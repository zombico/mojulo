/**
 * Motion — the three.js WORLD subject family. A stored, world-eligible sketch
 * (fractal-city, transportation-hub, room, painted-landscape, planetary, …) is
 * put under one of the same camera motions the manji-SVG path uses (turntable /
 * orbit / push_in / dolly_zoom / flythrough) and baked to raster frames via
 * headless WebGL.
 *
 * The camera-path generators (camera-path.js) are backend-agnostic: they emit
 * per-frame { worldFraming:{ cameraPosition, lookAt, horizontalFov } }, the exact
 * shape the World's camera consumes. We reuse them verbatim, convert the
 * horizontal FOV to the World's vertical FOV at the capture aspect, attach a
 * per-frame sim-time, and drive the capture-mode World a frame at a time.
 *
 * A World has NO SVG flipbook — its only durable motion form is the raster
 * GIF / MP4 (or re-rendering headless from the recipe). So this path returns PNG
 * buffers (framePngs), not frameSvgs, and forge_motion files it accordingly.
 */

import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld, verticalFov } from '@/lib/graph/scene/scene-three';
import { cameraPathFor, CAMERA_MOTIONS } from './camera-path.js';
import { renderWorldFrames, renderWorldTraversal, compileWorldWaypoints } from './world-frames.js';

export const WORLD_MOTION_NAMES = Object.keys(CAMERA_MOTIONS);

const DEFAULT_FRAMES = { turntable: 24, orbit: 18, push_in: 24, dolly_zoom: 24, flythrough: 36 };
const DEFAULT_W = 720;
const DEFAULT_H = 540;

/**
 * Resolve the base camera shot for a World payload. Prefers the world's first
 * authored framing bookmark (payload.cameras[0].worldFraming); falls back to a
 * 3/4 orbit of the geometry's bounding box (mirroring emitThreeWorld's own
 * camera fallback) so a world with no authored camera still animates.
 */
export function deriveBaseShot(payload) {
  const wf = payload?.cameras?.[0]?.worldFraming;
  if (wf && Array.isArray(wf.cameraPosition) && Array.isArray(wf.lookAt)) {
    return { cameraPosition: wf.cameraPosition, lookAt: wf.lookAt, horizontalFov: wf.horizontalFov ?? 50 };
  }
  // bounds fallback: scan face corners for an axis-aligned bbox → centre + radius.
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const f of payload?.faces || []) {
    for (const c of f?.corners || []) {
      for (let k = 0; k < 3; k++) {
        const v = c[k];
        if (Number.isFinite(v)) { if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
      }
    }
  }
  if (!Number.isFinite(mn[0])) { mn[0] = mn[1] = mn[2] = 0; mx[0] = mx[1] = mx[2] = 1; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const r = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1) * 0.6;
  return {
    cameraPosition: [center[0] + r * 1.1, center[1] - r * 1.1, center[2] + r * 0.8],
    lookAt: center,
    horizontalFov: 55,
  };
}

/**
 * Render a camera motion over a world-eligible sketch to raster frames.
 *
 * @param {object} args
 * @param {object} args.sketch   a stored sketch row (manifest world-eligible)
 * @param {string} args.motion   one of WORLD_MOTION_NAMES
 * @param {object} [args.params] per-motion params (from/to, end_scale, keyframes, fov, width/height)
 * @param {number} [args.frames] frame count (defaults per motion)
 * @param {number} [args.fps]
 * @param {boolean}[args.loop]
 * @returns {Promise<{ framePngs: Buffer[], width:number, height:number, viewBox:number[], meta:object }>}
 */
