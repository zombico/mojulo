/**
 * Rock takes pixels when the style is gritty (shading `grit`): at GRIT_PIXELS or over, the land's faces are the quiet
 * style's byte for byte and the page is handed the rock's own fabric (matte-paint/fabric.js) to draw on the near cliffs;
 * under it, or absent, the land is as it was. On one small island.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru, GRIT_PIXELS } from './plan.js';
import { assembleStageScene } from '../era/stage.js';
import { readGeocube, lowerGeocube } from '../era/geocube.js';
import { ISEKAI_STYLES } from '../era/isekai-tiles.js';
import { boulderFaces } from '../era/isekai.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const build = (shading) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: { geology: true, walk: 'base' }, shading } }, {});
const base = build(true), quiet = build({ grit: GRIT_PIXELS - 0.1 }), gritty = build({ grit: 0.7 });

describe('rock takes pixels in a gritty style', () => {
  it('a quiet style\'s land is as it was, and is handed no fabric', () => {
    expect(JSON.stringify(quiet)).toBe(JSON.stringify(base));
    expect(base.fabric).toBeUndefined();
  });

  it('a gritty style\'s land is the quiet style\'s but its broken rims, its boulders and its stones', () => {
    // the same faces in the same order; a corner that moved is a cliff's rim vertex, pushed a little into the land
    const land = (P) => P.faces.filter((f) => f.group !== 'isekai:rock'), a = land(base), b = land(gritty);
    expect(b.map((f) => f.group)).toEqual(a.map((f) => f.group));
    let moved = 0;
    a.forEach((f, i) => f.corners.forEach((c, j) => {
      const d = b[i].corners[j];
      if (d.join() === c.join()) return;
      moved++;
      expect(Math.hypot(d[0] - c[0], d[1] - c[1])).toBeLessThan(0.8 * 0.7 * 0.5 + 1e-3);
      expect(d[2]).toBeLessThanOrEqual(c[2]);
    }));
    expect(moved).toBeGreaterThan(0);
    // and small stones lie about: more rock than the boulders' alone
    expect(gritty.faces.filter((f) => f.group === 'isekai:rock').length).toBeGreaterThan(base.faces.filter((f) => f.group === 'isekai:rock').length);
    expect(JSON.stringify(build({ grit: 0.7 }).faces)).toBe(JSON.stringify(gritty.faces));
  });

  it('and its boulders break at their edges, each still a closed rock open only at its sunk foot', () => {
    const st = ISEKAI_STYLES['isekai-meadow'], it0 = { x: 3, y: 4, z0: 1, size: 3, v: 2 };
    const plain = boulderFaces(st, it0, 7), broken = boulderFaces(st, it0, 7, 0.7), faces = [...broken.sides, ...broken.cap];
    expect(faces.length).toBeGreaterThan(plain.sides.length + plain.cap.length);
    expect(JSON.stringify(boulderFaces(st, it0, 7, 0))).toBe(JSON.stringify(plain));
    const E = new Map(), key = (c) => c.join(',');
    for (const f of faces) {
      const cs = f.corners.filter((c, i, a) => i === 0 || key(c) !== key(a[i - 1]));
      for (let i = 0; i < cs.length; i++) { const a = key(cs[i]), b = key(cs[(i + 1) % cs.length]); if (a === b) continue; const k = a < b ? `${a}|${b}` : `${b}|${a}`; E.set(k, (E.get(k) || 0) + 1); }
    }
    const zmin = Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2])));
    const open = [...E.entries()].filter(([, n]) => n !== 2).map(([k]) => k.split('|').map((p) => Number(p.split(',')[2])));
    expect(open.length).toBeGreaterThan(0);
    for (const zs of open) for (const z of zs) expect(z).toBeLessThan(zmin + 0.2);
  });

  it('and the page is handed the island\'s own joint fabric for its cliffs', () => {
    const F = gritty.fabric, joint = ISEKAI_STYLES['isekai-meadow'].landform.joint;
    expect(F.groups).toEqual(['isekai:cliff']);
    // the island's landform joints granite on the card's spacing at strike 0: the master sets lie along x and y
    expect(F.sets[0]).toMatchObject({ n: [1, 0, 0], s: joint });
    expect(F.sets[1].n).toEqual([-0, 1, 0]);
    expect(F.sets[2].s).toBeCloseTo(joint / 3, 3);
    expect(F.sun[2]).toBeGreaterThan(0);
  });

  it('a geocube carries its grit into the land, and the land checks it', () => {
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.7 }), 'outside').meru.shading.grit).toBe(0.7);
    expect(lowerGeocube(readGeocube('valley-morning'), 'outside').meru.shading.grit).toBeUndefined();
    expect(() => readGeocube({ from: 'valley-morning', grit: 2 })).toThrow(/grit is how gritty the style is/);
    expect(() => readLocalMeru({ shading: { grit: -1 } })).toThrow(/shading\.grit is 0\.\.1/);
    expect(() => readLocalMeru({ shading: { grit: 0.7, skin: 'moss' } })).toThrow(/shading\.skin is true/);
    expect(build({ grit: 0.7, skin: true }).fabric.skin.id).toBe('sculpted');
  });

  it('a formation takes the boulders too, unless they are named a rock of their own', () => {
    const one = build({ grit: 0.7, skin: 'limestone' }).fabric;
    expect(one.formation.id).toBe('limestone');
    expect(one.groups).toEqual(['isekai:cliff', 'isekai:rock']);
    expect(one.also).toBeUndefined();
    const two = build({ grit: 0.7, skin: 'limestone', rocks: 'sculpted' }).fabric;
    expect(two.groups).toEqual(['isekai:cliff']);
    expect(two.also.groups).toEqual(['isekai:rock']);
    expect(two.also.skin.id).toBe('sculpted');
    expect(two.also.key).not.toBe(two.key);
    expect(() => readLocalMeru({ shading: { grit: 0.7, skin: 'limestone', rocks: 'moss' } })).toThrow(/shading\.rocks is one of/);
    expect(() => readLocalMeru({ shading: { grit: 0.7, rocks: 'sandstone' } })).toThrow(/it wants a skin/);
  });
});
