// humanoid-head.test.js — the FACE: the face proportion lab's checker transposed onto the fitted landmark head. Identity,
// composition, exact bilateral symmetry, closure at every control's limits and at both combined extremes on both heads,
// what each new control means, and the frozen fits' byte pins. The reference-camera gates live with the docs (test-humanoid.mjs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { humanoidHead, humanoidAnchors, FACE, FACE_KEYS, FACE_GROUPS, FACE_RANGES, FACE_MOVES, FACE_MOVE_NAMES, HEAD_SHAPE_DEFAULTS, resolveFace, validateFace, faceWarnings } from './humanoid-head.js';
import { FACE_EXTRA_DEFAULTS, FIT_PRESETS, FIT_DATA_DIR } from './humanoid-head-fit.js';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const PRESETS = ['male', 'female'];
const closed = (recipe, dials = {}) => Object.entries(auditLayered(compileLayered(recipe, dials))).filter(([, r]) => !r.pass).map(([n]) => n);
const head = (preset, shape = {}) => humanoidHead({ preset, shape, hair: 'none' });
const pts = (h, part) => h.parts[part].stations.flatMap((st) => Object.entries(st.points));
/** the x of a compiled part's centroid */
const centroidX = (mesh, part) => { const xs = mesh.pointIds.map((id, i) => (id.startsWith(`${part}/`) ? mesh.vertices[i][0] : null)).filter((v) => v !== null); return xs.reduce((a, b) => a + b, 0) / xs.length; };
const maxX = (mesh, part) => Math.max(...mesh.pointIds.map((id, i) => (id.startsWith(`${part}/`) ? mesh.vertices[i][0] : -Infinity)));

// The frozen fits: byte-pinned data (re-fitting is an authoring step that re-pins these), exactly symmetric.
const FIT_FILES = {
  female: { 'head-source.json': '639fcdb723e825537f801943116f1c6c93efa54b9451d76c032de30ccd48de02', 'landmarks.json': '82874379b9bf9db9380113efc80df717958c7238fb639b14c160e01b222efddd', 'fit-report.json': '15f7aa122dd305a4e37d9ffe0244c11d0eb48c81b37d2ce3afb392429864e84b' },
  male: { 'head-source.json': 'e8f18cd54bcc016de905482854e36fe9bd12edb4ab93966e26c3647a1693145b', 'landmarks.json': 'cfb6680abfc4bf153eee59f4b4436b058ea12a33d3d9abef9f01d908787d1d00', 'fit-report.json': '5adab46fedc839502d6891f7af4fa58a135139267780339e28ff0c2fd750d01e' },
};
describe('the frozen fits', () => {
  it('each head fit is frozen data: pinned bytes, exact bilateral symmetry', () => {
    expect([...FIT_PRESETS].sort()).toEqual(Object.keys(FIT_FILES).sort());
    for (const [preset, files] of Object.entries(FIT_FILES)) {
      for (const [file, sha] of Object.entries(files)) {
        const bytes = readFileSync(join(FIT_DATA_DIR, preset, file));
        expect(createHash('sha256').update(bytes).digest('hex'), `${preset}/${file} changed; re-pin only with a new fit`).toBe(sha);
      }
      const src = JSON.parse(readFileSync(join(FIT_DATA_DIR, preset, 'head-source.json'), 'utf8'));
      const at = Object.fromEntries(src.pointIds.map((k, i) => [k, src.vertices[i]]));
      for (const [k, p] of Object.entries(at)) if (k.endsWith('L')) expect([-p[0], p[1], p[2]], `${preset} ${k}`).toEqual(at[k.replace(/L$/, 'R')]);
    }
  });
});

