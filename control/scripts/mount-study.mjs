#!/usr/bin/env node
// mount-study — the eyes gate's contact sheets for a mount: each gait as a row of stick poses at even phases of its
// stride, the footfall diagram under it, the machine gates' verdicts printed beside. `--before` draws the fauna horse's
// gaits the same way (the sheet the mount is compared against). PNG through headless Chromium ($MOJULO_CHROMIUM or the usual
// places) when `--png`.
//
//   node scripts/mount-study.mjs <outDir> [--register realistic|stylized] [--gaits walk,trot,canter,gallop,reinBack]
//        [--lead right|left] [--cols 8] [--before] [--png]
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolveMount } from '../lib/graph/mount/build.js';
import { gaitCycle } from '../lib/graph/mount/gait.js';
import { contactSheet } from '../lib/graph/mount/sheet.js';
import { gaitGates } from '../lib/graph/mount/gates.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const register = opt('register', 'realistic'), lead = opt('lead', 'right'), cols = Number(opt('cols', 8));
const gaits = opt('gaits', 'walk,trot,canter,gallop,reinBack').split(',');
const before = flag('before'), png = flag('png');
const outDir = args[0] || '.';
mkdirSync(outDir, { recursive: true });

const files = [];
const B = resolveMount('horse', { register });
const rows = [], report = [];
for (const g of gaits) {
  const c = gaitCycle(B, g, { lead });
  const frames = Array.from({ length: cols }, (_, i) => c.poseAt(i / cols));
  const footfalls = {};
  for (const l of c.limbs) footfalls[l.id] = Array.from({ length: 192 }, (_, n) => c.poseAt(n / 192).contact[l.id]);
  const gates = gaitGates(B, c);
  const failed = gates.checks.filter((x) => !x.pass).map((x) => x.name);
  rows.push({ label: g, sub: `${c.speed.toFixed(1)} m/s · ${c.f.toFixed(2)} Hz · stride ${Math.abs(c.L).toFixed(2)} m · duty ${c.duty.toFixed(2)} · machine gate ${failed.length ? 'FAILS ' + failed.join(', ') : 'passes'}`, frames, footfalls });
  report.push({ gait: g, ...gates });
}
const name = `mount-horse-${register}${lead === 'left' ? '-left' : ''}`;
writeFileSync(path.join(outDir, `${name}.svg`), contactSheet(rows, { title: `the mount: a horse, ${register} (lead ${lead})` }));
writeFileSync(path.join(outDir, `${name}.gates.json`), JSON.stringify(report, null, 2));
files.push(`${name}.svg`);
for (const r of report) {
  console.log(`${r.gait}: ${r.checks.every((x) => x.pass) ? 'passes' : 'FAILS'}`);
  for (const x of r.checks) console.log(`  ${x.pass ? 'ok  ' : 'FAIL'} ${x.name}: ${x.saw}${x.want ? ` (want ${x.want})` : ''}`);
}

if (before) {
  const { gaitFrames } = await import('../lib/graph/fauna/gait.js');
  const brows = [];
  for (const g of ['walk', 'trot', 'canter', 'gallop']) {
    const fr = gaitFrames('horse', g, cols).map((p) => ({ bones: p.bones, ground: p.ground }));
    brows.push({ label: g, sub: 'the fauna horse (fauna/gait.js), before', frames: fr });
  }
  writeFileSync(path.join(outDir, 'fauna-horse-before.svg'), contactSheet(brows, { title: 'before: the fauna horse' }));
  files.push('fauna-horse-before.svg');
}

if (png) {
  const { default: puppeteer } = await import('puppeteer-core');
  const exe = [process.env.MOJULO_CHROMIUM, process.env.PUPPETEER_EXECUTABLE_PATH, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium']
    .find((p) => p && existsSync(p));
  if (!exe) throw new Error('mount-study: no Chromium for --png (set MOJULO_CHROMIUM)');
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  for (const f of files) {
    await page.goto('file://' + path.resolve(outDir, f));
    const el = await page.$('svg');
    await el.screenshot({ path: path.join(outDir, f.replace(/\.svg$/, '.png')) });
  }
  await browser.close();
}
console.log('wrote', files.map((f) => path.join(outDir, f)).join(', '));
