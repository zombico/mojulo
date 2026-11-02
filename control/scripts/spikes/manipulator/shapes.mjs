#!/usr/bin/env node
// shapes — the manual manipulator's octopus boxer (lib/graph/polygonizer/hero-digits.js) on the realistic hero: every hand
// shape solved (each digit's reach error, its clearance from a primitive, the joints past a stop, the time), the poles
// against their hand words, the power grasp on hafts of several radii (each phalanx's clearance, the closure), and a
// pinch. Nothing changes.
//
//   node scripts/spikes/manipulator/shapes.mjs [--cast male|female] [--radii 0.012,0.02,0.03,0.04] [--sheet <dir>]
//
// --sheet renders the bind, each shape and two grips through the body-study skill (.claude/skills/body-study), cropped to
// the hand: the eyes gate's pictures.
import { register } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { validateRig } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const D = await import('@/lib/graph/polygonizer/hero-digits.js');

const { values: opt } = parseArgs({ options: { cast: { type: 'string', default: 'male' }, radii: { type: 'string', default: '0.012,0.02,0.03,0.04' }, sheet: { type: 'string' } } });
const female = opt.cast === 'female';
const R = validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: opt.cast, form: 'realistic' }) }).recipe.rig);
const box = D.handBox(R, 'R', { female });
const mm = (v) => +(v * 1000).toFixed(1);

console.log(`\n══ octopus boxer: ${opt.cast} (realistic), right hand ══ palm ${mm(box.palmLen)} × ${mm(box.breadth)} mm`);
const shapes = {};
for (const name of D.HAND_SHAPE_NAMES) {
  const t = performance.now(), sh = D.handShape(R, 'R', name, { female }), ms = performance.now() - t; shapes[name] = sh;
  const parts = Object.entries(sh.digits).map(([d, x]) => `${d}${x.err !== undefined ? ` ${mm(x.err)}` : ''}${x.gaps ? ` [${x.gaps.map(mm).join('/')}]` : ''}`).join('  ');
  const pole = D.HAND_SHAPES[name].pole ? (() => { const p = D.poleError(R, 'R', sh, undefined, { female }); return `  pole '${p.word}': fingers ≤ ${mm(Math.max(...D.FINGERS.map((d) => p.tips[d])))} mm, thumb ${mm(p.tips.thumb)} mm`; })() : '';
  console.log(`  ${name.padEnd(13)} ${String(Math.round(ms)).padStart(4)} ms  ${sh.past.length ? 'PAST ' + sh.past.join(', ') : 'in range'}   ${parts}${pole}`);
}
console.log('  (a reach: its error, mm; a close: each phalanx\'s clearance, mm, − pressed in)');
console.log('  power grasp on a haft laid in the palm:');
for (const r of opt.radii.split(',').map(Number)) {
  const g = D.grasp(R, box, 'power', D.inPalm(box, 'cylinder', r));
  console.log(`    r ${mm(r)} mm: ` + D.DIGITS.map((d) => `${d} [${g.digits[d].gaps.map(mm).join('/')}]`).join('  ') + `   index ${JSON.stringify(g.fingers.index)}`);
}
const pin = D.grasp(R, box, 'pinch', { kind: 'sphere', c: box.at(1.25 * box.palmLen, 0.45 * box.breadth, 0.045), r: 0.01 });
console.log('  pinch on a 20 mm ball: ' + ['index', 'thumb'].map((d) => `${d} ${mm(pin.digits[d].err)} mm, facing ${pin.digits[d].facing}°${pin.digits[d].past.length ? ' PAST ' + pin.digits[d].past.join(', ') : ''}`).join('; '));

if (opt.sheet) {
  const grips = [0.015, 0.035].map((r) => D.grasp(R, box, 'power', D.inPalm(box, 'cylinder', r)).fingers);
  const acts = [{}, ...Object.values(shapes).map((s) => ({ pose: { fingersR: s.fingers } })), ...grips.map((f) => ({ pose: { fingersR: f } }))];
  console.log(`  sheet rows: bind, ${Object.keys(shapes).join(', ')}, power 15 mm, power 35 mm`);
  const r = spawnSync(process.execPath, [path.join(CONTROL, '../.claude/skills/body-study/body.mjs'), opt.cast, '--hero', '{"form":"realistic"}', '--crop', 'hand', '--out', opt.sheet, '--acts', JSON.stringify(acts)], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
