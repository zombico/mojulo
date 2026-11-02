// The hero fights with what it carries (adornment.js BASIC_VERBS, levels.js): an item serving the body's own strike gives
// the pilot its contact window (the page arms it with the held item's numbers), one serving its shot arms the pilot as the
// quick shooter's player is armed; a hero carrying nothing for either is played as it was. One case per procedure: a blade
// on a trail and in a building, a long gun and a pistol, a hero with neither.
import { describe, expect, it } from 'vitest';

import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { readAdornment, resolveAdornment } from './adornment.js';
import { readEquipment } from './equipment.js';
import { SHOOT, SHOULDER } from './quick.js';
import { runSteps } from './runner.js';
import { readCastEffect } from '../playscape/ui/cast.js';
import { validateLevelContract } from '../game/level-contract.js';
import { synthesizeLevel } from '../game/level-synth.js';
import { powerRecord } from './power-record.js';
import { composeMechanics } from '../game/mechanics.js';

const H = MEADOWMARK_HERO.characters.hero;
const carrying = (items, more = {}) => ({ ...MEADOWMARK_HERO, ...more, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items } } } });
const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const gun = (item) => ({ id: 'gun', slot: 'right', build: { item }, serves: ['shoot'] });
const firstLevel = (W) => { const G = readGameworld(W), st = gameStages(W).find((s) => s.section !== 'building'); return stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero' }).args.manifest; };
const pilot = (m) => m.entities.find((e) => e.pilotable);
const hint = (m) => (m.events?.hud ?? []).map((h) => h.text).join(' ');

describe('the adornment page carries what the body fights with', () => {
  it('an item may serve the body\'s strike or shot, leaving nothing open; a firearm is carried, never a table class', () => {
    expect(resolveAdornment({ items: [BLADE] }, { powers: [], progression: [] }).open).toEqual([]);
    expect(resolveAdornment({ items: [gun('carbine')] }, { powers: [], progression: [] }).open).toEqual([]);
    expect(resolveAdornment({ items: [{ ...BLADE, serves: ['slash'] }] }, { powers: [], progression: [] }).open[0]).toMatch(/serves 'slash', which is not a power \(the hero has none yet\)/);
    expect(() => readAdornment({ items: [gun('pistol')] })).not.toThrow();
    expect(() => readEquipment({ classes: { pistol: { build: { item: 'pistol' } } } })).toThrow(/not a class of gear/);
  });
});

describe('the pilot strikes and shoots with what the hero carries', () => {
  it('a blade for its strike: the contact window where no feel names one, the strike said in the controls', () => {
    const m = firstLevel(carrying([BLADE]));
    expect(pilot(m).rule.strikeContact).toEqual([0.28, 0.62]);
    expect(hint(m)).toMatch(/click {2}strike/);
    // (a feel that names a window keeps its own)
    const felt = firstLevel(carrying([BLADE], { feel: 'ebon-spirits' }));
    expect(Array.isArray(pilot(felt).rule.strikeContact)).toBe(true);
  });

  it('a long gun the rifle\'s numbers, a pistol the handgun\'s: fired from the eye, the body hittable, over the shoulder', () => {
    const m = firstLevel(carrying([gun('carbine')]));
    expect(pilot(m).weapon).toMatchObject({ ...SHOOT.rifle, eye: 1.5, converge: true });
    expect(pilot(m).body).toMatchObject({ hittable: true });
    expect(m.camera).toMatchObject({ rule: 'follow', ...SHOULDER });
    expect(hint(m)).toMatch(/click {2}fire/);
    expect(pilot(firstLevel(carrying([gun('pistol')]))).weapon).toMatchObject({ ...SHOOT.gun, eye: 1.5 });
  });

  it('a hero carrying nothing for either is played as it was', () => {
    const plain = firstLevel(MEADOWMARK_HERO), p = pilot(plain);
    expect(p.rule?.strikeContact).toBeUndefined();
    expect(p.weapon).toBeUndefined();
    expect(hint(plain)).not.toMatch(/click {2}(strike|fire)/);
  });
});

describe('a power\'s move is the hero\'s from the stage that gains it', () => {
  const withPowers = (actions) => ({ ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, actions } } });
  const LEAP = { id: 'ash-leap', verb: 'leap', move: 'double-jump' }, LIFT = { id: 'updraft', verb: 'rise', move: 'high-jump' };
  it('gained early (or with no stages laid), its move is granted from the first level; gained later, not yet', () => {
    expect(pilot(firstLevel(withPowers({ powers: [LEAP] }))).rule.airJumps).toBe(1);
    const staged = pilot(firstLevel(withPowers({ powers: [LEAP, LIFT], progression: [{ stage: 'early', gains: ['updraft'] }, { stage: 'mid', gains: ['ash-leap'] }] }))).rule;
    expect(staged.airJumps ?? 0).toBe(0);
    const plain = pilot(firstLevel(MEADOWMARK_HERO)).rule;
    expect(staged.jumpSpeed).toBeCloseTo((plain.jumpSpeed ?? 8.5) * Math.sqrt(1.5), 2);
  });
});

