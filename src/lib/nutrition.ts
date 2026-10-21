import { addDays, daysBetween } from './dates';
import type { DiaryEntry, ExerciseEntry, Food, Lifestyle, MealItem, Nutrients, Profile, Recipe, TrainingType, WeightEntry } from './types';

/** Approximate energy content of a kilogram of body-weight change (mixed fat/lean tissue). */
export const KCAL_PER_KG = 7700;

export const LIFESTYLES: Record<Lifestyle, { factor: number; baselineSteps: number; label: string; hint: string }> = {
  desk: { factor: 1.2, baselineSteps: 4000, label: 'Mostly sitting', hint: 'Office or desk job, drive to work' },
  mixed: { factor: 1.3, baselineSteps: 6500, label: 'Some walking', hint: 'Desk job but walk/commute on foot, school runs' },
  feet: { factor: 1.4, baselineSteps: 9500, label: 'On my feet', hint: 'Retail, teaching, nursing, hospitality' },
  manual: { factor: 1.55, baselineSteps: 12000, label: 'Physical work', hint: 'Trades, gardening, warehouse, farming' },
};

/** Added to the activity factor per weekly hour of training (≈ net kcal/h ÷ BMR ÷ 7). */
export const TRAINING_TYPES: Record<TrainingType, { perWeeklyHour: number; label: string; proteinHint: string }> = {
  strength: { perWeeklyHour: 0.025, label: 'Weights / strength', proteinHint: '1.6–2.2 g/kg' },
  cardio: { perWeeklyHour: 0.04, label: 'Running / cycling / cardio', proteinHint: '1.4–1.8 g/kg' },
  mixed: { perWeeklyHour: 0.033, label: 'Mix of both / classes', proteinHint: '1.6–2.0 g/kg' },
  sport: { perWeeklyHour: 0.04, label: 'Team or racket sports', proteinHint: '1.4–1.8 g/kg' },
};

/** Overall activity multiplier from lifestyle plus planned training. */
export function activityFactor(p: Pick<Profile, 'lifestyle' | 'workoutsPerWeek' | 'workoutMinutes' | 'trainingType'>): number {
  const weeklyHours = (Math.max(0, p.workoutsPerWeek) * Math.max(0, p.workoutMinutes)) / 60;
  return Math.min(2.0, LIFESTYLES[p.lifestyle].factor + weeklyHours * TRAINING_TYPES[p.trainingType].perWeeklyHour);
}

export function activityLabel(factor: number): string {
  if (factor < 1.3) return 'Sedentary';
  if (factor < 1.45) return 'Lightly active';
  if (factor < 1.65) return 'Moderately active';
  if (factor < 1.85) return 'Very active';
  return 'Extremely active';
}

/** Net walking calories ≈ 0.0005 kcal per step per kg of body weight (~35 kcal per 1,000 steps at 70 kg). */
export const KCAL_PER_STEP_PER_KG = 0.0005;

/**
 * Calories from steps above what your lifestyle already assumes. Can be negative on a
 * lazy day, but only the positive part is credited to the daily budget.
 */
export function stepCalories(profile: Pick<Profile, 'lifestyle'>, steps: number, kg: number): number {
  return (steps - LIFESTYLES[profile.lifestyle].baselineSteps) * kg * KCAL_PER_STEP_PER_KG;
}

export const ZERO_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, carbs: 0, sugars: 0, fat: 0, satFat: 0, fibre: 0, salt: 0 };

/** Mifflin–St Jeor basal metabolic rate. */
export function bmr(profile: Pick<Profile, 'sex' | 'age' | 'heightCm'>, kg: number): number {
  const base = 10 * kg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === 'male' ? base + 5 : base - 161;
}

export function formulaTdee(profile: Profile, kg: number): number {
  return bmr(profile, kg) * activityFactor(profile);
}

export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    sugars: per100.sugars * f,
    fat: per100.fat * f,
    satFat: per100.satFat * f,
    fibre: per100.fibre * f,
    salt: per100.salt * f,
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      sugars: acc.sugars + n.sugars,
      fat: acc.fat + n.fat,
      satFat: acc.satFat + n.satFat,
      fibre: acc.fibre + n.fibre,
      salt: acc.salt + n.salt,
    }),
    { ...ZERO_NUTRIENTS },
  );
}

export function entryNutrients(e: DiaryEntry): Nutrients {
  return scaleNutrients(e.food.per100, e.grams);
}

export function totalsForDate(diary: DiaryEntry[], date: string): Nutrients {
  return sumNutrients(diary.filter((e) => e.date === date).map(entryNutrients));
}

export function exerciseForDate(exercise: ExerciseEntry[], date: string): number {
  return exercise.filter((e) => e.date === date).reduce((s, e) => s + e.kcal, 0);
}

/** Daily intake in kcal for every date that has at least one diary entry. */
export function dailyIntake(diary: DiaryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of diary) out.set(e.date, (out.get(e.date) ?? 0) + entryNutrients(e).kcal);
  return out;
}

export interface TrendPoint {
  date: string;
  scale?: number;
  trend: number;
}

/**
 * Exponentially smoothed weight trend (as popularised by The Hacker's Diet and used by
 * MacroFactor-style apps). Missing days are linearly interpolated so a gap in weigh-ins
 * doesn't stall the trend.
 */
