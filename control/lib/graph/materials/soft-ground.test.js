import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { SOFT_GROUNDS, WET_DAMP, buildSandBed } from './soft-ground.js';

const DRY = SOFT_GROUNDS['dry-sand'], DAMP = SOFT_GROUNDS['damp-sand'], SNOW = SOFT_GROUNDS['fresh-snow'], MUD = SOFT_GROUNDS.mud;
const settle = (b, max = 20000) => { for (let t = 0; t < max; t++) if (!b.step().active) return t + 1; throw Error('did not settle'); };
const S0 = 0.2;
const deficit = (b) => { let d = 0; for (let i = 0; i < b.sand.length; i++) d += Math.max(0, Math.round(S0 / b.quantum) - b.baseU[i] - b.sand[i]); return d; };
function overYield(b, { staticFriction, cohesion }) {
  const { cols, rows, cell, quantum } = b; let worst = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c; if (!b.sand[i]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = c + dx, y = r + dy; if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const j = y * cols + x, drop = b.baseU[i] + b.sand[i] + b.packed[i] - b.baseU[j] - b.sand[j] - b.packed[j];
      worst = Math.max(worst, drop - Math.floor((staticFriction * cell * Math.hypot(dx, dy) + cohesion) / quantum));
    }
  }
  return worst;
}

describe('soft ground: prints, plows, sand / snow / mud (the sand-bed spike, graduated)', () => {
  it('a print conserves mass, heel deeper than toe, rim heavier toward the push, then holds with zero work', () => {
    for (const g of [DRY, DAMP]) {
      const b = buildSandBed({ cols: 120, rows: 120, depth: S0, ...g }), m0 = b.mass();
      b.press({ x: 1.5, y: 1.5, heading: 0, sink: 0.03, push: [1.5, 0] });
      expect(settle(b)).toBeLessThan(50);
      expect(b.mass()).toBe(m0);
      const heel = S0 - b.heightAt(1.5 - 0.078, 1.5), toe = S0 - b.heightAt(1.5 + 0.044, 1.5);
      expect(heel).toBeGreaterThan(Math.max(0.02, toe));
      const ring = (dx) => Math.max(...[0, 1, 2, 3].map((k) => b.heightAt(1.5 + dx * (0.13 + 0.02 * k), 1.5))) - S0;
      expect(ring(1)).toBeGreaterThan(ring(-1));
      const snap = b.sand.slice();
      for (let i = 0; i < 500; i++) expect(b.step().checked).toBe(0);
      expect(b.sand).toEqual(snap);
      b.wakeAll(); expect(b.step().moved).toBe(0);
    }
  });

  it('damp sand keeps more of a print than dry; re-tuning damp to dry slumps it under the new yield, mass exact', () => {
    const mk = (g) => { const b = buildSandBed({ cols: 120, rows: 120, depth: S0, ...g }); b.press({ x: 1.5, y: 1.5, sink: 0.03, push: [1.5, 0] }); settle(b); return b; };
    const dry = mk(DRY), damp = mk(DAMP), m0 = damp.mass();
    expect(deficit(damp)).toBeGreaterThan(deficit(dry));
    damp.tune(DRY); settle(damp);
    expect(damp.mass()).toBe(m0);
    expect(overYield(damp, DRY)).toBe(0);
  });

  it('snow compacts and breaks trail; mud oozes back but keeps a dent', () => {
    const snow = buildSandBed({ cols: 120, rows: 120, depth: 0.3, ...SNOW }), sm = snow.mass();
    const heel = (b) => 0.3 - b.heightAt(1.5 - 0.078, 1.5), boot = () => snow.press({ x: 1.5, y: 1.5, sink: SNOW.sink, push: [1.2, 0] });
    boot(); settle(snow); const d1 = heel(snow); boot(); settle(snow); const d2 = heel(snow) - d1;
    expect(d1).toBeGreaterThan(0.1); expect(d2).toBeLessThan(0.75 * d1); expect(snow.mass()).toBe(sm);
    const mud = buildSandBed({ cols: 120, rows: 120, depth: 0.3, ...MUD }), mm = mud.mass();
    mud.press({ x: 1.5, y: 1.5, sink: MUD.sink, push: [1.2, 0] });
    const fresh = heel(mud), ticks = settle(mud);
    expect(ticks).toBeGreaterThan(30); expect(heel(mud)).toBeLessThan(0.8 * fresh); expect(heel(mud)).toBeGreaterThan(0.02);
    expect(mud.mass()).toBe(mm);
  });

  it('replays a scripted walk and plow byte-for-byte, the same bytes as the spike kernel', () => {
    // hashes recorded from scripts/spikes/sand-bed/kernel.mjs before it graduated (no moisture, no shift)
    const PIN = { 'dry-sand': 'e830767c48d84ffc', 'damp-sand': '0b36552fc74be03d', 'fresh-snow': 'a1cd02c6f07e5174', mud: 'dcea5add2a16b943' };
    for (const [name, g] of Object.entries(SOFT_GROUNDS)) {
      const b = buildSandBed({ cols: 160, rows: 160, depth: 0.25, ...g });
      for (let k = 0; k < 24; k++) {
        const t = k * 0.26, h = 0.4 + 0.08 * k, side = k % 2 ? -1 : 1;
        b.press({ x: 0.8 + Math.cos(h) * t - Math.sin(h) * 0.11 * side, y: 0.8 + Math.sin(h) * t + Math.cos(h) * 0.11 * side, heading: h, sink: g.sink, push: [Math.cos(h), Math.sin(h)] });
        if (k % 6 === 5) b.plow({ x: 1.6, y: 1.2 + k * 0.02, hl: 0.15, hw: 0.15, bottom: 0.12, dx: 0.03, dy: 0 });
        for (let i = 0; i < 20; i++) b.step();
      }
      for (let i = 0; i < 3000; i++) b.step();
      expect(createHash('sha256').update(Buffer.from(b.sand.buffer)).update(Buffer.from(b.packed.buffer)).digest('hex').slice(0, 16), name).toBe(PIN[name]);
    }
  });

  it('rejects bad input', () => {
    expect(() => buildSandBed({ cols: 2 })).toThrow();
    expect(() => buildSandBed({}).press({ x: NaN, y: 0 })).toThrow();
    expect(() => buildSandBed({}).tune({ friction: 0.9, staticFriction: 0.5 })).toThrow();
  });
});

