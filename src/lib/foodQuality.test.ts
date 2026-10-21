import { assess, energyMismatch, implausible, sourceTier } from './foodQuality';
import { lookupBarcode, offToFood, searchLocal } from './foodSearch';
import type { Food, Nutrients } from './types';

const n = (o: Partial<Nutrients>): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, sugars: 0, fat: 0, satFat: 0, fibre: 0, salt: 0, ...o });
const baseMeta = { macrosPresent: true, alcoholic: false, hasLabelPhoto: true };

describe('energy checks', () => {
  it('accepts a label whose calories match the macros (UK fibre convention)', () => {
    // Wholemeal bread: 217 kcal, P 9.4, C 37.8, F 2.5, fibre 6 → 4*9.4+4*37.8+9*2.5+2*6 = 223
    expect(energyMismatch(n({ kcal: 217, protein: 9.4, carbs: 37.8, fat: 2.5, fibre: 6 }))).toBe(false);
  });

  it('flags a typo such as kJ entered as kcal', () => {
    expect(energyMismatch(n({ kcal: 908, protein: 9.4, carbs: 37.8, fat: 2.5, fibre: 6 }))).toBe(true);
  });

  it('allows small absolute differences on low-calorie foods', () => {
    expect(energyMismatch(n({ kcal: 20, protein: 0.5, carbs: 2, fat: 0.2 }))).toBe(false);
  });

  it('rejects impossible values', () => {
    expect(implausible(n({ kcal: 300, protein: 60, carbs: 60, fat: 10 }))).toBe(true);
    expect(implausible(n({ kcal: 0 }))).toBe(true);
    expect(implausible(n({ kcal: 100, carbs: 10, sugars: 30 }))).toBe(true);
    expect(implausible(n({ kcal: 375, protein: 11, carbs: 60, sugars: 1, fat: 8, fibre: 9 }))).toBe(false);
  });

  it('skips the mismatch check for alcoholic drinks', () => {
    const lager = n({ kcal: 41, carbs: 3 });
    expect(assess(lager, { ...baseMeta, alcoholic: false }).issues).toContain('energy-mismatch');
    expect(assess(lager, { ...baseMeta, alcoholic: true }).issues).not.toContain('energy-mismatch');
  });

  it('notes missing photos and stale entries', () => {
    const now = 2_000_000_000;
    const a = assess(n({ kcal: 100, carbs: 25 }), { ...baseMeta, hasLabelPhoto: false, lastModified: now - 6 * 365 * 86400, now });
    expect(a.issues).toEqual(['no-label-photo', 'stale']);
  });
});

describe('offToFood', () => {
  const product = {
    code: '5000000000001',
    product_name: 'Test Oats',
    brands: 'Acme, Acme UK',
    image_nutrition_url: 'https://example/img.jpg',
    nutriments: { 'energy-kcal_100g': 375, proteins_100g: 11, carbohydrates_100g: 60, sugars_100g: 1, fat_100g: 8, 'saturated-fat_100g': 1.4, fiber_100g: 9, salt_100g: 0 },
  };

  it('converts a clean product with no issues', () => {
    const f = offToFood(product)!;
    expect(f.brand).toBe('Acme');
    expect(f.quality?.issues).toEqual([]);
    expect(sourceTier(f)).toBe(2);
  });

  it('flags missing macros and ranks it last', () => {
    const f = offToFood({ ...product, nutriments: { 'energy-kcal_100g': 375, proteins_100g: 11 } })!;
    expect(f.quality?.issues).toContain('missing-macros');
    expect(sourceTier(f)).toBe(3);
  });

  it('drops products with no energy value', () => {
    expect(offToFood({ ...product, nutriments: { proteins_100g: 11 } })).toBeNull();
  });

  it('falls back to kJ when kcal is missing', () => {
    const f = offToFood({ ...product, nutriments: { ...product.nutriments, 'energy-kcal_100g': undefined, 'energy-kj_100g': 1569 } })!;
    expect(f.per100.kcal).toBeCloseTo(375, 0);
  });
});

describe('ranking and corrections', () => {
  const mine: Food = { id: 'custom:fix-uk:banana', name: 'Banana', source: 'custom', correctedFrom: 'uk:banana', servings: [], per100: n({ kcal: 89, carbs: 22.8, protein: 1.1, fat: 0.3 }) };

  it('puts your own foods first and hides the original you corrected', async () => {
    const r = await searchLocal('banana', [mine]);
    expect(r[0].id).toBe(mine.id);
    expect(r.some((f) => f.id === 'uk:banana')).toBe(false);
  });

  it('ranks curated UK foods above crowd-sourced ones on a similar match', async () => {
    const off: Food = { id: 'off:1', name: 'Banana', source: 'open-food-facts', quality: { issues: [] }, servings: [], per100: n({ kcal: 95, carbs: 21 }) };
    const r = await searchLocal('banana', [off]);
    expect(r.findIndex((f) => f.id === 'uk:banana')).toBeLessThan(r.findIndex((f) => f.id === 'off:1'));
  });

  it('prefers your own entry for a barcode without hitting the network', async () => {
    const own: Food = { ...mine, id: 'custom:x', barcode: '123' };
    expect(await lookupBarcode('123', [own])).toBe(own);
  });
});
