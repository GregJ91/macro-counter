import type { WeightUnit } from './types';

export const KG_PER_LB = 0.45359237;
export const LB_PER_ST = 14;

export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  if (unit === 'kg') return `${kg.toFixed(decimals)} kg`;
  const totalLb = kg / KG_PER_LB;
  if (unit === 'lb') return `${totalLb.toFixed(decimals)} lb`;
  let st = Math.floor(totalLb / LB_PER_ST);
  let lb = Math.round((totalLb - st * LB_PER_ST) * 10) / 10;
  if (lb >= LB_PER_ST) {
    st += 1;
    lb -= LB_PER_ST;
  }
  return `${st} st ${lb.toFixed(decimals === 0 ? 0 : 1)} lb`;
}

/** Format a signed change (e.g. per week) — stones are awkward for small deltas, so use lb. */
export function formatWeightDelta(kg: number, unit: WeightUnit): string {
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : '';
  const abs = Math.abs(kg);
  if (unit === 'kg') return `${sign}${abs.toFixed(2)} kg`;
  return `${sign}${(abs / KG_PER_LB).toFixed(1)} lb`;
}

/** Numeric value of a weight in the display unit (stones as decimal stones). */
export function kgToUnit(kg: number, unit: WeightUnit): number {
  if (unit === 'kg') return kg;
  const lb = kg / KG_PER_LB;
  return unit === 'lb' ? lb : lb / LB_PER_ST;
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'st' ? 'st' : unit;
}

export function stLbToKg(st: number, lb: number): number {
  return (st * LB_PER_ST + lb) * KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