export function weightTrend(weights: WeightEntry[], alpha = 0.1): TrendPoint[] {
  if (weights.length === 0) return [];
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((w) => [w.date, w.kg]));
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const span = daysBetween(first, last);
  const points: TrendPoint[] = [];
  let trend = sorted[0].kg;
  let prevIdx = 0;
  for (let i = 0; i <= span; i++) {
    const date = addDays(first, i);
    const scale = byDate.get(date);
    let value: number;
    if (scale !== undefined) {
      value = scale;
      while (prevIdx + 1 < sorted.length && sorted[prevIdx + 1].date <= date) prevIdx++;
    } else {
      const a = sorted[prevIdx];
      const b = sorted[prevIdx + 1];
      const t = daysBetween(a.date, date) / daysBetween(a.date, b.date);
      value = a.kg + (b.kg - a.kg) * t;
    }
    trend = i === 0 ? value : trend + alpha * (value - trend);
    points.push({ date, scale, trend });
  }
  return points;
}

export interface ExpenditureEstimate {
  /** Best estimate of total daily energy expenditure (kcal/day). */
  tdee: number;
  formula: number;
  /** Purely data-driven estimate, when enough data exists. */
  adaptive: number | null;
  /** 0–1: how much weight the adaptive estimate carries in `tdee`. */
  confidence: number;
  loggedDays: number;
}

/**
 * Estimate real-world expenditure from logged intake and the change in trend weight,
 * blending with the formula estimate until enough data has accumulated.
 * Energy balance: intake − expenditure = Δweight × 7700.
 */
export function estimateExpenditure(
  profile: Profile,
  diary: DiaryEntry[],
  weights: WeightEntry[],
  today: string,
  windowDays = 28,
): ExpenditureEstimate {
  const trend = weightTrend(weights);
  const currentKg = trend.length ? trend[trend.length - 1].trend : 70;
  const formula = formulaTdee(profile, currentKg);
  const start = addDays(today, -windowDays);
  const intake = dailyIntake(diary);
  // Ignore today (likely incomplete) and implausibly small days (probably partial logging).
  const days = [...intake.entries()].filter(([d, k]) => d >= start && d < today && k >= 800);
  const loggedDays = days.length;

  const inWindow = trend.filter((p) => p.date >= start && p.date < today);
  let adaptive: number | null = null;
  if (loggedDays >= 7 && inWindow.length >= 10) {
    const avgIntake = days.reduce((s, [, k]) => s + k, 0) / loggedDays;
    const first = inWindow[0];
    const last = inWindow[inWindow.length - 1];
    const span = Math.max(1, daysBetween(first.date, last.date));
    const kgPerDay = (last.trend - first.trend) / span;
    adaptive = avgIntake - kgPerDay * KCAL_PER_KG;
  }
  const confidence = adaptive === null ? 0 : Math.min(1, loggedDays / 21);
  const tdee = adaptive === null ? formula : confidence * adaptive + (1 - confidence) * formula;
  return { tdee, formula, adaptive, confidence, loggedDays };
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function calorieTargetForRate(tdee: number, rateKgPerWeek: number): number {
  return tdee + (rateKgPerWeek * KCAL_PER_KG) / 7;
}

export function macroTargets(profile: Profile, kcal: number, kg: number): Targets {
  const protein = profile.proteinGPerKg * kg;
  const fat = (kcal * profile.fatPct) / 100 / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, carbs, fat };
}

/** Minimum sensible intake — below this, warn the user. */
export function minimumSafeIntake(sex: Profile['sex']): number {
  return sex === 'male' ? 1500 : 1200;
}

export interface ProjectionPoint {
  day: number;
  kg: number;
}

/**
 * Day-by-day simulation of weight under a fixed intake and extra exercise burn.
 * Expenditure falls as weight falls (Mifflin's 10 kcal/kg × activity factor), so the
 * projection curves gently rather than dropping in a straight line forever.
 */
export function projectWeight(opts: {
  startKg: number;
  intake: number;
  tdee: number;
  extraBurn: number;
  activityFactor: number;
  days: number;
}): ProjectionPoint[] {
  const { startKg, intake, tdee, extraBurn, activityFactor, days } = opts;
  const out: ProjectionPoint[] = [{ day: 0, kg: startKg }];
  let kg = startKg;
  for (let d = 1; d <= days; d++) {
    const expenditure = tdee + extraBurn + 10 * activityFactor * (kg - startKg);
    kg += (intake - expenditure) / KCAL_PER_KG;
    out.push({ day: d, kg });
  }
  return out;
}

/** First day on which the projection reaches the goal, or null. */
export function daysToGoal(points: ProjectionPoint[], startKg: number, goalKg: number): number | null {
  const losing = goalKg < startKg;
  const hit = points.find((p) => (losing ? p.kg <= goalKg : p.kg >= goalKg));
  return hit ? hit.day : null;
}

export function itemsNutrients(items: MealItem[]): Nutrients {
  return sumNutrients(items.map((i) => scaleNutrients(i.food.per100, i.grams)));
}

/** Turn a recipe into a loggable food with per-100 g values and a per-serving portion. */
export function recipeToFood(r: Recipe): Food {
  const totals = itemsNutrients(r.ingredients);
  const rawWeight = r.ingredients.reduce((s, i) => s + i.grams, 0);
  const weight = r.cookedWeightG && r.cookedWeightG > 0 ? r.cookedWeightG : rawWeight;
  const f = weight > 0 ? 100 / weight : 0;
  const per100 = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v * f])) as unknown as Nutrients;
  const servings = Math.max(1, r.servings);
  return {
    id: `recipe:${r.id}`,
    name: r.name,
    source: 'recipe',
    per100,
    servings: [
      { label: `1 serving (1/${servings} of recipe)`, grams: Math.round((weight / servings) * 10) / 10 },
      { label: 'Whole recipe', grams: Math.round(weight) },
      { label: '100 g', grams: 100 },
    ],
  };
}

export function foodServingDefault(food: Food): number {
  return food.servings[0]?.grams ?? 100;
}
