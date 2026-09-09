import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as api from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Category = { id: number; name: string }

export type Project = {
  id: number
  categoryId: number
  title: string
  presenter: string
  institution: string
}

export type Judge = {
  id: number
  name: string
  email: string
  accessCode: string
  categoryId: number | null   // grouping hint only
}

// Junction table: which judges are assigned to which projects
export type JudgeProjectAssignment = {
  judgeId: number
  projectId: number
}

// ─── API → local shape mappers ─────────────────────────────────────────────────

const mapJudge = (j: api.APIJudge): Judge => ({
  id: j.id,
  name: j.name,
  email: j.email,
  accessCode: j.access_code,
  categoryId: j.category_id,
})

const mapProject = (p: api.APIProject): Project => ({
  id: p.id,
  categoryId: p.category_id,
  title: p.title,
  presenter: p.presenter,
  institution: p.institution ?? '',
})

const mapAssignment = (a: api.APIAssignment): JudgeProjectAssignment => ({
  judgeId: a.judge_id,
  projectId: a.project_id,
})

// ─── Context ──────────────────────────────────────────────────────────────────

type AdminContextType = {
  admin: boolean
  adminName: string | null
  adminLogin: (email: string, password: string) => Promise<boolean>
  adminLogout: () => void
  loading: boolean
  error: string | null
  categories: Category[]
  projects: Project[]
  judges: Judge[]
  assignments: JudgeProjectAssignment[]
  refreshAll: () => Promise<void>
  // Judge actions
  addJudge: (judge: Omit<Judge, 'id'>) => Promise<void>
  updateJudge: (id: number, updates: Partial<Judge>) => Promise<void>
  removeJudge: (id: number) => Promise<void>
  // Category actions
  addCategory: (name: string) => Promise<void>
  removeCategory: (id: number) => Promise<void>
  // Project actions
  addProject: (project: Omit<Project, 'id'>) => Promise<void>
  removeProject: (id: number) => Promise<void>
  // Assignment actions
  assignProject: (judgeId: number, projectId: number) => Promise<void>
  unassignProject: (judgeId: number, projectId: number) => Promise<void>
  autoAssignCategory: (categoryId: number, minJudgesPerProject?: number) => Promise<void>
  getProjectsForJudge: (judgeId: number) => Project[]
  getJudgesForProject: (projectId: number) => Judge[]
}

const AdminContext = createContext<AdminContextType | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(false)
  const [adminName, setAdminName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [assignments, setAssignments] = useState<JudgeProjectAssignment[]>([])

  const refreshAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cats, projs, judgs, assigns] = await Promise.all([
        api.getCategories(),
        api.getProjects(),
        api.getJudges(),
        api.getAssignments(),
      ])
      setCategories(cats)
      setProjects(projs.map(mapProject))
      setJudges(judgs.map(mapJudge))
      setAssignments(assigns.map(mapAssignment))
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // On mount: if a token is already saved, try to resume the session.
  useEffect(() => {
    const token = api.getToken()
    if (!token) return
    setAdmin(true)
    refreshAll().catch(() => {
      // Token was invalid/expired — drop back to login.
      api.clearToken()
      setAdmin(false)
    })
  }, [])

  const adminLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await api.adminLogin(email, password)
      api.saveToken(res.token)
      setAdminName(res.admin.name)
      setAdmin(true)
      await refreshAll()
      return true
    } catch {
      return false
    }
  }

  const adminLogout = () => {
    api.clearToken()
    setAdmin(false)
    setAdminName(null)
    setCategories([])
    setProjects([])
    setJudges([])
    setAssignments([])
  }

  // ─── Judge actions ────────────────────────────────────────────────────────

  const addJudge = async (judge: Omit<Judge, 'id'>) => {
    const created = await api.createJudge(judge)
    setJudges(prev => [...prev, mapJudge(created)])
  }

  const updateJudge = async (id: number, updates: Partial<Judge>) => {
    const existing = judges.find(j => j.id === id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    const updated = await api.updateJudgeAPI(id, {
      name: merged.name,
      email: merged.email,
      accessCode: merged.accessCode,
      categoryId: merged.categoryId,
    })
    setJudges(prev => prev.map(j => (j.id === id ? mapJudge(updated) : j)))
  }

  const removeJudge = async (id: number) => {
    await api.deleteJudge(id)
    setJudges(prev => prev.filter(j => j.id !== id))
    setAssignments(prev => prev.filter(a => a.judgeId !== id))
  }

  // ─── Category actions ─────────────────────────────────────────────────────

  const addCategory = async (name: string) => {
    const created = await api.createCategory(name)
    setCategories(prev => [...prev, created])
  }

  const removeCategory = async (id: number) => {
    await api.deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
    // Projects in this category cascade-delete server-side.
    const removedProjectIds = new Set(projects.filter(p => p.categoryId === id).map(p => p.id))
    setProjects(prev => prev.filter(p => p.categoryId !== id))
    setAssignments(prev => prev.filter(a => !removedProjectIds.has(a.projectId)))
  }

  // ─── Project actions ──────────────────────────────────────────────────────

  const addProject = async (project: Omit<Project, 'id'>) => {
    const created = await api.createProject(project)
    setProjects(prev => [...prev, mapProject(created)])
  }

  const removeProject = async (id: number) => {
    await api.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setAssignments(prev => prev.filter(a => a.projectId !== id))
  }

  // ─── Assignment actions ───────────────────────────────────────────────────

  const assignProject = async (judgeId: number, projectId: number) => {
    await api.createAssignment(judgeId, projectId)
    setAssignments(prev =>
      prev.some(a => a.judgeId === judgeId && a.projectId === projectId)
        ? prev
        : [...prev, { judgeId, projectId }]
    )
  }

  const unassignProject = async (judgeId: number, projectId: number) => {
    await api.deleteAssignment(judgeId, projectId)
    setAssignments(prev => prev.filter(a => !(a.judgeId === judgeId && a.projectId === projectId)))
  }

  const autoAssignCategory = async (categoryId: number, minJudgesPerProject = 2) => {
    await api.autoAssignCategoryAPI(categoryId, minJudgesPerProject)
    const fresh = await api.getAssignments()
    setAssignments(fresh.map(mapAssignment))
  }

  const getProjectsForJudge = (judgeId: number): Project[] => {
    const assignedIds = assignments.filter(a => a.judgeId === judgeId).map(a => a.projectId)
    return projects.filter(p => assignedIds.includes(p.id))
  }

  const getJudgesForProject = (projectId: number): Judge[] => {
    const assignedIds = assignments.filter(a => a.projectId === projectId).map(a => a.judgeId)
    return judges.filter(j => assignedIds.includes(j.id))
  }

  return (
    <AdminContext.Provider value={{
      admin, adminName, adminLogin, adminLogout,
      loading, error,
      categories, projects, judges, assignments,
      refreshAll,
      addJudge, updateJudge, removeJudge,
      addCategory, removeCategory,
      addProject, removeProject,
      assignProject, unassignProject, autoAssignCategory,
      getProjectsForJudge, getJudgesForProject,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin(): AdminContextType {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
