import { describe, it, expect } from 'vitest';
import { planHistoricCity, assembleHistoricCityScene } from './historic-city.js';
import { placeAsset } from './assets/kit.js';
import { GIZA_ASSETS } from './assets/giza.js';
import { GIZA } from './cultures/giza.js';
import { PATTERNS } from './patterns.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

describe('historic city: Old Kingdom Giza', () => {
  it('every Giza asset is built from shared patterns and stays on its slot, panels included', () => {
    for (const A of Object.values(GIZA_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      for (const facing of ['n', 'e']) {
        const W = facing === 'n' ? w : d, D = facing === 'n' ? d : w;
        const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 10, y: 20, w: W, d: D }, facing, exposed: true }, { palette: GIZA.palette, culture: GIZA, rng: () => 0.5 });
        expect(boxes.length, A.id).toBeGreaterThan(0);
        for (const b of boxes) {
          const pts = b.pts || [[b.x, b.y], [b.x + b.w, b.y + b.d]];
          for (const [x, y] of pts) {
            expect(x, `${A.id} ${b.kind} ${facing}`).toBeGreaterThanOrEqual(10 - 0.06); expect(x, `${A.id} ${b.kind} ${facing}`).toBeLessThanOrEqual(10 + W + 0.06);
            expect(y, `${A.id} ${b.kind} ${facing}`).toBeGreaterThanOrEqual(20 - 0.06); expect(y, `${A.id} ${b.kind} ${facing}`).toBeLessThanOrEqual(20 + D + 0.06);
          }
        }
      }
    }
  });
  it('each complex runs down from the plateau: pyramid, mortuary temple, valley temple, east to west; the pyramids keep apart', () => {
    const p = planHistoricCity({ seed: 7, culture: 'giza' }), cx = p.stats.complexes;
    for (const [name, c] of Object.entries(cx)) {
      expect(c.rect.x + c.rect.w, name).toBeLessThanOrEqual(c.temple.x + 1e-6);
      expect(c.temple.x + c.temple.w, name).toBeLessThan(c.valley.x);
      expect(p.hAt(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.d / 2), name).toBeGreaterThan(40);   // up on the plateau
      expect(p.hAt(c.valley.x + c.valley.w / 2, c.valley.y + c.valley.d / 2), name).toBeLessThan(0.5);   // down in the valley
      expect(c.path[0][2] - c.path.at(-1)[2], name).toBeGreaterThan(40);   // the causeway climbs the escarpment
    }
    const rs = Object.values(cx).map((c) => c.rect);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(overlap(rs[i], rs[j])).toBe(false);
  });
  it('every slot is in the kit and stands on level ground; no two buildings overlap; the water lies below the land', () => {
    const p = planHistoricCity({ seed: 7, culture: 'giza' });
    for (const q of p.slots) {
      expect(GIZA_ASSETS[q.asset], q.asset).toBeTruthy();
      const r = q.rect, hs = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d], [r.x + r.w / 2, r.y + r.d / 2]].map(([x, y]) => p.hAt(x, y));
      expect(Math.max(...hs) - Math.min(...hs), `${q.asset} at ${Math.round(r.x)},${Math.round(r.y)}`).toBeLessThan(q.asset === 'gz-sphinx' ? 0.5 : 1.5);
      expect(Math.abs(q.z - p.hAt(r.x + r.w / 2, r.y + r.d / 2)), q.asset).toBeLessThan(0.01);
    }
    for (let i = 0; i < p.slots.length; i++) for (let j = i + 1; j < p.slots.length; j++) expect(overlap(p.slots[i].rect, p.slots[j].rect), `${p.slots[i].asset} / ${p.slots[j].asset}`).toBe(false);
    expect(p.grounds.filter((g) => g.kind === 'water').every((g) => g.z < -1)).toBe(true);
  });
  it('is an exhibit of the monuments: the pyramids and the Sphinx, no cemeteries, town or building sites', () => {
    const p = planHistoricCity({ seed: 7, culture: 'giza' }), n = (id) => p.slots.filter((q) => q.asset === id).length;
    expect(n('gz-pyramid')).toBe(3);
    expect(n('gz-sphinx')).toBe(1);
    expect(new Set(p.slots.map((q) => q.asset))).toEqual(new Set(Object.keys(GIZA_ASSETS)));
    expect(Object.keys(p.views)).toEqual(['valley', 'pyramid', 'harbour', 'summit']);
    expect(p.grounds.filter((g) => g.kind === 'lane')).toEqual([]);
  });
  it('the ground covers the land: every point is under a ground face, the escarpment or the water', () => {
    const p = planHistoricCity({ seed: 7, culture: 'giza' });
    const covers = [...p.grounds.filter((g) => g.kind === 'ground' || g.kind === 'water'), ...p.boxes.filter((b) => b.kind === 'escarpment')];
    const bare = [];
    for (let y = 3; y < p.frame.d; y += 10) for (let x = 3; x < p.frame.w; x += 10) if (!covers.some((g) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.d)) bare.push([x, y]);
    expect(bare).toEqual([]);
  });
  it('the pyramidion is plain limestone unless the gilded conjecture is asked for', () => {
    const tops = (opts) => planHistoricCity({ seed: 7, culture: 'giza', ...opts }).boxes.filter((b) => /^pyramidion/.test(b.kind));
    expect(tops({}).length).toBeGreaterThan(0);
    expect(tops({}).every((b) => b.kind === 'pyramidion')).toBe(true);
    expect(tops({ pyramidion: 'electrum' }).every((b) => b.kind === 'pyramidion-gilt' && b.tint === GIZA.palette.electrum)).toBe(true);
  });
  it('builds a scene, opening on any of its views', () => {
    for (const view of ['valley', 'pyramid', 'harbour', 'summit']) expect(assembleHistoricCityScene({ seed: 7, culture: 'giza', view, shade: false }).cameras[0].name).toBe(view);
  });
});
