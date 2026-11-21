'use client'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTION_TYPE_LABEL } from '@/lib/toefl/academicPassage'
import { GENRE_LABEL, splitRow } from '@/lib/toefl/dailyLife'
import { TOEFL_LEVELS, type DailyLifeSet, type DailyText, type ToeflLevel } from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import q from '../academic-passage/passage.module.css'
import styles from './daily.module.css'

type Phase = 'setup' | 'loading' | 'answering' | 'review'

const LETTERS = ['A', 'B', 'C', 'D']

/** Renders **bold** spans (models often use Markdown emphasis) and drops stray asterisks. */
function rich(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? <strong key={i}>{part}</strong> : part.replace(/\*/g, '')
  )
}

function TextLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => {
        const row = splitRow(line)
        return row ? (
          <div key={i} className={styles.row}>
            <span>{rich(row[0])}</span>
            <span className={styles.rowDots} aria-hidden />
            <span className={styles.rowRight}>{rich(row[1])}</span>
          </div>
        ) : (
          <p key={i} className={styles.line}>{rich(line)}</p>
        )
      })}
    </>
  )
}

function DailyTextCard({ text }: { text: DailyText }) {
  switch (text.genre) {
    case 'email':
      return (
        <article className={`${styles.card} ${styles.email}`}>
          <div className={styles.emailHead}>
            <p><span className={styles.key}>From</span>{text.sender ?? '—'}</p>
            <p><span className={styles.key}>Subject</span><strong>{text.title}</strong></p>
          </div>
          <div className={styles.body}><TextLines lines={text.lines} /></div>
        </article>
      )
    case 'messages': {
      const first = text.messages?.[0]?.from
      return (
        <article className={`${styles.card} ${styles.chat}`}>
          <p className={styles.chatTitle}>{text.title}</p>
          <div className={styles.bubbles}>
            {text.messages?.map((m, i) => (
              <div key={i} className={`${styles.bubble} ${m.from === first ? styles.bubbleLeft : styles.bubbleRight}`}>
                <span className={styles.bubbleName}>{m.from}</span>
                {rich(m.text)}
              </div>
            ))}
          </div>
        </article>
      )
    }
    case 'social':
      return (
        <article className={`${styles.card} ${styles.social}`}>
          <div className={styles.socialHead}>
            <span className={styles.socialAvatar}>{(text.sender ?? '@').replace('@', '').slice(0, 1).toUpperCase()}</span>
            <span className={styles.socialName}>{text.sender ?? '@post'}</span>
          </div>
          <p className={styles.socialTitle}>{text.title}</p>
          <div className={styles.body}><TextLines lines={text.lines} /></div>
          <p className={styles.socialFoot}>♡ 128 · 💬 14 · ↗ Paylaş</p>
        </article>
      )
    case 'web':
      return (
        <article className={`${styles.card} ${styles.web}`}>
          <div className={styles.webBar}>
            <span className={styles.webDots} aria-hidden>●●●</span>
            <span className={styles.webUrl}>{(text.sender ?? 'website').toLowerCase().replace(/[^a-z0-9]+/g, '')}.com</span>
          </div>
          <div className={styles.body}>
            <h2 className={styles.webTitle}>{text.title}</h2>
            <TextLines lines={text.lines} />
          </div>
        </article>
      )
    default: // notice, menu, schedule
      return (
        <article className={`${styles.card} ${styles.notice} ${styles[`g_${text.genre}`] ?? ''}`}>
          {text.sender && <p className={styles.noticeSender}>{text.sender}</p>}
          <h2 className={styles.noticeTitle}>{text.title}</h2>
          <div className={styles.body}><TextLines lines={text.lines} /></div>
        </article>
      )
  }
}

