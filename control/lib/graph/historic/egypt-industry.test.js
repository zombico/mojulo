import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planFarmstead, assembleFarmsteadScene, FARM_CULTURES } from './farmstead.js';
import { planWorks, assembleWorksScene, WORKS_CULTURES } from './workshops.js';
import { EGYPT_FARM_ASSETS } from './assets/egypt-farm.js';
import { EGYPT_WORKS_ASSETS } from './assets/egypt-works.js';
import { placeAsset } from './assets/kit.js';
import { PATTERNS } from './patterns.js';
import { checkRecord } from './record.js';
import { EGYPT_INDUSTRY_RECORD } from './record/egypt-industry.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
const assets = (p) => new Set(p.slots.map((s) => s.asset));

/** Every asset of a kit is built from shared patterns and stays on its slot (only a front reach may leave it). */
function keepsToItsSlot(kit, C) {
  for (const A of Object.values(kit)) {
    for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
    const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
    for (const season of ['harvest', 'flood']) {
      const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 0, y: 0, w, d }, facing: 'n', season, seeder: season === 'harvest' }, { palette: C.palette, culture: C.culture, rng: () => 0.5 });
      expect(boxes.length, A.id).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.x, `${A.id} ${b.kind}`).toBeGreaterThanOrEqual(-0.35); expect(b.x + b.w, `${A.id} ${b.kind}`).toBeLessThanOrEqual(w + 0.35);
        expect(b.y + b.d, `${A.id} ${b.kind}`).toBeLessThanOrEqual(d + 0.35);
        if (b.solid === 'beam') expect(Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]), `${A.id} ${b.kind} has length`).toBeGreaterThan(0.01);
      }
    }
  }
}

describe('historic farmstead: the Egyptian countryside', () => {
  const p = planFarmstead({ seed: 7, culture: 'egypt' }), F = FARM_CULTURES.egypt;
  it('is deterministic, and a different seed is a different estate', () => {
    expect(hash(planFarmstead({ seed: 7, culture: 'egypt' }))).toBe(hash(p));
    expect(hash(planFarmstead({ seed: 8, culture: 'egypt' }))).not.toBe(hash(p));
  });
  it('builds the estate from its own pieces: the granary court, the scribes, the donkeys\' loads, no cart or wagon', () => {
    const a = assets(p);
    for (const id of ['eg-farmhouse', 'eg-silo-court', 'eg-cattle-shed', 'eg-stable', 'eg-fold', 'eg-threshing-floor', 'eg-tool-shed', 'eg-scribes-shade', 'eg-pillar-shaduf', 'eg-harvest-edge', 'eg-grain-packs', 'eg-vineyard', 'eg-apiary', 'eg-garden']) expect(a, id).toContain(id);
    for (const id of ['farm-cart', 'wagon', 'storehouse', 'plough']) expect(a, id).not.toContain(id);
    expect(p.slots.filter((s) => s.asset === 'eg-sluice').length).toBe(F.fields.channels);
  });
  it('reaps high (the cut straw stands), grows flax; sows with the ard; floods its basins in akhet', () => {
    expect(p.stats.fields).toEqual(expect.arrayContaining(['ripe', 'stubble', 'flax']));
    expect(p.boxes.some((b) => b.kind === 'stubble' && b.z1 > 0.3)).toBe(true);
    const sow = planFarmstead({ seed: 7, culture: 'egypt', season: 'sowing' });
    expect(sow.slots.find((s) => s.asset === 'eg-ard').seeder).toBe(true);
    const flood = planFarmstead({ seed: 7, culture: 'egypt', season: 'flood' });
    expect(flood.stats.fields.every((f) => f === 'flood')).toBe(true);
    expect(assets(flood)).not.toContain('eg-ard'); expect(assets(flood)).not.toContain('eg-harvest-edge');
    expect(flood.slots.find((s) => s.asset === 'eg-silo-court').season).toBe('flood');
    expect(Object.keys(flood.views)).toContain('basin');
  });
  it('the buildings and the garden pieces stand apart, on the frame', () => {
    const big = p.slots.filter((s) => !['eg-sluice', 'stook', 'eg-harvest-edge', 'eg-grain-packs'].includes(s.asset));
    for (let i = 0; i < big.length; i++) {
      const r = big[i].rect;
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= p.frame.w && r.y + r.d <= p.frame.d, big[i].asset).toBe(true);
      for (let j = i + 1; j < big.length; j++) expect(overlaps(r, big[j].rect), `${big[i].asset} × ${big[j].asset}`).toBe(false);
    }
  });
  it('holds tools and buildings only: no people, no beasts', () => {
    expect(p.boxes.filter((b) => /^(figure|beast)/.test(b.kind))).toEqual([]);
  });
  it('every farm asset is built from shared patterns and stays on its slot', () => keepsToItsSlot(EGYPT_FARM_ASSETS, F));
  it('assembles a scene with the eye-level views', () => {
    const s = assembleFarmsteadScene({ seed: 7, culture: 'egypt', view: 'field' });
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.cameras[0].name).toBe('field');
  });
});

