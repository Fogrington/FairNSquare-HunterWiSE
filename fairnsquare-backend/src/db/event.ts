import { pool } from './connection'

// Judging state lives in a single-row table (event_settings, id = 1).
// If the row is somehow missing, treat judging as open rather than locking everyone out.
export async function isJudgingOpen(): Promise<boolean> {
  const result = await pool.query('SELECT judging_open FROM event_settings WHERE id = 1')
  return result.rows.length === 0 ? true : result.rows[0].judging_open
}

export const JUDGING_CLOSED_RESPONSE = {
  error: 'Judging has closed. Scores and comments can no longer be changed.',
  code: 'JUDGING_CLOSED',
}
