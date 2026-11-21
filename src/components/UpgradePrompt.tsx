'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { activePlanId, getPlanById, interviewsFor, type LimitKind, type PlanId } from '@/lib/plans'
import { QUOTA_EVENT, plansHref, type QuotaEventDetail } from '@/lib/upgrade'
import styles from './UpgradePrompt.module.css'

const TITLE: Record<LimitKind, string> = {
  scoring: 'Bugünkü değerlendirme hakkın doldu',
  chat: 'Bugünkü konuşma hakkın doldu',
  generation: 'Bugünkü içerik hakkın doldu',
}

/** The next plan up and what it adds, or null on the top plan. */
function nextPlan(current: PlanId) {
  const next = current === 'free' ? getPlanById('pro') : current === 'pro' ? getPlanById('exam') : null
  if (!next) return null
  return {
    plan: next,
    pitch: `${next.name} ile günde ${next.limits.scoring} yazı değerlendirmesi ve ${interviewsFor(next.limits.chat)} canlı mülakat.`,
  }
}

/** Shown app-wide when an AI endpoint answers with a daily-limit error. */
export default function UpgradePrompt() {
  const router = useRouter()
  const pathname = usePathname()
  const [detail, setDetail] = useState<QuotaEventDetail | null>(null)
  const [plan, setPlan] = useState<PlanId>('free')

  useEffect(() => {
    const onQuota = (e: Event) => {
      setPlan(activePlanId())
      setDetail((e as CustomEvent<QuotaEventDetail>).detail)
    }
    window.addEventListener(QUOTA_EVENT, onQuota)
    return () => window.removeEventListener(QUOTA_EVENT, onQuota)
  }, [])

  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDetail(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  if (!detail) return null
  const upgrade = nextPlan(plan)

  return (
    <div className={styles.overlay} onClick={() => setDetail(null)}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.grabber} aria-hidden />
        <span className={styles.icon} aria-hidden>⏳</span>
        <h2 id="upgrade-title" className={styles.title}>
          {detail.kind ? TITLE[detail.kind] : 'Bugünkü hakkın doldu'}
        </h2>
        <p className={styles.body}>
          {upgrade ? upgrade.pitch : 'Sınav Paketi’ndeki en yüksek günlük sınıra ulaştın.'} Haklar her gece 03:00’te
          (TSİ) yenilenir.
        </p>

        <div className={styles.actions}>
          {upgrade && (
            <button
              id="upgrade-see-plans"
              className="btn"
              onClick={() => {
                setDetail(null)
                router.push(plansHref(pathname))
              }}
            >
              Planları Gör →
            </button>
          )}
          <button id="upgrade-dismiss" className="btn btn-outline" onClick={() => setDetail(null)}>
            {upgrade ? 'Yarın devam ederim' : 'Tamam'}
          </button>
        </div>
      </div>
    </div>
  )
}
