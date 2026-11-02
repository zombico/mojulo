/**
 * THE VISUAL GATE (the engine handoff's machine gate on the picture): a level's shots rendered on the World page and in
 * each engine the handoff reaches, scored per shot per engine, reported. Advisory, like every gate: it measures and
 * stamps, it refuses nothing, and it never says how a level looks (the eyes gate is the operator's: the page and each
 * engine at the same camera, opened and read by a person).
 *
 * This module is the gate's arithmetic and its report, plain Node (no browser, no engine): the drivers that render the
 * shots are visual-gate-run.js.
 *
 *   gateShots(level, { payload?, poses?, size? }) → [{ name, source, at, look, yfov, w, h }]: what the gate shoots, in
 *     mojulo's frame (z-up metres, yfov in radians): the level record's camera markers (handoff.js levelRecord: `at`,
 *     `look`, `yfov`), each shot of the level's shoot plan where it has one (its camera at the shot's first frame, its
 *     lens as the GLB's shot cameras carry it: the horizontal fov over the viewBox's aspect), then any explicit `poses`
 *     ({ name?, pos | at, target | look, vfov (degrees) | yfov (radians) }). Every shot at one size (1280×720), the
 *     vertical fov held: an engine and the page frame the same pose at the same aspect. A name is the shot's own, and so
 *     is its file's (shotKey): one taken, as a name or as a file's, takes the next free suffix (-2, -3, …)
 *   decodeImage(png) → { W, H, rgb }: an 8-bit PNG (grey, RGB or with alpha, the alpha over black) as RGB bytes
 *   compareImages(page, engine, { grid? }) → the scores of one engine's still against the page's (both decoded):
 *     ssim       the structural similarity of their luminance (Wang et al. 2004: an 11-tap Gaussian window, σ 1.5, K1
 *                0.01, K2 0.03), on both images box-filtered by round(min(W, H) / 256) as Wang's reference code does, so
 *                a renderer's own anti-aliasing reads as the same structure; 1 identical, about 0 unrelated
 *     deltaE     CIEDE2000 between them, pixel by pixel on the same filtered grid (sRGB, D65): { mean, p95, max };
 *                0 identical, about 2 just noticeable side by side, over 10 a different colour
 *     regions    the frame cut in a grid (4 × 3): each cell's SSIM and mean ΔE, and its mean colour on each side
 *     worst      the cell with the largest mean ΔE
 *     blank      either image nearly flat (its luminance's deviation under 2 levels): a render that drew nothing
 *     maps       the per-cell maps (SSIM and ΔE on the filtered grid), for the heat map
 *   deltaE2000(lab1, lab2), srgbToLab(r, g, b): the colour difference, exported for its test
 *   shotLine(shot, scores) → one summary line per shot; gateReport(...) → the report (JSON-able); contactSheet(report,
 *     images) → one self-contained HTML page: the page beside each engine per shot, its scores, a ΔE heat map
 */
import { decodePng } from '../era/tone.js';
import { encodePng } from '../landscape/surface-textures.js';

export const VISUAL_GATE_VERSION = 'visual-gate/0';
export const GATE_SIZE = Object.freeze({ width: 1280, height: 720 });
export const GATE_ENGINES = Object.freeze(['godot', 'blender', 'unreal', 'unity']);
/** The frame cut into this many cells (columns, rows) for the region scores. */
export const GATE_GRID = Object.freeze([4, 3]);
/** A still whose luminance deviates less than this (8-bit levels) drew nothing worth scoring. */
export const BLANK_SIGMA = 2;

/**
 * The levels the gate is run on by name (the CLI's --fixture, its Godot leg): the handoff's own test levels, each with the
 * poses it adds to its camera markers (the trail's close shot is phase 7's: the spawn's slope, the cliff band and the
 * path; the bay's looks back across the room at its other walls; the couch has no camera marker of its own).
 */
export const GATE_FIXTURES = Object.freeze({
  trail: { sketch: { ref: 'sk_trail', title: 'trail', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 1 } },
    poses: [{ name: 'close', pos: [-5, -5, 5.5], target: [8, 8, 1.5], vfov: 50 }] },
  bay: { sketch: { ref: 'sk_bay', title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } },
    poses: [{ name: 'corner', pos: [5.4, 7.4, 2.6], target: [1, 1.5, 1], vfov: 60 }] },
  couch: { sketch: { ref: 'sk_couch', title: 'couch', manifest: { kind: 'controllable', title: 'couch', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#a0b0c0', group: 'floor' }],
    figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
    entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [3, 0, 0.5] } },
      { id: 'grunt', rule: { type: 'ai' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [6, 2, 0.5] } }],
    seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } } },
    poses: [{ name: 'side', pos: [2, -12, 5], target: [3, 0, 0.8], vfov: 45 }] },
});

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const v3 = (v) => (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fin) ? [v[0], v[1], v[2]] : null);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const DEG = Math.PI / 180;

