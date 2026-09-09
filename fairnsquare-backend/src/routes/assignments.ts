import { Router, Request, Response } from 'express'
import { pool } from '../db/connection'
import { requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/assignments — all assignments (admin)
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT jp.judge_id, jp.project_id, j.name AS judge_name, p.title AS project_title
       FROM judge_project jp
       JOIN judges j ON j.id = jp.judge_id
       JOIN projects p ON p.id = jp.project_id
       ORDER BY j.name, p.title`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/assignments — assign a judge to a project (admin)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { judgeId, projectId } = req.body
  if (!judgeId || !projectId) {
    return res.status(400).json({ error: 'judgeId and projectId are required' })
  }
  try {
    await pool.query(
      `INSERT INTO judge_project (judge_id, project_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [judgeId, projectId]
    )
    res.status(201).json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/assignments — remove a judge from a project (admin)
router.delete('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { judgeId, projectId } = req.body
  try {
    await pool.query(
      'DELETE FROM judge_project WHERE judge_id=$1 AND project_id=$2',
      [judgeId, projectId]
    )
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/assignments/auto — auto-assign for a category (admin)
router.post('/auto', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { categoryId, minJudgesPerProject = 2 } = req.body
  if (!categoryId) return res.status(400).json({ error: 'categoryId is required' })

  try {
    // Get projects and judges for this category
    const [projectsResult, judgesResult] = await Promise.all([
      pool.query('SELECT id FROM projects WHERE category_id=$1', [categoryId]),
      pool.query('SELECT id FROM judges WHERE category_id=$1', [categoryId]),
    ])

    const projects = projectsResult.rows
    const judges = judgesResult.rows

    if (projects.length === 0 || judges.length === 0) {
      return res.status(400).json({ error: 'No projects or judges in this category' })
    }

    // Clear existing assignments for this category
    await pool.query(
      `DELETE FROM judge_project
       WHERE judge_id = ANY($1::int[])
       AND project_id = ANY($2::int[])`,
      [judges.map((j: any) => j.id), projects.map((p: any) => p.id)]
    )

    // Round-robin assignment
    const judgeLoad: Record<number, number> = {}
    judges.forEach((j: any) => { judgeLoad[j.id] = 0 })

    const newAssignments: { judgeId: number; projectId: number }[] = []

    for (const project of projects) {
      const sorted = [...judges].sort((a: any, b: any) => judgeLoad[a.id] - judgeLoad[b.id])
      const picked = sorted.slice(0, minJudgesPerProject)
      for (const judge of picked) {
        newAssignments.push({ judgeId: judge.id, projectId: project.id })
        judgeLoad[judge.id]++
      }
    }

    // Bulk insert
    for (const a of newAssignments) {
      await pool.query(
        'INSERT INTO judge_project (judge_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [a.judgeId, a.projectId]
      )
    }

    res.json({ success: true, assigned: newAssignments.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router