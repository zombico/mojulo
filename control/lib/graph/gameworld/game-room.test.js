// The game room at the practice door: the room composed for the world, the hero on its feel, the foes on their spots
// (still until woken), a shift on its counters and measured; offered to any world with a feel, a shift or foes.
import { describe, it, expect } from 'vitest';
import { gameRoom, gameRoomOf } from './game-room.js';
import { practiceFor } from './practice.js';
import { POLES, POLE_IDS } from './feel/cards.js';
import { feelRule } from './feel/lower.js';

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
