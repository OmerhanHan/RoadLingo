/**
 * Who is calling an API route, and on which plan (server only).
 *
 * Supabase mode: the user comes from the `Authorization: Bearer <token>`
 * header (verified with Supabase) and the plan from the subscriptions table.
 * Requests without a valid token count as the free plan, per IP address.
 * Tokens (not cookies) so the same API works for the web and the mobile app.
 *
 * Demo mode (no Supabase yet): the plan and device id sent by the browser
 * (X-Plan / X-User-Id) are trusted as before.
 */
import type { NextRequest } from 'next/server'
import {
  activePlanId,
  defaultSubscription,
  getPlanById,
  type BillingCycle,
  type PaymentRecord,
  type PlanId,
  type SubscriptionState,
} from '@/lib/plans'
import { serverSupabaseEnabled, supabaseAdmin } from './admin'

export type Caller = {
  /** Key the usage counters are kept under: 'u:<user id>', 'd:<device>' or 'ip:<address>'. */
  subject: string
  plan: PlanId
  /** Verified Supabase user, or null. */
  userId: string | null
}

function ipSubject(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  return `ip:${ip}`
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match ? match[1] : null
}

/** The verified Supabase user id of the request, or null. */
export async function requestUserId(req: NextRequest): Promise<string | null> {
  if (!serverSupabaseEnabled) return null
  const token = bearerToken(req)
  if (!token) return null
  try {
    const { data, error } = await supabaseAdmin().auth.getClaims(token)
    const sub = data?.claims?.sub
    return !error && typeof sub === 'string' ? sub : null
  } catch (err) {
    console.warn('[auth] token check failed:', err instanceof Error ? err.message : err)
    return null
  }
}

async function resolveCaller(req: NextRequest): Promise<Caller> {
  if (!serverSupabaseEnabled) {
    const device = req.headers.get('x-user-id')
    const subject = device && /^[\w-]{3,64}$/.test(device) ? `d:${device}` : ipSubject(req)
    return { subject, plan: getPlanById(req.headers.get('x-plan')).id, userId: null }
  }
  const userId = await requestUserId(req)
  if (!userId) return { subject: ipSubject(req), plan: 'free', userId: null }
  return { subject: `u:${userId}`, plan: await loadPlan(userId), userId }
}

// One lookup per request, however many limits the route checks.
const callers = new WeakMap<NextRequest, Promise<Caller>>()

export function getCaller(req: NextRequest): Promise<Caller> {
  let caller = callers.get(req)
  if (!caller) {
    caller = resolveCaller(req)
    callers.set(req, caller)
  }
  return caller
}

/* ── Subscriptions ── */

type SubscriptionRow = {
  plan_id: PlanId
  cycle: BillingCycle
  status: 'active' | 'canceled'
  current_period_end: string | null
  card_brand: string | null
  card_last4: string | null
}

type PaymentRow = {
  id: string
  created_at: string
  plan_id: PlanId
  cycle: BillingCycle
  amount_try: number
  status: 'paid' | 'refunded'
  card_last4: string | null
}

function toState(row: SubscriptionRow | null, payments: PaymentRow[] = []): SubscriptionState {
  const base = defaultSubscription()
  if (!row) return { ...base, payments: payments.map(toPayment) }
  return {
    planId: getPlanById(row.plan_id).id,
    cycle: row.cycle,
    status: row.status,
    renewsAt: row.current_period_end ?? base.renewsAt,
    cardBrand: row.card_brand ?? '',
    cardLast4: row.card_last4 ?? '',
    payments: payments.map(toPayment),
  }
}

function toPayment(p: PaymentRow): PaymentRecord {
  return {
    id: p.id,
    date: p.created_at,
    planName: getPlanById(p.plan_id).name,
    cycle: p.cycle,
    amount: p.amount_try,
    status: p.status === 'refunded' ? 'İade Edildi' : 'Ödendi',
    cardLast4: p.card_last4 ?? '',
  }
}

const SUB_COLUMNS = 'plan_id, cycle, status, current_period_end, card_brand, card_last4'

/** The user's subscription and payment history, in the shape the plans page uses. */
export async function loadSubscription(userId: string): Promise<SubscriptionState> {
  const db = supabaseAdmin()
  const [sub, pay] = await Promise.all([
    db.from('subscriptions').select(SUB_COLUMNS).eq('user_id', userId).maybeSingle<SubscriptionRow>(),
    db
      .from('payments')
      .select('id, created_at, plan_id, cycle, amount_try, status, card_last4')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<PaymentRow[]>(),
  ])
  if (sub.error) throw sub.error
  if (pay.error) throw pay.error
  return toState(sub.data, pay.data ?? [])
}

// Plans change rarely; a short cache saves a database read on every AI call.
const PLAN_TTL_MS = 30_000
const planCache = new Map<string, { plan: PlanId; at: number }>()

export async function loadPlan(userId: string): Promise<PlanId> {
  const hit = planCache.get(userId)
  if (hit && Date.now() - hit.at < PLAN_TTL_MS) return hit.plan
  const { data, error } = await supabaseAdmin()
    .from('subscriptions')
    .select(SUB_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle<SubscriptionRow>()
  if (error) {
    console.error('[auth] could not read the plan, using free:', error.message)
    return 'free'
  }
  const plan = activePlanId(toState(data))
  planCache.set(userId, { plan, at: Date.now() })
  return plan
}

/** Call after changing a subscription so the new plan applies right away. */
export function forgetPlan(userId: string) {
  planCache.delete(userId)
}
