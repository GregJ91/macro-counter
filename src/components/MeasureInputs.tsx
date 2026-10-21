import type { HeightUnit, WeightUnit } from '../lib/types';
import { kgToUnit, lbToKg, stLbToKg } from '../lib/units';

/** Weight input that speaks the user's unit (stones & pounds, lb or kg) but stores kg. */
export function WeightInput({ kg, unit, onChange }: { kg: number; unit: WeightUnit; onChange: (kg: number) => void }) {
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

const CM_PER_IN = 2.54;

export function HeightInput({ cm, unit, onChange }: { cm: number; unit: HeightUnit; onChange: (cm: number) => void }) {
  if (unit === 'cm') {
    return <input type="number" inputMode="numeric" value={Math.round(cm)} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  const totalIn = Math.round(cm / CM_PER_IN);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn - ft * 12;
  return (
    <div className="grid2">
      <input type="number" inputMode="numeric" aria-label="feet" value={ft} onChange={(e) => onChange(((Number(e.target.value) || 0) * 12 + inch) * CM_PER_IN)} />
      <input type="number" inputMode="numeric" aria-label="inches" value={inch} onChange={(e) => onChange((ft * 12 + (Number(e.target.value) || 0)) * CM_PER_IN)} />
    </div>
  );
}

export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
}
