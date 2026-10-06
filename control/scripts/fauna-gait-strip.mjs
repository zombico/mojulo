#!/usr/bin/env node
// fauna-gait-strip — a species' skeleton through one stride of a gait, as a stick GIF: side view over top view, the
// ground sliding under the planted feet. The eyes-gate strip for the locomotion studies; no rig, no skin.
//
//   node scripts/fauna-gait-strip.mjs <species> <gait> [outDir] [--frames 24] [--fps 12] [--strides 2]
//   node scripts/fauna-gait-strip.mjs wolf trot /tmp/strips
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { gaitFrames } from '../lib/graph/fauna/gait.js';
import { faunaSkeleton } from '../lib/graph/fauna/skeleton.js';
import { encodeGif } from '../lib/motion/encode-gif.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args.splice(i, 2)[1]) : d; };
const frames = opt('frames', 24), fps = opt('fps', 12), strides = opt('strides', 2);
const [id, gait, outDir = '.'] = args;
if (!id || !gait) { console.error('usage: fauna-gait-strip.mjs <species> <gait> [outDir] [--frames n] [--fps n] [--strides n]'); process.exit(1); }

const poses = gaitFrames(id, gait, frames);
const parentOf = Object.fromEntries(faunaSkeleton(id).bones.map((b) => [b.id, b.parent]));
const ink = (bid) => (/^(spine|neck|tail)\d+$|^head$/.test(bid) ? '#2b2b2b' : bid.endsWith('L') ? '#1c7ed6' : '#e8590c');
const width = (bid) => (/^(spine|neck|tail)\d+$|^head$/.test(bid) ? 3.2 : 2.4);

// one frame of extents for every frame, so the animal does not breathe in and out of the frame
let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = 0, x1 = 0;
for (const p of poses) for (const b of Object.values(p.bones)) for (const q of [b.head, b.tail]) {
  y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); x1 = Math.max(x1, Math.abs(q[0]));
}
const pad = 0.12 * (y1 - y0), W = 640, s = (W - 40) / (y1 - y0 + 2 * pad);
// a swimmer floats: frame its body, not the ground under it
const swims = poses.every((p) => p.ground === 0) && z0 > pad, base = swims ? z0 - pad : 0;
const sideH = (z1 - base + pad) * s + 30, topH = (2 * x1 + pad) * s + 20, H = Math.round(sideH + topH + 30);
const sx = (y) => 20 + (y - y0 + pad) * s;
const side = (q) => [sx(q[1]), sideH - (q[2] - base) * s];
const top = (q) => [sx(q[1]), sideH + 20 + topH / 2 + q[0] * s];

const svg = (p, i) => {
  const lines = [];
  const order = Object.keys(p.bones).sort((a, b) => (a.endsWith('L') ? -1 : 0) - (b.endsWith('L') ? -1 : 0));   // left limbs behind
  for (const view of [side, top]) for (const bid of order) {
    const { head, tail } = p.bones[bid], [a, b] = [view(head), view(tail)];
    // a thin link where a bone starts away from its parent's end (the spine's front to the neck's base)
    const par = parentOf[bid] && p.bones[parentOf[bid]];
    if (par) { const c = view(par.tail); if (Math.hypot(c[0] - a[0], c[1] - a[1]) > 2) lines.push(`<line x1="${c[0].toFixed(1)}" y1="${c[1].toFixed(1)}" x2="${a[0].toFixed(1)}" y2="${a[1].toFixed(1)}" stroke="#ced4da" stroke-width="1.2"/>`); }
    lines.push(`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${ink(bid)}" stroke-width="${width(bid)}" stroke-linecap="round"/>`);
    lines.push(`<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="1.8" fill="${ink(bid)}"/>`);
  }
  // the treadmill: ground ticks slide back by the ground travelled
  const step = 0.25 * (y1 - y0 + 2 * pad), ticks = [];
  for (let y = y0 - pad - step; y < y1 + pad + step; y += step) {
    const gx = sx(y - (p.ground % step));
    if (gx > 18 && gx < W - 18) ticks.push(`<line x1="${gx.toFixed(1)}" y1="${sideH}" x2="${(gx - 6).toFixed(1)}" y2="${sideH + 8}" stroke="#adb5bd" stroke-width="1.5"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fbfaf7"/>
${swims ? '' : `<line x1="12" y1="${sideH}" x2="${W - 12}" y2="${sideH}" stroke="#868e96" stroke-width="1.5"/>${ticks.join('')}`}
<line x1="12" y1="${sideH + 20}" x2="${W - 12}" y2="${sideH + 20}" stroke="#e9ecef" stroke-width="1"/>
${lines.join('\n')}
<text x="14" y="${H - 10}" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#495057">${id} · ${gait}  —  side (top), from above (bottom)   ${i + 1}/${poses.length}</text>
</svg>`;
};

mkdirSync(outDir, { recursive: true });
const all = Array.from({ length: strides }, () => poses).flat();
const out = path.join(outDir, `${id}-${gait}.gif`);
const r = await encodeGif(all.map((p, i) => svg(p, i % poses.length)), out, { width: W, fps, bg: '#fbfaf7' });
console.log(`${out}  ${r.frames} frames  ${r.width}×${r.height}  ${(r.bytes / 1024).toFixed(0)} KB`);
