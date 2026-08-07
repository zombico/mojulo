/**
 * forge_motion — the model's means to make a mojulo subject MOVE.
 *
 * A subject that exists in mojulo (a manji-tree sketch, the figure rig, or a
 * terrain world) is put in motion by a camera and rendered to an animated
 * artifact: a self-contained CSS flipbook SVG (durable, plays as <img>) and an
 * animated GIF (zero-dep, via control's bundled sharp/cgif). Motion is an OUTPUT
 * concern — sibling to illustration (create_sketch) and cook, not part of the
 * Bot/Service/App triad. "draw me X" → illustration; "make X move" → motion.
 *
 * The artifact is a RECIPE (subject + shot), so it regenerates deterministically.
 * It is filed as a "Motion Project" resource group, reusing existing primitives
 * rather than a bespoke layer:
 *   - an OPS TAG names the project (the shared tag / the bound),
 *   - a STASH holds the subject pointer + the shot recipe (the durable recipe),
 *   - a MOTION OUTCOME FOLDER holds the rendered motion.svg / motion.gif.
 * The tag binds the stash + the motion so the /motion gallery can surface the
 * whole group (the ops-tag tables are motion's grouping store; the standalone
 * operations deliberation surface was deprecated).
 *
 * Two subject families behind the one door:
 *   - CAMERA motions over a single manji-tree (turntable, orbit, push_in,
 *     dolly_zoom, flythrough) — figure / terrain / scene.
 *   - DECK motion over an ordered set of sketches/charts — the slideshow, for
 *     info transfer that needs no figure/scene animation (chart decks, KPI
 *     walkthroughs, explainers, a report in motion). Spike-validated in
 *     lite-template/integration/0609/spike-output/deck-motion/; design in
 *     motion-charts-and-decks.plan.md. The compositor (flipbook + GIF) is shared;
 *     only the frame source differs (camera-path vs. deck.js).
 * Performance motions (walk / grow / bounce) land later behind the same schema.
 * See lite-template/integration/0609/motion-as-mcp-concern.plan.md.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes/paths';
import {
  renderMotion,
  renderDeckMotion,
  renderWorldMotion,
  renderWorldTraversalMotion,
  encodeGif,
  encodeGifBuffers,
  encodeStitchMp4,
  encodeFramesMp4,
  CAMERA_MOTIONS,
  DECK_MOTIONS,
  MOTION_NAMES,
  DECK_MOTION_NAMES,
  WORLD_MOTION_NAMES,
  isDeckMotion,
  DECK_BG,
} from '@/lib/motion';
import { KIND_SCENE_MOTION, KIND_KEYFRAME_ANIMATION, normalizeImageOutcomesManifest } from '@/lib/graph/image-outcomes/manifest';
import { resolveSceneForge, resolveClipForge } from '@/lib/graph/image-outcomes/scene-forge';
import { clipFrameSelections, compositeCels } from '@/lib/graph/image-outcomes/keyframe-composite';
import { renderSceneFrames } from '@/lib/graph/image-outcomes/keyframe-spike/scene-composite';
import { viewerHtml, worldViewerHtml, stitchViewerHtml } from '@/lib/motion/viewer';
import { composeFlipbook } from '@/lib/motion/flipbook';
import {
  resolvePresentationTheme,
  PRESENTATION_THEME_NAMES,
} from '@/lib/visual-language/themes';
import { renderMaterializeFrames, renderTransfigureFrames } from '@/lib/graph/effects/carved-motion';

// EFFECT motions — the third subject family: phase-driven transitions over carved
// solids (carve's temporal peers). Distinct from CAMERA (manji-tree) and DECK.
const EFFECT_MOTIONS = {
  materialize: 'a carved subject comes into being from nothing (∅→form): hologram draws a wireframe then skin; doom prints through a scan plane; transporter converges particles into the solid. Reverse it (dematerialize) by reading it backwards. Subject: a single carved_solid.',
  transfigure: 'one carved subject BECOMES another (form A→B): Galvatron de-skins to wireframe and re-skins; liquid-metal leaves the beveled carve renderer and morphs through a smooth liquid carrier, T1000-style. Subject: a from→to pair.',
};
const EFFECT_MOTION_NAMES = Object.keys(EFFECT_MOTIONS);
const EFFECT_BG = '#070a11';

function motionRef() {
  return `mo_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function motionCatalogue() {
  return [...Object.entries(CAMERA_MOTIONS), ...Object.entries(DECK_MOTIONS), ...Object.entries(EFFECT_MOTIONS)]
    .map(([id, desc]) => `  • ${id} — ${desc}`)
    .join('\n');
}

// Resolve a carved-solid effect subject — a stored carved-solid sketch ref (sk_…)
// or an inline { shape, style?, material? } — to the render spec + a recipe pointer.
function resolveCarvedSpec(x, label) {
  if (typeof x === 'string') {
    const sketch = SketchRepository.getByRef(x);
    if (!sketch) throw new Error(`${label} carved sketch '${x}' not found`);
    const m = sketch.manifest;
    if (!m || m.kind !== 'carved-solid') {
      throw new Error(`${label} sketch '${x}' is kind '${m?.kind}'; materialize/transfigure animate carved-solid subjects — mint one with create_carved_solid.`);
    }
    return { spec: { shape: m.shape, style: m.style, material: m.material ?? m.metal }, ref: x };
  }
  if (x && typeof x === 'object' && x.shape) {
    return { spec: { shape: x.shape, style: x.style, material: x.material ?? x.metal }, ref: null };
  }
  throw new Error(`${label} must be a carved-solid ref (sk_…) or an inline { shape, style?, material? }`);
}

function resolveSketchManifest(ref) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`sketch '${ref}' not found`);
  if (!sketch.manifest) throw new Error(`sketch '${ref}' has no manifest`);
  return sketch.manifest;
}

/**
 * Resolve the subject into one of two frame-source shapes:
 *   - kind:'camera' — a single manji-tree (figure / terrain / stored sketch),
 *     animated by a camera path. { manifest, subjectRef, recipeSubject }
 *   - kind:'deck'   — an ordered set of sketches/charts played as a slideshow.
 *     { deckSlides, deckRefs, sourceStashRef?, recipeSubject }
 */
