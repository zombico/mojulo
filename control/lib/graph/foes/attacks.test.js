import { describe, expect, it } from 'vitest';

import { FOE_CLASSES } from './index.js';
import { ATTACKS } from './vocab.js';
import { resolveFoe } from './resolve.js';
import { ATTACK_CARDS, attackCard, cardFor, SECOND_CARDS } from './attacks.js';
import { ELEMENT_ROUNDS } from './resolve.js';
import { beastFieldOf } from '../egocube/moves.js';
import { bodyOf, topologyOf, fitOfPeople } from './fit.js';
import { beastMovesOf } from '../egocube/moves.js';
import { strikeWaysOf } from '../fauna/behavior/strike.js';
import { PEOPLE } from './people.js';
import { isKin } from './packs.js';
import { FOOT_STRIKES, FOOT_WORDS, footStrikeKeys } from '../polygonizer/hero-foot-strike.js';

const melee = (c) => ATTACKS[c.attack.kind].verb === 'melee';
// (one melee class on a four-legged stand-in, picked in code: the procedure every beast card runs through)
const beastClass = Object.values(FOE_CLASSES).find((c) => melee(c) && topologyOf(bodyOf(c.standIn)) === 'quadruped' && strikeWaysOf(c.standIn).includes('snap'));
const otherVerb = Object.values(FOE_CLASSES).find((c) => !melee(c));

