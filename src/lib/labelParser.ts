import { energyFromMacros } from './foodQuality';
import type { Nutrients } from './types';

/**
 * Parse OCR text from a UK/EU nutrition table ("Typical values per 100g | per serving").
 * Returns per-100 g values where found; the caller always shows them for the user to confirm.
 */
export interface ParsedLabel {
  per100: Partial<Nutrients>;
  servingG: number | null;
  /** Which column we read: per 100 g, or per serving scaled up using the serving size. */
  basis: 'per100' | 'perServing' | 'unknown';
  found: (keyof Nutrients)[];
  /** Calories couldn't be read reliably, so they were worked out from protein, carbs, fat and fibre. */
  kcalFromMacros: boolean;
}

type Row = { key: keyof Nutrients; re: RegExp };

// Order matters: "of which saturates/sugars" must be tested before plain fat/carbohydrate.
const ROWS: Row[] = [
  { key: 'satFat', re: /\b(saturates|saturated|sat\.? ?fat)/i },
  { key: 'sugars', re: /\bsugars?\b/i },
  { key: 'fat', re: /\bfat\b/i },
  { key: 'carbs', re: /\bcarbo?hydrates?\b|\bcarbs\b/i },
  { key: 'fibre', re: /\bfib(re|er)\b/i },
  { key: 'protein', re: /\bprote[il1]n\b/i },
  { key: 'salt', re: /\bsalt\b/i },
];

/** Fix the usual OCR confusions inside numbers: O→0, l/I→1, comma decimals, "<0.5" → 0.5. */
export function cleanNumbers(line: string): string {
  return line
    .replace(/(?<=\d[.,])[oO]|(?<=\d)[oO](?=[\d.,]|g\b|\s|$)|(?<=[\s(<]|^)[oO](?=[.,]\d)|(?<=[\s(<]|^)[oO](?=g\b)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)|(?<=\s)[lI](?=\d)/g, '1')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[<≤]\s*/g, '');
}

function numbers(s: string): number[] {
  return [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
}

/**
 * Gram values where OCR read the unit "g" as a trailing "9" (e.g. "8.19" for 8.1g, "189" for 18g).
 * Labels give at most 1 decimal place (2 for salt) and never more than 100 g per 100 g.
 */
function gramValues(s: string, key: keyof Nutrients): number[] {
  const maxDp = key === 'salt' ? 2 : 1;
  return [...s.matchAll(/(\d+)(?:\.(\d+))?(\s*g\b)?/g)].map((m) => {
    const [, int, dec = '', unit] = m;
    if (!unit && dec.length > maxDp && dec.endsWith('9')) return parseFloat(`${int}.${dec.slice(0, -1)}`);
    if (!unit && !dec && int.length >= 3 && int.endsWith('9') && parseFloat(int) > 100) return parseFloat(int.slice(0, -1));
    return parseFloat(dec ? `${int}.${dec}` : int);
  });
}

export function parseNutritionLabel(raw: string): ParsedLabel {
  const lines = raw.split(/\r?\n/).map((l) => cleanNumbers(l.trim())).filter(Boolean);
  const text = lines.join('\n');
  // The "Reference intake of an average adult (8400kJ/2000kcal)" footer is not a value.
  const valueText = lines.filter((l) => !/reference intake|average adult/i.test(l)).join('\n');

  // Serving size, e.g. "per 30g serving", "a 37.5g serving", "per bar (40g)", "Serving size: 125 g".
  const servingMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)\b[^\n\d]{0,12}serving/i) ??
    text.match(/serving[^\n\d]{0,20}(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i) ??
    text.match(/per\s+(?:bar|pack|pot|bottle|can|portion|biscuit|slice|pie|item)[^\n\d]{0,6}\(?\s*(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i);
  const servingG = servingMatch ? parseFloat(servingMatch[1]) : null;

  // Column order from the header: is "100g" mentioned before the serving column?
  const header = lines.find((l) => /100\s*(g|ml)/i.test(l)) ?? '';
  const idx100 = header.search(/100\s*(g|ml)/i);
  const idxServ = header.search(/serving|portion|per (bar|pack|pot|biscuit|slice|item)|\d+(?:\.\d+)?\s*g\s*(?!.*100)/i);
  const hasPer100 = idx100 >= 0;
  const col = !hasPer100 ? 0 : idxServ >= 0 && idxServ < idx100 ? 1 : 0;
  const basis: ParsedLabel['basis'] = hasPer100 ? 'per100' : servingG ? 'perServing' : 'unknown';
  const scale = !hasPer100 && servingG ? 100 / servingG : 1;

  const per100: Partial<Nutrients> = {};

  // Energy: prefer explicit kcal values; fall back to kJ / 4.184.
  const kcalVals = [...valueText.matchAll(/(\d+(?:\.\d+)?)[ \t]*k[ce]a[l1]/gi)].map((m) => parseFloat(m[1]));
  const kcalRow = lines.find((l) => /^\(?kcal\)?\b/i.test(l) || /energy[^\n]*kcal\s*$/i.test(l));
  const kcalRowVals = kcalRow && kcalVals.length === 0 ? numbers(kcalRow) : [];
  const kjVals = [...valueText.matchAll(/(\d+(?:\.\d+)?)[ \t]*kj/gi)].map((m) => parseFloat(m[1]));
  const kcal = kcalVals[col] ?? kcalRowVals[col] ?? (kjVals[col] !== undefined ? kjVals[col] / 4.184 : undefined);
  if (kcal !== undefined) per100.kcal = Math.round(kcal * scale);

  for (const line of lines) {
    if (/energy|kcal|kj/i.test(line)) continue;
    const row = ROWS.find((r) => r.re.test(line));
    if (!row || per100[row.key] !== undefined) continue;
    // Only numbers after the label word, ignoring "%" reference-intake columns.
    const after = line.slice(line.search(row.re)).replace(/\d+(?:\.\d+)?\s*%/g, '');
    const vals = gramValues(after, row.key);
    if (vals[col] !== undefined) per100[row.key] = Math.round(vals[col] * scale * 100) / 100;
  }

  // A lost decimal point ("32g" for 3.2g) shows up as a sub-value bigger than its parent.
  if (per100.satFat !== undefined && per100.fat !== undefined && per100.satFat > per100.fat && per100.satFat / 10 <= per100.fat) per100.satFat /= 10;
  if (per100.sugars !== undefined && per100.carbs !== undefined && per100.sugars > per100.carbs && per100.sugars / 10 <= per100.carbs) per100.sugars /= 10;

  // Cross-check energy against the macros: pick whichever readable figure agrees, else derive it.
  let kcalFromMacros = false;
  if (per100.protein !== undefined && per100.carbs !== undefined && per100.fat !== undefined) {
    const est = energyFromMacros({ kcal: 0, sugars: 0, satFat: 0, salt: 0, fibre: 0, ...per100 } as Nutrients);
    const ok = (v: number) => Math.abs(v - est) <= Math.max(0.15 * est, 15);
    if (per100.kcal === undefined || !ok(per100.kcal)) {
      const candidates = [...kcalVals, ...kcalRowVals, ...kjVals.map((v) => v / 4.184)].map((v) => Math.round(v * scale));
      const match = candidates.find(ok);
      if (match !== undefined) per100.kcal = match;
      else {
        per100.kcal = Math.round(est);
        kcalFromMacros = true;
      }
    }
  }

  return { per100, servingG, basis, found: Object.keys(per100) as (keyof Nutrients)[], kcalFromMacros };
}
