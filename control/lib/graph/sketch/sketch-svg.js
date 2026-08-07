/**
 * Sketch → standalone SVG renderer (the shared seam).
 *
 * Two callers depend on this: the HTTP route at /api/sketches/[ref]/svg (the
 * operator-facing download) and the picture-book outcome writer (which inlines
 * a sequence of sketch SVGs into a static HTML book). Both want the same
 * shape — a self-contained <svg> string with xmlns set and CSS variables
 * resolved to literal hex/families, because most SVG consumers (Illustrator,
 * Inkscape, image viewers, an outcome HTML opened directly off disk) don't
 * honor `var(...)` references.
 */

import React from 'react';

import CreationMap from '@/components/graph/CreationMap';

// Resolved values lifted from app/globals.css. Kept in sync deliberately —
// CreationMap uses CSS variables for in-app theming; portable export needs
// concrete colors.
const CSS_VAR_RESOLUTIONS = {
  '--brand-teal': '#5eead4',
  '--brand-teal-hover': '#2dd4bf',
  '--brand-navy': '#0a2028',
  '--surface-primary': '#1f2937',
  '--surface-elevated': '#374151',
  '--border-color': '#374151',
  '--text-primary': '#ffffff',
  '--text-secondary': '#d1d5db',
  '--text-muted': '#9ca3af',
  '--background': '#111827',
  '--foreground': '#f3f4f6',
  '--font-geist-sans': 'Inter, system-ui, sans-serif',
  '--font-geist-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

// The dark theme above is correct for the /sketches viewer and the standalone
// SVG download (both sit on a dark backdrop). When a sketch is inlined onto a
// LIGHT publication surface (e.g. the instruction_manual diagram band), the
// dark-theme text/foreground vars resolve to white and vanish. A `surface:
// 'light'` render swaps just the ink-bearing vars to dark and drops the opaque
// background, letting the host page's own paper show through. Strokes/fills the
// author set explicitly (e.g. assembly-line-art's `#1a1a1a`) are untouched —
// only `var(...)` defaults are re-resolved.
const LIGHT_SURFACE_OVERRIDES = {
  '--text-primary': '#161616',
  '--text-secondary': '#3a3a3a',
  '--text-muted': '#6a6a6a',
  '--foreground': '#161616',
  '--background': 'transparent',
  '--surface-primary': 'transparent',
  '--surface-elevated': '#e9e6df',
};

// A named presentation theme (themes.js) resolves to a `surface` base plus a
// `vars` map that re-tints ink/accent on top of it (paper, blueprint, sepia, …).
// Those overrides layer LAST so a theme can move a default the base set, while
// author-set fills still pass through untouched (only `var(--…)` is resolved).
function inlineCssVars(markup, surface = 'dark', vars = null) {
  const base = surface === 'light'
    ? { ...CSS_VAR_RESOLUTIONS, ...LIGHT_SURFACE_OVERRIDES }
    : CSS_VAR_RESOLUTIONS;
  const map = vars ? { ...base, ...vars } : base;
  return markup.replace(/var\((--[a-z0-9-]+)\)/gi, (match, name) => {
    return map[name] ?? match;
  });
}

/**
 * Render a sketch manifest to a self-contained SVG string.
 *
 * @param {object} manifest — a validated sketch manifest (CreationMap input)
 * @param {object} [opts]
 * @param {boolean} [opts.technical=false] — pass-through to CreationMap
 * @param {boolean} [opts.includeXmlDecl=true] — prepend `<?xml ...?>` for
 *   standalone .svg files. Set false when inlining into an HTML document.
 * @param {'dark'|'light'} [opts.surface='dark'] — which surface the SVG will
 *   sit on. 'light' re-resolves text/background vars to dark ink + transparent
 *   bg so default-colored marks stay readable on a light publication page.
 * @param {Object<string,string>} [opts.vars] — per-theme CSS-var overrides
 *   (from a presentation theme) merged over the surface base; re-tints ink +
 *   accent for the characterful themes (paper/blueprint/sepia/…).
 * @returns {Promise<string>}
 */
export async function renderSketchToSvg(manifest, { technical = false, includeXmlDecl = true, surface = 'dark', vars = null } = {}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('renderSketchToSvg requires a sketch manifest');
  }
  // Dynamic import keeps this lib usable from app-router code that lints
  // against static `react-dom/server` imports. Server-side only.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const inner = renderToStaticMarkup(
    React.createElement(CreationMap, { manifest, technical }),
  );
  const withXmlns = inner.replace(
    /^<svg\b/,
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
  );
  const resolved = inlineCssVars(withXmlns, surface, vars);
  if (!includeXmlDecl) return resolved;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${resolved}\n`;
}

// Test seam.
export const _internals = { inlineCssVars, CSS_VAR_RESOLUTIONS };
