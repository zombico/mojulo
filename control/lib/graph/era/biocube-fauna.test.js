// A biocube's fauna (biocube-fauna.js): read and checked, placed on its ground, drawn by the page's fauna channel.
import { describe, expect, it } from 'vitest';
import { readFauna, faunaOn, unitOf, FIELD_KINDS, FIELD_KIND_IDS, FAUNA_IDS, HERD_SETTINGS } from './biocube-fauna.js';
import { GARGANTUAN_MAX } from '../fauna/size-class.js';
import { withFlora } from './biocube.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { SPECIES } from '../fauna/species.js';
import { tagsOf } from '../fauna/behavior/index.js';
import { readBiocube, BIOCUBE_IDS } from './biocube.js';
import { assembleStageScene } from './stage.js';
import { substrateOf } from './substrate-of.js';
import { SUBSTRATE_IDS } from './substrate.js';
import { sizeClassOf } from '../fauna/size-class.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { faunaScript } from '../scene/channels/fauna.js';

const M = { kind: 'stage', kit: 'isekai-meadow' };
const built = new Map(), stage = (m) => { const k = JSON.stringify(m); if (!built.has(k)) built.set(k, assembleStageScene(m)); return built.get(k); };

describe('reading fauna', () => {
  it('reads every preset, a preset with changes kind by kind, and a whole document, every setting filled', () => {
    for (const id of FAUNA_IDS) expect(Object.keys(readFauna(id).swarms).length).toBeGreaterThan(0);
    const F = readFauna({ from: 'summer-day', swarms: { gnats: { per: 40 }, birds: null, fireflies: true } });
    expect(F.swarms.gnats).toEqual({ ...readFauna('summer-day').swarms.gnats, per: 40 });
    expect(F.swarms.birds).toBeUndefined();
    expect(F.swarms.fireflies.count).toBe(FIELD_KINDS.fireflies.settings.count.default);
    expect(readFauna({ swarms: { butterflies: { count: 3 } } }).swarms).toEqual({ butterflies: { count: 3 } });
  });

  it('says what is wrong, in the card\'s own words', () => {
    expect(() => readFauna('jungle')).toThrow(/not a preset/);
    expect(() => readFauna({ swarms: { wolves: true } })).toThrow(/not a field kind/);
    expect(() => readFauna({ swarms: { gnats: { clouds: 0 } } })).toThrow(/gnats\.clouds is a whole number 1 to 24/);
    expect(() => readFauna({ swarms: { birds: { flock: [9, 3] } } })).toThrow(/birds\.flock is \[lo, hi\]/);
    expect(() => readFauna({ swarms: { gnats: { size: 2 } } })).toThrow(/gnats\.size is not a setting/);
    expect(() => readFauna({ from: 'summer-night', swarms: { fireflies: null, gnats: null } })).toThrow(/names nothing/);
  });

  it('a biocube grows no fauna unless asked: every preset\'s is none', () => {
    for (const id of BIOCUBE_IDS) expect(readBiocube(id).fauna).toBeNull();
    expect(readBiocube({ from: 'meadow', fauna: 'summer-night' }).fauna.id).toBe('summer-night');
    expect(readBiocube({ from: 'meadow', fauna: null }).fauna).toBeNull();
    expect(() => readBiocube({ from: 'meadow', fauna: 'jungle' })).toThrow(/fauna 'jungle'/);
  });

  it('each field kind stands for an animal in the rosters, its size its own, and keeps to grounds the substrate knows', () => {
    for (const k of FIELD_KIND_IDS) {
      expect(sizeClassOf(FIELD_KINDS[k].stands), k).not.toBeNull();
      for (const g of FIELD_KINDS[k].keeps) expect(SUBSTRATE_IDS).toContain(g);
    }
    expect(faunaOn('soil')).toContain('butterflies');
    expect(faunaOn('bedrock')).toEqual([]);
    expect(() => faunaOn('lava')).toThrow(/no ground/);
  });
});

