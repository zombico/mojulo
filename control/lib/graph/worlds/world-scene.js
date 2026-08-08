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
import { collectFaceTextures } from '@/lib/graph/landscape/surface-textures';
import { resolveFaceMaterials, weatherRigParts } from '@/lib/graph/materials/procedural-material';
import { synthesizeLevel, mergeEventManifests } from '@/lib/graph/game/level-synth';
import { lowerGlyphBodies } from '@/lib/graph/game/glyph-forms';

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

  // ?livery=<shelf name> (z-series assembler units — the arena hangar's swatch row): repaint
  // the stored unit onto another shelf livery BEFORE assembly. Deterministic (a pure tint
  // remap through the baseline anchors), so the /world HTML cache keys on it like any flag.
  let manifest = sketch.manifest;
  if (viewOpts.livery && kind === 'assembler') {
    // engine→mobile-suit seam: the shelf lives in the content pack — absent, serve the base world
    try {
      const { reliveryZSeries } = await import('../mobile-suit/z-series-livery.js');
      manifest = reliveryZSeries(manifest, { to: viewOpts.livery }).manifest;
    } catch (err) { console.error('mobile-suit pack absent — ?livery ignored:', err?.message); }
  }

  const desc = WORLD_KINDS[kind] ?? ROOM_FALLBACK;
  const ctx = {
    title: sketch.title || sketch.manifest.title || desc.title,
    time,
    sky,
    groundShadows,
    view: viewOpts.view,
    render: viewOpts.render,
    ref: sketch.ref,
  };
  const payload = await desc.resolve(manifest, ctx);

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

  // generic, opt-in procedural VERTEX-COLOUR MATERIALS (materials/procedural-material.js): any face
  // carrying `material: '<preset>'` (or `{ kind, grid?, tint?, wear?, cloud?, seed? }`) is tessellated
  // and vertex-coloured through the layered material system (top-lit ramp + brushed cloud + weathering)
  // — the texture-free Wii-era metal look. Runs BEFORE the AO bake and texture collection so those
  // channels see the expanded faces. Absent `material` on every face ⇒ the list is returned untouched.
  if (payload && Array.isArray(payload.faces) && payload.faces.length) {
    payload.faces = resolveFaceMaterials(payload.faces);
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

  // generic, opt-in page BACKDROP image: `backdrop: '<url>'` on any mesh-world manifest paints
  // the image behind a TRANSPARENT canvas (emitThreeWorld gates the alpha + CSS on it), so the
  // world's solids composite over the photo — the hangar-bay read. Pure presentation; absent →
  // the emitted page is byte-identical.
  if (payload && typeof sketch.manifest.backdrop === 'string' && sketch.manifest.backdrop.trim()) {
    payload.backdrop = sketch.manifest.backdrop.trim();
  }

  // generic, opt-in face TEXTURES: any mesh world whose faces opt into a surface via
  // `texture: '<key>'` (+ per-corner `uv`) gets the { key: dataURL } map built here — procedural
  // surface-textures.js tiles (soils, grasses, concrete, stone, …) resolved by collectFaceTextures,
  // merged over any assembler-set payload.textures (e.g. the workbench label-wraps) and any explicit
  // manifest.textures (custom dataURL / an image-worker bound PNG). emitThreeWorld + facesToGlb read
  // payload.textures. Additive: a face list with no `texture` opt-ins leaves the payload untouched.
  if (payload && Array.isArray(payload.faces) && payload.faces.length) {
    const textures = collectFaceTextures(payload.faces, { ...(payload.textures || {}) });
    const manifestTex = sketch.manifest.textures;
    if (manifestTex && typeof manifestTex === 'object') {
      for (const [k, v] of Object.entries(manifestTex)) if (typeof v === 'string') textures[k] = v;
    }
    if (Object.keys(textures).length) payload.textures = textures;
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
  // MECHANIC DECORATION (game-ui-language.plan.md, U5): a level declared purely as `game.mechanics`
  // gets its default UI-language dressing here — glyph pickup/exit bodies + fx float/burst + sfx
  // sparkle/aura — merged into the manifest BEFORE the entities/glyph/fx/sfx lowering below, so a
  // verbs-only level renders legible + juicy with zero styling. Default-ON; `game.decorate:false`
  // opts out; hand-authored entities/fx/sfx compose on top. The decoration's bus reactions + the
  // set of mechanic markers it replaces are applied to the mechanics events further down.
  let decorReactions = null;
  let decorSuppress = null;
  if (payload && sketch.manifest.game && Array.isArray(sketch.manifest.game.mechanics)
      && sketch.manifest.game.mechanics.length && sketch.manifest.game.decorate !== false) {
    const { decorateMechanics, mergeDecorFx } = await import('@/lib/graph/game/mechanic-decor');
    const decor = decorateMechanics(sketch.manifest.game.mechanics);
    decorReactions = decor.reactions;
    decorSuppress = new Set(decor.suppress);
    const m = sketch.manifest;
    sketch = { ...sketch, manifest: {
      ...m,
      entities: [...(Array.isArray(m.entities) ? m.entities : []), ...decor.entities],
      fx: mergeDecorFx(m.fx, decor.fx),
      sfx: [...(Array.isArray(m.sfx) ? m.sfx : []), ...decor.sfx],
    } };
  }

  // shadows: any world can opt in, entity-bearing or not. `shadows: true / { r, alpha, fade,
  // occlude, … }` is the suit contact-blob decal (controllable worlds — a soft down-probed pool
  // under every rig-figure body, the landing tell). `shadows: { cast: true, alpha?, span?,
  // mapSize?, toLight? }` is the scene-level CAST-SHADOW channel: real shadow-map silhouettes
  // off every opaque mass and figure (static masses, walkers, controllable bodies), light keyed
  // to the payload's baked sun when one exists. Opt-in; absent ⇒ byte-identical.
  if (payload && sketch.manifest.shadows) payload.shadows = sketch.manifest.shadows;
  if (payload && Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.length) {
    payload.entities = sketch.manifest.entities;
    if (sketch.manifest.camera && sketch.manifest.camera.rule) payload.camera = sketch.manifest.camera;
    // suit switcher: `pilot` names the initially-piloted `pilotable` entity (default: the first one)
    if (typeof sketch.manifest.pilot === 'string') payload.pilot = sketch.manifest.pilot;
    // spectate (ai-battle-spectator.plan.md): NO pilot — the whole cast runs its ai brain and the
    // operator watches from a glide/follow spectator camera (WASD free-fly, Tab cycles the watched
    // fighter). Opt-in; absent ⇒ the world seats a pilot as before (byte-identical).
    if (sketch.manifest.spectate === true) payload.spectate = true;
    // AI-attack switch: `ai:'off'` loads the world passive (ai-ambient suits stand down until the
    // G / HUD toggle wakes them); absent ⇒ authored ai runs from load.
    if (typeof sketch.manifest.ai === 'string') payload.ai = sketch.manifest.ai;
    // lateral blocking: analytic AABB colliders (the invisible collision hull under the visual
    // faces) — the platform rule ejects the suit's footprint from them. See mobile-suit-city.plan.md.
    if (Array.isArray(sketch.manifest.colliders) && sketch.manifest.colliders.length) payload.colliders = sketch.manifest.colliders;
    // hangar (mobile-suit-hangar.plan.md P2): the non-combat suit-stepper menu — an ordered list of
    // display-entity suits { id, name } the emitted controllable runtime cycles (◀/▶). Opt-in; absent
    // ⇒ no menu emitted (byte-identical).
    if (sketch.manifest.hangar && typeof sketch.manifest.hangar === 'object') payload.hangar = sketch.manifest.hangar;
    // match (mobile-suit-arena.plan.md M1): the scored-bout layer — kills credited, respawns, first
    // to killTarget wins (scoreboard + result HUD in the emitted runtime). Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.match && typeof sketch.manifest.match === 'object') payload.match = sketch.manifest.match;
    // projectile smoke: pooled billow-sprite puffs on the bazooka/grenade fire trail + a seeded
    // rolling cloud at each detonation, read off the engine's projectiles/bursts records. `true`
    // or a tuning object { max, spacing, alpha, burstCount, trailTint, burstTint }. Opt-in;
    // absent ⇒ byte-identical (the smoke-test experiment map is the first consumer).
    if (sketch.manifest.smoke) payload.smoke = sketch.manifest.smoke;
    // wreck finisher (dev-rules sequence): a destroyed suit's death burst is DEFERRED until its
    // topple fall settles, then the wreck DETONATES (staggering + smoking) and VANISHES — fall →
    // boom → gone, instead of the instant blast that leaves a persistent wreck. `true` or a tuning
    // object { delay } (seconds the settled wreck lingers before it blows). Non-match worlds only
    // (a match owns its own corpse-window → respawn lifecycle). Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.wreckExplodes) payload.wreckExplodes = sketch.manifest.wreckExplodes;
    payload.nonBakeable = true;
    const figs = sketch.manifest.figures;
    if (figs && typeof figs === 'object') {
      payload.figures = {};
      for (const [name, rawSpec] of Object.entries(figs)) {
        if (!rawSpec || typeof rawSpec !== 'object') continue;
        // figureRef (figure-emotes.plan.md): a figures-map entry may reference a STORED
        // kind:'figure' sketch instead of re-declaring the body — the entry inherits the
        // recipe's pose/proto/garment/motion and its own fields override. This is how a
        // figure minted once via create_figure is re-used across scenes; the world manifest
        // stays a tiny recipe (only the ref persists — resolution happens here at bake time).
        // vehicleRef (drivable-vehicles.plan.md D4): a figures-map entry may reference a stored
        // ASSEMBLER vehicle build — the vehicle rig derives from its veh-* garage blocks
        // (vehicle-designer/vehicle-rig.js: root + four wheel bones classified against the
        // chassis's axle sockets) and bakes as rig delivery with the single distance-true `roll`
        // clip, so the existing figure-rig body path renders it unchanged. EXPLICIT beside
        // unitRef — a car is not a biped; unitRef stays biped-only.
        if (typeof rawSpec.vehicleRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.vehicleRef);
          if (!src || src.manifest?.kind !== 'assembler') {
            throw new Error(`figures.${name}: vehicleRef '${rawSpec.vehicleRef}' is not a stored assembler build`);
          }
          const { bakeVehicleRig } = await import('@/lib/graph/vehicle-designer/vehicle-rig.js');
          payload.figures[name] = bakeVehicleRig(src.manifest, {
            keys: rawSpec.keys || 12,
            targetH: Number.isFinite(rawSpec.targetH) ? rawSpec.targetH : null,
          });
          continue;
        }
        // unitRef (mobile-suit-builder.plan.md R3): a figures-map entry may
        // reference a stored ASSEMBLER unit — the biped rig derives from its
        // stations (unit-pose.js) and the body bakes as rig delivery only
        // (unit-rig.js): a suit is rigid parts by construction, and frame
        // stacks at unit face counts would dwarf the payload ceiling.
        if (typeof rawSpec.unitRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.unitRef);
          if (!src || src.manifest?.kind !== 'assembler') {
            throw new Error(`figures.${name}: unitRef '${rawSpec.unitRef}' is not a stored assembler unit`);
          }
          const { bakeUnitRig } = await import('@/lib/graph/worlds/unit-rig.js');
          const baked = bakeUnitRig(src.manifest, {
            keys: rawSpec.keys || 12,
            targetH: Number.isFinite(rawSpec.targetH) ? rawSpec.targetH : null,
            frame: rawSpec.frame === true || (rawSpec.frame && typeof rawSpec.frame === 'object') ? rawSpec.frame : false,
            // frameOnly (skinless read): bake JUST the generated inner frame — the
            // stick figure of the derived rig — with none of the suit's armor, so
            // the walk (and every clip) can be examined without any livery. Same
            // bones/clips/grounding as a full bake; only the skin is stripped.
            frameOnly: rawSpec.frameOnly === true || (rawSpec.frameOnly && typeof rawSpec.frameOnly === 'object') ? rawSpec.frameOnly : false,
            // pose (posing studio): hold one authored DOF static instead of the gait, so a
            // clock world freezes the suit in it — the clean surface for posing from scratch.
            pose: rawSpec.pose && typeof rawSpec.pose === 'object' ? rawSpec.pose : null,
            // aim (armed walkers): an arm-dof object locks the arms — and any
            // weapon station rigid with them — into a stabilized hold through
            // every clip (unit-rig.js aimLockClips).
            aim: rawSpec.aim && typeof rawSpec.aim === 'object' ? rawSpec.aim : null,
            // aimArms (per-arm lock mode): hold ONE arm on the aim while the other
            // swings with the gait (geof: left vulcan hand held, right sword hand
            // free). A string or { L, R } of 'lock'|'hold'|'free'; absent → both lock.
            aimArms: (rawSpec.aimArms && typeof rawSpec.aimArms === 'object') || typeof rawSpec.aimArms === 'string' ? rawSpec.aimArms : null,
            // swings (melee): pack swing-shelf names (mobile-suit/unit-swings.js) baked as unlocked swing_<name>
            // clips beside the aim-locked gait — the strike verbs.
            swings: Array.isArray(rawSpec.swings) ? rawSpec.swings : null,
            // dodges (acrobatic dodge): DODGE_POSES names baked as unlocked
            // maneuver clips beside the gait — the tuck/pike/spin tumble shapes.
            dodges: Array.isArray(rawSpec.dodges) ? rawSpec.dodges : null,
            // space (R18, the second play mode): swap the ground gait clips for
            // thrust poses + add ascend/descend, so a floating suit thrusts
            // instead of walking (pairs with the platform rule's `space:true`).
            space: rawSpec.space === true,
            // weldOffHand (left-arm control spike): weld the LEFT (off-hand) arm to
            // the chest so it holds a constant shape and turns only with the torso,
            // instead of being posed by shL/elbowL/aim/injection.
            weldOffHand: rawSpec.weldOffHand === true,
            // material (specular finish): a uniform clear-coat over every body panel so
            // the suit catches a live highlight (material-response specular channel). A
            // material-shelf ref (preset name / '#hex' / object). Diffuse-preserving, so
            // only the highlight is added; absent → byte-identical. Role-differentiated
            // finishes come from re-minting through the g/z livery `material:true`.
            material: rawSpec.material != null ? rawSpec.material : null,
            // contrast (ms-contrast.plan.md SPIKE): opt-in role-based material-contrast
            // treatment (value separation + finishes + rim). No game world sets this
            // until the treatment passes its eyes gate; absent → byte-identical.
            contrast: rawSpec.contrast != null ? rawSpec.contrast : null,
          });
          // previewClip (eyes-gate): alias a baked maneuver clip onto `forward`
          // so an ambient clock world HOLDS that pose — the dodge shapes are
          // static, so the clock just displays them. Resolve-time only; the
          // emitted page bytes are unchanged (no char re-pin), and worlds that
          // don't set it are byte-identical.
          if (typeof rawSpec.previewClip === 'string' && baked.clips[rawSpec.previewClip]) {
            baked.clips = { ...baked.clips, forward: baked.clips[rawSpec.previewClip] };
          }
          payload.figures[name] = baked;
          continue;
        }
        // polygomerRef (platformer.plan.md P2): a figures-map entry may reference a stored
        // kind:'manji-tree' POLYGOMER (a dreamed creature/object). It bakes to a STATIC face mesh —
        // no gait clips: a polygomer has no rig and animates by squash/stretch (driven in the
        // renderer off the platform rule's grounded/jumped/landed edges). This is how a round,
        // Kirby-style dreamed hero becomes a walking entity body. The world manifest stays a ref.
        if (typeof rawSpec.polygomerRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.polygomerRef);
          if (!src || src.manifest?.kind !== 'manji-tree') {
            throw new Error(`figures.${name}: polygomerRef '${rawSpec.polygomerRef}' is not a stored manji-tree polygomer`);
          }
          const { resolveManjiTreeLathes } = await import('@/lib/graph/worlds/polygomer-world.js');
          const { lowerObjectFaces, WORKBENCH_LIGHT } = await import('@/lib/graph/worlds/workbench.js');
          payload.figures[name] = { polygomer: true, faces: lowerObjectFaces({ lathes: resolveManjiTreeLathes(src.manifest) }, WORKBENCH_LIGHT) };
          continue;
        }
        let spec = rawSpec;
        if (typeof rawSpec.figureRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.figureRef);
          if (!src || src.manifest?.kind !== 'figure') {
            throw new Error(`figures.${name}: figureRef '${rawSpec.figureRef}' is not a stored figure sketch`);
          }
          const { figureRef, ...own } = rawSpec;
          const m = src.manifest;
          spec = {
            ...(m.pose ? { pose: m.pose } : {}),
            ...(m.proto ? { proto: m.proto } : {}),
            ...(m.garment ? { garment: m.garment } : {}),
            ...(m.motion ? { motion: m.motion } : {}),
            ...own,
          };
        }
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
    // GLYPH bodies (game-ui-language.plan.md, U1): body:{type:'glyph', form, tint?, scale?}
    // lowers here to a single-frame figure-frames body + a generated `glyph:<form>` clip — the
    // form shelf addressable by name, no emitter changes. No glyph bodies ⇒ payload untouched.
    const glyphLowered = lowerGlyphBodies(payload.entities, payload.figures);
    if (glyphLowered) {
      payload.entities = glyphLowered.entities;
      payload.figures = glyphLowered.figures;
    }
  }

  // generic, opt-in figure WEATHERING (materials/procedural-material.js `weatherRigParts`): the suit
  // analog of the face `material` channel. `weathering: true` (or `{ amt, seed }`) modulates every rig
  // figure's baked per-vertex colour buffers by the rust/grime field — livery colours stay the base,
  // weathering reads on top. Runs AFTER figures are baked (parts exist). Absent ⇒ figures untouched.
  if (payload && sketch.manifest.weathering && payload.figures && typeof payload.figures === 'object') {
    const w = sketch.manifest.weathering;
    const opts = w && typeof w === 'object' ? w : {};
    for (const key of Object.keys(payload.figures)) {
      const fig = payload.figures[key];
      if (fig && Array.isArray(fig.parts)) weatherRigParts(fig.parts, opts);
    }
  }

  // fx channel (game-ui-language.plan.md, U2): standing states + one-shot gestures on entities by
  // id. The stored /world path threads it here (emitThreeWorld reads `fx` from `...payload`); absent
  // ⇒ untouched. Carries hand-authored fx AND the U5 mechanic decoration merged above.
  if (payload && sketch.manifest.fx && typeof sketch.manifest.fx === 'object') {
    payload.fx = sketch.manifest.fx;
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
    // U5 decoration: drop the box markers the glyphs replaced, and add the per-pickup burst signal
    // reactions — so the decoration's fx.on bindings (above) fire on collect.
    if (mechEvents && decorSuppress && decorSuppress.size && Array.isArray(mechEvents.entities)) {
      mechEvents.entities = mechEvents.entities.filter((e) => !(e && decorSuppress.has(e.id)));
    }
    if (mechEvents && decorReactions && decorReactions.length) {
      mechEvents.reactions = [...(Array.isArray(mechEvents.reactions) ? mechEvents.reactions : []), ...decorReactions];
    }
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

  // SFX channel (game-ui-language.plan.md §V — geometry sfx backend, 2026-07-08). A manifest
  // `sfx: [{ verb, at:[x,y,z] | on:'<entityId>', color?, rate?, size?, params? }]` renders the "juice"
  // verb shelf (sparkle / heal / ward / aura / beacon / …) as ADDITIVE SPRITES — one sprite per bead,
  // moved each frame along the verb's path — NOT a fullscreen raymarch overlay (the overlay was
  // retired for game sfx: perf drain too severe). An `on` id resolves to that entity's transform.pos;
  // deferred verbs (kokusen/ssj-aura, which absorb light) drop. Absent ⇒ payload untouched.
  if (payload && Array.isArray(sketch.manifest.sfx) && sketch.manifest.sfx.length) {
    const { resolveSpriteSfxLayers } = await import('@/lib/graph/game/glyph-sfx-sprites');
    const layers = resolveSpriteSfxLayers(sketch.manifest.sfx, sketch.manifest.entities);
    if (layers.length) payload.spriteSfx = layers;
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
