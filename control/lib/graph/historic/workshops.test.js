import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planWorks, assembleWorksScene, WORKS_CULTURES } from './workshops.js';
import { SUMER_WORKS_ASSETS } from './assets/sumer-works.js';
import { placeAsset } from './assets/kit.js';
import { solidFaces } from './assets/solids.js';
import { PATTERNS } from './patterns.js';
import { checkRecord } from './record.js';
import { SUMER_RECORD } from './record/sumer.js';
import { SUMER_FARM_RECORD } from './record/sumer-farm.js';
import { SUMER_WORKS_RECORD } from './record/sumer-works.js';
import { SCENE_LIGHT } from './historic-city.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
const C = WORKS_CULTURES.sumer;

describe('historic works: how Sumer made its tools and its building stuff', () => {
  const p = planWorks({ seed: 7 });
  it('is deterministic, and a different seed is a different layout', () => {
    expect(hash(planWorks({ seed: 7 }))).toBe(hash(p));
    expect(hash(planWorks({ seed: 8 }))).not.toBe(hash(p));
  });
  it('has every works asset, with the town\'s pottery kilns and reed boats', () => {
    const used = new Set(p.slots.map((s) => s.asset));
    for (const id of [...Object.keys(SUMER_WORKS_ASSETS), 'pottery-kiln', 'reed-boat']) expect(used, id).toContain(id);
    expect(p.slots.filter((s) => s.asset === 'charcoal-clamp').map((s) => !!s.opened).sort()).toEqual([false, true]);
  });
  it('the works stand apart, on the frame', () => {
    const r = p.slots.map((s) => s.rect);
    for (let i = 0; i < r.length; i++) {
      expect(r[i].x >= 0 && r[i].y >= 0 && r[i].x + r[i].w <= p.frame.w && r[i].y + r[i].d <= p.frame.d, p.slots[i].asset).toBe(true);
      for (let j = i + 1; j < r.length; j++) expect(overlaps(r[i], r[j]), `${p.slots[i].asset} × ${p.slots[j].asset}`).toBe(false);
    }
  });
  it('the clay pit is sunk: no ground at the plain\'s level covers it', () => {
    const pit = p.slots.find((s) => s.asset === 'clay-pit').rect;
    expect(pit.x % 4).toBe(0); expect(pit.w % 4).toBe(0);   // on the base ground's 4 m columns
    const over = p.grounds.filter((g) => !g.poly && g.z >= 0 && g.kind !== 'water' && overlaps(g, pit));
    expect(over.map((g) => g.kind)).toEqual([]);
    expect(p.grounds.some((g) => g.kind === 'pit-floor' && g.z < -1)).toBe(true);
  });
  it('holds tools and workshops only: no people, no beasts', () => {
    expect(p.boxes.filter((b) => /^(figure|beast)/.test(b.kind))).toEqual([]);
  });
  it('every works asset is built from shared patterns and stays on its slot (only a front reach may leave it)', () => {
    for (const A of Object.values(SUMER_WORKS_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      for (const opened of [false, true]) {
        const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 0, y: 0, w, d }, facing: 'n', opened }, { palette: C.palette, culture: C.culture, rng: () => 0.5 });
        expect(boxes.length, A.id).toBeGreaterThan(0);
        for (const b of boxes) {
          expect(b.x, `${A.id} ${b.kind}`).toBeGreaterThanOrEqual(-0.35); expect(b.x + b.w, `${A.id} ${b.kind}`).toBeLessThanOrEqual(w + 0.35);
          expect(b.y + b.d, `${A.id} ${b.kind}`).toBeLessThanOrEqual(d + 0.35);
          if (b.solid === 'beam') expect(Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]), `${A.id} ${b.kind} has length`).toBeGreaterThan(0.01);
        }
      }
    }
  });
  it('assembles a scene with the eye-level views of each kind of making', () => {
    const s = assembleWorksScene({ seed: 7, view: 'forge' });
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.cameras[0].name).toBe('forge');
    for (const v of ['aerial', 'brickyard', 'potters', 'landing', 'clay-pit', 'wheelwright']) expect(s.cameras.map((c) => c.name)).toContain(v);
  });
  it('the record checks clean with the town\'s and the farm\'s, every gap reported', () => {
    const findings = checkRecord([...SUMER_RECORD, ...SUMER_FARM_RECORD, ...SUMER_WORKS_RECORD]);
    expect(findings.filter((f) => f.level === 'error')).toEqual([]);
    const gaps = findings.filter((f) => f.level === 'warn' && SUMER_WORKS_RECORD.some((e) => e.id === f.id)).map((f) => f.id).sort();
    expect(gaps).toEqual(SUMER_WORKS_RECORD.filter((e) => e.confidence === 'unverified').map((e) => e.id).sort());
  });
});

describe('historic solids: panels in a slot, undersides', () => {
  it('a panel turns with its slot, its outward side too, and rides up with it', () => {
    const A = { id: 't', build: () => [{ kind: 'p', solid: 'panel', pts: [[0, 0, 0], [1, 0, 0], [1, 1, -1]], out: [0, 1, 0.5], x: 0, y: 0, w: 1, d: 1, z0: -1, z1: 0 }] };
    // facing east: local (u, v) lands at (rect.x + D − v, rect.y + u), D = rect.w; +y turns to −x
    const { boxes: [b] } = placeAsset(A, { asset: 't', rect: { x: 10, y: 20, w: 2, d: 4 }, facing: 'e', z: 1 }, {});
    expect(b.pts).toEqual([[12, 20, 1], [12, 21, 1], [11, 21, 0]]);
    expect(b.out).toEqual([-1, 0, 0.5]);
  });
  it('a frustum draws its underside only when asked (a mat roof seen from under it)', () => {
    const m = { kind: 'roof', solid: 'frustum', x: 0, y: 0, w: 2, d: 0.06, z0: 2, z1: 2.3, top: { x: 0, y: 1.5, w: 2, d: 0.06 }, tint: '#c8ad62' };
    const down = (fs) => fs.filter((f) => f.corners.every((c) => Math.abs(c[2] - 2) < 0.02)).length;
    expect(down(solidFaces(m, SCENE_LIGHT))).toBe(0);
    expect(down(solidFaces({ ...m, underside: true }, SCENE_LIGHT))).toBe(1);
  });
});
