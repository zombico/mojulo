import { describe, it, expect } from 'vitest';
import { planHistoricCity, assembleHistoricCityScene, historicLight, SCENE_LIGHT } from './historic-city.js';
import { placeAsset } from './assets/kit.js';
import { LINDOS_ASSETS } from './assets/lindos.js';
import { LINDOS } from './cultures/lindos.js';
import { HISTORIC_STYLES } from './style/index.js';
import { PATTERNS } from './patterns.js';
import { litFactor } from '../polygonizer/vexar.js';
import { deriveSky } from '../polygonizer/painted-landscape.js';

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const value = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const scale = (c, f) => c.map((v) => v * f);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const UP = litFactor([0, 0, 1], SCENE_LIGHT);
const toSun = (() => { const d = SCENE_LIGHT.dir, h = Math.hypot(d[0], d[1]); return [-d[0] / h, -d[1] / h]; })();

const plan = planHistoricCity({ culture: 'lindos', seed: 7 });
const S = HISTORIC_STYLES.lindos, P = LINDOS.palette;

describe('historic city: Hellenistic Lindos — the kit', () => {
  it('every asset is built from shared patterns and stays on its slot', () => {
    for (const A of Object.values(LINDOS_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      for (const facing of ['n', 'e']) {
        const W = facing === 'n' ? w : d, D = facing === 'n' ? d : w;
        const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 10, y: 20, w: W, d: D }, facing, exposed: true, hearth: true }, { palette: P, culture: LINDOS, rng: () => 0.5 });
        expect(boxes.length, A.id).toBeGreaterThan(0);
        // eaves and cornices may reach past the walls by their overhang; nothing else leaves the lot
        for (const b of boxes) for (const [x, y] of b.pts || [[b.x, b.y], [b.x + b.w, b.y + b.d]]) {
          expect(x, `${A.id} ${b.kind}`).toBeGreaterThanOrEqual(10 - 1.2); expect(x, `${A.id} ${b.kind}`).toBeLessThanOrEqual(10 + W + 1.2);
          expect(y, `${A.id} ${b.kind}`).toBeGreaterThanOrEqual(20 - 1.2); expect(y, `${A.id} ${b.kind}`).toBeLessThanOrEqual(20 + D + 1.2);
        }
      }
    }
  });
  it('Athena\'s altar never burns; a house with a hearth and a kiln do', () => {
    const lit = (id, slot = {}) => placeAsset(LINDOS_ASSETS[id], { asset: id, rect: { x: 0, y: 0, w: 12, d: 12 }, facing: 'n', ...slot }, { palette: P, culture: LINDOS, rng: () => 0.5 }).boxes.some((b) => b.kind === 'flame');
    expect(lit('ln-altar')).toBe(false);
    expect(lit('ln-house', { hearth: true })).toBe(true);
    expect(lit('ln-house', { hearth: false })).toBe(false);
    expect(lit('ln-kiln')).toBe(true);
  });
  it('the temple keeps the record\'s plan: four columns at each end, ~22 × 8 m on its stylobate', () => {
    const { boxes } = placeAsset(LINDOS_ASSETS['ln-temple'], { asset: 'ln-temple', rect: { x: 0, y: 0, w: 7.75 + 2 * 0.84, d: 21.65 + 2 * 0.84 }, facing: 'n' }, { palette: P, culture: LINDOS, rng: () => 0.5 });
    expect(boxes.filter((b) => b.kind === 'column').length).toBe(8);
    const top = boxes.filter((b) => b.kind === 'crepis').sort((a, b) => b.z1 - a.z1)[0];
    expect(top.w).toBeCloseTo(7.75, 1);
    expect(top.d).toBeCloseTo(21.65, 1);
  });
});

