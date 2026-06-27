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

import { resolveWorldScene } from '@/lib/graph/world-scene';
import { emitThreeWorld, verticalFov } from '@/lib/graph/scene-three';
import { cameraPathFor, CAMERA_MOTIONS } from './camera-path.js';
import { renderWorldFrames } from './world-frames.js';

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
