/**
 * Gait cels — spike 2: the walk cycle authored by the figure rig's gait()
 * instead of hand-tuned stick poses (pan-cel-motion.plan.md, round-3
 * retrospective: "the rig's gait() is the reference for even phase
 * spacing"). This is the plan's "optional higher-fidelity pose source"
 * earning its place:
 *
 *   - gait(WALK_DEFAULTS) samples K uniform phases → per-cel dof poses
 *     with REAL weight shift, uniform regression, loop-perfect closure;
 *   - each phase renders through the protoform mesher (lateral view,
 *     transparent bg) as the cel's pose scaffold — a silhouette contract
 *     far stronger than sticks for the pose-critical walk shot;
 *   - the stride is MEASURED, not assumed: consecutive phase overlays are
 *     cross-correlated over their feet strip, and the median planted-foot
 *     regression IS the pan px/frame (the gait-camera principle — phase
 *     advances by distance — compiled into a plain number the manifest
 *     stores, like waypoints→ticks).
 *
 * Throwaway-grade; on promotion this folds into the motion-outcome mint
 * as `cels: { source: 'gait', ... }`.
 */

import sharp from 'sharp';

import { renderFigureToSvg } from '../../polygonizer/figure-render.js';
import { gait, WALK_DEFAULTS } from '../../polygonizer/figure-posing.js';

/** Sample K uniform gait phases → cel entries with the rig's dof pose. */
export function buildGaitCels(K = 6) {
  const g = gait(WALK_DEFAULTS);
  return Array.from({ length: K }, (_, k) => ({
    id: `g${k + 1}`,
    phase: k / K,
    dof: g(k / K),
  }));
}

/**
 * Render one gait cel's rig overlay in CEL SPACE: a transparent rect-sized
 * SVG with the protoform figure anchored exactly like the stick figures
 * were (mid-torso at the manifest figure anchor; the rigFigureSvg
 * geometry: h = 200·scale spanning y−96s … y+104s, feet on the ground
 * line). Same anchor → the registration + shadow pipeline applies as-is.
 */
