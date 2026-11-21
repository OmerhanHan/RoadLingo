'use client'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { TOEFL_LEVELS, type CompleteWordsSet, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './complete.module.css'

type Phase = 'setup' | 'loading' | 'playing'
type Gap = Extract<CompleteWordsSet['segments'][number], { type: 'gap' }>

export default function CompleteWordsPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [set, setSet] = useState<CompleteWordsSet | null>(null)
  const [answers, setAnswers] = useState<string[][]>([])
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const boxRefs = useRef(new Map<string, HTMLInputElement>())

  useEffect(() => () => abortRef.current?.abort(), [])

  const gaps = useMemo(
    () => (set?.segments.filter((s): s is Gap => s.type === 'gap') ?? []),
    [set]
  )

  /** Flat, reading-order list of every letter box for keyboard navigation. */
  const order = useMemo(
    () => gaps.flatMap((g) => Array.from(g.missing, (_, c) => `${g.index}-${c}`)),
    [gaps]
  )

  const loadSet = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/complete-words?level=${level}${seenParam('complete-words')}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CompleteWordsSet
      markSeen('complete-words', data.contentId)
      setSet(data)
      setAnswers(
        data.segments.filter((s): s is Gap => s.type === 'gap').map((g) => Array(g.missing.length).fill(''))
      )
      setChecked(false)
      setPhase('playing')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Paragraf yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [level])

  const focusAt = (pos: number) => {
    const key = order[pos]
    if (key) boxRefs.current.get(key)?.focus()
  }

  const setLetter = (gapIdx: number, charIdx: number, value: string) => {
    setAnswers((prev) => {
      const next = prev.map((a) => [...a])
      next[gapIdx][charIdx] = value
      return next
    })
  }

  const onInput = (gapIdx: number, charIdx: number, raw: string) => {
    if (checked) return
    const letter = raw.replace(/[^A-Za-z]/g, '').slice(-1).toLowerCase()
    setLetter(gapIdx, charIdx, letter)
    if (letter) focusAt(order.indexOf(`${gapIdx}-${charIdx}`) + 1)
  }

  const onKeyDown = (gapIdx: number, charIdx: number, e: KeyboardEvent<HTMLInputElement>) => {
    const pos = order.indexOf(`${gapIdx}-${charIdx}`)
    if (e.key === 'Backspace' && !answers[gapIdx]?.[charIdx] && pos > 0) {
      e.preventDefault()
      const [g, c] = order[pos - 1].split('-').map(Number)
      if (!checked) setLetter(g, c, '')
      focusAt(pos - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(pos - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(pos + 1)
    }
  }

  const isGapCorrect = (g: Gap) => (answers[g.index] ?? []).join('').toLowerCase() === g.missing.toLowerCase()
  const filled = answers.length > 0 && answers.every((a) => a.every(Boolean))
  const score = gaps.filter(isGapCorrect).length

  return (
    <main className={t.page}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.back()} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Eksik Harfler</h1>
          <p className={t.hSub}>TOEFL · Complete the Words</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            Paragraftaki bazı kelimelerin ikinci yarısı silindi. Bağlamı kullanarak eksik
            harfleri tamamla. Her kutuya bir harf gelir. Paragraf AI tarafından her seferinde
            yeniden yazılır.
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
          <button id="complete-start" className={t.primaryBtn} onClick={loadSet}>▶ Paragraf Üret</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          AI paragraf yazıyor...
        </div>
      )}

      {phase === 'playing' && set && (
        <section className="anim-fade-up">
          <div className={t.metaRow}>
            <span className={t.progressText}>{set.gapCount} boşluk</span>
            <span className={`${t.badge} ${set.source !== 'fallback' ? t.badgeAi : ''}`}>
              {set.source !== 'fallback' ? `AI · ${set.level}` : 'Hazır paragraf'}
            </span>
          </div>

          <article className={styles.passage}>
            <h2 className={styles.title}>{set.title}</h2>
            <p className={styles.text}>
              {set.segments.map((seg, i) => {
                if (seg.type === 'text') return <span key={i}>{seg.value}</span>
                const state = checked ? (isGapCorrect(seg) ? styles.gapOk : styles.gapBad) : ''
                return (
                  <span key={i} className={`${styles.gap} ${state}`}>
                    <span className={styles.prefix}>{seg.prefix}</span>
                    {Array.from(seg.missing, (_, c) => (
                      <input
                        key={c}
                        ref={(el) => {
                          const key = `${seg.index}-${c}`
                          if (el) boxRefs.current.set(key, el)
                          else boxRefs.current.delete(key)
                        }}
                        className={styles.box}
                        value={answers[seg.index]?.[c] ?? ''}
                        onChange={(e) => onInput(seg.index, c, e.target.value)}
                        onKeyDown={(e) => onKeyDown(seg.index, c, e)}
                        onFocus={(e) => e.target.select()}
                        readOnly={checked}
                        maxLength={2}
                        inputMode="text"
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        aria-label={`Boşluk ${seg.index + 1}, harf ${c + 1}`}
                      />
                    ))}
                    {checked && !isGapCorrect(seg) && (
                      <span className={styles.correction}>{seg.prefix}{seg.missing}</span>
                    )}
                  </span>
                )
              })}
            </p>
          </article>

          {checked ? (
            <div className={t.summary}>
              <span className={t.scoreSub}>Skorun</span>
              <span className={t.score}>{score} / {set.gapCount}</span>
              <div className={t.btnRow}>
                <button className={t.secondaryBtn} onClick={() => setPhase('setup')}>Seviye</button>
                <button className={t.primaryBtn} onClick={loadSet}>↺ Yeni Paragraf</button>
              </div>
            </div>
          ) : (
            <button id="complete-check" className={t.primaryBtn} onClick={() => setChecked(true)} disabled={!filled}>
              ✓ Kontrol Et
            </button>
          )}
        </section>
      )}
    </main>
  )
}
