'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, activePlanId, formatTRY, getPlanById, getSubscription, interviewsFor, type PlanDefinition } from '@/lib/plans'
import styles from './profile.module.css'

function priceLabel(plan: PlanDefinition) {
  if (!plan.price) return 'Ücretsiz'
  if (plan.passMonths) return `${formatTRY(plan.price)} · ${plan.passMonths} ay`
  return `${formatTRY(plan.price)} / ay`
}

/**
 * Profile badge with two parts: the writing level (from the number of
 * writings) and the current plan. Hovering (or tapping, on touch screens)
 * opens a small plans card that leads to /app/plans.
 */
export default function PlanBadge({ label }: { label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [current] = useState(() => activePlanId(getSubscription()))
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  // Short delay so the pointer can travel from the badge to the card.
  const hideSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  return (
    <div
      ref={wrapRef}
      className={styles.badgeWrap}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hideSoon()}
    >
      <button
        id="profile-level-badge"
        className={styles.levelBadge}
        aria-expanded={open}
        aria-controls="profile-plans-card"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.badgeLevel} title="Yazı seviyen">{label}</span>
        <span className={`${styles.badgePlan} ${current !== 'free' ? styles.badgePlanPaid : ''}`} title="Planın">
          {current !== 'free' && '✦ '}
          {getPlanById(current).name} planı
          <span className={styles.badgeCaret} aria-hidden>{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div id="profile-plans-card" className={styles.plansCard} role="dialog" aria-label="Planlar">
          <p className={styles.plansCardTitle}>Planlar</p>
          <ul className={styles.plansCardList}>
            {PLANS.map((plan) => {
              const isCurrent = plan.id === current
              return (
                <li key={plan.id}>
                  <button
                    className={`${styles.plansCardRow} ${isCurrent ? styles.plansCardRowCurrent : ''}`}
                    onClick={() => router.push('/app/plans')}
                  >
                    <span className={styles.plansCardName}>
                      {plan.name}
                      {isCurrent && <span className={styles.plansCardTag}>Mevcut</span>}
                    </span>
                    <span className={styles.plansCardPrice}>{priceLabel(plan)}</span>
                    <span className={styles.plansCardMeta}>
                      Günde {plan.limits.scoring} değerlendirme · {interviewsFor(plan.limits.chat)} mülakat
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <button id="profile-plans-cta" className={styles.plansCardCta} onClick={() => router.push('/app/plans')}>
            Planları Karşılaştır →
          </button>
        </div>
      )}
    </div>
  )
}
