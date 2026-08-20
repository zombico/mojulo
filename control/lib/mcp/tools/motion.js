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
import { getMotionVocabCatalog } from '@/lib/graph/motion-vocab/loader';
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

export async function getMotionVocabHandler(input) {
  const { id, family } = input && typeof input === 'object' ? input : {};
  const catalog = getMotionVocabCatalog();
  if (id) {
    const card = catalog.get(id);
    if (!card) {
      throw new Error(
        `get_motion_vocab: unknown card '${id}'. Known: ${[...catalog.keys()].join(', ')}`,
      );
    }
    return { ok: true, card, _telemetrySignal: { id_requested: true, found: true } };
  }
  let cards = [...catalog.values()];
  if (family) cards = cards.filter((c) => c.family === family);
  return {
    ok: true,
    cards: cards.map(({ id: cid, name, family: fam, entry, summary, when }) => ({
      id: cid, name, family: fam, entry, summary, when,
    })),
    _telemetrySignal: { id_requested: false, found: true },
  };
}

export function registerMotionTools() {
  registerTool({
    name: 'forge_motion',
    description:
      `Put a mojulo subject in MOTION and render an animated artifact — a self-contained CSS flipbook SVG (plays anywhere an <img> goes) plus an animated GIF; opt into a downloadable MP4. Motion is an OUTPUT concern, the sibling of illustration and cook: it CONSUMES a static subject and adds TIME, filed as a deterministic "Motion Project" recipe (subject + shot). Reach for "animate / make it move / turn it into a gif / spin it / a turntable / fly through / zoom in / orbit it", AND info-transfer framing "play these charts / a slideshow / a deck / an explainer / a report in motion". FOUR subject families behind one door — read the one you need via get_motion_vocab({ id }) (find it by intent via semantic_search({ kinds: ['motion_vocab'] })): 'camera' (turntable/orbit/push_in/dolly_zoom/flythrough over a manji-tree, figure rig, or terrain subject); 'deck' (a slideshow over ordered charts/sketches — reveals, themes, concept explainers); 'effect' (materialize/transfigure over a carved solid); 'world' (the camera moves plus a 'traversal' input-script run over a traversable three.js world, baked to gif/mp4). Pass the family's subject field (sketch_ref/manji_tree | deck/stash_ref | carved_solid/from/to | world_ref) plus shot ({ motion, params, frames, fps }) and export. Returns { motion_ref, tag_ref, stash_ref, url, ... }. (Contrast: draw me X → create_sketch / mint_solid; write up / publish X → cook.)`,
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
            world_ref: { type: 'string', description: 'WORLD: a stored sketch ref (sk_…) whose kind has a traversable three.js World form (fractal-city, transportation-hub, subway-station, painted-landscape, planetary, floorplan, workbench, room). Animated by the same camera motions, baked via headless WebGL → .gif/.mp4 (no .svg).' },
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
      `STITCH multiple already-forged motions into ONE long-form, downloadable MP4 (H.264) — the multi-clip sibling of forge_motion (forge makes one clip; stitch plays N end-to-end as a film). Reach for "stitch these together / combine the gifs / join the clips / make one long video / a movie out of these motions". Pass clips as an ordered list of motion refs (mo_...); each is snapshot-at-build (frames baked in, survives source deletion), letterboxed into one canvas, resampled to the output fps keeping real-time duration. CUT-only transitions; MP4-only (no GIF); warns but never refuses on large builds. A stitch is itself a motion outcome (its own mo_... folder + Motion Project tag). Parameter manual: get_motion_vocab({ id: 'stitch' }). Returns { motion_ref, url, mp4_path, clips, frames, duration_seconds, warning }.`,
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

  registerTool({
    name: 'get_motion_vocab',
    description:
      "Read a motion-vocab card in full — the parameter manual for one `forge_motion` / `stitch_motion` "
      + "subject family: `camera` (camera moves over a manji-tree/figure/terrain), `deck` (a chart/sketch "
      + "slideshow with reveals + themes), `effect` (materialize / transfigure a carved solid), `world` "
      + "(camera moves + a traversal input-script over a three.js world), `stitch` (concatenate clips into a "
      + "film). Pass `id` for one card; omit for the index rows. Discover by intent via "
      + "semantic_search({ kinds: ['motion_vocab'] }); this returns the full body. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Card id (a motion subject family: camera / deck / effect / world / stitch).' },
        family: { type: 'string', description: 'Optional list filter (all cards are family `motion`).' },
      },
      required: [],
    },
    handler: getMotionVocabHandler,
  });
}
