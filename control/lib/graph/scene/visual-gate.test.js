/**
 * The visual gate's arithmetic and report (scene/visual-gate.js), on synthetic images: no browser, no engine. The metric
 * says identical is identical (SSIM 1, ΔE 0), and moves the way it should for a shift (structure lost, colour roughly
 * kept), a recolour (structure kept, colour lost) and noise (structure falling as the noise grows); CIEDE2000 meets
 * Sharma's reference pairs. The shots come from a level record's camera markers, a shoot plan's shots and poses. The
 * World page's `captureSize` is a capture page's only and adds no byte to any page without it. The page's exact framing
 * in Chrome is visual-gate.chrome.test.js's; the gate run through Godot is visual-gate.godot.test.js's.
 */
import { describe, expect, it } from 'vitest';

import { gateShots, decodeImage, compareImages, deltaE2000, srgbToLab, gateReport, contactSheet, heatColour, heatPng, thumbPng, shotLine, boxDown, GATE_SIZE, GATE_FIXTURES, BLANK_SIGMA } from './visual-gate.js';
import { encodePng } from '../landscape/surface-textures.js';
import { emitThreeWorld } from './scene-three.js';

// (a deterministic picture: a few soft colour waves and hard-edged blocks, so it has structure at several scales)
function picture(W = 256, H = 144, { dx = 0, tint = null, noise = 0, seed = 1 } = {}) {
  const rgb = new Uint8Array(W * H * 3);
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x - dx;
    let r = 120 + 60 * Math.sin(u / 9) + 30 * Math.cos(y / 7), g = 110 + 50 * Math.sin((u + y) / 13), b = 100 + 70 * Math.cos(u / 21 - y / 11);
    if (((Math.floor(u / 32) + Math.floor(y / 24)) & 1) === 0) { r *= 0.55; g *= 0.6; b *= 0.7; }
    if (tint) { r = r * tint[0]; g = g * tint[1]; b = b * tint[2]; }
    if (noise) { r += (rnd() - 0.5) * 2 * noise; g += (rnd() - 0.5) * 2 * noise; b += (rnd() - 0.5) * 2 * noise; }
    const o = (y * W + x) * 3; rgb[o] = Math.max(0, Math.min(255, Math.round(r))); rgb[o + 1] = Math.max(0, Math.min(255, Math.round(g))); rgb[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
  return { W, H, rgb };
}
const flat = (W, H, c) => { const rgb = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) rgb.set(c, i * 3); return { W, H, rgb }; };

