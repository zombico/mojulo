/**
 * THE HEAD TUFTS: a library of looks for the top of a feature animal's head (docs/feature-style.md, Tuning), worn by any
 * animal of the style, furred, feathered, scaled or smooth, as a personal touch the operator chooses: `tune.tuft` (a
 * style's name, or { style, colour, size }) or a brief's word (a mohawk, a cowlick, a crest, a topknot …). A new look is a
 * card, not code.
 *
 * A card is its LOCKS, each a tuft (feature-body.js: a rounded body tapering to a rounded point along a bending spine,
 * melted into the skin at its root only), placed on the skull by angle so it sits on any head the grammar makes:
 *   at     [θ, φ]: θ degrees down from the crown's top, φ degrees round from the front toward the right (a lock with
 *          0 < φ < 180 is the right's, mirrored to the left by name: its name ends R)
 *   aim    the lock's direction in the head's frame (x right, y front, z up), `out` the share of the skull's own normal
 *          added to it (1: straight out of the scalp)
 *   len, r, tip, curl, bend   the tuft's own (feature-body.js tuft)
 * The skull is the cranium's ellipsoid in the head's frame (feature-grammar.js: about [0, 0.02, 2.82], radii 0.72 across,
 * 0.63 front to back, 0.6 up; a bird's head shape scales it), a lock's root sunk a little into it so it melts in.
 *
 *   HEAD_TUFTS             the cards (`reads`: the look in a line)
 *   TUFT_COLOURS           the colours a tuft takes by name: the coat's, its pale, its dark, its hair's; or a '#rrggbb'
 *   validateTuft(t) → error strings; resolveTuft(t) → { style, colour, size } or null
 *   tuftLocks(T, { shape, dial }) → the locks in the head's frame (the right's; a name ending R mirrored), group 'Tuft',
 *                          sized by the tuft's `size` and the crown's decoration dial (0: none)
 *   tuftColour(T, palette) → the colour the palette's `Tuft` group takes
 *
 * Pure: data and arithmetic.
 */

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rad = (d) => (d * Math.PI) / 180;

/** the skull a lock is placed on: the cranium's centre and radii [across, front to back, up] in the head's frame, and how
 *  far a root sinks into it */
export const TUFT_SKULL = Object.freeze({ c: [0, 0.02, 2.82], r: [0.72, 0.63, 0.6], sink: 0.07 });

const lock = (name, at, o) => ({ name, at, out: 0, tip: 0.18, curl: 0, bend: [0, -1, 0], ...o });

