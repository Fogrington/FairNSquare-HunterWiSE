import { app, pool, request, resetDb, judgeToken, adminToken, bearer } from './helpers'

beforeEach(resetDb)
afterAll(() => pool.end())

const submit = (judgeId: number, body: object) =>
  request(app).post('/api/scores').set(bearer(judgeToken(judgeId))).send(body)

describe('FR-002 Judges may only score assigned projects', () => {
  it('TC-SCR-01 accepts a score for an assigned project', async () => {
    const res = await submit(1, { projectId: 101, criterionId: 1, value: 4 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ judge_id: 1, project_id: 101, criterion_id: 1, value: 4 })
  })

  it('TC-SCR-02 rejects a score for an unassigned project in the same category (403)', async () => {
    // Sarah is in category 1 but is not assigned to project 103
    const res = await submit(1, { projectId: 103, criterionId: 1, value: 4 })
    expect(res.status).toBe(403)
    const { rows } = await pool.query('SELECT * FROM scores WHERE judge_id=1 AND project_id=103')
    expect(rows).toHaveLength(0)
  })

  it('TC-SCR-03 rejects a score for a project in another category (403)', async () => {
    const res = await submit(1, { projectId: 201, criterionId: 1, value: 4 })
    expect(res.status).toBe(403)
  })

  it('TC-SCR-04 takes the judge identity from the token, not the request body', async () => {
    const res = await submit(1, { projectId: 201, criterionId: 1, value: 5, judgeId: 2 })
    expect(res.status).toBe(403)
    const { rows } = await pool.query('SELECT * FROM scores WHERE project_id=201')
    expect(rows).toHaveLength(0)
  })

  it('TC-SCR-05 lists only the logged-in judge\'s assigned projects, in poster-number order', async () => {
    const res = await request(app).get('/api/judges/me/projects').set(bearer(judgeToken(3)))
    expect(res.status).toBe(200)
    expect(res.body.map((p: any) => p.id)).toEqual([101, 103])
  })
})

describe('FR-005 / FR-017 Score validation', () => {
  it.each([
    ['zero', 0], ['above max', 6], ['negative', -1], ['fractional', 2.5], ['string', '3'], ['null', null],
  ])('TC-SCR-06 rejects a %s value (400)', async (_label, value) => {
    const res = await submit(1, { projectId: 101, criterionId: 1, value })
    expect(res.status).toBe(400)
  })

  it.each([[1], [5]])('TC-SCR-07 accepts boundary value %i', async (value) => {
    expect((await submit(1, { projectId: 101, criterionId: 2, value })).status).toBe(201)
  })

  it('TC-SCR-08 rejects an unknown criterion with an actionable message (400)', async () => {
    const res = await submit(1, { projectId: 101, criterionId: 999, value: 3 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/restart the app/i)
  })

  it('TC-SCR-09 rejects requests with missing fields (400)', async () => {
    expect((await submit(1, { projectId: 101, value: 3 })).status).toBe(400)
    expect((await submit(1, { criterionId: 1, value: 3 })).status).toBe(400)
  })
})

describe('FR-016 Duplicate submissions keep only the most recent score', () => {
  it('TC-SCR-10 updates rather than duplicates on re-submission', async () => {
    await submit(1, { projectId: 101, criterionId: 1, value: 2 })
    await submit(1, { projectId: 101, criterionId: 1, value: 5 })
    const { rows } = await pool.query(
      'SELECT value FROM scores WHERE judge_id=1 AND project_id=101 AND criterion_id=1')
    expect(rows).toEqual([{ value: 5 }])
  })

  it('TC-SCR-11 stays consistent when the same submission is retried concurrently', async () => {
    // Simulates a judge double-tapping on a slow network: 10 identical requests in flight at once
    const results = await Promise.all(
      Array.from({ length: 10 }, () => submit(1, { projectId: 101, criterionId: 3, value: 4 })))
    expect(results.every(r => r.status === 201)).toBe(true)
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM scores WHERE judge_id=1 AND project_id=101 AND criterion_id=3')
    expect(rows[0].n).toBe(1)
  })

  it('TC-SCR-12 records a submission timestamp for every score (IMR-001)', async () => {
    await submit(1, { projectId: 101, criterionId: 1, value: 3 })
    const { rows } = await pool.query('SELECT submitted_at, judge_id, project_id FROM scores')
    expect(rows[0].submitted_at).toBeInstanceOf(Date)
  })
})

describe('Judging window control (open / close)', () => {
  const close = () => request(app).post('/api/event/close').set(bearer(adminToken()))
  const open = () => request(app).post('/api/event/open').set(bearer(adminToken()))

  it('TC-EVT-01 blocks score changes once judging is closed, with a machine-readable code', async () => {
    expect((await close()).body.judgingOpen).toBe(false)
    const res = await submit(1, { projectId: 101, criterionId: 1, value: 3 })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('JUDGING_CLOSED')
  })

  it('TC-EVT-02 blocks comment changes once judging is closed', async () => {
    await close()
    const res = await request(app).put('/api/judges/me/projects/101/comment')
      .set(bearer(judgeToken(1))).send({ comment: 'late' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('JUDGING_CLOSED')
  })

  it('TC-EVT-03 reports closed status and time publicly, and allows reopening', async () => {
    await close()
    const status = await request(app).get('/api/event/status')
    expect(status.body.judgingOpen).toBe(false)
    expect(status.body.closedAt).not.toBeNull()
    await open()
    expect((await submit(1, { projectId: 101, criterionId: 1, value: 3 })).status).toBe(201)
  })
})

describe('Per-poster judge comments', () => {
  const put = (judgeId: number, projectId: number, comment: unknown) =>
    request(app).put(`/api/judges/me/projects/${projectId}/comment`)
      .set(bearer(judgeToken(judgeId))).send({ comment })

  it('TC-CMT-01 saves and trims a comment on an assigned poster', async () => {
    const res = await put(1, 101, '  Clear problem statement.  ')
    expect(res.status).toBe(200)
    expect(res.body.comment).toBe('Clear problem statement.')
  })

  it('TC-CMT-02 refuses comments on unassigned posters (403)', async () => {
    expect((await put(1, 201, 'not mine')).status).toBe(403)
  })

  it('TC-CMT-03 enforces the 2000-character limit (400)', async () => {
    expect((await put(1, 101, 'x'.repeat(2001))).status).toBe(400)
    expect((await put(1, 101, 'x'.repeat(2000))).status).toBe(200)
  })

  it('TC-CMT-04 clears a comment when an empty string is saved', async () => {
    await put(1, 101, 'first')
    const res = await put(1, 101, '   ')
    expect(res.body.comment).toBeNull()
  })

  it('TC-CMT-05 exposes comments to administrators only', async () => {
    await put(1, 101, 'visible to admin')
    const res = await request(app).get('/api/scores/comments').set(bearer(adminToken()))
    expect(res.status).toBe(200)
    expect(res.body).toEqual([expect.objectContaining({ project_id: 101, judge_name: 'Sarah Chen' })])
  })
})
