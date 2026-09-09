// ─── Config ───────────────────────────────────────────────────────────────────
// Admin panel runs in a browser on the same machine as the backend during dev.
// If you ever need to hit a backend on another machine, change this to that
// machine's LAN IP, e.g. 'http://192.168.1.x:3000/api'
const API_BASE = 'http://localhost:3000/api'

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
  email: string
  access_code: string
  category_id: number | null
  category_name: string | null
}

export const getJudges = () => request<APIJudge[]>('/judges')

export const createJudge = (judge: { name: string; email: string; accessCode: string; categoryId: number | null }) =>
  request<APIJudge>('/judges', { method: 'POST', body: JSON.stringify(judge) })

export const updateJudgeAPI = (id: number, judge: { name: string; email: string; accessCode: string; categoryId: number | null }) =>
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

export type APICriterion = { id: number; label: string; description: string; weight: number }

export const getCriteria = () => request<APICriterion[]>('/scores/criteria')