// ---- the shots ----------------------------------------------------------------------------------------------------

// (a lowered shoot plan's camera track at world time t: shoot/plan.js lowerShoot's `track`, sampled as the GLB's shot
// cameras sample it, scene-gltf-level.js shootCameraDefs)
function trackAt(tr, t) {
  const f = Math.max(0, Math.min(tr.n - 1, (t - tr.t0) * tr.fps));
  const i = Math.min(Math.max(0, tr.n - 2), Math.floor(f)), j = Math.min(tr.n - 1, i + 1), a = tr.n > 1 ? f - i : 0;
  const L = (arr, d, k) => arr[i * d + k] + (arr[j * d + k] - arr[i * d + k]) * a;
  return { pos: [L(tr.pos, 3, 0), L(tr.pos, 3, 1), L(tr.pos, 3, 2)], look: [L(tr.look, 3, 0), L(tr.look, 3, 1), L(tr.look, 3, 2)], hfov: L(tr.hfov, 1, 0) };
}

/** A shot's name made a file's (its stills are `<key>.<who>.png`): gateShots keeps every shot's key its own. */
export const shotKey = (name) => String(name).replace(/[^A-Za-z0-9_-]+/g, '_');

export function gateShots(level, { payload = null, poses = [], size = GATE_SIZE } = {}) {
  const out = [], taken = new Set();
  const add = (name, source, at, look, yfov) => {
    if (!at || !look || !fin(yfov) || !(yfov > 0 && yfov < Math.PI) || Math.hypot(look[0] - at[0], look[1] - at[1], look[2] - at[2]) < 1e-6) return;
    // (a name taken, or one whose file another's already is, `shot:a` and `shot_a`, takes the next free -2, -3, …)
    let as = name;
    for (let n = 2; taken.has(shotKey(as)); n++) as = `${name}-${n}`;
    taken.add(shotKey(as));
    out.push({ name: as, source, at, look, yfov, w: size.width, h: size.height });
  };
  for (const m of level?.markers ?? []) {
    if (m?.kind !== 'camera') continue;
    add(String(m.name).replace(/^camera:/, ''), 'camera', v3(m.at), v3(m.look), m.yfov);
  }
  const shoot = payload?.shoot;
  if (shoot && Array.isArray(shoot.shots) && Array.isArray(shoot.cameras)) {
    const vb = payload.viewBox && fin(payload.viewBox.width) && fin(payload.viewBox.height) ? payload.viewBox : { width: 1120, height: 780 };
    const aspect = vb.width / vb.height;
    for (const s of shoot.shots) {
      const cam = shoot.cameras.find((c) => c.id === s.camera), tr = cam?.track;
      if (!tr || !tr.n || !Array.isArray(s.span)) continue;
      const v = trackAt(tr, s.span[0]);
      add(`shot:${s.name ?? s.camera}`, 'shot', v3(v.pos), v3(v.look), 2 * Math.atan(Math.tan((v.hfov * DEG) / 2) / aspect));
    }
  }
  poses.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const yfov = fin(p.yfov) ? p.yfov : fin(p.vfov) ? p.vfov * DEG : null;
    add(typeof p.name === 'string' && p.name ? p.name : `pose-${i + 1}`, 'pose', v3(p.pos ?? p.at), v3(p.target ?? p.look), yfov);
  });
  return out;
}

// ---- images -------------------------------------------------------------------------------------------------------

/** An 8-bit PNG → { W, H, rgb }; its alpha, if any, over black. Null for what decodePng cannot read (16-bit, interlaced). */
export function decodeImage(png) {
  const d = decodePng(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
  if (!d) return null;
  const { px, W, H } = d, rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < W * H * 4; i += 4, j += 3) {
    const a = px[i + 3];
    if (a === 255) { rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2]; } else {
      rgb[j] = Math.round((px[i] * a) / 255); rgb[j + 1] = Math.round((px[i + 1] * a) / 255); rgb[j + 2] = Math.round((px[i + 2] * a) / 255);
    }
  }
  return { W, H, rgb };
}

