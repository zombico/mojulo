#!/usr/bin/env node
/**
 * SPIKE: rock FORMATIONS, after real cliffs: a hierarchy, not one scale of chunks.
 *   masses    the cliff's own relief over metres: buttresses and recesses (low noise along the face), the overhangs a
 *             strong unit leaves over a weak one
 *   beds      a bed table read up the face: thicknesses from a formation's law (thin flags, thick units), each bed a
 *             hardness; a soft bed recessed behind the hard, a hard bed's lip proud and rounded (the ledge)
 *   joints    vertical breaks a few metres apart that run through a UNIT of beds and stop or step at its base, their
 *             blocks each a plane of their own
 *   weather   colour by weathering, not by block: large stained patches (fresh orange where rock fell, grey where it
 *             weathered), dark streaks run down from the ledges, green on the ledges' tops
 * Two formations after the operator's references: massive limestone (thick units, few beds, staining, overhangs) and
 * flagstone (thin bedding, through-going joints, grassy ledges: the Cliffs of Moher). Each as a whole cliff and a close
 * crop of the same field, lit and painted like the stone block.
 *
 *   cd control && node scripts/spikes/matte/formations.mjs [ref1 ref2] → ../lite-template/integration/1020/spike-output/matte/formations.png
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { fractal2, gnoise2, smoothstep } = await import('../../../lib/graph/noise/noise.js');
const { hash01, dice } = await import('../../../lib/graph/matte-paint/relief.js');
const { lightRelief } = await import('../../../lib/graph/matte-paint/light.js');
const { rampAt } = await import('../../../lib/graph/matte-paint/paint.js');
const { encodePngRgba } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const FORMATIONS = {
  limestone: {
    title: 'massive limestone: thick units, overhangs, staining',
    beds: { thin: [0.4, 1.2], thick: [2.5, 6], thickShare: 0.45, hardShare: 0.7, recess: 0.35, lip: 0.12, dark: 0.6 },
    joints: { spacing: [2, 6], unitBeds: [1, 2], width: 0.08, depth: 0.25, step: 0.5 },
    masses: { scale: 7, amp: 2.4, overhang: 0.9 }, runnels: { width: 1.2, amp: 0.35 }, lens: 0.5, laminae: 0,
    fractures: { cell: [0.7, 2.6], depth: 0.12 }, facets: { cell: 0.22, tilt: 0.25 },
    rough: { amp: 0.012, scale: 0.6 },
    ramp: ['#2e2c2a', '#5a554e', '#8a8478', '#b4ac9c', '#d8d0c0'], stain: ['#4a2e1a', '#8a5a34', '#c08654', '#dcaa78', '#f0caa0'],
    weather: { stainScale: 5, stainShare: 0.4, stainAmount: 0.6, streak: 0.6, green: 0.12 },
  },
  flagstone: {
    title: 'flagstone and shale: thin beds, through joints, grassy ledges',
    beds: { thin: [0.06, 0.35], thick: [0.6, 1.4], thickShare: 0.18, hardShare: 0.5, recess: 0.2, lip: 0.05, dark: 1.4 },
    joints: { spacing: [1.2, 3.5], unitBeds: [6, 16], width: 0.05, depth: 0.18, step: 0.35 },
    masses: { scale: 6, amp: 1.4, overhang: 0.5 }, runnels: null, lens: 0.6, laminae: 0.035,
    fractures: { cell: [0.9, 1.8], depth: 0.07 }, facets: { cell: 0.16, tilt: 0.2 },
    rough: { amp: 0.006, scale: 0.4 },
    ramp: ['#1e2124', '#3e4348', '#666b70', '#93979a', '#c4c6c4'], stain: ['#2a2a24', '#4a4a3e', '#6e6c5c', '#94907c', '#bcb6a0'],
    weather: { stainScale: 8, stainShare: 0.3, stainAmount: 0.5, streak: 0.45, green: 0.75, greenRamp: ['#2c3a1a', '#4c6428', '#6e8c38', '#94ae52', '#bccc78'] },
  },
};

/** Voronoi on an anisotropic plane: F1, F2 (cell units) and the nearest cell. */
function vor(x, y, cw, chh, seed) {
  const qx = x / cw, qy = y / chh, ci = Math.floor(qx), cj = Math.floor(qy); let f1 = 9, f2 = 9, id = [0, 0];
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const d = Math.hypot(qx - (i + 0.1 + 0.8 * hash01(i, j, seed)), qy - (j + 0.1 + 0.8 * hash01(i, j, seed + 1)));
    if (d < f1) { f2 = f1; f1 = d; id = [i, j]; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}
/** The formation's beds up a cliff `h` m tall, from its law: [{ y0, y1, hard, unit }] (y down the face from its top). */
function bedsOf(F, h, seed) {
  const R = dice(seed * 911 + 5), out = []; let y = 0, unit = 0, left = 0;
  while (y < h) {
    const thick = R() < F.beds.thickShare, [a, b] = thick ? F.beds.thick : F.beds.thin;
    const t = a * Math.pow(b / a, R());                     // log-uniform: many thin, a few thick
    if (left <= 0) { unit++; left = F.joints.unitBeds[0] + Math.floor(R() * (F.joints.unitBeds[1] - F.joints.unitBeds[0] + 1)); }
    out.push({ y0: y, y1: Math.min(h, y + t), hard: R() < F.beds.hardShare || thick, unit, off: R() }); y += t; left--;
  }
  return out;
}
/** Each unit's joints: x places across the face, jittered, a unit's own. */
function jointsOf(F, w, units, seed) {
  const R = dice(seed * 577 + 9), J = new Map();
  for (let u = 1; u <= units; u++) { const xs = []; let x = R() * F.joints.spacing[0]; while (x < w) { xs.push(x); x += F.joints.spacing[0] + R() * (F.joints.spacing[1] - F.joints.spacing[0]); } J.set(u, xs); }
  return J;
}

function formation(F, { w, h, ppm, x0 = 0, y0 = 0, cw = w, ch = h, seed = 3 }) {
  // the field lives on the whole cliff (w × h m); this paints the window (x0, y0, cw, ch) of it
  const beds = bedsOf(F, h, seed), J = jointsOf(F, w, beds[beds.length - 1].unit, seed);
  const W = Math.round(cw * ppm), H = Math.round(ch * ppm), px = 1 / ppm;
  const height = new Float32Array(W * H), inside = new Float32Array(W * H).fill(1), info = new Array(W * H);
  // the visual domain, as the page has it: a layer is drawn once its feature spans a few pixels, and not before
  const lod = (size) => smoothstep(1.5, 4, size * ppm);
  const L = { facet: lod(F.facets.cell), frac: lod(0.05), lam: F.laminae ? lod(F.laminae) : 0, joint: lod(F.joints.width), rough: lod(F.rough.scale * 0.3) };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) * px, y = y0 + (j + 0.5) * px, k = j * W + i;
    // the beds' boundaries waver a little along the face; which bed, how far through it
    // the beds thicken and thin along the face and pinch out into lenses: each boundary wanders by its bed's own scale
    const near = beds.findIndex((B) => y < B.y1), Bn = beds[near < 0 ? beds.length - 1 : near];
    const yy = y + F.lens * (Bn.y1 - Bn.y0) * 0.5 * fractal2(x / 5, Bn.y0 * 0.7, { seed: seed + 3, octaves: 2 })[0] + 0.05 * gnoise2(x / 0.8, y, seed + 4);
    let b = beds.findIndex((B) => yy < B.y1); if (b < 0) b = beds.length - 1;
    const B = beds[b], t = clamp((yy - B.y0) / Math.max(1e-6, B.y1 - B.y0), 0, 1), tall = B.y1 - B.y0;
    // masses: a buttress or a recess over metres, and the overhang of a strong unit over a weak one
    // (two octaves: the big forms only, which alone cast shadows; small bumps casting hard shadows read as camouflage)
    let z = fractal2(x / F.masses.scale, y / (F.masses.scale * 1.6), { seed: seed + 5, octaves: 2 })[0] * F.masses.amp;
    // runnels: vertical grooves the water cuts (limestone), a metre or so wide, fading in and out down the face
    if (F.runnels) { const r = Math.abs(fractal2(x / F.runnels.width, y / 9, { seed: seed + 6, octaves: 2 })[0]); z -= F.runnels.amp * (1 - smoothstep(0, 0.35, r)) * smoothstep(-0.2, 0.4, gnoise2(x / 6, y / 8, seed + 8)); }
    // beds: a soft bed set back, its top under the lip of the hard bed above; a hard bed's lip rounded
    // (how far a soft bed is worn back varies along the face: its hardness is not even)
    const wear = 0.5 + 0.5 * (fractal2(x / 4, B.y0 * 1.3, { seed: seed + 33, octaves: 2 })[0] + 1);
    if (!B.hard) z -= F.beds.recess * wear * smoothstep(0, Math.min(0.3, 0.15 / tall), t) * (1 - smoothstep(1 - Math.min(0.3, 0.1 / tall), 1, t));
    else z -= F.beds.lip * (1 - smoothstep(0, Math.min(0.5, (2.5 * F.beds.lip) / tall), t)) * 0.5 + F.beds.lip * smoothstep(0.85, 1, t) * 0.3;
    z -= F.masses.overhang * (B.hard ? 0 : 1) * (hash01(B.unit, 3, seed) - 0.3) * 0.4;
    // joints: through this unit, stepping at its base; each block its own plane
    const xs = J.get(B.unit) || [];
    let dj = Infinity, left = 0, right = w, blk = 0;
    for (let q = 0; q < xs.length; q++) {
      const jx = xs[q] + fractal2(y / 1.2, q * 3.1, { seed: seed + 7, octaves: 3 })[0] * F.joints.step;
      // most joints run only part of their unit: from a place in it, for a stretch
      const ur = beds.filter((Bb) => Bb.unit === B.unit), uy0 = ur[0].y0, uy1 = ur[ur.length - 1].y1, a0 = hash01(q, B.unit, seed + 41), a1 = a0 + 0.35 + 0.65 * hash01(q, B.unit, seed + 43);
      const ut = (y - uy0) / Math.max(1e-6, uy1 - uy0), runs = ut >= a0 * 0.5 && ut <= a1;
      const d = Math.abs(x - jx); if (runs && d < dj) dj = d;
      if (jx <= x) { left = jx; blk = q + 1; } else { right = Math.min(right, jx); }
    }
    if (dj < F.joints.width) z -= L.joint * F.joints.depth * (1 - dj / F.joints.width) * (0.6 + 0.4 * gnoise2(y / 0.4, dj * 9, seed + 9));
    const gx = hash01(B.unit, blk, seed + 11) - 0.5, gy = hash01(B.unit, blk, seed + 13) - 0.5, u = (x - left) / Math.max(0.3, right - left);
    z += (gx * (u - 0.5) * (right - left) + gy * (t - 0.5) * tall) * 0.08 + (hash01(B.unit, blk, seed + 15) - 0.5) * 0.08;
    // the fracture network between the joints: short irregular breaks, the edges of tall Voronoi cells, in the hard beds
    if (B.hard) { const V = vor(x + 0.3 * gnoise2(x, y, seed + 19), y, F.fractures.cell[0], F.fractures.cell[1], seed + 21), e = (V.f2 - V.f1) * F.fractures.cell[0] * 0.5; if (e < 0.05) z -= L.frac * F.fractures.depth * (1 - e / 0.05) * (hash01(V.id[0], V.id[1], seed + 23) < 0.6 ? 1 : 0.2); }
    // the skin: small planar facets, each tilted its own way (fractured rock, never sponge)
    const Fc = vor(x, y, F.facets.cell, F.facets.cell, seed + 25), fcx = (Fc.id[0] + 0.5) * F.facets.cell, fcy = (Fc.id[1] + 0.5) * F.facets.cell;
    z += L.facet * ((hash01(Fc.id[0], Fc.id[1], seed + 27) - 0.5) * (x - fcx) + (hash01(Fc.id[0], Fc.id[1], seed + 29) - 0.5) * (y - fcy)) * F.facets.tilt;
    // laminae: the fine bedding inside a bed (flags and shale), a millimetre of relief every few centimetres
    if (F.laminae) z -= L.lam * F.laminae * 0.06 * (0.5 + 0.5 * Math.sin((yy / F.laminae + 0.6 * gnoise2(x / 2, yy, seed + 31)) * 6.2832));
    z += L.rough * fractal2(x / F.rough.scale, y / F.rough.scale, { seed: seed + 17, octaves: 3 })[0] * F.rough.amp;
    height[k] = z; info[k] = { zMass: z, b, hard: B.hard, t, x, y, yy, wear, ledge: B.hard && t < 0.12 && hash01(b, 7, seed) < 0.6 };
  }
  const lit = lightRelief({ W, H, px, height, inside }, { az: 120, el: 35, ambient: 0.32, wrap: 0.25, reach: Math.max(0.6, 25 * px), soft: Math.max(0.02, 6 * px), floor: 0.3, radius: Math.max(0.08, 6 * px), cavity: 0.2, edge: 0.15 });
  const ramp = F.ramp.map(hex), stain = F.stain.map(hex), green = F.weather.greenRamp ? F.weather.greenRamp.map(hex) : null, out = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    const I = info[k], v = lit.value[k];
    // a soft bed is another rock (shale, marl): darker than the hard ones, the more so the more it is worn back
    let tt = 0.5 + (v - 1) * 0.95 + (I.hard ? 0.06 : -0.12 * I.wear * F.beds.dark);
    // the weathered skin: a stained patch (the second ramp) in large warped blotches
    // (it runs down the face with the water: the blotches stretched tall, their edges torn)
    const sx = I.x / F.weather.stainScale, sy = I.y / (F.weather.stainScale * 3.5);
    // (soft: a wash, no edge; and stronger where the face stands out, fresher where it has fallen back)
    const s = F.weather.stainAmount * clamp(0.5 + 1.2 * fractal2(sx + 0.5 * gnoise2(sx * 3, sy * 3, 31), sy, { seed: 23, octaves: 3 })[0] + (F.weather.stainShare - 0.5), 0, 1);
    // streaks: water runs down from a ledge's lip (a hard bed's foot over a recess) and down the runnels, long and narrow,
    // fading as it goes; nowhere else
    const below = I.hard ? 0 : clamp(1 - I.t * 1.5, 0, 1), runnel = F.runnels ? smoothstep(0.05, -0.25, I.zMass) : 0;
    const st = Math.max(0, fractal2(I.x / 0.3, I.y / 5, { seed: 29, octaves: 2 })[0] + 0.15) * F.weather.streak * Math.max(below, runnel);
    tt -= st * 0.4;
    if (F.laminae) tt -= L.lam * 0.08 * smoothstep(0.6, 1, 0.5 + 0.5 * Math.sin((I.yy / F.laminae) * 6.2832 + 1.3)) * (I.hard ? 0.6 : 1);
    let c = mix(rampAt(ramp, tt), rampAt(stain, tt), s);
    // green on the ledges' tops (the up-facing lip of a hard bed under a recess), in patches
    if (green && I.ledge) { const gm = smoothstep(0.1, 0.5, fractal2(I.x / 0.8, I.y / 0.8, { seed: 37, octaves: 3 })[0] + 0.3) * F.weather.green; c = mix(c, rampAt(green, 0.4 + (v - 1)), gm); }
    else if (green && !I.hard && I.t < 0.2) c = mix(c, rampAt(green, 0.35 + (v - 1)), 0.25 * F.weather.green);
    out[k * 4] = clamp(Math.round(c[0]), 0, 255); out[k * 4 + 1] = clamp(Math.round(c[1]), 0, 255); out[k * 4 + 2] = clamp(Math.round(c[2]), 0, 255); out[k * 4 + 3] = 255;
  }
  return `data:image/png;base64,${encodePngRgba(out, W, H).toString('base64')}`;
}

