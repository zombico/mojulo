/**
 * THE RUNNER'S PLAN — what a run of a gameworld makes, pure. The book's orders (heroOrders, mechanicsOrders,
 * equipmentOrders) are the tool calls that realize its pages; a run (design_game's `run`, lib/mcp/tools/design-game.js)
 * makes the ones whose step is ready, through the same handlers an agent would call, at refs it derives from the
 * gameworld's own, and records what it made (made.js). This module says, for the world as it stands, which steps there
 * are and what to do with each; the door does it.
 *
 *   runSteps(world, { ref, lookup })   → [{ key, ref, ready, waiting?, order, print }]
 *     hero       always ready once the world has a hero: the base must be made to be seen and pinned
 *     systems    when the systems step is (characterReady): the player world with the stats and the HUD
 *     gear-<c>   when the equipment step is: one per filled class of the table
 *   decide(step, record, storedNow, { force }) → what to do with one step:
 *     'waiting'  the step is not ready (its `waiting` says on what)
 *     'make'     nothing is at its ref
 *     'taken'    something the runner did not make is at its ref: left as it is (force: remade)
 *     'keep'     the book's order and what is stored are as the runner left them
 *     'edited'   the creator changed it by hand since: left as it is, even when the book moved (force: remade)
 *     'remake'   the book's order moved and the stored one is as the runner left it
 *
 * Every run of the same world and the same store decides the same: no dice, no clock.
 */
import { fingerprint } from './review.js';
import { readGameworld } from './world.js';
import { resolveBook, characterReady } from './character-review.js';
import { heroOrders } from './hero-looks.js';
import { mechanicsOrders } from './mechanics.js';
import { equipmentOrders } from './equipment.js';

const REF_MAX = 64;

/** The ref of what a run makes for `part` of the gameworld at `ref`: `<ref>-<part>`, or, past the 64 characters a ref
 * may have, the ref cut short with its print to keep it apart. */
export function childRef(ref, part) {
  const plain = `${ref}-${part}`;
  if (plain.length <= REF_MAX) return plain;
  return `${ref.slice(0, REF_MAX - part.length - 10)}-${fingerprint(ref)}-${part}`;
}

/** The steps of a run, in the order they are made (the hero first: the others name it, or wait on its pinned base). */
export function runSteps(world, { ref, lookup } = {}) {
  if (typeof ref !== 'string' || !ref) throw new Error('runner: the steps are made at refs derived from the gameworld\'s own ref');
  const G = readGameworld(world), O = heroOrders(G);
  if (!O) return [];
  const heroRef = childRef(ref, 'hero');
  const hero = { spec: O.mint.args.spec, mint: O.mint.args, motion: O.motion?.args.patch ?? null };
  const steps = [{ key: 'hero', ref: heroRef, ready: true, order: hero, print: fingerprint({ spec: hero.spec, motion: hero.motion, toon: hero.mint.toon ?? null }) }];
  const ready = characterReady(world, { lookup }), B = resolveBook(world);
  const waits = (r) => (r.ready ? {} : { waiting: r.waiting });
  const MO = mechanicsOrders(G, B.mechanics, { heroRef });
  if (MO) steps.push({ key: 'systems', ref: childRef(ref, 'systems'), ready: ready.systems.ready, ...waits(ready.systems), order: MO.args, print: fingerprint(MO.args) });
  const EO = equipmentOrders(G, ready.equipment);
  for (const m of EO.mints.length ? EO.mints : EO.planned ?? []) {
    steps.push({ key: `gear-${m.class}`, ref: childRef(ref, `gear-${m.class}`), ready: ready.equipment.ready, ...waits(ready.equipment), order: m.args, print: fingerprint(m.args) });
  }
  return steps;
}

/** What to do with one step. `record` is made[key], if any; `storedNow` the print of the manifest at its ref now, or
 * null when nothing is there. */
export function decide(step, record, storedNow, { force = false } = {}) {
  if (!step.ready) return 'waiting';
  if (storedNow === null) return 'make';
  if (!record || record.ref !== step.ref) return force ? 'remake' : 'taken';
  const edited = storedNow !== record.stored, moved = record.order !== step.print;
  if (edited && !force) return 'edited';
  return moved || edited ? 'remake' : 'keep';
}
