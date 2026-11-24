/**
 * A BOX'S THEMES (docs/metroidvania-map.md "The castle"): what a box is made of and how it is lit, laid over its greybox
 * ring by ring. A theme names a LOOK for each ring, outermost first and the core last (a box with more rings than a theme
 * has looks repeats its middle ones), and the night it stands under. A new theme is a row; a new place a look.
 *
 *   a LOOK  { place, open?, back, stone, mortar, top, trim, glass?, carpet?, bays, ceiling?, pier?, shafts?, near?, focal,
 *             dark, lamp }
 *     open     the ring is out under the sky: its back the night (the sky, the moon, the castle's far towers), a parapet's
 *              merlons standing behind its walk; else its back is a wall of ashlar in `back`
 *     stone    the closed parts' face, `mortar` its coursed joints, `top` its coping (every top a lit edge), `trim` the
 *              band under a lip and the fittings (frames, brackets, rails)
 *     bays     [A, B]: the two pieces its wall alternates bay by bay (backdrop.js BAY_PIECES: an arched window of moonlit
 *              `glass`, a niche and its statue, a banner, a coat of arms, a shelf of books, a portrait, ivy over cracked
 *              stone, a parapet's merlons), ordered by the wall's rhythm (era/wall-rhythm.js)
 *     ceiling  what hangs under its ceiling: `vault` (ribs to a boss a bay), `beams` (a timber and its brackets), none
 *     pier     the pier at each cell's edge, standing out of the wall: `round` (a half-column, its base and capital, the
 *              vault's ribs springing from it), `square` (a chamfered pier), none
 *     shafts   slender wall shafts flanking each bay's piece, rising to the vault's ribs
 *     near     what stands between the lane and the wall, at the cells' edges: `column`, `chain`, none
 *     dado     along its floor: `wainscot` (panels and a rail, a hall's), else a plain plinth (calm behind the play)
 *     lancets  a slit of moonlit glass high in each bay, over its piece: what is seen through a wall with no windows
 *     focal    the one piece a room is remembered by, larger than a bay's (backdrop.js FOCAL_PIECES)
 *     carpet   a runner down its floors (a hall's, the throne's)
 *     dark     how far its shadow falls where no lamp reaches (the share of a colour left: low is a dark mood)
 *     lamp     its light, one a bay: `torch` (a bracket and a flame), `candles` (a sconce of three), `ghost` (a cold
 *              lamp), `brazier` (a bowl of fire on the floor); its colour and its `reach` (m) baked into what stands
 *              near it, its flames haloed, dust hanging in its light
 *   the NIGHT { zenith, horizon, moon: { colour, r }, towers }   the sky an open ring stands under
 *
 *   BOX_THEMES, BOX_THEME_IDS, LAMP_KINDS
 *   lookOf(theme, ring, rings) → the ring's look (`rings` the box's ring count, the core counted)
 *   themeLaws(theme, rings, gates?) → [{ id, holds, says }]   rings-distinct: each ring unlike the one outside it;
 *                                     gates-read: every gate's colour stands out from the back of each ring it is in
 *
 * Pure.
 */
export const LAMP_KINDS = Object.freeze({ torch: 'a bracket and a flame', candles: 'a sconce of three candles', ghost: 'a cold lamp', brazier: 'a bowl of fire' });