export const HEAD_TUFTS = Object.freeze({
  // the designed crown (the raccoon's): three overlapping locks swept to one side, falling in length
  swept: { reads: 'a fan of three locks swept to one side, falling in length', locks: [
    lock('crownA', [16, -30], { aim: [0.42, 0.28, 1], len: 0.4, r: 0.12, curl: 24, bend: [1, 0.1, -0.4] }),
    lock('crownB', [10, 0], { aim: [0.5, 0.2, 1], len: 0.33, r: 0.11, curl: 22, bend: [1, 0.1, -0.4] }),
    lock('crownC', [14, 40], { aim: [0.6, 0.12, 1], len: 0.26, r: 0.095, curl: 20, bend: [1, 0.1, -0.4] }),
  ] },
  // one lock standing up at the front of the crown and curling back over on itself, a smaller one behind it
  cowlick: { reads: 'one lock at the front of the crown curling back on itself', locks: [
    lock('cowlick', [30, 0], { aim: [0, 0.2, 1], out: 0.3, len: 0.62, r: 0.14, tip: 0.14, curl: 105, bend: [0, -1, 0] }),
    lock('cowlickB', [8, 160], { aim: [0, -0.3, 1], len: 0.24, r: 0.09, curl: 40, bend: [0, 1, 0] }),
  ] },
  // a ridge of locks down the middle from the brow to the nape, the tallest over the crown
  mohawk: { reads: 'a ridge of locks down the middle, the tallest over the crown', locks: [
    [38, 0, 0.3], [18, 0, 0.42], [2, 180, 0.5], [22, 180, 0.44], [42, 180, 0.32], [60, 180, 0.22],
  ].map(([t, p, len], i) => lock(`mohawk${i}`, [t, p], { aim: [0, -0.25, 0.6], out: 0.8, len, r: 0.12, tip: 0.12, curl: 16, bend: [0, -1, 0] })) },
  // spikes standing straight out of the crown all round it
  spikes: { reads: 'spikes standing straight out all round the crown', locks: [
    lock('spikeTop', [0, 0], { aim: [0, 0.1, 1], out: 0.6, len: 0.42, r: 0.12, tip: 0.08 }),
    lock('spikeFront', [38, 0], { aim: [0, 0.2, 0.6], out: 1, len: 0.34, r: 0.11, tip: 0.08 }),
    lock('spikeBack', [40, 180], { aim: [0, -0.2, 0.5], out: 1, len: 0.36, r: 0.11, tip: 0.08 }),
    lock('spikeAR', [32, 55], { aim: [0.2, 0.1, 0.6], out: 1, len: 0.36, r: 0.11, tip: 0.08 }),
    lock('spikeBR', [36, 125], { aim: [0.2, -0.1, 0.5], out: 1, len: 0.34, r: 0.11, tip: 0.08 }),
  ] },
  // feathers rising from the brow's top and sweeping back over the head in a fan, falling in length (a cockatoo's, a
  // cardinal's, a jay's)
  crest: { reads: 'feathers rising from the brow and sweeping back in a fan', locks: [
    lock('crest0', [34, 0], { aim: [0, -0.35, 1], len: 0.56, r: 0.11, tip: 0.2, curl: 38, bend: [0, -1, -0.2] }),
    lock('crest1', [20, 0], { aim: [0, -0.55, 1], len: 0.62, r: 0.11, tip: 0.2, curl: 34, bend: [0, -1, -0.2] }),
    lock('crest2', [6, 180], { aim: [0, -0.8, 0.8], len: 0.5, r: 0.1, tip: 0.2, curl: 28, bend: [0, -1, -0.3] }),
    lock('crestR', [24, 22], { aim: [0.25, -0.5, 1], len: 0.44, r: 0.09, tip: 0.2, curl: 32, bend: [0, -1, -0.2] }),
  ] },
  // one thin stem rising from the crown and nodding forward to a teardrop (a quail's topknot)
  plume: { reads: 'one thin stem nodding forward to a teardrop, a quail\'s topknot', locks: [
    lock('plume', [12, 0], { aim: [0, 0.3, 1], len: 0.62, r: 0.05, tip: 1.9, curl: 80, bend: [0, 1, -0.4] }),
  ] },
  // locks falling forward from the crown's front over the brow (bangs)
  fringe: { reads: 'locks falling forward over the brow', locks: [
    lock('fringe', [34, 0], { aim: [0, 0.85, -0.2], out: 0.7, len: 0.44, r: 0.14, tip: 0.18, curl: 42, bend: [0, 0, -1] }),
    lock('fringeAR', [34, 28], { aim: [0.3, 0.8, -0.25], out: 0.7, len: 0.4, r: 0.13, tip: 0.18, curl: 40, bend: [0, 0, -1] }),
    lock('fringeBR', [32, 56], { aim: [0.6, 0.6, -0.3], out: 0.7, len: 0.34, r: 0.12, tip: 0.18, curl: 36, bend: [0, 0, -1] }),
  ] },
  // short round locks all over the crown, each flopping its own way (a shaggy mop)
  mop: { reads: 'short round locks all over the crown, each flopping its own way', locks: [
    lock('mopTop', [0, 0], { aim: [0, 0.3, 1], out: 0.5, len: 0.26, r: 0.14, tip: 0.35, curl: 50, bend: [0, 1, -1] }),
    lock('mopFront', [32, 0], { aim: [0, 0.6, 0.4], out: 0.6, len: 0.24, r: 0.13, tip: 0.35, curl: 50, bend: [0, 0, -1] }),
    lock('mopBack', [34, 180], { aim: [0, -0.6, 0.4], out: 0.6, len: 0.24, r: 0.13, tip: 0.35, curl: 50, bend: [0, 0, -1] }),
    lock('mopAR', [26, 45], { aim: [0.5, 0.3, 0.5], out: 0.6, len: 0.24, r: 0.13, tip: 0.35, curl: 45, bend: [0, 0, -1] }),
    lock('mopBR', [28, 130], { aim: [0.5, -0.4, 0.5], out: 0.6, len: 0.22, r: 0.12, tip: 0.35, curl: 45, bend: [0, 0, -1] }),
  ] },
  // one big wave rising off the front of the crown and rolling forward over the brow (a pompadour, a quiff)
  pompadour: { reads: 'one big wave rising off the brow and rolling forward', locks: [
    lock('pomp', [20, 0], { aim: [0, 0.7, 0.9], len: 0.6, r: 0.21, tip: 0.4, curl: 110, bend: [0, 0, -1] }),
    lock('pompR', [24, 30], { aim: [0.3, 0.6, 0.9], len: 0.44, r: 0.15, tip: 0.35, curl: 90, bend: [0, 0, -1] }),
  ] },
  // bare: the crown's designed fan taken away too
  none: { reads: 'a bare crown', locks: [] },
});

