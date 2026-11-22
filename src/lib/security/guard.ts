/**
 * Request guards shared by the API routes (server only).
 *
 *   requireUser   Supabase mode: AI routes need a verified sign-in, so the
 *                 free allowance cannot be multiplied with fake IP headers.
 *   rateLimit     Requests per minute per caller, on top of the daily plan
 *                 limits (stops bursts and scripted hammering).
 *   readJson      Body size cap before parsing.
 *   serverError   Error response without internal details in production.
 *
 * With Supabase the per-minute counters are kept in the rate_limits table
 * (rate_limit_hit function), shared by every server instance. Without it, or
 * while the database cannot be reached, each instance counts in memory.
 * RATE_LIMIT=0 turns the per-minute limit off.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { serverSupabaseEnabled, supabaseAdmin } from '@/lib/auth/admin'
import { getCaller } from '@/lib/auth/server'

/* ── Sign-in ── */

/** Supabase mode: 401 unless the request carries a valid session. Demo mode: always passes. */
export async function requireUser(req: NextRequest): Promise<NextResponse | null> {
  if (!serverSupabaseEnabled) return null
  const caller = await getCaller(req)
  if (caller.userId) return null
  return NextResponse.json(
    { error: 'Bu özellik için oturum açman gerekiyor.', code: 'auth_required' },
    { status: 401 }
  )
}

/** Whether the request comes from a signed-in user (always true in demo mode). */
export async function isSignedIn(req: NextRequest): Promise<boolean> {
  return !serverSupabaseEnabled || (await getCaller(req)).userId !== null
}

/* ── Per-minute limit ── */

/** Requests per minute, per caller and bucket. */
export const RATE_LIMITS = {
  /** Scoring and live conversation: a model call each. */
  ai: 12,
  /** Server voice: many short clips per listening set. */
  tts: 40,
  /** Content and game rounds (mostly served from the bank). */
  content: 30,
  /** Subscription changes. */
  account: 10,
} as const

export type RateBucket = keyof typeof RATE_LIMITS

const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()
let lastSweep = 0

const rateLimitEnabled = () => process.env.RATE_LIMIT !== '0'

function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return
  lastSweep = now
  for (const [key, times] of hits) {
    if (!times.length || now - times[times.length - 1] >= WINDOW_MS) hits.delete(key)
  }
}

/** In-memory sliding window. Returns 0 when allowed, else seconds to wait. */
function memoryHit(key: string, limit: number): number {
  const now = Date.now()
  sweep(now)
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000))
  }
  recent.push(now)
  hits.set(key, recent)
  return 0
}

let lastDbError = 0

/** Shared counter in Supabase; null when the database could not be reached. */
async function databaseHit(key: string, limit: number): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: WINDOW_MS / 1000,
    })
    if (error) throw error
    return typeof data === 'number' ? data : 0
  } catch (err) {
    // Once a minute is enough to notice (e.g. the migration was not run).
    if (Date.now() - lastDbError > WINDOW_MS) {
      lastDbError = Date.now()
      console.error('[rate-limit] rate_limit_hit failed, counting in memory:', err instanceof Error ? err.message : err)
    }
    return null
  }
}

/** 429 once the caller has used this bucket's allowance in the last minute; otherwise counts the request. */
export async function rateLimit(req: NextRequest, bucket: RateBucket): Promise<NextResponse | null> {
  if (!rateLimitEnabled()) return null
  const key = `${bucket}:${(await getCaller(req)).subject}`
  const limit = RATE_LIMITS[bucket]
  const wait = (serverSupabaseEnabled ? await databaseHit(key, limit) : null) ?? memoryHit(key, limit)
  if (wait === 0) return null
  return NextResponse.json(
    { error: 'Çok hızlı istek gönderildi. Birkaç saniye sonra tekrar dene.', code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(wait) } }
  )
}

/** Sign-in (if required) and then the per-minute limit. */
export async function guard(
  req: NextRequest,
  bucket: RateBucket,
  opts: { auth?: boolean } = {}
): Promise<NextResponse | null> {
  if (opts.auth) {
    const denied = await requireUser(req)
    if (denied) return denied
  }
  return rateLimit(req, bucket)
}

/* ── Input ── */

/** Largest JSON body any route accepts (the longest field is a 6000-character essay). */
export const MAX_BODY_BYTES = 32_000

export type JsonBody<T> = { ok: true; body: T } | { ok: false; response: NextResponse }

/** Parses the JSON body, rejecting oversized or malformed ones. */
export async function readJson<T>(req: NextRequest, maxBytes = MAX_BODY_BYTES): Promise<JsonBody<T>> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > maxBytes) return { ok: false, response: badRequest('İstek çok büyük', 413) }
  let text: string
  try {
    text = await req.text()
  } catch {
    return { ok: false, response: badRequest('İstek okunamadı') }
  }
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, response: badRequest('İstek çok büyük', 413) }
  try {
    const body = JSON.parse(text) as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, response: badRequest('Geçersiz istek') }
    return { ok: true, body: body as T }
  } catch {
    return { ok: false, response: badRequest('Geçersiz istek') }
  }
}

export function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

/** A trimmed string no longer than `max`, '' when absent, or null when it is not a string or too long. */
export function textField(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length > max ? null : text
}

/* ── Errors ── */

/** Logs the error and answers with a plain message; the internal detail is only sent outside production. */
export function serverError(tag: string, err: unknown, error: string, status = 500) {
  console.error(`[${tag}]`, err)
  const body: { error: string; detail?: string } = { error }
  if (process.env.NODE_ENV !== 'production') body.detail = err instanceof Error ? err.message : String(err)
  return NextResponse.json(body, { status })
}