describe('historic works: how New Kingdom Egypt cut its stone and made its tools', () => {
  const p = planWorks({ seed: 7, culture: 'egypt' }), C = WORKS_CULTURES.egypt;
  it('is deterministic, and a different seed is a different layout', () => {
    expect(hash(planWorks({ seed: 7, culture: 'egypt' }))).toBe(hash(p));
    expect(hash(planWorks({ seed: 8, culture: 'egypt' }))).not.toBe(hash(p));
  });
  it('has every Egyptian works asset, the Sumerian brick pieces in Nile mud, and no brick kiln', () => {
    const a = assets(p);
    for (const id of [...Object.keys(EGYPT_WORKS_ASSETS), 'clay-pit', 'clay-mixing', 'brick-field', 'brick-hacks', 'charcoal-clamp']) expect(a, id).toContain(id);
    for (const id of ['brick-kiln', 'bitumen-works', 'copper-workshop', 'wheelwright']) expect(a, id).not.toContain(id);
  });
  it('the quarry is at the east end by the water, the sledges between it and the quay', () => {
    const at = (id) => p.slots.filter((s) => s.asset === id).map((s) => s.rect);
    const [q] = at('eg-quarry'), [quay] = at('eg-stone-quay');
    expect(q.x + q.w).toBeGreaterThan(p.frame.w - 10);
    for (const s of at('eg-stone-sledge')) { expect(s.x).toBeGreaterThan(quay.x + quay.w - 4); expect(s.x + s.w).toBeLessThan(q.x); }
    expect(p.slots.find((s) => s.asset === 'eg-stone-barge').z).toBeLessThan(0);
  });
  it('the works stand apart, on the frame, the clay pit sunk', () => {
    const r = p.slots.map((s) => s.rect);
    for (let i = 0; i < r.length; i++) {
      expect(r[i].x >= 0 && r[i].y >= 0 && r[i].x + r[i].w <= p.frame.w && r[i].y + r[i].d <= p.frame.d, p.slots[i].asset).toBe(true);
      for (let j = i + 1; j < r.length; j++) expect(overlaps(r[i], r[j]), `${p.slots[i].asset} × ${p.slots[j].asset}`).toBe(false);
    }
    const pit = p.slots.find((s) => s.asset === 'clay-pit').rect;
    expect(p.grounds.filter((g) => !g.poly && g.z >= 0 && g.kind !== 'water' && overlaps(g, pit)).map((g) => g.kind)).toEqual([]);
  });
  it('holds tools and workshops only: no people, no beasts', () => {
    expect(p.boxes.filter((b) => /^(figure|beast)/.test(b.kind))).toEqual([]);
  });
  it('every works asset is built from shared patterns and stays on its slot', () => keepsToItsSlot(EGYPT_WORKS_ASSETS, C));
  it('assembles a scene with the eye-level views of each kind of making', () => {
    const s = assembleWorksScene({ seed: 7, culture: 'egypt', view: 'quarry' });
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.cameras[0].name).toBe('quarry');
    for (const v of ['aerial', 'haul', 'masons', 'foundry', 'quay', 'boatyard', 'glass', 'chariots', 'brickyard', 'potters']) expect(s.cameras.map((c) => c.name)).toContain(v);
  });
});

describe('historic record: Egypt\'s countryside and works', () => {
  it('checks clean, every gap reported', () => {
    const findings = checkRecord(EGYPT_INDUSTRY_RECORD);
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
    expect(findings.filter((f) => f.level === 'warn').map((f) => f.id).sort()).toEqual(EGYPT_INDUSTRY_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
  });
  it('keeps the newer tools to their period: the pot bellows, glass, the upright loom and the chariot are New Kingdom or near it', () => {
    const from = (id) => EGYPT_INDUSTRY_RECORD.find((e) => e.id === id)[EGYPT_INDUSTRY_RECORD.find((e) => e.id === id).kind === 'type' ? 'built' : 'attested'].from;
    for (const id of ['eg-pot-bellows', 'eg-glassmaking', 'eg-upright-loom', 'eg-chariot', 'eg-shaduf']) expect(from(id), id).toBeGreaterThanOrEqual(-1600);
  });
});
