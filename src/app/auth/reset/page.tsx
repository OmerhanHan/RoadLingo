'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { authErrorMessage, supabaseBrowser } from '@/lib/auth/client'
import styles from '../login/login.module.css'

/** New password, reached from the reset email (via /auth/callback, which opens the session). */
export default function ResetPasswordPage() {
  const { user, loading, mode } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    if (password !== repeat) { setError('Şifreler aynı değil.'); return }
    setSaving(true)
    const { error: err } = await supabaseBrowser().auth.updateUser({ password })
    setSaving(false)
    if (err) setError(authErrorMessage(err, 'Şifre değiştirilemedi.'))
    else router.replace('/app/home')
  }

  const ready = mode === 'supabase' && !loading && user

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoSub}>Yeni Şifre</span>
        </div>
        <hr className={styles.rule} />
        {loading ? (
          <div className={styles.center}><span className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--ink)' }} /></div>
        ) : !ready ? (
          <div className={styles.center}>
            <p className={styles.error}>Sıfırlama bağlantısı geçersiz ya da süresi dolmuş.</p>
            <Link href="/auth/login" className={styles.link}>Giriş sayfasına dön</Link>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="reset-password" className={styles.label}>Yeni şifre</label>
              <input id="reset-password" type="password" className={styles.input} placeholder="En az 6 karakter" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className={styles.field}>
              <label htmlFor="reset-repeat" className={styles.label}>Yeni şifre (tekrar)</label>
              <input id="reset-repeat" type="password" className={styles.input} value={repeat} onChange={e => setRepeat(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? <span className="spinner" /> : '→ Şifreyi Kaydet'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