describe('the visual gate\'s metric', () => {
  it('an image against itself: SSIM 1, ΔE 0 everywhere, every region the same', () => {
    const a = picture(), s = compareImages(a, picture());
    expect(s.ssim).toBe(1);
    expect(s.deltaE).toEqual({ mean: 0, p95: 0, max: 0 });
    expect(s.regions).toHaveLength(12);
    for (const r of s.regions) { expect(r.ssim).toBe(1); expect(r.deltaE).toBe(0); expect(r.page).toEqual(r.engine); }
    expect(s.blank).toMatchObject({ page: false, engine: false });
  });

  it('a shift loses structure more than colour; a recolour loses colour, not structure; noise lowers structure as it grows', () => {
    const a = picture();
    const shifted = compareImages(a, picture(256, 144, { dx: 6 }));
    const tinted = compareImages(a, picture(256, 144, { tint: [1.25, 0.85, 0.7] }));
    const n1 = compareImages(a, picture(256, 144, { noise: 8 })), n2 = compareImages(a, picture(256, 144, { noise: 40 }));
    expect(shifted.ssim).toBeLessThan(0.9);
    expect(tinted.ssim).toBeGreaterThan(0.9);
    expect(tinted.deltaE.mean).toBeGreaterThan(shifted.deltaE.mean);
    expect(tinted.deltaE.mean).toBeGreaterThan(5);
    expect(n1.ssim).toBeGreaterThan(n2.ssim);
    expect(n1.ssim).toBeLessThan(1);
    expect(n2.deltaE.mean).toBeGreaterThan(n1.deltaE.mean);
    for (const s of [shifted, tinted, n1, n2]) {
      expect(s.ssim).toBeGreaterThanOrEqual(-1); expect(s.ssim).toBeLessThanOrEqual(1);
      expect(s.deltaE.p95).toBeLessThanOrEqual(s.deltaE.max);
    }
  });

  it('names the worst region where the change is', () => {
    const a = picture(), b = picture();
    // (the bottom-right cell repainted)
    for (let y = 96; y < 144; y++) for (let x = 192; x < 256; x++) b.rgb.set([250, 20, 200], (y * 256 + x) * 3);
    const s = compareImages(a, b);
    expect(s.worst.cell).toBe('r3c4');
    expect(s.worst.box).toEqual([192, 96, 256, 144]);
    expect(s.regions.filter((r) => r.cell !== 'r3c4').every((r) => r.deltaE === 0)).toBe(true);
  });

  it('a flat render reads as blank; a still at another size is scored on the page\'s grid', () => {
    const s = compareImages(picture(), flat(256, 144, [40, 40, 40]));
    expect(s.blank.engine).toBe(true);
    expect(s.blank.page).toBe(false);
    expect(s.blank.sigma.engine).toBeLessThan(BLANK_SIGMA);
    const big = picture(512, 288), r = compareImages(picture(512, 288), boxed(big));
    expect(r.resized).toEqual([256, 144]);
    expect(r.ssim).toBeGreaterThan(0.8);
  });

  it('filters by round(min(W, H) / 256) as Wang\'s reference does', () => {
    expect(compareImages(picture(256, 144), picture(256, 144)).scale).toBe(1);
    expect(compareImages(picture(1280, 720), picture(1280, 720)).scale).toBe(3);
    expect(boxDown(picture(10, 6), 3)).toMatchObject({ W: 3, H: 2 });
  });

  it('CIEDE2000 meets Sharma, Wu and Dalal\'s reference pairs', () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
    expect(deltaE2000([50, -1.3802, -84.2814], [50, 0, -82.7485])).toBeCloseTo(1.0, 4);
    expect(deltaE2000([2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514])).toBeCloseTo(0.9082, 4);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 4);
    expect(deltaE2000([60, 30, 10], [60, 30, 10])).toBe(0);
    // (sRGB white and black are L 100 and 0)
    expect(srgbToLab(255, 255, 255)[0]).toBeCloseTo(100, 3);
    expect(srgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 6);
  });

  it('reads a PNG back as it was written, its alpha over black', () => {
    const a = picture(64, 36), back = decodeImage(encodePng(Buffer.from(a.rgb), 64, 36));
    expect(back.W).toBe(64);
    expect(Buffer.from(back.rgb).equals(Buffer.from(a.rgb))).toBe(true);
  });
});

// (an image box-filtered by two, as bytes)
function boxed(img) { const d = boxDown(img, 2); return { W: d.W, H: d.H, rgb: Uint8Array.from(d.rgb, (v) => Math.round(v)) }; }

describe('the visual gate\'s shots', () => {
  const level = { markers: [
    { name: 'spawn', kind: 'spawn', at: [0, 0, 0] },
    { name: 'camera:island', kind: 'camera', at: [100, 0, 40], look: [0, 0, 10], yfov: 0.7 },
    { name: 'camera:nolook', kind: 'camera', at: [1, 2, 3], yfov: 0.7 },
    { name: 'camera:island', kind: 'camera', at: [90, 0, 40], look: [0, 0, 10], yfov: 0.8 },
  ] };

  it('the level\'s camera markers, then the shoot plan\'s shots at their first frame, then the poses; one size', () => {
    const track = { t0: 0, fps: 2, n: 3, pos: [0, 0, 5, 10, 0, 5, 20, 0, 5], look: [0, 10, 0, 10, 10, 0, 20, 10, 0], hfov: [60, 60, 60], roll: [0, 0, 0] };
    const payload = { viewBox: { width: 1120, height: 780 }, shoot: { cameras: [{ id: 'a', track }], shots: [{ name: 'open', camera: 'a', span: [0.5, 1] }] } };
    const shots = gateShots(level, { payload, poses: [{ name: 'close', pos: [-5, -5, 5.5], target: [8, 8, 1.5], vfov: 50 }, { at: [1, 1, 1], look: [2, 2, 2], yfov: 0.5 }, { pos: [0, 0, 0], target: [0, 0, 0], vfov: 40 }] });
    expect(shots.map((s) => [s.name, s.source])).toEqual([['island', 'camera'], ['island-2', 'camera'], ['shot:open', 'shot'], ['close', 'pose'], ['pose-2', 'pose']]);
    expect(shots.every((s) => s.w === GATE_SIZE.width && s.h === GATE_SIZE.height)).toBe(true);
    expect(shots[0]).toMatchObject({ at: [100, 0, 40], look: [0, 0, 10], yfov: 0.7 });
    // (the shot's camera at t 0.5: a frame along its track, its horizontal 60° over the viewBox's aspect)
    expect(shots[2].at).toEqual([10, 0, 5]);
    expect(shots[2].look).toEqual([10, 10, 0]);
    expect(shots[2].yfov).toBeCloseTo(2 * Math.atan(Math.tan(Math.PI / 6) / (1120 / 780)), 12);
    expect(shots[3].yfov).toBeCloseTo((50 * Math.PI) / 180, 12);
  });

  it('every fixture names a sketch and its poses', () => {
    for (const [k, F] of Object.entries(GATE_FIXTURES)) {
      expect(F.sketch.manifest.kind, k).toBeTruthy();
      expect(gateShots({ markers: [] }, { poses: F.poses }).length, k).toBe(F.poses.length);
    }
  });
});