/** An image box-filtered by an integer factor (the trailing partial cells dropped), as floats. */
export function boxDown(img, f) {
  const W = Math.floor(img.W / f), H = Math.floor(img.H / f), out = new Float32Array(W * H * 3), k = 1 / (f * f);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const s = ((y * f + dy) * img.W + (x * f + dx)) * 3;
      r += img.rgb[s]; g += img.rgb[s + 1]; b += img.rgb[s + 2];
    }
    const o = (y * W + x) * 3; out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k;
  }
  return { W, H, rgb: out };
}

// (an image resampled to W × H, bilinear: an engine still at another size scored on the page's grid)
function resample(img, W, H) {
  if (img.W === W && img.H === H) return img;
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(img.W - 1, Math.max(0, ((x + 0.5) * img.W) / W - 0.5)), sy = Math.min(img.H - 1, Math.max(0, ((y + 0.5) * img.H) / H - 0.5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(img.W - 1, x0 + 1), y1 = Math.min(img.H - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
    for (let c = 0; c < 3; c++) {
      const p = (xx, yy) => img.rgb[(yy * img.W + xx) * 3 + c];
      out[(y * W + x) * 3 + c] = Math.round((p(x0, y0) * (1 - fx) + p(x1, y0) * fx) * (1 - fy) + (p(x0, y1) * (1 - fx) + p(x1, y1) * fx) * fy);
    }
  }
  return { W, H, rgb: out };
}

// ---- colour -------------------------------------------------------------------------------------------------------

const LIN = new Float64Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const linOf = (v) => { const c = Math.max(0, Math.min(255, v)); const i = Math.floor(c); return i >= 255 ? LIN[255] : LIN[i] + (LIN[i + 1] - LIN[i]) * (c - i); };
const labF = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** 8-bit sRGB (may be fractional) → CIELAB under D65. */
export function srgbToLab(r, g, b) {
  const R = linOf(r), G = linOf(g), B = linOf(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B, Z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const fx = labF(X), fy = labF(Y), fz = labF(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 (Sharma, Wu and Dalal 2005), kL = kC = kH = 1. */
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb7 = ((C1 + C2) / 2) ** 7, P7 = 6103515625;   // 25^7
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + P7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / DEG; return h < 0 ? h + 360 : h; };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * DEG) + 0.24 * Math.cos(2 * hbp * DEG) + 0.32 * Math.cos((3 * hbp + 6) * DEG) - 0.2 * Math.cos((4 * hbp - 63) * DEG);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), Cbp7 = Cbp ** 7, Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + P7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * DEG) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// ---- structure ----------------------------------------------------------------------------------------------------

const GAUSS = (() => { const k = [], s = 1.5; let t = 0; for (let i = -5; i <= 5; i++) { const v = Math.exp(-(i * i) / (2 * s * s)); k.push(v); t += v; } return k.map((v) => v / t); })();
// (a map filtered by the window, separably, its edges clamped: the result the map's size)
function gaussian(src, W, H) {
  const tmp = new Float64Array(W * H), out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0; for (let k = -5; k <= 5; k++) s += GAUSS[k + 5] * src[y * W + Math.min(W - 1, Math.max(0, x + k))];
    tmp[y * W + x] = s;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0; for (let k = -5; k <= 5; k++) s += GAUSS[k + 5] * tmp[Math.min(H - 1, Math.max(0, y + k)) * W + x];
    out[y * W + x] = s;
  }
  return out;
}
const luma = (img) => { const n = img.W * img.H, Y = new Float64Array(n); for (let i = 0; i < n; i++) Y[i] = 0.2126 * img.rgb[i * 3] + 0.7152 * img.rgb[i * 3 + 1] + 0.0722 * img.rgb[i * 3 + 2]; return Y; };

/** SSIM's per-pixel map of two equal-size images' luminance. */
export function ssimMap(a, b) {
  const { W, H } = a, X = luma(a), Y = luma(b), n = W * H;
  const XX = new Float64Array(n), YY = new Float64Array(n), XY = new Float64Array(n);
  for (let i = 0; i < n; i++) { XX[i] = X[i] * X[i]; YY[i] = Y[i] * Y[i]; XY[i] = X[i] * Y[i]; }
  const mx = gaussian(X, W, H), my = gaussian(Y, W, H), sxx = gaussian(XX, W, H), syy = gaussian(YY, W, H), sxy = gaussian(XY, W, H);
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vx = Math.max(0, sxx[i] - mx[i] * mx[i]), vy = Math.max(0, syy[i] - my[i] * my[i]), cxy = sxy[i] - mx[i] * my[i];
    out[i] = ((2 * mx[i] * my[i] + C1) * (2 * cxy + C2)) / ((mx[i] * mx[i] + my[i] * my[i] + C1) * (vx + vy + C2));
  }
  return out;
}

