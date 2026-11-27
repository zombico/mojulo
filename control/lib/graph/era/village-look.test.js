// A VILLAGE'S LOOK (era/village-look.js): a town's buildings in a palette of their own, apart from the land's, and each
// dressed: its footing, its timber, its shutters set out on the shell's face, its door's frame, a home's chimney, a
// tavern's sign, a hall's banners, its gables' timber. Deterministic.
import { describe, it, expect } from 'vitest';
import { VILLAGE_LOOKS, VILLAGE, villageOf, villageDress, gableDress, villageLight } from './village-look.js';

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hueOf = (h) => { const [r, g, b] = rgb(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return ((x * 60) + 360) % 360; };
const L = VILLAGE_LOOKS.storybook;

describe('a village\'s palette', () => {
  it('its roofs are never green, the hall and the tavern their own, every home apart from the tavern in hue', () => {
    for (const r of [L.roofs.hall, L.roofs.tavern, ...L.roofs.homes]) { const h = hueOf(r); expect(h > 70 && h < 160, `${r} is green`).toBe(false); }
    expect(villageOf('storybook', { id: 'x', use: 'hall' }).roof).toBe(L.roofs.hall);
    expect(villageOf('storybook', { id: 'x', use: 'tavern' }).roof).toBe(L.roofs.tavern);
    const tav = hueOf(L.roofs.tavern);
    for (const r of L.roofs.homes) { const d = Math.abs(hueOf(r) - tav); expect(Math.min(d, 360 - d), r).toBeGreaterThan(14); }
    // (its walls far lighter than its roofs: a building reads by its value as well as its hue)
    const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    for (const w of L.walls) expect(lum(w)).toBeGreaterThan(200);
    expect(villageOf('storybook', { id: 'h1', use: 'dwelling' }, 3)).toEqual(villageOf('storybook', { id: 'h1', use: 'dwelling' }, 3));
    expect(() => villageOf('gloomy', { id: 'x', use: 'hall' })).toThrow(/look/);
    // (lit cleanly: its shade side lifted, never under four fifths of its colour)
    expect(lum(villageLight('#ffffff', 0))).toBeGreaterThan(0.8 * 255);
  });
});

describe('a village building\'s dress', () => {
  // (two rooms side by side, a window on the front of the first, the door in its front)
  const rects = [[-0.25, -0.25, 6.25, 5.25], [6.25, -0.25, 10.25, 4.25]], tops = [3.35, 3.35];
  const holes = [{ n: [0, -1, 0], plane: 0, u0: 3.6, u1: 4.6, z0: 0.9, z1: 2.1 }], ways = [{ lo: 1, hi: 2.2 }], entry = { y: 0 };
  const groups = (fs) => fs.reduce((a, f) => ({ ...a, [f.group]: (a[f.group] ?? 0) + 1 }), {});
  it('a home: its footing, its timber, its window\'s frame and shutters out on the shell\'s face, a chimney through its roof', () => {
    const V = villageOf('storybook', { id: 'h', use: 'dwelling' }), F = villageDress(V, { rects, tops, holes, ways, entry, below: 0.4, use: 'dwelling' }), G = groups(F);
    for (const g of ['building:dress-stone', 'building:dress-timber', 'building:dress-frame', 'building:dress-shutter']) expect(G[g], g).toBeGreaterThan(0);
    // (the shutters in front of the shell's face: the room's face is at y 0, the shell's the wall's half thickness out)
    for (const f of F.filter((x) => x.group === 'building:dress-shutter')) for (const c of f.corners) expect(c[1]).toBeLessThanOrEqual(-0.25 + 1e-9);
    // (the footing from under the floor to knee height)
    const st = F.filter((x) => x.group === 'building:dress-stone').flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...st)).toBeLessThan(-0.4); expect(Math.max(...st)).toBeGreaterThan(tops[0]);   // (and the chimney past the eaves)
    // (no stud across the window or the door)
    // (a stud rises from the footing; the door's jambs stand from its threshold)
    const studs = F.filter((x) => x.group === 'building:dress-timber' && x.corners.every((c) => c[1] <= -0.25 + 1e-9) && Math.min(...x.corners.map((c) => c[2])) >= VILLAGE.footing - 1e-9 && Math.max(...x.corners.map((c) => c[2])) - Math.min(...x.corners.map((c) => c[2])) > 2);
    for (const f of studs) { const u = f.corners.reduce((a, c) => a + c[0], 0) / f.corners.length; expect(u > 3.6 - 0.2 && u < 4.6 + 0.2, `stud at ${u}`).toBe(false); expect(u > 1 - 0.2 && u < 2.2 + 0.2, `stud at ${u}`).toBe(false); }
    expect(JSON.stringify(villageDress(V, { rects, tops, holes, ways, entry, below: 0.4, use: 'dwelling' }))).toBe(JSON.stringify(F));
  });
  it('a tavern hangs its sign, a hall its banners and no chimney', () => {
    const T = villageDress(villageOf('storybook', { id: 't', use: 'tavern' }), { rects, tops, holes, ways, entry, use: 'tavern' }), H = villageDress(villageOf('storybook', { id: 'l', use: 'hall' }), { rects, tops, holes, ways, entry, use: 'hall' });
    expect(groups(T)['building:dress-sign']).toBeGreaterThan(0);
    expect(groups(H)['building:dress-banner']).toBeGreaterThan(0);
    expect(Math.max(...H.filter((f) => f.group === 'building:dress-stone').flatMap((f) => f.corners.map((c) => c[2])))).toBeLessThan(VILLAGE.footing + 1e-9);
  });
  it('a gable\'s timber: its barge boards, its tie beam and its king post, proud of its face', () => {
    const tri = [[0, 0, 3], [6, 0, 3], [3, 0, 5.5]], F = gableDress(tri, '#5b3a29');
    expect(F).toHaveLength(4);
    // (the gable faces -y: its timber a hand in front of it)
    for (const f of F) { for (const c of f.corners) expect(c[1]).toBeLessThan(0); const n = (() => { const [a, b, c] = f.corners; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; })(); expect(n[1]).toBeLessThan(0); }
    expect(gableDress([[0, 0, 0]], '#000000')).toEqual([]);
  });
});
