import { UK_FOODS } from '../data/ukFoods';
import type { Food, Nutrients, Serving } from './types';

// The full CoFID dataset is optional: it exists only after `npm run import:cofid`.
const cofidModules = import.meta.glob<{ default: Food[] }>('../data/cofid.json');
let cofidCache: Promise<Food[]> | null = null;

function loadCofid(): Promise<Food[]> {
  if (!cofidCache) {
    const loader = Object.values(cofidModules)[0];
    cofidCache = loader ? loader().then((m) => m.default) : Promise.resolve([]);
  }
  return cofidCache;
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Score how well a food name matches every word of the query; 0 = no match. */
function score(name: string, words: string[]): number {
  const n = normalise(name);
  let total = 0;
  for (const w of words) {
    const idx = n.indexOf(w);
    if (idx < 0) return 0;
    total += idx === 0 ? 3 : n[idx - 1] === ' ' ? 2 : 1;
  }
  return total - n.length / 100;
}

export async function searchLocal(query: string, extra: Food[] = []): Promise<Food[]> {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const pool = [...extra, ...UK_FOODS, ...(await loadCofid())];
  const seen = new Set<string>();
  return pool
    .map((f) => ({ f, s: score(`${f.brand ?? ''} ${f.name}`, words) }))
    .filter(({ f, s }) => s > 0 && !seen.has(f.id) && seen.add(f.id))
    .sort((a, b) => b.s - a.s)
    .slice(0, 40)
    .map(({ f }) => f);
}

// ---------- Open Food Facts (crowd-sourced, strong UK barcode coverage) ----------

const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function offToFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (!kcal && n['energy-kj_100g'] !== undefined) kcal = num(n['energy-kj_100g']) / 4.184;
  if (!kcal && n['energy_100g'] !== undefined) kcal = num(n['energy_100g']) / 4.184; // energy_100g is kJ
  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name || !p.code) return null;
  const per100: Nutrients = {
    kcal,
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    sugars: num(n['sugars_100g']),
    fat: num(n['fat_100g']),
    satFat: num(n['saturated-fat_100g']),
    fibre: num(n['fiber_100g']),
    salt: num(n['salt_100g']),
  };
  const servings: Serving[] = [];
  const sq = num(p.serving_quantity);
  if (sq > 0) servings.push({ label: p.serving_size ? `1 serving (${p.serving_size})` : '1 serving', grams: sq });
  servings.push({ label: '100 g', grams: 100 });
  return {
    id: `off:${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    source: 'open-food-facts',
    per100,
    servings,
    barcode: p.code,
  };
}

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '30',
    sort_by: 'unique_scans_n',
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'united-kingdom',
    fields: OFF_FIELDS,
  });
  const res = await fetch(`${OFF}/cgi/search.pl?${params}`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map(offToFood).filter((f): f is Food => !!f && f.per100.kcal > 0);
}

export async function lookupBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return offToFood({ ...data.product, code: data.product.code ?? code });
}
