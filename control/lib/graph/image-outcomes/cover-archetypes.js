/**
 * cover-archetypes — the layout grammar that keeps covers STRUCTURED without
 * making them uniform.
 *
 * An archetype is a pure layout fn `(canvas, slots) → regions`: where the
 * illustration sits, where the title zone is reserved, where subtext + metadata
 * land, and the safe area. Many archetypes + per-cover palette/typeface/treatment
 * = variety; the region math + a completability gate = "all the pieces are
 * there". `COVER_DEFAULTS_BY_KIND` SEEDS sensible choices per publication kind
 * (aspect, candidate archetypes, default slots) — seeds the agent overrides, not
 * locks.
 *
 * Regions are `{ x, y, w, h }` in canvas px. Pure — no fs, no sharp.
 */

/** Long edge of a portrait cover canvas; short edge derives from the aspect. */
const LONG_EDGE = 1800;

/** Publication kind → cover defaults. Aspect is [w, h]. */
export const COVER_DEFAULTS_BY_KIND = {
  novel: {
    aspect: [2, 3],
    archetypes: ['full-bleed-overlay', 'framed-below'],
    slots: ['title', 'author', 'series', 'barcode'],
    type: { titleFont: 'im-fell', textFont: 'inter' },
  },
  picture_book: {
    aspect: [4, 5],
    archetypes: ['framed-below', 'full-bleed-overlay'],
    slots: ['title', 'author'],
    type: { titleFont: 'archivo-black', textFont: 'inter' },
  },
  comic: {
    aspect: [13, 20], // ~US comic trim 6.625 × 10.25
    archetypes: ['comic-masthead'],
    slots: ['title', 'issue', 'price', 'barcode'],
    type: { titleFont: 'archivo-black', textFont: 'inter' },
  },
};

const FALLBACK_DEFAULTS = {
  aspect: [2, 3],
  archetypes: ['full-bleed-overlay'],
  slots: ['title', 'author'],
  type: { titleFont: 'archivo-black', textFont: 'inter' },
};

/** Defaults for a publication kind (never throws — unknown kinds get a book default). */
export function defaultsForKind(forKind) {
  return COVER_DEFAULTS_BY_KIND[forKind] || FALLBACK_DEFAULTS;
}

/** Portrait canvas {w,h} for a kind (or an explicit [w,h] aspect override). */
export function canvasFor(forKind, aspectOverride) {
  const aspect = aspectOverride || defaultsForKind(forKind).aspect;
  const [aw, ah] = aspect;
  // Portrait: the taller side is the long edge.
  if (ah >= aw) return { w: Math.round((LONG_EDGE * aw) / ah), h: LONG_EDGE };
  return { w: LONG_EDGE, h: Math.round((LONG_EDGE * ah) / aw) };
}

// ── archetypes ──
// Each returns { illustrationRegion, titleZone, subtextRegions, metadataRegions, safe }.
// subtextRegions/metadataRegions are keyed by role/kind so the compositor places
// the right slot in the right box.