function resolveSubject(subject) {
  if (!subject || typeof subject !== 'object') {
    throw new Error('forge_motion requires subject: { sketch_ref } | { manji_tree } | { deck } | { stash_ref }');
  }

  // ── deck subjects (charts / infographics / slides as a slideshow) ──
  if (Array.isArray(subject.deck)) {
    const deckSlides = [];
    const deckRefs = [];
    for (const entry of subject.deck) {
      if (typeof entry === 'string') {
        deckSlides.push(resolveSketchManifest(entry));
        deckRefs.push(entry);
      } else if (entry && typeof entry === 'object') {
        deckSlides.push(entry);
        deckRefs.push(null);
      } else {
        throw new Error('subject.deck entries must be a sketch ref (sk_…) or an inline sketch manifest');
      }
    }
    return { kind: 'deck', deckSlides, deckRefs, recipeSubject: { deck: deckRefs.map((r, i) => r || deckSlides[i]) } };
  }
  if (subject.stash_ref) {
    const stash = StashRepository.getByRef(subject.stash_ref);
    if (!stash) throw new Error(`subject stash '${subject.stash_ref}' not found`);
    const items = StashRepository.listItems(subject.stash_ref).filter((it) => it.type === 'sketch');
    const deckRefs = items.map((it) => it.metadata?.sketch_ref).filter(Boolean);
    if (deckRefs.length < 2) {
      throw new Error(
        `stash '${subject.stash_ref}' has ${deckRefs.length} sketch item(s); a deck needs at least 2. Gather sketch-typed items in the order they should play.`,
      );
    }
    const deckSlides = deckRefs.map(resolveSketchManifest);
    return { kind: 'deck', deckSlides, deckRefs, sourceStashRef: subject.stash_ref, recipeSubject: { stash_ref: subject.stash_ref } };
  }

  // ── world subjects (a traversable three.js World: city / hub / room / terrain /
  // planetary — animated by the same camera motions, baked via headless WebGL) ──
  if (subject.world_ref) {
    const sketch = SketchRepository.getByRef(subject.world_ref);
    if (!sketch) throw new Error(`subject world '${subject.world_ref}' not found`);
    if (!sketch.manifest) throw new Error(`subject world '${subject.world_ref}' has no manifest`);
    return { kind: 'world', sketch, subjectRef: sketch.ref, recipeSubject: { world_ref: sketch.ref } };
  }

  // ── camera subjects (manji-tree: figure / terrain / stored manji sketch) ──
  if (subject.sketch_ref) {
    const sketch = SketchRepository.getByRef(subject.sketch_ref);
    if (!sketch) throw new Error(`subject sketch '${subject.sketch_ref}' not found`);
    if (!sketch.manifest || sketch.manifest.kind !== 'manji-tree') {
      throw new Error(
        `subject sketch '${subject.sketch_ref}' is kind '${sketch.manifest?.kind}'. Camera motions only animate manji-tree subjects; for charts/slides pass subject.deck (ordered sketch refs) or subject.stash_ref with motion 'deck'.`,
      );
    }
    return { kind: 'camera', manifest: sketch.manifest, subjectRef: sketch.ref, recipeSubject: { sketch_ref: sketch.ref } };
  }
  if (subject.manji_tree) {
    const manifest = { kind: 'manji-tree', ...subject.manji_tree };
    return { kind: 'camera', manifest, subjectRef: null, recipeSubject: { manji_tree: manifest } };
  }

  // ── effect subjects (carved solids — materialize / transfigure) ──
  if (subject.from || subject.to) {
    if (!subject.from || !subject.to) {
      throw new Error('transfigure needs BOTH subject.from and subject.to (carved-solid refs or inline { shape } manifests).');
    }
    const from = resolveCarvedSpec(subject.from, 'subject.from');
    const to = resolveCarvedSpec(subject.to, 'subject.to');
    return {
      kind: 'carved-pair', from: from.spec, to: to.spec,
      subjectRef: from.ref || to.ref || null,
      recipeSubject: { from: from.ref ?? from.spec, to: to.ref ?? to.spec },
    };
  }
  if (subject.carved_solid) {
    const c = resolveCarvedSpec(subject.carved_solid, 'subject.carved_solid');
    return { kind: 'carved', carved: c.spec, subjectRef: c.ref, recipeSubject: { carved_solid: c.ref ?? c.spec } };
  }

  // ── scene subjects (a scene-motion recipe: character clips staged over a
  // background plate with depth + camera moves — the RASTER/CHARACTER family,
  // composited from accepted cels + the accepted plate; renderShot resolves the
  // store-backed assets via resolveSceneForge). ──
  if (subject.scene_ref) {
    const sketch = SketchRepository.getByRef(subject.scene_ref);
    if (!sketch) throw new Error(`subject scene '${subject.scene_ref}' not found`);
    if (sketch.manifest?.kind !== KIND_SCENE_MOTION) {
      throw new Error(`subject scene '${subject.scene_ref}' is kind '${sketch.manifest?.kind}', not a scene-motion recipe (mint one via create_sketch kind 'scene-motion').`);
    }
    const scene = normalizeImageOutcomesManifest(sketch.manifest);
    return { kind: 'scene', scene, sceneRef: sketch.ref, subjectRef: sketch.ref, recipeSubject: { scene_ref: sketch.ref } };
  }

  // ── clip subjects (a finished keyframe-animation clip: stitch its ACCEPTED
  // cels into the mo_ GIF/MP4 — mcp-promotion.plan.md A3). Re-time knobs
  // (fps/onTwos/cycles/blink/speech) re-mint over the SAME accepted cels, zero
  // new generations; pose/keys/motion are baked into the paint, so changing
  // them means a new clip, and overriding them here is refused. ──
  if (subject.cel_set) {
    const cs = typeof subject.cel_set === 'string' ? { ref: subject.cel_set } : subject.cel_set;
    if (!cs || typeof cs !== 'object' || !cs.ref) {
      throw new Error("subject.cel_set requires { ref: 'sk_…' } — the keyframe-animation clip whose accepted cels to stitch.");
    }
    const sketch = SketchRepository.getByRef(cs.ref);
    if (!sketch) throw new Error(`subject clip '${cs.ref}' not found`);
    if (sketch.manifest?.kind !== KIND_KEYFRAME_ANIMATION) {
      throw new Error(`subject clip '${cs.ref}' is kind '${sketch.manifest?.kind}', not a keyframe-animation clip (mint one via create_sketch kind 'keyframe-animation').`);
    }
    const RETIME_KEYS = ['fps', 'onTwos', 'cycles', 'blink', 'speech'];
    const unknown = Object.keys(cs).filter((k) => k !== 'ref' && !RETIME_KEYS.includes(k));
    if (unknown.length) {
      throw new Error(
        `cel_set re-time overrides accept only ${RETIME_KEYS.join(', ')} (got: ${unknown.join(', ')}). `
        + 'Pose, keys, and motion are baked into the accepted cels — mint a new clip to change them.',
      );
    }
    const overrides = {};
    for (const k of RETIME_KEYS) if (k in cs) overrides[k] = cs[k];
    const km = normalizeImageOutcomesManifest({ ...sketch.manifest, ...overrides });
    return {
      kind: 'cels', km, clipRef: sketch.ref, subjectRef: sketch.ref,
      recipeSubject: { cel_set: { ref: sketch.ref, ...overrides } },
    };
  }
  throw new Error('forge_motion subject must provide sketch_ref, manji_tree, deck, stash_ref, carved_solid, from+to, scene_ref, or cel_set');
}

/**
 * Resolve a subject + shot into rendered frames (pure: no fs, no outcome
 * folder). Shared by forge_motion and the stitcher's clip recovery, so a stitch
 * regenerates a source clip's frames the exact same way forge_motion first did.
 *
 * @param {object} args
 * @param {object} args.subject  a forge_motion subject (sketch_ref | manji_tree | deck | stash_ref)
 * @param {object} args.shot     a forge_motion shot (motion, params, frames, fps, loop)
 * @returns {Promise<{ resolved:object, isDeck:boolean, motion:string, result:object }>}
 */
