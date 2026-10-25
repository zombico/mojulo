// The comic hero pack's characters: a cast member is an egocube ask that rolls the same sheet for the same seed, reads
// into a hero spec the door validates at either pole, wears the pack's suit for that pole (never the sheet's own cut),
// and carries the toon its stop asks for: light and ink at the banded pole, ink alone at the painted stop, none at the
// material pole. One case per procedure, chosen from the cast in code.
import { describe, it, expect } from 'vitest';
import { CAST, castMember } from './cast.js';
import { SUITS, SUIT_KEYS, suitOf } from './suits.js';
import { rollMember, memberOrders, poleOf } from './characters.js';
import { LOOKS } from './looks.js';
import { SPEC_KEYS } from '../../../egocube/egocube.js';
import { validateHeroSpec } from '../../../../mcp/tools/layered.js';

const byPole = Object.fromEntries(Object.keys(LOOKS).map((id) => [poleOf(id), id]));

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
  it('a shadow is read from the motivation: the rival is the hero\'s archetype in shadow', () => {
    const hero = rollMember('hero'), rival = rollMember('rival');
    expect([hero.facets.archetype, rival.facets.archetype]).toEqual(['hero', 'hero']);
    expect(hero.reading.reads).not.toBe('shadow');
    expect(rival.reading.reads).toBe('shadow');
  });
});

describe('comic hero pack: suits', () => {
  it('each suit has a fragment for both poles, writing only suit keys, and the material one never paints', () => {
    for (const [id, S] of Object.entries(SUITS)) {
      for (const pole of ['banded', 'material']) {
        const { palette, ...frag } = suitOf(id, pole);
        expect(palette, id).toBeTruthy();
        for (const k of Object.keys(frag)) expect(SUIT_KEYS, `${id}.${pole}.${k}`).toContain(k);
      }
      expect(suitOf(id, 'material').paint, id).toBeUndefined();
    }
    expect(() => suitOf('cape-only', 'banded')).toThrow(/no suit 'cape-only' \(known: classic/);
  });
});

describe('comic hero pack: member orders', () => {
  it('every member validates at both poles: the suit over the sheet\'s plan, the realistic body at the material pole', () => {
    for (const m of CAST) {
      for (const [pole, look] of Object.entries(byPole)) {
        const { mint, sheet } = memberOrders(m.id, look);
        expect(validateHeroSpec(mint.args.spec), `${m.id} at ${look}`).toEqual([]);
        expect(mint.args.spec.form, `${m.id} at ${look}`).toBe(pole === 'material' ? 'realistic' : undefined);
        expect(sheet.facets.archetype).toBe(m.facets.archetype);
        expect(mint.args.vibe).toBe(m.vibe);
      }
    }
  });
  it('the suit is the pack\'s, not the sheet\'s cut: the hero wears the classic cape and emblem, the mastermind the hardsuit', () => {
    const hero = memberOrders('hero', byPole.banded).mint.args.spec;
    expect(hero.paint).toEqual(['catsuit', 'gloves']);
    expect(hero.outfit.pieces.map((p) => p.kind)).toEqual(['cloak', 'belt']);
    expect(hero.fieldPaint[0]).toMatchObject({ part: 'torso', shape: 'star' });
    expect(hero.palette.Top).toBe('#c62828');
    const boss = memberOrders('mastermind', byPole.banded).mint.args.spec;
    expect(boss.adorn).toMatchObject({ type: 'armor', style: 'armored-hero' });
    expect(boss.outfit).toBeUndefined();
  });
  it('the toon follows the stop: light and ink at the comic stop, ink alone painted, none at the material pole', () => {
    const toonAt = (look) => memberOrders('hero', look).mint.args.toon;
    expect(toonAt('comic-night')).toEqual({ light: true, ink: true });
    expect(toonAt('painted-dusk')).toEqual({ ink: true });
    expect(toonAt('realistic-city')).toBeUndefined();
    expect(memberOrders('hero', 'realistic-city').mint.args.spec.paint).toBeUndefined();
  });
});
