/**
 * A SEABED LAID AS AN AQUARIUM IS: the hardscape first, then what grows on it, what sits round its foot, what stands
 * apart, and what carpets the sand between, with open sand left. Pure placement over a land that is already built: it
 * reads the land's faces for its ground and its trail and says where each copy of a marine kind stands.
 *
 *   seabedGrid(faces)            the land's walkable ground as a metre grid (each cell its highest up-facing face's
 *                                plane) and the cells its trail runs on → { z(x, y) | null, cells, trail }
 *   placeMarine(comp, grid, o)   a composition (marine/roster.js readMarine) laid along the trail, by the seed →
 *                                { groups: [{ kind, grow, seed, h, w, n, sway, base, tip, items: [x, y, z, yaw, scale,
 *                                leanX, leanY, …] }], sites: { rocks, anemones, trail } (where the sea's animals find
 *                                their seats: marine/fauna.js), count, tris, readout }
 *
 * The rules of the lay (MARINE_LAY): nothing on the trail or within its clear; patches kept apart so sand shows between
 * them; on a rock the tall things stand back from its rim and a fan faces out of it; a drift is wholly one kind; a kind
 * is thinned to the page's budget, never cut whole, and the rocks are kept. Deterministic from the seed.
 */
import { MARINE } from './forms.js';
import { MARINE_KINDS, MARINE_KIND_IDS, MARINE_BUDGET } from './roster.js';

const { hash, rockZ } = MARINE;
const TAU = Math.PI * 2;
const r3 = (v) => Math.round(v * 1e3) / 1e3;
const lerp = (a, b, t) => a + (b - a) * t;
const hexRgb = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 1e4) / 1e4);

/** The lay's measures: the trail's clear (m) and how far from it things are laid; the least gap between patches (m, at a
 *  patch a hundred square metres); what a rock carries by its radius; a stand's and a drift's sizes; how steep the
 *  ground may be (its normal's rise); the variants a kind is grown in. */
export const MARINE_LAY = Object.freeze({
  clear: 2.4, reach: 15, gap: 4.4, steep: 0.82,
  on: Object.freeze({ base: 5, perArea: 3.4, most: 18, rim: 0.88, apart: 0.34 }), foot: Object.freeze({ base: 2, perRadius: 2.2, ring: Object.freeze([1.02, 1.4]) }),
  soft: Object.freeze([3, 6]), stand: Object.freeze({ count: Object.freeze([3, 8]), spread: Object.freeze([1.2, 3]) }),
  drift: Object.freeze({ radius: Object.freeze([1.8, 3.6]), perArea: 1.5 }), variants: 3,
});

const GROUND = /ground|sand|scree|soil|floor|seabed/, TRAIL = /trail|path/;

