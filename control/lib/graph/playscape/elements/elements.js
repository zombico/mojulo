/**
 * playscape elements — the juice verbs (game/glyph-sfx-sprites.js, and the two the sprite backend left behind) brought
 * into playscape as STATUSES: a character carries one while it is so ("warded", "draining", a black flash), and the page
 * draws it on the body as it moves.
 *
 *   ELEMENTS[id] → { says, when, motion, color, rate, size, trail, params, coat, tone }
 *     trail         ghosts each mark leaves behind on its own path (0: a field, a strike)
 *     says / when   what it means and when to reach for it (the shelf's words)
 *     motion        how its marks move: orbit, rise, spiral-in, burst, converge, ring, twinkle, fall, breathe, column,
 *                   tongues, bolts (one per element: the value signature's motion)
 *     coat          the FRESNEL COAT: a rim glow over the body's own surfaces, "this is happening now".
 *                   { k: strength 0..1, hz: breath per second, p: rim falloff (higher is a thinner rim),
 *                     shape: 'breathe' | 'grow' (rises over the first seconds) | 'flash' (strikes, then decays) |
 *                     'flicker' (re-struck 8 times a second) }
 *     tone          'light' (adds light) or 'dark' (takes it away: black bolts, a black rim)
 *     fire          a burning element: the world's own fire (fire/fire.js) lit on the body, { kind, size, rise: how far
 *                   up the body its bed sits, a share of its height (flames inside a body are hidden by it) }; its flames, embers and smoke are the fire kernel's and it lights what is near.
 *                   A status's color is a colorant (copper burns blue, barium green, strontium red, potassium lilac,
 *                   …) or '#rrggbb': the variations of one element, alike in values as a flame is
 *   ELEMENT_IDS
 *   valueSignature(id) → [tone, motion, coat shape, strength band, pace band]: what reads with the colour taken out
 *   elementMotifs(ids) → page source: each element's beads (and bolts) as functions of (cc, ph, p), deterministic in ph
 *
 * Designed in values first: an element is told apart by light or dark, how strong its coat is, how fast it breathes
 * and how its marks move. Colour is the element's default, a status's own, or the guide's; the grey page must read too.
 */
import { SPRITE_VERBS } from '../../game/glyph-sfx-sprites.js';
import { SFX_VERBS } from '../../game/glyph-sfx.js';
import { FIRE_KIND_LIGHT } from '../../fire/fire.js';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
const hsh = (a, b) => frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
const h3 = (a, b, c) => frac(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);

// kokusen's black-flash currents: nine jagged arcs round the body, struck afresh 8 times a second (the shader's frame
// flicker); a bolt whose dice fall under 0.3 sits the frame out (w 0). Each strike draws its own weight (0.6 to 1.8 of
// the stroke) and every node its own kink of it, tapering from root to tip, so no two strokes read as the same line;
// a bolt may fork once from its middle (a thinner, shorter branch). Nine bolts then nine fork slots, always, so a
// page's pools stay one size: { nodes, t: per-node thickness, w, fork? }.
function kokusenBolts(cc, ph, p) {
  const frame = Math.floor(ph * 8), N = 12, out = [], forks = [];
  for (let j = 0; j < 9; j++) {
    const gj = h3(j, frame, 7.3), A0 = h3(j, 3.3, 1.7) * TAU + ph, weight = 0.6 + 1.2 * h3(j, 9.1, frame), nodes = [], t = [];
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1), A = A0 + u * 2.2, rr = p.arcR + 0.18 * Math.sin(u * 9 + j * 2.1);
      nodes.push([cc[0] + rr * Math.cos(A) + (h3(j, k, frame) - 0.5) * 0.3, cc[1] + rr * Math.sin(A) + (h3(k, j, frame + 3) - 0.5) * 0.3, cc[2] + p.zBase + p.zSpan * u + (h3(frame, j, k) - 0.5) * 0.3]);
      t.push(weight * Math.pow(1 - 0.8 * u, 0.9) * (0.6 + 0.8 * h3(j, k, frame + 11)));
    }
    const w = gj < 0.3 ? 0 : gj;
    out.push({ nodes, t, w });
    // the fork: from a node in the middle, off at its own angle, half the weight, gone as fast
    const at = 4 + Math.floor(h3(j, frame, 2.2) * 4), o = nodes[at], fa = h3(j, frame, 4.4) * TAU, fn = [], ft = [];
    for (let k = 0; k < 5; k++) {
      const u = k / 4, len = 0.45 * u;
      fn.push([o[0] + len * Math.cos(fa) + (h3(j, k, frame + 5) - 0.5) * 0.12, o[1] + len * Math.sin(fa) + (h3(k, j, frame + 6) - 0.5) * 0.12, o[2] + 0.25 * u + (h3(frame, k, j + 7) - 0.5) * 0.12]);
      ft.push(t[at] * 0.55 * (1 - 0.85 * u));
    }
    forks.push({ nodes: fn, t: ft, w: w && h3(j, frame, 8.8) > 0.45 ? w : 0, fork: 1 });
  }
  return out.concat(forks);
}