const sigmaOf = (img) => { const Y = luma(img); let m = 0; for (const v of Y) m += v; m /= Y.length; let s = 0; for (const v of Y) s += (v - m) ** 2; return Math.sqrt(s / Y.length); };

// ---- the comparison -----------------------------------------------------------------------------------------------

export function compareImages(page, engine, { grid = GATE_GRID } = {}) {
  const resized = engine.W !== page.W || engine.H !== page.H;
  const e = resample(engine, page.W, page.H);
  const f = Math.max(1, Math.round(Math.min(page.W, page.H) / 256));
  const A = boxDown(page, f), B = boxDown(e, f), W = A.W, H = A.H, n = W * H;
  const S = ssimMap(A, B), D = new Float32Array(n);
  for (let i = 0; i < n; i++) D[i] = deltaE2000(srgbToLab(A.rgb[i * 3], A.rgb[i * 3 + 1], A.rgb[i * 3 + 2]), srgbToLab(B.rgb[i * 3], B.rgb[i * 3 + 1], B.rgb[i * 3 + 2]));
  const mean = (arr) => { let s = 0; for (const v of arr) s += v; return s / arr.length; };
  const sorted = Float32Array.from(D).sort();
  const [gc, gr] = grid, regions = [];
  for (let r = 0; r < gr; r++) for (let c = 0; c < gc; c++) {
    const x0 = Math.floor((c * W) / gc), x1 = Math.floor(((c + 1) * W) / gc), y0 = Math.floor((r * H) / gr), y1 = Math.floor(((r + 1) * H) / gr);
    let ss = 0, dd = 0, k = 0; const pa = [0, 0, 0], pb = [0, 0, 0];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x; ss += S[i]; dd += D[i]; k++;
      for (let q = 0; q < 3; q++) { pa[q] += A.rgb[i * 3 + q]; pb[q] += B.rgb[i * 3 + q]; }
    }
    regions.push({ cell: `r${r + 1}c${c + 1}`, box: [x0 * f, y0 * f, x1 * f, y1 * f], ssim: r4(ss / k), deltaE: r4(dd / k),
      page: pa.map((v) => Math.round(v / k)), engine: pb.map((v) => Math.round(v / k)) });
  }
  const worst = regions.reduce((w, x) => (x.deltaE > w.deltaE ? x : w), regions[0]);
  const sp = sigmaOf(page), se = sigmaOf(e);
  return {
    ssim: r4(mean(S)),
    deltaE: { mean: r4(mean(D)), p95: r4(sorted[Math.min(n - 1, Math.floor(n * 0.95))]), max: r4(sorted[n - 1]) },
    regions, worst,
    blank: { page: sp < BLANK_SIGMA, engine: se < BLANK_SIGMA, sigma: { page: r4(sp), engine: r4(se) } },
    scale: f, ...(resized ? { resized: [engine.W, engine.H] } : {}),
    maps: { W, H, ssim: S, deltaE: D },
  };
}

// ---- the report ---------------------------------------------------------------------------------------------------

const deg = (r) => Math.round((r / DEG) * 100) / 100;
const p3 = (v) => `[${v.map((x) => Math.round(x * 100) / 100).join(', ')}]`;

/** One line per shot: each engine's SSIM, mean ΔE and its worst cell. */
export function shotLine(shot, scores) {
  const parts = Object.entries(scores).map(([eng, s]) => (s.scores
    ? `${eng} SSIM ${s.scores.ssim.toFixed(3)} ΔE ${s.scores.deltaE.mean.toFixed(1)} (worst ${s.scores.worst.cell} ΔE ${s.scores.worst.deltaE.toFixed(1)})${s.scores.blank.engine ? ' BLANK' : ''}`
    : `${eng} ${s.skipped ? `skipped (${s.skipped})` : `no still (${s.error ?? 'unknown'})`}`));
  return `${shot.name.padEnd(12)} ${parts.join(' · ')}`;
}

/**
 * The gate's report: what it shot, how the page framed it, each engine's run and each shot's scores (the maps left
 * out), and a line per shot. `engines`: { <engine>: { ran, skipped?, error?, bin?, ms? } }; `scores`: { <shot>: {
 * <engine>: compareImages' result | { skipped } | { error } } }.
 */
