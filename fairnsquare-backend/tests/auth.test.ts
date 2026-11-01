import jwt from 'jsonwebtoken'
import { app, pool, request, resetDb, SEED, judgeToken, adminToken, bearer } from './helpers'

beforeAll(resetDb)
afterAll(() => pool.end())

describe('FR-001 Judge authentication', () => {
  it('TC-AUTH-01 issues a judge token for a valid username and access code', async () => {
    const res = await request(app).post('/api/auth/judge/login').send(SEED.sarah)
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.judge).toMatchObject({ id: 1, username: 'sarah.chen' })
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as any
    expect(payload).toMatchObject({ id: 1, role: 'judge' })
  })

  it('TC-AUTH-02 normalises username case and surrounding whitespace', async () => {
    const res = await request(app).post('/api/auth/judge/login')
      .send({ username: '  Sarah.Chen ', accessCode: '1234' })
    expect(res.status).toBe(200)
  })

  it('TC-AUTH-03 rejects a wrong access code with 401', async () => {
    const res = await request(app).post('/api/auth/judge/login')
      .send({ username: 'priya.nair', accessCode: '0000' })
    expect(res.status).toBe(401)
    expect(res.body.token).toBeUndefined()
  })

  it('TC-AUTH-04 rejects missing credentials with 400', async () => {
    const res = await request(app).post('/api/auth/judge/login').send({ username: 'sarah.chen' })
    expect(res.status).toBe(400)
  })

  it('TC-AUTH-05 completes login well inside the 3 s target', async () => {
    const t0 = Date.now()
    await request(app).post('/api/auth/judge/login').send(SEED.marcus)
    expect(Date.now() - t0).toBeLessThan(3000)
  })
})

describe('QR-008 Administrator authentication (bcrypt)', () => {
  it('TC-AUTH-06 accepts the correct admin password', async () => {
    const res = await request(app).post('/api/auth/admin/login').send(SEED.admin)
    expect(res.status).toBe(200)
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET!)).toMatchObject({ role: 'admin' })
  })

  it('TC-AUTH-07 returns the same error for an unknown email and a wrong password', async () => {
    const wrongPw = await request(app).post('/api/auth/admin/login')
      .send({ email: SEED.admin.email, password: 'nope' })
    const unknown = await request(app).post('/api/auth/admin/login')
      .send({ email: 'ghost@hunterwise.org', password: 'nope' })
    expect(wrongPw.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrongPw.body.error).toBe(unknown.body.error)
  })

  it('TC-AUTH-08 stores the admin password as a bcrypt hash, never plaintext', async () => {
    const { rows } = await pool.query('SELECT password FROM admins')
    for (const r of rows) {
      expect(r.password).toMatch(/^\$2[aby]\$\d{2}\$/)
      expect(r.password).not.toContain(SEED.admin.password)
    }
  })
})

describe('Brute-force protection on 4-digit access codes', () => {
  it('TC-AUTH-09 locks a username after 10 failed attempts within 15 minutes', async () => {
    const attempt = () => request(app).post('/api/auth/judge/login')
      .send({ username: 'marcus.webb', accessCode: '0001' })
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401)
    expect((await attempt()).status).toBe(429)
    // Even the correct code is refused while the lock is active
    const correct = await request(app).post('/api/auth/judge/login').send(SEED.marcus)
    expect(correct.status).toBe(429)
  })

  it('TC-AUTH-10 does not lock out other judges sharing the venue network', async () => {
    const res = await request(app).post('/api/auth/judge/login').send(SEED.priya)
    expect(res.status).toBe(200)
  })
})

describe('Role-based access control (JWT middleware)', () => {
  it('TC-RBAC-01 rejects requests with no token (401)', async () => {
    expect((await request(app).get('/api/judges/me/projects')).status).toBe(401)
    expect((await request(app).get('/api/judges')).status).toBe(401)
  })

  it('TC-RBAC-02 rejects a tampered or foreign-signed token (401)', async () => {
    const forged = jwt.sign({ id: 1, role: 'admin' }, 'some-other-secret-of-sufficient-length!!')
    expect((await request(app).get('/api/judges').set(bearer(forged))).status).toBe(401)
  })

  it('TC-RBAC-03 rejects an expired token (401)', async () => {
    const expired = jwt.sign({ id: 1, role: 'judge', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!)
    expect((await request(app).get('/api/judges/me/projects').set(bearer(expired))).status).toBe(401)
  })

  it('TC-RBAC-04 forbids judges from admin endpoints (403)', async () => {
    const t = judgeToken(1)
    for (const path of ['/api/judges', '/api/assignments', '/api/projects', '/api/scores/comments']) {
      expect((await request(app).get(path).set(bearer(t))).status).toBe(403)
    }
    expect((await request(app).post('/api/event/close').set(bearer(t))).status).toBe(403)
    expect((await request(app).get('/api/categories/1/results').set(bearer(t))).status).toBe(403)
  })

  it('TC-RBAC-05 forbids admin tokens from judge-only endpoints (403)', async () => {
    const res = await request(app).post('/api/scores').set(bearer(adminToken()))
      .send({ projectId: 101, criterionId: 1, value: 3 })
    expect(res.status).toBe(403)
  })

  it('TC-RBAC-06 exposes only the health check and judging status without a token', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200)
    expect((await request(app).get('/api/event/status')).status).toBe(200)
  })
})
