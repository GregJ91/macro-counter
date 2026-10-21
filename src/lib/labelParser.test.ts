import { cleanNumbers, parseNutritionLabel } from './labelParser';

describe('cleanNumbers', () => {
  it('fixes common OCR slips', () => {
    expect(cleanNumbers('Fat 8,O g')).toBe('Fat 8.0 g');
    expect(cleanNumbers('Salt <0.01g')).toBe('Salt 0.01g');
    expect(cleanNumbers('Protein l1g')).toBe('Protein 11g'); // l misread for 1 at the start of a number
    expect(cleanNumbers('Protein 1l g')).toBe('Protein 1l g'); // but not a trailing l before a unit
    expect(cleanNumbers('Fibre 1l1g')).toBe('Fibre 111g');
    expect(cleanNumbers('Sugars Og')).toBe('Sugars 0g');
  });
});

describe('parseNutritionLabel', () => {
  it('reads a typical cereal label (per 100g first, then per serving)', () => {
    const text = `NUTRITION
Typical values  Per 100g  Per 37.5g serving  %RI*
Energy 1534kJ 362kcal 575kJ 136kcal 7%
Fat 2.0g 0.8g 1%
of which saturates 0.6g 0.2g 1%
Carbohydrate 69g 26g
of which sugars 4.4g 1.7g 2%
Fibre 10g 3.8g
Protein 12g 4.5g 9%
Salt 0.28g 0.10g 2%`;
    const r = parseNutritionLabel(text);
    expect(r.basis).toBe('per100');
    expect(r.servingG).toBe(37.5);
    expect(r.per100).toEqual({ kcal: 362, fat: 2, satFat: 0.6, carbs: 69, sugars: 4.4, fibre: 10, protein: 12, salt: 0.28 });
  });

  it('handles energy split over kJ and kcal rows and comma decimals', () => {
    const text = `Per 100 g
Energy kJ 1569
kcal 375
Fat 8,0 g
of which saturates 1,4 g
Carbohydrate 60 g
of which sugars 1,1 g
Fibre 9,0 g
Protein 11 g
Salt <0,01 g`;
    const r = parseNutritionLabel(text);
    expect(r.per100.kcal).toBe(375);
    expect(r.per100.fat).toBe(8);
    expect(r.per100.salt).toBe(0.01);
    expect(r.found).toHaveLength(8);
  });

  it('reads the per-100g column when the serving column comes first', () => {
    const text = `Per bar (40g)  Per 100g
Energy 760kJ/181kcal 1900kJ/453kcal
Fat 7.2g 18g
Carbohydrate 24g 60g
Protein 4.0g 10g`;
    const r = parseNutritionLabel(text);
    expect(r.servingG).toBe(40);
    expect(r.per100).toMatchObject({ kcal: 453, fat: 18, carbs: 60, protein: 10 });
  });

  it('scales per-serving-only labels to per 100 g', () => {
    const text = `Serving size 50g
Energy 200kcal
Fat 5g
Carbohydrate 30g
Protein 10g`;
    const r = parseNutritionLabel(text);
    expect(r.basis).toBe('perServing');
    expect(r.per100).toMatchObject({ kcal: 400, fat: 10, carbs: 60, protein: 20 });
  });

  it('falls back to kJ when no kcal is readable', () => {
    expect(parseNutritionLabel('Per 100g\nEnergy 1046kJ\nFat 3g').per100.kcal).toBe(250);
  });

  it('copes with real OCR output from a photographed label', () => {
    // Raw Tesseract output: "g" read as "9", a lost decimal point, garbled kcal and a %RI footer.
    const text = `NUTRITION
Typical values Per 100g Per Asgsenving  %RI*
TBaok) 832K)
Energy aaikcal  198keal 10%
Fat 189 8.19 12%
of which saturates 32g 1.49 7%
Carbohydrate 589 269 10%
of which sugars 21g 9.5 1%
Fibre 6.49 2.99
Protein 9.29 419 8%
salt 0.359 0.169 3%
Reference intake of an average adult (B400KJ/2000kcal)`;
    const r = parseNutritionLabel(text);
    expect(r.per100).toMatchObject({ fat: 18, satFat: 3.2, carbs: 58, sugars: 21, fibre: 6.4, protein: 9.2, salt: 0.35 });
    // 441 kcal on the pack; unreadable, so derived from macros (≈444) and flagged.
    expect(r.kcalFromMacros).toBe(true);
    expect(r.per100.kcal).toBeGreaterThan(420);
    expect(r.per100.kcal).toBeLessThan(460);
  });
});
