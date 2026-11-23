/**
 * Plans, prices and daily limits (client- and server-safe).
 *
 * Prices follow the competitor analysis: well below global prep platforms
 * (Magoosh ≈ 5.500 TL / ay) and per-exam one-time passes, which is how exam
 * prep is usually bought. Daily limits cap the AI cost per user; they are
 * enforced on the server by src/lib/usage/quota.ts.
 *
 * Payments are a demo for now (no payment provider). With Supabase the
 * subscription is stored by the server (/api/subscription) and localStorage
 * only caches it for the UI; without Supabase it lives in localStorage alone.
 */
import { accessToken } from '@/lib/auth/token'
import { supabaseConfigured } from '@/lib/auth/config'

export type PlanId = 'free' | 'pro' | 'exam'
export type BillingCycle = 'monthly' | 'yearly' | 'once'
export type LimitKind = 'scoring' | 'chat' | 'generation'

export type PlanLimits = Record<LimitKind, number>

export interface PlanDefinition {
  id: PlanId
  name: string
  badge: string
  tagline: string
  /** Pro: monthly price; Exam: total one-time price. */
  price: number
  /** Pro only: monthly price when paid yearly. */
  yearlyMonthlyPrice?: number
  /** Exam pass length in months (one-time payment, no renewal). */
  passMonths?: number
  limits: PlanLimits
  features: string[]
  highlighted?: boolean
  accent: 'paper' | 'sage' | 'butter'
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Başlangıç',
    badge: 'Ücretsiz',
    tagline: 'Uygulamayı tanımak ve günlük pratik için',
    price: 0,
    accent: 'paper',
    limits: { scoring: 2, chat: 10, generation: 0 },
    features: [
      'Seviye testi ve tüm görev türleri',
      'Günde 2 yapay zekâ yazı değerlendirmesi',
      'Günde 1 canlı mülakat sohbeti',
      'Hazır içerik havuzundan okuma ve dinleme',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'En Popüler',
    tagline: 'Düzenli çalışan ve hedef puanı olanlar için',
    price: 349,
    yearlyMonthlyPrice: 249,
    highlighted: true,
    accent: 'sage',
    limits: { scoring: 20, chat: 80, generation: 10 },
    features: [
      'Günde 20 yazı değerlendirmesi (TOEFL 0–5 ölçeği)',
      'Günde 10 canlı mülakat sohbeti, 4 kategori',
      'Havuz bitince sana özel yeni içerik üretimi',
      'Tüm okuma, yazma, dinleme ve konuşma görevleri',
    ],
  },
  {
    id: 'exam',
    name: 'Sınav Paketi',
    badge: '3 Ay · Tek Ödeme',
    tagline: 'Sınava 1–3 ay kala, yenileme yok',
    price: 899,
    passMonths: 3,
    accent: 'butter',
    limits: { scoring: 30, chat: 120, generation: 20 },
    features: [
      "Pro'daki her şey, daha yüksek günlük sınırlarla",
      'Günde 30 yazı değerlendirmesi',
      'Günde 15 canlı mülakat sohbeti',
      'Otomatik yenilenmez; 3 ay sonra Başlangıç planına döner',
    ],
  },
]

export function getPlanById(id: unknown): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

/** A full speaking interview uses about this many chat replies (7 answers + closing). */
export const REPLIES_PER_INTERVIEW = 8

/** Interviews a chat-reply budget covers. */
export const interviewsFor = (replies: number) => Math.floor(replies / REPLIES_PER_INTERVIEW)

export function planLimit(plan: PlanId, kind: LimitKind): number {
  return getPlanById(plan).limits[kind]
}

/**
 * Internal daily budgets that the plans page does not list. They only stop
 * abuse of endpoints that cost money or CPU; normal use stays well below them.
 * - ttsChars: characters of server speech (cache hits are free). One listening
 *   clip is ~1–3k characters, one interview reply ~300.
 * - topics: AI-generated essay topics (past the budget the fixed pool is used).
 */
export type BudgetKind = 'ttsChars' | 'topics'

export const PLAN_BUDGETS: Record<PlanId, Record<BudgetKind, number>> = {
  free: { ttsChars: 20_000, topics: 5 },
  pro: { ttsChars: 120_000, topics: 30 },
  exam: { ttsChars: 180_000, topics: 30 },
}

