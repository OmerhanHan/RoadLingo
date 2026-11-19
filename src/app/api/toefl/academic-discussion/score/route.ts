import { NextRequest, NextResponse } from 'next/server'
import { discussionScoringPrompt, normalizeDiscussionScore } from '@/lib/toefl/academicDiscussion'
import { extractJson, generateText } from '@/lib/toefl/generate'
import type { AcademicDiscussionPrompt } from '@/lib/toefl/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RESPONSE_CHARS = 4000

type Body = {
  prompt?: Pick<AcademicDiscussionPrompt, 'course' | 'professor' | 'students'>
  response?: string
}

function isPost(v: unknown): v is { name: string; text: string } {
  return !!v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string' && typeof (v as { text?: unknown }).text === 'string'
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const response = typeof body.response === 'string' ? body.response.trim() : ''
  const p = body.prompt
  if (!response) return NextResponse.json({ error: 'response required' }, { status: 400 })
  if (response.length > MAX_RESPONSE_CHARS) return NextResponse.json({ error: 'response too long' }, { status: 400 })
  if (!p || typeof p.course !== 'string' || !isPost(p.professor) || !Array.isArray(p.students) || !isPost(p.students[0]) || !isPost(p.students[1])) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a strict but fair TOEFL writing rater. You reply with JSON only.' },
        { role: 'user', content: discussionScoringPrompt({ course: p.course, professor: p.professor, students: [p.students[0], p.students[1]] }, response) },
      ],
      req.signal
    )
    const score = normalizeDiscussionScore(extractJson(raw), response)
    if (!score) throw new Error('Score failed validation')
    return NextResponse.json(score)
  } catch (err) {
    console.error('[toefl/academic-discussion/score]', err)
    return NextResponse.json(
      { error: 'Puanlama yapılamadı', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
