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
    '971500000000',
    '971500000000',
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
  return rowsToVendorObjects(looksLikeXml ? spreadsheetMlRows(text) : tokenize(text));
}

/** Parse CSV text into objects keyed by the (lower-cased, trimmed) header row. */
export function parseCsv(text: string): Record<string, string>[] {
  return rowsToVendorObjects(tokenize(text));
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

// ---------------------------------------------------------------------------
// Excel template (SpreadsheetML 2003 .xls)
//
// A plain CSV can't carry cell formatting, so a 12-digit number typed into a
// "General" column shows up as "9.7E+11". This template ships the two phone
// columns as a real Number format ("0") via a per-COLUMN style, which Excel
// also applies to the cells the user types in — so their numbers stay full and
// plain without anyone touching the format. Downloaded as .xls; Excel opens it
// natively, and parseSpreadsheet() reads it (or a CSV) straight back on upload.
// ---------------------------------------------------------------------------

/** 0-based indexes of the phone columns within CSV_COLUMNS. */
const PHONE_COLUMN_INDEXES = CSV_COLUMNS.reduce<number[]>((acc, c, i) => {
  if ((PHONE_COLUMNS as readonly string[]).includes(c)) acc.push(i);
  return acc;
}, []);

export const TEMPLATE_FILENAME = 'mystokk-vendors-template.xls';
export const TEMPLATE_MIME = 'application/vnd.ms-excel';

/** Build the downloadable Excel template (SpreadsheetML 2003 XML). */
export function buildTemplateXls(): string {
  const example = [
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

  const headerCells = CSV_COLUMNS.map(
    (c) => `<Cell ss:StyleID="sHdr"><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`,
  ).join('');
  const sampleCells = example
    .map((v, i) =>
      PHONE_COLUMN_INDEXES.includes(i)
        ? `<Cell ss:StyleID="sNum"><Data ss:Type="Number">${v}</Data></Cell>`
        : `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`,
    )
    .join('');
  // Number-format the whole phone columns (1-based ss:Index) so user entries stay plain.
  const columns = PHONE_COLUMN_INDEXES.map(
    (i) => `<Column ss:Index="${i + 1}" ss:StyleID="sNum" ss:Width="120"/>`,
  ).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="sHdr"><Font ss:Bold="1"/></Style>
  <Style ss:ID="sNum"><NumberFormat ss:Format="0"/></Style>
 </Styles>
 <Worksheet ss:Name="Vendors">
  <Table>
   ${columns}
   <Row>${headerCells}</Row>
   <Row>${sampleCells}</Row>
  </Table>
 </Worksheet>
</Workbook>`;
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

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
