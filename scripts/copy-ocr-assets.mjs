// Copies the Tesseract OCR worker, WebAssembly core and English model into public/ocr so the
// nutrition-label scanner is served from our own origin: no CDN, works offline once cached.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const out = fileURLToPath(new URL('../public/ocr/', import.meta.url));
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

copyFileSync(join(pkgDir('tesseract.js'), 'dist/worker.min.js'), join(out, 'worker.min.js'));
const core = pkgDir('tesseract.js-core');
// LSTM-only builds are all the default OCR engine mode needs; tesseract.js picks SIMD at runtime.
for (const f of readdirSync(core).filter((f) => /lstm\.wasm\.js$/.test(f))) copyFileSync(join(core, f), join(out, 'core', f));
// "best_int" is the accurate-but-compact English model (~3 MB).
const lang = join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz');
if (!existsSync(lang)) throw new Error(`OCR language data not found at ${lang}`);
copyFileSync(lang, join(out, 'lang/eng.traineddata.gz'));
console.log('OCR assets copied to public/ocr');
