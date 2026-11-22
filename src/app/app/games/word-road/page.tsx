'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { LIVES, STOP_TIME, type WordRoadSet, type WordStop } from '@/lib/games/wordRoad'
import { readBest, readGameLevel, saveBest, saveGameLevel } from '@/lib/games/progress'
import { TOEFL_LEVELS, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './wordRoad.module.css'

const GAME = 'word-road'
const BASE_POINTS = 100
const SPEED_POINTS = 50
const STREAK_POINTS = 20
/** A correct answer moves on by itself after this long. */
const AUTO_NEXT_MS = 900

/* ── Game state ── */

type Phase = 'setup' | 'loading' | 'playing' | 'done'
type Answer = { choice: string | null; correct: boolean; gained: number }

type State = {
  phase: Phase
  set: WordRoadSet | null
  index: number
  lives: number
  streak: number
  points: number
  results: Answer[]
  deadline: number
  remaining: number
  reveal: Answer | null
  reason: 'arrived' | 'out' | 'quit' | null
  prevBest: number
  /** Bumped on every correct answer to replay the mascot's hop. */
  hop: number
}

type Action =
  | { type: 'setup' }
  | { type: 'loading' }
  | { type: 'start'; set: WordRoadSet; now: number; prevBest: number }
  | { type: 'tick'; now: number }
  | { type: 'answer'; choice: string | null; now: number }
  | { type: 'next'; now: number }
  | { type: 'quit' }

const initial: State = {
  phase: 'setup',
  set: null,
  index: 0,
  lives: LIVES,
  streak: 0,
  points: 0,
  results: [],
  deadline: 0,
  remaining: 0,
  reveal: null,
  reason: null,
  prevBest: 0,
  hop: 0,
}

function answer(s: State, choice: string | null, now: number): State {
  if (s.phase !== 'playing' || !s.set || s.reveal) return s
  const stop = s.set.stops[s.index]
  const remaining = Math.max(0, s.deadline - now)
  const correct = choice === stop.answer
  const gained = correct
    ? BASE_POINTS + Math.round((SPEED_POINTS * remaining) / (s.set.stopTime * 1000)) + STREAK_POINTS * s.streak
    : 0
  const result: Answer = { choice, correct, gained }
  return {
    ...s,
    remaining,
    reveal: result,
    results: [...s.results, result],
    points: s.points + gained,
    streak: correct ? s.streak + 1 : 0,
    lives: correct ? s.lives : s.lives - 1,
    hop: correct ? s.hop + 1 : s.hop,
  }
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setup':
      return { ...initial }
    case 'loading':
      return { ...initial, phase: 'loading' }
    case 'start':
      return {
        ...initial,
        phase: 'playing',
        set: a.set,
        deadline: a.now + a.set.stopTime * 1000,
        remaining: a.set.stopTime * 1000,
        prevBest: a.prevBest,
      }
    case 'tick': {
      if (s.phase !== 'playing' || s.reveal) return s
      const remaining = Math.max(0, s.deadline - a.now)
      return remaining === 0 ? answer(s, null, a.now) : { ...s, remaining }
    }
    case 'answer':
      return answer(s, a.choice, a.now)
    case 'next': {
      if (s.phase !== 'playing' || !s.set || !s.reveal) return s
      if (s.lives <= 0) return { ...s, phase: 'done', reason: 'out' }
      if (s.index + 1 >= s.set.stops.length) return { ...s, phase: 'done', reason: 'arrived', index: s.set.stops.length }
      const ms = s.set.stopTime * 1000
      return { ...s, index: s.index + 1, reveal: null, deadline: a.now + ms, remaining: ms }
    }
    case 'quit':
      return s.phase === 'playing' ? { ...s, phase: 'done', reason: 'quit' } : s
  }
}

/** Stars for a finished route: 3 with no mistakes, then one less per mistake. */
function starsFor(s: State): number {
  if (s.reason !== 'arrived') return 0
  return Math.max(1, 3 - s.results.filter((r) => !r.correct).length)
}

