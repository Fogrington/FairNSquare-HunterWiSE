import fs from 'fs'
import path from 'path'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { pool } from '../src/db/connection'
import app from '../src/index'

export { app, pool, request }

const SCHEMA = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8')

/** Drops and recreates every table from schema.sql, including the seed data. */
export async function resetDb() {
  await pool.query(SCHEMA)
}

// Seed accounts from schema.sql
export const SEED = {
  admin: { email: 'admin@hunterwise.org', password: 'changeme-local-dev' },
  sarah: { id: 1, username: 'sarah.chen', accessCode: '1234' },   // assigned 101, 102
  marcus: { id: 2, username: 'marcus.webb', accessCode: '5678' }, // assigned 201, 202
  priya: { id: 3, username: 'priya.nair', accessCode: '9012' },   // assigned 101, 103
}

export const CRITERIA_IDS = [1, 2, 3, 4, 5, 6]

export function judgeToken(id: number) {
  return jwt.sign({ id, role: 'judge' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

export function adminToken(id = 1) {
  return jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` })

/** Submits a full scorecard (one value per criterion) for a judge/project. */
export async function scoreCard(judgeId: number, projectId: number, values: number[]) {
  const token = judgeToken(judgeId)
  for (let i = 0; i < CRITERIA_IDS.length; i++) {
    const res = await request(app)
      .post('/api/scores')
      .set(bearer(token))
      .send({ projectId, criterionId: CRITERIA_IDS[i], value: values[i] })
    if (res.status !== 201) throw new Error(`scoreCard failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
}
