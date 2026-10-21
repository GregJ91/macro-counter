import { fromISO } from './dates';
import type { Targets } from './nutrition';
import type { AppData, DayLoad, Profile } from './types';

/**
 * Carb periodisation in the style of Hexis: more carbohydrate on harder training days, less on
 * rest days. Protein and fat stay fixed and the multipliers are normalised over the planned week,
 * so weekly calories (and therefore the rate of weight change) are unchanged.
 */
export const DAY_LOADS: Record<DayLoad, { label: string; short: string; carbMultiplier: number; fuel: string[] }> = {
  rest: {
    label: 'Rest day',
    short: 'Rest',
    carbMultiplier: 0.7,
    fuel: ['Lower-carb day: build meals around protein, vegetables and some healthy fats.', 'Spread protein across 3–4 meals to support recovery.'],
  },
  light: {
    label: 'Light training',
    short: 'Light',
    carbMultiplier: 0.9,
    fuel: ['Easy session (walk, yoga, easy spin, short gym): normal meals, no extra fuelling needed.'],
  },
  moderate: {
    label: 'Moderate training',
    short: 'Mod',
    carbMultiplier: 1.1,
    fuel: [
      'Have a carb-based meal 2–3 hours before training (porridge, rice, pasta, potatoes).',
      'Afterwards: a meal with 25–40 g protein plus carbs within a couple of hours.',
    ],
  },
  hard: {
    label: 'Hard training',
    short: 'Hard',
    carbMultiplier: 1.35,
    fuel: [
      'Include carbs at every meal today.',
      'Top up 60–90 min before: banana, toast & jam, cereal bar.',
      'Sessions over ~75 min: 30–60 g carbs per hour during (sports drink, gels, jelly sweets).',
      'Recovery: ~1 g/kg carbs + 25–40 g protein soon after.',
    ],
  },
};

export const LOAD_ORDER: DayLoad[] = ['rest', 'light', 'moderate', 'hard'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekdayIndex(date: string): number {
  return (fromISO(date).getDay() + 6) % 7; // Monday = 0
}

export function loadForDate(data: Pick<AppData, 'profile' | 'dayLoads'>, date: string): DayLoad {
  return data.dayLoads[date] ?? data.profile?.trainingWeek[weekdayIndex(date)] ?? 'rest';
}

export interface DayTargets extends Targets {
  load: DayLoad;
}

/** Targets for one day: the base targets with carbs (and so calories) shifted by training load. */
export function dayTargets(profile: Profile, base: Targets, load: DayLoad): DayTargets {
  if (!profile.carbCycling) return { ...base, load };
  const week = profile.trainingWeek.length === 7 ? profile.trainingWeek : Array<DayLoad>(7).fill('rest');
  const avg = week.reduce((s, l) => s + DAY_LOADS[l].carbMultiplier, 0) / 7;
  const carbs = (base.carbs * DAY_LOADS[load].carbMultiplier) / avg;
  return { ...base, carbs, kcal: base.kcal + (carbs - base.carbs) * 4, load };
}
