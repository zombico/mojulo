/**
 * Window-path + schedule resolvers — the deterministic motion layer
 * (pan-cel-motion.plan.md, spike build step 5 groundwork). Pure functions of
 * the manifest: same manifest → same per-frame crop rects and cel schedule.
 * No Date, no randomness.
 */

const EASINGS = {
  linear: (t) => t,
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

export function frameCount(manifest) {
  return Math.round(manifest.fps * manifest.durationSec);
}

/**
 * Resolve the window path to one crop rect per frame (plate coordinates).
 * scale < 1 = crop-zoom in (window shrinks; the raster step scales back up).
 */
export function resolveWindowPath(manifest) {
  const { keyframes, easing = 'linear' } = manifest.window;
  if (!Array.isArray(keyframes) || keyframes.length < 2) throw new Error('window needs ≥2 keyframes');
  const ease = EASINGS[easing];
  if (!ease) throw new Error(`unknown easing '${easing}' (one of: ${Object.keys(EASINGS).join(', ')})`);
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  const n = frameCount(manifest);
  const { width: fw, height: fh } = manifest.frame;
  const plate = manifest.plate.viewBox;

  const rects = [];
  for (let f = 0; f < n; f += 1) {
    const t = ease(n === 1 ? 0 : f / (n - 1));
    // find the bracketing keyframes
    let a = sorted[0];
    let b = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      if (t >= sorted[i].t && t <= sorted[i + 1].t) { a = sorted[i]; b = sorted[i + 1]; break; }
    }
    const span = b.t - a.t || 1;
    const u = (t - a.t) / span;
    const lerp = (ka, kb) => ka + (kb - ka) * u;
    const scale = lerp(a.scale ?? 1, b.scale ?? 1);
    const w = Math.round(fw * scale);
    const h = Math.round(fh * scale);
    const x = Math.round(lerp(a.x, b.x));
    const y = Math.round(lerp(a.y, b.y));
    if (x < 0 || y < 0 || x + w > plate.width || y + h > plate.height) {
      throw new Error(`frame ${f}: window {${x},${y} ${w}×${h}} leaves the plate ${plate.width}×${plate.height}`);
    }
    rects.push({ x, y, w, h });
  }
  return rects;
}

/**
 * Resolve the cel schedule: which cel plays on each frame, and where its
 * hotspot rect sits in FRAME coordinates ('frame' anchor: fixed; 'plate'
 * anchor: the cel holds a plate position and the window slides past it).
 */
export function resolveSchedule(manifest, windowRects) {
  const { cycle, anchor = 'frame', celRect } = manifest.schedule;
  const known = new Set(manifest.cels.map((c) => c.id));
  for (const id of cycle) {
    if (!known.has(id)) throw new Error(`schedule.cycle references unknown cel '${id}'`);
  }
  const n = windowRects.length;
  const frames = [];
  for (let f = 0; f < n; f += 1) {
    const celId = cycle[f % cycle.length];
    let rect;
    if (anchor === 'frame') {
      rect = { ...celRect };
    } else if (anchor === 'plate') {
      const win = windowRects[f];
      rect = { x: celRect.x - win.x, y: celRect.y - win.y, w: celRect.w, h: celRect.h };
    } else {
      throw new Error(`unknown schedule.anchor '${anchor}' (frame | plate)`);
    }
    frames.push({ frame: f, celId, rect });
  }
  return frames;
}

/**
 * The representative plate crop for a cel — the plate region under the cel's
 * hotspot at its MIDDLE occurrence. This is what an in-place cel generation
 * is conditioned on (plan: generation order, stage 3).
 */
export function representativeCrop(manifest, windowRects, celId) {
  const { cycle, celRect } = manifest.schedule;
  const idx = cycle.indexOf(celId);
  if (idx === -1) throw new Error(`cel '${celId}' is not in schedule.cycle`);
  const occurrences = [];
  for (let f = 0; f < windowRects.length; f += 1) {
    if (f % cycle.length === idx) occurrences.push(f);
  }
  const mid = occurrences[Math.floor(occurrences.length / 2)];
  const win = windowRects[mid];
  return {
    frame: mid,
    x: win.x + Math.round((celRect.x * win.w) / manifest.frame.width),
    y: win.y + Math.round((celRect.y * win.h) / manifest.frame.height),
    w: Math.round((celRect.w * win.w) / manifest.frame.width),
    h: Math.round((celRect.h * win.h) / manifest.frame.height),
  };
}
