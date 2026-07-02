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
import { registerTool } from '@/lib/mcp/server';
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

export function registerActionWorldTools() {
  registerTool({
    name: 'create_action_world',
    description:
      "Mint a LIVE world where THINGS HAPPEN with consequence — a GAME or an interactive scene with "
      + "RULES (moles that pop, shots that score, a timed round that ends, items you collect). The "
      + "sibling of create_controllable_world: that mints a world you MOVE through; this mints one that "
      + "PLAYS BACK. Stores ONLY a tiny recipe (`kind:'controllable'` + `events` + `walk`); the world "
      + "regenerates deterministically on render at `/api/sketches/<ref>/world` (open it / embed it). "
      + "Reach for framing like 'make a game where…', 'a shooting range / whack-a-mole', 'a scene with "
      + "a score and a timer', 'things that pop up and you click them', 'a coin-pickup level'. NOT for "
      + "a world you just drive a character through with no rules — that's create_controllable_world.\n\n"
      + "RULES are a declarative IDIOM RECIPE (`idioms`), each `{ kind, ...params }`, lowered to the "
      + "in-world event bus server-side. Idiom kinds:\n"
      + "• `scoreCounter` { name, label } — a tracker var shown on the HUD.\n"
      + "• `countdownClock` { var, from, onZero?, gate?, label? } — a var counting down 1/sec, fires "
      + "`onZero` (default 'game-over') at zero.\n"
      + "• `gameOverFreeze` { signal?, gate?, banner?, clear? } — on the signal, freeze every gated "
      + "timer and clear (toggle off) the listed entity ids.\n"
      + "• `spawnOnHeartbeat` { targets:[ids], periods:[secs], field?, rise?, gate? } — each target "
      + "pops on its own cadence (rise:false to only emit the pop, pairing with ephemeralTarget).\n"
      + "• `ephemeralTarget` { on?, ttl, field? } — a target appears, lives ttl seconds, disappears "
      + "(one independent timeline per target).\n"
      + "• `deed` { on:'pick'|'key'|'drag', emit, effects:[reactions] } — bind an input to an event + "
      + "its effects (cursor-pick games).\n"
      + "• `hitConfirm` { on?, emit?, score?, drop?, marker? } — the laser deed: a camera-forward "
      + "raycast (`fire` input) confirmed into a score + the hit target dropping.\n"
      + "• `onContact` { a?, b?, ...verb } / `pickup` { item, by, score } / `onRest` { body, ...verb } "
      + "— turn physics contact/rest FACTS into meaning (need a `physics` world; pickup = coin/pot).\n\n"
      + "`entities` are the BUS PROPS the rules act on: `[{ id, on?, color?, radius?, position:[x,y,z] }]` "
      + "(e.g. the spheres a heartbeat pops and a hit drops). `faces` is the bespoke stage geometry "
      + "(walls become walk-colliders AND shot-occluders); omit for a default floor. `walk` defaults "
      + "true (WASD first-person — set false for an orbit-only scene). Because input makes it "
      + "path-dependent the world is non-bakeable (/svg + /scene show only frame zero; /world is live).",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        idioms: {
          type: 'array',
          description: "The RULES, as a recipe of idioms. Each: { kind, ...params }. Kinds: scoreCounter, countdownClock, gameOverFreeze, spawnOnHeartbeat, ephemeralTarget, deed, hitConfirm, onContact, pickup, onRest (see the tool description for each idiom's params). Lowered to the event bus and composed server-side; a var declared by two idioms is an authoring error.",
          items: { type: 'object' },
        },
        entities: {
          type: 'array',
          description: "The BUS PROPS the rules act on (the stateful things, not a driven character). Each: { id, on?:boolean (starts hidden if false), color?, radius?, position?:[x,y,z] }. Idiom params reference these by id (e.g. spawnOnHeartbeat.targets, gameOverFreeze.clear).",
          items: { type: 'object' },
        },
        events: { type: 'object', description: 'Advanced escape hatch: a raw event-bus fragment ({ vars, timers, reactions, watches, inputs, hud, sources, sequences, initial }) merged through compose() alongside the idioms. Prefer `idioms` — reach for this only for a rule no idiom covers.' },
        faces: { type: 'array', description: 'Bespoke stage geometry as baked face quads ({ corners:[[x,y,z]×4], fill, doubleSided? }). Walls/obstacles become scene solids: they block walking AND occlude shots. Omit for a default checker floor (see `ground`).', items: { type: 'object' } },
        ground: { type: 'object', description: 'Default-floor spec when `faces` is omitted: { size, cell, colorA, colorB }. A 2-tone checker plane at z=0.' },
        walk: { description: 'First-person WASD navigation. Defaults to true (action worlds are moved through). Set false for an orbit-only scene, or pass a config object.' },
        worldFraming: { type: 'object', description: 'Initial camera framing { cameraPosition:[x,y,z], lookAt:[x,y,z], horizontalFov }.' },
        viewBox: { type: 'object', description: 'Render viewBox { width, height } (default 1120×780).' },
        bg: { type: 'string', description: 'Background color (default #0b1220).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createActionWorldHandler,
  });
}
