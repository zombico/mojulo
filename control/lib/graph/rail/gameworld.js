// The gameworld rail: a game designed top down (design_game). Its concerns are the book's reviewed parts, each in the
// state its stamp puts it (gameworld/review.js, character-review.js), grouped into what a game asks of its maker: what
// game it is, its world, its characters, its systems, its levels, its story, and play. Its parts are what a run made
// (runner.js), each fresh or not by the runner's own `decide`; it is read in its bible and played as its game.
import { registerRail, sketchHref } from './rail.js';
import { isGameworldKind, gameworldOf } from '../gameworld/gameworld-kind.js';
import { reviewState, fingerprint } from '../gameworld/review.js';
import { characterState } from '../gameworld/character-review.js';
import { runSteps, decide } from '../gameworld/runner.js';
import { readGameworld } from '../gameworld/world.js';

export const GAMEWORLD_OUTCOMES = Object.freeze([
  { id: 'intent', name: 'Intent' },
  { id: 'world', name: 'World' },
  { id: 'characters', name: 'Characters' },
  { id: 'systems', name: 'Systems' },
  { id: 'levels', name: 'Levels' },
  { id: 'story', name: 'Story' },
  { id: 'play', name: 'Play' },
]);

/** The outcome a reviewed part answers. */
export function partOutcome(id) {
  if (id === 'intent') return 'intent';
  if (['world', 'nature', 'civilizations', 'key'].includes(id) || id.startsWith('tech:')) return 'world';
  if (id === 'characters:direction' || id === 'cast' || id.startsWith('hero:')) return 'characters';
  if (id === 'equipment' || id.startsWith('mechanics:')) return 'systems';
  if (id.startsWith('level:')) return 'levels';
  if (id === 'story' || id === 'quests') return 'story';
  return null;
}

/**
 * A stamp as a concern's state. The creator's approval is the eyes gate; the agent's 'auto' is the machine gate; the
 * two are both settled and never the same: `gate` says which.
 */
export function stampState(s) {
  switch (s.status) {
    case 'approved': return { state: 'given', gate: 'eyes' };
    case 'auto': return { state: 'given', gate: 'machine' };
    case 'changed': return { state: 'advised' };
    // sent back: by the machine gate's laws it advises; by the creator's note it is open again
    case 'revise': return { state: s.machine?.length ? 'advised' : 'open' };
    default: return { state: 'open' };
  }
}

/** Where a part is in its bible: the character bible when the world has a character book (and only its parts are
 *  there), the world bible otherwise (bible route). */
export function partAnchor(id, characters) {
  const own = id === 'characters:direction' || id.startsWith('hero:') || id.startsWith('mechanics:') || id === 'equipment';
  if (characters) return own ? id.replace(':', '-') : null;
  if (own) return null;
  if (id === 'world') return 'map';
  if (id === 'cast' || id === 'quests') return 'story';
  return id.replace(':', '-');
}

// what a run's action says of the thing at a step's ref
const PART_STATE = { keep: 'fresh', remake: 'stale', edited: 'edited', make: 'missing', waiting: 'waiting', taken: 'taken' };
const roleOf = (key) => (key === 'hero-equipped' ? 'hero' : key.replace(/-.*$/, ''));

export default registerRail({
  id: 'gameworld',
  test: (m) => isGameworldKind(m.kind),
  outcomes: GAMEWORLD_OUTCOMES,
  read(m, { ref, row, errors }) {
    const world = gameworldOf(m);
    const stamps = [];
    try { stamps.push(...reviewState(world)); } catch (err) { errors.push(err.message); }
    try { if (world.characters) stamps.push(...characterState(world)); } catch (err) { errors.push(err.message); }
    const anchorOf = (id) => partAnchor(id, !!world.characters);
    const concerns = stamps.filter((s) => partOutcome(s.id)).map((s) => ({
      id: s.id, name: s.name, outcome: partOutcome(s.id), ...stampState(s), ...(s.note ? { note: s.note } : {}),
      ...(anchorOf(s.id) ? { anchor: anchorOf(s.id) } : {}),
    }));
    // a world that writes no intent is read from what it says; saying it is still open (a quick game's goal is its
    // intent, and design_game never asks it for one)
    if (world.intent === undefined && !world.quick) concerns.unshift({ id: 'intent', name: 'What game it is', outcome: 'intent', state: 'open' });

    const made = world.made ?? {};
    const parts = [];
    let steps = [];
    if (ref) {
      try { steps = runSteps(world, { ref }); } catch (err) { errors.push(err.message); }
    }
    for (const step of steps) {
      const stored = row(step.ref);
      const action = decide(step, made[step.key], stored ? fingerprint(stored.manifest) : null);
      parts.push({ ref: step.ref, role: roleOf(step.key), state: PART_STATE[action] ?? 'missing' });
    }
    // a building level by ref is played as it was made: a part, made by no run
    let G = null;
    try { G = readGameworld(world); } catch (err) { errors.push(err.message); }
    for (const id of G?.ids ?? []) {
      const b = world.levels?.[id]?.building;
      if (b && typeof b.ref === 'string') parts.push({ ref: b.ref, role: 'level', state: row(b.ref) ? 'fresh' : 'missing' });
    }

    // play: the run has made the game, and it is as the book left it
    const game = steps.find((s) => s.key === 'game');
    const gamePart = game && parts.find((p) => p.ref === game.ref);
    concerns.push({
      id: 'game', name: 'The game', outcome: 'play',
      state: !gamePart ? 'open' : gamePart.state === 'fresh' ? 'given' : ['missing', 'waiting'].includes(gamePart.state) ? 'open' : 'advised',
    });

    const exits = [];
    if (ref) exits.push({ id: 'book', href: sketchHref(ref, 'bible') });
    const gameRef = made.game?.ref;
    if (gameRef && row(gameRef)) exits.push({ id: 'play', href: sketchHref(gameRef, 'game') }, { id: 'playtest', href: sketchHref(gameRef, 'playtest') });
    return { concerns, parts, exits };
  },
});
