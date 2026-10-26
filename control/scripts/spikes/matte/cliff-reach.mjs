#!/usr/bin/env node
/**
 * SPIKE: the near cliff painted like the stone block. On a gritty island (valley-morning, grit 0.7, the land's facets
 * merged), the cliff faces a walker can reach (within REACH m of the walk) are grouped into their facets, and each facet
 * is matte-painted from its own geometry: its outline (the union of its quads, projected on its plane), the rock's fabric
 * (the same joint planes the page's shader draws, cut through this face), chips where its outline is an arris, the rock
 * field's grain at its true 3D position, lit by the cube's sun in the facet's own frame. Each painting is a DETAIL
 * texture (its mean `M`), the facet's vertex colours lifted by 1/M; mipmaps carry it back to the polygons' look from
 * afar. Far faces keep the shader's fabric, farther the polygons.
 *
 *   cd control && node scripts/spikes/matte/cliff-reach.mjs  → ../lite-template/integration/1020/spike-output/matte/cliff-reach-*.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { GEOCUBE_PALETTES } = await import('../../../lib/graph/era/geocube.js');
const { rockField } = await import('../../../lib/graph/polygonizer/rock-fracture.js');
const { lightRelief } = await import('../../../lib/graph/matte-paint/light.js');
const { gnoise2, fractal2, smoothstep } = await import('../../../lib/graph/noise/noise.js');
const { hash01 } = await import('../../../lib/graph/matte-paint/relief.js');
const { encodePng } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const REACH = 6, PPM = 96, M = 0.72, MAXTEX = 640;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), srgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), rgb2hex = (c) => `#${c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
const lift = (h) => rgb2hex(hex2(h).map((v) => srgb(Math.min(1, lin(v) / M))));

const cube = { from: 'valley-morning', palette: { ...GEOCUBE_PALETTES['valley-morning'], seed: 3 }, grit: 0.7, outside: { land: { smooth: true, crevice: 0.6, ridge: 0.35, blend: 0.6, facet: 3 } } };
const t0 = Date.now();
const { payload } = await resolveWorldScene({ title: 'cliff reach', manifest: { kind: 'geocube', cube, show: 'land', walk: false } });
const tLand = Date.now() - t0;
const F = payload.fabric;
if (!F) throw new Error('no fabric on the gritty land');

// the walkable points: the trail's corners and the spawn
const walkPts = payload.faces.filter((f) => f.group === 'isekai:trail').flatMap((f) => f.corners);
if (payload.walk && payload.walk.spawn) walkPts.push(payload.walk.spawn);
const cliffIdx = payload.faces.map((f, i) => [f, i]).filter(([f]) => f.group === 'isekai:cliff');
const near = (p) => walkPts.some((w) => (w[0] - p[0]) ** 2 + (w[1] - p[1]) ** 2 + (w[2] - p[2]) ** 2 < REACH * REACH);
const reach = cliffIdx.filter(([f]) => f.corners.some(near));
console.log(`land ${tLand} ms · ${payload.faces.length} faces · ${cliffIdx.length} cliff quads · walk points ${walkPts.length} · reachable cliff quads ${reach.length}`);

// facets: reachable quads joined through shared corners when their normals agree
const key = (c) => c.map((v) => Math.round(v * 100)).join(',');
const parent = reach.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const byCorner = new Map();
reach.forEach(([f], i) => f.corners.forEach((c) => { const k = key(c); if (!byCorner.has(k)) byCorner.set(k, []); byCorner.get(k).push(i); }));
for (const list of byCorner.values()) for (let a = 1; a < list.length; a++) {
  const i = list[0], j = list[a];
  if (dot(reach[i][0].normal, reach[j][0].normal) > 0.985) parent[find(j)] = find(i);
}
const groups = new Map();
reach.forEach((_, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
const facets = [...groups.values()].filter((g) => g.length >= 2);
console.log(`${facets.length} facets of 2+ quads (${groups.size} in all)`);

// the rock's fabric, as the shader draws it, here on the CPU: a shallow groove where a set's plane cuts the face
function fabricZ(p) {
  let z = 0, tilt = [0, 0, 0];
  F.sets.forEach((S, i) => {
    let tg = cross(S.n, [0, 0, 1]); tg = dot(tg, tg) < 1e-4 ? [1, 0, 0] : unit(tg);
    const q0 = dot(p, S.n) / S.s + S.phase, seg = Math.floor((dot(p, tg) + p[2] * 0.7) / (S.s * 0.8));
    const q = q0 + F.wave * gnoise2(dot(p, tg) / (S.s * 0.8), p[2] / (S.s * 0.8), 31 + i) * 0.5 + F.echelon * (hash01(Math.floor(q0), seg, 71 + i) - 0.5);
    const cell = Math.floor(q), fr = q - cell, dist = Math.min(fr, 1 - fr) * S.s;
    const hold = hash01(cell, Math.floor((dot(p, tg) + p[2]) / (S.s * 1.4)), 91 + i) < S.hold;
    if (hold && dist < S.w) z -= S.d * (1 - dist / S.w);
    const r = [hash01(cell, i, 1) - 0.5, hash01(cell, i, 2) - 0.5, hash01(cell, i, 3) - 0.5];
    tilt = add(tilt, mul(r, F.tilt * 0.6));
  });
  return { z, tilt };
}

const rf = rockField({ size: 3, unit: 'm', rock: 'granite', seed: 7, octaves: 0 }), mean = hex2(rf.meanColor).map((v) => v * 255);
const sun = F.sun, textures = {};
let texels = 0, bytes = 0;
const tPaint0 = Date.now();
facets.forEach((g, fi) => {
  const faces = g.map((i) => reach[i][0]);
  // the facet's frame: its mean normal, a horizontal u along it, v up its face
  let n = [0, 0, 0], o = [0, 0, 0], cnt = 0;
  for (const f of faces) { n = add(n, f.normal); for (const c of f.corners) { o = add(o, c); cnt++; } }
  n = unit(n); o = mul(o, 1 / cnt);
  const u = Math.abs(n[2]) < 0.95 ? unit(cross([0, 0, 1], n)) : [1, 0, 0], v = cross(n, u);
  const proj = (c) => { const d = sub(c, o); return [dot(d, u), dot(d, v)]; };
  const polys = faces.map((f) => f.corners.map(proj));
  const all = polys.flat(), U0 = Math.min(...all.map((q) => q[0])), U1 = Math.max(...all.map((q) => q[0])), V0 = Math.min(...all.map((q) => q[1])), V1 = Math.max(...all.map((q) => q[1]));
  const ppm = Math.min(PPM, MAXTEX / Math.max(U1 - U0, V1 - V0)), px = 1 / ppm, W = Math.max(2, Math.ceil((U1 - U0) * ppm)), H = Math.max(2, Math.ceil((V1 - V0) * ppm));
  // coverage: inside any of the facet's quads
  const inQuad = (P, q) => { let s = 0; for (let k = 0; k < q.length; k++) { const a = q[k], b = q[(k + 1) % q.length], c = (b[0] - a[0]) * (P[1] - a[1]) - (b[1] - a[1]) * (P[0] - a[0]); if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } } return true; };
  const mask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const P = [U0 + (i + 0.5) * px, V1 - (j + 0.5) * px]; mask[j * W + i] = polys.some((q) => inQuad(P, q)) ? 1 : 0; }
  // the distance to the facet's outline, texels (two-pass chamfer)
  const D = new Float32Array(W * H).fill(1e9);
  for (let k = 0; k < W * H; k++) if (!mask[k]) D[k] = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (i > 0) D[k] = Math.min(D[k], D[k - 1] + 1); if (j > 0) D[k] = Math.min(D[k], D[k - W] + 1); if (i > 0 && j > 0) D[k] = Math.min(D[k], D[k - W - 1] + 1.414); if (i < W - 1 && j > 0) D[k] = Math.min(D[k], D[k - W + 1] + 1.414); }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (i < W - 1) D[k] = Math.min(D[k], D[k + 1] + 1); if (j < H - 1) D[k] = Math.min(D[k], D[k + W] + 1); if (i < W - 1 && j < H - 1) D[k] = Math.min(D[k], D[k + W + 1] + 1.414); if (i > 0 && j < H - 1) D[k] = Math.min(D[k], D[k + W - 1] + 1.414); }
  // the height: the fabric's joints and blocks, the rock's fractured skin, chips at the outline
  const height = new Float32Array(W * H), inside = new Float32Array(W * H), world = new Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, U = U0 + (i + 0.5) * px, V = V1 - (j + 0.5) * px, p = add(o, add(mul(u, U), mul(v, V)));
    world[k] = p; inside[k] = mask[k] ? 1 : -1;
    if (!mask[k]) { height[k] = -0.05; continue; }
    const { z, tilt } = fabricZ(p);
    let h = z + dot(tilt, [U, V, 0]) * 0.05;
    h += fractal2(U / 0.35, V / 0.35, { seed: 101 + fi, octaves: 4, flavour: 'ridged' })[0] * 0.006 + fractal2(U / 0.03, V / 0.03, { seed: 131 + fi, octaves: 2 })[0] * 0.0008;
    // an arris broken back: where the outline is near, a planar chip falls toward it, the rim wandering
    const bd = D[k] * px, r = 0.09 + 0.06 * (gnoise2(U / 0.12, V / 0.12, 151 + fi) + 1);
    if (bd < r && gnoise2(U / 0.2, V / 0.2, 171 + fi) > -0.15) h -= 0.02 * (1 - bd / r);
    height[k] = h;
  }
  // its light: the cube's sun in the facet's frame (image y runs down v)
  const Lf = [dot(sun, u), -dot(sun, v), dot(sun, n)], el = Math.max(5, (Math.asin(clamp(Lf[2], -1, 1)) * 180) / Math.PI), az = (Math.atan2(-Lf[1], Lf[0]) * 180) / Math.PI;
  const lit = lightRelief({ W, H, px, height, inside }, { az, el, ambient: 0.35, wrap: 0.2, reach: 0.25, soft: 0.004, floor: 0.35, radius: 0.025, cavity: 0.45, edge: 0.12 });
  const out = Buffer.alloc(W * H * 3);
  for (let k = 0; k < W * H; k++) {
    const g = mask[k] ? hex2(rf.colorAt(world[k], px)).map((c, q) => (c * 255) / (mean[q] || 1)) : [1, 1, 1];
    const val = mask[k] ? 1 + (lit.value[k] - 1) * 0.9 : 1;
    for (let q = 0; q < 3; q++) out[k * 3 + q] = Math.round(255 * srgb(clamp(M * val * (1 + (g[q] - 1) * 0.6), 0, 1)));
  }
  const png = encodePng(out, W, H), k = `matte:cliff-${fi}`;
  textures[k] = `data:image/png;base64,${png.toString('base64')}`; texels += W * H; bytes += png.length;
  for (const i of g) {
    const [f, at] = reach[i];
    const uv = f.corners.map((c) => { const [U, V] = proj(c); return [Math.round(((U - U0) / (U1 - U0)) * 1e5) / 1e5, Math.round(((V - V0) / (V1 - V0)) * 1e5) / 1e5]; });
    payload.faces[at] = { ...f, texture: k, textureLit: true, uv, fill: lift(f.fill), ...(f.cornerFills ? { cornerFills: f.cornerFills.map(lift) } : {}) };
  }
});
const tPaint = Date.now() - tPaint0;
console.log(`painted ${facets.length} facets · ${(texels / 1e6).toFixed(2)} Mtexels · ${(bytes / 1024).toFixed(0)} KB of PNG · ${tPaint} ms`);

// close-ups from the walk: the biggest reachable facets, from the walk point nearest each, and nearer
const biggest = facets.map((g, fi) => ({ fi, g, c: g.flatMap((i) => reach[i][0].corners).reduce((a, c, _, A) => add(a, mul(c, 1 / A.length)), [0, 0, 0]), n: unit(g.reduce((a, i) => add(a, reach[i][0].normal), [0, 0, 0])) })).sort((a, b) => b.g.length - a.g.length).slice(0, 3);
const shots = biggest.flatMap(({ fi, c, n }) => {
  const w = walkPts.reduce((a, p) => ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 < (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2 ? p : a), walkPts[0]);
  const eye = [w[0], w[1], w[2] + 1.7], close = add(c, add(mul(n, 2.2), [0, 0, 0.4]));
  return [{ name: `walk-${fi}`, eye, at: c }, { name: `close-${fi}`, eye: close, at: c }];
});
const quiet = (await resolveWorldScene({ title: 'quiet', manifest: { kind: 'geocube', cube: { ...cube, grit: undefined }, show: 'land', walk: false } })).payload;
const fabricOnly = (await resolveWorldScene({ title: 'fabric', manifest: { kind: 'geocube', cube, show: 'land', walk: false } })).payload;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const files = [];
try {
  for (const s of shots) for (const [label, P] of [['quiet', quiet], ['fabric', fabricOnly], ['baked', { ...payload, textures: { ...(payload.textures || {}), ...textures } }]]) {
    const W = 760, H = 500, html = emitThreeWorld({ ...P, cameras: [{ name: s.name, worldFraming: { cameraPosition: s.eye, lookAt: s.at, horizontalFov: 70, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
    const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
    await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4000));
    await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
    const el = await page.$('#wrap'), f = `cliff-reach-${s.name}-${label}.png`;
    writeFileSync(path.join(outDir, f), Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' })));
    await page.close(); files.push(f);
  }
} finally { await browser.close(); }
writeFileSync(path.join(outDir, 'cliff-reach.json'), JSON.stringify({ reach: REACH, ppm: PPM, quads: reach.length, facets: facets.length, texels, bytes, ms: { land: tLand, paint: tPaint }, shots: shots.map((s) => s.name), files }, null, 1));
console.log('→', outDir);
