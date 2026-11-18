import { describe, it, expect } from 'vitest';
import { POWERS, POWER_IDS, ATTACK_POWER, POWER_DIALS, powerOf, readPower, powerRecipe, powerMoves, powerHeft, powerAdvice, isRound } from './brawl-powers.js';
import { beamColour, powerLook } from './brawl-power-look.js';
import { brawlFighter, newReader, readButtons } from './brawl-moves.js';
import { streetOf, stepStreet } from './brawl-crowd.js';
import { newBrawl, stepBrawl } from './brawl-core.js';
import { readBelt } from './brawl-belt.js';
import { SPECIAL_SLOTS } from '../versus/versus-library.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { solveFighter } from '../versus/versus-solver.js';

// A HERO'S POWER: a card is a special over the fight's library, its stock a few uses a life. The concept, on one card of
// each kind the shelf holds (a round down the street, a move that strikes all round, a body taken), chosen from the
// shelf by what its special is made from, never by name.
const recipe = (archetype = 'all-rounder') => ({ ...solveFighter({ id: 'hero', archetype }).recipe, archetype });
const byKind = (f) => POWER_IDS.find((id) => f(POWERS[id]));
const ROUND = byKind((P) => P.pierce > 1), ROUNDABOUT = byKind((P) => P.special.from === 'whirl'), TAKE = byKind((P) => P.special.from === 'grab');
const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, boss: true }] });
// (one hero at the gate's screen, its wave come in, pressing S at a person's pace every `every` frames)
function presses(power, { frames = 600, every = 60, hp = 99999, crowd = [{ type: 'thug', n: 4 }], lives } = {}) {
  let st = streetOf({ belt, players: [{ recipe: { ...recipe(), hp }, ...(power ? { power } : {}) }], waves: [{ screen: 1, crowd }], ...(lives ? { lives } : {}) });
  st.s.bodies[0].x = 22000;
  let r = newReader();
  const log = [];
  for (let f = 0; f < frames; f++) {
    const [pad, r2] = readButtons(r, f % every === 0 ? { s: true } : {}, st.s.bodies[0], st.ctx.fighters[0]);
    r = r2;
    st = stepStreet(st, [pad]);
    log.push(st);
  }
  return log;
}
const events = (log, t) => log.flatMap((st) => st.s.events.filter((e) => e.t === t));

