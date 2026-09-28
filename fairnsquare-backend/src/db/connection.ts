import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const config: PoolConfig = process.env.DATABASE_URL
  ? {
      // Production (Render → Neon): single connection string, SSL required
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      // Local dev: individual vars, no SSL
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'fairn2',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    }

export const pool = new Pool(config)

pool.on('connect', () => {
  console.log('Connected to PostgreSQL')
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})