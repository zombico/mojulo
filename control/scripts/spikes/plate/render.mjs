#!/usr/bin/env node
// Render the plate spike's subjects: node scripts/spikes/plate/render.mjs --out <dir> [subject…] [--finish wash|engraving|woodcut] [--res 2]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPlate, FINISHES } from './plate.js';
import { SUBJECTS } from './subjects.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const out = flag('out', 'plate-out');
const res = Number(flag('res', 2));
const finishes = flag('finish', Object.keys(FINISHES).join(',')).split(',');
const construction = args.includes('--construction') && args.splice(args.indexOf('--construction'), 1);
const names = args.length ? args : Object.keys(SUBJECTS);
mkdirSync(out, { recursive: true });
for (const name of names) for (const finish of finishes) {
  const t = performance.now();
  const { svg, stats } = renderPlate({ ...SUBJECTS[name], finish, construction: Boolean(construction) }, { res });
  const file = join(out, `${name}-${finish}.svg`);
  writeFileSync(file, svg);
  console.log(`${file}  ${Math.round(performance.now() - t)} ms  ${(stats.bytes / 1024).toFixed(1)} kB`);
}
