'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { TOEFL_SECTIONS } from '@/lib/exam/structure'
import { SUBSCRIPTION_EVENT, activePlanId, getPlanById, type PlanId } from '@/lib/plans'
import styles from './BottomNav.module.css'

/** Phone tab bar. */
const tabs = [
  { href: '/app/home',    label: 'Home',    icon: '⌂' },
  { href: '/app/writing', label: 'Write',   icon: '✎' },
  { href: '/app/history', label: 'History', icon: '◷' },
  { href: '/app/profile', label: 'Profile', icon: '◉' },
]

/**
 * App navigation: a bottom tab bar on phones and tablets, a left sidebar on
 * wide screens (≥1024px, see the media query in BottomNav.module.css).
 */
export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [plan, setPlan] = useState<PlanId>(() => activePlanId())

  useEffect(() => {
    const refresh = () => setPlan(activePlanId())
    window.addEventListener(SUBSCRIPTION_EVENT, refresh)
    return () => window.removeEventListener(SUBSCRIPTION_EVENT, refresh)
  }, [])

  const isActive = (href: string) => pathname.startsWith(href)
  const go = (href: string) => router.push(href)

  return (
    <>
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.inner}>
          {tabs.map(t => {
            const active = isActive(t.href)
            return (
              <button
                key={t.href}
                id={`nav-${t.label.toLowerCase()}`}
                className={`${styles.tab} ${active ? styles.active : ''}`}
                onClick={() => go(t.href)}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
                <span className={styles.label}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <aside className={styles.sidebar} aria-label="Ana menü">
        <button className={styles.brand} onClick={() => go('/app/home')} aria-label="RoadLingo ana sayfa">
          <Image src="/logo.png" alt="RoadLingo" width={2304} height={1536} sizes="140px" className={styles.brandLogo} />
        </button>

        <div className={styles.sideGroup}>
          <SideLink icon="⌂" label="Ana Sayfa" active={isActive('/app/home')} onClick={() => go('/app/home')} />
        </div>

        <p className={styles.sideHeading}>Bölümler</p>
        <div className={styles.sideGroup}>
          {TOEFL_SECTIONS.map(s => (
            <SideLink key={s.id} icon={s.emoji} label={s.labelTr} active={isActive(s.href)} onClick={() => go(s.href)} />
          ))}
        </div>

        <p className={styles.sideHeading}>Hesap</p>
        <div className={styles.sideGroup}>
          <SideLink icon="◷" label="Geçmiş" active={isActive('/app/history')} onClick={() => go('/app/history')} />
          <SideLink icon="◉" label="Profil" active={isActive('/app/profile')} onClick={() => go('/app/profile')} />
        </div>

        <button
          id="side-plan"
          className={`${styles.planChip} ${plan === 'free' ? styles.planChipFree : ''} ${isActive('/app/plans') ? styles.planChipActive : ''}`}
          onClick={() => go('/app/plans')}
        >
          <span className={styles.planChipLabel}>Planın</span>
          <span className={styles.planChipName}>{plan === 'free' ? getPlanById(plan).name : `✦ ${getPlanById(plan).name}`}</span>
          {plan === 'free' && <span className={styles.planChipCta}>Pro’ya geç →</span>}
        </button>
      </aside>
    </>
  )
}

function SideLink({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`${styles.sideLink} ${active ? styles.sideLinkActive : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className={styles.sideIcon} aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
