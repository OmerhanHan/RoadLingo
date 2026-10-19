'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EMAIL_CATEGORY_LABELS,
  EMAIL_SCORE_LABELS,
  EMAIL_SCENARIOS,
  analyzeEmail,
  formatEmailDraft,
  pickRandomEmailScenario,
  type EmailAnalysis,
  type EmailScenario,
  type EmailScoreKey,
} from '@/lib/emailAnalysis'
import {
  getEmailExercises,
  saveEmailExercise,
  type EmailExercise,
} from '@/lib/emailStorage'
import styles from './email.module.css'

const DURATION_SEC = 7 * 60
const SCORE_KEYS: EmailScoreKey[] = [
  'task_fulfillment',
  'organization_flow',
  'language_grammar',
  'tone_register',
]

type Tab = 'compose' | 'history'

function formatTime(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function applyScenarioFields(
  s: EmailScenario,
  setTo: (v: string) => void,
  setSubject: (v: string) => void,
) {
  setTo(s.to)
  setSubject(s.subject)
}

function AnalysisBlock({ analysis }: { analysis: EmailAnalysis }) {
  return (
    <div className={styles.feedbackMail}>
      <div className={styles.feedbackHead}>
        <span className={styles.feedbackFrom}>RoadLingo Coach &lt;coach@roadlingo.app&gt;</span>
        <span className={styles.feedbackSubject}>Re: Değerlendirme raporu</span>
      </div>

      <div className={styles.overall}>
        <span className={styles.overallLabel}>Genel puan</span>
        <span className={styles.overallScore}>{analysis.overall_score.toFixed(1)}/6</span>
      </div>

      <div className={styles.scoreGrid}>
        {SCORE_KEYS.map(key => (
          <div key={key} className={styles.scoreCard}>
            <div className={styles.scoreTop}>
              <span className={styles.scoreName}>{EMAIL_SCORE_LABELS[key]}</span>
              <span className={styles.scoreVal}>{analysis.scores[key].toFixed(1)}/6</span>
            </div>
            <p className={styles.scoreComment}>{analysis.comments[key]}</p>
          </div>
        ))}
      </div>

      {analysis.strengths.length > 0 && (
        <div className={styles.listBlock}>
          <p className={styles.listTitle}>Güçlü yanlar</p>
          <ul>{analysis.strengths.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}

      {analysis.improvements.length > 0 && (
        <div className={styles.listBlock}>
          <p className={styles.listTitle}>Geliştirme önerileri</p>
          <ul>{analysis.improvements.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}

      <p className={styles.overallComment}>{analysis.overall_comment}</p>
    </div>
  )
}

export default function EmailWritingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('compose')
  const [history, setHistory] = useState<EmailExercise[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [scenario, setScenario] = useState<EmailScenario>(EMAIL_SCENARIOS[0])
  const [to, setTo] = useState(EMAIL_SCENARIOS[0].to)
  const [subject, setSubject] = useState(EMAIL_SCENARIOS[0].subject)
  const [body, setBody] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SEC)
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [copied, setCopied] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishOnceRef = useRef(false)
  const draftRef = useRef({ to: '', subject: '', body: '' })
  const scenarioRef = useRef(scenario)

  draftRef.current = { to, subject, body }
  scenarioRef.current = scenario

  const refreshHistory = useCallback(() => {
    setHistory(getEmailExercises())
  }, [])

  useEffect(() => {
    const next = pickRandomEmailScenario()
    setScenario(next)
    applyScenarioFields(next, setTo, setSubject)
    refreshHistory()
  }, [refreshHistory])

  const canEdit = running && !finished
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length
  const progress = ((DURATION_SEC - secondsLeft) / DURATION_SEC) * 100
  const urgent = running && secondsLeft <= 60
  const selected = selectedId ? history.find(h => h.id === selectedId) ?? null : null

  const finalizeSession = useCallback(async () => {
    if (finishOnceRef.current) return
    finishOnceRef.current = true

    const draft = draftRef.current
    const sc = scenarioRef.current
    const words = draft.body.trim().split(/\s+/).filter(Boolean).length
    setCopied(false)
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalysis(null)

    let result: EmailAnalysis | null = null
    try {
      result = await analyzeEmail({
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        scenario: `${sc.subject}\n${sc.prompt}`,
      })
      setAnalysis(result)
    } catch {
      setAnalyzeError('Analiz tamamlanamadı. Tekrar deneyebilirsin.')
    } finally {
      setAnalyzing(false)
    }

    const saved = saveEmailExercise({
      scenario_id: sc.id,
      category: sc.category,
      title_tr: sc.title_tr,
      to: draft.to,
      subject: draft.subject,
      body: draft.body,
      word_count: words,
      analysis: result,
    })
    setHistory(getEmailExercises())
    setSelectedId(saved.id)
  }, [])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setRunning(false)
          setFinished(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [running])

  useEffect(() => {
    if (finished) void finalizeSession()
  }, [finished, finalizeSession])

  const start = () => {
    if (finished) return
    setStarted(true)
    setRunning(true)
  }

  const stop = () => setRunning(false)

  const reset = () => {
    const next = pickRandomEmailScenario(scenario.id)
    setRunning(false)
    setStarted(false)
    setFinished(false)
    setSecondsLeft(DURATION_SEC)
    setBody('')
    setCopied(false)
    setAnalyzing(false)
    setAnalysis(null)
    setAnalyzeError(null)
    finishOnceRef.current = false
    setScenario(next)
    applyScenarioFields(next, setTo, setSubject)
    setTab('compose')
  }

  const shuffleTopic = () => {
    if (started || finished) return
    const next = pickRandomEmailScenario(scenario.id)
    setScenario(next)
    applyScenarioFields(next, setTo, setSubject)
    setBody('')
    setCopied(false)
  }

  const copyFullEmail = async (mailTo: string, mailSubject: string, mailBody: string) => {
    const text = formatEmailDraft(mailTo, mailSubject, mailBody)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const openHistory = () => {
    refreshHistory()
    setTab('history')
    if (!selectedId && getEmailExercises()[0]) {
      setSelectedId(getEmailExercises()[0].id)
    }
  }

  return (
    <main className={styles.page}>
      {/* Mail app shell */}
      <div className={`${styles.mailApp} anim-fade-up`}>
        <div className={styles.mailTop}>
          <button type="button" className={styles.back} onClick={() => router.back()} aria-label="Geri">
            ←
          </button>
          <div className={styles.mailBrand}>
            <span className={styles.mailLogo}>✉</span>
            <div>
              <h1 className={styles.hTitle}>RoadLingo Mail</h1>
              <p className={styles.hSub}>7 dk · Hızlı e-posta</p>
            </div>
          </div>
        </div>

        <nav className={styles.tabs} aria-label="Mail sekmeleri">
          <button
            type="button"
            className={`${styles.tab} ${tab === 'compose' ? styles.tabActive : ''}`}
            onClick={() => setTab('compose')}
          >
            Compose
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
            onClick={openHistory}
          >
            Geçmiş
            {history.length > 0 && <span className={styles.tabBadge}>{history.length}</span>}
          </button>
        </nav>

        {/* ── Compose tab ── */}
        {tab === 'compose' && (
          <div className={styles.mailBody}>
            <div className={styles.prompt}>
              <div className={styles.promptHead}>
                <span className={styles.promptTag}>{EMAIL_CATEGORY_LABELS[scenario.category]}</span>
                <button
                  type="button"
                  className={styles.shuffleBtn}
                  onClick={shuffleTopic}
                  disabled={started || finished}
                >
                  Başka konu
                </button>
              </div>
              <p className={styles.promptTitle}>{scenario.title_tr}</p>
              <p className={styles.promptSubject}>{scenario.subject}</p>
              <p className={styles.promptText}>{scenario.prompt_tr}</p>
              <p className={styles.promptEn}>{scenario.prompt}</p>
            </div>

            <div className={`${styles.timerBar} ${urgent ? styles.timerUrgent : ''} ${finished ? styles.timerDone : ''}`}>
              <div className={styles.timerLeft}>
                <span className={styles.timerLabel}>Süre</span>
                <span className={styles.timerValue} aria-live="polite">{formatTime(secondsLeft)}</span>
              </div>
              <div className={styles.timerActions}>
                {!finished && !running && (
                  <button type="button" className={styles.btnStart} onClick={start}>
                    {!started ? 'Başlat' : 'Devam'}
                  </button>
                )}
                {running && (
                  <button type="button" className={styles.btnStop} onClick={stop}>
                    Durdur
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btnReset}
                  onClick={reset}
                  disabled={!started && !finished}
                >
                  Sıfırla
                </button>
              </div>
              <div className={styles.timerTrack} aria-hidden>
                <div className={styles.timerFill} style={{ width: `${progress}%` }} />
              </div>
            </div>

            {!started && !finished && (
              <p className={styles.lockHint}>Yazmaya başlamak için süreyi Başlat.</p>
            )}
            {started && !running && !finished && (
              <p className={styles.lockHint}>Süre duraklatıldı — yazmak için Devam’a bas.</p>
            )}
            {finished && (
              <p className={styles.timeUp}>
                Süre doldu — metin kilitlendi. Tüm maili kopyalamak için butonu kullan.
              </p>
            )}

            <div className={`${styles.compose} ${!canEdit ? styles.composeLocked : ''}`}>
              <div className={styles.composeChrome}>
                <span className={styles.dot} data-c="r" />
                <span className={styles.dot} data-c="y" />
                <span className={styles.dot} data-c="g" />
                <span className={styles.composeTitle}>
                  {finished ? 'Sent · Locked' : canEdit ? 'New Message' : 'Draft · Locked'}
                </span>
              </div>

              <div className={styles.fieldRow}>
                <label htmlFor="email-to" className={styles.fieldKey}>To</label>
                <input id="email-to" type="text" className={styles.fieldInput} value={to} readOnly disabled />
              </div>
              <div className={styles.fieldRow}>
                <label htmlFor="email-from" className={styles.fieldKey}>From</label>
                <input
                  id="email-from"
                  type="text"
                  className={styles.fieldInput}
                  value="you@writeai.student"
                  readOnly
                  disabled
                />
              </div>
              <div className={styles.fieldRow}>
                <label htmlFor="email-subject" className={styles.fieldKey}>Subject</label>
                <input id="email-subject" type="text" className={styles.fieldInput} value={subject} readOnly disabled />
              </div>

              <div className={styles.bodyWrap}>
                <textarea
                  id="email-body"
                  className={styles.bodyArea}
                  placeholder={'Dear …,\n\n…\n\nSincerely,\n[Your Name]'}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={12}
                  disabled={!canEdit}
                  readOnly={!canEdit}
                />
                <div className={styles.bodyFooter}>
                  <span className={styles.wordCount}>{wordCount} words</span>
                  <span className={styles.hint}>
                    {canEdit ? 'Süre işlerken yazabilirsin' : finished ? 'Düzenleme kapalı' : 'Başlatılmayı bekliyor'}
                  </span>
                </div>
              </div>
            </div>

            {finished && (
              <>
                <div className={styles.copyBar}>
                  <button
                    type="button"
                    className={styles.copyFullBtn}
                    onClick={() => copyFullEmail(to, subject, body)}
                  >
                    {copied ? 'Tüm mail kopyalandı ✓' : 'Tüm maili kopyala'}
                  </button>
                </div>

                <div className={styles.thread}>
                  <p className={styles.threadLabel}>Thread</p>
                  <div className={styles.threadMail}>
                    <div className={styles.threadMeta}>
                      <span>To: {to}</span>
                      <span>Subject: {subject}</span>
                    </div>
                    <pre className={styles.threadBody}>{body || '(boş)'}</pre>
                  </div>

                  {analyzing && (
                    <p className={styles.analyzing}>
                      <span className="spinner spinner-ink" /> Coach yanıtı hazırlanıyor…
                    </p>
                  )}
                  {analyzeError && <p className={styles.analyzeError}>{analyzeError}</p>}
                  {analysis && <AnalysisBlock analysis={analysis} />}
                </div>

                <button type="button" className={styles.gotoHistory} onClick={openHistory}>
                  Geçmişte gör →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <div className={styles.historyLayout}>
            <aside className={styles.inbox}>
              <div className={styles.inboxHead}>
                <span>Sent</span>
                <span className={styles.inboxCount}>{history.length}</span>
              </div>
              {history.length === 0 && (
                <p className={styles.inboxEmpty}>Henüz gönderilmiş egzersiz yok.</p>
              )}
              <ul className={styles.inboxList}>
                {history.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.inboxItem} ${selectedId === item.id ? styles.inboxItemActive : ''}`}
                      onClick={() => { setSelectedId(item.id); setCopied(false) }}
                    >
                      <div className={styles.inboxRow}>
                        <span className={styles.inboxTo}>{item.to}</span>
                        <span className={styles.inboxDate}>{formatDate(item.created_at)}</span>
                      </div>
                      <span className={styles.inboxSubject}>{item.subject}</span>
                      <div className={styles.inboxMeta}>
                        <span>{EMAIL_CATEGORY_LABELS[item.category].split(' ')[0]}</span>
                        {item.analysis && (
                          <span className={styles.inboxScore}>{item.analysis.overall_score.toFixed(1)}/6</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className={styles.reader}>
              {!selected && (
                <div className={styles.readerEmpty}>
                  <p>Bir mail seç</p>
                  <span>Geçmiş egzersizler ve coach önerileri burada açılır.</span>
                </div>
              )}

              {selected && (
                <div className={styles.readerPane}>
                  <div className={styles.readerChrome}>
                    <span className={styles.composeTitle}>Message</span>
                    <button
                      type="button"
                      className={styles.readerCopy}
                      onClick={() => copyFullEmail(selected.to, selected.subject, selected.body)}
                    >
                      {copied ? 'Kopyalandı ✓' : 'Kopyala'}
                    </button>
                  </div>

                  <div className={styles.fieldRow}>
                    <span className={styles.fieldKey}>To</span>
                    <span className={styles.fieldValue}>{selected.to}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldKey}>From</span>
                    <span className={styles.fieldValue}>you@writeai.student</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldKey}>Subject</span>
                    <span className={styles.fieldValue}>{selected.subject}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldKey}>Date</span>
                    <span className={styles.fieldValue}>{formatDate(selected.created_at)}</span>
                  </div>

                  <div className={styles.readerBody}>
                    <p className={styles.readerScenario}>{selected.title_tr}</p>
                    <pre className={styles.threadBody}>{selected.body || '(boş)'}</pre>
                  </div>

                  <div className={styles.thread}>
                    <p className={styles.threadLabel}>Coach yanıtı</p>
                    {selected.analysis ? (
                      <AnalysisBlock analysis={selected.analysis} />
                    ) : (
                      <p className={styles.analyzeError}>Bu egzersiz için analiz kaydı yok.</p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