describe('historic city: Hellenistic Lindos — the plan', () => {
  it('every slot is in the kit; the built ones never overlap; every house stands on one level, as its slot says', () => {
    for (const q of plan.slots) expect(LINDOS_ASSETS[q.asset], q.asset).toBeTruthy();
    const built = plan.slots.filter((q) => !['ln-trireme', 'ln-boat', 'ln-steps', 'ln-stair', 'ln-statue', 'ln-ship-relief', 'ln-altar'].includes(q.asset));
    for (let i = 0; i < built.length; i++) for (let j = i + 1; j < built.length; j++) expect(overlap(built[i].rect, built[j].rect), `${built[i].asset} / ${built[j].asset}`).toBe(false);
    const houses = plan.slots.filter((q) => q.asset === 'ln-house');
    expect(houses.length).toBeGreaterThan(60);
    for (const q of houses) {
      const r = q.rect, hs = [[r.x + 0.1, r.y + 0.1], [r.x + r.w - 0.1, r.y + 0.1], [r.x + 0.1, r.y + r.d - 0.1], [r.x + r.w - 0.1, r.y + r.d - 0.1]].map(([x, y]) => plan.hAt(x, y));
      for (const h of hs) expect(Math.abs(h - q.z), `house at ${Math.round(r.x)},${Math.round(r.y)}`).toBeLessThan(0.01);
    }
  });
  it('the temple stands at the edge of a sheer cliff: within 15 m of the summit\'s edge, the ground beyond it 80 m lower', () => {
    const t = plan.temple, cx = t.x + t.w / 2, cy = t.y + t.d;
    let drop = 0;
    for (let d = 1; d < 20; d++) drop = Math.max(drop, plan.hAt(cx, cy) - plan.hAt(cx, cy + d));
    expect(drop).toBeGreaterThan(80);
    expect(plan.hAt(cx, cy)).toBe(LINDOS.site.upper);
  });
  it('the rock is weathered: banded in beds, its faces many and upright, its foot in the sea', () => {
    const faces = plan.boxes.filter((b) => b.kind === 'cliff' && b.skin === null);
    expect(faces.length).toBeGreaterThan(500);
    expect(new Set(faces.map((b) => b.tint)).size).toBeGreaterThan(6);   // the beds' tones
    expect(faces.some((b) => b.z0 < 0 && b.z1 > 40)).toBe(false);          // sliced at the bed planes: no face spans the cliff
    expect(faces.some((b) => b.z0 < 0)).toBe(true);
  });
  it('is deterministic', () => {
    const again = planHistoricCity({ culture: 'lindos', seed: 7 });
    expect(JSON.stringify(again.slots)).toBe(JSON.stringify(plan.slots));
    expect(again.boxes.length).toBe(plan.boxes.length);
  });
  it('fire is opt-in: the plan hands over its hearths and kilns only when asked', () => {
    expect(plan.fireSources).toBeUndefined();
    const lit = planHistoricCity({ culture: 'lindos', seed: 7, fire: true });
    expect(lit.fireSources.length).toBeGreaterThan(5);
    expect(new Set(lit.fireSources.map((f) => f.kind))).toEqual(new Set(['brazier', 'campfire']));
  });
});

