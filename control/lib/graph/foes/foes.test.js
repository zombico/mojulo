// The foe class laws: a class is a move, an attack and a mind on a body that fits it, at any rank. One class per
// distinct procedure, chosen in code from the shelf (an attack that holds a blade, one that holds a weapon, one with no
// verb yet; a move that groups, one that flies); every class at every rank, and every class against the whole roster,
// is foes.deep.test.js.
import { describe, it, expect } from 'vitest';
import { FOE_CLASSES, foeClass, validateClass, classStatus, SIZES } from './index.js';
import { MOVES, ATTACKS, FOE_RANKS, PACES, HERO } from './vocab.js';
import { resolveFoe } from './resolve.js';
import { fitOf, checkFit, bodyOf } from './fit.js';
import { OOZES, resolveMutagen } from '../mutagen/index.js';
import { foeClassValues } from './cosmos.js';
import { SIZE_CLASS_IDS } from '../fauna/size-class.js';
import { RANKS, RANK_HP } from '../mind/vocab.js';
import { STATUSES } from '../cosmos/facets/index.js';
import { PACKAGES } from '../cosmos/packages.js';

const CLASSES = Object.values(FOE_CLASSES);
const pick = (what, pred) => { const c = CLASSES.find(pred); if (!c) throw new Error(`no class ${what}`); return c; };
const verbOf = (c) => ATTACKS[c.attack.kind].verb;
const BLADE = pick('with a blade', (c) => verbOf(c) === 'melee');
const GUN = pick('with a weapon', (c) => !!ATTACKS[c.attack.kind].fireClass);
const TOUCH = pick('that hurts by touch', (c) => ATTACKS[c.attack.kind].verb === 'contact' && !ATTACKS[c.attack.kind].during && MOVES[c.move].rides);
const OWN = pick('with a move of its own', (c) => !!MOVES[c.move].own);
const PACK = pick('that groups', (c) => !!MOVES[c.move].group);
const FLIER = pick('that flies', (c) => MOVES[c.move].needs.includes('wings'));
const GROUNDED = pick('on the ground', (c) => MOVES[c.move].needs.includes('ground') && c.fits.wings !== true);
const sumFrames = (t) => (t.startup ?? 0) + (t.active ?? 0) + (t.recovery ?? 0);

describe('foe vocabulary', () => {
  it('says its words in the cosmos statuses, and prices every word short of built', () => {
    for (const w of [...Object.values(MOVES), ...Object.values(ATTACKS)]) {
      expect(STATUSES).toContain(w.status);
      if (w.status !== 'built') { expect(w.effort).toBeTruthy(); expect(PACKAGES[w.pkg]).toBeTruthy(); expect(w.note).toBeTruthy(); }
    }
  });
  it('holds the fauna size classes as they are', () => {
    expect([...SIZES]).toEqual([...SIZE_CLASS_IDS]);
  });
  it('ranks meet the mind\'s typical health: a minion\'s downs × the rank\'s × a blow, never under it', () => {
    expect(Object.keys(FOE_RANKS)).toEqual(Object.keys(RANKS));
    for (const [rank, R] of Object.entries(FOE_RANKS)) expect(R.downs * HERO.blow).toBeGreaterThanOrEqual(RANK_HP[rank]);
  });
});

