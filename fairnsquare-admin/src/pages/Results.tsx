import { useState, useEffect } from 'react'
import { useAdmin } from '../context/AdminContext'
import * as api from '../services/api'
import { rowsToCSV, downloadCSV, todayStamp } from '../utils/csv'
import styles from './Results.module.css'

type ResultRow = {
  projectId: number
  title: string
  presenter: string
  institution: string
  average: number | null
  judgeCount: number
}

type JudgeBreakdownRow = {
  judgeId: number
  judgeName: string
  scores: { criterionId: number; label: string; value: number; weight: number }[]
  weighted: number
}

export default function Results() {
  const { categories } = useAdmin()
  const [selectedCat, setSelectedCat] = useState<number>(0)
  const [results, setResults] = useState<ResultRow[]>([])
  const [breakdowns, setBreakdowns] = useState<Record<number, JudgeBreakdownRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState<'category' | 'all' | null>(null)
  const [exportError, setExportError] = useState('')

  const CSV_HEADER = ['Rank', 'Project Title', 'Presenter / Team', 'Institution', 'Score (out of 10)', 'Judges Scored']

  const resultRowToCSV = (r: ResultRow, rank: number): (string | number)[] => [
    rank,
    r.title,
    r.presenter,
    r.institution,
    r.average !== null ? r.average.toFixed(2) : 'Not yet scored',
    r.judgeCount,
  ]

  const mapAPIResults = (rows: api.APICategoryResult[]): ResultRow[] =>
    rows.map(r => ({
      projectId: r.id,
      title: r.title,
      presenter: r.presenter,
      institution: r.institution,
      average: r.average_score !== null ? Number(r.average_score) : null,
      judgeCount: Number(r.judge_count),
    }))

  const currentCategoryName = categories.find(c => c.id === selectedCat)?.name ?? 'Category'

  // Export just the category currently being viewed — uses data already
  // on screen, so this is instant with no extra network round-trip.
  const handleExportCategory = () => {
    const rows = [CSV_HEADER, ...results.map((r, i) => resultRowToCSV(r, i + 1))]
    downloadCSV(
      `FairN2-Results-${currentCategoryName.replace(/[^a-z0-9]+/gi, '-')}-${todayStamp()}.csv`,
      rowsToCSV(rows)
    )
  }

  // Export every category into one file, section by section, in ranked
  // order — built for the MC/host to scroll straight down and read out
  // results category by category through the night.
  const handleExportAll = async () => {
    setExporting('all')
    setExportError('')
    try {
      const perCategory = await Promise.all(
        categories.map(cat => api.getCategoryResults(cat.id).then(rows => ({ cat, rows: mapAPIResults(rows) })))
      )

      const csvRows: (string | number)[][] = []
      perCategory.forEach(({ cat, rows }, idx) => {
        if (idx > 0) csvRows.push([])
        csvRows.push([`CATEGORY: ${cat.name}`])
        csvRows.push(CSV_HEADER)
        if (rows.length === 0) {
          csvRows.push(['No projects in this category.'])
        } else {
          rows.forEach((r, i) => csvRows.push(resultRowToCSV(r, i + 1)))
        }
      })

      downloadCSV(`FairN2-Results-All-Categories-${todayStamp()}.csv`, rowsToCSV(csvRows))
    } catch (err: any) {
      setExportError(err.message || 'Could not export all categories.')
    } finally {
      setExporting(null)
    }
  }

  // Default to the first category once categories have loaded.
  useEffect(() => {
    if (!selectedCat && categories.length > 0) setSelectedCat(categories[0].id)
  }, [categories])

  useEffect(() => {
    if (!selectedCat) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await api.getCategoryResults(selectedCat)
        if (cancelled) return

        const mapped: ResultRow[] = rows.map(r => ({
          projectId: r.id,
          title: r.title,
          presenter: r.presenter,
          institution: r.institution,
          average: r.average_score !== null ? Number(r.average_score) : null,
          judgeCount: Number(r.judge_count),
        }))
        setResults(mapped)

        // Fetch per-judge score breakdowns for every project in this category.
        const details = await Promise.all(
          mapped.map(r => api.getProjectScores(r.projectId).then(scores => [r.projectId, scores] as const))
        )
        if (cancelled) return

        const byProject: Record<number, JudgeBreakdownRow[]> = {}
        for (const [projectId, scores] of details) {
          const byJudge: Record<number, JudgeBreakdownRow> = {}
          for (const s of scores) {
            if (!byJudge[s.judge_id]) {
              byJudge[s.judge_id] = { judgeId: s.judge_id, judgeName: s.judge_name, scores: [], weighted: 0 }
            }
            byJudge[s.judge_id].scores.push({
              criterionId: s.criterion_id,
              label: s.criterion_label,
              value: s.value,
              weight: Number(s.weight),
            })
          }
          Object.values(byJudge).forEach(j => {
            j.weighted = j.scores.reduce((sum, s) => sum + s.value * s.weight, 0)
          })
          byProject[projectId] = Object.values(byJudge)
        }
        setBreakdowns(byProject)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load results.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedCat])

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Results</h2>
        <div className={styles.exportButtons}>
          <button
            className={styles.exportBtn}
            onClick={handleExportCategory}
            disabled={loading || results.length === 0}
          >
            Export {currentCategoryName} (CSV)
          </button>
          <button
            className={styles.exportBtn}
            onClick={handleExportAll}
            disabled={exporting !== null || categories.length === 0}
          >
            {exporting === 'all' ? 'Exporting…' : 'Export All Categories (CSV)'}
          </button>
        </div>
      </div>
      {exportError && <div className={styles.empty}>{exportError}</div>}

      {/* Category tabs */}
      <div className={styles.tabs}>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`${styles.tab} ${selectedCat === cat.id ? styles.tabActive : ''}`}
            onClick={() => setSelectedCat(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading && <div className={styles.empty}>Loading results…</div>}
      {!loading && error && <div className={styles.empty}>{error}</div>}
      {!loading && !error && results.length === 0 && (
        <div className={styles.empty}>No projects or scores in this category yet.</div>
      )}

      {!loading && !error && results.map((project, idx) => {
        const judgeBreakdown = breakdowns[project.projectId] ?? []
        const isFirst = idx === 0 && project.average !== null
        return (
          <div key={project.projectId} className={`${styles.projectCard} ${isFirst ? styles.projectCardTop : ''}`}>
            <div className={styles.projectHeader}>
              <div className={styles.projectLeft}>
                {isFirst && <span className={styles.trophy}>🏆</span>}
                <div>
                  <span className={styles.rank}>#{idx + 1}</span>
                  <span className={styles.projectTitle}>{project.title}</span>
                  <span className={styles.projectMeta}>{project.presenter} · {project.institution}</span>
                </div>
              </div>
              <div className={styles.scoreDisplay}>
                {project.average !== null ? (
                  <>
                    <span className={styles.scoreValue}>{project.average.toFixed(2)}</span>
                    <span className={styles.scoreMax}>/10</span>
                  </>
                ) : (
                  <span className={styles.noScore}>Not yet scored</span>
                )}
                <span className={styles.judgeCount}>{project.judgeCount} judge{project.judgeCount !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Score bar */}
            {project.average !== null && (
              <div className={styles.barContainer}>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(project.average / 10) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Judge breakdown */}
            {judgeBreakdown.length > 0 && (
              <div className={styles.breakdown}>
                {judgeBreakdown.map(j => {
                  const complete = j.scores.length >= 4
                  return (
                    <div key={j.judgeId} className={styles.judgeRow}>
                      <span className={styles.judgeName}>{j.judgeName}</span>
                      <div className={styles.criteriaScores}>
                        {j.scores.map(s => (
                          <span key={s.criterionId} className={styles.criterionChip}>
                            {s.label}: <strong>{s.value}</strong>
                          </span>
                        ))}
                      </div>
                      <span className={styles.judgeTotal}>
                        {complete ? `${j.weighted.toFixed(2)}/10` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
