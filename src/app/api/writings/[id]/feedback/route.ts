import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth/admin'
import { mockFeedback } from '@/lib/mockAI'
import { consumeQuota, quotaExceeded, refundQuota } from '@/lib/usage/quota'
import { accountGuard, badRequest, serverError } from '@/lib/security/guard'
import {
  mockScoringAllowed,
  normalizeEssayScore,
  scoreEssay,
  scoringConfigured,
  type EssayScore,
  type ScoreSource,
} from '@/lib/scoring/server'
import { WRITING_SELECT, toWriting, type WritingRow } from '@/lib/data/rows'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadWriting(id: string, userId: string) {
  const { data, error } = await supabaseAdmin()
    .from('writings')
    .select(WRITING_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<WritingRow>()
  if (error) throw error
  return data ? toWriting(data) : null
}

/**
 * Scores a stored writing and saves the feedback. The text comes from the
 * database, not the request, so the score always belongs to what was saved.
 * A writing is scored once; asking again returns the saved feedback for free.
 */
export async function POST(req: NextRequest, ctx: RouteContext<'/api/writings/[id]/feedback'>) {
  const g = await accountGuard(req, 'ai')
  if (!g.ok) return g.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return badRequest('Geçersiz yazı')

  let writing
  try {
    writing = await loadWriting(id, g.userId)
  } catch (err) {
    return serverError('writings/feedback', err, 'Yazı okunamadı')
  }
  if (!writing) return NextResponse.json({ error: 'Yazı bulunamadı' }, { status: 404 })
  if (writing.has_feedback) return NextResponse.json(writing)

  let score: EssayScore
  let model: string | null = null
  let source: ScoreSource = 'ai'
  if (scoringConfigured()) {
    const quota = await consumeQuota(req, 'scoring')
    if (!quota.ok) return quotaExceeded('scoring', quota.limit)
    try {
      ;({ score, model } = await scoreEssay(writing.topic, writing.content))
    } catch (err) {
      await refundQuota(req, 'scoring')
      if (!mockScoringAllowed()) return serverError('writings/feedback', err, 'Değerlendirme yapılamadı', 502)
      console.warn('[writings/feedback] model failed, saving a sample score:', err instanceof Error ? err.message : err)
      score = normalizeEssayScore(mockFeedback(writing.content, writing.topic))
      source = 'mock'
    }
  } else if (mockScoringAllowed()) {
    score = normalizeEssayScore(mockFeedback(writing.content, writing.topic))
    source = 'mock'
  } else {
    return NextResponse.json({ error: 'Değerlendirme şu an kullanılamıyor' }, { status: 503 })
  }

  try {
    const { error } = await supabaseAdmin()
      .from('writing_feedback')
      .upsert(
        { writing_id: id, user_id: g.userId, ...score, source, model },
        { onConflict: 'writing_id', ignoreDuplicates: true }
      )
    if (error) throw error
    const saved = await loadWriting(id, g.userId)
    return NextResponse.json(saved)
  } catch (err) {
    if (source === 'ai') await refundQuota(req, 'scoring')
    return serverError('writings/feedback', err, 'Değerlendirme kaydedilemedi')
  }
}
