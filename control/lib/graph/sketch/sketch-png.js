/**
 * Stored sketch → PNG buffer (the shared rasterizer behind /api/sketches/[ref]/png).
 *
 * Dispatched on the renderer mode (sketch-manifest.sketchRenderMode):
 *   • world / — heavy 3D kinds (navigable three.js cities/hubs + preset-shot CSS-3D
 *     scene     turntables). Both render hard live, so the gallery shows a baked
 *               still instead. Rasterized from the CSS preserve-3d HTML emitter
 *               (scene-html.js, which covers all of city/hub/turntable) by headless
 *               Chromium (scene-png.js). EXPENSIVE, so the result is disk-cached
 *               under data/scene-png/, keyed by a manifest hash, so a gallery of 3D
 *               thumbnails doesn't relaunch a browser per card.
 *   • svg /   — a self-contained SVG (illustration kinds + CreationMap diagrams).
 *     diagram   Rasterized with sharp (libvips), the same SVG→raster path the
 *               motion frame encoder already relies on. Cheap; rendered on demand.
 */

import { promises as fs, existsSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import sharp from 'sharp';

import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { renderSceneHtml } from '@/lib/graph/scene/scene-html';
import { renderSceneToPng } from '@/lib/graph/scene/scene-png';

// Bump when the scene rasterizer's output changes in a way that should invalidate
// already-baked PNGs (new camera default, lighting model, screenshot crop, …).
const SCENE_CACHE_VERSION = 'v1';

// Cap the longest rasterized SVG edge so a huge viewBox can't ask sharp for a
// gigapixel surface. 3000px is plenty for a crisp download/preview.
const MAX_SVG_DIM = 3000;

// The stored SVGs are dark-theme (sketch-svg.js resolves --background to #111827)
// and carry NO full-bleed background rect — they rely on the dark viewer pane
// behind a transparent <img>. A standalone PNG has no such pane, so white text on
// transparent flattens to invisible. Composite onto the same dark backdrop the
// theme resolves to, so the PNG is a faithful, self-contained still.
const PNG_BACKDROP = '#111827';

function scenePngCacheDir() {
  return process.env.MOJULO_SCENE_PNG_DIR || path.join(process.cwd(), 'data', 'scene-png');
}

function sceneCacheKey(sketch, scale) {
  const payload = JSON.stringify({ v: SCENE_CACHE_VERSION, scale, manifest: sketch.manifest });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

// Read the intrinsic pixel size from the SVG root: prefer explicit width/height,
// else fall back to the viewBox extent. Returns null if neither is present (let
// sharp use its own default density in that case).
function svgIntrinsicSize(svg) {
  const head = svg.slice(0, 600);
  const wAttr = head.match(/<svg\b[^>]*\bwidth="([\d.]+)/);
  const hAttr = head.match(/<svg\b[^>]*\bheight="([\d.]+)/);
  if (wAttr && hAttr) return { w: parseFloat(wAttr[1]), h: parseFloat(hAttr[1]) };
  const vb = head.match(/viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/);
  if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
  return null;
}

// Force explicit pixel width/height on the <svg> root so libvips rasterizes at a
// known size (CreationMap emits viewBox-only SVGs, which otherwise render at a
// low default density).
function withExplicitSize(svg, w, h) {
  return svg.replace(/<svg\b([^>]*)>/, (full, attrs) => {
    const cleaned = attrs
      .replace(/\swidth="[^"]*"/, '')
      .replace(/\sheight="[^"]*"/, '');
    return `<svg${cleaned} width="${w}" height="${h}">`;
  });
}

async function svgToPng(svg, scale) {
  const size = svgIntrinsicSize(svg);
  let prepared = svg;
  if (size && size.w > 0 && size.h > 0) {
    const longest = Math.max(size.w, size.h) * scale;
    const k = longest > MAX_SVG_DIM ? (MAX_SVG_DIM / Math.max(size.w, size.h)) : scale;
    prepared = withExplicitSize(svg, Math.round(size.w * k), Math.round(size.h * k));
  }
  return sharp(Buffer.from(prepared)).flatten({ background: PNG_BACKDROP }).png().toBuffer();
}

async function bakeScenePng(sketch, scale) {
  const html = renderSceneHtml(sketch);
  if (!html) {
    const err = new Error(
      'This scene kind has no live CSS-3D renderer to bake — use the /svg path instead.',
    );
    err.code = 'SCENE_INELIGIBLE';
    throw err;
  }
  return renderSceneToPng(html, { deviceScaleFactor: scale });
}

/**
 * Rasterize a stored sketch to a PNG buffer.
 *
 * @param {{ ref?: string, title?: string, manifest: object }} sketch
 * @param {object} [opts]
 * @param {number} [opts.scale=2] — pixel density / supersample factor
 * @returns {Promise<Buffer>} PNG bytes
 */
export async function rasterizeSketchToPng(sketch, { scale = 2 } = {}) {
  if (!sketch?.manifest) throw new Error('rasterizeSketchToPng requires a sketch manifest');
  const mode = sketchRenderMode(sketch.manifest);

  // 'world' (three.js) and 'scene' (CSS-3D) are both the heavy 3D kinds — bake
  // both from the CSS preserve-3d HTML, which renders city/hub/turntable alike.
  if (mode === 'scene' || mode === 'world') {
    const dir = scenePngCacheDir();
    const cacheFile = path.join(dir, `${sketch.ref || 'scene'}-${sceneCacheKey(sketch, scale)}.png`);
    if (existsSync(cacheFile)) {
      return fs.readFile(cacheFile);
    }
    const png = await bakeScenePng(sketch, scale);
    // Best-effort cache write; a failed write just means the next view re-bakes.
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(cacheFile, png);
    } catch {
      /* ignore cache write failures */
    }
    return png;
  }

  const svg = await renderStoredSketchSvg(sketch);
  return svgToPng(svg, scale);
}
