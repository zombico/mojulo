/**
 * world-scene — the single kind → `assemble*Scene` dispatch seam.
 *
 * A stored sketch manifest is a tiny RECIPE; the full traversable-World geometry is
 * regenerated deterministically by the per-kind assembler. Both the live World route
 * (/api/sketches/[ref]/world → emitThreeWorld) and the .glb export route
 * (/api/sketches/[ref]/model.glb → facesToGlb) resolve the SAME payload here, so the
 * downloadable mesh always matches the rendered World.
 *
 * Per-kind knowledge (assembler, default title, calling convention, walk/fog capability)
 * lives in ONE place: the WORLD_KINDS registry (world-kinds.js) — adding a new world kind
 * is one table row there, and keeps both surfaces in sync. This file owns what is generic
 * across kinds: context normalization, the registry lookup + room fallback, and the opt-in
 * channel layering (ao / repeats / motion / signage / physics / controllable / events /
 * walk / fog / audio) below.
 *
 * `resolveWorldScene` returns `{ payload, kind }` where `payload` is null for any kind
 * with no traversable form (the caller then points the user back at /scene or /svg).
 */

import { resolveMotionMovers } from '@/lib/graph/worlds/motion-vocabulary';
import { resolveSignage } from '@/lib/graph/scene/signage-chrome';
import { resolveSceneLighting } from '@/lib/graph/scene/scene-css3d';
import { composeVolumeFog } from '@/lib/graph/effects/effects-fog';
import { resolveWorldAudio } from '@/lib/graph/beats/beats-world';
import { composeLandscapeRaymarch } from '@/lib/graph/landscape/painted-landscape-raymarch';
import { renderFigureWorldFrames } from '@/lib/graph/polygonizer/figure-render';
import { WORLD_KINDS, ROOM_FALLBACK, resolveWrapTextures } from '@/lib/graph/worlds/world-kinds';
import { synthesizeLevel, mergeEventManifests } from '@/lib/graph/game/level-synth';

export { resolveWrapTextures };

// Spatial ("moved through") kinds get first-person traverse on by default; the object-study /
// orbit-only kinds (workbench, vehicle-instance, planetary) are intentionally absent. Derived
// from the registry's per-kind `walk` flags (+ the room fallback), so the /world route's
// `payload.walk || WALK_KINDS.has(kind)` semantics are untouched by the registry refactor.
export const WALK_KINDS = new Set([
  ...Object.keys(WORLD_KINDS).filter((k) => WORLD_KINDS[k].walk),
  ...(ROOM_FALLBACK.walk ? ['room'] : []),
]);

/**
 * resolveWorldScene(sketch) → { payload, kind }
 *
 * Regenerates the traversable-World payload for a stored sketch via its per-kind
 * assembler. `payload` is null when the kind has no World form (the assembleRoomScene
 * fallback returns null for any non-room manifest). Async because the workbench path
 * resolves label-wrap textures (which may render referenced sketches to SVG).
 */