/** The land's ground as a metre grid. A face counts where it faces up and is not water; its cell keeps the highest. */
export function seabedGrid(faces) {
  const cells = new Map(), trail = new Set(), key = (ix, iy) => ix * 65536 + iy;
  for (const f of faces || []) {
    const n = f.normal, g = String(f.group ?? '');
    if (!n || !(n[2] > MARINE_LAY.steep) || f.water || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    const isTrail = TRAIL.test(g);
    if (!isTrail && !GROUND.test(g)) continue;
    let cx = 0, cy = 0, cz = 0; for (const c of f.corners) { cx += c[0]; cy += c[1]; cz += c[2]; }
    cx /= f.corners.length; cy /= f.corners.length; cz /= f.corners.length;
    const k = key(Math.floor(cx), Math.floor(cy)), was = cells.get(k);
    if (isTrail) trail.add(k);
    if (!was || cz > was[2]) cells.set(k, [cx, cy, cz, n[0], n[1], n[2]]);
  }
  const at = (x, y) => cells.get(key(Math.floor(x), Math.floor(y)));
  /** The ground's height at a point: its cell's plane; null off the ground. */
  const z = (x, y) => { const c = at(x, y); return c ? c[2] - (c[3] * (x - c[0]) + c[4] * (y - c[1])) / c[5] : null; };
  return { z, cells, trail, key };
}

// one of a table's keys by its weights and a dice in 0..1
const pick = (W, d) => { const E = Object.entries(W); let t = E.reduce((a, [, w]) => a + w, 0) * d; for (const [k, w] of E) { t -= w; if (t <= 0) return k; } return E.length ? E.at(-1)[0] : null; };

export function placeMarine(comp, grid, { seed = 1 } = {}) {
  const L = MARINE_LAY, S = (comp.seed ?? seed) | 0, dice = (a, b = 0) => hash(S * 9973 + a, b);
  // where things may stand: ground within the reach of the trail and past its clear
  const trail = [...grid.trail].map((k) => grid.cells.get(k)).filter(Boolean), cand = [];
  const nearTrail = (x, y) => { let m = Infinity; for (const t of trail) { const d = (t[0] - x) * (t[0] - x) + (t[1] - y) * (t[1] - y); if (d < m) m = d; } return Math.sqrt(m); };
  for (const [k, c] of grid.cells) { if (grid.trail.has(k)) continue; const d = trail.length ? nearTrail(c[0], c[1]) : L.clear; if (d >= L.clear && d <= L.reach) cand.push(c); }
  cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const items = [], rocks = [], area = cand.length;
  const ok = (x, y) => grid.z(x, y) !== null && (!trail.length || nearTrail(x, y) >= L.clear);
  const inRock = (x, y, pad = 0) => rocks.some((r) => Math.hypot(x - r.x, y - r.y) < r.R * 1.1 + pad);
  // a copy: its kind, where, how turned, sized in its row's range, its variant and colour by its dice
  let id = 0;
  const put = (kind, x, y, z, { yaw = null, lean = [0, 0], size = null, keep = false } = {}) => {
    const K = MARINE_KINDS[kind], i = id++, t = size ?? dice(i, 11), h = lerp(K.h[0], K.h[1], t), mid = (K.h[0] + K.h[1]) / 2;
    const it = { kind, x, y, z, yaw: yaw ?? TAU * dice(i, 12), s: h / mid, lean, v: Math.floor(dice(i, 13) * L.variants), c: Math.floor(dice(i, 14) * K.colours.length), rank: keep ? -1 : dice(i, 15) };
    items.push(it); return it;
  };
  const cell = (i, b) => (cand.length ? cand[Math.floor(dice(i, b) * cand.length)] : null);

  // 1. the patches, kept apart: a rock and what it carries, or a soft patch of what sits on the bed
  const nP = Math.round((area / 100) * comp.patches), gap = L.gap / Math.sqrt(Math.max(0.3, comp.patches)), centres = [];
  for (let i = 0, tries = 0; centres.length < nP && tries < nP * 24; i++, tries++) {
    const c = cell(1000 + i, 1); if (!c) break;
    if (centres.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < gap)) continue;
    centres.push(c);
  }
  const hasOn = Object.keys(comp.seats.on).length > 0, hasFoot = Object.keys(comp.seats.foot).length > 0;
  centres.forEach((c, pi) => {
    const d = (b) => dice(2000 + pi, b);
    if (comp.rock > 0 && d(1) < comp.rock) {
      const K = MARINE_KINDS.bommie, rock = put('bommie', c[0], c[1], grid.z(c[0], c[1]), { size: d(2), keep: true });
      const R0 = (K.w[0] + K.w[1]) / 4, H0 = (K.h[0] + K.h[1]) / 2, R = R0 * rock.s, vs = variantSeed('bommie', rock.v), cy = Math.cos(rock.yaw), sy = Math.sin(rock.yaw);
      // (the rock's height at a point of the bed: the kernel's own function, in the rock's turned and scaled frame)
      const top = (x, y) => { const dx = x - rock.x, dy = y - rock.y; return rock.s * rockZ(vs, R0, H0, (dx * cy + dy * sy) / rock.s, (-dx * sy + dy * cy) / rock.s); };
      rocks.push({ x: rock.x, y: rock.y, z: rock.z, R, H: H0 * rock.s });
      if (hasOn) {
        const n = Math.min(L.on.most, Math.round(L.on.base + R * R * L.on.perArea)), mine = [];
        for (let j = 0, tries = 0; mine.length < n && tries < n * 6; j++, tries++) {
          const kind = pick(comp.seats.on, d(100 + j)), K2 = MARINE_KINDS[kind], a = TAU * d(200 + j);
          // (a fan on the flank, facing out; the rest anywhere inside the rim, the tall ones nearer the middle)
          const q = kind === 'fan' ? 0.55 + 0.3 * d(300 + j) : Math.sqrt(d(300 + j)) * L.on.rim * (K2.h[1] > 1 ? 0.7 : 1), x = rock.x + Math.cos(a) * R * q, y = rock.y + Math.sin(a) * R * q, h = top(x, y);
          const wide = (K2.w[0] + K2.w[1]) / 2;
          if (h <= 0.05 || mine.some((m) => Math.hypot(m.x - x, m.y - y) < (m.wide + wide) * L.on.apart)) continue;
          const it = put(kind, x, y, rock.z + h - 0.03, { yaw: kind === 'fan' ? a + Math.PI / 2 : null, lean: [Math.cos(a) * q * 0.3, Math.sin(a) * q * 0.3] });
          mine.push({ x, y, wide: wide * it.s });
        }
      }
      if (hasFoot) {
        const n = Math.round(L.foot.base + R * L.foot.perRadius);
        for (let j = 0; j < n; j++) {
          const a = TAU * d(400 + j), q = lerp(L.foot.ring[0], L.foot.ring[1], d(500 + j)), x = rock.x + Math.cos(a) * R * q, y = rock.y + Math.sin(a) * R * q;
          if (ok(x, y)) put(pick(comp.seats.foot, d(600 + j)), x, y, grid.z(x, y) + top(x, y));
        }
      }
    } else if (hasFoot) {
      const n = Math.round(lerp(L.soft[0], L.soft[1], d(3)));
      for (let j = 0; j < n; j++) { const a = TAU * d(700 + j), r = 1.6 * Math.sqrt(d(800 + j)), x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; if (ok(x, y)) put(pick(comp.seats.foot, d(900 + j)), x, y, grid.z(x, y)); }
    }
  });
  // 2. the stands: groups of one kind standing apart on the bed
  if (Object.keys(comp.seats.stand).length) {
    const nS = Math.round((area / 100) * comp.stands);
    for (let i = 0; i < nS; i++) {
      const c = cell(5000 + i, 1), d = (b) => dice(6000 + i, b); if (!c || inRock(c[0], c[1], 1.5)) continue;
      const kind = pick(comp.seats.stand, d(1)), n = Math.round(lerp(L.stand.count[0], L.stand.count[1], d(2))), spread = lerp(L.stand.spread[0], L.stand.spread[1], d(3));
      for (let j = 0; j < n; j++) { const a = TAU * d(10 + j), r = spread * Math.sqrt(d(40 + j)), x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; if (ok(x, y) && !inRock(x, y)) put(kind, x, y, grid.z(x, y)); }
    }
  }
  // 3. the carpet: drifts over open sand, each wholly one kind
  if (comp.cover > 0 && Object.keys(comp.seats.carpet).length) {
    const mean = (L.drift.radius[0] + L.drift.radius[1]) / 2, nD = Math.round((area * comp.cover) / (Math.PI * mean * mean));
    for (let i = 0; i < nD; i++) {
      const c = cell(8000 + i, 1), d = (b) => dice(9000 + i, b); if (!c) continue;
      const kind = pick(comp.seats.carpet, d(1)), R = lerp(L.drift.radius[0], L.drift.radius[1], d(2)), n = Math.round(Math.PI * R * R * L.drift.perArea);
      // (thicker at the drift's heart, thinning to its edge)
      for (let j = 0; j < n; j++) { const a = TAU * d(10 + j), r = R * Math.pow(d(2000 + j), 0.7), x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; if (ok(x, y) && !inRock(x, y)) put(kind, x, y, grid.z(x, y)); }
    }
  }
  // the budget: a kind's triangles by its templates, the copies thinned by rank where the page's most is passed
  const trisOf = (kind) => { const t = templateOf(kind, 0, 0); return MARINE.form(t.grow, t).tris; }, T = Object.fromEntries(MARINE_KIND_IDS.map((k) => [k, null]));
  const cost = (it) => (T[it.kind] ??= trisOf(it.kind));
  // (the rocks are kept whatever the budget; the rest are taken in their dice's order until the page's most is met, so
  // every kind thins alike and none is cut whole)
  const held = items.filter((it) => it.rank < 0), rest = items.filter((it) => it.rank >= 0).sort((x, y) => x.rank - y.rank), kept = [...held];
  let tris = held.reduce((a, it) => a + cost(it), 0);
  for (const it of rest) { if (kept.length >= MARINE_BUDGET.items || tris + cost(it) > MARINE_BUDGET.tris) break; kept.push(it); tris += cost(it); }
  const share = rest.length ? (kept.length - held.length) / rest.length : 1;
  const groups = new Map(), counts = {};
  for (const it of kept) {
    const k = `${it.kind}|${it.v}|${it.c}`;
    if (!groups.has(k)) groups.set(k, { ...templateOf(it.kind, it.v, it.c), items: [] });
    groups.get(k).items.push(r3(it.x), r3(it.y), r3(it.z), r3(it.yaw), r3(it.s), r3(it.lean[0]), r3(it.lean[1]));
    counts[it.kind] = (counts[it.kind] || 0) + 1;
  }
  const list = [...groups.values()].sort((a, b) => (a.kind + a.seed + a.base.join()).localeCompare(b.kind + b.seed + b.base.join()));
  // (where the animals' habits find their seats, marine/fauna.js: the rocks, and the anemones that were kept)
  const sites = { rocks, anemones: kept.filter((it) => it.kind === 'anemone').map((it) => [r3(it.x), r3(it.y), r3(it.z + 0.3 * it.s)]), trail: trail.map((t) => [t[0], t[1], t[2]]) };
  return { groups: list, sites, count: kept.length, tris: kept.reduce((a, it) => a + cost(it), 0),
    readout: { mix: comp.mix, reads: comp.reads, depth: comp.depth, ground: area, patches: centres.length, rocks: rocks.length, kinds: counts, ...(share < 1 ? { thinned: r3(share) } : {}), ...(comp.left.length ? { left: comp.left } : {}) } };
}

/** A kind's variant's seed: the roster's order and the variant, never the recipe's seed, so a template is one shape
 *  wherever it is grown (and a rock's height is its template's). */
export function variantSeed(kind, v) { return 1000 + MARINE_KIND_IDS.indexOf(kind) * 16 + v; }
/** The template a copy is stamped from: its kind's way of growing at the middle of its size, in one of its colours. */
export function templateOf(kind, v, c) {
  const K = MARINE_KINDS[kind], col = K.colours[c % K.colours.length];
  return { kind, grow: K.grow, seed: variantSeed(kind, v), h: (K.h[0] + K.h[1]) / 2, w: (K.w[0] + K.w[1]) / 2, n: K.n ?? 0, sway: K.sway, base: hexRgb(col[0]), tip: hexRgb(col[1]) };
}