export const LIMIT_LABEL: Record<LimitKind, string> = {
  scoring: 'Yazı değerlendirmesi',
  chat: 'Canlı konuşma yanıtı',
  generation: 'Yeni içerik üretimi',
}

export function formatTRY(amount: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount)
}

/* ── Checkout (shared by the plans page and /api/subscription) ── */

/** Coupon code → discount on the first payment. */
export const COUPONS: Record<string, number> = { ROAD20: 0.2 }

export function couponDiscount(code: string | null | undefined): number {
  return COUPONS[(code ?? '').trim().toUpperCase()] ?? 0
}

/** Billing cycle a checkout uses: an exam pass is always a one-time payment. */
export function checkoutCycle(plan: PlanDefinition, cycle: 'monthly' | 'yearly'): BillingCycle {
  return plan.passMonths ? 'once' : cycle
}

export function checkoutTotal(plan: PlanDefinition, cycle: BillingCycle, coupon?: string | null) {
  const base =
    cycle === 'once' ? plan.price : cycle === 'yearly' ? (plan.yearlyMonthlyPrice ?? plan.price) * 12 : plan.price
  const discount = Math.round(base * couponDiscount(coupon))
  return { base, discount, total: Math.max(0, base - discount) }
}

/** End of the period a checkout pays for (renewal date, or pass end). */
export function periodEnd(plan: PlanDefinition, cycle: BillingCycle, from = new Date()): Date {
  const end = new Date(from)
  if (cycle === 'once') end.setMonth(end.getMonth() + (plan.passMonths ?? 3))
  else if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  return end
}

/* ── Subscription state (cached in localStorage for the UI) ── */

export interface PaymentRecord {
  id: string
  date: string
  planName: string
  cycle: BillingCycle
  amount: number
  status: 'Ödendi' | 'İade Edildi'
  cardLast4: string
}

export interface SubscriptionState {
  planId: PlanId
  cycle: BillingCycle
  status: 'active' | 'canceled'
  /** Renewal date (Pro) or pass end (Exam). */
  renewsAt: string
  cardLast4: string
  cardBrand: string
  payments: PaymentRecord[]
}

const SUB_KEY = 'writer_subscription'
/** Fired on window after the subscription changes (e.g. to refresh the sidebar plan chip). */
export const SUBSCRIPTION_EVENT = 'roadlingo:subscription'
const DEVICE_KEY = 'roadlingo_device_id'

export function defaultSubscription(): SubscriptionState {
  return { planId: 'free', cycle: 'monthly', status: 'active', renewsAt: new Date().toISOString(), cardLast4: '', cardBrand: '', payments: [] }
}

export function getSubscription(): SubscriptionState {
  if (typeof window === 'undefined') return defaultSubscription()
  try {
    const raw = localStorage.getItem(SUB_KEY)
    const sub: SubscriptionState = raw ? { ...defaultSubscription(), ...JSON.parse(raw) } : defaultSubscription()
    if (!PLANS.some((p) => p.id === sub.planId)) sub.planId = 'free'
    return sub
  } catch {
    return defaultSubscription()
  }
}

export function clearSubscription(): void {
  try {
    localStorage.removeItem(SUB_KEY)
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(SUBSCRIPTION_EVENT))
}

export function saveSubscription(sub: SubscriptionState): void {
  try {
    localStorage.setItem(SUB_KEY, JSON.stringify(sub))
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(SUBSCRIPTION_EVENT))
}

/**
 * The plan in effect right now (an expired exam pass or canceled Pro falls
 * back to free). Pure when `sub` is passed, so the server uses it too.
 */
export function activePlanId(
  sub: Pick<SubscriptionState, 'planId' | 'cycle' | 'status' | 'renewsAt'> = getSubscription()
): PlanId {
  if (sub.planId === 'free') return 'free'
  const ended = new Date(sub.renewsAt).getTime() < Date.now()
  if (ended && (sub.cycle === 'once' || sub.status === 'canceled')) return 'free'
  return sub.planId
}

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = `d-${crypto.randomUUID()}`
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'anon'
  }
}

/**
 * Headers for AI endpoints so the server can apply the plan's daily limits.
 * With Supabase the server identifies the user from the access token and
 * reads the plan itself; the X-Plan / X-User-Id headers are only the local
 * demo mode and are ignored there.
 */
export function planHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  if (supabaseConfigured) {
    const token = accessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  return { 'X-Plan': activePlanId(), 'X-User-Id': deviceId() }
}