export default function DailyLifePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [set, setSet] = useState<DailyLifeSet | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [session, setSession] = useState({ correct: 0, total: 0, texts: 0 })
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const loadSet = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const skip = set?.text.genre ?? ''
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/daily-life?level=${level}&skip=${skip}${seenParam('daily-life')}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as DailyLifeSet
      markSeen('daily-life', data.contentId)
      setSet(data)
      setAnswers(Array(data.questions.length).fill(null))
      setPhase('answering')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Metin yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [level, set])

  const reviewing = phase === 'review'
  const allAnswered = answers.length > 0 && answers.every((a) => a !== null)
  const correct = set ? set.questions.filter((qq, i) => answers[i] === qq.answer).length : 0

  const choose = (qi: number, opt: number) => {
    if (reviewing) return
    setAnswers((prev) => prev.map((a, i) => (i === qi ? opt : a)))
  }

  const check = () => {
    if (!set) return
    setSession((s) => ({ correct: s.correct + correct, total: s.total + set.questions.length, texts: s.texts + 1 }))
    setPhase('review')
  }

  return (
    <main className={`${t.page} ${t.pageWide}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.back()} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Günlük Hayatta Okuma</h1>
          <p className={t.hSub}>TOEFL · Read in Daily Life</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            E-posta, duyuru, menü, otobüs saati, mesajlaşma veya sosyal medya gönderisi gibi <strong>kısa günlük
            metinler</strong> okuyacaksın. Her metnin ardından <strong>3 soru</strong> gelir: metnin amacı, bir detay ve
            bir çıkarım. Metinler AI tarafından her seferinde farklı türde üretilir.
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
          <button id="daily-start" className={t.primaryBtn} onClick={loadSet}>▶ Metin Üret</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          AI günlük bir metin hazırlıyor...
        </div>
      )}

      {(phase === 'answering' || phase === 'review') && set && (
        <section className="anim-fade-up">
          <div className={t.metaRow}>
            <span className={`${t.badge} ${set.source !== 'fallback' ? t.badgeAi : ''}`}>
              {GENRE_LABEL[set.text.genre]} · {set.source !== 'fallback' ? `AI · ${set.level}` : 'Hazır metin'}
            </span>
            {session.texts > 0 && (
              <span className={t.progressText}>Oturum: {session.correct}/{session.total} · {session.texts} metin</span>
            )}
          </div>

          <div className={t.split}>
            <div className={t.splitText}>
              <DailyTextCard text={set.text} />
            </div>

            <div className={t.splitSide}>
              {reviewing && (
                <div className={`${t.summary} ${q.scoreBox}`}>
                  <span className={t.scoreSub}>Bu metin</span>
                  <span className={t.score}>{correct} / {set.questions.length}</span>
                </div>
              )}

              {set.questions.map((qq, qi) => {
                const selected = answers[qi]
                return (
                  <div key={qi} className={q.question}>
                    <span className={q.qType}>{qi + 1} · {QUESTION_TYPE_LABEL[qq.type]}</span>
                    <h3 className={q.qText}>{qq.question}</h3>
                    <div className={q.options} role="radiogroup">
                      {qq.options.map((opt, i) => {
                        const state = reviewing
                          ? i === qq.answer ? q.optionOk : i === selected ? q.optionBad : ''
                          : i === selected ? q.optionSelected : ''
                        return (
                          <button
                            key={i}
                            role="radio"
                            aria-checked={selected === i}
                            className={`${q.option} ${state}`}
                            onClick={() => choose(qi, i)}
                            disabled={reviewing}
                          >
                            <span className={q.optionKey}>{LETTERS[i]}</span>
                            <span>{opt}</span>
                          </button>
                        )
                      })}
                    </div>
                    {reviewing && qq.explanation && (
                      <div className={`${t.feedback} ${selected === qq.answer ? t.feedbackOk : t.feedbackBad} ${q.explain}`}>
                        <span className={t.feedbackTitle}>{selected === qq.answer ? '✓ Doğru' : '✕ Yanlış'}</span>
                        {qq.explanation}
                      </div>
                    )}
                  </div>
                )
              })}

              {reviewing ? (
                <div className={t.btnRow}>
                  <button className={t.secondaryBtn} onClick={() => setPhase('setup')}>Seviye</button>
                  <button className={t.primaryBtn} onClick={loadSet}>Sonraki Metin →</button>
                </div>
              ) : (
                <>
                  <button id="daily-check" className={t.primaryBtn} onClick={check} disabled={!allAnswered}>✓ Kontrol Et</button>
                  {!allAnswered && <p className={q.hint}>Kontrol etmek için tüm soruları cevapla.</p>}
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
