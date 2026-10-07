import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planFarmstead, assembleFarmsteadScene, FARM_CULTURES } from './farmstead.js';
import { SUMER_FARM_ASSETS } from './assets/sumer-farm.js';
import { placeAsset, beam } from './assets/kit.js';
import { solidFaces } from './assets/solids.js';
import { PATTERNS } from './patterns.js';
import { checkRecord } from './record.js';
import { SUMER_RECORD } from './record/sumer.js';
import { SUMER_FARM_RECORD } from './record/sumer-farm.js';
import { SCENE_LIGHT } from './historic-city.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
const F = FARM_CULTURES.sumer;

describe('historic farmstead: the Sumerian countryside', () => {
  const p = planFarmstead({ seed: 7 });
  it('is deterministic, and a different seed is a different estate', () => {
    expect(hash(planFarmstead({ seed: 7 }))).toBe(hash(p));
    expect(hash(planFarmstead({ seed: 8 }))).not.toBe(hash(p));
  });
  it('a harvest has standing barley, stubble with stooks, a cart and an ard breaking fallow; sowing has the seeder plough and no harvest', () => {
    const assets = (q) => new Set(q.slots.map((s) => s.asset));
    expect(p.stats.fields).toEqual(expect.arrayContaining(['ripe', 'stubble', 'fallow']));
    for (const a of ['harvest-edge', 'stook', 'farm-cart', 'plough']) expect(assets(p), a).toContain(a);
    expect(p.slots.find((s) => s.asset === 'plough').seeder).toBe(false);
    const q = planFarmstead({ seed: 7, season: 'sowing' });
    expect(q.stats.fields).not.toContain('ripe');
    expect(assets(q)).not.toContain('harvest-edge');
    expect(q.slots.find((s) => s.asset === 'plough').seeder).toBe(true);
  });
  it('has the farmstead: house, storehouse, stable, byre, fold, threshing floor, tool shed, wagon, a shaduf, a sluice at every channel head', () => {
    const n = (a) => p.slots.filter((s) => s.asset === a).length;
    for (const a of ['farmhouse', 'storehouse', 'stable', 'reed-byre', 'sheepfold', 'threshing-floor', 'tool-shed', 'wagon', 'shaduf']) expect(n(a), a).toBe(1);
    expect(n('sluice')).toBe(F.fields.channels);
  });
  it('the buildings stand apart, on the frame', () => {
    const big = p.slots.filter((s) => ['farmhouse', 'storehouse', 'stable', 'reed-byre', 'sheepfold', 'threshing-floor', 'tool-shed', 'wagon'].includes(s.asset));
    for (let i = 0; i < big.length; i++) {
      const r = big[i].rect;
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= p.frame.w && r.y + r.d <= p.frame.d, big[i].asset).toBe(true);
      for (let j = i + 1; j < big.length; j++) expect(overlaps(r, big[j].rect), `${big[i].asset} × ${big[j].asset}`).toBe(false);
    }
  });
  it('holds tools and buildings only: no people, no beasts', () => {
    expect(p.boxes.filter((b) => /^(figure|beast)/.test(b.kind))).toEqual([]);
  });
  it('every farm asset is built from shared patterns and stays on its slot (only a front reach may leave it)', () => {
    for (const A of Object.values(SUMER_FARM_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 0, y: 0, w, d }, facing: 'n' }, { palette: F.palette, culture: F.culture, rng: () => 0.5 });
      expect(boxes.length, A.id).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.x, `${A.id} ${b.kind}`).toBeGreaterThanOrEqual(-0.35); expect(b.x + b.w, `${A.id} ${b.kind}`).toBeLessThanOrEqual(w + 0.35);   // roof eaves and parapet lips
        expect(b.y + b.d, `${A.id} ${b.kind}`).toBeLessThanOrEqual(d + 0.35);
      }
    }
  });
  it('assembles a scene with the eye-level views', () => {
    const s = assembleFarmsteadScene({ seed: 7, view: 'yard' });
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.cameras[0].name).toBe('yard');
    for (const v of ['aerial', 'threshing', 'field', 'plough']) expect(s.cameras.map((c) => c.name)).toContain(v);
  });
  it('the record checks clean with the town\'s, every gap reported', () => {
    const findings = checkRecord([...SUMER_RECORD, ...SUMER_FARM_RECORD]);
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
    const farmGaps = findings.filter((f) => f.level === 'warn' && SUMER_FARM_RECORD.some((e) => e.id === f.id)).map((f) => f.id).sort();
    expect(farmGaps).toEqual(SUMER_FARM_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
  });
});

describe('historic solids: beams and sealing', () => {
  it('a beam turns with its slot and rides up with it', () => {
    // facing east the local frame turns: local (u, v) lands at (rect.x + D − v, rect.y + u), D = rect.w
    const A = { id: 't', build: () => [beam('pole', [0, 0, 0], [3, 1, 1], 0.1, '#777777')] };
    const { boxes: [b] } = placeAsset(A, { asset: 't', rect: { x: 10, y: 20, w: 2, d: 4 }, facing: 'e', z: 1 }, {});
    expect(b.a).toEqual([12, 20, 1]); expect(b.b).toEqual([11, 23, 2]);
  });
  it('a long thin face grows by a hair at its ends, not by a share of its length', () => {
    const faces = solidFaces({ kind: 'roof', solid: 'frustum', x: 0, y: 0, w: 5, d: 0.08, z0: 0, z1: 0.08, top: { x: 0, y: 0, w: 5, d: 0.08 }, tint: '#888888' }, SCENE_LIGHT);
    const xs = faces.flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.min(...xs)).toBeGreaterThan(-0.02); expect(Math.max(...xs)).toBeLessThan(5.02);
  });
});
