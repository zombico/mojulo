import { describe, it, expect } from 'vitest';
import { newBrawl, stepBrawl, brawlHash } from './brawl-core.js';
import { brawlFighter } from './brawl-moves.js';
import { newGunReader, readGunButtons } from './brawl-gunner.js';
import { readGun, GUN_MUZZLE } from './brawl-guns.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// JUMPING OVER AND DUCKING UNDER FIRE: a round flies at the height it left its muzzle and lands only on a body's own
// boxes. A body up in the air as it passes is missed, a ducked one is missed, and a duck fires back from the crouch.
const belt = readBelt({ at: [0, 0], heading: 0, depth: [-1.25, 1.25], angle: 'classic', screens: [{ length: 24 }] }, 'belt');
const F = brawlFighter({ ...solveFighter({ id: 'h', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' });
const ctx = { fighters: [F, F], belt, guns: [readGun('sidearm'), readGun('rifle')] };
const start = () => newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: 4000, z: 0, gun: 0 }, { fighter: 1, side: 'crowd', x: 9000, z: 0, face: -1, gun: 1 }] });
// (the foe fires once at frame 0; the player's pad is decided from what it sees: the round and how far it is)
function meet(padOf, frames = 200) {
  let s = start(), struck = 0, landed = 0;
  const states = new Set(), shotsY = new Set();
  for (let f = 0; f < frames; f++) {
    const round = s.shots.find((t) => t.side === 'crowd'), gap = round ? Math.abs(round.x - s.bodies[0].x) : Infinity;
    s = stepBrawl(s, [padOf({ f, s, gap }), f === 0 ? { fire: [-1, 0] } : {}], ctx);
    for (const e of s.events) { if (e.t === 'hit' && e.d === 0) struck++; if (e.t === 'hit' && e.d === 1) landed++; }
    states.add(s.bodies[0].st);
    for (const t of s.shots) if (t.side === 'player') shotsY.add(t.y);
  }
  return { s, struck, landed, states, shotsY };
}

describe('jumping over and ducking under fire', () => {
  it('a round at the chest hits a body that stands in its path', () => {
    expect(meet(() => ({})).struck).toBe(1);
  });

  it('a jump taken early is over it; taken late it is caught in the air and floored', () => {
    const early = meet(({ s, gap }) => (gap < 2200 && s.bodies[0].st !== 'air' ? { jump: true } : {}));
    expect(early.struck).toBe(0);
    expect(early.states.has('air')).toBe(true);
    const late = meet(({ s, gap }) => (gap < 1300 && s.bodies[0].st !== 'air' ? { jump: true } : {}));
    expect(late.struck).toBe(1);
    expect(late.states.has('down')).toBe(true);
  });

  it('a duck held is under it, and stands when let go', () => {
    const ducked = meet(({ gap }) => (gap < 2500 ? { duck: true } : {}));
    expect(ducked.struck).toBe(0);
    expect(ducked.states.has('hide')).toBe(true);
    expect(ducked.s.bodies[0].st).toBe('stand');
    expect(ducked.s.bodies[0].dk).toBeUndefined();
  });

  it('a duck fires from the crouch, its rounds low, and they still land on a standing body; it never moves', () => {
    const R = meet(() => ({ duck: true, fire: [1, 0], x: 1 }), 120);
    expect(R.struck).toBe(0);
    expect(R.landed).toBeGreaterThan(0);
    expect([...R.shotsY].every((y) => y < GUN_MUZZLE[1])).toBe(true);
    expect(R.s.bodies[0].x).toBe(4000);
  });

  it('a round fired low lands on a ducked body, and a jump clears it', () => {
    const low = (padOf) => {
      let s = start(), struck = 0;
      for (let f = 0; f < 200; f++) {
        const round = s.shots.find((t) => t.side === 'crowd'), gap = round ? Math.abs(round.x - s.bodies[0].x) : Infinity;
        s = stepBrawl(s, [padOf({ s, gap }), f === 0 ? { fire: [-1, 0], low: 1 } : {}], ctx);
        struck += s.events.filter((e) => e.t === 'hit' && e.d === 0).length;
      }
      return struck;
    };
    expect(low(() => ({ duck: true }))).toBe(1);
    expect(low(() => ({}))).toBe(1);
    expect(low(({ s, gap }) => (gap < 2200 && s.bodies[0].st !== 'air' ? { jump: true } : {}))).toBe(0);
  });

  it('the gunner ducks planted with the stick pulled toward the camera, and fires the way it faces', () => {
    const body = { face: 1 };
    const [pad] = readGunButtons(newGunReader(), { h: true, z: -1 }, body);
    expect(pad).toEqual({ x: 0, z: 0, duck: true });
    expect(readGunButtons(newGunReader(), { h: true, z: -1, a: true }, body)[0]).toEqual({ x: 0, z: 0, duck: true, fire: [1, 0] });
    // (planted with the stick anywhere else aims, as it did; unplanted, the stick walks)
    expect(readGunButtons(newGunReader(), { h: true, z: 1, a: true }, body)[0]).toMatchObject({ x: 0, z: 0, fire: [0, 1] });
    expect(readGunButtons(newGunReader(), { z: -1 }, body)[0].duck).toBeUndefined();
  });

  it('a street that never ducks is the street it was: no duck, the same frames', () => {
    const run = () => { let s = start(); for (let f = 0; f < 90; f++) s = stepBrawl(s, [{ x: 1 }, f === 0 ? { fire: [-1, 0] } : {}], ctx); return s; };
    expect(brawlHash(run())).toBe(brawlHash(run()));
    expect(run().bodies.some((b) => b.dk !== undefined)).toBe(false);
  });
});
