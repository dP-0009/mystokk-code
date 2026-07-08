/**
 * CSV helpers for the bulk vendor import (Build Guide §6.5 / Step 20).
 *
 * The downloadable template is a 12-column sheet covering every vendor field.
 * On import, the columns that map to manual_vendors are persisted; the rest are
 * accepted so existing CRM exports paste in cleanly. Dedupe + auto-connect
 * happen server-side in the bulk_import_vendors RPC.
 */

import { writeXlsx, readXlsxRows, isXlsx } from './xlsx';

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

/** One filled example row (aligned to CSV_COLUMNS) shown in every template. */
export const TEMPLATE_EXAMPLE_ROW = [
  'Spinneys Distribution',
  'Rajesh Kumar',
  'Procurement Lead',
  'rajesh@spinneys.example',
  '971500000000',
  '971500000000',
  'Retail',
  'Food & Beverage',
  'United Arab Emirates',
  'Dubai',
  'Suppliers UAE',
  'Met at Gulfood 2026',
];

/** A header row + one example row so non-technical users see the expected shape. */
export function buildTemplateCsv(): string {
  return `${CSV_COLUMNS.join(',')}\n${TEMPLATE_EXAMPLE_ROW.map(csvCell).join(',')}\n`;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** The CSV columns that hold phone numbers (normalized on import). */
const PHONE_COLUMNS = ['mobile_number', 'whatsapp_number'] as const;

/**
 * Undo the way spreadsheets mangle long phone numbers in a General/Number cell:
 * scientific notation ("9.71505E+11") or an appended decimal ("97152005410.00").
 * When the value is a plain number we re-render it as a full integer; a human-
 * typed string like "+971 50 000 0000" is left exactly as entered. This is why
 * users don't have to fix cell formats — whatever the sheet exports imports clean.
 */
export function normalizePhoneNumber(raw: string): string {
  const s = (raw ?? '').trim();
  if (s === '') return '';
  // Pure number, optionally in scientific notation or with a trailing decimal.
  if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && Number.isInteger(n)) {
      // 9.71505E+11 -> "971505000000", 97152005410.00 -> "97152005410"
      return BigInt(n).toString();
    }
  }
  return s;
}

/**
 * Parse an uploaded vendor file. Accepts either a CSV or the SpreadsheetML
 * (.xls) workbook our own template downloads as, so the user can fill the
 * template in Excel and upload it directly OR save-as CSV — both work.
 */
export function parseSpreadsheet(text: string): Record<string, string>[] {
  const looksLikeXml = /urn:schemas-microsoft-com:office:spreadsheet/i.test(text) || /<Workbook[\s>]/i.test(text);
  return rowsToVendorObjects(looksLikeXml ? spreadsheetMlRows(text) : tokenize(text, detectDelimiter(text)));
}

/** Parse CSV text into objects keyed by the (lower-cased, trimmed) header row. */
export function parseCsv(text: string): Record<string, string>[] {
  return rowsToVendorObjects(tokenize(text, detectDelimiter(text)));
}

/**
 * Pick the delimiter Excel used. "CSV (Comma delimited)" uses commas, but Excel
 * in many locales exports "CSV" with semicolons, and some exports use tabs. We
 * sniff the header line and choose whichever separator appears most — so a plain
 * CSV, a CSV UTF-8, and a locale/semicolon export all import the same way.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, '').split(/\r\n|\r|\n/, 1)[0] ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const best = (Object.keys(counts) as string[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[best] > 0 ? best : ',';
}

/** Map a header row + data rows into objects, repairing phone columns. */
function rowsToVendorObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const out: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip fully blank lines.
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      const value = (cells[idx] ?? '').trim();
      // Repair spreadsheet-mangled phone numbers (scientific notation / ".00").
      obj[key] = (PHONE_COLUMNS as readonly string[]).includes(key) ? normalizePhoneNumber(value) : value;
    });
    out.push(obj);
  }
  return out;
}

/** RFC-4180-ish tokenizer: handles quoted fields, embedded delimiters/newlines, "" escapes. */
function tokenize(text: string, delimiter = ','): string[][] {
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
    } else if (ch === delimiter) {
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

// ---------------------------------------------------------------------------
// Excel template (real .xlsx / OOXML)
//
// A plain CSV can't carry cell formatting, so a 12-digit number typed into a
// "General" column shows up as "9.7E+11". This template ships the two phone
// columns with a real integer Number format ("0") via a per-COLUMN style, which
// Excel also applies to the cells the user types in — so their numbers stay full
// and plain without anyone touching the format.
//
// We emit a genuine .xlsx (see ./xlsx), NOT SpreadsheetML-2003-as-.xls: the old
// format made desktop Excel warn "format and extension don't match" and made
// mobile viewers render the raw XML. parseVendorFile() reads the filled .xlsx
// (or a CSV, or an old .xls) straight back on upload.
// ---------------------------------------------------------------------------

/** 0-based indexes of the phone columns within CSV_COLUMNS. */
const PHONE_COLUMN_INDEXES = CSV_COLUMNS.reduce<number[]>((acc, c, i) => {
  if ((PHONE_COLUMNS as readonly string[]).includes(c)) acc.push(i);
  return acc;
}, []);

export const TEMPLATE_FILENAME = 'mystokk-vendors-template.xlsx';
export const TEMPLATE_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Build the downloadable Excel template as real .xlsx bytes. */
export function buildTemplateXlsx(): Uint8Array {
  return writeXlsx({
    name: 'Vendors',
    header: [...CSV_COLUMNS],
    rows: [TEMPLATE_EXAMPLE_ROW],
    numberColumns: PHONE_COLUMN_INDEXES,
  });
}

/**
 * Parse an uploaded vendor file from its raw bytes. Handles a filled .xlsx
 * (zip), the legacy SpreadsheetML .xls, or a CSV (e.g. saved-as from Excel) —
 * so whatever the user uploads imports clean.
 */
export function parseVendorFile(bytes: Uint8Array): Record<string, string>[] {
  if (isXlsx(bytes)) return rowsToVendorObjects(readXlsxRows(bytes));
  // Everything else is text (CSV or SpreadsheetML); decode and strip any BOM.
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  return parseSpreadsheet(text);
}

/** Extract rows (arrays of cell strings) from a SpreadsheetML 2003 workbook. */
function spreadsheetMlRows(xml: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowM: RegExpExecArray | null;
  while ((rowM = rowRe.exec(xml)) !== null) {
    const inner = rowM[1];
    const cells: string[] = [];
    let col = 0;
    // Match either <Cell ...>...</Cell> or a self-closing <Cell .../>.
    const cellRe = /<Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Cell>)/gi;
    let cellM: RegExpExecArray | null;
    while ((cellM = cellRe.exec(inner)) !== null) {
      const attrs = cellM[1] ?? '';
      const idxM = /ss:Index="(\d+)"/i.exec(attrs);
      if (idxM) col = parseInt(idxM[1], 10) - 1; // jump to the explicit (1-based) column
      const body = cellM[2] ?? '';
      const dataM = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(body);
      cells[col] = dataM ? xmlUnescape(dataM[1]) : '';
      col++;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    rows.push(cells);
  }
  return rows;
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}
