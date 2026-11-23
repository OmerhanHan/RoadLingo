'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { planHeaders } from '@/lib/plans'
import { cloudData } from '@/lib/data/client'
import {
  HINT_COST,
  HINT_LABELS,
  MAX_HINTS,
  MAX_WRONG_GUESSES,
  NICKNAME_HINT,
  NICKNAME_RULE,
  PART_OF_SPEECH_TR,
  START_POINTS,
  WRONG_GUESS_COST,
  normalizeGuess,
  type DailyBoard,
  type DailyPuzzleView,
} from '@/lib/games/dailyWord'
import t from '@/components/toefl/toefl.module.css'
import styles from './daily.module.css'

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...planHeaders(), ...init.headers } })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

const DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })

function formatWait(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h} sa ${minutes % 60} dk` : `${minutes} dk`
}

function formatSeconds(s: number): string {
  return s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk ${s % 60} sn`
}

/* ── Pieces ── */

function Letters({ pattern, solved }: { pattern: string[]; solved: boolean }) {
  return (
    <div className={styles.letters} aria-label={`${pattern.length} harfli kelime`}>
      {pattern.map((l, i) => (
        <span key={i} className={`${styles.letter} ${l ? styles.letterShown : ''} ${solved ? styles.letterSolved : ''}`}>
          {l ? l.toUpperCase() : ''}
        </span>
      ))}
    </div>
  )
}

function Sentence({ text, answer }: { text: string; answer?: string }) {
  const [before, after] = text.split('___')
  return (
    <p className={styles.sentence}>
      {before}
      <span className={styles.blank}>{answer ?? '_____'}</span>
      {after}
    </p>
  )
}

function Board({ board }: { board: DailyBoard }) {
  if (!board.total) return <p className={styles.muted}>Bugün henüz kimse çözmedi; ilk sen ol.</p>
  const meInTop = board.top.some((r) => r.me)
  return (
    <>
      <p className={styles.muted}>Bugün {board.total} kişi çözdü.</p>
      <ol className={styles.board}>
        {board.top.map((r) => (
          <li key={`${r.rank}-${r.name}`} className={`${styles.boardRow} ${r.me ? styles.boardMe : ''}`}>
            <span className={styles.rank}>{r.rank}</span>
            <span className={styles.boardName}>{r.name}{r.me && ' (sen)'}</span>
            <span className={styles.boardTime}>{formatSeconds(r.seconds)}</span>
            <span className={styles.boardScore}>{r.score}</span>
          </li>
        ))}
        {board.me && !meInTop && (
          <li className={`${styles.boardRow} ${styles.boardMe} ${styles.boardGap}`}>
            <span className={styles.rank}>{board.me.rank}</span>
            <span className={styles.boardName}>{board.me.name} (sen)</span>
            <span className={styles.boardTime}>{formatSeconds(board.me.seconds)}</span>
            <span className={styles.boardScore}>{board.me.score}</span>
          </li>
        )}
      </ol>
    </>
  )
}

function NicknameForm({ current, onSaved }: { current: string | null; onSaved: (n: string) => void }) {
  const [open, setOpen] = useState(!current)
  const [value, setValue] = useState(current ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!open) {
    return (
      <p className={styles.nickLine}>
        Sıralamada <strong>{current}</strong> olarak görünüyorsun.{' '}
        <button className={styles.linkBtn} onClick={() => setOpen(true)}>Değiştir</button>
      </p>
    )
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const nickname = value.trim()
    if (!NICKNAME_RULE.test(nickname)) return setError(NICKNAME_HINT)
    setSaving(true)
    setError(null)
    try {
      const res = await call<{ nickname: string }>('/api/me/nickname', { method: 'PUT', body: JSON.stringify({ nickname }) })
      onSaved(res.nickname)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.nickForm} onSubmit={save}>
      <label htmlFor="nickname" className={t.label}>
        {current ? 'Yeni takma ad' : 'Sıralamada görünecek takma adını seç'}
      </label>
      <div className={styles.guessRow}>
        <input
          id="nickname"
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          autoComplete="off"
          placeholder="ör. kelimeavcisi"
        />
        <button className={styles.guessBtn} disabled={saving || !value.trim()}>{saving ? '...' : 'Kaydet'}</button>
      </div>
      <p className={styles.muted}>{error ?? `${NICKNAME_HINT} Seçmezsen "Oyuncu 1234" gibi görünürsün.`}</p>
    </form>
  )
}

/* ── Page ── */

