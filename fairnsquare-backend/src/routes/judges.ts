import { Router, Response } from 'express'
import { pool } from '../db/connection'
import { requireAdmin, requireJudge, AuthRequest } from '../middleware/auth'
import { isJudgingOpen, JUDGING_CLOSED_RESPONSE } from '../db/event'

const router = Router()

// Usernames: lowercase letters/digits, optionally separated by . _ or -
// e.g. sarah.chen, priya.nair2, tester01
const USERNAME_RE = /^[a-z0-9]+([._-][a-z0-9]+)*$/
const ACCESS_CODE_RE = /^\d{4}$/

function validateJudge(body: any): { error: string } | {
  name: string; username: string; accessCode: string; categoryId: number | null
} {
  const name = String(body?.name ?? '').trim()
  const username = String(body?.username ?? '').trim().toLowerCase()
  const accessCode = String(body?.accessCode ?? '').trim()
  const categoryId = body?.categoryId ? Number(body.categoryId) : null

  if (!name || !username || !accessCode) return { error: 'Name, username and access code are required' }
  if (username.length > 50 || !USERNAME_RE.test(username)) {
    return { error: 'Username can only contain lowercase letters, numbers, and . _ - between them (e.g. sarah.chen)' }
  }
  if (!ACCESS_CODE_RE.test(accessCode)) return { error: 'Access code must be exactly 4 digits' }
  return { name, username, accessCode, categoryId }
}

// ─── Judge-facing (own data only — id comes from the token, not the URL) ─────

// GET /api/judges/me/projects — projects assigned to the logged-in judge
router.get('/me/projects', requireJudge, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, jp.comment
       FROM projects p
       JOIN judge_project jp ON jp.project_id = p.id
       JOIN categories c ON c.id = p.category_id
       WHERE jp.judge_id = $1
       ORDER BY p.id  -- project id = poster number, so posters list in number order
      `,
      [req.judgeId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

const MAX_COMMENT_LENGTH = 2000

// PUT /api/judges/me/projects/:projectId/comment — save the judge's written feedback
router.put('/me/projects/:projectId/comment', requireJudge, async (req: AuthRequest, res: Response) => {
  const projectId = Number(req.params.projectId)
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : null

  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'Invalid project' })
  if (comment === null) return res.status(400).json({ error: 'comment must be text' })
  if (comment.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comments can be at most ${MAX_COMMENT_LENGTH} characters` })
  }

  try {
    if (!(await isJudgingOpen())) {
      return res.status(403).json(JUDGING_CLOSED_RESPONSE)
    }
    const result = await pool.query(
      `UPDATE judge_project
       SET comment = $3, comment_updated_at = NOW()
       WHERE judge_id = $1 AND project_id = $2
       RETURNING project_id, comment, comment_updated_at`,
      [req.judgeId, projectId, comment || null]
    )
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this project' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/judges/me/scores — scores the logged-in judge has submitted
router.get('/me/scores', requireJudge, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, cr.label AS criterion_label, cr.weight
       FROM scores s
       JOIN criteria cr ON cr.id = s.criterion_id
       WHERE s.judge_id = $1`,
      [req.judgeId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/judges — list all judges
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT j.*, c.name AS category_name
       FROM judges j
       LEFT JOIN categories c ON c.id = j.category_id
       ORDER BY j.name`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/judges — create judge
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const v = validateJudge(req.body)
  if ('error' in v) return res.status(400).json(v)
  try {
    const result = await pool.query(
      `INSERT INTO judges (name, username, access_code, category_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [v.name, v.username, v.accessCode, v.categoryId]
    )
    res.status(201).json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: `Username "${v.username}" is already taken` })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/judges/:id — update judge
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const v = validateJudge(req.body)
  if ('error' in v) return res.status(400).json(v)
  try {
    const result = await pool.query(
      `UPDATE judges SET name=$1, username=$2, access_code=$3, category_id=$4
       WHERE id=$5 RETURNING *`,
      [v.name, v.username, v.accessCode, v.categoryId, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Judge not found' })
    res.json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: `Username "${v.username}" is already taken` })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/judges/:id — remove judge
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM judges WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
