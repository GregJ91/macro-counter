import { useMemo, useState } from 'react';
import { HeightInput, WeightInput } from '../components/MeasureInputs';
import { todayISO } from '../lib/dates';
import { activityFactor, activityLabel, bmr, LIFESTYLES, TRAINING_TYPES } from '../lib/nutrition';
import { DEFAULT_PROFILE, useStore } from '../lib/store';
import { computePlan } from '../lib/targets';
import type { HeightUnit, Lifestyle, Profile as ProfileT, TrainingType, WeightUnit } from '../lib/types';
import { formatWeight } from '../lib/units';

export function Profile({ onboarding = false, onDone, onOpenSettings }: { onboarding?: boolean; onDone?: () => void; onOpenSettings?: () => void }) {
  const store = useStore();
  const { data } = store;
  const [p, setP] = useState<ProfileT>(data.profile ?? DEFAULT_PROFILE);
  const [startKg, setStartKg] = useState(data.weights[data.weights.length - 1]?.kg ?? 85);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof ProfileT>(k: K, v: ProfileT[K]) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: v }));
  };

  const weights = useMemo(() => (data.weights.length ? data.weights : [{ date: todayISO(), kg: startKg }]), [data.weights, startKg]);
  const plan = useMemo(() => computePlan({ ...data, profile: p, weights }, todayISO()), [data, p, weights]);
  const af = activityFactor(p);
  const kg = plan?.currentKg ?? startKg;
  const lifestyle = LIFESTYLES[p.lifestyle];

  const save = () => {
    store.setProfile(onboarding ? { ...p, goalKg: Math.round((startKg - 5) * 10) / 10 } : p);
    if (onboarding && data.weights.length === 0) store.setWeight({ date: todayISO(), kg: startKg });
    setSaved(true);
    onDone?.();
  };

  return (
    <>
      <div className="topbar">
        <h1>{onboarding ? 'Welcome — tell us about you' : p.name ? `Hi, ${p.name}` : 'Profile'}</h1>
        {onOpenSettings && (
          <button className="btn small" onClick={onOpenSettings}>Goals & settings</button>
        )}
      </div>

      <div className="card">
        <h2>About you</h2>
        <label className="field"><span>Name (optional)</span><input type="text" value={p.name} onChange={(e) => set('name', e.target.value)} /></label>
        <div className="grid2">
          <label className="field">
            <span>Sex (for BMR formula)</span>
            <select value={p.sex} onChange={(e) => set('sex', e.target.value as ProfileT['sex'])}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="field"><span>Age</span><input type="number" inputMode="numeric" value={p.age} onChange={(e) => set('age', Number(e.target.value))} /></label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>Height units</span>
            <select value={p.heightUnit} onChange={(e) => set('heightUnit', e.target.value as HeightUnit)}>
              <option value="ftin">Feet & inches</option>
              <option value="cm">Centimetres</option>
            </select>
          </label>
          <label className="field">
            <span>Weight units</span>
            <select value={p.weightUnit} onChange={(e) => set('weightUnit', e.target.value as WeightUnit)}>
              <option value="st">Stones & pounds</option>
              <option value="kg">Kilograms</option>
              <option value="lb">Pounds</option>
            </select>
          </label>
        </div>
        <label className="field"><span>Height {p.heightUnit === 'ftin' ? '(ft, in)' : '(cm)'}</span><HeightInput cm={p.heightCm} unit={p.heightUnit} onChange={(cm) => set('heightCm', cm)} /></label>
        {onboarding && data.weights.length === 0 ? (
          <label className="field"><span>Current weight {p.weightUnit === 'st' ? '(st, lb)' : `(${p.weightUnit})`}</span><WeightInput kg={startKg} unit={p.weightUnit} onChange={setStartKg} /></label>
        ) : (
          <p className="faint">Current trend weight: {formatWeight(kg, p.weightUnit)} — log new weigh-ins from the Diary or Progress tab.</p>
        )}
      </div>

      <div className="card">
        <h2>Daily life <small>outside of workouts</small></h2>
        <div className="segmented wrap" role="group" aria-label="Lifestyle">
          {(Object.keys(LIFESTYLES) as Lifestyle[]).map((k) => (
            <button key={k} aria-pressed={p.lifestyle === k} onClick={() => set('lifestyle', k)}>{LIFESTYLES[k].label}</button>
          ))}
        </div>
        <p className="faint">{lifestyle.hint}. Assumes about {lifestyle.baselineSteps.toLocaleString('en-GB')} steps a day.</p>
      </div>

      <div className="card">
        <h2>Exercise</h2>
        <div className="grid2">
          <label className="field">
            <span>Workouts per week</span>
            <input type="number" inputMode="numeric" min={0} max={14} value={p.workoutsPerWeek} onChange={(e) => set('workoutsPerWeek', Math.max(0, Number(e.target.value)))} />
          </label>
          <label className="field">
            <span>Typical session (minutes)</span>
            <input type="number" inputMode="numeric" min={0} step={5} value={p.workoutMinutes} onChange={(e) => set('workoutMinutes', Math.max(0, Number(e.target.value)))} />
          </label>
        </div>
        <label className="field">
          <span>Main type of training</span>
          <select value={p.trainingType} onChange={(e) => set('trainingType', e.target.value as TrainingType)}>
            {(Object.keys(TRAINING_TYPES) as TrainingType[]).map((k) => <option key={k} value={k}>{TRAINING_TYPES[k].label}</option>)}
          </select>
        </label>
        <p className="faint">Suggested protein for {TRAINING_TYPES[p.trainingType].label.toLowerCase()}: {TRAINING_TYPES[p.trainingType].proteinHint} (yours: {p.proteinGPerKg} g/kg).</p>
      </div>

      <div className="card">
        <h2>Steps</h2>
        <label className="field">
          <span>Daily step goal</span>
          <input type="number" inputMode="numeric" step={500} min={0} value={p.dailyStepGoal} onChange={(e) => set('dailyStepGoal', Math.max(0, Number(e.target.value)))} />
        </label>
        <p className="faint">
          Log your steps each day in the Diary. Steps above ~{lifestyle.baselineSteps.toLocaleString('en-GB')} count as extra burn
          (~{Math.round(1000 * kg * 0.0005)} kcal per 1,000 steps at your weight).
        </p>
      </div>

      <div className="card">
        <h2>Your activity <small>{activityLabel(af)}</small></h2>
        <div className="stat-grid">
          <div className="stat"><b>{Math.round(bmr(p, kg))}</b><span>BMR — calories at complete rest</span></div>
          <div className="stat"><b>× {af.toFixed(2)}</b><span>Activity factor</span></div>
          <div className="stat"><b>{plan ? Math.round(plan.expenditure.formula) : '—'}</b><span>Estimated maintenance (kcal)</span></div>
          <div className="stat"><b>{plan ? Math.round(plan.targets.kcal) : '—'}</b><span>Your daily target (kcal)</span></div>
        </div>
        {plan && plan.expenditure.adaptive !== null && (
          <p className="faint" style={{ marginBottom: 0 }}>Your logged data puts your real maintenance at ~{Math.round(plan.expenditure.adaptive)} kcal, so your target leans on that.</p>
        )}
      </div>

      <button className="btn primary block" onClick={save}>{onboarding ? 'Next: set your goal' : saved ? 'Saved ✓' : 'Save profile'}</button>
    </>
  );
}
