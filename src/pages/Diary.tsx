import { useMemo, useState } from 'react';
import { AddFood } from '../components/AddFood';
import { FoodDetail } from '../components/FoodDetail';
import { MacroBars } from '../components/MacroBars';
import { Sheet } from '../components/Sheet';
import { addDays, formatDay, todayISO } from '../lib/dates';
import { entryNutrients, exerciseForDate, sumNutrients } from '../lib/nutrition';
import { useStore } from '../lib/store';
import { computePlan } from '../lib/targets';
import { MEALS, type DiaryEntry, type Meal } from '../lib/types';
import { formatWeight, kgToUnit, lbToKg, stLbToKg } from '../lib/units';

const EXERCISES: { name: string; met: number }[] = [
  { name: 'Walking (brisk)', met: 4.3 },
  { name: 'Running (10 km/h)', met: 9.8 },
  { name: 'Cycling (moderate)', met: 8.0 },
  { name: 'Swimming (moderate)', met: 6.0 },
  { name: 'Weight training', met: 5.0 },
  { name: 'HIIT / circuits', met: 8.0 },
  { name: 'Football', met: 7.0 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Gardening', met: 3.8 },
];

export function Diary() {
  const store = useStore();
  const { data } = store;
  const [date, setDate] = useState(todayISO());
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [weighOpen, setWeighOpen] = useState(false);

  const plan = useMemo(() => computePlan(data, todayISO()), [data]);
  const entries = data.diary.filter((e) => e.date === date);
  const totals = sumNutrients(entries.map(entryNutrients));
  const burned = exerciseForDate(data.exercise, date);
  const weighIn = data.weights.find((w) => w.date === date);
  if (!plan || !data.profile) return null;
  const unit = data.profile.weightUnit;
  const budget = plan.targets.kcal + (data.profile.eatBackExercise ? burned : 0);
  const remaining = budget - totals.kcal;

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <h1>{formatDay(date)}</h1>
        <button className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>

      <div className="card">
        <h2>
          Calories remaining <small>{plan.expenditure.confidence > 0 ? 'adaptive target' : 'formula target'}</small>
        </h2>
        <div className="summary">
          <div><b>{Math.round(plan.targets.kcal)}</b><span>Target</span></div>
          <div><b>−{Math.round(totals.kcal)}</b><span>Food</span></div>
          <div><b>{data.profile.eatBackExercise ? '+' : ''}{Math.round(burned)}</b><span>Exercise{data.profile.eatBackExercise ? '' : ' (not added)'}</span></div>
          <div><b style={{ color: remaining < 0 ? 'var(--bad)' : 'var(--good)' }}>{Math.round(remaining)}</b><span>Remaining</span></div>
        </div>
        <div className="bar" style={{ marginTop: 12 }}>
          <i style={{ width: `${Math.min(100, (totals.kcal / budget) * 100)}%`, background: remaining < 0 ? 'var(--bad)' : 'var(--accent)' }} />
        </div>
        <MacroBars totals={totals} targets={plan.targets} />
        <div className="row between faint" style={{ marginTop: 10 }}>
          <span>Sugars {totals.sugars.toFixed(0)} g · Fibre {totals.fibre.toFixed(0)} g · Salt {totals.salt.toFixed(1)} g</span>
        </div>
      </div>

      {MEALS.map((meal) => {
        const list = entries.filter((e) => e.meal === meal);
        const kcal = list.reduce((s, e) => s + entryNutrients(e).kcal, 0);
        return (
          <div className="card" key={meal}>
            <div className="meal-head">
              <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{meal}</h2>
              <span className="row">
                <span className="num muted">{Math.round(kcal)} kcal</span>
                <button className="btn small" onClick={() => setAdding(meal)}>+ Add</button>
              </span>
            </div>
            {list.length > 0 && <div style={{ marginTop: 6 }} />}
            {list.map((e) => (
              <div key={e.id} className="entry" onClick={() => setEditing(e)}>
                <div className="grow">
                  <div className="name">{e.food.name}</div>
                  <div className="faint">{e.food.brand ? `${e.food.brand} · ` : ''}{e.food.id.startsWith('quick:') ? 'quick add' : `${Math.round(e.grams)} g`}</div>
                </div>
                <span className="kcal">{Math.round(entryNutrients(e).kcal)}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div className="card">
        <div className="meal-head">
          <h2 style={{ margin: 0 }}>Exercise</h2>
          <button className="btn small" onClick={() => setExerciseOpen(true)}>+ Add</button>
        </div>
        {data.exercise.filter((x) => x.date === date).map((x) => (
          <div key={x.id} className="entry">
            <div className="grow">
              <div className="name">{x.name}</div>
              <div className="faint">{x.minutes} min</div>
            </div>
            <span className="kcal">{Math.round(x.kcal)}</span>
            <button className="icon-btn" aria-label="Remove" onClick={() => store.removeExercise(x.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="card row between">
        <div>
          <strong>Weigh-in</strong>
          <div className="faint">{weighIn ? formatWeight(weighIn.kg, unit) : 'Not logged — weigh first thing in the morning'}</div>
        </div>
        <button className="btn small" onClick={() => setWeighOpen(true)}>{weighIn ? 'Edit' : 'Log weight'}</button>
      </div>

      {adding && <AddFood date={date} meal={adding} onClose={() => setAdding(null)} />}
      {editing && (
        <Sheet title="Edit entry" onClose={() => setEditing(null)}>
          <FoodDetail
            food={editing.food}
            meal={editing.meal}
            initialGrams={editing.grams}
            confirmLabel="Save"
            onConfirm={(grams, meal) => {
              store.updateEntry(editing.id, { grams, meal });
              setEditing(null);
            }}
            onDelete={() => {
              store.removeEntry(editing.id);
              setEditing(null);
            }}
          />
        </Sheet>
      )}
      {exerciseOpen && (
        <ExerciseSheet
          kg={plan.currentKg}
          onClose={() => setExerciseOpen(false)}
          onAdd={(name, minutes, kcal) => {
            store.addExercise({ date, name, minutes, kcal });
            setExerciseOpen(false);
          }}
        />
      )}
      {weighOpen && (
        <WeightSheet
          unit={unit}
          initialKg={weighIn?.kg ?? plan.currentKg}
          onClose={() => setWeighOpen(false)}
          onSave={(kg) => {
            store.setWeight({ date, kg });
            setWeighOpen(false);
          }}
          onDelete={weighIn ? () => { store.removeWeight(date); setWeighOpen(false); } : undefined}
        />
      )}
    </>
  );
}

function ExerciseSheet({ kg, onClose, onAdd }: { kg: number; onClose: () => void; onAdd: (name: string, minutes: number, kcal: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [minutes, setMinutes] = useState('30');
  const [custom, setCustom] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const isCustom = idx === -1;
  const mins = parseFloat(minutes) || 0;
  // Net calories: (MET − 1) excludes the resting burn already counted in your TDEE.
  const estimate = isCustom ? parseFloat(manualKcal) || 0 : ((EXERCISES[idx].met - 1) * 3.5 * kg * mins) / 200;
  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <label className="field">
        <span>Activity</span>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
          {EXERCISES.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
          <option value={-1}>Other / from my watch</option>
        </select>
      </label>
      {isCustom && <label className="field"><span>Name</span><input type="text" value={custom} onChange={(e) => setCustom(e.target.value)} /></label>}
      <div className="grid2">
        <label className="field"><span>Minutes</span><input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
        {isCustom && <label className="field"><span>Calories burned</span><input type="number" inputMode="numeric" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} /></label>}
      </div>
      <p className="muted">≈ <b className="num">{Math.round(estimate)}</b> kcal{!isCustom && ' (net, estimated from your weight)'}</p>
      <button className="btn primary block" disabled={estimate <= 0} onClick={() => onAdd(isCustom ? custom.trim() || 'Exercise' : EXERCISES[idx].name, mins, estimate)}>
        Add exercise
      </button>
    </Sheet>
  );
}

export function WeightSheet(props: { unit: 'kg' | 'st' | 'lb'; initialKg: number; onClose: () => void; onSave: (kg: number) => void; onDelete?: () => void }) {
  const { unit } = props;
  const initLb = kgToUnit(props.initialKg, 'lb');
  const [a, setA] = useState(unit === 'kg' ? props.initialKg.toFixed(1) : unit === 'lb' ? initLb.toFixed(1) : String(Math.floor(initLb / 14)));
  const [b, setB] = useState(unit === 'st' ? (initLb - Math.floor(initLb / 14) * 14).toFixed(1) : '');
  const kg = unit === 'kg' ? parseFloat(a) : unit === 'lb' ? lbToKg(parseFloat(a)) : stLbToKg(parseFloat(a) || 0, parseFloat(b) || 0);
  return (
    <Sheet title="Log weight" onClose={props.onClose}>
      {unit === 'st' ? (
        <div className="grid2">
          <label className="field"><span>Stone</span><input type="number" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} /></label>
          <label className="field"><span>Pounds</span><input type="number" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} /></label>
        </div>
      ) : (
        <label className="field"><span>Weight ({unit})</span><input type="number" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} /></label>
      )}
      <button className="btn primary block" disabled={!(kg > 20 && kg < 400)} onClick={() => props.onSave(kg)}>Save</button>
      {props.onDelete && <button className="btn ghost danger block" style={{ marginTop: 8 }} onClick={props.onDelete}>Delete weigh-in</button>}
    </Sheet>
  );
}
