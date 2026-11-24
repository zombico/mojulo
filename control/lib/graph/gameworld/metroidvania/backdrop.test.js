import { describe, it, expect, beforeAll } from 'vitest';
import { rhythmFaults } from '../../era/wall-rhythm.js';
import { boxOf } from './scene.js';
import { composeRoom, backdropLaws, BACKDROP_LAWS, DETAIL_GROUPS, EYE, SCALE } from './backdrop.js';
import { BOX_THEMES } from './themes.js';
import { vampireSonata } from './vampire-sonata.js';

let B;
beforeAll(() => { B = boxOf({ kind: 'geocube', show: 'metroidvania', metroidvania: vampireSonata(), stature: 1.63 }); });
const lost = (D) => backdropLaws(B, D).filter((l) => !l.holds).map((l) => l.id);
const centre = (f) => { const n = f.corners.length; return f.corners.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]); };

describe('the backdrop\'s craft', () => {
  it('composes a room from its own id: the wall\'s rhythm, one focal place, the same every time', () => {
    const look = BOX_THEMES.castle.looks[1], room = B.layout.rooms.find((r) => r.kind === 'corridor' && r.ring === 1 && r.rect[2] === 3);
    const C = composeRoom(room, look);
    expect(composeRoom(room, look)).toEqual(C);
    expect(C.order.length).toBe(room.rect[2] * 2);
    expect(rhythmFaults(C.order)).toEqual([]);
    expect(C.focal.cell).toBeLessThan(room.rect[2]);
  });

  it('holds every law over Vampire Sonata\'s castle, each named once', () => {
    expect(backdropLaws(B, B.dress).map((l) => l.id)).toEqual([...BACKDROP_LAWS]);
    expect(lost(B.dress)).toEqual([]);
    // (its flames haloed, its dust in their light)
    expect(B.dress.faces.some((f) => f.group === 'box:flame' && f.glow)).toBe(true);
    expect(B.dress.motes.count).toBeGreaterThan(0);
  });

  it('says a bare glance, a crowded play band and a room with no focal piece', () => {
    const W = B.greybox.screen.width, H = B.greybox.screen.height;
    // (the dress taken off one closed room's walls: its glances are bare)
    const room = B.layout.rooms.find((r) => r.ring === 1 && r.kind === 'corridor'), [c, rr, w] = room.rect;
    const inRoom = (f) => { const p = centre(f); return p[1] >= c * W && p[1] <= (c + w) * W && p[2] >= rr * H && p[2] <= (rr + 1) * H; };
    expect(lost({ ...B.dress, faces: B.dress.faces.filter((f) => !(DETAIL_GROUPS.includes(f.group) && inRoom(f))) })).toContain('eye-detail');
    // (a crowd behind the play: the band she moves in busier than the wall above it)
    const z = rr * H + 1.5, crowd = Array.from({ length: 80 }, (_, k) => ({ corners: [[-2.9, c * W + k * 0.2, z], [-2.9, c * W + k * 0.2 + 0.1, z], [-2.9, c * W + k * 0.2 + 0.1, z + 0.4], [-2.9, c * W + k * 0.2, z + 0.4]], normal: [1, 0, 0], fill: '#888888', group: 'box:dress' }));
    expect(lost({ ...B.dress, faces: [...B.dress.faces, ...crowd] })).toContain('calm-play');
    expect(EYE.up).toBeGreaterThan(1);
    // (a room's focal piece taken away)
    expect(lost({ ...B.dress, plan: { ...B.dress.plan, [room.id]: { ...B.dress.plan[room.id], focals: 0 } } })).toContain('focal');
  });

  it('says a wall lit flat and a lane that sinks into it', () => {
    const flat = B.dress.faces.map((f) => (f.group === 'box:back' ? { ...f, fill: '#3a2a2c' } : f));
    expect(lost({ ...B.dress, faces: flat })).toContain('pools');
    const sunk = B.dress.faces.map((f) => ((f.group === 'box:stone' || f.group === 'box:ledge') && f.normal[2] > 0.5 ? { ...f, fill: '#050505' } : f));
    expect(lost({ ...B.dress, faces: sunk })).toContain('lane-reads');
  });

  it('draws what a hand holds at its size against her, and says a piece blown up to fill the wall', () => {
    const k = 1.63 / 1.7;
    for (const part of ['book.h', 'sword.l', 'figure.h', 'face.w', 'block.w', 'case.h']) {
      const [lo, hi] = B.dress.sizes[part];
      expect(lo).toBeGreaterThanOrEqual(SCALE[part][0] * k - 1e-3);
      expect(hi).toBeLessThanOrEqual(SCALE[part][1] * k + 1e-3);
    }
    // (the library's books a metre tall, as a shelf drawn to its bay's size would have them)
    expect(lost({ ...B.dress, sizes: { ...B.dress.sizes, 'book.h': [0.2, 1.1] } })).toEqual(['scale']);
  });

  it('draws the relief by the light: every face lit corner by corner, a block domed toward its lamp, a column lit round', () => {
    const W = B.greybox.screen.width, H = B.greybox.screen.height, lum = (h) => { const n = parseInt(h.slice(1), 16); return (n >> 16) + ((n >> 8) & 255) + (n & 255); };
    expect(B.dress.faces.filter((f) => f.group === 'box:back').every((f) => f.cornerFills?.length === f.corners.length)).toBe(true);
    // (a wall lamp of the halls, and a block a little way from it: its corner nearest the lamp the lightest)
    const lamp = B.dress.lamps.find((l) => l.kind === 'candles'), [ls, lz] = [lamp.at[1], lamp.at[2]];
    const block = B.dress.faces.find((f) => f.group === 'box:back' && (() => { const p = centre(f); return Math.hypot(p[1] - ls, p[2] - lz) > 1.5 && Math.hypot(p[1] - ls, p[2] - lz) < 2.5; })());
    const d = block.corners.map((p) => Math.hypot(p[1] - ls, p[2] - lz)), near = d.indexOf(Math.min(...d)), far = d.indexOf(Math.max(...d));
    expect(lum(block.cornerFills[near])).toBeGreaterThan(lum(block.cornerFills[far]));
    // (the near column in the middle of a hall's screen lit by a lamp that reaches it: its strips lit toward the lamp's side)
    const reach = B.dress.lamps.find((l) => l.kind === 'candles' && Math.abs(l.at[1] - (Math.floor(l.at[1] / W) + 0.5) * W) < 2), cs = Math.floor(reach.at[1] / W), cz = Math.floor(reach.at[2] / H), mid = (cs + 0.5) * W, right = reach.at[1] > mid;
    const strips = B.dress.faces.filter((f) => f.corners.every((p) => Math.abs(p[0] + 2.3) < 0.01 && Math.abs(p[1] - mid) <= 0.51) && centre(f)[2] > cz * H + 2.5 && centre(f)[2] < cz * H + 4.5).sort((a, b) => centre(a)[1] - centre(b)[1]);
    expect(strips.length).toBeGreaterThanOrEqual(5);
    const [a, b] = [lum(strips[0].fill), lum(strips.at(-1).fill)];
    expect(right ? b > a : a > b).toBe(true);
  });
});
