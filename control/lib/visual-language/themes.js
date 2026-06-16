/**
 * Visual-language theme registry — the shared, named palette vocabulary the
 * model picks from so rendered output stops defaulting to dark.
 *
 * Approach A (see control/lib/visual-language/theming.plan.md): the model passes
 * ONE token (e.g. `theme: 'paper'`); it does not hand-author hex. Themes are
 * scoped per DOMAIN — a presentation/deck theme is meaningless for a figure
 * study — so each domain owns its own vocabulary. This module is the
 * PRESENTATION domain (decks/slideshows/charts + the motion player chrome).
 * Figure setups + map themes live beside the renderers that consume them.
 *
 * One presentation theme resolves the three values that previously drifted apart
 * as independent params (surface + bg + viewer chrome), so a 'paper' deck can't
 * end up cream-page-wrapping-a-dark-chart:
 *   - surface — which CSS-var base sketch-svg.js inlines ('dark' | 'light').
 *   - vars    — per-theme overrides merged ON TOP of that base, letting the
 *               characterful themes (paper/blueprint/sepia/…) re-tint ink +
 *               accent precisely. Only `var(--…)` defaults move; author-set
 *               fills are never touched.
 *   - bg      — the backdrop fill painted behind the slides (flipbook + still
 *               frame + GIF).
 *   - chrome  — the motion player (viewer.js) page/panel colors.
 *
 * The vocabulary is deliberately BROAD and INDICATIVE: the menu itself signals
 * the range so the model reaches past dark-by-default. Each entry is data —
 * adding/removing a theme is a registry edit, no call-site change.
 */

/**
 * @typedef {object} PresentationTheme
 * @property {string} label                 short human label
 * @property {string} description           model-facing one-liner (when to pick it)
 * @property {'dark'|'light'} surface        CSS-var base in sketch-svg.js
 * @property {Object<string,string>} vars   CSS-var overrides merged over the base
 * @property {string} bg                     backdrop fill behind the slides
 * @property {ChromeColors} chrome           motion-player chrome
 */

/**
 * @typedef {object} ChromeColors
 * @property {string} pageBg     player page background
 * @property {string} ink        primary text
 * @property {string} mutedInk   secondary / caption text
 * @property {string} panelBg    control bar / pre background
 * @property {string} panelBorder control bar / button border
 * @property {string} accent     focus / hover / range accent
 * @property {string} stageBg    letterbox behind the rendered SVG
 */

