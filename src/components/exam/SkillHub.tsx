'use client'
import { useRouter } from 'next/navigation'
import { getSection, type SkillId } from '@/lib/exam/structure'
import styles from './SkillHub.module.css'

export type ExtraMode = {
  id: string
  title: string
  tag: string
  desc: string
  emoji: string
  href: string
}

type Props = {
  skill: SkillId
  /** Practice modes outside the official task list (e.g. free essays, library). */
  extras?: ExtraMode[]
}

export default function SkillHub({ skill, extras = [] }: Props) {
  const router = useRouter()
  const section = getSection(skill)
  const ready = section.tasks.filter((t) => t.status === 'ready').length

  return (
    <main className={`${styles.page} ${styles[`skill_${skill}`]}`}>
      <header className={`${styles.header} anim-fade-up`}>
        <span className={styles.headerEmoji} aria-hidden>{section.emoji}</span>
        <div>
          <p className={styles.kicker}>TOEFL · {section.label}</p>
          <h1 className={styles.title}>{section.labelTr}</h1>
          <p className={styles.sub}>{section.tasks.length} görev · {ready} hazır</p>
        </div>
      </header>

      <ol className={`${styles.tasks} anim-fade-up d1`}>
        {section.tasks.map((task, i) => {
          const isReady = task.status === 'ready' && task.href
          return (
            <li key={task.id}>
              <button
                id={`task-${task.id}`}
                className={`${styles.task} ${isReady ? '' : styles.taskSoon}`}
                onClick={() => isReady && router.push(task.href!)}
                disabled={!isReady}
                aria-disabled={!isReady}
              >
                <span className={styles.taskNum}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.taskEmoji} aria-hidden>{task.emoji}</span>
                <span className={styles.taskBody}>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={styles.taskTr}>{task.titleTr}</span>
                  <span className={styles.taskDesc}>{task.desc}</span>
                </span>
                {isReady ? (
                  <span className={styles.taskCta} aria-hidden>→</span>
                ) : (
                  <span className={styles.soonBadge}>Yakında</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {extras.length > 0 && (
        <section className="anim-fade-up d2">
          <p className={styles.sectionLabel}>Serbest Pratik</p>
          <div className={styles.extras}>
            {extras.map((m) => (
              <button key={m.id} id={`extra-${m.id}`} className={styles.extra} onClick={() => router.push(m.href)}>
                <span className={styles.extraEmoji} aria-hidden>{m.emoji}</span>
                <span className={styles.extraTitle}>{m.title}</span>
                <span className={styles.extraTag}>{m.tag}</span>
                <span className={styles.extraDesc}>{m.desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {section.tip && (
        <div className={`${styles.tip} anim-fade-up d2`}>
          <span aria-hidden>💡</span>
          <p className={styles.tipText}>{section.tip}</p>
        </div>
      )}
    </main>
  )
}
