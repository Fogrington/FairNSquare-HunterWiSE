import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import styles from './Login.module.css'

export default function Login() {
  const { adminLogin } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const ok = await adminLogin(email.trim(), password)
      if (!ok) setError('Invalid credentials.')
    } catch {
      setError('Could not reach the server. Is the backend running?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>FairN²</h1>
          <p className={styles.sub}>Admin Portal</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>Email Address</label>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@hunterwise.org"
            autoComplete="email"
          />

          <label className={styles.label}>Password</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={submitting}>
            {submitting ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <div className={styles.devHint}>
          <span className={styles.devLabel}>Dev credentials</span>
          <span>admin@hunterwise.org / admin123</span>
        </div>
      </div>

      <div className={styles.footerBrand}>
        <span style={{ fontWeight: 700 }}>HUNTER</span>
        <span style={{ fontStyle: 'italic', color: '#0277BD' }}>wise</span>
      </div>
    </div>
  )
}
