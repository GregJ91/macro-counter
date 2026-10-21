import { useState } from 'react';
import { ISSUE_TEXT } from '../lib/foodQuality';
import { offProductUrl } from '../lib/foodSearch';
import { scaleNutrients } from '../lib/nutrition';
import { CreateFood } from './AddFood';
import { Sheet } from './Sheet';
import { MEALS, type Food, type Meal } from '../lib/types';

const SOURCE_LABEL: Record<Food['source'], string> = {
  'uk-generic': 'UK generic',
  cofid: 'CoFID (UK gov)',
  'open-food-facts': 'Open Food Facts',
  custom: 'My food',
  recipe: 'Recipe',
};

export function sourceLabel(f: Food): string {
  return SOURCE_LABEL[f.source];
}

/** Pick a serving + quantity, preview nutrition, then confirm. */
export function FoodDetail(props: {
  food: Food;
  meal: Meal;
  initialGrams?: number;
  confirmLabel: string;
  onConfirm: (grams: number, meal: Meal) => void;
  onDelete?: () => void;
  /** Hide the meal picker, e.g. when adding a recipe ingredient. */
  hideMeal?: boolean;
  /** Enables "Fix this food"; receives the corrected copy. */
  onCorrected?: (food: Food) => void;
}) {
  const { food } = props;
  const init = props.initialGrams ?? food.servings[0]?.grams ?? 100;
  // Start on the serving that divides the initial weight evenly, else grams.
  const startIdx = food.servings.findIndex((s) => Number.isInteger(init / s.grams) || s.grams === init);
  const [servingIdx, setServingIdx] = useState(startIdx >= 0 ? startIdx : -1);
  const [qty, setQty] = useState(String(startIdx >= 0 ? init / food.servings[startIdx].grams : init));
  const [meal, setMeal] = useState<Meal>(props.meal);
  const [fixing, setFixing] = useState(false);
  const issues = food.quality?.issues ?? [];
  const offBarcode = food.source === 'open-food-facts' ? food.barcode : food.correctedFrom?.startsWith('off:') ? food.correctedFrom.slice(4) : undefined;

  const q = parseFloat(qty) || 0;
  const grams = servingIdx >= 0 ? q * food.servings[servingIdx].grams : q;
  const n = scaleNutrients(food.per100, grams);

  return (
    <div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <strong className="grow">{food.name}</strong>
        <span className="badge">{sourceLabel(food)}</span>
      </div>
      {food.brand && <div className="muted">{food.brand}</div>}
      {issues.length > 0 && (
        <div className={`note ${issues.some((i) => i === 'energy-mismatch' || i === 'missing-macros') ? 'warn' : ''}`}>
          <strong>Check against the pack:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {issues.map((i) => <li key={i}>{ISSUE_TEXT[i]}</li>)}
          </ul>
        </div>
      )}
      {food.correctedFrom && (
        <div className="note good">
          ✓ Your corrected version{offBarcode ? ' of an Open Food Facts product' : ''}.
          {offBarcode && (
            <>
              {' '}Help everyone else by fixing it at the source:{' '}
              <a href={offProductUrl(offBarcode)} target="_blank" rel="noreferrer">open it on Open Food Facts</a> (free account) and{' '}
              <button
                className="btn ghost small"
                style={{ padding: 0 }}
                onClick={() => navigator.clipboard?.writeText(correctionSummary(food))}
              >
                copy your values
              </button>
              .
            </>
          )}
        </div>
      )}

      <div className="grid2" style={{ marginTop: 12 }}>
        <label className="field">
          <span>Amount</span>
          <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="field">
          <span>Unit</span>
          <select value={servingIdx} onChange={(e) => setServingIdx(Number(e.target.value))}>
            {food.servings.map((s, i) => (
              <option key={i} value={i}>
                {s.label}
                {s.label !== '100 g' ? ` (${s.grams} g)` : ''}
              </option>
            ))}
            <option value={-1}>grams / ml</option>
          </select>
        </label>
      </div>
      {!props.hideMeal && <label className="field">
        <span>Meal</span>
        <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {m[0].toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>
      </label>}

      <div className="card">
        <div className="row between">
          <span className="big-stat">{Math.round(n.kcal)}</span>
          <span className="muted">kcal · {Math.round(grams)} g</span>
        </div>
        <div className="grid3" style={{ marginTop: 10 }}>
          <Macro label="Protein" value={n.protein} color="var(--protein)" />
          <Macro label="Carbs" value={n.carbs} color="var(--carbs)" />
          <Macro label="Fat" value={n.fat} color="var(--fat)" />
        </div>
        <table className="list" style={{ marginTop: 10 }}>
          <tbody>
            <tr><td>of which sugars</td><td className="num">{n.sugars.toFixed(1)} g</td></tr>
            <tr><td>of which saturates</td><td className="num">{n.satFat.toFixed(1)} g</td></tr>
            <tr><td>Fibre</td><td className="num">{n.fibre.toFixed(1)} g</td></tr>
            <tr><td>Salt</td><td className="num">{n.salt.toFixed(2)} g</td></tr>
          </tbody>
        </table>
        <p className="faint" style={{ marginBottom: 0 }}>
          Per 100 g: {Math.round(food.per100.kcal)} kcal · P {food.per100.protein} · C {food.per100.carbs} · F {food.per100.fat}
        </p>
      </div>

      <button className="btn primary block" disabled={grams <= 0} onClick={() => props.onConfirm(grams, meal)}>
        {props.confirmLabel}
      </button>
      {props.onCorrected && food.source !== 'recipe' && !food.id.startsWith('quick:') && (
        <button className="btn ghost small block" style={{ marginTop: 8 }} onClick={() => setFixing(true)}>
          {food.correctedFrom || food.source === 'custom' ? 'Edit this food' : 'Something wrong? Fix this food'}
        </button>
      )}
      {fixing && (
        <Sheet title="Fix this food" onClose={() => setFixing(false)}>
          <CreateFood
            initial={food}
            onCreated={(f) => {
              setFixing(false);
              props.onCorrected!(f);
            }}
          />
        </Sheet>
      )}
      {props.onDelete && (
        <button className="btn ghost danger block" style={{ marginTop: 8 }} onClick={props.onDelete}>
          Remove from diary
        </button>
      )}
    </div>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat">
      <b>{value.toFixed(1)} g</b>
      <span className="row" style={{ gap: 5 }}>
        <i className="swatch" style={{ background: color }} /> {label}
      </span>
    </div>
  );
}

/** Plain-text per-100 g values, for pasting into Open Food Facts' edit form. */
function correctionSummary(f: Food): string {
  const n = f.per100;
  return [
    `${f.brand && !f.name.toLowerCase().startsWith(f.brand.toLowerCase()) ? `${f.brand} ` : ''}${f.name}${f.barcode ? ` (${f.barcode})` : ''} — per 100 g:`,
    `Energy ${Math.round(n.kcal)} kcal`,
    `Fat ${n.fat} g (saturates ${n.satFat} g)`,
    `Carbohydrate ${n.carbs} g (sugars ${n.sugars} g)`,
    `Fibre ${n.fibre} g`,
    `Protein ${n.protein} g`,
    `Salt ${n.salt} g`,
  ].join('\n');
}