export const PRESENTATION_THEMES = {
  dark: {
    label: 'Dark',
    description: 'Slate near-black ground, light text. The default; good for screens and dashboards.',
    surface: 'dark',
    vars: {},
    bg: '#0b0f16',
    chrome: {
      pageBg: '#0e1319', ink: '#c9d1d9', mutedInk: '#8b949e',
      panelBg: '#161b22', panelBorder: '#30363d', accent: '#4b93ff', stageBg: '#0b0f16',
    },
  },
  midnight: {
    label: 'Midnight',
    description: 'Deep navy/indigo ground with a soft violet accent. A warmer, more premium dark than slate.',
    surface: 'dark',
    vars: {
      '--background': '#0b1026', '--surface-primary': '#161d3a', '--surface-elevated': '#222a4d',
      '--border-color': '#2a3357', '--brand-teal': '#8b9cff', '--brand-teal-hover': '#a9b6ff',
    },
    bg: '#0b1026',
    chrome: {
      pageBg: '#0b1026', ink: '#c5cae9', mutedInk: '#7d86b5',
      panelBg: '#161d3a', panelBorder: '#2a3357', accent: '#8b9cff', stageBg: '#0b1026',
    },
  },
  light: {
    label: 'Light',
    description: 'Clean cool-white ground, dark text. Neutral default for print-like, legible info.',
    surface: 'light',
    vars: {},
    bg: '#f4f5f7',
    chrome: {
      pageBg: '#f6f7f9', ink: '#1f2933', mutedInk: '#5a6572',
      panelBg: '#ffffff', panelBorder: '#d8dde3', accent: '#2563eb', stageBg: '#f4f5f7',
    },
  },
  paper: {
    label: 'Paper',
    description: 'Warm cream ground with ink + a muted ochre accent. Editorial / document feel.',
    surface: 'light',
    vars: {
      '--text-primary': '#2b2218', '--text-secondary': '#4a3f30', '--text-muted': '#6f6149',
      '--foreground': '#2b2218', '--surface-elevated': '#e7dcc4',
      '--brand-teal': '#b06a2c', '--brand-teal-hover': '#955620',
    },
    bg: '#f3ead8',
    chrome: {
      pageBg: '#efe4cf', ink: '#3a2f20', mutedInk: '#6f6149',
      panelBg: '#fbf5e8', panelBorder: '#ddceb0', accent: '#b06a2c', stageBg: '#f3ead8',
    },
  },
  blueprint: {
    label: 'Blueprint',
    description: 'Deep blue ground with cyan/white lines. Technical, schematic, drafting feel.',
    surface: 'dark',
    vars: {
      '--background': '#0a2740', '--surface-primary': '#0e3253', '--surface-elevated': '#114066',
      '--border-color': '#1d5a86', '--text-primary': '#dceffb', '--text-secondary': '#9fd0ee',
      '--text-muted': '#6fa8cf', '--foreground': '#dceffb',
      '--brand-teal': '#7fdbff', '--brand-teal-hover': '#a9e8ff',
    },
    bg: '#0a2740',
    chrome: {
      pageBg: '#0a2740', ink: '#dceffb', mutedInk: '#6fa8cf',
      panelBg: '#0e3253', panelBorder: '#1d5a86', accent: '#7fdbff', stageBg: '#0a2740',
    },
  },
  sepia: {
    label: 'Sepia',
    description: 'Tan ground, warm brown ink. Archival / aged-document feel for historical or reflective material.',
    surface: 'light',
    vars: {
      '--text-primary': '#3a2a1a', '--text-secondary': '#5b4630', '--text-muted': '#806a4f',
      '--foreground': '#3a2a1a', '--surface-elevated': '#e3d2b6',
      '--brand-teal': '#9c5a2c', '--brand-teal-hover': '#824824',
    },
    bg: '#e8d9bd',
    chrome: {
      pageBg: '#e3d3b3', ink: '#43321f', mutedInk: '#806a4f',
      panelBg: '#f0e6d2', panelBorder: '#cdb88f', accent: '#9c5a2c', stageBg: '#e8d9bd',
    },
  },
  'high-contrast': {
    label: 'High contrast',
    description: 'Pure black on white with one bold accent. Accessibility / maximum legibility / strong emphasis.',
    surface: 'light',
    vars: {
      '--text-primary': '#000000', '--text-secondary': '#000000', '--text-muted': '#1a1a1a',
      '--foreground': '#000000', '--surface-elevated': '#ffffff', '--border-color': '#000000',
      '--brand-teal': '#0a58ff', '--brand-teal-hover': '#0040d0',
    },
    bg: '#ffffff',
    chrome: {
      pageBg: '#ffffff', ink: '#000000', mutedInk: '#1a1a1a',
      panelBg: '#ffffff', panelBorder: '#000000', accent: '#0a58ff', stageBg: '#ffffff',
    },
  },

  // ── contextual themes — each carries a strong identity for a specific kind of
  //    content, so the model can match the look to the subject, not just the mode.
  slate: {
    label: 'Slate',
    description: 'Cool blue-grey, professional and calm. A softer corporate dark for business reviews, dashboards, B2B reports.',
    surface: 'dark',
    vars: {
      '--background': '#232a33', '--surface-primary': '#2c343f', '--surface-elevated': '#39434f',
      '--border-color': '#3f4a57', '--text-primary': '#eef1f5', '--text-secondary': '#c2cad4',
      '--text-muted': '#8b95a1', '--foreground': '#eef1f5',
      '--brand-teal': '#5b9bd5', '--brand-teal-hover': '#7db0e0',
    },
    bg: '#232a33',
    chrome: {
      pageBg: '#232a33', ink: '#eef1f5', mutedInk: '#8b95a1',
      panelBg: '#2c343f', panelBorder: '#3f4a57', accent: '#5b9bd5', stageBg: '#232a33',
    },
  },
  terminal: {
    label: 'Terminal',
    description: 'Phosphor-green on near-black, like a console/CRT. For code, logs, command output, ops/hacker subject matter.',
    surface: 'dark',
    vars: {
      '--background': '#0a0f0a', '--surface-primary': '#0e160e', '--surface-elevated': '#13211a',
      '--border-color': '#1f3a24', '--text-primary': '#9bff9f', '--text-secondary': '#5fd968',
      '--text-muted': '#3f9647', '--foreground': '#9bff9f',
      '--brand-teal': '#39ff14', '--brand-teal-hover': '#6dff4f',
    },
    bg: '#0a0f0a',
    chrome: {
      pageBg: '#0a0f0a', ink: '#9bff9f', mutedInk: '#4f9657',
      panelBg: '#0e160e', panelBorder: '#1f3a24', accent: '#39ff14', stageBg: '#0a0f0a',
    },
  },
  solarized: {
    label: 'Solarized',
    description: 'The familiar Solarized-dark editor palette — teal-grey ink on deep cyan-navy. Developer-native; pairs with code-heavy decks.',
    surface: 'dark',
    vars: {
      '--background': '#002b36', '--surface-primary': '#073642', '--surface-elevated': '#0b4250',
      '--border-color': '#0b4250', '--text-primary': '#93a1a1', '--text-secondary': '#839496',
      '--text-muted': '#586e75', '--foreground': '#93a1a1',
      '--brand-teal': '#2aa198', '--brand-teal-hover': '#36c0b4',
    },
    bg: '#002b36',
    chrome: {
      pageBg: '#002b36', ink: '#93a1a1', mutedInk: '#586e75',
      panelBg: '#073642', panelBorder: '#0b4250', accent: '#268bd2', stageBg: '#002b36',
    },
  },
  synthwave: {
    label: 'Synthwave',
    description: 'Retro-80s neon: hot pink on deep indigo-purple. High-energy — product launches, gaming, hype decks, anything that should feel electric.',
    surface: 'dark',
    vars: {
      '--background': '#1a0b2e', '--surface-primary': '#241040', '--surface-elevated': '#301a54',
      '--border-color': '#3d2068', '--text-primary': '#f7e9ff', '--text-secondary': '#cdb0ec',
      '--text-muted': '#9477bd', '--foreground': '#f7e9ff',
      '--brand-teal': '#ff2e97', '--brand-teal-hover': '#ff5aae',
    },
    bg: '#1a0b2e',
    chrome: {
      pageBg: '#1a0b2e', ink: '#f7e9ff', mutedInk: '#9477bd',
      panelBg: '#241040', panelBorder: '#3d2068', accent: '#ff2e97', stageBg: '#1a0b2e',
    },
  },
  forest: {
    label: 'Forest',
    description: 'Deep woodland green with warm off-white ink and a moss accent. For nature, sustainability, outdoors, environmental data.',
    surface: 'dark',
    vars: {
      '--background': '#0f1c14', '--surface-primary': '#16291d', '--surface-elevated': '#1d3526',
      '--border-color': '#274a34', '--text-primary': '#e9f1e4', '--text-secondary': '#b9ceb1',
      '--text-muted': '#7f9577', '--foreground': '#e9f1e4',
      '--brand-teal': '#7cc47a', '--brand-teal-hover': '#97d695',
    },
    bg: '#0f1c14',
    chrome: {
      pageBg: '#0f1c14', ink: '#e9f1e4', mutedInk: '#7f9577',
      panelBg: '#16291d', panelBorder: '#274a34', accent: '#7cc47a', stageBg: '#0f1c14',
    },
  },
  mint: {
    label: 'Mint',
    description: 'Fresh pale green-teal on near-white. A clean, calm LIGHT theme for health, wellness, onboarding, anything that should feel airy.',
    surface: 'light',
    vars: {
      '--text-primary': '#0f302a', '--text-secondary': '#2f5249', '--text-muted': '#5c7f75',
      '--foreground': '#0f302a', '--surface-elevated': '#d6efe8',
      '--brand-teal': '#0d9488', '--brand-teal-hover': '#0b7d73',
    },
    bg: '#ecfaf5',
    chrome: {
      pageBg: '#e3f5ee', ink: '#0f302a', mutedInk: '#5c7f75',
      panelBg: '#f3fbf9', panelBorder: '#c2e6db', accent: '#0d9488', stageBg: '#ecfaf5',
    },
  },
  newsprint: {
    label: 'Newsprint',
    description: 'Off-white grey stock, black ink, a single red accent. Editorial / data-journalism / broadsheet feel for reportage and analysis.',
    surface: 'light',
    vars: {
      '--text-primary': '#191919', '--text-secondary': '#3d3d3d', '--text-muted': '#6e6e6e',
      '--foreground': '#191919', '--surface-elevated': '#e7e4dd',
      '--brand-teal': '#b8231f', '--brand-teal-hover': '#9d1b18',
    },
    bg: '#efece4',
    chrome: {
      pageBg: '#e8e5db', ink: '#191919', mutedInk: '#6e6e6e',
      panelBg: '#f4f1ea', panelBorder: '#d2cdc1', accent: '#b8231f', stageBg: '#efece4',
    },
  },
  chalkboard: {
    label: 'Chalkboard',
    description: 'Dark slate-green board with chalky off-white ink and a soft yellow accent. For teaching, lessons, walkthroughs, a hand-drawn classroom feel.',
    surface: 'dark',
    vars: {
      '--background': '#22302b', '--surface-primary': '#293a34', '--surface-elevated': '#33463f',
      '--border-color': '#3f564d', '--text-primary': '#f3f1e6', '--text-secondary': '#d0cebf',
      '--text-muted': '#9b9989', '--foreground': '#f3f1e6',
      '--brand-teal': '#f2d24b', '--brand-teal-hover': '#f6dd72',
    },
    bg: '#22302b',
    chrome: {
      pageBg: '#22302b', ink: '#f3f1e6', mutedInk: '#9b9989',
      panelBg: '#293a34', panelBorder: '#3f564d', accent: '#f2d24b', stageBg: '#22302b',
    },
  },
};

