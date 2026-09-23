/**
 * THE CAST — the machine gates of figure-cast.js (the eyes gate is /figure-study per preset).
 *
 *   0. the three module-level constants that were computed once from the canonical base: which
 *      ones survive a cast and which ones must take a base. This is the assertion the whole
 *      design rests on, so it is pinned before anything else;
 *   1. identity: castArmature({}) is basePositions(), exactly — a unit dial is a no-op, not a
 *      multiply by one, which is what lets every existing byte pin hold;
 *   2. each dial scales exactly the bone it names, and nothing else;
 *   3. the ground is invariant: every preset re-seats onto the canonical ankle height;
 *   4. resolveCast: aggregates, presets, array merge, explicit-over-aggregate, provenance;
 *   5. validateCast refuses a broken skeleton and allows unbounded taste.
 */
import { describe, expect, it, vi } from 'vitest';

// The render-pipeline gates build and render the WHOLE cast (every preset, bare and
// dressed, plus a walk over each) — a few seconds of real geometry per preset, which
// crossed the suite's 30s default under full parallel load and flaked as a timeout.
// The per-preset coverage is the point of the gate, so widen the budget, not the gate.
vi.setConfig({ testTimeout: 120000 });

import { castArmature, resolveCast, validateCast, legLengthOf, armLengthOf, CAST_DEFAULT, CAST_KEYS, CAST_PRESETS, CAST_PRESET_NAMES } from './figure-cast.js';
import { basePositions } from './figure-vajra.js';
import { buildPosedFigure, balancedArmature, renderFigureToSvg, renderFigureFrames, renderFigureWorldFrames, figurePatternReport } from './figure-render.js';
import { bodyGirths, buildBodyCharts } from './body-chart.js';
import { buildRig, DIMORPH, PROTOFORM_HUMAN_MALE } from './figure-rig.js';
import { gait } from './figure-posing.js';

