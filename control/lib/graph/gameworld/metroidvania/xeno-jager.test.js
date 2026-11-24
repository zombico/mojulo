// XENOJAGER: the castle's idioms in a planet's visual library. The same box, rings, gates and climbs; rock, crags, cave
// mouths, stalactites, crystals, fungi, falls of water and lava; every law the castle holds, held; the game a handle.
import { describe, it, expect } from 'vitest';
import { boxOf } from './scene.js';
import { readBox } from './box.js';
import { BOX_THEMES } from './themes.js';
import { BAY_PIECES, FOCAL_PIECES, DETAIL_GROUPS, rockCells } from './backdrop.js';
import { MOTION } from './dress.js';
import { GATES } from './gates.js';
import { BOX_LOOKS } from './hud.js';
import { feelRule } from '../feel/lower.js';
import { xenoJager, XENOJAGER_POWERS, XENOJAGER_HANDLE } from './xeno-jager.js';
import { vampireSonata } from './vampire-sonata.js';

const M = (words) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.63 });
const B = boxOf(M(xenoJager()));

describe('XenoJager: a dangerous planet explored down through its crust', () => {
  it('is the castle\'s map in the planet\'s words: its rings, its powers opening the same gates', () => {
    const X = readBox(xenoJager()), V = readBox(vampireSonata());
    expect(X.theme).toBe('xeno');
    expect(X.rings.length).toBe(V.rings.length);
    expect(Object.values(XENOJAGER_POWERS).map((p) => p.opens).sort()).toEqual(Object.values(V.powers).map((p) => p.opens).sort());
    for (const p of Object.values(XENOJAGER_POWERS)) expect(GATES[p.opens]).toBeTruthy();
    expect(B.layout.rooms.length).toBeGreaterThan(20);
  });

  it('holds every law the castle holds, in rock', () => {
    expect(B.laws.filter((l) => !l.holds)).toEqual([]);
    // (its solids built as rock, its doorways as cave mouths, its towers cracked where a castle slits them)
    const as = new Set(B.dress.fabric.built.map((b) => b.as.split(':')[0]));
    for (const k of ['path', 'rock', 'rock-roof', 'crust']) expect(as, k).toContain(k);
    expect(as.has('machicolations') || as.has('cornice') || as.has('hoarding')).toBe(false);
    expect(B.dress.fabric.doorways.every((w) => w.mouth)).toBe(true);
  });

  it('dresses its rooms from the planet\'s own library: every bay and focal piece it names drawn, its life moving', () => {
    const T = BOX_THEMES.xeno, named = new Set();
    for (const L of [...T.looks, ...Object.values(T.locales)]) { for (const b of L.bays ?? []) named.add(b); if (L.focal) named.add(L.focal); }
    for (const id of named) expect(BAY_PIECES[id] ?? FOCAL_PIECES[id], id).toBeTruthy();
    const groups = new Set(B.dress.faces.map((f) => f.group));
    for (const g of ['box:lava', 'box:water', 'box:glowpod', 'box:sway']) { expect(groups, g).toContain(g); expect(DETAIL_GROUPS).toContain(g); expect(B.dress.ambient.groups[g], g).toEqual(MOTION[g]); }
    // (its boulders are real rocks of the look's rock, its crystals real stones of its gem, shaded live and throwing no
    // print, grown as they are out of a wall; the wall itself fractured rock, never coursed)
    const rocks = B.dress.faces.filter((f) => f.group === 'box:rock'), gems = B.dress.faces.filter((f) => f.crystal);
    expect(rocks.length).toBeGreaterThan(0);
    expect(new Set(rocks.map((f) => f.piece)).size).toBeLessThan(rocks.length / 10);
    expect(gems.length).toBeGreaterThan(0);
    expect(new Set(gems.map((f) => f.crystal.gem)).size).toBeGreaterThan(1);
    expect(gems.every((f) => f.crystal.print === false && f.group === 'box:crystal')).toBe(true);
    expect(rocks.every((f) => f.corners.every((p) => p[0] < -1.6))).toBe(true);
    // (the sky over the crust is a planet's: a ringed world and a second moon over spires of rock)
    expect(T.night.planet && T.night.moon2 && T.night.skyline).toBeTruthy();
  });

  it('records each room\'s hazard for the game to come, and leaves its handle said, not wired', () => {
    const hz = Object.entries(B.dress.plan).filter(([, p]) => p.hazard);
    expect(new Set(hz.map(([, p]) => p.hazard))).toEqual(new Set(Object.keys(XENOJAGER_HANDLE.hazards)));
    for (const [room, p] of hz) expect(B.layout.rooms.find((r) => r.id === room).ring).toBeGreaterThan(1);
    expect([XENOJAGER_HANDLE.hero, XENOJAGER_HANDLE.feel, ...Object.values(XENOJAGER_HANDLE.hazards)].every((h) => h.wired === false)).toBe(true);
    // (its HUD's card is the one thing wired: the box's HUD wears it by its theme)
    expect(BOX_LOOKS.xeno).toBe(XENOJAGER_HANDLE.ui.theme);
    // (its feel the run and gun's own, its wall kept: the lowered rule clings)
    const R = feelRule({ pole: XENOJAGER_HANDLE.feel.pole, takes: true });
    expect(R).toBeTruthy();
  });

  it('breaks rock as rock breaks: boulders of every shape, never in courses, the same either side of a cut', () => {
    const C = rockCells(0, 20, 0, 11, { size: [2.1, 1.7], seed: 'test' });
    expect(C.length).toBeGreaterThan(30);
    expect(C.every((c) => c.pts.every(([a, z]) => a >= -1e-6 && a <= 20 + 1e-6 && z >= -1e-6 && z <= 11 + 1e-6))).toBe(true);
    // (no courses: the boulders' centres share no row)
    expect(new Set(C.map((c) => Math.round(c.c[1] * 100))).size).toBeGreaterThan(C.length * 0.9);
    expect(rockCells(0, 20, 0, 11, { size: [2.1, 1.7], seed: 'test' })).toEqual(C);
    // (a face cut in two breaks the same: a boulder wholly in the left half is the same boulder)
    const L = rockCells(0, 10, 0, 11, { size: [2.1, 1.7], seed: 'test' }), inL = (c) => c.pts.every(([a]) => a < 9.5);
    const at = (cs) => cs.filter(inL).map((c) => c.c.map((v) => v.toFixed(6)).join(',')).sort();
    expect(at(L)).toEqual(at(C));
  });

  it('is pure: the same words build the same planet', () => {
    const again = boxOf(M(xenoJager()));
    expect(again.dress.faces.length).toBe(B.dress.faces.length);
    expect(again.dress.plan).toEqual(B.dress.plan);
  });
});
