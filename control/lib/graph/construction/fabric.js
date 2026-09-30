// construction/fabric — upholstery cloth from a weave draft: which thread lies on top at each crossing, and what colour
// each thread is. That is how cloth is designed on a loom, and it gives every classic upholstery cloth from two small
// inputs: houndstooth is a 2/2 twill with four dark and four light threads each way; gingham is a plain weave in blocks
// of a colour and white; a tartan is a twill on a symmetric sett; ticking is a warp stripe across a plain weft.
//
//   fabric: 'houndstooth' (a preset) | { preset?, weave?, warp?, weft?, threadMm?, pile?, slub?, loops?, martindale? }
//   weave:  'plain' | 'basket' | 'twill' ('twill-2/2' default, 'twill-2/1', 'twill-3/1') | 'herringbone' (a 2/2 twill
//           reversing every 4 threads; 'herringbone-6' every 6) | 'satin' (5-end, warp-faced)
//   warp:   a colour order, ['#1d2a44', 4, '#ece4d0', 4] (colour, thread count, …) or one colour; `weft` defaults to it
//   threadMm: the thread pitch (mm); a coarse upholstery cloth is 0.5–1.2; rollMm: the cloth's width (1400)
//
// One draft renders three ways: the World tile (a `fabric:` texture key, the threads shaded as round floats), the SVG
// swatch at true scale or magnified, and black and white — the weaver's draft (black where the warp is up) or tones
// (each thread colour sorted into white, hatched, cross-hatched or black) so a coloured cloth prints in one ink.
//
// Each preset carries a Martindale figure (EN ISO 12947-2 rubs, a typical cloth of its kind, `est`) and whether it has
// a nap. Pure and deterministic: seeded by the draft, no randomness.
import { registerTextureResolver, encodePng } from '../landscape/surface-textures.js';
import { hexRgb, rgbHex } from './timber.js';

const NAMED = Object.freeze({
  ink: '#1d1f24', black: '#16171a', charcoal: '#3a3d42', grey: '#8a8a86', white: '#f4f1ea', cream: '#ece4d0', oat: '#d6c8aa',
  sand: '#c9b48c', navy: '#1d2a44', sky: '#8fb3d1', teal: '#2c6468', forest: '#1f4a35', olive: '#6b6a3a', mustard: '#c79a2a',
  emerald: '#2f7556', rust: '#a4502c', red: '#9e2a2b', rose: '#c98a8a', plum: '#5a2d4a', camel: '#b08a5a', chocolate: '#4a3226',
});

export const FABRIC_PRESETS = Object.freeze({
  linen: { title: 'linen', weave: 'plain', warp: 'oat', threadMm: 0.7, slub: 0.1, martindale: 15000 },
  canvas: { title: 'cotton canvas', weave: 'plain', warp: 'cream', threadMm: 1.0, slub: 0.04, martindale: 40000 },
  twill: { title: 'twill', weave: 'twill-2/2', warp: 'charcoal', weft: 'grey', threadMm: 0.6, martindale: 35000 },
  herringbone: { title: 'herringbone tweed', weave: 'herringbone', warp: 'camel', weft: 'cream', threadMm: 0.9, slub: 0.06, martindale: 30000 },
  houndstooth: { title: 'houndstooth', weave: 'twill-2/2', warp: ['ink', 4, 'cream', 4], threadMm: 1.2, martindale: 25000 },
  gingham: { title: 'gingham', weave: 'plain', warp: ['red', 12, 'white', 12], threadMm: 0.5, martindale: 15000 },
  tartan: {
    title: 'tartan', weave: 'twill-2/2', threadMm: 0.8, martindale: 35000,
    warp: ['navy', 24, 'black', 4, 'navy', 4, 'black', 4, 'navy', 4, 'black', 24, 'forest', 24, 'mustard', 4, 'forest', 24, 'black', 24],
  },
  ticking: { title: 'ticking', weave: 'twill-2/1', warp: ['navy', 6, 'cream', 14, 'navy', 2, 'cream', 14], weft: 'cream', threadMm: 0.5, martindale: 20000 },
  velvet: { title: 'cotton velvet', weave: 'plain', warp: 'emerald', threadMm: 0.4, pile: true, martindale: 50000 },
  boucle: { title: 'bouclé', weave: 'plain', warp: 'cream', threadMm: 1.4, loops: 0.35, martindale: 30000 },
});
export const FABRIC_NAMES = Object.freeze(Object.keys(FABRIC_PRESETS));

