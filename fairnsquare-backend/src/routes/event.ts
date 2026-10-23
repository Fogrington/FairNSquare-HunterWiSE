import { Router, Request, Response } from 'express'
import { pool } from '../db/connection'
import { requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

function toStatus(row: any) {
  return {
    judgingOpen: row ? row.judging_open : true,
    closedAt: row ? row.closed_at : null,
  }
}

// GET /api/event/status — is judging open? (public: no sensitive data)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT judging_open, closed_at FROM event_settings WHERE id = 1')
    res.json(toStatus(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/event/close — stop all scoring and commenting (admin)
router.post('/close', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `INSERT INTO event_settings (id, judging_open, closed_at) VALUES (1, FALSE, NOW())
       ON CONFLICT (id) DO UPDATE SET judging_open = FALSE, closed_at = NOW()
       RETURNING judging_open, closed_at`
    )
    res.json(toStatus(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/event/open — reopen judging, e.g. if closed by mistake (admin)
router.post('/open', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `INSERT INTO event_settings (id, judging_open, closed_at) VALUES (1, TRUE, NULL)
       ON CONFLICT (id) DO UPDATE SET judging_open = TRUE, closed_at = NULL
       RETURNING judging_open, closed_at`
    )
    res.json(toStatus(result.rows[0]))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
