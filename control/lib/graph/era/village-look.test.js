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
    // (no chimney on a hall: no stone up at its roof; its turret's footing alone stands over its own)
    expect(Math.max(...H.filter((f) => f.group === 'building:dress-stone').flatMap((f) => f.corners.map((c) => c[2])))).toBeLessThan(tops[0]);
    // (a hall's and a tavern's turret at a front corner; a home none)
    for (const F of [H, T]) expect(F.some((f) => f.group === 'building:turret')).toBe(true);
  });
  it('a gable\'s timber: its barge boards, its tie beam and its king post, proud of its face', () => {
    const tri = [[0, 0, 3], [6, 0, 3], [3, 0, 5.5]], F = gableDress(tri, '#5b3a29');
    expect(F).toHaveLength(4);
    // (the gable faces -y: its timber a hand in front of it)
    for (const f of F) { for (const c of f.corners) expect(c[1]).toBeLessThan(0); const n = (() => { const [a, b, c] = f.corners; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; })(); expect(n[1]).toBeLessThan(0); }
    expect(gableDress([[0, 0, 0]], '#000000')).toEqual([]);
  });
});

// THE STREET (villagePlaces, VILLAGE_LANGUAGE) and THE TURRET (villageTurret, turreted)
import { villagePlaces, VILLAGE_LANGUAGE, villageTurret, turreted, TURRET, villagePaint, VILLAGE_WAY } from './village-look.js';
import { townLanguage } from './out-town.js';
import { structureStyle } from './out-structures.js';
describe('a village\'s street and its turrets', () => {
  it('a straight way\'s houses one each side where the land is free, facing it; a bend or a crossing none', () => {
    const P = villagePlaces(24, ['e', 'w'], 3.4, { n: true, s: true, e: false, w: false });
    expect(P).toHaveLength(2);
    expect(P.find((p) => p.facing === '-y').y).toBeGreaterThan(12 + 1.7);
    expect(P.find((p) => p.facing === '+y').y).toBeLessThan(12 - 1.7);
    expect(villagePlaces(24, ['e', 'w'], 3.4, { n: false, s: true })).toHaveLength(1);
    expect(villagePlaces(24, ['n', 's'], 3.4, { e: true, w: true }).map((p) => p.facing).sort()).toEqual(['+x', '-x']);
    expect(villagePlaces(24, ['n', 'e'], 3.4, { n: true, s: true, e: true, w: true })).toEqual([]);
    expect(VILLAGE_WAY.surface).toBe('brick-paving');
  });
  it('its language is a building language the street speaks; its paint by group', () => {
    expect(() => townLanguage(structureStyle('isekai-meadow', 1), VILLAGE_LANGUAGE)).not.toThrow();
    const V = villageOf('storybook', { id: 'a', use: 'shop' });
    expect(villagePaint(V, 'str:tile')).toBe(V.roof); expect(villagePaint(V, 'str:motif')).toBe(V.sign); expect(villagePaint(V, 'str:plaster')).toBe(V.wall);
  });
  it('a turret: its shaft past the eaves, a cone in the roof\'s hue over it, a gold finial at its point; a share of houses', () => {
    const V = villageOf('storybook', { id: 't', use: 'tavern' }), F = villageTurret(V, { x: 0, y: 0, z0: -0.4, top: 5.8 });
    const zs = F.flatMap((f) => f.corners.map((c) => c[2])), top = Math.max(...zs);
    expect(top).toBeGreaterThan(5.8 + TURRET.past + TURRET.r * TURRET.rise);
    expect(F.filter((f) => f.group === 'building:roof').every((f) => f.colour === V.roof)).toBe(true);
    expect(F.some((f) => f.group === 'building:dress-sign' && f.colour === V.sign)).toBe(true);
    const share = Array.from({ length: 200 }, (_, k) => turreted(`town-house-${k}`, 1)).filter(Boolean).length / 200;
    expect(share).toBeGreaterThan(TURRET.share - 0.15); expect(share).toBeLessThan(TURRET.share + 0.15);
    expect(turreted('x', 3)).toBe(turreted('x', 3));
  });
});