export async function renderShot({ subject, shot }) {
  if (!shot || typeof shot !== 'object') throw new Error('renderShot requires a shot');
  const resolved = resolveSubject(subject);
  const isDeck = resolved.kind === 'deck';
  const isEffect = resolved.kind === 'carved' || resolved.kind === 'carved-pair';
  const isWorld = resolved.kind === 'world';
  const isScene = resolved.kind === 'scene';
  const isCels = resolved.kind === 'cels';

  // A named presentation theme unifies the surface + backdrop + (downstream)
  // player chrome behind one token, so they can't drift. Explicit surface/bg
  // params still win (fine-grained back-compat); no token keeps today's defaults.
  const theme = resolvePresentationTheme(shot.params?.theme);

  // Deck subjects imply the slideshow motion; camera subjects require a named
  // camera motion. Validate the pairing so the model gets a clear error.
  const motion = shot.motion || (isDeck ? 'deck' : isScene ? 'scene' : isCels ? 'clip' : undefined);
  if (!motion) {
    throw new Error('shot.motion is required, one of: ' + [...MOTION_NAMES, ...DECK_MOTION_NAMES, ...EFFECT_MOTION_NAMES].join(', '));
  }

  let result;
  if (isCels) {
    // A clip is self-contained (the recipe carries fps/onTwos/cycles + face
    // schedule). Resolve the accepted cels (completability-gated) and select
    // one per output frame — zero generations, the raster shape
    // forgeMotionHandler encodes to GIF/MP4.
    const { km, cel } = await resolveClipForge(resolved.clipRef, resolved.km);
    const selections = clipFrameSelections(km);
    const framePngs = await compositeCels({
      selections,
      cel,
      downscale: { width: Math.round(km.canvas.width / 2), height: Math.round(km.canvas.height / 2) },
    });
    result = { framePngs, meta: { fps: km.fps, frames: framePngs.length } };
  } else if (isScene) {
    // A scene is self-contained (the recipe carries fps + shots + camera). Resolve
    // the store-backed assets (accepted cels + plate, completability-gated) and
    // composite → framePngs, the raster shape forgeMotionHandler encodes to GIF/MP4.
    const { scene, plate, cel } = await resolveSceneForge(resolved.scene, resolved.sceneRef);
    const framePngs = await renderSceneFrames(scene, {
      plate,
      cel,
      downscale: { width: Math.round(scene.frame.width / 2), height: Math.round(scene.frame.height / 2) },
    });
    result = { framePngs, meta: { fps: scene.fps, frames: framePngs.length } };
  } else if (isWorld) {
    if (isDeckMotion(motion)) {
      throw new Error("'deck' needs a deck subject — a world animates with a camera motion (turntable/orbit/push_in/dolly_zoom/flythrough) or a 'traversal' input script.");
    }
    if (motion === 'traversal') {
      // TRAVERSAL (renderer-ladder P3): shot.ticks is an input script driving the world's LIVE
      // channels (controllable entities / physics / events) at shot.fps, instead of a camera
      // path over passive time. The ticks ride into the stored recipe, so the run reproduces.
      // shot.waypoints (renderer-convergence step 3) is the authorship sugar: a [x,y] route is
      // COMPILED into ticks against the live walk/platform rule (closed-loop steering, stuck
      // legs reported), and the COMPILED ticks are what get stored — the recipe stays a plain
      // tick script either way.
      result = await renderWorldTraversalMotion({
        sketch: resolved.sketch,
        ticks: shot.ticks,
        waypoints: shot.waypoints,
        fps: shot.fps ?? 24,
        params: shot.params || {},
      });
    } else {
      if (!WORLD_MOTION_NAMES.includes(motion)) {
        throw new Error(`unknown world motion '${motion}'. One of: ${WORLD_MOTION_NAMES.join(', ')}, traversal.`);
      }
      result = await renderWorldMotion({
        sketch: resolved.sketch,
        motion,
        params: shot.params || {},
        frames: shot.frames,
        fps: shot.fps ?? 12,
        loop: shot.loop ?? true,
      });
    }
  } else if (isEffect) {
    result = renderEffectShot(resolved, motion, shot);
  } else if (isDeck) {
    if (!isDeckMotion(motion)) {
      throw new Error(`deck/stash subjects play as a slideshow — set shot.motion to 'deck' (got '${motion}').`);
    }
    result = await renderDeckMotion({
      slides: resolved.deckSlides,
      secondsPerSlide: shot.params?.seconds_per_slide,
      fps: shot.fps,
      loop: shot.loop ?? true,
      width: shot.params?.width,
      surface: shot.params?.surface ?? theme?.surface,
      vars: theme?.vars,
      bg: shot.params?.bg ?? theme?.bg,
    });
  } else {
    if (isDeckMotion(motion)) {
      throw new Error("'deck' needs a deck subject — pass subject.deck (ordered sketch refs) or subject.stash_ref.");
    }
    if (!MOTION_NAMES.includes(motion)) {
      throw new Error(`unknown camera motion '${motion}'. One of: ${MOTION_NAMES.join(', ')}.`);
    }
    result = renderMotion({
      manifest: resolved.manifest,
      motion,
      params: shot.params || {},
      frames: shot.frames,
      fps: shot.fps ?? 12,
      loop: shot.loop ?? true,
    });
  }

  return { resolved, isDeck, isEffect, isWorld, isScene, isCels, motion, result, theme };
}

/**
 * Render an EFFECT shot (materialize / transfigure) over a carved subject into the
 * same { flipbookSvg, frameSvgs, viewBox, meta } shape the camera/deck paths emit.
 * The carved-motion renderer is pure (frames + viewBox); we compose the flipbook
 * here with the shared compositor, matching how the deck/camera paths build theirs.
 */
function renderEffectShot(resolved, motion, shot) {
  if (!EFFECT_MOTION_NAMES.includes(motion)) {
    throw new Error(`carved subjects animate as an effect — set shot.motion to one of: ${EFFECT_MOTION_NAMES.join(', ')} (got '${motion}').`);
  }
  let frameSvgs, viewBox;
  if (motion === 'materialize') {
    if (resolved.kind !== 'carved') {
      throw new Error('materialize takes a single carved subject — pass subject.carved_solid (a carved-solid ref or inline { shape }).');
    }
    ({ frameSvgs, viewBox } = renderMaterializeFrames(
      { shape: resolved.carved.shape, style: resolved.carved.style, material: resolved.carved.material, klass: shot.params?.class },
      shot.frames ?? 30,
    ));
  } else {
    // transfigure — the destination identity (`to`) lends the morph its material.
    if (resolved.kind !== 'carved-pair') {
      throw new Error('transfigure takes a pair — pass subject.from and subject.to (carved-solid refs or inline { shape }).');
    }
    ({ frameSvgs, viewBox } = renderTransfigureFrames(
      {
        from: resolved.from.shape,
        to: resolved.to.shape,
        style: resolved.to.style ?? resolved.from.style,
        material: resolved.to.material,        // the FINAL form's own material (liquid-metal resolves into this)
        fromMaterial: resolved.from.material,  // the start form's material (loop resolves back into this)
        klass: shot.params?.class,
        liquid: shot.params?.liquid,
      },
      shot.frames ?? 36,
    ));
  }
  const fps = shot.fps ?? 18;
  const loop = shot.loop ?? true;
  const flipbookSvg = composeFlipbook({ frames: frameSvgs, viewBox, fps, loop });
  return { flipbookSvg, frameSvgs, viewBox, meta: { motion, frames: frameSvgs.length, fps, loop } };
}

