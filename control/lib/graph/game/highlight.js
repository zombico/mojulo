/**
 * HIGHLIGHT — a thing in a level INDICATED: lit at its silhouette by a fresnel (bright where its surface turns away
 * from the eye, nothing face on), in a colour, so the player's eye finds it: what can be taken, what is next, what
 * to use. A primitive of the game UI language's fx channel (scene/channels/fx.js): a standing state on an entity by
 * its id, presentation only (it reads the scene and the bus, and writes neither). It is drawn as a status's coat is
 * (scene/channels/coat-src.js: one source for both), in the rim the game's juice gives its characters.
 *
 *   an fx state:  { highlight: true | '#rrggbb', pulse?, power?, k?, as?, when? }
 *     highlight  the colour (true: HIGHLIGHT_COLOR, a warm white that reads on any dress)
 *     pulse      it breathes on the step clock (a thing that waits to be taken)
 *     power      how narrow the rim is (the fresnel's power; 1 a wash over the whole thing, 5 a thin line)
 *     k          how strong
 *                (both unsaid: the GAME'S OWN RIM, the juice floor's, scene/juice-style.js: the look's narrowness and
 *                its cel band, at the game type's strength, as its characters wear; no juice: HIGHLIGHT_RIM, a soft fade)
 *     as         a motion it keeps under the light: float | spin | pulse (the fx channel's own words)
 *     when       a bus var's name: lit only while it is truthy (the quest's next thing; a part a cue shows)
 *
 *   readHighlight(v, where?, rim?)   the state whole, every dial filled (from `rim` { k, p, band } where unsaid, and
 *                              its band); throws on a word it does not know
 *   highlightFor(game)         a level's default: `game.highlight` (true | a colour | { color, pulse, power, k }) read
 *                              for mechanic-decor.js, which lights each thing its mechanics lay to be taken; or null
 * Pure.
 */
export const HIGHLIGHT_COLOR = '#fff1c4';
// the rim a highlight wears where the game says none (a soft fade): the juice floor's `rim` in a game with juice
export const HIGHLIGHT_RIM = Object.freeze({ k: 1.1, p: 2.2, band: 0 });
export const HIGHLIGHT_MOTIONS = Object.freeze(['float', 'spin', 'pulse']);
const HEX = /^#[0-9a-fA-F]{6}$/;
const KEYS = ['highlight', 'pulse', 'power', 'k', 'as', 'when'];
const num = (v, lo, hi, d, where) => { if (v === undefined) return d; if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(`${where} is a number from ${lo} to ${hi}`); return v; };

export function readHighlight(v, where = 'highlight', rim = HIGHLIGHT_RIM) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} is { highlight: true | '#rrggbb', pulse?, power?, k?, as?, when? }`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw new Error(`${where}.${k} is not a highlight's word (${KEYS.join(', ')})`);
  if (v.highlight !== true && !(typeof v.highlight === 'string' && HEX.test(v.highlight))) throw new Error(`${where}.highlight is true or a colour '#rrggbb'`);
  if (v.as !== undefined && !HIGHLIGHT_MOTIONS.includes(v.as)) throw new Error(`${where}.as is one of ${HIGHLIGHT_MOTIONS.join(', ')}`);
  if (v.when !== undefined && (typeof v.when !== 'string' || !v.when)) throw new Error(`${where}.when is a bus var's name`);
  const R = { ...HIGHLIGHT_RIM, ...(rim ?? {}) };
  return { highlight: v.highlight === true ? HIGHLIGHT_COLOR : v.highlight.toLowerCase(), pulse: v.pulse === true, power: num(v.power, 0.5, 8, R.p, `${where}.power`), k: num(v.k, 0.1, 4, R.k, `${where}.k`), band: R.band || 0, ...(v.as ? { as: v.as } : {}), ...(v.when ? { when: v.when } : {}) };
}

/** Whether an fx state is a highlight. */
export const isHighlight = (s) => !!s && typeof s === 'object' && s.highlight !== undefined;

export function highlightFor(game) {
  const h = game && game.highlight;
  if (h === undefined || h === null || h === false) return null;
  if (h === true) return { highlight: true };
  if (typeof h === 'string') return { highlight: h };
  if (typeof h === 'object' && !Array.isArray(h)) { const { color, ...rest } = h; return { highlight: color === undefined ? true : color, ...rest }; }
  throw new Error("game.highlight is true, a colour '#rrggbb' or { color?, pulse?, power?, k? }");
}
