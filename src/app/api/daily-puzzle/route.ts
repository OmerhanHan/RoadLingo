import { NextRequest, NextResponse } from 'next/server'
import { accountGuard, badRequest, readJson, serverError } from '@/lib/security/guard'
import { applyAction, dailyView, PuzzleError, type PuzzleAction } from '@/lib/games/dailyWordServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Today's puzzle as the player sees it (the word only after the end). */
export async function GET(req: NextRequest) {
  const g = await accountGuard(req, 'content')
  if (!g.ok) return g.response
  try {
    return NextResponse.json(await dailyView(g.userId))
  } catch (err) {
    return serverError('daily-puzzle', err, 'Bulmaca yüklenemedi')
  }
}

/** { action: 'start' | 'hint' } or { action: 'guess', guess }: checked and scored on the server. */
export async function POST(req: NextRequest) {
  const g = await accountGuard(req, 'content')
  if (!g.ok) return g.response
  const parsed = await readJson<{ action?: unknown; guess?: unknown }>(req, 1000)
  if (!parsed.ok) return parsed.response
  const { action, guess } = parsed.body

  let input: PuzzleAction
  if (action === 'start' || action === 'hint') input = { action }
  else if (action === 'guess' && typeof guess === 'string' && guess.length <= 40) input = { action, guess }
  else return badRequest('Geçersiz istek')

  try {
    return NextResponse.json(await applyAction(g.userId, input))
  } catch (err) {
    if (err instanceof PuzzleError) return badRequest(err.message, err.status)
    return serverError('daily-puzzle', err, 'Bulmaca güncellenemedi')
  }
}