const refs = process.argv.slice(2).filter(existsSync).map((p) => `data:image/${p.endsWith('.png') ? 'png' : 'webp'};base64,${readFileSync(p).toString('base64')}`);
const cells = [];
for (const [id, F] of Object.entries(FORMATIONS)) {
  const t0 = Date.now();
  const whole = formation(F, { w: 24, h: 30, ppm: 12 }), close = formation(F, { w: 24, h: 30, ppm: 64, x0: 9, y0: 12, cw: 5, ch: 6 });
  cells.push({ id, title: F.title, whole, close, ms: Date.now() - t0 });
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}img{display:block;height:440px}</style>
<div style="margin-bottom:8px">rock formations: masses · beds with hardness · joints through units · weathering colour — a 24 × 30 m cliff at 12 px/m, and a 5 × 6 m crop of the same field at 64 px/m</div>
${cells.map((c, i) => `<div class=r>${refs[i] ? `<figure style="margin:0"><img src="${refs[i]}"><figcaption>reference</figcaption></figure>` : ''}<figure style="margin:0"><img src="${c.whole}"><figcaption>${c.id}: ${c.title} · whole cliff</figcaption></figure><figure style="margin:0"><img src="${c.close}"><figcaption>the same field, close (${c.ms} ms both)</figcaption></figure></div>`).join('')}`;
writeFileSync(path.join(outDir, 'formations.html'), page);
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await browser.newPage(); await p.setViewport({ width: 1240, height: 960 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 500)); writeFileSync(path.join(outDir, 'formations.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await browser.close(); }
console.log(cells.map((c) => `${c.id} ${c.ms} ms`).join(' · '));
