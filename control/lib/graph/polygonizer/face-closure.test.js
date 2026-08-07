import { describe, it, expect } from 'vitest';
import { findOpenBoundaries, auditClosure } from './face-closure.js';
import { latheToFaces } from './lathe-faces.js';
import { extrudeToFaces } from './extrude-faces.js';

// A short constant-radius cylinder lathe (radius 5, height 10 along z).
const cylinder = (caps) => latheToFaces(
  { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 10 }, profile: [{ t: 0, radius: 5 }, { t: 1, radius: 5 }] },
  { caps },
);

describe('findOpenBoundaries', () => {
  it('a capped cylinder lathe is watertight (every edge shared by two faces)', () => {
    const r = findOpenBoundaries(cylinder(true));
    expect(r.closed).toBe(true);
    expect(r.boundaryEdgeCount).toBe(0);
  });

  it('an uncapped cylinder lathe (caps:false) is an open tube with two rims', () => {
    const r = findOpenBoundaries(cylinder(false));
    expect(r.closed).toBe(false);
    // the two open ends → two boundary loops, each a full ring
    expect(r.loops.length).toBe(2);
    for (const loop of r.loops) expect(loop.diameter).toBeGreaterThan(9); // ~diameter 10
  });

  it('a solid extrude prism is watertight', () => {
    const faces = extrudeToFaces({
      profile: { rect: { w: 8, h: 6 } },
      axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 4 },
    });
    expect(findOpenBoundaries(faces).closed).toBe(true);
  });

  it('an openFace:"none" shell is fully sealed (regression — used to fall through to an open end)', () => {
    const faces = extrudeToFaces({
      profile: { rect: { w: 20, h: 14 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 },
      wallThickness: 1.5, openFace: 'none',
    });
    expect(findOpenBoundaries(faces).closed).toBe(true);
  });

  it('an openFace:"to" shell keeps its intended opening', () => {
    const faces = extrudeToFaces({
      profile: { rect: { w: 20, h: 14 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 },
      wallThickness: 1.5, openFace: 'to',
    });
    expect(findOpenBoundaries(faces).closed).toBe(false);
  });
});

describe('auditClosure', () => {
  it('flags a significant hole on an intent-closed monomer', () => {
    const a = auditClosure(cylinder(false), { intendClosed: true });
    expect(a.closed).toBe(false);
    expect(a.holes.length).toBe(2);
  });

  it('stays silent when the surface is intended to be open (a sheet / open-face shell)', () => {
    const a = auditClosure(cylinder(false), { intendClosed: false });
    expect(a.closed).toBe(true);
    expect(a.holes).toEqual([]);
  });

  it('does not flag a sub-threshold pole ring as a hole', () => {
    // a spindle tapering to a tiny (below-cap) tip: the open end is a self-closing pole, not a hole
    const faces = latheToFaces(
      { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 20 }, profile: [{ t: 0, radius: 5 }, { t: 1, radius: 0.02 }] },
      { caps: true },
    );
    expect(auditClosure(faces, { intendClosed: true }).closed).toBe(true);
  });
});
