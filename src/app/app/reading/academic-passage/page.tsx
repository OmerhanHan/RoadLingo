'use client'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTION_TYPE_LABEL } from '@/lib/toefl/academicPassage'
import { TOEFL_LEVELS, type AcademicPassageSet, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './passage.module.css'

type Phase = 'setup' | 'loading' | 'reading' | 'review'

const LETTERS = ['A', 'B', 'C', 'D']

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Highlights the first whole-word occurrence of `word` in a paragraph. */
function withHighlight(text: string, word: string | undefined): ReactNode {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(text)
  if (!match) return text
  return (
    <>
      {text.slice(0, match.index)}
      <mark className={styles.mark}>{match[0]}</mark>
      {text.slice(match.index + match[0].length)}
    </>
  )
}

export default function AcademicPassagePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [set, setSet] = useState<AcademicPassageSet | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (phase !== 'reading') return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  const loadSet = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/academic-passage?level=${level}${seenParam('academic-passage')}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as AcademicPassageSet
      markSeen('academic-passage', data.contentId)
      setSet(data)
      setAnswers(Array(data.questions.length).fill(null))
      setIndex(0)
      setElapsed(0)
      setPhase('reading')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Metin yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [level])

  const q = set?.questions[index]
  const selected = answers[index] ?? null
  const reviewing = phase === 'review'
  const allAnswered = answers.length > 0 && answers.every((a) => a !== null)
  const score = set ? set.questions.filter((qq, i) => answers[i] === qq.answer).length : 0

  const choose = (opt: number) => {
    if (reviewing) return
    setAnswers((prev) => prev.map((a, i) => (i === index ? opt : a)))
  }

  return (
    <main className={`${t.page} ${t.pageWide}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.back()} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Akademik Metin</h1>
          <p className={t.hSub}>TOEFL · Read an Academic Passage</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            Üniversite ders kitabı tarzında kısa bir akademik metin okuyacak ve <strong>5 soruyu</strong> cevaplayacaksın:
            ana fikir, detay, kelime anlamı, çıkarım ve yazarın amacı. Metin ve sorular AI tarafından her seferinde yeniden üretilir.
          </p>
          <div>
            <span className={t.label}>Seviye</span>
            <div className={t.levelRow}>
              {TOEFL_LEVELS.map((l) => (
                <button key={l} className={`${t.levelBtn} ${level === l ? t.levelActive : ''}`} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {error && <div className={`${t.feedback} ${t.feedbackBad}`}>{error}</div>}
          <button id="passage-start" className={t.primaryBtn} onClick={loadSet}>▶ Metin Üret</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          AI metin ve soruları hazırlıyor...
        </div>
      )}

      {(phase === 'reading' || phase === 'review') && set && q && (
        <section className="anim-fade-up">
          <div className={t.metaRow}>
            <span className={`${t.badge} ${set.source !== 'fallback' ? t.badgeAi : ''}`}>
              {set.source !== 'fallback' ? `AI · ${set.level}` : 'Hazır metin'}
            </span>
            <span className={t.timer}>⏱ {formatTime(elapsed)}</span>
          </div>

          <div className={t.split}>
            <div className={t.splitText}>
              <article className={styles.passage}>
                <h2 className={styles.title}>{set.title}</h2>
                {set.paragraphs.map((p, i) => (
                  <p key={i} className={styles.paragraph}>{withHighlight(p, q.highlight)}</p>
                ))}
              </article>
            </div>

            <div className={t.splitSide}>
              {reviewing && (
                <div className={`${t.summary} ${styles.scoreBox}`}>
                  <span className={t.scoreSub}>Skorun · {formatTime(elapsed)}</span>
                  <span className={t.score}>{score} / {set.questions.length}</span>
                </div>
              )}

              <nav className={styles.dots} aria-label="Sorular">
                {set.questions.map((qq, i) => {
                  const state = reviewing
                    ? answers[i] === qq.answer ? styles.dotOk : styles.dotBad
                    : answers[i] !== null ? styles.dotDone : ''
                  return (
                    <button
                      key={i}
                      className={`${styles.dot} ${state} ${i === index ? styles.dotCurrent : ''}`}
                      onClick={() => setIndex(i)}
                      aria-label={`Soru ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </nav>

              <div key={index} className={styles.question}>
                <span className={styles.qType}>{QUESTION_TYPE_LABEL[q.type]}</span>
                <h3 className={styles.qText}>{q.question}</h3>
                <div className={styles.options} role="radiogroup">
                  {q.options.map((opt, i) => {
                    const state = reviewing
                      ? i === q.answer ? styles.optionOk : i === selected ? styles.optionBad : ''
                      : i === selected ? styles.optionSelected : ''
                    return (
                      <button
                        key={i}
                        role="radio"
                        aria-checked={selected === i}
                        className={`${styles.option} ${state}`}
                        onClick={() => choose(i)}
                        disabled={reviewing}
                      >
                        <span className={styles.optionKey}>{LETTERS[i]}</span>
                        <span>{opt}</span>
                      </button>
                    )
                  })}
                </div>
                {reviewing && q.explanation && (
                  <div className={`${t.feedback} ${selected === q.answer ? t.feedbackOk : t.feedbackBad} ${styles.explain}`}>
                    <span className={t.feedbackTitle}>{selected === q.answer ? '✓ Doğru' : '✕ Yanlış'}</span>
                    {q.explanation}
                  </div>
                )}
              </div>

              <div className={t.btnRow}>
                <button className={t.secondaryBtn} onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>← Önceki</button>
                {index < set.questions.length - 1 ? (
                  <button className={t.primaryBtn} onClick={() => setIndex((i) => i + 1)}>Sonraki →</button>
                ) : reviewing ? (
                  <button className={t.primaryBtn} onClick={loadSet}>↺ Yeni Metin</button>
                ) : (
                  <button id="passage-submit" className={t.primaryBtn} onClick={() => { setPhase('review'); setIndex(0) }} disabled={!allAnswered}>
                    ✓ Bitir
                  </button>
                )}
              </div>
              {!reviewing && index === set.questions.length - 1 && !allAnswered && (
                <p className={styles.hint}>Bitirmek için tüm soruları cevapla.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
