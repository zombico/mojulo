// THE POSED COAT (an open coat's `posed`): its skirt split at the back from the hip into two halves hung on hinges at the
// hip (body-relational-jacket.js ventBack), and each clip setting the hinges by its family (coat-poses.js): standing at
// rest, walking behind the hips, in action flared open at the back. On the smallest made-up coat that exercises it.
import { describe, it, expect } from 'vitest';
import { openFront, ventBack, COAT_POSE } from './body-relational-jacket.js';
import { ringSlots } from './body-relational-resample.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { coatFamily, posedCoatClips } from './coat-poses.js';

const SLOTS = ringSlots(48), ring = (z, r) => Object.fromEntries(SLOTS.map((sl, j) => { const a = (2 * Math.PI * j) / 48; return [sl, [Math.sin(a) * r, Math.cos(a) * r, z]]; }));
/** a coat's body: a tube up the z axis from the hip (0.95) to the chest, its skirt carried down from it to the knee as the
 * tailor carries one (rings `stSkirt<k>`, the hem `stSkirt0`, first), each skirt slot on the thigh of its side */
const coat = ({ skirt = true } = {}) => {
  const body = Array.from({ length: 6 }, (_, i) => ({ id: `st${i}`, u: i, points: ring(0.95 + 0.09 * i, 0.16) }));
  // (and the hem turned up inside it to a lining at the crotch, as the tailor turns it)
  const sk = skirt ? [{ id: 'stSkirtLining', u: -1.01, points: ring(0.8, 0.05) }, ...Array.from({ length: 10 }, (_, k) => ({ id: `stSkirt${k}`, u: -(10 - k) / 10, points: ring(0.5 + 0.045 * k, 0.17) }))] : [];
  const blend = Object.fromEntries(sk.flatMap((st) => SLOTS.map((sl) => [`${st.id}.${sl}`, { pelvis: 0.5, [st.points[sl][0] >= 0 ? 'thighR' : 'thighL']: 0.5 }])));
  return openFront({ layer: 1, closure: 'closed', garment: true, group: 'Outer', slots: SLOTS, bind: { bone: 'pelvis', blend }, stations: [...sk, ...body], caps: { back: [0, 0, 0.49], tip: [0, 0, 1.46] } }, { gap: () => 0.1 });
};
const RIG = { boneIndex: { pelvis: 0 } };

