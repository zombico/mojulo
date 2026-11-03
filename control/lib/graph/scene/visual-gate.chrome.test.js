/**
 * The visual gate's page side in Chrome (the e2e tier: it launches a browser, and passes saying nothing when none is
 * installed): the World page draws a shot exactly at the pose, vertical fov and frame size an engine does
 * (emitThreeWorld's `captureSize` and the capture bridge's frame), so the gate holds like to like. A shot drawn twice is
 * the same still; two markers at known places land where a pinhole camera at the pose projects them, to the pixel; the
 * bridge reports the aspect and the fov it drew at.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { renderPageShots } from './visual-gate-run.js';
import { decodeImage, gateShots } from './visual-gate.js';
import { resolveChromium } from './chromium.js';

let chrome = true;
try { await resolveChromium({ allowFetch: false }); } catch { chrome = false; }

const SIZE = { width: 640, height: 360 };
const sq = ([x, y], r, fill) => ({ corners: [[x - r, y - r, 0.02], [x + r, y - r, 0.02], [x + r, y + r, 0.02], [x - r, y + r, 0.02]], fill });
// a dark floor, a red marker near the middle and a green one off to the side
const RED = [1, 2], GREEN = [-6, 9];
const payload = { title: 'markers', bg: '#000000', glow: false, viewBox: { width: 1120, height: 780 },
  faces: [{ corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]], fill: '#1a1a1a' }, sq(RED, 0.25, '#ff0000'), sq(GREEN, 0.25, '#00ff00')],
  cameras: [{ name: 'default', worldFraming: { cameraPosition: [0, -20, 20], lookAt: [0, 0, 0], horizontalFov: 60 } }] };
const POSE = { name: 'oblique', pos: [-4, -12, 9], target: [1, 3, 0], vfov: 47 };

// where a pinhole camera at the pose (z up) puts a point, in pixels of the frame
function project(p, { pos, target, vfov }, { width, height }) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const f = norm(sub(target, pos)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f), d = sub(p, pos);
  const t = Math.tan((vfov * Math.PI) / 360), z = dot(d, f);
  return [((dot(d, r) / (z * t * (width / height)) + 1) / 2) * width, ((1 - dot(d, u) / (z * t)) / 2) * height];
}
// the centroid of the pixels of one colour
function centroid(img, test) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) { const o = (y * img.W + x) * 3; if (test(img.rgb[o], img.rgb[o + 1], img.rgb[o + 2])) { sx += x + 0.5; sy += y + 0.5; n++; } }
  return n ? [sx / n, sy / n, n] : null;
}

const dirs = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

describe.skipIf(!chrome)('the visual gate\'s World page, framed exactly (Chrome)', () => {
  it('draws a shot at the pose, fov and size an engine does: twice the same still, its markers where the pinhole puts them', async () => {
    const shots = gateShots({ markers: [] }, { poses: [POSE], size: SIZE });
    const run = async () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-visual-gate-page-')); dirs.push(dir);
      return renderPageShots(null, shots, { stills: path.join(dir, 'stills'), size: SIZE, payload });
    };
    const a = await run(), b = await run();
    expect(a.ran, a.error).toBe(true);
    const f = a.framing.oblique;
    expect(f).toMatchObject({ left: 0, top: 0, width: SIZE.width, height: SIZE.height, exact: true, stable: true });
    expect(f.aspect).toBeCloseTo(SIZE.width / SIZE.height, 12);
    expect(f.fov).toBeCloseTo(POSE.vfov, 12);
    const A = readFileSync(a.stills.oblique), B = readFileSync(b.stills.oblique);
    expect(A.equals(B)).toBe(true);
    const img = decodeImage(A);
    expect([img.W, img.H]).toEqual([SIZE.width, SIZE.height]);
    const red = centroid(img, (r, g, bl) => r > 120 && g < 60 && bl < 60), green = centroid(img, (r, g, bl) => g > 120 && r < 60 && bl < 60);
    expect(red && red[2] > 20, 'the red marker is drawn').toBe(true);
    expect(green && green[2] > 20, 'the green marker is drawn').toBe(true);
    const pr = project([...RED, 0.02], POSE, SIZE), pg = project([...GREEN, 0.02], POSE, SIZE);
    // (the marker's centroid against its centre's projection: within a pixel, the square's perspective a fraction of one)
    expect(Math.hypot(red[0] - pr[0], red[1] - pr[1])).toBeLessThan(1);
    expect(Math.hypot(green[0] - pg[0], green[1] - pg[1])).toBeLessThan(1);
    // (the off-centre marker is far from the middle, so a wrong fov or aspect would move it by many pixels)
    expect(Math.hypot(pg[0] - SIZE.width / 2, pg[1] - SIZE.height / 2)).toBeGreaterThan(100);
  }, 240000);
});