const WEAVE_RE = /^(plain|basket|satin|twill(?:-([1-4])\/([1-4]))?|herringbone(?:-(\d+))?)$/;

/** Parse a weave → { kind, o, u, k, rx, ry } (rx, ry: the weave's repeat in threads). */
function parseWeave(w) {
  const m = WEAVE_RE.exec(w || 'plain'); if (!m) return null;
  if (m[1] === 'plain') return { kind: 'plain', rx: 2, ry: 2 };
  if (m[1] === 'basket') return { kind: 'basket', rx: 4, ry: 4 };
  if (m[1] === 'satin') return { kind: 'satin', rx: 5, ry: 5 };
  if (m[1].startsWith('twill')) { const o = +(m[2] || 2), u = +(m[3] || 2); return { kind: 'twill', o, u, rx: o + u, ry: o + u }; }
  const k = +(m[4] || 4); if (k < 2 || k > 24) return null;
  return { kind: 'herringbone', o: 2, u: 2, k, rx: 2 * k, ry: 4 };
}

const colourOf = (c) => hexRgb(NAMED[c] || c);
/** A colour order → [{ rgb, n }], or null. */
function parseOrder(order) {
  if (typeof order === 'string') { const rgb = colourOf(order); return rgb ? [{ rgb, n: 1 }] : null; }
  if (!Array.isArray(order) || !order.length || order.length % 2) return null;
  const out = [];
  for (let i = 0; i < order.length; i += 2) {
    const rgb = colourOf(order[i]); const n = order[i + 1];
    if (!rgb || !Number.isInteger(n) || n < 1 || n > 256) return null;
    out.push({ rgb, n });
  }
  return out.reduce((s, r) => s + r.n, 0) <= 1024 ? out : null;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);
// A tile holds whole repeats of the weave and of each colour order, so its size is their least common multiple: a
// 1021-thread order in a herringbone-23 is 46966 threads across. The tile is baked as a texture pixel by pixel.
export const MAX_TILE_CROSSINGS = 1 << 22;     // 2048²: a 1024-thread order in a herringbone-24 is 3072 × 1024
/** The tile's size in threads, [nx, ny], for parsed orders and weave (a textured thread widens a small tile). */
function tileThreads(weave, warp, weft, textured) {
  const threads = (order) => order.reduce((n, r) => n + r.n, 0);
  const grow = (n) => (textured ? n * Math.ceil(96 / n) : n);
  return [grow(lcm(threads(warp), weave.rx)), grow(lcm(threads(weft), weave.ry))];
}

