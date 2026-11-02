#!/usr/bin/env node
// mount-study — the eyes gate's contact sheets for a mount: each gait as a row of stick poses at even phases of its
// stride, the footfall diagram under it, the machine gates' verdicts printed beside. `--before` draws the fauna horse's
// gaits the same way (the sheet the mount is compared against). PNG through headless Chromium ($MOJULO_CHROMIUM or the usual
// places) when `--png`.
//
//   node scripts/mount-study.mjs <outDir> [--register realistic|stylized] [--gaits walk,trot,canter,gallop,reinBack]
//        [--lead right|left] [--view side|front] [--cols 8] [--before] [--shots] [--jump] [--idle] [--body [--cells 80] [--coat bay] [--views side,front] [--big] [--crop head|tail]]
//        [--correctives [--cells 64]] [--tack] [--png]
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
import { bodyMesh } from '../lib/graph/mount/body.js';
import { coatColor, COATS } from '../lib/graph/mount/coats.js';
import { bodySheet, BODY_VIEWS } from '../lib/graph/mount/body-sheet.js';
import { boneFrames, skinPose, skinMeasures } from '../lib/graph/mount/skin.js';
import { simulateHair, hairCards } from '../lib/graph/mount/hair.js';
import { restState } from '../lib/graph/mount/idle.js';
import { oneShot } from '../lib/graph/mount/motion.js';
import { standPose } from '../lib/graph/mount/gait.js';
import { tackPieces, tackSkin } from '../lib/graph/mount/tack.js';
import { skinContext, implicitSkin, correctiveKeys, correctiveCorpus, fitCorrectives, applyCorrectives, correctiveGates } from '../lib/graph/mount/correctives.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const register = opt('register', 'realistic'), lead = opt('lead', 'right'), cols = Number(opt('cols', 8)), view = opt('view', 'side');
const gaits = opt('gaits', 'walk,trot,canter,gallop,reinBack').split(',');
const before = flag('before'), png = flag('png'), shots = flag('shots'), jumps = flag('jump'), idles = flag('idle'), body = flag('body'), correctives = flag('correctives'), tack = flag('tack');
const cells = Number(opt('cells', 80)), coat = opt('coat', 'bay'), views = opt('views', null), big = flag('big'), crop = opt('crop', null);
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

