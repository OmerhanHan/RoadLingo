import { NextRequest, NextResponse } from 'next/server'
import { discussionScoringPrompt, normalizeDiscussionScore } from '@/lib/toefl/academicDiscussion'
import { extractJson, generateText, MAX_TOKENS } from '@/lib/toefl/generate'
import type { AcademicDiscussionPrompt } from '@/lib/toefl/types'
import { consumeQuota, quotaExceeded, refundQuota } from '@/lib/usage/quota'
import { badRequest, guard, readJson, serverError } from '@/lib/security/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RESPONSE_CHARS = 4000
/** The prompt comes back from the client, so its parts are capped too. */
const MAX_COURSE_CHARS = 120
const MAX_NAME_CHARS = 60
const MAX_POST_CHARS = 1500

type Body = {
  prompt?: Pick<AcademicDiscussionPrompt, 'course' | 'professor' | 'students'>
  response?: string
}

function isPost(v: unknown): v is { name: string; text: string } {
  if (!v || typeof v !== 'object') return false
  const { name, text } = v as { name?: unknown; text?: unknown }
  return (
    typeof name === 'string' &&
    typeof text === 'string' &&
    name.length <= MAX_NAME_CHARS &&
    text.length <= MAX_POST_CHARS
  )
}

export async function POST(req: NextRequest) {
  const denied = await guard(req, 'ai', { auth: true })
  if (denied) return denied
  const parsed = await readJson<Body>(req)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const response = typeof body.response === 'string' ? body.response.trim() : ''
  const p = body.prompt
  if (!response) return badRequest('response required')
  if (response.length > MAX_RESPONSE_CHARS) return badRequest('Cevap çok uzun')
  if (
    !p ||
    typeof p.course !== 'string' ||
    p.course.length > MAX_COURSE_CHARS ||
    !isPost(p.professor) ||
    !Array.isArray(p.students) ||
    p.students.length !== 2 ||
    !isPost(p.students[0]) ||
    !isPost(p.students[1])
  ) {
    return badRequest('Geçersiz soru')
  }

  const quota = await consumeQuota(req, 'scoring')
  if (!quota.ok) return quotaExceeded('scoring', quota.limit)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a strict but fair TOEFL writing rater. You reply with JSON only.' },
        { role: 'user', content: discussionScoringPrompt({ course: p.course, professor: p.professor, students: [p.students[0], p.students[1]] }, response) },
      ],
      req.signal,
      MAX_TOKENS.scoring,
      false
    )
    const score = normalizeDiscussionScore(extractJson(raw), response)
    if (!score) throw new Error('Score failed validation')
    return NextResponse.json(score)
  } catch (err) {
    await refundQuota(req, 'scoring')
    return serverError('toefl/academic-discussion/score', err, 'Puanlama yapılamadı', 502)
  }
}
