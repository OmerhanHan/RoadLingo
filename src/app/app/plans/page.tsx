'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LIMIT_LABEL,
  PLANS,
  activePlanId,
  formatTRY,
  getPlanById,
  getSubscription,
  interviewsFor,
  planHeaders,
  saveSubscription,
  type BillingCycle,
  type LimitKind,
  type PlanDefinition,
  type SubscriptionState,
} from '@/lib/plans'
import styles from './plans.module.css'

const FAQ_ITEMS = [
  {
    q: 'Sınav Paketi ile Pro arasındaki fark ne?',
    a: "Pro her ay (ya da yıllık) yenilenen bir abonelik. Sınav Paketi ise 3 aylık tek ödeme: yenilenmez, sınavın bitince ek ücret çıkmaz ve günlük sınırları Pro'dan yüksektir.",
  },
  {
    q: 'Neden günlük sınırlar var?',
    a: 'Yazı değerlendirmesi ve canlı konuşma, her kullanımda yapay zekâ çalıştırır. Günlük sınırlar fiyatları düşük tutmamızı sağlar; normal bir çalışma gününde sınıra takılmazsın. Okuma ve dinleme görevleri hazır içerik havuzundan geldiği için sınırsızdır.',
  },
  {
    q: 'Aboneliğimi istediğim zaman iptal edebilir miyim?',
    a: 'Evet. Pro aboneliğini tek tıkla iptal edebilirsin; ödediğin dönemin sonuna kadar tüm hakların devam eder, sonra Başlangıç planına geçersin.',
  },
]

const LIMIT_KINDS: LimitKind[] = ['scoring', 'chat', 'generation']

type Usage = Record<LimitKind, { used: number; limit: number }>

function formatCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function cycleLabel(cycle: BillingCycle) {
  return cycle === 'once' ? '3 ay, tek ödeme' : cycle === 'yearly' ? 'Yıllık' : 'Aylık'
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function PlansPage() {
  const router = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [sub, setSub] = useState<SubscriptionState>(() => getSubscription())
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(() => (getSubscription().cycle === 'yearly' ? 'yearly' : 'monthly'))
  const [usage, setUsage] = useState<{ enforced: boolean; usage: Usage } | null>(null)

  const [checkoutPlan, setCheckoutPlan] = useState<PlanDefinition | null>(null)
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [paidSuccess, setPaidSuccess] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const activeId = activePlanId(sub)
  const currentPlan = getPlanById(activeId)

  // Today's usage under the active plan (refreshes when the plan changes).
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/usage', { headers: planHeaders(), signal: ctrl.signal })
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {})
    return () => ctrl.abort()
  }, [activeId])

  const checkoutCycle = (plan: PlanDefinition): BillingCycle => (plan.passMonths ? 'once' : cycle)

  const computeTotal = (plan: PlanDefinition) => {
    const base = plan.passMonths ? plan.price : cycle === 'yearly' ? (plan.yearlyMonthlyPrice ?? plan.price) * 12 : plan.price
    const discount = promoApplied ? Math.round(base * 0.2) : 0
    return { base, discount, total: Math.max(0, base - discount) }
  }

  const openCheckout = (plan: PlanDefinition) => {
    if (plan.id === 'free') {
      if (activeId !== 'free') setConfirmCancel(true)
      return
    }
    setCheckoutPlan(plan)
    setFormError(null)
    setPaidSuccess(false)
    setPromoMsg(null)
    setPromoApplied(false)
    setPromoInput('')
  }

  const closeCheckout = () => {
    if (processing) return
    setCheckoutPlan(null)
    setPaidSuccess(false)
  }

  /** After a purchase, go back to the screen that sent the user here (see plansHref). */
  const finishCheckout = () => {
    setCheckoutPlan(null)
    setPaidSuccess(false)
    const from = new URLSearchParams(window.location.search).get('from')
    if (from && from.startsWith('/app/') && !from.startsWith('/app/plans')) router.push(from)
  }

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    if (code === 'ROAD20') {
      setPromoApplied(true)
      setPromoMsg({ ok: true, text: 'ROAD20 uygulandı: ilk ödemede %20 indirim.' })
    } else {
      setPromoApplied(false)
      setPromoMsg({ ok: false, text: 'Geçersiz kupon kodu.' })
    }
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkoutPlan) return
    const digits = cardNumber.replace(/\s/g, '')
    if (cardName.trim().length < 3) return setFormError('Lütfen kart üzerindeki ad soyadı gir.')
    if (digits.length < 16) return setFormError('Lütfen 16 haneli bir kart numarası gir.')
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setFormError('Son kullanma tarihini AA/YY biçiminde gir.')
    if (cvc.length < 3) return setFormError('Lütfen 3 veya 4 haneli CVC kodunu gir.')

    setFormError(null)
    setProcessing(true)
    await new Promise((r) => setTimeout(r, 1100))

    const planCycle = checkoutCycle(checkoutPlan)
    const { total } = computeTotal(checkoutPlan)
    const last4 = digits.slice(-4)
    const brand = digits.startsWith('4') ? 'Visa' : digits.startsWith('5') ? 'Mastercard' : 'Kart'
    const ends = new Date()
    if (planCycle === 'once') ends.setMonth(ends.getMonth() + (checkoutPlan.passMonths ?? 3))
    else if (planCycle === 'yearly') ends.setFullYear(ends.getFullYear() + 1)
    else ends.setMonth(ends.getMonth() + 1)

    const updated: SubscriptionState = {
      planId: checkoutPlan.id,
      cycle: planCycle,
      status: 'active',
      renewsAt: ends.toISOString(),
      cardLast4: last4,
      cardBrand: brand,
      payments: [
        { id: `inv-${Date.now()}`, date: new Date().toISOString(), planName: checkoutPlan.name, cycle: planCycle, amount: total, status: 'Ödendi', cardLast4: last4 },
        ...sub.payments,
      ],
    }
    saveSubscription(updated)
    setSub(updated)
    setProcessing(false)
    setPaidSuccess(true)
  }

  /** Pro: stop renewal (benefits last until the period ends). */
  const handleCancel = () => {
    const updated: SubscriptionState = { ...sub, status: 'canceled' }
    saveSubscription(updated)
    setSub(updated)
    setConfirmCancel(false)
    showToast(`Yenileme iptal edildi. ${formatDate(sub.renewsAt)} tarihine kadar ${currentPlan.name} aktif.`)
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.topBar} anim-fade-up`}>
        <button id="plans-back-btn" className={styles.backBtn} onClick={() => router.back()}>← Geri</button>
        <span className={styles.activePill}>Aktif: {currentPlan.name}</span>
      </div>

      <header className={`${styles.header} anim-fade-up`}>
        <span className={styles.kicker}>Abonelik & Ödeme</span>
        <h1 className={styles.title}>Sınav Hedefine Uygun Planı Seç</h1>
        <p className={styles.subtitle}>
          Okuma ve dinleme görevleri her planda açık. Ücretli planlar yapay zekâ ile yazı değerlendirmesi ve canlı konuşma
          haklarını artırır.
        </p>
      </header>

      <div className={`${styles.cycleWrap} anim-fade-up d1`}>
        <div className={styles.cycleSwitch} role="group" aria-label="Pro faturalandırma dönemi">
          <button id="cycle-monthly" className={`${styles.cycleBtn} ${cycle === 'monthly' ? styles.cycleBtnActive : ''}`} onClick={() => setCycle('monthly')}>
            Aylık
          </button>
          <button id="cycle-yearly" className={`${styles.cycleBtn} ${cycle === 'yearly' ? styles.cycleBtnActive : ''}`} onClick={() => setCycle('yearly')}>
            Yıllık
            <span className={styles.saveBadge}>%29 İNDİRİM</span>
          </button>
        </div>
        <span className={styles.cycleHint}>Dönem seçimi Pro için geçerli</span>
      </div>

      <section className={`${styles.planGrid} anim-fade-up d2`}>
        {PLANS.map((plan) => {
          const isCurrent =
            activeId === plan.id && (plan.id !== 'pro' || sub.cycle === cycle) && !(plan.id !== 'free' && sub.status === 'canceled')
          const monthly = plan.id === 'pro' && cycle === 'yearly' ? plan.yearlyMonthlyPrice ?? plan.price : plan.price

          return (
            <article
              key={plan.id}
              className={`${styles.planCard} ${plan.highlighted ? styles.planCardHighlighted : ''} ${isCurrent ? styles.planCardCurrent : ''}`}
            >
              <div className={styles.planTop}>
                <div>
                  <div className={styles.planNameRow}>
                    <h2 className={styles.planName}>{plan.name}</h2>
                    <span className={`${styles.planBadge} ${styles[`badge_${plan.accent}`]}`}>{plan.badge}</span>
                  </div>
                  <p className={styles.planTagline}>{plan.tagline}</p>
                </div>

                <div className={styles.priceBlock}>
                  <div className={styles.priceValue}>{formatTRY(monthly)}</div>
                  <div className={styles.pricePeriod}>{plan.passMonths ? `/ ${plan.passMonths} ay` : '/ ay'}</div>
                  {plan.passMonths && (
                    <div className={styles.priceSub}>≈ {formatTRY(Math.round(plan.price / plan.passMonths))} / ay</div>
                  )}
                  {plan.id === 'pro' && cycle === 'yearly' && (
                    <div className={styles.priceSub}>Yıllık {formatTRY(monthly * 12)}</div>
                  )}
                </div>
              </div>

              <ul className={styles.featureList}>
                {plan.features.map((feat) => (
                  <li key={feat} className={styles.featureItem}>
                    <span className={styles.featureCheck}>✓</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                id={`select-plan-${plan.id}`}
                disabled={isCurrent}
                onClick={() => openCheckout(plan)}
                className={`${styles.planBtn} ${isCurrent ? styles.planBtnActive : plan.highlighted ? '' : styles.planBtnOutline}`}
              >
                {isCurrent
                  ? '✓ Mevcut Planın'
                  : plan.id === 'free'
                    ? activeId === 'free' ? 'Ücretsiz' : 'Başlangıç Planına Dön'
                    : plan.passMonths ? `${plan.name} Al →` : `${plan.name} Planını Seç →`}
              </button>
            </article>
          )
        })}
      </section>

      {usage && (
        <>
          <p className={styles.sectionTitle}>Bugünkü Kullanımın · {currentPlan.name}</p>
          <section className={styles.usageCard}>
            {LIMIT_KINDS.map((k) => {
              const { used, limit } = usage.usage[k]
              const pct = limit ? Math.min(100, (used / limit) * 100) : 100
              return (
                <div key={k} className={styles.usageRow}>
                  <div className={styles.usageMeta}>
                    <span>{LIMIT_LABEL[k]}</span>
                    <span className={styles.usageCount}>{limit ? `${used} / ${limit}` : 'Hazır havuz'}</span>
                  </div>
                  <div className={styles.usageTrack}>
                    <div className={`${styles.usageFill} ${used >= limit && limit ? styles.usageFull : ''}`} style={{ width: `${limit ? pct : 0}%` }} />
                  </div>
                </div>
              )
            })}
            <p className={styles.usageNote}>
              Haklar her gün gece yarısı (UTC) yenilenir.
              {!usage.enforced && ' Geliştirme ortamında sınırlar uygulanmıyor.'}
            </p>
          </section>
        </>
      )}

      <p className={`${styles.sectionTitle} anim-fade-up d3`}>Mevcut Abonelik Özeti</p>
      <section className={`${styles.billingCard} anim-fade-up d3`}>
        <div className={styles.billingRow}>
          <span className={styles.billingLabel}>Plan</span>
          <span className={styles.billingVal}>
            {currentPlan.name}{activeId !== 'free' ? ` (${cycleLabel(sub.cycle)})` : ''}
          </span>
        </div>
        <div className={styles.billingRow}>
          <span className={styles.billingLabel}>Durum</span>
          <span className={styles.billingVal}>
            {activeId === 'free' ? '● Aktif' : sub.status === 'canceled' ? 'Yenileme iptal edildi' : '● Aktif'}
          </span>
        </div>
        {activeId !== 'free' && (
          <div className={styles.billingRow}>
            <span className={styles.billingLabel}>
              {sub.cycle === 'once' || sub.status === 'canceled' ? 'Bitiş Tarihi' : 'Sonraki Yenileme'}
            </span>
            <span className={styles.billingVal}>{formatDate(sub.renewsAt)}</span>
          </div>
        )}
        <div className={styles.billingRow}>
          <span className={styles.billingLabel}>Ödeme Yöntemi</span>
          <span className={styles.billingVal}>
            {sub.cardLast4 ? `${sub.cardBrand || 'Kart'} •••• ${sub.cardLast4}` : 'Kayıtlı kart yok'}
          </span>
        </div>
      </section>

      {sub.payments.length > 0 && (
        <>
          <p className={styles.sectionTitle}>Ödeme Geçmişi</p>
          <section className={styles.historyList}>
            {sub.payments.map((inv) => (
              <div key={inv.id} className={styles.historyItem}>
                <div className={styles.historyLeft}>
                  <span className={styles.historyTitle}>{inv.planName} ({cycleLabel(inv.cycle)})</span>
                  <span className={styles.historyMeta}>
                    {new Date(inv.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} · •••• {inv.cardLast4}
                  </span>
                </div>
                <div className={styles.historyRight}>
                  <div className={styles.historyAmount}>{formatTRY(inv.amount)}</div>
                  <div className={styles.historyStatus}>{inv.status}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      <p className={styles.sectionTitle}>Sık Sorulan Sorular</p>
      <section className={styles.faqList}>
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openFaq === idx
          return (
            <div key={item.q} className={styles.faqItem}>
              <button className={styles.faqTrigger} onClick={() => setOpenFaq(isOpen ? null : idx)} aria-expanded={isOpen}>
                <span>{item.q}</span>
                <span className={styles.faqChevron}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <p className={styles.faqBody}>{item.a}</p>}
            </div>
          )
        })}
      </section>

      {checkoutPlan && (
        <div className={styles.modalOverlay} onClick={closeCheckout}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            {paidSuccess ? (
              <div className={styles.successBox}>
                <div className={styles.successIcon}>✓</div>
                <h2 className={styles.successTitle}>Plan Etkinleştirildi</h2>
                <p className={styles.successDesc}>
                  <strong>{checkoutPlan.name}</strong> artık aktif. Günlük hakların: {checkoutPlan.limits.scoring} yazı
                  değerlendirmesi, {interviewsFor(checkoutPlan.limits.chat)} canlı mülakat.
                </p>
                <button id="checkout-done-btn" className={`btn ${styles.payBtn}`} onClick={finishCheckout}>Devam Et →</button>
              </div>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <span className={styles.kicker}>Ödeme</span>
                    <h2 className={styles.modalTitle}>{checkoutPlan.name}</h2>
                  </div>
                  <button className={styles.modalClose} onClick={closeCheckout} aria-label="Kapat">✕</button>
                </div>

                <p className={styles.demoNote}>
                  Demo ödeme: henüz bir ödeme sağlayıcısı bağlı değil. Kart bilgileri hiçbir yere gönderilmez ve ücret alınmaz.
                </p>

                {(() => {
                  const { base, discount, total } = computeTotal(checkoutPlan)
                  return (
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryLine}>
                        <span>{checkoutPlan.name} ({cycleLabel(checkoutCycle(checkoutPlan))})</span>
                        <span>{formatTRY(base)}</span>
                      </div>
                      {discount > 0 && (
                        <div className={styles.summaryLine}>
                          <span>Kupon (ROAD20)</span>
                          <span style={{ color: 'var(--sage-dark)' }}>−{formatTRY(discount)}</span>
                        </div>
                      )}
                      <div className={styles.summaryTotal}>
                        <span>Toplam Tutar</span>
                        <span className={styles.summaryTotalPrice}>{formatTRY(total)}</span>
                      </div>
                    </div>
                  )
                })()}

                <div className={styles.promoRow}>
                  <input id="promo-input" type="text" className="input-retro" placeholder="İndirim kodu" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} />
                  <button id="apply-promo-btn" type="button" className={styles.promoBtn} onClick={handleApplyPromo}>Uygula</button>
                </div>
                {promoMsg && <p className={`${styles.promoMsg} ${promoMsg.ok ? styles.promoOk : styles.promoErr}`}>{promoMsg.text}</p>}

                <form onSubmit={handlePay}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="card-name">Kart Üzerindeki İsim</label>
                    <input id="card-name" type="text" className="input-retro" placeholder="Ad Soyad" value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="card-number">Kart Numarası</label>
                    <input id="card-number" type="text" inputMode="numeric" className="input-retro" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} autoComplete="cc-number" />
                  </div>
                  <div className={`${styles.formGroup} ${styles.formRow}`}>
                    <div>
                      <label className={styles.formLabel} htmlFor="card-expiry">Son Kullanma</label>
                      <input id="card-expiry" type="text" inputMode="numeric" className="input-retro" placeholder="AA/YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} autoComplete="cc-exp" />
                    </div>
                    <div>
                      <label className={styles.formLabel} htmlFor="card-cvc">CVC</label>
                      <input id="card-cvc" type="text" inputMode="numeric" className="input-retro" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="cc-csc" />
                    </div>
                  </div>

                  {formError && <div className={styles.formError}>{formError}</div>}

                  <button id="submit-payment-btn" type="submit" className={`btn ${styles.payBtn}`} disabled={processing}>
                    {processing ? <><span className="spinner" /> İşleniyor...</> : `${formatTRY(computeTotal(checkoutPlan).total)} Öde ve Başlat`}
                  </button>
                  <p className={styles.secureNote}>
                    {checkoutPlan.passMonths ? 'Tek ödeme · otomatik yenilenmez' : 'İstediğin zaman iptal edebilirsin'}
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className={styles.modalOverlay} onClick={() => setConfirmCancel(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle} style={{ marginBottom: 8 }}>
              {sub.cycle === 'once' ? 'Sınav Paketi devam ediyor' : 'Yenilemeyi iptal et'}
            </h2>
            <p className={styles.subtitle} style={{ marginBottom: 20 }}>
              {sub.cycle === 'once'
                ? `Sınav Paketi tek ödemelidir ve ${formatDate(sub.renewsAt)} tarihinde kendiliğinden Başlangıç planına döner.`
                : `${formatDate(sub.renewsAt)} tarihine kadar ${currentPlan.name} hakların devam eder, sonra Başlangıç planına geçersin.`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sub.cycle !== 'once' && sub.status !== 'canceled' && (
                <button id="confirm-cancel-btn" className="btn" onClick={handleCancel}>Evet, yenilemeyi iptal et</button>
              )}
              <button className="btn btn-outline" onClick={() => setConfirmCancel(false)}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}
