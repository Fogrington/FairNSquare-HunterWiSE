import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import * as api from '../services/api'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { judges, categories, projects, assignments, loading: contextLoading } = useAdmin()

  const [judgesScored, setJudgesScored] = useState(0)
  const [completedCards, setCompletedCards] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)

  // ─── Judging open/closed control ──────────────────────────────────────────
  const navigate = useNavigate()
  const [status, setStatus] = useState<api.EventStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [modal, setModal] = useState<'confirmClose' | 'closed' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getEventStatus()
      .then(setStatus)
      .catch(err => setStatusError(err.message || 'Could not load judging status.'))
  }, [])

  const handleClose = async () => {
    setBusy(true)
    setStatusError('')
    try {
      setStatus(await api.closeJudging())
      setModal('closed')
    } catch (err: any) {
      setStatusError(err.message || 'Could not close judging. Please try again.')
      setModal(null)
    } finally {
      setBusy(false)
    }
  }

  const handleReopen = async () => {
    if (!window.confirm('Reopen judging? Judges will be able to submit and change scores again.')) return
    setBusy(true)
    setStatusError('')
    try {
      setStatus(await api.reopenJudging())
    } catch (err: any) {
      setStatusError(err.message || 'Could not reopen judging. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const closedTime = status?.closedAt
    ? new Date(status.closedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''

  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-AU')

  // Compute scoring progress by pulling each project's score breakdown.
  // (There's no single bulk "all scores" endpoint, so we fan out per project —
  // fine at this event's scale of ~30-45 projects.)
  useEffect(() => {
    if (projects.length === 0) return
    let cancelled = false

    const loadStats = async () => {
      setStatsLoading(true)
      try {
        const criteria = await api.getCriteria()
        const criteriaCount = criteria.length

        const allScores = await Promise.all(projects.map(p => api.getProjectScores(p.id)))
        if (cancelled) return

        const scoredJudgeIds = new Set<number>()
        let completed = 0

        allScores.forEach(scores => {
          const byJudge: Record<number, number> = {}
          for (const s of scores) {
            scoredJudgeIds.add(s.judge_id)
            byJudge[s.judge_id] = (byJudge[s.judge_id] || 0) + 1
          }
          Object.values(byJudge).forEach(count => {
            if (count >= criteriaCount) completed++
          })
        })

        setJudgesScored(scoredJudgeIds.size)
        setCompletedCards(completed)
      } catch {
        // Non-critical — dashboard stats just stay at 0 if this fails.
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    loadStats()
    return () => { cancelled = true }
  }, [projects])

  const stats = [
    { label: 'Judges', value: judges.length, sub: `${judgesScored} have scored` },
    { label: 'Categories', value: categories.length, sub: 'active' },
    { label: 'Projects', value: projects.length, sub: 'total entries' },
    { label: 'Score Submissions', value: completedCards, sub: 'completed scorecards' },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerCard}>
        <div>
          <h1 className={styles.welcome}>Welcome,</h1>
          <h2 className={styles.adminName}>Admin</h2>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.time}>{timeStr}</span>
          <span className={styles.date}>{dateStr}</span>
        </div>
      </div>

      {/* Judging control */}
      <div className={`${styles.judgingCard} ${status && !status.judgingOpen ? styles.judgingCardClosed : ''}`}>
        <div className={styles.judgingInfo}>
          {status === null && !statusError && <span className={styles.judgingText}>Checking judging status…</span>}
          {status?.judgingOpen && (
            <>
              <span className={`${styles.badge} ${styles.badgeOpen}`}>● Judging open</span>
              <span className={styles.judgingText}>
                Judges can submit and change scores. {completedCards} of {assignments.length} assigned scorecards complete.
              </span>
            </>
          )}
          {status && !status.judgingOpen && (
            <>
              <span className={`${styles.badge} ${styles.badgeClosed}`}>■ Judging closed{closedTime && ` at ${closedTime}`}</span>
              <span className={styles.judgingText}>Scores are locked. Results are final unless you reopen judging.</span>
            </>
          )}
          {statusError && <span className={styles.judgingError}>{statusError}</span>}
        </div>

        <div className={styles.judgingActions}>
          {status?.judgingOpen && (
            <button className={styles.closeBtn} onClick={() => setModal('confirmClose')} disabled={busy}>
              Close Judging
            </button>
          )}
          {status && !status.judgingOpen && (
            <>
              <button className={styles.printBtn} onClick={() => navigate('/print?auto=1')}>
                Print Results
              </button>
              <button className={styles.reopenBtn} onClick={handleReopen} disabled={busy}>
                Reopen judging
              </button>
            </>
          )}
        </div>
      </div>

      {modal === 'confirmClose' && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Close judging for the night?</h3>
            <p className={styles.modalText}>
              Judges will immediately be unable to submit or change scores and comments.
            </p>
            <p className={styles.modalText}>
              <strong>{completedCards} of {assignments.length}</strong> assigned scorecards are complete.
              {assignments.length > completedCards && ' Unfinished scorecards will not count towards results.'}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setModal(null)} disabled={busy}>Cancel</button>
              <button className={styles.closeBtn} onClick={handleClose} disabled={busy}>
                {busy ? 'Closing…' : 'Yes, close judging'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'closed' && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Judging is closed</h3>
            <p className={styles.modalText}>
              Results are now final. Print them for the MC and presenters?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setModal(null)}>Later</button>
              <button className={styles.printBtn} onClick={() => navigate('/print?auto=1')}>Print Results</button>
            </div>
          </div>
        </div>
      )}

      {(contextLoading || statsLoading) && (
        <p className={styles.sectionTitle} style={{ opacity: 0.6 }}>Loading latest data…</p>
      )}

      {/* Stats grid */}
      <div className={styles.statsGrid}>
        {stats.map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statSub}>{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Category summary */}
      <h3 className={styles.sectionTitle}>Category Overview</h3>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Category</span>
          <span>Projects</span>
          <span>Judges Assigned</span>
        </div>
        {categories.map(cat => {
          const catProjects = projects.filter(p => p.categoryId === cat.id)
          const catProjectIds = new Set(catProjects.map(p => p.id))
          const catJudgeIds = new Set(
            assignments.filter(a => catProjectIds.has(a.projectId)).map(a => a.judgeId)
          )
          return (
            <div key={cat.id} className={styles.tableRow}>
              <span className={styles.catName}>{cat.name}</span>
              <span>{catProjects.length}</span>
              <span>{catJudgeIds.size}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
