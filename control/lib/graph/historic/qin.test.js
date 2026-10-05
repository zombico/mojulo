import { describe, it, expect } from 'vitest';
import { planHistoricCity, assembleHistoricCityScene, assetBlueprint } from './historic-city.js';
import { placeAsset } from './assets/kit.js';
import { QIN_ASSETS } from './assets/qin.js';
import { QIN } from './cultures/qin.js';
import { QIN_STYLE } from './style/qin.js';
import { QIN_RECORD } from './record/qin.js';
import { PATTERNS } from './patterns.js';

const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
const plan = planHistoricCity({ seed: 7, culture: 'qin' });

describe('historic city: Qin Xianyang', () => {
  it('every Qin asset is built from shared patterns and stays on its slot, panels and beams included', () => {
    for (const A of Object.values(QIN_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      for (const facing of ['n', 'e']) {
        const W = facing === 'n' ? w : d, D = facing === 'n' ? d : w;
        const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 10, y: 20, w: W, d: D }, facing, exposed: true }, { palette: QIN.palette, culture: QIN, rng: () => 0.5 });
        expect(boxes.length, A.id).toBeGreaterThan(0);
        for (const b of boxes) {
          const pts = b.pts || (b.solid === 'beam' ? [b.a, b.b] : [[b.x, b.y], [b.x + b.w, b.y + b.d]]);
          for (const [x, y] of pts) {
            expect(x, `${A.id} ${b.kind} ${facing}`).toBeGreaterThanOrEqual(10 - 0.06); expect(x, `${A.id} ${b.kind} ${facing}`).toBeLessThanOrEqual(10 + W + 0.06);
            expect(y, `${A.id} ${b.kind} ${facing}`).toBeGreaterThanOrEqual(20 - 0.06); expect(y, `${A.id} ${b.kind} ${facing}`).toBeLessThanOrEqual(20 + D + 0.06);
          }
        }
      }
    }
  });

  it('the kit reads its numbers from the style card: the batter, the column, the straight roof', () => {
    const K = QIN_STYLE.kit, at = (asset, size, o = {}) => placeAsset(QIN_ASSETS[asset], { asset, rect: { x: 0, y: 0, w: size[0], d: size[1] }, facing: 'n', ...o }, { palette: QIN.palette, culture: QIN, rng: () => 0.5 }).boxes;
    const hall = at('qn-hall', [60, 46]);
    // every earth face leans in 1 for every `batter` it rises
    for (const b of hall.filter((q) => q.kind === 'terrace')) {
      const ins = Math.max(b.top.x - b.x, b.top.y - b.y, b.x + b.w - b.top.x - b.top.w, b.y + b.d - b.top.y - b.top.d);
      expect((b.z1 - b.z0) / ins).toBeCloseTo(K.earth.batter, 5);
    }
    const cols = hall.filter((q) => q.kind === 'column' && q.w === K.column.d);
    expect(cols.length).toBeGreaterThanOrEqual(16);
    for (const c of cols) expect(c.z1 - c.z0).toBeCloseTo(K.column.h[1], 9);
    expect(hall.filter((q) => q.kind === 'plinth' && Math.abs(q.w - K.column.plinth) < 1e-9).length).toBe(cols.length);   // every full column on the card's base (gallery posts scale theirs down)
    // a roof is straight: its top is a ridge line, never a curved surface, and its pitch is the card's
    const roofs = hall.filter((q) => q.kind === 'roof' && q.solid === 'frustum');
    for (const r of roofs) {
      expect(Math.min(r.top.w, r.top.d)).toBe(0);
      expect(Math.atan((r.z1 - r.z0) / Math.min(r.w / 2, r.d / 2)) * 180 / Math.PI).toBeCloseTo(K.roof.pitch, 5);
    }
  });

  it('the palace on the axis: the que in its south wall, Palace No. 1 behind it, the avenue and the bridge in line', () => {
    const s = plan.stats;
    expect(s.que.x + s.que.w / 2).toBeCloseTo(s.axis, 6);
    expect(s.hall.x + s.hall.w / 2).toBeCloseTo(s.axis, 6);
    expect(s.hall.y + s.hall.d).toBeLessThan(s.que.y);
    const br = plan.slots.find((q) => q.asset === 'qn-bridge').rect;
    expect(br.x + br.w / 2).toBeCloseTo(s.axis, 6);
    expect(br.y).toBeLessThan(s.river.y0);
    expect(br.y + br.d).toBeGreaterThan(s.river.y1);
    // Epang is across the river, begun: a building site, not a palace
    expect(s.works.y).toBeGreaterThan(s.river.y1);
  });

  it('walled wards with gates; houses packed inside them, each on a lane; no two buildings overlap', () => {
    expect(plan.stats.wards).toBeGreaterThanOrEqual(10);
    expect(plan.stats.houses).toBeGreaterThan(80);
    expect(plan.slots.filter((q) => q.asset === 'qn-ward-gate').length).toBe(plan.stats.wards);
    expect(plan.slots.filter((q) => q.asset === 'qn-market').length).toBe(1);
    const built = plan.slots.filter((q) => !['qn-wall', 'qn-bridge'].includes(q.asset));
    for (let i = 0; i < built.length; i++) for (let j = i + 1; j < built.length; j++) expect(overlap(built[i].rect, built[j].rect), `${built[i].asset} / ${built[j].asset}`).toBe(false);
    const lanes = plan.grounds.filter((g) => g.kind === 'lane');
    const fronts = (r) => lanes.some((g) => g.x < r.x + r.w + 0.5 && g.x + g.w > r.x - 0.5 && g.y < r.y + r.d + 0.5 && g.y + g.d > r.y - 0.5);
    expect(plan.slots.filter((q) => q.asset === 'qn-house' && !fronts(q.rect))).toEqual([]);
    for (const q of plan.slots) expect(QIN_ASSETS[q.asset], q.asset).toBeTruthy();
  });

  it('builds only what the record has at 212 BCE: no outer town wall, no curved roof; the market labelled an analogue', () => {
    // no wall run longer than the palace's own: nothing encloses the whole town
    const walls = plan.slots.filter((q) => q.asset === 'qn-wall').map((q) => Math.max(q.rect.w, q.rect.d));
    expect(Math.max(...walls)).toBeLessThanOrEqual(plan.stats.palace.w);
    expect(QIN_RECORD.find((e) => e.id === 'xianyang-capital').notes).toMatch(/No outer city wall/);
    expect(QIN_ASSETS['qn-market'].notes.join(' ')).toMatch(/Han analogue/);
    // every roof in the town is a frustum whose top is a line (a hip or a gable), or a pent roof's flat ring
    for (const r of plan.boxes.filter((b) => (b.kind === 'roof' || b.kind === 'thatch') && b.solid === 'frustum')) expect(r.top).toBeTruthy();
  });

  it('stands the palace on the tableland and the wards on the plain, the axis climbing the bluff, the Wei braided', () => {
    const s = plan.stats, H = s.tableland.h;
    // every palace piece sits on the tableland; every ward piece on the plain below the bluff
    const inPal = (r) => r.x >= s.palace.x - 0.5 && r.x + r.w <= s.palace.x + s.palace.w + 0.5 && r.y + r.d <= s.palace.y + s.palace.d + 0.5;
    for (const q of plan.slots.filter((q) => inPal(q.rect))) expect(q.z, q.asset).toBe(H);
    for (const q of plan.slots.filter((q) => q.asset === 'qn-house' || q.asset === 'qn-ward-gate')) { expect(q.z).toBe(0); expect(q.rect.y).toBeGreaterThan(s.tableland.edge); }
    expect(Math.min(...plan.boxes.filter((b) => b.asset === 'qn-hall').map((b) => b.z0))).toBeGreaterThanOrEqual(H - 1e-9);
    // the causeway on the axis, from the que down to the east–west avenue
    const cw = plan.boxes.find((b) => b.kind === 'causeway');
    expect(cw.x + cw.w / 2).toBeCloseTo(s.axis, 6);
    expect([cw.y, cw.z1, cw.z0]).toEqual([s.tableland.edge, H, 0]);
    expect(cw.y).toBeGreaterThanOrEqual(s.que.y + s.que.d);
    // the bluff stands as cliff on the shared terrain mesher; the gullies cut it; the bars break the Wei's surface
    expect(s.terrain.cliffs).toBeGreaterThan(30);
    const cliffs = plan.boxes.filter((b) => b.kind === 'cliff');
    expect(Math.max(...cliffs.map((b) => b.z1 - b.z0))).toBeGreaterThanOrEqual(H);
    for (const q of [50, 530]) expect(plan.hAt(q, 150)).toBeGreaterThan(0), expect(plan.hAt(q, 150)).toBeLessThan(H);   // a gully floor, part way up
    const waterZ = -QIN.river.sink;
    expect(s.bars.length).toBe(QIN.river.bars);
    for (const b of s.bars) { expect(plan.hAt(b.cx, b.cy)).toBeGreaterThan(waterZ); expect(b.cy).toBeGreaterThan(s.river.y0); expect(b.cy).toBeLessThan(s.river.y1); expect(Math.abs(b.cx - s.axis)).toBeGreaterThan(14); }
    expect(plan.hAt(s.axis, (s.river.y0 + s.river.y1) / 2)).toBeLessThan(waterZ - 1);
    // the water carries the river look for the World page
    const water = plan.grounds.filter((g) => g.kind === 'water');
    expect(water.length).toBeGreaterThan(0);
    for (const g of water) expect(g.liquid.kind).toBe('river');
    // views stand on the ground they look from, never under it
    expect(plan.views.palace.eye[2]).toBeGreaterThan(H);
    expect(plan.views.gate.eye[2]).toBeGreaterThan(H * 0.8);
    // both terrain claims are in the record, marked unverified
    for (const id of ['xianyang-tableland', 'wei-braided']) expect(QIN_RECORD.find((e) => e.id === id).confidence).toBe('unverified');
    // the riverbed and the land beyond the frame are for the World only
    expect(plan.world.boxes.some((b) => b.kind === 'riverbed')).toBe(true);
    expect(plan.world.boxes.filter((b) => b.kind === 'horizon').length).toBeGreaterThan(100);
    expect(plan.boxes.some((b) => b.kind === 'horizon' || b.kind === 'riverbed')).toBe(false);
  });

  it('builds a scene with a camera for each of its views, opening on the one asked for, under a sky from its card', () => {
    const s = assembleHistoricCityScene({ seed: 7, culture: 'qin', view: 'ward' });   // one build: a whole town is ~68k faces
    expect(s.cameras[0].name).toBe('ward');
    expect(s.cameras.map((c) => c.name)).toEqual(expect.arrayContaining(['palace', 'gate', 'avenue', 'ward', 'market', 'bridge', 'works', 'bluff']));
    expect(s.sky).toEqual(QIN_STYLE.sky);
  }, 60000);

  it('draws each asset as a blueprint', () => {
    for (const id of Object.keys(QIN_ASSETS)) expect(assetBlueprint({ asset: id, culture: 'qin' })).toMatch(/^<svg/);
  });


});
