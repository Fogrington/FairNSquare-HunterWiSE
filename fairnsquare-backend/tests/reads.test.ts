import { app, pool, request, resetDb, adminToken, judgeToken, bearer } from './helpers'

beforeEach(resetDb)
afterAll(() => pool.end())

const admin = () => bearer(adminToken())

describe('Administrator read endpoints', () => {
  it('TC-READ-01 lists judges with their category names, alphabetically', async () => {
    const res = await request(app).get('/api/judges').set(admin())
    expect(res.status).toBe(200)
    expect(res.body.map((j: any) => j.name)).toEqual(['Marcus Webb', 'Priya Nair', 'Sarah Chen'])
    expect(res.body[0].category_name).toBe('Life Sciences & Health')
  })

  it('TC-READ-02 lists categories, projects and per-category projects', async () => {
    expect((await request(app).get('/api/categories').set(admin())).body).toHaveLength(2)
    const projects = (await request(app).get('/api/projects').set(admin())).body
    expect(projects).toHaveLength(7)
    expect(projects[0].category_name).toBeDefined()
    const cat1 = (await request(app).get('/api/categories/1/projects').set(admin())).body
    expect(cat1.map((p: any) => p.id).sort()).toEqual([101, 102, 103, 104])
  })

  it('TC-READ-03 lists all assignments with judge and project names', async () => {
    const res = await request(app).get('/api/assignments').set(admin())
    expect(res.body).toHaveLength(6)
    expect(res.body[0]).toEqual(expect.objectContaining({ judge_name: expect.any(String), project_title: expect.any(String) }))
  })

  it('TC-READ-04 returns the six-question HunterWiSE rubric (1-5 each)', async () => {
    const res = await request(app).get('/api/scores/criteria')
    expect(res.body).toHaveLength(6)
    expect(res.body.every((c: any) => c.max_score === 5 && c.low_label)).toBe(true)
  })
})

describe('Session restore data for judges', () => {
  it('TC-READ-05 returns only the logged-in judge\'s own saved scores', async () => {
    await request(app).post('/api/scores').set(bearer(judgeToken(1))).send({ projectId: 101, criterionId: 1, value: 4 })
    await request(app).post('/api/scores').set(bearer(judgeToken(3))).send({ projectId: 101, criterionId: 1, value: 2 })
    const res = await request(app).get('/api/judges/me/scores').set(bearer(judgeToken(1)))
    expect(res.body).toEqual([expect.objectContaining({ judge_id: 1, value: 4, criterion_label: 'Problem' })])
  })
})

describe('Cascading deletes keep the data consistent', () => {
  it('TC-DEL-01 deleting a project removes its scores and assignments', async () => {
    await request(app).post('/api/scores').set(bearer(judgeToken(1))).send({ projectId: 101, criterionId: 1, value: 4 })
    expect((await request(app).delete('/api/projects/101').set(admin())).status).toBe(200)
    const s = await pool.query('SELECT * FROM scores WHERE project_id=101')
    const a = await pool.query('SELECT * FROM judge_project WHERE project_id=101')
    expect(s.rows).toHaveLength(0)
    expect(a.rows).toHaveLength(0)
  })

  it('TC-DEL-02 deleting a category removes its projects but keeps judges (category set to null)', async () => {
    expect((await request(app).delete('/api/categories/1').set(admin())).status).toBe(200)
    const p = await pool.query('SELECT * FROM projects WHERE category_id=1')
    const j = await pool.query('SELECT category_id FROM judges WHERE id=1')
    expect(p.rows).toHaveLength(0)
    expect(j.rows[0].category_id).toBeNull()
  })
})