export const PRESENTATION_THEME_NAMES = Object.keys(PRESENTATION_THEMES);

/** The chrome used by the motion player when no theme is named (back-compat). */
export const DEFAULT_CHROME = PRESENTATION_THEMES.dark.chrome;

/**
 * Derive the cook-template CSS-var overrides for a presentation theme.
 *
 * The motion player has its own `chrome`; the static publish templates
 * (outcome.html essay, slide_deck.html) read a different but overlapping set of
 * `--…` page vars. This maps ONE theme onto those vars so a published artifact's
 * chrome matches its embedded visuals — killing the light-page/dark-visual split.
 * Note `--paper` means different things per template (essay: the content card;
 * deck: the page backdrop), so the var names are kind-specific.
 *
 * Emitted on `body { … }` by the caller, which beats each template's own `:root`
 * defaults for everything inside <body> (inheritance, not specificity).
 *
 * @param {PresentationTheme} theme
 * @param {'essay'|'slide_deck'} kind
 * @returns {Object<string,string>} CSS-var name → value
 */
export function presentationDocVars(theme, kind) {
  const c = theme.chrome;
  const shared = {
    '--ink': c.ink,
    '--muted': c.mutedInk,
    '--faint': c.mutedInk,
    '--line': c.panelBorder,
    '--accent': c.accent,
  };
  if (kind === 'slide_deck') {
    return {
      ...shared,
      '--paper': c.pageBg, // deck: the page backdrop behind the slides
      '--slide': c.panelBg, // the slide card
      '--visual-bg': theme.bg, // the sketch backdrop — unifies band with the embedded sketch
      '--visual-ink': c.ink,
    };
  }
  // essay / outcome.html
  return {
    ...shared,
    '--bg': c.pageBg, // essay: the outer page background
    '--paper': c.panelBg, // the reading card
    '--chip-bg': c.panelBg,
    '--chip-ink': c.accent,
    '--code-bg': c.panelBg,
  };
}