const ARCHETYPES = {
  // Illustration edge-to-edge; title floats in a reserved band up top; author
  // sits on a line low-centre; the barcode owns a quiet strip BELOW the author,
  // note bottom-left — no slot shares a row.
  'full-bleed-overlay': (canvas) => {
    const m = Math.round(canvas.w * 0.08);
    const bcW = Math.round(canvas.w * 0.2), bcH = Math.round(bcW * 0.5);
    return {
      illustrationRegion: { x: 0, y: 0, w: canvas.w, h: canvas.h },
      titleZone: { x: m, y: Math.round(canvas.h * 0.07), w: canvas.w - 2 * m, h: Math.round(canvas.h * 0.2) },
      subtextRegions: {
        series: { x: m, y: Math.round(canvas.h * 0.29), w: canvas.w - 2 * m, h: Math.round(canvas.h * 0.035) },
        author: { x: m, y: Math.round(canvas.h * 0.8), w: canvas.w - 2 * m, h: Math.round(canvas.h * 0.05) },
      },
      metadataRegions: {
        barcode: { x: canvas.w - m - bcW, y: canvas.h - Math.round(m * 0.6) - bcH, w: bcW, h: bcH },
        note: { x: m, y: canvas.h - Math.round(m * 0.6) - Math.round(canvas.h * 0.028), w: Math.round(canvas.w * 0.36), h: Math.round(canvas.h * 0.028) },
      },
      safe: { x: m, y: m, w: canvas.w - 2 * m, h: canvas.h - 2 * m },
    };
  },

  // Illustration framed in the upper ~62%; a solid title band fills the lower
  // third with title + author stacked; barcode on its own strip below the author.
  'framed-below': (canvas) => {
    const m = Math.round(canvas.w * 0.07);
    const splitY = Math.round(canvas.h * 0.62);
    const bandH = canvas.h - splitY;
    const bcW = Math.round(canvas.w * 0.2), bcH = Math.round(bcW * 0.5);
    return {
      illustrationRegion: { x: m, y: m, w: canvas.w - 2 * m, h: splitY - m - Math.round(m * 0.5) },
      band: { x: 0, y: splitY, w: canvas.w, h: bandH },
      titleZone: { x: m, y: splitY + Math.round(bandH * 0.12), w: canvas.w - 2 * m, h: Math.round(bandH * 0.4) },
      subtextRegions: {
        author: { x: m, y: splitY + Math.round(bandH * 0.56), w: canvas.w - 2 * m, h: Math.round(bandH * 0.11) },
      },
      metadataRegions: {
        barcode: { x: canvas.w - m - bcW, y: canvas.h - Math.round(m * 0.5) - bcH, w: bcW, h: bcH },
      },
      safe: { x: m, y: m, w: canvas.w - 2 * m, h: canvas.h - 2 * m },
    };
  },

  // Comic: full-bleed cover art; a big masthead LOGO across the top; issue# +
  // price stacked in the top-left corner; barcode bottom-left; publisher
  // bottom-right; optional tagline under the logo.
  'comic-masthead': (canvas) => {
    const m = Math.round(canvas.w * 0.05);
    const bcW = Math.round(canvas.w * 0.26), bcH = Math.round(bcW * 0.42);
    return {
      illustrationRegion: { x: 0, y: 0, w: canvas.w, h: canvas.h },
      titleZone: { x: m, y: Math.round(canvas.h * 0.092), w: canvas.w - 2 * m, h: Math.round(canvas.h * 0.15) },
      subtextRegions: {
        tagline: { x: m, y: Math.round(canvas.h * 0.25), w: canvas.w - 2 * m, h: Math.round(canvas.h * 0.03) },
      },
      metadataRegions: {
        issue: { x: m, y: Math.round(canvas.h * 0.02), w: Math.round(canvas.w * 0.34), h: Math.round(canvas.h * 0.035) },
        price: { x: m, y: Math.round(canvas.h * 0.056), w: Math.round(canvas.w * 0.34), h: Math.round(canvas.h * 0.03) },
        barcode: { x: m, y: canvas.h - Math.round(m * 0.6) - bcH, w: bcW, h: bcH },
        publisher: { x: canvas.w - m - Math.round(canvas.w * 0.34), y: canvas.h - Math.round(m * 0.6) - Math.round(canvas.h * 0.03), w: Math.round(canvas.w * 0.34), h: Math.round(canvas.h * 0.03) },
      },
      safe: { x: m, y: m, w: canvas.w - 2 * m, h: canvas.h - 2 * m },
    };
  },
};

/** All archetype names (for recommend_cover / vocab). */
export function archetypeNames() {
  return Object.keys(ARCHETYPES);
}

/**
 * Resolve a cover manifest to its concrete regions. Falls back to
 * full-bleed-overlay for an unknown archetype so layout never throws.
 */
export function layoutCover(manifest) {
  const canvas = manifest.canvas;
  const name = manifest?.artDirection?.composition?.archetype;
  const arch = ARCHETYPES[name] || ARCHETYPES['full-bleed-overlay'];
  return { archetype: ARCHETYPES[name] ? name : 'full-bleed-overlay', ...arch(canvas, manifest.slots || {}) };
}