export async function resolveWorldScene(sketch, viewOpts = {}) {
  // declarative scene lighting — same normalization the /scene route uses.
  const scene = sketch.manifest.scene && typeof sketch.manifest.scene === 'object' ? sketch.manifest.scene : {};
  const time = sketch.manifest.time ?? scene.time;
  const sky = sketch.manifest.sky ?? scene.sky;
  // opt-in per-building ground shadows (off unless the manifest asks). `true` for the default
  // look, or an object `{ strength, length, maxAlpha, max }` to tune the cast.
  const groundShadows = sketch.manifest.groundShadows ?? scene.groundShadows ?? false;
  const kind = sketch.manifest.kind;

  const desc = WORLD_KINDS[kind] ?? ROOM_FALLBACK;
  const ctx = {
    title: sketch.title || sketch.manifest.title || desc.title,
    time,
    sky,
    groundShadows,
    view: viewOpts.view,
    render: viewOpts.render,
  };
  const payload = await desc.resolve(sketch.manifest, ctx);

  // opt-in RAYMARCH backend for painted-landscape (?render=raymarch): a per-pixel terrain/water/sky
  // render (painted-landscape-raymarch.js) instead of the polygon mesh. emitThreeWorld dispatches a
  // `raymarch` payload to emitRaymarchWorld (same path black-hole-view uses), so we swap the whole
  // payload and return early — the mesh channels (motion/signage/walk/…) don't apply to a shader world.
  if (payload && kind === 'painted-landscape' && viewOpts.render === 'raymarch') {
    try {
      const raymarch = composeLandscapeRaymarch(sketch.manifest);
      return { payload: { raymarch, viewBox: payload.viewBox || { width: 1120, height: 780 }, bg: payload.bg || '#9fb6c8', title: payload.title || ctx.title }, kind };
    } catch {
      // an unsupportable recipe (should not happen — both engines port) falls back to the mesh world.
    }
  }

  // generic, opt-in baked AMBIENT OCCLUSION (renderer-ladder.plan.md / P1): any mesh world may set
  // `ao: true` (or a tuning object: { strength, radius, steps }) to darken corners, crevices, and
  // contact junctions — a second baked lighting term beside the Lambert solve, sampled against the
  // world's OWN faces (no per-kind occluder extractor needed). Carried as a payload setting, not a
  // face mutation: the bake must run AFTER facade-card expansion (a card's sub-faces don't exist
  // yet here), so emitThreeWorld and facesToGlb apply effects/ao-bake.js to their expanded face
  // list and faceListToMesh folds the per-corner `vao` into the vertex colours. Every consumer
  // (live /world, PNG/MP4 bakes, .glb export) inherits it. Interior kinds default it ON via
  // their registry descriptor's `ao` field (renderer-convergence 1c) — a manifest `ao: false`
  // always wins. Otherwise additive; absent ⇒ untouched.
  const aoSetting = sketch.manifest.ao ?? desc.ao;
  if (payload && aoSetting && Array.isArray(payload.faces) && payload.faces.length) {
    payload.ao = typeof aoSetting === 'object' ? aoSetting : {};
  }

  // generic, opt-in INSTANCED REPEATS (renderer-ladder P4): a manifest may carry `repeats` —
  // [{ template: faces[], transforms: [{pos, rotZ?, scale?, tint?}], group? }] — repeated
  // geometry stored once and stamped N times. emitThreeWorld lowers each entry to an
  // InstancedMesh (instances collide/occlude like real geometry); facesToGlb lowers to one
  // shared mesh + N thin nodes. Kind assemblers may also set payload.repeats natively (the
  // fractal-city/condo generators are the intended adopters); the manifest channel is additive
  // and never overrides an assembler's own.
  if (payload && !payload.repeats && Array.isArray(sketch.manifest.repeats) && sketch.manifest.repeats.length) {
    payload.repeats = sketch.manifest.repeats;
  }

  // generic, opt-in MOTION layer: ANY world may carry a `motion` spec — a list of motion-vocabulary
  // rules (ballistic arc, pendulum, spring, …) placed into the scene at a position/scale. Resolved here
  // so every kind gains it uniformly, and appended to the mover channel the renderer already animates.
  // Purely additive — absent `motion` (the common case) leaves every existing payload untouched.
  if (payload && Array.isArray(sketch.manifest.motion) && sketch.manifest.motion.length) {
    const placed = resolveMotionMovers(sketch.manifest.motion);
    if (placed.length) payload.movers = [...(payload.movers || []), ...placed];
  }

  // generic, opt-in adaptive-signage layer (the same channel the /scene + /svg backends read).
  // Chrome is derived from the World's own palette so notes match the scene's visual language.
  // { object } anchors are left unresolved here and bound to a mesh by render-group name at render
  // time (emitThreeWorld's signage channel). Absent `signage` leaves the payload untouched.
  if (payload && Array.isArray(sketch.manifest.signage) && sketch.manifest.signage.length) {
    const { lighting } = resolveSceneLighting(sketch.manifest);
    payload.signs = resolveSignage(sketch.manifest.signage, {
      palette: {
        bg: payload.bg,
        sky: payload.sky ?? lighting?.sky,
        tint: lighting?.tint,
        ambient: lighting?.vexar?.ambient,
        lamps: lighting?.lamps,
        mood: sketch.manifest.time === 'night' ? 'night' : undefined,
      },
    });
  }

  // generic, opt-in PHYSICS property (actions-world.plan.md): ANY world may carry a `physics` block
  // (gravity + bodies with mass/restitution/friction/velocity). It is the only LIVE, non-deterministic
  // channel — the browser runs the integrator rather than replaying a baked path — so a world carrying
  // it is flagged `nonBakeable`. The flag is INFORMATIONAL where surfaces cannot run live
  // channels: /svg + /scene degrade to frame zero structurally (they never see this payload),
  // the scene-* MCP tools surface it in their result stats, and /model.glb records the
  // degradation as an X-Mojulo-Degraded response header (renderer-emitter.plan.md E4).
  // Purely additive — absent `physics` leaves every existing payload untouched.
  if (payload && sketch.manifest.physics && Array.isArray(sketch.manifest.physics.bodies) && sketch.manifest.physics.bodies.length) {
    payload.physics = sketch.manifest.physics;
    payload.nonBakeable = true;
    // the ACTIONS channel (input → impulse) rides alongside physics — same live tier.
    if (Array.isArray(sketch.manifest.actions) && sketch.manifest.actions.length) {
      payload.actions = sketch.manifest.actions;
    }
  }

  // generic, opt-in CONTROLLABLE channel (controllable-world.plan.md): a manifest may carry `entities`
  // (transform + rule + body) and a `camera` spec — the unified "control a thing in a world" primitive
  // (walk/glide/follow/clock). It rides ON TOP of any recognized world kind (a figure walking a stored
  // city, a drone over a room), so it is gated on an existing `payload`. Input-driven ⇒ `nonBakeable`.
  // `figure-frames` bodies reference a baked-at-resolve-time figure: manifest.figures is a map of
  // name → renderFigureWorldFrames spec ({ motion, proto, frames? }); we bake each here so the stored
  // manifest stays a tiny recipe (no packed geometry persisted), matching the rest of the substrate.
  if (payload && Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.length) {
    payload.entities = sketch.manifest.entities;
    if (sketch.manifest.camera && sketch.manifest.camera.rule) payload.camera = sketch.manifest.camera;
    payload.nonBakeable = true;
    const figs = sketch.manifest.figures;
    if (figs && typeof figs === 'object') {
      payload.figures = {};
      for (const [name, spec] of Object.entries(figs)) {
        if (!spec || typeof spec !== 'object') continue;
        // RIG delivery (renderer-ladder P2 rung 2): `delivery:'rig'` bakes pose CURVES + rigid
        // parts (rig-bake.js) instead of frame stacks — orders of magnitude smaller, continuous
        // poses, head-look-at capable. `asset:'megaboy'` routes to the FK builder; anything
        // else is the protoform pipeline. Default (no delivery field) stays figure-frames.
        if (spec.delivery === 'rig') {
          const { bakeMegaBoyRig, bakeProtoformRig } = await import('@/lib/graph/figures/rig-bake.js');
          payload.figures[name] = spec.asset === 'megaboy'
            ? await bakeMegaBoyRig({ keys: spec.keys || 8 })
            : await bakeProtoformRig({ proto: spec.proto, garment: spec.garment, keys: spec.keys || 8, motion: spec.motion || 'walk' });
        } else {
          payload.figures[name] = renderFigureWorldFrames(spec, spec.frames || 24).frames;
        }
      }
    }
  }

  // MECHANICS lowering (game-mechanics.plan.md, M1): if the level's `game` channel declares
  // `mechanics` (+ an optional `fall` policy), lower them ONCE here — into an events fragment
  // (zones/reactions/watches/timers/hud/vars, onto the M0-pre zone fact source) merged into the
  // manifest's own events, and into synthesized contract fragments (produces/on/consumes/audits)
  // merged into the game channel below. The author declares verbs; the plumbing is generated. The
  // store isn't known at level-resolve, so mechanics NAME their slices (into:'bag'); create_game
  // re-validates the synthesized contract against the game's actual store. Deterministic + pure.
  let mechEvents = null;
  if (payload && sketch.manifest.game && Array.isArray(sketch.manifest.game.mechanics) && sketch.manifest.game.mechanics.length) {
    const synth = synthesizeLevel(sketch.manifest);   // lower mechanics → events + synthesized contract
    mechEvents = synth.mechEvents;
    // stash the synthesized contract onto a working copy of the game channel for the block below
    sketch = { ...sketch, manifest: { ...sketch.manifest, game: synth.game } };
  }

  // generic, opt-in EVENTS channel (event-bus.plan.md): the in-world bus. A manifest may carry an
  // `events` block ({ sources, reactions, sequences, initial, entities }) — declarative reactions
  // that turn physics FACTS (contact/rest) and timers into meaning (spawn/toggle/move/emit), and
  // reach back into physics via the 5b bridge. It rides on top of any kind (typically alongside
  // `physics`), so it is gated on an existing payload. Present (reactions or sequences) ⇒ a LIVE
  // channel the static stills can't run, so `nonBakeable` (the /svg + /scene degrade to frame zero).
  // Mechanics-lowered events (mechEvents) merge in here so the one bus runs both.
  const ev = payload && mergeEventManifests(sketch.manifest.events, mechEvents);
  if (ev && ((Array.isArray(ev.reactions) && ev.reactions.length) || (Array.isArray(ev.sequences) && ev.sequences.length))) {
    payload.events = ev;
    payload.nonBakeable = true;
  }

  // generic, opt-in WALK camera: any world may set `walk: true` (or a config object) to offer the
  // emitThreeWorld first-person Fly/Walk navigation (WASD + pointer-lock look, ground-snap, wall
  // collision against the scene `solids`). Needed by controllable game worlds you move THROUGH — e.g.
  // a laser range. Additive; absent ⇒ orbit only.
  if (payload && sketch.manifest.walk) payload.walk = sketch.manifest.walk;

  // generic, opt-in volumetric FOG (effects-layer.plan.md / P3.5): an outdoor world may set
  // `fog: true` (or a tuning object: { density, height, color, maxDist, ... }) to composite a
  // ground-hugging volumetric fog over the rasterized mesh — a raymarched overlay that clips against
  // the world's solids via a grid-culled scene SDF (see composeVolumeFog + docs/raymarch-effects-layer.md).
  // Only kinds whose registry descriptor declares a `fogBoxes` extractor carry it; it renders ONLY on
  // the live /world (three.js) path — the /svg + /scene stills ignore `payload.fog`. Additive; absent
  // ⇒ no fog.
  if (payload && sketch.manifest.fog && typeof desc.fogBoxes === 'function') {
    const boxes = desc.fogBoxes(sketch.manifest);
    if (boxes && boxes.length) {
      const opts = (sketch.manifest.fog && typeof sketch.manifest.fog === 'object') ? sketch.manifest.fog : {};
      payload.fog = composeVolumeFog(boxes, { up: 'z', ...opts });
    }
  }

  // generic, opt-in AUDIO channel (beats.plan.md): synthesized WebAudio presence — an ambient
  // soundtrack (inline recipe or a stored beats artifact by `beatsRef`, inlined here so the page
  // stays self-contained), bus-event SFX cues, gait footsteps, and wind shaped by the scene's
  // declared time. Renders ONLY on the live /world path (the audio channel is not emitted on
  // capture runs, so muted bakes stay byte-identical); the /svg + /scene stills ignore it.
  // Presentation, not simulation — it reads sim state and never feeds back. Additive; absent ⇒
  // untouched. NOT flagged nonBakeable: audio has no visual frame, so stills stay full-fidelity.
  if (payload && sketch.manifest.audio && typeof sketch.manifest.audio === 'object') {
    const resolvedAudio = resolveWorldAudio(sketch.manifest.audio, { time });
    if (resolvedAudio) payload.audio = resolvedAudio;
  }

  // generic, opt-in GAME channel (game-metacontext.plan.md): the level contract. A manifest may
  // carry `game` ({ levelRef, consumes, produces, presets, on? }) declaring the level's signature —
  // which store slices parameterize it and which typed events its outcome envelope may carry.
  // The emitted page gains the `__mojGame` bridge: params arrive from a hosting game SHELL via
  // versioned postMessage (or fall back to the contract's `presets.default`, so a level with no
  // shell stays playable standalone), and ONE outcome envelope leaves at level end. The store
  // itself lives in the shell/artifact, never here — play data never enters mojulo. Contract
  // faults are authoring errors: fail the mint loudly, not the player. Additive; absent ⇒
  // byte-identical HTML to today. NOT nonBakeable: the contract adds no visual frame, and capture
  // runs keep the bridge (preset-fed, messaging inert) so completability audits can read the
  // envelope from the probe stream.
  if (payload && sketch.manifest.game && typeof sketch.manifest.game === 'object') {
    const { validateLevelContract, normalizeLevelContract } = await import('@/lib/graph/game/level-contract.js');
    const v = validateLevelContract(sketch.manifest.game);
    if (!v.ok) throw new Error(`game channel contract is invalid:\n- ${v.errors.join('\n- ')}`);
    payload.game = normalizeLevelContract(sketch.manifest.game);
  }

  return { payload, kind };
}
