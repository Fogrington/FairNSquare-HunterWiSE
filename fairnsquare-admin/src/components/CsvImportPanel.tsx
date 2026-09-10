import { useState, ReactNode } from 'react'
import { csvToRecords, CSVRecord, downloadCSV, rowsToCSV } from '../utils/csv'
import styles from './CsvImportPanel.module.css'

export type ParsedCsvRow<T> = {
  label: string          // short human-readable identifier for the preview list (e.g. a name/title)
  detail?: string        // optional secondary line shown under the label
  payload: T | null      // transformed row ready to submit — null means "blocking error, skip this row"
  error?: string         // blocking issue — row will not be imported
  warning?: string       // non-blocking issue — row still imports, but flagged for review
}

type Props<T> = {
  title: string
  instructions: ReactNode
  templateHeaders: string[]
  templateExampleRow: (string | number)[]
  templateFilename: string
  parseRow: (record: CSVRecord, index: number) => ParsedCsvRow<T>
  onImportRow: (payload: T) => Promise<void>
  onDone: () => void
  onClose: () => void
}

export default function CsvImportPanel<T>({
  title, instructions, templateHeaders, templateExampleRow, templateFilename,
  parseRow, onImportRow, onDone, onClose,
}: Props<T>) {
  const [parsed, setParsed] = useState<ParsedCsvRow<T>[] | null>(null)
  const [fileError, setFileError] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: { label: string; error: string }[] } | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const records = csvToRecords(text)
        if (records.length === 0) {
          setFileError('No data rows found in that file — check it has a header row plus at least one row of data.')
          setParsed(null)
          return
        }
        setParsed(records.map((r, i) => parseRow(r, i)))
      } catch {
        setFileError('Could not read that file. Make sure it\u2019s a plain .csv file.')
        setParsed(null)
      }
    }
    reader.onerror = () => setFileError('Could not read that file.')
    reader.readAsText(file)
  }

  const validRows = parsed?.filter(r => r.payload !== null) ?? []
  const errorRows = parsed?.filter(r => r.error) ?? []
  const warnRows = parsed?.filter(r => r.warning && !r.error) ?? []

  const handleImport = async () => {
    if (validRows.length === 0) return
    setImporting(true)
    const failed: { label: string; error: string }[] = []
    let success = 0

    // Sequential, not Promise.all — keeps error attribution per-row clean
    // and avoids hammering the backend with dozens of simultaneous inserts.
    for (const row of validRows) {
      try {
        await onImportRow(row.payload as T)
        success++
      } catch (err: any) {
        failed.push({ label: row.label, error: err.message || 'Import failed' })
      }
    }

    setImporting(false)
    setResults({ success, failed })
    if (failed.length === 0) onDone()
  }

  const handleTemplate = () => {
    downloadCSV(templateFilename, rowsToCSV([templateHeaders, templateExampleRow]))
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.instructions}>
            {instructions}
            <div style={{ marginTop: 8 }}>
              <button className={styles.templateLink} onClick={handleTemplate}>
                Download a template CSV
              </button>
            </div>
          </div>

          <div className={styles.fileInputRow}>
            <input className={styles.fileInput} type="file" accept=".csv,text/csv" onChange={handleFile} />
          </div>

          {fileError && <p className={styles.rowIssueError}>{fileError}</p>}

          {parsed && (
            <>
              <div className={styles.summary}>
                <span className={styles.summaryValid}>{validRows.length} ready to import</span>
                {warnRows.length > 0 && <span className={styles.summaryWarn}>{warnRows.length} with warnings</span>}
                {errorRows.length > 0 && <span className={styles.summaryError}>{errorRows.length} skipped (errors)</span>}
              </div>

              <div className={styles.previewTable}>
                <div className={styles.previewHeaderRow}>
                  <span></span>
                  <span>Row</span>
                </div>
                <div className={styles.previewRows}>
                  {parsed.map((row, i) => (
                    <div key={i} className={styles.previewRow}>
                      <span className={row.error ? styles.statusError : row.warning ? styles.statusWarn : styles.statusOk}>
                        {row.error ? '✗' : row.warning ? '⚠' : '✓'}
                      </span>
                      <div>
                        <div className={styles.rowText}>{row.label}</div>
                        {row.detail && <div className={styles.rowMeta}>{row.detail}</div>}
                        {row.error && <div className={`${styles.rowIssue} ${styles.rowIssueError}`}>{row.error}</div>}
                        {row.warning && !row.error && <div className={`${styles.rowIssue} ${styles.rowIssueWarn}`}>{row.warning}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {results && (
            <div className={styles.resultsBox}>
              <strong>{results.success} imported successfully.</strong>
              {results.failed.length > 0 && (
                <>
                  <div style={{ marginTop: 6 }}>{results.failed.length} failed:</div>
                  <ul>
                    {results.failed.map((f, i) => <li key={i}>{f.label} — {f.error}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              className={styles.confirmBtn}
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
            >
              {importing ? 'Importing…' : `Import ${validRows.length} Row${validRows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