/** The sketch render inputs (surface + var overrides) implied by a theme. */
export function presentationSketchTheme(theme) {
  return { surface: theme.surface, vars: theme.vars };
}

// ── Figure domain ──────────────────────────────────────────────────────────
//
// The protoform figure's look is NOT a presentation theme — a slide palette is
// meaningless for a body study. Its axes are backdrop + material + lighting +
// render mode. So it gets its own small named vocabulary of studio SETUPS.
// `filled` setups light the mesh; `wire` renders the ring-wave wireframe (stroke
// the projected ring polylines, no fill) for verifying construction.
//
// No setup → the renderer keeps its built-in defaults (back-compat), which
// `studio-grey` is the named equivalent of.

/**
 * @typedef {object} FigureSetup
 * @property {string} label
 * @property {string} description       model-facing one-liner
 * @property {'filled'|'wire'} mode     lit mesh vs ring-wave wireframe
 * @property {string} bg                backdrop fill
 * @property {string} [fleshHex]        material color (filled mode)
 * @property {{direction:number[],ambient:number,diffuse:number}} [light]  key light (filled)
 * @property {string} [wireStroke]      line color (wire mode)
 */

const FLESH_DEFAULT = '#c8836a';

export const FIGURE_SETUPS = {
  'studio-grey': {
    label: 'Studio grey',
    description: 'Neutral grey seamless backdrop, warm flesh, standard key light. The default studio look.',
    mode: 'filled',
    bg: '#dfe1e4',
    fleshHex: FLESH_DEFAULT,
    light: { direction: [0.42, -0.5, -0.76], ambient: 0.40, diffuse: 0.76 },
  },
  'white-cyc': {
    label: 'White cyclorama',
    description: 'High-key seamless white backdrop with a softer fill — a clean catalog/clinical look.',
    mode: 'filled',
    bg: '#f7f7f5',
    fleshHex: FLESH_DEFAULT,
    light: { direction: [0.36, -0.42, -0.82], ambient: 0.50, diffuse: 0.66 },
  },
  'blueprint-wire': {
    label: 'Blueprint wireframe',
    description: 'Deep blueprint-blue ground with a cyan ring-wave wireframe (no fill) — a construction / verification view, not a finished render.',
    mode: 'wire',
    bg: '#0a2740',
    wireStroke: '#7fdbff',
  },
};

