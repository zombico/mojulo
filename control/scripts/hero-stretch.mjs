#!/usr/bin/env node
/**
 * hero-stretch — the STRETCH AUDIT over a hero (lib/graph/polygonizer/hero-stretch.js): its shell ring by ring through
 * the studied gaits (walk, jog, sprint) and the stand's gestures, against its bind. Prints, per joint region and for
 * the whole shell, the worst ring area and pinch, the twist away from the bone, and the band between rings (compression,
 * stretch, folds), and the seams between parts (the groin, the armpit, the elbow, the knee, the ankle, the neck: how far
 * each opens or presses in), each naming the ring and the frame. The realistic register's baseline and its phase-4 "after".
 *
 *   node scripts/hero-stretch.mjs [--cast male|female|<a figure cast>] [--form norrin|shalla] [--samples 12] [--rings] [--json]
 *                                 [--poses '<json>'] [--only]
 *
 * --form audits the realistic register's form-field slice of a build (body-relational.js, its tune worn, bald) in place
 * of the authored shell; --rings prints every ring's own worst; --json the whole report. --poses adds rig poses as
 * rigNodesAt takes them (an object, or a list of them or of { label, pose }); --only audits those alone.
 */
import { parseArgs } from 'node:util';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
process.chdir(path.resolve(here, '..'));

const { values: args } = parseArgs({ options: { cast: { type: 'string', default: 'male' }, form: { type: 'string' }, samples: { type: 'string', default: '12' }, rings: { type: 'boolean' }, json: { type: 'boolean' }, poses: { type: 'string' }, only: { type: 'boolean' } } });
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft.js');
const { validateRig, bindLayered } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { GESTURE_WORDS, standPose } = await import('@/lib/graph/polygonizer/hero-gesture.js');
const { stretchAudit, gaitFrames } = await import('@/lib/graph/polygonizer/hero-stretch.js');

const cast = args.cast;
// (the form slice: the build's tune worn and the hair off, as the body lane draws it; the gestures' heroes wear it too)
const { formSlice, BODY_BUILDS, correctiveRest } = args.form ? await import('@/lib/graph/polygonizer/body-relational.js') : {};
if (args.form && !BODY_BUILDS[args.form]) throw new Error(`hero-stretch: unknown form '${args.form}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
const worn = args.form ? { hair: 'none', ...(BODY_BUILDS[args.form].tune ? { tune: BODY_BUILDS[args.form].tune } : {}) } : {};
const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, ...worn }) });
// (the slice's own rig: it adds the hinges' crease bones)
if (args.form) m.recipe = formSlice(m.recipe, validateRig(m.recipe.rig), args.form).recipe;
const R = validateRig(m.recipe.rig), mesh = compileLayered(m.recipe, m.dials), skin = bindLayered(mesh, m.recipe, R);
// the frames: the planted stand, each gait over its cycle, and each stand gesture as the door mints it on this cast
const extra = args.poses ? [JSON.parse(args.poses)].flat().map((p, i) => (p.pose ? { label: p.label ?? `pose ${i + 1}`, pose: p.pose } : { label: `pose ${i + 1}`, pose: p })) : [];
if (args.only && !extra.length) throw new Error('hero-stretch: --only audits the --poses alone, and none were given');
const frames = args.only ? [{ label: 'stand', pose: {} }] : [{ label: 'stand', pose: {} }, ...gaitFrames(R, { samples: Number(args.samples) })];
for (const g of args.only ? [] : GESTURE_WORDS.filter((w) => w !== 'rest')) {
  const mg = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, gesture: g, ...worn }) });
  const pose = standPose(mg.recipe, validateRig(mg.recipe.rig));
  if (pose) frames.push({ label: `gesture ${g}`, pose });
}
frames.push(...extra);
const A = stretchAudit(mesh, skin, R, m.recipe, frames, args.form ? { restAt: (nodes) => correctiveRest(mesh, m.recipe, nodes) } : {});
if (args.json) { console.log(JSON.stringify({ cast, ...A }, null, 2)); process.exit(0); }

const f = (x, d = 2) => (typeof x === 'number' ? x.toFixed(d) : String(x));
const at = (w) => `${w.ring} @ ${w.at}`;
console.log(`${cast}${args.form ? ` · form ${args.form}` : ''}: ${A.rings.length} rings over ${A.frames} frames (${args.only ? 'the stand and the poses given' : `the stand, ${args.samples} phases of each gait, the gestures${extra.length ? ', the poses given' : ''}`})`);
const show = (name, w) => {
  console.log(`${name.padEnd(9)} ring area ${f(w.areaMin.value)} (${at(w.areaMin)}) … ${f(w.areaMax.value)} (${at(w.areaMax)});  pinch ${f(w.pinch.value)} (${at(w.pinch)});  twist ${f(w.twist.value, 1)}° (${at(w.twist)})`);
  console.log(`${''.padEnd(9)} band ${f(w.bandMin.value)} (${at(w.bandMin)}) … ${f(w.bandMax.value)} (${at(w.bandMax)});  folds ${w.folds.value}${w.folds.value ? ` (${at(w.folds)})` : ''}`);
};
for (const [k, w] of Object.entries(A.regions)) show(k, w);
show('shell', A.worst);
const mm = (x) => (x * 1000).toFixed(1);
console.log('seams (the child\'s end ring in the parent\'s tube: the share of its slots inside at rest and at worst; how far a tucked slot came out):');
const pc = (x) => `${Math.round(x * 100)}%`.padStart(4);
for (const s of A.seams) console.log(`  ${`${s.seam}${s.side ? ' ' + s.side : ''}`.padEnd(10)} ${`${s.child} in ${s.parent}`.padEnd(30)} inside ${pc(s.share.rest)} → ${pc(s.share.min)} @ ${String(s.share.at).padEnd(16)} emerged ${mm(s.emerged.max).padStart(5)} mm${s.emerged.max ? ` @ ${s.emerged.at}` : ''}`);
if (args.rings) for (const r of A.rings) console.log(`  ${`${r.part}/${r.station}`.padEnd(22)} area ${f(r.area.min)}…${f(r.area.max)}  pinch ${f(r.pinch.min)}  twist ${f(r.twist.max, 1)}°  band ${f(r.band.min)}…${f(r.band.max)}${r.band.folds ? `  folds ${r.band.folds}` : ''}`);
