/**
 * THE COCKPIT'S LOOK — how a starfighter's instruments are coloured and how its panel is made, as data the cockpit HUD
 * (cockpit-hud.js) draws. The principles, at length in docs/cockpit-instruments.md:
 *
 *   A DARK COCKPIT. What is normal is quiet: every readout that is as it should be is the one phosphor, its labels dimmer
 *   than its figures. Colour is rare, so a colour pops out before it is read (pre-attentive pop-out holds only while few
 *   hues are on the screen); a pilot who sees colour knows something wants them.
 *
 *   ONE CODE, the annunciation code aviation flies by (red a warning, amber a caution, green normal, cyan an advisory,
 *   magenta what is selected or commanded) with the symbology code's sides (a friend cyan-blue, a hostile red):
 *     normal     the phosphor: readouts, scales, the gunsight
 *     label      the phosphor dimmed: what a figure is, never brighter than the figure
 *     figure     the phosphor bright: the numbers a glance is for
 *     friend     cyan-blue: a friend on the sensors, the comms (an advisory)
 *     hostile    red: a foe on the sensors
 *     target     magenta: the one the computer holds, its brackets, its lead pip, its mark on the sensors. No other
 *                thing in space is magenta (the stars are white, the bolts red and green, the fire orange), so the
 *                target is found by its hue alone
 *     caution    amber: a pool running low (the cannons under a quarter, a shield under a third, the hull under a half)
 *     warning    red, beating: a shield down, the hull under a quarter
 *     shields    blue: the one system with a hue of its own, the shield's own colour in the world (its shimmer)
 *   Hue says what a thing is; chroma and motion say how urgent: a caution steady, a warning beating, and the master
 *   lamps on the glare shield lit by either, so the eye is called to the panel before it finds the gauge.
 *
 *   LUMINANCE IN THREE STEPS: labels at about half the figures' value, the figures, then the cues over the world (the
 *   gunsight, the target) brightest; the glass under them near black, so every step holds its contrast.
 *
 *   A PANEL THAT IS A THING: painted metal by the craft's card (`panel.paint`), lit from above by the star when the
 *   star is above the craft (the key light sweeping over the glare shield as the craft rolls), each screen in a bevelled
 *   bezel held by four screws, a placard naming each, and the screens' own phosphor spilling onto the metal round them.
 *
 *   COCKPIT_COLOURS            the code (hex)
 *   COCKPIT_THEME              mana-ui's theme for the instruments: the terminal's, its tokens the code's
 *   COCKPIT_ALERTS             the thresholds: a caution and a warning for each pool
 *   PLACARDS                   each screen's name on its placard
 *   cockpitAlerts(facts, L)    → { caution: [..], warning: [..] } the pools past COCKPIT_ALERTS (pure: the page runs it)
 *   keyOnPanel(sun, f, u)      → 0..1 how much the star lights the panel's top (pure: the page runs it)
 *   panelPaint(card)           → the panel's metal: its paint, its lit edge, its shade, its bezels (hex)
 */

export const COCKPIT_COLOURS = Object.freeze({
  normal: '#7dff9a', label: '#4f9a66', figure: '#c6ffd6', glass: '#04100a',
  friend: '#4cc4ff', hostile: '#ff4a3d', target: '#ff4fd8',
  caution: '#ffb000', warning: '#ff3b30', shields: '#6f9dff',
});

const C = COCKPIT_COLOURS;
/** The instruments' theme: the terminal's phosphor, every token a colour of the code. */
export const COCKPIT_THEME = Object.freeze({
  // (its bars filled solid, so a gauge's colour is its state: the terminal's hatching would fight the code)
  from: 'terminal', fills: 'solid',
  tokens: Object.freeze({ ink: C.figure, panel: C.glass, line: C.label, accent: C.normal, accent2: C.target, mid: C.label, harm: C.warning, hp: C.normal, mp: C.normal, shield: C.shields }),
});

/** The thresholds (a share of full): under `caution` amber, under `warning` red and beating; a shield side at zero is
 *  down (a warning). */
export const COCKPIT_ALERTS = Object.freeze({ lasers: Object.freeze({ caution: 0.25 }), shields: Object.freeze({ caution: 1 / 3, warning: 0 }), hull: Object.freeze({ caution: 0.5, warning: 0.25 }) });

/** Each screen's name on its placard (the slots' keys). */
export const PLACARDS = Object.freeze({ fore: 'SENSOR FWD', systems: 'SYSTEMS', computer: 'TARGETING', flight: 'FLIGHT · POWER', aft: 'SENSOR AFT' });

/** The pools past their thresholds (`L` COCKPIT_ALERTS, passed: the page inlines this alone): facts { lasers?: share,
 *  shields?: [fore, aft] shares | null, hull: share }. */
export function cockpitAlerts(f, L) {
  const A = { caution: [], warning: [] };
  if (Number.isFinite(f.hull)) { if (f.hull <= L.hull.warning) A.warning.push('hull'); else if (f.hull < L.hull.caution) A.caution.push('hull'); }
  if (Array.isArray(f.shields)) {
    if (f.shields.some((s) => s <= 0)) A.warning.push('shields');
    else if (f.shields.some((s) => s < L.shields.caution)) A.caution.push('shields');
  }
  if (Number.isFinite(f.lasers) && f.lasers < L.lasers.caution) A.caution.push('lasers');
  return A;
}

/** How much the star lights the panel's top: the star's direction (toward it) against the craft's up, leaning on its
 *  nose (a panel's top faces up and a little back toward the pilot, under the canopy's glass). 0 under the craft. */
export function keyOnPanel(sun, f, u) {
  if (!sun || !f || !u) return 0;
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const n = [u[0] - 0.35 * f[0], u[1] - 0.35 * f[1], u[2] - 0.35 * f[2]], L = Math.hypot(n[0], n[1], n[2]) || 1;
  return Math.max(0, Math.min(1, d(sun, n) / L));
}

const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => hexOf(rgbOf(a).map((v, k) => v + (rgbOf(b)[k] - v) * t));
/** The panel's metal from its card's paint (a craft's own: a light grey for the general, a near-black for the other
 *  side's): the paint, its edge where the light catches it, its shade under the lip, its bezels and their screws. */
export function panelPaint(card) {
  const p = (card && card.panel && card.panel.paint) || '#22272d';
  return { paint: p, lit: mix(p, '#ffffff', 0.32), shade: mix(p, '#000000', 0.55), lip: mix(p, '#000000', 0.35), bezel: mix(p, '#000000', 0.25), bevel: mix(p, '#ffffff', 0.18), screw: mix(p, '#ffffff', 0.4), placard: mix(p, '#000000', 0.6), ink: '#c9d1d9', well: '#020504' };
}