// A cut-and-sewn shift (pattern-garment.test.js's fixture): front + back rectangles half the
// bust wide sewn at the sides, plus sleeves, DRAFTED FROM THE BODY IT WILL BE WORN ON.
const rect = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
// `len` scales the piece heights with the trunk the shift is cut for — a naive fixed-length
// rectangle drafted onto a half-height chibi torso strains because the FIXTURE is wrong for that
// body, not because the tailoring failed to read the cast.
const shift = (girths, { ease = 2, len = 1 } = {}) => ({
  id: 'shift', stature_cm: girths.stature_cm, ease_cm: ease, stitch_cm: 2,
  pieces: [
    { id: 'front', fit: 'pattern', chart: 'trunk', outline: rect(girths.bust / 2 + ease * 2, 40 * len), anchor: { piece: [0, 40 * len], chart: { u: 'cf', v: 'collar' } } },
    { id: 'back', fit: 'pattern', chart: 'trunk', outline: rect(girths.bust / 2 + ease * 2, 40 * len), anchor: { piece: [0, 40 * len], chart: { u: 'cb', v: 'collar' } } },
    { id: 'sleeveL', fit: 'pattern', chart: 'armL', outline: rect(girths.upperArm - 2 + ease * 2, 25 * len), anchor: { piece: [0, 25 * len], chart: { u: 'cf', v: 'shoulder' } }, mirror: 'sleeveR' },
  ],
  seams: [
    { a: { piece: 'front', edge: 'right' }, b: { piece: 'back', edge: 'left' } },
    { a: { piece: 'front', edge: 'left' }, b: { piece: 'back', edge: 'right' } },
  ],
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const unit = (a, b) => { const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, l = Math.hypot(d.x, d.y, d.z) || 1; return { x: d.x / l, y: d.y / l, z: d.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// The bones a length dial names, and the rest DIRECTIONS figure-posing.js caches at import.
const BONES = {
  upperArm: ['shoulderL', 'elbowL'],
  forearm: ['elbowL', 'wristL'],
  thigh: ['hipL', 'kneeL'],
  shank: ['kneeL', 'ankleL'],
  lumbar: ['pelvisHub', 'navel'],
  thoracic: ['navel', 'neckHub'],
  neck: ['neckHub', 'headBase'],
  skull: ['headBase', 'headTop'],
};
// figure-posing.js's REST: the six rest bone unit vectors every swivel solve rotates.
const REST_BONES = [['shoulderL', 'elbowL'], ['shoulderR', 'elbowR'], ['hipL', 'kneeL'], ['hipR', 'kneeR'], ['neckHub', 'headBase'], ['headBase', 'headTop']];

describe('phase 0 — the constants computed once from the canonical base', () => {
  const B = basePositions();

  it('figure-posing REST directions survive every LENGTH dial, exactly', () => {
    for (const dial of Object.keys(BONES)) {
      const m = castArmature({ [dial]: 1.7 });
      for (const [a, b] of REST_BONES) {
        expect(dot(unit(m[a], m[b]), unit(B[a], B[b]))).toBeCloseTo(1, 12);
      }
    }
  });

  it('figure-posing REST directions survive a SPAN dial (the arm rides along whole)', () => {
    for (const span of [{ shoulderSpan: 1.4 }, { shoulderSpan: 0.7 }]) {
      const m = castArmature(span);
      for (const [a, b] of [['shoulderL', 'elbowL'], ['shoulderR', 'elbowR']]) {
        expect(dot(unit(m[a], m[b]), unit(B[a], B[b]))).toBeCloseTo(1, 12);
      }
    }
  });

  it('a hipSpan dial DOES re-aim the thigh — the leg follows partway, by design', () => {
    const m = castArmature({ hipSpan: 1.3 });
    expect(dot(unit(m.hipL, m.kneeL), unit(B.hipL, B.kneeL))).toBeLessThan(0.9999);
    // ...and the SHANK still points where it did (knee and ankle shift together)
    expect(dot(unit(m.kneeL, m.ankleL), unit(B.kneeL, B.ankleL))).toBeCloseTo(1, 12);
  });

  it('figure-spine SHOULDER_ANCHOR_U moves with a trunk cast, so it must take a base', () => {
    const anchorU = (m) => (m.neckHub.z - m.pelvisHub.z) / (m.headTop.z - m.pelvisHub.z);
    expect(anchorU(castArmature({ thoracic: 1.5 }))).not.toBeCloseTo(anchorU(B), 6);
    expect(anchorU(castArmature({}))).toBe(anchorU(B));
  });

  it('figure-posing LEG_LEN moves with a leg cast, so the gait must take a base', () => {
    expect(legLengthOf(castArmature({ leg: 1.25 }))).toBeCloseTo(legLengthOf(B) * 1.25, 10);
    expect(legLengthOf(castArmature({}))).toBe(legLengthOf(B));
  });
});

describe('the girdle carriage', () => {
  const B = basePositions();
  const declineOf = (m) => Math.atan2(m.neckHub.z - m.shoulderL.z, Math.abs(m.shoulderL.x - m.neckHub.x)) * 180 / Math.PI;

  // The canonical armature used to put neckHub and both shoulders at the same z — a dead-level
  // clavicle, which is a permanent shrug and read stiff in every study. It now declines.
  // The canonical girdle is still LEVEL (figure-vajra's CLAVICLE_DECLINE is held at 0 — see the
  // comment there for what unblocks it). This pins that, so the day it moves, it moves here first.
  it('the canonical rest is level, and shoulderDrop is measured off it', () => {
    expect(declineOf(B)).toBeCloseTo(0, 6);
    expect(B.shoulderL.z).toBe(B.shoulderR.z);
  });

  it('shoulderDrop declines the shoulder line by exactly the degrees asked', () => {
    for (const d of [-8, -3, 0, 4, 8, 14]) expect(declineOf(castArmature({ shoulderDrop: d }))).toBeCloseTo(d, 6);
  });

  it('+ drops the acromion, − rides it up into a shrug', () => {
    expect(castArmature({ shoulderDrop: 8 }).shoulderL.z).toBeLessThan(B.shoulderL.z);
    expect(castArmature({ shoulderDrop: -8 }).shoulderL.z).toBeGreaterThan(B.shoulderL.z);
  });

  // THE INVARIANT: the arm TRANSLATES with the acromion instead of rotating with it, so the
  // humerus keeps its rest hang and figure-posing's cached REST stays exactly valid.
  it('the arm rides the acromion without changing its hang', () => {
    for (const d of [-10, 5, 12, 25]) {
      const m = castArmature({ shoulderDrop: d });
      for (const [a, b] of [['shoulderL', 'elbowL'], ['shoulderR', 'elbowR'], ['elbowL', 'wristL']]) {
        expect(dot(unit(m[a], m[b]), unit(B[a], B[b]))).toBeCloseTo(1, 12);
      }
      expect(dist(m.shoulderL, m.elbowL)).toBeCloseTo(dist(B.shoulderL, B.elbowL), 12);
    }
  });

  it('composes with a span: a wider girdle keeps its shoulder ANGLE', () => {
    const m = castArmature({ shoulderSpan: 1.3, shoulderDrop: 8 });
    expect(declineOf(m)).toBeCloseTo(8, 6);
    expect(Math.abs(m.shoulderL.x)).toBeGreaterThan(Math.abs(castArmature({ shoulderDrop: 8 }).shoulderL.x));
  });

  // KNOWN LIMIT, pinned so it is visible rather than discovered in a garment. The trunk chart's
  // cap (body-chart.js `capRows`) takes its footprint from the topmost hull z-BAND, which assumes
  // the acromion is the highest thing on the body. Past ~5° of drop the deltoids fall out of that
  // band and W collapses. It costs nothing for a shell or a side-seam garment; it misplaces a
  // piece anchored to the CREST, i.e. one with a shoulder seam. The day capRows takes its
  // footprint from the shoulder LINE instead, this test is what says so.
  it('past ~5° the trunk cap footprint collapses — a shoulder-seamed garment is the casualty', () => {
    const capW = (drop) => buildBodyCharts(buildPosedFigure({}, {}, null, { cast: { shoulderDrop: drop } }), { stature_cm: 170 }).charts.trunk.cap.W;
    const w0 = buildBodyCharts(buildPosedFigure({}, {}, null), { stature_cm: 170 }).charts.trunk.cap.W;
    for (const d of [2, 4]) expect(capW(d) / w0).toBeGreaterThan(0.9);     // the shoulder line is still in the band
    for (const d of [8, 12]) expect(capW(d) / w0).toBeLessThan(0.75);      // it is not
  });

  it('...but a side-seam garment tailors fine at any drop', () => {
    const girths = bodyGirths(buildPosedFigure({}, {}, null), { stature_cm: 170 });
    for (const d of [0, 4, 8, 12]) {
      const report = figurePatternReport({ cast: { shoulderDrop: d }, garment: shift(girths) });
      for (const piece of report[0].pieces) { expect(piece.clipped).toBe(0); expect(piece.strain.max).toBeLessThan(2); }
      for (const seam of report[0].seams) expect(seam.gap_cm).toBeLessThan(16);
    }
  });

  it('is an ANGLE, so 0 is valid and the bounds are two-sided', () => {
    expect(validateCast({ shoulderDrop: 0 })).toEqual([]);
    expect(validateCast({ shoulderDrop: -15 })).toEqual([]);
    expect(validateCast({ shoulderDrop: 40 })[0]).toMatch(/\[-20, 30\] degrees/);
    expect(validateCast({ shoulderDrop: -40 })[0]).toMatch(/\[-20, 30\] degrees/);
    expect(validateCast({ shoulderDrop: NaN })[0]).toMatch(/finite number/);
  });
});

describe('identity', () => {
  it('castArmature({}) is basePositions(), exactly', () => {
    expect(castArmature({})).toEqual(basePositions());
    expect(castArmature()).toEqual(basePositions());
    expect(castArmature('canonical')).toEqual(basePositions());
    expect(castArmature(null)).toEqual(basePositions());
  });

  it('every coordinate is bit-identical (no multiply-by-one drift)', () => {
    const a = castArmature({}), b = basePositions();
    for (const k of Object.keys(b)) for (const ax of ['x', 'y', 'z']) expect(Object.is(a[k][ax], b[k][ax])).toBe(true);
  });

  it('is pure — two calls agree and neither mutates the armature', () => {
    castArmature({ limb: 2, shoulderSpan: 1.5 });
    expect(castArmature({})).toEqual(basePositions());
    expect(castArmature({ thigh: 1.3 })).toEqual(castArmature({ thigh: 1.3 }));
  });
});

describe('each dial scales the bone it names', () => {
  const B = basePositions();

  it.each(Object.entries(BONES))('%s', (dial, [a, b]) => {
    for (const k of [0.6, 1.45, 2.2]) {
      const m = castArmature({ [dial]: k });
      expect(dist(m[a], m[b])).toBeCloseTo(dist(B[a], B[b]) * k, 9);
    }
  });

  it('a limb dial leaves every OTHER bone at its canonical length', () => {
    const m = castArmature({ forearm: 1.8 });
    for (const [dial, [a, b]] of Object.entries(BONES)) {
      if (dial === 'forearm') continue;
      expect(dist(m[a], m[b])).toBeCloseTo(dist(B[a], B[b]), 12);
    }
  });

  it('span dials move the girdle half-span and nothing lengthwise', () => {
    const m = castArmature({ shoulderSpan: 1.25, hipSpan: 0.8 });
    // the clavicle scales as a vector (the rest girdle is declined), so the half-span AND the
    // acromion's drop below the neck root scale together — the shoulder LINE keeps its angle
    expect(Math.abs(m.shoulderL.x)).toBeCloseTo(Math.abs(B.shoulderL.x) * 1.25, 12);
    expect(B.neckHub.z - m.shoulderL.z).toBeCloseTo((B.neckHub.z - B.shoulderL.z) * 1.25, 12);
    expect(Math.abs(m.hipL.x)).toBeCloseTo(Math.abs(B.hipL.x) * 0.8, 12);
    for (const [dial, [a, b]] of Object.entries(BONES)) {
      if (dial === 'thigh') continue;   // the thigh re-aims with the pelvis (leg follows 45 %)
      expect(dist(m[a], m[b])).toBeCloseTo(dist(B[a], B[b]), 12);
    }
  });

  it('the trunk carries what sits above it', () => {
    const B0 = basePositions();
    const m = castArmature({ thoracic: 1.4 });
    const rise = dist(B0.navel, B0.neckHub) * 0.4;
    // the shoulder girdle, head and arms all ride the lengthened ribcage
    for (const k of ['neckHub', 'headBase', 'headTop', 'shoulderL', 'elbowR', 'wristL']) {
      expect(m[k].z - B0[k].z).toBeCloseTo(rise, 9);
    }
    // ...the hips and legs do not
    for (const k of ['hipL', 'kneeR', 'ankleL']) expect(m[k].z).toBeCloseTo(B0[k].z, 12);
  });

  it('aggregate dials reach both segments', () => {
    const m = castArmature({ arm: 1.5 });
    expect(armLengthOf(m)).toBeCloseTo(armLengthOf(basePositions()) * 1.5, 10);
  });
});

describe('the ground is invariant', () => {
  const B = basePositions();
  it.each(CAST_PRESET_NAMES)('%s re-seats onto the canonical floor', (name) => {
    const m = castArmature(name);
    expect(m.ankleL.z).toBeCloseTo(B.ankleL.z, 12);
    expect(m.ankleR.z).toBeCloseTo(B.ankleR.z, 12);
  });

  it('a longer leg grows the figure UPWARD off the floor', () => {
    const m = castArmature({ leg: 1.3 });
    expect(m.ankleL.z).toBeCloseTo(B.ankleL.z, 12);
    expect(m.headTop.z).toBeGreaterThan(B.headTop.z);
  });

  it('brute is what it claims: ape index up, legs short, shoulders wide', () => {
    const m = castArmature('brute');
    expect(armLengthOf(m) / legLengthOf(m)).toBeGreaterThan(armLengthOf(B) / legLengthOf(B));
    expect(legLengthOf(m)).toBeLessThan(legLengthOf(B));
    expect(Math.abs(m.shoulderL.x)).toBeGreaterThan(Math.abs(B.shoulderL.x));
  });
});

describe('resolveCast', () => {
  it('fills every dial and defaults to canonical', () => {
    expect(resolveCast()).toEqual(CAST_DEFAULT);
    expect(Object.keys(resolveCast({ thigh: 2 })).sort()).toEqual([...CAST_KEYS].sort());
  });

  it('expands aggregates, and an explicit dial wins over its group', () => {
    expect(resolveCast({ limb: 1.2 })).toMatchObject({ upperArm: 1.2, forearm: 1.2, thigh: 1.2, shank: 1.2 });
    expect(resolveCast({ limb: 1.2, forearm: 2 })).toMatchObject({ upperArm: 1.2, forearm: 2 });
    expect(resolveCast({ torso: 1.1 })).toMatchObject({ lumbar: 1.1, thoracic: 1.1 });
  });

  it('resolves a preset by VALUE and records where it came from', () => {
    const r = resolveCast('brute');
    expect(r).toMatchObject(CAST_PRESETS.brute.dials);
    expect(r.from).toBe('brute');
    for (const k of CAST_KEYS) expect(typeof r[k]).toBe('number');
  });

  it('merges an array left → right so a preset can be nudged', () => {
    const r = resolveCast(['brute', { forearm: 1.3 }]);
    expect(r.forearm).toBe(1.3);
    expect(r.shoulderSpan).toBe(CAST_PRESETS.brute.dials.shoulderSpan);
    expect(r.from).toBe('brute');
  });

  it('every preset resolves and every preset dial is a known key', () => {
    for (const name of CAST_PRESET_NAMES) {
      expect(() => castArmature(name)).not.toThrow();
      for (const k of Object.keys(CAST_PRESETS[name].dials)) expect(CAST_KEYS).toContain(k);
      expect(typeof CAST_PRESETS[name].note).toBe('string');
    }
  });

  it('throws on an unknown preset', () => {
    expect(() => resolveCast('hulk')).toThrow(/unknown cast preset/);
  });
});

describe('validateCast', () => {
  it('passes what it should', () => {
    expect(validateCast(null)).toEqual([]);
    expect(validateCast('chibi')).toEqual([]);
    expect(validateCast({ thigh: 0.4, limb: 3 })).toEqual([]);
    expect(validateCast(['heroic', { forearm: 1.1, from: 'heroic' }])).toEqual([]);
  });

  it('is unbounded above — taste is the operator\'s', () => {
    expect(validateCast({ upperArm: 9 })).toEqual([]);
  });

  it('refuses a broken skeleton, not a bold one', () => {
    expect(validateCast({ thigh: 0 })[0]).toMatch(/finite number > 0/);
    expect(validateCast({ thigh: -1 })[0]).toMatch(/finite number > 0/);
    expect(validateCast({ thigh: NaN })[0]).toMatch(/must be a finite number/);
    expect(validateCast({ thigh: 'long' })[0]).toMatch(/must be a finite number/);
    expect(validateCast({ bicep: 2 })[0]).toMatch(/unknown dial/);
    expect(validateCast('xxl')[0]).toMatch(/unknown preset/);
  });
});

// ── The cast through the whole pipeline. Everything above is arithmetic on 17 points; these
//    are the gates that say the flesh, the balance IK, the gait, the rig and the tailoring all
//    actually read it — and that a figure with no cast is untouched.
describe('the cast through the render pipeline', () => {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const allPts = (stacks) => stacks.flatMap((s) => s.rings.flatMap((r) => r.polyline));
  const WORLD_FLOOR = 0.02;   // figure-render worldVertex plants every body this far off z = 0
  const heightOf = (stacks) => {
    const z = allPts(stacks).map((q) => q.z);
    return Math.max(...z) - Math.min(...z);
  };

  it('absent channel: no cast is byte-identical to before casts existed', () => {
    const a = buildPosedFigure({}, {}, null);
    expect(buildPosedFigure({}, {}, null, {})).toEqual(a);
    expect(buildPosedFigure({}, {}, null, { cast: null })).toEqual(a);
    expect(buildPosedFigure({}, {}, null, { cast: 'canonical' })).toEqual(a);
    expect(renderFigureToSvg({ pose: {}, proto: {} })).toBe(renderFigureToSvg({ pose: {}, proto: {}, cast: null }));
  });

  it('is deterministic and actually changes the flesh', () => {
    const a = renderFigureToSvg({ cast: 'brute' });
    expect(renderFigureToSvg({ cast: 'brute' })).toBe(a);
    expect(a).not.toBe(renderFigureToSvg({}));
    expect(renderFigureToSvg({ cast: ['brute', { forearm: 1.3 }] })).not.toBe(a);
  });

  it('a longer leg makes a taller figure, a shorter one a shorter figure', () => {
    const base = heightOf(buildPosedFigure({}, {}, null));
    expect(heightOf(buildPosedFigure({}, {}, null, { cast: { leg: 1.3 } }))).toBeGreaterThan(base);
    expect(heightOf(buildPosedFigure({}, {}, null, { cast: { leg: 0.7 } }))).toBeLessThan(base);
  });

  // The cast re-seats the ARMATURE's ankle onto the canonical floor, which is what the balance
  // solve and the armature readout need. The FLESH sole hangs below that ankle by the leg
  // extensions figure-proto applies (knee +15 %, ankle +20 %), and those are proportional, so a
  // cast leg's sole sits proportionally lower in raw STAND space. Harmless, and it is the
  // renderer's job either way: every render path plants the body on `stackMinZ`. This is the
  // gate that says so — the ground is the ground for every preset.
  it.each(CAST_PRESET_NAMES)('%s is planted on the world floor', (name) => {
    const { frames } = renderFigureWorldFrames({ cast: name }, 1);
    const z = frames[0].faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...z)).toBeCloseTo(WORLD_FLOOR, 6);   // worldVertex's fixed ground clearance
  });

  it('...and the presets stand at the heights they claim', () => {
    const top = (name) => Math.max(...renderFigureWorldFrames({ cast: name }, 1).frames[0].faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(top('heroic')).toBeGreaterThan(top('canonical'));
    expect(top('brute')).toBeLessThan(top('canonical'));       // short legs, wide body
    expect(top('chibi')).toBeLessThan(top('child'));
  });

  it.each(CAST_PRESET_NAMES)('%s builds finite flesh, bare and dressed', (name) => {
    for (const garment of [null, 'tee', 'trousers']) {
      for (const sex of ['male', 'female']) {
        const stacks = buildPosedFigure({}, { sex }, garment, { cast: name });
        expect(stacks.length).toBeGreaterThan(0);
        for (const q of allPts(stacks)) expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z)).toBe(true);
      }
    }
  });

  it('the balance IK solves on the CAST bone lengths, not the canonical ones', () => {
    const B = basePositions();
    for (const name of ['brute', 'chibi', 'heroic']) {
      const b = castArmature(name);
      // a spine SIDE-BEND deviates the COM, so the counter-shift + 2-bone IK actually run, and
      // it stays well inside the leg's reach (unlike a committed one-foot stance, which
      // over-extends the shank on the canonical figure too).
      const arm = balancedArmature({ spine: { lateral: 0.35 } }, null, b);
      // the re-solved support leg keeps the CAST's femur and shank, not the canonical ones
      expect(dist(arm.hipR, arm.kneeR)).toBeCloseTo(dist(b.hipR, b.kneeR), 6);
      expect(dist(arm.kneeR, arm.ankleR)).toBeCloseTo(dist(b.kneeR, b.ankleR), 5);
      expect(dist(arm.hipR, arm.kneeR)).not.toBeCloseTo(dist(B.hipR, B.kneeR), 3);
    }
  });

  it('the gait converts a ground stride against the CAST leg — a long leg swings less', () => {
    const hip = (move) => move(0.25).hipR.pitch;
    const long = gait({}, castArmature({ leg: 1.4 })), short = gait({}, castArmature({ leg: 0.7 }));
    expect(Math.abs(hip(long))).toBeLessThan(Math.abs(hip(gait({}))));
    expect(Math.abs(hip(short))).toBeGreaterThan(Math.abs(hip(gait({}))));
  });

  it('a walk renders over every preset', () => {
    for (const name of CAST_PRESET_NAMES) {
      const frames = renderFigureFrames({ cast: name, motion: 'walk' }, 4);
      expect(frames).toHaveLength(4);
      for (const f of frames) expect(f).toContain('<svg');
    }
  }, 60_000);   // every preset × 4 fleshed frames, nothing to cache: its own ceiling under full-suite load

  it('the exported rig is cast too, and the canonical rig is untouched', () => {
    expect(buildRig(DIMORPH.male)).toEqual(PROTOFORM_HUMAN_MALE);
    const brute = buildRig(DIMORPH.male, 'brute');
    expect(brute.cast.from).toBe('brute');
    expect(brute.joints).toEqual(PROTOFORM_HUMAN_MALE.joints);       // a cast never touches a joint's range
    expect(Math.abs(brute.slots.wristL[0])).toBeGreaterThan(Math.abs(PROTOFORM_HUMAN_MALE.slots.wristL[0]));
    for (const v of Object.values(brute.slots)) for (const c of v) expect(Number.isFinite(c)).toBe(true);
  });

  // The cut-and-sewn family is the one that proves the tailoring READS the cast: a piece is
  // drafted flat in centimetres off the body's own charts, so if the charts did not follow the
  // cast the shift would draft for a canonical figure and strain or clip on this one.
  it.each(['heroic', 'brute', 'chibi'])('a cut-and-sewn shift drafts and sews on a %s body', (name) => {
    const girths = bodyGirths(buildPosedFigure({}, {}, null, { cast: name }), { stature_cm: 170 });
    const dials = resolveCast(name);
    const report = figurePatternReport({ cast: name, garment: shift(girths, { len: (dials.lumbar + dials.thoracic) / 2 }) });
    expect(report).not.toBeNull();
    expect(report[0].warnings ?? []).toEqual([]);
    for (const piece of report[0].pieces) {
      expect(piece.clipped).toBe(0);
      expect(piece.strain.max).toBeLessThan(2);
    }
  });

  it('a stored `proportions` migrates to the equivalent cast instead of breaking', () => {
    const legacy = buildPosedFigure({}, {}, null, { cast: { torso: 0.5, neck: 0.5, limb: 0.5, shoulderSpan: 0.82, hipSpan: 0.82 } });
    expect(heightOf(legacy)).toBeLessThan(heightOf(buildPosedFigure({}, {}, null)));
    expect(() => renderFigureToSvg({ proportions: { body: 0.5, lateral: 0.82 } })).not.toThrow();
    expect(renderFigureToSvg({ proportions: { body: 0.5, lateral: 0.82 } })).not.toBe(renderFigureToSvg({}));
  });
});
