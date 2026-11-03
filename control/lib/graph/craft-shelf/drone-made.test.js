// The drones in the aircraft's language (drone-made.js, craft-form.js's spins, air-surface.js's wear on drones): each
// drone kind's made fittings (a frame's parting line or screws, an arm's cable, a motor's wires, a rotor's hub screws, a
// gimbal's lens ring), all fittings, none without the word or on a starship drone; the aircraft's made fittings their
// own size on a small fixed-wing drone; a drone's rotors and propellers spinning about their hubs in its figure, a
// mirrored pair and a coaxial pair turning against each other; wear sized to the drone; within the budget in camo and
// battered. The cases are chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, CRAFT_ODM, CRAFT_ARCHETYPES } from './index.js';
import { craftForm, craftFormFigure } from './craft-form.js';

const A = CRAFT_ARCHETYPES;
const has = (k, kind) => A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === kind);
const QUAD = Object.keys(A).find((k) => A[k].realm === 'earth' && has(k, 'drone-rotor') && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.build.family === 'gimbal3'));
const COAX = Object.keys(A).find((k) => A[k].layout.some((e) => e.flip === 'z' && CRAFT_ODM[e.sku]?.kind === 'drone-motor'));
const SMALLWING = Object.keys(A).find((k) => A[k].look && has(k, 'craft-wing') && A[k].reference.mtow < 5 && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.build.hinge));
const SPACE = Object.keys(A).find((k) => A[k].realm === 'space' && has(k, 'drone-frame'));
const ids = (m, id) => { const it = m.items.find((i) => i.id === id); return ['lathes', 'sweeps', 'extrudes', 'lofts'].flatMap((k) => (it.source[k] ?? []).map((x) => ({ id: x.id, group: x.group }))); };
const faces = (C) => C.items.flatMap((i) => i.faces);
const tris = (C) => faces(C).reduce((s, f) => s + f.corners.length - 2, 0);

describe('a drone\'s made fittings', () => {
  const made = assembleCraft(QUAD, { made: true }).manifest, plain = assembleCraft(QUAD).manifest;
  const firstOf = (kind) => made.items.find((i) => i.source.garage.kind === kind).id;
  it('each kind its own: the frame\'s line or screws, an arm\'s cable, a motor\'s wires, a rotor\'s hub screws, the gimbal\'s lens ring', () => {
    const want = { 'drone-frame': /^(parting_line|top_screw|rim_screw)/, 'drone-arm': /^(cable|wire)/, 'drone-motor': /^wire/, 'drone-rotor': /^hub_screw/, 'drone-payload': /^lens_ring/ };
    for (const [kind, re] of Object.entries(want)) expect(ids(made, firstOf(kind)).some((x) => re.test(x.id)), kind).toBe(true);
  });
  it('all of them fittings; none without the word; none on a starship drone', () => {
    for (const it of made.items) {
      const own = new Set(ids(plain, it.id).map((x) => x.id));
      for (const x of ids(made, it.id).filter((x) => !own.has(x.id))) expect(x.group, `${it.id} ${x.id}`).toBe('fitting');
    }
    const s = assembleCraft(SPACE, { made: true }).manifest, p = assembleCraft(SPACE).manifest;
    expect(JSON.stringify(s)).toBe(JSON.stringify(p));
  });
  it('a small fixed-wing drone\'s made fittings its own size: no fairing as long as its wing is deep', () => {
    const m = assembleCraft(SMALLWING, { made: true }).manifest, wing = m.items.find((i) => i.source.garage.kind === 'craft-wing');
    const chord = CRAFT_ODM[wing.source.garage.sku].build.rootChord;
    const fairings = (wing.source.lathes ?? []).filter((l) => /^actuator_/.test(l.id));
    for (const l of fairings) expect(Math.hypot(l.axisTo.x - l.axisFrom.x, l.axisTo.y - l.axisFrom.y, l.axisTo.z - l.axisFrom.z)).toBeLessThan(chord * 0.5);
  });
});

describe('its rotors spinning in its figure', () => {
  it('each rotor a bone at its hub, a full turn about the vertical over its clip; the craft\'s idle still unless asked', () => {
    const F = craftFormFigure(QUAD), S = craftFormFigure(QUAD, { spin: true }), C = craftForm(QUAD);
    expect(F.clips.spin).toBeDefined();
    expect(F.clips.idle).not.toBe(F.clips.spin);
    expect(S.clips.idle).toEqual(S.clips.spin);
    const rotor = C.spins[0], bi = F.bones.findIndex((b) => b.id === rotor.id), nb = F.bones.length;
    expect(F.bones[bi].head).toEqual(rotor.hub);
    // (a quarter of the way through, a quarter turn about the vertical)
    const at = (k) => F.clips.spin.b.slice((k * nb + bi) * 7, (k * nb + bi) * 7 + 4);
    const q = at(F.clips.spin.k / 4);
    expect(Math.abs(q[2])).toBeCloseTo(Math.SQRT1_2, 3);
    expect(q[0]).toBe(0);
    expect(q[1]).toBe(0);
  });
  it('a mirrored pair turns against itself; a coaxial pair, one over the other, turns against itself', () => {
    const turn = (C, id) => C.spins.find((s) => s.id === id).turn;
    const C = craftForm(QUAD), r = C.spins.find((s) => s.id.endsWith('-r'));
    expect(turn(C, r.id)).toBe(-turn(C, r.id.replace(/-r$/, '-l')));
    const X = craftForm(COAX), low = X.spins.find((s) => /RotorLow-r$/.test(s.id)), up = X.spins.find((s) => s.id === low.id.replace('RotorLow', 'Rotor'));
    expect(Math.hypot(low.hub[0] - up.hub[0], low.hub[1] - up.hub[1])).toBeLessThan(1e-3);
    expect(low.turn).toBe(-up.turn);
  });
  it('a craft that is no drone carries no spins, its figure as it was', () => {
    const JET = Object.keys(A).find((k) => !A[k].look && A[k].realm === 'earth' && has(k, 'craft-propeller'));
    expect(craftForm(JET).spins).toBeUndefined();
    expect(Object.keys(craftFormFigure(JET).clips)).toEqual(['idle']);
  });
});

describe('the language on a drone', () => {
  it('its wear its own size: a battered quad a few hundred marks, not thousands', () => {
    const n = faces(craftForm(QUAD, { made: true, wear: 'battered' })).filter((f) => f.fitting === 'wear').length;
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(800);
  });
  it('made, in camo and battered, within its budget: 1.6 times its plain one', () => {
    for (const k of Object.keys(A).filter((x) => A[x].realm === 'earth' && A[x].look)) {
      const base = A[k].reference.mtow > 1000 ? 80000 : A[k].reference.mtow < 2 ? 25000 : 50000;
      expect(tris(craftForm(k, { made: true, look: 'military', livery: 'wraparound', wear: 'battered' })), k).toBeLessThan(base * 1.6);
    }
  });
});
