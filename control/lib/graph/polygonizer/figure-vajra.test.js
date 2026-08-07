import { describe, it, expect } from 'vitest';
import {
  FIGURE_NODES, FIGURE_EDGES, LIMITS,
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
