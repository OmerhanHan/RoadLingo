'use client'
import { planHeaders } from '@/lib/plans'
import { reportQuota } from '@/lib/upgrade'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CRITERION_LABEL,
  DISCUSSION_MIN_WORDS,
  DISCUSSION_MINUTES,
} from '@/lib/toefl/academicDiscussion'
import {
  TOEFL_LEVELS,
  type AcademicDiscussionPrompt,
  type DiscussionCriterion,
  type DiscussionPost,
  type DiscussionScore,
  type ToeflLevel,
} from '@/lib/toefl/types'
import t from '@/components/toefl/toefl.module.css'
import styles from './discussion.module.css'

type Phase = 'setup' | 'loading' | 'writing' | 'scoring' | 'result'

const TOTAL_SEC = DISCUSSION_MINUTES * 60

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

function initials(name: string) {
  return name.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, '').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function Post({ post, role, variant }: { post: DiscussionPost; role: string; variant: 'prof' | 'a' | 'b' }) {
  return (
    <div className={`${styles.post} ${styles[`post_${variant}`]}`}>
      <span className={styles.postAvatar}>{initials(post.name)}</span>
      <div className={styles.postBody}>
        <p className={styles.postMeta}><strong>{post.name}</strong> · {role}</p>
        <p className={styles.postText}>{post.text}</p>
      </div>
    </div>
  )
}

