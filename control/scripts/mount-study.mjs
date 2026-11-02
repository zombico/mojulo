#!/usr/bin/env node
// mount-study — the eyes gate's contact sheets for a mount: each gait as a row of stick poses at even phases of its
// stride, the footfall diagram under it, the machine gates' verdicts printed beside. `--before` draws the fauna horse's
// gaits the same way (the sheet the mount is compared against). PNG through headless Chromium ($MOJULO_CHROMIUM or the usual
// places) when `--png`.
//
//   node scripts/mount-study.mjs <outDir> [--register realistic|stylized] [--gaits walk,trot,canter,gallop,reinBack]
//        [--lead right|left] [--view side|front] [--cols 8] [--before] [--shots] [--jump] [--idle] [--png]
// `--shots` adds the one-shots' sheet (changes of gait, the halts, the move off); `--jump` the jump's; `--idle` the rest's.
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolveMount } from '../lib/graph/mount/build.js';
import { gaitCycle } from '../lib/graph/mount/gait.js';
import { contactSheet } from '../lib/graph/mount/sheet.js';
import { gaitGates, shotGates, jumpGates } from '../lib/graph/mount/gates.js';
import { jumpClip } from '../lib/graph/mount/jump.js';
import { idleClip, idleLayer, grazeClip, IDLE_LAYERS } from '../lib/graph/mount/idle.js';
import { idleGates } from '../lib/graph/mount/gates.js';
import { oneShot } from '../lib/graph/mount/motion.js';
import { standPose } from '../lib/graph/mount/gait.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const register = opt('register', 'realistic'), lead = opt('lead', 'right'), cols = Number(opt('cols', 8)), view = opt('view', 'side');
const gaits = opt('gaits', 'walk,trot,canter,gallop,reinBack').split(',');
const before = flag('before'), png = flag('png'), shots = flag('shots'), jumps = flag('jump'), idles = flag('idle');
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
const name = `mount-horse-${register}${lead === 'left' ? '-left' : ''}${view === 'front' ? '-front' : ''}`;
writeFileSync(path.join(outDir, `${name}.svg`), contactSheet(rows, { title: `the mount: a horse, ${register} (lead ${lead}, ${view})`, view, ...(view === 'front' ? { cellW: 150 } : {}) }));
writeFileSync(path.join(outDir, `${name}.gates.json`), JSON.stringify(report, null, 2));
files.push(`${name}.svg`);
for (const r of report) {
  console.log(`${r.gait}: ${r.checks.every((x) => x.pass) ? 'passes' : 'FAILS'}`);
  for (const x of r.checks) console.log(`  ${x.pass ? 'ok  ' : 'FAIL'} ${x.name}: ${x.saw}${x.want ? ` (want ${x.want})` : ''}`);
}

if (shots) {
  // the one-shots: each as poses at even times over its run, its footfalls under it, its gate beside it
  const srows = [], sreport = [], stand = standPose(B);
  for (const [from, to] of [['stand', 'walk'], ['walk', 'trot'], ['trot', 'canter'], ['canter', 'gallop'], ['gallop', 'canter'], ['canter', 'trot'], ['trot', 'walk'], ['walk', 'stand'], ['trot', 'stand']]) {
    const c = oneShot(B, { from, to, lead });
    const k = 10, frames = Array.from({ length: k }, (_, i) => c.poseAt(c.duration * i / (k - 1)));
    const footfalls = {};
    for (const id of ['LF', 'RF', 'LH', 'RH']) footfalls[id] = Array.from({ length: 240 }, (_, n) => c.poseAt(c.duration * n / 239).contact[id]);
    const g = shotGates(B, c, { stand }), failed = g.checks.filter((x) => !x.pass).map((x) => x.name);
    srows.push({ label: `${from} → ${to}`, sub: `${c.duration.toFixed(2)} s · ${c.rootAt(c.duration).toFixed(1)} m · machine gate ${failed.length ? 'FAILS ' + failed.join(', ') : 'passes'}`, frames, footfalls });
    sreport.push({ from, to, ...g });
    console.log(`${from} → ${to}: ${failed.length ? 'FAILS ' + failed.join(', ') : 'passes'}`);
  }
  const sname = `mount-horse-${register}-shots${view === 'front' ? '-front' : ''}`;
  writeFileSync(path.join(outDir, `${sname}.svg`), contactSheet(srows, { title: `the mount's one-shots, ${register} (lead ${lead}): even times over each`, view, cellW: view === 'front' ? 130 : 200 }));
  writeFileSync(path.join(outDir, `${sname}.gates.json`), JSON.stringify(sreport, null, 2));
  files.push(`${sname}.svg`);
}

