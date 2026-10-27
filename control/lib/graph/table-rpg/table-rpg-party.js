/**
 * THE TABLE RPG'S PARTY, seen from the rest of mojulo: a member's PERSONA rolled on the egocube (egocube/egocube.js:
 * who they are, the same sheet `create_character { egocube }` draws a body from), and the party read as the LIVE RPG's
 * (playscape/rpg/rpg.js `play.rpg`), so a party rolled at the table fights in a 3D game with its numbers carried over.
 * Character creation stays the module's own: the sheet is rolled by the system (table-rpg-kernel.js `sheet`), the
 * persona only says who wears it, and the class it plays when the member names none (the persona's role).
 *
 *   withPersonas(module) → module   each member with `egocube: true | { brief?, facets? }` given `persona` (and `role`
 *                                   from it when it names neither a class nor a role); the egocube sheet kept on the
 *                                   member as `egocube` for the character door
 *   toLiveParty(K) → play.rpg       { party: [{ id, name, class, level, bonus }] }: each member as the live class its
 *                                   system class plays as, its abilities read as the live stats (the card's `live`
 *                                   map), centred on the class's own numbers; readRpg takes it as it is
 */
import { rollEgocube } from '../egocube/egocube.js';

export function withPersonas(module) {
  const seed = module.seed ?? 1;
  const party = (module.party ?? []).map((p) => {
    if (!p.egocube) return p;
    const ask = p.egocube === true ? {} : p.egocube;
    const sheet = rollEgocube({ seed, path: `party/${p.id}`, brief: ask.brief ?? '', facets: ask.facets ?? {} });
    const persona = { archetype: sheet.reading.archetype, shadow: sheet.reading.shadow, role: sheet.facets.role, reads: sheet.reads.join('; ') };
    const out = { ...p, persona, egocube: { seed, path: sheet.path, ...(ask.brief ? { brief: ask.brief } : {}), ...(ask.facets ? { facets: ask.facets } : {}) } };
    if (p.class === undefined && p.role === undefined) out.role = sheet.facets.role;
    return out;
  });
  return { ...module, party };
}

// how far each live stat moves from the class's own numbers at the ends of an ability's span
const SWING = { hp: 10, mp: 6, atk: 4, def: 4, mag: 4, spd: 3 };

export function toLiveParty(K) {
  const sys = K.sys, [lo, hi] = sys.range ?? [0, 1];
  const norm = (v) => Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  const party = K.party.map((p) => {
    const bonus = {};
    for (const [stat, a] of Object.entries(sys.live)) {
      const n = Math.round((norm(p.scores[a]) - 0.5) * 2 * SWING[stat]);
      if (n) bonus[stat] = n;
    }
    return { id: p.id, name: p.name, class: sys.classes[p.class].live, level: p.level, ...(Object.keys(bonus).length ? { bonus } : {}) };
  });
  return { party };
}
