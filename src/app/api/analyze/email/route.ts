import { NextRequest, NextResponse } from 'next/server'
import { consumeQuota, quotaExceeded, refundQuota } from '@/lib/usage/quota'
import { badRequest, guard, readJson, serverError, textField } from '@/lib/security/guard'
import {
  MAX_ESSAY_CHARS,
  MAX_HEADER_CHARS,
  MAX_SCENARIO_CHARS,
  scoreEmail,
  scoringConfigured,
} from '@/lib/scoring/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Scores an email without storing it (demo mode). With Supabase the app uses
 * /api/email-exercises, which saves the exercise and its analysis.
 */
export async function POST(req: NextRequest) {
  const denied = await guard(req, 'ai', { auth: true })
  if (denied) return denied
  const parsed = await readJson<Record<string, unknown>>(req)
  if (!parsed.ok) return parsed.response

  const body = textField(parsed.body.body, MAX_ESSAY_CHARS)
  const scenario = textField(parsed.body.scenario, MAX_SCENARIO_CHARS)
  const to = textField(parsed.body.to, MAX_HEADER_CHARS)
  const subject = textField(parsed.body.subject, MAX_HEADER_CHARS)
  if (body === null) return badRequest('Metin çok uzun')
  if (scenario === null || to === null || subject === null) return badRequest('Alanlardan biri çok uzun')
  if (!body) return badRequest('body is required')
  if (!scenario) return badRequest('scenario is required')
  if (!scoringConfigured()) return NextResponse.json({ error: 'GOOGLE_AI_API_KEY is not configured' }, { status: 500 })

  const quota = await consumeQuota(req, 'scoring')
  if (!quota.ok) return quotaExceeded('scoring', quota.limit)
  try {
    return NextResponse.json(await scoreEmail({ to, subject, body, scenario }))
  } catch (err) {
    await refundQuota(req, 'scoring')
    return serverError('analyze/email', err, 'E-posta değerlendirmesi yapılamadı')
  }
}
