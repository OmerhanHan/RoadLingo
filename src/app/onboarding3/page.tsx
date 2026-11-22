'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import MascotSpeech from '@/components/MascotSpeech'
import { savePrefs } from '@/lib/data/account'
import { STORED_SSR as SSR, useStoredValue } from '@/lib/exam/useStoredValue'
import { voiceDialogue } from '@/lib/speaking/tts/voices'
import { useSpeakingTts } from '@/lib/speaking/useSpeakingTts'
import {
  EXAM_META,
  getPlacementQuestions,
  scorePlacement,
  SECTION_META,
  type ExamId,
  type PlacementResult,
  type PlacementSection,
} from '@/lib/placement/questions'
import base from '../onboarding/onboarding.module.css'
import styles from './placement.module.css'

type Phase = 'intro' | 'test' | 'result'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

/** Renders *word* as underlined emphasis. */
function renderPrompt(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') ? <u key={i}>{part.slice(1, -1)}</u> : <span key={i}>{part}</span>
  )
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PlacementTestPage() {
  const router = useRouter()
  const storedExam = useStoredValue('selectedExam')
  const storedTarget = useStoredValue('targetScore')
  const exam: ExamId | null = storedExam === 'toefl' || storedExam === 'ielts' ? storedExam : null
  const targetNum = Number(storedTarget)
  const target = storedTarget && storedTarget !== SSR && Number.isFinite(targetNum) && targetNum > 0 ? targetNum : null
  const [phase, setPhase] = useState<Phase>('intro')
  const [introDone, setIntroDone] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [remaining, setRemaining] = useState(0)
  const [result, setResult] = useState<PlacementResult | null>(null)
  const tts = useSpeakingTts()
  const ttsStop = tts.stop
  const startedAt = useRef(0)

  useEffect(() => {
    if (storedExam !== SSR && !exam) router.replace('/onboarding')
  }, [storedExam, exam, router])

  const questions = useMemo(() => (exam ? getPlacementQuestions(exam) : []), [exam])
  const meta = exam ? EXAM_META[exam] : null
  const q = questions[index]
  const selected = answers[index] ?? null
  const isLast = index === questions.length - 1

  const stopAudio = ttsStop

  const finish = useCallback(
    (finalAnswers: (number | null)[]) => {
      if (!exam) return
      stopAudio()
      const duration = Math.round((Date.now() - startedAt.current) / 1000)
      const r = scorePlacement(exam, questions, finalAnswers, duration)
      void savePrefs({ placement: r })
      setResult(r)
      setPhase('result')
    },
    [exam, questions, stopAudio]
  )

  const start = () => {
    if (!meta) return
    setAnswers(Array(questions.length).fill(null))
    setIndex(0)
    setRemaining(meta.minutes * 60)
    startedAt.current = Date.now()
    setPhase('test')
  }

  // Countdown
  useEffect(() => {
    if (phase !== 'test') return
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'test' && remaining === 0 && startedAt.current) finish(answers)
  }, [phase, remaining, answers, finish])


  const choose = useCallback(
    (opt: number) => setAnswers((prev) => prev.map((a, i) => (i === index ? opt : a))),
    [index]
  )

  const goNext = useCallback(() => {
    if (selected === null) return
    stopAudio()
    if (isLast) finish(answers)
    else setIndex((i) => i + 1)
  }, [selected, isLast, finish, answers, stopAudio])

  const goBack = () => {
    stopAudio()
    setIndex((i) => Math.max(0, i - 1))
  }

  // Keyboard: A–D / 1–4 to pick, Enter to continue
  useEffect(() => {
    if (phase !== 'test' || !q) return
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase()
      const letter = LETTERS.indexOf(key)
      const digit = Number(e.key) - 1
      if (letter >= 0 && letter < q.options.length) choose(letter)
      else if (digit >= 0 && digit < q.options.length) choose(digit)
      else if (e.key === 'Enter') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, q, choose, goNext])

  const playAudio = () => {
    if (!q?.dialogue?.length) return
    if (tts.isSpeaking) return tts.stop()
    tts.speakDialogue(voiceDialogue(q.dialogue))
  }


  if (!exam || !meta) return null

  /* ── Intro ── */
  if (phase === 'intro') {
    const sections = Array.from(new Set(questions.map((x) => x.section)))
    return (
      <main className={base.page}>
        <div className={base.content}>
          <MascotSpeech
            title="Seni tanıyalım 📝"
            text={`Başlamadan önce kısa bir ${meta.label} seviye testi yapalım. Sana uygun planı buna göre hazırlayacağım.`}
            onDone={() => setIntroDone(true)}
          />

          <div className={introDone ? base.buttonsVisible : base.buttonsHidden}>
            <div className={styles.introCard}>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{questions.length}</span>
                  <span className={styles.statLabel}>Soru</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>~{meta.minutes}</span>
                  <span className={styles.statLabel}>Dakika</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{sections.length}</span>
                  <span className={styles.statLabel}>Bölüm</span>
                </div>
              </div>
              <div className={styles.chips}>
                {sections.map((s) => (
                  <span key={s} className={`${styles.chip} ${styles[`sec_${s}`]}`}>
                    <span className={styles.chipIcon}>{SECTION_META[s].icon}</span>
                    {SECTION_META[s].label}
                  </span>
                ))}
              </div>
              <p className={styles.introNote}>
                Bilmediğin soruları tahmin etmeye çalışma — sonuç ne kadar dürüst olursa planın o kadar iyi olur.
              </p>
            </div>

            <button id="placement-start" className={base.confirmBtn} onClick={start}>Teste Başla →</button>
            <button className={base.backBtn} onClick={() => router.replace('/app/home')}>Şimdilik atla</button>
          </div>
        </div>
      </main>
    )
  }

  /* ── Result ── */
  if (phase === 'result' && result) {
    const pct = Math.round((result.correct / result.total) * 100)
    const R = 54
    const C = 2 * Math.PI * R
    const reached = target !== null && result.estimatedScore >= target
    return (
      <main className={base.page}>
        <div className={`${base.content} ${styles.wide}`}>
          <MascotSpeech
            title={pct >= 70 ? 'Harika iş! 🎉' : 'Test bitti! 🙌'}
            text={
              target === null
                ? 'Seviyeni belirledim. Şimdi sana özel çalışma planını hazırlıyorum.'
                : reached
                  ? `Hedefin olan ${target.toFixed(1)} puana çok yakınsın. Şimdi bunu sağlamlaştıralım!`
                  : `Hedefin ${target.toFixed(1)}. Aradaki farkı birlikte kapatacağız, adım adım.`
            }
          />

          <div className={styles.resultCard}>
            <div className={styles.ringWrap}>
              <svg viewBox="0 0 128 128" className={styles.ring} aria-hidden>
                <circle cx="64" cy="64" r={R} className={styles.ringTrack} />
                <circle
                  cx="64" cy="64" r={R}
                  className={styles.ringFill}
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - pct / 100)}
                />
              </svg>
              <div className={styles.ringCenter}>
                <span className={styles.ringScore}>{result.estimatedScore.toFixed(1)}</span>
                <span className={styles.ringLabel}>Tahmini {meta.label}</span>
              </div>
            </div>

            <div className={styles.resultMeta}>
              <div className={styles.metaBox}>
                <span className={styles.metaValue}>{result.cefr}</span>
                <span className={styles.metaLabel}>CEFR</span>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaValue}>{result.correct}/{result.total}</span>
                <span className={styles.metaLabel}>Doğru</span>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaValue}>{target !== null ? target.toFixed(1) : '—'}</span>
                <span className={styles.metaLabel}>Hedef</span>
              </div>
            </div>

            <div className={styles.breakdown}>
              {(Object.keys(result.bySection) as PlacementSection[])
                .filter((s) => result.bySection[s].total > 0)
                .map((s) => {
                  const { correct, total } = result.bySection[s]
                  return (
                    <div key={s} className={styles.barRow}>
                      <span className={styles.barLabel}>
                        <span className={styles.chipIcon}>{SECTION_META[s].icon}</span>
                        {SECTION_META[s].label}
                      </span>
                      <div className={styles.barTrack}>
                        <div className={`${styles.barFill} ${styles[`sec_${s}`]}`} style={{ width: `${(correct / total) * 100}%` }} />
                      </div>
                      <span className={styles.barValue}>{correct}/{total}</span>
                    </div>
                  )
                })}
            </div>

            <p className={styles.disclaimer}>Bu kısa test yalnızca kabaca bir tahmindir; resmi sınav puanı değildir.</p>
          </div>

          <button id="placement-finish" className={base.confirmBtn} onClick={() => router.replace('/app/home')}>
            Planıma Git →
          </button>
          <button className={base.backBtn} onClick={() => { setPhase('intro'); setIntroDone(true) }}>↺ Testi tekrarla</button>
        </div>
      </main>
    )
  }

  /* ── Test ── */
  if (!q) return null
  const sec = SECTION_META[q.section]
  const lowTime = remaining <= 60

  return (
    <main className={styles.testPage}>
      <div className={styles.testInner}>
        <header className={styles.topBar}>
          <button className={styles.iconBtn} onClick={() => router.replace('/app/home')} aria-label="Testten çık">✕</button>
          <div className={styles.segments} aria-label={`Soru ${index + 1} / ${questions.length}`}>
            {questions.map((_, i) => (
              <span
                key={i}
                className={`${styles.segment} ${i < index ? styles.segDone : ''} ${i === index ? styles.segCurrent : ''}`}
              />
            ))}
          </div>
          <span className={`${styles.timer} ${lowTime ? styles.timerLow : ''}`}>⏱ {formatTime(remaining)}</span>
        </header>

        <div className={styles.qMeta}>
          <span className={`${styles.chip} ${styles[`sec_${q.section}`]}`}>
            <span className={styles.chipIcon}>{sec.icon}</span>
            {sec.label}
          </span>
          <span className={styles.counter}>{index + 1} / {questions.length}</span>
        </div>

        <section key={q.id} className={styles.qCard}>
          <p className={styles.instruction}>{q.instruction}</p>

          {q.passage && <blockquote className={styles.passage}>{q.passage}</blockquote>}

          {q.dialogue && q.dialogue.length > 0 && (
            <button className={`${styles.audio} ${tts.status === 'playing' ? styles.audioPlaying : ''}`} onClick={playAudio}>
              <span className={styles.audioIcon}>{tts.isSpeaking ? '■' : '▶'}</span>
              <span className={styles.wave} aria-hidden>
                {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.1}s` }} />)}
              </span>
              <span className={styles.audioLabel}>{tts.status === 'loading' ? 'Hazırlanıyor…' : tts.status === 'playing' ? 'Çalıyor…' : 'Dinle'}</span>
            </button>
          )}

          <h2 className={styles.prompt}>{renderPrompt(q.prompt)}</h2>

          <div className={styles.options} role="radiogroup">
            {q.options.map((opt, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={selected === i}
                className={`${styles.option} ${selected === i ? styles.optionSelected : ''}`}
                onClick={() => choose(i)}
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                <span className={styles.optionKey}>{LETTERS[i]}</span>
                <span className={styles.optionText}>{opt}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <button className={styles.secondary} onClick={goBack} disabled={index === 0}>← Geri</button>
          <button id="placement-next" className={styles.primary} onClick={goNext} disabled={selected === null}>
            {isLast ? 'Bitir ✓' : 'Devam →'}
          </button>
        </footer>
        <p className={styles.hint}>İpucu: A–D tuşlarıyla seç, Enter ile devam et.</p>
      </div>
    </main>
  )
}
