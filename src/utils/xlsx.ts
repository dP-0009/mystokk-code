/**
 * Minimal .xlsx (OOXML) reader + writer for the bulk vendor import.
 *
 * We deliberately generate a *real* .xlsx (a zip of XML parts) rather than the
 * old SpreadsheetML-2003-as-.xls, which triggered Excel's "format and extension
 * don't match" warning on desktop and rendered as raw XML on mobile viewers.
 *
 * Only the sliver of the spec we need is implemented: inline strings, numbers,
 * a bold header style, and a per-column integer number format (so phone columns
 * never turn into 9.7E+11). fflate handles the zip/deflate both ways.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

export type XlsxColumnType = 'string' | 'number';

export interface XlsxSheetSpec {
  name: string;
  /** Header labels (bold, row 1). */
  header: string[];
  /** Data rows (strings; number-typed columns are emitted as numeric cells). */
  rows: string[][];
  /** 0-based columns to render as integers (numFmt "0") + widen. */
  numberColumns?: number[];
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Build a single-sheet .xlsx workbook as raw bytes. */
export function writeXlsx(spec: XlsxSheetSpec): Uint8Array {
  const numberCols = new Set(spec.numberColumns ?? []);

  const cols = [...numberCols]
    .sort((a, b) => a - b)
    .map((i) => `<col min="${i + 1}" max="${i + 1}" width="18" style="2" customWidth="1"/>`)
    .join('');

  const headerRow = row(1, spec.header.map((v, c) => cellInlineStr(colRef(c, 1), v, 1)));
  const dataRows = spec.rows
    .map((cells, r) => {
      const rowNum = r + 2; // row 1 is the header
      const body = cells
        .map((v, c) =>
          numberCols.has(c) && isPlainNumber(v)
            ? cellNumber(colRef(c, rowNum), v, 2)
            : cellInlineStr(colRef(c, rowNum), v),
        )
        .join('');
      return row(rowNum, [body]);
    })
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${
    cols ? `<cols>${cols}</cols>` : ''
  }<sheetData>${headerRow}${dataRows}</sheetData></worksheet>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    'xl/workbook.xml': strToU8(workbookXml(spec.name)),
    'xl/_rels/workbook.xml.rels': strToU8(WORKBOOK_RELS),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
  return zipSync(files);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// cellXfs: 0 = default, 1 = bold header, 2 = integer number format ("0", builtin numFmtId 1).
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function row(rowNum: number, cells: string[]): string {
  return `<row r="${rowNum}">${cells.join('')}</row>`;
}

function cellInlineStr(ref: string, value: string, styleId?: number): string {
  const s = styleId ? ` s="${styleId}"` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function cellNumber(ref: string, value: string, styleId: number): string {
  return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`;
}

/** A value we can safely emit as a numeric cell (no leading zeros / plus sign lost). */
function isPlainNumber(v: string): boolean {
  return /^[0-9]+$/.test(v) && !/^0\d/.test(v);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** True when the bytes are a zip container (all .xlsx files start with "PK"). */
export function isXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 1 && bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
}

/** Extract rows (arrays of cell strings) from the first worksheet of an .xlsx. */
export function readXlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const sheetKey =
    Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k)) ??
    Object.keys(files).find((k) => /^xl\/worksheets\/.*\.xml$/i.test(k));
  if (!sheetKey) return [];

  const sharedKey = Object.keys(files).find((k) => /^xl\/sharedStrings\.xml$/i.test(k));
  const shared = sharedKey ? parseSharedStrings(strFromU8(files[sharedKey])) : [];
  return parseSheet(strFromU8(files[sheetKey]), shared);
}

/** Concatenated text of every <si> entry in sharedStrings.xml. */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) out.push(collectText(m[1]));
  return out;
}

/** Sum of every <t>…</t> run inside a fragment (handles rich-text runs). */
function collectText(fragment: string): string {
  let text = '';
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(fragment)) !== null) text += xmlUnescape(m[1]);
  return text;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowM: RegExpExecArray | null;
  while ((rowM = rowRe.exec(xml)) !== null) {
    const cells: string[] = [];
    let col = 0;
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellM: RegExpExecArray | null;
    while ((cellM = cellRe.exec(rowM[1])) !== null) {
      const attrs = cellM[1] ?? '';
      const refM = /\br="([A-Z]+)\d+"/i.exec(attrs);
      if (refM) col = colIndex(refM[1]); // honor the explicit column (Excel omits blanks)
      cells[col] = cellValue(attrs, cellM[2] ?? '', shared);
      col++;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    rows.push(cells);
  }
  return rows;
}

function cellValue(attrs: string, body: string, shared: string[]): string {
  const t = /\bt="([^"]+)"/i.exec(attrs)?.[1] ?? 'n';
  if (t === 'inlineStr') return collectText(body);
  if (t === 's') {
    const idx = parseInt(vOf(body), 10);
    return Number.isInteger(idx) ? (shared[idx] ?? '') : '';
  }
  if (t === 'b') return vOf(body) === '1' ? 'TRUE' : 'FALSE';
  // "str" (formula string) and numbers both live in <v> verbatim.
  return vOf(body);
}

function vOf(body: string): string {
  const m = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body);
  return m ? xmlUnescape(m[1]) : '';
}

// ---------------------------------------------------------------------------
// Column-reference helpers (A -> 0, B -> 1, … AA -> 26)
// ---------------------------------------------------------------------------

function colRef(colIdx0: number, rowNum: number): string {
  return colLetter(colIdx0) + rowNum;
}

function colLetter(colIdx0: number): string {
  let n = colIdx0 + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colIndex(letters: string): number {
  let n = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) n = n * 26 + (up.charCodeAt(i) - 64);
  return n - 1;
}

// ---------------------------------------------------------------------------
// XML entity helpers
// ---------------------------------------------------------------------------

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
