// The game room at the practice door: the room composed for the world, the hero on its feel, the foes on their spots
// (still until woken), a shift on its counters and measured; offered to any world with a feel, a shift or foes.
import { describe, it, expect } from 'vitest';
import { gameRoom, gameRoomOf } from './game-room.js';
import { practiceFor } from './practice.js';
import { POLES, POLE_IDS } from './feel/cards.js';
import { feelRule } from './feel/lower.js';
import { readGameworld } from './world.js';

const FIGHTER = POLE_IDS.find((id) => POLES[id].demo.includes('attack') && POLES[id].base === 'action');

describe('the game room', () => {
  it('is offered to a world that fights hand to hand or works a shift, and left to their own rooms for the rest', () => {
    expect(gameRoomOf({ feel: FIGHTER })).toBe(true);
    expect(gameRoomOf({ quick: { goal: 'work' } })).toBe(true);
    expect(gameRoomOf({ id: 'bare' })).toBe(false);
    const PLATFORMER = POLE_IDS.find((id) => POLES[id].base === 'platformer' && !POLES[id].demo.includes('attack'));
    if (PLATFORMER) expect(practiceFor({ feel: PLATFORMER }).rooms).not.toContain('room');
    expect(practiceFor({ feel: FIGHTER }).rooms).toContain('room');
  });
  it('stands the composed room, the hero on the feel at the spawn, and a foe on every spot', () => {
    const r = gameRoom({ id: 'g', feel: FIGHTER }), M = r.manifest, A = r.room.anchors;
    const hero = M.entities.find((e) => e.pilotable);
    expect(hero.transform.pos).toEqual(A.spawn);
    expect(hero.rule.speed).toBe(feelRule(FIGHTER).speed);
    expect(M.entities.filter((e) => /^foe-/.test(e.id)).length).toBe(A.foes.length);
    // every block of the composition collides (the four walls besides)
    expect(M.colliders.length).toBe(4 + r.room.primitives.reduce((t, p) => t + (p.kind === 'platform' && (p.h ?? 0) > 0.72 ? 2 : 1), 0));
    expect(r.laws.every((l) => l.holds)).toBe(true);
    expect(M.camera.rule).not.toBe('overhead');
  });
  it('a shift: its line on the counters, seen from overhead, the work shown and measured', () => {
    const r = gameRoom({ id: 'w', quick: { goal: 'work' } });
    expect(r.manifest.camera.rule).toBe('overhead');
    expect(r.manifest.events.sources.some((z) => z.use === 'w0-serve')).toBe(true);
    expect(r.manifest.events.entities.some((e) => e.type === 'work-pip')).toBe(true);
    expect(r.manifest.faces.some((f) => f.group === 'room:flow')).toBe(true);
    expect(r.measured.won).toBe(true);
  });
});

describe('the game room\'s area', () => {
  it('stands in its trade\'s area, the world\'s own written over it, or on the plane', () => {
    const own = gameRoom({ id: 'w', quick: { goal: 'work' } });
    expect(own.area.name).toBe(own.dress.trade);
    expect(own.area.cut).toEqual(['s']);
    expect(own.manifest.faces.some((f) => f.group === 'room:area:wall')).toBe(true);
    expect(own.manifest.faces.some((f) => f.group === 'room:plane')).toBe(false);
    const H = own.room.half, south = own.manifest.colliders.find((c) => c.max[1] <= -H);
    expect(south.max[2]).toBeLessThan(own.manifest.colliders.find((c) => c.min[1] >= H).max[2] + 1e-9);
    const G = { id: 'w', quick: { goal: 'work' }, room: { area: { like: 'farm', walls: 'stone', surround: false } } };
    const w = gameRoom(G);
    expect(w.area).toMatchObject({ name: 'farm', walls: 'stone', surround: [] });
    const plane = gameRoom(G, { area: false });
    expect(plane.area).toBeNull();
    expect(plane.manifest.faces.some((f) => f.group === 'room:plane')).toBe(true);
    expect(plane.manifest.faces.some((f) => String(f.group).startsWith('room:area'))).toBe(false);
  });
  it('is the world\'s to design: `room: { dress?, area? }`, read and taught', () => {
    const W = (room) => ({ id: 'r', levels: { a: { walk: { nodes: { t: { trail: true } } } } }, room });
    expect(readGameworld(W({ dress: 'farm', area: { like: 'farm', sky: '#dde8ef' } })).room.dress).toBe('farm');
    expect(() => readGameworld(W({ area: 'moon' }))).toThrow(/area is/);
    expect(() => readGameworld(W({ dress: 'moon' }))).toThrow(/room.dress/);
    expect(() => readGameworld(W({ walls: 'stone' }))).toThrow(/room has no 'walls'/);
  });
});
