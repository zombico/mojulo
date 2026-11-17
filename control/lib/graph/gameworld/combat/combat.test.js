import { describe, it, expect } from 'vitest';
import { measureCombat, combatLaws, combatantsOf, armed, BANDS } from './measure.js';
import { gymOf, layGym } from './gym.js';
import { combatBookHtml, combatSample, combatGame } from './book.js';
import { feelRule } from '../feel/lower.js';
import { armsLoadout } from '../arms-kit.js';
import { SHOOT, PERSON } from '../quick.js';
import { rangeOf, rangeBody, validateRange, FIRE } from './range.js';
import { shotWordOf, reloadCue } from './range-sound.js';
import { sfxSound } from '../../sfx-shelf/resolve.js';

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

// THE FIRING RANGE (range.js): a game being designed, its weapons tried before its levels: by fire type and numbers, a
// skin for the look alone. The smallest set that exercises each fire type: a hitscan automatic, a rocket, a blade.
describe('the firing range', () => {
  const spec = { weapons: [{ name: 'carbine', fire: 'hitscan', rof: 10, damage: 20, recoil: { kick: 0.4, recover: 4, max: 4, wait: 0.15 } }, { name: 'rocket', fire: 'projectile', speed: 30, damage: 60 }, { name: 'blade', fire: 'melee' }], foe: { hp: 100 } };
  it('names what it cannot set up', () => {
    expect(validateRange(spec)).toEqual([]);
    expect(validateRange({ weapons: [] })[0]).toMatch(/1 to 5/);
    expect(validateRange({ weapons: [{ name: 'x', fire: 'laser' }] })[0]).toMatch(/hitscan, projectile, melee/);
    expect(validateRange({ weapons: ['rifle'], skins: { gun: 'smg' } })[0]).toMatch(/no weapon of that name/);
    expect(validateRange({ weapons: [{ name: 'a', fire: 'melee' }, { name: 'b', fire: 'melee' }] }).join()).toMatch(/one melee weapon/);
    expect(validateRange({ weapons: [{ name: 'b', fire: 'melee' }], skins: { b: 'smg' } }).join()).toMatch(/a knife's build words/);
  });
  it('the fire types onto the runtime: a hitscan round, a travelling one, a blade in the free hand; a skin changes the look, never the numbers', () => {
    const { pilot } = rangeBody(spec), [c, r] = pilot.rule.loadout;
    expect(c.weapon).toMatchObject({ fireClass: 'sight', auto: true, rof: 10, damage: 20 });
    expect(r.weapon).toMatchObject({ fireClass: 'lob', projectileSpeed: 30, damage: 60, splashRadius: FIRE.projectile.splashRadius });
    expect(pilot.rule.knife).toMatchObject({ reach: FIRE.melee.reach, damage: FIRE.melee.damage, name: 'blade' });
    const skinned = rangeBody({ ...spec, skins: { carbine: 'smg', blade: { item: 'knife', model: 'tanto' } } }).pilot;
    expect(skinned.rule.loadout[0].weapon).toEqual(c.weapon);
    expect(skinned.rule.loadout[0].gunplay.view.boxes).not.toEqual(c.gunplay.view.boxes);
    expect(skinned.rule.knife.damage).toBe(pilot.rule.knife.damage);
    expect(skinned.rule.knife.view.boxes).not.toEqual(pilot.rule.knife.view.boxes);
  });
  it('measured on the runtime: each fire type drops the body at its bands, the rocket by its flight, the blade within its reach and not past it', () => {
    const { m } = rangeOf(spec);
    expect(m.slots.carbine.fire).toBe('hitscan');
    expect(m.slots.rocket.fire).toBe('projectile');
    expect(m.slots.rocket.ttk[30].flight).toBe(1);
    for (const d of BANDS) expect(typeof m.slots.rocket.ttk[d].still.rounds).toBe('number');
    expect(m.melee).toMatchObject({ name: 'blade', cuts: 2, past: true });
    expect(m.laws.filter((l) => !l.ok).map((l) => l.name)).toEqual([]);
  });
});

// THE RANGE HEARD (range-sound.js): each weapon voiced from the SFX shelf by what it is, or by the game's own word
describe('the firing range, heard', () => {
  const g = (w) => sfxSound(w).gestures;
  const spec = { weapons: ['handgun', { name: 'zap', fire: 'hitscan', rof: 12 }, { name: 'boom', fire: 'projectile' }, { name: 'cut', fire: 'melee' }] };
  it('a shot by what it is: a kit gun by its round, a fast automatic a submachine gun, a launcher a missile away', () => {
    const { pilot } = rangeBody(spec), [hand, zap, boom] = pilot.rule.loadout;
    expect([shotWordOf(hand), shotWordOf(zap), shotWordOf(boom)]).toEqual(['pistol shot', 'smg shot', 'missile launch']);
    expect(hand.weapon.sfx.shot).toEqual(g('pistol shot'));
    expect(zap.weapon.sfx.draw).toEqual(g('weapon switch'));
    expect(shotWordOf(rangeBody({ weapons: ['shotgun'] }).pilot.rule.loadout[0])).toBe('shotgun shot');
  });
  it('a reload is one cue over the gun\'s own time: the magazine out, a fresh one in, the action racked', () => {
    const { pilot } = rangeBody(spec), hand = pilot.rule.loadout[0], cue = reloadCue(hand), r = hand.weapon.reload;
    expect(cue.length).toBe(g('mag out').length + g('mag in').length + g('rack').length);
    expect(Math.max(...cue.map((x) => x.at ?? 0))).toBeGreaterThanOrEqual(r * 0.8 - 1e-3);
    expect(cue.filter((x) => (x.at ?? 0) >= r * 0.55 - 1e-3).length).toBe(g('mag in').length + g('rack').length);
  });
  it('every shot and swing a variant when the game\'s hits vary (the sound sheet\'s); a range without it as it was', () => {
    expect(rangeBody({ ...spec, vary: true }).payload.audio.vary).toBe(true);
    expect(rangeBody(spec).payload.audio.vary).toBeUndefined();
  });
  it('the range\'s audio: hits, the blade, the feet, the rocket\'s blast, on a mix in the open; every cue in its book of cues', () => {
    const { payload, pilot } = rangeBody(spec), A = payload.audio;
    expect(A.mix).toEqual({ space: 'open', voices: 16, distance: true });
    expect(A.strike).toEqual({ swing: g('blade swing'), hit: g('blade hit') });
    expect(A.burst).toEqual(g('explosion'));
    expect(A.footsteps.step).toEqual(g('step concrete'));
    for (const s of pilot.rule.loadout) for (const [k, c] of Object.entries(s.weapon.sfx)) expect(A.cues[`${s.name}:${k}`]).toEqual(c);
    // (no launcher, no blast; no blade, no strike)
    const plain = rangeBody({ weapons: ['rifle'] }).payload.audio;
    expect(plain.burst).toBeUndefined(); expect(plain.strike).toBeUndefined();
  });
  it('the game\'s own word wins; a word the shelf lacks is named; quiet is silent', () => {
    const own = rangeBody({ ...spec, sounds: { zap: { shot: 'machine gun' }, cut: { swing: 'katana swing' } } });
    expect(own.pilot.rule.loadout[1].weapon.sfx.shot).toEqual(g('machine gun'));
    expect(own.payload.audio.strike.swing).toEqual(g('katana swing'));
    expect(validateRange({ ...spec, sounds: { zap: { shot: 'pew pew' } } }).join()).toMatch(/'pew pew' is not a sound on the SFX shelf/);
    expect(validateRange({ ...spec, sounds: { cut: { shot: 'rifle shot' } } }).join()).toMatch(/melee weapon sounds its swing, hit/);
    const q = rangeBody({ ...spec, quiet: true });
    expect(q.payload.audio).toBeUndefined(); expect(q.pilot.rule.loadout[0].weapon.sfx).toBeUndefined();
  });
});

