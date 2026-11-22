'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MascotSpeech from '@/components/MascotSpeech'
import { savePrefs } from '@/lib/data/account'
import { STORED_SSR, useStoredValue } from '@/lib/exam/useStoredValue'
import styles from '../onboarding/onboarding.module.css'

const CONFIG = {
  toefl: { label: 'TOEFL', max: 6, min: 0 },
  ielts: { label: 'IELTS', max: 9, min: 0 },
} as const

type ExamId = keyof typeof CONFIG

export default function Onboarding2Page() {
  const router = useRouter()
  const storedExam = useStoredValue('selectedExam')
  const exam: ExamId | null = storedExam === 'toefl' || storedExam === 'ielts' ? storedExam : null
  const [scoreChoice, setScore] = useState<number | null>(null)
  const score = scoreChoice ?? (exam === 'toefl' ? 4.5 : 6.5)
  const [joke, setJoke] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (storedExam !== STORED_SSR && !exam) router.replace('/onboarding')
  }, [storedExam, exam, router])

  if (!exam) return null
  const { label, max, min } = CONFIG[exam]
  const pct = ((score - min) / (max - min)) * 100

  const confirm = () => {
    if (score === 0) {
      setJoke(true)
      return
    }
    void savePrefs({ targetScore: score })
    router.replace('/onboarding3')
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <MascotSpeech
          key={joke ? 'joke' : 'ask'}
          title={joke ? 'Hop hop! 🧭' : `${label} 🎯`}
          text={joke
            ? 'Hedefin yoksa nereye gidiyoruz? Pusulasız gemiye rüzgar da yardım edemez, bir puan seç!'
            : `Hedef puanın kaç? (${max} üzerinden)`}
          onDone={() => setDone(true)}
        />
        <div className={`${done ? styles.buttonsVisible : styles.buttonsHidden}`}>
        <div className={styles.scoreValue}>{score.toFixed(1)}</div>
        <input
          id="score-slider"
          type="range"
          className={styles.slider}
          min={min}
          max={max}
          step={0.5}
          value={score}
          onChange={e => {
            setScore(parseFloat(e.target.value))
            setJoke(false)
          }}
          style={{ ['--pct' as string]: `${pct}%` }}
        />
        <div className={styles.scale}><span>{min}</span><span>{max}</span></div>
        <button id="score-confirm" className={styles.confirmBtn} onClick={confirm}>Devam</button>
        <button className={styles.backBtn} onClick={() => router.replace('/onboarding')}>← Geri</button>
        </div>
      </div>
    </main>
  )
}
