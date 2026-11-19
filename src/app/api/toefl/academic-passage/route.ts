import { NextRequest, NextResponse } from 'next/server'
import {
  ACADEMIC_PASSAGE_TOPICS,
  academicPassagePrompt,
  FALLBACK_PASSAGES,
  normalizePassage,
  shuffleOptions,
} from '@/lib/toefl/academicPassage'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type AcademicPassageSet } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  const topic = pickRandom(ACADEMIC_PASSAGE_TOPICS)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a precise TOEFL reading item writer. You reply with JSON only.' },
        { role: 'user', content: academicPassagePrompt(level, topic, LEVEL_GUIDE[level]) },
      ],
      req.signal
    )
    const passage = normalizePassage(extractJson(raw))
    if (!passage) throw new Error('Generated passage failed validation')

    const body: AcademicPassageSet = {
      source: 'ai', level, topic, ...passage, questions: shuffleOptions(passage.questions),
    }
    return NextResponse.json(body)
  } catch (err) {
    console.warn('[toefl/academic-passage] AI generation failed, using fallback:', err instanceof Error ? err.message : err)
    const fb = pickRandom(FALLBACK_PASSAGES)
    const body: AcademicPassageSet = { source: 'fallback', level, ...fb, questions: shuffleOptions(fb.questions) }
    return NextResponse.json(body)
  }
}