describe('the face resolves like the body tune', () => {
  it('identity: an empty face, a unit ratio and a move at 1 change no bytes', () => {
    for (const preset of PRESETS) {
      const base = JSON.stringify(head(preset));
      expect(JSON.stringify(head(preset, resolveFace({})))).toBe(base);
      expect(JSON.stringify(head(preset, Object.fromEntries(FACE_KEYS.map((k) => [k, 1]))))).toBe(base);
      expect(JSON.stringify(humanoidPlan({ preset, face: [] }))).toBe(JSON.stringify(humanoidPlan({ preset })));
    }
  });
  it('the groups cover every fitted control once; the figure\'s knobs and the lab\'s words are all shape knobs', () => {
    const all = Object.values(FACE_GROUPS).flat();
    expect(new Set(all).size).toBe(all.length); expect(all).toEqual([...FACE_KEYS]);
    for (const k of FACE_KEYS) { expect(k in HEAD_SHAPE_DEFAULTS).toBe(true); expect(FACE_RANGES[k]).toHaveLength(2); }
    for (const k of Object.keys(FACE_EXTRA_DEFAULTS)) expect(FACE_KEYS).toContain(k);
    expect(FACE_KEYS).not.toContain('neckGirth');   // the body's
  });
  it('composes by product; a move names itself; a group word expands first', () => {
    const f = resolveFace(['broad-jaw', { jawWidth: 1.05 }]);
    expect(f.jawWidth).toBeCloseTo(1.18 * 1.05, 6); expect(f.chinProjection).toBe(1.08); expect(f.from).toBe('broad-jaw');
    expect(resolveFace('large-eyes')).toMatchObject(FACE_MOVES['large-eyes'].face);
    expect(resolveFace({ eyes: 1.1, eyeSize: 1 })).toMatchObject({ eyeSpacing: 1.1, eyeSize: 1 });
    expect(resolveFace({ nose: 0.9 })).toMatchObject({ noseWidth: 0.9, noseSize: 0.9, noseDroop: 0.9, mouthWidth: 1 });
  });
  it('refuses an unknown control or move and a ratio that is not a positive number; ranges advise', () => {
    expect(validateFace({ jawline: 1.1 })[0]).toMatch(/unknown control/);
    expect(validateFace({ jaw: 1.1 })).toEqual([]);   // `jaw` is a group word (jawWidth, chinProjection, chinPoint)
    expect(validateFace('square')[0]).toMatch(/unknown move/); expect(validateFace({ eyeSize: -1 })[0]).toMatch(/> 0/);
    expect(faceWarnings(resolveFace({ jawWidth: 1.2 }))).toEqual([]);
    expect(faceWarnings(resolveFace({ jawWidth: 1.4 }))[0]).toMatch(/face\.jawWidth 1\.4 .*\[0\.8, 1\.25\]/);
    expect(() => head('male', { jawWidth: 1.4 })).not.toThrow();
    expect(() => head('male', { jaw: 1.1 })).toThrow(/invalid head shape 'jaw'/);
  });
});

describe('every control at its limits, and both combined extremes: symmetric, finite, closed, the eyes still read', () => {
  const lo = Object.fromEntries(FACE_KEYS.map((k) => [k, FACE_RANGES[k][0]])), hi = Object.fromEntries(FACE_KEYS.map((k) => [k, FACE_RANGES[k][1]]));
  const cases = [['as fit', {}], ...FACE_KEYS.flatMap((k) => FACE_RANGES[k].map((v) => [`${k} ${v}`, { [k]: v }])), ...FACE_MOVE_NAMES.map((m) => { const { from: _f, ...shape } = resolveFace(m); return [m, shape]; }), ['all low', lo], ['all high', hi]];
  for (const preset of PRESETS) for (const [label, shape] of cases) {
    it(`${preset} · ${label}`, () => {
      const h = head(preset, shape);
      for (const part of ['cranium', 'jaw']) for (const [slot, p] of pts(h, part)) {
        expect(p.every(Number.isFinite)).toBe(true);
        if (slot.endsWith('L')) { const q = h.parts[part].stations.find((st) => st.points[slot] === p).points[slot.replace(/L$/, 'R')]; expect(p).toEqual([-q[0], q[1], q[2]]); }
        if (slot === 'front' || slot === 'back') expect(p[0]).toBe(0);
      }
      expect(closed(h)).toEqual([]); expect(closed(h, { jawOpen: 25 })).toEqual([]);
      const ex = layeredExposure(compileLayered(h), { res: 256 });
      for (const eye of ['eyeR', 'eyeL']) expect(ex.parts[eye].flag).toBe('reads');
    });
  }
  it('the hero wearing a face at both extremes closes and stands', () => {
    for (const preset of PRESETS) for (const face of [lo, hi]) { const recipe = expandPlan(humanoidPlan({ preset, face })); expect(closed(recipe)).toEqual([]); }
  });
});

