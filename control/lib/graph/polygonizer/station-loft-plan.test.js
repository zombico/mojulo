import { describe, expect, it } from 'vitest';

import { expandPlan, validatePlan, PLAN_SCHEMA, SLOT_FAMILIES, segmentBind, mirrorPartName, loftPart } from './station-loft-plan.js';
import { compileLayered, auditLayered, mirrorPid } from './station-loft.js';
import { validateRig, bindLayered, skinLayered, rigNodesAt, boneFrames } from './station-loft-rig.js';

// A small biped: a trunk, a two-link tail, one leg (right authored, left by name) with a claw on the toe, a rig.
const plan = () => ({
  schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y' },
  joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05], tail0: [0, -0.2, 0.9], tail1: [0, -0.5, 0.8], tail2: [0, -0.8, 0.75] },
  segments: [
    { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24], yc: 0.02, e: 2.4 }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, group: 'Torso', tint: '#667', mirror: 'plane', bind: 'torso' },
    { name: 'tail', kind: 'chain', joints: ['tail0', 'tail1', 'tail2'], r: [0.12, 0.08, 0.03], group: 'Tail', tint: '#556', mirror: 'plane', bind: { root: 'torso' } },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: [0.14, 0.15], rB: 0.1, e: 2.2, over: [0.5, 0.6], group: 'Legs', tint: '#565', mirror: 'name', bind: { bone: 'thighR', prev: 'torso', next: 'shinR' } },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], over: [0.6, 0.3], group: 'Legs', tint: '#565', mirror: 'name', bind: { bone: 'shinR', prev: 'thighR', next: null } },
  ],
  details: [
    { name: 'clawR', kind: 'claw', base: [0.22, 0.3, 0.03], dir: [0, 0.9, -0.3], length: 0.08, radius: 0.015, pin: { parent: 'shinR', face: 'shinR/st1-st2.k0.b', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['shinR/st1.front', 'shinR/st2.front'], handedness: 1 }, tint: '#eee', stretch: 'clawLength', mirror: 'clawL' },
  ],
  dials: {
    bulk: { min: 0.8, max: 1.3, rest: 1, doc: 'x scale of the trunk', op: 'scale', axis: 'x', pivot: 0, parts: ['torso'], blend: { st0: 1, st1: 1, st2: 1, back: 1, tip: 1 } },
    clawLength: { min: 0.5, max: 2, rest: 1, doc: 'claw stretch', op: 'stretch', parts: [] },
    tailCurl: { min: -20, max: 20, rest: 0, doc: 'tail', op: 'chain', axis: 'x', sign: -1, links: [{ pivot: 'tail1/back', parts: ['tail1'] }] },
    stance: { min: 0.8, max: 1.2, rest: 1, doc: 'legs', op: 'scale', axis: 'x', pivot: 0, parts: ['thigh$S', 'shin$S'], blend: { st0: 1, st1: 1, st2: 1, back: 1, tip: 1 } },
  },
  rig: {
    joints: {
      pelvisHub: { at: [0, 0, 1] }, navel: { at: [0, 0, 1.3] }, neckHub: { at: [0, 0, 1.7] }, headBase: { at: [0, 0, 1.8] }, headTop: { at: [0, 0, 2] },
      shoulder$S: { at: [0.2, 0, 1.6] }, elbow$S: { at: [0.3, 0, 1.3] }, wrist$S: { at: [0.3, 0, 1.0] },
      hip$S: { at: [0.2, 0, 1] }, knee$S: { at: [0.22, 0.1, 0.5] }, ankle$S: { at: [0.22, 0.3, 0.05] },
      tail0: { at: [0, -0.2, 0.9], rides: 'torso' }, tail1: { at: [0, -0.5, 0.8], rides: 'torso' }, tail2: { at: [0, -0.8, 0.75], rides: 'torso' },
    },
    bones: [
      { id: 'torso', head: 'pelvisHub', tail: 'neckHub', aux: ['hipL', 'hipR'] },
      { perSide: [{ id: 'thigh$S', head: 'hip$S', tail: 'knee$S' }, { id: 'shin$S', head: 'knee$S', tail: 'ankle$S' }] },
      { id: 'tail0', head: 'tail0', tail: 'tail1' }, { id: 'tail1', head: 'tail1', tail: 'tail2' },
    ],
    chains: { tail: { axis: 'x', sign: -1, links: [{ pivot: 'tail1', joints: ['tail2'] }] } },
  },
});

