// plating.test.js — the plating library on a stub body (a cylinder per segment, its rings in ring order: `front` +y,
// the R side +x): the plates read nothing of a body but its adapter. A matched pair mirrored, rows parted by panel lines,
// a limb's plate on both limbs, the reactor glowing, plates on the bare skin without a suit, refusals, the same twice.
import { describe, it, expect } from 'vitest';

import { wearPlating, validatePlating, suitCard, SKINS } from './index.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';

const SL = ringSlots(16);
// a cylinder down z from `top` to `bottom`, `r` round, `k` rings, u 0 … uMax
const seg = (bone, x, top, bottom, r, uMax, k = 13) => ({ layer: 0, closure: 'closed', slots: SL, bind: { bone },
  stations: Array.from({ length: k }, (_, i) => { const z = top + ((bottom - top) * i) / (k - 1);
    return { id: `st${i}`, u: (uMax * i) / (k - 1), points: Object.fromEntries(SL.map((nm, j) => { const a = (2 * Math.PI * j) / 16; return [nm, [x + r * Math.sin(a), r * Math.cos(a), z]]; })) }; }),
  caps: { back: [x, 0, top], tip: [x, 0, bottom] } });
// (the torso and the pelvis run up from their u 0, the limbs down)
const body = { torso: seg('torso', 0, 1.0, 1.45, 0.15, 4), pelvis: seg('pelvis', 0, 0.8, 1.0, 0.15, 6),
  ...Object.fromEntries(['R', 'L'].flatMap((S) => { const x = S === 'R' ? 1 : -1; return [[`upperArm${S}`, seg(`upperArm${S}`, 0.22 * x, 1.4, 1.1, 0.045, 2)], [`foreArm${S}`, seg(`foreArm${S}`, 0.24 * x, 1.1, 0.85, 0.04, 2)],
    [`thigh${S}`, seg(`thigh${S}`, 0.09 * x, 0.9, 0.48, 0.07, 4)], [`shank${S}`, seg(`shank${S}`, 0.09 * x, 0.48, 0.05, 0.05, 2)]]; })) };
const U = { torso: 4, pelvis: 6, upperArm: 2, foreArm: 2, thigh: 4, shank: 2 };
const stub = { sides: ['R', 'L'], part: (n) => body[n], u: (k, s) => U[k] * s,
  suit: (_s, { id, group }) => Object.fromEntries(Object.entries(body).map(([n, P]) => [`${id}_${n}`, { ...P, layer: 1, group }])) };
const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));

describe('a plated suit on a body adapter', () => {
  it('a matched pair, rows parted by panel lines, a limb\'s plate on both limbs, standing off the suit, the reactor glowing', () => {
    const W = wearPlating(stub, { family: 'powered', plates: [{ region: 'chest', lift: 0.008 }, { region: 'abs', rows: 3 }, { region: 'shin' }], reactor: { at: 0.64 }, emissive: ['Reactor'] }, { id: 's' });
    // the chest a pair, right on +x and left mirrored
    const R = W.parts.sChestR_torso, L = W.parts.sChestL_torso;
    expect(Math.min(...pts(R).map((p) => p[0]))).toBeGreaterThan(-1e-9);
    expect(Math.max(...pts(L).map((p) => p[0]))).toBeLessThan(1e-9);
    expect(Math.max(...pts(R).map((p) => p[0])) + Math.min(...pts(L).map((p) => p[0]))).toBeCloseTo(0, 6);
    // standing off the suit by its lift
    expect(Math.max(...pts(R).map((p) => Math.hypot(p[0], p[1])))).toBeCloseTo(0.158, 3);
    // three rows each side, the suit showing between them
    const rows = [0, 1, 2].map((r) => W.parts[`sAbs${r}R_torso`]);
    expect(rows.every(Boolean)).toBe(true);
    expect(Math.min(...pts(rows[1]).map((p) => p[2]))).toBeGreaterThan(Math.max(...pts(rows[0]).map((p) => p[2])) + 0.005);
    for (const S of ['R', 'L']) for (const t of ['Lat', 'Med']) expect(W.parts[`sShin0${t}_shank${S}`]).toBeTruthy();
    expect(W.parts.sReactor_torso.group).toBe('Reactor');
    expect(W.emissive).toEqual(['Reactor']);
    expect(W.parts.sChestR_torso.bind.bone).toBe('torso');
    expect(JSON.stringify(wearPlating(stub, 'powerSuit', { id: 's' }))).toBe(JSON.stringify(wearPlating(stub, 'powerSuit', { id: 's' })));
  });

  it('without a suit the plates lie on the skin; a variety is its kin and a few keys; a colourway recolours it', () => {
    const W = wearPlating(stub, { suit: false, plates: [{ region: 'gauntlet', rows: 1 }] }, { id: 'b' });
    expect(Object.keys(W.parts).some((k) => k.startsWith('b_'))).toBe(false);
    expect(W.parts.bGauntletLat_foreArmR).toBeTruthy();
    const C = suitCard({ from: 'powerSuit', platesPlus: [{ region: 'calf' }], skin: 'midnight' });
    expect(C.plates[C.plates.length - 1].region).toBe('calf');
    expect(C.tones.Plate).toBe(SKINS.midnight.Plate);
  });

  it('refuses a suit by name', () => {
    expect(validatePlating('ironSuit')[0]).toMatch(/'ironSuit' is not a suit/);
    const E = validatePlating({ plates: [{ region: 'wing', colour: 1 }] });
    expect(E[0]).toBe("suit.plates[0]: a plate takes region, lift, thick, rows, gap, group, not 'colour'");
    expect(E[1]).toMatch(/^suit\.plates\[0\]\.region: one of chest, /);
    expect(validatePlating({ plates: [{ region: { seg: 'tail', along: [0, 1], around: [0, 1], sides: 'both' } }] })[0]).toMatch(/region: a plate region's name/);
    expect(() => wearPlating(stub, 'ironSuit')).toThrow(/ironSuit/);
  });
});