describe('an attack power lands on the nearest foe in front', () => {
  it('its key\'s cue fires its beam from the hero at the nearest foe, taking the hero\'s power × its per', () => {
    const lv = runSteps(MEADOWMARK_HERO, { ref: 'm' }).find((s) => s.key.startsWith('level')).order.manifest;
    const cue = lv.play.cues.find((c) => c.id === 'power-wind-orb'), beam = cue.then.find((t) => t.beam)?.beam;
    expect(beam).toMatchObject({ who: 'hero', to: { nearest: { range: 24, cone: 0.7 } }, is: 'orb' });
    expect(beam.hurt).toBeGreaterThan(0);
    // (a power with no attack fires none)
    expect(lv.play.cues.find((c) => c.id === 'power-gust-step').then.some((t) => t.beam)).toBe(false);
  });

  it('a cue\'s beam takes the nearest foe and a hurt, and says what they are when they are wrong', () => {
    const ctx = { beams: {}, explosions: {} };
    expect(readCastEffect('beam', { beam: { who: 'hero', to: { nearest: { range: 10 } }, hurt: 3 } }, 'then', ctx)).toMatchObject({ to: { nearest: { range: 10 } }, hurt: 3 });
    expect(() => readCastEffect('beam', { beam: { who: 'hero', to: { nearest: { reach: 10 } } } }, 'then', ctx)).toThrow(/nearest: \{ range\?: metres, cone\?: radians \}/);
    expect(() => readCastEffect('beam', { beam: { who: 'hero', to: 'b', hurt: -1 } }, 'then', ctx)).toThrow(/hurt is the hp it takes/);
  });
});

describe('a power fires only once it is the hero\'s and when its spend is there', () => {
  const lv = runSteps(MEADOWMARK_HERO, { ref: 'm' }).find((s) => s.key.startsWith('level')).order.manifest, cue = (id) => lv.play.cues.find((c) => c.id === `power-${id}`);
  it('the starting stage\'s power is the hero\'s kit; a later one waits on its node; refused, it says why', () => {
    // (gust-step is the early stage's: no gained check; wind-orb the mid's: its node, hero.wind-orb, at 1 at least)
    expect((cue('gust-step').if ?? []).some((c) => c.var === 'hero.gust-step')).toBe(false);
    expect(cue('wind-orb').if).toContainEqual({ var: 'hero.wind-orb', gte: 1 });
    expect(cue('wind-orb').else).toMatchObject({ as: 'toast', say: expect.stringMatching(/^wind-orb: not gained yet/) });
  });

  it('a later power\'s move is granted when its node is gained (the page hears the stats), an early one\'s from the start', () => {
    const W = { ...MEADOWMARK_HERO, links: [], characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, actions: { ...H.actions, powers: H.actions.powers.map((p) => (p.id === 'cyclone' ? { ...p, move: 'high-jump' } : p.id === 'gust-step' ? { ...p, move: 'double-jump' } : p)) } } } };
    const m = runSteps(W, { ref: 'm' }).find((s) => s.key.startsWith('level')).order.manifest;
    expect(m.game.powers).toMatchObject({ target: pilot(m).id, bought: 'hero', grants: { cyclone: { jumpSpeed: expect.any(Number) } } });
    expect(m.game.powers.slice).toBeUndefined();
    expect(m.game.powers.grants['gust-step']).toBeUndefined();
    expect(pilot(m).rule.airJumps).toBe(1);
    // (the level's contract holds without a slice: the page renders it; a powers block with neither is still refused)
    expect(validateLevelContract(synthesizeLevel(m).game)).toEqual({ ok: true, errors: [] });
    const { bought, ...bare } = m.game.powers;
    expect(validateLevelContract({ ...synthesizeLevel(m).game, powers: bare }).errors[0]).toMatch(/absent only beside bought/);
  });
});

