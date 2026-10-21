import type { Nutrients } from '../lib/types';
import type { Targets } from '../lib/nutrition';

const ROWS = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)' },
] as const;

export function MacroBars({ totals, targets }: { totals: Nutrients; targets: Targets }) {
  return (
    <div>
      {ROWS.map((r) => {
        const got = totals[r.key];
        const goal = targets[r.key];
        const pct = goal > 0 ? Math.min(100, (got / goal) * 100) : 0;
        return (
          <div className="macro" key={r.key}>
            <div className="row between">
              <span className="row">
                <i className="swatch" style={{ background: r.color }} /> {r.label}
              </span>
              <span className="num muted">
                {Math.round(got)} / {Math.round(goal)} g
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${pct}%`, background: r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