if (body) {
  // the body: the mesh from every view, in a coat (a star and a sock to show the markings)
  const m = bodyMesh(B, { cells });
  const colors = m.quads.map((q) => { const c = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return coatColor(coat, m.parts[q[0]], c, { stand: m.stand, markings: { star: true, sock: ['LH'] } }); });
  // the hair on a body: its cards appended to the body's quads (two-sided)
  const withHair = (cell, guides, strands) => {
    const hc = hairCards(guides, strands, { coat }), off = cell.vertices.length;
    return { ...cell, vertices: [...cell.vertices, ...hc.vertices], quads: [...cell.quads, ...hc.quads.map((q) => q.map((i) => i + off))],
      colors: [...cell.colors, ...hc.colors], twoSided: [...cell.quads.map(() => false), ...hc.twoSided] };
  };
  // the tack (`--tack`): its pieces on the body, skinned as the export skins them into a pose
  const T = tack ? tackPieces(B) : null, TS = T ? tackSkin(T, m) : null, rest0 = boneFrames(B, standPose(B));
  const withTack = (cell, frames = null) => {
    if (!T) return cell;
    const V = [...cell.vertices], Q = [...cell.quads], C = [...cell.colors], two = cell.twoSided ? [...cell.twoSided] : cell.quads.map(() => false);
    T.forEach((pc, k) => {
      const o = V.length;
      for (const [j, v] of pc.vertices.entries()) {
        if (!frames) { V.push(v); continue; }
        let p = [0, 0, 0];
        for (const [bone, w] of TS[k][j]) { const r = rest0[bone], q = frames[bone], d = v.map((x, i) => x - r.h[i]), l = [0, 1, 2].map((a2) => d[0] * r.R[a2][0] + d[1] * r.R[a2][1] + d[2] * r.R[a2][2]); for (let a2 = 0; a2 < 3; a2++) p[a2] += w * (q.h[a2] + q.R[0][a2] * l[0] + q.R[1][a2] * l[1] + q.R[2][a2] * l[2]); }
        V.push(p);
      }
      Q.push(...pc.quads.map((q) => q.map((i) => i + o))); C.push(...pc.colors); two.push(...pc.quads.map(() => true));
    });
    return { ...cell, vertices: V, quads: Q, colors: C, twoSided: two };
  };
  const standHair = simulateHair(B, () => standPose(B), { t0: 0, t1: 0.5, fps: 10 });
  const simHold = (fr) => { const h = simulateHair(B, () => fr, { t0: 0, t1: 0.5, fps: 10 }); return { guides: h.guides, strands: h.strands[h.strands.length - 1] }; };
  const restHairAt = standHair.strands[standHair.strands.length - 1];
  // a crop: the head and neck alone (the quads ahead of the withers and above the elbow), for a close look
  if (crop === 'head') {
    const keep = m.quads.map((q) => { const c = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return c[1] > B.trunk.withers[0] + 0.05 && c[2] > B.trunk.com[1] - 0.15; });
    const qs = m.quads.filter((_, i) => keep[i]), cs = colors.filter((_, i) => keep[i]);
    const rowsH = [{ label: `${register}, ${coat}: the head and neck`, sub: '', cells: (views ? views.split(',') : ['side', 'threeQuarter', 'front', 'top', 'lowQuarter']).map((view) => withHair({ vertices: m.vertices, quads: qs, colors: cs, view, caption: view }, standHair.guides.filter((g) => g.kind !== 'tail'), restHairAt.filter((_, gi) => standHair.guides[gi].kind !== 'tail'))) }];
    const hname = `mount-head-${register}-${coat}`;
    writeFileSync(path.join(outDir, `${hname}.svg`), bodySheet(rowsH, { title: `the mount's head and neck (${cells} cells)`, cellW: 520, cellH: 520 }));
    files.push(`${hname}.svg`);
  }
  // a crop: the quarters and the tail alone (the quads behind the loin, above the stifle), for a close look
  if (crop === 'tail') {
    const keep = m.quads.map((q) => { const c = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return c[1] < B.trunk.loin[0] - 0.05 && c[2] > B.trunk.com[1] - 0.25; });
    const qs = m.quads.filter((_, i) => keep[i]), cs = colors.filter((_, i) => keep[i]), tailOnly = (gi) => standHair.guides[gi].kind === 'tail';
    const rowsT = [{ label: `${register}, ${coat}: the quarters and the tail`, sub: '', cells: (views ? views.split(',') : ['back', 'side', 'rearQuarter', 'top']).map((view) => withHair({ vertices: m.vertices, quads: qs, colors: cs, view, caption: view }, standHair.guides.filter((_, gi) => tailOnly(gi)), restHairAt.filter((_, gi) => tailOnly(gi)))) }];
    const tname = `mount-tail-${register}-${coat}`;
    writeFileSync(path.join(outDir, `${tname}.svg`), bodySheet(rowsT, { title: `the mount's quarters and tail (${cells} cells)`, cellW: 520, cellH: 620 }));
    files.push(`${tname}.svg`);
  }
  const rows = [{ label: `${register}, ${coat}`, sub: `${m.stats.triangles} triangles · ${m.stats.vertices} vertices · open edges ${m.stats.open} · non-manifold ${m.stats.nonManifold} · hair: ${standHair.guides.length} guides`, cells: (views ? views.split(',') : BODY_VIEWS).map((view) => withHair(withTack({ vertices: m.vertices, quads: m.quads, colors, view, caption: view }), standHair.guides, restHairAt)) }];
  // the coats: each card on the same body
  if (!views) {
    const coatCells = Object.keys(COATS).map((c) => ({ vertices: m.vertices, quads: m.quads, view: 'threeQuarter', caption: c,
      colors: m.quads.map((q) => { const ctr = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return coatColor(c, m.parts[q[0]], ctr, { stand: m.stand, markings: c === 'chestnut' ? { blaze: true, stocking: ['LH', 'RH'] } : c === 'black' ? { star: true } : {} }); }) }));
    rows.push({ label: 'coats', sub: 'cards: a new coat is data (a chestnut with a blaze and two stockings, a black with a star)', cells: coatCells });
  }
  // the body skinned into poses: a stride of the trot and of the gallop, the jump's apex and landing, grazing, resting
  if (!views) {
    const rest = boneFrames(B, standPose(B));
    const posed = (label, fr, hair) => { const p = skinPose(m, rest, boneFrames(B, fr)), st = skinMeasures(m, p); const cell = withTack({ vertices: p, quads: m.quads, colors, view: 'side', caption: `${label} · stretch p99 ${st.stretch.p99.toFixed(2)} · volume ${st.volume.toFixed(3)}` }, boneFrames(B, fr)); return hair ? withHair(cell, hair.guides, hair.strands) : cell; };
    // the hair through each clip: a cycle's looped, a one-shot's from its first frame; sampled where the cells are
    const hairOf = (sim, t) => ({ guides: sim.guides, strands: sim.strands[Math.round((t - sim.times[0]) / (sim.times[1] - sim.times[0]))] });
    const tr = gaitCycle(B, 'trot'), ga = gaitCycle(B, 'gallop'), jp = jumpClip(B, { fence: 1.1 });
    const trH = simulateHair(B, (u) => tr.poseAt(u / tr.T), { t0: 0, t1: tr.T, fps: 80, loop: true });
    const gaH = simulateHair(B, (u) => ga.poseAt(u / ga.T), { t0: 0, t1: ga.T, fps: 100, loop: true });
    const jpH = simulateHair(B, (t) => jp.poseAt(t), { t0: 0, t1: jp.duration, fps: 60 });
    rows.push({ label: 'trot', sub: 'skinned (linear blend, the masses\' own weights); the hair\'s swing computed', cells: [0, 0.125, 0.25, 0.375, 0.5].map((t) => posed(`trot ${t}`, tr.poseAt(t), hairOf(trH, t * tr.T))) });
    rows.push({ label: 'gallop', sub: '', cells: [0, 0.2, 0.4, 0.6, 0.8].map((t) => posed(`gallop ${t}`, ga.poseAt(t), hairOf(gaH, t * ga.T))) });
    const rh = (t) => ({ guides: standHair.guides, strands: restHairAt });
    rows.push({ label: 'jump, grazing, resting', sub: '', cells: [posed('take-off', jp.poseAt(jp.flight.launch - 0.1), hairOf(jpH, jp.flight.launch - 0.1)), posed('apex', jp.poseAt(jp.flight.apex), hairOf(jpH, jp.flight.apex)), posed('landing', jp.poseAt(jp.flight.touchdown + 0.05), hairOf(jpH, jp.flight.touchdown + 0.05)), posed('grazing', restState(B, { graze: 1 }), simHold(restState(B, { graze: 1 }))), posed('resting a hind', restState(B, { restHind: 'L', rest: 1 }), simHold(restState(B, { restHind: 'L', rest: 1 })))] });
    void rh;
  }
  const bname = `mount-body-${register}-${coat}`;
  writeFileSync(path.join(outDir, `${bname}.svg`), bodySheet(rows, { title: `the mount's body: the masses from the solved stand (${cells} cells)`, ...(big ? { cellW: 900, cellH: 720 } : {}) }));
  files.push(`${bname}.svg`);
  console.log(`body: ${JSON.stringify(m.stats)}`);
}

