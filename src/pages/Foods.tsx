import { useState } from 'react';
import { ItemsEditor } from '../components/ItemsEditor';
import { Sheet } from '../components/Sheet';
import { itemsNutrients, recipeToFood } from '../lib/nutrition';
import { newId, useStore } from '../lib/store';
import type { Nutrients, Recipe, SavedMeal } from '../lib/types';

type Tab = 'recipes' | 'meals' | 'foods';

export function Foods() {
  const { data, removeCustomFood } = useStore();
  const [tab, setTab] = useState<Tab>('recipes');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [meal, setMeal] = useState<SavedMeal | null>(null);

  return (
    <>
      <div className="topbar"><h1>My foods</h1></div>
      <div className="segmented" role="group">
        {(
          [
            ['recipes', `Recipes (${data.recipes.length})`],
            ['meals', `Saved meals (${data.savedMeals.length})`],
            ['foods', `Custom foods (${data.customFoods.length})`],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'recipes' && (
        <>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setRecipe({ id: newId(), name: '', servings: 4, cookedWeightG: null, ingredients: [] })}>
            + New recipe
          </button>
          {data.recipes.length === 0 && <p className="muted">Build a recipe from its ingredients — chilli, curry, overnight oats — then log it by the serving.</p>}
          {data.recipes.map((r) => {
            const f = recipeToFood(r);
            const serving = f.servings[0].grams;
            return (
              <div key={r.id} className="card entry" onClick={() => setRecipe(r)}>
                <div className="grow">
                  <div className="name"><strong>{r.name}</strong></div>
                  <div className="faint">{r.ingredients.length} ingredients · {r.servings} servings</div>
                </div>
                <span className="kcal">{Math.round((f.per100.kcal * serving) / 100)} kcal/serving</span>
              </div>
            );
          })}
        </>
      )}

      {tab === 'meals' && (
        <>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setMeal({ id: newId(), name: '', items: [] })}>
            + New saved meal
          </button>
          {data.savedMeals.length === 0 && <p className="muted">Save meals you eat often — or tap “Save meal” on any meal in your diary.</p>}
          {data.savedMeals.map((m) => (
            <div key={m.id} className="card entry" onClick={() => setMeal(m)}>
              <div className="grow">
                <div className="name"><strong>{m.name}</strong></div>
                <div className="faint">{m.items.map((i) => i.food.name).join(', ')}</div>
              </div>
              <span className="kcal">{Math.round(itemsNutrients(m.items).kcal)} kcal</span>
            </div>
          ))}
        </>
      )}

      {tab === 'foods' && (
        <div className="card">
          {data.customFoods.length === 0 && <p className="muted" style={{ margin: 0 }}>Foods you create from a label appear here.</p>}
          {data.customFoods.map((f) => (
            <div key={f.id} className="entry" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="name">{f.name}</div>
                <div className="faint">{f.brand ? `${f.brand} · ` : ''}{Math.round(f.per100.kcal)} kcal/100g</div>
              </div>
              <button className="icon-btn" aria-label={`Delete ${f.name}`} onClick={() => confirm(`Delete “${f.name}”? Past diary entries keep their values.`) && removeCustomFood(f.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {recipe && <RecipeEditor initial={recipe} onClose={() => setRecipe(null)} />}
      {meal && <MealEditor initial={meal} onClose={() => setMeal(null)} />}
    </>
  );
}

function NutritionLine({ n, label }: { n: Nutrients; label: string }) {
  return (
    <div className="note">
      <div className="row between">
        <span>{label}</span>
        <b className="num">{Math.round(n.kcal)} kcal</b>
      </div>
      <div className="faint">
        P {n.protein.toFixed(1)} g · C {n.carbs.toFixed(1)} g · F {n.fat.toFixed(1)} g · Fibre {n.fibre.toFixed(1)} g · Salt {n.salt.toFixed(2)} g
      </div>
    </div>
  );
}

function RecipeEditor({ initial, onClose }: { initial: Recipe; onClose: () => void }) {
  const { data, saveRecipe, removeRecipe } = useStore();
  const [r, setR] = useState(initial);
  const exists = data.recipes.some((x) => x.id === r.id);
  const total = itemsNutrients(r.ingredients);
  const servings = Math.max(1, r.servings || 1);
  const perServing = Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / servings])) as unknown as Nutrients;
  const rawWeight = r.ingredients.reduce((s, i) => s + i.grams, 0);

  return (
    <Sheet title={exists ? 'Edit recipe' : 'New recipe'} onClose={onClose}>
      <label className="field"><span>Recipe name</span><input type="text" value={r.name} placeholder="e.g. Turkey chilli" onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field">
          <span>Makes (servings)</span>
          <input type="number" inputMode="numeric" min={1} value={r.servings} onChange={(e) => setR({ ...r, servings: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Cooked weight g (optional)</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder={rawWeight ? `${Math.round(rawWeight)} raw` : 'weigh the pot'}
            value={r.cookedWeightG ?? ''}
            onChange={(e) => setR({ ...r, cookedWeightG: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
      </div>
      <p className="faint" style={{ marginTop: 0 }}>Enter the cooked weight (minus the pan) to log by grams accurately — cooking changes water content.</p>

      <h4 style={{ margin: '14px 0 4px' }}>Ingredients</h4>
      <ItemsEditor items={r.ingredients} onChange={(ingredients) => setR({ ...r, ingredients })} addLabel="Add ingredient" excludeId={`recipe:${r.id}`} />

      {r.ingredients.length > 0 && (
        <>
          <NutritionLine n={perServing} label={`Per serving (1/${servings})`} />
          <NutritionLine n={total} label="Whole recipe" />
        </>
      )}

      <button
        className="btn primary block"
        style={{ marginTop: 14 }}
        disabled={!r.name.trim() || r.ingredients.length === 0}
        onClick={() => {
          saveRecipe({ ...r, name: r.name.trim(), servings });
          onClose();
        }}
      >
        Save recipe
      </button>
      {exists && (
        <button className="btn ghost danger block" style={{ marginTop: 8 }} onClick={() => { if (confirm('Delete this recipe? Past diary entries keep their values.')) { removeRecipe(r.id); onClose(); } }}>
          Delete recipe
        </button>
      )}
    </Sheet>
  );
}

function MealEditor({ initial, onClose }: { initial: SavedMeal; onClose: () => void }) {
  const { data, saveMeal, removeMeal } = useStore();
  const [m, setM] = useState(initial);
  const exists = data.savedMeals.some((x) => x.id === m.id);
  return (
    <Sheet title={exists ? 'Edit saved meal' : 'New saved meal'} onClose={onClose}>
      <label className="field"><span>Name</span><input type="text" value={m.name} placeholder="e.g. Usual breakfast" onChange={(e) => setM({ ...m, name: e.target.value })} /></label>
      <h4 style={{ margin: '14px 0 4px' }}>Foods</h4>
      <ItemsEditor items={m.items} onChange={(items) => setM({ ...m, items })} addLabel="Add food" />
      {m.items.length > 0 && <NutritionLine n={itemsNutrients(m.items)} label="Total" />}
      <button
        className="btn primary block"
        style={{ marginTop: 14 }}
        disabled={!m.name.trim() || m.items.length === 0}
        onClick={() => {
          saveMeal({ ...m, name: m.name.trim() });
          onClose();
        }}
      >
        Save meal
      </button>
      {exists && (
        <button className="btn ghost danger block" style={{ marginTop: 8 }} onClick={() => { if (confirm('Delete this saved meal?')) { removeMeal(m.id); onClose(); } }}>
          Delete saved meal
        </button>
      )}
    </Sheet>
  );
}