/** Why a fabric spec is malformed, or null. */
export function fabricError(spec) {
  if (spec === undefined) return null;
  if (typeof spec === 'string') return FABRIC_PRESETS[spec] ? null : `fabric: a preset (${FABRIC_NAMES.join(', ')}) or { weave, warp, weft?, threadMm? }`;
  if (!spec || typeof spec !== 'object') return 'fabric: a preset name or { weave, warp, weft?, threadMm? }';
  if (spec.preset !== undefined && !FABRIC_PRESETS[spec.preset]) return `fabric.preset: one of ${FABRIC_NAMES.join(', ')}`;
  const base = spec.preset ? FABRIC_PRESETS[spec.preset] : {};
  if (!parseWeave(spec.weave || base.weave || 'plain')) return "fabric.weave: 'plain', 'basket', 'satin', 'twill' ('twill-2/2', 'twill-2/1', 'twill-3/1') or 'herringbone' ('herringbone-6')";
  const warp = spec.warp !== undefined ? spec.warp : base.warp;
  if (warp === undefined) return 'fabric.warp: a colour, or a colour order [colour, threads, colour, threads, …]';
  if (!parseOrder(warp)) return "fabric.warp: a colour ('#rrggbb' or a name: " + Object.keys(NAMED).join(', ') + '), or a colour order [colour, threads, …] of at most 1024 threads';
  if (spec.weft !== undefined && !parseOrder(spec.weft)) return 'fabric.weft: a colour or a colour order, like the warp';
  if (spec.threadMm !== undefined && !(Number.isFinite(spec.threadMm) && spec.threadMm >= 0.1 && spec.threadMm <= 5)) return 'fabric.threadMm: the thread pitch, 0.1–5 mm';
  if (spec.martindale !== undefined && !(Number.isFinite(spec.martindale) && spec.martindale > 0)) return 'fabric.martindale: rubs, a number > 0';
  for (const k of ['slub', 'loops']) if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] >= 0 && spec[k] <= 1)) return `fabric.${k}: 0–1`;
  if (spec.pile !== undefined && typeof spec.pile !== 'boolean') return 'fabric.pile: true or false';
  if (spec.rollMm !== undefined && !(Number.isFinite(spec.rollMm) && spec.rollMm >= 600 && spec.rollMm <= 3200)) return 'fabric.rollMm: the cloth\'s width, 600–3200 mm';
  const pick = (k) => (spec[k] !== undefined ? spec[k] : base[k]);
  const weft = spec.weft !== undefined ? spec.weft : spec.warp !== undefined ? spec.warp : base.weft !== undefined ? base.weft : base.warp;
  const [nx, ny] = tileThreads(parseWeave(spec.weave || base.weave || 'plain'), parseOrder(warp), parseOrder(weft), !!(pick('slub') || pick('loops') || pick('pile')));
  if (nx * ny > MAX_TILE_CROSSINGS) return `fabric: the pattern repeats every ${nx} × ${ny} threads (the colour orders' thread counts against the weave's repeat), over the ${MAX_TILE_CROSSINGS} crossings a tile may hold — shorten an order, or make its thread count a multiple of the weave's repeat`;
  return null;
}

const expand = (order) => order.flatMap((r) => Array(r.n).fill(r.rgb));
const sameOrder = (a, b) => a.length === b.length && a.every((r, i) => r.n === b[i].n && r.rgb.every((v, k) => v === b[i].rgb[k]));

/** A fabric spec → the resolved cloth, or null. */
export function resolveFabric(spec) {
  if (fabricError(spec)) return null;
  const s = typeof spec === 'string' ? { preset: spec } : spec || { preset: 'linen' };
  const base = s.preset ? FABRIC_PRESETS[s.preset] : {};
  const pick = (k, d) => (s[k] !== undefined ? s[k] : base[k] !== undefined ? base[k] : d);
  const weave = parseWeave(pick('weave', 'plain'));
  const warp = parseOrder(pick('warp')); const weftSpec = s.weft !== undefined ? s.weft : s.warp !== undefined ? s.warp : base.weft !== undefined ? base.weft : base.warp;
  const weft = parseOrder(weftSpec);
  const threadMm = pick('threadMm', 0.6);
  const W = expand(warp), F = expand(weft);
  const slub = pick('slub', 0), loops = pick('loops', 0), pile = !!pick('pile', false);
  // a cloth with texture in its threads (slubs, loops, a crushed pile) needs a tile wide enough not to show it repeating
  const [nx, ny] = tileThreads(weave, warp, weft, !!(slub || loops || pile));
  const R = {
    name: s.preset || 'custom', title: base.title || 'custom cloth', weave, warp: W, weft: F, threadMm, nx, ny,
    pile, slub, loops, martindale: pick('martindale', null), rollMm: pick('rollMm', 1400),
    est: s.martindale === undefined && base.martindale !== undefined,
    // a cloth whose warp and weft orders differ looks different turned on its side (railroaded)
    directional: !sameOrder(warp, weft),
  };
  R.tileMm = [nx * threadMm, ny * threadMm].map((v) => Math.round(v * 1e4) / 1e4);
  // the pattern's repeat, what a cutter matches: only a colour order has one, and a small one hides a mismatch
  const colourX = warp.length > 1 ? W.length * threadMm : 0, colourY = weft.length > 1 ? F.length * threadMm : 0;
  R.repeatMm = [colourX, colourY].map((v) => Math.round(v * 10) / 10);
  R.match = Math.max(colourX, colourY) >= 25;
  R.nap = R.pile;
  R.meanRgb = meanOf(R);
  R.lightness = lum(R.meanRgb);
  return R;
}

