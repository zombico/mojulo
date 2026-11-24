import { describe, it, expect, beforeAll } from 'vitest';
import { rhythmFaults } from '../../era/wall-rhythm.js';
import { boxOf } from './scene.js';
import { composeRoom, backdropLaws, BACKDROP_LAWS, DETAIL_GROUPS, EYE } from './backdrop.js';
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
});
