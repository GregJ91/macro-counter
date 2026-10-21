import { parseNutritionLabel, type ParsedLabel } from './labelParser';

/** Downscale/upscale to ~1600px wide, greyscale and stretch contrast — helps Tesseract on phone photos. */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(2, 1600 / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface LabelScan extends ParsedLabel {
  text: string;
}

/** OCR a photo of a nutrition table entirely on-device and parse it. */
export async function scanLabel(file: Blob, onProgress?: (p: number) => void): Promise<LabelScan> {
  const { createWorker } = await import('tesseract.js');
  const base = `${import.meta.env.BASE_URL}ocr/`;
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    logger: (m: { status: string; progress: number }) => m.status === 'recognizing text' && onProgress?.(m.progress),
  });
  try {
    const canvas = await prepare(file);
    const { data } = await worker.recognize(canvas);
    return { ...parseNutritionLabel(data.text), text: data.text };
  } finally {
    await worker.terminate();
  }
}
