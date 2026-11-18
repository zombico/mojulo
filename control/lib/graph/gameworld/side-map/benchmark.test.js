// The render benchmark (side-map/benchmark.js), its arithmetic: the concepts read on frames built by hand, so what each
// measure says is known. A face's group says its role; one shot a zone kind, its hero standing on a top; the role pass
// is every face in its role's colour with the hero's stand-in among them; on a frame, the hero's share and the lane's
// place are read off the role pass, the lit tops, the painting, the sharpness and the recession off the page; a flat
// closed part is not painted; a top of one colour is one smooth band (`top-segmented` lost); a foreground under the feet holds `foreground` and one over the hero loses it; moving things are said
// missing, never claimed. A round read on the page (the shot's look): a white core, its hue peaking in the falloff and a
// thin accent hold; a flat disc of the hue loses the white core, one with no accent loses the accent.
import { describe, it, expect } from 'vitest';
import { roleOf, benchmarkShots, rolePayload, measureShot, benchmarkLaws, ROLE_COLOURS, measureRound, roundLaws } from './benchmark.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { firstSideMap } from './first.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// a 40 × 40 frame: back over a top row over the closed parts, the hero 5 rows tall standing on the top
// (fore: a foreground band in the frame's rows from it, under the feet at 30, over the hero at 20)
function frame({ stripes = true, fore = null } = {}) {
  const W = 40, H = 40, roles = new Uint8Array(W * H * 3), page = new Uint8Array(W * H * 3);
  const put = (img, x, y, c) => { img.set(c, 3 * (y * W + x)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = y < 27 ? 'back' : y === 27 ? 'top' : 'closed';
    put(roles, x, y, hex(ROLE_COLOURS[r]));
    put(page, x, y, r === 'back' ? [30, 34, 44] : r === 'top' ? [200, 210, 230] : stripes && (x + y) % 2 ? [70, 90, 150] : [50, 70, 130]);
  }
  for (let y = 22; y <= 26; y++) for (let x = 19; x <= 21; x++) put(roles, x, y, hex(ROLE_COLOURS.hero));
  if (fore !== null) for (let y = fore; y < H; y++) for (let x = 15; x <= 25; x++) { put(roles, x, y, hex(ROLE_COLOURS.fore)); put(page, x, y, [12, 14, 16]); }
  return { page: { W, H, rgb: page }, roles: { W, H, rgb: roles } };
}

describe('the render benchmark', () => {
  it('a face\'s group says its role', () => {
    expect(['sidemap:edge', 'sidemap:rock', 'sidemap:paint-bed', 'sidemap:hills', 'sidemap:ladder', 'sidemap:lamp', 'sidemap:emblem', 'sidemap:back', 'sidemap:doodad-back', 'sidemap:doodad-foreground'].map(roleOf)).toEqual(['top', 'closed', 'closed', 'hills', 'play', 'lamp', 'boss', 'back', 'closed', 'fore']);
  });
  it('one shot a zone kind, the hero standing on a top in each; the role pass carries the hero', () => {
    const map = firstSideMap(), L = layoutSideMap(map, { reach, stature: 1.67 }), shots = benchmarkShots(L, dressSideMap(L, map));
    expect(shots.map((s) => s.name)).toEqual(['run', 'climb', 'boss']);
    for (const s of shots) expect(L.solids.some((r) => r.zone === s.zone && Math.abs(r.z1 - s.hero[1]) < 1e-3 && r.s0 <= s.hero[0] && r.s1 >= s.hero[0])).toBe(true);
    const P = rolePayload({ faces: [{ group: 'sidemap:rock', fill: '#123456', corners: [], normal: [1, 0, 0] }] }, shots[0], 1.67);
    expect(P.faces.map((f) => f.fill)).toEqual([ROLE_COLOURS.closed, ROLE_COLOURS.hero]);
  });
  it('on a frame: the hero an eighth, the lane two thirds down, the tops lit, the closed parts painted and sharpest', () => {
    const M = measureShot(frame(), { name: 'run' });
    expect(M.hero).toBeCloseTo(0.125, 3);
    expect(M.lane).toBeCloseTo(0.675, 3);
    expect(M.litTops).toBeGreaterThan(5);
    expect(M.painted).toBeGreaterThan(3);
    expect(M.sharp.closed).toBeGreaterThan(M.sharp.back);
    const laws = Object.fromEntries(benchmarkLaws([M]).map((l) => [l.id, l.holds]));
    expect(laws).toMatchObject({ 'hero-share': true, 'lane-down': true, 'lit-tops': true, painted: true, 'lane-sharpest': true, 'top-segmented': false, foreground: false, moving: false });
  });
  it('a foreground under the feet holds; one standing over the hero loses; a run with none says so', () => {
    const law = (fore) => benchmarkLaws([measureShot(frame({ fore }), { name: 'run' })]).find((l) => l.id === 'foreground');
    expect(law(30).holds).toBe(true);
    expect(law(20).holds).toBe(false);
    expect(law(null)).toMatchObject({ holds: false, says: expect.stringMatching(/no foreground/) });
  });
  it('a flat closed part is not painted', () => {
    const M = measureShot(frame({ stripes: false }), { name: 'run' });
    expect(benchmarkLaws([M]).find((l) => l.id === 'painted').holds).toBe(false);
  });
  it('reads a lamp\'s falloff on the back: lighter near the lamp than far from it; an even back has none', () => {
    const W = 200, H = 100, mk = (pool) => {
      const roles = new Uint8Array(W * H * 3), page = new Uint8Array(W * H * 3);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = 3 * (y * W + x), lamp = x >= 20 && x < 40 && y >= 10 && y < 50, d = Math.hypot(x - 30, y - 30), v = pool ? Math.max(20, 120 - d) : 40;
        roles.set(hex(ROLE_COLOURS[lamp ? 'lamp' : 'back']), i);
        page.set(lamp ? [255, 255, 230] : [v, v, v], i);
      }
      return { page: { W, H, rgb: page }, roles: { W, H, rgb: roles } };
    };
    expect(measureShot(mk(true), { name: 'run' }).light.lamp).toBeGreaterThan(5);
    expect(Math.abs(measureShot(mk(false), { name: 'run' }).light.lamp)).toBeLessThan(1);
  });
});

