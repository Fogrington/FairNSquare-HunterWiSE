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

/**
 * One parsed CSV row. Use get() with one or more accepted header names —
 * matching ignores case, spaces, underscores and hyphens, so
 * get('AccessCode', 'Access Code') matches "access code", "ACCESS_CODE", etc.
 * Returns '' if none of the headers are present.
 */
export type CSVRecord = {
  get: (...headerNames: string[]) => string
  raw: Record<string, string>
}

const normHeader = (h: string) => h.toLowerCase().replace(/[\s_-]+/g, '')

/**
 * Parse CSV text into an array of records keyed by header row.
 * Handles quoted fields, escaped quotes (""), commas/newlines inside quotes,
 * CRLF line endings, and a leading UTF-8 BOM (e.g. from Excel).
 */

export function csvToRecords(text: string): CSVRecord[] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ''));
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0].map(h => h.trim());
  return nonEmpty.slice(1).map(r => {
    const raw: Record<string, string> = Object.fromEntries(
      headers.map((h, idx) => [h, (r[idx] ?? '').trim()])
    );
    const byNorm = new Map(headers.map((h, idx) => [normHeader(h), (r[idx] ?? '').trim()]));
    return {
      raw,
      get: (...headerNames: string[]) => {
        for (const name of headerNames) {
          const v = byNorm.get(normHeader(name));
          if (v !== undefined && v !== '') return v;
        }
        return '';
      },
    };
  });
}