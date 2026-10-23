import { Router, Response } from 'express'
import { pool } from '../db/connection'
import { requireJudge, requireAdmin, AuthRequest } from '../middleware/auth'
import { isJudgingOpen, JUDGING_CLOSED_RESPONSE } from '../db/event'

const router = Router()

// POST /api/scores — submit or update one criterion score (judge)
router.post('/', requireJudge, async (req: AuthRequest, res: Response) => {
  const { projectId, criterionId, value } = req.body
  const judgeId = req.judgeId

  if (!projectId || !criterionId || value === undefined) {
    return res.status(400).json({ error: 'projectId, criterionId and value are required' })
  }
  try {
    if (!(await isJudgingOpen())) {
      return res.status(403).json(JUDGING_CLOSED_RESPONSE)
    }

    const criterion = await pool.query('SELECT max_score FROM criteria WHERE id=$1', [criterionId])
    if (criterion.rows.length === 0) {
      return res.status(400).json({ error: 'Unknown criterion. Please restart the app to load the latest questions.' })
    }
    const max = criterion.rows[0].max_score
    if (!Number.isInteger(value) || value < 1 || value > max) {
      return res.status(400).json({ error: `Score must be a whole number between 1 and ${max}` })
    }

    // Verify judge is assigned to this project
    const assigned = await pool.query(
      'SELECT 1 FROM judge_project WHERE judge_id=$1 AND project_id=$2',
      [judgeId, projectId]
    )
    if (assigned.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this project' })
    }

    // Upsert — update if already scored this criterion
    const result = await pool.query(
      `INSERT INTO scores (judge_id, project_id, criterion_id, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (judge_id, project_id, criterion_id)
       DO UPDATE SET value=$4, submitted_at=NOW()
       RETURNING *`,
      [judgeId, projectId, criterionId, value]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/scores/comments — every judge comment, for results and printing (admin)
router.get('/comments', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT jp.project_id, jp.judge_id, j.name AS judge_name,
              jp.comment, jp.comment_updated_at
       FROM judge_project jp
       JOIN judges j ON j.id = jp.judge_id
       WHERE jp.comment IS NOT NULL AND jp.comment <> ''
       ORDER BY jp.project_id, j.name`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/scores/project/:id — all scores for a project (admin)
router.get('/project/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, j.name AS judge_name, cr.label AS criterion_label, cr.weight
       FROM scores s
       JOIN judges j ON j.id = s.judge_id
       JOIN criteria cr ON cr.id = s.criterion_id
       WHERE s.project_id=$1
       ORDER BY j.name, cr.id`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/scores/criteria — get all criteria
router.get('/criteria', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM criteria ORDER BY id')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
