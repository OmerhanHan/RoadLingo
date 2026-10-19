'use client'
import { useEffect, useState } from 'react'
import styles from '@/app/onboarding/onboarding.module.css'

type Props = {
  title: string
  text: string
  onDone?: () => void
}

/** Maskot + konuşma balonu. Metni harf harf yazar; değiştirmek için parent'ta `key` verin. */
export default function MascotSpeech({ title, text, onDone }: Props) {
  const chars = Array.from(`${title}\n${text}`)
  const [typed, setTyped] = useState(0)
  const done = typed >= chars.length

  useEffect(() => {
    if (done) {
      onDone?.()
      return
    }
    const t = setTimeout(() => setTyped(n => n + 1), typed === 0 ? 400 : 45)
    return () => clearTimeout(t)
    // onDone kasıtlı olarak bağımlılık dışında: yalnızca yazım bitince bir kez tetiklenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, done])

  const [greet, question = ''] = chars.slice(0, typed).join('').split('\n')

  return (
    <section className={styles.mascotRow}>
      <img
        src={done ? '/mascot-idle.png' : '/mascot-talking.gif'}
        alt="RoadLingo maskotu"
        className={`${styles.mascot} ${done ? '' : styles.mascotTalking}`}
        onClick={() => setTyped(0)}
      />
      <div className={styles.bubble}>
        <h1 className={styles.bubbleTitle}>{greet}</h1>
        <p className={styles.bubbleText}>
          {question}
          {!done && <span className={styles.caret} />}
        </p>
        <span className={styles.srOnly}>{title} {text}</span>
      </div>
    </section>
  )
}
