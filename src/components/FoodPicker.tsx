import { useState } from 'react';
import type { Food } from '../lib/types';
import { CreateFood, FoodList, ScanTab, SearchTab, useFoodPools } from './AddFood';
import { FoodDetail } from './FoodDetail';
import { Sheet } from './Sheet';

type Tab = 'search' | 'recent' | 'scan' | 'create';

/** Pick any food and an amount — used for recipe ingredients and saved-meal items. */
export function FoodPicker({ title, onPick, onClose, excludeId }: { title: string; onPick: (food: Food, grams: number) => void; onClose: () => void; excludeId?: string }) {
  const [tab, setTab] = useState<Tab>('search');
  const [selected, setSelected] = useState<Food | null>(null);
  const { recent, searchPool } = useFoodPools();
  // A recipe can't contain itself.
  const pool = excludeId ? searchPool.filter((f) => f.id !== excludeId) : searchPool;

  return (
    <Sheet title={title} onClose={onClose}>
      {selected ? (
        <>
          <button className="btn ghost small" onClick={() => setSelected(null)} style={{ marginBottom: 8 }}>← Back</button>
          <FoodDetail key={selected.id} food={selected} meal="snacks" hideMeal confirmLabel="Add" onConfirm={(grams) => onPick(selected, grams)} onCorrected={setSelected} />
        </>
      ) : (
        <>
          <div className="segmented" role="group">
            {(
              [
                ['search', 'Search'],
                ['recent', 'Recent'],
                ['scan', 'Scan'],
                ['create', 'Create'],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {tab === 'search' && <SearchTab onPick={setSelected} customFoods={pool} />}
            {tab === 'recent' && (recent.length ? <FoodList foods={recent} onPick={setSelected} /> : <p className="muted">Foods you log will show here.</p>)}
            {tab === 'scan' && <ScanTab onPick={setSelected} />}
            {tab === 'create' && <CreateFood onCreated={setSelected} />}
          </div>
        </>
      )}
    </Sheet>
  );
}
