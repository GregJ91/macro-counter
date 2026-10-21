import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, DiaryEntry, ExerciseEntry, Food, Profile, Recipe, SavedMeal, WeightEntry } from './types';

const KEY = 'macro-counter:v1';

const EMPTY: AppData = {
  version: 1,
  profile: null,
  diary: [],
  exercise: [],
  weights: [],
  customFoods: [],
  recentFoodIds: [],
  recentFoods: {},
  savedMeals: [],
  recipes: [],
  steps: {},
};

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'male',
  age: 35,
  heightCm: 175,
  heightUnit: 'ftin',
  lifestyle: 'desk',
  workoutsPerWeek: 3,
  workoutMinutes: 45,
  trainingType: 'mixed',
  dailyStepGoal: 10000,
  weightUnit: 'st',
  goalKg: 75,
  rateKgPerWeek: -0.5,
  proteinGPerKg: 1.8,
  fatPct: 30,
  eatBackExercise: false,
  calorieOverride: null,
};

// Profiles saved before lifestyle/workouts existed had a single activity level.
const LEGACY_ACTIVITY: Record<string, Partial<Profile>> = {
  sedentary: { lifestyle: 'desk', workoutsPerWeek: 0 },
  light: { lifestyle: 'desk', workoutsPerWeek: 2, workoutMinutes: 45 },
  moderate: { lifestyle: 'mixed', workoutsPerWeek: 4, workoutMinutes: 45 },
  very: { lifestyle: 'mixed', workoutsPerWeek: 6, workoutMinutes: 60 },
  extreme: { lifestyle: 'manual', workoutsPerWeek: 6, workoutMinutes: 60 },
};

export function migrate(raw: Partial<AppData>): AppData {
  const d = { ...EMPTY, ...raw };
  if (d.profile) {
    const legacy = (d.profile as Profile & { activity?: string }).activity;
    d.profile = { ...DEFAULT_PROFILE, ...(legacy ? LEGACY_ACTIVITY[legacy] : {}), ...d.profile, heightUnit: d.profile.heightUnit ?? 'cm' };
    delete (d.profile as Profile & { activity?: string }).activity;
  }
  return d;
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as Partial<AppData>);
  } catch {
    /* corrupt or unavailable storage — start fresh */
  }
  return EMPTY;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Replace the item with the same id in place, or append it. */
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

interface Store {
  data: AppData;
  setProfile(p: Profile): void;
  addEntry(e: Omit<DiaryEntry, 'id'>): void;
  updateEntry(id: string, patch: Partial<DiaryEntry>): void;
  removeEntry(id: string): void;
  addExercise(e: Omit<ExerciseEntry, 'id'>): void;
  removeExercise(id: string): void;
  setWeight(w: WeightEntry): void;
  removeWeight(date: string): void;
  saveCustomFood(f: Food): void;
  removeCustomFood(id: string): void;
  saveMeal(m: SavedMeal): void;
  removeMeal(id: string): void;
  saveRecipe(r: Recipe): void;
  removeRecipe(id: string): void;
  setSteps(date: string, steps: number | null): void;
  replaceAll(d: AppData): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked */
    }
  }, [data]);

  const rememberFood = useCallback((d: AppData, food: Food): AppData => {
    if (food.id.startsWith('quick:')) return d;
    const ids = [food.id, ...d.recentFoodIds.filter((x) => x !== food.id)].slice(0, 50);
    const recentFoods: Record<string, Food> = {};
    for (const id of ids) recentFoods[id] = id === food.id ? food : d.recentFoods[id];
    return { ...d, recentFoodIds: ids, recentFoods };
  }, []);

  const store = useMemo<Store>(
    () => ({
      data,
      setProfile: (p) => setData((d) => ({ ...d, profile: p })),
      addEntry: (e) => setData((d) => rememberFood({ ...d, diary: [...d.diary, { ...e, id: newId() }] }, e.food)),
      updateEntry: (id, patch) =>
        setData((d) => ({ ...d, diary: d.diary.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => setData((d) => ({ ...d, diary: d.diary.filter((e) => e.id !== id) })),
      addExercise: (e) => setData((d) => ({ ...d, exercise: [...d.exercise, { ...e, id: newId() }] })),
      removeExercise: (id) => setData((d) => ({ ...d, exercise: d.exercise.filter((e) => e.id !== id) })),
      setWeight: (w) =>
        setData((d) => ({
          ...d,
          weights: [...d.weights.filter((x) => x.date !== w.date), w].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      removeWeight: (date) => setData((d) => ({ ...d, weights: d.weights.filter((w) => w.date !== date) })),
      saveCustomFood: (f) =>
        setData((d) => ({ ...d, customFoods: [...d.customFoods.filter((x) => x.id !== f.id), f] })),
      removeCustomFood: (id) => setData((d) => ({ ...d, customFoods: d.customFoods.filter((f) => f.id !== id) })),
      saveMeal: (m) => setData((d) => ({ ...d, savedMeals: upsert(d.savedMeals, m) })),
      removeMeal: (id) => setData((d) => ({ ...d, savedMeals: d.savedMeals.filter((m) => m.id !== id) })),
      saveRecipe: (r) => setData((d) => ({ ...d, recipes: upsert(d.recipes, r) })),
      removeRecipe: (id) => setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id) })),
      setSteps: (date, steps) =>
        setData((d) => {
          const next = { ...d.steps };
          if (steps === null) delete next[date];
          else next[date] = steps;
          return { ...d, steps: next };
        }),
      replaceAll: (d) => setData(migrate(d)),
    }),
    [data, rememberFood],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
