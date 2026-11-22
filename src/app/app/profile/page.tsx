'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/lib/useSubscription'
import { useAuth } from '@/contexts/AuthContext'
import { getStats } from '@/lib/storage'
import { activePlanId, getPlanById } from '@/lib/plans'
import styles from './profile.module.css'
import PlanBadge from './PlanBadge'

function level(n: number) {
  if (n >= 20) return '🥇 Advanced'
  if (n >= 10) return '🥈 Intermediate'
  if (n >= 3)  return '🥉 Beginner'
  return '🌱 Starter'
}
function levelPct(n: number) {
  if (n >= 20) return 1
  if (n >= 10) return (n - 10) / 10
  if (n >= 3)  return (n - 3)  / 7
  return n / 3
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [stats] = useState(() => getStats())
  const planName = getPlanById(activePlanId(useSubscription())).name
  const [modal, setModal] = useState(false)

  const firstName = user?.name?.split(' ')[0] || ''

  const statItems = [
    { val: stats.totalWritings,                                                                                           lbl: 'Yazı'        },
    { val: stats.avgBandScore > 0 ? stats.avgBandScore.toFixed(1) : '—',                                                lbl: 'Ort. Band'  },
    { val: stats.totalWords > 999 ? `${(stats.totalWords/1000).toFixed(1)}k` : stats.totalWords || '—',                lbl: 'Kelime'     },
    { val: stats.streak > 0 ? `${stats.streak}g` : '—',                                                                        lbl: 'Seri'       },
    { val: stats.lastStudied ? new Date(stats.lastStudied).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—', lbl: 'Son Çalışma' },
  ]

  return (
    <main className={styles.page}>
      {/* Hero */}
      <div className={`${styles.heroCard} anim-fade-up`}>
        <div className={styles.avatar}>{firstName.charAt(0).toUpperCase()}</div>
        <h1 className={styles.name}>{user?.name}</h1>
        <p className={styles.email}>{user?.email}</p>
        <PlanBadge label={level(stats.totalWritings)} />
      </div>

      {/* Stats */}
      <div className={`${styles.stats} anim-fade-up d1`}>
        {statItems.map(s => (
          <div key={s.lbl} className={styles.statCard}>
            <span className={styles.statVal}>{s.val}</span>
            <span className={styles.statLbl}>{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* Level progress */}
      <div className={`${styles.levelSection} anim-fade-up d2`}>
        <div className={styles.levelHead}>
          <span>Seviye</span>
          <span>{level(stats.totalWritings)}</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.round(levelPct(stats.totalWritings) * 100)}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className={`${styles.actions} anim-fade-up d3`}>
        <button id="go-plans-btn" className={styles.actionBtn} onClick={() => router.push('/app/plans')}>
          ✦ Planlar & Ödeme ({planName})
        </button>
        <button id="go-writing-btn" className={styles.actionBtn} onClick={() => router.push('/app/writing')}>→ Yeni Yazı Başlat</button>
        <button id="logout-btn" className={styles.logoutBtn} onClick={() => setModal(true)}>🚪 Çıkış Yap</button>
      </div>

      {modal && (
        <div className={styles.overlay} onClick={() => setModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>👋</div>
            <h2 className={styles.modalTitle}>Çıkış Yap</h2>
            <p className={styles.modalDesc}>Yazıların saklanmaya devam edecek.</p>
            <div className={styles.modalBtns}>
              <button id="confirm-logout" className={styles.btnDanger} onClick={() => { logout(); router.push('/auth/login') }}>Evet, çık</button>
              <button id="cancel-logout" className={styles.btnCancel} onClick={() => setModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
