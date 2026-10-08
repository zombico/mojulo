/**
 * REGISTER — one slider from MODERN (0: 2015 onward, sans serif, the conventions of UX and UI) to IMMERSIVE (1: the
 * late 90s and early 00s, the menu rendered in the engine, a console framed in the world's own materials). The slider
 * moves a set of DIALS together; any dial can be pinned on its own, so a register is tuned, not picked.
 *
 *   REGISTER_STOPS        modern 0 · clean 0.25 · framed 0.5 · console 0.75 · immersive 1 (stops on the scale, not
 *                         presets: a stop sets the slider and the dials still read off it)
 *   DIALS                 each dial's value at the five stops, modern first
 *   readRegister(v)       a number 0..1 or a stop word → the number (throws a teaching error)
 *   stopOf(r)             the nearest stop's word
 *   dialsAt(r, pins)      the dials at r, a pin overriding its dial
 *   validatePins(pins)    errors[] (a pin names a dial and one of its words)
 *   fontOfType(t, hints)  the type dial → a hud-widgets FONTS id (the period face reads the fiction: mono for
 *                         sci-fi, serif otherwise)
 *   SCENE_ONLY            dial values only the scene backend draws; the dom backend draws its nearest and advises
 *   registerCss(dials)    THE DOM BACKEND for the dials: CSS from closed words only (never an author string), laid
 *                         over the HUD page's own sheet (scene/channels/events.js) and the board's specimens alike
 *
 * Tokens (colour) are the guide's, not the register's: the register says how a part is framed, plated and moved.
 */

export const REGISTER_STOPS = Object.freeze({ modern: 0, clean: 0.25, framed: 0.5, console: 0.75, immersive: 1 });
export const STOP_IDS = Object.keys(REGISTER_STOPS);

export const DIALS = Object.freeze({
  type: ['system', 'system', 'system', 'display', 'period'],
  frame: ['none', 'hairline', 'rule', 'bevel', 'material'],
  plate: ['clear', 'flat', 'solid', 'solid', 'textured'],
  surface: ['overlay', 'overlay', 'overlay', 'console', 'console'],
  layout: ['fluid', 'fluid', 'fluid', 'fixed', 'fixed'],
  motion: ['ease', 'ease', 'snap', 'stepped', 'mechanical'],
  sound: ['silent', 'silent', 'silent', 'cues', 'cues'],
  cursor: ['system', 'system', 'system', 'game', 'game'],
  light: ['unlit', 'unlit', 'unlit', 'unlit', 'lit'],
});
export const DIAL_IDS = Object.keys(DIALS);
export const dialWords = (d) => [...new Set(DIALS[d])];

// what each dial does, for the cards and the guide piece
export const DIAL_ABOUT = Object.freeze({
  type: 'the face: a system sans → a display face → the period face the fiction implies',
  frame: 'the edge a part sits in: none → a hairline → a rule → a bevel → a frame built of the kit\'s materials',
  plate: 'what a part sits on: clear → a flat translucent plate → solid → textured from the world\'s surfaces',
  surface: 'what the HUD is drawn on: an overlay → a console band across the bottom',
  layout: 'fluid (content-driven) → fixed (slots cut into a console of fixed size)',
  motion: 'eased (short ease-out) → snapped → stepped → mechanical (shutters, servo slides)',
  sound: 'silent → a cue on every state change (clicks, servos), as cue data',
  cursor: 'the system cursor → the game\'s own',
  light: 'unlit → lit by the scene\'s lights (the scene backend)',
});

// values only the scene backend (in the engine) draws; the dom backend draws the value before it and says so
export const SCENE_ONLY = Object.freeze({ light: ['lit'] });

/** A register as a number 0..1 or a stop word → the number. */
export function readRegister(v) {
  if (typeof v === 'number' && v >= 0 && v <= 1) return Math.round(v * 1000) / 1000;
  if (typeof v === 'string' && STOP_IDS.includes(v)) return REGISTER_STOPS[v];
  throw new Error(`play.ui: register is a number from 0 (modern) to 1 (immersive), or one of: ${STOP_IDS.join(', ')}`);
}

/** The nearest stop's word. */
export function stopOf(r) {
  return STOP_IDS.reduce((best, s) => (Math.abs(REGISTER_STOPS[s] - r) < Math.abs(REGISTER_STOPS[best] - r) ? s : best), STOP_IDS[0]);
}

/** Pins → errors (each pin names a dial and one of its words). */
export function validatePins(pins) {
  if (pins === undefined) return [];
  if (!pins || typeof pins !== 'object' || Array.isArray(pins)) return [`play.ui.pin is { <dial>: <word> } over: ${DIAL_IDS.join(', ')}`];
  const errors = [];
  for (const [d, w] of Object.entries(pins)) {
    if (!DIAL_IDS.includes(d)) errors.push(`play.ui.pin.${d}: no such dial (dials: ${DIAL_IDS.join(', ')})`);
    else if (!dialWords(d).includes(w)) errors.push(`play.ui.pin.${d} is one of: ${dialWords(d).join(', ')}`);
  }
  return errors;
}