describe('the World page\'s captureSize', () => {
  const faces = [{ corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#808080' }];
  it('is a capture page\'s only, and adds no byte without one', () => {
    const plain = emitThreeWorld({ faces, capture: true });
    expect(emitThreeWorld({ faces, capture: true, captureSize: null })).toBe(plain);
    expect(emitThreeWorld({ faces, capture: true, captureSize: { width: 0, height: 720 } })).toBe(plain);
    // (a live page ignores it)
    expect(emitThreeWorld({ faces, captureSize: { width: 1280, height: 720 } })).toBe(emitThreeWorld({ faces }));
    const sized = emitThreeWorld({ faces, capture: true, captureSize: { width: 1280, height: 720 } });
    expect(sized).toContain('#wrap{width:1280px!important;height:720px!important;');
    expect(sized.replace(/ {2}#wrap\{width:1280px!important[^\n]*\n {2}html,body\{overflow:hidden\}[^\n]*\n/, '')).toBe(plain);
  });
});

describe('the visual gate\'s report and contact sheet', () => {
  const shots = gateShots({ markers: [{ name: 'camera:island', kind: 'camera', at: [100, 0, 40], look: [0, 0, 10], yfov: 0.7 }] }, { poses: [{ name: 'close', pos: [-5, -5, 5.5], target: [8, 8, 1.5], vfov: 50 }] });
  const a = picture(), scored = compareImages(a, picture(256, 144, { noise: 10 }));
  const scores = { island: { godot: { scores: scored }, unity: { skipped: 'no Unity on this machine' } }, close: { godot: { error: 'no still for this shot' }, unity: { skipped: 'no Unity on this machine' } } };
  const engines = { godot: { ran: true, ms: 1000 }, unity: { ran: false, skipped: 'no Unity on this machine' } };
  const report = gateReport({ sketch: { ref: 'sk_x', title: 'x' }, shots, page: { ran: true, framing: { island: { width: 256, height: 144, aspect: 16 / 9, fov: 40.1, exact: true } } }, engines, scores });

  it('says it is the machine gate, advisory, and that the eyes gate did not run; drops the maps', () => {
    expect(report).toMatchObject({ gate: 'machine', advisory: true, ref: 'sk_x' });
    expect(report.eyes).toMatch(/^not run/);
    expect(report.shots.map((s) => s.name)).toEqual(['island', 'close']);
    expect(report.shots[0].engines.godot.maps).toBeUndefined();
    expect(report.shots[0].engines.godot.ssim).toBe(scored.ssim);
    expect(report.shots[0].engines.unity).toEqual({ skipped: 'no Unity on this machine' });
    expect(report.shots[0].framing.exact).toBe(true);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(report.lines).toHaveLength(2);
    expect(report.lines[0]).toMatch(/^island\s+godot SSIM \d\.\d{3} ΔE \d+\.\d \(worst r\dc\d ΔE \d+\.\d\) · unity skipped/);
    expect(shotLine(shots[1], scores.close)).toContain('godot no still (no still for this shot)');
  });

  it('the contact sheet: one self-contained page, the page beside each engine, the scores and a heat map', () => {
    const images = { island: { page: thumbPng(a), godot: { thumb: thumbPng(a), heat: heatPng(scored.maps) } }, close: {} };
    const html = contactSheet(report, images, { island: { page: 'stills/island.page.png', godot: 'stills/island.godot.png' } });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Visual gate x</title>');
    expect(html).toContain('href="stills/island.godot.png"');
    expect((html.match(/src="data:image\/png;base64,/g) ?? []).length).toBe(3);
    expect(html).toContain('skipped: no Unity on this machine');
    expect(html).not.toMatch(/<script|https?:\/\//);
    // (the heat ramp: dark at no difference, brighter as it grows)
    const lum = (c) => c[0] + c[1] + c[2];
    expect(lum(heatColour(0))).toBeLessThan(lum(heatColour(5)));
    expect(lum(heatColour(5))).toBeLessThan(lum(heatColour(20)));
    expect(lum(heatColour(20))).toBeLessThan(lum(heatColour(60)));
  });
});
