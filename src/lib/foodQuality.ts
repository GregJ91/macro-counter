import type { Food, Nutrients, QualityIssue } from './types';

export const ISSUE_TEXT: Record<QualityIssue, string> = {
  'energy-mismatch': 'Calories don’t match the protein, carbs and fat — likely a typo',
  'missing-macros': 'Some of protein, carbs or fat are missing',
  'no-label-photo': 'No photo of the nutrition label to check against',
  stale: 'Not updated for over 5 years — the recipe may have changed',
};

/**
 * Calories implied by the macros, using UK label conventions: carbohydrate excludes fibre,
 * so fibre counts separately at 2 kcal/g (Regulation 1169/2011 energy factors).
 */
export function energyFromMacros(n: Nutrients): number {
  return n.protein * 4 + n.carbs * 4 + n.fat * 9 + n.fibre * 2;
}

/** True when stated calories differ from the macro-derived figure by more than 15% (min 15 kcal). */
export function energyMismatch(n: Nutrients): boolean {
  return Math.abs(n.kcal - energyFromMacros(n)) > Math.max(0.15 * n.kcal, 15);
}

/** Physically impossible or nonsensical per-100 g values — these entries are dropped outright. */
export function implausible(n: Nutrients): boolean {
  const vals = Object.values(n);
  if (vals.some((v) => v < 0 || !Number.isFinite(v))) return true;
  if (n.kcal <= 0 || n.kcal > 950) return true;
  if (n.protein > 100 || n.carbs > 100 || n.fat > 100) return true;
  if (n.protein + n.carbs + n.fat + n.fibre > 110) return true;
  if (n.sugars > n.carbs + 1 || n.satFat > n.fat + 1) return true;
  return n.salt > 100;
}

export interface Assessment {
  drop: boolean;
  issues: QualityIssue[];
}

export function assess(
  n: Nutrients,
  meta: { macrosPresent: boolean; alcoholic: boolean; hasLabelPhoto: boolean; lastModified?: number; now?: number },
): Assessment {
  if (implausible(n)) return { drop: true, issues: [] };
  const issues: QualityIssue[] = [];
  if (!meta.macrosPresent) issues.push('missing-macros');
  // Alcohol (7 kcal/g) isn't in the macros, so drinks with alcohol would always look wrong.
  else if (!meta.alcoholic && energyMismatch(n)) issues.push('energy-mismatch');
  if (!meta.hasLabelPhoto) issues.push('no-label-photo');
  const now = meta.now ?? Date.now() / 1000;
  if (meta.lastModified && now - meta.lastModified > 5 * 365 * 86400) issues.push('stale');
  return { drop: false, issues };
}

/**
 * Search ranking tier, lower is better: your own foods, then lab/curated UK data,
 * then clean crowd-sourced entries, then flagged ones.
 */
export function sourceTier(f: Food): number {
  if (f.source === 'custom' || f.source === 'recipe') return 0;
  if (f.source === 'cofid' || f.source === 'uk-generic') return 1;
  const serious = f.quality?.issues.some((i) => i === 'energy-mismatch' || i === 'missing-macros');
  return serious ? 3 : 2;
}

/** Whether the entry should carry a "check the label" warning. */
export function needsCheck(f: Food): boolean {
  return sourceTier(f) === 3;
}
