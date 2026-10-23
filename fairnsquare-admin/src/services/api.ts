// ─── Config ───────────────────────────────────────────────────────────────────
// Set VITE_API_URL in fairnsquare-admin/.env.local (dev) or in the hosting
// provider's environment settings (production), e.g.
//   VITE_API_URL=https://fairnsquare-hunterwise.onrender.com/api
// Falls back to a local backend if it isn't set.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

const TOKEN_KEY = 'fairn2_admin_token'

// ─── Token helpers ────────────────────────────────────────────────────────────

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  // DELETE endpoints in this API return { success: true } with a body,
  // so we can always try to parse JSON.
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error((data as any).error || `Request failed: ${res.status}`)
  }

  return data as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AdminLoginResponse = {
  token: string
  admin: { id: number; name: string; email: string }
}

export function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  return request<AdminLoginResponse>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ─── Judges ───────────────────────────────────────────────────────────────────

export type APIJudge = {
  id: number
  name: string
  username: string
  access_code: string
  category_id: number | null
  category_name: string | null
}

export const getJudges = () => request<APIJudge[]>('/judges')

export const createJudge = (judge: { name: string; username: string; accessCode: string; categoryId: number | null }) =>
  request<APIJudge>('/judges', { method: 'POST', body: JSON.stringify(judge) })

export const updateJudgeAPI = (id: number, judge: { name: string; username: string; accessCode: string; categoryId: number | null }) =>
  request<APIJudge>(`/judges/${id}`, { method: 'PUT', body: JSON.stringify(judge) })

export const deleteJudge = (id: number) =>
  request<{ success: true }>(`/judges/${id}`, { method: 'DELETE' })

// ─── Categories ───────────────────────────────────────────────────────────────

export type APICategory = { id: number; name: string }

export const getCategories = () => request<APICategory[]>('/categories')

export const createCategory = (name: string) =>
  request<APICategory>('/categories', { method: 'POST', body: JSON.stringify({ name }) })

export const deleteCategory = (id: number) =>
  request<{ success: true }>(`/categories/${id}`, { method: 'DELETE' })

export type APICategoryResult = {
  id: number
  title: string
  presenter: string
  institution: string
  judge_count: string
  average_score: string | null
}

export const getCategoryResults = (categoryId: number) =>
  request<APICategoryResult[]>(`/categories/${categoryId}/results`)

// ─── Projects ─────────────────────────────────────────────────────────────────

export type APIProject = {
  id: number
  category_id: number
  category_name: string
  title: string
  presenter: string
  institution: string
  description: string | null
}

export const getProjects = () => request<APIProject[]>('/projects')

export const createProject = (project: { categoryId: number; title: string; presenter: string; institution: string }) =>
  request<APIProject>('/projects', { method: 'POST', body: JSON.stringify(project) })

export const deleteProject = (id: number) =>
  request<{ success: true }>(`/projects/${id}`, { method: 'DELETE' })

// ─── Assignments ──────────────────────────────────────────────────────────────

export type APIAssignment = {
  judge_id: number
  project_id: number
  judge_name: string
  project_title: string
}

export const getAssignments = () => request<APIAssignment[]>('/assignments')

export const createAssignment = (judgeId: number, projectId: number) =>
  request<{ success: true }>('/assignments', { method: 'POST', body: JSON.stringify({ judgeId, projectId }) })

export const deleteAssignment = (judgeId: number, projectId: number) =>
  request<{ success: true }>('/assignments', { method: 'DELETE', body: JSON.stringify({ judgeId, projectId }) })

export const autoAssignCategoryAPI = (categoryId: number, minJudgesPerProject = 2) =>
  request<{ success: true; assigned: number }>('/assignments/auto', {
    method: 'POST',
    body: JSON.stringify({ categoryId, minJudgesPerProject }),
  })

// ─── Scores ───────────────────────────────────────────────────────────────────

export type APIScoreDetail = {
  id: number
  judge_id: number
  judge_name: string
  project_id: number
  criterion_id: number
  criterion_label: string
  weight: string
  value: number
}

export const getProjectScores = (projectId: number) =>
  request<APIScoreDetail[]>(`/scores/project/${projectId}`)

export type APICriterion = {
  id: number
  label: string
  description: string
  weight: number
  max_score: number          // scores run 1..max_score
  low_label: string | null   // what a score of 1 means
}

// Highest possible total for one judge's scorecard (e.g. 6 questions × 5 = 30)
export const maxTotalOf = (criteria: APICriterion[]) =>
  criteria.reduce((sum, c) => sum + Number(c.max_score), 0)

export const getCriteria = () => request<APICriterion[]>('/scores/criteria')

// ─── Judging status (open / closed) ───────────────────────────────────────────

export type EventStatus = { judgingOpen: boolean; closedAt: string | null }

export const getEventStatus = () => request<EventStatus>('/event/status')

export const closeJudging = () => request<EventStatus>('/event/close', { method: 'POST' })

export const reopenJudging = () => request<EventStatus>('/event/open', { method: 'POST' })

// ─── Judge comments ───────────────────────────────────────────────────────────

export type APIComment = {
  project_id: number
  judge_id: number
  judge_name: string
  comment: string
  comment_updated_at: string
}

export const getAllComments = () => request<APIComment[]>('/scores/comments')
