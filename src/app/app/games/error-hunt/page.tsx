'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { ERROR_TYPES, MISS_PENALTY, TIME_LIMIT, type ErrorHuntSet } from '@/lib/games/errorHunt'
import { readBest, readGameLevel, saveBest, saveGameLevel } from '@/lib/games/progress'
import { TOEFL_LEVELS, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './errorHunt.module.css'

const GAME = 'error-hunt'
const HIT_POINTS = 100
const COMBO_POINTS = 50
const TIME_BONUS_PER_SEC = 10

/* ── Passage pieces: plain words are tappable too (tapping a correct word costs time) ── */

type Piece =
  | { kind: 'gap'; text: string }
  | { kind: 'word'; id: string; text: string; lead: string; trail: string }
  | { kind: 'error'; index: number; text: string; lead: string; trail: string }

/**
 * Words keep their punctuation (lead / trail) so a line never breaks between
 * a tappable word and the comma or full stop after it.
 */
function toPieces(set: ErrorHuntSet): Piece[] {
  const out: Piece[] = []
  set.segments.forEach((seg, si) => {
    if (seg.type === 'error') {
      out.push({ kind: 'error', index: seg.index, text: seg.value, lead: '', trail: '' })
      return
    }
    seg.value.split(/(\s+)/).forEach((chunk, ci) => {
      if (!chunk) return
      if (/^\s+$/.test(chunk)) return void out.push({ kind: 'gap', text: chunk })
      const [, lead, core, trail] = /^([^A-Za-z0-9'’]*)(.*?)([^A-Za-z0-9'’]*)$/.exec(chunk) ?? ['', '', chunk, '']
      const prev = out[out.length - 1]
      if (!core) {
        // Punctuation right after an error span ("{go|goes}.") sticks to it.
        if (prev && prev.kind !== 'gap' && ci === 0) prev.trail += chunk
        else out.push({ kind: 'gap', text: chunk })
        return
      }
      out.push({ kind: 'word', id: `${si}-${ci}`, text: core, lead, trail })
    })
  })
  return out
}

/* ── Game state ── */

type Phase = 'setup' | 'loading' | 'playing' | 'done'
type Flash = { kind: 'hit'; index: number; gained: number } | { kind: 'miss'; n: number } | null

type State = {
  phase: Phase
  set: ErrorHuntSet | null
  found: number[]
  misses: string[]
  combo: number
  points: number
  deadline: number
  remaining: number
  flash: Flash
  timeBonus: number
  reason: 'cleared' | 'timeout' | 'quit' | null
  prevBest: number
}

type Action =
  | { type: 'setup' }
  | { type: 'loading' }
  | { type: 'start'; set: ErrorHuntSet; now: number; prevBest: number }
  | { type: 'tick'; now: number }
  | { type: 'hit'; index: number; now: number }
  | { type: 'miss'; id: string; now: number }
  | { type: 'quit' }

const initial: State = {
  phase: 'setup',
  set: null,
  found: [],
  misses: [],
  combo: 0,
  points: 0,
  deadline: 0,
  remaining: 0,
  flash: null,
  timeBonus: 0,
  reason: null,
  prevBest: 0,
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setup':
      return { ...initial }
    case 'loading':
      return { ...initial, phase: 'loading' }
    case 'start': {
      const ms = a.set.timeLimit * 1000
      return { ...initial, phase: 'playing', set: a.set, deadline: a.now + ms, remaining: ms, prevBest: a.prevBest }
    }
    case 'tick': {
      if (s.phase !== 'playing') return s
      const remaining = Math.max(0, s.deadline - a.now)
      return remaining === 0 ? { ...s, remaining, phase: 'done', reason: 'timeout' } : { ...s, remaining }
    }
    case 'hit': {
      if (s.phase !== 'playing' || !s.set || s.found.includes(a.index)) return s
      const gained = HIT_POINTS + COMBO_POINTS * s.combo
      const found = [...s.found, a.index]
      const remaining = Math.max(0, s.deadline - a.now)
      const next = { ...s, found, remaining, combo: s.combo + 1, points: s.points + gained, flash: { kind: 'hit', index: a.index, gained } as Flash }
      if (found.length < s.set.errors.length) return next
      return { ...next, phase: 'done', reason: 'cleared', timeBonus: Math.ceil(remaining / 1000) * TIME_BONUS_PER_SEC }
    }
    case 'miss': {
      if (s.phase !== 'playing' || s.misses.includes(a.id)) return s
      const deadline = s.deadline - MISS_PENALTY * 1000
      const remaining = Math.max(0, deadline - a.now)
      const next = { ...s, deadline, remaining, combo: 0, misses: [...s.misses, a.id], flash: { kind: 'miss', n: s.misses.length + 1 } as Flash }
      return remaining === 0 ? { ...next, phase: 'done', reason: 'timeout' } : next
    }
    case 'quit':
      return s.phase === 'playing' ? { ...s, phase: 'done', reason: 'quit' } : s
  }
}

