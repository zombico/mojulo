/**
 * versus fx — what a fight draws of what happens in it: one library of effects for every art style, the hit and the
 * block told apart at a glance, and the elements a fighter carries on its limbs (inlined into the arena's block, a
 * page module: no imports).
 *
 * The sim says what happened (versus-core.js events: a hit, a counter, a block, a parry, a clash, a guard crushed, a
 * SPARK, a KO, each blow with where it landed `at`, how heavy `w` 0 light … 3 a super, what struck `limb` and the
 * move's `kind`); a CARD says how it is drawn, as parts every register draws its own way:
 *
 *   core     the white-hot centre of the blow, its size and how long it burns (frames)
 *   ring     a shock ring thrown out from it (or, `in`, snapping inward: a parry)
 *   rays     streaks flung out of it, how many and how long (the heavier, the more)
 *   arc      a guard's shield: a bowed band facing the blow, struck and fading (a block)
 *   shards   the guard broken: panes flung out (a crush)
 *   bolts    jagged currents round it, how many, how far, their colour (a spark's black ones, a lightning fist's)
 *   light    a real light at the contact for a moment, how strong: it lights the fighters (the register's rig)
 *   coat     light laid on the body it lands on (versus-arena.client.js bodyCoat: a fresnel rim on the figure's own
 *            surface): round where it landed (`reach` metres) or the whole figure (reach 0), how strong, how long, dark
 *   frame    an impact frame over the whole picture: 'flash' (a white blink), 'invert' (the picture turned negative, a
 *            spark's held moment), how many frames
 *   hold     frames the effect holds its peak before it lets go (a spark's held moment, the sim's sparkStop)
 *
 * The REGISTER skins the same parts (FX_SKINS, the fight's register, versus-levels.js FIGHT_REGISTERS; the juice
 * register's looks, scene/juice-style.js: anime's `cel`, western's `material`): `cel` hard bands round the white core,
 * flat colour, drawn on twos; `material` soft falloff, a glow standing in for bloom, every frame. One library, every
 * style: a hit reads a hit, a block a block, in both.
 *
 * ELEMENTS (FX_ELEMENTS): what a fighter's limbs carry, `element: 'fire' | { kind, on }` on its recipe (on: fists,
 * feet, limbs, weapon; fists by default), as a COAT of light on the figure itself, gathered round those limbs and
 * flickering at the element's own rate: `fire` a warm licking rim (flaming fists), `lightning` a fast white-blue
 * flicker, `frost` a slow cold breath, `void` a darkening with a red rim. Flaring as the limb strikes, and a blow struck
 * with it coats the body it lands on in the element (its colour, its light). The sim never reads it.
 *
 *   readElement(v, where)        → { kind, on } | null (throws naming the fault)
 *   fxCard(e, element?)          → the card an event is drawn by (null: nothing drawn), at its weight, in its element
 *   fxBolt(seed, from, to, n, amp) → a jagged current's points (deterministic: the same seed is the same bolt)
 *   FX_CARDS, FX_ELEMENTS, FX_SKINS, FX_LIMBS
 *
 * Pure, no dice: a bolt's jags are hashed from its seed.
 */

const isObjFx = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fxHash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

/** how each register draws the same parts: bands (0 a smooth falloff, else the steps), its glow, on twos or every frame */
export const FX_SKINS = Object.freeze({
  anime: Object.freeze({ look: 'cel', bands: 3, glow: 0.55, twos: true, ink: 0.85 }),
  western: Object.freeze({ look: 'material', bands: 0, glow: 1, twos: false, ink: 0 }),
});

/** the limbs an element may ride, by the figure's points */
export const FX_LIMBS = Object.freeze({ fists: ['fist'], feet: ['foot'], limbs: ['fist', 'foot'], weapon: ['blade'] });

/** the elements, each a coat of light on the figure (versus-arena.client.js bodyCoat): its rim's colour, how fast it
 * flickers (hz), how far round each limb it gathers (m), how strong at rest and as the limb strikes, the light its blows
 * throw; a dark one darkens what it coats, its colour only at the very rim */
