// handwear.test.js — the handwear library on a stub hand (a cylinder per segment, its rings in ring order): the glove
// reads nothing of a body but its adapter. The protoglove stood off by its thickness, a fingerless glove's digits cut at
// the middle joint, the cuff asked of the adapter, a variety its kin and a few keys, refusals, the same twice.
import { describe, it, expect } from 'vitest';

import { wearHandwear, validateHandwear, handwearCard, readTones, FINGERS, HANDWEAR, HANDWEAR_FAMILIES, SKINS } from './index.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';

const SL = ringSlots(8);
// a cylinder down z from `top`, `k` rings `step` apart, `r` round; its blend by ring, as the hero's digits carry it
const seg = (bone, x, top, r, k, step = 0.02) => ({ layer: 1, closure: 'closed', slots: SL, bind: { bone, blend: { st1: { [bone]: 0.5, handR: 0.5 } } },
  stations: Array.from({ length: k }, (_, i) => ({ id: `st${i}`, points: Object.fromEntries(SL.map((nm, j) => { const a = (2 * Math.PI * j) / 8; return [nm, [x + r * Math.sin(a), r * Math.cos(a), top - step * i]]; })) })),
  caps: { back: [x, 0, top + 0.01], tip: [x, 0, top - step * (k - 1) - 0.005] } });
const body = Object.fromEntries(['R', 'L'].flatMap((S) => { const x = S === 'R' ? 0.3 : -0.3;
  return [[`hand${S}`, seg(`hand${S}`, x, 0.85, 0.03, 4)], ...['thumb', 'index', 'middle', 'ring', 'little'].map((d, i) => [`${d}${S}`, seg(`${d}1${S}`, x + (i - 2) * 0.012, 0.77, 0.008, 5)])]; }));
