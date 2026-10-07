/**
 * Idiom vocabulary loader — the game-idiom shelf: one card per idiom in game-idioms.js, plus the guide.
 * Generated from IDIOM_ABOUT at load, never hand-written: each card lowers its own example through
 * IDIOM_LOWERING and prints what it became, so a card cannot drift from the function it describes, and an
 * idiom without an about row fails the shelf's test. Find one by intent via
 * semantic_search({ kinds: ['game_idiom'] }), read it via get_game_vocab({ id: 'idiom-<kind>' }), then list
 * it in a world's `idioms` (compose_world base 'action'). Indexed under source_kind='game_idiom'.
 *
 * Its own shelf: it reads only game-idioms.js and shares no helpers with the other card families.
 */

import { IDIOM_ABOUT, IDIOM_KINDS, IDIOM_LOWERING, PLAY_TIERS } from '../../worlds/game-idioms.js';

/** The bytes an idiom card's body may take: what it does, its params, one example and what that lowers to. */
export const IDIOM_CARD_BODY_CEILING = 2400;

const TIER_TEXT = {
  click: 'click demo: things you press that answer',
  walk: 'walk demo: a body you drive through the world',
  level: 'level: one place with a goal',
  game: 'game: levels that carry state between them',
};

// the lowered fragment, one channel a line, so the card shows exactly which bus rows the idiom writes
function lowered(kind) {
  const frag = IDIOM_LOWERING[kind](IDIOM_ABOUT[kind].example);
  return Object.entries(frag).map(([ch, v]) => `  ${ch}: ${JSON.stringify(v)}`);
}

function idiomCard(kind) {
  const a = IDIOM_ABOUT[kind];
  const body = [
    `# ${a.name} (game idiom)`, '', a.summary, '',
    `TIER       ${a.tier}: ${TIER_TEXT[a.tier]}`,
    ...(a.needs ? [`NEEDS      ${a.needs}`] : []),
    '', 'PARAMS', ...Object.entries(a.params).map(([k, v]) => `  ${k}: ${v}`),
    '', 'EXAMPLE (a row in the world\'s "idioms")', `  ${JSON.stringify({ kind, ...a.example })}`,
    '', 'LOWERS TO (event-bus rows; the idiom is gone once lowered)', ...lowered(kind),
  ].join('\n');
  return { id: `idiom-${kind}`, name: `${a.name} (game idiom)`, summary: a.summary, when: a.when, tier: a.tier, body };
}

function guideCard() {
  const body = [
    '# Game idioms', '',
    'Reusable rules a world lists as `idioms: [{ kind, …params }]`. Each lowers to event-bus rows once, at mint; a var declared by two idioms is refused. Rules act on the world\'s `entities` (the props they show, hide and count). Open idiom-<kind> for its params and what it lowers to.',
    ...PLAY_TIERS.flatMap((t) => {
      const kinds = IDIOM_KINDS.filter((k) => IDIOM_ABOUT[k].tier === t);
      return kinds.length ? ['', `${t.toUpperCase()} (${TIER_TEXT[t]})`, ...kinds.map((k) => `  - ${k}: ${IDIOM_ABOUT[k].summary}`)] : [];
    }),
    '', 'An idiom is listed by the lowest tier it is useful on; any higher tier may use it.',
  ].join('\n');
  return {
    id: 'idiom-guide', name: 'Game idioms (guide)',
    summary: 'The reusable rules a world lists in `idioms`, grouped by the lowest tier of interactivity each is useful on.',
    when: 'make it interactive, add rules, click to toggle, a score and a timer, which game rules exist',
    body,
  };
}

let _catalog = null;
export function getIdiomVocabCatalog() {
  if (!_catalog) {
    _catalog = new Map();
    for (const card of [guideCard(), ...IDIOM_KINDS.map(idiomCard)]) _catalog.set(card.id, card);
  }
  return _catalog;
}
export function getIdiomVocabCard(id) { return getIdiomVocabCatalog().get(id) || null; }