describe('foe shelf', () => {
  it('refuses a row whose words it does not know, naming them', () => {
    expect(() => validateClass({ ...BLADE, move: 'teleport' })).toThrow(/move 'teleport' \(known: hold/);
    expect(() => validateClass({ ...BLADE, mind: { ...BLADE.mind, aggressiveness: 'grumpy' } })).toThrow(/aggressiveness 'grumpy'/);
    expect(() => validateClass({ ...BLADE, colour: 'red' })).toThrow(/no key 'colour'/);
    expect(() => foeClass('dragon')).toThrow(/no class 'dragon' \(known: /);
  });
  it('a class\'s status and each engine\'s mark are the worse of its move\'s and its attack\'s', () => {
    const rank = { built: 0, approximated: 1, absent: 2 };
    const markOf = (w, e) => w[e] ?? 'built';
    for (const c of [OWN, BLADE]) {
      const S = classStatus(c), M = MOVES[c.move], A = ATTACKS[c.attack.kind];
      if (M.status === 'built' && A.status === 'built') expect(S.status).toBe('built');
      if (!M.rides) expect(rank[S.marks.godot]).toBeGreaterThanOrEqual(Math.max(rank[markOf(M, 'godot')], rank[markOf(A, 'godot')]));
    }
    const built = pick('that is built', (c) => classStatus(c).status === 'built');
    expect(classStatus(built).short).toEqual([]);
  });
  it('the cosmos reads each class as a value: its engine marks the worst of what it does there', () => {
    const V = foeClassValues();
    expect(Object.keys(V)).toEqual(Object.keys(FOE_CLASSES));
    // a move of its own runs on the web alone (worlds/controllable/foe.js): no engine plays it yet
    expect(V[OWN.id].godot).toBe(MOVES[OWN.move].godot);
    expect(V[OWN.id].status).toBe('built');
    expect(V[OWN.id].pkg).toBeUndefined();
  });
});

describe('foe resolver', () => {
  it('a blade class holds a blade slot timed by its attack, and its mind strikes with it', () => {
    const f = resolveFoe({ class: BLADE.id });
    const slot = f.entity.rule.loadout[0];
    expect(slot.strike).toBe('melee');
    expect(slot.strikeDur).toBeCloseTo(sumFrames(f.attack.timing) / 60, 3);
    expect(slot.strikeDamage).toBe(BLADE.toll.harm * HERO.hit);
    expect(f.mind.actions.melee).toBe(true);
    expect(f.mind.situations.strike.strategy).not.toBe('none');
  });
  it('a weapon class fires its fire class, and its mind fires it', () => {
    const f = resolveFoe({ class: GUN.id });
    expect(f.entity.weapon.fireClass).toBe(ATTACKS[GUN.attack.kind].fireClass);
    expect(f.mind.situations.strike.strategy).toBe('fire-burst');
  });
  it('a class that hurts by touch lays its touch, closes to its body and strikes by running into it', () => {
    const f = resolveFoe({ class: TOUCH.id });
    expect(f.entity.rule.loadout).toBeUndefined();
    expect(f.entity.weapon).toBeUndefined();
    expect(f.entity.rule.foe).toMatchObject({ move: TOUCH.move, touch: TOUCH.toll.harm, stomp: TOUCH.stomp });
    expect(f.entity.rule.standoff).toBeLessThan(1);
    expect(f.mind.actions.contact).toBe(true);
    expect(f.mind.situations.strike.strategy).toBe('touch');
  });
  it('a move of its own lays its numbers on the rule, a telegraph its attack\'s own frames', () => {
    const f = resolveFoe({ class: OWN.id });
    expect(f.entity.rule.foe.move).toBe(OWN.move);
    for (const k of Object.keys(MOVES[OWN.move].own)) expect(f.entity.rule.foe).toHaveProperty(k);
    const braced = pick('that braces', (c) => !!MOVES[c.move].own?.rush), R = resolveFoe({ class: braced.id }).entity.rule.foe.rush;
    expect(R.brace).toBeCloseTo((ATTACKS[braced.attack.kind].timing.startup) / 60, 3);
    // a class the mind plays whole and that never touches lays no record
    expect(resolveFoe({ class: GUN.id }).entity.rule.foe).toBeUndefined();
  });
  it('a pack shares a group, the class\'s id unless the foe names one', () => {
    expect(resolveFoe({ class: PACK.id }).entity.rule.mind.group.id).toBe(PACK.id);
    expect(resolveFoe({ class: PACK.id, group: 'den-1' }).entity.rule.mind.group).toMatchObject({ id: 'den-1', plan: MOVES[PACK.move].group.plan });
  });
  it('a flier flies, and does not fit a body without wings', () => {
    expect(resolveFoe({ class: FLIER.id }).entity.rule.flier).toBe(true);
    const wingless = GROUNDED.standIn;
    expect(fitOf(FLIER.id, wingless).ok).toBe(false);
    expect(() => resolveFoe({ class: FLIER.id, skin: { species: wingless } })).toThrow(/needs wings/);
  });
  it('rank raises its toll and its threat, and never draws the mind\'s health advisory', () => {
    let last = null;
    for (const rank of Object.keys(RANKS)) {
      const f = resolveFoe({ class: BLADE.id, rank });
      expect(f.advisories).toEqual([]);
      expect(f.toll.hp).toBe(BLADE.toll.downs * FOE_RANKS[rank].downs * HERO.blow);
      if (last) { expect(f.toll.hp).toBeGreaterThan(last.toll.hp); expect(f.threat).toBeGreaterThan(last.threat); }
      last = f;
    }
    const duel = resolveFoe({ class: BLADE.id, rank: 'boss' });
    expect(duel.mind.situations.strike.repertoire).toBeTruthy();
  });
  it('a pace is a share of the hero\'s run, in the frame it is given', () => {
    const paced = pick('with a pace', (c) => !!c.pace);
    expect(resolveFoe({ class: paced.id }).entity.rule.speed).toBeCloseTo(PACES[paced.pace] * HERO.run, 3);
    expect(resolveFoe({ class: paced.id }, { hero: { ...HERO, run: 10 } }).entity.rule.speed).toBeCloseTo(PACES[paced.pace] * 10, 3);
  });
  it('plays on its stand-in unskinned, on a skin that fits, and refuses one that does not, saying why', () => {
    expect(resolveFoe({ class: GROUNDED.id }).body).toBe(GROUNDED.standIn);
    expect(checkFit(GROUNDED.id, GROUNDED.standIn).ok).toBe(true);
    const swimmer = 'salmon';
    expect(() => resolveFoe({ class: GROUNDED.id, skin: { species: swimmer } })).toThrow(/needs ground/);
    expect(() => resolveFoe({ class: GROUNDED.id, skin: { species: 'unicorn' } })).toThrow(/no fauna species 'unicorn'/);
  });
  it('an ooze grows the body it is measured on: its size class is the grown body\'s, and a growth past the class refuses', () => {
    // (the growth as the mutagen composes it: an ooze's own stylism heightens its form)
    const id = Object.keys(OOZES).find((o) => (OOZES[o].form?.scale ?? 1) > 1.5), scale = resolveMutagen(id, { key: GROUNDED.standIn }).form.scale;
    const plain = bodyOf(GROUNDED.standIn), grown = bodyOf(GROUNDED.standIn, { ooze: id });
    expect(grown.scale).toBe(scale);
    expect(grown.extent).toBeCloseTo(plain.extent * scale, 2);
    const f = resolveFoe({ class: GROUNDED.id, skin: { ooze: { id, strength: 0 } } });
    expect(f.skin).toEqual({ species: GROUNDED.standIn, ooze: { id, strength: 0 } });
    // a class held to the smallest bodies, on its stand-in grown past them
    const small = pick('held small', (c) => c.fits.size && !c.fits.size.includes('behemoth') && !c.fits.size.includes('gargantuan'));
    const tooBig = Object.keys(OOZES).find((o) => !fitOf(small.id, small.standIn, { ooze: o }).ok);
    if (tooBig) expect(() => resolveFoe({ class: small.id, skin: { ooze: tooBig } })).toThrow(/does not fit a grown/);
  });
  it('refuses words it does not know, naming the known', () => {
    expect(() => resolveFoe({ class: BLADE.id, rank: 'general' })).toThrow(/rank 'general'.*minion/);
    expect(() => resolveFoe({ class: BLADE.id, skin: { colour: 'red' } })).toThrow(/no key 'colour'/);
    expect(() => resolveFoe({ class: BLADE.id, skin: { ooze: 'plaid' } })).toThrow(/unknown ooze "plaid"/);
    expect(() => resolveFoe({ class: BLADE.id, level: 3 })).toThrow(/no key 'level'/);
  });
  it('is deterministic: the same foe resolves to the same bytes', () => {
    const spec = { class: PACK.id, rank: 'elite', skill: 'veteran' };
    expect(JSON.stringify(resolveFoe(spec))).toBe(JSON.stringify(resolveFoe(spec)));
  });
});
