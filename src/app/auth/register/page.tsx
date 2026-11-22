'use client'
import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import AuthShowcase from '@/components/AuthShowcase'
import GoogleButton from '@/components/GoogleButton'
import { MAX_NAME, PASSWORD_HINT, passwordProblem } from '@/lib/auth/config'
import styles from '../login/login.module.css'

export default function RegisterPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  /** Set when the account waits for the email confirmation link. */
  const [sentTo, setSentTo]     = useState<string | null>(null)
  const { register } = useAuth()
  const router       = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!name || !email || !password) { setError('Lütfen tüm alanları doldurun.'); return }
    const weak = passwordProblem(password)
    if (weak) { setError(weak); return }
    setLoading(true)
    try {
      const { needsConfirmation } = await register(email, password, name.trim().slice(0, MAX_NAME))
      if (needsConfirmation) setSentTo(email)
      else router.push('/app/home')
    }
    catch (err) { setError(err instanceof Error && err.message ? err.message : 'Kayıt başarısız.') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.wrap}>
      <AuthShowcase />
      <div className={styles.card}>
        <div className={styles.logo}>
          <Image src="/logo.png" alt="RoadDash" width={1536} height={1024} sizes="160px" loading="eager" className={styles.brandLogo} />
          <span className={styles.logoSub}>Hesap Oluştur</span>
        </div>
        <hr className={styles.rule} />
        {sentTo ? (
          <div className={styles.center}>
            <p className={styles.notice}>
              Doğrulama bağlantısını <strong>{sentTo}</strong> adresine gönderdik. Bağlantıya tıkladığında hesabın açılacak.
            </p>
            <button type="button" className={styles.forgot} onClick={() => setSentTo(null)}>Farklı bir e-posta kullan</button>
          </div>
        ) : (
          <>
            <GoogleButton onError={setError} />
            <form onSubmit={submit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="reg-name" className={styles.label}>Ad Soyad</label>
                <input id="reg-name" type="text" className={styles.input} placeholder="Adınız" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={MAX_NAME} />
              </div>
              <div className={styles.field}>
                <label htmlFor="reg-email" className={styles.label}>E-posta</label>
                <input id="reg-email" type="email" className={styles.input} placeholder="ornek@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className={styles.field}>
                <label htmlFor="reg-password" className={styles.label}>Şifre</label>
                <input id="reg-password" type="password" className={styles.input} placeholder={PASSWORD_HINT} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button id="register-submit" type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? <span className="spinner" /> : '→ Kayıt Ol'}
              </button>
            </form>
          </>
        )}
        <p className={styles.foot}>Zaten hesabın var mı? <Link href="/auth/login" id="go-login" className={styles.link}>Giriş yap</Link></p>
      </div>
    </div>
  )
}
