// The comic hero pack, swept: every piece card, headgear card, accessory card, item card, ensemble head, suit, cast
// member and era through the hero door's validator on the bodies it fits (pieces, accessories, items, costumes and
// characters .test.js hold the concepts, one case per family or path).
import { describe, it, expect } from 'vitest';
import { PIECE_IDS } from './pieces.js';
import { HEADGEAR, HEADGEAR_IDS, fitted } from './headgear.js';
import { ENSEMBLES, HARMONY } from './ensembles.js';
import { ERA_IDS, costumeOf } from './costumes.js';
import { SUITS, SUIT_KEYS, suitOf } from './suits.js';
import { CAST } from './cast.js';
import { LOOKS, DIAL } from './looks.js';
import { memberOrders, bodyOf } from './characters.js';
import { ACCESSORIES, ACCESSORY_IDS, accessoryFits } from './accessories.js';
import { ITEM_IDS } from './items.js';
import { GRUNT_STYLES, gruntOrders } from './grunts.js';
import { validateHeroSpec, heroRecord, heroPlanOf, sortPieces } from '../../../../mcp/tools/layered.js';

// one look per stop of the dial: each its own procedure (the anime head, the baked landmark head, the realistic body)
const STOP_LOOKS = DIAL.map((d) => Object.keys(LOOKS).find((id) => LOOKS[id].stop === d.id));
const valid = (spec) => { const { vibe: _v, ...fields } = spec; return validateHeroSpec(fields); };

describe('the comic hero pack, swept', () => {
  it('every piece card and every fitted headgear card validates on the hero on both bodies', () => {
    const failing = [];
    for (const look of STOP_LOOKS) {
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

  it('every accessory card validates and is worn on the bodies it fits; every item card validates on both bodies', () => {
    const failing = [];
    for (const look of STOP_LOOKS) {
      const body = bodyOf(look);
      for (const id of ACCESSORY_IDS) {
        if (!accessoryFits(id, body)) continue;
        const spec = (({ vibe: _v, ...f }) => f)(memberOrders('hero', look, { era: 'modern', accessories: [id] }).mint.args.spec);
        const e = validateHeroSpec(spec);
        if (e.length) failing.push({ accessory: id, look, e });
        if (ACCESSORIES[id].pieces) { const hero = heroRecord(spec), { unworn } = sortPieces(heroPlanOf(hero), hero.outfit); if (unworn.length) failing.push({ accessory: id, look, unworn }); }
      }
      for (const id of ITEM_IDS) { const e = valid(memberOrders('hero', look, { era: 'modern', items: [id] }).mint.args.spec); if (e.length) failing.push({ item: id, look, e }); }
    }
    for (const m of CAST) for (const look of STOP_LOOKS) {
      const e = valid(memberOrders(m.id, look, { items: 'signature' }).mint.args.spec);
      if (e.length) failing.push({ member: m.id, look, signature: m.items, e });
    }
    expect(failing).toEqual([]);
  }, 120_000);

  it('every head\'s ensemble validates, an armoured one carrying the head in place of its helm', () => {
    const failing = [];
    for (const [head, id] of Object.entries(HARMONY)) for (const look of STOP_LOOKS.filter((l) => bodyOf(l) === 'tiered')) {
      if (!ENSEMBLES[id]) { failing.push({ head, missing: id }); continue; }
      const { spec } = memberOrders('hero', look, { headgear: head, ensemble: 'auto' }).mint.args;
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
    for (const m of CAST) for (const look of STOP_LOOKS) for (const era of [undefined, ...ERA_IDS]) {
      const body = bodyOf(look);
      const { mint, era: got } = memberOrders(m.id, look, era ? { era } : {});
      const e = valid(mint.args.spec);
      if (e.length) failing.push({ member: m.id, look, era, e });
      if (era && got !== era) failing.push({ member: m.id, look, era, got });
      if (mint.args.spec.toon !== undefined || mint.args.spec.form !== (body === 'realistic' ? 'realistic' : undefined)) failing.push({ member: m.id, look, era, body: mint.args.spec.form, toon: mint.args.spec.toon });
    }
    expect(failing).toEqual([]);
  }, 120_000);

  it('every grunt faction, kind and pole validates on both bodies, in each of its colourways', () => {
    const failing = [];
    for (const [s, S] of Object.entries(GRUNT_STYLES)) for (const kind of Object.keys(S.kinds)) for (const pole of ['male', 'female']) for (const look of STOP_LOOKS) for (const colourway of Object.keys(S.colourways)) {
      const o = gruntOrders(s, look, { kind, pole, colourway });
      const e = valid(o.mint.args.spec);
      if (e.length) failing.push({ s, kind, pole, look, colourway, e });
    }
    expect(failing).toEqual([]);
  }, 120_000);
});
