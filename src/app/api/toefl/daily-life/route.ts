import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import { shuffleOptions } from '@/lib/toefl/academicPassage'
import { DAILY_SCENARIOS, dailyLifePrompt, FALLBACK_DAILY, normalizeDailyText } from '@/lib/toefl/dailyLife'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type DailyGenre, type DailyLifeSet, type DailyText, type PassageQuestion } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Content = { scenario: string; text: DailyText; questions: PassageQuestion[] }

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  // Avoid repeating the genre the client just saw; optionally force one (?genre=menu).
  const skip = req.nextUrl.searchParams.get('skip') as DailyGenre | null
  const only = req.nextUrl.searchParams.get('genre') as DailyGenre | null
  const allowed = (g: DailyGenre) => (only ? g === only : g !== skip)

  return serveContent<Content, DailyLifeSet>({
    task: 'daily-life',
    req,
    level,
    filter: (data) => allowed(data.text.genre),
    async generate(signal) {
      const pool = DAILY_SCENARIOS.filter((s) => allowed(s.genre))
      const scenario = pickRandom(pool.length ? pool : DAILY_SCENARIOS)
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL reading item writer. You reply with JSON only.' },
          { role: 'user', content: dailyLifePrompt(level, scenario, LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const item = normalizeDailyText(extractJson(raw), scenario.genre)
      if (!item) throw new Error('Generated daily-life text failed validation')
      return { scenario: scenario.scenario, ...item }
    },
    fallback: () => {
      const candidates = FALLBACK_DAILY.filter((f) => allowed(f.text.genre))
      return pickRandom(candidates.length ? candidates : FALLBACK_DAILY)
    },
    finalize: (data, meta) => ({ ...meta, level, ...data, questions: shuffleOptions(data.questions) }),
  })
}
