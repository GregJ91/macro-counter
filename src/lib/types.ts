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

export type FoodSource = 'uk-generic' | 'cofid' | 'open-food-facts' | 'custom';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  source: FoodSource;
  /** Nutrition per 100 g (or 100 ml for drinks). */
  per100: Nutrients;
  servings: Serving[];
  barcode?: string;
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
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extreme';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  activity: ActivityLevel;
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

export interface AppData {
  version: 1;
  profile: Profile | null;
  diary: DiaryEntry[];
  exercise: ExerciseEntry[];
  weights: WeightEntry[];
  customFoods: Food[];
  recentFoodIds: string[];
  recentFoods: Record<string, Food>;
}
