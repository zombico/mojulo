/**
 * Scene frame planner (scene-staging.plan.md, Axis 2 — the shot algebra). Pure:
 * a scene manifest → one sorted layer list per output frame. No sharp, no I/O,
 * no Date/Math.random — the raster runnable (composite-scene.mjs) consumes this.
 *
 * A scene is a PIECEWISE window over one clock. A continuous eased camera is one
 * SHOT; a scene is a sequence of independent shots — so a CUT needs no special
 * machinery: each shot's camera is sampled in its OWN local time, and a frame
 * belongs to exactly one shot. Frame N (shot A's last) → frame N+1 (shot B's
 * first) with a different camera+cast IS the cut. This generalizes
 * pan-cel-spike/window.js (one crop rect, one cel) to N depth layers.
 */

import { placeActor, drawBox, placeBand, depthSort, headroomOk, soleInBand, groundShadow } from './stage.js';
import { resolveSubCelTracks, subCelStates } from '../pan-cel-spike/sub-cels.js';

const EASINGS = {
  linear: (t) => t,
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  hold: () => 0,
};

/** Total output frames = fps × (latest shot tOut). */
export function sceneFrameCount(scene) {
  const end = Math.max(...scene.shots.map((s) => s.span[1]));
  return Math.round(scene.fps * end);
}

/** Which shot owns output frame f (piecewise on the one clock). */
function shotAt(scene, f) {
  const tSec = f / scene.fps;
  for (let i = 0; i < scene.shots.length; i += 1) {
    const [tIn, tOut] = scene.shots[i].span;
    if (tSec >= tIn && tSec < tOut) return i;
  }
  return scene.shots.length - 1; // final frame lands exactly on the last tOut
}

/**
 * Sample a shot's camera path at shot-local seconds → { camX, camY, zoom }.
 * Keyframes: [{ t, camX, camY, zoom, ease }], t in shot-local seconds. `ease`
 * on a keyframe governs the segment leading INTO it (the pan-cel easing set).
 * `zoom-approach` rides a per-actor depth ramp, not the camera — see actorDepth.
 */
function sampleCamera(shot, tLocal) {
  const keys = [...(shot.camera || [{ t: 0, camX: 0, camY: 0, zoom: 1 }])].sort((a, b) => a.t - b.t);
  if (tLocal <= keys[0].t) return pick(keys[0]);
  if (tLocal >= keys[keys.length - 1].t) return pick(keys[keys.length - 1]);
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (tLocal >= keys[i].t && tLocal <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const span = b.t - a.t || 1;
  const ease = EASINGS[b.ease || 'linear'];
  if (!ease) throw new Error(`unknown ease '${b.ease}' (${Object.keys(EASINGS).join(' | ')})`);
  const u = ease((tLocal - a.t) / span);
  const lerp = (ka, kb) => (ka ?? 0) + ((kb ?? 0) - (ka ?? 0)) * u;
  return {
    camX: lerp(a.camX, b.camX),
    camY: lerp(a.camY, b.camY),
    zoom: (a.zoom ?? 1) + ((b.zoom ?? 1) - (a.zoom ?? 1)) * u,
  };
}
const pick = (k) => ({ camX: k.camX ?? 0, camY: k.camY ?? 0, zoom: k.zoom ?? 1 });

/**
 * An actor's depth at shot-local time — constant `depth`, OR a keyframed ramp
 * `depthKeys: [{ t, depth }]` (the `zoom-approach` cheat expressed in the
 * kernel: the actor walks toward camera as its depth shrinks).
 */
function actorDepth(actor, tLocal) {
  if (!actor.depthKeys) return actor.depth;
  const keys = [...actor.depthKeys].sort((a, b) => a.t - b.t);
  if (tLocal <= keys[0].t) return keys[0].depth;
  if (tLocal >= keys[keys.length - 1].t) return keys[keys.length - 1].depth;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (tLocal >= keys[i].t && tLocal <= keys[i + 1].t) {
      const span = keys[i + 1].t - keys[i].t || 1;
      const u = (tLocal - keys[i].t) / span;
      return keys[i].depth + (keys[i + 1].depth - keys[i].depth) * u;
    }
  }
  return actor.depth;
}

