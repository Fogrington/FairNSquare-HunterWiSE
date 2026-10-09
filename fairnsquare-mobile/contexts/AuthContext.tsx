import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  judgeLogin,
  getAssignedProjects,
  getCriteria,
  submitScore as apiSubmitScore,
  getJudgeScores,
  saveToken,
  clearToken,
  getToken,
  saveJudgeProfile,
  getStoredJudgeProfile,
  APIProject,
  APICriterion,
} from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Judge = {
  id: number;
  name: string;
  username: string;
  categoryId: number | null;
  categoryName: string | null;
};

export type Project = {
  id: number;
  categoryId: number;
  title: string;
  presenter: string;
  institution: string;
  description: string;
};

export type Criterion = {
  id: number;
  label: string;
  description: string;
  weight: number;
};

export type ScoreEntry = {
  projectId: number;
  criterionId: number;
  value: number;
};

type AuthContextType = {
  judge: Judge | null;
  projects: Project[];
  criteria: Criterion[];
  scores: ScoreEntry[];
  loading: boolean;
  restoring: boolean;
  error: string | null;
  login: (username: string, accessCode: string) => Promise<boolean>;
  logout: () => void;
  submitScore: (projectId: number, criterionId: number, value: number) => Promise<void>;
  getScoreFor: (projectId: number, criterionId: number) => number | null;
  getProjectsForJudge: () => Project[];
  isProjectComplete: (projectId: number) => boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapProject(p: APIProject): Project {
  return {
    id: p.id,
    categoryId: p.category_id,
    title: p.title,
    presenter: p.presenter,
    institution: p.institution,
    description: p.description,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [judge, setJudge] = useState<Judge | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetches everything a logged-in judge needs: their assigned projects,
  // the scoring criteria, and any scores they've already submitted
  // (so re-opening the app mid-event doesn't lose their progress).
  const loadJudgeData = async () => {
    const [rawProjects, rawCriteria, rawScores] = await Promise.all([
      getAssignedProjects(),
      getCriteria(),
      getJudgeScores(),
    ]);

    setProjects(rawProjects.map(mapProject));
    setCriteria(rawCriteria);
    setScores(rawScores.map(s => ({
      projectId: s.project_id,
      criterionId: s.criterion_id,
      value: s.value,
    })));
  };

  // On mount — restore session if a token + saved judge profile exist
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const storedJudge = await getStoredJudgeProfile();
        if (!token || !storedJudge) return;

        setJudge(storedJudge);
        await loadJudgeData();
      } catch (err) {
        // Token expired/invalid, or the server rejected a request —
        // fall back to a clean logged-out state.
        await clearToken();
        setJudge(null);
        setProjects([]);
        setCriteria([]);
        setScores([]);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const login = async (username: string, accessCode: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await judgeLogin(username, accessCode);
      await saveToken(res.token);
      await saveJudgeProfile(res.judge);
      setJudge(res.judge);
      await loadJudgeData();
      return true;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await clearToken();
    setJudge(null);
    setProjects([]);
    setScores([]);
  };

  const submitScore = async (
    projectId: number,
    criterionId: number,
    value: number
  ) => {
    // Optimistic local update first for instant UI response
    setScores(prev => {
      const filtered = prev.filter(
        s => !(s.projectId === projectId && s.criterionId === criterionId)
      );
      return [...filtered, { projectId, criterionId, value }];
    });
    // Then persist to backend
    try {
      await apiSubmitScore(projectId, criterionId, value);
    } catch (err) {
      console.error('Failed to submit score to backend:', err);
      // Score still saved locally — will need sync when backend available
    }
  };

  const getScoreFor = (projectId: number, criterionId: number): number | null => {
    const entry = scores.find(
      s => s.projectId === projectId && s.criterionId === criterionId
    );
    return entry ? entry.value : null;
  };

  const getProjectsForJudge = (): Project[] => projects;

  const isProjectComplete = (projectId: number): boolean =>
    criteria.every(c => getScoreFor(projectId, c.id) !== null);

  return (
    <AuthContext.Provider value={{
      judge, projects, criteria, scores,
      loading, restoring, error,
      login, logout,
      submitScore, getScoreFor,
      getProjectsForJudge, isProjectComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Keep SCORING_CRITERIA export for any screens that still reference it
// Will be replaced by live criteria from DB
export const SCORING_CRITERIA = [
  { id: 1, label: 'Innovation', description: 'Originality and novelty of the approach', weight: 0.3 },
  { id: 2, label: 'Technical Merit', description: 'Soundness of methodology and execution', weight: 0.3 },
  { id: 3, label: 'Impact', description: 'Potential real-world benefit and scalability', weight: 0.25 },
  { id: 4, label: 'Presentation', description: 'Clarity and professionalism of delivery', weight: 0.15 },
];