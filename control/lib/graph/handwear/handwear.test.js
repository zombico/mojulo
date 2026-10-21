// handwear.test.js — the handwear library on a stub hand (a cylinder per segment, its rings in ring order): the glove
// reads nothing of a body but its adapter. The protoglove stood off by its thickness, a fingerless glove's digits cut at
// the middle joint, the cuff asked of the adapter, a variety its kin and a few keys, refusals, the same twice.
import { describe, it, expect } from 'vitest';

import { wearHandwear, validateHandwear, handwearCard, FINGERS } from './index.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';

const SL = ringSlots(8);
// a cylinder down z from `top`, `k` rings `step` apart, `r` round; its blend by ring, as the hero's digits carry it
const seg = (bone, x, top, r, k, step = 0.02) => ({ layer: 1, closure: 'closed', slots: SL, bind: { bone, blend: { st1: { [bone]: 0.5, handR: 0.5 } } },
  stations: Array.from({ length: k }, (_, i) => ({ id: `st${i}`, points: Object.fromEntries(SL.map((nm, j) => { const a = (2 * Math.PI * j) / 8; return [nm, [x + r * Math.sin(a), r * Math.cos(a), top - step * i]]; })) })),
  caps: { back: [x, 0, top + 0.01], tip: [x, 0, top - step * (k - 1) - 0.005] } });
const body = Object.fromEntries(['R', 'L'].flatMap((S) => { const x = S === 'R' ? 0.3 : -0.3;
  return [[`hand${S}`, seg(`hand${S}`, x, 0.85, 0.03, 4)], ...['thumb', 'index', 'middle', 'ring', 'little'].map((d, i) => [`${d}${S}`, seg(`${d}1${S}`, x + (i - 2) * 0.012, 0.77, 0.008, 5)])]; }));
const cuffs = [];
const stub = { sides: ['R', 'L'], seg: (k, S) => (body[`${k}${S}`] ? `${k}${S}` : null), bare: (n) => body[n], u: (k, s) => s,
  cuff: (g, { id, group }) => { cuffs.push(g.cuff); return { [`${id}_foreArmR`]: { ...body.handR, group } }; } };
const radius = (st) => { const ps = Object.values(st.points), c = [0, 1, 2].map((q) => ps.reduce((a, p) => a + p[q], 0) / ps.length); return Math.hypot(...ps[0].map((v, q) => v - c[q])); };

describe('handwear on a hand adapter', () => {
  it('the protoglove: the hand and the digits stood off by its thickness, the cuff the adapter\'s, its weights the skin\'s', () => {
    const W = wearHandwear(stub, { glove: { cuff: 0.2, thick: 0.002 } }, { id: 'g' });
    expect(radius(W.parts.g_handR.stations[1])).toBeCloseTo(0.032, 6);
    expect(radius(W.parts.g_indexL.stations[4])).toBeCloseTo(0.01, 6);
    expect(W.parts.g_indexR.stations.length).toBe(FINGERS.full);
    expect(W.parts.g_indexR.bind.blend.st1).toEqual({ index1R: 0.5, handR: 0.5 });
    expect(cuffs).toEqual([0.2]);
    expect(W.parts.g_foreArmR.group).toBe('Gloves');
    expect(Object.keys(W.tones)).toEqual(['Gloves']);
    expect(JSON.stringify(wearHandwear(stub, 'gloves'))).toBe(JSON.stringify(wearHandwear(stub, 'gloves')));
  });

  it('fingerless: the digits cut at the middle joint, closed inside the finger; a variety is its kin and a few keys', () => {
    const W = wearHandwear(stub, 'fingerless', { id: 'f' });
    expect(W.parts.f_middleR.stations.length).toBe(FINGERS.half);
    // (its end closed short of the next ring: inside the finger)
    expect(W.parts.f_middleR.caps.tip[2]).toBeGreaterThan(body.middleR.stations[3].points.front[2]);
    expect(handwearCard('fingerless').glove).toEqual({ cuff: 0.06, thick: 0.0018, fingers: 'half' });
    expect(Object.keys(wearHandwear(stub, { glove: false }).parts)).toEqual([]);
  });

  it('refuses by name', () => {
    expect(validateHandwear('mittens')[0]).toMatch(/'mittens' is not a handwear word/);
    expect(validateHandwear({ glove: { fingers: 'some' } })[0]).toMatch(/glove\.fingers: one of full, half, none/);
    expect(validateHandwear({ glove: { cuff: 2 } })[0]).toMatch(/glove\.cuff: a share/);
    expect(validateHandwear({ glove: {}, sole: 1 })[0]).toMatch(/not 'sole'/);
  });
});
