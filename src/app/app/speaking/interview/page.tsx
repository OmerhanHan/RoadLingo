'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSpeakingLive } from '@/lib/speaking/useSpeakingLive'
import {
  SPEAKING_TOPICS,
  TOPIC_STAGES,
  TOPIC_TOTAL_ANSWERS,
  getTopic,
  stageForStep,
  type TopicId,
} from '@/lib/speaking/topics'
import { useSpeakingTts } from '@/lib/speaking/useSpeakingTts'
import styles from './speaking.module.css'

type RecStatus = 'idle' | 'listening' | 'unsupported'

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function SpeakingPage() {
  const router = useRouter()
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  // Client-only render (AppLayout), so feature detection can run in the initializer.
  const [status, setStatus] = useState<RecStatus>(() => (getSpeechRecognitionCtor() ? 'idle' : 'unsupported'))
  const [toast, setToast] = useState<string | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  /** null = category picker; 'free' = classic open coach. */
  const [choice, setChoice] = useState<TopicId | 'free' | null>(null)
  const topic = choice && choice !== 'free' ? getTopic(choice) : null
  const coachName = topic?.character.shortName ?? 'Koç'

  const recRef = useRef<SpeechRec | null>(null)
  const finalRef = useRef('')
  const live = useSpeakingLive(topic?.id ?? null)
  const tts = useSpeakingTts()
  const { speakFull, stop: stopTts, enabled: ttsEnabled, setEnabled: setTtsEnabled, isSpeaking, error: ttsError } = tts
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const lastSpokenIdRef = useRef<string | null>(null)

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2800)
  }

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (ev) => {
      let interimText = ''
      let finalChunk = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript
        if (ev.results[i].isFinal) finalChunk += piece
        else interimText += piece
      }
      if (finalChunk) {
        finalRef.current = `${finalRef.current}${finalRef.current ? ' ' : ''}${finalChunk.trim()}`.trim()
        setTranscript(finalRef.current)
      }
      setInterim(interimText)
    }

    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') showToast('⚠ Mikrofon izni gerekli')
      else if (ev.error !== 'aborted' && ev.error !== 'no-speech') showToast('⚠ Dikte hatası')
      setStatus('idle')
    }

    rec.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s))
      setInterim('')
    }

    recRef.current = rec
    return () => {
      try { rec.abort() } catch { /* ignore */ }
      recRef.current = null
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [live.turns, live.status])

  // Auto-speak finished coach turns with local TTS
  useEffect(() => {
    const last = [...live.turns]
      .reverse()
      .find((t) => t.role === 'assistant' && !t.streaming && t.content.trim())

    if (!last || last.id === lastSpokenIdRef.current) return
    lastSpokenIdRef.current = last.id
    speakFull(last.content, { voice: topic?.character.voice })
  }, [live.turns, speakFull, topic])

  const startListening = useCallback(() => {
    const rec = recRef.current
    if (!rec) {
      showToast('⚠ Bu tarayıcıda dikte desteklenmiyor')
      return
    }
    stopTts()
    try {
      rec.start()
      setStatus('listening')
    } catch {
      showToast('⚠ Dikte başlatılamadı')
    }
  }, [stopTts])

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setStatus('idle')
    setInterim('')
  }, [])

  const toggleMic = () => {
    if (!sessionStarted) {
      showToast('⚠ Önce live oturumu başlat')
      return
    }
    if (status === 'unsupported') {
      showToast('⚠ Chrome / Edge ile dene — sistem diktesi')
      return
    }
    if (status === 'listening') stopListening()
    else startListening()
  }

  const clearAnswer = () => {
    finalRef.current = ''
    setTranscript('')
    setInterim('')
  }

  const sendToCoach = async () => {
    const text = [finalRef.current, interim].filter(Boolean).join(' ').trim()
    if (!text) {
      showToast('⚠ Önce konuş veya bir şey yaz')
      return
    }
    if (live.isBusy) {
      showToast(`⚠ ${coachName} hâlâ yanıtlıyor…`)
      return
    }
    stopListening()
    clearAnswer()
    stopTts()
    await live.send(text)
  }

  const beginLive = async () => {
    stopListening()
    clearAnswer()
    stopTts()
    lastSpokenIdRef.current = null
    setSessionStarted(true)
    await live.startSession()
  }

  const endLive = () => {
    stopListening()
    clearAnswer()
    stopTts()
    live.reset()
    lastSpokenIdRef.current = null
    setSessionStarted(false)
  }

  const changeTopic = () => {
    endLive()
    setChoice(null)
  }

  const displayAnswer = [transcript, interim].filter(Boolean).join(' ')
  const coachActive = live.turns.some((t) => t.streaming) || isSpeaking
  const finished = !!topic && sessionStarted && live.answered >= TOPIC_TOTAL_ANSWERS && !live.isBusy
  const currentStage = stageForStep(live.answered)

  if (choice === null) {
    return (
      <main className={styles.page}>
        <header className={`${styles.header} anim-fade-up`}>
          <button id="speaking-back" className={styles.back} onClick={() => router.back()} aria-label="Geri">←</button>
          <div className={styles.headerText}>
            <h1 className={styles.hTitle}>Mülakat</h1>
            <p className={styles.hSub}>TOEFL · Take an Interview</p>
          </div>
        </header>

        <p className={`${styles.pickIntro} anim-fade-up d1`}>
          Bir kategori seç. Resimdeki karakter seninle o konuda İngilizce sohbet edecek: önce tanışma, sonra
          resmi anlatma, kendi deneyimin ve görüşün. Sonunda kısa bir geri bildirim verecek.
        </p>

        <div className={`${styles.topicGrid} anim-fade-up d2`}>
          {SPEAKING_TOPICS.map((tp) => (
            <button key={tp.id} id={`topic-${tp.id}`} className={styles.topicCard} onClick={() => setChoice(tp.id)}>
              <span className={styles.topicThumb}>
                <Image
                  src={tp.image}
                  alt={tp.imageAlt}
                  fill
                  sizes="(max-width: 680px) 50vw, 340px"
                  className={`${styles.topicImg} ${tp.pixelArt ? styles.pixelated : ''}`}
                  style={{ objectPosition: tp.focus }}
                />
              </span>
              <span className={styles.topicBody}>
                <span className={styles.topicLabel}>{tp.emoji} {tp.label}</span>
                <span className={styles.topicChar}>{tp.character.name} · {tp.character.roleTr}</span>
              </span>
            </button>
          ))}
        </div>

        <button id="topic-free" className={`${styles.nextBtn} ${styles.freeBtn}`} onClick={() => setChoice('free')}>
          Serbest sohbet (genel koç) →
        </button>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={`${styles.header} anim-fade-up`}>
        <button id="speaking-back" className={styles.back} onClick={() => router.back()} aria-label="Geri">←</button>
        <div className={styles.headerText}>
          <h1 className={styles.hTitle}>{topic ? `${topic.emoji} ${topic.label}` : 'Mülakat'}</h1>
          <p className={styles.hSub}>
            {topic ? `${topic.character.name} · ${topic.labelEn}` : 'TOEFL · Take an Interview'}
            {live.providerMeta ? ` · ${live.providerMeta.provider}/${live.providerMeta.model}` : ''}
            {ttsEnabled ? ' · TTS' : ' · TTS off'}
          </p>
        </div>
      </header>

      <div className={`${styles.stage} anim-fade-up d1`}>
        <div className={styles.characterStage}>
          <Image
            src={topic?.image ?? '/characters/speaking-coach.jpeg'}
            alt={topic?.imageAlt ?? 'Speaking coach'}
            width={topic ? 1600 : 2752}
            height={topic ? 900 : 1536}
            sizes="(max-width: 680px) 100vw, 680px"
            loading="eager"
            className={`${styles.characterImage} ${!topic || topic.pixelArt ? styles.pixelated : ''} ${coachActive ? styles.characterTalking : ''}`}
            style={topic ? { objectPosition: topic.focus } : undefined}
          />
          {topic && (
            <span className={styles.nameTag}>
              <strong>{topic.character.name}</strong> · {topic.character.roleTr}
            </span>
          )}
          {coachActive && <span className={styles.liveBadge}>{isSpeaking ? 'TTS' : 'Live'}</span>}
        </div>

        {topic && (
          <ol className={styles.stepper} aria-label="Konuşma aşamaları">
            {TOPIC_STAGES.map((st) => {
              const idx = TOPIC_STAGES.indexOf(st)
              const cur = TOPIC_STAGES.indexOf(currentStage)
              const state = !sessionStarted
                ? ''
                : finished || idx < cur
                  ? styles.stepDone
                  : idx === cur
                    ? styles.stepCurrent
                    : ''
              return (
                <li key={st.id} className={`${styles.step} ${state}`}>
                  <span className={styles.stepDot}>{idx + 1}</span>
                  <span className={styles.stepLabel}>{st.label}</span>
                </li>
              )
            })}
          </ol>
        )}

        <section className={styles.chatBox} aria-live="polite">
          <div className={styles.chatTop}>
            <span className={styles.answerLabel}>Canlı sohbet</span>
            <div className={styles.chatActions}>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setTtsEnabled(!ttsEnabled)}
                aria-pressed={ttsEnabled}
              >
                {ttsEnabled ? 'Ses açık' : 'Ses kapalı'}
              </button>
              {sessionStarted && (
                <button type="button" className={styles.clearBtn} onClick={endLive}>
                  Bitir
                </button>
              )}
              {!sessionStarted && (
                <button type="button" className={styles.clearBtn} onClick={changeTopic}>
                  Kategori
                </button>
              )}
            </div>
          </div>

          {!sessionStarted && (
            <p className={`${styles.answerText} ${styles.answerPlaceholder}`}>
              {topic
                ? `Live oturumu başlat — ${topic.character.shortName} kendini tanıtıp ilk soruyu soracak. ${TOPIC_TOTAL_ANSWERS} cevaplık bir sohbet olacak.`
                : 'Live oturumu başlat — koç seninle serbest bir İngilizce sohbet yapacak.'}
            </p>
          )}

          {sessionStarted && live.turns.length === 0 && live.isBusy && (
            <p className={`${styles.answerText} ${styles.answerPlaceholder}`}>
              {coachName} bağlanıyor…
            </p>
          )}

          <div className={styles.chatList}>
            {live.turns.map((turn) => (
              <div
                key={turn.id}
                className={`${styles.bubble} ${turn.role === 'user' ? styles.bubbleUser : styles.bubbleCoach}`}
              >
                <div className={styles.bubbleHead}>
                  <span className={styles.bubbleRole}>
                    {turn.role === 'user' ? 'Sen' : coachName}
                    {turn.streaming ? ' · …' : ''}
                  </span>
                  {turn.role === 'assistant' && !turn.streaming && turn.content && (
                    <button
                      type="button"
                      className={styles.replayBtn}
                      onClick={() => speakFull(turn.content, { voice: topic?.character.voice })}
                      aria-label="Yanıtı seslendir"
                    >
                      ▶
                    </button>
                  )}
                </div>
                <p className={styles.bubbleText}>
                  {turn.content || (turn.streaming ? '…' : '')}
                </p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {live.error && <p className={styles.errorNote}>{live.error}</p>}
          {ttsError && <p className={styles.errorNote}>TTS: {ttsError}</p>}
        </section>

        <section className={styles.answerBox}>
          <div className={styles.answerTop}>
            <span className={styles.answerLabel}>Senin cevabın</span>
            {displayAnswer && (
              <button type="button" className={styles.clearBtn} onClick={clearAnswer}>Temizle</button>
            )}
          </div>
          <p className={`${styles.answerText} ${!displayAnswer ? styles.answerPlaceholder : ''}`}>
            {displayAnswer || (sessionStarted ? 'Mikrofona basıp İngilizce konuş…' : 'Önce live oturumu başlat')}
          </p>
        </section>
      </div>

      <div className={`${styles.controls} anim-fade-up d2`}>
        {finished ? (
          <>
            <p className={styles.doneNote}>✓ Sohbet tamamlandı · {TOPIC_TOTAL_ANSWERS} cevap</p>
            <button type="button" className={styles.micBtn} onClick={beginLive}>
              <span className={styles.micIcon}>↺</span>
              <span>Tekrar Konuş</span>
            </button>
            <button type="button" className={styles.nextBtn} onClick={changeTopic}>
              Başka kategori seç →
            </button>
          </>
        ) : !sessionStarted ? (
          <button
            id="speaking-live-start"
            type="button"
            className={styles.micBtn}
            onClick={beginLive}
            disabled={live.isBusy}
          >
            <span className={styles.micIcon}>▶</span>
            <span>Live Başlat</span>
          </button>
        ) : (
          <>
            <button
              id="speaking-mic"
              type="button"
              className={`${styles.micBtn} ${status === 'listening' ? styles.micActive : ''}`}
              onClick={toggleMic}
              aria-pressed={status === 'listening'}
              disabled={live.isBusy}
            >
              <span className={styles.micIcon}>{status === 'listening' ? '■' : '🎙️'}</span>
              <span>{status === 'listening' ? 'Durdur' : 'Dikte Başlat'}</span>
            </button>

            <button
              id="speaking-send"
              type="button"
              className={styles.nextBtn}
              onClick={sendToCoach}
              disabled={live.isBusy || !displayAnswer.trim()}
            >
              {live.isBusy ? `${coachName} yanıtlıyor…` : 'Cevabı Gönder →'}
            </button>

            {(live.isBusy || isSpeaking) && (
              <button
                type="button"
                className={styles.stopStreamBtn}
                onClick={() => {
                  live.stop()
                  stopTts()
                }}
              >
                Yanıtı / sesi kes
              </button>
            )}
          </>
        )}
      </div>

      {status === 'unsupported' && (
        <p className={styles.supportNote}>
          Tarayıcı diktesi bu cihazda yok. Chrome veya Edge ile dene.
        </p>
      )}

      {status === 'listening' && (
        <p className={styles.listeningNote} aria-live="polite">Dinleniyor… sistem diktesi aktif</p>
      )}

      {isSpeaking && (
        <p className={styles.listeningNote} aria-live="polite">{coachName} konuşuyor…</p>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}
