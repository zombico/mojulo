/**
 * THE ATLAS — a gameworld laid out as a map of its own: each level a region on one plane, placed out from the start
 * (the hub, where a world has one) along its links; its ground drawn as its land says (forest, hills, rock, peaks); its
 * trail wound through its stages from the side it is reached from to the side it leads on; its places (a town, its
 * walls, a castle, the hub); and each link a road or a gate between the trails' ends.
 *
 *   designAtlas(world) → { W, H, seed, name, regions, roads, colours, compass }
 *     regions  [{ id, name, kit, at: [x, y], r, outline: [[x, y]], depth, hub, start, glyphs: [{ kind, at, s }],
 *                trail: { path: [[x, y]], stops: [{ node, section, at }] }, places: [{ kind, at, name? }], reads }]
 *              glyph kinds: conifer | broadleaf | palm | hill | rock | peak | marsh; place kinds: town | walls | castle |
 *              hall | door
 *     roads    [{ from, to, kind: 'road' | 'gate', path: [[x, y]], key? }]
 *     colours  the world's own (its cube's solved colours, else its kit's ramps): { paper?, grass, foliage, rock, soil,
 *              water, accent, stone }
 *
 * The plane is W × H map units (no metres: an atlas is drawn, not surveyed). Pure: the world's seed and its recipe only;
 * seeded streams (city/plan/dice.js streamOf), never Math.random or Date.
 */
import { readGameworld, resolveLevel, cubeInPalette } from './world.js';
import { layLevel } from '../level/index.js';
import { readGeocube } from '../era/geocube.js';
import { stampGeocubes } from '../color-theorist/stamp.js';
import { colorKey } from './nature.js';
import { streamOf } from '../city/plan/dice.js';

export const ATLAS_W = 1200, ATLAS_H = 840;
const r1 = (v) => Math.round(v * 10) / 10;
const TAU = Math.PI * 2;

// the world's colours: its cube's, solved as its levels are (the palette's seed kept), else its kit's ramps
function coloursOf(G) {
  const cube = G.style.geocube;
  if (cube !== undefined) {
    const stamped = stampGeocubes({ kind: 'stage', trail: {}, geocube: cubeInPalette(cube, G.style.palette) }, null, () => G.seed);
    const C = readGeocube(stamped.geocube).colour;
    return { grass: C.grass, foliage: C.foliage, rock: C.stone, soil: C.floor, water: C.water, accent: C.accent, stone: C.trim ?? C.stone, sand: C.sand };
  }
  const K = colorKey(G.style.kit), mid = (name, f = 0.5) => { const r = K.ramps.find((x) => x.name === name)?.stops; return r ? r[Math.round((r.length - 1) * f)] : null; };
  return { grass: mid('grass') ?? '#7da35a', foliage: mid('foliage') ?? mid('leaf') ?? '#3f6e3a', rock: mid('rock') ?? '#8c8478', soil: mid('soil') ?? '#8a6a4a', water: mid('water') ?? '#4a86a8', accent: '#a8402a', stone: mid('rock', 0.7) ?? '#b8b0a0', sand: mid('sand') ?? '#d6c49a' };
}

// what a level's ground grows and how it rises, read off its words: its kit, its look, its cube's flora, its land
function groundOf(G, R) {
  const words = [R.style.kit, typeof R.style.look === 'string' ? R.style.look : R.style.look?.intent, JSON.stringify(R.style.geocube?.biocube ?? ''), JSON.stringify(R.style.land ?? {})].join(' ').toLowerCase();
  const trees = /pine|spruce|fir|conifer|alpine|taiga/.test(words) ? 'conifer' : /jungle|bamboo|palm|tropic/.test(words) ? 'palm' : 'broadleaf';
  const land = R.style.land ?? {}, many = (f) => (typeof land[f] === 'object' ? land[f].many ?? 0.5 : land[f] !== undefined ? 0.5 : 0);
  const hills = /downs|hill|rolling|hummock/.test(JSON.stringify(land.landscape ?? '')) ? 0.25 + 0.4 * many('landscape') : 0.12;
  const rock = 0.04 + 0.2 * many('rock'), marsh = /marsh|bog|fen|swamp|mire/.test(words) ? 0.2 : 0;
  return { trees, forest: /meadow|plain|desert|dune/.test(words) && trees !== 'conifer' ? 0.32 : 0.5, hills, rock, marsh };
}

