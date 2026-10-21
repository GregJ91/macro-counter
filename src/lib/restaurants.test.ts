import { energyMismatch } from './foodQuality';
import { CHAINS, chainItemToFood, RESTAURANT_FOODS } from './restaurants';

// Guards the bundled chain data: every item must be official, complete and self-consistent.
const OFFICIAL: Record<string, RegExp> = {
  costa: /costa\.co\.uk$/,
  'five-guys': /fiveguys\.co\.uk$/,
  greggs: /greggs\.(com|co\.uk)$/,
  itsu: /itsu\.com$/,
  kfc: /kfc\.co\.uk$/,
  leon: /leon\.co$/,
  pizzaexpress: /pizzaexpress\.com$/,
  pret: /pret\.co\.uk$/,
  subway: /subway\.com$/,
  wagamama: /wagamama\.com$/,
};

describe('restaurant data', () => {
  it('loads every chain', () => {
    expect(CHAINS.length).toBeGreaterThanOrEqual(10);
  });

  for (const chain of CHAINS) {
    it(`${chain.chain}: items are sourced from the official site and add up`, () => {
      const domain = OFFICIAL[chain.slug];
      expect(domain, `no official domain listed for ${chain.slug}`).toBeDefined();
      const names = new Set<string>();
      for (const item of chain.items) {
        expect(new URL(item.url).hostname).toMatch(domain);
        expect(names.has(item.name), `duplicate ${item.name}`).toBe(false);
        names.add(item.name);
        const food = chainItemToFood(chain, item);
        const portion = item.portionG ?? 100;
        const perPortion = Object.fromEntries(Object.entries(food.per100).map(([k, v]) => [k, (v * portion) / 100]));
        expect(perPortion.kcal).toBeCloseTo(item.kcal, 5);
        expect(energyMismatch(perPortion as never), `${item.name} kcal doesn't match macros`).toBe(false);
      }
    });
  }

  it('gives restaurant foods unique ids', () => {
    expect(new Set(RESTAURANT_FOODS.map((f) => f.id)).size).toBe(RESTAURANT_FOODS.length);
  });
});
