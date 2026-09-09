import { Router, Response } from 'express'
import { pool } from '../db/connection'
import { requireJudge, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/scores — submit a score (judge)
router.post('/', requireJudge, async (req: AuthRequest, res: Response) => {
  const { projectId, criterionId, value } = req.body
  const judgeId = req.judgeId

  if (!projectId || !criterionId || value === undefined) {
    return res.status(400).json({ error: 'projectId, criterionId and value are required' })
  }
  if (value < 1 || value > 10) {
    return res.status(400).json({ error: 'Score must be between 1 and 10' })
  }

  try {
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