// the levels out from the start: the hub (or the start) at the middle, each reached level beyond the one it is reached
// from, its neighbours spread round the way out; a world with no links walked in a gentle arc
function placeLevels(G, sizes) {
  const root = G.hub ?? G.start, adj = Object.fromEntries(G.ids.map((id) => [id, []]));
  for (const l of G.links) { adj[l.from]?.push(l.to); adj[l.to]?.push(l.from); }
  const at = {}, depth = {}, out = {}, D = streamOf(G.seed, 'atlas-place');
  const cx = ATLAS_W / 2, cy = ATLAS_H / 2 + 20;
  if (!G.links.length) {
    G.ids.forEach((id, i) => { const t = G.ids.length === 1 ? 0.5 : i / (G.ids.length - 1); at[id] = [140 + t * (ATLAS_W - 280), cy + 90 * Math.sin(t * Math.PI * 1.3 + 0.4)]; depth[id] = i; });
    return { at, depth };
  }
  // (the sheet is wider than it is tall: the start's first ways laid out across it, east and west, then round)
  at[root] = [cx, cy]; depth[root] = 0; out[root] = (D() - 0.5) * 0.5;
  const queue = [root];
  while (queue.length) {
    const id = queue.shift(), next = adj[id].filter((x) => at[x] === undefined);
    const spread = depth[id] === 0 ? TAU : Math.min(Math.PI * 0.9, 0.7 * next.length), base = depth[id] === 0 ? out[id] : out[id] - spread / 2 + spread / (2 * Math.max(1, next.length));
    next.forEach((x, k) => {
      const a = depth[id] === 0 ? base + (k * TAU) / next.length : base + (next.length > 1 ? (k * spread) / next.length : 0) + (D() - 0.5) * 0.25;
      const d = sizes[id] + sizes[x] + 70 + D() * 40;
      at[x] = [at[id][0] + d * Math.cos(a), at[id][1] + d * Math.sin(a)]; depth[x] = depth[id] + 1; out[x] = a; queue.push(x);
    });
  }
  // a level no link reaches: beside the last placed
  let k = 0;
  for (const id of G.ids) if (at[id] === undefined) { at[id] = [140 + 120 * k++, ATLAS_H - 140]; depth[id] = 1; }
  // relaxed apart (regions do not overlap), held to the sheet; then the whole set centred on it
  for (let it = 0; it < 80; it++) {
    for (const a of G.ids) for (const b of G.ids) {
      if (a >= b) continue;
      const dx = at[b][0] - at[a][0], dy = at[b][1] - at[a][1], d = Math.hypot(dx, dy) || 1, want = sizes[a] + sizes[b] + 40;
      if (d < want) { const p = (want - d) / 2, ux = dx / d, uy = dy / d; if (a !== root) { at[a][0] -= ux * p; at[a][1] -= uy * p; } if (b !== root) { at[b][0] += ux * p; at[b][1] += uy * p; } }
    }
  }
  const xs = G.ids.map((id) => [at[id][0] - sizes[id], at[id][0] + sizes[id]]).flat(), ys = G.ids.map((id) => [at[id][1] - sizes[id], at[id][1] + sizes[id]]).flat();
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), s = Math.min(1.7, (ATLAS_W - 220) / w, (ATLAS_H - 250) / h);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  for (const id of G.ids) at[id] = [cx + (at[id][0] - mx) * s, cy + (at[id][1] - my) * s];
  return { at, depth, scale: s };
}

// a region's shore: a ring of points round its centre, its radius stirred by a few seeded waves
function outlineOf(c, r, rand) {
  const waves = [0, 1, 2].map(() => ({ k: 2 + Math.floor(rand() * 4), a: 0.05 + rand() * 0.1, p: rand() * TAU }));
  return Array.from({ length: 36 }, (_, i) => { const t = (i * TAU) / 36, f = 1 + waves.reduce((s, w) => s + w.a * Math.sin(w.k * t + w.p), 0); return [r1(c[0] + r * f * Math.cos(t)), r1(c[1] + r * f * 0.78 * Math.sin(t))]; });
}
export const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