/** The dials at register r, each pin overriding its dial. */
export function dialsAt(r, pins = {}) {
  const i = Math.max(0, Math.min(4, Math.round(r * 4))), out = {};
  for (const d of DIAL_IDS) out[d] = pins && dialWords(d).includes(pins[d]) ? pins[d] : DIALS[d][i];
  return out;
}

const MACHINE_FICTION = /sci|cyber|space|mecha|robot|future|terminal|tech/i;
/** The type dial → a FONTS id (game/hud-widgets.js). */
export function fontOfType(type, hints) {
  if (type === 'display') return 'display';
  if (type === 'period') return MACHINE_FICTION.test(String((hints && (hints.fiction || hints.genre)) || '')) ? 'mono' : 'serif';
  return 'system';
}

/** Dials as received (a hand-poked events.register): only known dials with known words survive. */
export function cleanDials(dials) {
  const out = {};
  if (!dials || typeof dials !== 'object') return out;
  for (const d of DIAL_IDS) if (dialWords(d).includes(dials[d])) out[d] = dials[d];
  return out;
}

const FRAME_CSS = {
  none: 'border:0;border-radius:8px',
  hairline: 'border:1px solid var(--moj-line);border-radius:6px',
  rule: 'border:2px solid var(--moj-line);border-radius:3px',
  bevel: 'border:2px outset var(--moj-line);border-radius:0',
  material: 'border:4px ridge var(--moj-line);border-radius:0;box-shadow:inset 0 0 0 1px var(--moj-bg)',
};
// a plate as a background layer (an image, a colour), so a stylized border (borders.js) can stack its art over it
export const PLATE_LAYER = Object.freeze({
  clear: { img: null, color: 'transparent' },
  flat: { img: null, color: 'var(--moj-panel-a)' },
  solid: { img: null, color: 'var(--moj-panel)' },
  textured: { img: 'repeating-linear-gradient(0deg,var(--moj-panel) 0 2px,var(--moj-bg) 2px 3px)', color: 'var(--moj-panel)' },
});
const PLATE_CSS = Object.fromEntries(Object.entries(PLATE_LAYER).map(([k, v]) => [k, `background:${v.img ? `${v.img} ` : ''}${v.color}`]));
// durations are frames at 60 fps; eased motion is the only one that curves
export const MOTION_TIMING = Object.freeze({
  ease: { frames: 11, fn: 'cubic-bezier(.2,.7,.2,1)' },
  snap: { frames: 2, fn: 'steps(1,end)' },
  stepped: { frames: 6, fn: 'steps(3,end)' },
  mechanical: { frames: 8, fn: 'steps(4,end)' },
});
const secs = (frames) => `${Math.round((frames / 60) * 1000) / 1000}s`;

/**
 * The dom backend's sheet for a set of dials, scoped under `scope` (the page's `.moj-hud`, or a board specimen's
 * box). Closed words in, CSS out: nothing an author typed reaches it.
 */
export function registerCss(dials, scope = '.moj-hud') {
  const D = { ...dialsAt(0), ...cleanDials(dials) };
  const m = MOTION_TIMING[D.motion], w = `${scope} .moj-w`;
  const rules = [`${w}{${FRAME_CSS[D.frame]};${PLATE_CSS[D.plate]};transition:opacity ${secs(m.frames)} ${m.fn}}`];
  if (D.motion !== 'ease') rules.push(`${w}-bar .moj-fill{transition:width ${secs(m.frames)} ${m.fn}}`);
  if (D.frame === 'bevel' || D.frame === 'material') rules.push(`${w}-banner{text-shadow:none}${w}-toast{text-shadow:none}`);
  if (D.type === 'display' || D.type === 'period') rules.push(`${w}{letter-spacing:1px}`);
  if (D.surface === 'console') {
    // a console band across the bottom: the bottom columns sit inside it
    const h = D.layout === 'fixed' ? '132px' : '22%';
    rules.push(`${scope}::before{content:'';position:absolute;left:0;right:0;bottom:0;height:${h};${PLATE_CSS[D.plate === 'clear' ? 'solid' : D.plate]};${FRAME_CSS[D.frame].replace(/border:/, 'border-top:').replace(/border-radius:[^;]+;?/, '')}}`);
    rules.push(`${scope} .moj-hud-bottom-left,${scope} .moj-hud-bottom,${scope} .moj-hud-bottom-right{bottom:${D.layout === 'fixed' ? '40px' : '7%'}}`);
  }
  // cursor, sound and light are recorded on the guide; the HUD layer takes no pointer, so the cursor lands with the
  // rung-0 parts you press, the cues with the phase machine, the light with the scene backend
  return rules.join('');
}
