import { useMemo, useRef, useState } from 'react';
import { todayISO } from '../lib/dates';
import { WeightInput } from '../components/MeasureInputs';
import { DEFAULT_PROFILE, useStore } from '../lib/store';
import { computePlan } from '../lib/targets';
import type { AppData, Profile } from '../lib/types';

export function Settings({ onboarding = false, onDone, onBack }: { onboarding?: boolean; onDone?: () => void; onBack?: () => void }) {
  const store = useStore();
  const { data } = store;
  const [p, setP] = useState<Profile>(data.profile ?? DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => computePlan({ ...data, profile: p }, todayISO()), [data, p]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: v }));
  };
  const rateOptions = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5];

  const save = () => {
    store.setProfile(p);
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
      <div className="topbar">
        {onBack && <button className="btn ghost small" onClick={onBack}>← Profile</button>}
        <h1 className="grow">{onboarding ? 'Your goal' : 'Goals & settings'}</h1>
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