describe('a posed coat', () => {
  const V = ventBack(coat(), RIG);
  it('splits its skirt at the back from the hip: a bodice and two halves, each a closed well-wound part, apart at the vent', () => {
    expect(Object.keys(V.parts).sort()).toEqual(['L', 'R', 'body']);
    const A = auditLayered(compileLayered({ schema: 'layered-v1', dials: {}, parts: { outer_body: V.parts.body, outer_skirtR: V.parts.R, outer_skirtL: V.parts.L } }, {}, { details: false, creases: false }));
    for (const k of ['outer_body', 'outer_skirtR', 'outer_skirtL']) expect([A[k].windingErrors, A[k].nonManifold, A[k].boundaryEdges], k).toEqual([0, 0, 0]);
    // (no skirt ring in the bodice; each half on its own side of the back, and down to the hem)
    expect(V.parts.body.stations.some((st) => /^stSkirt\d+$/.test(st.id) && st.id !== 'stSkirt9')).toBe(false);
    const sk = (P) => P.stations.filter((st) => /^stSkirt\d+$/.test(st.id)).flatMap((st) => Object.values(st.points));
    for (const q of sk(V.parts.R).filter((p) => p[1] < -0.1)) expect(q[0]).toBeGreaterThan(0);
    for (const q of sk(V.parts.L).filter((p) => p[1] < -0.1)) expect(q[0]).toBeLessThan(0);
    expect(Math.min(...sk(V.parts.R).map((p) => p[2]))).toBeCloseTo(0.5, 6);
  });

  it('hangs each half on three hinges carried by the pelvis, its hem on its own side\'s alone, its hip as it was', () => {
    expect(V.bones.map((b) => b.id)).toEqual(['coatFR', 'coatSR', 'coatBR', 'coatFL', 'coatSL', 'coatBL']);
    for (const j of Object.values(V.joints)) expect(j.rides).toBe('pelvis');
    const W = V.parts.R.bind.blend, hem = Object.entries(W).filter(([k]) => k.startsWith('stSkirt0.')), hip = Object.entries(W).filter(([k]) => k.startsWith('stSkirt9.'));
    for (const [, w] of hem) { expect(Object.keys(w).every((b) => /^coat[FSB]R$/.test(b))).toBe(true); expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6); }
    for (const [, w] of hip) expect(Object.keys(w).some((b) => b.startsWith('coat'))).toBe(false);
    // (the hem's lining hinged as the hem it is sewn to, never by its own height: the cloth between them drawn out in a spike)
    for (const [k, w] of hem) expect(W[k.replace('stSkirt0.', 'stSkirtLining.')]).toEqual(w);
  });

  it('walking sweeps the fronts back round the sides; in action the back halves hang out a little, flared out and up; standing, nothing set', () => {
    expect(Object.keys(V.poses).sort()).toEqual(Object.keys(COAT_POSE.families).sort());
    const g = V.poses.gait.coatHemFR, a = V.poses.flare, act = V.poses.action;
    expect(act.coatHemBR[0]).toBeGreaterThan(0.03);
    // (standing, the front pulled back off the thigh; running, further back than walking, and lifted)
    expect(V.poses.stand.coatHemFR[1]).toBeLessThan(-0.02); expect(V.poses.run.coatHemFR[1]).toBeLessThan(g[1]); expect(V.poses.run.coatHemFR[2]).toBeGreaterThan(g[2]); expect(act.coatHemBR[2]).toBeLessThan(a.coatHemBR[2]);
    expect(g[1]).toBeLessThan(-0.05); expect(g[0]).toBeGreaterThan(0.05);
    expect(a.coatHemBR[0]).toBeGreaterThan(0.1); expect(a.coatHemBL[0]).toBeLessThan(-0.1);
    expect(a.coatHemBR[2]).toBeGreaterThan(0.05); expect(a.coatHemBL[2]).toBeCloseTo(a.coatHemBR[2], 6);
  });

  it('a coat with no skirt is not split', () => {
    expect(ventBack(coat({ skirt: false }), RIG)).toBeNull();
  });
});

describe('the posed coat\'s clips', () => {
  it('reads a clip\'s family from its name and its tags; what it cannot place is action', () => {
    expect(['idle', 'gesture', 'walk', 'jog', 'sprintStop', 'swing_down', 'mv_ready', 'jump', 'staff_slam', 'somethingNew'].map((n) => coatFamily(n)))
      .toEqual(['stand', 'stand', 'gait', 'run', 'gait', 'action', 'action', 'flare', 'flare', 'action']);
    expect(coatFamily('idle', Object.assign(() => ({}), { move: { family: 'swing' } }))).toBe('action');
  });
  it('sets the hinges on each clip\'s flow by its family, over what the clip carries; no poses, the clips as they were', () => {
    const poses = { gait: { coatHemFR: [0.1, -0.1, 0] }, action: { coatHemBR: [0.2, 0, 0.1] } };
    const walk = Object.assign((ph) => ({ crouch: ph, flow: { s1: [0, 0, 1] } }), { keys: 8 }), idle = () => ({ crouch: 0 });
    const C = posedCoatClips({ walk, idle, swing_down: () => ({}) }, poses, null);
    expect(C.walk(0.5)).toEqual({ crouch: 0.5, flow: { s1: [0, 0, 1], coatHemFR: [0.1, -0.1, 0] } });
    expect(C.walk.keys).toBe(8);
    expect(C.idle).toBe(idle);   // (no standing set asked here: the clip as it was)
    // (a figure with no idle given a still one, standing as the standing set says; one with its own keeps it)
    const stand = { coatHemFR: [0, -0.05, 0] }, S = posedCoatClips({ walk }, { ...poses, stand }, null);
    expect(S.idle(0)).toEqual({ flow: stand }); expect(posedCoatClips({ walk, idle }, { stand }, null).idle(0).flow).toEqual(stand);
    expect(C.swing_down(0).flow).toEqual(poses.action);
    const clips = { walk }; expect(posedCoatClips(clips, null, null)).toBe(clips);
  });
});
