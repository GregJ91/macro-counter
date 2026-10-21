import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lookupBarcode, searchLocal, searchOpenFoodFacts } from '../lib/foodSearch';
import { newId, useStore } from '../lib/store';
import { itemsNutrients, recipeToFood } from '../lib/nutrition';
import type { Food, Meal, SavedMeal } from '../lib/types';
import { BarcodeScanner } from './BarcodeScanner';
import { FoodDetail, sourceLabel } from './FoodDetail';
import { Sheet } from './Sheet';

type Tab = 'search' | 'recent' | 'mine' | 'scan' | 'create' | 'quick';

export function AddFood({ date, meal, onClose }: { date: string; meal: Meal; onClose: () => void }) {
  const { data, addEntry } = useStore();
  const [tab, setTab] = useState<Tab>('search');
  const [selected, setSelected] = useState<Food | null>(null);
  const [savedMeal, setSavedMeal] = useState<SavedMeal | null>(null);
  const { recent, searchPool, recipeFoods } = useFoodPools();

  const add = (food: Food, grams: number, m: Meal) => {
    addEntry({ date, meal: m, food, grams });
    onClose();
  };

  if (savedMeal) {
    return (
      <Sheet title="Add saved meal" onClose={onClose}>
        <button className="btn ghost small" onClick={() => setSavedMeal(null)} style={{ marginBottom: 8 }}>
          ← Back
        </button>
        <SavedMealAdder
          meal={savedMeal}
          onAdd={(scale) => {
            for (const item of savedMeal.items) addEntry({ date, meal, food: item.food, grams: item.grams * scale });
            onClose();
          }}
        />
      </Sheet>
    );
  }

  if (selected) {
    return (
      <Sheet title="Add food" onClose={onClose}>
        <button className="btn ghost small" onClick={() => setSelected(null)} style={{ marginBottom: 8 }}>
          ← Back
        </button>
        <FoodDetail food={selected} meal={meal} confirmLabel="Add to diary" onConfirm={(g, m) => add(selected, g, m)} />
      </Sheet>
    );
  }

  return (
    <Sheet title={`Add to ${meal}`} onClose={onClose}>
      <div className="segmented" role="group">
        {(
          [
            ['search', 'Search'],
            ['recent', 'Recent'],
            ['mine', 'Meals & recipes'],
            ['scan', 'Scan'],
            ['create', 'Create'],
            ['quick', 'Quick add'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {tab === 'search' && <SearchTab onPick={setSelected} customFoods={searchPool} />}
        {tab === 'recent' && (recent.length ? <FoodList foods={recent} onPick={setSelected} /> : <p className="muted">Foods you log will show here.</p>)}
        {tab === 'mine' && (
          <MealsAndRecipes meals={data.savedMeals} recipes={recipeFoods} customFoods={data.customFoods} onPickMeal={setSavedMeal} onPickFood={setSelected} />
        )}
        {tab === 'scan' && <ScanTab onPick={setSelected} />}
        {tab === 'create' && <CreateFood onCreated={setSelected} />}
        {tab === 'quick' && <QuickAdd onAdd={(food) => add(food, 100, meal)} />}
      </div>
    </Sheet>
  );
}

/** Foods the user owns or used recently, for search and pickers. */
export function useFoodPools() {
  const { data } = useStore();
  const recent = useMemo(() => data.recentFoodIds.map((id) => data.recentFoods[id]).filter(Boolean), [data.recentFoodIds, data.recentFoods]);
  const recipeFoods = useMemo(() => data.recipes.map(recipeToFood), [data.recipes]);
  const searchPool = useMemo(() => [...recipeFoods, ...data.customFoods, ...recent], [recipeFoods, data.customFoods, recent]);
  return { recent, recipeFoods, searchPool };
}

function MealsAndRecipes(props: { meals: SavedMeal[]; recipes: Food[]; customFoods: Food[]; onPickMeal: (m: SavedMeal) => void; onPickFood: (f: Food) => void }) {
  if (!props.meals.length && !props.recipes.length && !props.customFoods.length) {
    return <p className="muted">No saved meals or recipes yet. Use “Save meal” on a diary meal, or build recipes in the Foods tab.</p>;
  }
  return (
    <div>
      {props.meals.length > 0 && <p className="faint" style={{ margin: '4px 0 0' }}>Saved meals</p>}
      {props.meals.map((m) => (
        <div key={m.id} className="food-row" onClick={() => props.onPickMeal(m)}>
          <div className="grow">
            <div>{m.name}</div>
            <div className="faint">{m.items.length} items · {Math.round(itemsNutrients(m.items).kcal)} kcal</div>
          </div>
          <span className="badge">Meal</span>
        </div>
      ))}
      {props.recipes.length > 0 && <p className="faint" style={{ margin: '12px 0 0' }}>Recipes</p>}
      <FoodList foods={props.recipes} onPick={props.onPickFood} />
      {props.customFoods.length > 0 && <p className="faint" style={{ margin: '12px 0 0' }}>My foods</p>}
      <FoodList foods={props.customFoods} onPick={props.onPickFood} />
    </div>
  );
}

function SavedMealAdder({ meal, onAdd }: { meal: SavedMeal; onAdd: (scale: number) => void }) {
  const [scale, setScale] = useState('1');
  const k = parseFloat(scale) || 0;
  const n = itemsNutrients(meal.items);
  return (
    <div>
      <strong>{meal.name}</strong>
      <div className="card">
        {meal.items.map((i, idx) => (
          <div key={idx} className="row between" style={{ padding: '4px 0' }}>
            <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.food.name}</span>
            <span className="num muted">{Math.round(i.grams * k)} g</span>
          </div>
        ))}
      </div>
      <label className="field">
        <span>Portion (1 = as saved)</span>
        <input type="number" inputMode="decimal" step="0.25" min="0" value={scale} onChange={(e) => setScale(e.target.value)} />
      </label>
      <p className="muted">
        <b className="num">{Math.round(n.kcal * k)}</b> kcal · P {Math.round(n.protein * k)} g · C {Math.round(n.carbs * k)} g · F {Math.round(n.fat * k)} g
      </p>
      <button className="btn primary block" disabled={k <= 0} onClick={() => onAdd(k)}>Add all {meal.items.length} items</button>
    </div>
  );
}

export function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div>
      {foods.map((f) => (
        <div key={f.id} className="food-row" onClick={() => onPick(f)}>
          <div className="grow">
            <div className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.name}
            </div>
            <div className="faint">
              {f.brand ? `${f.brand} · ` : ''}
              {Math.round(f.per100.kcal)} kcal/100g · P {f.per100.protein.toFixed(1)} C {f.per100.carbs.toFixed(1)} F {f.per100.fat.toFixed(1)}
            </div>
          </div>
          <span className="badge">{sourceLabel(f)}</span>
        </div>
      ))}
    </div>
  );
}

