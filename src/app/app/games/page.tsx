'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { readBest } from '@/lib/games/progress'
import { TOEFL_LEVELS } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './games.module.css'

type GameCard = {
  id: string
  emoji: string
  title: string
  skill: string
  desc: string
  href?: string
  accent: 'butter' | 'sage' | 'slate'
}

const GAMES: GameCard[] = [
  {
    id: 'error-hunt',
    emoji: '🔍',
    title: 'Hata Avı',
    skill: 'Dilbilgisi · Yazma',
    desc: 'Paragraftaki gizli hataları süre bitmeden bul, her birinin nedenini öğren.',
    href: '/app/games/error-hunt',
    accent: 'butter',
  },
  {
    id: 'word-road',
    emoji: '🛣️',
    title: 'Kelime Yolculuğu',
    skill: 'Kelime · Okuma',
    desc: 'Maskotla yola çık; her durakta doğru kelimeyi seçip ilerle.',
    href: '/app/games/word-road',
    accent: 'sage',
  },
  {
    id: 'daily',
    emoji: '📅',
    title: 'Günün Bulmacası',
    skill: 'Kelime · Her gün yeni',
    desc: 'Herkese aynı kelime: Türkçe anlamından İngilizcesini bul, serini koru, sıralamada yerini gör.',
    href: '/app/games/daily',
    accent: 'slate',
  },
]

/** Games: short, AI-free rounds from the content bank (no daily limit on any plan). */
export default function GamesPage() {
  const router = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [tops] = useState(() =>
    Object.fromEntries(
      GAMES.map((g) => {
        const best = readBest(g.id)
        return [g.id, Math.max(0, ...TOEFL_LEVELS.map((l) => best[l] ?? 0))]
      })
    ) as Record<string, number>
  )

  return (
    <main className={`${t.page} ${styles.page}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.push('/app/home')} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Oyunlar</h1>
          <p className={t.hSub}>Kısa turlar · Sınırsız</p>
        </div>
      </header>

      <p className={`${styles.lead} anim-fade-up d1`}>
        Birkaç dakikalık turlarla İngilizceni keskinleştir. Oyunlar her planda sınırsız, günlük haklarından düşmez.
      </p>

      <div className={`${styles.grid} anim-fade-up d2`}>
        {GAMES.map((g) => {
          const ready = Boolean(g.href)
          return (
            <button
              key={g.id}
              id={`game-${g.id}`}
              className={`${styles.card} ${styles[`accent_${g.accent}`]} ${ready ? '' : styles.cardSoon}`}
              onClick={() => g.href && router.push(g.href)}
              disabled={!ready}
            >
              <span className={styles.emoji} aria-hidden>{g.emoji}</span>
              <span className={styles.title}>{g.title}</span>
              <span className={styles.skill}>{g.skill}</span>
              <span className={styles.desc}>{g.desc}</span>
              <span className={styles.foot}>
                {!ready ? 'Yakında' : tops[g.id] > 0 ? `En iyi skor: ${tops[g.id]} · Oyna →` : 'Oyna →'}
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