export async function forgeMotionHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('forge_motion requires { title, subject, shot }');
  }
  const { title, subject, shot, export: exportFormat = 'both', tag_ref: existingTag } = input;
  if (!title || typeof title !== 'string') throw new Error('title is required');
  if (!shot || typeof shot !== 'object') throw new Error('forge_motion requires a shot');

  const { resolved, isDeck, isEffect, isWorld, isScene, isCels, motion, result, theme } = await renderShot({ subject, shot });
  // Raster-native families (no SVG flipbook): a three.js World, a composited
  // scene, or a keyframe clip's stitched cels.
  const isRaster = isWorld || isScene || isCels;

  // ── materialize the outcome folder ──
  const ref = motionRef();
  const dir = outcomeDirFor(ref);
  await fs.mkdir(dir, { recursive: true });

  let gifInfo = null;
  let mp4Info = null;
  let wantGif;
  if (isRaster) {
    // Raster-native — no SVG flipbook. The GIF is the portable preview; the
    // MP4 is the scrub/download form.
    wantGif = exportFormat !== 'mp4';
    const wantMp4 = exportFormat === 'mp4' || exportFormat === 'both';
    if (wantGif) {
      gifInfo = await encodeGifBuffers(result.framePngs, path.join(dir, 'motion.gif'), {
        fps: result.meta.fps,
        loop: 0,
      });
    }
    if (wantMp4) {
      mp4Info = await encodeFramesMp4(result.framePngs, path.join(dir, 'motion.mp4'), {
        fps: result.meta.fps,
      });
    }
  } else {
    wantGif = exportFormat === 'gif' || exportFormat === 'both';

    // The flipbook SVG is the durable, portable form — always write it.
    await fs.writeFile(path.join(dir, 'motion.svg'), result.flipbookSvg, 'utf8');

    // A named theme sets the backdrop for every motion family (its bg also became
    // the deck's slide backdrop above); without one, keep the per-family default.
    const bgDefault = theme?.bg || (isEffect ? EFFECT_BG : isDeck ? DECK_BG : '#fafaf6');
    if (wantGif) {
      gifInfo = await encodeGif(result.frameSvgs, path.join(dir, 'motion.gif'), {
        width: shot.params?.gif_width || (isDeck ? 720 : 640),
        fps: result.meta.fps,
        bg: shot.params?.bg || bgDefault,
        loop: 0,
      });
    }
    if (exportFormat === 'mp4') {
      // Single-clip H.264 beside the durable svg — the exact raster/encode path the
      // stitcher uses, applied to one clip. Deliberately NOT part of 'both': mp4 is
      // opt-in so the default forge never resolves/lazy-fetches ffmpeg. A still deck
      // runs at a fractional fps (e.g. 0.4 = 2.5s/slide); H.264 wants a sane constant
      // rate, so resample those up to 24 — planClip holds frames, preserving duration.
      const mp4Fps = result.meta.fps < 5 ? 24 : result.meta.fps;
      mp4Info = await encodeStitchMp4(
        [{ frameSvgs: result.frameSvgs, fps: result.meta.fps, title }],
        path.join(dir, 'motion.mp4'),
        { fps: mp4Fps, width: shot.params?.gif_width || (isDeck ? 720 : 640), bg: shot.params?.bg || bgDefault },
      );
    }
  }

  const recipe = {
    motion_ref: ref,
    title,
    subject: resolved.recipeSubject,
    // a traversal's ticks ARE its recipe — with them stored, the run re-renders exactly.
    // a waypoint shot stores the COMPILED ticks (result.ticks), so the recipe is still a plain
    // tick script; the waypoints + per-leg compile report ride along as provenance.
    shot: {
      motion, params: shot.params || {}, frames: result.meta.frames, fps: result.meta.fps, loop: result.meta.loop,
      ...(motion === 'traversal' ? { ticks: result.ticks || shot.ticks } : {}),
      ...(motion === 'traversal' && shot.waypoints ? { waypoints: shot.waypoints, legs: result.legs || [] } : {}),
    },
    viewBox: result.viewBox,
    meta: result.meta,
  };
  await fs.writeFile(path.join(dir, 'recipe.json'), JSON.stringify(recipe, null, 2), 'utf8');
  // the traversal's full per-tick probe stream (entity transforms / HUD vars / physics bodies)
  // files beside the video — the deterministic record a caller can assert against.
  if (motion === 'traversal' && Array.isArray(result.probes)) {
    await fs.writeFile(path.join(dir, 'probes.json'), JSON.stringify(result.probes, null, 2), 'utf8');
  }
  await fs.writeFile(
    path.join(dir, 'index.html'),
    isRaster
      ? worldViewerHtml({ title, motion, recipe, baseUrl: outcomeUrlFor(ref), hasGif: !!gifInfo, hasMp4: !!mp4Info, loop: result.meta.loop })
      : viewerHtml({ title, motion, hasGif: !!gifInfo, hasMp4: !!mp4Info, recipe, baseUrl: outcomeUrlFor(ref), chrome: theme?.chrome }),
    'utf8',
  );

  // ── file it as a Motion Project resource group (stash + tag) ──
  const subjectDesc = isDeck
    ? `a ${resolved.deckSlides.length}-slide deck${resolved.sourceStashRef ? ` from stash \`${resolved.sourceStashRef}\`` : ''}`
    : resolved.subjectRef
      ? `${isWorld ? 'three.js world' : isEffect ? 'carved subject' : isScene ? 'scene' : isCels ? 'keyframe clip' : 'sketch'} \`${resolved.subjectRef}\``
      : isEffect ? 'an inline carved subject' : 'inline manji-tree';
  const tag = existingTag
    ? OpsTagRepository.getByRef(existingTag)
    : OpsTagRepository.forge({
        title: `Motion: ${title}`,
        descriptorMd: `A motion project. Subject ${subjectDesc} put in motion as \`${motion}\` and rendered to ${ref}. Members: the subject/recipe stash and each rendered shot.`,
      });
  if (!tag) throw new Error(`tag_ref '${existingTag}' not found`);

  const stash = StashRepository.mint({ title: `Motion: ${title}` });
  if (isDeck) {
    resolved.deckRefs.forEach((r, i) => {
      if (!r) return; // inline slides have no sketch ref to point at
      StashRepository.gather({
        stashRef: stash.stashRef,
        type: 'sketch',
        title: `slide ${i + 1} — ${title}`,
        metadata: { sketch_ref: r, label: `${title} · slide ${i + 1}` },
      });
    });
  } else if (resolved.subjectRef) {
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      title: `subject — ${title}`,
      metadata: { sketch_ref: resolved.subjectRef, label: title },
    });
  }
  StashRepository.gather({
    stashRef: stash.stashRef,
    type: 'script',
    title: `shot recipe — ${motion}`,
    body: JSON.stringify(recipe, null, 2),
    metadata: { language: 'js' },
  });

  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'stash', memberRef: stash.stashRef });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'motion', memberRef: ref });

  const url = outcomeUrlFor(ref);
  return {
    ok: true,
    motion_ref: ref,
    tag_ref: tag.tagRef,
    stash_ref: stash.stashRef,
    url,
    svg_path: isRaster ? null : `${url}motion.svg`,
    gif_path: gifInfo ? `${url}motion.gif` : null,
    mp4_path: mp4Info ? `${url}motion.mp4` : null,
    frames: result.meta.frames,
    bytes: (mp4Info?.bytes ?? gifInfo?.bytes) ?? null,
    // traversal: the final probe is the run's outcome (where the player ended, HUD state);
    // the full per-tick stream is at <url>probes.json.
    ...(motion === 'traversal' && Array.isArray(result.probes) && result.probes.length
      ? { final_probe: result.probes[result.probes.length - 1], probes_path: `${url}probes.json` }
      : {}),
    message:
      `Motion '${motion}' rendered (${result.meta.frames} frames${isWorld ? ', three.js world via headless WebGL' : ''}) at ${url}. `
      + `Filed under ops tag ${tag.tagRef} with subject/recipe stash ${stash.stashRef}.`
      + (motion === 'traversal' ? ' Final probe (entity positions / HUD vars) is in final_probe; the per-tick stream is at probes_path.' : ''),
  };
}

