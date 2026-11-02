// A drone's look as a card (drone-looks.js through assembleCraft and craftForm): the same airframe in each look, its
// frame, arms, motors and rotors the same parts; a military look's gimbal an EO/IR ball nearest its size, its LEDs dark,
// its paint the slot a camo cuts into; a consumer's moulded plastic, a racer's carbon; the civil marks (a registration
// both sides, a serial plate, an enterprise's high-visibility arm tips) and the military's (a low-visibility number); a
// stock look by default, a look's livery only when it is asked for; an unknown look named. One drone with a gimbal,
// chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, CRAFT_ODM, CRAFT_ARCHETYPES } from './index.js';
import { craftForm } from './craft-form.js';
import { DRONE_LOOK_IDS, lookCard } from './drone-looks.js';

const A = CRAFT_ARCHETYPES;
const GIMBAL = Object.keys(A).find((k) => A[k].look && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.build.family === 'gimbal3'));
const faces = (C) => C.items.flatMap((i) => i.faces);
const skus = (m) => Object.fromEntries(m.items.map((i) => [i.id, i.source.garage.sku]));
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

describe('the same airframe in each look', () => {
  const by = Object.fromEntries(DRONE_LOOK_IDS.map((l) => [l, assembleCraft(GIMBAL, { look: l }).manifest]));
  it('every look keeps the frame, arms, motors and rotors; only its payloads change', () => {
    const base = skus(assembleCraft(GIMBAL).manifest);
    for (const l of DRONE_LOOK_IDS) for (const [id, sku] of Object.entries(skus(by[l]))) {
      if (CRAFT_ODM[sku].kind !== 'drone-payload') expect(sku, `${l} ${id}`).toBe(base[id]);
    }
  });
  it('a military look\'s gimbal an EO/IR ball, the nearest in size; its LEDs dark', () => {
    const g = A[GIMBAL].layout.find((e) => CRAFT_ODM[e.sku].build.family === 'gimbal3');
    const ball = CRAFT_ODM[skus(by.military)[g.id]];
    expect(ball.build.family).toBe('eoir');
    const others = Object.values(CRAFT_ODM).filter((r) => r.build.family === 'eoir');
    expect(Math.min(...others.map((r) => Math.abs(r.dims.height - CRAFT_ODM[g.sku].dims.height)))).toBe(Math.abs(ball.dims.height - CRAFT_ODM[g.sku].dims.height));
    const C = craftForm(GIMBAL, { look: 'military' });
    expect(faces(C).some((f) => /^nav/.test(f.material))).toBe(false);
    expect(faces(craftForm(GIMBAL, { look: 'consumer' })).some((f) => /^nav/.test(f.material))).toBe(true);
  });
  it('the slots its card says: moulded plastic, bare carbon, a military drone\'s paint (which a camo cuts into)', () => {
    const slots = (l) => new Set(faces(craftForm(GIMBAL, { look: l })).map((f) => f.material));
    expect(slots('consumer').has('plastic')).toBe(true);
    expect(slots('racer').has('carbon')).toBe(true);
    expect(slots('military').has('airPaint') && !slots('military').has('plastic')).toBe(true);
    const camo = craftForm(GIMBAL, { look: 'military', livery: 'wraparound' });
    expect(new Set(faces(camo).filter((f) => f.material === 'airPaint').map((f) => f.albedo)).size).toBeGreaterThan(2);
  });
});

describe('the marks a look wears', () => {
  const marks = (C) => faces(C).filter((f) => f.fitting === 'mark');
  it('civil: a registration on both sides of the frame, a pale serial plate on top; an enterprise\'s arm tips orange', () => {
    const C = craftForm(GIMBAL, { look: 'consumer' }), ms = marks(C);
    expect(ms.some((f) => f.outNormal[0] > 0.5) && ms.some((f) => f.outNormal[0] < -0.5)).toBe(true);
    expect(ms.some((f) => f.albedo === '#ece9e0' && f.outNormal[2] > 0.5)).toBe(true);
    const E = craftForm(GIMBAL, { look: 'enterprise' });
    expect(E.items.filter((i) => /^arm/.test(i.id)).every((i) => i.faces.some((f) => f.fitting === 'mark' && f.albedo === '#ff6a1a'))).toBe(true);
  });
  it('military: its number low-visibility, no plate, no orange; a racer none', () => {
    const ms = marks(craftForm(GIMBAL, { look: 'military' }));
    expect(ms.length).toBeGreaterThan(10);
    expect(ms.some((f) => f.albedo === '#ece9e0' || f.albedo === '#ff6a1a')).toBe(false);
    // (low-visibility: a step off the paint it is laid on, never a bright mark)
    const paint = lum(faces(craftForm(GIMBAL, { look: 'military' })).find((f) => f.material === 'airPaint' && !f.fitting).albedo);
    for (const f of ms) expect(Math.abs(lum(f.albedo) - paint)).toBeLessThan(80);
    expect(marks(craftForm(GIMBAL, { look: 'racer' }))).toHaveLength(0);
  });
});

describe('by default, and asked wrongly', () => {
  it('its stock look\'s slots and its own palette, no marks unless a livery or a look is asked for', () => {
    const C = craftForm(GIMBAL), stock = lookCard(A[GIMBAL].look);
    expect(faces(C).some((f) => f.fitting === 'mark')).toBe(false);
    for (const [from, to] of Object.entries(stock.slots)) {
      expect(faces(C).some((f) => f.material === from), from).toBe(false);
      expect(faces(C).some((f) => f.material === to), to).toBe(true);
    }
    expect(JSON.stringify(assembleCraft(GIMBAL).manifest)).toBe(JSON.stringify(assembleCraft(GIMBAL, { look: undefined }).manifest));
  });
  it('an unknown look named; a craft that is no drone takes none', () => {
    expect(() => assembleCraft(GIMBAL, { look: 'stealthy' })).toThrow(/no look/);
    const JET = Object.keys(A).find((k) => !A[k].look && A[k].realm === 'earth');
    expect(JSON.stringify(craftForm(JET))).toBe(JSON.stringify(craftForm(JET, { look: undefined })));
  });
});
