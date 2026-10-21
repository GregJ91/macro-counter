import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, DiaryEntry, ExerciseEntry, Food, Profile, WeightEntry } from './types';

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
};

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as AppData) };
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
      replaceAll: (d) => setData({ ...EMPTY, ...d }),
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
