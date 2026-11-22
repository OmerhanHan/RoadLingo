'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { listWritings } from '@/lib/data/client'
import { useLoad } from '@/lib/data/useLoad'
import styles from './history.module.css'

function bandColor(s: number) {
  if (s >= 7) return '#7A9E7E'
  if (s >= 5.5) return '#C9A84C'
  return '#B07070'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HistoryPage() {
  const router = useRouter()
  const { data, error, loading, reload } = useLoad('writings', listWritings)
  const writings = data ?? []
  const [filter, setFilter]     = useState<'all' | 'predetermined' | 'random'>('all')
  const filtered = filter === 'all' ? writings : writings.filter(w => w.mode === filter)

  return (
    <main className={styles.page}>
      <header className={`${styles.header} anim-fade-up`}>
        <h1 className={styles.title}>Geçmiş</h1>
        <p className={styles.sub}>{loading ? 'Yükleniyor…' : `${writings.length} yazı · arşiv`}</p>
      </header>

      <div className={`${styles.filters} anim-fade-up d1`}>
        {([['all', 'Tümü'], ['predetermined', '📌 Konum Var'], ['random', '🎲 Rastgele']] as const).map(([val, lbl]) => (
          <button key={val} id={`filter-${val}`} className={`${styles.filterBtn} ${filter === val ? styles.filterActive : ''}`} onClick={() => setFilter(val)}>
            {lbl}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.loading} aria-label="Yükleniyor"><div className={styles.spinner} /></div>
        ) : error ? (
          <div className={`${styles.empty} anim-fade-in`}>
            <div className={styles.emptyIcon}>📡</div>
            <h2 className={styles.emptyTitle}>Yazılar yüklenemedi</h2>
            <p className={styles.emptyDesc}>Bağlantını kontrol edip tekrar dene</p>
            <button id="retry-load-btn" className={styles.emptyBtn} onClick={reload}>↻ Tekrar dene</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${styles.empty} anim-fade-in`}>
            <div className={styles.emptyIcon}>📭</div>
            <h2 className={styles.emptyTitle}>Henüz yazı yok</h2>
            <p className={styles.emptyDesc}>İlk yazını yazmaya başla</p>
            <button id="start-writing-btn" className={styles.emptyBtn} onClick={() => router.push('/app/writing')}>→ Yaz</button>
          </div>
        ) : (
          filtered.map((w, i) => (
            <button key={w.id} id={`writing-card-${w.id}`}
              className={styles.card}
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => router.push(`/app/history/${w.id}`)}>
              <div className={styles.cardTop}>
                <span className={styles.modeTag}>{w.mode === 'predetermined' ? '📌 Predetermined' : '🎲 Random'}</span>
                {w.has_feedback && w.feedback && (
                  <span className={styles.bandBadge} style={{ color: bandColor(w.feedback.band_score) }}>
                    Band {w.feedback.band_score}
                  </span>
                )}
              </div>
              <h3 className={styles.cardTopic}>{w.topic}</h3>
              <div className={styles.cardMeta}>
                <span>{fmtDate(w.created_at)}</span>
                <span className={styles.dot}>·</span>
                <span>{w.word_count} words</span>
                {w.has_feedback && <><span className={styles.dot}>·</span><span className={styles.feedbackTag}>✓ Analiz</span></>}
              </div>
            </button>
          ))
        )}
      </div>
    </main>
  )
}
