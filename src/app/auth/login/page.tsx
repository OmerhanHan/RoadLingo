'use client'
import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import AuthShowcase from '@/components/AuthShowcase'
import GoogleButton from '@/components/GoogleButton'
import styles from './login.module.css'

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [notice, setNotice]     = useState('')
  const [loading, setLoading]   = useState(false)
  const { login, resetPassword } = useAuth()
  const router     = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setNotice('')
    if (!email || !password) { setError('Lütfen tüm alanları doldurun.'); return }
    setLoading(true)
    try { await login(email, password); router.push('/app/home') }
    catch (err) { setError(errorText(err, 'Giriş başarısız.')) }
    finally { setLoading(false) }
  }

  const forgot = async () => {
    setError(''); setNotice('')
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Şifre sıfırlama bağlantısı için önce e-postanı yaz.'); return }
    try {
      await resetPassword(email)
      setNotice(`Şifre sıfırlama bağlantısını ${email} adresine gönderdik.`)
    } catch (err) { setError(errorText(err, 'Sıfırlama e-postası gönderilemedi.')) }
  }

  return (
    <div className={styles.wrap}>
      <AuthShowcase />
      <div className={styles.card}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="RoadLingo" width={2304} height={1536} sizes="160px" loading="eager" className={styles.brandLogo} />
          <span className={styles.logoSub}>English Writing Practice</span>
        </div>
        <hr className={styles.rule} />
        <GoogleButton onError={setError} />
        <form onSubmit={submit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="login-email" className={styles.label}>E-posta</label>
            <input id="login-email" type="email" className={styles.input} placeholder="ornek@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="login-password" className={styles.label}>Şifre</label>
              <button type="button" id="forgot-password" className={styles.forgot} onClick={forgot}>Şifremi unuttum</button>
            </div>
            <input id="login-password" type="password" className={styles.input} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          {notice && <p className={styles.notice}>{notice}</p>}
          <button id="login-submit" type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className="spinner" /> : '→ Giriş Yap'}
          </button>
        </form>
        <p className={styles.foot}>Hesabın yok mu? <Link href="/auth/register" id="go-register" className={styles.link}>Kayıt ol</Link></p>
      </div>
    </div>
  )
}
