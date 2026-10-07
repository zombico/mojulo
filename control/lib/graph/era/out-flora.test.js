import { describe, it, expect } from 'vitest';
import { FLORA_FORMS, FLORA_FORM_IDS, FLORA_PARTS, FLORA_SKINS, FLORA_LEVELS, BARK_DIALS, BARK_PATTERNS, GRASS_PRIMITIVES, JUNGLE_COMPOSITION, designFlora, floraLaws, floraSkin, floraScatter } from './out-flora.js';
import { SWATCHES } from './style/swatches.js';
import { BARKS } from '../vegetation/bark.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { outFloraHtml } from './out-flora-html.js';

describe('the flora index: plants as doodads', () => {
  it('every form and variant builds deterministically, in values on named parts', () => {
    for (const id of FLORA_FORM_IDS) for (const v of Object.keys(FLORA_FORMS[id].variants)) {
      const a = designFlora(id, v, 5), b = designFlora(id, v, 5);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.faces.length).toBeGreaterThan(0);
      for (const f of a.faces) { expect(FLORA_PARTS[f.part]).toBeTruthy(); expect(f.value).toBeGreaterThanOrEqual(0); expect(f.value).toBeLessThanOrEqual(1); }
    }
  });
  it('a dial rolls inside its variant\'s rails, and a trail\'s ask pins it', () => {
    for (let s = 1; s < 30; s++) { const { dials } = designFlora('broccoli', 'pads', s); expect(dials.tiers).toBeGreaterThanOrEqual(3); expect(dials.tiers).toBeLessThanOrEqual(4); }
    expect(designFlora('mushroom', 'parasol', 3, { over: { height: 6 } }).dials.height).toBe(6);
  });
  it('a far doodad is cheaper than a near one', () => {
    for (const id of FLORA_FORM_IDS) for (const v of Object.keys(FLORA_FORMS[id].variants)) {
      const near = designFlora(id, v, 9, { level: 'near' }).faces.length, far = designFlora(id, v, 9, { level: 'far' }).faces.length;
      expect(far).toBeLessThanOrEqual(near);
      expect(far).toBeLessThanOrEqual(FLORA_LEVELS.far.budget);
    }
  });
  it('porosity depicts density: a sparser crown drops masses', () => {
    const dense = designFlora('broccoli', 'broccoli', 4, { level: 'near', over: { porosity: 0, masses: 8 } });
    const airy = designFlora('broccoli', 'broccoli', 4, { level: 'near', over: { porosity: 0.35, masses: 8 } });
    expect(airy.faces.filter((f) => f.part === 'core').length).toBeGreaterThan(0);
    expect(airy.elements.length).toBeLessThanOrEqual(dense.elements.length);
  });
  it('every kit skin points each part at a ramp the kit has', () => {
    for (const k of Object.keys(FLORA_SKINS)) for (const [part, role] of Object.entries(floraSkin(k))) expect(SWATCHES[k].land[role], `${k} ${part}→${role}`).toBeTruthy();
  });
  it('bark dials read every fracture preset as one of the stylized patterns', () => {
    expect(Object.keys(BARK_DIALS)).toEqual(Object.keys(BARKS));
    for (const d of Object.values(BARK_DIALS)) expect(BARK_PATTERNS[d.pattern]).toBeTruthy();
    expect(BARK_DIALS.beech.pattern).toBe('ringed'); expect(BARK_DIALS.oak.pattern).toBe('ridged'); expect(BARK_DIALS.pine.pattern).toBe('plated'); expect(BARK_DIALS.chestnut.pattern).toBe('spiral');
  });
  it('the jungle composition reads its numbers off the card, and each doodad it names exists', () => {
    expect(JUNGLE_COMPOSITION.rings).toBe(JUNGLE_MGS3.rings);
    expect(JUNGLE_COMPOSITION.layers.find((l) => l.role === 'canopy').cover).toBe(JUNGLE_MGS3.canopy.cover);
    for (const L of JUNGLE_COMPOSITION.layers) if (L.as) expect(FLORA_FORMS[L.as.form].variants[L.as.variant]).toBeTruthy();
    for (const L of JUNGLE_COMPOSITION.layers) if (L.grass) expect(GRASS_PRIMITIVES[L.grass]).toBeTruthy();
  });
  it('a scatter clumps clear of the trail and thins by ring', () => {
    const pts = floraScatter(JUNGLE_COMPOSITION.plan, 8, { rings: JUNGLE_COMPOSITION.rings });
    for (const p of pts) expect(Math.abs(p.x)).toBeGreaterThan(1.6);
    const under = pts.filter((p) => p.species === 'understory');
    expect(under.filter((p) => p.ring === 'far').length).toBe(0);
    expect(under.filter((p) => p.ring === 'near').length).toBeGreaterThan(under.filter((p) => p.ring === 'mid').length * 0.5);
    expect(JSON.stringify(floraScatter(JUNGLE_COMPOSITION.plan, 8))).toBe(JSON.stringify(floraScatter(JUNGLE_COMPOSITION.plan, 8)));
  });
  it('the board draws, and a sample of every form keeps the read laws', () => {
    for (const id of FLORA_FORM_IDS) for (const v of Object.keys(FLORA_FORMS[id].variants)) expect(floraLaws(designFlora(id, v, 8))).toEqual([]);
    const h = outFloraHtml({ seed: 8 });
    expect(h).toContain('OUTDOOR FLORA INDEX');
    expect(h).toBe(outFloraHtml({ seed: 8 }));
  });
});
