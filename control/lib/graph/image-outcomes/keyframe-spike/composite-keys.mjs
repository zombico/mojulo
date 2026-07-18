/**
 * K1 compositor (animation-cheats.plan.md Addendum 4) — audits the
 * worker's painted key cels against their meru guides and composites the
 * motion on twos. Zero generations; holds and whole-cel handling only.
 *
 *   cd control && node lib/graph/image-outcomes/keyframe-spike/composite-keys.mjs <dir> [fps]
 *
 * Expects: keys/key-<i>/cel.png (worker output per guide), canonical.json.
 * Emits: per-cel audit (crown/ground compliance + keying stats) in
 * audit.json, per-cel RETRY notes on violation, composite/<motion>.gif.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { CANVAS } from '../parts-bank-spike/front.js';
import { floodKey } from '../parts-bank-spike/key.js';
import { transformPart, segmentTransform } from '../parts-bank-spike/assemble.js';
import { encodeGifBuffers } from '../../../motion/encode-gif.js';

const DIR = path.resolve(process.argv[2] || '.');
const FPS = Number(process.argv[3] || 12);          // on twos at 12fps = 6 drawings/sec
const { width: W, height: H } = CANVAS;

const exists = (p) => fs.access(p).then(() => true, () => false);
const canonical = JSON.parse(await fs.readFile(path.join(DIR, 'canonical.json'), 'utf8'));

const keyDirs = (await fs.readdir(path.join(DIR, 'keys'), { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name.startsWith('key-'))
  .map((d) => d.name)
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));

const audit = { canonical, cels: {} };
const frames = [];
let missing = 0;
for (const kd of keyDirs) {
  const celPath = path.join(DIR, 'keys', kd, 'cel.png');
  if (!(await exists(celPath))) { console.log(`${kd}: no cel.png yet`); missing += 1; continue; }
  let rgba = await sharp(celPath).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const keyStats = floodKey(rgba, CANVAS);
  const measure = (buf) => {
    let top = H, bottom = -1, x0 = W, x1 = -1;
    for (let i = 0; i < W * H; i += 1) if (buf[i * 4 + 3] > 28) {
      const y = (i / W) | 0, x = i % W;
      if (y < top) top = y; if (y > bottom) bottom = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
    }
    return { top, bottom, cx: (x0 + x1) / 2 };
  };
  // Head-crown finder: the meru height is HEAD-to-sole, but the topmost painted
  // pixel can be a RAISED LIMB (a fist pump puts the fist above — even directly
  // above — the head). Measuring the topmost pixel would then shrink the whole
  // body to fit the fist under the crown line, so body scale drifts cel-to-cel
  // on any raised-arm motion. Instead find the head: scan down for the first
  // SUSTAINED band of head-sized rows (a thin raised arm/fist column never
  // sustains HEAD_MIN painted pixels for HEAD_RUN rows). Fall back to the
  // absolute top if no head band is found (e.g. arms-down cel).
  const HEAD_MIN = 70;   // painted-pixel count in a row that reads as head, not a limb
  const HEAD_RUN = 24;   // rows the head band must sustain
  const findHeadTop = (buf, top, bottom) => {
    const rowCount = new Array(H).fill(0);
    for (let i = 0; i < W * H; i += 1) if (buf[i * 4 + 3] > 28) rowCount[(i / W) | 0] += 1;
    for (let y = top; y <= bottom - HEAD_RUN; y += 1) {
      let ok = true;
      for (let d = 0; d < HEAD_RUN; d += 1) if (rowCount[y + d] < HEAD_MIN) { ok = false; break; }
      if (ok) return y;
    }
    return top;
  };
  let m = measure(rgba);
  let headTop = findHeadTop(rgba, m.top, m.bottom);
  let heightRatio = Math.round(((m.bottom - headTop) / canonical.span) * 1000) / 1000;
  let normalized = false;
  // pure SCALE violations are deterministically healable: a whole-cel
  // similarity (never a cut) mapping the painted HEAD-to-sole span onto the unit
  // — soles → ground, head-crown → (ground − span) = the crown line. A raised
  // fist is then allowed to sit above the crown line; only the head is pinned.
  if (Math.abs(heightRatio - 1) >= 0.06 || m.bottom - canonical.ground >= canonical.span * 0.02) {
    const T = segmentTransform([m.cx, m.bottom], [m.cx, headTop], [m.cx, canonical.ground], [m.cx, canonical.ground - canonical.span]);
    rgba = transformPart(rgba, CANVAS, T);
    m = measure(rgba);
    headTop = findHeadTop(rgba, m.top, m.bottom);
    heightRatio = Math.round(((m.bottom - headTop) / canonical.span) * 1000) / 1000;
    normalized = true;
    await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).flatten({ background: '#add0eb' }).png().toFile(celPath);
  }
  const groundDeltaPx = m.bottom - canonical.ground;
  const compliant = Math.abs(heightRatio - 1) < 0.06 && groundDeltaPx < canonical.span * 0.02;
  audit.cels[kd] = { heightRatio, groundDeltaPx, crownDeltaPx: canonical.crown - headTop, headTop, compliant, normalized, keyStats };
  if (!compliant) {
    await fs.writeFile(path.join(DIR, 'keys', kd, 'RETRY.md'), [
      `# ${kd} meru retry — painted height ${heightRatio}x the unit (must be within 6%),`,
      `lowest pixel y=${m.bottom} vs ground y=${canonical.ground}. Redo this cel as an edit`,
      `of its guide.png: crown at/below y=${canonical.crown}, soles ON y=${canonical.ground}.`,
    ].join('\n'));
  }
  // composite frame: keyed cel over the flat background (on twos = push twice)
  const frame = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .flatten({ background: '#add0eb' }).resize({ width: 416, height: 608 }).png().toBuffer();
  frames.push(frame, frame);
  console.log(`${kd}: ratio ${heightRatio} ground∆ ${groundDeltaPx}${normalized ? ' (auto-normalized)' : ''} ${compliant ? 'OK' : 'RETRY'}`);
}
await fs.writeFile(path.join(DIR, 'audit.json'), JSON.stringify(audit, null, 2));
if (frames.length) {
  await fs.mkdir(path.join(DIR, 'composite'), { recursive: true });
  const res = await encodeGifBuffers(frames, path.join(DIR, 'composite', 'motion.gif'), { fps: FPS, loop: 0 });
  console.log(`GIF: ${res.outPath} (${res.frames} frames @ ${FPS}fps, on twos)${missing ? ` — ${missing} keys still missing` : ''}`);
} else {
  console.log('no cels present — emit keys, hand off, then re-run');
}
