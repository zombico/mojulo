/**
 * level-synth — synthesize a level's game contract (+ world events) from its `game.mechanics`
 * (game-mechanics.plan.md, M1/M3). ONE lowering, shared by two readers so they never drift:
 *   - world-scene.js resolveWorldScene — splices the events into the bus, the contract onto payload.game
 *   - game-resolve.js resolveGame — validates the SYNTHESIZED contract (produces/on/audits) against
 *     the game's store, so a mechanics-authored level assembles into a game like a hand-authored one.
 *
 * A level sketch stores the RECIPE (mechanics), not the rendered contract — so any reader that needs
 * the contract must synthesize it here. Chapters that carry (play.chapters with play.carry) add their rows here too,
 * for the same reason. Deterministic + pure.
 */

import { composeMechanics } from './mechanics.js';
import { chapterContract } from '../playscape/ui/chapters.js';
import { sceneContract } from '../playscape/ui/scenes.js';

const EV_ARRAY_CHANNELS = ['entities', 'timers', 'reactions', 'watches', 'inputs', 'hud', 'sources', 'sequences', 'initial'];

// the level's player = its walk/platform controllable entity; spawn = that entity's initial pos.
export function deriveLevelPlayer(manifest) {
  const ents = Array.isArray(manifest.entities) ? manifest.entities : [];
  // the pilot: the first walker or platformer, else a driven vehicle (a ride)
  const p = ents.find((e) => e && e.rule && (e.rule.type === 'walk' || e.rule.type === 'platform')) || ents.find((e) => e && e.pilotable && e.rule && e.rule.type === 'drive');
  const player = (p && p.id) || 'player';
  const spawn = (p && p.transform && Array.isArray(p.transform.pos)) ? p.transform.pos.slice() : [0, 0, 2];
  return { player, spawn };
}

// merge the mechanic-synthesized contract into the hand-authored game channel. The contract's
// `produces` is { results?, events:[...] }, so mechanic-synthesized events nest under `.events`.
// Hand-authored produces/on/consumes are kept; a hand `on` key wins over a mechanic one (override).
export function mergeContract(game, composed) {
  const handProduces = game.produces && typeof game.produces === 'object' ? game.produces : {};
  const handEvents = Array.isArray(handProduces.events) ? handProduces.events : [];
  return {
    ...game,
    produces: {
      ...(handProduces.results ? { results: handProduces.results } : {}),
      events: [...handEvents, ...(composed.produces || [])],
    },
    on: { ...(composed.on || {}), ...(game.on || {}) },
    consumes: [...(game.consumes || []), ...(composed.consumes || [])],
    audits: [...(game.audits || []), ...(composed.audits || [])],
    ...(composed.doors ? { doors: [...(game.doors || []), ...composed.doors] } : {}),
    ...(composed.keep ? { keep: [...(game.keep || []), ...composed.keep] } : {}),
    ...(composed.aftermath ? { aftermath: composed.aftermath } : {}),
  };
}

// merge two events manifests (hand-authored + mechanic-lowered) into the one the bus runs.
export function mergeEventManifests(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  for (const ch of EV_ARRAY_CHANNELS) {
    const av = Array.isArray(a[ch]) ? a[ch] : [];
    const bv = Array.isArray(b[ch]) ? b[ch] : [];
    if (av.length || bv.length) out[ch] = [...av, ...bv];
  }
  const vars = { ...(a.vars || {}), ...(b.vars || {}) };
  if (Object.keys(vars).length) out.vars = vars; else delete out.vars;
  return out;
}

/**
 * Synthesize a level manifest's game channel from its mechanics.
 * @returns {{ game: object|null, mechEvents: object|null }} the (possibly synthesized) game
 *          contract and the lowered events fragment (null when the level declares no mechanics).
 * @throws  a teaching error if the mechanics are invalid.
 */
export function synthesizeLevel(manifest) {
  const game = manifest && manifest.game;
  if (!game || typeof game !== 'object') return { game: game || null, mechEvents: null };
  // chapters and scenes that carry between levels add their setFlag rows (playscape/ui/chapters.js, scenes.js); none ⇒ the same object
  const play = manifest.play;
  if (!Array.isArray(game.mechanics) || !game.mechanics.length) return { game: sceneContract(chapterContract(game, play), play), mechEvents: null };
  const { player, spawn } = deriveLevelPlayer(manifest);
  let composed;
  try {
    composed = composeMechanics(game.mechanics, { player, spawn, fall: game.fall });
  } catch (err) {
    throw new Error(`game mechanics are invalid:\n${err.message}`);
  }
  return { game: sceneContract(chapterContract(mergeContract(game, composed), play), play), mechEvents: composed.events };
}
