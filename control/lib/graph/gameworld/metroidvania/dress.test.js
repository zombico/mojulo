import { describe, it, expect } from 'vitest';
import { assembleBox, boxOf } from './scene.js';
import { dressBox, LIVE, MOTION } from './dress.js';
import { BOX_THEMES, lookOf, themeLaws, localeOf, roomLook } from './themes.js';
import { vampireSonata } from './vampire-sonata.js';
import { readBox } from './box.js';

const M = (words) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.63 });

describe('a box dressed in its theme', () => {
  it('names a theme in its words, and refuses one it does not know', () => {
    expect(readBox(vampireSonata()).theme).toBe('castle');
    expect(() => readBox({ ...vampireSonata(), theme: 'spaceship' })).toThrow(/theme is castle/);
  });

  it('gives each ring its own look, its core the theme\'s last, and holds the theme\'s laws', () => {
    const rings = vampireSonata().rings.length, T = BOX_THEMES.castle;
    expect(lookOf(T, 0, rings)).toBe(T.looks[0]);
    expect(lookOf(T, rings - 1, rings)).toBe(T.looks.at(-1));
    const B = boxOf(M(vampireSonata()));
    expect(B.laws.filter((l) => !l.holds)).toEqual([]);
    expect(B.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['theme:rings-distinct', 'theme:gates-read']));
    // (two rings alike are said)
    const same = { ...T, looks: [T.looks[1], T.looks[1], T.looks[1], T.looks[1]] };
    expect(themeLaws(same, rings).find((l) => l.id === 'rings-distinct').holds).toBe(false);
  });

  it('dresses nothing it does not see the box keep: its play the greybox\'s, no runner over a hole', () => {
    const plain = assembleBox(M({ ...vampireSonata(), theme: undefined })), dressed = assembleBox(M(vampireSonata()));
    // (the play stands as it stood: the same colliders, gates and what is picked up)
    expect(dressed.colliders).toEqual(plain.colliders);
    expect(dressed.breakables).toEqual(plain.breakables);
    expect(dressed.heldGates).toEqual(plain.heldGates);
    // (a runner never lies over a hole in the floor it runs down: a drop is never carpeted over)
    const B = boxOf(M(vampireSonata())), D = dressBox(B, 'castle');
    const runners = D.faces.filter((f) => f.group === 'box:runner');
    expect(runners.length).toBeGreaterThan(0);
    for (const h of B.greybox.holes) for (const f of runners) {
      const s = f.corners.map((p) => p[1]), z = f.corners[0][2];
      if (Math.abs(z - (h.z + 1.02)) > 0.05) continue;
      expect(Math.min(...s) >= h.s1 || Math.max(...s) <= h.s0).toBe(true);
    }
    // (a lamp a cell, lit faces near each)
    expect(D.lamps.length).toBeGreaterThanOrEqual(B.layout.rooms.length);
  });

  // (docs/side-scroll-backgrounds.md) the night seen in depth, the moon's light in the rooms, the flames alive, the backdrop moving
  it('lays the night in depth, lets the moonlight in, burns every flame live and moves what stands behind the play', () => {
    const B = boxOf(M(vampireSonata())), D = B.dress, P = assembleBox(M(vampireSonata()));
    const night = D.faces.filter((f) => f.group === 'box:night'), xs = (g) => D.faces.filter((f) => f.group === g).map((f) => f.corners[0][0]);
    // (the sky's bands meet edge to edge: a lapped band is lifted a step toward the eye by the page, and a stack of them climbs)
    const bands = night.filter((f) => f.corners.every((c) => c[0] === Math.min(...night.map((n) => n.corners[0][0])))).map((f) => [Math.min(...f.corners.map((c) => c[2])), Math.max(...f.corners.map((c) => c[2]))]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < bands.length; i++) expect(bands[i][0]).toBeGreaterThanOrEqual(bands[i - 1][1] - 1e-6);
    // (stars and cloud over the sky, behind the far towers; a moonbeam from every arched window; its glass the night)
    expect(Math.max(...xs('box:stars'))).toBeLessThan(Math.min(...night.filter((f) => f.corners.length === 5).map((f) => f.corners[0][0])));
    expect(xs('box:clouds').length).toBeGreaterThan(0);
    const beams = D.faces.filter((f) => f.group === 'box:beam');
    expect(beams.length).toBeGreaterThan(0);
    expect(beams.every((f) => f.alpha > 0 && f.alpha < 0.2)).toBe(true);
    expect(D.faces.filter((f) => f.group === 'box:glass').every((f) => new Set(f.cornerFills).size > 1)).toBe(true);
    // (a live flame for every painted flame but the cold lamps', the painted one kept as its ember)
    expect(D.live.length).toBe(D.faces.filter((f) => f.group === 'box:flame' && f.corners.length === 5).length);
    expect(P.flames).toEqual(D.live);
    expect(LIVE.grow).toBeGreaterThan(1);
    expect(Object.keys(P.ambient.groups)).toEqual(expect.arrayContaining(Object.keys(MOTION)));
  });

  // (docs/metroidvania-map.md "Locales") a room its own place inside its ring
  it('dresses a room as its locale by what it is, in its own wall, and turns what turns', () => {
    const rings = vampireSonata().rings.length, B = boxOf(M(vampireSonata())), D = B.dress, T = BOX_THEMES.castle;
    // (every save room in a closed ring is a chapel; an open ring's rooms are its ramparts, none a locale)
    for (const r of B.layout.rooms) {
      if (lookOf(T, r.ring, rings).open) expect(D.plan[r.id].locale).toBeUndefined();
      else if (r.save) expect(D.plan[r.id].locale).toBe('chapel');
    }
    expect(localeOf(T, { ring: 1, kind: 'shaft' }, rings)).toBe(lookOf(T, 1, rings).shaft);
    expect(roomLook(T, { ring: 1, kind: 'shaft' }, rings).focal).toBe(T.locales[lookOf(T, 1, rings).shaft].focal);
    expect(roomLook(T, { ring: 1, kind: 'corridor' }, rings)).toBe(lookOf(T, 1, rings));
    // (stained glass keeps its colours, lit from behind; each gear and each clock hand turns about its own hub)
    const stained = D.faces.filter((f) => f.group === 'box:stained');
    expect(stained.length).toBeGreaterThan(0);
    expect(stained.every((f) => !f.cornerFills)).toBe(true);
    const turns = Object.entries(D.ambient.groups).filter(([g, m]) => g.startsWith('box:turn:') && m.spin);
    expect(turns.some(([g]) => g.includes(':gear:'))).toBe(true);
    expect(turns.some(([g]) => g.includes('clock:'))).toBe(true);
    for (const [g] of turns) expect(D.faces.some((f) => f.group === g)).toBe(true);
    // (every backdrop law still holds over the locales)
    expect(B.laws.filter((l) => l.id.startsWith('backdrop:') && !l.holds)).toEqual([]);
  });
});
