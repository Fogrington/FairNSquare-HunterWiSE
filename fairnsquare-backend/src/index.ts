import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes        from './routes/auth'
import judgesRoutes      from './routes/judges'
import categoriesRoutes  from './routes/categories'
import projectsRoutes    from './routes/projects'
import assignmentsRoutes from './routes/assignments'
import scoresRoutes      from './routes/scores'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',  // admin panel (Vite)
    'http://localhost:8081',  // Expo web
    'exp://*',                // Expo Go
  ],
  credentials: true,
}))
app.use(express.json())

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes)
app.use('/api/judges',      judgesRoutes)
app.use('/api/categories',  categoriesRoutes)
app.use('/api/projects',    projectsRoutes)
app.use('/api/assignments', assignmentsRoutes)
app.use('/api/scores',      scoresRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FairN² API running on http://localhost:${PORT}`)
})

export default app