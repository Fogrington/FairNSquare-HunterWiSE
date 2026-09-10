import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import CsvImportPanel, { ParsedCsvRow } from '../components/CsvImportPanel'
import { CSVRecord } from '../utils/csv'
import styles from './Judges.module.css'

export default function Judges() {
  const {
    judges, categories, projects,
    addJudge, updateJudge, removeJudge,
    assignments, assignProject, unassignProject, autoAssignCategory,
    getProjectsForJudge,
  } = useAdmin()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', email: '', accessCode: '', categoryId: '' })
  const [formError, setFormError] = useState('')

  // Which judge's assignment panel is expanded
  const [expandedJudge, setExpandedJudge] = useState<number | null>(null)

  const resetForm = () => {
    setForm({ name: '', email: '', accessCode: '', categoryId: '' })
    setFormError('')
    setShowForm(false)
    setEditingId(null)
  }

  const handleEdit = (judge: typeof judges[0]) => {
    setForm({
      name: judge.name,
      email: judge.email,
      accessCode: judge.accessCode,
      categoryId: judge.categoryId?.toString() ?? '',
    })
    setEditingId(judge.id)
    setShowForm(true)
  }

  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)

  type JudgeImportPayload = { name: string; email: string; accessCode: string; categoryId: number | null }

  const parseJudgeRow = (record: CSVRecord, index: number): ParsedCsvRow<JudgeImportPayload> => {
    const name = record.get('Name', 'Judge Name', 'Full Name')
    const email = record.get('Email', 'Email Address')
    const accessCode = record.get('AccessCode', 'Access Code', 'Code')
    const categoryName = record.get('Category', 'Category Name')

    if (!name) return { label: `Row ${index + 2}`, payload: null, error: 'Missing name.' }
    if (!email || !email.includes('@')) return { label: name, payload: null, error: 'Missing or invalid email.' }
    if (!/^\d{4}$/.test(accessCode)) return { label: name, payload: null, error: 'Access code must be exactly 4 digits.' }

    let categoryId: number | null = null
    let warning: string | undefined

    if (categoryName) {
      const match = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
      if (match) categoryId = match.id
      else warning = `Category "${categoryName}" not found — will import without a category.`
    }

    if (judges.some(j => j.email.toLowerCase() === email.toLowerCase())) {
      warning = (warning ? warning + ' Also: ' : '') + 'a judge with this email already exists — import will likely fail.'
    }

    return {
      label: name,
      detail: `${email} · code ${accessCode}${categoryName ? ' · ' + categoryName : ''}`,
      payload: { name, email, accessCode, categoryId },
      warning,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim() || !form.email.trim() || !form.accessCode.trim()) {
      setFormError('Name, email and access code are required.'); return
    }
    if (form.accessCode.length !== 4 || !/^\d+$/.test(form.accessCode)) {
      setFormError('Access code must be exactly 4 digits.'); return
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      accessCode: form.accessCode,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    }
    setSaving(true)
    try {
      editingId !== null ? await updateJudge(editingId, payload) : await addJudge(payload)
      resetForm()
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Judges</h2>
        <div className={styles.headerBtns}>
          <button className={styles.importBtn} onClick={() => setShowImport(true)}>
            Import CSV
          </button>
          <button className={styles.addBtn} onClick={() => { resetForm(); setShowForm(true) }}>
            + Add Judge
          </button>
        </div>
      </div>

      {showImport && (
        <CsvImportPanel<JudgeImportPayload>
          title="Import Judges from CSV"
          instructions={
            <>
              Columns: <code>Name</code>, <code>Email</code>, <code>AccessCode</code> (4 digits), and optionally{' '}
              <code>Category</code> (must match an existing category name exactly).
            </>
          }
          templateHeaders={['Name', 'Email', 'AccessCode', 'Category']}
          templateExampleRow={['Sarah Chen', 'sarah.chen@hunterwise.org', '1234', categories[0]?.name ?? 'STEM']}
          templateFilename="fairn2-judges-template.csv"
          parseRow={parseJudgeRow}
          onImportRow={addJudge}
          onDone={() => {}}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Auto-assign section */}
      <div className={styles.autoAssignCard}>
        <div className={styles.autoAssignInfo}>
          <span className={styles.autoAssignTitle}>Auto-Assign Projects</span>
          <span className={styles.autoAssignSub}>
            Distributes projects across judges in each category — minimum 2 judges per project, balanced load.
          </span>
        </div>
        <div className={styles.autoAssignBtns}>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={styles.autoBtn}
              onClick={() => autoAssignCategory(cat.id, 2).catch(err => alert(err.message || 'Auto-assign failed.'))}
            >
              Auto-assign: {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className={styles.formCard}>
          <h3 className={styles.formTitle}>{editingId ? 'Edit Judge' : 'Add New Judge'}</h3>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@org.com" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Access Code (4 digits)</label>
                <input className={styles.input} value={form.accessCode} onChange={e => setForm(f => ({ ...f, accessCode: e.target.value }))} placeholder="1234" maxLength={4} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Category (grouping)</label>
                <select className={styles.input} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">— Unassigned —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={resetForm}>Cancel</button>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Judge'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Judge list */}
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Name</span>
          <span>Email</span>
          <span>Code</span>
          <span>Category</span>
          <span>Assigned</span>
          <span>Actions</span>
        </div>

        {judges.map(judge => {
          const cat = categories.find(c => c.id === judge.categoryId)
          const assignedProjects = getProjectsForJudge(judge.id)
          const isExpanded = expandedJudge === judge.id
          // Projects in judge's category not yet assigned to them
          const catProjects = judge.categoryId
            ? projects.filter(p => p.categoryId === judge.categoryId)
            : projects
          const unassigned = catProjects.filter(
            p => !assignments.some(a => a.judgeId === judge.id && a.projectId === p.id)
          )

          return (
            <div key={judge.id}>
              <div className={styles.tableRow}>
                <span className={styles.judgeName}>{judge.name}</span>
                <span className={styles.muted}>{judge.email}</span>
                <span className={styles.code}>{judge.accessCode}</span>
                <span>
                  {cat
                    ? <span className={styles.catBadge}>{cat.name}</span>
                    : <span className={styles.unassigned}>None</span>
                  }
                </span>
                <span>
                  <button
                    className={styles.assignCountBtn}
                    onClick={() => setExpandedJudge(isExpanded ? null : judge.id)}
                  >
                    {assignedProjects.length} project{assignedProjects.length !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                  </button>
                </span>
                <span className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => handleEdit(judge)}>Edit</button>
                  <button className={styles.removeBtn} onClick={() => removeJudge(judge.id).catch(err => alert(err.message || 'Remove failed.'))}>Remove</button>
                </span>
              </div>

              {/* Expanded assignment panel */}
              {isExpanded && (
                <div className={styles.assignPanel}>
                  <div className={styles.assignColumns}>
                    {/* Assigned projects */}
                    <div className={styles.assignCol}>
                      <p className={styles.assignColTitle}>Assigned ({assignedProjects.length})</p>
                      {assignedProjects.length === 0 && (
                        <p className={styles.assignEmpty}>No projects assigned yet.</p>
                      )}
                      {assignedProjects.map(p => (
                        <div key={p.id} className={styles.assignRow}>
                          <span className={styles.assignProjectName}>{p.title}</span>
                          <button
                            className={styles.unassignBtn}
                            onClick={() => unassignProject(judge.id, p.id).catch(err => alert(err.message || 'Unassign failed.'))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Available to add */}
                    <div className={styles.assignCol}>
                      <p className={styles.assignColTitle}>Available to add ({unassigned.length})</p>
                      {unassigned.length === 0 && (
                        <p className={styles.assignEmpty}>All category projects assigned.</p>
                      )}
                      {unassigned.map(p => (
                        <div key={p.id} className={styles.assignRow}>
                          <span className={styles.assignProjectName}>{p.title}</span>
                          <button
                            className={styles.addAssignBtn}
                            onClick={() => assignProject(judge.id, p.id).catch(err => alert(err.message || 'Assign failed.'))}
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {judges.length === 0 && (
          <div className={styles.empty}>No judges added yet.</div>
        )}
      </div>
    </div>
  )
}
