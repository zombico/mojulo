/**
 * Motion — the DECK frame source (charts / infographics / slides as a slideshow).
 *
 * Sibling to the camera frame source (camera-path.js + frame-render.js, which
 * orbit/dolly a single manji-tree). A deck has no camera: it is an ORDERED set
 * of independent sketches (KPI dashboards, charts, flow diagrams, title cards)
 * played one-per-beat. It feeds the SAME compositor (flipbook.js) + GIF encoder
 * the camera path uses — proven renderer-agnostic by the deck-motion spike
 * (lite-template/integration/0609/spike-output/deck-motion/). This is "info
 * transfer that needs no figure/scene animation": a report in motion.
 *
 * The one thing it must NOT reuse is the manji stripper (frame-render.js
 * `stripSvgBody`), which drops every <text> as a debug label. Charts ARE text —
 * bar labels, KPI numbers, titles — so this module strips sketch-aware, keeping
 * text and removing only the outer <svg> wrapper.
 */

import { renderSketchToSvg } from '../graph/sketch/sketch-svg.js';
import { composeFlipbook } from './flipbook.js';
import { stillFrameSvg } from './frame-render.js';
import { expandSlide, hasReveals } from './reveal.js';
import { hasAnimate, renderRegimeA } from './regime-a.js';

// Charts are authored on the dark /sketches backdrop; the deck shares it.
export const DECK_BG = '#0b0f16';
const DEFAULT_CANVAS = { width: 880, height: 520 };

export const DECK_MOTIONS = {
  deck: 'Play an ordered set of sketches/charts as a SLIDESHOW — one self-contained animated SVG (+ GIF). For info transfer that needs no figure/scene animation: explainers, walkthroughs, dashboards, a report in motion.',
};
export const DECK_MOTION_NAMES = Object.keys(DECK_MOTIONS);

/** True for the deck/slideshow motion verbs (incl. the `slideshow` alias). */
export function isDeckMotion(motion) {
  return motion === 'deck' || motion === 'slideshow';
}

/**
 * Strip a CreationMap-rendered sketch SVG to its body — drop only the outer
 * <svg> wrapper (and any xml decl), KEEP <text>. renderToStaticMarkup emits one
 * flat string, so this is a regex peel, not the line filter the manji path uses.
 */
export function stripSketchBody(svg) {
  return svg
    .replace(/^<\?xml[^>]*\?>\s*/, '')
    .replace(/^<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
}

/** Shared viewBox for the deck = the max canvas across slides (smaller slides
 *  sit top-left). Heterogeneous canvases letterbox rather than distort. */
function deckViewBox(slides) {
  let w = 0;
  let h = 0;
  for (const m of slides) {
    const vb = m?.viewBox || DEFAULT_CANVAS;
    w = Math.max(w, vb.width || DEFAULT_CANVAS.width);
    h = Math.max(h, vb.height || DEFAULT_CANVAS.height);
  }
  return [0, 0, w || DEFAULT_CANVAS.width, h || DEFAULT_CANVAS.height];
}

/**
 * Render an ordered list of sketch manifests into a slideshow flipbook + frame
 * SVGs (the GIF source). Mirrors renderMotion's return shape so the MCP handler
 * shares the outcome-folder / recipe / resource-group plumbing.
 *
 * @param {object} args
 * @param {object[]} args.slides         ordered sketch manifests
 * @param {number} [args.secondsPerSlide=2.5]  beat per slide (→ fps when fps unset)
 * @param {number} [args.fps]            explicit fps overrides secondsPerSlide
 * @param {boolean}[args.loop=true]
 * @param {number} [args.width]
 * @param {'dark'|'light'} [args.surface='dark']
 * @param {Object<string,string>} [args.vars] presentation-theme CSS-var overrides
 * @param {string} [args.bg=DECK_BG]
 * @returns {Promise<{ frameSvgs: string[], flipbookSvg: string, viewBox: number[], meta: object }>}
 */
export async function renderDeckMotion({
  slides,
  secondsPerSlide = 2.5,
  fps,
  loop = true,
  width,
  surface = 'dark',
  vars = null,
  bg = DECK_BG,
}) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('a deck needs at least one slide.');
  }

  // Regime A — a single slide whose marks carry `animate` renders once + CSS
  // (live svg) and bakes by transform (gif), bypassing the flipbook. See
  // motion-regime-a.plan.md.
  if (slides.length === 1 && hasAnimate(slides[0])) {
    return renderRegimeA(slides[0], { fps, width, surface, vars, bg });
  }

  const anyReveal = slides.some(hasReveals);
  if (slides.length < 2 && !anyReveal) {
    throw new Error(
      'a still deck needs at least 2 slides; a single slide must carry reveals or animate marks (otherwise use create_sketch for a static image).',
    );
  }

  // A still deck plays one frame per slide at a slow fps. The moment any slide
  // reveals, the deck runs at an animation fps and EVERY slide becomes a frame
  // sequence: a reveal slide expands into its build; a still slide holds for
  // `secondsPerSlide` (repeated frames). Reveal is expressed through the SAME
  // slide interface — no separate motion verb.
  const effFps = fps || (anyReveal ? 12 : 1 / Math.max(0.25, secondsPerSlide));

  let frameManifests;
  if (anyReveal) {
    const dwellFrames = Math.max(1, Math.round(Math.max(0.25, secondsPerSlide) * effFps));
    frameManifests = slides.flatMap((s) =>
      hasReveals(s) ? expandSlide(s, { fps: effFps }) : Array.from({ length: dwellFrames }, () => s),
    );
  } else {
    frameManifests = slides;
  }

  const fullSvgs = [];
  for (const m of frameManifests) {
    // eslint-disable-next-line no-await-in-loop -- order matters; N bounded by frame budget
    fullSvgs.push(await renderSketchToSvg(m, { includeXmlDecl: false, surface, vars }));
  }
  const bodies = fullSvgs.map(stripSketchBody);
  const viewBox = deckViewBox(slides);

  const flipbookSvg = composeFlipbook({ frames: bodies, viewBox, fps: effFps, width, loop, bgFill: bg });
  const frameSvgs = bodies.map((body) => stillFrameSvg({ body, viewBox, width, bgFill: bg }));

  return {
    frameSvgs,
    flipbookSvg,
    viewBox,
    meta: {
      motion: 'deck',
      frames: frameManifests.length,
      slides: slides.length,
      animated: anyReveal,
      fps: effFps,
      loop,
      viewBoxStrategy: 'deck',
      secondsPerSlide,
    },
  };
}
