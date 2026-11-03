import { describe, it, expect } from 'vitest';
import { designAtlas } from './atlas.js';
import { gameworldAtlasHtml, ATLAS_LOOK_IDS, ATLAS_LOOKS, ATLAS_DEPICTIONS } from './atlas-html.js';
import { readGameworld } from './world.js';
import { HOLLIN_VALE, MEADOWMARK } from './examples.js';

// the atlas (atlas.js, atlas-html.js): a world's levels laid out as one map from its own recipe, in looks of paint only
describe('the atlas', () => {
  const A = designAtlas(HOLLIN_VALE), G = readGameworld(HOLLIN_VALE);

  it('lays every level a province of its own, none over another, the hub in the middle; the same world the same map', () => {
    expect(A.regions.map((r) => r.id).sort()).toEqual([...G.ids].sort());
    for (const a of A.regions) for (const b of A.regions) if (a.id < b.id) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${a.id} ${b.id}`).toBeGreaterThan((a.r + b.r) * 0.95);
    const hub = A.regions.find((r) => r.hub);
    expect(hub.id).toBe(G.hub);
    expect(hub.places.map((p) => p.kind)).toContain('walls');
    expect(JSON.stringify(designAtlas(HOLLIN_VALE))).toBe(JSON.stringify(A));
  });

  it('winds each level\'s trail through its stages, marks a climb, and draws every link as its kind between the trails\' ends', () => {
    for (const R of A.regions) expect(R.trail.stops.length).toBeGreaterThan(0);
    expect(A.roads.map((r) => [r.from, r.to, r.kind])).toEqual(G.links.map((l) => [l.from, l.to, l.kind ?? 'road']));
    for (const road of A.roads) {
      const from = A.regions.find((r) => r.id === road.from), to = A.regions.find((r) => r.id === road.to);
      expect(road.path[0]).toEqual(from.trail.path.at(-1));
      expect(road.path.at(-1)).toEqual(to.trail.path[0]);
    }
    // the hill fort's level stands its castle on heights; a wooded world grows its own kind of tree
    const fort = A.regions.find((r) => r.places.some((p) => p.kind === 'castle'));
    expect(fort.glyphs.some((g) => g.kind === 'peak')).toBe(true);
    expect(A.regions.flatMap((r) => r.glyphs.map((g) => g.kind))).toContain('conifer');
  });

  it('a look is paint only: every look lays the same provinces, trails and names; a world with no cube takes its kit\'s colours', () => {
    const provinces = (h) => [...h.matchAll(/class="prov" data-level="([^"]+)" points="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
    const pages = ATLAS_LOOK_IDS.map((look) => gameworldAtlasHtml(HOLLIN_VALE, { look }));
    for (const h of pages) { expect(provinces(h)).toEqual(provinces(pages[0])); for (const R of A.regions) expect(h).toContain(`>${R.name}</text>`); }
    expect(new Set(pages.map((h) => h.match(/--paper:([^;]+);/)[1])).size).toBe(ATLAS_LOOK_IDS.length);
    expect(() => gameworldAtlasHtml(HOLLIN_VALE, { look: 'sepia' })).toThrow(/look is one of/);
    expect(MEADOWMARK.style.geocube).toBeUndefined();
    expect(designAtlas(MEADOWMARK).colours.grass).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('depicts the same map as kinds of map: an illustrated atlas, and a tactical one read as ground and control measures', () => {
    expect(Object.keys(ATLAS_DEPICTIONS)).toEqual(['illustrated', 'tactical']);
    for (const id of ATLAS_LOOK_IDS) expect(Object.keys(ATLAS_DEPICTIONS)).toContain(ATLAS_LOOKS[id].depiction);
    const T = gameworldAtlasHtml(HOLLIN_VALE, { look: 'ops' }), stops = A.regions.reduce((n, r) => n + r.trail.stops.length, 0);
    // every level an AO, every stage a checkpoint numbered across the game, a phase line where each road crosses
    for (const R of A.regions) expect(T).toContain(`AO ${R.name.replace(/^the\s+/i, '').toUpperCase()}`);
    expect([...T.matchAll(/class="cp"[^>]*>(\d+)</g)].map((m) => +m[1])).toEqual(Array.from({ length: stops }, (_, i) => i + 1));
    expect(T.match(/>PL [A-Z]+</g)).toHaveLength(A.roads.length);
    // the hub is the base, the deepest level the objective; a gate a passage point; the relief contoured with heights
    expect(T).toContain(`BASE ${A.regions.find((r) => r.hub).name.toUpperCase()}`);
    const deepest = [...A.regions].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1)).at(-1);
    expect(T).toContain(`OBJ ${deepest.name.replace(/^the\s+/i, '').toUpperCase()}`);
    expect(T).toContain('>PP<');
    expect(T).toMatch(/class="ht"[^>]*>\d+</);
  });

  it('a world with no links is walked in an arc, each level its own province', () => {
    const L = designAtlas({ ...MEADOWMARK, links: [] });
    expect(L.roads).toEqual([]);
    expect(L.regions).toHaveLength(Object.keys(MEADOWMARK.levels).length);
  });
});