export function gateReport({ sketch, shots, page, engines, scores, size = GATE_SIZE, files = {} }) {
  const strip = (s) => (s && s.maps ? (({ maps: _m, ...rest }) => rest)(s) : s);
  return {
    version: VISUAL_GATE_VERSION, gate: 'machine', advisory: true,
    eyes: 'not run: the eyes gate is the operator opening the page and each engine at the same camera',
    ref: sketch?.ref ?? null, title: sketch?.title ?? null, size: { width: size.width, height: size.height },
    page: { ran: !!page?.ran, ...(page?.skipped ? { skipped: page.skipped } : {}), ...(page?.error ? { error: page.error } : {}), ...(page?.ms ? { ms: page.ms } : {}) },
    engines,
    shots: shots.map((s) => ({
      name: s.name, source: s.source, at: s.at, look: s.look, yfov: s.yfov, vfovDeg: deg(s.yfov),
      ...(page?.framing?.[s.name] ? { framing: page.framing[s.name] } : {}),
      files: files[s.name] ?? {},
      engines: Object.fromEntries(Object.entries(scores[s.name] ?? {}).map(([e, v]) => [e, v.scores ? strip(v.scores) : v])),
    })),
    lines: shots.map((s) => shotLine(s, scores[s.name] ?? {})),
  };
}

// ---- the contact sheet --------------------------------------------------------------------------------------------

