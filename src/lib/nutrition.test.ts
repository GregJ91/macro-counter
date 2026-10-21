import { addDays } from './dates';
import { activityFactor, bmr, calorieTargetForRate, recipeToFood, stepCalories, daysToGoal, estimateExpenditure, formulaTdee, KCAL_PER_KG, macroTargets, projectWeight, weightTrend } from './nutrition';
import { migrate } from './store';
import type { DiaryEntry, Profile, Recipe, WeightEntry } from './types';
import { formatWeight, stLbToKg } from './units';

const profile: Profile = {
  name: '', heightUnit: 'cm', lifestyle: 'mixed', workoutsPerWeek: 3, workoutMinutes: 60, trainingType: 'mixed', dailyStepGoal: 10000,
  sex: 'male', age: 35, heightCm: 180, weightUnit: 'kg', goalKg: 80,
  rateKgPerWeek: -0.5, proteinGPerKg: 2, fatPct: 30, eatBackExercise: false, calorieOverride: null,
};

describe('energy formulas', () => {
  it('computes Mifflin–St Jeor BMR', () => {
    expect(bmr(profile, 90)).toBeCloseTo(10 * 90 + 6.25 * 180 - 5 * 35 + 5);
    expect(bmr({ ...profile, sex: 'female' }, 90)).toBeCloseTo(10 * 90 + 6.25 * 180 - 5 * 35 - 161);
  });

  it('sets a deficit matching the weekly rate', () => {
    expect(calorieTargetForRate(2500, -0.5)).toBeCloseTo(2500 - 550);
  });

  it('splits macros so they add up to the calorie target', () => {
    const t = macroTargets(profile, 2000, 90);
    expect(t.protein).toBe(180);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeCloseTo(2000);
  });
});

describe('weightTrend', () => {
  it('smooths noise and interpolates gaps', () => {
    const w: WeightEntry[] = [
      { date: '2026-01-01', kg: 90 },
      { date: '2026-01-02', kg: 91 },
      { date: '2026-01-05', kg: 89 },
    ];
    const t = weightTrend(w);
    expect(t).toHaveLength(5);
    expect(t[0].trend).toBe(90);
    expect(t[1].trend).toBeCloseTo(90.1);
    expect(t[2].scale).toBeUndefined();
    expect(t[4].trend).toBeLessThan(90.2);
  });
});

describe('estimateExpenditure', () => {
  it('learns true expenditure from intake and weight change', () => {
    const today = '2026-03-01';
    const trueTdee = 2800;
    const intake = 2250; // 550 deficit → ~0.5 kg/week
    const diary: DiaryEntry[] = [];
    const weights: WeightEntry[] = [];
    for (let i = 60; i >= 1; i--) {
      const date = addDays(today, -i);
      diary.push({ id: String(i), date, meal: 'lunch', grams: 100, food: { id: 'q', name: 'q', source: 'custom', servings: [], per100: { kcal: intake, protein: 0, carbs: 0, sugars: 0, fat: 0, satFat: 0, fibre: 0, salt: 0 } } });
      weights.push({ date, kg: 95 - ((60 - i) * (trueTdee - intake)) / KCAL_PER_KG });
    }
    const est = estimateExpenditure(profile, diary, weights, today);
    expect(est.confidence).toBe(1);
    expect(est.adaptive!).toBeGreaterThan(trueTdee - 60);
    expect(est.adaptive!).toBeLessThan(trueTdee + 60);
  });

  it('falls back to the formula without data', () => {
    const est = estimateExpenditure(profile, [], [{ date: '2026-03-01', kg: 90 }], '2026-03-01');
    expect(est.adaptive).toBeNull();
    expect(est.tdee).toBeCloseTo(formulaTdee(profile, 90));
  });
});

