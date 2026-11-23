import { NextRequest, NextResponse } from 'next/server'
import { consumeQuota, quotaExceeded, refundQuota } from '@/lib/usage/quota'
import { badRequest, guard, readJson, serverError, textField } from '@/lib/security/guard'
import { MAX_ESSAY_CHARS, MAX_TOPIC_CHARS, scoreEssay, scoringConfigured } from '@/lib/scoring/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Scores an essay without storing it (demo mode: the browser keeps the
 * writing). With Supabase the app uses /api/writings/[id]/feedback instead,
 * which scores the stored text and saves the result.
 */
export async function POST(req: NextRequest) {
  const denied = await guard(req, 'ai', { auth: true })
  if (denied) return denied
  const parsed = await readJson<{ content?: unknown; topic?: unknown }>(req)
  if (!parsed.ok) return parsed.response

  const content = textField(parsed.body.content, MAX_ESSAY_CHARS)
  const topic = textField(parsed.body.topic, MAX_TOPIC_CHARS)
  if (content === null) return badRequest('Metin çok uzun')
  if (topic === null) return badRequest('Konu çok uzun')
  if (!content || !topic) return badRequest('content and topic are required')
  if (!scoringConfigured()) return NextResponse.json({ error: 'GOOGLE_AI_API_KEY is not configured' }, { status: 500 })

  const quota = await consumeQuota(req, 'scoring')
  if (!quota.ok) return quotaExceeded('scoring', quota.limit)
  try {
    return NextResponse.json((await scoreEssay(topic, content)).score)
  } catch (err) {
    await refundQuota(req, 'scoring')
    return serverError('analyze', err, 'Değerlendirme yapılamadı')
  }
}
