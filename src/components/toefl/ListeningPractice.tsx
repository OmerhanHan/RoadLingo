'use client'
import { planHeaders } from '@/lib/plans'
import { markSeen, seenParam } from '@/lib/content/seen'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LISTENING_TASK_INFO, QUESTION_KIND_LABEL } from '@/lib/toefl/listening'
import { useClipPlayer } from '@/lib/speaking/useClipPlayer'
import {
  TOEFL_LEVELS,
  type ListeningClip,
  type ListeningQuestion,
  type ListeningSet,
  type ListeningTaskId,
  type ToeflLevel,
} from '@/lib/toefl/types'
import t from './toefl.module.css'
import q from '@/app/app/reading/academic-passage/passage.module.css'
import styles from './listening.module.css'

type Phase = 'setup' | 'loading' | 'clip' | 'review'

const LETTERS = ['A', 'B', 'C', 'D']

function Options({
  question, selected, reviewing, onChoose,
}: { question: ListeningQuestion; selected: number | null; reviewing: boolean; onChoose: (i: number) => void }) {
  return (
    <div className={q.options} role="radiogroup">
      {question.options.map((opt, i) => {
        const state = reviewing
          ? i === question.answer ? q.optionOk : i === selected ? q.optionBad : ''
          : i === selected ? q.optionSelected : ''
        return (
          <button
            key={i}
            role="radio"
            aria-checked={selected === i}
            className={`${q.option} ${state}`}
            onClick={() => onChoose(i)}
            disabled={reviewing}
          >
            <span className={q.optionKey}>{LETTERS[i]}</span>
            <span>{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

function speakersOf(clip: ListeningClip) {
  const seen = new Map<string, 'male' | 'female'>()
  for (const l of clip.lines) if (!seen.has(l.speaker)) seen.set(l.speaker, l.gender)
  return [...seen.entries()]
}

export default function ListeningPractice({ task }: { task: ListeningTaskId }) {
  const router = useRouter()
  const info = LISTENING_TASK_INFO[task]
  const player = useClipPlayer()
  const { prepare, play, stop, reset } = player

  const [phase, setPhase] = useState<Phase>('setup')
  const [level, setLevel] = useState<ToeflLevel>('B2')
  const [allowReplay, setAllowReplay] = useState(false)
  const [set, setSet] = useState<ListeningSet | null>(null)
  const [clipIndex, setClipIndex] = useState(0)
  const [heard, setHeard] = useState<boolean[]>([])
  const [playingClip, setPlayingClip] = useState<number | null>(null)
  const [answers, setAnswers] = useState<(number | null)[][]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    reset()
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch(`/api/toefl/listening?task=${task}&level=${level}${seenParam(`listening-${task}`)}`, { signal: ctrl.signal, headers: planHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ListeningSet
      markSeen(`listening-${task}`, data.contentId)
      setSet(data)
      setClipIndex(0)
      setHeard(data.clips.map(() => false))
      setAnswers(data.clips.map((c) => c.questions.map(() => null)))
      prepare(data.clips.map((c) => c.lines.map((l) => ({ text: l.text, voice: l.voice, speaker: l.speaker }))))
      setPhase('clip')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('İçerik yüklenemedi. Tekrar dene.')
      setPhase('setup')
    }
  }, [task, level, prepare, reset])

  const listen = async (ci: number) => {
    setPlayingClip(ci)
    const finished = await play(ci)
    setPlayingClip(null)
    if (finished) setHeard((h) => h.map((v, i) => (i === ci ? true : v)))
  }

  const choose = (ci: number, qi: number, opt: number) => {
    setAnswers((prev) => prev.map((row, i) => (i === ci ? row.map((a, j) => (j === qi ? opt : a)) : row)))
  }

  const next = () => {
    if (!set) return
    stop()
    if (clipIndex < set.clips.length - 1) setClipIndex((i) => i + 1)
    else setPhase('review')
  }

  const playing = player.status === 'playing'
  const clip = set?.clips[clipIndex]
  const clipAnswered = !!clip && answers[clipIndex]?.every((a) => a !== null)
  const totalQ = set ? set.clips.reduce((n, c) => n + c.questions.length, 0) : 0
  const score = set
    ? set.clips.reduce((n, c, ci) => n + c.questions.filter((qq, qi) => answers[ci]?.[qi] === qq.answer).length, 0)
    : 0
  const preparing = player.total > 0 && player.ready < player.total

  return (
    <main className={t.page}>
      <header className={`${t.header} anim-fade-up`}>
        <button id="back-btn" className={t.back} onClick={() => { stop(); router.back() }} aria-label="Geri">←</button>
        <div>
          <h1 className={t.hTitle}>{info.titleTr}</h1>
          <p className={t.hSub}>TOEFL · {info.title}</p>
        </div>
      </header>

      {phase === 'setup' && (
        <section className={`${t.intro} anim-fade-up d1`}>
          <p className={t.introText}>
            {info.intro} Metinler AI tarafından üretilir ve konuşmacının cinsiyetine uygun sesle okunur.
            Sınavdaki gibi <strong>kayıt yalnızca bir kez çalar</strong>; sorular baştan görünür, dinlerken cevaplayabilirsin.
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
          <label className={styles.toggle}>
            <input type="checkbox" checked={allowReplay} onChange={(e) => setAllowReplay(e.target.checked)} />
            <span>Pratik modu: kaydı tekrar dinlemeye izin ver</span>
          </label>
          {error && <div className={`${t.feedback} ${t.feedbackBad}`}>{error}</div>}
          <button id="listening-start" className={t.primaryBtn} onClick={load}>▶ Başla</button>
        </section>
      )}

      {phase === 'loading' && (
        <div className={t.loading}>
          <span className="spinner spinner-ink" />
          AI kaydı hazırlıyor...
        </div>
      )}

      {phase === 'clip' && set && clip && (
        <section className="anim-fade-up" key={clipIndex}>
          <div className={t.metaRow}>
            <span className={`${t.badge} ${set.source !== 'fallback' ? t.badgeAi : ''}`}>
              {set.source !== 'fallback' ? `AI · ${set.level}` : 'Hazır içerik'}
            </span>
            {set.clips.length > 1 && <span className={t.progressText}>{clipIndex + 1} / {set.clips.length}</span>}
          </div>

          <div className={`${styles.player} ${playing ? styles.playerOn : ''}`}>
            {set.clips.length === 1 && <p className={styles.playerTitle}>{set.title}</p>}
            {clip.context && <p className={styles.context}>🎧 {clip.context}</p>}
            <div className={styles.speakers}>
              {speakersOf(clip).map(([name, gender]) => {
                const active = playing && clip.lines[player.current]?.speaker === name
                return (
                  <span key={name} className={`${styles.speaker} ${active ? styles.speakerActive : ''}`}>
                    {gender === 'female' ? '♀' : '♂'} {name === 'Speaker' ? (gender === 'female' ? 'Kadın' : 'Erkek') : name}
                  </span>
                )
              })}
            </div>

            <div className={styles.wave} aria-hidden>
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className={styles.bar} style={{ animationDelay: `${(i % 6) * 0.11}s` }} />
              ))}
            </div>

            {playing ? (
              <p className={styles.status}>
                Çalıyor… {clip.lines.length > 1 ? `${player.current + 1}/${clip.lines.length}` : ''}
              </p>
            ) : heard[clipIndex] && !allowReplay ? (
              <p className={styles.status}>Kayıt dinlendi</p>
            ) : (
              <button id="listening-play" className={t.primaryBtn} onClick={() => listen(clipIndex)}>
                {heard[clipIndex] ? '↺ Tekrar Dinle' : '▶ Dinle'}
              </button>
            )}
            {preparing && <p className={styles.prep}>Ses hazırlanıyor {player.ready}/{player.total}</p>}
            {player.fallbackUsed && <p className={styles.prep}>Sunucu sesi alınamadı, tarayıcı sesi kullanılıyor.</p>}
          </div>

          {clip.questions.map((qq, qi) => (
            <div key={qi} className={q.question}>
              <span className={q.qType}>
                {clip.questions.length > 1 ? `${qi + 1} · ` : ''}{QUESTION_KIND_LABEL[qq.kind]}
              </span>
              <h3 className={q.qText}>{qq.question}</h3>
              <Options
                question={qq}
                selected={answers[clipIndex]?.[qi] ?? null}
                reviewing={false}
                onChoose={(i) => choose(clipIndex, qi, i)}
              />
            </div>
          ))}
          <button id="listening-next" className={t.primaryBtn} onClick={next} disabled={!clipAnswered}>
            {clipIndex < set.clips.length - 1 ? 'Sonraki →' : '✓ Bitir'}
          </button>
        </section>
      )}

      {phase === 'review' && set && (
        <section className="anim-fade-up">
          <div className={`${t.summary} ${q.scoreBox}`}>
            <span className={t.scoreSub}>Skorun</span>
            <span className={t.score}>{score} / {totalQ}</span>
          </div>

          {set.clips.map((c, ci) => (
            <div key={ci} className={styles.reviewClip}>
              <div className={styles.transcript}>
                <div className={styles.transcriptHead}>
                  <span className={t.label} style={{ margin: 0 }}>
                    {set.clips.length > 1 ? `${ci + 1}. ${c.context}` : 'Metin (transcript)'}
                  </span>
                  <button
                    className={styles.replay}
                    onClick={() => (playingClip === ci ? stop() : listen(ci))}
                    aria-label="Kaydı dinle"
                  >
                    {playingClip === ci ? '■' : '▶'}
                  </button>
                </div>
                {c.lines.map((l, li) => (
                  <p
                    key={li}
                    className={`${styles.tLine} ${playingClip === ci && player.current === li ? styles.tLineOn : ''}`}
                  >
                    {speakersOf(c).length > 1 && <strong>{l.speaker}: </strong>}
                    {l.text}
                  </p>
                ))}
              </div>

              {c.questions.map((qq, qi) => {
                const sel = answers[ci]?.[qi] ?? null
                return (
                  <div key={qi} className={q.question}>
                    <span className={q.qType}>{QUESTION_KIND_LABEL[qq.kind]}</span>
                    <h3 className={q.qText}>{qq.question}</h3>
                    <Options question={qq} selected={sel} reviewing onChoose={() => {}} />
                    {qq.explanation && (
                      <div className={`${t.feedback} ${sel === qq.answer ? t.feedbackOk : t.feedbackBad} ${q.explain}`}>
                        <span className={t.feedbackTitle}>{sel === qq.answer ? '✓ Doğru' : '✕ Yanlış'}</span>
                        {qq.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <div className={t.btnRow}>
            <button className={t.secondaryBtn} onClick={() => { reset(); setPhase('setup') }}>Ayarlar</button>
            <button className={t.primaryBtn} onClick={load}>↺ Yeni Kayıt</button>
          </div>
        </section>
      )}
    </main>
  )
}