describe('projectWeight', () => {
  it('loses ~0.5 kg/week on a 550 kcal deficit and slows as weight drops', () => {
    const pts = projectWeight({ startKg: 90, intake: 2000, tdee: 2550, extraBurn: 0, activityFactor: 1.55, days: 70 });
    const firstWeek = 90 - pts[7].kg;
    const lastWeek = pts[63].kg - pts[70].kg;
    expect(firstWeek).toBeCloseTo(0.5, 1);
    expect(lastWeek).toBeLessThan(firstWeek);
    expect(daysToGoal(pts, 90, 88)).toBeGreaterThan(25);
  });

  it('exercise burn speeds up loss', () => {
    const base = projectWeight({ startKg: 90, intake: 2000, tdee: 2550, extraBurn: 0, activityFactor: 1.55, days: 28 });
    const more = projectWeight({ startKg: 90, intake: 2000, tdee: 2550, extraBurn: 300, activityFactor: 1.55, days: 28 });
    expect(more[28].kg).toBeLessThan(base[28].kg);
  });
});

describe('units', () => {
  it('formats stones and pounds', () => {
    expect(formatWeight(stLbToKg(14, 7), 'st')).toBe('14 st 7.0 lb');
    expect(formatWeight(stLbToKg(13, 13.97), 'st')).toBe('14 st 0.0 lb');
  });
});

describe('activity & steps', () => {
  it('derives the activity factor from lifestyle and training', () => {
    const base = { lifestyle: 'desk' as const, workoutsPerWeek: 0, workoutMinutes: 60, trainingType: 'cardio' as const };
    expect(activityFactor(base)).toBeCloseTo(1.2);
    expect(activityFactor({ ...base, workoutsPerWeek: 4 })).toBeCloseTo(1.36);
    expect(activityFactor({ ...base, lifestyle: 'manual', workoutsPerWeek: 14, workoutMinutes: 180 })).toBe(2.0);
  });

  it('credits steps above the lifestyle baseline', () => {
    expect(stepCalories({ lifestyle: 'desk' }, 14000, 80)).toBeCloseTo(400);
    expect(stepCalories({ lifestyle: 'desk' }, 2000, 80)).toBeLessThan(0);
  });
});

describe('recipeToFood', () => {
  const oats = { id: 'o', name: 'Oats', source: 'uk-generic' as const, servings: [], per100: { kcal: 375, protein: 11, carbs: 60, sugars: 1, fat: 8, satFat: 1.4, fibre: 9, salt: 0 } };
  const milk = { id: 'm', name: 'Milk', source: 'uk-generic' as const, servings: [], per100: { kcal: 47, protein: 3.5, carbs: 4.8, sugars: 4.8, fat: 1.7, satFat: 1.1, fibre: 0, salt: 0.1 } };
  const recipe: Recipe = { id: 'r', name: 'Porridge', servings: 2, cookedWeightG: null, ingredients: [{ food: oats, grams: 100 }, { food: milk, grams: 400 }] };

  it('gives per-serving portions that add up to the whole recipe', () => {
    const f = recipeToFood(recipe);
    const total = 375 + 4 * 47;
    expect(f.servings[0].grams).toBe(250);
    expect((f.per100.kcal * f.servings[0].grams) / 100).toBeCloseTo(total / 2);
  });

  it('uses cooked weight for per-100 g values', () => {
    const f = recipeToFood({ ...recipe, cookedWeightG: 400 });
    expect(f.per100.kcal).toBeCloseTo(((375 + 188) / 400) * 100);
    expect(f.servings[0].grams).toBe(200);
  });
});

describe('migrate', () => {
  it('upgrades a legacy activity level profile', () => {
    const d = migrate({ version: 1, profile: { sex: 'female', age: 40, heightCm: 165, activity: 'moderate' } as never });
    expect(d.profile!.lifestyle).toBe('mixed');
    expect(d.profile!.workoutsPerWeek).toBe(4);
    expect(d.profile!.heightUnit).toBe('cm');
    expect(d.recipes).toEqual([]);
    expect('activity' in d.profile!).toBe(false);
  });
});
