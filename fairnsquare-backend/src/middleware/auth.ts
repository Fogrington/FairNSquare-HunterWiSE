import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  judgeId?: number
  adminId?: number
  role?: 'judge' | 'admin'
}

export function requireJudge(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '') as any
    if (payload.role !== 'judge') return res.status(403).json({ error: 'Judge access required' })
    req.judgeId = payload.id
    req.role = 'judge'
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '') as any
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    req.adminId = payload.id
    req.role = 'admin'
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}