// the motifs the sprite shelf lacked: the ssj aura (a sheath, a white core, fourteen rising tongues) and kokusen (the
// red aura its bolts are silhouetted against, and a spark at each bolt's head). `s` scales a bead's sprite.
const MOTIFS = {
  'ssj-aura': (cc, ph, p) => {
    const o = [{ p: [cc[0], cc[1], cc[2] + p.coreZ], w: 0.45 + 0.18 * Math.sin(ph), s: 3.2 }, { p: [cc[0], cc[1], cc[2] + p.coreZ], w: 0.8, s: 1.6, white: 1 }];
    for (let k = 0; k < 14; k++) {
      const h1 = hsh(k, 2.7), h2 = hsh(k, 6.3), s = frac(h1 + ph / TAU), A = h2 * TAU + 0.5 * Math.sin(ph + k), r = 0.62 * Math.pow(1 - s, 0.6) + 0.1;
      o.push({ p: [cc[0] + r * Math.cos(A), cc[1] + r * Math.sin(A), cc[2] + 0.1 + p.height * s], w: Math.pow(Math.sin(Math.PI * s), 0.8) * (0.7 + 0.3 * Math.sin(ph * 2 + h2 * TAU)) });
    }
    return o;
  },
  // a burning element's marks are the fire's own (flames, embers, smoke: the fire channel draws them)
  burning: () => [],
  blaze: () => [],
  kokusen: (cc, ph, p) => [{ p: [cc[0], cc[1], cc[2] + p.cz], w: 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(ph * 2)), s: 3 }, ...kokusenBolts(cc, ph, p).filter((b) => !b.fork).map((b) => ({ p: b.nodes[b.nodes.length - 1], w: b.w * 0.9 }))],
};

const words = (id) => ({ says: SFX_VERBS[id] ? SFX_VERBS[id].summary : '', when: SFX_VERBS[id] ? SFX_VERBS[id].when : '' });
const shelf = (id, motion, coat, more = {}) => ({ ...words(id), motion, color: SPRITE_VERBS[id].defaults.color, rate: SPRITE_VERBS[id].rate, size: 0.6, trail: 2, params: { ...SPRITE_VERBS[id].defaults }, coat: { p: 2, ...coat }, tone: 'light', ...more });

