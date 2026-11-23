'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { cloudData, getWriting, listSimilarWritings } from '@/lib/data/client'
import { useLoad } from '@/lib/data/useLoad'
import styles from './detail.module.css'

function bandColor(s: number) { return s >= 7 ? '#7A9E7E' : s >= 5.5 ? '#C9A84C' : '#B07070' }
function bandLabel(s: number) { return s >= 8 ? 'Expert' : s >= 7 ? 'Good' : s >= 6 ? 'Competent' : s >= 5 ? 'Modest' : 'Limited' }

function ScoreRow({ lbl, val, color }: { lbl: string; val: number; color: string }) {
  return (
    <div className={styles.scoreRow}>
      <div className={styles.scoreHead}>
        <span className={styles.scoreLbl}>{lbl}</span>
        <span className={styles.scoreVal} style={{ color }}>{val}/10</span>
      </div>
      <div className={styles.scoreTrack}>
        <div className={styles.scoreFill} style={{ width: `${val * 10}%`, background: color }} />
      </div>
    </div>
  )
}

export default function DetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : null
  const { data: writing, error, loading } = useLoad(id, () => (id ? getWriting(id) : Promise.resolve(null)))
  const { data: similar } = useLoad(cloudData && id ? `similar:${id}` : null, () => listSimilarWritings(id!))
  const [tabChoice, setTab] = useState<'feedback' | 'essay' | null>(null)
  const tab = tabChoice ?? (writing?.has_feedback ? 'feedback' : 'essay')

  if (loading) return <div className={styles.loading}><div className={styles.spinnerInk} /></div>
  if (!writing) {
    return (
      <main className={styles.page}>
        <header className={`${styles.header} anim-fade-up`}>
          <button id="back-btn" className={styles.back} onClick={() => router.push('/app/history')}>←</button>
        </header>
        <p className={styles.noFb}>{error ? 'Yazı yüklenemedi. Bağlantını kontrol edip tekrar dene.' : 'Bu yazı bulunamadı.'}</p>
      </main>
    )
  }

  const fb = writing.feedback
  const bc = fb ? bandColor(fb.band_score) : '#8C7D65'
  const circ = 2 * Math.PI * 50
  const dash  = fb ? circ - (fb.band_score / 9) * circ : circ

  return (
    <main className={styles.page}>
      <header className={`${styles.header} anim-fade-up`}>
        <button id="back-btn" className={styles.back} onClick={() => router.back()}>←</button>
        <div className={styles.hInfo}>
          <p className={styles.hMode}>{writing.mode === 'predetermined' ? '📌 Predetermined' : '🎲 Random'}</p>
          <p className={styles.hDate}>{new Date(writing.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </header>

      <div className={`${styles.topicBanner} anim-fade-up d1`}>
        <h1 className={styles.topicText}>{writing.topic}</h1>
        <span className={styles.wordsBadge}>{writing.word_count} words</span>
      </div>

      {fb && (
        <div className={`${styles.tabs} anim-fade-up d2`}>
          <button id="tab-feedback" className={`${styles.tab} ${tab === 'feedback' ? styles.tabActive : ''}`} onClick={() => setTab('feedback')}>🤖 AI Analiz</button>
          <button id="tab-essay"    className={`${styles.tab} ${tab === 'essay'    ? styles.tabActive : ''}`} onClick={() => setTab('essay')}>📝 Yazı</button>
        </div>
      )}

      {/* Phones: tabs switch between essay and analysis. Desktop: both side by side. */}
      <div className={`${styles.detailGrid} ${fb ? styles.detailGridSplit : ''}`}>
        <div className={`${styles.essayCol} ${fb && tab !== 'essay' ? styles.mobileHidden : ''}`}>
          <p className={styles.essayLabel}>📝 Yazı</p>
          <p className={`${styles.essayText} anim-fade-in`}>{writing.content}</p>
        </div>

        {fb && (
          <div className={`${styles.fbWrap} ${tab !== 'feedback' ? styles.mobileHidden : ''} anim-fade-in`}>
            {/* Band gauge */}
            <div className={styles.bandRow}>
              <div className={styles.gauge}>
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle cx="55" cy="55" r="50" fill="none" stroke={bc} strokeWidth="8"
                    strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
                    transform="rotate(-90 55 55)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                <div className={styles.gaugeCenter}>
                  <span className={styles.bandNum} style={{ color: bc }}>{fb.band_score}</span>
                  <span className={styles.bandWord} style={{ color: bc }}>{bandLabel(fb.band_score)}</span>
                </div>
              </div>
              <div className={styles.bandMeta}>
                <h2 className={styles.bandTitle}>Band Score</h2>
                <p className={styles.bandSub}>IELTS Writing Task 2 tahmini</p>
                {fb.source === 'mock' && (
                  <p className={styles.sampleNote}>Örnek değerlendirme: yapay zekâ bağlı değilken üretildi, ortalamaya sayılmaz.</p>
                )}
                {fb.source === 'import' && <p className={styles.sampleNote}>Hesap açılmadan önce bu cihazda yapılan değerlendirme.</p>}
              </div>
            </div>

            {/* Scores */}
            <div className={styles.section}>
              <span className={styles.secLabel}>📊 Detaylı Puanlar</span>
              <div className={styles.scoresBox}>
                <ScoreRow lbl="Grammar"    val={fb.grammar_score}    color="#7A9E7E" />
                <ScoreRow lbl="Coherence"  val={fb.coherence_score}  color="#C9A84C" />
                <ScoreRow lbl="Vocabulary" val={fb.vocabulary_score} color="#8B9BB4" />
              </div>
            </div>

            {/* Errors */}
            {fb.grammar_errors.length > 0 && (
              <div className={styles.section}>
                <span className={styles.secLabel}>⚠ Dikkat Edilmesi Gerekenler</span>
                <div className={styles.errors}>
                  {fb.grammar_errors.map((e, i) => (
                    <div key={i} className={styles.errCard}>
                      <div className={styles.errTop}>
                        <span className={styles.errWord}>&ldquo;{e.word}&rdquo;</span>
                        <span className={styles.errArrow}>→</span>
                        <span className={styles.errFix}>&ldquo;{e.suggestion}&rdquo;</span>
                      </div>
                      <p className={styles.errExp}>{e.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            <div className={styles.section}>
              <span className={styles.secLabel}>💡 Öneriler</span>
              <ul className={styles.suggList}>
                {fb.suggestions.map((s, i) => (
                  <li key={i} className={styles.suggItem}>
                    <span className={styles.suggDot} />{s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Overall */}
            <div className={styles.section}>
              <span className={styles.secLabel}>🎓 Genel Değerlendirme</span>
              <div className={styles.overall}>
                <p className={styles.overallText}>{fb.overall_comment}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!fb && <p className={styles.noFb}>Bu yazı için AI analizi yapılmadı.</p>}

      {similar && similar.length > 0 && (
        <section className={`${styles.similar} anim-fade-up`} aria-labelledby="similar-title">
          <span id="similar-title" className={styles.secLabel}>🧭 Bu konuya yakın yazıların</span>
          <ul className={styles.similarList}>
            {similar.map(s => (
              <li key={s.id}>
                <button id={`similar-${s.id}`} className={styles.similarItem} onClick={() => router.push(`/app/history/${s.id}`)}>
                  <span className={styles.similarTopic}>{s.topic}</span>
                  <span className={styles.similarMeta}>
                    {new Date(s.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    {s.band_score !== null && <> · Band {s.band_score}</>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
