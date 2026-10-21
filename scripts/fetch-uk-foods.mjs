// Downloads the latest CoFID (McCance & Widdowson's Composition of Foods Integrated Dataset)
// from GOV.UK and converts it into src/data/cofid.json via import-cofid.mjs.
//
//   npm run fetch:uk-foods
//
// Uses the GOV.UK Content API to find the current .xlsx attachment, so it keeps working when a
// new edition is published. Behind a proxy on Node 22, run with NODE_USE_ENV_PROXY=1.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PAGE = 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid';
const API = PAGE.replace('https://www.gov.uk/', 'https://www.gov.uk/api/content/');

async function findXlsxUrl() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`GOV.UK content API returned ${res.status}`);
  const json = await res.json();
  const attachments = [...(json.details?.attachments ?? []), ...(json.details?.documents ?? [])];
  // attachments are objects with url; "documents" are HTML snippets containing links.
  const urls = attachments.flatMap((a) =>
    typeof a === 'string' ? [...a.matchAll(/href="([^"]+\.xlsx)"/g)].map((m) => m[1]) : a.url ? [a.url] : [],
  );
  const xlsx = urls.filter((u) => /\.xlsx$/i.test(u));
  // Prefer the main integrated dataset over the user guide / factors workbooks.
  return xlsx.find((u) => /integrated|cofid/i.test(u) && !/factor|guide/i.test(u)) ?? xlsx[0];
}

let url;
try {
  url = await findXlsxUrl();
} catch (e) {
  console.error(`Could not reach GOV.UK (${e.cause?.message ?? e.message}).`);
  console.error(`Check your connection / proxy allow-list for www.gov.uk and assets.publishing.service.gov.uk,`);
  console.error(`or download the workbook from ${PAGE} and run: npm run import:cofid -- <file>`);
  process.exit(1);
}
if (!url) {
  console.error(`No .xlsx attachment found. Download it manually from ${PAGE} and run: npm run import:cofid -- <file>`);
  process.exit(1);
}
console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed (${res.status})`);
const rawDir = fileURLToPath(new URL('../data/raw/', import.meta.url));
mkdirSync(rawDir, { recursive: true });
const file = `${rawDir}cofid.xlsx`;
writeFileSync(file, Buffer.from(await res.arrayBuffer()));
execFileSync(process.execPath, [fileURLToPath(new URL('./import-cofid.mjs', import.meta.url)), file], { stdio: 'inherit' });