describe('herds: the unit tier', () => {
  // (one case per mind: a grazer and a predator, each the first the encyclopedia has that can walk a level)
  const first = (tag) => Object.keys(SPECIES).find((id) => (tagsOf(SPECIES[id].family, id) || []).includes(tag) && (() => { try { return unitOf(id); } catch { return null; } })());

  it('reads herds by species, merged over a preset\'s, every setting filled', () => {
    const F = readFauna({ from: 'pasture', herds: { sheep: { size: [2, 3] } } });
    expect(F.herds.sheep).toEqual({ groups: 2, size: [2, 3], killable: false, interact: 'pet' });
    expect(readFauna({ herds: { deer: true } }).herds.deer).toEqual({ groups: HERD_SETTINGS.groups.default, size: [...HERD_SETTINGS.size.default], killable: false, interact: null });
    expect(readFauna({ from: 'pasture', herds: { sheep: null } }).herds).toEqual({});
  });

  it('refuses what cannot stand in a level, saying why', () => {
    expect(() => readFauna({ herds: { unicorn: true } })).toThrow(/not a species/);
    expect(() => readFauna({ herds: { firefly: true } })).toThrow(/a bug/);
    const swimmer = Object.keys(SPECIES).find((id) => SPECIES[id].family === 'teleost');   // (a fish: the swimmers' case)
    expect(() => readFauna({ herds: { [swimmer]: true } })).toThrow(/lives in water/);
    expect(() => readFauna({ herds: { sheep: { size: [0, 2] } } })).toThrow(/sheep\.size/);
    expect(() => readFauna({ herds: { sheep: { flock: 2 } } })).toThrow(/sheep\.flock is not a setting/);
  });

  it('may be killable (its hp by its size, or named) and may be petted', () => {
    const small = readFauna({ herds: { rabbit: { killable: true } } }).herds.rabbit.killable.hp, big = readFauna({ herds: { sheep: { killable: true } } }).herds.sheep.killable.hp;
    expect(big).toBeGreaterThan(small);
    expect(readFauna({ herds: { sheep: { killable: { hp: 7 } } } }).herds.sheep.killable).toEqual({ hp: 7 });
    expect(() => readFauna({ herds: { sheep: { killable: 'yes' } } })).toThrow(/killable is false, true or \{ hp \}/);
    expect(() => readFauna({ herds: { sheep: { killable: { hp: 0 } } } })).toThrow(/killable\.hp/);
    expect(() => readFauna({ herds: { sheep: { interact: 'ride' } } })).toThrow(/interact is null or one of pet/);
  });

  it('is never hostile: a grazer grazes, a predator only wanders, both passive', () => {
    const g = unitOf(first('grazer')), p = unitOf(first('predator'));
    expect(g.mind).toEqual({ motivation: 'forage', aggressiveness: 'passive' });
    expect(p.mind).toEqual({ motivation: 'wander', aggressiveness: 'passive' });
    for (const u of [g, p]) { expect(u.stride.speed).toBeGreaterThan(0); expect(['mini']).not.toContain(u.size); }
  });
});

describe('fauna on a stage', () => {
  const plain = stage({ ...M, biocube: 'meadow' }), day = stage({ ...M, biocube: { from: 'meadow', fauna: 'summer-day' } });

  it('adds nothing to the land: the same faces, and no fauna without one', () => {
    expect(plain.fauna).toBeUndefined();
    expect(JSON.stringify(day.faces)).toBe(JSON.stringify(plain.faces));
  });

  it('lays each kind on its own ground, off the way, the same every time', () => {
    expect(Object.keys(day.fauna)).toEqual(['seed', 'gnats', 'butterflies', 'birds']);
    expect(day.fauna.gnats.clouds).toHaveLength(3);
    const S = substrateOf({ ...M }), at = ([x, y]) => SUBSTRATE_IDS[S.cells[Math.floor((y - S.y0) / S.cell) * S.nx + Math.floor((x - S.x0) / S.cell)]];
    for (const [k, list] of [['gnats', day.fauna.gnats.clouds], ['butterflies', day.fauna.butterflies.homes]]) for (const p of list) expect(FIELD_KINDS[k].keeps, k).toContain(at(p));
    expect(JSON.stringify(stage({ ...M, biocube: { from: 'meadow', fauna: 'summer-day' }, seed: 1 }).fauna)).toBe(JSON.stringify(day.fauna));
    expect(day.fauna.birds.flock).toEqual(FIELD_KINDS.birds.settings.flock.default);
  });

  it('lays a herd as units: passive bodies on their rig, on the soil and off the way, a grazer\'s grass round them', () => {
    const P = stage({ ...M, biocube: { from: 'meadow', fauna: 'pasture' } }), U = P.faunaUnits, H = readFauna('pasture').herds.sheep;
    const animals = U.entities.filter((e) => e.rule.type === 'ai'), grass = U.entities.filter((e) => e.food);
    expect(Object.keys(U.figures)).toEqual(['fauna:sheep']);
    expect(U.figures['fauna:sheep']).toEqual({ species: 'sheep', gait: unitOf('sheep').gait, behaviors: ['eat', 'relax'] });
    expect(animals.length).toBeGreaterThanOrEqual(H.groups * H.size[0]);
    expect(animals.length).toBeLessThanOrEqual(H.groups * H.size[1]);
    expect(grass.length).toBeGreaterThan(0);
    expect(new Set(U.entities.map((e) => e.id)).size).toBe(U.entities.length);
    const S = substrateOf({ ...M }), at = ([x, y]) => SUBSTRATE_IDS[S.cells[Math.floor((y - S.y0) / S.cell) * S.nx + Math.floor((x - S.x0) / S.cell)]];
    for (const a of animals) {
      expect(a).toMatchObject({ fauna: true, body: { type: 'figure-rig', figure: 'fauna:sheep' }, rule: { mind: { aggressiveness: 'passive' } } });
      expect(a.rule.loadout).toBeUndefined(); expect(a.team).toBeUndefined();
      expect(at(a.transform.pos)).toBe('soil');
      // (pasture's sheep may be petted, and are not to be hurt: no hp, nothing hits them)
      expect(a.pet).toMatchObject({ species: 'sheep', clip: 'relax' });
      expect(a.body.hittable).toBeUndefined();
    }
    const K = stage({ ...M, biocube: { from: 'meadow', fauna: { herds: { sheep: { killable: { hp: 30 } } } } } }).faunaUnits;
    for (const a of K.entities.filter((e) => e.rule.type === 'ai')) { expect(a.body).toMatchObject({ hp: 30, hittable: true }); expect(a.pet).toBeUndefined(); }
    expect(K.figures['fauna:sheep'].reactions).toEqual(unitOf('sheep').reacts);
    expect(P.fauna.butterflies).toBeDefined();
    expect(JSON.stringify(P.faces)).toBe(JSON.stringify(plain.faces));
    // (a fauna of herds alone puts nothing on the page's field)
    expect(stage({ ...M, biocube: { from: 'meadow', fauna: { herds: { sheep: true } } } }).fauna).toBeUndefined();
  });

  it('the page draws them only when there are some', () => {
    const marker = '// --- fauna: the field';
    expect(emitThreeWorld({ faces: plain.faces.slice(0, 50) })).not.toContain(marker);
    expect(emitThreeWorld({ faces: plain.faces.slice(0, 50), fauna: { seed: 1 } })).not.toContain(marker);
    expect(faunaScript(day.fauna)).toContain(marker);
    expect(emitThreeWorld({ faces: plain.faces.slice(0, 50), fauna: day.fauna })).toContain(marker);
  });
});

