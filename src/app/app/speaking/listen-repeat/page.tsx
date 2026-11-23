'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useClipPlayer } from '@/lib/speaking/useClipPlayer'
import {
  compareRepeat,
  MAX_POINTS,
  POINT_LABEL,
  SENTENCES_PER_SET,
  type ListenRepeatSet,
  type RepeatResult,
} from '@/lib/toefl/listenRepeat'
import { TOEFL_LEVELS, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './listenRepeat.module.css'

const TASK = 'listen-repeat'

type Phase = 'setup' | 'loading' | 'brief' | 'play' | 'record' | 'result' | 'done'
type Attempt = RepeatResult & { said: string }

/* ── Browser speech recognition (Chrome, Edge, Safari) ── */

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

function speechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function Marks({ result }: { result: RepeatResult }) {
  return (
    <p className={styles.marks}>
      {result.words.map((w, i) => (
        <span key={i}>
          <span className={w.ok ? styles.wordOk : styles.wordMiss}>{w.word}</span>{' '}
        </span>
      ))}
    </p>
  )
}

export default function ListenRepeatPage() {
  const router = useRouter()
  const player = useClipPlayer()
  const { prepare, play, stop: stopAudio, reset } = player

  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [practice, setPractice] = useState(true)
  const [set, setSet] = useState<ListenRepeatSet | null>(null)
  const [idx, setIdx] = useState(0)
  const [attempts, setAttempts] = useState<(Attempt | null)[]>([])
  const [error, setError] = useState<string | null>(null)
  // Client-only render (AppLayout), so feature detection can run in the initializer.
  const [canListen, setCanListen] = useState(() => speechRecognitionCtor() !== null)
  const [notice, setNotice] = useState<string | null>(null)

  // Recording state
  const [heardText, setHeardText] = useState('')
  const [typed, setTyped] = useState('')
  const [left, setLeft] = useState(0)
  const recRef = useRef<SpeechRec | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const finishedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadAbort = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const stopRecognition = useCallback(() => {
    clearTimer()
    const rec = recRef.current
    recRef.current = null
    if (rec) {
      rec.onresult = null
      rec.onend = null
      rec.onerror = null
      try { rec.abort() } catch { /* already stopped */ }
    }
  }, [])

  useEffect(() => () => {
    loadAbort.current?.abort()
    stopRecognition()
  }, [stopRecognition])

  /* ── Loading a set ── */

  const load = useCallback(async () => {
    loadAbort.current?.abort()
    const ctrl = new AbortController()
    loadAbort.current = ctrl
    reset()
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/listen-repeat?level=${level}${seenParam(TASK)}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ListenRepeatSet
      markSeen(TASK, data.contentId)
      setSet(data)
      setIdx(0)
      setAttempts(data.sentences.map(() => null))
      prepare(data.sentences.map((text) => [{ text, voice: data.voice }]))
      setPhase('brief')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('İçerik yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [level, prepare, reset])

  /* ── One sentence: listen, then repeat ── */

  const finish = useCallback(
    (at: number, said: string) => {
      if (finishedRef.current || !set) return
      finishedRef.current = true
      stopRecognition()
      const result = compareRepeat(set.sentences[at], said)
      setAttempts((prev) => prev.map((a, i) => (i === at ? { ...result, said: said.trim() } : a)))
      setPhase('result')
    },
    [set, stopRecognition]
  )

  const record = useCallback((at: number) => {
    if (!set) return
    finishedRef.current = false
    finalRef.current = ''
    interimRef.current = ''
    setHeardText('')
    setTyped('')
    setPhase('record')

    const seconds = set.answerTime[at]
    const endAt = Date.now() + seconds * 1000
    setLeft(seconds)
    clearTimer()
    timerRef.current = setInterval(() => {
      const ms = endAt - Date.now()
      setLeft(Math.max(0, ms / 1000))
      if (ms <= 0) {
        clearTimer()
        const rec = recRef.current
        // Let the recognizer deliver its last words, then score.
        if (rec) {
          try { rec.stop() } catch { /* ignore */ }
          setTimeout(() => finish(at, `${finalRef.current} ${interimRef.current}`), 1500)
        }
      }
    }, 100)

    const Ctor = speechRecognitionCtor()
    if (!Ctor) return // typing fallback: the learner submits by hand
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (ev) => {
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript
        if (ev.results[i].isFinal) finalRef.current = `${finalRef.current} ${piece}`.trim()
        else interim += piece
      }
      interimRef.current = interim
      setHeardText(`${finalRef.current} ${interim}`.trim())
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        stopRecognition()
        setCanListen(false)
        setNotice('Mikrofon izni verilmedi. Duyduğunu yazarak devam edebilirsin; izni tarayıcının adres çubuğundan açabilirsin.')
      } else if (ev.error === 'audio-capture') {
        stopRecognition()
        setCanListen(false)
        setNotice('Mikrofon bulunamadı. Duyduğunu yazarak devam edebilirsin.')
      }
    }
    rec.onend = () => {
      // Ended on its own (silence) or after stop(): score what was heard.
      if (recRef.current === rec) finish(at, `${finalRef.current} ${interimRef.current}`)
    }
    recRef.current = rec
    try {
      rec.start()
    } catch {
      stopRecognition()
      setCanListen(false)
      setNotice('Mikrofon başlatılamadı. Duyduğunu yazarak devam edebilirsin.')
    }
  }, [finish, set, stopRecognition])

  /** Plays sentence `at` once, then opens the microphone. */
  const listen = useCallback(async (at: number) => {
    stopRecognition()
    setPhase('play')
    const finished = await play(at)
    if (finished) record(at)
  }, [play, record, stopRecognition])

  const doneSpeaking = () => {
    const rec = recRef.current
    if (!rec) return finish(idx, typed)
    clearTimer()
    try { rec.stop() } catch { /* ignore */ }
    setTimeout(() => finish(idx, `${finalRef.current} ${interimRef.current}`), 1500)
  }

  const next = useCallback(() => {
    if (!set) return
    stopAudio()
    if (idx < set.sentences.length - 1) {
      // After the first sentence the next one starts by itself.
      setIdx(idx + 1)
      void listen(idx + 1)
    } else {
      setPhase('done')
    }
  }, [idx, listen, set, stopAudio])

  useEffect(() => {
    if (phase === 'result') resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [phase])

  useEffect(() => {
    if (phase !== 'result') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, next])

  const replay = async (i: number) => {
    stopAudio()
    await play(i)
  }

  const quit = () => {
    stopAudio()
    stopRecognition()
    router.push('/app/speaking')
  }

  const attempt = attempts[idx]
  const total = attempts.reduce((n, a) => n + (a?.points ?? 0), 0)
  const maxTotal = (set?.sentences.length ?? SENTENCES_PER_SET) * MAX_POINTS
  const timeShare = set ? Math.min(1, left / set.answerTime[idx]) : 0
  const preparing = player.total > 0 && player.ready < player.total

  return (
    <main className={`${t.page} ${styles.page}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={quit} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Dinle ve Tekrarla</h1>
          <p className={t.hSub}>TOEFL · Listen and Repeat</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            Bir iş yerinde eğitim aldığını düşün: sorumlun sana {SENTENCES_PER_SET} kısa cümle söyleyecek, cümleler giderek
            uzayacak. Her cümleyi <strong>bir kez dinle</strong>, ses bitince mikrofon açılır; cümleyi aynen tekrar et. Her
            cümle 0–{MAX_POINTS} arası puanlanır.
          </p>
          <ul className={styles.tips}>
            <li>🎧 Kulaklık kullan, sessiz bir ortamda çalış.</li>
            <li>🗣️ Kelimeleri atlamadan ve aynı sırayla söyle; ekstra kelime puan düşürür.</li>
            <li>⏱️ Her cümle için cümlenin uzunluğuna göre 6–16 saniyen var.</li>
          </ul>
          {!canListen && (
            <div className={`${t.feedback} ${t.feedbackBad}`}>
              Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome, Edge ya da Safari ile sesli çalışabilirsin; burada
              duyduğunu yazarak (dikte) çalışırsın.
            </div>
          )}
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
          <label className={styles.toggle}>
            <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
            <span>Pratik modu: her cümleyi yeniden deneyebilirsin (sınavda tek hak var)</span>
          </label>
          {error && <div className={`${t.feedback} ${t.feedbackBad}`}>{error}</div>}
          <button id="lr-start" className={t.primaryBtn} onClick={load}>▶ Başla</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          Cümleler hazırlanıyor...
        </div>
      )}

      {set && phase !== 'setup' && phase !== 'loading' && phase !== 'done' && (
        <section className={`${styles.stage} anim-fade-up`}>
          <div className={styles.hud}>
            <span className={styles.title}>{set.title}</span>
            <span className={styles.points}>{total} / {maxTotal} puan</span>
          </div>

          <div className={styles.dots} aria-label={`Cümle ${idx + 1} / ${set.sentences.length}`}>
            {set.sentences.map((_, i) => {
              const a = attempts[i]
              const cls = a ? (a.points >= 4 ? styles.dotGood : a.points >= 2 ? styles.dotMid : styles.dotBad) : i === idx ? styles.dotNow : ''
              return <span key={i} className={`${styles.dot} ${cls}`} />
            })}
          </div>

          {phase === 'brief' && (
            <div className={styles.card}>
              <span className={styles.role}>{set.gender === 'female' ? '♀' : '♂'} {set.speakerRole}</span>
              <p className={styles.scenario}>{set.scenario}</p>
              <p className={styles.scenarioTr}>{set.scenarioTr}</p>
              {notice && <div className={`${t.feedback} ${t.feedbackBad}`}>{notice}</div>}
              <button id="lr-begin" className={t.primaryBtn} onClick={() => void listen(0)}>
                🎧 İlk cümleyi dinle
              </button>
              {preparing && <p className={styles.prep}>Ses hazırlanıyor {player.ready}/{player.total}</p>}
            </div>
          )}

          {phase === 'play' && (
            <div className={`${styles.card} ${styles.cardCenter}`}>
              <span className={styles.stepNo}>Cümle {idx + 1} / {set.sentences.length}</span>
              <div className={`${styles.wave} ${styles.waveOn}`} aria-hidden>
                {Array.from({ length: 18 }, (_, i) => (
                  <span key={i} className={styles.bar} style={{ animationDelay: `${(i % 6) * 0.11}s` }} />
                ))}
              </div>
              <p className={styles.status}>Dinle…</p>
              {player.fallbackUsed && <p className={styles.prep}>Sunucu sesi alınamadı, tarayıcı sesi kullanılıyor.</p>}
            </div>
          )}

          {phase === 'record' && (
            <div className={`${styles.card} ${styles.cardCenter}`}>
              <span className={styles.stepNo}>Cümle {idx + 1} / {set.sentences.length}</span>
              {canListen ? (
                <>
                  <div className={styles.mic} aria-hidden>🎙️</div>
                  <p className={styles.status}>Şimdi tekrar et</p>
                  <p className={styles.live}>{heardText || '…'}</p>
                </>
              ) : (
                <>
                  <p className={styles.status}>Duyduğun cümleyi yaz</p>
                  {notice && <p className={styles.prep}>{notice}</p>}
                  <textarea
                    id="lr-typed"
                    className={styles.typed}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Duyduğun cümle…"
                  />
                </>
              )}
              {/* Typing takes longer than speaking: no clock in the typing fallback. */}
              {canListen && (
                <>
                  <div className={styles.timeTrack}>
                    <div className={`${styles.timeFill} ${timeShare < 0.3 ? styles.timeLow : ''}`} style={{ width: `${timeShare * 100}%` }} />
                  </div>
                  <span className={styles.timer}>{Math.ceil(left)} sn</span>
                </>
              )}
              <button id="lr-done" className={t.primaryBtn} onClick={doneSpeaking}>
                {canListen ? '■ Bitirdim' : '✓ Kontrol et'}
              </button>
            </div>
          )}

          {phase === 'result' && attempt && (
            <div ref={resultRef} className={`${styles.card} ${styles.result}`}>
              <div className={styles.resultHead}>
                <span className={styles.stepNo}>Cümle {idx + 1} / {set.sentences.length}</span>
                <span className={`${styles.pointBadge} ${attempt.points >= 4 ? styles.pbGood : attempt.points >= 2 ? styles.pbMid : styles.pbBad}`}>
                  {attempt.points} / {MAX_POINTS} · {POINT_LABEL[attempt.points]}
                </span>
              </div>
              <Marks result={attempt} />
              <p className={styles.said}>
                <span className={t.label}>Senin söylediğin</span>
                {attempt.said || <em>Hiçbir şey duyulmadı</em>}
              </p>
              {attempt.extra > 0 && attempt.said && (
                <p className={styles.prep}>Cümlede olmayan {attempt.extra} kelime söyledin.</p>
              )}
              <div className={t.btnRow}>
                <button className={t.secondaryBtn} onClick={() => void replay(idx)} disabled={player.status === 'playing'}>
                  ↺ Tekrar dinle
                </button>
                {practice && (
                  <button id="lr-retry" className={t.secondaryBtn} onClick={() => void listen(idx)}>
                    🎙️ Yeniden dene
                  </button>
                )}
              </div>
              <button id="lr-next" className={t.primaryBtn} onClick={next}>
                {idx < set.sentences.length - 1 ? 'Sonraki cümle →' : '✓ Sonuçları gör'}
              </button>
            </div>
          )}

          {phase !== 'result' && (
            <button className={styles.quit} onClick={quit}>Bırak</button>
          )}
        </section>
      )}

      {phase === 'done' && set && (
        <section className="anim-fade-up">
          <div className={t.summary}>
            <span className={t.scoreSub}>{set.title}</span>
            <span className={t.score}>{total} / {maxTotal}</span>
            <span className={t.scoreSub}>
              Ortalama {(total / set.sentences.length).toFixed(1)} / {MAX_POINTS} · %{Math.round((total / maxTotal) * 100)}
            </span>
            <div className={t.btnRow}>
              <button id="lr-again" className={t.primaryBtn} onClick={load}>↺ Yeni set</button>
              <button className={t.secondaryBtn} onClick={() => setPhase('setup')}>Seviye</button>
            </div>
          </div>

          <p className={styles.reviewTitle}>Cümleler</p>
          <ol className={styles.review}>
            {set.sentences.map((s, i) => {
              const a = attempts[i]
              return (
                <li key={i} className={styles.reviewItem}>
                  <div className={styles.reviewHead}>
                    <span className={`${styles.pointBadge} ${!a ? '' : a.points >= 4 ? styles.pbGood : a.points >= 2 ? styles.pbMid : styles.pbBad}`}>
                      {a ? `${a.points} / ${MAX_POINTS}` : '—'}
                    </span>
                    <button className={styles.replay} onClick={() => void replay(i)} aria-label="Cümleyi dinle">▶</button>
                  </div>
                  {a ? <Marks result={a} /> : <p className={styles.marks}>{s}</p>}
                  {a?.said && <p className={styles.saidSmall}>“{a.said}”</p>}
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </main>
  )
}
