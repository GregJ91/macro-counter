// Converts the UK government's Composition of Foods Integrated Dataset (CoFID, McCance &
// Widdowson's) into src/data/cofid.json, which the app picks up automatically.
//
// 1. Download the CoFID Excel file from
//    https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
// 2. npm run import:cofid -- path/to/CoFID.xlsx
//
// CoFID is published under the Open Government Licence v3.0.
import { readFileSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:cofid -- path/to/CoFID.xlsx');
  process.exit(1);
}
const wb = XLSX.read(readFileSync(file));

/** Rows of a sheet whose name matches `re`, keyed by the header row (found by its "Food Code" cell). */
function sheetRows(re) {
  const name = wb.SheetNames.find((n) => re.test(n));
  if (!name) return [];
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  const h = grid.findIndex((r) => r.some((c) => typeof c === 'string' && /food code/i.test(c)));
  const headers = grid[h].map((c) => String(c ?? '').trim());
  return grid.slice(h + 1).map((r) => Object.fromEntries(headers.map((k, i) => [k, r[i]])));
}

const pick = (row, ...patterns) => {
  for (const re of patterns) {
    const key = Object.keys(row).find((k) => re.test(k));
    if (key !== undefined) {
      const v = row[key];
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : 0; // "Tr" (trace) and "N" (not measured) become 0
    }
  }
  return 0;
};

const proximates = sheetRows(/proximates/i);
const inorganics = new Map(sheetRows(/inorganics/i).map((r) => [r['Food Code'], r]));
const fats = new Map(sheetRows(/(fatty acids|^1\.6)/i).map((r) => [r['Food Code'], r]));
if (!proximates.length) {
  console.error('Could not find the Proximates sheet — is this the CoFID workbook?');
  process.exit(1);
}

const foods = [];
for (const r of proximates) {
  const code = r['Food Code'];
  const name = r['Food Name'];
  if (!code || !name) continue;
  const kcal = pick(r, /energy.*kcal/i);
  if (!kcal) continue;
  const sodiumMg = pick(inorganics.get(code) ?? {}, /^sodium/i);
  const fa = fats.get(code) ?? {};
  foods.push({
    id: `cofid:${code}`,
    name: String(name).trim(),
    source: 'cofid',
    per100: {
      kcal,
      protein: pick(r, /^protein/i),
      carbs: pick(r, /^carbohydrate/i),
      sugars: pick(r, /total sugars/i),
      fat: pick(r, /^fat/i),
      satFat: pick(fa, /satd fa.*\/100\s*g\s*food/i, /satd fa/i),
      fibre: pick(r, /aoac fibre/i, /nsp/i),
      salt: Math.round(((sodiumMg * 2.5) / 1000) * 100) / 100,
    },
    servings: [{ label: '100 g', grams: 100 }],
  });
}

writeFileSync(new URL('../src/data/cofid.json', import.meta.url), JSON.stringify(foods));
console.log(`Wrote ${foods.length} CoFID foods to src/data/cofid.json`);