// value noise on a seeded lattice, smoothed: woods and hill bands grow in masses, not a sprinkle
export function noise2(seed, key, x, y) {
  const h = (ix, iy) => streamOf(seed, `atlas-noise-${key}`, `${ix},${iy}`)(), fx = Math.floor(x), fy = Math.floor(y), tx = x - fx, ty = y - fy, s = (t) => t * t * (3 - 2 * t);
  const a = h(fx, fy), b = h(fx + 1, fy), c = h(fx, fy + 1), e = h(fx + 1, fy + 1);
  return a + (b - a) * s(tx) + (c - a) * s(ty) + (a - b - c + e) * s(tx) * s(ty);
}
// a winding way from a to b, bowed and stirred (a trail, a road)
function wind(a, b, rand, n = 10, bow = 0.18, stir = 0.05) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, side = rand() < 0.5 ? -1 : 1;
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, w = side * bow * L * Math.sin(Math.PI * t) + stir * L * Math.sin(t * Math.PI * 3 + rand() * 0.6) * Math.sin(Math.PI * t); return [r1(a[0] + dx * t + nx * w), r1(a[1] + dy * t + ny * w)]; });
}
const along = (path, f) => { const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])), L = segs.reduce((a, b) => a + b, 0); let s = f * L; for (let i = 0; i < segs.length; i++) { if (s <= segs[i] || i === segs.length - 1) { const t = segs[i] ? Math.min(1, s / segs[i]) : 0; return [r1(path[i][0] + (path[i + 1][0] - path[i][0]) * t), r1(path[i][1] + (path[i + 1][1] - path[i][1]) * t)]; } s -= segs[i]; } return path.at(-1); };

