import { describe, it, expect } from 'vitest';
import { streetRoomOf, stepYard } from './brawl-practice.js';
import { streetHud, streetMoments, streetSpec, streetYardOf, yardSpec } from './brawl-yard.js';
import { readBelt } from './brawl-belt.js';
import { IDIOMS } from '../../mana-ui/idioms.js';
import { solveFighter } from '../versus/versus-solver.js';

// A STREET'S SCREEN: the game's own. Every player's health, the stop and the falls left, the boss while it stands, a
// moment as a stop clears; none of the practice room's readouts, and no practice settings.
const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, boss: true }] }, 'belt');
const recipe = (id) => ({ ...solveFighter({ id, archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' });
const boss = { ...solveFighter({ id: 'king', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'King' };
const waves = [{ screen: 1, name: 'The alley', crowd: [{ type: 'thug', n: 2 }] }, { screen: 2, crowd: [], boss: { recipe: boss } }];
const room = () => streetRoomOf({ belt, players: [{ recipe: recipe('a') }, { recipe: recipe('b') }], waves, stakes: 3 });

describe('a street\'s screen', () => {
  it('is made of parts the UI runtime knows, and shows no practice readouts or settings', () => {
    const S = streetSpec(), uses = S.hud.children.map((c) => c.use);
    for (const u of [...uses, 'command-list']) expect(IDIOMS[u], u).toBeDefined();
    expect(uses).toEqual(expect.arrayContaining(['street-players', 'street-status', 'boss-bar', 'moment-banner']));
    for (const practice of ['line-marks', 'press-log', 'input-display', 'wave-meter', 'chain-beats']) expect(uses).not.toContain(practice);
    expect(Object.keys(S.screens)).toEqual(['moves']);
    expect(Object.keys(yardSpec().screens)).toContain('settings');
    expect(streetYardOf().css.length).toBeGreaterThan(0);
  });

  it('reads every player\'s health, the stop of how many and the falls left; no boss until it comes in', () => {
    const r = room(), H = streetHud(r, ['Ada', 'Bo']);
    expect(H.party).toEqual([expect.objectContaining({ name: 'Ada', hp: r.s.bodies[0].hp, hpMax: r.ctx.fighters[0].hp }), expect.objectContaining({ name: 'Bo' })]);
    expect(H.street).toEqual({ stop: 1, of: 2, name: '', lives: 3, livesMax: 3 });
    expect(H.boss.on).toBe(false);
    // (a fall taken: one fewer left)
    const fell = stepYard({ ...r, s: { ...r.s, bodies: r.s.bodies.map((b, i) => (i === 0 ? { ...b, ko: 1, st: 'ko', hp: 0 } : b)) } }, [{}, {}]);
    expect(streetHud(fell).street.lives).toBe(2);
  });

  it('names the stop as its wave comes in, and shows the boss while it stands', () => {
    let r = room();
    const sweep = (x) => { for (const b of x.s.bodies) if (b.side === 'crowd' && !b.gone && !b.ko) { b.hp = 0; b.ko = 1; b.st = 'ko'; } return x; };
    let moments = [], sawStop = false, sawBoss = null;
    for (let k = 0; k < 4000 && !r.yard.over; k++) {
      // (walk on; the first stop's wave is let stand a while, then felled, and the boss is watched as it comes in)
      r = stepYard(r.mind.wave === 0 && k > 700 ? sweep(r) : r, [{ x: 1 }, { x: 1 }]);
      moments = streetMoments(moments, r.s.events, ['', 'The alley', '']);
      const H = streetHud(r);
      if (H.street.name === 'The alley') sawStop = true;
      if (H.boss.on && !sawBoss) { sawBoss = H.boss; r = sweep(r); }
    }
    expect(sawStop).toBe(true);
    expect(sawBoss).toMatchObject({ name: 'King', hpMax: expect.any(Number) });
    expect(moments.map((m) => m.text)).toEqual(expect.arrayContaining(['GO', 'King']));
    expect(moments.length).toBeLessThanOrEqual(4);
    expect(new Set(moments.map((m) => m.id)).size).toBe(moments.length);
  });

  it('a staged boss\'s bar is cut by its stages, and each stage begun is a moment', () => {
    const staged = streetRoomOf({ belt, players: [{ recipe: recipe('a') }], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }, { screen: 2, crowd: [], boss: { recipe: boss, stages: [{}, { name: 'Enraged' }, {}] } }], stakes: 3 });
    let r = staged, moments = [], phases = null;
    const sweep = (x) => { for (const b of x.s.bodies) if (b.side === 'crowd' && !b.gone && !b.ko && !x.mind.bosses[b.id]) { b.hp = 0; b.ko = 1; b.st = 'ko'; } return x; };
    for (let k = 0; k < 3000 && !r.yard.over; k++) {
      const B = r.s.bodies.find((p) => r.mind.bosses[p.id]);
      // (the boss worn down a little each frame once it is in, as blows would)
      if (B && !B.gone && !B.ko) B.hp = Math.max(1, B.hp - 3);
      r = stepYard(sweep(r), [{ x: 1 }]);
      moments = streetMoments(moments, r.s.events, []);
      const H = streetHud(r);
      if (H.boss.on) phases = H.boss.phases;
      if (moments.some((m) => m.text === 'STAGE 3')) break;
    }
    expect(phases).toBe(3);
    expect(moments.map((m) => m.text)).toEqual(expect.arrayContaining(['Enraged', 'STAGE 3']));
    expect(moments.find((m) => m.text === 'Enraged').sub).toBe('2 / 3');
  });
});
