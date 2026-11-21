/**
 * Plans, prices and daily limits (client- and server-safe).
 *
 * Prices follow the competitor analysis: well below global prep platforms
 * (Magoosh ≈ 5.500 TL / ay) and per-exam one-time passes, which is how exam
 * prep is usually bought. Daily limits cap the AI cost per user; they are
 * enforced on the server by src/lib/usage/quota.ts.
 *
 * Payments are a demo for now (no payment provider): the subscription lives
 * in localStorage and the plan is sent to the server in the X-Plan header.
 * With a real provider the plan must come from the backend instead.
 */

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

export const LIMIT_LABEL: Record<LimitKind, string> = {
  scoring: 'Yazı değerlendirmesi',
  chat: 'Canlı konuşma yanıtı',
  generation: 'Yeni içerik üretimi',
}

export function formatTRY(amount: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount)
}

/* ── Client-side (demo) subscription state ── */

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
const DEVICE_KEY = 'roadlingo_device_id'

function defaultSubscription(): SubscriptionState {
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

export function saveSubscription(sub: SubscriptionState): void {
  try {
    localStorage.setItem(SUB_KEY, JSON.stringify(sub))
  } catch {
    /* storage unavailable */
  }
}

/** The plan in effect right now (an expired exam pass or canceled Pro falls back to free). */
export function activePlanId(sub: SubscriptionState = getSubscription()): PlanId {
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

/** Headers for AI endpoints so the server can apply the plan's daily limits. */
export function planHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  return { 'X-Plan': activePlanId(), 'X-User-Id': deviceId() }
}
