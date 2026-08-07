/**
 * Motion — camera-path generators (the proven Staging recipes).
 *
 * Each generator turns a base shot (the subject's own `camera.worldFraming`,
 * plus optional per-motion params) into an array of N per-frame camera objects
 * shaped exactly like the engine expects:
 *
 *     { worldFraming: { cameraPosition:[x,y,z], lookAt:[x,y,z], horizontalFov },
 *       viewBox: { width, height } }
 *
 * The mechanisms are subject-agnostic — the same orbit/dolly code framed a
 * figure (turntable spike) and a canyon terrain (flythrough spike). worldUp is
 * the Zenith–Nadir (z) axis, matching `projectTwoPointPinhole`, so the orbit
 * azimuth lives in the x–y plane and camera height (z above the lookAt) holds.
 *
 * Camera motions split by how the subject sits in frame:
 *   - 'union'  — the subject centre projects to picture-centre every frame, so a
 *                shared (union) viewBox locks it while the camera circles it
 *                (turntable / orbit). Computed downstream in frame-render.
 *   - 'fixed'  — the shot genuinely re-frames, so it renders into a fixed film
 *                frame; off-frame world clips (push-in / dolly-zoom / flythrough).
 */

import { catmullRom, crChannel, smoother } from './easing.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

const DEFAULT_BASE = {
  cameraPosition: [0, -8, 2.6],
  lookAt: [0, 0, 2],
  horizontalFov: 42,
};
const DEFAULT_VIEWBOX = { width: 640, height: 800 };

/**
 * Resolve the base shot from the subject manifest, with optional param
 * overrides. Prefers the subject's authored camera; falls back to sane figure
 * defaults so a camera-less manji-tree still animates.
 */
export function resolveBaseShot(manifest, params = {}) {
  const wf = manifest?.camera?.worldFraming || {};
  const base = {
    cameraPosition: params.camera_position || wf.cameraPosition || DEFAULT_BASE.cameraPosition,
    lookAt: params.look_at || wf.lookAt || DEFAULT_BASE.lookAt,
    horizontalFov:
      params.fov ?? wf.horizontalFov ?? DEFAULT_BASE.horizontalFov,
  };
  const vb = manifest?.camera?.viewBox || {};
  const viewBox = {
    width: params.width || vb.width || DEFAULT_VIEWBOX.width,
    height: params.height || vb.height || DEFAULT_VIEWBOX.height,
  };
  return { base, viewBox };
}

/** Decompose the camera offset (cameraPosition − lookAt) into orbit coords. */
function toOrbit(base) {
  const d = sub(base.cameraPosition, base.lookAt);
  const rH = Math.hypot(d[0], d[1]);
  // azimuth such that [dx,dy] = [rH·sin(az), −rH·cos(az)] (matches the spike rig)
  const azimuth = Math.atan2(d[0], -d[1]);
  return { rH, azimuth, height: d[2] };
}

function orbitCamera(base, viewBox, azimuth, height, rH) {
  return {
    worldFraming: {
      cameraPosition: add(base.lookAt, [
        rH * Math.sin(azimuth),
        -rH * Math.cos(azimuth),
        height,
      ]),
      lookAt: base.lookAt,
      horizontalFov: base.horizontalFov,
    },
    viewBox,
  };
}

/**
 * orbit / turntable — circle the camera around the subject's vertical axis.
 * `from`/`to` are azimuth deltas in DEGREES added to the base azimuth; turntable
 * is the full 0→360 loop. Subject stays centred → 'union' viewBox.
 */
export function orbitPath({ base, viewBox, frames, from = 0, to = 360, loop = true }) {
  const { rH, azimuth, height } = toOrbit(base);
  const span = (to - from) * DEG;
  // For a seamless loop, sample i/frames (last frame == first); otherwise span
  // the closed interval i/(frames-1).
  const denom = loop ? frames : Math.max(1, frames - 1);
  const cams = [];
  for (let i = 0; i < frames; i++) {
    const delta = from * DEG + (span * i) / denom;
    cams.push(orbitCamera(base, viewBox, azimuth + delta, height, rH));
  }
  return { cameras: cams, viewBoxStrategy: 'union' };
}

/**
 * push-in / dolly — track the camera straight toward the lookAt along the view
 * axis. `endScale` < 1 moves in (closer), > 1 pulls out. Fixed film frame.
 */
export function pushInPath({ base, viewBox, frames, endScale = 0.5 }) {
  const d = sub(base.cameraPosition, base.lookAt);
  const cams = [];
  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? 0 : i / (frames - 1);
    const s = 1 + (endScale - 1) * smoother(t);
    cams.push({
      worldFraming: {
        cameraPosition: add(base.lookAt, scale(d, s)),
        lookAt: base.lookAt,
        horizontalFov: base.horizontalFov,
      },
      viewBox,
    });
  }
  return { cameras: cams, viewBoxStrategy: 'fixed', fixedViewBox: viewBox };
}

