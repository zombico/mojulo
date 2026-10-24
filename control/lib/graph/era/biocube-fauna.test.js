// A biocube's fauna (biocube-fauna.js): read and checked, placed on its ground, drawn by the page's fauna channel.
import { describe, expect, it } from 'vitest';
import { readFauna, faunaOn, FIELD_KINDS, FIELD_KIND_IDS, FAUNA_IDS } from './biocube-fauna.js';
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

  it('the page draws them only when there are some', () => {
    const marker = '// --- fauna: the field';
    expect(emitThreeWorld({ faces: plain.faces.slice(0, 50) })).not.toContain(marker);
    expect(emitThreeWorld({ faces: plain.faces.slice(0, 50), fauna: { seed: 1 } })).not.toContain(marker);
    expect(faunaScript(day.fauna)).toContain(marker);
    expect(emitThreeWorld({ faces: plain.faces.slice(0, 50), fauna: day.fauna })).toContain(marker);
  });
});