/** Is the warp on top at crossing (i, j)? i counts warp threads (across the cloth), j weft picks (along it). */
export function warpUp(weave, i, j) {
  const mod = (a, n) => ((a % n) + n) % n;
  switch (weave.kind) {
    case 'plain': return mod(i + j, 2) === 0;
    case 'basket': return mod((i >> 1) + (j >> 1), 2) === 0;
    case 'satin': return mod(2 * i - j, 5) !== 0;                          // warp-faced: one weft float in five
    case 'twill': return mod(i + j, weave.o + weave.u) < weave.o;
    default: {                                                            // herringbone: the twill turns, a thread off
      const n = weave.o + weave.u, a = mod(i, 2 * weave.k);
      return a < weave.k ? mod(a + j, n) < weave.o : mod(-a + j + weave.o, n) < weave.o;
    }
  }
}

/** The colour on top at crossing (i, j) → [r, g, b]. */
export const cellRgb = (R, i, j) => (warpUp(R.weave, i, j) ? R.warp[i % R.warp.length] : R.weft[j % R.weft.length]);

function meanOf(R) {
  const acc = [0, 0, 0]; const n = R.nx * R.ny;
  for (let j = 0; j < R.ny; j++) for (let i = 0; i < R.nx; i++) { const c = cellRgb(R, i, j); acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; }
  const k = R.pile ? 0.82 : 0.92;                                         // the shade between threads (a pile swallows more)
  return acc.map((v) => Math.round((v / n) * k));
}
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

// ── the tile ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const FABRIC_TEXTURE_PREFIX = 'fabric:';
const b64u = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
/** The canonical spec a key carries: what the draft needs, nothing else. */
const canon = (spec) => (typeof spec === 'string' ? { preset: spec } : Object.fromEntries(['preset', 'weave', 'warp', 'weft', 'threadMm', 'pile', 'slub', 'loops'].filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]])));
/** The texture key for a fabric spec, and the tile's size in metres → { key, tileM: [u, v] }. */
export function fabricTile(spec) {
  const R = resolveFabric(spec); if (!R) return null;
  return { key: FABRIC_TEXTURE_PREFIX + b64u(JSON.stringify(canon(spec))), tileM: R.tileMm.map((v) => v / 1000) };
}

