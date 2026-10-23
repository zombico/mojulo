/**
 * THE FEEL BOOK — a made game's feel, played: the stick view (page.js) of the card its `feel` makes, on its template's
 * stage and viewer, the takes baked for the template's base feel on one cast, and what the game's runtime carries of
 * the card said beside it. The gameworld bible's sibling (`/api/sketches/<ref>/bible?book=feel`), as the character
 * bible is: a page to sample how the game's controls play before (or beside) the game itself.
 *
 *   feelBookHtml(world, { cast?, data? }) → the page's HTML, or null for a world that writes no feel (`data`: takes
 *                                   already baked, else baked here)
 *   feelSample(world, { cast? })   → the sample the page carries (its name, card, stage, viewer, report), or null
 *
 * The bake (takes.js) is the slow part: once per cast and base feel, kept in memory for every world that asks.
 */
import { POLES } from './cards.js';
import { readFeel, feelCard, feelReport } from './lower.js';
import { bake } from './takes.js';
import { feelPageHtml } from './page.js';

export const BOOK_CASTS = Object.freeze(['male', 'female']);
const baked = new Map();
const bakeOf = (cast, base) => { const k = `${cast}:${base}`; if (!baked.has(k)) baked.set(k, bake(cast, { feels: [base] })); return baked.get(k); };
// a card as JSON keeps its Infinity (a turn that is instant) the way the page's copy() reads it back
const carded = (card) => JSON.parse(JSON.stringify(card, (k, v) => (v === Infinity ? 'Infinity' : v)));

export function feelSample(world, { cast = 'male' } = {}) {
  if (!world || world.feel === undefined || world.feel === null) return null;
  if (!BOOK_CASTS.includes(cast)) throw new Error(`feel book: cast is one of ${BOOK_CASTS.join(', ')}`);
  const F = readFeel(world.feel), card = feelCard(F), R = feelReport(F);
  // a blend is seen as its nearer template is (the stage, the viewer, the gear)
  const P = POLES[F.toward && F.t >= 0.5 ? F.toward : F.pole], name = world.name ?? world.id ?? 'This game';
  const blend = F.toward ? `, ${Math.round(F.t * 100)}% toward ${POLES[F.toward].name}` : '';
  return {
    name, cast, base: POLES[F.pole].base, card: carded(card), stage: P.stage, view: P.view.camera, gear: P.gear ?? null,
    demo: P.demo,
    says: `${name} plays ${R.name} (after ${R.after})${R.variant ? `, ${R.variant}` : ''}${blend}: ${POLES[F.pole].says}`,
    report: { carried: R.carried, partly: R.partly, lost: R.lost },
  };
}

export function feelBookHtml(world, { cast = 'male', data = null } = {}) {
  const sample = feelSample(world, { cast });
  if (!sample) return null;
  // (`data`: takes already baked for the cast, a test's or a caller's own; else baked here, once)
  return feelPageHtml({ data: data ?? { [sample.cast]: bakeOf(sample.cast, sample.base) }, sample, title: `${sample.name}: feel` });
}
