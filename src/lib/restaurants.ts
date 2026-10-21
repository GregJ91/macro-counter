import type { Food } from './types';

/** Raw per-portion data as collected from each chain's official UK nutrition information. */
export interface ChainItem {
  name: string;
  category?: string;
  portionG: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  satFat: number | null;
  fibre: number | null;
  salt: number | null;
  url: string;
}

export interface ChainFile {
  chain: string;
  slug: string;
  retrieved: string;
  /** 'pdf' when values were read from a nutrition PDF table rather than a per-item web page. */
  extraction?: 'page' | 'pdf';
  items: ChainItem[];
}

const modules = import.meta.glob<ChainFile>('../data/chains/*.json', { eager: true, import: 'default' });

export const CHAINS: ChainFile[] = Object.values(modules)
  .filter((c) => c.items.length > 0)
  .sort((a, b) => a.chain.localeCompare(b.chain));

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function chainItemToFood(chain: ChainFile, item: ChainItem): Food {
  const n = {
    kcal: item.kcal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    sugars: item.sugars ?? 0,
    satFat: item.satFat ?? 0,
    fibre: item.fibre ?? 0,
    salt: item.salt ?? 0,
  };
  const base = { id: `chain:${chain.slug}:${slug(item.name)}`, name: item.name, brand: chain.chain, source: 'restaurant' as const, sourceUrl: item.url };
  if (item.portionG && item.portionG > 0) {
    const f = 100 / item.portionG;
    const per100 = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v * f])) as typeof n;
    return { ...base, per100, servings: [{ label: '1 portion', grams: item.portionG }, { label: '100 g', grams: 100 }] };
  }
  return { ...base, per100: n, portionOnly: true, servings: [{ label: '1 portion', grams: 100 }] };
}

export const RESTAURANT_FOODS: Food[] = CHAINS.flatMap((c) => c.items.map((i) => chainItemToFood(c, i)));
