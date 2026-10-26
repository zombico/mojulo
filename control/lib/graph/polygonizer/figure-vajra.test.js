import { describe, it, expect } from 'vitest';
import {
  FIGURE_NODES, FIGURE_EDGES, LIMITS, CERVICAL_CAP,
  basePositions, articulate, figureVajraSpecs, figureJointGraph,
} from './figure-vajra.js';

// Locks the canonical figure shape: the node/edge graph, the kinematic
// limits, the one-way hinges, and the ball-in-socket form contract.
describe('figure-vajra — the fundamental figure shape', () => {
  it('has the locked node + edge counts', () => {
    // 17 nodes: the original 16 + headBase (the atlas — splits neck from head).
    expect(Object.keys(FIGURE_NODES)).toHaveLength(17);
    expect(FIGURE_EDGES).toHaveLength(8);
  });

  it('neutral articulation equals the base armature', () => {
    const base = basePositions();
    const neutral = articulate({});
    for (const k of Object.keys(FIGURE_NODES)) expect(neutral[k]).toEqual(base[k]);
  });

  it('shoulder out-ranges the hip; elbow/knee are full hinges', () => {
    expect(LIMITS.shoulder).toBeGreaterThan(LIMITS.hip);
    expect(LIMITS.elbow).toBe(150);
    expect(LIMITS.knee).toBe(150);
  });

  it('knee folds the calf backward, elbow folds the forearm forward', () => {
    const base = basePositions();
    expect(articulate({ kneeL: 90 }).ankleL.y).toBeLessThan(base.ankleL.y);    // calf back (−y)
    expect(articulate({ elbowL: 90 }).wristL.y).toBeGreaterThan(base.wristL.y); // forearm forward (+y)
  });

  it('hinges are one-way — over-driving clamps to the limit, never reverses', () => {
    expect(articulate({ kneeL: 400 }).ankleL).toEqual(articulate({ kneeL: LIMITS.knee }).ankleL);
  });

  it('ball-in-socket: a limb root is a smaller, offset ball', () => {
    const armSpec = figureVajraSpecs(basePositions())[4]; // left-arm edge
    expect(armSpec.rProximal).toBeLessThan(FIGURE_NODES.shoulderL.r);     // smaller head
    expect(armSpec.proximal).not.toEqual(FIGURE_NODES.shoulderL.pos);     // offset into the socket
  });

  it('neck and head are separate joints (head tilts on a fixed atlas; neck carries both)', () => {
    const base = basePositions();
    // HEAD alone: rotates headTop about headBase — neckHub AND headBase stay put.
    const h = articulate({ head: { yaw: 30 } });
    expect(h.headBase).toEqual(base.headBase);              // atlas unmoved
    expect(h.neckHub).toEqual(base.neckHub);
    expect(h.headTop).not.toEqual(base.headTop);            // skull tilted
    // NECK alone: rotates the column about neckHub — carries headBase AND headTop.
    const n = articulate({ neck: { pitch: 30 } });
    expect(n.headBase).not.toEqual(base.headBase);          // atlas moved with the column
    expect(n.headTop).not.toEqual(base.headTop);
    expect(n.neckHub).toEqual(base.neckHub);                // neck root is the pivot
  });

  it('joint graph: one sphere per node, two links per edge', () => {
    const g = figureJointGraph(basePositions());
    expect(g.spheres).toHaveLength(17);
    expect(g.links).toHaveLength(FIGURE_EDGES.length * 2);
  });
});

// The cervical chain (`dof.cervical`, CERVICAL_CAP): a head aim is the cervical spine's, shared by the neck's column and
// the skull's nod on the atlas, each within its own range; without the flag, the two cones as before.
describe('figure-vajra — the cervical chain', () => {
  const deg = (r) => (r * 180) / Math.PI;
  const lines = (m) => { const nk = [m.headBase.y - m.neckHub.y, m.headBase.z - m.neckHub.z, m.headBase.x - m.neckHub.x], hd = [m.headTop.y - m.headBase.y, m.headTop.z - m.headBase.z, m.headTop.x - m.headBase.x];
    // (the nod: forward of vertical, +; the side bend: toward +x, +)
    return { neck: deg(Math.atan2(nk[0], nk[1])), skull: deg(Math.atan2(hd[0], hd[1])), neckSide: deg(Math.atan2(nk[2], nk[1])), skullSide: deg(Math.atan2(hd[2], hd[1])) }; };
  const rest = lines(articulate({}));
  const at = (dof) => { const L = lines(articulate(dof)); return { neck: L.neck - rest.neck, atlas: L.skull - L.neck - (rest.skull - rest.neck), neckSide: L.neckSide - rest.neckSide, atlasSide: L.skullSide - L.neckSide - (rest.skullSide - rest.neckSide) }; };
  it('shares a head aim alone down the neck: a nod bends the column more than the atlas, never the atlas alone', () => {
    const A = at({ cervical: true, head: { yaw: 0, pitch: -20 } });
    expect(A.neck + A.atlas).toBeCloseTo(20, 6);
    expect(A.neck / A.atlas).toBeCloseTo(CERVICAL_CAP.neck.flex / CERVICAL_CAP.head.flex, 6);
    // (without the chain, the same word swings the skull alone at the atlas)
    const B = at({ head: { yaw: 0, pitch: -20 } });
    expect(B.neck).toBeCloseTo(0, 9); expect(B.atlas).toBeCloseTo(20, 6);
  });
  it('holds each direction to the chain\'s range: flexion, extension and side bend each their own', () => {
    const C = CERVICAL_CAP;
    const fwd = at({ cervical: true, head: { yaw: 0, pitch: -90 } }), back = at({ cervical: true, head: { yaw: 0, pitch: 90 } }), side = at({ cervical: true, head: { yaw: 90, pitch: 0 } });
    expect(fwd.neck).toBeCloseTo(C.neck.flex, 6); expect(fwd.atlas).toBeCloseTo(C.head.flex, 6);
    expect(-back.neck).toBeCloseTo(C.neck.ext, 6); expect(-back.atlas).toBeCloseTo(C.head.ext, 6);
    expect(Math.abs(side.neckSide)).toBeCloseTo(C.neck.lateral, 6); expect(Math.abs(side.atlasSide)).toBeCloseTo(C.head.lateral, 6);
    expect(C.neck.flex + C.head.flex).toBeLessThan(C.neck.ext + C.head.ext);   // (the cervical spine extends further than it flexes)
  });
  it('holds a neck and a head both named each to its own segment\'s range', () => {
    const A = at({ cervical: true, neck: { yaw: 0, pitch: -80 }, head: { yaw: 0, pitch: -80 } });
    expect(A.neck).toBeCloseTo(CERVICAL_CAP.neck.flex, 6); expect(A.atlas).toBeCloseTo(CERVICAL_CAP.head.flex, 6);
  });
  it('is absent without the flag: a pose with no cervical key is the cones\' to the bit', () => {
    const dof = { neck: { yaw: 10, pitch: -30 }, head: { yaw: -5, pitch: 40, turn: 12 } };
    expect(articulate({ ...dof, cervical: false })).toEqual(articulate(dof));
  });
});
