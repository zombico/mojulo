// THE GEOCITY BUILT: a metro's map stood on the cube's land as massing. The smallest metro that still rings: a small
// shore, one built at noon and one at night.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene, GEOCITY_FACES } from './scene.js';
import { designGeocity } from './design.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity };
const P = assembleGeocityScene(M), D = designGeocity(geocity, { seed: 2 });
const law = (id) => P.geocity.laws.find((l) => l.law === id);
const group = (g) => P.faces.filter((f) => f.group === g);

describe('the geocity built: its map stood on the cube\'s land as massing', () => {
  it('draws the metro under its budget, its blocks\' buildings by segment, its towers in its core', () => {
    expect(law('faces').ok).toBe(true);
    expect(P.faces.length).toBeLessThanOrEqual(GEOCITY_FACES);
    const towers = D.regions.flatMap((r) => r.blocks).flatMap((b) => b.towers ?? []);
    expect(P.geocity.counts.towers).toBe(towers.length);
    expect(group('geocity:tower').length).toBe(4 * towers.length);
    expect(group('geocity:house').length).toBeGreaterThan(0);
    expect(group('geocity:water').length).toBe(1);
  });

  it('stands every block\'s terraces over the walk round them, and each tower its storeys over its terrace', () => {
    const S = D.land.S;
    for (const f of group('geocity:pad')) for (const [x, y, z] of f.corners) expect(z).toBeGreaterThanOrEqual(S(x, y) + 0.15 - 1e-3);
    const office = D.grammar.floorH.office, b = D.regions.flatMap((r) => r.blocks).find((x) => x.towers), t = b.towers[0];
    const roof = group('geocity:tower:roof').find((f) => f.corners.every(([x, y]) => x >= t.rect[0] - 1e-3 && x <= t.rect[2] + 1e-3 && y >= t.rect[1] - 1e-3 && y <= t.rect[3] + 1e-3));
    const pad = group('geocity:pad').map((f) => f.corners[0][2]).filter((z) => Math.abs(roof.corners[0][2] - t.storeys * office - z) < 1e-3);
    expect(pad.length).toBeGreaterThan(0);
  });

  it('lights its windows past dusk, and draws none by day', () => {
    expect(group('geocity:night-window')).toHaveLength(0);
    const N = assembleGeocityScene({ ...M, hour: 'night' });
    expect(N.geocity.counts.panes).toBeGreaterThan(0);
    expect(N.faces.filter((f) => f.group === 'geocity:night-window')).toHaveLength(N.geocity.counts.panes);
    // (the rest of the night's metro is the day's, face for face but its light)
    expect(N.faces.length - N.geocity.counts.panes).toBe(P.faces.length);
  });

  it('is the same metro for the same recipe', () => {
    const Q = assembleGeocityScene(M);
    expect(Q.faces.length).toBe(P.faces.length);
    expect(JSON.stringify(Q.faces.slice(-50))).toBe(JSON.stringify(P.faces.slice(-50)));
  });

  it('sees itself from its water, over it, its core and up its spine, and is walked from its seat', () => {
    expect(P.cameras.map((c) => c.name)).toEqual(['skyline', 'over', 'core', 'street']);
    const [x, y, z] = P.walk.spawn;
    expect(z).toBeCloseTo(D.land.S(x, y) + 0.15 + 1.7, 3);
    expect(P.route[0]).toEqual(P.route[P.route.length - 1]);
    expect(P.geocity.graph.edges).toBe(D.graph.edges.length);
  });

  it('is the geocube kind\'s `show: \'geocity\'`, walked by its dummy, and refuses what is off its settings', async () => {
    const p = await WORLD_KINDS.geocube.resolve(M, { title: 'a metro' });
    expect(p.walkers?.length).toBe(1);
    expect(p.geocube.show).toBe('geocity');
    expect(() => assembleGeocityScene({ ...M, domain: 'x' })).toThrow(/'domain' is not a setting of the geocube kind's geocity/);
  });
});
