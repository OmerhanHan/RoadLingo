'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/lib/useSubscription'
import { useAuth } from '@/contexts/AuthContext'
import { EMPTY_STATS } from '@/lib/storage'
import { loadStats } from '@/lib/data/client'
import { useLoad } from '@/lib/data/useLoad'
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
  const { user, logout, deleteAccount, mode } = useAuth()
  const router = useRouter()
  const { data: stats = EMPTY_STATS } = useLoad('stats', loadStats)
  const planName = getPlanById(activePlanId(useSubscription())).name
  const [modal, setModal] = useState<'logout' | 'delete' | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const canDelete = confirmText.trim().toLocaleUpperCase('tr') === 'SİL'

  const closeModal = () => {
    if (deleting) return
    setModal(null)
    setConfirmText('')
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!canDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      router.replace('/auth/login')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Hesap silinemedi.')
      setDeleting(false)
    }
  }

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
        <button id="logout-btn" className={styles.logoutBtn} onClick={() => setModal('logout')}>🚪 Çıkış Yap</button>
        <button id="delete-account-btn" className={styles.deleteBtn} onClick={() => setModal('delete')}>Hesabımı sil</button>
      </div>

      {modal === 'delete' && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>⚠️</div>
            <h2 id="delete-title" className={styles.modalTitle}>Hesabı sil</h2>
            <p className={styles.modalDesc}>
              {mode === 'supabase'
                ? 'Hesabın, yazıların, puanların, e-posta alıştırmaların ve plan bilgin kalıcı olarak silinir. Bu işlem geri alınamaz.'
                : 'Bu tarayıcıdaki yazıların, e-posta alıştırmaların ve seçimlerin silinir. Bu işlem geri alınamaz.'}
            </p>
            <label className={styles.confirmLabel} htmlFor="delete-confirm">Onaylamak için <b>SİL</b> yaz</label>
            <input
              id="delete-confirm"
              className={styles.confirmInput}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={deleting}
            />
            {deleteError && <p className={styles.modalError} role="alert">{deleteError}</p>}
            <div className={styles.modalBtns}>
              <button id="confirm-delete" className={styles.btnDanger} onClick={confirmDelete} disabled={!canDelete || deleting}>
                {deleting ? 'Siliniyor…' : 'Kalıcı olarak sil'}
              </button>
              <button id="cancel-delete" className={styles.btnCancel} onClick={closeModal} disabled={deleting}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'logout' && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>👋</div>
            <h2 className={styles.modalTitle}>Çıkış Yap</h2>
            <p className={styles.modalDesc}>Yazıların saklanmaya devam edecek.</p>
            <div className={styles.modalBtns}>
              <button id="confirm-logout" className={styles.btnDanger} onClick={() => { logout(); router.push('/auth/login') }}>Evet, çık</button>
              <button id="cancel-logout" className={styles.btnCancel} onClick={closeModal}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
