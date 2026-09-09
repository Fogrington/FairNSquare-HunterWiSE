import { Router, Request, Response } from 'express'
import { pool } from '../db/connection'
import { requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM projects p
       JOIN categories c ON c.id = p.category_id
       ORDER BY c.name, p.title`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/projects (admin)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { categoryId, title, presenter, institution, description } = req.body
  if (!categoryId || !title || !presenter) {
    return res.status(400).json({ error: 'Category, title and presenter are required' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO projects (category_id, title, presenter, institution, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [categoryId, title, presenter, institution || null, description || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/projects/:id (admin)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router