export const FX_ELEMENTS = Object.freeze({
  fire: Object.freeze({ says: 'a warm rim licking round the limb, flaring as it strikes; its blows coat the one struck in flame', rim: '#ff8a1e', flicker: 9, reach: 0.24, rest: 0.9, strike: 2.2, light: '#ff8a3c' }),
  lightning: Object.freeze({ says: 'a white-blue rim flickering fast round the limb, arcing bright as it strikes; its blows coat the one struck in it', rim: '#9fd8ff', flicker: 38, reach: 0.22, rest: 0.8, strike: 2.4, light: '#9fd8ff' }),
  frost: Object.freeze({ says: 'a cold rim breathing slowly round the limb; its blows coat the one struck in rime', rim: '#a9ecff', flicker: 3, reach: 0.24, rest: 0.75, strike: 1.8, light: '#bfefff' }),
  void: Object.freeze({ says: 'a darkening round the limb, red at its very rim; its blows coat the one struck dark', rim: '#ff3048', flicker: 6, reach: 0.26, rest: 0.8, strike: 1.8, light: '#ff2a3a', dark: true }),
});

/** Read a fighter's element: a word (on its fists) or { kind, on? }; → { kind, on } or null (throws naming the fault). */
export function readElement(v, where = 'element') {
  if (v === undefined || v === null || v === false) return null;
  const spec = typeof v === 'string' ? { kind: v } : v;
  if (!isObjFx(spec)) throw new Error(`versus: ${where} is ${Object.keys(FX_ELEMENTS).join(' | ')} or { kind, on? }`);
  for (const k of Object.keys(spec)) if (k !== 'kind' && k !== 'on') throw new Error(`versus: ${where}.${k} is not an element's word (kind, on)`);
  if (!FX_ELEMENTS[spec.kind]) throw new Error(`versus: ${where}.kind is one of ${Object.keys(FX_ELEMENTS).join(', ')}`);
  const on = spec.on ?? 'fists';
  if (!FX_LIMBS[on]) throw new Error(`versus: ${where}.on is one of ${Object.keys(FX_LIMBS).join(', ')} (the limbs it rides)`);
  return { kind: spec.kind, on };
}

// the weights: a light blow, a medium, a heavy, a super
const FX_WEIGHT = (w) => [0.8, 1, 1.22, 1.45][Math.max(0, Math.min(3, w ?? 1))];
/** THE CARDS: an event's parts at weight 1 (a medium blow); sizes in metres, times in frames */
export const FX_CARDS = Object.freeze({
  hit: Object.freeze({ color: '#ffffff', tint: '#ffe08a', core: { size: 0.22, life: 7 }, ring: { size: 0.55, life: 9 }, rays: { n: 5, length: 0.42, life: 6 }, light: { power: 0.9, life: 7 }, coat: { k: 1.1, reach: 0.5, life: 9 } }),
  counter: Object.freeze({ color: '#ffffff', tint: '#ffc21f', core: { size: 0.28, life: 9 }, ring: { size: 0.75, life: 11, double: true }, rays: { n: 8, length: 0.6, life: 7 }, light: { power: 1.4, life: 9 }, coat: { k: 1.6, reach: 0.8, life: 12 }, frame: { kind: 'flash', n: 1 } }),
  block: Object.freeze({ color: '#d8f1ff', tint: '#56b8ff', arc: { size: 0.42, life: 9 }, rays: { n: 3, length: 0.22, life: 5 }, light: { power: 0.35, life: 5 }, coat: { k: 1, reach: 0.45, life: 8 } }),
  parry: Object.freeze({ color: '#ffffff', tint: '#7ae0ff', core: { size: 0.2, life: 6 }, ring: { size: 0.55, life: 8, in: true }, light: { power: 0.7, life: 6 }, coat: { k: 1.5, reach: 0, life: 10 }, frame: { kind: 'flash', n: 1 } }),
  clash: Object.freeze({ color: '#fff4e0', tint: '#ff9a3a', core: { size: 0.24, life: 8 }, ring: { size: 0.62, life: 9 }, rays: { n: 8, length: 0.5, life: 7 }, light: { power: 1, life: 8 } }),
  crush: Object.freeze({ color: '#ffe0d8', tint: '#ff4a2e', arc: { size: 0.46, life: 7 }, shards: { n: 6, size: 0.08, life: 14 }, ring: { size: 0.65, life: 10 }, light: { power: 1, life: 9 }, coat: { k: 1.6, reach: 0, life: 14 }, frame: { kind: 'flash', n: 1 } }),
  // the SPARK: the blow and the opening met in one frame; the picture turns negative and is held, black currents with a
  // red edge burst out of it, the body it lands on darkened with a red rim, then it lets go
  spark: Object.freeze({ color: '#ff2a3a', tint: '#0a0006', dark: true, core: { size: 0.3, life: 11 }, ring: { size: 0.85, life: 12 }, rays: { n: 6, length: 0.7, life: 8 }, bolts: { n: 6, reach: 0.6, life: 12, color: '#120006', edge: '#ff1f3d' }, light: { power: 1.8, life: 10, color: '#ff2a3a' }, coat: { k: 1.8, reach: 0, life: 14, color: '#ff1f3d', dark: true }, frame: { kind: 'invert', n: 2 }, hold: 'stop' }),
  ko: Object.freeze({ color: '#ffffff', tint: '#ffd23a', core: { size: 0.32, life: 16 }, ring: { size: 1.2, life: 20, double: true }, rays: { n: 10, length: 0.9, life: 12 }, light: { power: 2, life: 16 }, coat: { k: 2, reach: 0, life: 24 }, frame: { kind: 'flash', n: 2 } }),
});