const cuffs = [];
// (the forearm above the hand, its stations' `u` 0 the elbow … 2 the wrist; a glove's cuff its rings from 2 − 2·cuff)
const fore = (S) => { const x = S === 'R' ? 0.3 : -0.3, P = seg(`foreArm${S}`, x, 1.1, 0.032, 9, 0.03); return { ...P, stations: P.stations.map((st, i) => ({ ...st, u: i / 4 })) }; };
const stub = { sides: ['R', 'L'], seg: (k, S) => (k === 'foreArm' || body[`${k}${S}`] ? `${k}${S}` : null), bare: (n) => body[n] ?? (n.startsWith('foreArm') ? fore(n.slice(-1)) : undefined),
  u: (k, s) => ({ hand: 3, foreArm: 2 }[k] ?? 4) * s,
  cuff: (g, { id, group }) => { cuffs.push(g.cuff); return Object.fromEntries(['R', 'L'].map((S) => { const P = fore(S); return [`${id}_foreArm${S}`, { ...P, stations: P.stations.filter((st) => st.u >= 2 - 2 * g.cuff - 1e-9), group }]; })); } };
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

  it('the adornment: a glover\'s piece on its region, a band with its snap, a claw on the last phalanx, all on both hands', () => {
    const W = wearHandwear(stub, { glove: { cuff: 0.3 }, adorn: [{ prim: 'panel', region: 'palm' }, { prim: 'panel', region: 'fingerBacks', group: 'Back' }, { prim: 'strap', at: 0.2, buckle: false }, { prim: 'claws', on: ['index'] }] }, { id: 'a' });
    // (the palm's piece on the palm's side, ±1: in the stub's −y half; the fingers' backs on all four, the thumb bare)
    const P = W.parts.aPalm_handR.stations.flatMap((st) => Object.values(st.points));
    expect(Math.max(...P.map((p) => p[1]))).toBeLessThan(0);
    expect(['index', 'middle', 'ring', 'little'].every((d) => W.parts[`aFingerBacks_${d}L`])).toBe(true);
    expect(W.parts.aFingerBacks_thumbR).toBeUndefined();
    // (the strap up the forearm, its snap on its back; a claw rigid on the digit's last ring's bone)
    expect(W.parts.aStrap_foreArmR.group).toBe('Strap');
    expect(W.parts.aStrapSnap_foreArmL.group).toBe('Steel');
    expect(W.parts.aClaws_indexR.bind).toEqual({ bone: 'index1R', blend: {} });
    expect(Math.min(...W.parts.aClaws_indexR.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2]))).toBeLessThan(body.indexR.stations[4].points.front[2]);
    expect(Object.keys(W.tones).sort()).toEqual(['Claw', 'Gloves', 'Overlay', 'Steel', 'Strap']);
    // (on the bare hand: wraps round the palm)
    expect(Object.keys(wearHandwear(stub, 'handWraps', { id: 'w' }).parts)).toEqual(['wWrap_handR', 'wWrap1_handR', 'wWrap_handL', 'wWrap1_handL']);
  });

  it('a card per family is valid and named; a colourway recolours the leather and what is cut OF it', () => {
    // (one card per family, the catalogue's first of each: a family is a shelf, not a procedure)
    const first = Object.fromEntries(Object.keys(HANDWEAR).map((w) => [handwearCard(w).family, w]).reverse());
    expect(Object.keys(first).sort()).toEqual([...HANDWEAR_FAMILIES].sort());
    for (const w of Object.values(first)) expect(validateHandwear(w), w).toEqual([]);
    // (a leather colourway over a card whose pieces are OF its leather: the pieces follow when the palette is read)
    const leather = Object.keys(SKINS).find((k) => Object.keys(SKINS[k]).join() === 'Gloves');
    const T = readTones(wearHandwear(stub, { from: 'walkingGloves', skin: leather }).tones);
    expect(T.Gloves).toBe(SKINS[leather].Gloves);
    expect(T.Stitch).not.toBe(readTones(wearHandwear(stub, 'walkingGloves').tones).Stitch);
  });

  it('buttons at the wrist\'s opening, up the inner forearm along a long cuff; a grid of perforation on each digit', () => {
    const W = wearHandwear(stub, { glove: { cuff: 0.8 }, adorn: [{ prim: 'buttons', count: 3 }, { prim: 'perf', region: 'fingerBacks', rows: 2, cols: 2 }] }, { id: 'b' });
    expect(['bButtons0_foreArmR', 'bButtons1_foreArmR', 'bButtons2_foreArmR'].every((k) => W.parts[k])).toBe(true);
    // (up the forearm from the wrist: each higher than the last)
    const z = (k) => Math.max(...W.parts[k].stations.flatMap((st) => Object.values(st.points)).map((p) => p[2]));
    expect(z('bButtons1_foreArmR')).toBeGreaterThan(z('bButtons0_foreArmR'));
    expect(['index', 'little'].every((d) => [0, 1, 2, 3].every((i) => W.parts[`bPerf${i}_${d}L`]))).toBe(true);
    // (one button: on the palm's side of the wrist, the stub's −y)
    const one = wearHandwear(stub, { glove: { cuff: 0 }, adorn: [{ prim: 'buttons' }] }, { id: 'o' }).parts.oButtons0_handR;
    expect(Math.max(...one.stations.flatMap((st) => Object.values(st.points)).map((p) => p[1]))).toBeLessThan(0);
  });

  it('a mitten: one shell over the palm and the fingers, closed past them; gripped it is rigid and asks the body to hold the grip', () => {
    // (the stub's joints: the wrist over the palm, the knuckles at its end, each digit's down its cylinder; a grip curls none
    // here, the body's rig does that: the shell is made round what the adapter hands over)
    const joints = (S) => { const x = S === 'R' ? 0.3 : -0.3, J = { wrist: [x, 0, 0.85], knuckles: [x, 0, 0.79] };
      ['thumb', 'index', 'middle', 'ring', 'little'].forEach((d, i) => (d === 'thumb' ? ['Cmc', 'Mcp', 'Ip', 'Tip'] : ['Mcp', 'Pip', 'Dip', 'Tip']).forEach((j, k) => { J[`${d}${j}`] = [x + (i - 2) * 0.012, 0, 0.77 - 0.02 * k]; }));
      return J; };
    const A = { ...stub, gripJoints: (S) => joints(S) };
    const W = wearHandwear(A, { glove: { cuff: 0.2 }, mitten: { pad: 0.01, grip: 'fist' } }, { id: 'x' });
    // (the shell in place of the palm's and the digits' gloves, the cuff kept; its front past the fingertips; rigid)
    expect(Object.keys(W.parts).filter((k) => k.endsWith('R')).sort()).toEqual(['xMitten_handR', 'x_foreArmR']);
    const z = W.parts.xMitten_handR.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2]);
    expect(Math.min(...z)).toBeLessThan(joints('R').middleTip[2] - 0.01);
    expect(W.parts.xMitten_handR.bind).toEqual({ bone: 'handR', blend: {} });
    expect(W.grip).toEqual({ R: 'fist', L: 'fist' });
    // (soft, its thumb apart: the thumb in its own glove, the shell bending with the fingers inside it, no grip asked)
    const M = wearHandwear(A, { glove: { cuff: 0.2 }, mitten: { thumb: 'apart' } }, { id: 'm' });
    expect(M.parts.m_thumbL).toBeTruthy();
    expect(Object.values(M.parts.mMitten_handR.bind.blend).some((w) => w.index1R)).toBe(true);
    expect(M.grip).toBeUndefined();
    expect(validateHandwear({ glove: {}, mitten: { grip: 'claw' } })[0]).toMatch(/mitten\.grip: a hand word/);
    expect(validateHandwear({ glove: false, mitten: {} })[0]).toMatch(/a mitten is the glove's/);
  });

  it('refuses by name', () => {
    expect(validateHandwear('potholders')[0]).toMatch(/'potholders' is not a handwear word/);
    expect(validateHandwear({ glove: { fingers: 'some' } })[0]).toMatch(/glove\.fingers: one of full, half, none/);
    expect(validateHandwear({ glove: { cuff: 2 } })[0]).toMatch(/glove\.cuff: a share/);
    expect(validateHandwear({ glove: {}, sole: 1 })[0]).toMatch(/not 'sole'/);
    expect(validateHandwear({ adorn: [{ prim: 'spikes' }] })[0]).toMatch(/adorn\[0\]\.prim: one of panel, points/);
    expect(validateHandwear({ adorn: [{ prim: 'panel', region: 'wrist' }] })[0]).toMatch(/region: one of back, palm/);
    expect(validateHandwear({ glove: false, adorn: [{ prim: 'cuff' }] })[0]).toMatch(/a cuff is the glove's; this card wears none/);
    expect(validateHandwear({ glove: { cuff: 0.1 }, adorn: [{ prim: 'strap', at: 0.3 }] })[0]).toMatch(/wants the cuff that far/);
  });
});
