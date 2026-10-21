import { useEffect, useRef, useState } from 'react';

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => DetectorLike;
  }
}

/**
 * Camera barcode scanner. Uses the native BarcodeDetector (Chrome/Android) when available
 * and falls back to ZXing (needed on iOS Safari).
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    let stopped = false;
    let cleanup: () => void = () => {};
    const done = (code: string) => {
      if (stopped) return;
      stopped = true;
      cleanup();
      onDetected(code);
    };

    (async () => {
      try {
        const video = videoRef.current!;
        if (window.BarcodeDetector) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (stopped) return stream.getTracks().forEach((t) => t.stop());
          video.srcObject = stream;
          await video.play();
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          let raf = 0;
          const tick = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              if (codes[0]) return done(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(tick);
          };
          cleanup = () => {
            cancelAnimationFrame(raf);
            stream.getTracks().forEach((t) => t.stop());
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
            if (result) done(result.getText());
          });
          cleanup = () => controls.stop();
          if (stopped) cleanup();
        }
      } catch (e) {
        setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'Could not start the camera.');
      }
    })();

    return () => {
      stopped = true;
      cleanup();
    };
  }, [onDetected]);

  return (
    <div className="scanner">
      {error ? <p className="note warn">{error} You can type the barcode instead.</p> : <video ref={videoRef} muted playsInline />}
      <form
        className="row"
        style={{ marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onDetected(manual.trim());
        }}
      >
        <input type="text" inputMode="numeric" placeholder="Or enter barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn" type="submit">
          Look up
        </button>
      </form>
    </div>
  );
}
