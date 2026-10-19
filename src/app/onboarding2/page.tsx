'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MascotSpeech from '@/components/MascotSpeech'
import styles from '../onboarding/onboarding.module.css'

const CONFIG = {
  toefl: { label: 'TOEFL', max: 6, min: 0 },
  ielts: { label: 'IELTS', max: 9, min: 0 },
} as const

type ExamId = keyof typeof CONFIG

export default function Onboarding2Page() {
  const router = useRouter()
  const [exam, setExam] = useState<ExamId | null>(null)
  const [score, setScore] = useState(5)
  const [joke, setJoke] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selectedExam')
    if (saved === 'toefl' || saved === 'ielts') {
      setExam(saved)
      setScore(saved === 'toefl' ? 4.5 : 6.5)
    }
    else router.replace('/onboarding')
  }, [router])

  if (!exam) return null
  const { label, max, min } = CONFIG[exam]
  const pct = ((score - min) / (max - min)) * 100

  const confirm = () => {
    if (score === 0) {
      setJoke(true)
      return
    }
    localStorage.setItem('targetScore', String(score))
    router.replace('/app/home')
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
