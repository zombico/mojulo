/**
 * The STAGE GUIDE (scene-staging.plan.md, S0) — the meru-guide move applied to
 * BACKGROUNDS. A plate-sized base image that DECLARES the ground plane (horizon,
 * reference sole line, depth-tick figures at U·k(d)) so a worker paints a plate
 * whose ground agrees with the kernel BY CONSTRUCTION. The bank render is an edit
 * of this; scale/floor/depth are then inherited, no per-plate calibration.
 *
 * Honesty about the audit (plan): a plate has no crisp crown/ground like a figure
 * — so the MACHINE gate covers only what IS crisp (dimensions; the magenta guide
 * marks removed; sky≠ground so the plane isn't a flat wash), and the register
 * gate is the operator's EYES over a `stage-overlay.png` (declared horizon + tick
 * figures drawn back over the painted plate). Pure — no sharp, no I/O.
 */

import { footY, scaleAt } from './stage.js';

export const REGISTER_COLOR = '#ff2bd6'; // magenta — far from any sky/ground/skin; audited as removed

/**
 * Guide geometry from a stage manifest. `depthTicks` are the depths shown as
 * scale figures; each is placed across the frame viewport so recession reads.
 */
export function buildStageGuide(stage, { frame, depthTicks = [1, 2, 3] } = {}) {
  if (!frame) throw new Error('buildStageGuide needs a frame { width, height }');
  const width = stage.plate?.width ?? frame.width;
  const height = stage.plate?.height ?? frame.height;
  const frameLeft = Math.round((width - frame.width) / 2); // default window, centered in the plate
  const ticks = depthTicks.map((depth, i) => ({
    depth,
    footY: footY(depth, stage),
    span: stage.unit * scaleAt(depth, stage),
    x: Math.round(frameLeft + (frame.width * (i + 1)) / (depthTicks.length + 1)),
  }));
  return {
    width, height, horizonY: stage.horizonY, groundYRef: stage.groundYRef,
    unit: stage.unit, dRef: stage.dRef, registerColor: REGISTER_COLOR,
    frame: { x: frameLeft, y: 0, w: frame.width, h: frame.height }, ticks,
  };
}

/** Schematic person (head + torso + legs), total height = span, feet at (cx, footY). */
export function personSvg(cx, footY, span, { color = REGISTER_COLOR, fill = 'none', width = 3 } = {}) {
  const headR = span * 0.065;
  const headCy = footY - span + headR;
  const shoulderY = footY - span * 0.82;
  const hipY = footY - span * 0.46;
  const halfW = span * 0.11;
  const stroke = `stroke='${color}' stroke-width='${width}' fill='${fill}'`;
  return [
    `<circle cx='${cx}' cy='${headCy}' r='${headR}' ${stroke}/>`,
    `<path d='M${cx - halfW} ${shoulderY} L${cx + halfW} ${shoulderY} L${cx + halfW * 0.8} ${hipY} L${cx - halfW * 0.8} ${hipY} Z' ${stroke}/>`,
    `<line x1='${cx - halfW * 0.5}' y1='${hipY}' x2='${cx - halfW * 0.6}' y2='${footY}' ${stroke}/>`,
    `<line x1='${cx + halfW * 0.5}' y1='${hipY}' x2='${cx + halfW * 0.6}' y2='${footY}' ${stroke}/>`,
    `<line x1='${cx - halfW}' y1='${footY}' x2='${cx + halfW}' y2='${footY}' ${stroke}/>`,
  ].join('');
}

/**
 * The guide SVG — the BASE image the worker edits. Flat sky/ground hint fills, the
 * horizon + reference sole lines and tick figures in the register color (removed
 * in the paint), the default frame viewport, and depth labels.
 */