if (jumps) {
  // the jump over an upright of three heights and an oxer: poses at even times from the take-off stride to the landing
  const jrows = [], jreport = [], stand = standPose(B);
  for (const [fence, spread] of [[0.8, 0], [1.1, 0], [1.3, 0], [1.1, 1.2]]) {
    const c = jumpClip(B, { fence, spread, lead });
    const a = c.flight.launch - 0.75, b = c.flight.touchdown + 0.55, k = 12;
    const frames = Array.from({ length: k }, (_, i) => c.poseAt(a + (b - a) * i / (k - 1)));
    const footfalls = {};
    for (const id of ['LF', 'RF', 'LH', 'RH']) footfalls[id] = Array.from({ length: 240 }, (_, n) => c.poseAt(a + (b - a) * n / 239).contact[id]);
    const g = jumpGates(B, c, { stand }), failed = g.checks.filter((x) => !x.pass).map((x) => x.name);
    jrows.push({ label: `jump ${fence} m${spread ? ` × ${spread} m` : ''}`, sub: `airtime ${c.flight.airtime.toFixed(2)} s over ${c.flight.distance.toFixed(1)} m · machine gate ${failed.length ? 'FAILS ' + failed.join(', ') : 'passes'}`, frames, footfalls });
    jreport.push({ fence, spread, ...g });
    console.log(`jump ${fence}${spread ? ' x ' + spread : ''}: ${failed.length ? 'FAILS ' + g.checks.filter((x) => !x.pass).map((x) => `${x.name}: ${x.saw}`).join(' | ') : 'passes'}`);
  }
  const jname = `mount-horse-${register}-jump`;
  writeFileSync(path.join(outDir, `${jname}.svg`), contactSheet(jrows, { title: `the mount's jump, ${register} (lead ${lead}): the take-off stride to the landing`, cellW: 190 }));
  writeFileSync(path.join(outDir, `${jname}.gates.json`), JSON.stringify(jreport, null, 2));
  files.push(`${jname}.svg`);
}

if (idles) {
  // the idle: all its layers together over the weight shift's loop, each layer alone, and grazing
  const irows = [];
  const row = (label, clip, k, loop) => {
    const frames = Array.from({ length: k }, (_, i) => clip.poseAt(clip.duration * i / k));
    const g = idleGates(B, clip, { loop }), failed = g.checks.filter((x) => !x.pass).map((x) => x.name);
    irows.push({ label, sub: `${clip.duration.toFixed(2)} s · machine gate ${failed.length ? 'FAILS ' + failed.join(', ') : 'passes'}`, frames });
    console.log(`${label}: ${failed.length ? 'FAILS ' + g.checks.filter((x) => !x.pass).map((x) => `${x.name}: ${x.saw}`).join(' | ') : 'passes'}`);
  };
  row('idle, every layer', idleClip(B, { seed: 3 }), 12, false);
  for (const name of Object.keys(IDLE_LAYERS)) row(`layer: ${name} (${IDLE_LAYERS[name].toFixed(2)} s loop)`, idleLayer(B, name, { seed: 3 }), 8, true);
  row('grazing: down, graze, up', grazeClip(B, { seed: 3 }), 10, false);
  const iname = `mount-horse-${register}-idle${view === 'front' ? '-front' : ''}`;
  writeFileSync(path.join(outDir, `${iname}.svg`), contactSheet(irows, { title: `the mount at rest, ${register}: the layers loop at 3 s × φⁿ`, view, cellW: view === 'front' ? 130 : 200 }));
  files.push(`${iname}.svg`);
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