/** Which cel of an actor's clip plays on global frame f (on twos, looped). */
function celIndex(actor, f) {
  const onTwos = actor.onTwos ?? 2;
  const phase = actor.phase ?? 0;
  return Math.floor(f / onTwos + phase) % actor.cels;
}

/**
 * Per-frame FACE variant selection for an actor with a `face` track — the
 * face-subcel schedule (blink seed / speech spans) resolved on the SCENE clock
 * (one clock, S3). Returns a celFile per frame RELATIVE to the pose key dir:
 * `cel.png` (base) or `face/<vocab>-<state>.png`. Reuses the sub-cel resolver so
 * a scene re-seed re-selects over the SAME variant cels (zero new generations).
 */
function resolveActorFace(actor, fps, n) {
  if (!actor.face) return null;
  const subCels = [];
  if (actor.face.blink) subCels.push({ id: 'eyes', vocab: 'blink', track: { kind: 'blink', ...actor.face.blink } });
  if (actor.face.speech?.spans?.length) {
    subCels.push({ id: 'mouth', vocab: 'mouth', track: { kind: 'speech', spans: actor.face.speech.spans, flapsPerSec: actor.face.speech.flapsPerSec ?? 8 } });
  }
  if (!subCels.length) return null;
  const tracks = resolveSubCelTracks({ fps, subCels }, n);
  const base = Object.fromEntries(subCels.map((sc) => [sc.id, subCelStates(sc.vocab)[0]]));
  const out = [];
  for (let f = 0; f < n; f += 1) {
    const active = subCels.map((sc) => ({ sc, state: tracks[sc.id][f] })).filter((a) => a.state !== base[a.sc.id]);
    out.push(active.length ? `face/${active[0].sc.vocab}-${active[0].state}.png` : 'cel.png');
  }
  return out;
}

/**
 * The source assets each clip MUST provide — independent of fps, camera, seed,
 * cut points, or blocking. This pins the zero-generation claim: re-timing /
 * re-seeding / re-blocking / re-cutting a scene changes the composite but NEVER
 * this set. Returns { [clipRef]: { poses, variants: [...] } }.
 */
export function requiredAssets(scene) {
  const out = {};
  for (const a of scene.cast) {
    const entry = out[a.clipRef] || { poses: 0, variants: new Set() };
    entry.poses = Math.max(entry.poses, a.cels);
    if (a.face?.blink) for (const s of subCelStates('blink').slice(1)) entry.variants.add(`blink-${s}.png`);
    if (a.face?.speech?.spans?.length) for (const s of subCelStates('mouth').slice(1)) entry.variants.add(`mouth-${s}.png`);
    out[a.clipRef] = entry;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { poses: v.poses, variants: [...v.variants].sort() }]));
}

/**
 * Resolve every output frame → { frame, shot, camera, layers } with layers
 * depth-sorted far→near (painter's order). Actor layers carry a drawBox; band
 * layers (incl. the plate) carry left/top/scale. Also runs the validator teeth
 * (headroom, sole-in-band, cut-continuity) and throws on violation — a scene
 * that contradicts its own geometry is refused, not silently mis-composited.
 */
