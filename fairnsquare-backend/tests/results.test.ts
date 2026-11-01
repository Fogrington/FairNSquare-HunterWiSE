import { app, pool, request, resetDb, adminToken, bearer, scoreCard, judgeToken } from './helpers'

beforeEach(resetDb)
afterAll(() => pool.end())

const results = (categoryId: number) =>
  request(app).get(`/api/categories/${categoryId}/results`).set(bearer(adminToken()))

describe('FR-007 Aggregation follows the HunterWiSE method', () => {
  it('TC-RES-01 averages the totals of each judge\'s complete scorecard', async () => {
    // Project 101 is judged by Sarah (1) and Priya (3)
    await scoreCard(1, 101, [5, 5, 4, 4, 3, 3])   // total 24
    await scoreCard(3, 101, [3, 3, 3, 3, 3, 4])   // total 19
    const res = await results(1)
    const p101 = res.body.find((r: any) => r.id === 101)
    expect(Number(p101.average_score)).toBeCloseTo(21.5, 5)
    expect(Number(p101.judge_count)).toBe(2)
  })

  it('TC-RES-02 excludes incomplete scorecards from the average', async () => {
    await scoreCard(1, 101, [5, 5, 5, 5, 5, 5])   // complete: 30
    // Priya scores only 3 of 6 criteria
    for (const c of [1, 2, 3]) {
      await request(app).post('/api/scores').set(bearer(judgeToken(3)))
        .send({ projectId: 101, criterionId: c, value: 1 })
    }
    const p101 = (await results(1)).body.find((r: any) => r.id === 101)
    expect(Number(p101.average_score)).toBe(30)
    expect(Number(p101.judge_count)).toBe(1)
  })

  it('TC-RES-03 ranks projects by average, highest first, with unscored projects last', async () => {
    await scoreCard(1, 101, [3, 3, 3, 3, 3, 3])   // 18
    await scoreCard(1, 102, [5, 5, 5, 5, 4, 4])   // 28
    await scoreCard(3, 103, [4, 4, 4, 4, 4, 4])   // 24
    const ids = (await results(1)).body.map((r: any) => r.id)
    expect(ids.slice(0, 3)).toEqual([102, 103, 101])
    expect(ids[3]).toBe(104)                        // never scored
    const p104 = (await results(1)).body.find((r: any) => r.id === 104)
    expect(p104.average_score).toBeNull()
    expect(Number(p104.judge_count)).toBe(0)
  })

  it('TC-RES-04 never mixes projects from another category', async () => {
    await scoreCard(2, 201, [5, 5, 5, 5, 5, 5])
    const ids = (await results(1)).body.map((r: any) => r.id)
    expect(ids).not.toContain(201)
    expect((await results(2)).body.map((r: any) => r.id)).toEqual(expect.arrayContaining([201, 202, 203]))
  })

  it('TC-RES-05 reflects a corrected score immediately (no stale aggregate)', async () => {
    await scoreCard(1, 101, [1, 1, 1, 1, 1, 1])
    await scoreCard(1, 101, [5, 5, 5, 5, 5, 5])   // judge revises every answer
    const p101 = (await results(1)).body.find((r: any) => r.id === 101)
    expect(Number(p101.average_score)).toBe(30)
  })
})

describe('IR-006 Admin results read the same data path the mobile app writes', () => {
  it('TC-RES-06 a mobile-submitted score appears in admin per-project scores', async () => {
    await request(app).post('/api/scores').set(bearer(judgeToken(2)))
      .send({ projectId: 201, criterionId: 4, value: 2 })
    const res = await request(app).get('/api/scores/project/201').set(bearer(adminToken()))
    expect(res.body).toEqual([expect.objectContaining({ judge_name: 'Marcus Webb', criterion_id: 4, value: 2 })])
  })
})