export default function AcademicDiscussionPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [prompt, setPrompt] = useState<AcademicDiscussionPrompt | null>(null)
  const [text, setText] = useState('')
  const [remaining, setRemaining] = useState(TOTAL_SEC)
  const [result, setResult] = useState<DiscussionScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (phase !== 'writing') return
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [phase])

  const timeUp = phase === 'writing' && remaining === 0
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  const loadPrompt = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/academic-discussion?level=${level}${seenParam('academic-discussion')}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as AcademicDiscussionPrompt
      markSeen('academic-discussion', data.contentId)
      setPrompt(data)
      setText('')
      setResult(null)
      setRemaining(TOTAL_SEC)
      setPhase('writing')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Tartışma konusu yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [level])

  const submit = useCallback(async () => {
    if (!prompt || !words) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('scoring')
    setError(null)
    try {
      const res = await fetch('/api/toefl/academic-discussion/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...planHeaders() },
        body: JSON.stringify({
          prompt: { course: prompt.course, professor: prompt.professor, students: prompt.students },
          response: text,
        }),
        signal: ctrl.signal,
      })
      const data = await res.json()
      if (res.status === 429) {
        reportQuota({ kind: 'scoring', message: data.error || 'Günlük değerlendirme hakkın doldu.' })
        setError(data.error || 'Günlük değerlendirme hakkın doldu.')
        setPhase('writing')
        return
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data as DiscussionScore)
      setPhase('result')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Puanlama yapılamadı. Yazın kaybolmadı — tekrar deneyebilirsin.')
      setPhase('writing')
    }
  }, [prompt, text, words])

  return (
    <main className={`${t.page} ${t.pageWide}`}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => router.back()} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>Akademik Tartışma</h1>
          <p className={t.hSub}>TOEFL · Write for an Academic Discussion</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            Bir profesör ders forumuna soru soruyor, iki öğrenci farklı görüşlerle cevap vermiş. Sen de
            <strong> {DISCUSSION_MINUTES} dakikada</strong>, en az <strong>{DISCUSSION_MIN_WORDS} kelimelik</strong> bir
            gönderi yazarak görüşünü savunacaksın. Cevabını AI, TOEFL ölçütlerine göre 0–5 arası puanlar.
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
          <button id="discussion-start" className={t.primaryBtn} onClick={loadPrompt}>▶ Konu Üret</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          AI tartışmayı hazırlıyor...
        </div>
      )}

      {prompt && (phase === 'writing' || phase === 'scoring' || phase === 'result') && (
        <section className="anim-fade-up">
          <div className={t.metaRow}>
            <span className={`${t.badge} ${prompt.source !== 'fallback' ? t.badgeAi : ''}`}>
              {prompt.source !== 'fallback' ? `AI · ${prompt.level}` : 'Hazır konu'} · {prompt.course}
            </span>
            {phase === 'writing' && (
              <span className={`${t.timer} ${remaining <= 60 ? styles.timerLow : ''}`}>⏱ {formatTime(remaining)}</span>
            )}
          </div>

          <div className={t.split}>
            <div className={t.splitText}>
              <div className={styles.board}>
                <Post post={prompt.professor} role="Professor" variant="prof" />
                <div className={styles.replies}>
                  <Post post={prompt.students[0]} role="Student" variant="a" />
                  <Post post={prompt.students[1]} role="Student" variant="b" />
                </div>
              </div>
            </div>

            <div className={t.splitSide}>
              <div className={styles.editor}>
                <div className={styles.editorTop}>
                  <span className={t.label} style={{ margin: 0 }}>✎ Senin gönderin</span>
                  <span className={`${styles.wordCount} ${words >= DISCUSSION_MIN_WORDS ? styles.wordOk : ''}`}>
                    {words} / {DISCUSSION_MIN_WORDS}+ kelime
                  </span>
                </div>
                <textarea
                  id="discussion-textarea"
                  className={styles.textarea}
                  placeholder="Write your post here. State your opinion clearly and respond to your classmates' ideas…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  readOnly={phase !== 'writing' || timeUp}
                  spellCheck={false}
                  rows={9}
                />
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${Math.min(100, (words / DISCUSSION_MIN_WORDS) * 100)}%` }} />
                </div>
              </div>

              {timeUp && <div className={`${t.feedback} ${t.feedbackBad} ${styles.gap}`}>⏰ Süre doldu. Gönderini puanlatabilirsin.</div>}
              {error && phase === 'writing' && <div className={`${t.feedback} ${t.feedbackBad} ${styles.gap}`}>{error}</div>}

              {phase === 'writing' && (
                <button id="discussion-submit" className={t.primaryBtn} onClick={submit} disabled={!words}>
                  {words < DISCUSSION_MIN_WORDS && words > 0 ? `Yine de gönder (${words} kelime)` : '✓ Gönder ve Puanla'}
                </button>
              )}

              {phase === 'scoring' && (
                <div className={t.loading}>
                  <span className="spinner spinner-ink" />
                  AI cevabını değerlendiriyor...
                </div>
              )}

              {phase === 'result' && result && (
                <div className={`${styles.result} anim-fade-up`}>
                  <div className={t.summary}>
                    <span className={t.scoreSub}>TOEFL Puanı</span>
                    <span className={t.score}>{result.score} / 5</span>
                    {result.summary && <p className={t.introText}>{result.summary}</p>}
                  </div>

                  <div className={styles.criteria}>
                    {(Object.keys(CRITERION_LABEL) as DiscussionCriterion[]).map((c) => (
                      <div key={c} className={styles.critRow}>
                        <span className={styles.critLabel}>{CRITERION_LABEL[c]}</span>
                        <div className={styles.critTrack}>
                          <div className={styles.critFill} style={{ width: `${(result.criteria[c] / 5) * 100}%` }} />
                        </div>
                        <span className={styles.critValue}>{result.criteria[c]}</span>
                      </div>
                    ))}
                  </div>

                  {result.strengths.length > 0 && (
                    <div className={`${t.feedback} ${t.feedbackOk}`}>
                      <span className={t.feedbackTitle}>✓ Güçlü yönler</span>
                      <ul className={styles.list}>{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {result.improvements.length > 0 && (
                    <div className={`${t.feedback} ${styles.improve}`}>
                      <span className={t.feedbackTitle}>↑ Geliştir</span>
                      <ul className={styles.list}>{result.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {result.corrections.length > 0 && (
                    <div className={styles.corrections}>
                      <span className={t.label}>Düzeltmeler</span>
                      {result.corrections.map((c, i) => (
                        <div key={i} className={styles.correction}>
                          <span className={styles.corrOld}>{c.original}</span>
                          <span aria-hidden>→</span>
                          <span className={styles.corrNew}>{c.suggestion}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={t.btnRow}>
                    <button className={t.secondaryBtn} onClick={() => setPhase('setup')}>Seviye</button>
                    <button className={t.primaryBtn} onClick={loadPrompt}>↺ Yeni Konu</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