describe('what each new control means', () => {
  for (const preset of PRESETS) {
    const base = head(preset), bm = compileLayered(base), a0 = humanoidAnchors(preset);
    const eyeRow = (h) => h.parts.cranium.stations[4].points, crownRow = (h) => h.parts.cranium.stations.at(-2).points;
    it(`${preset}: skullWidth widens the vault more than the cheekbone; faceWidth the cheekbone more than the vault`, () => {
      const s = head(preset, { skullWidth: 1.15 }), f = head(preset, { faceWidth: 1.15 });
      const vault = (h) => crownRow(h).sideR[0], cheek = (h) => humanoidAnchors(preset, h.shape).zygionR[0];
      expect(vault(s) / vault(base)).toBeGreaterThan(cheek(s) / cheek(base)); expect(vault(s)).toBeGreaterThan(vault(base) * 1.08);
      expect(cheek(f) / cheek(base)).toBeGreaterThan(vault(f) / vault(base)); expect(cheek(f)).toBeGreaterThan(cheek(base) * 1.1);
    });
    it(`${preset}: faceLength drops the chin and leaves the crown; chinProjection brings the chin forward`, () => {
      const a = humanoidAnchors(preset, { ...HEAD_SHAPE_DEFAULTS, faceLength: 1.15 });
      expect(a.menton[2]).toBeLessThan(a0.menton[2] - 0.005); expect(a.crown[2]).toBeCloseTo(a0.crown[2], 6); expect(a.eyeR[2]).toBeCloseTo(a0.eyeR[2], 6);
      const c = humanoidAnchors(preset, { ...HEAD_SHAPE_DEFAULTS, chinProjection: 1.2 });
      expect(c.chinFront[1]).toBeGreaterThan(a0.chinFront[1] + 0.004); expect(c.nasion[1]).toBe(a0.nasion[1]);
    });
    it(`${preset}: eyeSpacing moves the pupils apart and nothing behind the face; browHeight lifts the brow`, () => {
      const w = compileLayered(head(preset, { eyeSpacing: 1.15 }));
      expect(centroidX(w, 'pupilR')).toBeGreaterThan(centroidX(bm, 'pupilR') * 1.08);
      expect(head(preset, { eyeSpacing: 1.15 }).parts.cranium.stations.at(-1).points).toEqual(base.parts.cranium.stations.at(-1).points);
      const b = humanoidAnchors(preset, { ...HEAD_SHAPE_DEFAULTS, browHeight: 1.15 });
      expect(b.glabella[2]).toBeGreaterThan(a0.glabella[2] + 0.003); expect(b.eyeR[2]).toBe(a0.eyeR[2]);
      const brow = (h) => Math.max(...compileLayered(h).pointIds.map((id, i) => (id.startsWith('browR/') ? compileLayered(h).vertices[i][2] : -Infinity)));
      expect(brow(head(preset, { browHeight: 1.15 }))).toBeGreaterThan(brow(base) + 0.002);
    });
    it(`${preset}: mouthWidth widens the mouth and leaves the nose`, () => {
      const m = head(preset, { mouthWidth: 1.2 }), mm = compileLayered(m);
      expect(maxX(mm, 'mouthR')).toBeGreaterThan(maxX(bm, 'mouthR') * 1.12);
      expect(m.parts.cranium.stations[1].points.alaR[0]).toBe(base.parts.cranium.stations[1].points.alaR[0]);   // the ala's x; its depth resamples off neighbouring lip triangles
    });
    it(`${preset}: the face never moves the hero's joints`, () => {
      const plain = humanoidPlan({ preset }), faced = humanoidPlan({ preset, face: ['broad-jaw', 'large-eyes', { faceLength: 1.1 }] });
      expect(faced.joints).toEqual(plain.joints); expect(faced.rig.joints.hipR).toEqual(plain.rig.joints.hipR);
      expect(faced.frame.note).toMatch(/face broad-jaw\+large-eyes: faceLength 110%, eyeSpacing 105%, eyeSize 115%, jawWidth 118%, chinProjection 108%/);
    });
  }
});
