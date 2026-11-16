import { describe, it, expect } from 'vitest';
import { streetRoomOf, stepYard, resetYard, yardOver, yardRead } from './brawl-practice.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// A STREET AS A ROOM: a level's street played on the room the page steps. Its waves wait at their gates and come in as
// the players reach them, the camera held until each falls; won at the last, lost at the last fall allowed; a run &
// gun's players carry guns on it.
const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, boss: true }] }, 'belt');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const boss = { ...solveFighter({ id: 'king', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'King' };
const waves = [{ screen: 1, crowd: [{ type: 'thug', n: 2, roster: 1 }] }, { screen: 2, crowd: [{ type: 'knife', n: 1 }], boss: { recipe: boss, roster: 2 } }];
const street = (o = {}) => streetRoomOf({ belt, players: [{ recipe }], waves, stakes: 2, ...o });
// (walk right; whoever of the crowd is on the street falls at once: the street's own rules do the rest)
const sweep = (r) => { for (const b of r.s.bodies) if (b.side === 'crowd' && !b.gone && !b.ko) { b.hp = 0; b.ko = 1; b.st = 'ko'; } return r; };
function run(r, n, fell = false) {
  const ev = [];
  for (let k = 0; k < n && !r.yard.over; k++) { r = stepYard(fell ? sweep(r) : r, [{ x: 1 }]); ev.push(...r.s.events); }
  return { r, ev };
}

describe('a street as a room', () => {
  it('starts with its waves offstage and its bodies\' cast in the street\'s order: a wave at a time, the boss first', () => {
    const r = street();
    expect(r.yard).toMatchObject({ street: true, stakes: 2, falls: 0, over: null });
    expect(r.s.bodies.slice(1).every((b) => b.gone)).toBe(true);
    expect(r.yard.cast).toEqual([1, 1, 2, null]);
    expect(() => yardRead(r)).not.toThrow();
    expect(() => streetRoomOf({ belt, players: [{ recipe }], waves: [] })).toThrow(/a wave or more/);
  });

  it('a wave comes in as the player reaches its screen, and the camera is held at its gate until it falls', () => {
    const { r, ev } = run(street(), 900);
    expect(ev.find((e) => e.t === 'wave')).toMatchObject({ screen: 1 });
    expect(r.s.cleared).not.toContain(1);
    // (held: the view's right edge never passes the first gate while its wave stands)
    expect(r.s.cam / 1000).toBeLessThanOrEqual(14 + 16);
    expect(yardOver(r)).toBeNull();
  });

  it('won when the last wave has fallen, the boss with it; a reset lays it again', () => {
    const { r, ev } = run(street(), 4000, true);
    expect(ev.filter((e) => e.t === 'cleared').map((e) => e.screen)).toEqual([1, 2]);
    expect(ev.some((e) => e.t === 'boss')).toBe(true);
    expect(yardOver(r)).toBe('won');
    const again = resetYard(r);
    expect(again.yard).toMatchObject({ over: null, falls: 0 });
    expect(again.s.f).toBe(0);
  });

  it('lost at the last fall allowed', () => {
    let r = street({ stakes: 1 });
    r = stepYard({ ...r, s: { ...r.s, bodies: r.s.bodies.map((b, i) => (i === 0 ? { ...b, ko: 1, st: 'ko', hp: 0 } : b)) } }, [{}]);
    expect(yardOver(r)).toBe('lost');
  });

  it('a run & gun\'s street: the players carry guns, their first over the sidearm, the crowd\'s after them', () => {
    const r = street({ range: { guns: ['spread'] }, waves: [{ screen: 1, crowd: [{ type: 'rifleman', n: 2 }] }, { screen: 2, crowd: [{ type: 'gunner', n: 1 }] }] });
    expect(r.yard.range).toBe(true);
    expect(r.ctx.guns.slice(0, 3).map((g) => g.id)).toEqual(['sidearm', 'spread', 'grenade']);
    expect(r.s.bodies[0].gn).toBe(1);
    expect(r.ctx.guns[r.s.bodies[1].gn].id).toBe('rifle');
    expect(yardRead(r).gun).toMatchObject({ id: 'spread' });
    const { r: after } = run(r, 120);
    expect(after.s.f).toBe(120);
  });
});
