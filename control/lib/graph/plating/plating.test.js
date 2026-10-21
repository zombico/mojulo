// plating.test.js — the plating library on a stub body (a cylinder per segment, its rings in ring order: `front` +y,
// the R side +x): the plates read nothing of a body but its adapter. A matched pair mirrored, rows parted by panel lines,
// a limb's plate on both limbs, the reactor glowing, plates on the bare skin without a suit, refusals, the same twice.
import { describe, it, expect } from 'vitest';

import { wearPlating, validatePlating, suitCard, SKINS, fairShell, shellPanel } from './index.js';
import { slotOf, stepped } from './shell.js';
import { straighten, muscleLayout } from './muscles.js';
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

  it('a fitted shell: the segment faired, panels cut from it along design lines, bevelled, parted by seams, stacked by layer', () => {
    const P = body.shankR, F = fairShell(P), fOf = slotOf(16, 'R'), uOf = (t) => 2 * t, rad = (p) => Math.hypot(p[0] - 0.09, p[1]);
    // a cylinder's shell is the cylinder
    expect(rad(F.at(1, 3.3).p)).toBeCloseTo(0.05, 4);
    const panel = (o) => shellPanel(F, { t0: 0.2, t1: 0.8, left: [[0, -0.3]], right: [[1, 0.3]], lift: 0.01, thick: 0.004, bevel: 0.003, uOf, fOf, ...o });
    const A = panel({}), mid = A.stations[5].points, top = Object.values(mid).slice(0, 9);
    // its middle at its lift, its edges bevelled down toward the seam
    expect(rad(top[4])).toBeCloseTo(0.06, 4);
    expect(rad(top[0])).toBeLessThan(rad(top[4]) - 0.002);
    // two panels on a shared line part by the seam
    const left = panel({ right: [[0, 0]] }), right = panel({ left: [[0, 0]] }), xs = (Q) => Q.stations.flatMap((st) => Object.values(st.points)).map((p) => p[0] - 0.09);
    expect(Math.min(...xs(right)) - Math.max(...xs(left))).toBeGreaterThan(0.001);
    // on the lateral side of the right leg (+x); a cap domed over its middle
    expect(rad(Object.values(panel({ dome: 0.008 }).stations[5].points)[4])).toBeCloseTo(0.068, 3);
    const W = wearPlating(stub, { family: 'powered', shells: ['greave', 'kneeCap'], emissive: ['Light'] }, { id: 'm' });
    expect(Math.min(...xs(W.parts.mGreaveSideLat_shankR))).toBeGreaterThan(0);
    expect(Math.max(...xs(W.parts.mGreaveSideMed_shankR))).toBeLessThan(0);
    // stacked: the calf plate (cap) over the side plate (over) over the underplate (under)
    const r = (k) => Math.max(...W.parts[k].stations.flatMap((st) => Object.values(st.points)).map(rad));
    expect(r('mGreaveCalfLat_shankR')).toBeGreaterThan(r('mGreaveSideLat_shankR'));
    expect(r('mGreaveSideLat_shankR')).toBeGreaterThan(r('mGreaveUnder_shankR'));
    expect([W.parts.mGreaveUnder_shankL.group, W.parts.mGreaveShin_shankL.group, W.parts.mKneeCapCap_shankL.group]).toEqual(['Alloy', 'Plate', 'Plate']);
    expect(W.emissive).toEqual(['Light']);
  });

  it('a line that bends yet stays straight: straight runs and diagonal jogs, each jog a sharp corner of the panel', () => {
    stepped(0.3, [[0.4, 0.5, -0.1]], 0.1, 0.9).forEach(([t, v], i) => { const [et, ev] = [[0.1, 0.3], [0.4, 0.3], [0.5, 0.2], [0.9, 0.2]][i]; expect(t).toBeCloseTo(et, 9); expect(v).toBeCloseTo(ev, 9); });
    const F = fairShell(body.shankR), pc = shellPanel(F, { t0: 0.1, t1: 0.9, left: [[0, -0.3]], right: stepped(0.3, [[0.437, 0.511, -0.1]], 0.1, 0.9), lift: 0.01, uOf: (t) => 2 * t, fOf: slotOf(16, 'R') });
    // a section at each kink (off the even steps), so the jog is a corner, not a curve
    const z = pc.stations.map((st) => Object.values(st.points)[0][2]), zAt = (t) => 0.48 + (0.05 - 0.48) * t;
    for (const t of [0.437, 0.511]) expect(z.some((x) => Math.abs(x - zAt(t)) < 2e-3)).toBe(true);
  });

  it('a muscle-mapped layout: each plate a muscle group, its edges at the grooves, straightened, neighbours jogging together', () => {
    // straight until the groove moves and holds; a blip does not jog
    expect(straighten([[0, 0.2], [0.1, 0.21], [0.2, 0.2], [0.3, 0.35], [0.4, 0.2], [0.5, 0.36], [0.6, 0.36], [0.7, 0.37]], { step: 0.1, hold: 0.03 }))
      .toEqual([[0, 0.2], [0.4, 0.2], [0.5, 0.36], [0.7, 0.36]]);
    // a stub thigh: the front quarter rectusFemoris, beside it vastusLateralis, its boundary stepping out halfway down
    const P = body.thighR, n = 16, lab = (st, sl) => { const k = +st.slice(2), j = SL.indexOf(sl), edge = k < 6 ? 2 : 4;
      return j <= edge || j >= n - 2 ? 'rectusFemoris' : j <= 7 ? 'vastusLateralis' : null; };
    const groups = [{ id: 'Rf', muscles: ['rectusFemoris'], layer: 'cap' }, { id: 'Vl', muscles: ['vastusLateralis'], layer: 'over' }];
    const L = Object.fromEntries(muscleLayout(P, lab, 'R', { groups, uMax: 4 }).map((p) => [p.id, p]));
    // the two share the groove: the one's right edge is the other's left, jog for jog
    expect(L.Rf.right).toEqual(L.VlLat.left);
    expect(L.Rf.right.length).toBe(4);   // straight, a jog, straight
    expect(L.Rf.layer).toBe('cap');
    const W = wearPlating({ ...stub, muscle: (seg, st, sl) => (seg === 'thighR' || seg === 'thighL' ? lab(st, sl) : null) }, { family: 'powered', muscles: { on: ['thigh'] } }, { id: 'q' });
    expect(W.parts.qThighRectusFemoris_thighR).toBeTruthy();
    expect(W.parts.qThighUnder_thighL.group).toBe('Alloy');
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