const REASON_TITLE = { arrived: 'Varış! 🏁', out: 'Yolda kaldın', quit: 'Yolculuk bitti' } as const

/* ── Pieces ── */

function Sentence({ stop, revealed }: { stop: WordStop; revealed: boolean }) {
  if (stop.kind === 'gap') {
    const [before, after] = stop.sentence.split('___')
    return (
      <p className={styles.sentence}>
        {before}
        <span className={`${styles.blank} ${revealed ? styles.blankFilled : ''}`}>{revealed ? stop.answer : '?'}</span>
        {after}
      </p>
    )
  }
  const parts = stop.sentence.split(/\*([^*]+)\*/)
  return (
    <p className={styles.sentence}>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} className={styles.target}>{part}</mark> : <span key={i}>{part}</span>))}
    </p>
  )
}

function Road({ s }: { s: State }) {
  const total = s.set?.stops.length ?? 0
  const pos = (i: number) => `${(i / total) * 100}%`
  const lastWrong = s.reveal && !s.reveal.correct
  return (
    <div className={styles.road} aria-hidden>
      <div className={styles.track}>
        <div className={styles.lane} />
        {Array.from({ length: total }, (_, i) => {
          const r = s.results[i]
          const state = r ? (r.correct ? styles.nodeGood : styles.nodeBad) : i === s.index ? styles.nodeNow : ''
          return <span key={i} className={`${styles.node} ${state}`} style={{ left: pos(i) }} />
        })}
        <span className={styles.flag} style={{ left: '100%' }}>🏁</span>
        <div className={styles.mascotWrap} style={{ left: pos(Math.min(s.index, total)) }}>
          <Image
            key={`${s.hop}-${lastWrong ? s.results.length : 0}`}
            src="/mascot-idle.png"
            alt=""
            width={44}
            height={44}
            className={`${styles.mascot} ${lastWrong ? styles.mascotOops : s.hop ? styles.mascotHop : ''}`}
            unoptimized
          />
        </div>
      </div>
    </div>
  )
}

