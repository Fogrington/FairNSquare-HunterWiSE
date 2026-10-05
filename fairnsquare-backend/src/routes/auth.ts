import { Router, Request, Response } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/connection'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config'

const router = Router()

const JWT_OPTIONS: SignOptions = { expiresIn: JWT_EXPIRES_IN }

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Usernames are guessable (firstname.lastname) and access codes are 4 digits,
// so without a limit the 10,000 possible codes could be brute-forced quickly.

// Per-username: 10 failed attempts per 15 min. Keyed on the username rather
// than IP because every judge at the venue shares one Wi-Fi IP address.
const judgeAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => 'judge:' + String(req.body?.username ?? '').trim().toLowerCase(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts for this username. Please wait 15 minutes or ask an organiser.' },
})

// Per-IP backstop against spraying codes across many usernames.
// Generous enough for ~40 judges logging in from one venue network.
const judgeIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this network. Please wait a few minutes.' },
})

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
})

// POST /api/auth/judge/login
router.post('/judge/login', judgeIpLimiter, judgeAccountLimiter, async (req: Request, res: Response) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase()
  const accessCode = String(req.body?.accessCode ?? '').trim()

  if (!username || !accessCode) {
    return res.status(400).json({ error: 'Username and access code are required' })
  }

  try {
    const result = await pool.query(
      `SELECT j.*, c.name AS category_name
       FROM judges j
       LEFT JOIN categories c ON c.id = j.category_id
       WHERE j.username = $1 AND j.access_code = $2`,
      [username, accessCode]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or access code' })
    }

    const judge = result.rows[0]
    const token = jwt.sign({ id: judge.id, role: 'judge' }, JWT_SECRET, JWT_OPTIONS)

    res.json({
      token,
      judge: {
        id: judge.id,
        name: judge.name,
        username: judge.username,
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
router.post('/admin/login', adminLimiter, async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    // Same error for unknown email and wrong password, so the response
    // doesn't reveal which admin emails exist.
    const admin = result.rows[0]
    const valid = admin ? await bcrypt.compare(password, admin.password) : false
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