const REASON_TITLE = { cleared: 'Hepsini buldun!', timeout: 'Süre doldu', quit: 'Tur bitti' } as const

export default function ErrorHuntPage() {
  const router = useRouter()
  // Rendered client-only (AppLayout waits for auth), so localStorage is safe to read here.
  const [level, setLevel] = useState<ToeflLevel>(() => readGameLevel(GAME))
  const [best, setBest] = useState(() => readBest(GAME))
  const [error, setError] = useState<string | null>(null)
  const [s, dispatch] = useReducer(reducer, initial)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  // Clock: 10 updates a second while a round is running.
  useEffect(() => {
    if (s.phase !== 'playing') return
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 100)
    return () => clearInterval(id)
  }, [s.phase])

  const total = s.points + s.timeBonus
  const record = s.phase === 'done' && total > s.prevBest

  // Keep the best score per level.
  useEffect(() => {
    if (record) saveBest(GAME, level, total)
  }, [record, level, total])

  const pieces = useMemo(() => (s.set ? toPieces(s.set) : []), [s.set])

  const chooseLevel = (l: ToeflLevel) => {
    setLevel(l)
    saveGameLevel(GAME, l)
  }

  const startRound = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setBest(readBest(GAME))
    dispatch({ type: 'loading' })
    try {
      const res = await fetch(`/api/games/error-hunt?level=${level}${seenParam(GAME)}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const set = (await res.json()) as ErrorHuntSet
      markSeen(GAME, set.contentId)
      dispatch({ type: 'start', set, now: Date.now(), prevBest: readBest(GAME)[level] ?? 0 })
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Paragraf yüklenemedi. Tekrar dene.')
      dispatch({ type: 'setup' })
    }
  }

  const playing = s.phase === 'playing'
  const done = s.phase === 'done'
  const set = s.set
  const timeShare = set ? s.remaining / (set.timeLimit * 1000) : 0
  const seconds = Math.ceil(s.remaining / 1000)

  const renderPassage = () => (
    <p className={styles.text}>
      {pieces.map((p, i) => {
        if (p.kind === 'gap') return <span key={i}>{p.text}</span>
        if (p.kind === 'word') {
          const missed = s.misses.includes(p.id)
          return (
            <span key={i} className={styles.chunk}>
              {p.lead}
              <button
                type="button"
                className={`${styles.word} ${missed ? styles.wordMiss : ''}`}
                onClick={() => dispatch({ type: 'miss', id: p.id, now: Date.now() })}
                disabled={!playing || missed}
              >
                {p.text}
              </button>
              {p.trail}
            </span>
          )
        }
        const err = set!.errors[p.index]
        const isFound = s.found.includes(p.index)
        if (isFound || done) {
          return (
            <span key={i} className={styles.chunk}>
              {p.lead}
              <span className={`${styles.fix} ${isFound ? styles.fixFound : styles.fixMissed}`} title={err.explanation}>
                <s className={styles.fixWrong}>{p.text}</s>
                <span className={styles.fixRight}>{err.correct}</span>
              </span>
              {p.trail}
            </span>
          )
        }
        return (
          <span key={i} className={styles.chunk}>
            {p.lead}
            <button
              type="button"
              className={styles.word}
              onClick={() => dispatch({ type: 'hit', index: p.index, now: Date.now() })}
              disabled={!playing}
            >
              {p.text}
            </button>
            {p.trail}
          </span>
        )
      })}
    </p>
  )

  return (
    <main className={`${t.page} ${styles.page}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.push('/app/games')} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Hata Avı</h1>
          <p className={t.hSub}>Oyun · Dilbilgisi</p>
        </div>
      </header>

      {s.phase === 'setup' && (
        <section className={`${t.intro} ${styles.setup} anim-fade-up d1`}>
          <div className={styles.setupHead}>
            <Image src="/mascot-idle.png" alt="" width={72} height={72} className={styles.mascot} unoptimized />
            <p className={t.introText}>
              Paragrafta <strong>3–5 dilbilgisi hatası</strong> saklı. Süre bitmeden hatalı kelimelere dokun; her
              bulduğun hatanın doğrusunu ve nedenini göreceksin.
            </p>
          </div>
          <ul className={styles.rules}>
            <li><span aria-hidden>⏱</span> Süre seviyeye göre: {TOEFL_LEVELS.map((l) => `${l} ${TIME_LIMIT[l]} sn`).join(', ')}</li>
            <li><span aria-hidden>✕</span> Doğru bir kelimeye dokunmak {MISS_PENALTY} saniye götürür</li>
            <li><span aria-hidden>🔥</span> Art arda bulduğun her hata daha çok puan getirir</li>
            <li><span aria-hidden>★</span> Hepsini bulursan kalan her saniye +{TIME_BONUS_PER_SEC} puan</li>
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
          <button id="error-hunt-start" className={t.primaryBtn} onClick={startRound}>▶ Avı Başlat</button>
        </section>
      )}

      {s.phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          Paragraf hazırlanıyor...
        </div>
      )}

      {(playing || done) && set && (
        <div className={styles.board}>
          <aside className={styles.side}>
            {playing ? (
              <div className={styles.hud} aria-label="Oyun durumu">
                <div className={styles.timeRow}>
                  <span className={`${styles.seconds} ${seconds <= 10 ? styles.secondsLow : ''}`}>{seconds} sn</span>
                  <span className={styles.points}>{s.points} puan</span>
                </div>
                <div className={styles.timeTrack} aria-hidden>
                  <div className={`${styles.timeFill} ${seconds <= 10 ? styles.timeFillLow : ''}`} style={{ width: `${timeShare * 100}%` }} />
                </div>
                <div className={styles.timeRow}>
                  <span className={styles.dots} aria-label={`${s.found.length} / ${set.errors.length} hata bulundu`}>
                    {set.errors.map((_, i) => (
                      <span key={i} className={`${styles.dot} ${i < s.found.length ? styles.dotOn : ''}`} />
                    ))}
                  </span>
                  <span className={styles.hudRight}>
                    {s.combo > 1 && <span className={styles.combo}>🔥 {s.combo} seri</span>}
                    <button className={styles.quit} onClick={() => dispatch({ type: 'quit' })}>Bitir</button>
                  </span>
                </div>
              </div>
            ) : (
              <div className={`${t.summary} ${styles.result}`}>
                <span className={t.scoreSub}>{REASON_TITLE[s.reason ?? 'quit']}</span>
                <span className={t.score}>{total}</span>
                {record ? (
                  <span className={styles.record}>★ Yeni rekor!</span>
                ) : (
                  <span className={styles.best}>En iyi: {s.prevBest}</span>
                )}
                <dl className={styles.breakdown}>
                  <div><dt>Bulunan hata</dt><dd>{s.found.length} / {set.errors.length}</dd></div>
                  <div><dt>Yanlış dokunuş</dt><dd>{s.misses.length}</dd></div>
                  <div><dt>Süre bonusu</dt><dd>+{s.timeBonus}</dd></div>
                </dl>
              </div>
            )}

            <div className={`${styles.feedback} ${playing ? styles.feedbackLive : ''}`} aria-live="polite">
              {playing && !s.flash && <p className={styles.hint}>Bu paragrafta {set.errors.length} hata var. Hatalı kelimeye dokun.</p>}
              {playing && s.flash?.kind === 'miss' && (
                <p key={s.flash.n} className={`${styles.flash} ${styles.flashMiss}`}>✕ Bu kelimede hata yok. −{MISS_PENALTY} sn</p>
              )}
              {playing && s.flash?.kind === 'hit' && (
                <div key={s.flash.index} className={`${styles.flash} ${styles.flashHit}`}>
                  <p className={styles.flashHead}>
                    <span>✓ {set.errors[s.flash.index].wrong} → <strong>{set.errors[s.flash.index].correct}</strong></span>
                    <span className={styles.gain}>+{s.flash.gained}</span>
                  </p>
                  <span className={styles.typeChip}>{ERROR_TYPES[set.errors[s.flash.index].type]}</span>
                  <p className={styles.explain}>{set.errors[s.flash.index].explanation}</p>
                </div>
              )}
            </div>

            {done && (
              <div className={styles.actions}>
                <button id="error-hunt-again" className={t.primaryBtn} onClick={startRound}>↺ Yeni Tur</button>
                <div className={t.btnRow}>
                  <button className={t.secondaryBtn} onClick={() => dispatch({ type: 'setup' })}>Seviye</button>
                  <Link href="/app/writing" className={`${t.secondaryBtn} ${styles.linkBtn}`}>✎ Yazı yaz</Link>
                </div>
              </div>
            )}
          </aside>

          <section className={styles.main}>
            <article className={styles.passage}>
              <div className={t.metaRow}>
                <h2 className={styles.title}>{set.title}</h2>
                <span className={t.badge}>{set.level}</span>
              </div>
              {renderPassage()}
            </article>

            {done && (
              <ol className={styles.errorList}>
                {set.errors.map((err, i) => {
                  const ok = s.found.includes(i)
                  return (
                    <li key={i} className={`${styles.errorItem} ${ok ? styles.errorFound : styles.errorMissed}`}>
                      <p className={styles.flashHead}>
                        <span>
                          {ok ? '✓' : '○'} <s>{err.wrong}</s> → <strong>{err.correct}</strong>
                        </span>
                        <span className={styles.typeChip}>{ERROR_TYPES[err.type]}</span>
                      </p>
                      <p className={styles.explain}>{err.explanation}</p>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
