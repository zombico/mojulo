/**
 * The STAGE depth kernel (scene-staging.plan.md, Axis 1). Pure arithmetic — no
 * sharp, no I/O, no Date/Math.random — so the S0 "placement is arithmetic, not
 * eyeballing" claim is unit-testable against synthetic layers BEFORE any plate
 * exists.
 *
 * The result the plan derived: on a flat ground plane under a fixed camera, ONE
 * depth factor
 *
 *     k(d) = dRef / d
 *
 * governs scale, floor-height, lateral placement, AND parallax. You tune dRef +
 * horizonY + groundYRef once (the stage), then every actor at any depth places
 * by construction.
 *
 * ACTORS (meru clips) take size + floor-y + parallax from k. BANDS (2D authored
 * plate crops) take ONLY parallax from k and are drawn at their authored size —
 * never scaled by k, or you shrink the plate.
 */

/**
 * A stage: the ground-plane contract a plate declares.
 * - unit:       the meru span in px (crown→ground; 859 for k1/k2 clips)
 * - dRef:       the depth where a clip draws at native `unit` size (k=1)
 * - horizonY:   the vanishing line in plate px (soles converge here as d→∞)
 * - groundYRef: the reference sole line in plate px (where a d=dRef actor stands)
 */
export function makeStage({ unit = 859, dRef = 1, horizonY, groundYRef }) {
  if (!(horizonY < groundYRef)) {
    throw new Error(`stage: horizonY (${horizonY}) must be above groundYRef (${groundYRef})`);
  }
  if (!(dRef > 0)) throw new Error(`stage: dRef must be > 0 (got ${dRef})`);
  return { unit, dRef, horizonY, groundYRef };
}

/**
 * The stage `unit` (how tall a person APPEARS at the reference depth in this
 * plate) is a per-plate SCALE FIT — NOT the clip's native pixel height. It's set
 * by the camera height: on a flat ground plane, footY(d)−horizon = h·span(d),
 * where h is the camera's height in person-units. So
 *
 *     unit = (groundYRef − horizonY) / h
 *
 * h ≈ 0.93 is an eye-level camera (a standing figure's eyes land on the horizon —
 * the correct-scale rule). Smaller h → a low, looming camera (subjects read as
 * giants). This is the meru-lock analog for backgrounds: fit `unit` to the plate,
 * don't paste the clip's own height in. `drawBox` scales the native clip to `unit`.
 */
export function eyeLevelUnit(groundYRef, horizonY, cameraHeight = 0.93) {
  return (groundYRef - horizonY) / cameraHeight;
}

/** k(d) = dRef/d — the ONLY free function; everything below is it. */
export function depthFactor(depth, stage) {
  if (!(depth > 0)) throw new Error(`depth must be > 0 (got ${depth})`);
  return stage.dRef / depth;
}

/** Drawn span of a meru actor at depth d = unit·k(d). */
export function scaleAt(depth, stage) {
  return depthFactor(depth, stage);
}

/** Sole-line (plate y) for an actor at depth d — rises toward the horizon with depth. */
export function footY(depth, stage) {
  const k = depthFactor(depth, stage);
  return stage.horizonY + (stage.groundYRef - stage.horizonY) * k;
}

/** Parallax factor at depth d — screen px per reference-plane camera px. Same k. */
export function parallax(depth, stage) {
  return depthFactor(depth, stage);
}

/**
 * Place a meru ACTOR under a camera window. Returns the target sole point and
 * drawn height in plate/screen px; the image-anchor math (left/top of the clip
 * raster) is drawBox's job.
 *
 *   actor:  { markX, depth }   markX = plate-x of the sole point at authoring
 *   camera: { camX, camY, zoom }  camX/camY are reference-plane pan (k=1) px
 */
export function placeActor(actor, camera, stage, center = { x: 0, y: 0 }) {
  const { markX, depth } = actor;
  const { camX = 0, camY = 0, zoom = 1 } = camera;
  const k = depthFactor(depth, stage);
  // pan first (in unzoomed screen space), then zoom about the frame CENTER — a
  // push/pull scales toward the middle of frame, not the top-left corner.
  const sx = markX - camX * k;
  const sy = footY(depth, stage) - camY * k;
  return {
    depth,
    k,
    scale: k * zoom,
    span: stage.unit * k * zoom,
    footSx: center.x + (sx - center.x) * zoom,
    footSy: center.y + (sy - center.y) * zoom,
  };
}

/**
 * Turn a placeActor result into a composite box for the clip raster.
 *   clip: { width, height, cx, groundY, span }  the clip's OWN native anchors
 *         (832×1216, cx≈416, groundY 1037, span 859 for k1/k2).
 * left/top are where the scaled clip raster goes so its own sole point lands on
 * (footSx, footSy) and its own center-x lands on footSx.
 */
export function drawBox(place, clip) {
  const scale = place.span / clip.span;
  return {
    scale,
    width: clip.width * scale,
    height: clip.height * scale,
    left: place.footSx - clip.cx * scale,
    top: place.footSy - clip.groundY * scale,
  };
}

/**
 * Place a plate BAND under the camera — parallax only, no scale. `originX`/
 * `originY` are the band raster's top-left in plate px at camera 0.
 */
export function placeBand(band, camera, stage, center = { x: 0, y: 0 }) {
  const { originX = 0, originY = 0, depth } = band;
  const { camX = 0, camY = 0, zoom = 1 } = camera;
  const k = depthFactor(depth, stage);
  const tlx = originX - camX * k;
  const tly = originY - camY * k;
  return {
    depth,
    k,
    left: center.x + (tlx - center.x) * zoom,   // zoom about the frame center too
    top: center.y + (tly - center.y) * zoom,
    scale: zoom, // band raster scales with the lens
  };
}

/** Painter's order: far → near, so nearer layers (bands or actors) draw last. */
export function depthSort(layers) {
  return [...layers].sort((a, b) => b.depth - a.depth);
}

/**
 * Plate-headroom precondition (scene-staging.plan.md, validator teeth). The
 * window excursion must stay inside every band at ITS parallax; the FASTEST
 * (nearest) band reveals an edge first, so check against max parallax.
 */
export function headroomOk({ plateWidth, frameWidth, maxCamX, maxParallax }) {
  return plateWidth >= frameWidth + Math.abs(maxCamX) * maxParallax;
}

/**
 * Sole-in-band gate — a placement whose sole line leaves the plate's floor range
 * is refused (coherence by construction). `floor` is [minY, maxY] in plate px.
 */
export function soleInBand(depth, stage, floor) {
  const y = footY(depth, stage);
  return y >= floor[0] && y <= floor[1];
}

/**
 * Ground CONTACT shadow (scene-staging.plan.md — an effect-cheat layer, drawn by
 * mojulo, never by the worker). A soft AO pool under the feet — direction-agnostic
 * (no light vector needed), so it's always correct and needs nothing from the
 * plate. A flat ellipse centered on the sole point, its size riding the drawn
 * figure so it shrinks with depth exactly like the actor (both scale with `span`).
 * Returns an ellipse spec in screen px, or null when the actor is off-frame.
 */
export function groundShadow(place, { spread = 0.19, flatten = 0.22, opacity = 0.4 } = {}) {
  const rx = place.span * spread;   // half-width ≈ stance width at this depth
  const ry = rx * flatten;          // flat pool (ground seen at a shallow angle)
  return { cx: place.footSx, cy: place.footSy, rx, ry, opacity };
}
