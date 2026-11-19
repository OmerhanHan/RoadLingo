import { NextRequest, NextResponse } from 'next/server'
import { shuffleOptions } from '@/lib/toefl/academicPassage'
import { DAILY_SCENARIOS, dailyLifePrompt, FALLBACK_DAILY, normalizeDailyText } from '@/lib/toefl/dailyLife'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type DailyGenre, type DailyLifeSet } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  // Avoid repeating the genre the client just saw.
  const skip = req.nextUrl.searchParams.get('skip') as DailyGenre | null
  // Optional: force a text type (?genre=menu).
  const only = req.nextUrl.searchParams.get('genre') as DailyGenre | null
  const pool = DAILY_SCENARIOS.filter((s) => (only ? s.genre === only : s.genre !== skip))
  const scenario = pickRandom(pool.length ? pool : DAILY_SCENARIOS)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a precise TOEFL reading item writer. You reply with JSON only.' },
        { role: 'user', content: dailyLifePrompt(level, scenario, LEVEL_GUIDE[level]) },
      ],
      req.signal
    )
    const item = normalizeDailyText(extractJson(raw), scenario.genre)
    if (!item) throw new Error('Generated daily-life text failed validation')

    const body: DailyLifeSet = {
      source: 'ai', level, scenario: scenario.scenario, text: item.text, questions: shuffleOptions(item.questions),
    }
    return NextResponse.json(body)
  } catch (err) {
    console.warn('[toefl/daily-life] AI generation failed, using fallback:', err instanceof Error ? err.message : err)
    const candidates = FALLBACK_DAILY.filter((f) => f.text.genre !== skip)
    const fb = pickRandom(candidates.length ? candidates : FALLBACK_DAILY)
    const body: DailyLifeSet = { source: 'fallback', level, ...fb, questions: shuffleOptions(fb.questions) }
    return NextResponse.json(body)
  }
}
