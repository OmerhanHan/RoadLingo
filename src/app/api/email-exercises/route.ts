import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth/admin'
import { mockEmailAnalysis, type EmailAnalysis } from '@/lib/emailAnalysis'
import { QUOTA_MESSAGE, consumeQuota, refundQuota } from '@/lib/usage/quota'
import { accountGuard, badRequest, readJson, serverError, textField } from '@/lib/security/guard'
import {
  MAX_ESSAY_CHARS,
  MAX_HEADER_CHARS,
  MAX_SCENARIO_CHARS,
  countWords,
  mockScoringAllowed,
  scoreEmail,
  scoringConfigured,
  type ScoreSource,
} from '@/lib/scoring/server'
import { EMAIL_SELECT, toEmailExercise, type EmailExerciseRow } from '@/lib/data/rows'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ID = /^[\w-]{1,80}$/

type Scored =
  | { analysis: EmailAnalysis; source: ScoreSource }
  | { analysis: null; error: string; quota?: { kind: 'scoring'; limit: number } }

async function score(req: NextRequest, params: { to: string; subject: string; body: string; scenario: string }): Promise<Scored> {
  if (!params.body) return { analysis: null, error: 'Boş e-posta değerlendirilmedi.' }
  if (!scoringConfigured()) {
    return mockScoringAllowed()
      ? { analysis: mockEmailAnalysis(params.body), source: 'mock' }
      : { analysis: null, error: 'Değerlendirme şu an kullanılamıyor.' }
  }
  const quota = await consumeQuota(req, 'scoring')
  if (!quota.ok) return { analysis: null, error: QUOTA_MESSAGE.scoring, quota: { kind: 'scoring', limit: quota.limit } }
  try {
    return { analysis: await scoreEmail(params), source: 'ai' }
  } catch (err) {
    await refundQuota(req, 'scoring')
    if (mockScoringAllowed()) {
      console.warn('[email-exercises] model failed, saving a sample analysis:', err instanceof Error ? err.message : err)
      return { analysis: mockEmailAnalysis(params.body), source: 'mock' }
    }
    console.error('[email-exercises] scoring failed:', err)
    return { analysis: null, error: 'Analiz tamamlanamadı. E-postan kaydedildi.' }
  }
}

/**
 * Saves a finished email exercise and scores it (Supabase mode). The exercise
 * is kept even when scoring fails or the daily limit is reached; the answer
 * then carries `error` (and `quota` for the upgrade prompt).
 */
export async function POST(req: NextRequest) {
  const g = await accountGuard(req, 'ai')
  if (!g.ok) return g.response
  const parsed = await readJson<Record<string, unknown>>(req)
  if (!parsed.ok) return parsed.response
  const b = parsed.body

  const body = textField(b.body, MAX_ESSAY_CHARS)
  const scenario = textField(b.scenario, MAX_SCENARIO_CHARS)
  const to = textField(b.to, MAX_HEADER_CHARS)
  const subject = textField(b.subject, MAX_HEADER_CHARS)
  const titleTr = textField(b.title_tr, MAX_HEADER_CHARS)
  const scenarioId = typeof b.scenario_id === 'string' && ID.test(b.scenario_id) ? b.scenario_id : null
  const category = typeof b.category === 'string' && /^[a-z_]{1,40}$/.test(b.category) ? b.category : null
  if (body === null) return badRequest('Metin çok uzun')
  if (scenario === null || to === null || subject === null || titleTr === null) return badRequest('Alanlardan biri çok uzun')
  if (!scenario || !scenarioId || !category) return badRequest('Senaryo bilgisi eksik')

  const result = await score(req, { to, subject, body, scenario })

  try {
    const { data, error } = await supabaseAdmin()
      .from('email_exercises')
      .insert({
        user_id: g.userId,
        scenario_id: scenarioId,
        category,
        title_tr: titleTr,
        recipient: to,
        subject,
        body,
        word_count: countWords(body),
        analysis: result.analysis,
        analysis_source: result.analysis ? (result as { source: ScoreSource }).source : null,
      })
      .select(EMAIL_SELECT)
      .single<EmailExerciseRow>()
    if (error) throw error
    return NextResponse.json(
      {
        exercise: toEmailExercise(data),
        error: result.analysis ? null : result.error,
        quota: result.analysis ? null : (result.quota ?? null),
      },
      { status: 201 }
    )
  } catch (err) {
    if (result.analysis && (result as { source: ScoreSource }).source === 'ai') await refundQuota(req, 'scoring')
    return serverError('email-exercises', err, 'E-posta kaydedilemedi')
  }
}
