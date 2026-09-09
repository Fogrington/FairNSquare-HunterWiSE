import { useState, useEffect } from 'react'
import { useAdmin } from '../context/AdminContext'
import * as api from '../services/api'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { judges, categories, projects, assignments, loading: contextLoading } = useAdmin()

  const [judgesScored, setJudgesScored] = useState(0)
  const [completedCards, setCompletedCards] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)

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
