import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── Config ───────────────────────────────────────────────────────────────────
// For Expo Go on a physical device, replace with your machine's local IP
// e.g. 'http://192.168.1.x:3000/api'
// For iOS simulator use 'http://localhost:3000/api'
// For Android emulator use 'http://10.0.2.2:3000/api'
//const API_BASE = 'http://192.168.0.185:3000/api'
// changed to this API_URL constant to use the environment variable from .env file
// and to do automatically for while publishing and moving away from Expo
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.x.x:3000/api'

const TOKEN_KEY = 'fairn2_judge_token'
const JUDGE_KEY = 'fairn2_judge_profile'

// ─── Token helpers ────────────────────────────────────────────────────────────

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token)
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY)
  await AsyncStorage.removeItem(JUDGE_KEY)
}

// ─── Judge profile persistence (for session restore on app relaunch) ──────────

export type StoredJudge = {
  id: number
  name: string
  username: string
  categoryId: number | null
  categoryName: string | null
}

export async function saveJudgeProfile(judge: StoredJudge) {
  await AsyncStorage.setItem(JUDGE_KEY, JSON.stringify(judge))
}

export async function getStoredJudgeProfile(): Promise<StoredJudge | null> {
  const raw = await AsyncStorage.getItem(JUDGE_KEY)
  return raw ? JSON.parse(raw) : null
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

// Errors carry the HTTP status and the backend's error code (e.g. JUDGING_CLOSED)
// so screens can show the right message.
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Generous, because a sleeping free-tier server can take ~a minute to wake up
const REQUEST_TIMEOUT_MS = 60000

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  let text: string
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal })
    text = await res.text()
  } catch {
    throw new ApiError(
      "Couldn't reach the FairN² server. Check your internet connection and try again.",
      0,
      'NETWORK'
    )
  } finally {
    clearTimeout(timeout)
  }

  // A server that's restarting can answer with an HTML error page instead of JSON
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new ApiError('The server is not responding properly. Please try again in a moment.', res.status, 'BAD_RESPONSE')
  }

  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code)
  }

  return data as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type JudgeLoginResponse = {
  token: string
  judge: {
    id: number
    name: string
    username: string
    categoryId: number | null
    categoryName: string | null
  }
}

export async function judgeLogin(
  username: string,
  accessCode: string
): Promise<JudgeLoginResponse> {
  return request<JudgeLoginResponse>('/auth/judge/login', {
    method: 'POST',
    body: JSON.stringify({ username, accessCode }),
  })
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type APIProject = {
  id: number
  category_id: number
  title: string
  presenter: string
  institution: string
  description: string
  comment: string | null   // this judge's written feedback, if any
}

// The backend identifies the judge from the token, so no id in the URL
export async function getAssignedProjects(): Promise<APIProject[]> {
  return request<APIProject[]>('/judges/me/projects')
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export type APICriterion = {
  id: number
  label: string              // short name, e.g. "Problem"
  description: string        // the full rubric question
  weight: number
  max_score: number          // scores run 1..max_score
  low_label: string | null   // what a score of 1 means
}

export async function getCriteria(): Promise<APICriterion[]> {
  return request<APICriterion[]>('/scores/criteria')
}

export async function submitScore(
  projectId: number,
  criterionId: number,
  value: number
): Promise<void> {
  return request('/scores', {
    method: 'POST',
    body: JSON.stringify({ projectId, criterionId, value }),
  })
}

export type APIJudgeScore = {
  id: number
  judge_id: number
  project_id: number
  criterion_id: number
  criterion_label: string
  weight: string
  value: number
  submitted_at: string
}

export async function getJudgeScores(): Promise<APIJudgeScore[]> {
  return request<APIJudgeScore[]>('/judges/me/scores')
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function saveComment(projectId: number, comment: string): Promise<void> {
  await request(`/judges/me/projects/${projectId}/comment`, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  })
}
