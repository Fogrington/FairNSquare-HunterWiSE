import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import * as api from '../services/api'
import styles from './PrintResults.module.css'

// Full-page, print-ready results for the MC: every category ranked, with judge
// comments underneath. Opened from the dashboard after judging closes
// (?auto=1 opens the browser print dialog as soon as the data has loaded).

type Row = {
  id: number
  title: string
  presenter: string
  institution: string
  average: number | null
  judgeCount: number
}

type CategoryBlock = { id: number; name: string; rows: Row[] }

function placeLabels(rows: Row[]): string[] {
  // Equal scores (to 2 d.p.) share a place, shown as "=2".
  const rounded = rows.map(r => (r.average === null ? null : r.average.toFixed(2)))
  return rows.map((r, i) => {
    if (r.average === null) return '–'
    const first = rounded.indexOf(rounded[i])
    const tied = rounded.filter(v => v === rounded[i]).length > 1
    return `${tied ? '=' : ''}${first + 1}`
  })
}

export default function PrintResults() {
  const { categories } = useAdmin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const autoPrint = params.get('auto') === '1'

  const [blocks, setBlocks] = useState<CategoryBlock[]>([])
  const [comments, setComments] = useState<api.APIComment[]>([])
  const [status, setStatus] = useState<api.EventStatus | null>(null)
  const [maxTotal, setMaxTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const printed = useRef(false)

  useEffect(() => {
    if (categories.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const [perCategory, allComments, eventStatus, criteria] = await Promise.all([
          Promise.all(categories.map(async cat => ({
            id: cat.id,
            name: cat.name,
            rows: (await api.getCategoryResults(cat.id)).map(r => ({
              id: r.id,
              title: r.title,
              presenter: r.presenter,
              institution: r.institution,
              average: r.average_score !== null ? Number(r.average_score) : null,
              judgeCount: Number(r.judge_count),
            })),
          }))),
          api.getAllComments(),
          api.getEventStatus(),
          api.getCriteria(),
        ])
        if (cancelled) return
        setBlocks(perCategory)
        setComments(allComments)
        setStatus(eventStatus)
        setMaxTotal(api.maxTotalOf(criteria))
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load results.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [categories])

  // Open the print dialog once, after everything has rendered
  useEffect(() => {
    if (autoPrint && !loading && !error && blocks.length > 0 && !printed.current) {
      printed.current = true
      setTimeout(() => window.print(), 300)
    }
  }, [autoPrint, loading, error, blocks])

  const commentsFor = (projectId: number) => comments.filter(c => c.project_id === projectId)
  const printedAt = new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
  const closedAt = status?.closedAt
    ? new Date(status.closedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← Back to dashboard</button>
        <button className={styles.printBtn} onClick={() => window.print()} disabled={loading || !!error}>
          Print
        </button>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>FairN² Results</h1>
        <p className={styles.meta}>HunterWiSE Presentation Night · Printed {printedAt}</p>
        {status && !status.judgingOpen && closedAt && (
          <p className={styles.meta}>Judging closed {closedAt}. These results are final.</p>
        )}
        {status?.judgingOpen && (
          <p className={styles.warning}>Judging is still open. These results may change.</p>
        )}
      </header>

      {loading && <p className={styles.message}>Loading results…</p>}
      {error && <p className={styles.message}>{error}</p>}

      {!loading && !error && blocks.map(block => {
        const places = placeLabels(block.rows)
        const commented = block.rows.filter(r => commentsFor(r.id).length > 0)
        return (
          <section key={block.id} className={styles.category}>
            <h2 className={styles.categoryName}>{block.name}</h2>

            {block.rows.length === 0 ? (
              <p className={styles.message}>No projects in this category.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.placeCol}>Place</th>
                    <th>Project</th>
                    <th>Presenter / Team</th>
                    <th>Institution</th>
                    <th className={styles.numCol}>Avg score /{maxTotal}</th>
                    <th className={styles.numCol}>Judges</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((r, i) => (
                    <tr key={r.id} className={places[i] === '1' || places[i] === '=1' ? styles.winner : ''}>
                      <td className={styles.placeCol}>{places[i]}</td>
                      <td className={styles.projectCell}>{r.title}</td>
                      <td>{r.presenter}</td>
                      <td>{r.institution}</td>
                      <td className={styles.numCol}>{r.average !== null ? r.average.toFixed(2) : 'Not scored'}</td>
                      <td className={styles.numCol}>{r.judgeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {commented.length > 0 && (
              <div className={styles.comments}>
                <h3 className={styles.commentsTitle}>Judge comments</h3>
                {commented.map(r => (
                  <div key={r.id} className={styles.commentProject}>
                    <p className={styles.commentProjectName}>
                      {places[block.rows.indexOf(r)] !== '–' && `${places[block.rows.indexOf(r)]}. `}{r.title}
                    </p>
                    <ul className={styles.commentList}>
                      {commentsFor(r.id).map(c => (
                        <li key={c.judge_id}>
                          “{c.comment}” <span className={styles.commentJudge}>— {c.judge_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
