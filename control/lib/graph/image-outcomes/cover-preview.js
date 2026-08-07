/**
 * cover-preview — the deterministic SVG face of a cover (pure; no sharp).
 *
 * `renderCoverSvg(manifest)` is what `/api/sketches/<ref>/svg` serves and the
 * sketch page shows: the illustration placeholder + flat title + subtext +
 * metadata, all vector, from the manifest alone. It is the cover's "scaffold" —
 * shown before (and instead of) any painted raster layer, and the ControlNet-
 * style geometry a worker later paints onto.
 *
 * The raster composite (cover-compositor.js) reuses these same fragment builders
 * over sharp when there ARE bound raster layers (a painted illustration, an
 * alpha'd title mark) to composite. One set of fragment builders → the SVG face
 * and the raster face never drift.
 */
import { normalizeCoverManifest, COVER_KIND } from './cover-manifest.js';
import { layoutCover } from './cover-archetypes.js';
import { titleSvgPath } from './title-geometry.js';
import { barcodeSvg } from './cover-metadata.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) };
}
function toHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}
/** Shade a hex toward white (amt>0) or black (amt<0), amt in [-1,1]. */
export function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const t = amt >= 0 ? 255 : 0, k = Math.abs(amt);
  return toHex({ r: r + (t - r) * k, g: g + (t - g) * k, b: b + (t - b) * k });
}

/** The gradient defs for the palette-derived stand-in illustration. */
function illoDefs(palette) {
  const top = shade(palette.bg, 0.16), bot = shade(palette.bg, -0.34);
  const glow = palette.accent || '#e8c14a';
  return `<defs>
    <linearGradient id="csky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>
    <radialGradient id="cfocal" cx="0.5" cy="0.32" r="0.6"><stop offset="0" stop-color="${glow}" stop-opacity="0.28"/><stop offset="0.6" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cvig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></radialGradient>
  </defs>`;
}

/** A palette-derived stand-in "illustration" as a standalone SVG doc (region-
 *  local, origin 0,0) — the raster compositor rasterizes this per illustration
 *  region when no painted illustration is bound. */
export function placeholderIllustrationSvg(w, h, palette) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${illoDefs(palette)}
  <rect width="${w}" height="${h}" fill="url(#csky)"/>
  <rect width="${w}" height="${h}" fill="url(#cfocal)"/>
  <rect width="${w}" height="${h}" fill="url(#cvig)"/>
</svg>`;
}

/**
 * The above-the-illustration vector fragments: solid band (some archetypes),
 * flat title (unless a painted title layer is supplied), subtext by role, and
 * metadata marks. Shared by the SVG face and the raster overlay layer.
 */
export function coverOverlayParts(manifest, layout, renders = {}) {
  const { artDirection: ad, slots } = manifest;
  const parts = [];

  if (layout.band) {
    parts.push(`<rect x="${layout.band.x}" y="${layout.band.y}" width="${layout.band.w}" height="${layout.band.h}" fill="${ad.palette.bg}"/>`);
  }

  // Title — flat here unless a painted title mark rides as its own raster layer.
  const titlePainted = slots.title.realizer === 'painted' && renders.title;
  if (!titlePainted && slots.title.text) {
    parts.push(titleSvgPath(
      slots.title.text,
      { face: slots.title.font || ad.type.titleFont, fill: ad.palette.accent },
      layout.titleZone,
      { fill: 0.92 },
    ));
  }

  for (const s of slots.subtext) {
    const region = layout.subtextRegions?.[s.role];
    if (!region || !s.text) continue;
    parts.push(titleSvgPath(s.text, { face: s.font || ad.type.textFont, fill: ad.palette.ink }, region, { fill: s.role === 'author' ? 0.7 : 0.6 }));
  }

  for (const md of slots.metadata) {
    const region = layout.metadataRegions?.[md.kind];
    if (!region) continue;
    if (md.kind === 'barcode') parts.push(barcodeSvg(md.value, region));
    else if (md.value) parts.push(titleSvgPath(md.value, { face: ad.type.textFont, fill: ad.palette.ink, opacity: 0.8 }, region, { fill: 0.6, align: 'left' }));
  }

  return parts.filter(Boolean);
}

/** The overlay as a full-canvas SVG doc (the raster overlay layer). */
export function overlaySvgDoc(manifest, layout, renders = {}) {
  const { canvas } = manifest;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" width="${canvas.w}" height="${canvas.h}">
${coverOverlayParts(manifest, layout, renders).join('\n')}
</svg>`;
}

/**
 * The whole cover as one self-contained SVG (illustration placeholder + overlay)
 * — the deterministic preview served at `/svg` and shown on the sketch page.
 * @param {object} manifestIn a cover recipe (loose or normalized)
 * @returns {string} SVG
 */
export function renderCoverSvg(manifestIn) {
  const manifest = manifestIn?.kind === COVER_KIND ? manifestIn : normalizeCoverManifest(manifestIn);
  const { canvas, artDirection: ad } = manifest;
  const layout = layoutCover(manifest);
  const illo = layout.illustrationRegion;
  const illoRects = ['csky', 'cfocal', 'cvig']
    .map((id) => `<rect x="${illo.x}" y="${illo.y}" width="${illo.w}" height="${illo.h}" fill="url(#${id})"/>`)
    .join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" width="${canvas.w}" height="${canvas.h}">
  ${illoDefs(ad.palette)}
  <rect x="0" y="0" width="${canvas.w}" height="${canvas.h}" fill="${ad.palette.bg}"/>
  ${illoRects}
  ${coverOverlayParts(manifest, layout, {}).join('\n  ')}
</svg>`;
}
