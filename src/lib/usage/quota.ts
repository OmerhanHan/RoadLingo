/**
 * Daily usage quotas for the paid AI features (server only).
 *
 * Limits come from the user's plan (src/lib/plans.ts), sent by the client in
 * the X-Plan header. Enforced in production, or anywhere with QUOTA_ENFORCE=1
 * (QUOTA_ENFORCE=0 turns it off).
 *
 * Counters are kept in memory per device (X-User-Id) or IP and reset daily
 * (UTC). That is enough for a single server; with several instances move the
 * counter to a shared store (Redis / Supabase). Until payments go through a
 * real provider, X-Plan is trusted as sent — the plan must then come from the
 * backend instead.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getPlanById, type LimitKind, type PlanId } from '@/lib/plans'

export type QuotaKind = LimitKind

const MESSAGE: Record<QuotaKind, string> = {
  scoring: 'Bugünkü yazı değerlendirme hakkın doldu. Yarın yenilenir ya da planını yükseltebilirsin.',
  chat: 'Bugünkü canlı konuşma hakkın doldu. Yarın yenilenir ya da planını yükseltebilirsin.',
  generation: 'Bugünkü yeni içerik üretme hakkın doldu.',
}

export function quotaEnforced(): boolean {
  const flag = process.env.QUOTA_ENFORCE
  if (flag === '1') return true
  if (flag === '0') return false
  return process.env.NODE_ENV === 'production'
}

export function requestPlan(req: NextRequest): PlanId {
  return getPlanById(req.headers.get('x-plan')).id
}

export function quotaLimit(req: NextRequest, kind: QuotaKind): number {
  return getPlanById(requestPlan(req)).limits[kind]
}

const counters = new Map<string, number>()
let counterDay = ''

function rollDay() {
  const day = new Date().toISOString().slice(0, 10)
  if (day !== counterDay) {
    counters.clear()
    counterDay = day
  }
}

export function clientKey(req: NextRequest): string {
  const user = req.headers.get('x-user-id')
  if (user && /^[\w-]{3,64}$/.test(user)) return `u:${user}`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  return `ip:${ip}`
}

const counterKey = (req: NextRequest, kind: QuotaKind) => `${kind}:${clientKey(req)}`

export type QuotaResult = { ok: true; remaining: number | null } | { ok: false; limit: number }

/** Counts one use. Returns ok:false (without counting) once the daily limit is reached. */
export function consumeQuota(req: NextRequest, kind: QuotaKind): QuotaResult {
  if (!quotaEnforced()) return { ok: true, remaining: null }
  rollDay()
  const limit = quotaLimit(req, kind)
  const key = counterKey(req, kind)
  const used = counters.get(key) ?? 0
  if (used >= limit) return { ok: false, limit }
  counters.set(key, used + 1)
  return { ok: true, remaining: limit - used - 1 }
}

/** Gives a use back (e.g. when the AI call failed and nothing was delivered). */
export function refundQuota(req: NextRequest, kind: QuotaKind) {
  if (!quotaEnforced()) return
  const key = counterKey(req, kind)
  const used = counters.get(key) ?? 0
  if (used > 0) counters.set(key, used - 1)
}

/** Today's usage for the requesting device under its plan. */
export function usageFor(req: NextRequest) {
  rollDay()
  const plan = requestPlan(req)
  const kinds: QuotaKind[] = ['scoring', 'chat', 'generation']
  return {
    plan,
    enforced: quotaEnforced(),
    usage: Object.fromEntries(
      kinds.map((k) => [k, { used: counters.get(counterKey(req, k)) ?? 0, limit: quotaLimit(req, k) }])
    ) as Record<QuotaKind, { used: number; limit: number }>,
  }
}

export function quotaExceeded(kind: QuotaKind, limit: number) {
  return NextResponse.json(
    { error: MESSAGE[kind], code: 'quota_exceeded', limit },
    { status: 429, headers: { 'Retry-After': '3600' } }
  )
}