if (correctives) {
  // the folds: one-joint keys, refit over the clips' even poses, gated on the odd ones; LBS, corrected and the oracle
  // side by side, whole and cropped to the pose's fold
  const m = bodyMesh(B, { cells }), ctx = skinContext(B, m), t0 = Date.now();
  const colors = m.quads.map((q) => { const c = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return coatColor(coat, m.parts[q[0]], c, { stand: m.stand }); });
  const corpus = correctiveCorpus(B, { phases: 16, jumpSamples: 24 }), train = corpus.filter((_, i) => i % 2 === 0), test = corpus.filter((_, i) => i % 2 === 1);
  const keys = correctiveKeys(ctx, { corpus: corpus.map((c) => c.frames) });
  const set = fitCorrectives(ctx, keys, train.map((c) => c.frames));
  const g = correctiveGates(ctx, set, test.map((c) => c.frames));
  const shapes = set.drivers.reduce((t, d) => t + d.keys.length, 0), nz = set.drivers.reduce((t, d) => t + d.keys.reduce((u, kk) => u + kk.deltas.length, 0), 0);
  console.log(`correctives: ${set.drivers.length} drivers, ${shapes} shapes, ${nz} vertex deltas (${m.vertices.length} vertices); built in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const x of g.checks) console.log(`  ${x.pass ? 'ok  ' : 'FAIL'} ${x.name}: ${x.saw} (want ${x.want})`);
  console.log(`  worst vertex (reported): ${(g.worst.fit * 100).toFixed(1)} cm (LBS ${(g.worst.lbs * 100).toFixed(1)} cm)`);
  writeFileSync(path.join(outDir, `mount-correctives-${register}.gates.json`), JSON.stringify({ checks: g.checks, worst: g.worst, shapes, deltas: nz, held: test.map((c, i) => ({ label: c.label, lbs: g.rows[i].lbs, fit: g.rows[i].fit })) }, null, 2));
  // a crop: the quads whose rest centre lies within r of a joint (the right side's)
  const sb = m.stand.bones, joint = { armpit: sb.humerusR.tail, shoulder: sb.humerusR.head, stifle: sb.femurR.tail, throat: sb.head.head, hip: sb.femurR.head };
  const cropQ = (j, r) => m.quads.flatMap((q, qi) => { const c = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return Math.hypot(c[0] - j[0], c[1] - j[1], c[2] - j[2]) < r ? [qi] : []; });
  const pick = (label) => corpus.find((c) => c.label.startsWith(label));
  // the jump's frames by time: the corpus's sample nearest the crouch (just before the launch) and the tuck (just
  // before the touchdown)
  const jf = jumpClip(B).flight, jumps = corpus.filter((c) => c.label.startsWith('jump')), tOf = (c) => parseFloat(c.label.slice(5));
  const nearJ = (t) => jumps.reduce((a, c) => (Math.abs(tOf(c) - t) < Math.abs(tOf(a) - t) ? c : a), jumps[0]);
  const shown = [['gallop, the fore reaching', pick('gallop 0.438'), 'armpit', 'lowQuarter'], ['the jump: the crouch', nearJ(jf.launch - 0.05), 'armpit', 'lowQuarter'],
    ['the jump: the tuck', nearJ(jf.touchdown - 0.05), 'stifle', 'rearQuarter'], ['the trot', pick('trot 0.250'), 'stifle', 'rearQuarter'], ['grazing', pick('grazing'), 'throat', 'side']].filter((r) => r[1]);
  const crows = shown.map(([label, c, fold, cview]) => {
    const lbs = skinPose(m, ctx.rest, c.frames), co = applyCorrectives(ctx, set, c.frames), or = implicitSkin(ctx, c.frames, lbs);
    const qi = cropQ(joint[fold], 0.32 * B.scale), qs = qi.map((i) => m.quads[i]), cs = qi.map((i) => colors[i]);
    const whole = (v, cap) => ({ vertices: v, quads: m.quads, colors, view: 'side', caption: cap }), part = (v, cap) => ({ vertices: v, quads: qs, colors: cs, view: cview, ownScale: true, caption: `${cap}: the ${fold} (close)` });
    return { label, sub: `${c.label}`, cells: [whole(lbs, 'LBS'), whole(co, 'corrected'), part(lbs, 'LBS'), part(co, 'corrected'), part(or, 'the oracle')] };
  });
  const cname = `mount-correctives-${register}`;
  writeFileSync(path.join(outDir, `${cname}.svg`), bodySheet(crows, { title: `the folds: LBS, corrected (${shapes} shapes, refit over the clips), the oracle (the masses carried and re-blended)`, cellW: 400, cellH: 320 }));
  files.push(`${cname}.svg`);
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
