/**
 * Shared request flow for content routes (server only):
 *
 *   1. an unseen item from the content bank        → source "bank"  (no AI cost)
 *   2. live AI generation, saved to the bank        → source "ai"    (only on a bank miss)
 *   3. a repeat from the bank, else built-in content → "bank" / "fallback"
 *
 * Live generation needs a signed-in user (Supabase mode); everyone else gets
 * the bank and built-in content. Every request counts toward the per-minute
 * 'content' limit (src/lib/security/guard.ts).
 *
 * Env:
 *   CONTENT_LIVE_AI=never     never call the model at request time (bank + fallback only)
 *   CONTENT_BANK_AUTOSAVE=0   do not write live generations to the bank
 *                             (default: on outside production)
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { ContentSource, ToeflLevel } from '@/lib/toefl/types'
import { consumeQuota, refundQuota } from '@/lib/usage/quota'
import { isSignedIn, rateLimit } from '@/lib/security/guard'
import { addToBank, contentId, pickAny, pickUnseen, type BankTask } from './bank'

const MAX_SEEN = 500

export function parseSeen(req: NextRequest): Set<string> {
  const raw = req.nextUrl.searchParams.get('seen') ?? ''
  return new Set(raw.split(',').filter((id) => /^[a-f0-9]{10}$/.test(id)).slice(-MAX_SEEN))
}

const liveAiEnabled = () => process.env.CONTENT_LIVE_AI !== 'never'
const autosaveEnabled = () =>
  process.env.CONTENT_BANK_AUTOSAVE ? process.env.CONTENT_BANK_AUTOSAVE !== '0' : process.env.NODE_ENV !== 'production'

export type ServeMeta = { source: ContentSource; contentId: string }

export async function serveContent<T, R>(opts: {
  task: BankTask
  req: NextRequest
  level: ToeflLevel
  /** Generates validated content with the AI; throws on failure. */
  generate: (signal: AbortSignal) => Promise<T>
  /** Built-in content for when nothing else is available. */
  fallback: () => T
  /** Per-request randomization (option shuffle, gaps…) + response shape. */
  finalize: (data: T, meta: ServeMeta) => R
  /** Restricts bank picks (e.g. a specific genre). */
  filter?: (data: T) => boolean
  /**
   * false: never generate during a user request; only the content script
   * (`fresh=1`, dev) does, so every item can be reviewed before users see it.
   */
  liveAi?: boolean
  /**
   * Curated built-in items that join the pool: once the bank has nothing new
   * for this user, an unseen one is served before anything repeats.
   */
  builtIn?: T[]
}): Promise<NextResponse> {
  const { task, req, level, generate, fallback, finalize, filter } = opts
  const limited = await rateLimit(req, 'content')
  if (limited) return limited
  const respond = (data: T, source: ContentSource, id = contentId(data)) =>
    NextResponse.json(finalize(data, { source, contentId: id }), { headers: { 'X-Content-Source': source } })

  // `fresh=1` (dev only) skips the bank: used by `npm run content:generate`.
  const forceFresh = req.nextUrl.searchParams.get('fresh') === '1' && process.env.NODE_ENV !== 'production'
  if (forceFresh) {
    try {
      const data = await generate(req.signal)
      const id = addToBank(task, level, data).id
      return respond(data, 'ai', id)
    } catch (err) {
      // Dev only (see forceFresh), so the reason is useful and safe to return.
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
    }
  }

  const seen = parseSeen(req)
  const unseen = pickUnseen<T>(task, level, seen, filter)
  if (unseen) return respond(unseen.data, 'bank', unseen.id)

  // Live generation costs money: signed-in users only (Supabase mode), within their daily limit.
  if (
    opts.liveAi !== false &&
    liveAiEnabled() &&
    (await isSignedIn(req)) &&
    (await consumeQuota(req, 'generation')).ok
  ) {
    try {
      const data = await generate(req.signal)
      let id = contentId(data)
      if (autosaveEnabled()) {
        try {
          id = addToBank(task, level, data).id
        } catch (err) {
          console.warn(`[content:${task}] could not save to bank:`, err instanceof Error ? err.message : err)
        }
      }
      return respond(data, 'ai', id)
    } catch (err) {
      await refundQuota(req, 'generation')
      console.warn(`[content:${task}] live generation failed:`, err instanceof Error ? err.message : err)
    }
  }

  const freshBuiltIn = (opts.builtIn ?? []).filter((d) => !seen.has(contentId(d)))
  if (freshBuiltIn.length) return respond(freshBuiltIn[Math.floor(Math.random() * freshBuiltIn.length)], 'fallback')

  const repeat = pickAny<T>(task, level, filter)
  if (repeat) return respond(repeat.data, 'bank', repeat.id)
  return respond(fallback(), 'fallback')
}
