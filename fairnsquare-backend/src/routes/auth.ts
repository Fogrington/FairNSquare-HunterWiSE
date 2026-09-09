import { Router, Request, Response } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import { pool } from '../db/connection'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret'
const JWT_OPTIONS: SignOptions = { expiresIn: '12h' }

// POST /api/auth/judge/login
router.post('/judge/login', async (req: Request, res: Response) => {
  const { email, accessCode } = req.body

  if (!email || !accessCode) {
    return res.status(400).json({ error: 'Email and access code are required' })
  }

  try {
    const result = await pool.query(
      `SELECT j.*, c.name AS category_name
       FROM judges j
       LEFT JOIN categories c ON c.id = j.category_id
       WHERE LOWER(j.email) = LOWER($1) AND j.access_code = $2`,
      [email, accessCode]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or access code' })
    }

    const judge = result.rows[0]
    const token = jwt.sign({ id: judge.id, role: 'judge' }, JWT_SECRET, JWT_OPTIONS)

    res.json({
      token,
      judge: {
        id: judge.id,
        name: judge.name,
        email: judge.email,
        categoryId: judge.category_id,
        categoryName: judge.category_name,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/admin/login
router.post('/admin/login', async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const admin = result.rows[0]
    const valid = password === 'admin123'

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET, JWT_OPTIONS)

    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router