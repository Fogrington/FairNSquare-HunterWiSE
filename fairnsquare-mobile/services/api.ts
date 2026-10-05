import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── Config ───────────────────────────────────────────────────────────────────
// For Expo Go on a physical device, replace with your machine's local IP
// e.g. 'http://192.168.1.x:3000/api'
// For iOS simulator use 'http://localhost:3000/api'
// For Android emulator use 'http://10.0.2.2:3000/api'
//const API_BASE = 'http://192.168.0.185:3000/api'
// changed to this API_URL constant to use the environment variable from .env file
// and to do automatically for while publishing and moving away from Expo
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.x.x:3000'
console.log('API:', process.env.EXPO_PUBLIC_API_URL)

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
  email: string
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

  const url = `${API_URL}${path}`
  // console.log(options.method ?? 'GET', url)
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })
  const text = await res.text()
  // console.log(res.status, text.slice(0, 200))
  const data = JSON.parse(text)

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`)
  }

  return data as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type JudgeLoginResponse = {
  token: string
  judge: {
    id: number
    name: string
    email: string
    categoryId: number | null
    categoryName: string | null
  }
}

export async function judgeLogin(
  email: string,
  accessCode: string
): Promise<JudgeLoginResponse> {
  return request<JudgeLoginResponse>('/auth/judge/login', {
    method: 'POST',
    body: JSON.stringify({ email, accessCode }),
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
}

export async function getAssignedProjects(judgeId: number): Promise<APIProject[]> {
  return request<APIProject[]>(`/judges/${judgeId}/projects`)
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export type APICriterion = {
  id: number
  label: string
  description: string
  weight: number
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

export async function getJudgeScores(judgeId: number): Promise<APIJudgeScore[]> {
  return request<APIJudgeScore[]>(`/judges/${judgeId}/scores`)
}