describe('the attack cards: the blow apart from the body that throws it', () => {
  it('absent, the class\'s own attack as it was, no card and no way', () => {
    const f = resolveFoe({ class: beastClass.id });
    expect(f.attack.card).toBeUndefined();
    expect(f.attack.way).toBeUndefined();
  });

  it('a card re-times the blow and names the way the body throws it; the contact window follows the card', () => {
    const plain = resolveFoe({ class: beastClass.id }), snap = resolveFoe({ class: beastClass.id, attack: 'snap' });
    expect(snap.attack).toMatchObject({ card: 'snap', way: 'snap', timing: ATTACK_CARDS.snap.timing });
    expect(snap.strike).toEqual(ATTACK_CARDS.snap.timing);
    // (seconds from the swing to the hit: the card's tell, not the class's)
    const toHit = (f) => f.entity.rule.loadout[0].strikeDur * f.entity.rule.loadout[0].strikeContact[0];
    expect(toHit(snap)).toBeCloseTo(ATTACK_CARDS.snap.timing.startup / 60, 1);
    expect(toHit(snap)).toBeLessThan(toHit(plain));
    // (the same body takes another card: one model, re-skinned)
    expect(resolveFoe({ class: beastClass.id, attack: 'maul' }).attack.way).toBe('maul');
  });

  it('the beast\'s swing plays the card\'s way, its clip at the card\'s timing; the lunge as always', () => {
    const M = beastMovesOf(beastClass.standIn, { strike: ATTACK_CARDS.snap.timing, way: 'snap' });
    expect(M.states.swing_neutral).toBe('snap');
    expect(M.motion.strikes.snap).toEqual(ATTACK_CARDS.snap.timing);
    expect(beastMovesOf(beastClass.standIn, { strike: true, way: 'strike' })).toEqual(beastMovesOf(beastClass.standIn, { strike: true }));
  });

  it('a body with hands carries its card\'s held swing on its blow, for the page to bake; a beast never', () => {
    const kin = PEOPLE.find((p) => isKin(p)), C = Object.values(FOE_CLASSES).find((c) => melee(c) && fitOfPeople(c.id, { people: kin }).ok);
    const f = resolveFoe({ class: C.id, skin: { people: kin }, attack: 'chop' });
    expect(f.attack.way).toBe('chop');
    expect(f.entity.rule.loadout[0].swing).toBe('chop');
    expect(resolveFoe({ class: beastClass.id, attack: 'snap' }).entity.rule.loadout[0].swing).toBeUndefined();
    expect(resolveFoe({ class: C.id, skin: { people: kin } }).entity.rule.loadout[0].swing).toBeUndefined();
  });

  it('refused with words: no such card, a card of another kind, a body it has no way for', () => {
    expect(() => attackCard('nope')).toThrow(/the cards: lunge/);
    expect(() => resolveFoe({ class: otherVerb.id, attack: 'snap' })).toThrow(/never its kind/);
    expect(() => cardFor('chop', beastClass, 'quadruped')).toThrow(/person \| kin, not a quadruped/);
  });

  it('a thrower\'s card winds its throw before the round leaves: the round loosed at the release, once a throw; absent, as it fired', async () => {
    const { composeLive } = await import('../worlds/controllable/compose.js');
    const E = composeLive(), DT = 1 / 60;
    const lob = Object.values(FOE_CLASSES).find((c) => c.attack.kind === "lob"), kin = PEOPLE.find((p) => isKin(p) && fitOfPeople(lob.id, { people: p }).ok) ?? PEOPLE.find((p) => fitOfPeople(lob.id, { people: p }).ok);
    const rounds = (attack) => {
      const f = resolveFoe({ class: lob.id, skin: { people: kin }, ...(attack ? { attack } : {}) });
      const foe = { id: 'f', team: 'foes', rule: { ...f.entity.rule, eye: 0, collideRadius: 0.3, collideHeight: 1.1 }, weapon: { ...f.entity.weapon }, body: { type: 'none', hittable: true, hp: 50 }, transform: { pos: [0, 0, 0], heading: 0 } };
      const hero = { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'none', hittable: true, hp: 1e6 }, transform: { pos: [8, 0, 0], heading: Math.PI } };
      const st = E.createWorld({ entities: [foe, hero] }), out = [];
      let n0 = 0;
      for (let i = 0; i < 300; i++) { E.stepWorld(st, {}, DT, { ground: () => 0 }); const n = (st.projectiles || []).length; if (n > n0) out.push({ i, windT: st.byId.f.windT, loc: st.byId.f.locomotion }); n0 = n; }
      return { out, w: f.entity.weapon };
    };
    const thrown = rounds('throw'), plain = rounds(null);
    expect(thrown.w.throw).toMatchObject({ clip: true, ai: true });
    expect(thrown.out.length).toBeGreaterThan(0);
    expect(thrown.out[0].loc).toBe('throw');
    expect(thrown.out[0].windT).toBeCloseTo(thrown.w.throw.dur * thrown.w.throw.release, 1);
    expect(thrown.out.length).toBeLessThan(plain.out.length);
    expect(plain.w.throw).toBeUndefined();
  });

  it('a second attack goes beside its blow: a slot of its loadout thrown from its band, its round its body\'s element; refused with words elsewhere', () => {
    const [spit] = SECOND_CARDS, C = ATTACK_CARDS[spit];
    const plain = resolveFoe({ class: beastClass.id }), f = resolveFoe({ class: beastClass.id, also: spit });
    expect(plain.entity.rule.loadout).toHaveLength(1);
    const slot = f.entity.rule.loadout.at(-1);
    expect(slot).toMatchObject({ name: spit, band: [...C.band] });
    expect(slot.weapon).toMatchObject({ fireClass: 'lob', projectileGravity: 0, foeRound: true, fxColor: ELEMENT_ROUNDS.fire });
    expect(slot.weapon.muzzleOffset.f).toBeGreaterThan(0);
    // (grown by an element, its round that element's)
    const venomous = resolveFoe({ class: beastClass.id, skin: { species: beastClass.standIn, ooze: ['venom'] }, also: spit });
    expect(venomous.entity.rule.loadout.at(-1).weapon.fxColor).toBe(ELEMENT_ROUNDS.poison);
    expect(f.attack.also).toMatchObject({ card: spit });
    expect(() => resolveFoe({ class: beastClass.id, attack: spit })).toThrow(/a second attack/);
    expect(() => resolveFoe({ class: otherVerb.id, also: spit })).toThrow(/beside a blow/);
  });

  it('its figure fires in its second attack\'s clip; without one, no fire state', () => {
    const F = (also) => beastFieldOf(beastClass.standIn, { strike: ATTACK_CARDS.snap.timing, way: 'snap', ...(also ? { also } : {}) });
    const breath = SECOND_CARDS.map((k) => ATTACK_CARDS[k]).find((c) => strikeWaysOf(beastClass.standIn).includes(c.ways.quadruped) && c.ways.quadruped !== 'snap');
    if (breath) expect(F({ way: breath.ways.quadruped, timing: breath.timing }).own.fire).toBe(breath.ways.quadruped);
    expect(F(null).own.fire).toBeUndefined();
  });

  it('on the runtime it comes on throwing its rounds from off, and bites when close', async () => {
    const { composeLive } = await import('../worlds/controllable/compose.js');
    const E = composeLive(), DT = 1 / 60, [spit] = SECOND_CARDS;
    // (one that hunts, picked in code: a lurker lies still till the hero is on it)
    const hunter = Object.values(FOE_CLASSES).find((c) => melee(c) && c.move === 'chase' && topologyOf(bodyOf(c.standIn)) === 'quadruped');
    const f = resolveFoe({ class: hunter.id, also: spit });
    const foe = { id: 'f', team: 'foes', rule: { ...f.entity.rule, eye: 0, collideRadius: 0.3, collideHeight: 0.8 }, weapon: { ...f.entity.weapon }, body: { type: 'none', hittable: true, hp: 50 }, transform: { pos: [0, 0, 0], heading: 0 } };
    const hero = { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'none', hittable: true, hp: 1e6 }, transform: { pos: [15, 0, 0], heading: Math.PI } };
    const st = E.createWorld({ entities: [foe, hero] });
    let thrown = 0, n0 = 0, bit = false;
    for (let i = 0; i < 900; i++) {
      E.stepWorld(st, {}, DT, { ground: () => 0 });
      const n = (st.projectiles || []).length; if (n > n0 && Math.hypot(st.byId.f.transform.pos[0] - 15, st.byId.f.transform.pos[1]) > ATTACK_CARDS[spit].band[0] - 0.5) thrown++; n0 = n;
      if (st.byId.f.swingT != null) bit = true;
    }
    expect(thrown).toBeGreaterThan(0);
    expect(bit).toBe(true);
  });

  it('a breath is a stream that lands as one hit: its rounds spare a body they hurt for its gap; without the gap, a hit a round', async () => {
    const { composeLive } = await import('../worlds/controllable/compose.js');
    const E = composeLive(), DT = 1 / 60, breath = SECOND_CARDS.find((k) => ATTACK_CARDS[k].round.gap > 0);
    // (one that chases and bites short of the breath's far reach, picked in code: it breathes before it commits to the bite)
    const hunter = Object.values(FOE_CLASSES).find((c) => melee(c) && c.move === 'chase' && topologyOf(bodyOf(c.standIn)) === 'quadruped'
      && (resolveFoe({ class: c.id }).entity.rule.loadout[0].strikeReach ?? 1.2) * 3 < ATTACK_CARDS[breath].band[1] - 0.5);
    const hits = (gap) => {
      const f = resolveFoe({ class: hunter.id, also: breath }), lo = f.entity.rule.loadout.map((l) => (l.weapon && !gap ? { ...l, weapon: { ...l.weapon, hitGap: 0 } } : l));
      const foe = { id: 'f', team: 'foes', rule: { ...f.entity.rule, loadout: lo, speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 0.8 }, body: { type: 'none', hittable: true, hp: 50 }, transform: { pos: [0, 0, 0], heading: 0 } };
      const hero = { id: 'p', pilotable: true, rule: { type: 'platform', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'none', hittable: true, hp: 1e6 }, transform: { pos: [ATTACK_CARDS[breath].band[1] - 0.5, 0, 0], heading: Math.PI } };
      const st = E.createWorld({ entities: [foe, hero] });
      // (one breath: the mind's first burst of the trigger, its pause not yet over)
      for (let i = 0; i < 100; i++) E.stepWorld(st, {}, DT, { ground: () => 0 });
      return st.byId.p.hits || 0;
    };
    expect(hits(true)).toBe(1);
    expect(hits(false)).toBeGreaterThan(1);
  });

  it('a foot strike is thrown with the legs: a folk\'s second slot fires at its feet in its card\'s element, its foot named for the page to bake; a beast has no way for it', () => {
    const stomp = SECOND_CARDS.find((k) => Object.values(ATTACK_CARDS[k].ways).some((w) => FOOT_WORDS.includes(w))), C = ATTACK_CARDS[stomp];
    const folk = Object.values(FOE_CLASSES).find((c) => melee(c) && fitOfPeople(c.id, { people: 'human' }).ok);
    const f = resolveFoe({ class: folk.id, skin: { people: 'human' }, also: stomp }), slot = f.entity.rule.loadout.at(-1);
    expect(slot).toMatchObject({ name: stomp, fireFoot: C.ways.person });
    expect(slot.weapon.muzzleOffset.u).toBeLessThan(0.1);
    expect(slot.weapon.fxColor).toBe(ELEMENT_ROUNDS[C.round.element]);
    expect(slot.weapon.fuse).toBe(C.round.life);
    expect(() => resolveFoe({ class: beastClass.id, also: stomp })).toThrow(/thrown by/);
  });
  it('its foot strike\'s keys: the swing\'s ready, the leg up on the other foot, the leg down on both; a word it has not, refused', () => {
    const [word] = FOOT_WORDS, keys = footStrikeKeys(word);
    expect(keys).toHaveLength(3);
    expect(keys[1].support).toBe('L');
    expect(keys[1].hipR.pitch).toBeGreaterThan(keys[2].hipR.pitch);
    expect(keys[2]).toMatchObject({ support: 'both' });
    expect(keys[2].crouch).toBeGreaterThan(keys[1].crouch);
    expect(FOOT_STRIKES[word].up.kneeR).toBeGreaterThan(45);
    expect(() => footStrikeKeys('kick')).toThrow(/no foot strike/);
  });
});
