/**
 * CSV helpers for the bulk vendor import (Build Guide §6.5 / Step 20).
 *
 * The downloadable template is a 12-column sheet covering every vendor field.
 * On import, the columns that map to manual_vendors are persisted; the rest are
 * accepted so existing CRM exports paste in cleanly. Dedupe + auto-connect
 * happen server-side in the bulk_import_vendors RPC.
 */

export const CSV_COLUMNS = [
  'company_name',
  'contact_person',
  'designation',
  'email',
  'mobile_number',
  'whatsapp_number',
  'industry',
  'category',
  'country',
  'city',
  'group_name',
  'notes',
] as const;

/** A header row + one example row so non-technical users see the expected shape. */
export function buildTemplateCsv(): string {
  const example = [
    'Spinneys Distribution',
    'Rajesh Kumar',
    'Procurement Lead',
    'rajesh@spinneys.example',
    '+971 50 000 0000',
    '+971 50 000 0000',
    'Retail',
    'Food & Beverage',
    'United Arab Emirates',
    'Dubai',
    'Suppliers UAE',
    'Met at Gulfood 2026',
  ];
  return `${CSV_COLUMNS.join(',')}\n${example.map(csvCell).join(',')}\n`;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Parse CSV text into objects keyed by the (lower-cased, trimmed) header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = tokenize(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const out: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip fully blank lines.
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = (cells[idx] ?? '').trim();
    });
    out.push(obj);
  }
  return out;
}

/** RFC-4180-ish tokenizer: handles quoted fields, embedded commas/newlines, "" escapes. */
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      // Treat \r, \n, and \r\n as a single row break.
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // Flush the trailing field/row if the file didn't end on a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
