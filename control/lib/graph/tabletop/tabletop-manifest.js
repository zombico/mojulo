/**
 * THE TABLETOP MANIFEST — a board game as a recipe: a few keys a `sketches` row keeps, the page regenerated from them
 * on every read.
 *
 *   { kind: 'tabletop', game, human?, level?, view?, seed?, clock?, title? }
 *     game 'chess' | 'checkers' (the book: games nobody owns), or a game written out (the tabletop kernel's G: board,
 *       players, pieces, rules, setup, or the systems: places, resources, building, dice, cards, trading, scores), so a
 *       new game is composed, not coded. The book never holds a published game by name: one asked for by name is
 *       written out from the rules the person explains.
 *     human the player the person plays (the first); level 'easy' | 'fair' | 'hard'; view 'plan' | 'table'; seed the
 *     computer's dice (and a written game's `deal`, when it has no seed of its own); clock { base, inc?, delay? } in
 *     seconds (a game of moves)
 *
 *   TABLETOP_GAMES                 the book's games
 *   resolveTabletop(manifest) → { G, opts }   G the kernel's game, opts the page's; refuses what it cannot play
 *   tabletopManifestHtml(manifest) → html
 *
 * Stored as a game (create_game's `tabletop`): { kind: 'game', engine: 'tabletop', title, tabletop: <the keys above,
 * less kind> }, played at /api/sketches/<ref>/game and exported as one page, as a pixelizer or versus game is.
 *
 *   buildTabletopGameManifest({ title?, tabletop }) → manifest   refuses a game it cannot play
 *   emitTabletopGame(manifest, { title? }) → html
 */

import { CHESS } from './games/chess.js';
import { CHECKERS } from './games/checkers.js';
import { tabletopGame } from './tabletop.js';
import { tabletopPageHtml } from './tabletop-page.js';

export const TABLETOP_GAMES = {
  chess: { title: 'Chess', make: () => ({ ...CHESS, title: 'Chess' }) },
  checkers: { title: 'Checkers', make: () => ({ ...CHECKERS, title: 'Checkers' }) },
};

const KEYS = new Set(['kind', 'game', 'human', 'level', 'view', 'seed', 'clock', 'title']);

export function resolveTabletop(m = {}) {
  const no = (msg) => { throw new Error(`tabletop: ${msg}`); };
  if (m.kind !== undefined && m.kind !== 'tabletop') no(`a tabletop manifest is kind 'tabletop', not '${m.kind}'`);
  for (const k of Object.keys(m)) if (!KEYS.has(k)) no(`unknown key '${k}' (keys: ${[...KEYS].join(', ')})`);
  const seed = m.seed ?? 1;
  if (!Number.isInteger(seed) || seed < 0) no('seed is a whole number, 0 or more');
  let G;
  if (typeof m.game === 'string') {
    const book = TABLETOP_GAMES[m.game];
    if (!book) no(`no game '${m.game}' in the book (${Object.keys(TABLETOP_GAMES).join(', ')}); or write one out as an object`);
    G = book.make();
  } else if (m.game && typeof m.game === 'object' && !Array.isArray(m.game)) {
    G = { ...m.game };
    if (G.seed === undefined && m.seed !== undefined) G.seed = seed;
  } else no(`game is one of ${Object.keys(TABLETOP_GAMES).join(', ')}, or a game written out`);
  if (m.clock !== undefined) {
    if (G.dice || G.build) no('a clock is for a game of moves (chess, checkers), not a euro game');
    const { base, inc = 0, delay = 0 } = m.clock || {};
    if (!(base > 0) || !(inc >= 0) || !(delay >= 0)) no('clock is { base, inc?, delay? } in seconds, base above 0');
    G.clock = { base: base * 1000, inc: inc * 1000, delay: delay * 1000 };
  }
  if (m.title !== undefined) G.title = String(m.title);
  // compiled here, so a game that cannot be played is refused at minting, not on the page; its deal done
  G = tabletopGame(G).G;
  return { G, opts: { human: m.human, level: m.level, view: m.view, seed, title: G.title } };
}

export function tabletopManifestHtml(m) {
  const { G, opts } = resolveTabletop(m);
  return tabletopPageHtml(G, opts);
}

export function buildTabletopGameManifest({ title, tabletop } = {}) {
  if (!tabletop || typeof tabletop !== 'object' || Array.isArray(tabletop)) {
    throw new Error(`tabletop is { game: ${Object.keys(TABLETOP_GAMES).join(' | ')} | <a game written out>, human?, level?, view?, seed?, clock? }`);
  }
  const { kind, ...keys } = tabletop;
  const { G } = resolveTabletop({ kind: 'tabletop', ...keys });
  return { kind: 'game', engine: 'tabletop', title: String(title ?? G.title ?? 'Board game'), tabletop: keys };
}

export function emitTabletopGame(manifest, { title } = {}) {
  if (manifest?.engine !== 'tabletop' || !manifest.tabletop) throw new Error('not a tabletop game (engine \'tabletop\' with its `tabletop` keys)');
  return tabletopManifestHtml({ kind: 'tabletop', ...manifest.tabletop, title: manifest.tabletop.title ?? title ?? manifest.title });
}
