/**
 * A small CSV reader for PokéAPI's data files: comma-separated, with quoted
 * fields that may contain commas, quotes ("") and line breaks.
 */
export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (inQuotes) {
      if (ch === 34 /* " */) {
        if (text.charCodeAt(i + 1) === 34) {
          field += text.slice(start, i + 1);
          i++;
          start = i + 1;
        } else {
          field += text.slice(start, i);
          inQuotes = false;
          start = i + 1;
        }
      }
      continue;
    }
    if (ch === 34) {
      field += text.slice(start, i);
      inQuotes = true;
      start = i + 1;
    } else if (ch === 44 /* , */) {
      row.push(field + text.slice(start, i));
      field = '';
      start = i + 1;
    } else if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      row.push(field + text.slice(start, i));
      field = '';
      rows.push(row);
      row = [];
      if (ch === 13 && text.charCodeAt(i + 1) === 10) i++;
      start = i + 1;
    }
  }
  const last = field + text.slice(start);
  if (last !== '' || row.length > 0) {
    row.push(last);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => !(r.length === 1 && r[0] === ''));
  if (!header) return [];
  return body.map((values) => {
    const record: CsvRow = {};
    header.forEach((name, index) => {
      record[name] = values[index] ?? '';
    });
    return record;
  });
}

/** Parses an integer column; empty or invalid values give 0. */
export function int(value: string | undefined): number {
  return intOrNull(value) ?? 0;
}

/** Parses an integer column; empty or invalid values give null. */
export function intOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}
