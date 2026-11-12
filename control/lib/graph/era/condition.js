/**
 * CONDITION — a room's state of repair, as the word people say for it: how long it has stood and how long since anyone
 * kept it. One word sets the dials that tell it together, so "derelict" or "ruined" reads as one place and not as three
 * knobs turned apart:
 *
 *   skandart  how much has come down and lies where it rests (era/skandart.js: its heaps, by the kit's causes)
 *   grime     how long the place has stood (era/stage.js withGrime: the dirt, the moss, the wall's wear)
 *   swept     whether anyone still sweeps: a kept room's webs within reach are brushed away, a forsaken room's stay
 *   decay     on a kit that tells its own story of going derelict (its style card's `decay`, era/decay.js: a lab's
 *             abandonment, blackout, leak, broken set piece and fallen roof), how far each went: a ruined lab's roof
 *             is down, so its debris has a hole to lie under
 *
 *   CONDITIONS          the ladder, kept to ruined, each its dials and its words
 *   readCondition(m)    a recipe's `condition` (a step or any of its words) → { id, said, dials } | null
 *   withCondition(m, kit) → the recipe with the condition's dials filled where the recipe set none, and `_condition`, what
 *                       it applied and what the kit could not (a kit that answers no debris question takes the grime alone)
 * A recipe's own `skandart` or `grime` stands over the word's. Pure.
 */

import { deriveSkandart } from './skandart-derive.js';

export const CONDITIONS = Object.freeze({
  kept: Object.freeze({ dials: Object.freeze({ skandart: 0, grime: 0.1, swept: true }),
    words: Object.freeze(['kept', 'tended', 'maintained', 'clean', 'pristine', 'new', 'in use']) }),
  worn: Object.freeze({ dials: Object.freeze({ skandart: 0.2, grime: 0.4, swept: true }),
    words: Object.freeze(['worn', 'used', 'lived-in', 'old', 'weathered', 'aged']) }),
  neglected: Object.freeze({ dials: Object.freeze({ skandart: 0.45, grime: 0.6, swept: false, decay: Object.freeze({ abandon: 0.35 }) }),
    words: Object.freeze(['neglected', 'dusty', 'disused', 'forgotten', 'unkempt', 'shabby']) }),
  derelict: Object.freeze({ dials: Object.freeze({ skandart: 0.7, grime: 0.85, swept: false, decay: Object.freeze({ abandon: 0.8, blackout: 0.6, leak: 0.4 }) }),
    words: Object.freeze(['derelict', 'abandoned', 'deserted', 'decrepit', 'run-down', 'forsaken', 'dilapidated']) }),
  ruined: Object.freeze({ dials: Object.freeze({ skandart: 1, grime: 1, swept: false, decay: Object.freeze({ abandon: 1, blackout: 0.9, leak: 0.6, breach: 1, collapse: 1 }) }),
    words: Object.freeze(['ruined', 'ruins', 'ruin', 'crumbling', 'collapsing', 'falling apart', 'wrecked', 'caved in']) }),
});

const WORD = new Map(Object.entries(CONDITIONS).flatMap(([id, C]) => [[id, id], ...C.words.map((w) => [w, id])]));

/** A recipe's `condition` → { id, said, dials } | null. A word it does not know teaches the ladder. */
export function readCondition(m) {
  const v = m.condition;
  if (v === undefined || v === null || v === false) return null;
  const said = typeof v === 'string' ? v.trim().toLowerCase() : null, id = said !== null ? WORD.get(said) : undefined;
  if (!id) throw new Error(`stage: condition is a room's state of repair: ${Object.keys(CONDITIONS).join(' | ')} (or a word for one: ${Object.values(CONDITIONS).map((C) => C.words[1]).join(', ')}, …), got ${JSON.stringify(v)}`);
  return { id, said, dials: CONDITIONS[id].dials };
}

/**
 * The recipe with its condition's dials filled where it set none. `kit` the stage kit (its `skandart` card says whether
 * it answers the debris question). → the recipe, with `_condition`: { id, said, applied: {…}, unanswered: [dial] }
 */
export function withCondition(m, kit) {
  const C = readCondition(m);
  if (!C) return m;
  const { condition: _c, ...rest } = m, applied = {}, unanswered = [];
  const out = { ...rest };
  if (m.grime === undefined) { out.grime = C.dials.grime; applied.grime = C.dials.grime; }
  // (a kit that tells its own story of decay, its style card's `decay`, takes the step's events where the recipe set none)
  if (m.decay === undefined && C.dials.decay && kit && kit.dress && kit.dress.decay) { out.decay = { ...C.dials.decay }; applied.decay = { ...C.dials.decay }; }
  if (m.skandart === undefined) {
    // (a kept room is one where nothing has come down: it lays no heap and keeps none of its kit's fallen stone either)
    // (a kit answers by its card, or by what it is made of, era/skandart-derive.js)
    if (kit && (kit.skandart || deriveSkandart(kit))) { out.skandart = { amount: C.dials.skandart, ...(C.dials.swept ? {} : { swept: false }) }; applied.skandart = C.dials.skandart; }
    else if (C.dials.skandart > 0) unanswered.push('skandart');
  }
  return { ...out, _condition: { id: C.id, said: C.said, applied, ...(unanswered.length ? { unanswered } : {}) } };
}
