// XENOJAGER: the castle's idioms in a planet's visual library. The same box, rings, gates and climbs; rock, crags, cave
// mouths, stalactites, crystals, fungi, falls of water and lava; every law the castle holds, held; the game a handle.
import { describe, it, expect } from 'vitest';
import { boxOf } from './scene.js';
import { readBox } from './box.js';
import { BOX_THEMES } from './themes.js';
import { BAY_PIECES, FOCAL_PIECES, DETAIL_GROUPS } from './backdrop.js';
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

  it('is pure: the same words build the same planet', () => {
    const again = boxOf(M(xenoJager()));
    expect(again.dress.faces.length).toBe(B.dress.faces.length);
    expect(again.dress.plan).toEqual(B.dress.plan);
  });
});