/**
 * dolly-zoom (Vertigo) — track in while counter-zooming the fov so the SUBJECT
 * holds its angular size and the BACKGROUND perspective warps. fov' keeps
 * tan(fov/2)·distance constant. Fixed film frame.
 */
export function dollyZoomPath({ base, viewBox, frames, endScale = 0.55 }) {
  const d = sub(base.cameraPosition, base.lookAt);
  const fov0 = base.horizontalFov * DEG;
  const halfTan0 = Math.tan(fov0 / 2);
  const cams = [];
  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? 0 : i / (frames - 1);
    const s = 1 + (endScale - 1) * smoother(t);
    // subject angular size ∝ 1/(distance·tan(fov/2)); hold it ⇒ tan(fov/2) ∝ 1/s
    const fov = 2 * Math.atan(halfTan0 / s) / DEG;
    cams.push({
      worldFraming: {
        cameraPosition: add(base.lookAt, scale(d, s)),
        lookAt: base.lookAt,
        horizontalFov: fov,
      },
      viewBox,
    });
  }
  return { cameras: cams, viewBoxStrategy: 'fixed', fixedViewBox: viewBox };
}

/**
 * flythrough — a keyframed cinematic path. `keyframes` is an array of
 * { pos:[x,y,z], lookAt:[x,y,z], fov } (≥2). Catmull-Rom through the keys with a
 * single global smootherstep over the timeline (start/end ease; loop restarts at
 * ~zero velocity). The world stays locked; only the camera moves. Fixed film frame.
 */
export function flythroughPath({ viewBox, frames, keyframes }) {
  if (!Array.isArray(keyframes) || keyframes.length < 2) {
    throw new Error('flythrough requires shot.params.keyframes with at least 2 entries ({ pos, lookAt, fov })');
  }
  const POS = keyframes.map((k) => k.pos);
  const LOOK = keyframes.map((k) => k.lookAt);
  const FOV = keyframes.map((k) => (k.fov ?? 50));
  const cams = [];
  for (let i = 0; i < frames; i++) {
    const u = smoother(frames === 1 ? 0 : i / (frames - 1)) * (keyframes.length - 1);
    cams.push({
      worldFraming: {
        cameraPosition: [0, 1, 2].map((c) => crChannel(POS.map((p) => p[c]), u)),
        lookAt: [0, 1, 2].map((c) => crChannel(LOOK.map((p) => p[c]), u)),
        horizontalFov: crChannel(FOV, u),
      },
      viewBox,
    });
  }
  return { cameras: cams, viewBoxStrategy: 'fixed', fixedViewBox: viewBox };
}

/**
 * The consolidated camera-motion set (Phase 1: subject-agnostic, works on any
 * manji-tree subject). Each maps a framing verb to a proven recipe.
 */
export const CAMERA_MOTIONS = {
  turntable: 'Full 360° orbit around the subject; it stays centred and spins. Loops seamlessly.',
  orbit: 'Partial orbit around the subject (params.from/to in degrees). Subject stays centred.',
  push_in: 'Track the camera straight toward the subject (params.end_scale < 1 = closer). Re-frames.',
  dolly_zoom: 'Vertigo: track in while counter-zooming fov so the subject holds size and the background warps.',
  flythrough: 'Keyframed cinematic camera path over a locked world (params.keyframes). Re-frames.',
};

/** Dispatch a motion name → per-frame cameras + viewBox strategy. */
export function cameraPathFor(motion, { manifest, frames, params = {} }) {
  const { base, viewBox } = resolveBaseShot(manifest, params);
  switch (motion) {
    case 'turntable':
      return orbitPath({ base, viewBox, frames, from: 0, to: 360, loop: true });
    case 'orbit':
      return orbitPath({
        base,
        viewBox,
        frames,
        from: params.from ?? 0,
        to: params.to ?? 90,
        loop: params.loop ?? false,
      });
    case 'push_in':
      return pushInPath({ base, viewBox, frames, endScale: params.end_scale ?? 0.5 });
    case 'dolly_zoom':
      return dollyZoomPath({ base, viewBox, frames, endScale: params.end_scale ?? 0.55 });
    case 'flythrough':
      return flythroughPath({ viewBox, frames, keyframes: params.keyframes });
    default:
      throw new Error(
        `unknown camera motion '${motion}'. Phase 1 supports: ${Object.keys(CAMERA_MOTIONS).join(', ')}`,
      );
  }
}