export const FIGURE_SETUP_NAMES = Object.keys(FIGURE_SETUPS);

/**
 * Resolve a figure setup token to its setup object.
 * @param {string} [token]
 * @returns {FigureSetup|null} null when no token (renderer keeps its defaults).
 * @throws if a non-null token is unknown.
 */
export function resolveFigureSetup(token) {
  if (token == null || token === '') return null;
  const setup = FIGURE_SETUPS[token];
  if (!setup) {
    throw new Error(`unknown figure setup '${token}'. One of: ${FIGURE_SETUP_NAMES.join(', ')}.`);
  }
  return setup;
}

/**
 * Resolve a presentation theme token to its theme object.
 *
 * @param {string} [token] — a PRESENTATION_THEME_NAMES entry, or nullish.
 * @returns {PresentationTheme|null} the theme, or null when no token is given
 *   (callers then keep their existing per-surface defaults — back-compat).
 * @throws if a non-null token is not a known theme.
 */
export function resolvePresentationTheme(token) {
  if (token == null || token === '') return null;
  const theme = PRESENTATION_THEMES[token];
  if (!theme) {
    throw new Error(
      `unknown presentation theme '${token}'. One of: ${PRESENTATION_THEME_NAMES.join(', ')}.`,
    );
  }
  return theme;
}