export function SearchTab({ onPick, customFoods }: { onPick: (f: Food) => void; customFoods: Food[] }) {
  const [q, setQ] = useState('');
  const [local, setLocal] = useState<Food[]>([]);
  const [online, setOnline] = useState<Food[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    searchLocal(q, customFoods).then((r) => live && setLocal(r));
    return () => {
      live = false;
    };
  }, [q, customFoods]);

  // Debounced Open Food Facts search for branded UK products.
  useEffect(() => {
    abortRef.current?.abort();
    setOnline([]);
    if (q.trim().length < 3) return setStatus('idle');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(() => {
      setStatus('loading');
      searchOpenFoodFacts(q.trim(), ctrl.signal)
        .then((r) => {
          setOnline(r);
          setStatus('idle');
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setStatus('error');
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div>
      <input type="search" autoFocus placeholder="Search foods, e.g. “Hovis”, “banana”, “chicken tikka”" value={q} onChange={(e) => setQ(e.target.value)} />
      {local.length > 0 && (
        <>
          <p className="faint" style={{ margin: '12px 0 0' }}>Generic & my foods</p>
          <FoodList foods={local} onPick={onPick} />
        </>
      )}
      {q.trim().length >= 3 && (
        <>
          <p className="faint" style={{ margin: '12px 0 0' }}>
            UK branded products {status === 'loading' && '— searching…'}
          </p>
          {status === 'error' && <p className="note warn">Couldn’t reach Open Food Facts. Check your connection.</p>}
          {status === 'idle' && online.length === 0 && <p className="faint">No branded matches.</p>}
          <FoodList foods={online} onPick={onPick} />
        </>
      )}
    </div>
  );
}

export function ScanTab({ onPick }: { onPick: (f: Food) => void }) {
  const [state, setState] = useState<{ kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'missing'; code: string } | { kind: 'error'; msg: string }>({ kind: 'scanning' });

  const onDetected = useCallback(
    (code: string) => {
      setState({ kind: 'looking', code });
      lookupBarcode(code)
        .then((f) => (f ? onPick(f) : setState({ kind: 'missing', code })))
        .catch((e: Error) => setState({ kind: 'error', msg: e.message }));
    },
    [onPick],
  );

  if (state.kind === 'scanning') return <BarcodeScanner onDetected={onDetected} />;
  return (
    <div>
      {state.kind === 'looking' && <p className="muted">Looking up {state.code}…</p>}
      {state.kind === 'missing' && (
        <div>
          <p className="note warn">Barcode {state.code} isn’t in Open Food Facts yet. Create it from the label in the Create tab — it’ll be saved to your foods.</p>
          <CreateFood barcode={state.code} onCreated={onPick} />
        </div>
      )}
      {state.kind === 'error' && <p className="note warn">{state.msg}</p>}
      {state.kind !== 'looking' && (
        <button className="btn block" style={{ marginTop: 10 }} onClick={() => setState({ kind: 'scanning' })}>
          Scan again
        </button>
      )}
    </div>
  );
}

const NUTRIENT_FIELDS = [
  ['kcal', 'Energy (kcal)'],
  ['protein', 'Protein (g)'],
  ['carbs', 'Carbohydrate (g)'],
  ['sugars', 'of which sugars (g)'],
  ['fat', 'Fat (g)'],
  ['satFat', 'of which saturates (g)'],
  ['fibre', 'Fibre (g)'],
  ['salt', 'Salt (g)'],
] as const;

export function CreateFood({ onCreated, barcode }: { onCreated: (f: Food) => void; barcode?: string }) {
  const { saveCustomFood } = useStore();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [serving, setServing] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});

  const submit = () => {
    const per100 = Object.fromEntries(NUTRIENT_FIELDS.map(([k]) => [k, parseFloat(vals[k] ?? '') || 0])) as unknown as Food['per100'];
    const sg = parseFloat(serving);
    const food: Food = {
      id: `custom:${newId()}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      source: 'custom',
      per100,
      servings: [...(sg > 0 ? [{ label: '1 serving', grams: sg }] : []), { label: '100 g', grams: 100 }],
      barcode,
    };
    saveCustomFood(food);
    onCreated(food);
  };

  return (
    <div>
      <p className="faint">Enter values per 100 g from the label (UK labels list these by default).</p>
      <label className="field"><span>Name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field"><span>Brand (optional)</span><input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
        <label className="field"><span>Serving size g (optional)</span><input type="number" inputMode="decimal" value={serving} onChange={(e) => setServing(e.target.value)} /></label>
      </div>
      <div className="grid2">
        {NUTRIENT_FIELDS.map(([k, label]) => (
          <label className="field" key={k} style={{ margin: 0 }}>
            <span>{label}</span>
            <input type="number" inputMode="decimal" step="any" value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={!name.trim() || !vals.kcal} onClick={submit}>
        Save food
      </button>
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (f: Food) => void }) {
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [label, setLabel] = useState('');
  return (
    <div>
      <p className="faint">Log calories and macros directly, e.g. a restaurant meal.</p>
      <label className="field"><span>Description (optional)</span><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="grid2">
        <label className="field"><span>Calories (kcal)</span><input type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></label>
        <label className="field"><span>Protein (g)</span><input type="number" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <label className="field"><span>Carbs (g)</span><input type="number" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></label>
        <label className="field"><span>Fat (g)</span><input type="number" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></label>
      </div>
      <button
        className="btn primary block"
        disabled={!(parseFloat(kcal) > 0)}
        onClick={() =>
          onAdd({
            id: `quick:${newId()}`,
            name: label.trim() || 'Quick add',
            source: 'custom',
            // Stored "per 100 g" and logged as 100 g so the entry equals exactly what was typed.
            per100: { kcal: parseFloat(kcal) || 0, protein: parseFloat(p) || 0, carbs: parseFloat(c) || 0, fat: parseFloat(f) || 0, sugars: 0, satFat: 0, fibre: 0, salt: 0 },
            servings: [{ label: 'entry', grams: 100 }],
          })
        }
      >
        Add
      </button>
    </div>
  );
}
