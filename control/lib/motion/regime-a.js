/**
 * Motion — Regime A render path: render the slide ONCE, then (a) attach the CSS
 * <style> for the live self-contained svg, and (b) stamp the per-frame bake onto
 * the addressable mark groups for the GIF — no geometry re-render. The compositor
 * (flipbook/M1) is bypassed. See motion-regime-a.plan.md.
 *
 * A slide opts in by giving a mark an `animate: { channel, ...params }`. The mark
 * group is addressable as `.moj-mark[data-idx="i"]` (CreationMap structured-emit).
 */

import { renderSketchToSvg } from '../graph/sketch/sketch-svg.js';
import { compileMotionCss } from './css-motion.js';
import { stripSketchBody, DECK_BG } from './deck.js';

/** True when any of a slide's marks carry an `animate` spec (→ Regime A). */
export function hasAnimate(slide) {
  return Array.isArray(slide?.marks) && slide.marks.some((m) => m && m.animate);
}

/** Inject transform/opacity onto the addressable mark group `data-idx="idx"`. */
function stampGroup(body, idx, { transform, opacity }) {
  const attrs = [
    transform ? `transform="${transform}"` : '',
    opacity !== undefined ? `opacity="${opacity}"` : '',
  ].filter(Boolean).join(' ');
  if (!attrs) return body;
  return body.replace(new RegExp(`(<g class="moj-mark"[^>]*\\bdata-idx="${idx}")`), `$1 ${attrs}`);
}

function frameSvg({ body, viewBox, width, bgFill, style = '' }) {
  const [x, y, w, h] = viewBox;
  const outW = width || Math.min(900, w);
  const outH = Math.round((outW * h) / w);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${outW}" height="${outH}">`,
    style,
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgFill}" />`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Render a single animate-annotated slide as Regime A. Returns renderMotion's
 * shape: `flipbookSvg` is the LIVE css-animated svg (the durable form); `frameSvgs`
 * are the baked frames (the gif source).
 */
export async function renderRegimeA(slide, { fps = 16, width, surface = 'dark', vars = null, bg = DECK_BG } = {}) {
  const specs = (slide.marks || [])
    .map((m, idx) => (m.animate ? { idx, ...m.animate } : null))
    .filter(Boolean);
  if (!specs.length) throw new Error('renderRegimeA: slide has no marks with an `animate` spec');

  const full = await renderSketchToSvg(slide, { includeXmlDecl: false, surface, vars });
  const body = stripSketchBody(full); // keeps the <g class="moj-mark"> groups + text

  const vb = slide.viewBox || { width: 880, height: 520 };
  const viewBox = [0, 0, vb.width, vb.height];
  const compile = compileMotionCss(specs, slide.marks, { fps });

  // live svg — one render + the @keyframes layer (plays as <img>)
  const flipbookSvg = frameSvg({ body, viewBox, width, bgFill: bg, style: compile.style });

  // baked frames — stamp the same transforms on the single render, per frame
  const N = compile.frameCount;
  const frameSvgs = [];
  for (let i = 0; i < N; i += 1) {
    const t = compile.looping ? i / N : i / Math.max(1, N - 1);
    const stamped = compile.bake(t).reduce((b, s) => stampGroup(b, s.idx, s), body);
    frameSvgs.push(frameSvg({ body: stamped, viewBox, width, bgFill: bg }));
  }

  return {
    frameSvgs,
    flipbookSvg,
    viewBox,
    meta: { motion: 'deck', frames: N, slides: 1, animated: true, regime: 'A', fps, loop: compile.looping },
  };
}
