import dotenv from 'dotenv'

dotenv.config()

// Fail fast: never run with a missing or guessable signing secret.
// (Previously auth.ts fell back to 'fallback_secret' while the middleware
// fell back to '' — tokens would sign fine but never verify.)
const secret = process.env.JWT_SECRET
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET is missing or too short (min 32 chars) — refusing to start')
}

export const JWT_SECRET: string = secret
export const JWT_EXPIRES_IN = '12h'
