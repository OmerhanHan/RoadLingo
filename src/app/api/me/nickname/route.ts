import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth/admin'
import { accountGuard, badRequest, readJson, serverError } from '@/lib/security/guard'
import { nicknameProblem } from '@/lib/games/dailyWordServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sets the nickname shown on leaderboards. Written by the server (not by the
 * browser through RLS) so that names that are not allowed can be refused.
 */
export async function PUT(req: NextRequest) {
  const g = await accountGuard(req, 'account')
  if (!g.ok) return g.response
  const parsed = await readJson<{ nickname?: unknown }>(req, 500)
  if (!parsed.ok) return parsed.response
  const nickname = typeof parsed.body.nickname === 'string' ? parsed.body.nickname.trim() : ''
  const problem = nicknameProblem(nickname)
  if (problem) return badRequest(problem)

  try {
    const { error } = await supabaseAdmin().from('profiles').update({ nickname }).eq('id', g.userId)
    if (error?.code === '23505') return badRequest('Bu takma ad alınmış, başka bir tane dene.', 409)
    if (error) throw error
    return NextResponse.json({ nickname })
  } catch (err) {
    return serverError('me/nickname', err, 'Takma ad kaydedilemedi')
  }
}
