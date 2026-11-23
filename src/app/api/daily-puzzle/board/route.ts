import { NextRequest, NextResponse } from 'next/server'
import { accountGuard, serverError } from '@/lib/security/guard'
import { dailyBoard } from '@/lib/games/dailyWordServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Today's leaderboard: the top 20 and the player's own place. Names only, never ids or emails. */
export async function GET(req: NextRequest) {
  const g = await accountGuard(req, 'content')
  if (!g.ok) return g.response
  try {
    return NextResponse.json(await dailyBoard(g.userId))
  } catch (err) {
    return serverError('daily-puzzle/board', err, 'Sıralama yüklenemedi')
  }
}