export const BOX_THEMES = Object.freeze({
  // the vampire lord's castle, stormed by night: its walls out under the moon, its halls warm with candles, its ward cold
  // and mossy, its keep dark stone and gold, crimson at its heart
  castle: Object.freeze({
    name: 'the vampire lord\'s castle by night',
    night: Object.freeze({ zenith: '#0b0d1f', horizon: '#2a2550', moon: Object.freeze({ colour: '#f1ecd6', r: 1.3 }), towers: '#17162e' }),
    looks: Object.freeze([
      Object.freeze({ place: 'the ramparts', open: true, back: '#1b1f38', stone: '#6c6875', mortar: '#3d3a46', top: '#a6a2ad', trim: '#4f4b58',
        bays: Object.freeze(['merlons', 'merlons']), focal: 'gargoyle', dark: 0.5, lamp: Object.freeze({ kind: 'torch', colour: '#ffad55', reach: 6 }) }),
      Object.freeze({ place: 'the great halls', back: '#3b2a2c', stone: '#8c8179', mortar: '#55493f', top: '#c4b8a6', trim: '#8a6a3e', glass: '#5d7cb4', carpet: '#7a1a26',
        bays: Object.freeze(['arch', 'shelf']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', dado: 'wainscot', focal: 'portrait', dark: 0.36, lamp: Object.freeze({ kind: 'candles', colour: '#ffcc80', reach: 5.5 }) }),
      Object.freeze({ place: 'the inner ward', back: '#1f2c2a', stone: '#5a6658', mortar: '#2f3a30', top: '#8d9a86', trim: '#3f4a3c', glass: '#7fa6a0',
        bays: Object.freeze(['arch', 'ivy']), ceiling: 'beams', pier: 'square', near: 'chain', focal: 'statue', dark: 0.34, lamp: Object.freeze({ kind: 'ghost', colour: '#9fe0ff', reach: 5 }) }),
      Object.freeze({ place: 'the keep', back: '#2a0f16', stone: '#4c3b40', mortar: '#2a1e22', top: '#8a7466', trim: '#c9a24a', carpet: '#8c1020',
        bays: Object.freeze(['banner', 'niche']), ceiling: 'vault', pier: 'round', shafts: true, near: 'column', lancets: true, focal: 'arms', dark: 0.32, lamp: Object.freeze({ kind: 'brazier', colour: '#ff7a3a', reach: 6.5 }) }),
    ]),
  }),
});
export const BOX_THEME_IDS = Object.freeze(Object.keys(BOX_THEMES));

/** The ring's look: the theme's own for the outermost and the core, its middle looks repeated for any rings between. */
export function lookOf(theme, ring, rings) {
  const T = typeof theme === 'string' ? BOX_THEMES[theme] : theme, L = T.looks, last = rings - 1;
  if (ring === 0) return L[0];
  if (ring === last) return L[L.length - 1];
  const mid = L.slice(1, -1);
  return mid.length ? mid[(ring - 1) % mid.length] : L[Math.min(ring, L.length - 1)];
}

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const lum = (h) => { const c = rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
/** WCAG's contrast of two colours (1 to 21) */
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
/** how far two rings must stand apart (the distance of their backs and their stones in RGB, 0 to √3) */
export const RING_APART = 0.12;
/** how far a gate stands out from a back (contrast) */
export const GATE_READS = 2.2;

/** The theme's laws over a box of `rings` rings (the core counted), and, given, the gates it lays: [{ kind, colour, rings }]. */
export function themeLaws(theme, rings, gates = []) {
  const looks = Array.from({ length: rings }, (_, k) => lookOf(theme, k, rings)), out = [];
  const close = [];
  for (let k = 1; k < looks.length; k++) {
    const a = looks[k - 1], b = looks[k];
    if (dist(a.back, b.back) + dist(a.stone, b.stone) < RING_APART) close.push(`${a.place} and ${b.place}`);
  }
  out.push({ id: 'rings-distinct', holds: !close.length, says: close.length ? `${close.join('; ')} look alike` : `each of ${rings} rings unlike the one outside it, in its back and its stone` });
  const faint = [];
  for (const g of gates) for (const r of g.rings) { const c = contrast(g.colour, looks[r].back); if (c < GATE_READS) faint.push(`${g.kind} on ${looks[r].place} (${Math.round(c * 10) / 10})`); }
  out.push({ id: 'gates-read', holds: !faint.length, says: faint.length ? `faint against their room: ${faint.join(', ')}` : `every gate stands out from its room's back (contrast ${GATE_READS} or more)` });
  return out;
}