/**
 * Recover one already-forged clip to its frames, by re-rendering from its stored
 * recipe the SAME way forge_motion first did (frame source = recipe, faithful).
 * Snapshot-at-build means these frames get baked into the stitch MP4, so the
 * stitch then survives this source clip being deleted/re-forged.
 */
async function recoverClip(clipRef) {
  if (typeof clipRef !== 'string' || !clipRef.startsWith('mo_')) {
    throw new Error(`clip '${clipRef}' is not a motion ref (mo_…)`);
  }
  const dir = outcomeDirFor(clipRef);
  let recipe;
  try {
    recipe = JSON.parse(await fs.readFile(path.join(dir, 'recipe.json'), 'utf8'));
  } catch {
    throw new Error(`clip '${clipRef}' not found (no recipe.json in its outcome folder)`);
  }
  if (recipe.kind === 'stitch') {
    throw new Error(
      `clip '${clipRef}' is itself a stitch; stitching a stitch is not supported yet — pass its source clips directly.`,
    );
  }
  if (recipe.subject?.world_ref) {
    throw new Error(
      `clip '${clipRef}' is a three.js WORLD motion (raster-native, no frame SVGs). Stitching world clips is not supported yet — `
      + 'it already exports an MP4 directly (forge_motion export:"mp4"|"both").',
    );
  }
  const { result } = await renderShot({ subject: recipe.subject, shot: recipe.shot });
  return {
    ref: clipRef,
    title: recipe.title || clipRef,
    frameSvgs: result.frameSvgs,
    fps: result.meta.fps,
    frames: result.meta.frames,
  };
}

/**
 * stitch_motion — concatenate N already-forged motion clips end-to-end into one
 * long-form MP4/H.264 (the broadly-playable, downloadable container the GIF path
 * can't be). A stitch is ITSELF a motion outcome: same mo_<…> folder, filed under
 * the same "Motion Project" ops tag, surfaced by the same gallery — it just plays
 * as a <video> instead of a flipbook. Cut-only in P1 (pure concatenation).
 */
