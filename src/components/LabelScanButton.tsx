import { useRef, useState } from 'react';
import type { LabelScan } from '../lib/ocr';

/** Take or choose a photo of a nutrition table and read it on-device. */
export function LabelScanButton({ onResult }: { onResult: (scan: LabelScan) => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const { scanLabel } = await import('../lib/ocr');
      onResult(await scanLabel(file, setProgress));
    } catch (e) {
      setError(`Couldn’t read the photo (${(e as Error).message}).`);
    } finally {
      setProgress(null);
      if (camRef.current) camRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="grow">
          <strong>Scan the nutrition label</strong>
          <div className="faint">Photograph the table, flat and well lit — values fill in for you.</div>
        </div>
        <div className="row">
          <button className="btn primary small" disabled={progress !== null} onClick={() => camRef.current?.click()}>📷 Take photo</button>
          <button className="btn small" disabled={progress !== null} onClick={() => fileRef.current?.click()}>Choose</button>
        </div>
      </div>
      {progress !== null && (
        <div style={{ marginTop: 10 }}>
          <div className="faint">Reading label… {Math.round(progress * 100)}% (first scan loads the reader, ~6 MB)</div>
          <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${Math.max(4, progress * 100)}%`, background: 'var(--accent)' }} /></div>
        </div>
      )}
      {error && <p className="note warn">{error}</p>}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => run(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => run(e.target.files?.[0])} />
    </div>
  );
}
