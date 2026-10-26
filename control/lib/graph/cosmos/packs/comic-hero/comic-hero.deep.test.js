// The comic hero pack, swept: every piece card, headgear card, ensemble head, suit, cast member and era through the
// hero door's validator on the bodies it fits (pieces, costumes and characters .test.js hold the concepts, one case
// per family or path).
import { describe, it, expect } from 'vitest';
import { PIECE_IDS } from './pieces.js';
import { HEADGEAR, HEADGEAR_IDS, fitted } from './headgear.js';
import { ENSEMBLES, HARMONY } from './ensembles.js';
import { ERA_IDS, costumeOf } from './costumes.js';
import { SUITS, SUIT_KEYS, suitOf } from './suits.js';
import { CAST } from './cast.js';
import { LOOKS } from './looks.js';
import { memberOrders, bodyOf } from './characters.js';
import { validateHeroSpec } from '../../../../mcp/tools/layered.js';

const byBody = Object.fromEntries(Object.keys(LOOKS).map((id) => [bodyOf(id), id]));
const valid = (spec) => { const { vibe: _v, ...fields } = spec; return validateHeroSpec(fields); };

describe('the comic hero pack, swept', () => {
  it('every piece card and every fitted headgear card validates on the hero on both bodies', () => {
    const failing = [];
    for (const look of ['comic-day', 'realistic-city']) {
      for (const id of PIECE_IDS) { const e = valid(memberOrders('hero', look, { era: 'modern', pieces: [id] }).mint.args.spec); if (e.length) failing.push({ piece: id, look, e }); }
      for (const id of HEADGEAR_IDS) {
        if (!fitted(id, bodyOf(look))) continue;
        const { spec } = memberOrders('hero', look, { era: 'modern', headgear: id }).mint.args;
        const e = valid(spec);
        if (e.length) failing.push({ headgear: id, look, e });
        if (['helmet', 'cowl', 'face'].includes(HEADGEAR[id].family) && spec.hair !== 'none') failing.push({ headgear: id, look, hair: spec.hair });
      }
    }
    expect(failing).toEqual([]);
  }, 120_000);

  it('every head\'s ensemble validates, an armoured one carrying the head in place of its helm', () => {
    const failing = [];
    for (const [head, id] of Object.entries(HARMONY)) {
      if (!ENSEMBLES[id]) { failing.push({ head, missing: id }); continue; }
      const { spec } = memberOrders('hero', 'comic-day', { headgear: head, ensemble: 'auto' }).mint.args;
      const e = validateHeroSpec(spec);
      if (e.length) failing.push({ head, id, e });
      if (ENSEMBLES[id].armor && !(spec.adorn.type === 'armor' && spec.adorn.with.some((A) => A.part === 'cranium'))) failing.push({ head, id, helm: 'kept' });
    }
    expect(failing).toEqual([]);
  }, 120_000);

  it('every suit writes only suit keys on both bodies and never paints the realistic one; every member validates in every era', () => {
    const failing = [];
    for (const id of Object.keys(SUITS)) for (const body of ['tiered', 'realistic']) {
      expect(costumeOf(id, 'silver', body)).toEqual(suitOf(id, body));
      for (const era of ERA_IDS) {
        const { palette, ...frag } = costumeOf(id, era, body);
        if (!palette) failing.push({ suit: id, era, body, palette: 'none' });
        for (const k of Object.keys(frag)) if (!SUIT_KEYS.includes(k)) failing.push({ suit: id, era, body, key: k });
        if (body === 'realistic' && frag.paint) failing.push({ suit: id, era, paints: frag.paint });
      }
    }
    for (const m of CAST) for (const [body, look] of Object.entries(byBody)) for (const era of [undefined, ...ERA_IDS]) {
      const { mint, era: got } = memberOrders(m.id, look, era ? { era } : {});
      const e = valid(mint.args.spec);
      if (e.length) failing.push({ member: m.id, look, era, e });
      if (era && got !== era) failing.push({ member: m.id, look, era, got });
      if (mint.args.spec.toon !== undefined || mint.args.spec.form !== (body === 'realistic' ? 'realistic' : undefined)) failing.push({ member: m.id, look, era, body: mint.args.spec.form, toon: mint.args.spec.toon });
    }
    expect(failing).toEqual([]);
  }, 120_000);
});
