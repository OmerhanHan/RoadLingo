import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import {
  answerTimeFor,
  LISTEN_REPEAT_FALLBACKS,
  LISTEN_REPEAT_SCENARIOS,
  listenRepeatPrompt,
  normalizeListenRepeat,
  type ListenRepeatContent,
  type ListenRepeatSet,
} from '@/lib/toefl/listenRepeat'
import { parseLevel } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'
import { pickVoices } from '@/lib/speaking/tts/voices'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One Listen and Repeat set: a scenario and seven sentences, short to long.
 * Learners repeat these word for word, so an awkward sentence would teach the
 * wrong English: only reviewed bank items and the handwritten sets are served.
 * `generate` runs for the content script (`npm run content:generate -- --tasks listen-repeat`).
 */
export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  const own = LISTEN_REPEAT_FALLBACKS.filter((f) => f.level === level).map((f) => f.content)

  return serveContent<ListenRepeatContent, ListenRepeatSet>({
    task: 'listen-repeat',
    req,
    level,
    liveAi: false,
    builtIn: own,
    async generate(signal) {
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL speaking item writer. You reply with JSON only.' },
          { role: 'user', content: listenRepeatPrompt(level, pickRandom(LISTEN_REPEAT_SCENARIOS), LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const content = normalizeListenRepeat(extractJson(raw), level)
      if (!content) throw new Error('Generated listen-and-repeat set failed validation')
      return content
    },
    fallback: () => pickRandom(own.length ? own : LISTEN_REPEAT_FALLBACKS.map((f) => f.content)),
    finalize: (data, meta) => ({
      ...meta,
      level,
      ...data,
      voice: pickVoices([data.gender])[0],
      answerTime: data.sentences.map(answerTimeFor),
    }),
  })
}
