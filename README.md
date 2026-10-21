# Macro Counter

A UK-focused calorie & macro tracker in the spirit of MyFitnessPal / Nutracheck / Hexis, with a
MacroFactor-style adaptive expenditure engine and a "what if" weight-loss planner.

It's a Progressive Web App: open it on your phone and choose **Add to Home Screen** to install it.
All data is stored on the device (export/import a JSON backup from Settings).

## Features

- **Food diary** – breakfast/lunch/dinner/snacks, calories, protein/carbs/fat, plus UK label
  nutrients (sugars, saturates, fibre, salt). Tap an entry to edit or remove it.
- **UK food database**
  - ~230 common UK generic foods built in (bread, takeaways, pints, cuppas…), with UK portion sizes.
  - Full **CoFID / McCance & Widdowson's** dataset (~2,900 foods, UK Government, OGL) can be added – see below.
  - **Open Food Facts** live search filtered to UK products, for branded supermarket items.
  - **Barcode scanner** (camera; native BarcodeDetector or ZXing fallback for iPhone).
  - Create your own foods from a label, and quick-add calories/macros.
- **Saved meals** – tap “Save meal” on any diary meal (or build one in the Foods tab) and add the
  whole lot in one go next time, scaled up or down.
- **Recipes** – build a dish from ingredients, set servings and (optionally) the cooked weight, then
  log it by the serving or by grams. Recipes show up in search.
- **Profile** – height in ft/in or cm, daily lifestyle (sitting → physical work), workouts per week,
  session length and training type. These set your activity factor and protein suggestion.
- **Steps** – daily step goal and log; steps above what your lifestyle already assumes count as
  extra burn (~0.0005 kcal per step per kg).
- **Exercise logging** with MET-based estimates or manual calories from your watch; optionally
  add exercise and step calories to your budget.
- **Weight trend** – exponentially smoothed trend line so daily water swings don't mislead you.
  Units: stones & pounds, lb, or kg.
- **Adaptive expenditure** – after ~1–3 weeks of logging, your real maintenance calories are
  estimated from intake vs. trend-weight change, and your calorie target updates automatically.
- **Planner** – sliders for starting weight, calories eaten and extra calories burnt; shows weekly
  and monthly change, projected weight curve, date you'd hit your goal, and safety warnings.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the nutrition maths
npm run build      # production build in dist/
```

## Adding the full CoFID database

1. Download the CoFID Excel workbook from
   <https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid>.
2. `npm run import:cofid -- path/to/CoFID.xlsx`

This writes `src/data/cofid.json`, which the app lazy-loads into search automatically.

## How the maths works

- BMR: Mifflin–St Jeor; maintenance = BMR × activity factor until enough data exists.
- Activity factor: lifestyle base (1.2 desk → 1.55 physical job) + weekly training hours ×
  0.025–0.04 depending on training type, capped at 2.0.
- Trend weight: EWMA (α = 0.1) over daily values, interpolating missing days.
- Adaptive TDEE: `avg intake − Δtrend kg/day × 7,700`, blended with the formula estimate by
  confidence (logged days / 21).
- Projection: day-by-day energy balance, with maintenance falling ~10 kcal × activity factor per kg lost.

Estimates only — not medical advice.
