// The substrate (substrate.js, substrate-of.js) and what belongs on it (substrate-flora.js): what a stage's ground is,
// cell by cell, by the land's own numbers and the rock's formation; the library set against it.
import { describe, expect, it } from 'vitest';
import { SUBSTRATES, SUBSTRATE_IDS, FORMATION_TURNS, substrateMap } from './substrate.js';
import { substrateOf } from './substrate-of.js';
import { SUBSTRATE_FLORA, ROLES, WANTS, floraGaps, floraLibrary } from './substrate-flora.js';
import { assembleGeocubeScene } from './geocube.js';
import { assembleStageScene } from './stage.js';
import { ISEKAI_STYLES } from './isekai.js';
import { outTrailSite } from './out-trail.js';

const M = { kind: 'stage', kit: 'isekai-meadow', trail: {} };
const sum = (s) => Object.values(s).reduce((a, v) => a + v, 0);

describe('what the ground is', () => {
  const plain = substrateOf(M);

  it('reads the land the stage lays: the path, the cliff\'s bedrock, its talus scree, the rest soil', () => {
    for (const k of ['path', 'bedrock', 'scree', 'soil']) expect(plain.shares[k], k).toBeGreaterThan(0);
    expect(plain.shares.sand).toBe(0);
    expect(plain.shares.wet).toBe(0);
    expect(sum(plain.shares)).toBeCloseTo(1, 3);
    expect(Object.keys(SUBSTRATES)).toEqual(SUBSTRATE_IDS);
  });

  it('a stream\'s crossing wets the ground about it', () => {
    expect(substrateOf({ ...M, trail: { beats: ['crossing', 'reveal', 'pocket', 'landmark'] } }).shares.wet).toBeGreaterThan(0);
  });

  it('the water (out-water.js) reads as its ground: open water no land, the shallows and the bank wet, the shore sand', () => {
    // (one case per procedure: a fresh water with its bank, a lake; the sea, a coast)
    const st = ISEKAI_STYLES[M.kit], site = outTrailSite(st, { ground: { water: { lake: true } } }, 1), S = substrateMap(st, site);
    const lake = site.water.forms.find((f) => f.form === 'lake'), [cx, cy] = lake.at, id = (k) => SUBSTRATE_IDS.indexOf(k);
    expect(S.shares.sand).toBeGreaterThan(0);
    expect(S.shares.wet).toBeGreaterThan(0);
    // walked out from the lake's middle: open water, then its shallows, its sand shore, its wet bank, the soil
    const runs = [], j = Math.floor((cy - S.y0) / S.cell);
    for (let i = Math.floor((cx - S.x0) / S.cell); i < S.nx; i++) { const c = S.cells[j * S.nx + i]; if (runs[runs.length - 1] !== c) runs.push(c); }
    expect(runs.slice(0, 5)).toEqual([255, id('wet'), id('sand'), id('wet'), id('soil')]);
    // (well clear of the water, the ground is the dry stage's)
    const dry = substrateMap(st, outTrailSite(st, {}, 1));
    for (let k = 0; k < S.cells.length; k++) {
      const x = S.x0 + (k % S.nx + 0.5) * S.cell, y = S.y0 + (Math.floor(k / S.nx) + 0.5) * S.cell;
      if (Math.hypot(x - cx, y - cy) > lake.r * 2.6) expect(S.cells[k]).toBe(dry.cells[k]);
    }
    // the coast: its beach sand, the sea no land, nothing wet
    const coast = substrateOf({ ...M, trail: { ground: { water: { coast: true } } } });
    expect(coast.shares.sand).toBeGreaterThan(0);
    expect(coast.shares.wet).toBe(0);
    expect(coast.cells.some((c) => c === 255)).toBe(true);
  });

  it('a formation turns only the soil, in patches of its own; the same recipe the same map', () => {
    // (one case per turn: to bedrock, to sand)
    const lime = substrateOf({ ...M, shading: { grit: 0.7, skin: 'limestone' } }), sand = substrateOf({ ...M, shading: { grit: 0.7, skin: 'sandstone' } });
    expect(FORMATION_TURNS.limestone.to).toBe('bedrock');
    expect(lime.shares.bedrock).toBeGreaterThan(plain.shares.bedrock);
    expect(sand.shares.sand).toBeGreaterThan(0);
    for (const S of [lime, sand]) {
      for (const k of ['path', 'scree', 'wet']) expect(S.shares[k], k).toBe(plain.shares[k]);
      // (a cell the formation turned was soil before)
      const soil = SUBSTRATE_IDS.indexOf('soil');
      for (let i = 0; i < S.cells.length; i++) if (S.cells[i] !== plain.cells[i]) expect(plain.cells[i]).toBe(soil);
    }
    expect(substrateOf({ ...M, shading: { grit: 0.7, skin: 'limestone' } }).cells).toEqual(lime.cells);
  });

  it('a geocube\'s street reads out the shares of its ground', () => {
    const T = assembleGeocubeScene({ kind: 'geocube', cube: 'limestone-crags', show: 'town', walk: false }, {}, assembleStageScene);
    expect(sum(T.geocube.substrate)).toBeCloseTo(1, 3);
    expect(T.geocube.substrate.bedrock).toBeGreaterThan(0);
  }, 60000);
});

describe('what belongs on it, and the library\'s gaps', () => {
  it('names every substrate and role, every ref in the library or wanted with its read', () => {
    expect(new Set(Object.keys(SUBSTRATE_FLORA))).toEqual(new Set(SUBSTRATE_IDS));
    for (const s of SUBSTRATE_IDS) expect(Object.keys(SUBSTRATE_FLORA[s])).toEqual(ROLES);
    const G = floraGaps();
    expect(G.dangling).toEqual([]);
    expect(G.gaps.every((g) => WANTS[g.want] && g.substrates.length && g.climates.length)).toBe(true);
    // (every wanted kind is wanted somewhere)
    expect(new Set(G.gaps.map((g) => g.want))).toEqual(new Set(Object.keys(WANTS)));
  });

  it('reads the library off its registries, and ranks a gap by the ground it would cover', () => {
    const lib = floraLibrary();
    expect(lib.has('grass:sedge') && lib.has('species:reed') && lib.has('patch:puddle') && lib.has('rock:stonecrop') && lib.has('cut:karst')).toBe(true);
    // (one ground covering the level: its gaps first; an empty slot doubles a gap on the same ground)
    const only = (s) => Object.fromEntries(SUBSTRATE_IDS.map((k) => [k, k === s ? 1 : 0]));
    for (const s of ['wet', 'soil']) expect(floraGaps({ shares: only(s) }).gaps[0].substrates).toContain(s);
    const G = floraGaps({ shares: only('wet') }), filling = G.gaps.find((g) => g.fills.length && g.substrates.includes('wet')), plain = G.gaps.find((g) => !g.fills.length && g.substrates.includes('wet') && g.climates.length === filling.climates.length && g.substrates.length === 1);
    if (plain) expect(filling.score).toBe(plain.score * 2);
    expect(G.empty.length).toBeGreaterThan(0);
    expect(G.gaps.every((g, i) => i === 0 || g.score <= G.gaps[i - 1].score)).toBe(true);
  });
});
