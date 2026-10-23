/**
 * JUICE STYLE — the effects' style floor (effect-style.js) composed from what the game is. One floor no longer fits
 * every game: an orb in an anime brawler, a western shooter, a cartoon platformer and a racer should each read as
 * that game's. Speeding an effect up or rounding its sparks changes the whole composition. The floor is two halves:
 *
 *   REGISTER   the art direction, the look half: anime | western (gameworld/characters.js TRADITIONS: the game's
 *              tradition, its book's direction or its kit's pole), each drawn in one of its LOOKS (JUICE_LOOKS):
 *                isekai    (anime's default) the contemporary anime RPG's effects, clean and bright, no ink line: a
 *                          white-hot core into saturated ribbons in a near hue, soft trails, glints, fire as light, a
 *                          halo ring on the blow and glints drifting up after it, its smoke short and tinted
 *                cel       full anime, cel-shaded (the anime fighter's): the isekai look's high-res colour drawn in
 *                          hard painterly shapes: flat bands round a white-hot core, accent hues, fire as spinning
 *                          spirit onions ringed by spikes, speed lines, dark debris specks and a swirl ring, on twos
 *                material  (western's) one colour, motion blur, streaks and chips, grey smoke that lingers, the light
 *                          it throws
 *   FLAVOR     the game type, the time half: realistic | action | platformer | pinball (gameworld/feel/flavor.js
 *              flavorFor: the animation selector, a genre's). Playback rate, anticipation, squash and stretch, arcs,
 *              how many echoes, the shake, the impact's flash, how strongly the effects rim-light the characters, and
 *              a slight change of shape (round sparks in a platformer, streaks at speed)
 *
 * and DIALS over both (JUICE_DIALS): any one number of the composition, pinned. What stays GLOBAL is the floor's own:
 * a line stays a line, a laser one beam, an attack lands on its target (its landing re-read), the white core reads
 * first in greys, a warm bolt burns and a pale ray crackles, the hand is the attack's.
 *
 *   fxStyle: true                          the floor as it always was (FX_STYLE, byte for byte)
 *   fxStyle: { register?, look?, flavor?, …dials }  a composed floor: register anime (its look isekai) by default,
 *                                          flavor action; a look names its register
 *
 *   JUICE_REGISTERS, JUICE_LOOKS, JUICE_FLAVORS, JUICE_DIALS   the registers and their looks, the game types, the dials
 *   readJuiceStyle(v, where)    → { register, look, flavor, …dials } checked (teaches on a bad word)
 *   juiceFloor(style)           → the floor: FX_STYLE's numbers composed, and the composed fields (composed: true)
 *   juiceSignature(F)           → { look, time }: what tells one composition from another
 *
 * Pure data and arithmetic; no dice of its own (the attack's hand is effect-style's).
 */
import { FX_STYLE } from './effect-style.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const HEX = /^#[0-9a-f]{6}$/i;
const hexRgb = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 1000) / 1000);

/** Where a swing trail's colour comes from: the weapon's element, the hero's power colour, the world's palette (its
 *  accent). A trail's `trailColor` is one of these, a colour, or (in code) a function of the context. */
export const TRAIL_SOURCES = Object.freeze(['element', 'power', 'palette']);
/**
 * A swing trail's colour from its source and the game's context { element?, power?, palette? } (each '#rrggbb' or
 * [r, g, b]): a function is called with the context; a source word reads that one; a colour is itself; nothing (or a
 * word whose colour the context lacks) falls to the default chain, the element, else the power colour, else the palette's
 * accent, else null (the look's own).
 */
