/**
 * cover-compositor — flatten a cover recipe into `cover.png` (the raster face).
 *
 * Generalizes the final-page composite (final-page.js) for the cover kind:
 *   cover = illustration (base, opaque) + title + subtext + metadata (overlay)
 * The illustration is the only opaque layer; a painted title arrives as an
 * ALPHA'D letter mark and composites over it; subtext/metadata are vector. Same
 * shape as the comic overlay over panel renders.
 *
 * The SVG fragment builders live in cover-preview.js (pure, no sharp) so the SVG
 * face (`/svg`) and this raster face never drift. NO-WORKER path (Phase B): a
 * missing illustration stands in as the palette placeholder; a missing painted
 * title falls back to its flat outline in the overlay.
 */
import { promises as fs } from 'node:fs';
import sharp from 'sharp';

import { normalizeCoverManifest, coverRenderTargets, COVER_KIND } from './cover-manifest.js';
import { layoutCover } from './cover-archetypes.js';
import { hexToRgb, placeholderIllustrationSvg, overlaySvgDoc } from './cover-preview.js';
import { boundRenderMap } from './render-store.js';

async function bufOf(src) {
  return Buffer.isBuffer(src) ? src : fs.readFile(src);
}

/** Resize a source to a region and return a positioned composite layer.
 *  `fit: 'cover'` fills+crops (illustration base); `fit: 'contain'` fits inside
 *  without cropping on a transparent bed (title/mark layers — never crop letters). */
async function fitted(src, region, fit = 'cover') {
  const input = await sharp(await bufOf(src))
    .resize(Math.max(1, Math.round(region.w)), Math.max(1, Math.round(region.h)), {
      fit,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return { input, left: Math.round(region.x), top: Math.round(region.y) };
}

/**
 * Composite a cover to PNG bytes.
 * @param {object} manifestIn a cover recipe (loose or normalized)
 * @param {{ illustration?: Buffer|string, title?: Buffer|string }} [renders]
 *   bound layer PNGs (buffer or path). Missing layers stand in deterministically.
 * @returns {Promise<Buffer>} cover.png
 */
export async function compositeCover(manifestIn, renders = {}) {
  const manifest = manifestIn.kind === COVER_KIND ? manifestIn : normalizeCoverManifest(manifestIn);
  const { w, h } = manifest.canvas;
  const layout = layoutCover(manifest);
  const illoRegion = layout.illustrationRegion;

  const layers = [];

  // Illustration layer (base) — bound render, else the palette placeholder.
  const illoSrc = renders.illustration
    ? await bufOf(renders.illustration)
    : Buffer.from(placeholderIllustrationSvg(illoRegion.w, illoRegion.h, manifest.artDirection.palette));
  layers.push(await fitted(illoSrc, illoRegion));

  // Painted title as its own raster layer (when bound) — an alpha'd letter mark
  // the worker painted, composited over the illustration without cropping.
  if (manifest.slots.title.realizer === 'painted' && renders.title) {
    layers.push(await fitted(renders.title, layout.titleZone, 'contain'));
  }

  // Vector overlay (band + flat title fallback + subtext + metadata).
  const overlay = await sharp(Buffer.from(overlaySvgDoc(manifest, layout, renders)))
    .resize(w, h)
    .png()
    .toBuffer();
  layers.push({ input: overlay, left: 0, top: 0 });

  return sharp({ create: { width: w, height: h, channels: 4, background: { ...hexToRgb(manifest.artDirection.palette.bg), alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

/**
 * Composite a stored cover sketch from its LATEST bound renders (illustration /
 * title), standing in placeholders for any target not yet bound. Unlike
 * final.png this never 404s — a directed cover always renders (Phase B).
 * @param {{ ref: string, manifest: object }} sketch
 * @returns {Promise<Buffer>} cover.png
 */
export async function compositeCoverForSketch(sketch) {
  const manifest = sketch.manifest?.kind === COVER_KIND
    ? sketch.manifest
    : normalizeCoverManifest(sketch.manifest);
  const bound = boundRenderMap(sketch.ref, coverRenderTargets(manifest));
  const renders = {};
  if (bound.illustration) renders.illustration = bound.illustration.path;
  if (bound.title) renders.title = bound.title.path;
  return compositeCover(manifest, renders);
}