/** the colours a tuft takes by name (the palette's groups), else a '#rrggbb' of its own */
export const TUFT_COLOURS = Object.freeze({ coat: 'Body', pale: 'Belly', dark: 'Patch', hair: 'Hair' });
export const TUFT_SIZE = Object.freeze([0.4, 2.5]);

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

export function validateTuft(t) {
  if (t === undefined) return [];
  const styles = Object.keys(HEAD_TUFTS);
  if (typeof t === 'string') return HEAD_TUFTS[t] ? [] : [`tune.tuft: a style (${styles.join(', ')}) or { style, colour?, size? }`];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return [`tune.tuft: a style (${styles.join(', ')}) or { style, colour?, size? }`];
  const errs = [];
  for (const k of Object.keys(t)) if (!['style', 'colour', 'size'].includes(k)) errs.push(`tune.tuft.${k}: not a tuft word (style, colour, size)`);
  if (!HEAD_TUFTS[t.style]) errs.push(`tune.tuft.style: one of ${styles.join(', ')}`);
  if (t.colour !== undefined && !TUFT_COLOURS[t.colour] && !isHex(t.colour)) errs.push(`tune.tuft.colour: ${Object.keys(TUFT_COLOURS).join(', ')} or a '#rrggbb'`);
  if (t.size !== undefined && !(Number.isFinite(t.size) && t.size >= TUFT_SIZE[0] && t.size <= TUFT_SIZE[1])) errs.push(`tune.tuft.size: a number ${TUFT_SIZE[0]}–${TUFT_SIZE[1]} (1 as designed)`);
  return errs;
}

export function resolveTuft(t) {
  if (t === undefined || t === null) return null;
  const T = typeof t === 'string' ? { style: t } : t;
  return { style: T.style, colour: T.colour ?? 'coat', size: T.size ?? 1 };
}

/** a point on the skull at [θ, φ] (sunk a little into it) and the skull's outward normal there, in the head's frame */
function onSkull([theta, phi], shape) {
  const S = TUFT_SKULL, R = [S.r[0] * shape[1], S.r[1] * shape[0], S.r[2] * shape[2]];
  const d = [Math.sin(rad(theta)) * Math.sin(rad(phi)), Math.sin(rad(theta)) * Math.cos(rad(phi)), Math.cos(rad(theta))];
  const n = unit([d[0] / R[0], d[1] / R[1], d[2] / R[2]]), p = [S.c[0] + R[0] * d[0], S.c[1] + R[1] * d[1], S.c[2] + R[2] * d[2]];
  return { p: p.map((x, k) => x - n[k] * S.sink), n };
}

export function tuftLocks(T, { shape = [1, 1, 1], dial = 1 } = {}) {
  if (!T || !(dial > 0)) return [];
  const k = T.size * dial;
  return HEAD_TUFTS[T.style].locks.map((L) => {
    const { p, n } = onSkull(L.at, shape), aim = unit(L.aim.map((x, i) => x + n[i] * L.out));
    return { name: L.name, root: p.map(r4), aim: aim.map(r4), len: r4(L.len * k), r: r4(L.r * (0.6 + 0.4 * k)), tip: L.tip, curl: L.curl, bend: L.bend, bone: 'head', group: 'Tuft', join: 0.05 };
  });
}

export function tuftColour(T, palette) {
  return isHex(T.colour) ? T.colour : palette[TUFT_COLOURS[T.colour]] ?? palette.Body;
}