export async function renderWorldMotion({ sketch, motion, params = {}, frames, fps = 12, loop = true }) {
  if (!WORLD_MOTION_NAMES.includes(motion)) {
    throw new Error(`unknown world camera motion '${motion}'. Supported: ${WORLD_MOTION_NAMES.join(', ')}.`);
  }
  const { payload } = await resolveWorldScene(sketch, { view: params.view });
  if (!payload) {
    throw new Error(
      `sketch '${sketch.ref}' (kind '${sketch.manifest?.kind}') has no traversable three.js World form. `
      + 'World motions animate world-eligible kinds (fractal-city, transportation-hub, subway-station, '
      + 'painted-landscape, planetary, floorplan, workbench, room). Other kinds animate as a manji-tree (sketch_ref) or deck.',
    );
  }

  const width = Math.round(params.width || DEFAULT_W);
  const height = Math.round(params.height || DEFAULT_H);
  const aspect = width / height;
  const frameCount = frames || DEFAULT_FRAMES[motion] || 24;

  // Backend-agnostic camera path: feed the world's base framing in as a synthetic
  // manji-tree-shaped manifest so cameraPathFor's resolveBaseShot picks it up.
  const base = deriveBaseShot(payload);
  const manifest = { camera: { worldFraming: base, viewBox: { width, height } } };
  const { cameras } = cameraPathFor(motion, { manifest, frames: frameCount, params });

  // Each path camera → a capture spec: world pos/target, vertical FOV at the capture
  // aspect, and a per-frame sim-time so any animated world channels play in real time.
  const specs = cameras.map((cam, i) => {
    const w = cam.worldFraming;
    return {
      pos: w.cameraPosition,
      target: w.lookAt,
      vfov: verticalFov(w.horizontalFov, aspect),
      t: (i * 1000) / Math.max(1, fps),
    };
  });

  const html = emitThreeWorld({
    ...payload,
    inline: true,
    capture: true,
    walk: false,            // capture drives the camera explicitly; no FPV traverse
    wireframe: !!params.wireframe,
    decollide: params.decollide !== false,
  });

  const { pngs } = await renderWorldFrames(html, specs, { width, height });

  return {
    framePngs: pngs,
    width,
    height,
    viewBox: [0, 0, width, height],
    meta: { motion, frames: frameCount, fps, loop, backend: 'three' },
  };
}

/**
 * Replay a TRAVERSAL over a stored world sketch (renderer-ladder P3): an input script — one
 * normalized input snapshot per tick at a fixed rate — drives the world's live channels
 * (controllable entities, physics, events) and is baked to raster frames plus a per-tick probe
 * stream. The ticks ARE the recipe: the model layer is wall-clock-free, so the same stored
 * { world_ref, ticks, fps } reproduces the identical run, frames, and probes.
 *
 * Camera: a camera ENTITY in the world's manifest (follow / FPV) owns the view; `params.camera`
 * may inject one (the same { rule, target, ... } sugar the controllable channel takes) for
 * worlds that ship without; otherwise the world's authored framing holds a static wide shot.
 *
 * @param {object} args
 * @param {object} args.sketch   stored-sketch-like { manifest, title, ref }
 * @param {Array<object|null>} args.ticks  input snapshots ({ forward, strafe, turn, jump, lookDX, ... })
 * @param {number} [args.fps=24]
 * @param {object} [args.params]  { width, height, camera, view, frames:false → probes only }
 * @returns {Promise<{ framePngs, probes, width, height, viewBox, meta }>}
 */
export async function renderWorldTraversalMotion({ sketch, ticks, waypoints, fps = 24, params = {} }) {
  if ((!Array.isArray(ticks) || !ticks.length) && (!Array.isArray(waypoints) || !waypoints.length)) {
    throw new Error("a traversal needs a non-empty 'ticks' input script (one snapshot per tick — {} for idle ticks) or a 'waypoints' route to compile into one.");
  }
  const { payload } = await resolveWorldScene(sketch, { view: params.view });
  if (!payload) {
    throw new Error(`sketch '${sketch.ref}' (kind '${sketch.manifest?.kind}') has no traversable three.js World form.`);
  }
  if (params.camera && params.camera.rule) payload.camera = params.camera;   // inject a follow/FPV camera entity

  const width = Math.round(params.width || DEFAULT_W);
  const height = Math.round(params.height || DEFAULT_H);

  const html = emitThreeWorld({
    ...payload,
    inline: true,
    capture: true,
    walk: false,            // the input script drives entities; no interactive FPV layer
    decollide: params.decollide !== false,
  });

  // WAYPOINT route (renderer-convergence step 3): compile "walk to X" into ticks against the
  // live rule (one page load), then REPLAY those ticks on a fresh load below — the stored
  // recipe stays a plain tick script, so every Phase-3 determinism guarantee holds unchanged.
  // A blocked leg surfaces in `legs` (the compiled prefix still renders, so the failure is
  // watchable, and the final probe shows where the run died).
  let legs = null;
  if (!Array.isArray(ticks) || !ticks.length) {
    const compiled = await compileWorldWaypoints(html, waypoints, { fps, id: params.entity || null });
    if (!compiled.ticks.length) {
      throw new Error(`waypoint compile produced no ticks (first leg: ${JSON.stringify(compiled.legs[0] || null)})`);
    }
    ticks = compiled.ticks;
    legs = compiled.legs;
  }

  const { pngs, probes } = await renderWorldTraversal(html, ticks, {
    fps, width, height, frames: params.frames !== false,
  });

  return {
    framePngs: pngs,
    probes,
    ticks,                   // the (possibly compiled) script — callers persist THIS as the recipe
    ...(legs ? { legs } : {}),
    width,
    height,
    viewBox: [0, 0, width, height],
    meta: { motion: 'traversal', frames: ticks.length, fps, loop: false, backend: 'three' },
  };
}
