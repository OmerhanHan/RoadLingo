import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import {
  ERROR_HUNT_FALLBACKS,
  ERROR_HUNT_TOPICS,
  errorHuntPrompt,
  injectErrors,
  keepVerified,
  TIME_LIMIT,
  toSegments,
  verificationPlan,
  type ErrorHuntContent,
  type ErrorHuntSet,
} from '@/lib/games/errorHunt'
import { extractJson, generateText, LEVEL_GUIDE, MAX_TOKENS } from '@/lib/toefl/generate'
import { parseLevel } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One Hata Avı round: from the content bank, else a built-in round. Never a
 * live model call (no cost, no daily limit); `generate` only runs for the
 * content script (`npm run content:generate -- --tasks error-hunt`).
 */
export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<ErrorHuntContent, ErrorHuntSet>({
    task: 'error-hunt',
    req,
    level,
    // Small models sometimes mark correct English as wrong: only reviewed bank items reach players.
    liveAi: false,
    async generate(signal) {
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a careful English grammar teacher. You reply with JSON only.' },
          { role: 'user', content: errorHuntPrompt(level, pickRandom(ERROR_HUNT_TOPICS), LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const draft = injectErrors(extractJson(raw))
      if (!draft) throw new Error('Generated error hunt failed validation')

      // Second, blind check of every error: drops corruptions that are not clearly wrong.
      const plan = verificationPlan(draft)
      const verdict = await generateText(
        [
          { role: 'system', content: 'You are a strict English grammar checker. You reply with JSON only.' },
          { role: 'user', content: plan.prompt },
        ],
        signal,
        MAX_TOKENS.scoring,
        false
      )
      const checked = keepVerified(draft, (extractJson(verdict) as { answers?: unknown } | null)?.answers, plan.expected)
      if (!checked) throw new Error('Too few errors passed the grammar check')
      return checked
    },
    fallback: () => {
      const own = ERROR_HUNT_FALLBACKS.filter((f) => f.level === level)
      return pickRandom(own.length ? own : ERROR_HUNT_FALLBACKS).content
    },
    finalize: (data, meta) => ({
      ...meta,
      level,
      title: data.title,
      segments: toSegments(data.passage),
      errors: data.errors,
      timeLimit: TIME_LIMIT[level],
    }),
  })
}