export default function WordRoadPage() {
  const router = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [level, setLevel] = useState<ToeflLevel>(() => readGameLevel(GAME))
  const [best, setBest] = useState(() => readBest(GAME))
  const [error, setError] = useState<string | null>(null)
  const [s, dispatch] = useReducer(reducer, initial)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  // Per-stop clock (paused while the answer is shown).
  useEffect(() => {
    if (s.phase !== 'playing' || s.reveal) return
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 100)
    return () => clearInterval(id)
  }, [s.phase, s.reveal])

  // A correct answer moves on by itself; a wrong one waits so the learner can read it.
  useEffect(() => {
    if (!s.reveal?.correct) return
    const id = setTimeout(() => dispatch({ type: 'next', now: Date.now() }), AUTO_NEXT_MS)
    return () => clearTimeout(id)
  }, [s.reveal])

  // On phones the explanation and its button can fall below the fold: bring them into view.
  const verdictRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (s.reveal && !s.reveal.correct) verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [s.reveal])

  // Keyboard: 1–3 answer, Enter continues.
  const stop = s.phase === 'playing' && s.set ? s.set.stops[s.index] : null
  useEffect(() => {
    if (!stop) return
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= stop.options.length) dispatch({ type: 'answer', choice: stop.options[n - 1], now: Date.now() })
      else if (e.key === 'Enter') dispatch({ type: 'next', now: Date.now() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stop])

  const stars = starsFor(s)
  const record = s.phase === 'done' && s.points > s.prevBest

  useEffect(() => {
    if (record) saveBest(GAME, level, s.points)
  }, [record, level, s.points])

  const chooseLevel = (l: ToeflLevel) => {
    setLevel(l)
    saveGameLevel(GAME, l)
  }

  const startRoute = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setBest(readBest(GAME))
    dispatch({ type: 'loading' })
    try {
      const res = await fetch(`/api/games/word-road?level=${level}${seenParam(GAME)}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const set = (await res.json()) as WordRoadSet
      markSeen(GAME, set.contentId)
      dispatch({ type: 'start', set, now: Date.now(), prevBest: readBest(GAME)[level] ?? 0 })
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Yol yüklenemedi. Tekrar dene.')
      dispatch({ type: 'setup' })
    }
  }

  const set = s.set
  const seconds = Math.ceil(s.remaining / 1000)
  const timeShare = set ? s.remaining / (set.stopTime * 1000) : 0
  const correctCount = s.results.filter((r) => r.correct).length

  return (
    <main className={`${t.page} ${styles.page}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.push('/app/games')} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Kelime Yolculuğu</h1>
          <p className={t.hSub}>Oyun · Kelime</p>
        </div>
      </header>

      {s.phase === 'setup' && (
        <section className={`${t.intro} ${styles.setup} anim-fade-up d1`}>
          <div className={styles.setupHead}>
            <Image src="/mascot-idle.png" alt="" width={72} height={72} className={styles.setupMascot} unoptimized />
            <p className={t.introText}>
              Maskotla birlikte yola çık. Her durakta bir kelime sorusu var; doğru cevap seni bir sonraki durağa
              taşır. Yolun sonunda geçtiğin kelimeleri anlamlarıyla birlikte göreceksin.
            </p>
          </div>
          <ul className={styles.rules}>
            <li><span aria-hidden>🛣️</span> 8 durak: boşluk doldurma ve eş anlam soruları</li>
            <li><span aria-hidden>⏱</span> Durak başına süre: {TOEFL_LEVELS.map((l) => `${l} ${STOP_TIME[l]} sn`).join(', ')}</li>
            <li><span aria-hidden>♥</span> {LIVES} canın var; yanlış cevap ya da süre dolması bir can götürür</li>
            <li><span aria-hidden>🔥</span> Hızlı ve art arda doğru cevaplar daha çok puan getirir</li>
          </ul>
          <div>
            <span className={t.label}>Seviye</span>
            <div className={t.levelRow}>
              {TOEFL_LEVELS.map((l) => (
                <button key={l} className={`${t.levelBtn} ${level === l ? t.levelActive : ''}`} onClick={() => chooseLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
            <p className={styles.best}>{best[level] ? `En iyi skorun (${level}): ${best[level]}` : 'Bu seviyede henüz rekorun yok.'}</p>
          </div>
          {error && <div className={`${t.feedback} ${t.feedbackBad}`}>{error}</div>}
          <button id="word-road-start" className={t.primaryBtn} onClick={startRoute}>▶ Yola Çık</button>
        </section>
      )}

      {s.phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          Yol hazırlanıyor...
        </div>
      )}

      {(s.phase === 'playing' || s.phase === 'done') && set && (
        <div className={styles.board}>
          <div className={styles.hud}>
            <span className={styles.routeTitle}>{set.title}</span>
            <span className={styles.hudStats}>
              <span className={styles.lives} aria-label={`${s.lives} can`}>
                {Array.from({ length: LIVES }, (_, i) => (
                  <span key={i} className={i < s.lives ? styles.heart : styles.heartLost}>♥</span>
                ))}
              </span>
              <span className={styles.points}>{s.points} puan</span>
            </span>
          </div>

          <Road s={s} />

          {stop && (
            <section className={styles.card} aria-live="polite">
              <div className={styles.cardHead}>
                <span className={styles.stopNo}>Durak {s.index + 1} / {set.stops.length}</span>
                <span className={styles.kind}>{stop.kind === 'gap' ? 'Boşluğu doldur' : 'Anlamca en yakın'}</span>
              </div>

              <Sentence stop={stop} revealed={Boolean(s.reveal)} />

              <div className={styles.timeTrack} aria-hidden>
                <div
                  className={`${styles.timeFill} ${seconds <= 5 ? styles.timeLow : ''}`}
                  style={{ width: `${(s.reveal ? 0 : timeShare) * 100}%` }}
                />
              </div>

              <div className={styles.options}>
                {stop.options.map((o, i) => {
                  const state = !s.reveal
                    ? ''
                    : o === stop.answer
                      ? styles.optRight
                      : o === s.reveal.choice
                        ? styles.optWrong
                        : styles.optDim
                  return (
                    <button
                      key={o}
                      className={`${styles.option} ${state}`}
                      onClick={() => dispatch({ type: 'answer', choice: o, now: Date.now() })}
                      disabled={Boolean(s.reveal)}
                    >
                      <span className={styles.optKey}>{i + 1}</span>
                      {o}
                    </button>
                  )
                })}
              </div>

              {!s.reveal && <p className={styles.timer}>{seconds} sn</p>}

              {s.reveal?.correct && (
                <p className={`${styles.verdict} ${styles.verdictGood}`}>
                  ✓ Doğru! <strong>+{s.reveal.gained}</strong>
                  {s.streak > 1 && <span className={styles.streak}>🔥 {s.streak} seri</span>}
                </p>
              )}
              {s.reveal && !s.reveal.correct && (
                <div ref={verdictRef} className={`${styles.verdict} ${styles.verdictBad}`}>
                  <p>
                    {s.reveal.choice === null ? '⏱ Süre doldu.' : '✕ Olmadı.'} Doğrusu: <strong>{stop.answer}</strong>
                    {' · '}
                    {stop.meaningTr}
                  </p>
                  {stop.note && <p className={styles.note}>{stop.note}</p>}
                  <button id="word-road-next" className={t.primaryBtn} onClick={() => dispatch({ type: 'next', now: Date.now() })}>
                    {s.lives <= 0 ? 'Sonucu gör →' : 'Devam →'}
                  </button>
                </div>
              )}
              {!s.reveal && (
                <button className={styles.quit} onClick={() => dispatch({ type: 'quit' })}>Yolculuğu bitir</button>
              )}
            </section>
          )}

          {s.phase === 'done' && (
            <>
              <section className={`${t.summary} ${styles.result}`}>
                <span className={t.scoreSub}>{REASON_TITLE[s.reason ?? 'quit']}</span>
                {s.reason === 'arrived' && (
                  <span className={styles.stars} aria-label={`${stars} yıldız`}>
                    {[1, 2, 3].map((n) => <span key={n} className={n <= stars ? styles.starOn : styles.starOff}>★</span>)}
                  </span>
                )}
                <span className={t.score}>{s.points}</span>
                {record ? <span className={styles.record}>★ Yeni rekor!</span> : <span className={styles.best}>En iyi: {s.prevBest}</span>}
                <dl className={styles.breakdown}>
                  <div><dt>Doğru cevap</dt><dd>{correctCount} / {s.results.length}</dd></div>
                  <div><dt>Kalan can</dt><dd>{s.lives} / {LIVES}</dd></div>
                </dl>
                <div className={styles.actions}>
                  <button id="word-road-again" className={t.primaryBtn} onClick={startRoute}>↺ Yeni Yol</button>
                  <div className={t.btnRow}>
                    <button className={t.secondaryBtn} onClick={() => dispatch({ type: 'setup' })}>Seviye</button>
                    <Link href="/app/games/error-hunt" className={`${t.secondaryBtn} ${styles.linkBtn}`}>🔍 Hata Avı</Link>
                  </div>
                </div>
              </section>

              {s.results.length > 0 && (
                <section className={styles.words}>
                  <h2 className={styles.wordsTitle}>Bu yolda geçen kelimeler</h2>
                  <ol className={styles.wordList}>
                    {s.results.map((r, i) => {
                      const st = set.stops[i]
                      const target = st.kind === 'synonym' ? /\*([^*]+)\*/.exec(st.sentence)?.[1] : null
                      return (
                        <li key={i} className={`${styles.wordItem} ${r.correct ? styles.wordGood : styles.wordBad}`}>
                          <span className={styles.wordMark}>{r.correct ? '✓' : '✕'}</span>
                          <span className={styles.wordText}>
                            <strong>{target ? `${target} ≈ ${st.answer}` : st.answer}</strong>
                            <span className={styles.wordMeaning}>{st.meaningTr}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </main>
  )
}
