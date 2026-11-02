// The accessory cards: worn things that are not garments or headgear, each the hero door's own words. A card of the
// outfit's pieces rides the suit's outfit build and is worn on a person's landmarks on both bodies; a word-list outfit
// and an armour build take none and say so. Goggles pushed up are the eyegear cast shifted onto the forehead, the tiered
// body's only, and an armour build carries them in its `with`. No accessory adds nothing. One card per family, chosen
// from the catalogue in code; comic-hero.deep.test.js validates and wears every card.
import { describe, it, expect } from 'vitest';
import { ACCESSORIES, ACCESSORY_IDS, ACCESSORY_GAPS, accessoryFits, withAccessories } from './accessories.js';
import { EYEGEAR } from '../../../headgear/cards.js';
import { costumeOf, ERA_IDS } from './costumes.js';
import { memberOrders, bodyOf } from './characters.js';
import { OUTFIT_KIND_NAMES } from '../../../polygonizer/outfit-plan.js';
import { validateHeroSpec, heroRecord, heroPlanOf, sortPieces } from '../../../../mcp/tools/layered.js';

const FAMILIES = ['neck', 'shoulders', 'arm', 'carried', 'eyegear'];
const firstOfFamily = (ids, cards) => [...new Set(ids.map((id) => cards[id].family))].map((f) => ids.find((id) => cards[id].family === f));
const fields = (spec) => { const { vibe: _v, ...f } = spec; return f; };
const LOOK = { tiered: 'dcau-golden', realistic: 'realistic-night' };

describe('comic hero pack: accessory cards', () => {
  it('each card reads, names a family, eras and bodies, and only words the door has (an outfit kind, an eyegear word)', () => {
    for (const id of ACCESSORY_IDS) {
      const C = ACCESSORIES[id];
      expect(C.reads && FAMILIES.includes(C.family) && C.eras.length > 0 && C.eras.every((e) => ERA_IDS.includes(e)), id).toBe(true);
      expect(!!C.pieces !== !!C.eyegear, `${id}: pieces or eyegear`).toBe(true);
      for (const p of C.pieces || []) expect(OUTFIT_KIND_NAMES, `${id}: ${p.kind}`).toContain(p.kind);
      if (C.eyegear) expect(EYEGEAR[C.eyegear.word], id).toBeTruthy();
      for (const b of C.bodies || []) expect(['tiered', 'realistic']).toContain(b);
    }
    expect(Object.keys(ACCESSORY_GAPS).length).toBeGreaterThan(0);
  });

  it('a card of the outfit\'s pieces rides the suit\'s build (the suit untouched); refusals name the known ids, the word list and the body', () => {
    const id = ACCESSORY_IDS.find((k) => ACCESSORIES[k].pieces), suit = costumeOf('classic', 'modern', 'tiered');
    const worn = withAccessories(suit, [id], 'tiered');
    expect(worn.outfit.pieces).toEqual([...suit.outfit.pieces, ...ACCESSORIES[id].pieces]);
    expect(suit.outfit.pieces).toHaveLength(costumeOf('classic', 'modern', 'tiered').outfit.pieces.length);
    expect(() => withAccessories(suit, ['jetBoots'], 'tiered')).toThrow(new RegExp(`no accessory card 'jetBoots' \\(known: ${ACCESSORY_IDS[0]}`));
    expect(() => withAccessories(costumeOf('classic', 'movie', 'realistic'), [id], 'realistic')).toThrow(/word list/);
    expect(() => withAccessories(costumeOf('armored', 'silver', 'tiered'), [id], 'tiered')).toThrow(/not an outfit build/);
    const eye = ACCESSORY_IDS.find((k) => !accessoryFits(k, 'realistic'));
    expect(() => withAccessories(costumeOf('classic', 'silver', 'realistic'), [eye], 'realistic')).toThrow(/not fitted to the realistic body \(fits: tiered\)/);
  });

  it('no accessory adds nothing: the fragment itself, and the orders as without the option', () => {
    const suit = costumeOf('classic', 'silver', 'tiered');
    expect(withAccessories(suit, [], 'tiered')).toBe(suit);
    expect(withAccessories(suit, null, 'tiered')).toBe(suit);
    for (const look of Object.values(LOOK)) expect(memberOrders('hero', look, { accessories: [] })).toEqual(memberOrders('hero', look));
  });

  it('a card of each family validates through the door on the bodies it fits, and the body wears its pieces', () => {
    for (const id of firstOfFamily(ACCESSORY_IDS, ACCESSORIES)) for (const body of ['tiered', 'realistic']) {
      if (!accessoryFits(id, body)) continue;
      const spec = fields(memberOrders('hero', LOOK[body], { era: 'modern', accessories: [id] }).mint.args.spec);
      expect(validateHeroSpec(spec), `${id} on ${body}`).toEqual([]);
      if (ACCESSORIES[id].pieces) { const hero = heroRecord(spec); expect(sortPieces(heroPlanOf(hero), hero.outfit).unworn, `${id} on ${body}`).toEqual([]); }
    }
  });

  it('goggles pushed up: the eyegear cast shifted onto the forehead, in its colours, riding an armour build\'s `with`', () => {
    const id = ACCESSORY_IDS.find((k) => ACCESSORIES[k].eyegear), C = ACCESSORIES[id];
    const bare = memberOrders('hero', LOOK.tiered, { accessories: [id] }).mint.args.spec;
    const kit = bare.adorn.find((A) => A.id === id);
    expect(kit.signature.shift).toEqual(C.eyegear.over.shift);
    expect(bare.hair).not.toBe('none');
    for (const [g, v] of Object.entries(C.palette)) expect(bare.palette[g]).toBe(v);
    const shell = memberOrders('mastermind', LOOK.tiered, { era: 'silver', accessories: [id] }).mint.args.spec;
    expect(shell.adorn.type).toBe('armor');
    expect(shell.adorn.with.some((A) => A.id === id)).toBe(true);
    expect(validateHeroSpec(fields(shell))).toEqual([]);
    expect(bodyOf(LOOK.tiered)).toBe('tiered');
  });
});
