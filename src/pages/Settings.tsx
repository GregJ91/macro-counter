import { useMemo, useRef, useState } from 'react';
import { todayISO } from '../lib/dates';
import { ACTIVITY_FACTORS } from '../lib/nutrition';
import { useStore } from '../lib/store';
import { computePlan } from '../lib/targets';
import type { ActivityLevel, AppData, Profile, WeightUnit } from '../lib/types';
import { kgToUnit, lbToKg, stLbToKg } from '../lib/units';

const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 35,
  heightCm: 175,
  activity: 'light',
  weightUnit: 'st',
  goalKg: 75,
  rateKgPerWeek: -0.5,
  proteinGPerKg: 1.8,
  fatPct: 30,
  eatBackExercise: false,
  calorieOverride: null,
};

/** Weight input that speaks the user's unit (stones & pounds, lb or kg) but stores kg. */
function WeightInput({ kg, unit, onChange }: { kg: number; unit: WeightUnit; onChange: (kg: number) => void }) {
  const lb = kgToUnit(kg, 'lb');
  if (unit === 'st') {
    const st = Math.floor(lb / 14);
    return (
      <div className="grid2">
        <input type="number" inputMode="numeric" aria-label="stone" value={st} onChange={(e) => onChange(stLbToKg(Number(e.target.value) || 0, lb - st * 14))} />
        <input type="number" inputMode="decimal" aria-label="pounds" value={Math.round((lb - st * 14) * 10) / 10} onChange={(e) => onChange(stLbToKg(st, Number(e.target.value) || 0))} />
      </div>
    );
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      value={Math.round((unit === 'kg' ? kg : lb) * 10) / 10}
      onChange={(e) => onChange(unit === 'kg' ? Number(e.target.value) : lbToKg(Number(e.target.value)))}
    />
  );
}

export function Settings({ onboarding = false, onDone }: { onboarding?: boolean; onDone?: () => void }) {
  const store = useStore();
  const { data } = store;
  const [p, setP] = useState<Profile>(data.profile ?? DEFAULT_PROFILE);
  const [startKg, setStartKg] = useState(data.weights[data.weights.length - 1]?.kg ?? 85);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => computePlan({ ...data, profile: p, weights: data.weights.length ? data.weights : [{ date: todayISO(), kg: startKg }] }, todayISO()),
    [data, p, startKg],
  );

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: v }));
  };
  const rateOptions = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5];

  const save = () => {
    store.setProfile(p);
    if (onboarding && data.weights.length === 0) store.setWeight({ date: todayISO(), kg: startKg });
    setSaved(true);
    onDone?.();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `macro-counter-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (parsed.version !== 1 || !Array.isArray(parsed.diary)) throw new Error('Not a Macro Counter backup');
      if (confirm('Replace all current data with this backup?')) {
        store.replaceAll(parsed);
        if (parsed.profile) setP(parsed.profile);
      }
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="topbar"><h1>{onboarding ? 'Welcome — let’s set you up' : 'Settings'}</h1></div>

      <div className="card">
        <h2>About you</h2>
        <div className="grid2">
          <label className="field">
            <span>Sex (for BMR formula)</span>
            <select value={p.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="field"><span>Age</span><input type="number" inputMode="numeric" value={p.age} onChange={(e) => set('age', Number(e.target.value))} /></label>
          <label className="field"><span>Height (cm)</span><input type="number" inputMode="numeric" value={p.heightCm} onChange={(e) => set('heightCm', Number(e.target.value))} /></label>
          <label className="field">
            <span>Weight units</span>
            <select value={p.weightUnit} onChange={(e) => set('weightUnit', e.target.value as WeightUnit)}>
              <option value="st">Stones & pounds</option>
              <option value="kg">Kilograms</option>
              <option value="lb">Pounds</option>
            </select>
          </label>
        </div>
        {onboarding && data.weights.length === 0 && (
          <label className="field"><span>Current weight {p.weightUnit === 'st' ? '(st, lb)' : `(${p.weightUnit})`}</span><WeightInput kg={startKg} unit={p.weightUnit} onChange={setStartKg} /></label>
        )}
        <label className="field">
          <span>Activity level (excluding logged workouts)</span>
          <select value={p.activity} onChange={(e) => set('activity', e.target.value as ActivityLevel)}>
            {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Goal</h2>
        <label className="field"><span>Goal weight {p.weightUnit === 'st' ? '(st, lb)' : `(${p.weightUnit})`}</span><WeightInput kg={p.goalKg} unit={p.weightUnit} onChange={(kg) => set('goalKg', kg)} /></label>
        <label className="field">
          <span>Weekly rate</span>
          <select value={rateOptions.includes(p.rateKgPerWeek) ? p.rateKgPerWeek : 'custom'} onChange={(e) => e.target.value !== 'custom' && set('rateKgPerWeek', Number(e.target.value))}>
            {rateOptions.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'Maintain' : `${r < 0 ? 'Lose' : 'Gain'} ${Math.abs(r)} kg (${(Math.abs(r) / 0.4536).toFixed(1)} lb) / week`}
              </option>
            ))}
            {!rateOptions.includes(p.rateKgPerWeek) && <option value="custom">Custom from planner: {p.rateKgPerWeek.toFixed(2)} kg/week</option>}
          </select>
        </label>
        <div className="grid2">
          <label className="field"><span>Protein (g per kg body weight)</span><input type="number" step="0.1" inputMode="decimal" value={p.proteinGPerKg} onChange={(e) => set('proteinGPerKg', Number(e.target.value))} /></label>
          <label className="field"><span>Fat (% of calories)</span><input type="number" inputMode="numeric" value={p.fatPct} onChange={(e) => set('fatPct', Number(e.target.value))} /></label>
        </div>
        <label className="field">
          <span>Calorie target override (leave blank for automatic)</span>
          <input type="number" inputMode="numeric" value={p.calorieOverride ?? ''} placeholder="Automatic" onChange={(e) => set('calorieOverride', e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label className="row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={p.eatBackExercise} onChange={(e) => set('eatBackExercise', e.target.checked)} />
          <span>Add logged exercise calories to my daily budget</span>
        </label>
        {preview && (
          <p className="note">
            Daily target: <b>{Math.round(preview.targets.kcal)} kcal</b> · P {Math.round(preview.targets.protein)} g · C {Math.round(preview.targets.carbs)} g · F {Math.round(preview.targets.fat)} g
          </p>
        )}
      </div>

      <button className="btn primary block" onClick={save}>{onboarding ? 'Start tracking' : saved ? 'Saved ✓' : 'Save settings'}</button>

      {!onboarding && (
        <div className="card">
          <h2>Your data</h2>
          <p className="faint">Everything is stored on this device only. Export a backup regularly, or to move to another phone.</p>
          <div className="row">
            <button className="btn" onClick={exportData}>Export backup</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </div>
          <p className="faint" style={{ marginBottom: 0 }}>
            Food data: UK generic values (McCance & Widdowson / CoFID style) and branded products from{' '}
            <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL).
          </p>
        </div>
      )}
    </>
  );
}