export const ELEMENTS = Object.freeze({
  enchant: shelf('enchant', 'orbit', { k: 0.5, hz: 0.5, shape: 'breathe' }),
  heal: shelf('heal', 'rise', { k: 0.55, hz: 0.8, shape: 'breathe' }),
  charge: shelf('charge', 'spiral-in', { k: 0.85, hz: 0, shape: 'grow' }),
  // one burst in 0.7 s (the shelf's path is one burst per turn of ph)
  hit: shelf('hit', 'burst', { k: 1, hz: 0, shape: 'flash' }, { rate: TAU / 0.7 }),
  accumulate: shelf('accumulate', 'converge', { k: 0.45, hz: 1.5, shape: 'grow' }),
  ward: shelf('ward', 'ring', { k: 0.85, hz: 0.25, shape: 'breathe', p: 1.4 }),
  sparkle: shelf('sparkle', 'twinkle', { k: 0.3, hz: 2, shape: 'breathe', p: 3 }),
  drain: shelf('drain', 'fall', { k: 0.55, hz: 0.6, shape: 'breathe', p: 3 }),
  aura: shelf('aura', 'breathe', { k: 0.6, hz: 0.6, shape: 'breathe' }, { size: 1.8, trail: 0 }),
  beacon: shelf('beacon', 'column', { k: 0.35, hz: 0.4, shape: 'breathe' }, { says: 'A breathing column of light over a place: the goal marker.', when: 'a goal, an exit, where to go next', trail: 0 }),
  'ssj-aura': { ...words('ssj-aura'), motion: 'tongues', color: [1, 0.82, 0.25], rate: 1, size: 0.55, trail: 2, params: { coreZ: 0.95, height: 2.1 }, coat: { k: 1, hz: 1.2, p: 1.6, shape: 'breathe' }, tone: 'light' },
  burning: { says: 'Flames lick up the body: it is on fire.', when: 'set alight, a burning foe, a fire spell landing, a torch-bearer', motion: 'flame', color: FIRE_KIND_LIGHT.brazier, rate: 1, size: 0.5, trail: 0, params: {}, coat: { k: 0.6, hz: 4, p: 1.6, shape: 'breathe' }, tone: 'light', fire: { kind: 'brazier', size: 1.5, rise: 0.85 } },
  blaze: { says: 'Engulfed: a fire as tall as the body roars up from its feet.', when: 'a pyre, a burning beast, a fire elemental, a building ablaze, the moment fire wins', motion: 'engulf', color: FIRE_KIND_LIGHT.campfire, rate: 1, size: 0.5, trail: 0, params: {}, coat: { k: 0.95, hz: 2, p: 1.3, shape: 'breathe' }, tone: 'light', fire: { kind: 'campfire', size: 3, rise: 0 } },
  kokusen: { ...words('kokusen'), motion: 'bolts', color: [1, 0.12, 0.15], rate: 1, size: 0.5, trail: 0, params: { cz: 0.95, arcR: 0.6, zBase: 0.3, zSpan: 1.3, width: 0.02 }, coat: { k: 0.9, hz: 0, p: 1.8, shape: 'flicker' }, tone: 'dark' },
});
export const ELEMENT_IDS = Object.freeze(Object.keys(ELEMENTS));

const band = (x, cuts) => cuts.findIndex((c) => x <= c);
/** What an element reads as with the colour taken out. No two elements share one (the values law). */
export function valueSignature(id) {
  const E = ELEMENTS[id];
  return [E.tone, E.motion, E.coat.shape, band(E.coat.k, [0.4, 0.7, 1]), band(E.coat.hz, [0, 0.5, 1, 99])];
}

/** The page source of the named elements' motifs: `const __ELM = { id: { beads, bolts? } }`, deterministic in ph. */
export function elementMotifs(ids) {
  const list = ids.filter((id) => ELEMENTS[id]);
  const body = list.map((id) => {
    const beads = MOTIFS[id] || SPRITE_VERBS[id].beads;
    return `${JSON.stringify(id)}: { beads: ${beads.toString()}${id === 'kokusen' ? ', bolts: kokusenBolts' : ''} }`;
  });
  return `const __ELM = (() => {
  const TAU = 6.283185307179586;
  const frac = (x) => x - Math.floor(x);
  const hsh = (a, b) => frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
  const h3 = (a, b, c) => frac(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);${list.includes('kokusen') ? `\n  ${kokusenBolts.toString()}` : ''}
  return {
    ${body.join(',\n    ')}
  };
})();`;
}

/** Beads of one element at ph (seconds × rate), for tests and bakes. */
export function elementBeads(id, cc, ph, params = {}) {
  const E = ELEMENTS[id];
  if (!E) return [];
  const p = { ...E.params, ...params };
  return (MOTIFS[id] || SPRITE_VERBS[id].beads)(cc, ph, p);
}
export { kokusenBolts };