import { villageVariant, VILLAGE_DOORS, VILLAGE_WINDOWS, VILLAGE_TEXTURE } from './village-look.js';
import { dressTownFace } from './town-dress.js';
import { speak, DOORWAY_JAMB } from './out-anchor-structure.js';
describe('each village house its own door and windows; its surfaces textured', () => {
  it('a house\'s variant is its own (the same seed the same), across the doors and windows on the shelf, and a language the street speaks', () => {
    expect(villageVariant('a|1')).toEqual(villageVariant('a|1'));
    const V = Array.from({ length: 40 }, (_, k) => villageVariant(`h|${k}`));
    expect(new Set(V.map((L) => JSON.stringify(L.elements.door))).size).toBe(VILLAGE_DOORS.length);
    expect(new Set(V.map((L) => JSON.stringify(L.elements.lights))).size).toBe(VILLAGE_WINDOWS.length);
    // a round head under a keystone, a square one under a flat lintel
    for (const L of V) expect(L.elements.lintels.form).toBe(L.elements.lights.form === 'rect' ? 'flat' : 'key');
    expect(() => townLanguage(structureStyle('isekai-meadow', 1), V[0])).not.toThrow();
  });
  it('a door\'s boards\' joints a shade under its leaf, its raised panels a shade over; its surround the trim', () => {
    const V = villageOf('storybook', { id: 'd', use: 'shop' }), lum = (h) => [1, 3, 5].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0);
    expect(villagePaint(V, 'str:timber', 'door')).toBe(V.door);
    expect(lum(villagePaint(V, 'str:timber', 'joint'))).toBeLessThan(lum(V.door));
    expect(lum(villagePaint(V, 'str:timber', 'panel'))).toBeGreaterThan(lum(V.door));
    expect(villagePaint(V, 'str:paint', 'surround')).toBe(V.frame);
  });
  it('a roof\'s face gets its tiles in courses, a wall its stucco; a group the texture does not name stays plain', () => {
    const roof = { corners: [[0, 0, 3], [4, 0, 3], [4, 2, 4.5], [0, 2, 4.5]], normal: [0, -0.6, 0.8], fill: '#3a63b0' };
    const wall = { corners: [[0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3]], normal: [0, -1, 0], fill: '#f4ead6' };
    expect(dressTownFace(roof, 'str:tile', VILLAGE_TEXTURE).texture).toBeTruthy();
    expect(dressTownFace(wall, 'str:plaster', VILLAGE_TEXTURE).texture).toBeTruthy();
    expect(dressTownFace(wall, 'str:glass', VILLAGE_TEXTURE)).toBe(wall);
  });
  it('with `doorway` the socle stops at the door\'s jambs (else it runs the front over the door\'s foot); without, the house is as it was', () => {
    const style = structureStyle('isekai-meadow', 1), L = townLanguage(style, villageVariant('s|1'));
    const socles = (o) => { const s = speak(L, 'shop', { w: 9, d: 12 }, style, 5, o); return [...s.faces, ...s.tile].filter((f) => f.part === 'socle' && f.normal[1] < -0.9); };
    const plain = socles({}), cut = socles({ doorway: true });
    expect(cut.length).toBe(plain.length + 1);
    expect(JSON.stringify(speak(L, 'shop', { w: 9, d: 12 }, style, 5, {}))).toBe(JSON.stringify(speak(L, 'shop', { w: 9, d: 12 }, style, 5, { doorway: false })));
    expect(DOORWAY_JAMB).toBeGreaterThan(0);
  });
});

import { villageHour, VILLAGE_HOUR } from './village-look.js';
describe('a village under the hour', () => {
  it('by day the houses as they were; toward night dimmed as the land is and drawn to the night sky\'s hue', () => {
    expect(villageHour({ day: 1, zenith: [40, 108, 220] })).toBeNull();
    expect(villageHour(undefined)).toBeNull();
    expect(villageLight('#f4ead6', 0.6, null)).toBe(villageLight('#f4ead6', 0.6));
    const night = villageHour({ day: 0, zenith: [20, 30, 80] }), dusk = villageHour({ day: 0.5, zenith: [20, 30, 80] });
    const lum = (h) => [1, 3, 5].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0), rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const W = '#f4ead6', day = villageLight(W, 1), d = villageLight(W, 1, dusk), n = villageLight(W, 1, night);
    expect(lum(n)).toBeLessThan(lum(d)); expect(lum(d)).toBeLessThan(lum(day));
    // (no darker than the night's floor; its blue held over its red, the sky's)
    expect(Math.max(...night)).toBeLessThanOrEqual(VILLAGE_HOUR.night + 1e-9);
    const [r, , b] = rgbOf(n); expect(b / r).toBeGreaterThan(rgbOf(W)[2] / rgbOf(W)[0]);
  });
});
