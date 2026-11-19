import { NextRequest, NextResponse } from 'next/server'
import {
  DISCUSSION_COURSES,
  discussionPromptPrompt,
  FALLBACK_DISCUSSIONS,
  normalizeDiscussionPrompt,
} from '@/lib/toefl/academicDiscussion'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type AcademicDiscussionPrompt } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  const course = pickRandom(DISCUSSION_COURSES)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a precise TOEFL writing prompt author. You reply with JSON only.' },
        { role: 'user', content: discussionPromptPrompt(level, course, LEVEL_GUIDE[level]) },
      ],
      req.signal
    )
    const prompt = normalizeDiscussionPrompt(extractJson(raw))
    if (!prompt) throw new Error('Generated discussion failed validation')

    const body: AcademicDiscussionPrompt = { source: 'ai', level, course, ...prompt }
    return NextResponse.json(body)
  } catch (err) {
    console.warn('[toefl/academic-discussion] AI generation failed, using fallback:', err instanceof Error ? err.message : err)
    const body: AcademicDiscussionPrompt = { source: 'fallback', level, ...pickRandom(FALLBACK_DISCUSSIONS) }
    return NextResponse.json(body)
  }
}