export async function stitchMotionHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('stitch_motion requires { title, clips }');
  const { title, clips: clipInput, fps = 24, loop = true, width = 720, bg = '#000000', tag_ref: existingTag } = input;
  if (!title || typeof title !== 'string') throw new Error('title is required');
  if (!Array.isArray(clipInput) || clipInput.length < 2) {
    throw new Error('stitch_motion needs clips: an ordered list of ≥2 motion refs (mo_…) to play end-to-end.');
  }

  // normalize entries: 'mo_x' | { motion_ref, transition? } — P1 is cut-only.
  const order = clipInput.map((c) => {
    const ref = typeof c === 'string' ? c : c?.motion_ref;
    const transition = (typeof c === 'object' && c?.transition) || 'cut';
    if (transition !== 'cut') {
      throw new Error(`transition '${transition}' not supported yet — P1 stitches are cut-only. Omit transition or use 'cut'.`);
    }
    return ref;
  });

  // recover every clip's frames (the snapshot source), in order
  const clips = [];
  for (const ref of order) {
    clips.push(await recoverClip(ref)); // eslint-disable-line no-await-in-loop -- order matters
  }

  // ── encode the long-form MP4 into a fresh motion outcome folder ──
  const ref = motionRef();
  const dir = outcomeDirFor(ref);
  await fs.mkdir(dir, { recursive: true });
  const enc = await encodeStitchMp4(clips, path.join(dir, 'motion.mp4'), { fps, width, bg });

  const recipe = {
    motion_ref: ref,
    kind: 'stitch',
    title,
    subject: { clips: clips.map((c) => ({ motion_ref: c.ref, transition: 'cut' })) },
    shot: { motion: 'stitch', fps: enc.fps, loop, width: enc.width, bg },
    meta: {
      motion: 'stitch',
      clipCount: clips.length,
      frames: enc.totalFrames,
      fps: enc.fps,
      loop,
      durationSec: Math.round(enc.durationSec * 100) / 100,
      width: enc.width,
      height: enc.height,
      bytes: enc.bytes,
      viewBoxStrategy: 'stitch',
      encoder: 'ffmpeg/h264',
    },
  };
  await fs.writeFile(path.join(dir, 'recipe.json'), JSON.stringify(recipe, null, 2), 'utf8');
  await fs.writeFile(
    path.join(dir, 'index.html'),
    stitchViewerHtml({ title, recipe, baseUrl: outcomeUrlFor(ref), loop }),
    'utf8',
  );

  // ── file it as a Motion Project resource group (stash + tag), same as forge ──
  const tag = existingTag
    ? OpsTagRepository.getByRef(existingTag)
    : OpsTagRepository.forge({
        title: `Motion: ${title}`,
        descriptorMd: `A stitched motion project. ${clips.length} clips (${clips
          .map((c) => `\`${c.ref}\``)
          .join(' → ')}) concatenated into a long-form MP4 at ${ref}.`,
      });
  if (!tag) throw new Error(`tag_ref '${existingTag}' not found`);

  const stash = StashRepository.mint({ title: `Motion: ${title}` });
  StashRepository.gather({
    stashRef: stash.stashRef,
    type: 'script',
    title: `stitch recipe — ${clips.length} clips`,
    body: JSON.stringify(recipe, null, 2),
    metadata: { language: 'js' },
  });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'stash', memberRef: stash.stashRef });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'motion', memberRef: ref });

  const url = outcomeUrlFor(ref);
  return {
    ok: true,
    motion_ref: ref,
    tag_ref: tag.tagRef,
    stash_ref: stash.stashRef,
    url,
    mp4_path: `${url}motion.mp4`,
    clips: clips.length,
    frames: enc.totalFrames,
    duration_seconds: recipe.meta.durationSec,
    bytes: enc.bytes,
    warning: enc.warning,
    message:
      `Stitched ${clips.length} clips into a ${recipe.meta.durationSec}s MP4 ` +
      `(${enc.totalFrames} frames, ${(enc.bytes / 1e6).toFixed(1)} MB) at ${url}. Filed under ops tag ${tag.tagRef}.` +
      (enc.warning ? ` ⚠ ${enc.warning}` : ''),
  };
}

export function registerMotionTools() {
  registerTool({
    name: 'forge_motion',
    description:
      `Put a mojulo subject in MOTION and render it to an animated artifact — a self-contained CSS flipbook SVG (plays anywhere an <img> goes) plus an animated GIF (zero-dependency, via the bundled sharp/cgif encoder). Motion is an OUTPUT concern, the sibling of illustration and cook: it CONSUMES a static subject and adds TIME. Reach for this on framing like "animate / make it move / turn it into a gif / spin it / a turntable / fly through / fly between / zoom in on / orbit it", AND on info-transfer framing like "play these charts / make a slideshow / a deck / an explainer / a walkthrough / a report in motion". (Contrast: "draw me X" → create_sketch / create_manji_tree; "write up / publish X" → cook.)\n\nThe artifact is a RECIPE (subject + shot), so it regenerates deterministically. It is filed as a "Motion Project" resource group reusing existing primitives — an ops tag names the project, a stash holds the subject pointer(s) + the shot recipe, and the outcome folder holds the rendered motion.svg / motion.gif. The returned tag groups them; pass \`tag_ref\` to add more shots of the same subject to one project.\n\nFOUR SUBJECT FAMILIES:\n\n1. CAMERA motions over a single manji-tree subject (a stored manji-tree sketch, the figure rig, or a terrain world). worldUp is the Zenith–Nadir axis, so the same orbit/dolly code that framed a figure also frames a canyon. The subject's own \`camera.worldFraming\` is the BASE shot; the motion perturbs it. turntable/orbit lock the centred subject under a shared (union) viewBox while the camera circles; push_in/dolly_zoom/flythrough re-frame into a fixed film frame. \`shot.params\`: orbit {from,to} deg; push_in/dolly_zoom {end_scale} (<1 = closer); flythrough REQUIRES {keyframes:[{pos,lookAt,fov},…]} (≥2); optional {camera_position,look_at,fov,width,height,gif_width,bg}. (Manji-tree performance motions — walk/grow/bounce — land later behind this same schema; the carve EFFECT motions in family 3 below have already landed.)\n\n2. DECK motion (\`deck\`) over an ORDERED set of sketches/charts — the SLIDESHOW. This is INFO TRANSFER that needs no figure or scene animation: a chart deck, a KPI dashboard walkthrough, an explainer, a report in motion. No camera; each sketch plays one-per-beat as a self-contained flipbook + GIF. Pass the slides as \`subject.deck\` (an ordered list of sketch refs sk_… and/or inline sketch manifests, ≥2) OR \`subject.stash_ref\` (a stash whose \`sketch\`-typed items, in gather order, ARE the slides). \`shot.params\`: {seconds_per_slide} (default 2.5), {theme}, {width,gif_width}. Use a deck — not a camera motion — whenever the content is charts/text/diagrams rather than a 3D figure or scene.\n\nTHEME — the deck need not be dark. Pass \`shot.params.theme\` to set ONE coherent look across the slide ink, the backdrop, and the player chrome (so a light deck is never a dark chart on a cream page). The vocabulary is broad and indicative — pick the one that fits the content: ${PRESENTATION_THEME_NAMES.join(', ')}. \`dark\` is the default if omitted. (\`paper\`/\`sepia\` for editorial or reflective info; \`blueprint\` for technical/schematic; \`light\`/\`high-contrast\` for maximum legibility; \`midnight\` for a warmer dark.) Low-level escape hatches {surface:'dark'|'light'} and {bg} still exist and override the theme, but prefer the named theme.\n\nA deck slide can also REVEAL its content in sequence (make its points one at a time) — annotate any of its marks with \`reveal: { step, enter, from?, dwell? }\`:\n  • step — integer order; marks sharing a step enter together; marks WITHOUT \`reveal\` are the slide's base (shown from the start).\n  • enter — 'fly-in' (slides in; \`from\`:'left'|'right'), 'fade-up' (rises + fades in), 'type-on' (text types out character by character), 'fade'/'pop'.\n  • dwell — seconds to hold after this step lands (default 0.7).\nA slide with reveals expands into a paced build; still slides hold for seconds_per_slide. This is the same slideshow with motion WITHIN a slide — words flying in, bullets appearing, a callout dropping in — so a single annotated slide is itself a valid animated deck. (Smooth WITHIN-element motion like a bar continuously filling is not available yet; reveals appear/animate element-by-element.)\n\nEXPLAINING A CONCEPT VISUALLY — the deck+reveal IS a concept explainer: graduated, paced disclosure. Common shapes (compose freely, not a fixed menu): a CONCEPT LADDER (one idea at rising depth L1→L2→L3, each level a reveal slide); a PROCESS / MECHANISM (boxes + arrows built from MARKS — rect/line/polygon/text, NOT stations/edges, since reveal only stages marks — each stage fly-in in causal order); a LABELED STRUCTURE (draw it as base marks, then disclose callout labels one at a time); a STRATIFIED / LAYERED model; a QUANTITATIVE build (a chart whose marks appear a category per step); a FORMAL / DEFINITIONAL (type-on the equation, fade-up the gloss). Scaffold each with a kicker (label + rule), a type-on title, and a closing framed callout (rounded rect + accent + text). FORK: if the concept is a 3D OBJECT that must ROTATE to be understood (a molecule, a lattice, a mechanism), leave the deck — build a manji-tree and use a CAMERA turntable/orbit. BALL-AND-STICK is lathes: a ball = a lathe with a dome profile \`[{t:0,radius:0},{t:0.5,radius:R},{t:1,radius:0}]\` about a short axis through the atom centre; a rod = a constant-radius lathe between two atom centres. Give each lathe \`style:{ fill:'vexar', fillColor:'#hex' }\` for LIT shaded solids (the default is wireframe); optional manifest \`light:{ direction:[x,y,z], ambient, diffuse }\`. Then \`forge_motion({ subject:{ sketch_ref|manji_tree }, shot:{ motion:'turntable' } })\` spins the lit model. The atomic BOND has its own primitive — a \`vajra\` (the o-o-o bond: two outer spheres + a thin hub); CHIRALITY / handedness (a chiral centre, a double helix, DNA) is the \`taiji\` primitive (a SIGNED \`twist\` — sign = which way it spins). Multi-atom molecules and chiral helices INTERPENETRATE / self-fold, so they belong on this BAKED turntable (it depth-sorts every frame). But a SINGLE convex solid that never self-occludes — a lit ball, a crystal / coordination polyhedron, a gem, a single atom or orbital lobe — can instead spin LIVE in the browser via \`create_solid_turntable\` (dependency-free CSS-3D, highlight fixed in the viewport; no bake). LIMITS to respect: no sound (timing is the narration — pace with dwell).\n\nSMOOTH 2D MOTION (\`animate\`) — a SINGLE-slide deck whose marks carry \`animate: { channel, … }\` renders REGIME A: the slide is rendered ONCE and animated by CSS transform (smooth, tiny, loops; the .svg plays live, the .gif is the bake). Channels: 'spin' (rotate about the mark's centre), 'orbit' ({center:[x,y]}), 'grow' (scaleY from the baseline — yes, bars grow), 'slide' ({from:'left'|'right'|'top'|'bottom'}), 'fade', 'pulse'; with {duration, delay, loop}. Reach for it for a rotating / growing / orbiting / building diagram. (Still staged, not smooth: motion across a MULTI-slide deck, draw-on, and continuous 3D — for those, stage it as revealed states or use a 3D turntable.)\n\n3. EFFECT motions (\`materialize\` / \`transfigure\`) over CARVED SOLIDS — the temporal peers of carve (create_carved_solid). They ADD TIME to a carved subject: a phase 0→1 that brings it into being or turns it into something else. Reach for them on framing like "make it appear / boot it up / materialize / dissolve / 3D-print the logo / beam it in / transporter effect" → \`materialize\`; "morph A into B / turn the old logo into the new one / shapeshift / a rebrand reveal / before→after / liquid chrome / T1000" → \`transfigure\`. SUBJECT: materialize takes \`subject.carved_solid\` (a carved-solid ref sk_… or inline { shape, style?, material? }); transfigure takes \`subject.from\` + \`subject.to\` (the start + end carved solids; liquid-metal uses a smooth carrier and does not require metal endpoint materials). \`shot.params.class\` is the STYLE: materialize → \`hologram\` (wireframe boot-up, then skin), \`doom\` (a glowing platform/scan plane prints the solid upward), or \`transporter\` (particles converge into the solid); transfigure → \`galvatron\` (de-skin to wireframe → morph the outline → re-skin, after Mahito's Idle Transfiguration) or \`liquid-metal\` (a smooth liquid carrier morphs outside the beveled carved renderer, T1000-style). Optional liquid-metal tuning lives at \`shot.params.liquid\`: {carrier} (material name, #hex, or material object; default chrome), {blobRandomness} 0..1, and {highlightBias} -1..1. Galvatron/materialize reuse the carved-solid extrude + vexar-shade stack; liquid-metal plans with a golden-ratio radial mesh in vector space, then draws only the vexar-lit waveform mass in worldspace. It loops smoothly (ping-pong). LIMITS: transfigure currently morphs a single outer contour, so shapes with different hole counts can swim; effect shots use the fixed carved-solid hero framing (no camera override yet).\n\n4. WORLD motions over a traversable three.js World — the SAME camera motions (turntable/orbit/push_in/dolly_zoom/flythrough) applied to a world-eligible sketch instead of a manji-tree, baked through headless WebGL. This is the door for the rich, occlusion-correct, fully-lit 3D scenes that only exist on the WebGL backend — a fractal-city skyline, a transportation hub, a furnished room, painted-landscape terrain, a planetary body, a floorplan house, the workbench object study, the operator-world (the operator's own Connected Services graph as a walkable block field). Pass \`subject.world_ref\` (a stored sketch sk_… whose kind has a World form). The world's own first camera bookmark is the BASE shot the motion perturbs (a bounds-derived 3/4 orbit if it ships none). \`shot.params\`: same camera params as family 1, plus {width,height} for the render canvas. A World is RASTER-NATIVE — there is NO durable flipbook SVG; it exports a looping .gif (preview) and, on \`export:'mp4'|'both'\`, a downloadable .mp4/H.264 (the better form for a smooth 3D fly-through). Heavier than the SVG paths (it spins up headless Chromium + SwiftShader and renders each frame), so keep frame counts modest. Reach for world_ref over sketch_ref whenever the subject is a city/hub/room/terrain/planet — those kinds aren't manji-trees and only move on the WebGL backend.\n\nA world subject also plays a TRAVERSAL (\`shot.motion:'traversal'\`): instead of a camera path over passive time, \`shot.ticks\` is an INPUT SCRIPT — one normalized snapshot per tick ({forward,strafe,jump,lookDX,…}) at \`shot.fps\` — that drives the world's LIVE channels (controllable entities, physics, events) exactly as the interactive page would. Reach for it on "walk through it / play the run back / record a tour / prove the dungeon is traversable / show the character doing X". The run is DETERMINISTIC (the model layer is wall-clock-free): the ticks are stored in the recipe, the per-tick probe stream (entity positions, HUD vars, physics bodies) files as probes.json beside the video, and the final probe returns in the result — so a traversal is simultaneously the MP4 tour and the assertion record ("the player reached the exit; score is 2"). Camera: a camera ENTITY in the world's manifest (follow/FPV) owns the view; \`shot.params.camera\` may inject one ({rule:'follow',target:'<entityId>',dist,height,…}); otherwise the world's authored framing holds a static wide shot.\n\nMotions:\n${motionCatalogue()}\n\nReturns { motion_ref, tag_ref, stash_ref, url, svg_path, gif_path, mp4_path, frames, message }. Open \`url\` to view; for the SVG families the .svg is the durable form and the .gif a cache (export:'mp4' bakes a downloadable H.264 beside the .svg); for WORLD motions the .gif/.mp4 are the artifact (no .svg).`,
    inputSchema: {
      type: 'object',
      required: ['title', 'subject', 'shot'],
      properties: {
        title: { type: 'string', description: 'Title for the motion project + artifact.' },
        subject: {
          type: 'object',
          description: 'What moves. CAMERA family: a single manji-tree (sketch_ref or inline manji_tree). WORLD family: a traversable three.js world (world_ref). DECK family: an ordered set of charts/sketches (deck or stash_ref) played as a slideshow. EFFECT family: a carved solid (carved_solid) for materialize, or a from→to pair for transfigure.',
          properties: {
            sketch_ref: { type: 'string', description: 'CAMERA: a stored sketch ref (sk_…) whose manifest.kind is manji-tree.' },
            manji_tree: { type: 'object', description: 'CAMERA: an inline manji-tree manifest (tree/waveFields/camera/…). The kind field is added if missing.' },
            world_ref: { type: 'string', description: 'WORLD: a stored sketch ref (sk_…) whose kind has a traversable three.js World form (fractal-city, transportation-hub, subway-station, painted-landscape, planetary, floorplan, workbench, room, operator-world). Animated by the same camera motions, baked via headless WebGL → .gif/.mp4 (no .svg).' },
            carved_solid: { type: ['string', 'object'], description: 'EFFECT (materialize): a carved-solid ref (sk_…) or an inline { shape, style?, material? } — the subject that comes into being.' },
            from: { type: ['string', 'object'], description: 'EFFECT (transfigure): the START carved solid (ref or inline { shape, … }). Requires `to`.' },
            to: { type: ['string', 'object'], description: 'EFFECT (transfigure): the END carved solid the subject becomes (ref or inline { shape, … }). Lends the morph its material. Requires `from`.' },
            scene_ref: { type: 'string', description: "SCENE (raster/character family): a stored sketch ref (sk_…) whose kind is scene-motion — hand-drawn character CLIPS staged over a background PLATE with depth + camera moves. Composited from the clips' accepted keyframe cels + the accepted plate (all must be accepted first), baked to .gif/.mp4 (no .svg). This is the ONE motion family whose pixels come from an external image model, not from mojulo — output quality = that model's." },
            cel_set: { type: 'object', description: "CLIP (raster/character family): stitch ONE finished keyframe-animation clip's ACCEPTED cels into its GIF/MP4 — pass { ref: 'sk_…' } plus optional re-time knobs { fps, onTwos, cycles, blink, speech } that re-mint over the SAME accepted cels (zero new generations; pose/keys/motion are baked into the paint — mint a new clip to change those). Refused until every cel target of the clip is accepted through the render handoff. To stage clips over a background with depth/cuts/camera, use scene_ref instead." },
            deck: {
              type: 'array',
              description: "DECK: an ordered list of slides. Each entry is a sketch ref (sk_…) or an inline sketch manifest. Plays one-per-beat as a slideshow. A slide's marks may carry reveal:{step,enter,from,dwell} to build in sequence (see the description); ≥2 still slides, or ≥1 reveal slide.",
              items: { type: ['string', 'object'] },
            },
            stash_ref: { type: 'string', description: 'DECK: a stash (st_…) whose sketch-typed items, in gather order, are the slides (≥2).' },
          },
        },
        shot: {
          type: 'object',
          description: 'The shot. CAMERA: a named camera motion + params. DECK: motion \'deck\' (or omit — implied for deck subjects).',
          properties: {
            motion: { type: 'string', enum: [...MOTION_NAMES, ...DECK_MOTION_NAMES, ...EFFECT_MOTION_NAMES, 'traversal'], description: "Which motion. Camera: turntable/orbit/push_in/dolly_zoom/flythrough. Deck: 'deck'. Effect: materialize/transfigure. World only: 'traversal' — an input script (shot.ticks) drives the world's live entities/physics/events instead of a camera path. See the catalogue in the description." },
            ticks: {
              type: 'array',
              description: "TRAVERSAL only: the input script — one normalized input snapshot per tick at shot.fps ({forward,strafe,turn,lift,jump,jumpHeld,lookDX,lookDY}, each -1..1; {} = idle tick). The world's controllable entities, physics, and events advance one fixed dt per tick, so the same ticks reproduce the identical run. Stored into the recipe. The run's per-tick probe stream (entity positions, HUD vars) files as probes.json beside the video, and the final probe returns in the result.",
              items: { type: 'object' },
            },
            waypoints: {
              type: 'array',
              description: "TRAVERSAL alternative to ticks — a [x,y] route ('walk to X, then Y'). Each leg is COMPILED into ticks against the world's live walk/platform rule (closed-loop steering + the rule's own wall slide; no pathfinding — a blocked leg is reported as {stuck:true, atTick} in the recipe's legs, never an endless loop). The compiled ticks are what get stored, so the recipe stays a plain deterministic tick script. This is also the WALKABILITY AUDIT: compile entrance→exit and check the final probe / legs for arrival.",
              items: { type: 'array', items: { type: 'number' }, minItems: 2 },
            },
            params: { type: 'object', description: `CAMERA: orbit {from,to}; push_in/dolly_zoom {end_scale}; flythrough {keyframes}; +{camera_position,look_at,fov,width,height,gif_width,bg,theme}. DECK: {seconds_per_slide,theme,width,gif_width} — theme is one of ${PRESENTATION_THEME_NAMES.join('|')} (default dark) and unifies slide ink + backdrop + player chrome; {surface,bg} remain as low-level overrides. EFFECT: {class} (materialize: hologram|doom|transporter; transfigure: galvatron|liquid-metal). Liquid-metal also accepts {liquid:{carrier,blobRandomness,highlightBias}}.` },
            frames: { type: 'integer', minimum: 2, description: 'CAMERA/WORLD frame count (defaults per motion). Ignored for decks (one frame per slide). Keep modest for WORLD motions — each frame is a headless WebGL render.' },
            fps: { type: 'integer', minimum: 1, description: 'Frames per second (camera default 12). For decks prefer shot.params.seconds_per_slide.' },
            loop: { type: 'boolean', description: 'Seamless loop (default true).' },
          },
        },
        export: { type: 'string', enum: ['gif', 'svg', 'mp4', 'both'], description: "Artifact form (default 'both'). SVG families: 'both' = durable flipbook .svg + .gif cache; 'svg' skips the gif; 'mp4' bakes a downloadable H.264 beside the .svg instead of the gif (opt-in — first use resolves/lazy-fetches ffmpeg). WORLD family (raster-native, no svg): 'gif' is the looping preview, 'mp4' the downloadable H.264, 'both' writes both." },
        tag_ref: { type: 'string', description: 'Optional existing Motion Project ops tag (ops_…) to file this shot under, instead of forging a new one.' },
      },
    },
    handler: forgeMotionHandler,
  });

  registerTool({
    name: 'stitch_motion',
    description:
      `STITCH multiple already-forged motions into ONE long-form, downloadable, broadly-playable MP4 (H.264). Reach for this on framing like "stitch these together / combine the gifs / join the clips / make one long video / a movie out of these motions / concatenate the motions / play them back-to-back". It is the multi-clip sibling of forge_motion: forge_motion makes ONE clip; stitch_motion plays N of them end-to-end as a single film.\n\nEach clip is an existing motion ref (mo_…) — forge the pieces with forge_motion first, then pass them here in play order. A stitch is ITSELF a motion outcome (its own mo_… folder, filed under a Motion Project ops tag, listed in the same /motion gallery) — it just plays as a <video> and offers a download, where a single motion plays as a flipbook.\n\nSNAPSHOT-AT-BUILD: clip frames are baked into the MP4 now, so the stitch survives a source clip being deleted or re-forged afterward. Clips of different sizes are LETTERBOXED into one canvas (never cropped/distorted); each clip keeps its real-time duration (frames are resampled to the output fps). Transitions are CUT-ONLY in this version (pure concatenation). MP4 is the only playable artifact (no GIF). For very long stitches the tool WARNS about build size/time but still proceeds — the operator owns the call.\n\nReturns { motion_ref, tag_ref, stash_ref, url, mp4_path, clips, frames, duration_seconds, bytes, warning }. Open url to watch/download.`,
    inputSchema: {
      type: 'object',
      required: ['title', 'clips'],
      properties: {
        title: { type: 'string', description: 'Title for the stitched motion + its project.' },
        clips: {
          type: 'array',
          minItems: 2,
          description:
            'Ordered list of ≥2 clips to play end-to-end. Each entry is a motion ref (mo_…) or { motion_ref, transition }. Transition is cut-only for now (omit it).',
          items: {
            type: ['string', 'object'],
            properties: {
              motion_ref: { type: 'string', description: 'An existing motion ref (mo_…) to include.' },
              transition: { type: 'string', enum: ['cut'], description: "Cut-only in this version (the default)." },
            },
          },
        },
        fps: { type: 'integer', minimum: 1, description: 'Output (constant) frame rate (default 24). Each clip is resampled to it, preserving its real-time duration.' },
        width: { type: 'integer', minimum: 16, description: 'Output width in px (default 720). Height is derived; clips letterbox into the canvas.' },
        bg: { type: 'string', description: "Letterbox background color (default '#000000')." },
        loop: { type: 'boolean', description: 'Whether the player loops playback (default true). MP4 itself does not loop; the <video> player honors this.' },
        tag_ref: { type: 'string', description: 'Optional existing Motion Project ops tag (ops_…) to file this stitch under, instead of forging a new one.' },
      },
    },
    handler: stitchMotionHandler,
  });
}
