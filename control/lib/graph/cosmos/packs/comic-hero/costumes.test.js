// The costume eras: three poles of the comic hero look, each principles and a resolver over the role suits. Each era
// validates on both bodies through the hero door, on a suited member and an armoured one (every member in every era:
// comic-hero.deep.test.js); the Silver Age is the role suits as they are; the eras tie to the look dial through a
// default era per stop, which the operator may override.
import { describe, it, expect } from 'vitest';
import { ERAS, ERA_IDS, ERA_OF_STOP, costumeOf } from './costumes.js';
import { SUITS, SUIT_KEYS, suitOf } from './suits.js';
import { DIAL, LOOKS } from './looks.js';
import { memberOrders, bodyOf } from './characters.js';
import { validateHeroSpec } from '../../../../mcp/tools/layered.js';

// one role per path a suit takes: an outfit over the body, or the hardsuit (an armour build)
const ROLES = [Object.keys(SUITS).find((r) => !SUITS[r].at.tiered.adorn), Object.keys(SUITS).find((r) => SUITS[r].at.tiered.adorn)];

describe('comic hero pack: costume eras', () => {
  it('each era has a name, a reading, principles and a palette, and each stop of the dial suggests one', () => {
    for (const id of ERA_IDS) { const E = ERAS[id]; expect(E.name && E.reads && E.principles.length >= 3 && Object.keys(E.palette).length > 0, id).toBe(true); }
    for (const d of DIAL) expect(ERA_IDS, d.id).toContain(ERA_OF_STOP[d.id]);
    expect(() => costumeOf('classic', 'bronze', 'tiered')).toThrow(/no era 'bronze' \(known: silver, modern, movie\)/);
  });
  it('the Silver Age is the role suits as they are; the other eras write only suit keys', () => {
    for (const role of ROLES) for (const body of ['tiered', 'realistic']) {
      expect(costumeOf(role, 'silver', body)).toEqual(suitOf(role, body));
      for (const era of ['modern', 'movie']) { const { palette, ...frag } = costumeOf(role, era, body); expect(palette).toBeTruthy(); for (const k of Object.keys(frag)) expect(SUIT_KEYS, `${role} ${era} ${body} ${k}`).toContain(k); }
    }
  });
  it('the Movie Hero wears the plating library by word on the realistic body and the hardsuit at low mass over a tactical outfit on the tiered one; no era paints the realistic body', () => {
    expect(costumeOf('classic', 'movie', 'realistic').outfit).toEqual(['sleekSuit', 'combatBoots', 'tacticalGloves']);
    const tiered = costumeOf('classic', 'movie', 'tiered');
    expect(tiered.adorn).toMatchObject({ type: 'armor', style: 'armored-hero', dials: { mass: 0.5 } });
    expect(tiered.outfit.style).toBe('tactical');
    for (const role of ROLES) for (const era of ERA_IDS) expect(costumeOf(role, era, 'realistic').paint, `${role} ${era}`).toBeUndefined();
  });
  it('a suited member and an armoured one validate in every era on both bodies; a look suggests its era and an era named wins', () => {
    const looks = Object.fromEntries(Object.keys(LOOKS).map((id) => [bodyOf(id), id]));
    for (const id of ['hero', 'mastermind']) for (const era of ERA_IDS) for (const look of Object.values(looks)) {
      const { mint, era: got } = memberOrders(id, look, { era });
      const { vibe: _v, ...fields } = mint.args.spec;
      expect(validateHeroSpec(fields), `${id} ${era} ${look}`).toEqual([]);
      expect(got).toBe(era);
    }
    expect(memberOrders('hero', 'comic-night').era).toBe('silver');
    expect(memberOrders('hero', 'painted-dusk').era).toBe('modern');
    expect(memberOrders('hero', 'realistic-city').era).toBe('movie');
  });
});