describe('a hero\'s power', () => {
  it('is a card read by its id or its words; its look a beam of the elements\' shelf, in that beam\'s colour', () => {
    expect(readPower(ROUND)).toEqual({ id: ROUND, stock: POWERS[ROUND].stock, beam: POWERS[ROUND].beam, screen: POWERS[ROUND].beat.screen });
    expect(readPower({ id: ROUND, stock: 1 }).stock).toBe(1);
    expect(() => powerOf('telekinesis')).toThrow(/a power is one of/);
    expect(() => readPower({ id: ROUND, stock: 0 })).toThrow(/stock/);
    expect(() => readPower({ id: ROUND, glow: 1 })).toThrow(/not a power's word/);
    expect(() => powerLook({ id: ROUND, beam: 'nope' })).toThrow(/beam/);
    expect(powerLook(ROUND).colour).toBe(beamColour(POWERS[ROUND].beam));
    expect(beamColour(POWERS[ROUND].beam)).toMatch(/^#[0-9a-f]{6}$/);
    // (a hero's own attack, the actions page's beam, plays as a power the shelf holds)
    expect(new Set(BEAM_NAMES.map((b) => ATTACK_POWER[b]).filter(Boolean)).size).toBeGreaterThan(1);
    for (const id of new Set(Object.values(ATTACK_POWER))) expect(POWERS[id], id).toBeDefined();
  });

  it('is every direction of the special, compiled by the fight on any style, and marked as the power', () => {
    for (const [id, arch] of [[ROUND, 'zoner'], [ROUNDABOUT, 'rushdown'], [TAKE, 'grappler']]) {
      const F = brawlFighter(powerRecipe(recipe(arch), id), { style: arch });
      const moves = powerMoves(F, id);
      for (const d of SPECIAL_SLOTS) expect(moves[`special.${d}.M`]).toMatchObject({ id: `power.${id}`, power: 1 });
      // (the desperation is the brawler's own still, and no other move is a power)
      expect(moves.desperate.power).toBeUndefined();
      expect(Object.values(moves).filter((m) => m.power).every((m) => m.id === `power.${id}`)).toBe(true);
    }
    // (a round's pierce and its knock laid on its projectile)
    const P = powerMoves(brawlFighter(powerRecipe(recipe(), ROUND)), ROUND)['special.neutral.M'].projectile;
    expect(P.hits).toBe(POWERS[ROUND].pierce);
  });

  it('spends a use as it starts, is not thrown with none left, and a fall fills it again', () => {
    const log = presses(ROUND, { frames: 60 * 12 });
    const spent = events(log, 'power');
    expect(spent.map((e) => e.left)).toEqual(Array.from({ length: POWERS[ROUND].stock }, (_, k) => POWERS[ROUND].stock - 1 - k));
    expect(log.at(-1).s.bodies[0].pw).toBe(0);
    // (pressed with none left, no special starts)
    const after = log.findIndex((st) => st.s.bodies[0].pw === 0);
    expect(log.slice(after + 90).some((st) => st.s.events.some((e) => e.t === 'special' && e.p === 0))).toBe(false);
    // (a fall: the hero knocked out where the street has lives is up again, its stock full)
    const fell = presses(ROUND, { frames: 60 * 40, every: 20, hp: 60, crowd: [{ type: 'heavy', n: 3 }], lives: 3 });
    const fall = events(fell, 'fall')[0];
    expect(fall).toBeDefined();
    const k = fell.findIndex((st) => st.s.events.some((e) => e.t === 'fall'));
    expect(fell[k].s.bodies[0].pw).toBe(POWERS[ROUND].stock);
  });

  it('a round of it passes through the bodies lined up on its line', () => {
    const log = presses(ROUND, { frames: 200, every: 999 });
    const hit = events(log, 'hit').filter((e) => e.p === 0 && e.kind === 'shot');
    expect(new Set(hit.map((e) => e.d)).size).toBeGreaterThan(1);
  });

  it('absent, nothing is added: no stock on a body, no power spent, a special thrown as it always was', () => {
    const log = presses(null, { frames: 200 });
    expect('pw' in log[0].s.bodies[0]).toBe(false);
    expect(events(log, 'power')).toEqual([]);
    expect(events(log, 'special').length).toBeGreaterThan(0);
  });
});

// A POWER DESIGNED: a kind made the person's own, its dials bounded; never a new move.
describe('a power designed', () => {
  const moveOf = (power, arch = 'all-rounder') => powerMoves(brawlFighter(powerRecipe(recipe(arch), power), { style: arch }), power)['special.neutral.M'];
  it('is a kind with a name, a look, its uses and its dials; read back as it was written', () => {
    const P = readPower({ kind: ROUND, name: 'Solar lance', beam: 'laser', stock: 2, strength: 120, pierce: 3 });
    expect(P).toEqual({ id: ROUND, stock: 2, beam: 'laser', screen: POWERS[ROUND].beat.screen, name: 'Solar lance', dials: { strength: 120, pierce: 3 } });
    expect(readPower({ kind: ROUND, screen: 'none' }).screen).toBe('none');
    expect(() => readPower({ kind: ROUND, screen: 'sparkle' })).toThrow(/super beat/);
    expect(readPower(P)).toEqual(P);
    expect(() => readPower({ kind: ROUND, id: ROUND })).toThrow(/said once/);
    expect(() => readPower({ kind: ROUND, strength: POWER_DIALS.strength.max + 1 })).toThrow(/strength/);
    expect(() => readPower({ kind: ROUNDABOUT, speed: 120 })).toThrow(/throws no round/);
    expect(isRound(ROUND)).toBe(true);
    expect(isRound(ROUNDABOUT)).toBe(false);
  });

  it('its dials turn its kind\'s numbers: strength its damage, speed and size its round, pierce the bodies passed through', () => {
    const base = moveOf(ROUND), strong = moveOf({ kind: ROUND, strength: 150, speed: 50, size: 200, pierce: 2 });
    expect(strong.damage).toBeGreaterThan(base.damage);
    expect(strong.projectile.speed).toBeLessThan(base.projectile.speed);
    expect(strong.projectile.w).toBeGreaterThan(base.projectile.w);
    expect(strong.projectile.hits).toBe(2);
    // (a kind whose damage is in its rows is turned there too)
    expect(moveOf({ kind: ROUNDABOUT, strength: 150 }).damage).toBeGreaterThan(moveOf(ROUNDABOUT).damage);
  });

  it('far from its kind\'s measure it is advised, never refused', () => {
    expect(powerHeft(ROUND)).toBe(1);
    expect(powerAdvice(ROUND)).toEqual([]);
    expect(powerAdvice({ kind: ROUND, strength: 200, stock: 9 }, 'Nova Girl')[0]).toMatch(new RegExp(`Nova Girl's ${ROUND} hits .*× as much`));
    expect(powerAdvice({ kind: ROUND, strength: 50, stock: 1 })[0]).toMatch(/hardly worth/);
  });
});

// ITS SUPER BEAT: the moment a power is called up, the street held still and told, so the screen can mark it round a
// figure that stands where it was drawn.
describe('a power\'s super beat', () => {
  it('holds the whole street still its frames as it starts, for a hero and for a body with no stock alike', () => {
    const log = presses(ROUND, { frames: 40, every: 999 });
    const k = log.findIndex((st) => st.s.events.some((e) => e.t === 'power'));
    expect(log[k].s.freeze).toBe(POWERS[ROUND].beat.freeze);
    const before = log[k + 1].s.bodies.map((b) => [b.x, b.z, b.st]);
    expect(log[k + 2].s.bodies.map((b) => [b.x, b.z, b.st])).toEqual(before);
    // (a villain's: no stock, the beat and its telling all the same, no uses left to say)
    const V = { ...brawlFighter(powerRecipe(recipe('grappler'), ROUNDABOUT), { style: 'grappler' }) };
    const ctx = { fighters: [brawlFighter(recipe()), { ...V, moves: powerMoves(V, ROUNDABOUT) }] };
    let s = newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: 0, z: 0 }, { fighter: 1, side: 'crowd', x: 1500, z: 0, face: -1 }] });
    s = stepBrawl(s, [{}, { mv: 'special.neutral.M' }], ctx);
    const told = s.events.find((e) => e.t === 'power');
    expect(told).toMatchObject({ p: 1 });
    expect(told.left).toBeUndefined();
    expect(s.freeze).toBe(POWERS[ROUNDABOUT].beat.freeze);
  });

  it('each card\'s screen is one of the lens\'s strikes', () => {
    for (const id of new Set(POWER_IDS.map((x) => POWERS[x].beat.screen))) expect(['lift', 'ring', 'shade', 'ink']).toContain(id);
  });
});
