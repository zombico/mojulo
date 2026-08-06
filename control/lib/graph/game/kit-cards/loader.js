/**
 * Kit vocabulary loader — one card per game KIT (game-mechanics.plan.md, M4). Unlike the slice /
 * mechanic cards (hand-written markdown), kit cards are GENERATED from the kit registry (kits.js)
 * so the discoverable recipe can never drift from the actual scaffolder. Each card carries the
 * kit's routing phrases + its store + level-template + progression, plus a worked example, so an
 * agent finds a game type by intent (semantic_search({ kinds: ['game_kit'] })), reads the recipe
 * (get_game_vocab), and scaffolds a whole game.
 */

import { KITS, KIT_IDS, scaffoldGameFromKit } from '../kits.js';

function exampleFor(id) {
  // a tiny two-level worked example, so the card shows a concrete scaffold result.
  const geo = {
    'dungeon-crawler': [
      { ref: 'crypt-1', exit: [20, 0, 0], pickups: [{ item: 'coin', at: [8, 0, 0] }], hazards: [{ at: [12, 0, 0], damage: 25 }] },
      { ref: 'crypt-2', exit: [24, 0, 0], pickups: [{ item: 'rune-key', at: [10, 4, 0] }] },
    ],
    collectathon: [
      { ref: 'grove-1', exit: [18, 0, 0], pickups: [{ item: 'gem', at: [6, 0, 0] }, { item: 'gem', at: [12, 3, 0] }] },
      { ref: 'grove-2', exit: [20, 0, 0], pickups: [{ item: 'gem', at: [9, 0, 0] }] },
    ],
    platformer: [
      { ref: 'isles-1', exit: [22, 0, 4], exitRadius: 2, pickups: [{ item: 'gear', at: [6, 0, 2] }, { item: 'gear', at: [14, 0, 5] }], hazards: [{ at: [10, 0, 1], damage: 20 }] },
      { ref: 'isles-2', exit: [26, 0, 6], pickups: [{ item: 'gear', at: [9, 0, 3] }], hazards: [{ at: [16, 0, 2], damage: 25 }], lethal: true },
    ],
    'survival-arena': [
      { ref: 'arena-1', seconds: 30, hazards: [{ at: [5, 0, 0], damage: 20 }] },
      { ref: 'arena-2', seconds: 45, hazards: [{ at: [4, 2, 0], damage: 25 }] },
    ],
  }[id];
  return scaffoldGameFromKit(id, { title: KITS[id].name, levels: geo });
}

function renderCard(id) {
  const kit = KITS[id];
  const ex = exampleFor(id);
  const body = [
    '## What it is', '', kit.summary, '',
    '## Store', '', '```json', JSON.stringify(kit.store, null, 2), '```', '',
    `## Progression`, '', `\`${kit.progression}\`` + (kit.progression === 'gated' ? ' — each level unlocks the next on completion.' : ' — levels play in order, all reachable.'), '',
    `## Fall policy`, '', '```json', JSON.stringify(kit.fall), '```', '',
    '## Worked example (two levels)', '',
    'Mint each world with its `game` channel, then call `create_game`:', '',
    '```json', JSON.stringify({
      per_level_game_channels: ex.levelChannels,
      create_game: { title: kit.name, store: ex.store, levels: ex.gameLevels },
    }, null, 2), '```', '',
    'Fill in each level world\'s geometry (the `at` positions of the exit / pickups / hazards) to taste; the store, mechanics wiring, and gates come from the kit.',
  ].join('\n');
  return { id, name: kit.name, summary: kit.summary, when: kit.when, body };
}

let _catalog = null;
export function getKitVocabCatalog() {
  if (!_catalog) {
    _catalog = new Map();
    for (const id of KIT_IDS) _catalog.set(id, renderCard(id));
  }
  return _catalog;
}
export function getKitVocabCard(id) { return getKitVocabCatalog().get(id) || null; }
export function listKitVocab() {
  return [...getKitVocabCatalog().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when }));
}
