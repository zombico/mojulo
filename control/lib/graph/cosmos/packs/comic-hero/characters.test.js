// The comic hero pack's characters: a cast member is an egocube ask that rolls the same sheet for the same seed, reads
// into a hero spec the door validates on either body, wears the pack's suit for that body (never the sheet's own cut),
// and is never cel shaded: no toon at any stop, the realistic body at the realistic stop, the tiered body elsewhere.
// One case per procedure, chosen from the cast in code: a suit's outfit or its armour build (every suit and every member
// on both bodies: comic-hero.deep.test.js).
import { describe, it, expect } from 'vitest';
import { CAST, castMember } from './cast.js';
import { SUITS, SUIT_KEYS, suitOf } from './suits.js';
import { rollMember, memberOrders, bodyOf } from './characters.js';
import { LOOKS } from './looks.js';
import { SPEC_KEYS } from '../../../egocube/egocube.js';
import { validateHeroSpec } from '../../../../mcp/tools/layered.js';

const byBody = Object.fromEntries(Object.keys(LOOKS).map((id) => [bodyOf(id), id]));
const armoured = (suit) => !!SUITS[suit].at.tiered.adorn;
const PICKS = [CAST.find((m) => !armoured(m.suit)), CAST.find((m) => armoured(m.suit))];

describe('comic hero pack: cast', () => {
  it('every member asks in egocube words, wears a suit the pack has, and rolls the same sheet for the same seed', () => {
    expect(new Set(CAST.map((m) => m.id)).size).toBe(CAST.length);
    for (const m of CAST) {
      for (const k of Object.keys(m.facets)) expect(SPEC_KEYS, `${m.id}.${k}`).toContain(k);
      expect(SUITS[m.suit], `${m.id} suit ${m.suit}`).toBeTruthy();
    }
    const a = rollMember('hero', { seed: 7 }), b = rollMember('hero', { seed: 7 });
    expect(a.facets).toEqual(b.facets);
    expect(a.facets.archetype).toBe('hero');
    expect(() => castMember('narrator')).toThrow(/no cast member 'narrator' \(known: hero/);
  });
  it('the cast is mixed at every seed: each member names its pole, and an order may name another', () => {
    for (const seed of [1, 2]) expect(new Set(CAST.map((m) => rollMember(m.id, { seed }).facets.pole)), `seed ${seed}`).toEqual(new Set(['male', 'female']));
    const m = CAST[0], other = m.facets.pole === 'male' ? 'female' : 'male';
    expect(rollMember(m.id).facets.pole).toBe(m.facets.pole);
    expect(rollMember(m.id, { pole: other }).facets.pole).toBe(other);
    expect(memberOrders(m.id, byBody.tiered, { pole: other }).mint.args.spec.cast).toBe(other);
  });
  it('a shadow is read from the motivation: the rival is the hero\'s archetype in shadow', () => {
    const hero = rollMember('hero'), rival = rollMember('rival');
    expect([hero.facets.archetype, rival.facets.archetype]).toEqual(['hero', 'hero']);
    expect(hero.reading.reads).not.toBe('shadow');
    expect(rival.reading.reads).toBe('shadow');
  });
});

describe('comic hero pack: suits', () => {
  it('a suit has a fragment for both bodies, writing only suit keys, and the realistic one never paints', () => {
    for (const id of PICKS.map((m) => m.suit)) {
      for (const body of ['tiered', 'realistic']) {
        const { palette, ...frag } = suitOf(id, body);
        expect(palette, id).toBeTruthy();
        for (const k of Object.keys(frag)) expect(SUIT_KEYS, `${id}.${body}.${k}`).toContain(k);
      }
      expect(suitOf(id, 'realistic').paint, id).toBeUndefined();
    }
    expect(() => suitOf('cape-only', 'tiered')).toThrow(/no suit 'cape-only' \(known: classic/);
  });
});

describe('comic hero pack: member orders', () => {
  it('a member validates on both bodies: the suit over the sheet\'s plan, the realistic body at the realistic stop, no toon', () => {
    for (const m of PICKS) {
      for (const [body, look] of Object.entries(byBody)) {
        const { mint, sheet } = memberOrders(m.id, look);
        const { vibe: _v, ...fields } = mint.args.spec;
        expect(validateHeroSpec(fields), `${m.id} at ${look}`).toEqual([]);
        expect(mint.args.spec.toon, `${m.id} at ${look}`).toBeUndefined();
        expect(mint.args.spec.form, `${m.id} at ${look}`).toBe(body === 'realistic' ? 'realistic' : undefined);
        expect(sheet.facets.archetype).toBe(m.facets.archetype);
        expect(mint.args.spec.vibe).toBe(m.vibe);
      }
    }
  });
  it('the suit is the pack\'s, not the sheet\'s cut: the hero wears the classic cape and emblem, the mastermind the hardsuit', () => {
    const hero = memberOrders('hero', byBody.tiered, { era: 'silver' }).mint.args.spec;
    expect(hero.paint).toEqual(['catsuit', 'gloves']);
    expect(hero.outfit.pieces.map((p) => p.kind)).toEqual(['cloak', 'belt']);
    expect(hero.outfit.detail).toEqual([{ prim: 'embroidery', role: 'chest', motif: 'diamond' }]);
    expect(hero.outfit.language.bottom).toMatchObject({ leg: 'long', cut: 'skinny' });
    expect(hero.palette.OutfitSecond).toBe('#c62828');
    expect(hero.palette.Top).toBe('#c62828');
    const boss = memberOrders('mastermind', byBody.tiered, { era: 'silver' }).mint.args.spec;
    expect(boss.adorn).toMatchObject({ type: 'armor', style: 'armored-hero' });
    expect(boss.outfit).toBeUndefined();
  });
  it('never cel shaded: no toon at any stop, the tiered body at the comic and painted stops, the realistic body at the realistic one', () => {
    for (const look of Object.keys(LOOKS)) expect(memberOrders('hero', look).mint.args.spec.toon, look).toBeUndefined();
    expect([bodyOf('comic-night'), bodyOf('painted-dusk'), bodyOf('realistic-city'), bodyOf('gritty-night')]).toEqual(['tiered', 'tiered', 'realistic', 'realistic']);
    expect(memberOrders('hero', 'realistic-city').mint.args.spec.paint).toBeUndefined();
  });
});