describe('a level\'s powers read back as data, for a reader that does not run its cues', () => {
  const levelOf = (W) => runSteps(W, { ref: 'm' }).find((s) => s.key.startsWith('level')).order.manifest;
  it('each power its key, when it is gained, its refusal, its look and its attack, as the level plays them', () => {
    const R = powerRecord(levelOf(MEADOWMARK_HERO));
    expect(R.map((r) => [r.id, r.key])).toEqual([['gust-step', '1'], ['wind-orb', '2'], ['cyclone', '3']]);
    expect(R[0]).toMatchObject({ holder: 'hero', gained: { at: 'start' } });
    expect(R[0].refusal).toBeUndefined();
    expect(R[1]).toMatchObject({ gained: { at: 'stats', var: 'hero.wind-orb', gte: 1 }, refusal: 'wind-orb: not gained yet', attack: { is: 'orb', from: 'hero', at: 'nearest-foe', range: 24, cone: 0.7, hurt: 12 } });
    expect(R[0].attack).toBeUndefined();
  });

  it('a spend where the system has a resource; a later power\'s move with the stats that grant it', () => {
    const W = { ...MEADOWMARK_HERO, links: [], characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, actions: { ...H.actions, system: { kind: 'transform', resource: 'ki' }, powers: H.actions.powers.map((p) => (p.id === 'cyclone' ? { ...p, move: 'high-jump' } : p)) } } } };
    const R = powerRecord(levelOf(W)), cy = R.find((r) => r.id === 'cyclone');
    expect(R.every((r) => r.spends && r.spends.ki > 0)).toBe(true);
    expect(cy.refusal).toMatch(/not gained yet, or not enough ki/);
    expect(cy.move).toEqual({ grants: { jumpSpeed: expect.any(Number) }, on: ['stats'] });
    // (a level with no powers reads none)
    expect(powerRecord({ play: { cues: [{ id: 'level-up', when: { levelled: 'hero' }, then: { say: 'Level up' } }] } })).toEqual([]);
  });
});

const EXIT = { kind: 'reach-exit', at: [9, 0, 0] };
describe('one hp: where the stats bind the hero\'s body, its bar is the hp that ends the level', () => {
  // (the example hero, its first stage standing a grunt: systems that bind the hp stat to the body)
  const fighting = () => { const W = JSON.parse(JSON.stringify(MEADOWMARK_HERO)), first = Object.keys(W.levels)[0];
    W.levels = { [first]: { ...W.levels[first], foes: { from: ['grunt'] } } }; W.links = []; delete W.start; W.foes = { grunt: { class: 'walker' } }; return W; };
  const levelOf = (W) => runSteps(W, { ref: 'm' }).find((s) => s.key.startsWith('level')).order.manifest;
  it('the level is lost when the body is down; a touch takes the same share of its hp the level\'s took; one readout', () => {
    const m = levelOf(fighting());
    expect(m.game.mechanics.filter((x) => x.kind === 'fail-on-death')).toEqual([{ kind: 'fail-on-death', of: 'body' }]);
    // (2 of the level's 20 was a tenth: a tenth of the hp stat's base, 100)
    expect(pilot(m).rule.stomp.hurt).toBe(10);
    const { game } = synthesizeLevel(m), lowered = composeMechanics(m.game.mechanics, { player: pilot(m).id });
    expect(lowered.world?.vars?.hp ?? lowered.events?.vars?.hp).toBeUndefined();
    expect(JSON.stringify(lowered)).not.toMatch(/"var":"hp","label":"HP"/);
    expect(JSON.stringify(lowered)).toMatch(/"on":"down","match":\{"entity":"hero"\},"do":"emit","type":"dead"/);
    expect(validateLevelContract(game).ok).toBe(true);
    expect(m.play.parts.filter((x) => x.label === 'HP')).toHaveLength(1);
  });

  it('a world with no systems keeps the level\'s own hp; a body-bound hazard hurts the body, and a wrong of is refused', () => {
    const W = fighting(); delete W.characters.hero.actions; delete W.mechanics;
    const plain = levelOf({ ...W, characters: { ...W.characters, hero: { ...W.characters.hero, actions: { none: true } } } });
    expect(plain.game.mechanics.find((x) => x.kind === 'fail-on-death')).toMatchObject({ startHp: 20, hits: 2 });
    expect(pilot(plain).rule.stomp.hurt).toBeUndefined();
    const hz = composeMechanics([{ kind: 'hazard-damage', of: 'body', hazards: [{ at: [1, 0, 0], damage: 25 }] }, { kind: 'fail-on-death', of: 'body' }, EXIT], { player: 'hero' });
    expect(JSON.stringify(hz)).toMatch(/"do":"ctrl","op":"hurt","who":"hero","by":25/);
    expect(() => composeMechanics([{ kind: 'fail-on-death', of: 'self' }, EXIT], { player: 'hero' })).toThrow(/of is 'body'/);
    expect(() => composeMechanics([{ kind: 'fail-on-death', of: 'body', hits: 2 }, EXIT], { player: 'hero' })).toThrow(/takes no startHp or hits/);
  });
});
