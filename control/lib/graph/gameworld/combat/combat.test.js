import { describe, it, expect } from 'vitest';
import { measureCombat, combatLaws, combatantsOf, armed, BANDS } from './measure.js';
import { gymOf, layGym } from './gym.js';
import { combatBookHtml, combatSample, combatGame } from './book.js';
import { feelRule } from '../feel/lower.js';
import { armsLoadout } from '../arms-kit.js';
import { SHOOT, PERSON } from '../quick.js';

// the combat tester's measures, gym and book, promoted: a game's player and foe as a level ships them, measured on the
// runtime and set in the gym laid from the numbers. The smallest game that exercises them: a person on the platform rule
// with a card's feel (its takes: the sprint), a rifle and a sidearm, and one foe body
const feel = { pole: 'conscription', takes: true };
const kit = armsLoadout(['rifle', 'handgun'], SHOOT.rifle, { eye: 1.5 });
const pilot = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 3.6, walkSpeed: 1.6, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...feelRule(feel), loadout: kit, gunplay: true }, weapon: kit[0].weapon, body: { type: 'figure-rig', figure: 'hero', hittable: true, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } }, transform: { pos: [0, 0, 0], heading: 0 } };
const foe = { id: 'foe-1', rule: { type: 'ai' }, body: { type: 'figure-rig', figure: 'foe-1', hittable: true, hp: SHOOT.foeHp, radius: 0.6, egg: { ...PERSON, cz: PERSON.c } }, transform: { pos: [20, 0, 0], heading: Math.PI } };
const payload = { entities: [pilot, foe], camera: { rule: 'follow', target: 'hero', dist: 2.8, height: 1.8, shoulder: 0.75 }, figures: {} };
const M = measureCombat(pilot, foe, { feel, name: 'test' });

describe('the combat measures', () => {
  it('a level\'s player and foe, and whether the player is armed', () => {
    expect(combatantsOf(payload)).toEqual({ pilot, foe });
    expect(armed(pilot)).toBe(true);
    expect(armed({ ...pilot, weapon: undefined, rule: { type: 'platform' } })).toBe(false);
  });

  it('the body moves as its card says: its run, its build to it, its sprint, its walk, its jump', () => {
    const L = Object.fromEntries(combatLaws(M).map((l) => [l.name, l.ok]));
    for (const k of ['the run is the card\'s', 'the run builds as the card says (time to it within 25%)', 'the sprint is carried', 'the walk is the card\'s', 'the jump is carried']) expect(L[k]).toBe(true);
    expect(M.mobility.jump.reach).toBeGreaterThan(M.mobility.jump.height);   // the step taken in the air
  });

  it('the guns: a spray blooms and climbs, the cone widens on the move and tightens aimed, each band is measured', () => {
    const R = M.slots.rifle;
    expect(R.cone.spray10).toBeGreaterThan(R.cone.first);
    expect(R.cone.climb10).toBeGreaterThan(0.05);
    expect(R.cone.moving).toBeGreaterThan(R.cone.first);
    expect(R.cone.aimed).toBeLessThan(R.cone.first);
    expect(Object.keys(R.ttk).map(Number)).toEqual(BANDS);
  });

  it('the marks are each gun\'s and each matter\'s; the switch is the arms\' own time; every law holds', () => {
    expect(M.slots.rifle.walls.brick.cm).toBeGreaterThan(M.slots.handgun.walls.brick.cm);
    expect(M.slots.rifle.walls.steel.kinds).toEqual(['dent']);
    expect(M.switching['rifle→handgun'].s).toBeLessThan(M.switching['handgun→rifle'].s);
    expect(combatLaws(M).filter((l) => !l.ok).map((l) => l.name)).toEqual([]);
  });

  it('deterministic: measured twice, the same', () => {
    expect(JSON.stringify(measureCombat(pilot, foe, { feel, name: 'test' }))).toBe(JSON.stringify(M));
  });
});

describe('the gym', () => {
  const G = gymOf(pilot, { ...M, laws: combatLaws(M) });
  it('is laid from the reach on boxes, and every station is as meant when the game\'s rule is driven at it', () => {
    expect(G.reach.ledge).toBeGreaterThan(M.mobility.jump.height);
    expect(G.gym.stations.map((s) => s.id)).toEqual(['stop', 'step-made', 'step-not', 'ledge-made', 'ledge-not', 'gap-made', 'gap-not']);
    expect(G.gate.filter((g) => g.ok === false)).toEqual([]);
  });
  it('a rule that does not jump is laid no ledge and no gap', () => {
    const still = layGym({ ...M, mobility: { ...M.mobility, jump: null } }, pilot.rule);
    expect(still.stations.some((s) => s.kind === 'gap' || s.id.startsWith('ledge'))).toBe(false);
  });
});

describe('the combat book', () => {
  it('a world that fights with guns, by its words', () => {
    expect([combatGame({ quick: { goal: 'shoot' } }), combatGame({ quick: { goal: 'deathmatch' } }), combatGame({ quick: { goal: 'race', arms: ['rifle'] } }), combatGame({ quick: { goal: 'race' } }), combatGame({})]).toEqual([true, true, true, false, false]);
  });
  it('the made level\'s gym as a page, from its own camera and the other; none for an unarmed player', () => {
    const own = combatBookHtml(payload, { name: 'Test', feel });
    expect(own).toContain('combat book');
    expect(own).toContain('its own camera');
    expect(combatBookHtml(payload, { name: 'Test', feel }, { view: 'other' })).toContain('seen from the eye');
    expect(combatSample({ entities: [{ ...pilot, weapon: undefined, rule: { type: 'platform' } }, foe] })).toBeNull();
    expect(() => combatBookHtml(payload, {}, { view: 'top' })).toThrow(/view is one of/);
  });
});
