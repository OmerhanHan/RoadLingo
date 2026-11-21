'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseConfigured } from '@/lib/auth/config'
import { supabaseBrowser } from '@/lib/auth/client'
import styles from '../login/login.module.css'

/** Only same-site app paths, so the link cannot send users elsewhere. */
function safeNext(raw: string | null): string {
  return raw && /^\/(app|auth\/reset)(\/|$)/.test(raw) ? raw : '/app/home'
}

/**
 * Landing page after Google sign-in, the email confirmation link and the
 * password reset link. The Supabase client exchanges the ?code= in the URL
 * for a session on load; then the user goes on to `next`.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(() =>
    supabaseConfigured ? null : 'Supabase bağlantısı kurulmadığı için bu bağlantı kullanılamıyor.'
  )

  useEffect(() => {
    if (!supabaseConfigured) return
    const params = new URLSearchParams(window.location.search)
    const next = safeNext(params.get('next'))
    const denied = params.get('error_description') || new URLSearchParams(window.location.hash.slice(1)).get('error_description')

    // getSession waits until the code in the URL has been exchanged.
    supabaseBrowser()
      .auth.getSession()
      .then(({ data, error: err }) => {
        if (data.session) router.replace(next)
        else
          setError(
            denied || err
              ? 'Bağlantı geçersiz ya da süresi dolmuş. Lütfen tekrar dene.'
              : 'Oturum açılamadı. Lütfen tekrar giriş yap.'
          )
      })
  }, [router])

  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${styles.center}`}>
        {error ? (
          <>
            <p className={styles.error}>{error}</p>
            <Link href="/auth/login" className={styles.link}>Giriş sayfasına dön</Link>
          </>
        ) : (
          <>
            <span className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--ink)' }} />
            <p className={styles.foot}>Oturum açılıyor…</p>
          </>
        )}
      </div>
    </div>
  )
}