/**
 * The card an event is drawn by, at its weight (a heavier blow bigger, brighter and longer), and in the striker's
 * element when the blow was struck with the limb it rides (its colours, its bolts, its light): → { kind, …parts, at,
 * w, color, tint, element? } or null for an event that draws nothing here.
 */
export function fxCard(e, element = null) {
  // (a blow that sparked is drawn by its spark, the event before it)
  if ((e.t === 'hit' || e.t === 'counter') && e.spark) return null;
  const base = FX_CARDS[e.t];
  if (!base || !Array.isArray(e.at)) return null;
  const k = FX_WEIGHT(e.w);
  const scale = (part, keys) => (part ? Object.fromEntries(Object.entries(part).map(([key, v]) => [key, keys.includes(key) && typeof v === 'number' ? (key === 'n' ? Math.round(v * (0.6 + 0.4 * k)) : key === 'life' ? Math.round(v * (0.8 + 0.2 * k)) : v * k) : v])) : undefined);
  const card = { kind: e.t, at: e.at, w: e.w ?? 1, color: base.color, tint: base.tint, ...(base.dark ? { dark: true } : {}) };
  for (const part of ['core', 'ring', 'rays', 'arc', 'shards', 'bolts', 'light']) if (base[part]) card[part] = scale(base[part], ['size', 'length', 'reach', 'power', 'n', 'life']);
  if (base.coat) card.coat = { color: base.coat.color ?? base.tint, k: base.coat.k * k, reach: base.coat.reach, life: base.coat.life, ...(base.coat.dark ? { dark: true } : {}) };
  if (base.frame) card.frame = base.frame;
  if (base.hold) card.hold = base.hold;
  // (a blow struck with the limb an element rides lands as the element: the body it lands on coated in it)
  const El = element && FX_ELEMENTS[element.kind];
  if (El && (e.t === 'hit' || e.t === 'counter') && FX_LIMBS[element.on].includes(e.limb === 'shot' ? '' : e.limb)) {
    card.element = element.kind;
    card.tint = El.rim;
    if (card.light) card.light = { ...card.light, power: card.light.power * 1.15, color: El.light };
    card.coat = { ...card.coat, color: El.rim, k: card.coat.k * 1.3, reach: card.coat.reach * 1.4, ...(El.dark ? { dark: true } : {}) };
  }
  return card;
}

/** A jagged current from `from` to `to` (points [x, z], metres): n segments, each joint pushed across the line by up
 * to `amp` of its length, less toward the ends; deterministic in `seed`. → [[x, z], …] */
export function fxBolt(seed, from, to, n = 8, amp = 0.18) {
  const dx = to[0] - from[0], dz = to[1] - from[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, j = i === 0 || i === n ? 0 : (fxHash(seed, i) * 2 - 1) * amp * L * Math.sin(Math.PI * u);
    out.push([from[0] + dx * u + nx * j, from[1] + dz * u + nz * j]);
  }
  return out;
}
