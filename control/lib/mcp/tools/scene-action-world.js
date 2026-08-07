/**
 * create_action_world — mint a LIVE world where THINGS HAPPEN with consequence: a game / an
 * interactive scene with rules (see control/lib/graph/action-world-mcp.plan.md). The sibling of
 * create_controllable_world: that one mints a world you MOVE through; this one mints a world that
 * PLAYS BACK — moles pop, shots score, a timed round ends.
 *
 * The rules are a declarative IDIOM RECIPE lowered server-side: the caller passes `idioms`
 * ([{ kind, ...params }]) and this maps each to its game-idioms.js function, runs compose() (which
 * inherits the var-collision guardrail), and stores the LOWERED `events` block. Same fractal ethos as
 * the rest of the substrate — the stored manifest is a tiny recipe (`kind: 'controllable'` + `events`
 * + `walk`); the live world regenerates deterministically on render at `/api/sketches/<ref>/world`.
 *
 * Two entity concepts (do not conflate): this tool's `entities` are BUS PROPS — the stateful things
 * the rules act on (a sphere that toggles on/off), which live inside the events block. Driven movers
 * (a figure/drone with a per-frame rule) belong to create_controllable_world.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { assembleControllableScene } from '@/lib/graph/worlds/controllable-world';
import {
  compose, scoreCounter, countdownClock, gameOverFreeze, spawnOnHeartbeat, deed,
  onContact, pickup, onRest, ephemeralTarget, hitConfirm,
} from '@/lib/graph/worlds/game-idioms';

// kind → (params) → events fragment. Every idiom takes a single params object EXCEPT scoreCounter
// (positional name), so it gets a thin adapter; the rest pass params straight through (onContact /
// onRest forward their extra fields as the `...spec` verb, which is exactly the params object).
const IDIOMS = {
  scoreCounter: (p = {}) => scoreCounter(p.name ?? p.var ?? 'score', { label: p.label }),
  countdownClock: (p) => countdownClock(p),
  gameOverFreeze: (p) => gameOverFreeze(p),
  spawnOnHeartbeat: (p) => spawnOnHeartbeat(p),
  deed: (p) => deed(p),
  onContact: (p) => onContact(p),
  pickup: (p) => pickup(p),
  onRest: (p) => onRest(p),
  ephemeralTarget: (p) => ephemeralTarget(p),
  hitConfirm: (p) => hitConfirm(p),
};
const IDIOM_KINDS = Object.keys(IDIOMS);

export function mintActionWorld({ title, entities, idioms, events, faces, ground, walk, worldFraming, viewBox, bg, ref, folderRef } = {}) {
  const props = Array.isArray(entities) ? entities : [];
  const recipe = Array.isArray(idioms) ? idioms : [];
  const hasRaw = events && typeof events === 'object';
  if (recipe.length === 0 && props.length === 0 && !hasRaw) {
    throw new Error('create_action_world requires `idioms`, `entities`, or an `events` block (a world with no rules does nothing)');
  }

  // lower the idiom recipe to event-bus fragments (kind → game-idioms fn).
  const fragments = recipe.map((entry, i) => {
    if (!entry || typeof entry !== 'object') throw new Error(`idioms[${i}] must be an object { kind, ...params }`);
    const { kind, ...params } = entry;
    const make = IDIOMS[kind];
    if (!make) throw new Error(`idioms[${i}] has unknown kind '${kind}' (known: ${IDIOM_KINDS.join(', ')})`);
    return make(params);
  });

  // compose: bus props first, then idiom fragments, then any raw passthrough. compose() throws if two
  // idioms declare the same var (an authoring bug — which idiom owns `score`?), surfaced loudly.
  const composed = compose(
    ...(props.length ? [{ entities: props }] : []),
    ...fragments,
    ...(hasRaw ? [events] : []),
  );

  const navWalk = walk === undefined ? true : walk;   // action worlds default to first-person WASD
  const manifest = {
    kind: 'controllable',
    ...(navWalk ? { walk: navWalk } : {}),
    events: composed,
    ...(Array.isArray(faces) && faces.length ? { faces } : {}),
    ...(ground && typeof ground === 'object' ? { ground } : {}),
    ...(worldFraming && typeof worldFraming === 'object' ? { worldFraming } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(bg ? { bg } : {}),
    ...(title ? { title } : {}),
  };

  // validate the stage is renderable (no geometry persisted beyond the recipe itself).
  assembleControllableScene(manifest, {});   // throws if the stage is malformed

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || 'action world', manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${enc}/world`,
    url: `/sketches/${enc}`,
    recipe: manifest,
    stats: {
      entities: props.length,
      idioms: recipe.map((e) => e && e.kind).filter(Boolean),
      hud: Array.isArray(composed.hud) ? composed.hud.map((h) => h.var) : [],
      vars: composed.vars ? Object.keys(composed.vars) : [],
      walk: !!navWalk,
      nonBakeable: true,
    },
  };
}

export async function createActionWorldHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_action_world requires a recipe object');
  const { title, entities, idioms, events, faces, ground, walk, worldFraming, viewBox, bg, ref, folder_ref: folderRef } = input;
  return mintActionWorld({ title, entities, idioms, events, faces, ground, walk, worldFraming, viewBox, bg, ref, folderRef });
}
