import { describe, expect, it } from 'vitest';

import { FOE_CLASSES } from './index.js';
import { ATTACKS } from './vocab.js';
import { resolveFoe } from './resolve.js';
import { ATTACK_CARDS, attackCard, cardFor } from './attacks.js';
import { bodyOf, topologyOf, fitOfPeople } from './fit.js';
import { beastMovesOf } from '../egocube/moves.js';
import { strikeWaysOf } from '../fauna/behavior/strike.js';
import { PEOPLE } from './people.js';
import { isKin } from './packs.js';

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
});
