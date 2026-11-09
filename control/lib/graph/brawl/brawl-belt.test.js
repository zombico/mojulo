import { describe, it, expect } from 'vitest';
import { readBelt, beltPoint, screenAt, heldAt, viewHalf, beltScroll, beltBounds, beltCamera, BELT_ANGLES, BELT_ANGLE_IDS } from './brawl-belt.js';
import { brawlLevel, brawlPreset, readBrawlLevel, BRAWL_PRESETS } from './brawl-levels.js';
import { readGreybox } from '../level/greybox-scene.js';

// THE BELT: a straight run of street with a depth band, cut into screens the camera scrolls through, some held until
// their wave is beaten. The camera only travels along it, at one locked angle, never back, never past what is held.
const words = { at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, boss: true }] };
const B = readBelt(words);
const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);

describe('brawl belt: its words', () => {
  it('settles each screen\'s place along it; a boss\'s screen is held', () => {
    expect(B.length).toBe(46);
    expect(B.screens.map((s) => [s.from, s.to, s.gate, s.boss])).toEqual([[0, 14, false, false], [14, 30, true, false], [30, 46, true, true]]);
    expect(B.depth).toEqual([-2.5, 2.5]);
    expect(B.angle).toBe('classic');
  });
  it('refuses what is not a belt, naming the fault', () => {
    expect(() => readBelt({ ...words, wobble: 1 })).toThrow(/wobble/);
    expect(() => readBelt({ ...words, screens: [] })).toThrow(/screens/);
    expect(() => readBelt({ ...words, screens: [{ length: 3 }] })).toThrow(/length/);
    expect(() => readBelt({ ...words, screens: [{ length: 14, boss: true }, { length: 14 }] })).toThrow(/last/);
    expect(() => readBelt({ ...words, depth: [-0.5, 0.5] })).toThrow(/depth/);
    expect(() => readBelt({ ...words, angle: 'orbit' })).toThrow(/angle/);
    // (a held screen the camera's first view does not fill would hold it behind its start)
    expect(() => readBelt({ ...words, screens: [{ length: 8, gate: true }, { length: 20 }] })).toThrow(/held screen/);
  });
  it('lays a point along and across it, turned with it', () => {
    const T = readBelt({ ...words, at: [10, 5], heading: 90, floor: 2 });
    expect(close(beltPoint(T, 3, 0, 0), [10, 8, 2])).toBe(true);
    // (across toward the far side is the belt's left: heading 90, the far side is −x)
    expect(close(beltPoint(T, 0, 1, 1), [9, 5, 3])).toBe(true);
  });
  it('knows the screen a point is in', () => {
    expect([0, 13.9, 14, 29.9, 30, 50].map((s) => screenAt(B, s))).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('brawl belt: the camera scrolls on, never back, never past what is held', () => {
  const half = viewHalf(B);
  it('starts at the belt\'s start and follows the body furthest on past the leading third', () => {
    expect(beltScroll(B, 0, [1, 2])).toBe(half);
    expect(beltScroll(B, half, [half + 0.5])).toBe(half);   // (in the middle third: it stays)
    const on = beltScroll(B, half, [3, half + 4]);
    expect(on).toBeCloseTo(half + 4 - half / 3, 3);
  });
  it('never goes back', () => {
    expect(beltScroll(B, 12, [1])).toBe(12);
  });
  it('a held screen holds it at its end until its wave is beaten, then lets it on', () => {
    expect(heldAt(B, [])).toBe(30);
    expect(beltScroll(B, 20, [40])).toBeCloseTo(30 - half, 3);
    expect(heldAt(B, [1])).toBe(46);
    expect(beltScroll(B, 30 - half, [40], [1])).toBeCloseTo(40 - half / 3, 3);
    // (the boss's screen holds the belt's end: the camera stops there whatever is beaten)
    expect(beltScroll(B, 30, [60], new Set([1, 2]))).toBeCloseTo(46 - half, 3);
  });
  it('keeps the bodies in the view, a body\'s width from its edges, and in the band', () => {
    const at = beltBounds(B, 20);
    expect(at.s[0]).toBeCloseTo(20 - half + 0.5, 3);
    expect(at.s[1]).toBeCloseTo(20 + half - 0.5, 3);
    expect(at.n).toEqual([-2.5, 2.5]);
    expect(beltBounds(B, half).s[0]).toBeCloseTo(0.5, 3);
  });
});

describe('brawl belt: the angle is locked', () => {
  it('each angle looks the same way wherever the camera is along the belt, from the near side, down onto the band', () => {
    for (const id of BELT_ANGLE_IDS) {
      const T = readBelt({ ...words, heading: 30, angle: id });
      const look = (c) => { const { cameraPosition: p, lookAt: l } = beltCamera(T, c); return l.map((v, i) => v - p[i]); };
      expect(close(look(8), look(30))).toBe(true);
      const { cameraPosition: p, lookAt: l } = beltCamera(T, 20);
      // (the near side: the camera stands at −n of the band, square to the belt's far side when its yaw is 0)
      const far = [-Math.sin(Math.PI / 6), Math.cos(Math.PI / 6)];
      expect((l[0] - p[0]) * far[0] + (l[1] - p[1]) * far[1]).toBeGreaterThan(0);
      expect(p[2]).toBeGreaterThan(l[2] - 1e-9);
      expect(beltCamera(T, 20).horizontalFov).toBe(BELT_ANGLES[id].fov);
    }
  });
});

describe('brawl levels: a greybox street', () => {
  // (one preset: the procedure every street row runs through)
  const id = Object.keys(BRAWL_PRESETS)[0];
  it('is a greybox and its belt, the belt\'s words over the preset\'s', () => {
    const P = brawlPreset(id);
    expect(readGreybox({ blocks: P.blocks }).blocks.length).toBe(P.blocks.length);
    const high = brawlPreset(id, { angle: 'high' });
    expect(high.belt.angle).toBe('high');
    expect(high.belt.screens).toEqual(P.belt.screens);
  });
  it('carries its street with the belt: a belt that runs elsewhere lays the same blocks there', () => {
    const a = brawlPreset(id), b = brawlPreset(id, { at: [40, -20], heading: 90 });
    expect(b.blocks.length).toBe(a.blocks.length);
    for (let k = 0; k < a.blocks.length; k += 7) {
      const [x, y, z] = a.blocks[k].at;
      expect(close(b.blocks[k].at, [40 - y, -20 + x, z])).toBe(true);
      expect(b.blocks[k].turn).toBe(90);
    }
  });
  it('leaves the band clear: nothing stands in it but the screens\' lines on the road', () => {
    const { belt, blocks } = brawlPreset(id);
    const [near, far] = belt.depth;
    const inBand = blocks.filter((b) => b.size[2] > 0.2 && b.size[0] < belt.length && b.at[1] - b.size[1] / 2 < far - 0.01 && b.at[1] + b.size[1] / 2 > near + 0.01 && b.at[0] > 0 && b.at[0] < belt.length);
    expect(inBand).toEqual([]);
  });
  it('the manifest a brawl is fought on: the greybox with its belt, the register and the sun beside it', () => {
    const m = brawlLevel({ kind: 'greybox', preset: id }, { title: 'street', register: 'anime' });
    expect(m.kind).toBe('greybox');
    expect(m.title).toBe('street');
    expect(m.brawl.belt.screens.length).toBeGreaterThan(1);
    expect(m.brawl.register).toBe('anime');
    expect(m.brawl.sun).toHaveLength(3);
    expect(readGreybox(m).blocks.length).toBe(m.blocks.length);
    // (no register: no look and no sun)
    expect(Object.keys(brawlLevel({ kind: 'greybox', preset: id }).brawl)).toEqual(['belt']);
    expect(() => readBrawlLevel({ kind: 'greybox', preset: id, lane: {} })).toThrow(/lane/);
    expect(() => readBrawlLevel({ kind: 'greybox', preset: 'moon' })).toThrow(/preset/);
    expect(() => brawlLevel({ kind: 'greybox', preset: id }, { register: 'noir' })).toThrow(/register/);
  });
});

describe('brawl levels: a street\'s band is the street\'s', () => {
  it('a band wider than the street between its kerb and its pavement\'s things is refused', () => {
    const id = Object.keys(BRAWL_PRESETS)[0];
    expect(() => brawlPreset(id, { depth: [-2.5, 4] })).toThrow(/band/);
    expect(brawlPreset(id, { depth: [-2, 2] }).belt.depth).toEqual([-2, 2]);
  });
});