export function gaitCelOverlaySvg({ dof, rect, figure, proto = { sex: 'female' }, view = 'lateral' }) {
  const doc = renderFigureToSvg({ pose: dof, proto, view, background: false });
  const match = doc.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!match) throw new Error('gait cel: protoform render returned no <svg viewBox>');
  const [, viewBox, inner] = match;
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
  const s = figure.scale;
  const h = 200 * s;
  const w = h * (vbW / vbH);
  const x = figure.x - rect.x;
  const y = figure.y - rect.y;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rect.w} ${rect.h}" width="${rect.w}" height="${rect.h}"><svg x="${x - w / 2}" y="${y - 96 * s}" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMax meet">${inner}</svg></svg>`;
}

/**
 * Measure the gait's ground speed in cel pixels/frame: for each pair of
 * consecutive phase overlays, find the horizontal shift that best aligns
 * their feet strips (bottom `strip` px of alpha). The planted foot
 * dominates the strip, so the best shift ≈ its regression. Median across
 * the cycle = pan px/frame. Deterministic; measured once at authoring.
 */
export async function measureGaitStride(overlayPngs, { w, h, maxShift = 70, alphaFloor = 40 }) {
  // Per phase: the pixels touching the ground are the bottom rows of the
  // figure's own alpha (each phase's maxY — padding-proof). Cluster them
  // in x; each cluster is a foot in contact.
  const clustersPerPhase = [];
  for (const png of overlayPngs) {
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let maxY = 0;
    for (let y = h - 1; y >= 0 && !maxY; y -= 1) {
      for (let x = 0; x < w; x += 1) if (data[(y * w + x) * 4 + 3] > alphaFloor) { maxY = y; break; }
    }
    const cols = new Array(w).fill(0);
    for (let y = Math.max(0, maxY - 8); y <= maxY; y += 1) {
      for (let x = 0; x < w; x += 1) if (data[(y * w + x) * 4 + 3] > alphaFloor) cols[x] += 1;
    }
    const clusters = [];
    let start = -1;
    let gap = 0;
    for (let x = 0; x <= w; x += 1) {
      const on = x < w && cols[x] > 0;
      if (on && start === -1) { start = x; gap = 0; }
      else if (!on && start !== -1 && (gap += 1) > 18) {
        clusters.push(centroid(cols, start, x - gap));
        start = -1;
      }
    }
    if (start !== -1) clusters.push(centroid(cols, start, w - 1));
    clustersPerPhase.push(clusters);
  }
  // The planted foot is the cluster pair with the SMALLEST movement between
  // consecutive phases, and it moves backward (dx ≤ small noise) — the
  // swing foot jumps forward by a large +dx and is excluded. Sample at
  // high phase resolution (small per-step motion → unambiguous matches)
  // and SUM the regression around the full cycle: that sum is the ground
  // the body gains per cycle.
  const shifts = [];
  for (let k = 0; k < clustersPerPhase.length; k += 1) {
    const a = clustersPerPhase[k];
    const b = clustersPerPhase[(k + 1) % clustersPerPhase.length];
    let best = null;
    for (const xa of a) {
      for (const xb of b) {
        const dx = xb - xa;
        if (dx <= 3 && dx >= -maxShift && (best === null || Math.abs(dx) < Math.abs(best))) best = dx;
      }
    }
    shifts.push(best === null ? null : -best);
  }
  const tracked = shifts.filter((s) => s !== null);
  if (tracked.length < clustersPerPhase.length * 0.7) {
    throw new Error(`measureGaitStride: planted-foot track too sparse (${tracked.length}/${clustersPerPhase.length}) — raise the sample count`);
  }
  // untracked pairs (double-support ambiguity) take the tracked mean
  const mean = tracked.reduce((s, v) => s + v, 0) / tracked.length;
  const cycleAdvancePx = shifts.reduce((s, v) => s + (v ?? mean), 0);
  return { shifts, cycleAdvancePx };
}

function centroid(cols, x0, x1) {
  let sum = 0;
  let weight = 0;
  for (let x = x0; x <= x1; x += 1) { sum += x * cols[x]; weight += cols[x]; }
  return weight ? sum / weight : (x0 + x1) / 2;
}

/**
 * The gait-locked manifest: same plate, key, frame, and staging as the
 * walk fixture, but cels are gait phases and the window is DERIVED —
 * linear, at the measured stride speed, for as many frames as the plate's
 * pan room affords (shot length is a derived quantity; round 3).
 */
export function gaitWalkManifest(baseFixture, gaitCels, panPerFrame) {
  const panRoom = baseFixture.plate.viewBox.width - baseFixture.frame.width;
  const frames = Math.floor(panRoom / panPerFrame) + 1;
  return {
    ...baseFixture,
    title: `${baseFixture.title} — gait-locked`,
    fps: 6,
    durationSec: frames / 6,
    cels: gaitCels.map((c) => ({ id: c.id, pose: `gait@${c.phase.toFixed(3)}`, facing: 'right', dof: c.dof })),
    schedule: { ...baseFixture.schedule, cycle: gaitCels.map((c) => c.id) },
    window: {
      keyframes: [
        { t: 0, x: 0, y: 128, scale: 1 },
        { t: 1, x: Math.round((frames - 1) * panPerFrame), y: 128, scale: 1 },
      ],
      easing: 'linear',
    },
    gait: { source: 'figure-rig gait(WALK_DEFAULTS)', panPerFrame, frames },
  };
}

export function buildGaitCelInstructions(manifest, cel, { crop }) {
  return [
    `# ${manifest.title} — cel ${cel.id}`,
    '',
    `One animation cel of a ${manifest.schedule.cycle.length}-phase walk cycle at ${manifest.fps} fps, pose authored by the figure rig's gait engine (phase ${cel.pose}).`,
    '',
    'THIS IS AN ACETATE CEL, traditional animation style: paint the CHARACTER ONLY on a fully TRANSPARENT background (alpha PNG). Flat chroma green (#00ff00) only if transparency is impossible.',
    '',
    'CONDITIONING: (1) the character key — identity + lighting contract; (2) THIS cel\'s rig scaffold — a 3D-posed mannequin in the exact walk phase. Match its silhouette precisely: limb positions, knee bend, weight shift, stride width, foot placement. The mannequin is the pose; the key sheet is the person.',
    '',
    'Facing: full right profile, walking toward frame-right.',
    '',
    'LIGHTING LOCK: same character, same light — light direction, shadow side, and color temperature must match the character key exactly; only the pose changes.',
    '',
    ...(crop ? [`Canvas size exactly ${crop.w}×${crop.h}. Place the character exactly where the mannequin stands.`, ''] : []),
    '## Must Preserve',
    '- the character exactly as the key sheet defines her',
    '- the mannequin\'s silhouette — this cycle\'s timing is measured from it, so pose drift becomes foot-slip',
    '- rim/fill consistent with the key light (low sun from frame-left)',
    '',
    '## Avoid',
    '- NO background, ground, sky, or gradient; NO cast shadow (the compositor owns it)',
    '- no readable text, borders, labels; no motion blur',
  ].join('\n');
}
