'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { LibraryBook } from '@/lib/reading'
import { resolveEpubUrl } from '@/lib/reading'
import styles from './EpubReader.module.css'

const ReactReader = dynamic(
  () => import('react-reader').then(m => m.ReactReader),
  { ssr: false, loading: () => <div className={styles.loading}>Kitap yükleniyor…</div> },
)

type Props = {
  book: LibraryBook
}

export default function EpubReader({ book }: Props) {
  const router = useRouter()
  // Result is tagged with the epub it belongs to, so switching books shows "loading" without a reset.
  const [loaded, setLoaded] = useState<{ epub: LibraryBook['epub']; url: string | null; error: string | null } | null>(null)
  const current = loaded?.epub === book.epub ? loaded : null
  const url = current?.url ?? null
  const error = current?.error ?? null
  const [location, setLocation] = useState<string | number>(0)

  useEffect(() => {
    let cancelled = false

    resolveEpubUrl(book.epub)
      .then(resolved => {
        if (!cancelled) setLoaded({ epub: book.epub, url: resolved, error: null })
      })
      .catch(err => {
        if (!cancelled) setLoaded({ epub: book.epub, url: null, error: err instanceof Error ? err.message : 'EPUB açılamadı' })
      })

    return () => { cancelled = true }
  }, [book])

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.back}
          onClick={() => router.push('/app/reading/library')}
        >
          ← Kütüphane
        </button>
        <div className={styles.meta}>
          <h1 className={styles.title}>{book.title}</h1>
          {book.author && <p className={styles.author}>{book.author}</p>}
        </div>
      </header>

      <div className={styles.reader}>
        {error && <p className={styles.error}>{error}</p>}
        {!error && !url && <div className={styles.loading}>Kitap yükleniyor…</div>}
        {url && (
          <ReactReader
            url={url}
            title={book.title}
            location={location}
            locationChanged={setLocation}
            epubInitOptions={{ openAs: 'epub' }}
          />
        )}
      </div>
    </div>
  )
}
