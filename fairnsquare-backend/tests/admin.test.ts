import { app, pool, request, resetDb, adminToken, bearer } from './helpers'

beforeEach(resetDb)
afterAll(() => pool.end())

const admin = () => bearer(adminToken())

describe('FR-011 Judge management and validation', () => {
  const create = (body: object) => request(app).post('/api/judges').set(admin()).send(body)

  it('TC-ADM-01 creates a judge with a normalised username', async () => {
    const res = await create({ name: 'Ada Lovelace', username: 'Ada.Lovelace', accessCode: '4321', categoryId: 1 })
    expect(res.status).toBe(201)
    expect(res.body.username).toBe('ada.lovelace')
  })

  it.each([
    ['spaces', 'ada lovelace'], ['leading dot', '.ada'], ['double separator', 'ada..l'],
    ['symbol', 'ada@hw'], ['too long', 'a'.repeat(51)],
  ])('TC-ADM-02 rejects a username with %s (400)', async (_l, username) => {
    expect((await create({ name: 'Ada', username, accessCode: '4321' })).status).toBe(400)
  })

  it.each([['3 digits', '123'], ['5 digits', '12345'], ['letters', '12ab']])(
    'TC-ADM-03 rejects an access code with %s (400)', async (_l, accessCode) => {
      expect((await create({ name: 'Ada', username: 'ada', accessCode })).status).toBe(400)
    })

  it('TC-ADM-04 reports a duplicate username as a 409 conflict', async () => {
    const res = await create({ name: 'Another Sarah', username: 'sarah.chen', accessCode: '1111' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already taken/)
  })

  it('TC-ADM-05 updates and deletes judges; deleting cascades their assignments', async () => {
    const upd = await request(app).put('/api/judges/1').set(admin())
      .send({ name: 'Sarah Chen', username: 'sarah.c', accessCode: '2468', categoryId: 1 })
    expect(upd.status).toBe(200)
    expect((await request(app).put('/api/judges/999').set(admin())
      .send({ name: 'X', username: 'x', accessCode: '1111' })).status).toBe(404)
    await request(app).delete('/api/judges/1').set(admin())
    const { rows } = await pool.query('SELECT * FROM judge_project WHERE judge_id=1')
    expect(rows).toHaveLength(0)
  })

  it('TC-ADM-06 collects no email addresses for judges (IMR-005)', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='judges'`)
    expect(rows.map((r: any) => r.column_name)).not.toContain('email')
  })
})

describe('FR-010 / FR-011 Category, project and assignment management', () => {
  it('TC-ADM-07 creates categories and projects and validates required fields', async () => {
    const cat = await request(app).post('/api/categories').set(admin()).send({ name: 'Mathematics' })
    expect(cat.status).toBe(201)
    expect((await request(app).post('/api/categories').set(admin()).send({})).status).toBe(400)
    const proj = await request(app).post('/api/projects').set(admin())
      .send({ categoryId: cat.body.id, title: 'Primes', presenter: 'E. Noether' })
    expect(proj.status).toBe(201)
    expect((await request(app).post('/api/projects').set(admin()).send({ title: 'No category' })).status).toBe(400)
  })

  it('TC-ADM-08 manual assignment is idempotent and removable', async () => {
    const assign = () => request(app).post('/api/assignments').set(admin()).send({ judgeId: 1, projectId: 103 })
    expect((await assign()).status).toBe(201)
    expect((await assign()).status).toBe(201)    // ON CONFLICT DO NOTHING
    let { rows } = await pool.query('SELECT * FROM judge_project WHERE judge_id=1 AND project_id=103')
    expect(rows).toHaveLength(1)
    await request(app).delete('/api/assignments').set(admin()).send({ judgeId: 1, projectId: 103 })
    ;({ rows } = await pool.query('SELECT * FROM judge_project WHERE judge_id=1 AND project_id=103'))
    expect(rows).toHaveLength(0)
  })
})

describe('Round-robin auto-assignment', () => {
  // Builds a category with nJudges and nProjects, then auto-assigns k judges per project
  async function buildCategory(nJudges: number, nProjects: number) {
    const cat = (await request(app).post('/api/categories').set(admin()).send({ name: 'Load' })).body
    for (let j = 0; j < nJudges; j++) {
      await request(app).post('/api/judges').set(admin())
        .send({ name: `Judge ${j}`, username: `judge${j}`, accessCode: '1000', categoryId: cat.id })
    }
    for (let p = 0; p < nProjects; p++) {
      await request(app).post('/api/projects').set(admin())
        .send({ categoryId: cat.id, title: `Poster ${p}`, presenter: `Team ${p}` })
    }
    return cat.id as number
  }

  async function loads(categoryId: number) {
    const { rows } = await pool.query(
      `SELECT j.id, COUNT(jp.project_id)::int AS n FROM judges j
       LEFT JOIN judge_project jp ON jp.judge_id = j.id
       WHERE j.category_id = $1 GROUP BY j.id`, [categoryId])
    return rows.map((r: any) => r.n)
  }

  it('TC-ASG-01 gives every project exactly k distinct judges', async () => {
    const cat = await buildCategory(6, 15)
    const res = await request(app).post('/api/assignments/auto').set(admin())
      .send({ categoryId: cat, minJudgesPerProject: 2 })
    expect(res.body.assigned).toBe(30)
    const { rows } = await pool.query(
      `SELECT p.id, COUNT(DISTINCT jp.judge_id)::int AS n FROM projects p
       JOIN judge_project jp ON jp.project_id = p.id WHERE p.category_id=$1 GROUP BY p.id`, [cat])
    expect(rows).toHaveLength(15)
    expect(rows.every((r: any) => r.n === 2)).toBe(true)
  })

  it.each([[6, 15, 2], [5, 12, 2], [4, 9, 3], [18, 45, 2]])(
    'TC-ASG-02 balances load to within one project (%i judges, %i projects, k=%i)',
    async (nJ, nP, k) => {
      const cat = await buildCategory(nJ, nP)
      await request(app).post('/api/assignments/auto').set(admin()).send({ categoryId: cat, minJudgesPerProject: k })
      const l = await loads(cat)
      expect(l.reduce((a, b) => a + b, 0)).toBe(nP * k)
      expect(Math.max(...l) - Math.min(...l)).toBeLessThanOrEqual(1)
    })

  it('TC-ASG-03 replaces, rather than adds to, a previous auto-assignment', async () => {
    const cat = await buildCategory(4, 8)
    const run = () => request(app).post('/api/assignments/auto').set(admin()).send({ categoryId: cat, minJudgesPerProject: 2 })
    await run(); await run()
    const l = await loads(cat)
    expect(l.reduce((a, b) => a + b, 0)).toBe(16)
  })

  it('TC-ASG-04 refuses a category with no judges or projects (400)', async () => {
    const cat = (await request(app).post('/api/categories').set(admin()).send({ name: 'Empty' })).body
    expect((await request(app).post('/api/assignments/auto').set(admin()).send({ categoryId: cat.id })).status).toBe(400)
    expect((await request(app).post('/api/assignments/auto').set(admin()).send({})).status).toBe(400)
  })
})