describe('Lindos — the style card\'s principles, measured', () => {
  const { shade } = historicLight(plan);
  it('principle 1 — hard Aegean sun: stucco > house plaster > sunlit rock > a cliff turned from the sun (cool, never black)', () => {
    const lee = plan.boxes.filter((b) => b.kind === 'cliff' && b.skin === null && b.out[0] * toSun[0] + b.out[1] * toSun[1] < -0.3);
    expect(lee.length).toBeGreaterThan(50);
    const V = {
      stucco: value(scale(rgbOf(P.stucco), UP)),
      rock: value(scale(rgbOf(P.rock), UP)),
      plaster: value(scale(rgbOf(P.plaster), UP)),
      cliff: mean(lee.map((b) => value(scale(rgbOf(b.tint), litFactor([b.out[0], b.out[1], b.out[2]], SCENE_LIGHT))))),
    };
    for (let i = 0; i + 1 < S.values.length; i++) expect(V[S.values[i]], `${S.values[i]} > ${S.values[i + 1]}`).toBeGreaterThan(V[S.values[i + 1]]);
    expect(V.cliff).toBeGreaterThan(V.rock * 0.4);
  });
  it('principle 2 — the rock holds its own shade: the sea at the foot of the cliffs turned from the sun lies in it; open water in sun', () => {
    const foot = plan.boxes.filter((b) => b.kind === 'cliff' && b.skin === null && b.z0 < 0 && b.out[0] * toSun[0] + b.out[1] * toSun[1] < -0.3);
    expect(foot.length).toBeGreaterThan(10);
    const samples = foot.map((b) => { const c = b.pts.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3], [0, 0]), h = Math.hypot(b.out[0], b.out[1]) || 1; return [c[0] + (b.out[0] / h) * 8, c[1] + (b.out[1] / h) * 8]; }).filter(([x, y]) => plan.isSea(x, y));
    expect(samples.length).toBeGreaterThan(5);
    expect(mean(samples.map(([x, y]) => (shade.sun(x, y) > 0.5 ? 1 : 0)))).toBeGreaterThanOrEqual(S.sea.footShade);
    const open = [];
    for (let x = 5; x < plan.frame.w; x += 10) for (let y = 5; y < plan.frame.d; y += 10) {
      let far = plan.isSea(x, y);
      for (let a = 0; far && a < 16; a++) for (const r of [S.sea.open * 0.5, S.sea.open]) if (!plan.isSea(x + r * Math.cos(a * 0.3927), y + r * Math.sin(a * 0.3927))) far = false;
      if (far) open.push(shade.sun(x, y));
    }
    if (open.length) expect(mean(open)).toBeLessThanOrEqual(S.sea.openShade);
  });
  it('principle 3 — the climb rises station by station, and nothing built stands higher than the goddess', () => {
    const z = (v) => plan.views[v].eye[2];
    const temple = plan.slots.find((q) => q.asset === 'ln-temple');
    const stations = [z('bay'), z('town'), z('climb'), z('stoa'), temple.z];
    for (let i = 0; i + 1 < stations.length; i++) expect(stations[i + 1], `station ${i + 1}`).toBeGreaterThan(stations[i]);
    for (const q of plan.slots) expect(q.z ?? 0, q.asset).toBeLessThanOrEqual(temple.z);
  });
  it('principle 4 — a terraced hillside: every terrace wall at most a storey; no cliff in the town', () => {
    const walls = plan.boxes.filter((b) => b.kind === 'terrace-wall');
    expect(walls.length).toBeGreaterThan(50);
    for (const b of walls) expect(b.z1 - b.z0).toBeLessThanOrEqual(S.terrace.wall + 0.1);
    // a cliff's foot (its lowest edge's middle) never stands in a house lot; the shore, where the land meets the sea, is the coast's
    const lots = plan.slots.filter((q) => q.asset === 'ln-house').map((q) => q.rect);
    for (const b of plan.boxes.filter((q) => q.kind === 'cliff' && q.z0 > 0)) {
      const lo = [...b.pts].sort((p, q) => p[2] - q[2]).slice(0, 2), fx = (lo[0][0] + lo[1][0]) / 2, fy = (lo[0][1] + lo[1][1]) / 2;
      expect(lots.some((r) => fx > r.x && fx < r.x + r.w && fy > r.y && fy < r.y + r.d), `cliff foot at ${Math.round(fx)},${Math.round(fy)}`).toBe(false);
    }
  });
  it('principle 5 — the sea is a place: turquoise shallows, deep blue offshore; the sky bluer overhead', () => {
    const water = plan.grounds.filter((g) => g.kind === 'water');
    expect(new Set(water.map((g) => g.fill))).toEqual(new Set([P.shallows, P.sea]));
    const [sh, dp] = [rgbOf(P.shallows), rgbOf(P.sea)];
    expect(value(sh)).toBeGreaterThan(value(dp));
    expect(sh[1] / sh[2]).toBeGreaterThan(dp[1] / dp[2]);
    const sky = deriveSky(S.sky.palette, { x: 0, y: 0, z: S.sky.sunElev });
    expect(sky.zenith[2] - sky.zenith[0]).toBeGreaterThan(sky.horizon[2] - sky.horizon[0] + 20);
  });
  it('principle 6 — fire where the town lives, never on Athena\'s altar or the summit', () => {
    const lit = planHistoricCity({ culture: 'lindos', seed: 7, fire: true }), a = lit.altar;
    for (const f of lit.fireSources) {
      expect(Math.hypot(f.at[0] - (a.x + a.w / 2), f.at[1] - (a.y + a.d / 2))).toBeGreaterThan(20);
      expect(inPoly(lit.summitPoly, f.at[0], f.at[1])).toBe(false);
    }
  });
  it('the land casts: with the card\'s terrain light the rock shades ground it would not as a flat plan', () => {
    let n = 0;
    for (let x = 5; x < plan.frame.w; x += 10) for (let y = 5; y < plan.frame.d; y += 10) n += shade.sun(x, y) > 0.5 && plan.isSea(x, y);
    expect(n).toBeGreaterThan(20);
  });
});

describe('Lindos and the generic polis — scenes', () => {
  it('builds a scene opening on any of its views', () => {
    for (const view of Object.keys(plan.views)) expect(assembleHistoricCityScene({ culture: 'lindos', seed: 7, view, shade: false }).cameras[0].name).toBe(view);
  }, 300000);
  it('the polis is the same plan on a gentle hill: no sheer cliff, no ship relief, its sanctuary still on top', () => {
    const p = planHistoricCity({ culture: 'polis', seed: 7 });
    expect(p.stats.cliff).toBe(false);
    expect(p.slots.some((q) => q.asset === 'ln-ship-relief')).toBe(false);
    const temple = p.slots.find((q) => q.asset === 'ln-temple');
    for (const q of p.slots) expect(q.z ?? 0).toBeLessThanOrEqual(temple.z);
    expect(Math.max(...p.boxes.filter((b) => b.kind === 'cliff').map((b) => b.z1 - b.z0), 0)).toBeLessThan(25);
    expect(assembleHistoricCityScene({ culture: 'polis', seed: 7, view: 'town' }).cameras[0].name).toBe('town');
  }, 120000);
});
