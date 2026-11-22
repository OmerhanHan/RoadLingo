import { NextRequest, NextResponse } from 'next/server'
import { serverSupabaseEnabled, supabaseAdmin } from '@/lib/auth/admin'
import { forgetPlan, loadSubscription, requestUserId } from '@/lib/auth/server'
import { readJson, rateLimit } from '@/lib/security/guard'
import { activePlanId, checkoutCycle, checkoutTotal, getPlanById, periodEnd, PLANS } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The signed-in user's subscription (Supabase mode only).
 *
 * GET  → current subscription and payment history.
 * POST { action: 'checkout', planId, cycle, coupon?, cardLast4, cardBrand }
 *      → demo payment: activates the plan. The server sets the price and the
 *        period itself; nothing the client sends decides what the plan costs.
 * POST { action: 'cancel' } → stops renewal (Pro stays active until period end).
 *
 * Demo payments are open outside production, or with DEMO_PAYMENTS=1. A real
 * payment provider will write the same tables from its webhook instead.
 */

const demoPaymentsEnabled = () =>
  process.env.DEMO_PAYMENTS ? process.env.DEMO_PAYMENTS === '1' : process.env.NODE_ENV !== 'production'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

async function authed(req: NextRequest) {
  if (!serverSupabaseEnabled) return { error: fail(501, 'Supabase yapılandırılmadı') }
  const userId = await requestUserId(req)
  if (!userId) return { error: fail(401, 'Oturum açman gerekiyor') }
  return { userId }
}

export async function GET(req: NextRequest) {
  const auth = await authed(req)
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await loadSubscription(auth.userId), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[subscription] load failed:', err)
    return fail(500, 'Abonelik bilgisi alınamadı')
  }
}

type Body = {
  action?: string
  planId?: string
  cycle?: string
  coupon?: string
  cardLast4?: string
  cardBrand?: string
}

export async function POST(req: NextRequest) {
  const auth = await authed(req)
  if ('error' in auth) return auth.error
  const { userId } = auth
  const limited = await rateLimit(req, 'account')
  if (limited) return limited
  const parsed = await readJson<Body>(req, 4_000)
  if (!parsed.ok) return parsed.response
  const body = parsed.body
  const db = supabaseAdmin()

  try {
    if (body.action === 'checkout') {
      if (!demoPaymentsEnabled()) return fail(403, 'Ödeme şu an kapalı')
      const plan = PLANS.find((p) => p.id === body.planId)
      if (!plan || plan.id === 'free') return fail(400, 'Geçersiz plan')
      const cycle = checkoutCycle(plan, body.cycle === 'yearly' ? 'yearly' : 'monthly')
      const coupon = typeof body.coupon === 'string' ? body.coupon.slice(0, 40) : undefined
      const { total } = checkoutTotal(plan, cycle, coupon)
      const last4 = /^\d{4}$/.test(body.cardLast4 ?? '') ? body.cardLast4! : null
      const brand = ['Visa', 'Mastercard', 'Kart'].includes(body.cardBrand ?? '') ? body.cardBrand! : null

      const { error: subError } = await db.from('subscriptions').upsert({
        user_id: userId,
        plan_id: plan.id,
        cycle,
        status: 'active',
        current_period_end: periodEnd(plan, cycle).toISOString(),
        provider: 'demo',
        card_brand: brand,
        card_last4: last4,
        updated_at: new Date().toISOString(),
      })
      if (subError) throw subError
      const { error: payError } = await db.from('payments').insert({
        user_id: userId,
        plan_id: plan.id,
        cycle,
        amount_try: total,
        provider: 'demo',
        card_last4: last4,
      })
      if (payError) throw payError
    } else if (body.action === 'cancel') {
      const current = await loadSubscription(userId)
      if (activePlanId(current) === 'free') return fail(400, 'İptal edilecek bir abonelik yok')
      if (getPlanById(current.planId).passMonths) return fail(400, 'Sınav Paketi zaten yenilenmez')
      const { error } = await db
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      if (error) throw error
    } else {
      return fail(400, 'Bilinmeyen işlem')
    }

    forgetPlan(userId)
    return NextResponse.json(await loadSubscription(userId))
  } catch (err) {
    console.error('[subscription] update failed:', err)
    return fail(500, 'Abonelik güncellenemedi')
  }
}