// (ΔE 0 → 30 as a dark-to-bright heat ramp, roughly inferno)
const RAMP = [[0, [0, 0, 4]], [3, [40, 11, 84]], [6, [101, 21, 110]], [10, [159, 42, 99]], [15, [212, 72, 66]], [21, [245, 125, 21]], [30, [250, 193, 39]], [45, [252, 255, 164]]];
export function heatColour(d) {
  if (d <= 0) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    const [d1, c1] = RAMP[i], [d0, c0] = RAMP[i - 1];
    if (d <= d1) { const t = (d - d0) / (d1 - d0); return c0.map((v, k) => Math.round(v + (c1[k] - v) * t)); }
  }
  return RAMP[RAMP.length - 1][1];
}
/** The ΔE map as a PNG (its own grid's size). */
export function heatPng(maps) {
  const { W, H, deltaE } = maps, rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) rgb.set(heatColour(deltaE[i]), i * 3);
  return encodePng(rgb, W, H);
}
/** An image halved as many times as it takes to be at most `max` wide, as a PNG (the sheet's thumbnail). */
export function thumbPng(img, max = 640) {
  let f = 1; while (img.W / f > max) f *= 2;
  const d = f > 1 ? boxDown(img, f) : img, rgb = Buffer.from(Uint8Array.from(d.rgb, (v) => Math.round(v)));
  return encodePng(rgb, d.W, d.H);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dataUrl = (png) => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
const fmt = (v, d) => (fin(v) ? v.toFixed(d) : '–');

/**
 * The contact sheet: one self-contained page. `images`: { <shot>: { page: png thumb, <engine>: { thumb, heat } } }
 * (PNG bytes); `links`: { <shot>: { page: path, <engine>: path } } relative to the sheet, to open the full stills.
 */
export function contactSheet(report, images, links = {}) {
  const engines = Object.keys(report.engines);
  const cell = (s, e) => { const v = s.engines[e]; return v && v.ssim !== undefined ? `<td><b>${fmt(v.ssim, 3)}</b><br><span>ΔE ${fmt(v.deltaE.mean, 1)}</span></td>` : `<td class="na">${esc(v?.skipped ? 'skipped' : v?.error ? 'no still' : '–')}</td>`; };
  const summary = `<table class="sum"><tr><th>shot</th>${engines.map((e) => `<th>${esc(e)}</th>`).join('')}</tr>${report.shots.map((s) => `<tr><th>${esc(s.name)}</th>${engines.map((e) => cell(s, e)).join('')}</tr>`).join('')}</table>`;
  const engineRows = engines.map((e) => { const r = report.engines[e]; return `<li><b>${esc(e)}</b>: ${r.ran ? `rendered${r.ms ? ` in ${Math.round(r.ms / 1000)} s` : ''}` : esc(r.skipped ? `skipped: ${r.skipped}` : `failed: ${r.error ?? '?'}`)}${r.version ? ` (${esc(r.version)})` : ''}</li>`; }).join('');
  const shotBlock = (s) => {
    const im = images[s.name] ?? {}, ln = links[s.name] ?? {};
    const fig = (label, png, href, body = '') => `<figure>${png ? `${href ? `<a href="${esc(href)}">` : ''}<img src="${dataUrl(png)}" alt="${esc(label)}">${href ? '</a>' : ''}` : '<div class="none">no still</div>'}<figcaption>${label}${body}</figcaption></figure>`;
    const eng = engines.map((e) => {
      const v = s.engines[e], I = im[e] ?? {};
      if (!v || v.ssim === undefined) return fig(`${esc(e)}`, null, null, `<br><span>${esc(v?.skipped ? `skipped: ${v.skipped}` : v?.error ?? 'no still')}</span>`);
      const regs = v.regions.map((r) => `<td title="page ${r.page.join(',')} · ${esc(e)} ${r.engine.join(',')}"${r.cell === v.worst.cell ? ' class="worst"' : ''}>${fmt(r.deltaE, 1)}</td>`);
      const rows = []; for (let k = 0; k < regs.length; k += 4) rows.push(`<tr>${regs.slice(k, k + 4).join('')}</tr>`);
      return `<div class="eng">${fig(esc(e), I.thumb, ln[e], ` · SSIM <b>${fmt(v.ssim, 3)}</b> · ΔE <b>${fmt(v.deltaE.mean, 1)}</b> (p95 ${fmt(v.deltaE.p95, 1)})${v.blank.engine ? ' · <b class="bad">blank</b>' : ''}`)}
${fig('ΔE heat (0 dark → 30+ bright)', I.heat, null, ` · worst ${esc(v.worst.cell)}: page ${v.worst.page.join(',')} / ${esc(e)} ${v.worst.engine.join(',')}`)}
<table class="grid" aria-label="mean ΔE per cell">${rows.join('')}</table></div>`;
    }).join('\n');
    return `<section><h2>${esc(s.name)} <small>${esc(s.source)} · at ${p3(s.at)} → ${p3(s.look)} · vfov ${s.vfovDeg}°${s.framing ? ` · page framed ${s.framing.width}×${s.framing.height}, aspect ${fmt(s.framing.aspect, 4)}, fov ${fmt(s.framing.fov, 3)}°` : ''}</small></h2>
<div class="row"><div class="eng">${fig('the World page', im.page, ln.page)}</div>
${eng}</div></section>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual gate ${esc(report.title ?? report.ref ?? '')}</title>
<style>
:root{--bg:#f6f5f2;--fg:#1d1d1b;--mute:#6b6a66;--line:#dad8d2;--card:#fff;--bad:#b3261e;--hi:#fde7c2}
@media (prefers-color-scheme: dark){:root{--bg:#141413;--fg:#e9e7e1;--mute:#9c9a93;--line:#34332f;--card:#1d1d1b;--bad:#ff8a80;--hi:#4a3a12}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
main{max-width:1600px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px}h2 small{font-weight:400;color:var(--mute);font-size:12px}
p,li{color:var(--mute)}b{color:var(--fg)}
.row{display:flex;flex-wrap:wrap;gap:12px}.eng{flex:1 1 300px;max-width:400px;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px}
figure{margin:0 0 6px}img{width:100%;display:block;border-radius:3px}figcaption{font-size:12px;color:var(--mute);margin-top:3px}
.none{aspect-ratio:16/9;display:grid;place-items:center;color:var(--mute);border:1px dashed var(--line)}
table{border-collapse:collapse;font-variant-numeric:tabular-nums}.sum td,.sum th{border:1px solid var(--line);padding:4px 10px;text-align:center}.sum td span{color:var(--mute);font-size:12px}
.grid{width:100%;font-size:11px}.grid td{border:1px solid var(--line);text-align:center;padding:1px}.grid td.worst{background:var(--hi)}
.na{color:var(--mute)}.bad{color:var(--bad)}
</style></head><body><main>
<h1>Visual gate: ${esc(report.title ?? report.ref ?? 'level')}</h1>
<p>The machine gate (advisory): each shot rendered on the World page and in each engine at the same pose, vertical fov and ${report.size.width}×${report.size.height} frame, scored by SSIM on luminance (1 = the same structure) and mean CIEDE2000 ΔE (0 = the same colour; about 2 is just noticeable). It measures, it never refuses, and it says nothing about how the level looks: that is the eyes gate, the operator's.</p>
<ul>${engineRows}</ul>
${summary}
${report.shots.map(shotBlock).join('\n')}
</main></body></html>
`;
}