describe('a round read on the page', () => {
  // a 80 × 80 dark frame and the same with a round on it: a white core, the gold in its falloff, a thin cyan ring
  const frames = ({ core = true, accent = true } = {}) => {
    const W = 80, H = 80, quiet = new Uint8Array(W * H * 3).fill(20), page = new Uint8Array(W * H * 3).fill(20);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 40, y - 40), i = 3 * (y * W + x);
      if (accent && Math.abs(d - 18) < 0.45) { page.set([60, 230, 255], i); continue; }
      if (d < 4 && core) page.set([255, 255, 255], i);
      else if (d < 16) { const k = 1 - d / 16; page.set([Math.round(40 + 215 * Math.min(1, k * 1.6)), Math.round(30 + 180 * Math.min(1, k * 1.6)), 25], i); }
    }
    return { page: { W, H, rgb: page }, quiet: { W, H, rgb: quiet } };
  };
  it('a white core, the hue in the falloff, a thin accent: all hold', () => {
    const M = measureRound(frames(), { r: 24 });
    expect(Object.fromEntries(roundLaws(M).map((l) => [l.id, l.holds]))).toEqual({ 'white-core': true, 'hue-in-falloff': true, 'accent-thin': true });
  });
  it('no white core loses it; no accent loses it', () => {
    expect(roundLaws(measureRound(frames({ core: false }), { r: 24 })).find((l) => l.id === 'white-core').holds).toBe(false);
    expect(roundLaws(measureRound(frames({ accent: false }), { r: 24 })).find((l) => l.id === 'accent-thin').holds).toBe(false);
  });
});
