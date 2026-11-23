import { describe, it, expect } from 'vitest';
import { readSpaceFleet, fleetWorld, layFleet, toward } from './space-fleet.js';
import { assembleAirspace, airspaceOf } from './airspace.js';
import { planBackdrop, BACKDROP } from './backdrop.js';
import { SPACE_STAR } from './space.js';
import { buildCapital } from '../fleet/build.js';

// ── a space level's fleet (space-fleet.js): ships laid in the frame of the pilot's start, as a sortie's groups are ──────
const seat = { pos: [100, -200, 50], heading: Math.PI / 2 };   // facing +y
const corvette = { id: 'k', capital: 'corvette', at: { ahead: 1000, side: 200, up: 0 } };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('space fleet', () => {
  it('teaches a fault', () => {
    expect(readSpaceFleet([{ id: 'a', at: {} }])[0]).toMatch(/capital ship .* or a station/);
    expect(readSpaceFleet([{ id: 'a', capital: 'dreadnought', at: {} }])[0]).toMatch(/capital ship's class/);
    expect(readSpaceFleet([corvette])).toEqual([]);
  });
  it('stands each ship where the start\'s frame puts it, its bow along its heading', () => {
    expect(fleetWorld([corvette], seat)[0].center).toEqual([300, 800, 50]);
    const bow = (heading) => {
      const L = layFleet([{ ...corvette, heading }], seat), B = buildCapital('corvette');
      const bowId = B.pieces.reduce((a, p) => (p.max[0] > a.max[0] ? p : a)).id;
      const c = L.colliders.find((x) => x.id === `k/${bowId}`);
      return [(c.min[0] + c.max[0]) / 2 - 300, (c.min[1] + c.max[1]) / 2 - 800];
    };
    // heading 0: the bow the way the pilot faces (+y); 90 clockwise: to its right (+x)
    expect(bow(0)[1]).toBeGreaterThan(40);
    expect(bow(90)[0]).toBeGreaterThan(40);
  });
  it('lays faces in the ship\'s own group, a collider for each piece, a bookmark; the same for the same ask', () => {
    const L = layFleet([corvette], seat), B = buildCapital('corvette');
    expect(L.faces.length).toBe(B.faces.length);
    expect(L.faces.every((f) => f.group === 'fleet:k')).toBe(true);
    expect(L.colliders.length).toBe(B.pieces.length);
    expect(L.cameras.map((c) => c.name)).toEqual(['fleet:k']);
    expect(JSON.stringify(layFleet([corvette], seat))).toBe(JSON.stringify(L));
  });
  it('a bearing and an elevation from the start become a direction in the world', () => {
    expect(toward(seat, { bearing: 0, elevation: 0 })).toEqual([0, 1, 0]);
    expect(toward(seat, { bearing: 90, elevation: 0 })[0]).toBeCloseTo(1, 3);
  });
});

describe('a space level with a fleet', () => {
  const level = (space) => ({ kind: 'airspace', map: { craft: 'fighter', field: 4000 }, cockpit: true, space, seed: 1 });
  it('carries its ships\' faces, colliders and bookmarks, the rocks clear of them; without one, none of it', () => {
    const bare = assembleAirspace(level({ asteroids: 'field' })), with_ = assembleAirspace(level({ asteroids: 'field', fleet: [corvette] }));
    expect(bare.colliders).toBeUndefined();
    expect(bare.meta.fleet).toBeUndefined();
    expect(with_.colliders.length).toBeGreaterThan(5);
    expect(with_.faces.length).toBeGreaterThan(bare.faces.length);
    expect(with_.meta.fleet[0]).toMatchObject({ id: 'k', kind: 'corvette' });
    expect(with_.cameras.some((c) => c.name === 'fleet:k')).toBe(true);
    const { field } = airspaceOf(level({ asteroids: 'field', fleet: [corvette] }));
    const { field: f0 } = airspaceOf(level({ asteroids: 'field' }));
    // (the fleet's own spot is kept: no rock within its reach of it)
    const at = with_.meta.fleet[0].at, R = 80;
    expect(field.asteroids.every(([x, y, z, r]) => Math.hypot(x - at[0], y - at[1], z - at[2]) > R + r)).toBe(true);
    expect(f0.asteroids.length).toBeGreaterThan(0);
  });
  it('sets the large world where the mission put it, moved just clear of the star when it crowds it', () => {
    const S = SPACE_STAR.dir, far = [0, -0.9, -0.44], near = [0.5, -0.3, 0.81];
    const P1 = planBackdrop({ star: S, worlds: ['arctic'], proximity: 'near', toward: far }).planets[0];
    expect(dot(P1.dir, far) / Math.hypot(...far)).toBeGreaterThan(0.999);
    const P2 = planBackdrop({ star: S, worlds: ['arctic'], proximity: 'near', toward: near }).planets[0];
    expect(Math.acos(dot(P2.dir, S)) * 180 / Math.PI).toBeGreaterThan(1 + BACKDROP.clear + P2.r);
  });
});
