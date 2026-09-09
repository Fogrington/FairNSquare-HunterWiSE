import { Router, Response } from 'express'
import { pool } from '../db/connection'
import { requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/judges — list all judges (admin)
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

// POST /api/judges — create judge (admin)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, email, accessCode, categoryId } = req.body
  if (!name || !email || !accessCode) {
    return res.status(400).json({ error: 'Name, email and access code are required' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO judges (name, email, access_code, category_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, accessCode, categoryId || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/judges/:id — update judge (admin)
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, email, accessCode, categoryId } = req.body
  try {
    const result = await pool.query(
      `UPDATE judges SET name=$1, email=$2, access_code=$3, category_id=$4
       WHERE id=$5 RETURNING *`,
      [name, email, accessCode, categoryId || null, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Judge not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/judges/:id — remove judge (admin)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM judges WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/judges/:id/projects — get assigned projects for a judge (judge)
router.get('/:id/projects', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM projects p
       JOIN judge_project jp ON jp.project_id = p.id
       JOIN categories c ON c.id = p.category_id
       WHERE jp.judge_id = $1
       ORDER BY p.title`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/judges/:id/scores — get all scores submitted by a judge
router.get('/:id/scores', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, cr.label AS criterion_label, cr.weight
       FROM scores s
       JOIN criteria cr ON cr.id = s.criterion_id
       WHERE s.judge_id = $1`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router