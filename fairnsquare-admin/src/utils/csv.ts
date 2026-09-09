// Minimal CSV helpers — no library needed for something this small,
// and it keeps the bundle light for what's meant to be a quick export.

// Wrap a field in quotes if it contains a comma, quote, or newline,
// and double up any internal quotes per CSV convention.
function escapeCell(value: string | number): string {
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function rowsToCSV(rows: (string | number)[][]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n')
}

// Triggers a browser download of the given CSV text.
export function downloadCSV(filename: string, csvContent: string) {
  // Leading BOM so Excel (Windows especially) opens it as UTF-8
  // instead of mis-rendering special characters like é, —, etc.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function todayStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
