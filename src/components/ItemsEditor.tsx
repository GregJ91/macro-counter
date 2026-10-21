import { useState } from 'react';
import { scaleNutrients } from '../lib/nutrition';
import type { MealItem } from '../lib/types';
import { FoodPicker } from './FoodPicker';

/** Editable list of foods with weights — the ingredients of a recipe or items of a saved meal. */
export function ItemsEditor({ items, onChange, addLabel, excludeId }: { items: MealItem[]; onChange: (items: MealItem[]) => void; addLabel: string; excludeId?: string }) {
  const [picking, setPicking] = useState(false);
  return (
    <div>
      {items.length === 0 && <p className="faint">Nothing added yet.</p>}
      {items.map((item, i) => (
        <div key={i} className="entry" style={{ cursor: 'default' }}>
          <div className="grow">
            <div className="name">{item.food.name}</div>
            <div className="faint">{Math.round(scaleNutrients(item.food.per100, item.grams).kcal)} kcal</div>
          </div>
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${item.food.name} grams`}
            style={{ width: 80 }}
            value={item.grams}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, grams: Math.max(0, Number(e.target.value)) } : x)))}
          />
          <span className="faint">g</span>
          <button className="icon-btn" aria-label={`Remove ${item.food.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn block" style={{ marginTop: 8 }} onClick={() => setPicking(true)}>+ {addLabel}</button>
      {picking && (
        <FoodPicker
          title={addLabel}
          excludeId={excludeId}
          onClose={() => setPicking(false)}
          onPick={(food, grams) => {
            onChange([...items, { food, grams: Math.round(grams * 10) / 10 }]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
