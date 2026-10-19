'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MascotSpeech from '@/components/MascotSpeech'
import styles from './onboarding.module.css'

const EXAMS = [
  { id: 'toefl', label: 'TOEFL', desc: 'Test of English as a Foreign Language' },
  { id: 'ielts', label: 'IELTS', desc: 'International English Language Testing System' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [done, setDone] = useState(false)

  const choose = (id: string) => {
    localStorage.setItem('selectedExam', id)
    router.replace('/onboarding2')
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <img src="/logo.png" alt="RoadLingo" className={styles.brandLogo} />

        <MascotSpeech title="Selam 👋" text="Hangi sınava hazırlanıyorsun?" onDone={() => setDone(true)} />

        <div className={`${styles.buttons} ${done ? styles.buttonsVisible : styles.buttonsHidden}`}>
          {EXAMS.map(e => (
            <button key={e.id} id={`exam-${e.id}`} className={styles.examBtn} onClick={() => choose(e.id)}>
              <span className={styles.examLabel}>{e.label}</span>
              <span className={styles.examDesc}>{e.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
