import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'

export interface AuthRequest extends Request {
  judgeId?: number
  adminId?: number
  role?: 'judge' | 'admin'
}

type TokenPayload = { id: number; role: 'judge' | 'admin' }

function readToken(req: Request): TokenPayload | null {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function requireJudge(req: AuthRequest, res: Response, next: NextFunction) {
  const payload = readToken(req)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })
  if (payload.role !== 'judge') return res.status(403).json({ error: 'Judge access required' })
  req.judgeId = payload.id
  req.role = 'judge'
  next()
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const payload = readToken(req)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })
  if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  req.adminId = payload.id
  req.role = 'admin'
  next()
}
