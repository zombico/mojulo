/**
 * THE ROUTING — what the door says so the form is filled before the gate is crossed. A game of several departments is
 * worked from an intent (an ask, asks.js), its pages written from their cards (chapters.js), and its run read whole.
 * Nothing here refuses: each is advice, a next move or a stamp.
 *
 *   needsAsk(world)                 → does the book hold work that stands on an intent (a hero, a main quest, a
 *                                     bestiary a hand wrote)? A quick game and a composed world are one call: never.
 *   askAdvice(world, { asked })     → null, or { says, next }: the advice and the move that leads, while the ledger
 *                                     holds no ask
 *   unaskedStamp(made, { asked, built, needs })  → the build ledger with its game stamped `unasked` (built with no ask on
 *                                     record) or the stamp dropped (an ask has since linked a run); the same object
 *                                     when nothing moves; `needs` false (a book that stands on no intent) never stamps
 *   runAdvice(ran)                  → [{ says, steps }]: each distinct advice a run's steps gave, with how many gave it
 *   refusalCards(message)           → the cards of the chapter a refusal's path belongs to ([] when it names none)
 *   withCards(message)              → the refusal, ending with the cards to read (unchanged when it names a manual)
 *
 * Pure: no database, no clock.
 */
import { chaptersOfPath, LEVEL_PAGE_CARDS } from './chapters.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function needsAsk(world) {
  if (!isObj(world) || world.quick) return false;
  const composed = Array.isArray(world.brief?.read);
  return !!world.characters?.hero || isObj(world.mainQuest) || (!composed && isObj(world.foes) && Object.keys(world.foes).length > 0);
}

export const ASK_SAYS = 'no ask on record: the work below stands on no intent (give `ask: { intent }` with the next patch or run: the game you inferred, in your own words)';

export function askAdvice(world, { asked = false } = {}) {
  if (asked || !needsAsk(world)) return null;
  return { says: ASK_SAYS, next: { step: 'ask', card: 'gameworld-ledger' } };
}

export function unaskedStamp(made, { asked = false, built = false, needs = true } = {}) {
  if (!isObj(made?.game)) return made;
  if (!asked && built && needs && !made.game.unasked) return { ...made, game: { ...made.game, unasked: true } };
  if (asked && made.game.unasked) { const { unasked: _u, ...game } = made.game; return { ...made, game }; }
  return made;
}

export function runAdvice(ran) {
  const seen = new Map();
  for (const r of Array.isArray(ran) ? ran : []) for (const says of r?.advises ?? []) seen.set(says, (seen.get(says) ?? 0) + 1);
  return [...seen].map(([says, steps]) => ({ says, steps }));
}

// a refusal's path: '<scope>: <dotted.path>…' (characters: hero.actions.idiom …; gameworld: foes.warlord: …)
const SCOPES = { characters: '/characters', gameworld: '' };
function pointerOf(message) {
  const m = /^(characters|gameworld): ([A-Za-z][\w-]*(?:(?:\.[A-Za-z][\w-]*)|(?:\[\d+\]))*)/.exec(String(message ?? ''));
  if (!m) return null;
  return `${SCOPES[m[1]]}/${m[2].replace(/\[(\d+)\]/g, '/$1').replace(/\./g, '/')}`;
}

export function refusalCards(message) {
  const p = pointerOf(message);
  if (!p) return [];
  const [, first, second] = p.split('/');
  // a level's own page is written from the world's card and the foes' (chapters.js), not the levels' structures
  if (first === 'levels' && second) return [...LEVEL_PAGE_CARDS];
  const owners = chaptersOfPath(p);
  if (owners.length !== 1) return [];
  const cards = owners[0].cards.filter((c) => !c.includes('*'));
  // a chapter of several cards: the one named for the page refused, when there is one
  const own = cards.filter((c) => c === `gameworld-${first.replace(/[A-Z]/g, (x) => `-${x.toLowerCase()}`)}`);
  return own.length ? own : cards;
}

export function withCards(message) {
  const text = String(message ?? '');
  if (/get_\w+_vocab\(/.test(text)) return text;
  const cards = refusalCards(text);
  return cards.length ? `${text} — read first: ${cards.map((c) => `get_game_vocab({ id: '${c}' })`).join(', ')}` : text;
}