describe('station-loft-plan — the ring plan expands into a layered recipe', () => {
  it('a loft: explicit stations along a polyline, rings perpendicular to the local direction, mirrored by name, closed', () => {
    const p = plan();
    p.segments.push({ name: 'flankR', kind: 'loft', stations: [{ at: [0.1, 0, 1.0], r: [0.1, 0.11] }, { at: [0.16, 0.05, 0.8], r: 0.09 }, { at: [0.2, 0.1, 0.55], r: [0.07, 0.075] }, { at: [0.22, 0.1, 0.5], r: 0.07 }], group: 'Legs', tint: '#565', mirror: 'name', bind: { bone: 'thighR', blend: { st0: { torso: 1 }, st1: { torso: 0.5, thighR: 0.5 }, st3: { thighR: 1 } } } });
    const recipe = expandPlan(p); const R = recipe.parts.flankR, L = recipe.parts.flankL;
    expect(R.stations.map((s) => s.id)).toEqual(['st0', 'st1', 'st2', 'st3']); expect(R.slots).toEqual(SLOT_FAMILIES.limb6);
    // each ring lies in the plane perpendicular to the chord between its neighbours
    const C = [[0.1, 0, 1.0], [0.16, 0.05, 0.8], [0.2, 0.1, 0.55], [0.22, 0.1, 0.5]]; const sub = (a, b) => a.map((x, i) => x - b[i]); const dot = (a, b) => a.reduce((t, x, i) => t + x * b[i], 0);
    R.stations.forEach((st, i) => { const d = sub(C[Math.min(i + 1, 3)], C[Math.max(i - 1, 0)]); for (const q of Object.values(st.points)) expect(Math.abs(dot(sub(q, C[i]), d))).toBeLessThan(1e-6); });
    for (const st of R.stations) { const left = L.stations.find((s) => s.id === st.id); for (const [slot, q] of Object.entries(st.points)) expect(left.points[mirrorPid(slot)]).toEqual([-q[0] + 0, q[1], q[2]]); }
    expect(R.caps.back[2]).toBeGreaterThan(1.0); expect(R.caps.tip[2]).toBeLessThan(0.5);   // pinched beyond the end rings
    expect(Object.values(auditLayered(compileLayered(recipe))).every((r) => r.pass)).toBe(true);
    expect(() => validatePlan({ ...plan(), segments: [...plan().segments, { name: 'x', kind: 'loft', stations: [{ at: [0.1, 0, 1], r: 0.1 }], mirror: 'name' }] })).toThrow(/at least two stations/);
    expect(() => validatePlan({ ...plan(), segments: [...plan().segments, { name: 'x', kind: 'loft', stations: [{ at: [0.1, 0, 1], r: 0.1 }, { at: [0.1, 0, 0.5], r: 0.1 }], mirror: 'name' }] })).toThrow(/must end in R or L/);
    expect(loftPart([{ at: [0, 0, 1], r: 0.1 }, { at: [0, 0, 0] , r: 0.1 }]).caps.back).toEqual([0, 0, 1.045]);
  });
  it('a style block sets every ring family and exponent at once; a segment or station that names its own wins; unknown families refuse', () => {
    const p = plan(); p.style = { slots: 'ring12', limbSlots: 'ring6', e: 8 };
    const recipe = expandPlan(p);
    expect(recipe.parts.torso.slots).toEqual(SLOT_FAMILIES.ring12); expect(recipe.parts.tail0.slots).toEqual(SLOT_FAMILIES.ring6); expect(recipe.parts.shinR.slots).toEqual(SLOT_FAMILIES.ring6);
    // e: the trunk station that names 2.4 keeps it, the others take 8; the thigh names 2.2, the shin takes 8
    const corner = (part, st, slot) => Math.hypot(...part.stations.find((s) => s.id === st).points[slot].slice(0, 2));
    const plain = expandPlan(plan());
    expect(corner(recipe.parts.shinR, 'st0', 'frontR')).toBeGreaterThan(corner(plain.parts.shinR, 'st0', 'frontR'));   // a boxier ring reaches further at the diagonal
    expect(recipe.parts.thighR.stations.find((s) => s.id === 'st0').points.frontR).toEqual(plain.parts.thighR.stations.find((s) => s.id === 'st0').points.frontR);
    expect(recipe.parts.torso.stations.find((s) => s.id === 'st1').points.sideR).toEqual(recipe.parts.torso.stations.find((s) => s.id === 'st1').points.sideR);
    for (const dials of [{}, { bulk: 1.3, stance: 0.8 }]) expect(Object.values(auditLayered(compileLayered(recipe, dials))).every((r) => r.pass)).toBe(true);
    expect(() => validatePlan({ ...plan(), style: { slots: 'ring7' } })).toThrow(/style\.slots names slot family 'ring7'/);
    expect(() => validatePlan({ ...plan(), style: { e: 0.5 } })).toThrow(/style\.e/);
    expect(() => validatePlan({ ...plan(), style: { tint: '#fff' } })).toThrow(/style\.tint is not a style key/);
    expect(JSON.stringify(expandPlan({ ...plan(), style: { slots: 'ring8', limbSlots: 'limb6', e: 2 } }))).toBe(JSON.stringify(plain));   // the defaults, spelled out, change nothing
  });
  it('expands segments, a chain, a mirrored limb, a claw and the rig; every part closes; ids mirror by name', () => {
    const recipe = expandPlan(plan());
    expect(Object.keys(recipe.parts)).toEqual(['torso', 'tail0', 'tail1', 'thighR', 'thighL', 'shinR', 'shinL', 'clawR', 'clawL']);
    expect(recipe.parts.torso.slots).toEqual(SLOT_FAMILIES.ring8); expect(recipe.parts.thighR.slots).toEqual(SLOT_FAMILIES.limb6);
    // the left limb is the exact mirror of the right, by name
    for (const st of recipe.parts.thighR.stations) { const left = recipe.parts.thighL.stations.find((s) => s.id === st.id);
      for (const [slot, p] of Object.entries(st.points)) expect(left.points[mirrorPid(slot)]).toEqual([-p[0] + 0, p[1], p[2]]); }
    // binds: the segment form expands to shared overshoot rings; the chain binds link to link; the mirror renames bones
    expect(recipe.parts.thighR.bind).toEqual(segmentBind('torso', 'thighR', 'shinR'));
    expect(recipe.parts.thighL.bind).toEqual(segmentBind('torso', 'thighL', 'shinL'));
    expect(recipe.parts.tail0.bind).toEqual(segmentBind('torso', 'tail0', 'tail1')); expect(recipe.parts.tail1.bind).toEqual(segmentBind('tail0', 'tail1', null));
    // the claw rides its stretch dial (both sides), stores local offsets, mirrors with reversed winding
    expect(recipe.dials.clawLength.parts).toEqual(['clawR', 'clawL']); expect(recipe.parts.clawR.stretch.dial).toBe('clawLength');
    expect(recipe.parts.clawL.pin.parent).toBe('shinL'); expect(recipe.parts.clawL.pin.handedness).toBe(-1);
    // `$S` in a dial's parts and in the rig
    expect(recipe.dials.stance.parts).toEqual(['thighR', 'thighL', 'shinR', 'shinL']);
    expect(recipe.rig.joints.hipL.at).toEqual([-0.2, 0, 1]); expect(recipe.rig.bones.map((b) => b.id)).toEqual(['torso', 'thighR', 'shinR', 'thighL', 'shinL', 'tail0', 'tail1']);
    const mesh = compileLayered(recipe); const audit = auditLayered(mesh);
    expect(Object.entries(audit).filter(([, r]) => !r.pass)).toEqual([]);
    for (const dials of [{}, { bulk: 1.3, clawLength: 2, tailCurl: 20, stance: 0.8 }]) expect(compileLayered(recipe, dials).pointIds).toEqual(mesh.pointIds);
    // the rig binds and skins at rest as identity
    const R = validateRig(recipe.rig); const skin = bindLayered(mesh, recipe, R); const frames = boneFrames(R, R.joints, rigNodesAt(R, {}).nodes);
    const posed = skinLayered(mesh, skin, frames);
    for (let i = 0; i < mesh.vertices.length; i++) for (let k = 0; k < 3; k++) expect(Math.abs(posed[i][k] - mesh.vertices[i][k])).toBeLessThan(1e-9);
  });
  it('is deterministic and rounds every coordinate to the micrometre', () => {
    const a = expandPlan(plan()), b = expandPlan(plan());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const walk = (v) => { if (typeof v === 'number') expect(Math.round(v * 1e6) / 1e6).toBe(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    // (a claw's `root` is the exact mean of its rounded base ring, unrounded on purpose, so the loft axis starts at t = 0)
    for (const p of Object.values(a.parts)) { if (p.stations) p.stations.forEach((s) => walk(s.points)); if (p.caps) walk(p.caps); if (p.offsets) walk(Object.fromEntries(Object.entries(p.offsets).filter(([k]) => k !== 'root'))); }
    for (const j of Object.values(a.rig.joints)) walk(j.at);
  });
  it('an include wears a baked fragment at a shift: L1 points translated, offsets untouched, scale pivots shifted, dials spliced in order, binds applied', () => {
    const p = plan();
    const head = expandPlan({ schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y' }, joints: {}, segments: [{ name: 'skull', kind: 'trunk', stations: [{ z: 0, r: 0.2 }, { z: 0.3, r: 0.15 }], caps: { back: [0, 0, -0.1], tip: [0, 0, 0.4] }, mirror: 'plane' }], dials: { dome: { min: 0.8, max: 1.2, rest: 1, doc: 'z scale', op: 'scale', axis: 'z', pivot: 0, parts: ['skull'], blend: { st0: 0, st1: 1, tip: 1 } } } });
    p.include = [{ name: 'head', parts: head.parts, dials: head.dials, shift: [0, 0.1, 1.8], bind: { skull: 'torso' } }];
    p.dials = { bulk: p.dials.bulk, head: { op: 'include', name: 'head' }, clawLength: p.dials.clawLength, tailCurl: p.dials.tailCurl, stance: p.dials.stance };
    const r = expandPlan(p);
    expect(Object.keys(r.dials)).toEqual(['bulk', 'dome', 'clawLength', 'tailCurl', 'stance']);
    expect(r.dials.dome.pivot).toBe(1.8); expect(r.parts.skull.caps.tip).toEqual([0, 0.1, 2.2]); expect(r.parts.skull.bind).toBe('torso');
    expect(Object.entries(auditLayered(compileLayered(r))).filter(([, x]) => !x.pass)).toEqual([]);
  });
  it('refuses with a pointer: bad schema, a missing joint, a duplicate name, an unknown slot family, a claw on a missing face, an undeclared stretch dial, an include a dial names but no include declares', () => {
    const bad = (mut, re) => { const p = plan(); mut(p); expect(() => expandPlan(p)).toThrow(re); };
    bad((p) => { p.schema = 'x'; }, /schema must be/);
    bad((p) => { p.segments[2].from = 'knuckle'; }, /names joint 'knuckle'/);
    bad((p) => { p.segments.push({ ...p.segments[2] }); }, /used twice/);
    bad((p) => { p.segments[0].slots = 'ring9'; }, /slots must name a family/);
    bad((p) => { p.details[0].pin.face = 'shinR/st7-st8.k0.b'; }, /clawR/);
    bad((p) => { p.details[0].stretch = 'nope'; }, /stretch dial 'nope'/);
    bad((p) => { p.dials.head = { op: 'include', name: 'head' }; }, /no include declares/);
    bad((p) => { p.segments[2].mirror = 'plane'; p.segments[2].name = 'thigh'; }, /joint 'hip' must sit on x = 0/);
    expect(validatePlan(plan())).toBe(true);
  });
  it('mirrorPartName flips only a trailing R or L', () => { expect(mirrorPartName('thighR')).toBe('thighL'); expect(mirrorPartName('torso')).toBe('torso'); expect(mirrorPartName('tail0')).toBe('tail0'); });
});