export function designAtlas(world) {
  const G = readGameworld(world), seed = G.seed ?? 1;
  const levels = Object.fromEntries(G.ids.map((id) => [id, resolveLevel(world, id)]));
  // each level's stages, in order (its walk's sections; a building, a city, a track one stage of its own)
  const stagesOf = (R) => (R.building ? [{ node: 'building', section: 'building' }] : R.city ? [{ node: 'city', section: 'city' }] : R.roadway ? [{ node: 'roadway', section: 'roadway' }] : R.runner || R.airspace ? [{ node: 'run', section: 'trail' }]
    : layLevel(R.level).stages.map((s) => ({ node: s.node, section: s.section })));
  const stages = Object.fromEntries(G.ids.map((id) => [id, stagesOf(levels[id])]));
  const sizes = Object.fromEntries(G.ids.map((id) => [id, 96 + 24 * stages[id].length + (levels[id].town ? 20 : 0) + (G.hub === id ? 16 : 0)]));
  const { at, depth, scale = 1 } = placeLevels(G, sizes);
  const regions = G.ids.map((id) => {
    const R = levels[id], rand = streamOf(seed, 'atlas-region', id), r = r1(sizes[id] * scale), c = at[id].map(r1), outline = outlineOf(c, r, rand), g = groundOf(G, R);
    // where it is reached from and where it leads: its trail runs from the one to the other (else across it)
    const from = G.links.find((l) => l.to === id), to = G.links.find((l) => l.from === id);
    const dir = (o) => { const d = [at[o][0] - c[0], at[o][1] - c[1]], L = Math.hypot(...d) || 1; return [d[0] / L, d[1] / L]; };
    const ia = from ? dir(from.from) : to ? dir(to.to).map((v) => -v) : [-1, 0.2], oa = to ? dir(to.to) : ia.map((v) => -v);
    const a = [c[0] + ia[0] * r * 0.72, c[1] + ia[1] * r * 0.6], b = [c[0] + oa[0] * r * 0.72, c[1] + oa[1] * r * 0.6];
    const path = Math.hypot(b[0] - a[0], b[1] - a[1]) < r * 0.4 ? wind(a, [c[0] - ia[1] * r * 0.5, c[1] + ia[0] * r * 0.4], rand, 12) : wind(a, b, rand, 14, 0.22, 0.06);
    const S = stages[id], stops = S.map((s, k) => ({ node: s.node, section: s.section, at: along(path, S.length === 1 ? 0.5 : 0.08 + (0.84 * k) / (S.length - 1)) }));
    // its places: the town at its middle (walled where its street is), the hub larger; a castle on the far side
    const places = [];
    if (R.town) places.push({ kind: R.street?.walls ? 'walls' : 'town', at: along(path, 0.5), name: R.name });
    if (R.town?.castle || R.castle) places.push({ kind: 'castle', at: [r1(c[0] + oa[0] * r * 0.35 - oa[1] * r * 0.3), r1(c[1] + oa[1] * r * 0.3 + oa[0] * r * 0.2)] });
    if (R.building) places.push({ kind: 'hall', at: along(path, 0.5) });
    // its ground: glyphs strewn on a jittered grid inside its shore, clear of its trail and places; a climb raises peaks
    // (its name's band, under its middle, kept clear: atlas-html.js writes it at r × 0.58 below the centre)
    // (wide as its small caps are, and deep enough below it that nothing standing up off the ground covers it)
    const band = { x: R.name.length * (G.hub === id ? 11 : 8.4) + 12, y0: c[1] + r * 0.58 - 28, y1: c[1] + r * 0.58 + 24 };
    const glyphs = [], clear = (p, d) => path.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > d) && places.every((q) => Math.hypot(q.at[0] - p[0], q.at[1] - p[1]) > 34) && !(Math.abs(p[0] - c[0]) < band.x && p[1] > band.y0 && p[1] < band.y1 + 46);
    const climbs = S.filter((s) => s.section === 'meru').length, step = 12, highland = climbs || places.some((q) => q.kind === 'castle');
    for (let y = c[1] - r; y <= c[1] + r; y += step) for (let x = c[0] - r; x <= c[0] + r; x += step) {
      const p = [r1(x + (rand() - 0.5) * step * 0.9), r1(y + (rand() - 0.5) * step * 0.9)];
      if (!inside(p, outline) || !clear(p, 13)) continue;
      const u = rand(), edge = Math.hypot((p[0] - c[0]) / r, (p[1] - c[1]) / (r * 0.78));
      // the woods and the hill bands where their noise rises; peaks toward the far rim where it climbs (or where its
      // castle stands on the heights); a stone or a tuft of marsh strewn between
      const wood = noise2(seed, `wood-${id}`, p[0] / 70, p[1] / 70), rise = noise2(seed, `hill-${id}`, p[0] / 55, p[1] / 55);
      const high = highland && (p[0] - c[0]) * oa[0] + (p[1] - c[1]) * oa[1] > r * 0.2 && edge > 0.4;
      const kind = high && u < 0.7 ? 'peak' : wood > 1 - g.forest ? (u < 0.88 ? g.trees : null) : rise > 1 - g.hills * 1.4 ? (u < 0.55 ? 'hill' : null) : u < g.rock * 0.5 ? 'rock' : u < g.rock * 0.5 + g.marsh ? 'marsh' : null;
      if (kind) glyphs.push({ kind, at: p, s: r1((kind === 'peak' ? 1.25 : kind === 'hill' ? 1.05 : 0.8) + rand() * 0.35) });
    }
    // a river from its heights to the sea: off the peaks, away from the middle of the world, out past its shore
    const peaks = glyphs.filter((q) => q.kind === 'peak');
    const river = peaks.length >= 3 ? (() => {
      const src = [peaks.reduce((a, q) => a + q.at[0], 0) / peaks.length, peaks.reduce((a, q) => a + q.at[1], 0) / peaks.length];
      const away = [src[0] - ATLAS_W / 2, src[1] - (ATLAS_H / 2 + 20)], L = Math.hypot(...away) || 1, mouth = [src[0] + (away[0] / L) * r * 1.4, src[1] + (away[1] / L) * r * 1.2];
      return wind(src, mouth, rand, 16, 0.2, 0.08);
    })() : null;
    if (river) for (let i = glyphs.length - 1; i >= 0; i--) if (glyphs[i].kind !== 'peak' && river.some((q) => Math.hypot(q[0] - glyphs[i].at[0], q[1] - glyphs[i].at[1]) < 9)) glyphs.splice(i, 1);
    glyphs.sort((p, q) => p.at[1] - q.at[1]);
    return { id, name: R.name, kit: R.style.kit, at: c, r, outline, depth: depth[id], hub: G.hub === id, start: G.start === id, glyphs, trail: { path, stops }, places, ...(river ? { river } : {}), reads: g };
  });
  const by = Object.fromEntries(regions.map((x) => [x.id, x]));
  // the links: from the end of one trail to the start of the next, winding; a gate drawn as a dotted way
  const roads = G.links.filter((l) => by[l.from] && by[l.to]).map((l, k) => {
    const A = by[l.from], B = by[l.to], rand = streamOf(seed, 'atlas-road', `${l.from}>${l.to}#${k}`);
    return { from: l.from, to: l.to, kind: l.kind ?? 'road', path: wind(A.trail.path.at(-1), B.trail.path[0], rand, 12, 0.12, 0.04), ...(l.key ? { key: l.key } : {}) };
  });
  return { W: ATLAS_W, H: ATLAS_H, seed, name: G.name, regions, roads, colours: coloursOf(G), compass: [ATLAS_W - 110, ATLAS_H - 120] };
}
