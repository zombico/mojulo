import { describe, it, expect } from 'vitest';
import { bakeShade } from './light.js';
import { HISTORIC_STYLES } from './style/index.js';
import { planHistoricCity, historicLight, assembleHistoricCityScene, SCENE_LIGHT } from './historic-city.js';
import { litFactor } from '../polygonizer/vexar.js';
import { deriveSky } from '../polygonizer/painted-landscape.js';

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const value = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const scale = (c, f) => c.map((v) => v * f);
const over = (base, top, a) => base.map((v, i) => v * (1 - a) + top[i] * a);
const UP = litFactor([0, 0, 1], SCENE_LIGHT);
const toSunFlat = (() => { const d = SCENE_LIGHT.dir, h = Math.hypot(d[0], d[1]); return [-d[0] / h, -d[1] / h, 0]; })();

// pixel centres inside a rect, stepped
function* cells({ x, y, w, d }, step = 0.5) { for (let u = x + step / 2; u < x + w; u += step) for (let v = y + step / 2; v < y + d; v += step) yield [u, v]; }
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

describe('historic style cards', () => {
  it('every card states its principles, its light and its sky', () => {
    for (const [id, S] of Object.entries(HISTORIC_STYLES)) {
      expect(S.id).toBe(id);
      expect(S.principles.length).toBeGreaterThanOrEqual(4);
      expect(S.light.shade.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(S.sky.palette).toBeTruthy();
    }
  });
});

describe('the shade bake (light.js)', () => {
  const flat = (extra = []) => ({ frame: { w: 60, d: 60 }, grounds: [{ kind: 'ground', x: 0, y: 0, w: 60, d: 60, z: 0.01, fill: '#c0a080' }], masses: extra });
  const d = SCENE_LIGHT.dir, tanE = -d[2] / Math.hypot(d[0], d[1]);

  it('a box throws its shadow away from the sun, as long as its height over the sun\'s elevation', () => {
    const B = { kind: 'house', x: 25, y: 25, w: 6, d: 6, z0: 0, z1: 10 };
    const sh = bakeShade(flat([B]), SCENE_LIGHT);
    const len = 10 / tanE, cx = 28 + 3 * -toSunFlat[0], cy = 28 + 3 * -toSunFlat[1];   // from the lee face's middle
    const at = (t) => sh.sun(cx - toSunFlat[0] * t, cy - toSunFlat[1] * t);
    expect(at(0.5)).toBeGreaterThan(0.9);
    expect(at(len - 1)).toBeGreaterThan(0.5);
    expect(at(len + 1)).toBeLessThan(0.1);
    // sunward of the box the ground is lit
    expect(sh.sun(28 + toSunFlat[0] * 6, 28 + toSunFlat[1] * 6)).toBeLessThan(0.05);
  });

  it('a battered mass throws a shorter shadow than a box of its footprint and height (slopes step true)', () => {
    const box = bakeShade(flat([{ kind: 'mass', x: 20, y: 20, w: 12, d: 12, z0: 0, z1: 10 }]), SCENE_LIGHT);
    const fr = bakeShade(flat([{ kind: 'mass', solid: 'frustum', x: 20, y: 20, w: 12, d: 12, z0: 0, z1: 10, top: { x: 24, y: 24, w: 4, d: 4 } }]), SCENE_LIGHT);
    let a = 0, b = 0;
    for (const [x, y] of cells({ x: 0, y: 0, w: 60, d: 60 })) { if (box.open(x, y)) a += box.sun(x, y) > 0.5; if (fr.open(x, y)) b += fr.sun(x, y) > 0.5; }
    expect(b).toBeLessThan(a * 0.75);
    expect(b).toBeGreaterThan(0);
  });

  it('overlapping shadows never darken twice', () => {
    const sh = bakeShade(flat([{ kind: 'house', x: 20, y: 20, w: 6, d: 6, z0: 0, z1: 10 }, { kind: 'house', x: 24, y: 22, w: 6, d: 6, z0: 0, z1: 12 }]), SCENE_LIGHT);
    let max = 0;
    for (const [x, y] of cells({ x: 0, y: 0, w: 60, d: 60 })) if (sh.open(x, y)) max = Math.max(max, sh.alpha(x, y));
    expect(max).toBeLessThanOrEqual(1 - (1 - sh.shadeAlpha) * (1 - sh.aoAlpha) + 0.02);
  });

  it('a palm\'s crown floats: its shadow lands a height out, and the ground between is lighter', () => {
    const P = { kind: 'palm', solid: 'palm', x: 29.3, y: 29.3, w: 1.4, d: 1.4, z0: 0, z1: 12, lean: [0, 0], fronds: [] };
    const sh = bakeShade(flat([P]), SCENE_LIGHT), o = [d[0] / -d[2], d[1] / -d[2]];
    const crown = sh.sun(30 + o[0] * 12, 30 + o[1] * 12), side = [-o[1], o[0]], n = Math.hypot(...side);
    const between = sh.sun(30 + o[0] * 6 + (side[0] / n) * 2.5, 30 + o[1] * 6 + (side[1] / n) * 2.5);
    expect(crown).toBeGreaterThan(0.3);
    expect(between).toBeLessThan(crown);
  });

  it('is deterministic', () => {
    const m = flat([{ kind: 'house', x: 20, y: 20, w: 6, d: 6, z0: 0, z1: 10 }]);
    expect(bakeShade(m, SCENE_LIGHT).url).toBe(bakeShade(m, SCENE_LIGHT).url);
  });
});

// each culture with a town plan is held to its own card's principles
for (const culture of ['sumer', 'thebes']) {
  describe(`${culture} — the style card's principles, measured`, () => {
    const S = HISTORIC_STYLES[culture], plan = planHistoricCity({ culture }), { shade } = historicLight(plan);
    const lanes = plan.grounds.filter((g) => g.kind === 'lane' && !g.poly);
    const alleys = lanes.filter((g) => g.surface === S.lanes.alley);   // the beaten-mud alleys, not the rubble streets
    const shadedShare = (rects) => { let n = 0, s = 0; for (const r of rects) for (const [x, y] of cells(r)) if (shade.open(x, y)) { n++; s += shade.sun(x, y) > 0.5; } return s / (n || 1); };

    it('principle 1 — hard sun, measured: whitewash > sunlit lane > lane in shade (cool, never black) > brick turned from the sun', () => {
      const laneFill = rgbOf(lanes[0].fill), lit = scale(laneFill, UP);
      // the shade a lane takes where the sun is fully off it (the card's tint at its alpha), with the sky occlusion an alley floor carries
      const aoAlley = mean(alleys.flatMap((r) => [...cells(r)].filter(([x, y]) => shade.open(x, y)).map(([x, y]) => shade.ao(x, y))));
      const shadeA = 1 - (1 - S.light.shade.alpha) * (1 - aoAlley * S.light.ao.alpha);
      const inShade = over(lit, rgbOf(S.light.shade.color), shadeA);
      const white = plan.boxes.filter((b) => b.skin === 'lime-plaster' || b.skin === 'gypsum-wash').map((b) => value(scale(rgbOf(b.tint || b.fill || '#ffffff'), UP)));
      const brick = plan.boxes.filter((b) => (b.kind === 'house' || b.kind === 'city-wall') && (b.skin === 'mudbrick' || b.skin === 'nile-brick')).map((b) => value(scale(rgbOf(b.tint || b.fill), SCENE_LIGHT.ambient)));
      expect(white.length).toBeGreaterThan(0);
      expect(brick.length).toBeGreaterThan(0);
      const V = { whitewash: Math.max(...white), lane: value(lit), shade: value(inShade), brick: mean(brick) };
      for (let i = 0; i + 1 < S.values.length; i++) expect(V[S.values[i]], `${S.values[i]} > ${S.values[i + 1]}`).toBeGreaterThan(V[S.values[i + 1]]);
      // never black: half the sunlit value at least, and cooler than the sun (more blue for its red)
      expect(V.shade).toBeGreaterThan(V.lane * 0.5);
      expect(inShade[2] / inShade[0]).toBeGreaterThan(lit[2] / lit[0]);
    });

    it('principle 2 — the alleys are slots of shade, far more than the streets; the open court stands in sun', () => {
      expect(alleys.length).toBeGreaterThan(20);
      expect(shadedShare(alleys)).toBeGreaterThanOrEqual(S.lanes.alleyShade);
      const pc = plan.stats.precinct;
      expect(shadedShare([pc])).toBeLessThanOrEqual(S.lanes.courtShade);
      expect(shadedShare(alleys)).toBeGreaterThan(shadedShare([pc]));
      expect(shadedShare(alleys)).toBeGreaterThan(S.lanes.overStreets * shadedShare(lanes.filter((g) => g.surface !== S.lanes.alley)));
    });

    it('principle 3 — walls stand in their own contact shade: the foot of a house darker than the open court', () => {
      const houses = plan.boxes.filter((b) => b.kind === 'house' && !b.solid);
      const foot = [];
      for (const h of houses) for (const [x, y] of [[h.x + h.w / 2, h.y - 0.4], [h.x + h.w / 2, h.y + h.d + 0.4], [h.x - 0.4, h.y + h.d / 2], [h.x + h.w + 0.4, h.y + h.d / 2]]) if (shade.open(x, y)) foot.push(shade.ao(x, y));
      const pc = plan.stats.precinct, court = [...cells(pc, 2)].filter(([x, y]) => shade.open(x, y)).map(([x, y]) => shade.ao(x, y)).sort((a, b) => a - b);
      expect(foot.length).toBeGreaterThan(50);
      expect(mean(foot)).toBeGreaterThan(court[Math.floor(court.length / 2)] * 1.5);
    });

    it('principle 4 — shadows reach the page: every ground face carries the one shade map', () => {
      const scene = assembleHistoricCityScene({ culture, view: 'street' });
      const grounds = scene.faces.filter((f) => f.shade);
      expect(grounds.length).toBeGreaterThanOrEqual(plan.grounds.filter((g) => !g.poly).length);   // every ground rect; a skewed poly keeps its flat colour
      expect(new Set(grounds.map((f) => f.shade)).size).toBe(1);
      expect(shade.url.length).toBeLessThan(600 * 1024);   // the map is one image for the whole town, under its budget
      // off by request: no map, no bytes
      expect(assembleHistoricCityScene({ culture, view: 'street', shade: false }).faces.some((f) => f.shade)).toBe(false);
    });

    it('principle 5 — the sky is a place: bluer overhead than at the horizon, and behind the page', () => {
      const sky = deriveSky(S.sky.palette, { x: 0, y: 0, z: S.sky.sunElev });
      expect(sky.zenith[2] - sky.zenith[0]).toBeGreaterThan(sky.horizon[2] - sky.horizon[0] + 20);
      expect(assembleHistoricCityScene({ culture, view: 'street' }).sky).toEqual(S.sky);
    });

  });
}

// Qin: the design language is held to its card before any town plan exists (the plan checks join with the layout)
describe('qin — the style card\'s principles, measured on the kit', () => {
  const S = HISTORIC_STYLES.qin, K = S.kit, P = S.palette;
  const sat = (h) => { const c = rgbOf(h), mx = Math.max(...c); return mx ? (mx - Math.min(...c)) / mx : 0; };

  it('principle 1 — one batter for every earth face, about 77° as drawn; courses 6–10 cm', () => {
    const deg = (Math.atan(K.earth.batter) * 180) / Math.PI;
    expect(deg).toBeGreaterThan(74);
    expect(deg).toBeLessThan(80);
    expect(K.earth.course[0]).toBeGreaterThanOrEqual(0.06);
    expect(K.earth.course[1]).toBeLessThanOrEqual(0.1);
    // the city wall's own section stands at the same batter: the base wider than its height allows for two faces
    expect(K.wall.city.base).toBeGreaterThanOrEqual((2 * K.wall.city.h) / K.earth.batter);
  });

  it('principle 2 — a column 6–8 diameters tall, on a base wider than itself, with one bracket', () => {
    for (const h of K.column.h) { expect(h / K.column.d).toBeGreaterThanOrEqual(6); expect(h / K.column.d).toBeLessThanOrEqual(8); }
    expect(K.column.plinth).toBeGreaterThanOrEqual(K.column.d * 1.4);
    expect(K.bracket.perColumn).toBe(1);
  });

  it('principle 3 — straight eaves, a moderate pitch, a deep overhang, eave tiles that fit their rows', () => {
    expect(K.roof.eaveCurve).toBe(0);
    expect(K.roof.pitch).toBeGreaterThanOrEqual(25);
    expect(K.roof.pitch).toBeLessThanOrEqual(35);
    expect(K.roof.overhang[0] / K.column.h[1]).toBeGreaterThanOrEqual(0.6);
    expect(K.tile.wadang).toBeLessThan(K.tile.row);
    expect(K.tile.motifs).toContain(K.tile.motif);
  });

  it('principle 4 — plaster lighter than the loess; lacquer the strongest colour; a wall in shade cool, never black', () => {
    expect(value(rgbOf(P.ochrePlaster))).toBeGreaterThan(value(rgbOf(P.loess)) + 0.03);
    expect(value(rgbOf(P.whitePlaster))).toBeGreaterThan(value(rgbOf(P.ochrePlaster)));
    for (const [k, h] of Object.entries(P)) if (k !== 'lacquerRed') expect(sat(P.lacquerRed), k).toBeGreaterThan(sat(h));
    const lit = scale(rgbOf(P.hangtu), UP), inShade = over(lit, rgbOf(S.light.shade.color), S.light.shade.alpha);
    expect(value(inShade)).toBeGreaterThan(value(lit) * 0.5);
    expect(inShade[2] / inShade[0]).toBeGreaterThan(lit[2] / lit[0]);
  });

  it('principle 5 — the sky is a place: bluer overhead than at the horizon', () => {
    const sky = deriveSky(S.sky.palette, { x: 0, y: 0, z: S.sky.sunElev });
    expect(sky.zenith[2] - sky.zenith[0]).toBeGreaterThan(sky.horizon[2] - sky.horizon[0] + 20);
  });
});

// Pompeii: the design language is held to its card before any town plan exists (the plan checks join with the layout)
describe('pompeii — the style card\'s principles, measured on the kit', () => {
  const S = HISTORIC_STYLES.pompeii, K = S.kit, P = S.palette;
  const hue = (h) => { const [r, g, b] = rgbOf(h).map((v) => v / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };

  it('principle 1 — the podium lifts the temple above the eye, with its one stair at the front', () => {
    expect(K.podium.h[0]).toBeGreaterThan(1.7);
    expect(K.podium.stair).toBe('front');
    expect(K.roof.pediment).toBe('temple');
  });

  it('principle 2 — stucco > limestone > tufa > lava; the socle under the field; a wall in shade cool, never black', () => {
    for (let i = 0; i + 1 < S.values.length; i++) expect(value(rgbOf(P[S.values[i]])), `${S.values[i]} > ${S.values[i + 1]}`).toBeGreaterThan(value(rgbOf(P[S.values[i + 1]])));
    for (const field of ['stucco', 'yellow']) expect(value(rgbOf(P[field]))).toBeGreaterThan(value(rgbOf(P.red)));
    expect(K.wall.socle[1]).toBeLessThan(K.wall.storey[0] / 2);
    const lit = scale(rgbOf(P.tufa), UP), inShade = over(lit, rgbOf(S.light.shade.color), S.light.shade.alpha);
    expect(value(inShade)).toBeGreaterThan(value(lit) * 0.5);
    expect(inShade[2] / inShade[0]).toBeGreaterThan(lit[2] / lit[0]);
  });

  it('principle 3 — low red roofs: a shallow pitch, a short eave, terracotta hue', () => {
    expect(K.roof.pitch).toBeGreaterThanOrEqual(15);
    expect(K.roof.pitch).toBeLessThanOrEqual(25);
    expect(K.roof.overhang[1]).toBeLessThan(1);
    expect(hue(P.tile)).toBeGreaterThan(5);
    expect(hue(P.tile)).toBeLessThan(30);
  });

  it('principle 4 — stepping stones no higher than the kerb, with gaps a cart\'s wheels pass through', () => {
    expect(K.street.stone.h).toBeLessThanOrEqual(K.street.kerb[1]);
    expect(K.street.kerb[0]).toBeGreaterThanOrEqual(0.3);
    // two stones a gauge apart centre to centre leave a gap wider than a wheel on either side of the middle stone
    expect(K.street.gauge - K.street.stone.w).toBeGreaterThan(K.street.wheel * 2);
  });

  it('principle 5 — Tuscan and Doric about seven diameters, Corinthian about ten; the upper order shorter', () => {
    for (const o of ['tuscan', 'doric']) { expect(K.order[o]).toBeGreaterThanOrEqual(6.5); expect(K.order[o]).toBeLessThanOrEqual(7.5); }
    expect(K.order.corinthian).toBeGreaterThanOrEqual(9.5);
    expect(K.order.ionic).toBeGreaterThan(K.order.doric);
    expect(K.order.upper).toBeLessThan(1);
  });

  it('principle 6 — the sky is a place: bluer overhead than at the horizon', () => {
    const sky = deriveSky(S.sky.palette, { x: 0, y: 0, z: S.sky.sunElev });
    expect(sky.zenith[2] - sky.zenith[0]).toBeGreaterThan(sky.horizon[2] - sky.horizon[0] + 20);
  });
});

describe('forum — the style card\'s principles, measured on the built orders', async () => {
  const { column, entablature } = await import('./assets/orders.js');
  const S = HISTORIC_STYLES.forum, K = S.kit, P = S.palette;
  const zTop = (ms) => Math.max(...ms.map((m) => m.z1)), zBot = (ms) => Math.min(...ms.map((m) => m.z0));
  const reach = (ms, z0, z1) => Math.max(...ms.filter((m) => m.z0 >= z0 - 1e-6 && m.z1 <= z1 + 1e-6).map((m) => Math.max(Math.abs(m.x), Math.abs(m.x + m.w), Math.abs(m.y), Math.abs(m.y + m.d))));

  it('principle 1 — each column is built to its order: height, base, capital and taper in diameters', () => {
    const D = 1.45;
    for (const [o, k] of Object.entries(K.order)) {
      const c = column(o, { D, tint: P.luna });
      expect(zTop(c.masses) / D, o).toBeCloseTo(k.column, 1);
      expect(c.base / D, o).toBeCloseTo(k.base, 5);
      expect((c.top - c.shaftTop) / D, o).toBeCloseTo(k.capital, 5);
      expect(c.rTop / (D / 2), o).toBeCloseTo(k.taper, 5);
      expect(zBot(c.masses)).toBe(0);
    }
    expect(K.order.corinthian.column).toBeGreaterThanOrEqual(9.5);
    expect(K.order.ionic.column).toBeLessThan(K.order.corinthian.column);
    expect(K.order.tuscan.column).toBeLessThan(K.order.ionic.column);
    expect(K.order.corinthian.taper).toBeGreaterThan(0.8);
    // the Corinthian capital's abacus reaches past the shaft (the horns over the leaves)
    const c = column('corinthian', { D, tint: P.luna });
    expect(reach(c.masses, c.shaftTop, c.top)).toBeGreaterThan(0.7 * D);
  });

  it('principle 2 — the entablature is about a quarter of the column, its modillions spaced to the columns', () => {
    const D = 1.45;
    for (const [o, [lo, hi]] of Object.entries(K.entablature)) {
      const e = entablature(o, { D, span: 4, tint: P.luna }), H = K.order[o].column * D;
      expect(e.height / H, o).toBeGreaterThanOrEqual(lo);
      expect(e.height / H, o).toBeLessThanOrEqual(hi);
    }
    // the Corinthian modillions: one per pitch, so two columns' worth of span has more than two
    const e = entablature('corinthian', { D, span: 3.2 * D * 2, tint: P.luna });
    expect(e.masses.filter((m) => m.y < -0.5 * D && m.z0 > 1.5 * D).length).toBeGreaterThan(4);
  });

  it('principle 3 — temples on podia with a front stair; columns close (1.5–2.25 D clear)', () => {
    expect(K.podium.h[0]).toBeGreaterThanOrEqual(3);
    expect(K.podium.stair).toBe('front');
    expect(K.spacing[0]).toBe(1.5);
    expect(K.spacing[1]).toBeLessThanOrEqual(2.25);
  });

  it('principle 4 — Luna marble > travertine > tufa > peperino > basalt; gilt brighter than bronze; shade cool, never black', () => {
    for (let i = 0; i + 1 < S.values.length; i++) expect(value(rgbOf(P[S.values[i]])), `${S.values[i]} > ${S.values[i + 1]}`).toBeGreaterThan(value(rgbOf(P[S.values[i + 1]])));
    expect(value(rgbOf(P.gilt))).toBeGreaterThan(value(rgbOf(P.bronze)));
    const lit = scale(rgbOf(P.luna), UP), inShade = over(lit, rgbOf(S.light.shade.color), S.light.shade.alpha);
    expect(value(inShade)).toBeGreaterThan(value(lit) * 0.5);
    expect(inShade[2] / inShade[0]).toBeGreaterThan(lit[2] / lit[0]);
  });

  it('principle 5 — the square is long and open: its length over two and a half times its width', () => {
    expect(K.square.d / K.square.w).toBeGreaterThan(2.5);
  });

  it('principle 6 — the sky is a place: bluer overhead than at the horizon', () => {
    const sky = deriveSky(S.sky.palette, { x: 0, y: 0, z: S.sky.sunElev });
    expect(sky.zenith[2] - sky.zenith[0]).toBeGreaterThan(sky.horizon[2] - sky.horizon[0] + 20);
  });
});
