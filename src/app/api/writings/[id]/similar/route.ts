import { NextRequest, NextResponse } from 'next/server'
import { accountGuard, badRequest, serverError } from '@/lib/security/guard'
import { similarWritings } from '@/lib/vectors/writings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The user's earlier writings closest in meaning to this one (by vector).
 * Empty while the writing is still waiting for its vector.
 */
export async function GET(req: NextRequest, ctx: RouteContext<'/api/writings/[id]/similar'>) {
  const g = await accountGuard(req, 'data')
  if (!g.ok) return g.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return badRequest('Geçersiz yazı')
  try {
    return NextResponse.json({ similar: await similarWritings(g.userId, id) })
  } catch (err) {
    return serverError('writings/similar', err, 'Benzer yazılar bulunamadı')
  }
}
