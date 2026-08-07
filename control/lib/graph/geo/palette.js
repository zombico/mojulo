/**
 * Map palette themes.
 *
 * The sketches page renders directly on the app background (#111827, slate-900
 * — see app/globals.css `--background`). There is no SVG container fill; the
 * page bg IS the sea. Pick palettes that read against THAT bg, not against
 * white.
 *
 * Token names ALIGN with the presentation theme vocabulary
 * (lib/visual-language/themes.js) so one name means the same thing across
 * domains — a map can sit beside a `paper` deck or a `blueprint` study and
 * match. Maps keep their OWN rich per-element palette (land/sea/holes/legend);
 * they don't derive from presentation chrome, because cartography needs more
 * structure than a page does. The set is a subset of the presentation names
 * (the cartographically meaningful ones); see the guard in palette.test.js.
 *
 * Shipped themes:
 *
 *   - `dark` (DEFAULT) — slate land on slightly-darker sea. Matches the rest
 *     of the sketch_vocab palette family (stacked-bar, donut-ring, stat-tile)
 *     so a map can sit next to a chart in one manifest without clashing.
 *   - `light` — cool neutral land, slate stroke. The clean print look.
 *   - `paper` — warm cream land on charcoal stroke (the editorial/print-style
 *     cartographic look that used to be misnamed `light`). The cream lifts off
 *     the page so the map sits "above" the canvas rather than "in" it.
 *   - `blueprint` — blue land + cyan strokes/labels: a technical/schematic map.
 *   - `sepia` — parchment land, brown ink: the classic aged-cartography look.
 *
 * (midnight / high-contrast aren't authored for maps yet — add them here if a
 * map needs to pair with one of those decks.)
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
    outerFill: '#e8edf2',         // cool neutral land (matches presentation `light`)
    outerStroke: '#475569',
    outerStrokeWidth: 1,
    holeFill: '#0b0f16',          // matches dark theme's sea — holes punch through
    holeStroke: '#475569',
    holeStrokeWidth: 0.5,
    label: '#1f2937',             // dark text on cool land
    legendBg: '#f8fafc',
    legendStroke: '#cbd5e1',
    legendLabel: '#1e293b',
    title: '#0f172a',
    subtitle: '#475569',
    footer: '#64748b',
  },
  paper: {
    outerFill: '#f3efe6',         // warm cream — print-style cartographic
    outerStroke: '#2a2a2a',
    outerStrokeWidth: 1,
    holeFill: '#0b0f16',
    holeStroke: '#2a2a2a',
    holeStrokeWidth: 0.5,
    label: '#2b2218',             // warm dark ink on cream land
    legendBg: '#faf7f0',
    legendStroke: '#d8cdb8',
    legendLabel: '#3a2f20',
    title: '#2b2218',
    subtitle: '#6f6149',
    footer: '#8a7d64',
  },
  blueprint: {
    outerFill: '#0e3a5c',         // blue land
    outerStroke: '#7fdbff',       // cyan coastline
    outerStrokeWidth: 0.8,
    holeFill: '#071f33',          // darker blue cutout
    holeStroke: '#3d7ea6',
    holeStrokeWidth: 0.5,
    label: '#dceffb',
    legendBg: '#0e3253',
    legendStroke: '#1d5a86',
    legendLabel: '#dceffb',
    title: '#eaf6ff',
    subtitle: '#9fd0ee',
    footer: '#6fa8cf',
  },
  sepia: {
    outerFill: '#e6d2a8',         // parchment land
    outerStroke: '#6b4f2c',       // brown coastline
    outerStrokeWidth: 1,
    holeFill: '#0b0f16',
    holeStroke: '#6b4f2c',
    holeStrokeWidth: 0.5,
    label: '#43321f',
    legendBg: '#efe3c8',
    legendStroke: '#cdb88f',
    legendLabel: '#43321f',
    title: '#3a2a1a',
    subtitle: '#806a4f',
    footer: '#9c8a63',
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
