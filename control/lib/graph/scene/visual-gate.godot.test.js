/**
 * The visual gate's Godot leg (MOJULO_GODOT; CI's `godot` job runs it under a virtual display): the trail's island
 * camera and its close pose drawn on the World page in Chrome and in Godot through the handoff's own project, scored and
 * stamped. Advisory, so it holds the report's shape and that its scores are numbers in range, never a look: the only
 * floor is that neither still is blank (a render that drew nothing), which no change of look can trip. Without Chrome,
 * or where Godot cannot open a display to draw in, it skips saying why.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runVisualGate } from './visual-gate-run.js';
import { GATE_FIXTURES, VISUAL_GATE_VERSION } from './visual-gate.js';
import { resolveChromium } from './chromium.js';

const GODOT = process.env.MOJULO_GODOT;
const KEEP = process.env.MOJULO_HANDOFF_KEEP;
let chrome = true;
try { await resolveChromium({ allowFetch: false }); } catch { chrome = false; }

const dirs = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
// (what a Godot that cannot draw here says: no display, no driver)
const NO_DISPLAY = /display|DisplayServer|X11|Wayland|Vulkan|OpenGL|video driver|rendering device/i;

describe('the visual gate through Godot', () => {
  it.skipIf(!GODOT)('the trail\'s island camera and close pose, on the page and in Godot: the report, its scores in range, nothing blank (MOJULO_GODOT)', async (ctx) => {
    if (!chrome) ctx.skip();
    const out = KEEP ? path.join(KEEP, 'visual-gate-trail') : mkdtempSync(path.join(os.tmpdir(), 'mojulo-visual-gate-godot-'));
    if (!KEEP) dirs.push(out);
    const F = GATE_FIXTURES.trail, size = { width: 640, height: 360 };
    const { report, json, html } = await runVisualGate(F.sketch, { engines: ['godot'], out, poses: F.poses, size, only: ['island', 'close'], bins: { godot: GODOT } });
    const g = report.engines.godot;
    if (!g.ran && NO_DISPLAY.test(String(g.log ?? g.error))) ctx.skip();
    expect(report.page.ran, JSON.stringify(report.page)).toBe(true);
    expect(g.ran, `${g.error}\n${g.log ?? ''}`).toBe(true);
    expect(report).toMatchObject({ version: VISUAL_GATE_VERSION, gate: 'machine', advisory: true, ref: 'sk_trail', size });
    expect(report.shots.map((s) => [s.name, s.source])).toEqual([['island', 'camera'], ['close', 'pose']]);
    for (const s of report.shots) {
      // (the page drew the shot at the engine's frame, aspect and fov)
      expect(s.framing.exact, JSON.stringify(s.framing)).toBe(true);
      const v = s.engines.godot;
      expect(v.ssim, s.name).toBeGreaterThanOrEqual(-1);
      expect(v.ssim, s.name).toBeLessThanOrEqual(1);
      for (const k of ['mean', 'p95', 'max']) expect(Number.isFinite(v.deltaE[k]) && v.deltaE[k] >= 0, `${s.name} ΔE ${k}`).toBe(true);
      expect(v.regions).toHaveLength(12);
      expect(v.regions.every((r) => Number.isFinite(r.ssim) && Number.isFinite(r.deltaE))).toBe(true);
      expect(v.worst.cell).toMatch(/^r\dc\d$/);
      // (the one floor: a still that drew something, on each side)
      expect(v.blank, s.name).toMatchObject({ page: false, engine: false });
      for (const f of Object.values(s.files)) expect(existsSync(path.join(out, f)), f).toBe(true);
    }
    expect(report.lines).toHaveLength(2);
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual(report);
    const sheet = readFileSync(html, 'utf8');
    expect(sheet).toContain('Visual gate: trail');
    expect((sheet.match(/src="data:image\/png;base64,/g) ?? []).length).toBe(2 * 3);
  }, 1_800_000);
});