export function resolveSceneFrames(scene) {
  validateScene(scene);
  const n = sceneFrameCount(scene);
  const castById = Object.fromEntries(scene.cast.map((a) => [a.id, a]));
  const faceByCast = Object.fromEntries(scene.cast.map((a) => [a.id, resolveActorFace(a, scene.fps, n)]));
  const center = { x: scene.frame.width / 2, y: scene.frame.height / 2 }; // push/pull scales about here
  const frames = [];
  for (let f = 0; f < n; f += 1) {
    const shotIndex = shotAt(scene, f);
    const shot = scene.shots[shotIndex];
    const tLocal = f / scene.fps - shot.span[0];
    const camera = sampleCamera(shot, tLocal);
    // The cross-cut: a shot with its own stage plays on that stage's plate,
    // plane, and bands; everything else reads against the scene's base stage.
    const stage = shot.stage || scene.stage;
    const bands = stage.bands || [];

    const layers = [];
    // plate + authored bands (always present, parallax only)
    if (stage.plate) layers.push({ kind: 'band', ref: stage.plate.ref, plate: true, ...bandLayer(stage.plate, camera, stage, center) });
    for (const band of bands) layers.push({ kind: 'band', ref: band.ref, ...bandLayer(band, camera, stage, center) });
    // the shot's cast subset
    for (const id of shot.cast || []) {
      const actor = castById[id];
      if (!actor) throw new Error(`shot ${shotIndex} names unknown cast '${id}'`);
      const depth = actorDepth(actor, tLocal);
      const place = placeActor({ markX: actor.markX, depth }, camera, stage, center);
      const box = drawBox(place, actor.clip);
      const ci = celIndex(actor, f);
      const celFile = faceByCast[id] ? faceByCast[id][f] : 'cel.png';
      const shadow = stage.shadows === false ? null : groundShadow(place, actor.shadow);
      layers.push({
        kind: 'actor', id, clipRef: actor.clipRef, facing: actor.facing || 'front',
        celIndex: ci, celFile, keyDir: `key-${ci}`, depth, box, shadow,
      });
    }
    frames.push({ frame: f, shot: shotIndex, camera, layers: depthSort(layers) });
  }
  return { frames, frameCount: n, stage: scene.stage };
}

function bandLayer(band, camera, stage, center) {
  const p = placeBand(band, camera, stage, center);
  return { depth: band.depth, left: p.left, top: p.top, scale: p.scale };
}

/** Validator teeth — refuse a scene whose geometry contradicts itself. */
export function validateScene(scene) {
  if (!scene.shots?.length) throw new Error('scene needs ≥1 shot');
  const castById = Object.fromEntries(scene.cast.map((a) => [a.id, a]));
  // Per shot, against the stage that shot actually plays on (a shot with its
  // own stage — the cross-cut — is validated against that stage, not the base):
  // headroom (the fastest band must not reveal a plate edge at the shot's max
  // pan) and sole-in-band (every placement's sole line stays on the floor).
  scene.shots.forEach((shot, si) => {
    const stage = shot.stage || scene.stage;
    const allBands = [stage.plate, ...(stage.bands || [])].filter(Boolean);
    const maxParallax = Math.max(...allBands.map((b) => stage.dRef / b.depth), 1);
    const maxCamX = Math.max(0, ...(shot.camera || []).map((k) => Math.abs(k.camX ?? 0)));
    if (stage.plate && !headroomOk({
      plateWidth: stage.plate.width, frameWidth: scene.frame.width, maxCamX, maxParallax,
    })) {
      throw new Error(`shot ${si}: plate ${stage.plate.width}px too narrow for pan ${maxCamX}×parallax ${maxParallax.toFixed(2)} (need ${scene.frame.width + maxCamX * maxParallax | 0})`);
    }
    const floor = stage.floor || [stage.horizonY, stage.plate ? stage.plate.height : scene.frame.height];
    for (const id of shot.cast || []) {
      const a = castById[id];
      if (!a) continue; // unknown-cast throws in the frame loop with a clearer message
      for (const d of a.depthKeys ? a.depthKeys.map((k) => k.depth) : [a.depth]) {
        if (!soleInBand(d, stage, floor)) throw new Error(`shot ${si}: cast '${a.id}' at depth ${d}: sole line leaves the floor ${floor}`);
      }
    }
  });
  // cut-continuity: an actor carried across a cut must be loop-safe (whole-cel
  // holds are always loop-safe; a non-loop clip may not straddle a cut boundary)
  for (let i = 0; i < scene.shots.length - 1; i += 1) {
    const carried = (scene.shots[i].cast || []).filter((id) => (scene.shots[i + 1].cast || []).includes(id));
    for (const id of carried) {
      if (castById[id]?.loop === false) throw new Error(`non-loop cast '${id}' straddles the cut ${i}→${i + 1}`);
    }
  }
  return true;
}
