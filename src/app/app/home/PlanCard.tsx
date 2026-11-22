'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { activePlanId, getPlanById, interviewsFor, planHeaders, type LimitKind } from '@/lib/plans'
import { useSubscription } from '@/lib/useSubscription'
import styles from './home.module.css'

type Usage = Record<LimitKind, { used: number; limit: number }>

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

/** Home entry point to the plans page: today's allowance on free, plan status on paid. */
export default function PlanCard() {
  const router = useRouter()
  const sub = useSubscription()
  const [usage, setUsage] = useState<Usage | null>(null)
  const planId = activePlanId(sub)
  const plan = getPlanById(planId)

  // The limits depend on the plan, so usage is reloaded when it changes.
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/usage', { headers: planHeaders(), signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setUsage(d.usage))
      .catch(() => {})
    return () => ctrl.abort()
  }, [planId])

  const left = (k: LimitKind) => (usage ? Math.max(0, usage[k].limit - usage[k].used) : plan.limits[k])
  const scoringLeft = left('scoring')
  // Interviews: whole budget minus the ones already started.
  const interviewsLeft = usage
    ? Math.max(0, interviewsFor(usage.chat.limit) - interviewsFor(usage.chat.used))
    : interviewsFor(plan.limits.chat)
  const exhausted = scoringLeft === 0 && interviewsLeft === 0

  const isFree = planId === 'free'
  const status = isFree
    ? exhausted
      ? 'Bugünkü hakların bitti, yarın yenilenir.'
      : `Bugün ${scoringLeft} yazı değerlendirmesi, ${interviewsLeft} canlı mülakat hakkın var.`
    : `Bugün ${scoringLeft} değerlendirme, ${interviewsLeft} mülakat · ${
        sub.cycle === 'once' || sub.status === 'canceled' ? `bitiş ${shortDate(sub.renewsAt)}` : `yenileme ${shortDate(sub.renewsAt)}`
      }`

  return (
    <button
      id="home-plan"
      className={`${styles.planCard} ${isFree ? styles.planCardFree : ''} anim-fade-up d1`}
      onClick={() => router.push('/app/plans')}
    >
      <span className={styles.planText}>
        <span className={styles.planKicker}>{isFree ? 'Başlangıç planı' : `✦ ${plan.name} aktif`}</span>
        <span className={styles.planStatus}>{status}</span>
      </span>
      <span className={styles.planCta}>{isFree ? 'Pro’ya Geç →' : 'Planım →'}</span>
    </button>
  )
}
