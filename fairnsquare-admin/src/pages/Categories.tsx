import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import styles from './Categories.module.css'

export default function Categories() {
  const { categories, projects, addCategory, removeCategory, addProject, removeProject } = useAdmin()

  const [newCatName, setNewCatName] = useState('')
  const [catError, setCatError] = useState('')

  const [showProjectForm, setShowProjectForm] = useState<number | null>(null)
  const [projectForm, setProjectForm] = useState({ title: '', presenter: '', institution: '' })
  const [projectError, setProjectError] = useState('')

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setCatError('')
    if (!newCatName.trim()) { setCatError('Category name is required.'); return }
    try {
      await addCategory(newCatName.trim())
      setNewCatName('')
    } catch (err: any) {
      setCatError(err.message || 'Could not add category.')
    }
  }

  const handleAddProject = async (e: React.FormEvent, categoryId: number) => {
    e.preventDefault()
    setProjectError('')
    if (!projectForm.title.trim() || !projectForm.presenter.trim()) {
      setProjectError('Title and presenter are required.')
      return
    }
    try {
      await addProject({
        categoryId,
        title: projectForm.title.trim(),
        presenter: projectForm.presenter.trim(),
        institution: projectForm.institution.trim(),
      })
      setProjectForm({ title: '', presenter: '', institution: '' })
      setShowProjectForm(null)
    } catch (err: any) {
      setProjectError(err.message || 'Could not add project.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Categories & Projects</h2>
      </div>

      {/* Add category form */}
      <form className={styles.addCatForm} onSubmit={handleAddCategory}>
        <input
          className={styles.catInput}
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          placeholder="New category name..."
        />
        <button type="submit" className={styles.addCatBtn}>+ Add Category</button>
        {catError && <p className={styles.error}>{catError}</p>}
      </form>

      {/* Category cards */}
      {categories.map(cat => {
        const catProjects = projects.filter(p => p.categoryId === cat.id)
        return (
          <div key={cat.id} className={styles.catCard}>
            <div className={styles.catHeader}>
              <h3 className={styles.catName}>{cat.name}</h3>
              <div className={styles.catActions}>
                <span className={styles.projectCount}>{catProjects.length} projects</span>
                <button
                  className={styles.addProjectBtn}
                  onClick={() => { setShowProjectForm(cat.id); setProjectForm({ title: '', presenter: '', institution: '' }); setProjectError('') }}
                >
                  + Add Project
                </button>
                <button className={styles.removeCatBtn} onClick={() => removeCategory(cat.id).catch(err => alert(err.message || 'Remove failed.'))}>Remove</button>
              </div>
            </div>

            {/* Add project form */}
            {showProjectForm === cat.id && (
              <form className={styles.projectForm} onSubmit={e => handleAddProject(e, cat.id)}>
                <input className={styles.projectInput} placeholder="Project title" value={projectForm.title} onChange={e => setProjectForm(f => ({ ...f, title: e.target.value }))} />
                <input className={styles.projectInput} placeholder="Presenter name" value={projectForm.presenter} onChange={e => setProjectForm(f => ({ ...f, presenter: e.target.value }))} />
                <input className={styles.projectInput} placeholder="Institution" value={projectForm.institution} onChange={e => setProjectForm(f => ({ ...f, institution: e.target.value }))} />
                {projectError && <p className={styles.error}>{projectError}</p>}
                <div className={styles.projectFormActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setShowProjectForm(null)}>Cancel</button>
                  <button type="submit" className={styles.saveBtn}>Add Project</button>
                </div>
              </form>
            )}

            {/* Project list */}
            <div className={styles.projectList}>
              {catProjects.length === 0 && (
                <p className={styles.emptyProjects}>No projects in this category yet.</p>
              )}
              {catProjects.map(p => (
                <div key={p.id} className={styles.projectRow}>
                  <div>
                    <span className={styles.projectTitle}>{p.title}</span>
                    <span className={styles.projectMeta}>{p.presenter} · {p.institution}</span>
                  </div>
                  <button className={styles.removeProjectBtn} onClick={() => removeProject(p.id).catch(err => alert(err.message || 'Remove failed.'))}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {categories.length === 0 && (
        <div className={styles.empty}>No categories yet. Add one above.</div>
      )}
    </div>
  )
}
