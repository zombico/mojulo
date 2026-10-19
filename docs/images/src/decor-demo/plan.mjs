// The floor plan the homeowner uploads: house.json drawn by mojulo itself as its ground-floor plan sheet (A-101),
// cropped to the drawing, so it reads as the plan a buyer is handed. The agent only ever sees the picture.
//
//   node docs/images/src/decor-demo/plan.mjs <workDir>      # writes <workDir>/floor-plan.png
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJson, snapHtml } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// the drawing on the 1700 × 1100 sheet, dimensions and window tags included, title block left out (this house's)
const SHEET = { width: 1700, height: 1100 }, CROP = 'crop=840:690:285:150';

export async function drawPlan(work) {
  const data = path.join(work, 'plan-data');
  rmSync(data, { recursive: true, force: true });
  const env = { ...process.env, MOJULO_DATA_DIR: data, MOJULO_OUTCOMES_DIR: path.join(data, 'outcomes') };
  mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });
  const house = JSON.parse(readFileSync(path.join(here, 'house.json'), 'utf8'));
  for (const [tool, args] of [['mint_building', house], ['export_model', { ref: house.ref, format: 'sheets' }]]) {
    const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
    if (res.ok === false || res.code) throw new Error(`${tool}: ${res.error || res.reason}`);
  }
  const sheet = path.join(work, 'A-101.png'), out = path.join(work, 'floor-plan.png');
  await snapHtml(path.join(env.MOJULO_OUTCOMES_DIR, house.ref, 'sheets', 'A-101.svg'), sheet, SHEET);
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', sheet, '-vf', CROP, out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed on the plan crop');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await drawPlan(path.resolve(process.argv[2] || '.')));