export default function DailyPuzzlePage() {
  const router = useRouter()
  const [puzzle, setPuzzle] = useState<DailyPuzzleView | null>(null)
  const [board, setBoard] = useState<DailyBoard | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; good?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [guess, setGuess] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const inputRef = useRef<HTMLInputElement | null>(null)

  const finished = puzzle?.status === 'solved' || puzzle?.status === 'failed'

  useEffect(() => {
    if (!cloudData) return
    call<DailyPuzzleView>('/api/daily-puzzle').then(setPuzzle, (err: unknown) =>
      setLoadError(err instanceof Error ? err.message : 'Bulmaca yüklenemedi')
    )
  }, [])

  useEffect(() => {
    if (!finished) return
    call<DailyBoard>('/api/daily-puzzle/board').then(setBoard, () => setBoard(null))
  }, [finished])

  // Countdown to the next puzzle; reload when it opens.
  useEffect(() => {
    if (!finished) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [finished])
  const opensIn = puzzle ? Date.parse(puzzle.nextAt) - now : 0

  const act = async (body: Record<string, string>) => {
    setBusy(true)
    setMessage(null)
    try {
      const before = puzzle
      const next = await call<DailyPuzzleView>('/api/daily-puzzle', { method: 'POST', body: JSON.stringify(body) })
      setPuzzle(next)
      if (body.action === 'guess') {
        setGuess('')
        if (next.status === 'solved') setMessage({ text: `Bildin! +${next.score} puan`, good: true })
        else if (next.status === 'failed') setMessage({ text: 'Tahmin hakkın bitti.' })
        else if (before && next.guesses.length > before.guesses.length) setMessage({ text: `Olmadı: −${WRONG_GUESS_COST} puan` })
        inputRef.current?.focus()
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Bir şeyler ters gitti' })
    } finally {
      setBusy(false)
    }
  }

  const submitGuess = (e: FormEvent) => {
    e.preventDefault()
    if (!puzzle) return
    const word = normalizeGuess(guess)
    if (word.length !== puzzle.length) return setMessage({ text: `Kelime ${puzzle.length} harfli olmalı.` })
    act({ action: 'guess', guess: word })
  }

  const header = (
    <header className={`${t.header} anim-fade-up`}>
      <button id="back-btn" className={t.back} onClick={() => router.push('/app/games')} aria-label="Geri">←</button>
      <div>
        <h1 className={t.hTitle}>Günün Bulmacası</h1>
        <p className={t.hSub}>
          {puzzle ? `#${puzzle.number} · ${DATE.format(new Date(`${puzzle.day}T12:00:00+03:00`))}` : 'Oyun · Kelime'}
        </p>
      </div>
    </header>
  )

  if (!cloudData) {
    return (
      <main className={`${t.page} ${styles.page}`}>
        {header}
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            Günün Bulmacası herkese aynı kelimeyi sorar ve puanı sunucuda hesaplar; bu yüzden hesapla giriş gerekir.
            Demo modunda kullanılamıyor.
          </p>
        </section>
      </main>
    )
  }

  if (!puzzle) {
    return (
      <main className={`${t.page} ${styles.page}`}>
        {header}
        {loadError ? (
          <div className={`${t.feedback} ${t.feedbackBad}`}>{loadError}</div>
        ) : (
          <div className={t.loading}>
            <span className="spinner spinner-ink" />
            Bulmaca yükleniyor...
          </div>
        )}
      </main>
    )
  }

  const wrongLeft = MAX_WRONG_GUESSES - puzzle.guesses.length

  return (
    <main className={`${t.page} ${styles.page}`}>
      {header}

      {puzzle.status === 'new' && (
        <section className={`${t.intro} ${styles.intro} anim-fade-up d1`}>
          <Letters pattern={puzzle.pattern} solved={false} />
          <p className={t.introText}>
            Bugünün kelimesi {puzzle.length} harfli. Başlayınca Türkçe anlamını, türünü, ilk ve son harfini göreceksin;
            İngilizcesini bul. Herkes aynı kelimeyi çözüyor.
          </p>
          <ul className={styles.rules}>
            <li><span aria-hidden>🎯</span> {START_POINTS} puanla başlarsın</li>
            <li><span aria-hidden>💡</span> {MAX_HINTS} ipucu var: {HINT_LABELS.join(', ').toLocaleLowerCase('tr')}; her biri −{HINT_COST}</li>
            <li><span aria-hidden>✕</span> Yanlış tahmin −{WRONG_GUESS_COST}; {MAX_WRONG_GUESSES}. yanlışta bulmaca biter</li>
            <li><span aria-hidden>⏱</span> Puan eşitse daha hızlı çözen öne geçer; süre başlayınca işler</li>
            <li><span aria-hidden>🔥</span> Her gün çözersen serin büyür{puzzle.streak > 0 ? ` (şu an ${puzzle.streak} gün)` : ''}</li>
          </ul>
          {message && <div className={`${t.feedback} ${t.feedbackBad}`}>{message.text}</div>}
          <button id="daily-start" className={t.primaryBtn} onClick={() => act({ action: 'start' })} disabled={busy}>
            {busy ? 'Başlıyor...' : '▶ Başla'}
          </button>
        </section>
      )}

      {puzzle.status !== 'new' && (
        <section className={`${styles.card} anim-fade-up d1`} aria-live="polite">
          <div className={styles.cardHead}>
            <span className={styles.pos}>{puzzle.partOfSpeech ? PART_OF_SPEECH_TR[puzzle.partOfSpeech] : ''}</span>
            <span className={styles.stats}>
              <span>{finished ? 'Puan' : 'Şu an'}: <strong>{puzzle.score}</strong></span>
              <span>🔥 {puzzle.streak}</span>
            </span>
          </div>

          <p className={styles.meaning}>{puzzle.meaningTr}</p>
          <Letters pattern={puzzle.pattern} solved={puzzle.status === 'solved'} />

          {(puzzle.sentence || puzzle.definition) && (
            <div className={styles.hints}>
              {puzzle.sentence && (
                <div className={styles.hint}>
                  <span className={t.label}>{HINT_LABELS[0]}</span>
                  <Sentence text={puzzle.sentence} answer={puzzle.answer} />
                </div>
              )}
              {puzzle.definition && (
                <div className={styles.hint}>
                  <span className={t.label}>{HINT_LABELS[1]}</span>
                  <p className={styles.definition}>{puzzle.definition}</p>
                </div>
              )}
            </div>
          )}

          {puzzle.guesses.length > 0 && (
            <p className={styles.tried}>
              Denediklerin: {puzzle.guesses.map((g) => <s key={g}>{g}</s>)}
            </p>
          )}

          {puzzle.status === 'playing' && (
            <>
              <form className={styles.guessRow} onSubmit={submitGuess}>
                <input
                  ref={inputRef}
                  id="daily-guess"
                  className={styles.input}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  maxLength={puzzle.length + 4}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={`${puzzle.length} harfli kelime`}
                  aria-label="Tahminin"
                  autoFocus
                />
                <button id="daily-guess-btn" className={styles.guessBtn} disabled={busy || !guess.trim()}>Tahmin et</button>
              </form>
              {message && (
                <div className={`${t.feedback} ${message.good ? t.feedbackOk : t.feedbackBad}`}>{message.text}</div>
              )}
              <div className={styles.actions}>
                <button
                  id="daily-hint"
                  className={t.secondaryBtn}
                  onClick={() => act({ action: 'hint' })}
                  disabled={busy || puzzle.hintsUsed >= MAX_HINTS}
                >
                  {puzzle.hintsUsed >= MAX_HINTS
                    ? 'İpucu kalmadı'
                    : `💡 ${HINT_LABELS[puzzle.hintsUsed]} (−${HINT_COST})`}
                </button>
                <p className={styles.muted}>
                  İpucu {puzzle.hintsUsed}/{MAX_HINTS} · {wrongLeft} yanlış hakkın kaldı
                </p>
              </div>
            </>
          )}

          {finished && (
            <div className={`${styles.result} ${puzzle.status === 'solved' ? styles.resultGood : styles.resultBad}`}>
              <p className={styles.resultTitle}>
                {puzzle.status === 'solved' ? '✓ Bildin!' : '✕ Bugün olmadı.'} Kelime: <strong>{puzzle.answer}</strong>
              </p>
              {puzzle.seconds !== undefined && (
                <p className={styles.muted}>
                  {formatSeconds(puzzle.seconds)} · {puzzle.hintsUsed} ipucu · {puzzle.guesses.length} yanlış
                </p>
              )}
              {puzzle.note && <p className={styles.note}>{puzzle.note}</p>}
            </div>
          )}
        </section>
      )}

      {finished && (
        <section className={`${t.summary} ${styles.summary} anim-fade-up d2`}>
          <span className={t.scoreSub}>Bugünün sıralaması</span>
          {board ? <Board board={board} /> : <p className={styles.muted}>Sıralama yükleniyor...</p>}
          <NicknameForm
            current={puzzle.nickname}
            onSaved={(nickname) => {
              setPuzzle({ ...puzzle, nickname })
              call<DailyBoard>('/api/daily-puzzle/board').then(setBoard, () => undefined)
            }}
          />
          <p className={styles.next}>
            {opensIn > 0 ? `Yeni bulmaca ${formatWait(opensIn)} sonra.` : 'Yeni bulmaca açıldı.'}{' '}
            {opensIn <= 0 && <button className={styles.linkBtn} onClick={() => window.location.reload()}>Yenile</button>}
          </p>
          <div className={t.btnRow}>
            <Link href="/app/games/word-road" className={`${t.secondaryBtn} ${styles.linkCard}`}>🛣️ Kelime Yolculuğu</Link>
            <Link href="/app/games/error-hunt" className={`${t.secondaryBtn} ${styles.linkCard}`}>🔍 Hata Avı</Link>
          </div>
        </section>
      )}
    </main>
  )
}
