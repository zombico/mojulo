import { describe, it, expect } from 'vitest';
import { seaPen, SEA_PEN } from './sea-pen.js';
import { readInfiltration } from './infiltration-words.js';
import { infiltrationStage, infiltrationCast, infiltrationEnds } from './infiltration-level.js';

// THE SEA PEN: a covered dock round a moored ship, its quays at the floor, its water calm, its places named
describe('the sea pen', () => {
  const S = seaPen({ ship: 'supply ship', night: true });
  const B = S.bounds;

  it('lays its quays round the ship\'s basin, the ship moored in it with its deck at the quays\' height', () => {
    expect(S.ship.archetype).toBe('supplyShip');
    expect(B.bx).toBeGreaterThan(S.ship.beam / 2);                       // (the basin wider than the ship)
    expect(B.by0).toBeLessThan(S.ship.y0);                               // (the gate astern of its stern)
    expect(B.by1).toBeGreaterThan(S.ship.yEnd);                          // (the head quay beyond its bow)
    expect(S.inside((B.W - B.bx) / 2, 0)).toBe(true);                    // the west quay
    expect(S.inside((B.bx + B.E) / 2, 0)).toBe(true);                    // the east quay
    expect(S.inside(0, (B.by1 + B.H) / 2)).toBe(true);                   // the head quay
    expect(S.inside(0, 0)).toBe(false);                                  // the basin is never walked
    expect(S.inside(B.W - 1, 0)).toBe(false);                            // nor the rock
  });

  it('rails every quay\'s edge deeper than a vault crosses, and walls the rock in', () => {
    const rails = S.colliders.filter((c) => c.of === 'pen:rail'), rock = S.colliders.filter((c) => c.of === 'pen:rock');
    expect(rails.length).toBeGreaterThanOrEqual(3);
    for (const c of rails) {
      expect(c.max[2]).toBe(SEA_PEN.rail);
      // (free-run.js vaults 1.6 m: the rail's reach is more, so the free run never carries a body into the basin)
      expect(Math.min(c.max[0] - c.min[0], c.max[1] - c.min[1])).toBeGreaterThan(1.6 - 1e-6);
    }
    expect(rock.length).toBe(3);
    for (const c of rock) expect(c.max[2]).toBe(SEA_PEN.roof);
  });

  it('holds its water still under a calm swell, at the ship\'s waterline', () => {
    expect(S.shipSea.speed).toBe(0);
    expect(S.shipSea.z).toBe(S.ship.seaZ);
    S.shipSea.sea.swell.forEach((w, i) => expect(w.amp).toBeLessThan(S.ship.sea.swell[i].amp));
  });

  it('names its places on its quays and its raised posts', () => {
    for (const id of ['west-quay', 'head-quay', 'stair-door']) expect(S.inside(S.marks[id][0], S.marks[id][1])).toBe(true);
    expect(S.marks['control-room'][2]).toBeGreaterThan(S.raised.controlRoom);
    expect(S.marks.gantry[2]).toBeGreaterThan(S.raised.gantry);
    for (const id of Object.keys(S.marks)) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('is an infiltration level\'s ground: its faces and colliders laid, its ship a body, its marks the level\'s, a place off its quays refused', () => {
    const v = { ground: { pen: { ship: 'supply ship' } }, night: true, start: [-15, -38], guards: [{ id: 'g', kind: 'post', at: [0, 46], facing: [0, 0], z: SEA_PEN.control.h }], tasks: [{ reach: [-15, 46], r: 4 }] };
    const P = readInfiltration(v);
    const St = infiltrationStage({}, P);
    expect(St.shipSea).toMatchObject({ speed: 0, z: S.shipSea.z, heading: S.shipSea.heading });
    expect(St.colliders.some((c) => c.of === 'pen:rail')).toBe(true);
    // (its roof never footing: a camera under it stays on the quay's side of it)
    expect(St.footless).toEqual(['pen:roof', 'pen:lintel']);
    for (const g of St.footless) expect(St.faces.some((f) => f.group === g)).toBe(true);
    const C = infiltrationCast({ id: 's', feel: 'steel-serpents' }, P);
    expect(C.entities.find((e) => e.id === 'ship').body).toEqual({ type: 'figure-rig', figure: 'ship' });
    expect(C.entities.find((e) => e.id === 'g').transform.pos[2]).toBeGreaterThan(SEA_PEN.control.h);   // (its eye over the block)
    expect(infiltrationEnds(P).marks.map((m) => m.id)).toEqual(expect.arrayContaining(['stair-door', 'gantry']));
    expect(() => infiltrationStage({}, readInfiltration({ ...v, start: [0, 0] }))).toThrow(/off the sea pen's quays/);
    expect(() => readInfiltration({ ...v, ground: { pen: { boat: 'x' } } })).toThrow(/ground\.pen/);
  });
});
