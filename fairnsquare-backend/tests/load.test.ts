/**
 * Event-scale scenario (FR-014, FR-007, QR-005): 18 judges, 45 posters across 3 categories,
 * 2 judges per poster, every judge submitting every criterion concurrently.
 * Runs against a local database, so timings measure application + database cost,
 * not the production network path (Render/Neon), which is reported separately.
 */
import { app, pool, request, resetDb, adminToken, judgeToken, bearer, CRITERIA_IDS } from './helpers'

const N_JUDGES = 18
const N_PROJECTS = 45
const N_CATEGORIES = 3
const K = 2
export const metrics: Record<string, number> = {}

beforeAll(async () => {
  await resetDb()
  const admin = bearer(adminToken())
  for (let c = 0; c < N_CATEGORIES; c++) {
    const cat = (await request(app).post('/api/categories').set(admin).send({ name: `Cat ${c}` })).body
    for (let j = 0; j < N_JUDGES / N_CATEGORIES; j++) {
      await request(app).post('/api/judges').set(admin)
        .send({ name: `J${c}-${j}`, username: `j${c}-${j}`, accessCode: '1000', categoryId: cat.id })
    }
    for (let p = 0; p < N_PROJECTS / N_CATEGORIES; p++) {
      await request(app).post('/api/projects').set(admin)
        .send({ categoryId: cat.id, title: `P${c}-${p}`, presenter: 'Team' })
    }
    await request(app).post('/api/assignments/auto').set(admin).send({ categoryId: cat.id, minJudgesPerProject: K })
  }
})
afterAll(async () => {
  // Print the measured figures so they can be quoted in the report
  console.info('LOAD_METRICS ' + JSON.stringify(metrics))
  await pool.end()
})

it('TC-LOAD-01 stores 100% of concurrent submissions from 18 judges with no loss', async () => {
  const { rows: assignments } = await pool.query(
    `SELECT jp.judge_id, jp.project_id FROM judge_project jp
     JOIN judges j ON j.id = jp.judge_id WHERE j.username LIKE 'j%-%'`)
  expect(assignments).toHaveLength(N_PROJECTS * K)

  // Each judge works through their posters sequentially; all 18 judges run in parallel
  const byJudge = new Map<number, number[]>()
  for (const a of assignments) byJudge.set(a.judge_id, [...(byJudge.get(a.judge_id) ?? []), a.project_id])

  const latencies: number[] = []
  let ok = 0, sent = 0
  const t0 = Date.now()
  await Promise.all([...byJudge.entries()].map(async ([judgeId, projects]) => {
    const token = judgeToken(judgeId)
    for (const projectId of projects) {
      await Promise.all(CRITERIA_IDS.map(async (criterionId) => {
        const s = Date.now()
        sent++
        const res = await request(app).post('/api/scores').set(bearer(token))
          .send({ projectId, criterionId, value: 1 + ((projectId + criterionId + judgeId) % 5) })
        latencies.push(Date.now() - s)
        if (res.status === 201) ok++
      }))
    }
  }))
  metrics.wallClockMs = Date.now() - t0
  latencies.sort((a, b) => a - b)
  metrics.requests = sent
  metrics.successRate = ok / sent
  metrics.p50Ms = latencies[Math.floor(latencies.length * 0.5)]
  metrics.p95Ms = latencies[Math.floor(latencies.length * 0.95)]
  metrics.maxMs = latencies[latencies.length - 1]

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM scores')
  expect(rows[0].n).toBe(N_PROJECTS * K * CRITERIA_IDS.length)   // 540 rows
  expect(metrics.successRate).toBe(1)
  expect(metrics.p95Ms).toBeLessThan(2000)                         // FR-014 threshold
})

it('TC-LOAD-02 produces ranked results for every category well within 5 minutes', async () => {
  const { rows: cats } = await pool.query(`SELECT id FROM categories WHERE name LIKE 'Cat %'`)
  const t0 = Date.now()
  const all = await Promise.all(cats.map((c: any) =>
    request(app).get(`/api/categories/${c.id}/results`).set(bearer(adminToken()))))
  metrics.resultsAllCategoriesMs = Date.now() - t0
  for (const r of all) {
    expect(r.status).toBe(200)
    expect(r.body).toHaveLength(N_PROJECTS / N_CATEGORIES)
    expect(r.body.every((p: any) => Number(p.judge_count) === K)).toBe(true)
    const avgs = r.body.map((p: any) => Number(p.average_score))
    expect([...avgs].sort((a, b) => b - a)).toEqual(avgs)       // correctly ordered
  }
  expect(metrics.resultsAllCategoriesMs).toBeLessThan(5 * 60 * 1000)
})
