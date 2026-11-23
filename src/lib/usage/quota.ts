/**
 * Daily usage quotas for the paid AI features (server only).
 *
 * Limits come from the caller's plan (src/lib/plans.ts); who the caller is
 * and which plan they are on is decided in src/lib/auth/server.ts. Enforced
 * in production, or anywhere with QUOTA_ENFORCE=1 (QUOTA_ENFORCE=0 turns it
 * off).
 *
 * With Supabase the counters live in the usage_daily table (atomic
 * consume_usage function), so they survive restarts and are shared by every
 * server instance. Without it, or if the database cannot be reached, they
 * are kept in memory. Days are UTC: counters reset at 03:00 Turkey time.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { PLAN_BUDGETS, getPlanById, type BudgetKind, type LimitKind } from '@/lib/plans'
import { serverSupabaseEnabled, supabaseAdmin } from '@/lib/auth/admin'
import { getCaller } from '@/lib/auth/server'

export type QuotaKind = LimitKind

/** Shown when a daily limit is reached. */
export const QUOTA_MESSAGE: Record<QuotaKind, string> = {
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

const today = () => new Date().toISOString().slice(0, 10)

/* ── Counter stores ── */

const memory = new Map<string, number>()
let memoryDay = ''

function memoryKey(subject: string, kind: string) {
  const day = today()
  if (day !== memoryDay) {
    memory.clear()
    memoryDay = day
  }
  return `${kind}:${subject}`
}

const memoryStore = {
  consume(subject: string, kind: string, amount: number, limit: number): boolean {
    const key = memoryKey(subject, kind)
    const used = memory.get(key) ?? 0
    if (used + amount > limit) return false
    memory.set(key, used + amount)
    return true
  },
  refund(subject: string, kind: string, amount: number) {
    const key = memoryKey(subject, kind)
    memory.set(key, Math.max(0, (memory.get(key) ?? 0) - amount))
  },
  used(subject: string, kind: string): number {
    return memory.get(memoryKey(subject, kind)) ?? 0
  },
}

async function consume(subject: string, kind: string, amount: number, limit: number): Promise<boolean> {
  if (serverSupabaseEnabled) {
    const { data, error } = await supabaseAdmin().rpc('consume_usage', {
      p_subject: subject,
      p_day: today(),
      p_kind: kind,
      p_amount: amount,
      p_limit: limit,
    })
    if (!error) return data === true
    // Still limited (per server instance) while the database is unreachable.
    console.error('[quota] consume_usage failed, counting in memory:', error.message)
  }
  return memoryStore.consume(subject, kind, amount, limit)
}

async function refund(subject: string, kind: string, amount: number) {
  if (serverSupabaseEnabled) {
    const { error } = await supabaseAdmin().rpc('refund_usage', {
      p_subject: subject,
      p_day: today(),
      p_kind: kind,
      p_amount: amount,
    })
    if (!error) return
    console.error('[quota] refund_usage failed:', error.message)
  }
  memoryStore.refund(subject, kind, amount)
}

/* ── Plan limits (shown to the user) ── */

export type QuotaResult = { ok: true } | { ok: false; limit: number }

/** Counts one use. Returns ok:false (without counting) once the daily limit is reached. */
export async function consumeQuota(req: NextRequest, kind: QuotaKind): Promise<QuotaResult> {
  if (!quotaEnforced()) return { ok: true }
  const caller = await getCaller(req)
  const limit = getPlanById(caller.plan).limits[kind]
  return (await consume(caller.subject, kind, 1, limit)) ? { ok: true } : { ok: false, limit }
}

/** Gives a use back (e.g. when the AI call failed and nothing was delivered). */
export async function refundQuota(req: NextRequest, kind: QuotaKind) {
  if (!quotaEnforced()) return
  await refund((await getCaller(req)).subject, kind, 1)
}

/* ── Internal budgets (see PLAN_BUDGETS; not shown to the user) ── */

/**
 * Like consumeQuota, but an amount per call (e.g. characters). Returns false,
 * without counting, when the amount does not fit in what is left today.
 */
export async function consumeBudget(req: NextRequest, kind: BudgetKind, amount = 1): Promise<boolean> {
  if (!quotaEnforced()) return true
  const caller = await getCaller(req)
  return consume(caller.subject, kind, amount, PLAN_BUDGETS[caller.plan][kind])
}

export async function refundBudget(req: NextRequest, kind: BudgetKind, amount = 1) {
  if (!quotaEnforced()) return
  await refund((await getCaller(req)).subject, kind, amount)
}

/* ── Usage summary (plans page and home card) ── */

const LIMIT_KINDS: QuotaKind[] = ['scoring', 'chat', 'generation']

export async function usageFor(req: NextRequest) {
  const caller = await getCaller(req)
  const plan = getPlanById(caller.plan)
  const used: Record<string, number> = {}

  if (serverSupabaseEnabled) {
    const { data, error } = await supabaseAdmin()
      .from('usage_daily')
      .select('kind, used')
      .eq('subject', caller.subject)
      .eq('day', today())
    if (error) console.error('[quota] could not read usage:', error.message)
    for (const row of (data ?? []) as { kind: string; used: number }[]) used[row.kind] = row.used
  } else {
    for (const k of LIMIT_KINDS) used[k] = memoryStore.used(caller.subject, k)
  }

  return {
    plan: plan.id,
    signedIn: caller.userId !== null,
    enforced: quotaEnforced(),
    usage: Object.fromEntries(
      LIMIT_KINDS.map((k) => [k, { used: used[k] ?? 0, limit: plan.limits[k] }])
    ) as Record<QuotaKind, { used: number; limit: number }>,
  }
}

export function quotaExceeded(kind: QuotaKind, limit: number) {
  return NextResponse.json(
    { error: QUOTA_MESSAGE[kind], code: 'quota_exceeded', kind, limit },
    { status: 429, headers: { 'Retry-After': '3600' } }
  )
}