describe('soft ground: per-column moisture', () => {
  const MOIST = { dry: DRY, damp: DAMP, fluid: { friction: 0.5, staticFriction: 0.5, cohesion: 0 } };
  const bed = () => buildSandBed({ cols: 120, rows: 120, depth: S0, ...DRY, moisture: MOIST });

  it('a damp column holds a print a dry one slumps, in the same bed', () => {
    const b = bed();
    for (let i = 0; i < b.sand.length; i++) if (i % b.cols >= 60) b.setMoisture(i, WET_DAMP);   // right half damp
    b.press({ x: 0.75, y: 1.5, sink: 0.03 }); b.press({ x: 2.25, y: 1.5, sink: 0.03 });
    settle(b);
    const hole = (x) => S0 - b.heightAt(x - 0.078, 1.5);
    expect(hole(2.25)).toBeGreaterThan(hole(0.75));
  });

  it('flooding a print with backwash (fluid) erases its walls; mass exact; sleep stays sound', () => {
    const b = bed();
    for (let i = 0; i < b.sand.length; i++) b.setMoisture(i, WET_DAMP);
    b.press({ x: 1.5, y: 1.5, sink: 0.03, push: [1, 0] }); settle(b);
    const m0 = b.mass(), before = deficit(b);
    for (let i = 0; i < b.sand.length; i++) b.setMoisture(i, 255);
    settle(b);
    expect(b.mass()).toBe(m0);
    expect(deficit(b)).toBeLessThan(before);
    expect(overYield(b, MOIST.fluid)).toBe(0);
    b.wakeAll(); expect(b.step().moved).toBe(0);
  });

  it('a moisture change inside the same level wakes nothing', () => {
    const b = bed();
    b.setMoisture(500, 3); expect(b.step().checked).toBe(0);
    b.setMoisture(500, 200); expect(b.step().checked).toBeGreaterThan(0);
  });
});

describe('soft ground: the sliding window', () => {
  it('keeps every column it shifts, fresh ground at the far edge, and the relaxation follows', () => {
    const b = buildSandBed({ cols: 80, rows: 60, depth: S0, ...DAMP });
    b.press({ x: 1.0, y: 0.75, sink: 0.03, push: [1, 0] }); settle(b);
    const before = b.heightAt(1.0 - 0.078, 0.75), kept = b.sand.slice();
    b.shift(10, -4, () => 0);
    expect(b.origin).toEqual([10 * b.cell, -4 * b.cell]);
    expect(b.heightAt(1.0 - 0.078, 0.75)).toBeCloseTo(before, 9);                    // the print stayed put in the world
    for (let r = 4; r < 60; r++) for (let c = 0; c < 70; c++) expect(b.sand[r * 80 + c]).toBe(kept[(r - 4) * 80 + c + 10]);
    for (let r = 0; r < 4; r++) expect(b.sand[r * 80 + 5]).toBe(Math.round(S0 / b.quantum));   // fresh rows
    settle(b);
    b.wakeAll(); expect(b.step().moved).toBe(0);
    expect(() => b.shift(0.5, 0, () => 0)).toThrow();
  });
});

describe('soft ground: relief (slopes measured on the material alone)', () => {
  it('a weak ground on a sloped base keeps its place; prints in it still level out', () => {
    const cols = 100, rows = 100, cell = 0.03, slope = 0.4;
    const base = new Float64Array(cols * rows); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) base[r * cols + c] = slope * r * cell;
    const weak = { friction: 0.1, staticFriction: 0.1, cohesion: 0 };
    const plain = buildSandBed({ cols, rows, cell, base, depth: 0.3, ...weak }), skin = buildSandBed({ cols, rows, cell, base, depth: 0.3, ...weak, relief: true });
    plain.wakeAll(); skin.wakeAll();
    expect(plain.step().moved).toBeGreaterThan(0);          // without relief the whole layer starts down the slope
    expect(skin.step().moved).toBe(0);                     // with it, an untouched skin is at rest
    const top = 0.3 + slope * 50 * cell;
    skin.press({ x: 1.5, y: 1.5, sink: 0.03 }); settle(skin);
    expect(top - skin.heightAt(1.5 - 0.078, 1.5)).toBeLessThan(0.008);
  });
});