export function stageGuideSvg(guide) {
  const { width, height, horizonY, groundYRef, registerColor: rc, frame, ticks } = guide;
  const parts = [`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>`];
  parts.push(`<rect width='${width}' height='${horizonY}' fill='#cfe0f0'/>`);            // sky hint
  parts.push(`<rect y='${horizonY}' width='${width}' height='${height - horizonY}' fill='#b9c9a6'/>`); // ground hint
  parts.push(`<line x1='0' y1='${horizonY}' x2='${width}' y2='${horizonY}' stroke='${rc}' stroke-width='3' stroke-dasharray='14 10'/>`);
  parts.push(`<text x='12' y='${horizonY - 8}' fill='${rc}' font-size='26' font-family='monospace'>horizon</text>`);
  parts.push(`<line x1='0' y1='${groundYRef}' x2='${width}' y2='${groundYRef}' stroke='${rc}' stroke-width='2'/>`);
  parts.push(`<text x='12' y='${groundYRef - 8}' fill='${rc}' font-size='22' font-family='monospace'>ground d=${guide.dRef}</text>`);
  for (const t of ticks) {
    parts.push(personSvg(t.x, t.footY, t.span, { color: rc }));
    parts.push(`<text x='${t.x + t.span * 0.13}' y='${t.footY}' fill='${rc}' font-size='20' font-family='monospace'>d=${t.depth}</text>`);
  }
  parts.push(`<rect x='${frame.x}' y='${frame.y}' width='${frame.w}' height='${frame.h}' stroke='${rc}' stroke-width='4' fill='none' stroke-dasharray='24 12'/>`);
  parts.push('</svg>');
  return parts.join('');
}

/** The eyes-gate overlay — declared horizon + tick figures + frame box, to composite OVER the painted plate. */
export function stageOverlaySvg(guide, { color = '#00ff88' } = {}) {
  const { width, height, horizonY, frame, ticks } = guide;
  const parts = [`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>`];
  parts.push(`<line x1='0' y1='${horizonY}' x2='${width}' y2='${horizonY}' stroke='${color}' stroke-width='2' stroke-dasharray='14 10' opacity='0.9'/>`);
  for (const t of ticks) parts.push(personSvg(t.x, t.footY, t.span, { color, width: 2 }));
  parts.push(`<rect x='${frame.x}' y='${frame.y}' width='${frame.w}' height='${frame.h}' stroke='${color}' stroke-width='3' fill='none' opacity='0.8'/>`);
  parts.push('</svg>');
  return parts.join('');
}

/**
 * Deterministic machine audit of a PAINTED plate (raw RGBA + guide).
 * - dims: matches the declared canvas
 * - linesRemoved: the magenta register marks are gone (< tol of pixels)
 * - groundDistinct: mean color below the horizon differs from above (not a flat
 *   wash) — the softest gate, advisory, but catches a plate with no ground plane
 * The register/floor READ stays the operator's eyes over stage-overlay.png.
 */
export function auditStagePlate(raw, width, height, guide, { registerTol = 0.0008, groundMinDelta = 18 } = {}) {
  const dims = width === guide.width && height === guide.height;
  const [rr, rg, rb] = hexRgb(guide.registerColor);
  let leak = 0;
  let skyN = 0; let groundN = 0;
  const skySum = [0, 0, 0]; const groundSum = [0, 0, 0];
  for (let i = 0; i < width * height; i += 1) {
    const r = raw[i * 4]; const g = raw[i * 4 + 1]; const b = raw[i * 4 + 2];
    if (Math.abs(r - rr) < 40 && Math.abs(g - rg) < 40 && Math.abs(b - rb) < 40) leak += 1;
    const y = (i / width) | 0;
    if (y < guide.horizonY) { skyN += 1; skySum[0] += r; skySum[1] += g; skySum[2] += b; }
    else { groundN += 1; groundSum[0] += r; groundSum[1] += g; groundSum[2] += b; }
  }
  const leakFrac = leak / (width * height);
  const mean = (s, n) => (n ? s.map((v) => v / n) : [0, 0, 0]);
  const sky = mean(skySum, skyN); const ground = mean(groundSum, groundN);
  const groundDelta = Math.abs(sky[0] - ground[0]) + Math.abs(sky[1] - ground[1]) + Math.abs(sky[2] - ground[2]);
  const linesRemoved = leakFrac < registerTol;
  const groundDistinct = groundDelta >= groundMinDelta;
  return {
    dims, linesRemoved, leakFrac: round(leakFrac, 6),
    groundDistinct, groundDelta: round(groundDelta, 1),
    skyMean: sky.map((v) => Math.round(v)), groundMean: ground.map((v) => Math.round(v)),
    pass: dims && linesRemoved, // groundDistinct is advisory, not a hard fail
  };
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const round = (v, p) => Math.round(v * 10 ** p) / 10 ** p;
