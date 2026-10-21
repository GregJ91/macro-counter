export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  sugars: number;
  fat: number;
  satFat: number;
  fibre: number;
  salt: number;
}

export interface Serving {
  label: string;
  grams: number;
}

export type FoodSource = 'uk-generic' | 'cofid' | 'open-food-facts' | 'custom' | 'recipe' | 'restaurant';

/** Data-quality concerns found in a crowd-sourced entry. */
export type QualityIssue = 'energy-mismatch' | 'missing-macros' | 'no-label-photo' | 'stale';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  source: FoodSource;
  /** Nutrition per 100 g (or 100 ml for drinks). */
  per100: Nutrients;
  servings: Serving[];
  barcode?: string;
  /** Present on crowd-sourced foods; empty issues = passed every check. */
  quality?: { issues: QualityIssue[] };
  /** Id of the food this is a user correction of (custom foods only). */
  correctedFrom?: string;
  /**
   * Values are per portion, not per 100 g (restaurant items with no published weight).
   * `per100` then holds per-portion values and the single serving is 100 "units".
   */
  portionOnly?: boolean;
  /** Where the values came from, e.g. the chain's official product page. */
  sourceUrl?: string;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  /** Snapshot of the food at log time so later edits/lookups never rewrite history. */
  food: Food;
  grams: number;
}

export interface ExerciseEntry {
  id: string;
  date: string;
  name: string;
  minutes: number;
  kcal: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

export type Sex = 'male' | 'female';
export type WeightUnit = 'kg' | 'st' | 'lb';
export type HeightUnit = 'cm' | 'ftin';
/** Day-to-day movement outside of deliberate exercise. */
export type Lifestyle = 'desk' | 'mixed' | 'feet' | 'manual';
export type TrainingType = 'strength' | 'cardio' | 'mixed' | 'sport';
/** How demanding a day's training is — drives the carb plan. */
export type DayLoad = 'rest' | 'light' | 'moderate' | 'hard';

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  heightUnit: HeightUnit;
  lifestyle: Lifestyle;
  workoutsPerWeek: number;
  workoutMinutes: number;
  trainingType: TrainingType;
  dailyStepGoal: number;
  waterGoalMl: number;
  /** Shift carbs towards training days, keeping the weekly calorie average the same. */
  carbCycling: boolean;
  /** Planned load for Monday … Sunday. */
  trainingWeek: DayLoad[];
  weightUnit: WeightUnit;
  goalKg: number;
  /** Planned change per week in kg; negative = loss. */
  rateKgPerWeek: number;
  proteinGPerKg: number;
  fatPct: number;
  /** Whether logged exercise calories are added to the day's budget. */
  eatBackExercise: boolean;
  /** Manually overridden calorie target; null = derived from goal. */
  calorieOverride: number | null;
}

export interface MealItem {
  food: Food;
  grams: number;
}

/** A group of foods logged together, e.g. "My usual breakfast". */
export interface SavedMeal {
  id: string;
  name: string;
  items: MealItem[];
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  /** Weight of the finished dish; null = sum of raw ingredient weights. */
  cookedWeightG: number | null;
  ingredients: MealItem[];
}

export interface AppData {
  version: 1;
  profile: Profile | null;
  diary: DiaryEntry[];
  exercise: ExerciseEntry[];
  weights: WeightEntry[];
  customFoods: Food[];
  recentFoodIds: string[];
  recentFoods: Record<string, Food>;
  savedMeals: SavedMeal[];
  recipes: Recipe[];
  /** Step count per date (YYYY-MM-DD). */
  steps: Record<string, number>;
  /** Water drunk per date, in ml. */
  water: Record<string, number>;
  /** One-off changes to the planned training load for a date. */
  dayLoads: Record<string, DayLoad>;
}
