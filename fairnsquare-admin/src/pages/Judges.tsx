import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import CsvImportPanel, { ParsedCsvRow } from '../components/CsvImportPanel'
import { CSVRecord } from '../utils/csv'
import styles from './Judges.module.css'

// Judges log in with a username, not an email — we never contact them, so we
// don't collect one. Format matches the backend rule: lowercase letters/digits
// separated by . _ or -   e.g. "Sarah Chen" → sarah.chen
const USERNAME_RE = /^[a-z0-9]+([._-][a-z0-9]+)*$/

function suggestUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // é → e
    .replace(/[^a-z0-9]+/g, '.')                          // spaces/punctuation → .
    .replace(/^\.+|\.+$/g, '')                           // trim stray dots
    .slice(0, 50)
}

export default function Judges() {
  const {
    judges, categories, projects,
    addJudge, updateJudge, removeJudge,
    assignments, assignProject, unassignProject, autoAssignCategory,
    getProjectsForJudge,
  } = useAdmin()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', username: '', accessCode: '', categoryId: '' })
  // Once the admin edits the username by hand, stop auto-filling it from the name
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [formError, setFormError] = useState('')

  // Which judge's assignment panel is expanded
  const [expandedJudge, setExpandedJudge] = useState<number | null>(null)

  const resetForm = () => {
    setForm({ name: '', username: '', accessCode: '', categoryId: '' })
    setUsernameTouched(false)
    setFormError('')
    setShowForm(false)
    setEditingId(null)
  }

  const handleEdit = (judge: typeof judges[0]) => {
    setForm({
      name: judge.name,
      username: judge.username,
      accessCode: judge.accessCode,
      categoryId: judge.categoryId?.toString() ?? '',
    })
    setUsernameTouched(true)   // keep an existing judge's username unless deliberately changed
    setEditingId(judge.id)
    setShowForm(true)
  }

  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)

  type JudgeImportPayload = { name: string; username: string; accessCode: string; categoryId: number | null }

  const parseJudgeRow = (record: CSVRecord, index: number): ParsedCsvRow<JudgeImportPayload> => {
    const name = record.get('Name', 'Judge Name', 'Full Name')
    // Username column is optional — if blank, generate one from the name
    const username = (record.get('Username', 'User Name', 'Login') || suggestUsername(name)).trim().toLowerCase()
    const accessCode = record.get('AccessCode', 'Access Code', 'Code')
    const categoryName = record.get('Category', 'Category Name')

    if (!name) return { label: `Row ${index + 2}`, payload: null, error: 'Missing name.' }
    if (!USERNAME_RE.test(username)) return { label: name, payload: null, error: `Invalid username "${username}" — use lowercase letters, numbers and . _ - (e.g. sarah.chen).` }
    if (!/^\d{4}$/.test(accessCode)) return { label: name, payload: null, error: 'Access code must be exactly 4 digits.' }

    let categoryId: number | null = null
    let warning: string | undefined

    if (categoryName) {
      const match = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
      if (match) categoryId = match.id
      else warning = `Category "${categoryName}" not found — will import without a category.`
    }

    if (judges.some(j => j.username === username)) {
      warning = (warning ? warning + ' Also: ' : '') + `username "${username}" is already taken — import will fail. Add a Username column to set a different one.`
    }

    return {
      label: name,
      detail: `${username} · code ${accessCode}${categoryName ? ' · ' + categoryName : ''}`,
      payload: { name, username, accessCode, categoryId },
      warning,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const username = form.username.trim().toLowerCase()
    if (!form.name.trim() || !username || !form.accessCode.trim()) {
      setFormError('Name, username and access code are required.'); return
    }
    if (!USERNAME_RE.test(username)) {
      setFormError('Username can only use lowercase letters, numbers and . _ - (e.g. sarah.chen).'); return
    }
    if (form.accessCode.length !== 4 || !/^\d+$/.test(form.accessCode)) {
      setFormError('Access code must be exactly 4 digits.'); return
    }
    const payload = {
      name: form.name.trim(),
      username,
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
              Columns: <code>Name</code>, <code>AccessCode</code> (4 digits), and optionally <code>Username</code>{' '}
              (generated from the name if left blank, e.g. Sarah Chen → sarah.chen) and{' '}
              <code>Category</code> (must match an existing category name exactly).
            </>
          }
          templateHeaders={['Name', 'Username', 'AccessCode', 'Category']}
          templateExampleRow={['Sarah Chen', 'sarah.chen', '1234', categories[0]?.name ?? 'STEM']}
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
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value
                    setForm(f => ({ ...f, name, username: usernameTouched ? f.username : suggestUsername(name) }))
                  }}
                  placeholder="Jane Smith"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Username</label>
                <input
                  className={styles.input}
                  value={form.username}
                  onChange={e => { setUsernameTouched(true); setForm(f => ({ ...f, username: e.target.value.toLowerCase() })) }}
                  placeholder="jane.smith"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
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
          <span>Username</span>
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
                <span className={styles.muted}>{judge.username}</span>
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
