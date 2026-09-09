import { Router, Request, Response } from 'express'
import { pool } from '../db/connection'
import { requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/categories
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/categories (admin)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })
  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/categories/:id (admin)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/categories/:id/projects
router.get('/:id/projects', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE category_id=$1 ORDER BY title',
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/categories/:id/results — ranked results for a category
router.get('/:id/results', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id, p.title, p.presenter, p.institution,
         COUNT(DISTINCT s.judge_id) AS judge_count,
         AVG(
           subq.weighted_score
         ) AS average_score
       FROM projects p
       LEFT JOIN (
         SELECT
           s.project_id,
           s.judge_id,
           SUM(s.value * cr.weight) AS weighted_score
         FROM scores s
         JOIN criteria cr ON cr.id = s.criterion_id
         GROUP BY s.project_id, s.judge_id
         HAVING COUNT(s.criterion_id) = (SELECT COUNT(*) FROM criteria)
       ) subq ON subq.project_id = p.id
       LEFT JOIN scores s ON s.project_id = p.id
       WHERE p.category_id = $1
       GROUP BY p.id, p.title, p.presenter, p.institution
       ORDER BY average_score DESC NULLS LAST`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router