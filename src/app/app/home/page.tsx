'use client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getStats } from '@/lib/storage'
import { TOEFL_SECTIONS } from '@/lib/exam/structure'
import { useState } from 'react'
import styles from './home.module.css'
import PlanCard from './PlanCard'

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return { label: 'Günaydın', name }
  if (h < 18) return { label: 'İyi günler', name }
  return { label: 'İyi akşamlar', name }
}

export default function HomePage() {
  const { user } = useAuth()
  const router   = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [stats] = useState(() => getStats())

  const firstName = user?.name?.split(' ')[0] || 'Kullanıcı'
  const { label }  = greeting(firstName)

  return (
    <main className={styles.page}>
      {/* Header */}
      <header className={`${styles.header} anim-fade-up`}>
        <div className={styles.greetBlock}>
          <Image src="/logo.png" alt="RoadLingo" width={2304} height={1536} sizes="160px" loading="eager" className={styles.brandLogo} />
          <p className={styles.greetLabel}>{label}</p>
          <h1 className={styles.greetName}>{firstName}</h1>
          <p className={styles.greetSub}>
            {stats.totalWritings === 0 ? 'İlk yazını yazmaya hazır mısın?' :
             `${stats.totalWritings} yazı tamamlandı`}
          </p>
        </div>
        <div className={styles.avatar}>{firstName.charAt(0).toUpperCase()}</div>
      </header>

      {/* Stats */}
      <div className={`${styles.stats} anim-fade-up d1`}>
        {[
          { val: stats.totalWritings, lbl: 'Yazı' },
          { val: stats.avgBandScore > 0 ? stats.avgBandScore.toFixed(1) : '—', lbl: 'Ort. Band' },
          { val: stats.totalWords > 999 ? `${(stats.totalWords/1000).toFixed(1)}k` : stats.totalWords || '—', lbl: 'Kelime' },
        ].map(s => (
          <div key={s.lbl} className={styles.statCard}>
            <span className={styles.statVal}>{s.val}</span>
            <span className={styles.statLbl}>{s.lbl}</span>
          </div>
        ))}
      </div>

      <PlanCard />

      {/* Skill sections */}
      <p className={`${styles.sectionTitle} anim-fade-up d2`}>TOEFL Bölümleri</p>
      <div className={`${styles.mainCards} anim-fade-up d2`}>
        {TOEFL_SECTIONS.map((section) => {
          const ready = section.tasks.filter((t) => t.status === 'ready').length
          return (
            <button
              key={section.id}
              id={`home-${section.id}`}
              className={`${styles.mainCard} ${styles[`card_${section.id}`]}`}
              onClick={() => router.push(section.href)}
            >
              <span className={styles.cardEmoji}>{section.emoji}</span>
              <span className={styles.cardTitle}>{section.labelTr}</span>
              <span className={styles.cardKicker}>{section.label}</span>
              <span className={styles.cardDesc}>{ready}/{section.tasks.length} GÖREV HAZIR →</span>
            </button>
          )
        })}
      </div>

      <button id="home-history" className={`${styles.historyRow} anim-fade-up d3`} onClick={() => router.push('/app/history')}>
        <span className={styles.cardEmoji}>📁</span>
        <span className={styles.historyText}>
          <span className={styles.cardTitle}>Geçmiş</span>
          <span className={styles.cardDesc}>Yazılarını ve geri bildirimlerini gör</span>
        </span>
        <span className={styles.historyArrow}>→</span>
      </button>

      {/* Streak */}
      {stats.streak > 0 && (
        <div className={`anim-fade-up d3`}>
          <span className={styles.streakPill}>🔥 {stats.streak} günlük seri devam ediyor</span>
        </div>
      )}
    </main>
  )
}
