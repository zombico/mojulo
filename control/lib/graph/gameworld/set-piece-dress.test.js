// A set piece in its place: the greybox a kind lays dressed as the level's geocube says, nothing it plays on moved
import { describe, it, expect } from 'vitest';
import { placeOf, dressFaces, surroundsOf } from './set-piece-dress.js';
import { siteOf, layKind, SET_PIECE_KIND_IDS } from './set-piece-kinds.js';
import { stuntLevel } from './stunt-room.js';
import { LEVANT } from './lost-nomad.js';

const PLACE = placeOf({ geocube: LEVANT });
const zs = (F) => F.flatMap((f) => f.corners.map((c) => c[2]));

describe('a set piece in its place', () => {
  it('reads its place from the level\'s geocube: its look, its architecture, its colours; none without one', () => {
    expect(placeOf({})).toBeNull();
    expect(placeOf(undefined)).toBeNull();
    expect(PLACE).toMatchObject({ look: 'desert-dusk', style: 'moorish-medina', colour: { sand: '#d6bb8a', rock: '#a47b52' } });
  });

  it('a building is a row of houses in the place\'s architecture, filling the block, its roof the block\'s top', () => {
    const B = { id: 'roof', x: [0, 21], y: [-4, 4], z: [0, 6], role: 'building' }, F = dressFaces(B, PLACE, 3);
    expect(F.length).toBeGreaterThan(200);
    expect(Math.max(...zs(F))).toBeCloseTo(6, 5);                       // (nothing over the roof the play stands on)
    expect(Math.min(...zs(F))).toBeGreaterThanOrEqual(0);
    // (within the block, a lattice standing a hand proud of its wall the most)
    const xs = F.flatMap((f) => f.corners.map((c) => c[0])), ys = F.flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.min(...xs)).toBeGreaterThan(-0.3); expect(Math.max(...xs)).toBeLessThan(21.3);
    expect(Math.min(...ys)).toBeGreaterThan(-4.3); expect(Math.max(...ys)).toBeLessThan(4.3);
    // (the medina's colours: its limewash and its teal band, its openings dark)
    const fills = new Set(F.map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(5);
    expect(dressFaces(B, PLACE, 3)).toEqual(F);                         // seeded
    expect(dressFaces(B, PLACE, 4)).not.toEqual(F);
  });

  it('a rock is laid in beds from its foot to its top; a block with no role keeps the greybox', () => {
    const F = dressFaces({ id: 'face', x: [20, 24], y: [-6, 6], z: [0, 11], role: 'rock' }, PLACE, 1);
    expect(Math.min(...zs(F))).toBe(0); expect(Math.max(...zs(F))).toBe(11);
    expect(new Set(F.map((f) => f.fill)).size).toBeGreaterThan(4);
    expect(dressFaces({ id: 'x', x: [0, 1], y: [0, 1], z: [0, 1] }, PLACE, 1)).toBeNull();
  });

  it('dresses what is seen and moves nothing played on: the same colliders and breakables, a breakable its own group', () => {
    for (const kind of ['collapse', 'climb']) {
      const K = layKind(kind), bare = siteOf(K.blocks), dressed = siteOf(K.blocks, { place: PLACE, seed: 7 });
      expect(dressed.colliders, kind).toEqual(bare.colliders);
      expect(dressed.breakables, kind).toEqual(bare.breakables);
      for (const b of bare.breakables) expect(dressed.faces.filter((f) => f.group === `break:${b.id}`).every((f) => f.node === b.id)).toBe(true);
      expect(dressed.faces.some((f) => f.group === 'site:street')).toBe(false);   // (the place's own ground, not the street)
    }
  });

  it('lays its ground and what lies beyond the play, never on it', () => {
    const bounds = [-3, -4, 64, 12];
    for (const backdrop of ['town', 'desert']) {
      const F = surroundsOf(PLACE, 7, { backdrop, bounds });
      const ground = F.filter((f) => f.group === 'dress:ground'), beyond = F.filter((f) => f.group !== 'dress:ground');
      expect(ground.every((f) => f.corners.every((c) => c[2] < 0)), backdrop).toBe(true);   // (under a street or a road)
      expect(beyond.length, backdrop).toBeGreaterThan(50);
      // (nothing standing over the play's plan)
      const over = beyond.filter((f) => f.corners.some((c) => c[2] > 0.5) && f.corners.every((c) => c[0] > bounds[0] && c[0] < bounds[2] && c[1] > bounds[1] && c[1] < bounds[3]));
      expect(over, backdrop).toEqual([]);
    }
  });

  it('a set piece in a place plays as it did: its line, prompts, colliders and slopes the same, its look the place\'s', () => {
    // (each kind's laid site: one case per procedure, chosen from the catalog: a still town, a still desert, a moving one)
    const cases = SET_PIECE_KIND_IDS.filter((k, i, all) => all.findIndex((x) => layKind(x).backdrop === layKind(k).backdrop && !!layKind(x).entities === !!layKind(k).entities) === i);
    expect(cases.length).toBe(3);
    for (const kind of cases) {
      const G = { id: 'g', feel: 'lost-nomad', seed: 7 };
      const a = stuntLevel(G, { spec: { kind }, cast: 'stand-in' }).manifest, b = stuntLevel(G, { spec: { kind }, cast: 'stand-in', place: PLACE }).manifest;
      for (const k of ['colliders', 'breakables', 'chase', 'prompts', 'slides', 'entities']) expect(b[k], `${kind} ${k}`).toEqual(a[k]);
      expect(a.look).toBeUndefined();
      expect(b.look).toBe('desert-dusk');
      expect(b.faces.length).toBeGreaterThan(a.faces.length);
    }
  });
});

describe('a house\'s faces face out', () => {
  // (each wall's normal away from the house's middle, each roof's up: a look bakes its sun by them)
  const normal = (f) => { const [a, b, , d] = f.corners, u = b.map((v, i) => v - a[i]), w = d.map((v, i) => v - a[i]); return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; };
  for (const [name, B] of [['along x', { id: 'r', x: [0, 21], y: [-4, 4], z: [0, 6] }], ['along y', { id: 'r', x: [0, 8], y: [0, 21], z: [0, 6] }]]) {
    it(`${name}: every house in the row, its front to either side`, () => {
      const F = dressFaces({ ...B, role: 'building' }, PLACE, 3), roofs = F.filter((f) => f.corners.every((c) => Math.abs(c[2] - 6) < 1e-6));
      expect(roofs.length).toBeGreaterThan(1);
      expect(roofs.every((f) => normal(f)[2] > 0)).toBe(true);
    });
  }
});
