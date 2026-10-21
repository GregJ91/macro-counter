import { estimateExpenditure, calorieTargetForRate, exerciseForDate, macroTargets, stepCalories, weightTrend, type Targets, type ExpenditureEstimate } from './nutrition';
import { dayTargets, loadForDate, type DayTargets } from './carbPlan';
import type { AppData } from './types';

export interface DayPlan {
  currentKg: number;
  expenditure: ExpenditureEstimate;
  targets: Targets;
}

/** Everything derived from the profile + logged data that several screens need. */
export function computePlan(data: AppData, today: string): DayPlan | null {
  const p = data.profile;
  if (!p) return null;
  const trend = weightTrend(data.weights);
  const currentKg = trend.length ? trend[trend.length - 1].trend : 70;
  const expenditure = estimateExpenditure(p, data.diary, data.weights, today);
  const kcal = p.calorieOverride ?? Math.round(calorieTargetForRate(expenditure.tdee, p.rateKgPerWeek) / 10) * 10;
  return { currentKg, expenditure, targets: macroTargets(p, kcal, currentKg) };
}

export interface DayBurn {
  workouts: number;
  steps: number | null;
  /** Calories from steps beyond your lifestyle baseline (never negative). */
  stepKcal: number;
  total: number;
}

export function burnForDate(data: AppData, date: string, kg: number): DayBurn {
  const workouts = exerciseForDate(data.exercise, date);
  const steps = data.steps[date] ?? null;
  const stepKcal = steps !== null && data.profile ? Math.max(0, stepCalories(data.profile, steps, kg)) : 0;
  return { workouts, steps, stepKcal, total: workouts + stepKcal };
}

/** The plan's targets adjusted for a specific date's training load (carb plan). */
export function targetsForDate(data: AppData, plan: DayPlan, date: string): DayTargets {
  return dayTargets(data.profile!, plan.targets, loadForDate(data, date));
}

/** Suggested daily water: ~35 ml per kg, rounded to 250 ml, within 1.5–4 L. */
export function suggestedWaterMl(kg: number): number {
  return Math.min(4000, Math.max(1500, Math.round((kg * 35) / 250) * 250));
}