describe('the gargantuan: a rock\'s or a pillar\'s scale', () => {
  it('stands solid and still a long while, and past a Gundam\'s scale is a landmark, not fauna', () => {
    const u = unitOf('elephant');
    expect(u).toMatchObject({ size: 'gargantuan', solid: true });
    expect(unitOf('sheep').solid).toBe(false);
    expect(() => unitOf('diplodocus')).toThrow(new RegExp(`past a gargantuan's scale \\(${GARGANTUAN_MAX} m`));
    const U = stage({ ...M, biocube: { fauna: { herds: { elephant: { size: [2, 2] } } } } }).faunaUnits;
    for (const a of U.entities.filter((e) => e.rule.type === 'ai')) {
      expect(a.body).toMatchObject({ heavy: true, collide: { a: expect.any(Number), c: expect.any(Number) } });
      expect(a.rule.wanderPause).toBeGreaterThan(3);
    }
  });
});

describe('fauna alone, water and indoors', () => {
  it('a biocube of fauna alone lays no flora: the kit grows its own', () => {
    const B = readBiocube({ fauna: 'summer-day' });
    expect(B.flora).toBeNull();
    expect(withFlora(ISEKAI_MEADOW, B)).toBe(ISEKAI_MEADOW);
    expect(JSON.stringify(stage({ ...M, biocube: { fauna: 'summer-day' } }).faces)).toBe(JSON.stringify(stage(M).faces));
  });

  it('floats ducks on a stage\'s streams, inside the water; a stage without a stream lays none', () => {
    const T = { ...M, trail: { beats: ['landmark', 'crossing', 'pocket', 'reveal'] }, biocube: { fauna: 'brook' } };
    const D = stage(T).fauna.ducks, water = stage(T).faces.filter((f) => f.group === 'trail:water');
    expect(D.ducks.length).toBe(readFauna('brook').swarms.ducks.count);
    const zs = water.flatMap((f) => f.corners.map((c) => c[2])), lo = Math.min(...zs), hi = Math.max(...zs);
    for (const [x, y, z, line, half] of D.ducks) { expect(Math.abs(y - line)).toBeLessThanOrEqual(half); expect(z).toBeGreaterThanOrEqual(lo - 1e-3); expect(z).toBeLessThanOrEqual(hi + 1e-3); }
    expect(stage({ ...M, biocube: { fauna: 'brook' } }).fauna.ducks).toBeUndefined();
  });

  it('lays a room stage\'s critters along its walls, and keeps each kind to its side of the roof', () => {
    const R = { kind: 'stage', kit: 'catacomb', rooms: [{ id: 'a', x: 0, y: 0, w: 6, d: 8, h: 3 }] };
    const F = stage({ ...R, biocube: { fauna: 'cellar' } }).fauna;
    expect(F.roaches.runs).toHaveLength(readFauna('cellar').swarms.roaches.count);
    for (const [x0, y0, x1, y1, , z] of [...F.roaches.runs, ...F.mice.runs]) { expect(x0).toBeGreaterThanOrEqual(0); expect(y1).toBeLessThanOrEqual(8); expect(x1 - x0).toBeGreaterThan(5); expect(z).toBe(0); }
    expect(stage(R).fauna).toBeUndefined();
    expect(() => stage({ ...R, biocube: { fauna: 'pasture' } })).toThrow(/herds stand on open ground/);
    expect(() => stage({ ...R, biocube: { fauna: 'summer-day' } })).toThrow(/lives outdoors/);
    expect(() => stage({ ...M, biocube: { fauna: 'cellar' } })).toThrow(/live indoors/);
    const html = emitThreeWorld({ faces: [], fauna: F });
    expect(html).toContain('// --- fauna: the field');
  });
});
