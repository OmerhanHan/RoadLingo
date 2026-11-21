import type { CSSProperties } from 'react'
import styles from './ShelfButton.module.css'

const SPINE_TONES = ['#7E9B82', '#B07070', '#C9A64B', '#6F7F96', '#A88A5E', '#D9CBA8', '#A35F4E', '#C5D9C8', '#E4C4C4']

/** Small deterministic PRNG so the spines look the same on every render. */
function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function spines(seed: number, count: number) {
  const r = rand(seed)
  return Array.from({ length: count }, (_, i) => ({
    key: i,
    bands: r() > 0.5,
    lean: r() > 0.94,
    style: {
      width: `${12 + Math.round(r() * 12)}px`,
      height: `${60 + Math.round(r() * 38)}%`,
      backgroundColor: SPINE_TONES[Math.floor(r() * SPINE_TONES.length)],
      transitionDelay: `${(i % 12) * 18}ms`,
    } as CSSProperties,
  }))
}

function ShelfRow({ seed }: { seed: number }) {
  return (
    <span className={styles.row} aria-hidden>
      <span className={styles.books}>
        {spines(seed, 48).map((s) => (
          <span
            key={s.key}
            className={`${styles.spine} ${s.bands ? styles.spineBands : ''} ${s.lean ? styles.spineLean : ''}`}
            style={s.style}
          />
        ))}
      </span>
      <span className={styles.plank} />
    </span>
  )
}

type Props = {
  id?: string
  /** Accessible name (the button shows only shelves, no text). */
  label: string
  onClick: () => void
}

/** A button drawn as two bookshelves (used for the Library entry). */
export default function ShelfButton({ id, label, onClick }: Props) {
  return (
    <button id={id} type="button" className={styles.button} onClick={onClick} aria-label={label} title={label}>
      <ShelfRow seed={11} />
      <ShelfRow seed={29} />
    </button>
  )
}
