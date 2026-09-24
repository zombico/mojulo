import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, audit, loadRecipe, DIALS, resolveDials, surfaceLocalOffset, mirrorPid } from './compile.mjs';
const recipe = loadRecipe();
const baseline = compile(recipe);
const EXTREMES = [Object.fromEntries(Object.entries(DIALS).map(([k, s]) => [k, s.min])), Object.fromEntries(Object.entries(DIALS).map(([k, s]) => [k, s.max])), { skullWidth: 1.3, snoutLength: 0.7, jawOpen: 20 }, { snoutLength: 1.4, browDrop: 0.05, hornSweep: 0.6 }];
const close = (a, b, tol = 1e-9) => assert.ok(Math.hypot(...a.map((x, i) => x - b[i])) < tol, `${a} != ${b}`);

test('every part meets its closure contract at baseline and at every dial extreme', () => {
  for (const dials of [{}, ...EXTREMES]) { const r = audit(compile(recipe, dials)); for (const [name, p] of Object.entries(r)) assert.ok(p.pass, `${name} at ${JSON.stringify(dials)}: ${JSON.stringify(p)}`); }
});
test('the point and face ID sets are dial-invariant (identity lives in station/slot names, not coordinates)', () => {
  for (const dials of EXTREMES) { const m = compile(recipe, dials); assert.deepEqual(m.pointIds, baseline.pointIds); assert.deepEqual(m.faceIds, baseline.faceIds); assert.deepEqual(m.faces, baseline.faces); }
});
test('every L1 point is addressed by station and slot; every L2/L3 point by its pin face', () => {
  for (const p of baseline.provenance) { if (p.layer === 1) assert.ok((p.station && p.slot) || /\/(back|tip)$/.test(p.id), p.id); else assert.match(p.anchor, /^(cranium|jaw)\//); }
});
test('details keep their local offsets under every dial (stretch dials excepted, along their own axis only)', () => {
  for (const dials of EXTREMES) { const m = compile(recipe, dials); const D = resolveDials(dials);
    for (const [name, part] of Object.entries(recipe.parts)) for (const [id, o] of Object.entries(part.offsets)) {
      const local = surfaceLocalOffset(m.pins[name], m.parts[name].points[id]);
      if (!part.stretch) { close(local, o); continue; }
      const { origin, axis } = part.stretch; const rel = o.map((x, i) => x - origin[i]); const along = rel.reduce((s, x, i) => s + x * axis[i], 0); const k = D[part.stretch.dial];
      close(local, origin.map((x, i) => x + (rel[i] - axis[i] * along) + axis[i] * along * k), 1e-9);
    } }
});
test('the head is exactly mirror-symmetric by name at baseline and under every dial', () => {
  for (const dials of [{}, ...EXTREMES]) { const m = compile(recipe, dials); const at = Object.fromEntries(m.pointIds.map((id, i) => [id, m.vertices[i]]));
    for (const [id, v] of Object.entries(at)) {
      const mid = id.replace(/^([A-Za-z0-9]+?)([RL])\//, (s, a, b) => `${a}${b === 'R' ? 'L' : 'R'}/`).replace(/\.(\w*?)([RL])$/, (s, a, b) => `.${a}${b === 'R' ? 'L' : 'R'}`);
      if (mid !== id) { assert.ok(at[mid], `no mirror for ${id}`); close(at[mid], [-v[0], v[1], v[2]], 1e-9); continue; }
      // a midline part (crest spike, cap point, top/palate/gum slot): its mirror is some point of the same part
      const part = id.split('/')[0]; assert.ok(Object.entries(at).some(([q, u]) => q.startsWith(part + '/') && Math.hypot(u[0] + v[0], u[1] - v[1], u[2] - v[2]) < 1e-9), `no mirror in ${part} for ${id}`);
    }
    for (const c of ['crest1', 'crest2', 'crest3']) for (const p of Object.values(m.parts[c].points)) assert.ok(Math.abs(p[0]) < 0.03 * recipe.frame.scale + 1e-9); }
});
test('the jaw is rigid under jawOpen and hinges at its rear gum slot; lower teeth ride it, upper teeth do not', () => {
  const open = compile(recipe, { jawOpen: 30 }); const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
  const ids = Object.keys(baseline.parts.jaw.points);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j += 7) assert.ok(Math.abs(d(open.parts.jaw.points[ids[i]], open.parts.jaw.points[ids[j]]) - d(baseline.parts.jaw.points[ids[i]], baseline.parts.jaw.points[ids[j]])) < 1e-9);
  close(open.parts.jaw.points['jaw/st0.gum'], baseline.parts.jaw.points['jaw/st0.gum']);
  assert.ok(open.parts.jaw.points['jaw/tip'][2] < baseline.parts.jaw.points['jaw/tip'][2] - 0.05);
  assert.ok(d(open.pins.toothL1R.origin, baseline.pins.toothL1R.origin) > 0.02); assert.ok(d(open.pins.toothU1R.origin, baseline.pins.toothU1R.origin) < 1e-12);
  assert.deepEqual(open.parts.cranium.points, baseline.parts.cranium.points);
});
test('channels: details off emits only L1; creases off changes no geometry; dial guards throw', () => {
  const primary = compile(recipe, {}, { details: false, creases: false }); assert.deepEqual(Object.keys(primary.parts), ['cranium', 'jaw']); assert.deepEqual(primary.featureEdges, []);
  const nc = compile(recipe, {}, { creases: false }); assert.deepEqual(nc.vertices, baseline.vertices); assert.deepEqual(nc.faces, baseline.faces); assert.equal(baseline.featureEdges.length, 4);
  assert.throws(() => compile(recipe, { jawOpen: 90 }), /outside/); assert.throws(() => compile(recipe, { wings: 1 }), /unknown dial/);
});
test('a deleted pin face fails loudly; a part cannot address its own or a higher layer', () => {
  const broken = structuredClone(recipe); broken.parts.eyeR.pin.face = 'cranium/st9-st9.k0.a'; assert.throws(() => compile(broken), /face/);
  const up = structuredClone(recipe); up.parts.eyeR.pin.parent = 'hornR'; assert.throws(() => compile(up), /lower layer|missing parent/);
});
test('determinism: compiling twice is deep-equal', () => { assert.deepEqual(compile(recipe, { skullWidth: 1.2, jawOpen: 10 }), compile(recipe, { skullWidth: 1.2, jawOpen: 10 })); });
