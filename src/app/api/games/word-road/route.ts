import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import { extractJson, generateText, LEVEL_GUIDE, MAX_TOKENS } from '@/lib/toefl/generate'
import { parseLevel } from '@/lib/toefl/types'
import { pickRandom, shuffle } from '@/lib/toefl/utils'
import {
  keepCheckedStops,
  normalizeRoute,
  routeCheckPlan,
  STOP_TIME,
  WORD_ROAD_FALLBACKS,
  WORD_ROAD_THEMES,
  wordRoadPrompt,
  type WordRoadSet,
  type WordRoute,
} from '@/lib/games/wordRoad'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One Kelime Yolculuğu route: from the content bank, else a built-in route.
 * Never a live model call (no cost, no daily limit); `generate` only runs for
 * the content script (`npm run content:generate -- --tasks word-road`).
 */
export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<WordRoute, WordRoadSet>({
    task: 'word-road',
    req,
    level,
    // Distractors that also fit would teach the wrong thing: only reviewed bank items reach players.
    liveAi: false,
    builtIn: WORD_ROAD_FALLBACKS.filter((f) => f.level === level).map((f) => f.route),
    async generate(signal) {
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a careful English vocabulary teacher. You reply with JSON only.' },
          { role: 'user', content: wordRoadPrompt(level, pickRandom(WORD_ROAD_THEMES), LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const draft = normalizeRoute(extractJson(raw))
      if (!draft) throw new Error('Generated route failed validation')

      // Blind second check: keep only questions where exactly the intended option fits.
      const plan = routeCheckPlan(draft)
      const verdict = await generateText(
        [
          { role: 'system', content: 'You are a strict English vocabulary checker. You reply with JSON only.' },
          { role: 'user', content: plan.prompt },
        ],
        signal,
        MAX_TOKENS.scoring,
        false
      )
      const checked = keepCheckedStops(draft, (extractJson(verdict) as { answers?: unknown } | null)?.answers, plan.expected)
      if (!checked) throw new Error('Too few questions passed the check')
      return checked
    },
    fallback: () => {
      const own = WORD_ROAD_FALLBACKS.filter((f) => f.level === level)
      return pickRandom(own.length ? own : WORD_ROAD_FALLBACKS).route
    },
    finalize: (data, meta) => ({
      ...meta,
      level,
      title: data.title,
      stops: data.stops.map((s) => ({ ...s, options: shuffle(s.options) })),
      stopTime: STOP_TIME[level],
    }),
  })
}
