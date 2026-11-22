import Image from 'next/image'
import { TOEFL_SECTIONS } from '@/lib/exam/structure'
import styles from './AuthShowcase.module.css'

const POINTS = [
  'Gerçek TOEFL formatında okuma, yazma, dinleme ve konuşma görevleri',
  'Yapay zekâ ile yazı puanlama ve sesli mülakat',
  'Ücretsiz başla, istediğin zaman Pro’ya geç',
]

/** Brand panel next to the login / register card (wide screens only). */
export default function AuthShowcase() {
  return (
    <aside className={styles.panel}>
      <Image src="/mascot-idle.png" alt="" width={128} height={128} className={styles.mascot} unoptimized />
      <h2 className={styles.title}>Sınava RoadDash ile hazırlan</h2>
      <p className={styles.lead}>Her gün birkaç görev, anında geri bildirim ve seviyene göre içerik.</p>

      <div className={styles.sections}>
        {TOEFL_SECTIONS.map((s) => (
          <span key={s.id} className={`${styles.chip} ${styles[`chip_${s.id}`]}`}>
            <span aria-hidden>{s.emoji}</span> {s.labelTr}
          </span>
        ))}
      </div>

      <ul className={styles.points}>
        {POINTS.map((p) => (
          <li key={p}>
            <span className={styles.check}>✓</span>
            {p}
          </li>
        ))}
      </ul>
    </aside>
  )
}