export function resolveTrailColor(source, ctx = {}) {
  const rgb = (c) => (Array.isArray(c) && c.length === 3 ? c.map((x) => +(+x).toFixed(3)) : typeof c === 'string' && HEX.test(c) ? hexRgb(c) : null);
  if (typeof source === 'function') { const c = rgb(source(ctx)); if (c) return c; }
  else if (TRAIL_SOURCES.includes(source)) { const c = rgb(ctx[source]); if (c) return c; }
  else { const c = rgb(source); if (c) return c; }
  for (const k of TRAIL_SOURCES) { const c = rgb(ctx[k]); if (c) return c; }
  return null;
}
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The looks a register is drawn in. `glyphs` maps a spray's glyph to the look's shape before the game type's, `draw`
 *  after it (a cel look draws every round glyph as its flat cel version); `fps` the drawings a second an effect is
 *  drawn on (null: every frame); `edge` what an attack's edge becomes ('glow': no ink line; 'both': an outline on its
 *  core, in `ink`'s share of its own colour; null: kept); `cel` flat bands with hard edges across a beam; `halo` a clean
 *  ring of light where a blow lands; `motes` glints drifting up after it; `glow` a fire's body burning as added light
 *  (its smoke and dust stay soft); `onions` a fire's body as spirit onions (aura.js: overlapping shells spinning their own ways, rings of spikes round them); `debris` dark specks thrown
 *  from a blow; `tint` how far an explosion's grey smoke is pulled toward a deeper tone of its own
 *  colour; `comic` the manga ink burst; `rim` the characters' rim light from the effects round them (effect-rim.js: `k`
 *  its strength, `p` how narrow, `band` above 0 a cel band where the fresnel passes it, `gap` metres the field stands off
 *  the body) and what it does to a status's
 *  coat (`coat`: its strength ×, with the rim's narrowness and band); `trail` a weapon's swing trail (`kind`: glow | cel
 *  | sheen, `life` s it lingers, `base` how far down the blade it reaches, a share from the tip's end, `fast` the share of the swing's
 *  own peak speed the blade must pass besides the game type's floor (a cel smear marks only the fastest drawings), `glints`, `alpha`,
 *  `color` the look's own when no source gives one). */
export const JUICE_LOOKS = Object.freeze({
  isekai: {
    register: 'anime',
    says: 'the contemporary anime RPG: no ink line; a white-hot core into saturated ribbons in a near hue, soft trails, glints for sparks, fire that burns as glowing light, a halo ring on the blow and glints drifting up after it; smoke short and tinted its colour; smooth, every frame',
    ink: null, companions: true, hue: 35, echoes: 3, echoLag: 0.05, echoShrink: 0.8, echoFade: 0.55,
    rim: { k: 1.1, p: 2.2, band: 0, gap: 0.02, coat: 1.15 }, trail: { kind: 'glow', life: 0.2, base: 0.35, fast: 0.3, glints: true, alpha: 0.9, color: [0.62, 0.86, 1] }, glyphs: { streak: 'spark', chip: 'spark' }, draw: {}, comic: false, halo: true, motes: true, glow: true, onions: false, debris: false, tint: 0.6, smoke: 0.35, light: 1.2, star: 1.35, fps: null, edge: 'glow', cel: false,
  },
  cel: {
    register: 'anime',
    says: 'full anime, cel-shaded (the anime fighter\'s, high-res colour in hard painterly shapes): flat bands with hard edges round a white-hot core, accent hues beside the attack\'s own, fire as overlapping spinning spirit onions ringed by spikes, speed lines, dark debris specks and a swirl ring on the blow, smoke short and coloured; no outline, no grey; drawn on twos',
    ink: null, companions: true, hue: 150, echoes: 3, echoLag: 0.06, echoShrink: 0.82, echoFade: 0.6,
    rim: { k: 1.3, p: 1.5, band: 0.45, gap: 0.04, coat: 1.25 }, trail: { kind: 'cel', life: 0.3, base: 0.6, fast: 0.6, glints: false, alpha: 1, color: [0.55, 0.85, 1] }, glyphs: { spark: 'streak' }, draw: { dot: 'cdot', soft: 'cblob' }, comic: false, halo: true, motes: true, glow: false, onions: true, debris: true, tint: 0.8, smoke: 0.25, light: 0.8, star: 1.3, fps: 12, edge: 'glow', cel: true,
  },
  material: {
    register: 'western',
    says: 'material: no ink, the glow and the light it throws carry it; one colour, the material\'s; motion blur, not afterimages; streaks and chips; grey smoke that lingers; every frame',
    ink: null, companions: false, hue: 40, echoes: 4, echoLag: 0.035, echoShrink: 0.9, echoFade: 0.42,
    rim: { k: 0.5, p: 3.6, band: 0, gap: 0.01, coat: 0.8 }, trail: { kind: 'sheen', life: 0.07, base: 0.5, fast: 0.45, glints: false, alpha: 0.35, color: [0.92, 0.94, 1] }, glyphs: { spark: 'streak' }, draw: {}, comic: false, halo: false, motes: false, glow: false, onions: false, debris: false, tint: 0, smoke: 1.5, light: 1.6, star: 0.9, fps: null, edge: 'glow', cel: false,
  },
});
export const JUICE_LOOK_IDS = Object.freeze(Object.keys(JUICE_LOOKS));
/** The two visual registers (the traditions), each with its looks, the first its default. */
export const JUICE_REGISTERS = Object.freeze(Object.fromEntries(['anime', 'western'].map((r) => {
  const looks = JUICE_LOOK_IDS.filter((l) => JUICE_LOOKS[l].register === r);
  return [r, Object.freeze({ looks, look: looks[0], says: JUICE_LOOKS[looks[0]].says })];
})));
export const JUICE_REGISTER_IDS = Object.freeze(Object.keys(JUICE_REGISTERS));

/** The four game types (flavor.js FLAVORS' names), each as the effects' time. `rate` plays the whole effect faster
 *  (speeds × rate, times ÷ rate); `anticipation` × the floor's charge (0: none added); `stretch`, `arc` × the floor's;
 *  `echoes` × the register's; `fps: 'every'` draws every frame whatever the register says. */
export const JUICE_FLAVORS = Object.freeze({
  realistic: {
    says: 'an effect on earth: its own pace, no charge it was not given, no arc, no stretch, one echo, a light shake',
    rate: 1, anticipation: 0, stretch: 0, arc: 0, echoes: 0.34, shake: 0.6, rim: 0.6, trail: { life: 0.6, min: 3 }, star: 0.8, sparks: 0.8, sparkLife: 1, glyphs: {},
  },
  action: {
    says: 'the blow is the verb: a deep charge held to read, then a snap faster than the eye, a big flash and a hard shake',
    rate: 1.25, anticipation: 1.6, stretch: 1, arc: 1, echoes: 1, shake: 1.35, rim: 1.3, trail: { life: 1.3, min: 1.5 }, star: 1.3, sparks: 1.2, sparkLife: 1, glyphs: {},
  },
  platformer: {
    says: 'a boop: a quick wind-up, squash and stretch, a bouncy arc, round sparks gone in a blink, a soft shake',
    rate: 1.1, anticipation: 0.6, stretch: 1.3, arc: 2.5, echoes: 0.34, shake: 0.5, rim: 1, trail: { life: 0.7, min: 2.2 }, star: 1.2, sparks: 0.8, sparkLife: 0.7, glyphs: { streak: 'dot', spark: 'dot', chip: 'dot' },
  },
  pinball: {
    says: 'speed: everything plays fast, stretched along its flight, a long tail of echoes close behind, streaks, every frame drawn',
    rate: 1.6, anticipation: 0.4, stretch: 1.5, arc: 0, echoes: 1.67, echoLag: 0.5, shake: 0.8, rim: 1.1, trail: { life: 1.6, min: 1 }, star: 1, sparks: 1.5, sparkLife: 1, glyphs: { dot: 'streak', spark: 'streak' }, fps: 'every',
  },
});
export const JUICE_FLAVOR_IDS = Object.freeze(Object.keys(JUICE_FLAVORS));

/** The dials: one number (or switch) of the composition pinned over both cards. [lo, hi, what it is] */
export const JUICE_DIALS = Object.freeze({
  rate: [0.25, 4, 'how fast the effect plays (× its own pace)'],
  fps: [0, 60, 'drawings a second (0: every frame)'],
  anticipation: [0, 4, '× the floor\'s charge before release (0: none added)'],
  ink: [0, 1, 'the ink edge\'s share of the attack\'s own colour (0: none added)'],
  echoes: [0, 8, 'afterimages behind a bolt'],
  stretch: [0, 3, 'a head\'s stretch along its flight'],
  arc: [0, 6, '× the floor\'s rise on a bolt'],
  shake: [0, 3, '× an effect\'s camera shake'],
  light: [0, 4, '× the light an explosion throws'],
  smoke: [0.2, 4, '× how long soft puffs linger'],
  star: [0.2, 4, '× the impact\'s flash'],
  sparks: [0, 4, '× how many sparks'],
  hue: [0, 180, 'degrees the companions stand round from the attack\'s hue'],
  tint: [0, 1, 'how far grey smoke is pulled toward the effect\'s own pale colour'],
  rim: [0, 3, '× the characters\' rim light from the effects round them (0: none)'],
  trail: [0, 3, '× how long a weapon\'s swing trail lingers (0: none)'],
  companions: 'switch',
  halo: 'switch',
  motes: 'switch',
  comic: 'switch',
});
const STYLE_KEYS = ['register', 'look', 'flavor', 'trailColor', ...Object.keys(JUICE_DIALS)];

/** A composed style's words, checked. */
export function readJuiceStyle(v, where = 'fxStyle') {
  if (!isObj(v)) throw new Error(`${where} is true (the floor) or { register?, look?, flavor?, …dials } (a composed floor)`);
  const bad = Object.keys(v).filter((k) => !STYLE_KEYS.includes(k));
  if (bad.length) throw new Error(`${where} has no ${bad.join(', ')}: it is { ${STYLE_KEYS.join(', ')} }`);
  if (v.look !== undefined && !JUICE_LOOKS[v.look]) throw new Error(`${where}.look is ${JUICE_LOOK_IDS.join(' | ')} (how the register is drawn)`);
  const register = v.register ?? (v.look !== undefined ? JUICE_LOOKS[v.look].register : 'anime'), flavor = v.flavor ?? 'action';
  if (!JUICE_REGISTERS[register]) throw new Error(`${where}.register is ${JUICE_REGISTER_IDS.join(' | ')} (the game's visual register)`);
  const look = v.look ?? JUICE_REGISTERS[register].look;
  if (JUICE_LOOKS[look].register !== register) throw new Error(`${where}.look '${look}' is the ${JUICE_LOOKS[look].register} register's: ${register} is drawn ${JUICE_REGISTERS[register].looks.join(' | ')}`);
  if (!JUICE_FLAVORS[flavor]) throw new Error(`${where}.flavor is ${JUICE_FLAVOR_IDS.join(' | ')} (the game type's animation)`);
  const out = { register, look, flavor };
  if (v.trailColor !== undefined) {
    const c = v.trailColor;
    if (!((typeof c === 'string' && (TRAIL_SOURCES.includes(c) || HEX.test(c))) || (Array.isArray(c) && c.length === 3 && c.every((x) => num(x) && x >= 0 && x <= 1)))) throw new Error(`${where}.trailColor is ${TRAIL_SOURCES.join(' | ')}, '#rrggbb' or [r, g, b] (a function goes to resolveTrailColor)`);
    out.trailColor = c;
  }
  for (const [k, d] of Object.entries(JUICE_DIALS)) {
    if (v[k] === undefined) continue;
    if (d === 'switch') { if (typeof v[k] !== 'boolean') throw new Error(`${where}.${k} is true or false`); out[k] = v[k]; continue; }
    if (!(num(v[k]) && v[k] >= d[0] && v[k] <= d[1])) throw new Error(`${where}.${k} is ${d[2]}, ${d[0]} to ${d[1]}`);
    out[k] = v[k];
  }
  return out;
}

// a glyph through the look's shape, then the game type's, then how the look draws it
const glyphMap = (Rg, Fl) => {
  const out = {};
  for (const g of ['dot', 'soft', 'streak', 'drop', 'flake', 'leaf', 'spark', 'chip']) {
    const a = Rg.glyphs[g] ?? g, b = Fl.glyphs[a] ?? a, c = Rg.draw[b] ?? b;
    if (c !== g) out[g] = c;
  }
  return out;
};

/** The floor a composed style asks for: FX_STYLE's shape with its numbers composed, and the composed fields. */
export function juiceFloor(style) {
  const S = readJuiceStyle(style), Rg = JUICE_LOOKS[S.look], Fl = JUICE_FLAVORS[S.flavor], F = FX_STYLE;
  const pick = (k, v) => (S[k] !== undefined ? S[k] : v);
  const glyphs = glyphMap(Rg, Fl);
  const sparkK = pick('sparks', Fl.sparks);
  const fps = S.fps !== undefined ? (S.fps || null) : Fl.fps === 'every' ? null : Rg.fps;
  return Object.freeze({
    ...F,
    composed: true, register: S.register, look: S.look, flavor: S.flavor,
    ink: S.ink !== undefined ? (S.ink || null) : Rg.ink,
    echoes: Math.round(pick('echoes', Rg.echoes * Fl.echoes)),
    echoLag: r3(Rg.echoLag * (Fl.echoLag ?? 1)), echoShrink: Rg.echoShrink, echoFade: Rg.echoFade,
    companions: pick('companions', Rg.companions),
    companion: Object.freeze({ ...F.companion, hue: pick('hue', Rg.hue) }),
    charge: Object.freeze({ ...F.charge, time: r3(F.charge.time * pick('anticipation', Fl.anticipation)) }),
    stretch: r3(S.stretch !== undefined ? S.stretch : F.stretch * Fl.stretch),
    arc: r3(F.arc * pick('arc', Fl.arc)),
    sparks: Object.freeze({ ...F.sparks, glyph: glyphs[F.sparks.glyph] ?? F.sparks.glyph, count: Math.max(1, Math.round(F.sparks.count * sparkK)), life: r3(F.sparks.life * Fl.sparkLife) }),
    rate: pick('rate', Fl.rate), fps,
    glyphs: Object.freeze(glyphs), sparkK, sparkLife: Fl.sparkLife,
    comic: pick('comic', Rg.comic), glow: Rg.glow, onions: Rg.onions, debris: Rg.debris, halo: pick('halo', Rg.halo), motes: pick('motes', Rg.motes), tint: pick('tint', Rg.tint), edge: Rg.edge, cel: Rg.cel,
    shakeK: pick('shake', Fl.shake), lightK: pick('light', Rg.light), smokeK: pick('smoke', Rg.smoke),
    starK: r3(pick('star', Rg.star * Fl.star)),
    // the characters' rim: the look's (how narrow, a soft fade or a cel band, how a status's coat is lifted) at the game
    // type's strength
    rim: Object.freeze({ k: r3(pick('rim', Rg.rim.k * Fl.rim)), p: Rg.rim.p, band: Rg.rim.band, gap: Rg.rim.gap, coat: Rg.rim.coat }),
    // a weapon's swing trail: the look's kind (a glow ribbon, cel smear sheets, a sheen) lingering the game type's time,
    // left once the blade's tip moves faster than the game type's floor (m/s) and the look's share of the swing's own
    // running peak, in its colour (resolveTrailColor)
    trail: Object.freeze({ kind: Rg.trail.kind, life: r3(Rg.trail.life * Fl.trail.life * pick('trail', 1)), min: Fl.trail.min, fast: Rg.trail.fast, base: Rg.trail.base, glints: Rg.trail.glints, alpha: Rg.trail.alpha,
      color: resolveTrailColor(S.trailColor) ?? Rg.trail.color }),
  });
}

/** What tells one composition from another: its look (values and shape) and its time. */
export function juiceSignature(F) {
  const look = [F.look, F.cel ? 'cel bands' : 'soft glow', F.ink ? `ink ${F.ink}` : 'no ink', F.companions ? 'companions' : 'one colour', F.halo ? 'halo' : 'no halo', F.motes ? 'motes' : 'no motes', F.tint ? `smoke tinted ${F.tint}` : 'grey smoke', F.comic ? 'comic burst' : 'no burst',
    `sparks ${F.sparks.glyph}×${F.sparks.count}`, F.trail.life ? `trail ${F.trail.kind} ${F.trail.life}s over ${F.trail.min} m/s` : 'no trail', F.rim.k ? `rim ${F.rim.band ? 'cel band' : `soft p${F.rim.p}`} ×${F.rim.k}` : 'no rim', `smoke ×${F.smokeK}`, `light ×${F.lightK}`, F.fps ? `${F.fps} drawings/s` : 'every frame'].join(' · ');
  const time = [`rate ×${F.rate}`, F.charge.time ? `charge ${F.charge.time}s` : 'no charge', `stretch ${F.stretch}`, `arc ${F.arc}`, `${F.echoes} echoes @${F.echoLag}s`, `shake ×${F.shakeK}`, `flash ×${F.starK}`].join(' · ');
  return { look, time };
}
