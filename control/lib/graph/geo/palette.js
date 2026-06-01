/**
 * Map palette themes.
 *
 * The sketches page renders directly on the app background (#111827, slate-900
 * — see app/globals.css `--background`). There is no SVG container fill; the
 * page bg IS the sea. Pick palettes that read against THAT bg, not against
 * white.
 *
 * Two themes ship:
 *
 *   - `dark` (DEFAULT) — slate land on slightly-darker sea. Matches the rest
 *     of the sketch_vocab palette family (stacked-bar, donut-ring, stat-tile)
 *     so a map can sit next to a chart in one manifest without clashing.
 *   - `light` — warm cream land on charcoal stroke. Use when the operator
 *     wants a print-style cartographic look (export-to-PDF, embed in a
 *     light-mode doc). Still legible on the dark page; the cream lifts off the
 *     bg, so the map sits "above" the canvas rather than "in" it.
 *
 * Choropleth (data-driven fill) colors are SEPARATE from the base palette —
 * the operator picks per-region fills that override `outerFill`. The base
 * palette is the look you get when no data channel is in use.
 */

export const MAP_THEMES = {
  dark: {
    outerFill: '#1f2937',         // slate-800 — "land" reads as elevated surface
    outerStroke: '#475569',       // slate-600 — visible against both land + sea
    outerStrokeWidth: 0.7,
    holeFill: '#0b0f16',          // deeper than the page bg — reads as cutout
    holeStroke: '#475569',
    holeStrokeWidth: 0.5,
    label: '#e2e8f0',             // slate-200 — readable on slate-800 land
    legendBg: '#1e293b',          // slate-800/0.9 (carrier card)
    legendStroke: '#334155',      // slate-700
    legendLabel: '#e2e8f0',
    title: '#f1f5f9',             // slate-100
    subtitle: '#94a3b8',          // slate-400
    footer: '#64748b',            // slate-500
  },
  light: {
    outerFill: '#f3efe6',         // warm cream — print-style cartographic
    outerStroke: '#2a2a2a',
    outerStrokeWidth: 1,
    holeFill: '#0b0f16',          // matches dark theme's sea — holes punch through
    holeStroke: '#2a2a2a',
    holeStrokeWidth: 0.5,
    label: '#1f2937',             // dark text on cream land
    legendBg: '#f8fafc',
    legendStroke: '#cbd5e1',
    legendLabel: '#1e293b',
    title: '#0f172a',
    subtitle: '#475569',
    footer: '#64748b',
  },
};

export const DEFAULT_THEME = 'dark';

export function getMapTheme(theme = DEFAULT_THEME) {
  const t = MAP_THEMES[theme];
  if (!t) {
    throw new Error(`getMapTheme: unknown theme '${theme}' (expected: ${Object.keys(MAP_THEMES).join(', ')})`);
  }
  return t;
}

// Kept for backwards compatibility with the smoke test and any caller that
// imported the original constant. New code should use `getMapTheme(theme)`.
export const MAP_PALETTE = MAP_THEMES[DEFAULT_THEME];