const hash = (a, b, c) => { let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

/** Bake a fabric key → { rgb, nu, nv } (row 0 is the top of the image, uv's v = 1), or null. */
export function bakeFabricKey(key) {
  let spec; try { spec = JSON.parse(unb64u(key.slice(FABRIC_TEXTURE_PREFIX.length))); } catch { return null; }
  const R = resolveFabric(spec); if (!R) return null;
  const px = Math.max(1, Math.min(3, Math.floor(1024 / Math.max(R.nx, R.ny))));
  const nu = R.nx * px, nv = R.ny * px; const rgb = Buffer.alloc(nu * nv * 3);
  // a round thread: lit along its middle, shaded at its sides where it dips under its neighbour
  const across = px === 3 ? [0.8, 1, 0.8] : px === 2 ? [0.86, 1] : [0.92];
  const along = px === 3 ? [0.94, 1, 0.94] : px === 2 ? [0.97, 1] : [1];
  const slubW = Array.from({ length: R.nx }, (_, i) => 1 + R.slub * (hash(i, 7, 1) * 2 - 1)), slubF = Array.from({ length: R.ny }, (_, j) => 1 + R.slub * (hash(j, 11, 2) * 2 - 1));
  for (let y = 0; y < nv; y++) {
    const j = R.ny - 1 - Math.floor(y / px), b = y % px;               // image row 0 is the top: the last pick
    for (let x = 0; x < nu; x++) {
      const i = Math.floor(x / px), a = x % px;
      const up = warpUp(R.weave, i, j);
      let c = up ? R.warp[i % R.warp.length] : R.weft[j % R.weft.length];
      let s = up ? across[a] * along[b] * slubW[i] : across[b] * along[a] * slubF[j];
      if (R.loops) s *= 1 - R.loops * 0.5 + R.loops * hash(i >> 1, j >> 1, 3) * (0.6 + 0.4 * hash(i, j, 4));
      if (R.pile) s = 0.84 + 0.1 * hash(i >> 2, j >> 2, 5) + 0.04 * hash(i, j, 6);   // a pile hides the weave; it crushes in patches
      const k = (y * nu + x) * 3;
      rgb[k] = Math.max(0, Math.min(255, Math.round(c[0] * s))); rgb[k + 1] = Math.max(0, Math.min(255, Math.round(c[1] * s))); rgb[k + 2] = Math.max(0, Math.min(255, Math.round(c[2] * s)));
    }
  }
  return { rgb, nu, nv };
}

const URLS = new Map(); const MAX_URLS = 32;
export function resolveFabricTexture(key) {
  if (URLS.has(key)) return URLS.get(key);
  const b = bakeFabricKey(key); if (!b) return null;
  const url = `data:image/png;base64,${encodePng(b.rgb, b.nu, b.nv).toString('base64')}`;
  URLS.set(key, url); if (URLS.size > MAX_URLS) URLS.delete(URLS.keys().next().value);
  return url;
}
registerTextureResolver(FABRIC_TEXTURE_PREFIX, resolveFabricTexture);

// ── ink ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A colour's ink tone: 0 white, 1 hatched, 2 cross-hatched, 3 black. */
export const inkTone = (rgb) => { const L = lum(rgb); return L < 0.2 ? 3 : L < 0.4 ? 2 : L < 0.64 ? 1 : 0; };

const r3 = (v) => Math.round(v * 1000) / 1000;
/** Runs of equal colour in a thread order → [{ rgb, from, n }]. */
const runs = (threads) => { const out = []; threads.forEach((c, i) => { const l = out[out.length - 1]; if (l && l.rgb === c) l.n++; else out.push({ rgb: c, from: i, n: 1 }); }); return out; };

/**
 * fabricSvg(spec, { widthMm, heightMm, scale, ink }) → an SVG swatch of the cloth. `scale` 1 draws it at true size
 * (the root's width and height are in mm, so it prints at size); 4 magnifies it four times. `ink`:
 *   'colour' — the cloth;
 *   'draft'  — the weaver's black and white: black where the warp is up;
 *   'tone'   — each thread colour as white, hatched, cross-hatched or black, in one ink.
 * Built from bands, not cells: the weft's colour bands, then the warp's, shown only where the warp is up (a mask
 * tiled from the weave's repeat) — a tartan is a few dozen rects, whatever its size.
 */
export function fabricSvg(spec, { widthMm = 100, heightMm = 100, scale = 1, ink = 'colour', id = 'f' } = {}) {
  const R = resolveFabric(spec); if (!R) return null;
  const t = R.threadMm * scale; const W = widthMm, H = heightMm;
  const defs = []; const body = [];
  // the weave's up-mask, one repeat of the weave
  const mask = []; for (let j = 0; j < R.weave.ry; j++) for (let i = 0; i < R.weave.rx; i++) if (warpUp(R.weave, i, j)) mask.push(`M${r3(i * t)} ${r3((R.weave.ry - 1 - j) * t)}h${r3(t)}v${r3(t)}h${r3(-t)}z`);
  const hatchDefs = () => {
    const s = Math.max(0.5, Math.min(1.2, 0.9 * scale)); const w = r3(0.18 * Math.min(1.5, scale));
    return `<pattern id="${id}-h1" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${s}" stroke="#000" stroke-width="${w}"/></pattern>`
      + `<pattern id="${id}-h2" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V${s}M0 0H${s}" stroke="#000" stroke-width="${w}"/></pattern>`;
  };
  const fillOf = (rgb) => {
    if (ink === 'colour') return rgbHex(rgb);
    const k = inkTone(rgb); return k === 3 ? '#000' : k === 2 ? `url(#${id}-h2)` : k === 1 ? `url(#${id}-h1)` : 'none';
  };
  if (ink === 'tone') defs.push(hatchDefs());
  if (ink === 'draft') {
    defs.push(`<pattern id="${id}-w" width="${r3(R.weave.rx * t)}" height="${r3(R.weave.ry * t)}" patternUnits="userSpaceOnUse"><path d="${mask.join('')}" fill="#000"/></pattern>`);
    body.push(`<rect width="${W}" height="${H}" fill="#fff"/><rect width="${W}" height="${H}" fill="url(#${id}-w)"/>`);
    // a grid every thread when magnified, so the draft reads as squares
    if (scale >= 3) { const g = []; for (let x = 0; x <= W; x += t) g.push(`M${r3(x)} 0V${H}`); for (let y = 0; y <= H; y += t) g.push(`M0 ${r3(y)}H${W}`); body.push(`<path d="${g.join('')}" stroke="#000" stroke-width="0.05" fill="none"/>`); }
  } else {
    const tw = r3(R.nx * t), th = r3(R.ny * t);
    const tileWeft = Array.from({ length: R.ny }, (_, j) => R.weft[j % R.weft.length]), tileWarp = Array.from({ length: R.nx }, (_, i) => R.warp[i % R.warp.length]);
    const weftBands = runs(tileWeft).map((r) => [r, fillOf(r.rgb)]).filter(([, f]) => f !== 'none').map(([r, f]) => `<rect x="0" y="${r3((R.ny - r.from - r.n) * t)}" width="${tw}" height="${r3(r.n * t)}" fill="${f}"/>`);
    const warpBands = runs(tileWarp).map((r) => [r, fillOf(r.rgb)]).map(([r, f]) => `<rect x="${r3(r.from * t)}" y="0" width="${r3(r.n * t)}" height="${th}" fill="${f === 'none' ? '#fff' : f}"/>`);
    defs.push(`<pattern id="${id}-weft" width="${tw}" height="${th}" patternUnits="userSpaceOnUse">${weftBands.join('')}</pattern>`);
    defs.push(`<pattern id="${id}-warp" width="${tw}" height="${th}" patternUnits="userSpaceOnUse">${warpBands.join('')}</pattern>`);
    defs.push(`<pattern id="${id}-up" width="${r3(R.weave.rx * t)}" height="${r3(R.weave.ry * t)}" patternUnits="userSpaceOnUse"><path d="${mask.join('')}" fill="#fff"/></pattern>`);
    defs.push(`<mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${id}-up)"/></mask>`);
    body.push(`<rect width="${W}" height="${H}" fill="#fff"/><rect width="${W}" height="${H}" fill="url(#${id}-weft)"/><rect width="${W}" height="${H}" fill="url(#${id}-warp)" mask="url(#${id}-m)"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

/** The report row for a cloth. */
export function fabricSummary(R) {
  return {
    name: R.name, title: R.title, weave: R.weave.kind === 'twill' ? `twill-${R.weave.o}/${R.weave.u}` : R.weave.kind, threadMm: R.threadMm,
    repeatMm: R.repeatMm, match: R.match, directional: R.directional, nap: R.nap, mean: rgbHex(R.meanRgb),
    ...(R.martindale ? { martindale: R.martindale, ...(R.est ? { est: true } : {}) } : {}),
  };
}
