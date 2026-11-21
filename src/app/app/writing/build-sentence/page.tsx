'use client'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSpeakingTts } from '@/lib/speaking/useSpeakingTts'
import { isCorrectOrder, makeTiles, type Tile } from '@/lib/toefl/buildSentence'
import { TOEFL_LEVELS, type BuildSentenceSet, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './build.module.css'

type Phase = 'setup' | 'loading' | 'playing' | 'done'

type Round = { tiles: Tile[]; slotCount: number; punct: string }

/** Where a dragged tile came from: the word bank or a slot index. */
type Origin = 'bank' | number

type DragState = {
  tile: Tile
  from: Origin
  pointerId: number
  startX: number
  startY: number
  active: boolean
}

type Ghost = { label: string; x: number; y: number }

const DRAG_THRESHOLD = 6

/** Finds the drop zone under the pointer: "bank" or a slot index. */
function dropTargetAt(x: number, y: number): Origin | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
  if (!el) return null
  const v = el.dataset.drop
  if (v === 'bank') return 'bank'
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}

export default function BuildSentencePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [set, setSet] = useState<BuildSentenceSet | null>(null)
  const [index, setIndex] = useState(0)
  const [round, setRound] = useState<Round | null>(null)
  const [slots, setSlots] = useState<(Tile | null)[]>([])
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [hoverTarget, setHoverTarget] = useState<Origin | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const tts = useSpeakingTts()
  const ttsStop = tts.stop

  useEffect(() => () => abortRef.current?.abort(), [])

  const startRound = useCallback((s: BuildSentenceSet, i: number) => {
    ttsStop()
    const r = makeTiles(s.items[i])
    setIndex(i)
    setRound(r)
    setSlots(Array(r.slotCount).fill(null))
    setChecked(false)
  }, [ttsStop])

  const loadSet = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/build-sentence?level=${level}${seenParam('build-sentence')}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as BuildSentenceSet
      if (!data.items?.length) throw new Error('Boş set')
      markSeen('build-sentence', data.contentId)
      setSet(data)
      setResults([])
      startRound(data, 0)
      setPhase('playing')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Sorular yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [level, startRound])

  const item = set?.items[index]
  const available = round ? round.tiles.filter((tile) => !slots.some((s) => s?.id === tile.id)) : []
  const full = slots.length > 0 && slots.every(Boolean)
  const placedLabels = slots.map((s) => s?.label ?? '')
  const correct = item && checked ? isCorrectOrder(item, placedLabels) : false

  /* ── Moves (shared by click and drag) ── */

  const moveTile = useCallback((tile: Tile, from: Origin, to: Origin) => {
    if (from === to) return
    setSlots((prev) => {
      const next = [...prev]
      if (to === 'bank') {
        if (typeof from === 'number') next[from] = null
        return next
      }
      const occupant = next[to]
      next[to] = tile
      // Slot → slot swaps; bank → occupied slot sends the occupant back to the bank.
      if (typeof from === 'number') next[from] = occupant
      return next
    })
  }, [])

  const onTileClick = (tile: Tile, from: Origin) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (checked) return
    if (from === 'bank') {
      const empty = slots.findIndex((s) => s === null)
      if (empty !== -1) moveTile(tile, 'bank', empty)
    } else {
      moveTile(tile, from, 'bank')
    }
  }

  /* ── Pointer drag (mouse + touch) ── */

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, tile: Tile, from: Origin) => {
    if (checked || e.button !== 0) return
    suppressClickRef.current = false
    dragRef.current = { tile, from, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
      d.active = true
      setDraggingId(d.tile.id)
    }
    setGhost({ label: d.tile.label, x: e.clientX, y: e.clientY })
    setHoverTarget(dropTargetAt(e.clientX, e.clientY))
  }

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    dragRef.current = null
    if (d.active) {
      suppressClickRef.current = true
      if (!cancelled) {
        const target = dropTargetAt(e.clientX, e.clientY)
        if (target !== null) moveTile(d.tile, d.from, target)
      }
    }
    setGhost(null)
    setDraggingId(null)
    setHoverTarget(null)
  }

  const tileHandlers = (tile: Tile, from: Origin) => ({
    onClick: () => onTileClick(tile, from),
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => onPointerDown(e, tile, from),
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => endDrag(e),
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => endDrag(e, true),
  })

  const playContext = () => {
    if (!item) return
    if (tts.isSpeaking) return tts.stop()
    tts.speakFull(item.context, { voice: item.speakers.a.voice })
  }

  const playDialogue = () => {
    if (!item) return
    if (tts.isSpeaking) return tts.stop()
    tts.speakDialogue([
      { text: item.context, voice: item.speakers.a.voice },
      { text: item.answer, voice: item.speakers.b.voice },
    ])
  }

  const genderIcon = (g: 'male' | 'female') => (g === 'female' ? '♀' : '♂')

  const check = () => {
    if (!item || !full) return
    setChecked(true)
    setResults((prev) => [...prev, isCorrectOrder(item, placedLabels)])
  }

  const next = () => {
    if (!set) return
    if (index + 1 >= set.items.length) setPhase('done')
    else startRound(set, index + 1)
  }

  const score = results.filter(Boolean).length

  return (
    <main className={t.page}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.back()} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Cümle Kur</h1>
          <p className={t.hSub}>TOEFL · Build a Sentence</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            Her soruda kısa bir konuşma göreceksin. İkinci kişinin cevabını karışık kelimeleri
            <strong> sürükleyip</strong> doğru kutulara bırakarak kur. Kelimelerden biri
            <strong> fazladan</strong> olabilir — onu kullanma. Sorular AI tarafından her seferinde yeniden üretilir.
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
          <button id="build-start" className={t.primaryBtn} onClick={loadSet}>▶ Başla (10 soru)</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          AI sorular hazırlıyor...
        </div>
      )}

      {phase === 'playing' && set && item && round && (
        <section className="anim-fade-up">
          <div className={t.metaRow}>
            <span className={t.progressText}>Soru {index + 1} / {set.items.length}</span>
            <span className={`${t.badge} ${set.source !== 'fallback' ? t.badgeAi : ''}`}>
              {set.source !== 'fallback' ? `AI · ${set.level}` : 'Hazır set'}
            </span>
          </div>

          <div className={styles.dialogue}>
            <div className={styles.speaker}>
              <span className={styles.avatar} title={item.speakers.a.gender}>
                A<small className={styles.gender}>{genderIcon(item.speakers.a.gender)}</small>
              </span>
              <p className={styles.bubble}>{item.context}</p>
              <button
                className={`${styles.listen} ${tts.isSpeaking ? styles.listenActive : ''}`}
                onClick={playContext}
                aria-label={tts.isSpeaking ? 'Durdur' : 'Dinle'}
              >
                {tts.status === 'loading' ? '…' : tts.isSpeaking ? '■' : '🔊'}
              </button>
            </div>
            <div className={`${styles.speaker} ${styles.speakerB}`}>
              <span className={`${styles.avatar} ${styles.avatarB}`} title={item.speakers.b.gender}>
                B<small className={styles.gender}>{genderIcon(item.speakers.b.gender)}</small>
              </span>
              <div className={styles.slots} aria-label="Cevap cümlesi">
                {slots.map((tile, i) => (
                  <div
                    key={`slot-${i}`}
                    data-drop={i}
                    className={`${styles.slot} ${tile ? styles.slotFilled : ''} ${hoverTarget === i ? styles.slotHover : ''}`}
                  >
                    {tile && (
                      <button
                        className={`${styles.tile} ${styles.tilePlaced} ${draggingId === tile.id ? styles.tileDragging : ''} ${checked ? (correct ? styles.tileOk : styles.tileBad) : ''}`}
                        disabled={checked}
                        {...tileHandlers(tile, i)}
                      >
                        {tile.label}
                      </button>
                    )}
                  </div>
                ))}
                <span className={styles.punct}>{round.punct}</span>
              </div>
            </div>
          </div>

          <span className={t.label}>Kelimeler · sürükle ya da tıkla</span>
          <div data-drop="bank" className={`${styles.bank} ${hoverTarget === 'bank' ? styles.bankHover : ''}`}>
            {available.map((tile) => (
              <button
                key={tile.id}
                className={`${styles.tile} ${draggingId === tile.id ? styles.tileDragging : ''}`}
                disabled={checked}
                {...tileHandlers(tile, 'bank')}
              >
                {tile.label}
              </button>
            ))}
            {available.length === 0 && <span className={styles.bankEmpty}>Tüm kelimeler kullanıldı</span>}
          </div>

          {checked && (
            <div className={`${t.feedback} ${correct ? t.feedbackOk : t.feedbackBad} ${styles.feedback}`}>
              <span className={t.feedbackTitle}>{correct ? '✓ Doğru' : '✕ Yanlış'}</span>
              {!correct && <>Doğru cevap: <strong>{item.answer}</strong></>}
              {correct && item.distractor && <>Fazladan kelime: <strong>{item.distractor}</strong></>}
              <button className={styles.dialogueBtn} onClick={playDialogue}>
                {tts.isSpeaking ? '■ Durdur' : '▶ Diyaloğu dinle'}
              </button>
            </div>
          )}

          <div className={t.btnRow}>
            {!checked ? (
              <>
                <button
                  className={t.secondaryBtn}
                  onClick={() => setSlots(Array(round.slotCount).fill(null))}
                  disabled={!slots.some(Boolean)}
                >
                  ↺ Temizle
                </button>
                <button id="build-check" className={t.primaryBtn} onClick={check} disabled={!full}>✓ Kontrol Et</button>
              </>
            ) : (
              <button id="build-next" className={t.primaryBtn} onClick={next}>
                {index + 1 >= set.items.length ? 'Sonuçları Gör →' : 'Sonraki →'}
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'done' && set && (
        <section className={`${t.summary} anim-fade-up`}>
          <span className={t.scoreSub}>Skorun</span>
          <span className={t.score}>{score} / {set.items.length}</span>
          <p className={t.introText}>
            {score === set.items.length
              ? 'Mükemmel! Tüm cümleleri doğru kurdun.'
              : score >= set.items.length * 0.7
                ? 'Harika iş! Yanlışlarındaki gramer yapılarına bir göz at.'
                : 'Pratik yapmaya devam — soru cümleleri ve yardımcı fiillere dikkat et.'}
          </p>
          <button className={t.primaryBtn} onClick={loadSet}>↺ Yeni Set Üret</button>
          <button className={t.secondaryBtn} onClick={() => setPhase('setup')}>Seviye Değiştir</button>
        </section>
      )}

      {ghost && (
        <div className={styles.ghost} style={{ left: ghost.x, top: ghost.y }} aria-hidden>
          {ghost.label}
        </div>
      )}
    </main>
  )
}
