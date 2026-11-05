/**
 * The lock's coat, its WORDS: the cards, a coat's form, its resolution and a lock's frame (hair-coat.js has the rest:
 * the beast's validators over its cover and pattern, and the paint). Light on purpose: the anime head (anime-head.js)
 * reads it while it is itself imported by the beast modules hair-coat.js leans on, so nothing here imports them.
 */
/** the coat cards: each a coat filled in (colour words are the coat's own: suit lighter, seam darker, armor darker grey) */
export const COAT_CARDS = Object.freeze({
  snake: Object.freeze({ reads: "a snake's: fine keeled scales, a pale belly toward the head, dark blotches, the tip darkened",
    cover: Object.freeze({ kind: 'scales', size: 'medium', shape: 'keeled' }),
    pattern: Object.freeze([{ kind: 'countershade', color: 'suit', reach: 0.26, soft: 0.12 }, { kind: 'spots', color: 'seam', size: 0.008, spacing: 0.03, reach: 0.75 }, { kind: 'points', color: 'seam', from: 0.8, soft: 0.1 }]) }),
  tiger: Object.freeze({ reads: 'a big cat\'s: short fur, dark rings round each lock',
    cover: Object.freeze({ kind: 'fur', length: 'short' }),
    pattern: Object.freeze([{ kind: 'stripes', color: 'seam', period: 0.045, width: 0.35, wobble: 0.4 }]) }),
  barred: Object.freeze({ reads: "a raptor's feathers: fine bars across each vane, the tip darker",
    cover: Object.freeze({ kind: 'feathers', size: 'small' }),
    pattern: Object.freeze([{ kind: 'stripes', color: 'seam', period: 0.026, width: 0.3, wobble: 0.15 }, { kind: 'points', color: 'armor', from: 0.82, soft: 0.08 }]) }),
  ember: Object.freeze({ reads: 'a flame: hot at the root, burning out pale at the tip',
    color: '#d8451c',
    pattern: Object.freeze([{ kind: 'points', color: '#ffd66b', from: 0.5, soft: 0.3 }, { kind: 'countershade', color: '#a3200e', reach: 0.3, soft: 0.2 }]) }),
  leaf: Object.freeze({ reads: 'a leaf: a pale vein down its face, the tip lighter',
    pattern: Object.freeze([{ kind: 'dorsal', color: 'suit', width: 0.004 }, { kind: 'points', color: 'suit', from: 0.8, soft: 0.15 }]) }),
  banded: Object.freeze({ reads: 'a quill: close bands down its length, the point pale',
    pattern: Object.freeze([{ kind: 'stripes', color: 'seam', period: 0.022, width: 0.5, wobble: 0 }, { kind: 'points', color: '#f1ecdf', from: 0.86, soft: 0.05 }]) }),
});
export const COAT_CARD_NAMES = Object.freeze(Object.keys(COAT_CARDS));
const COAT_KEYS = ['from', 'color', 'cover', 'pattern'];
const HEX = /^#[0-9a-f]{6}$/i, KEY = /^[A-Z][A-Za-z0-9]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Error strings for a `coat`'s FORM (empty = valid): its card, its words, its colour; its cover's and its pattern's own
 * words are checked by the beast's validators where the hero door reads it (hair-coat.js validateHairCoat) */
export function hairCoatFormErrors(coat, at = 'coat') {
  if (coat === undefined || coat === null) return [];
  if (typeof coat === 'string') return COAT_CARDS[coat] ? [] : [`${at}: a coat card (${COAT_CARD_NAMES.join(', ')}) or { from?, color?, cover?, pattern? }`];
  if (!isObj(coat)) return [`${at}: a coat card (${COAT_CARD_NAMES.join(', ')}) or { from?, color?, cover?, pattern? }`];
  const errs = [];
  for (const k of Object.keys(coat)) if (!COAT_KEYS.includes(k)) errs.push(`${at}.${k}: not a coat word (${COAT_KEYS.join(', ')})`);
  if (coat.from !== undefined && !COAT_CARDS[coat.from]) errs.push(`${at}.from: a coat card (${COAT_CARD_NAMES.join(', ')})`);
  if (coat.color !== undefined && !(typeof coat.color === 'string' && (HEX.test(coat.color) || KEY.test(coat.color)))) errs.push(`${at}.color: '#rrggbb' or a palette key ('Hair', 'Scale' …)`);
  if (coat.cover !== undefined && !(typeof coat.cover === 'string' || isObj(coat.cover))) errs.push(`${at}.cover: a cover kind (scales, fur, chitin, feathers, none) or { kind, … }`);
  if (coat.pattern !== undefined && !Array.isArray(coat.pattern)) errs.push(`${at}.pattern: a list of layers { kind, color?, … }`);
  return errs;
}

/** A coat's words: its card's (when it names one) under its own. */
export function resolveHairCoat(coat) {
  if (coat === undefined || coat === null) return null;
  const own = typeof coat === 'string' ? { from: coat } : coat, card = own.from ? COAT_CARDS[own.from] : {};
  const cover = own.cover !== undefined ? own.cover : card.cover;
  return {
    color: own.color ?? card.color ?? 'Hair',
    ...(cover && cover !== 'none' ? { cover: typeof cover === 'string' ? { kind: cover } : { ...cover } } : {}),
    pattern: (own.pattern ?? card.pattern ?? []).map((L) => ({ ...L })),
  };
}

// ─── the lock's frame, at build (construction units) ────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mulv = (a, k) => [a[0] * k, a[1] * k, a[2] * k], addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => { const l = len(a) || 1; return mulv(a, 1 / l); };

/**
 * Each point of a lock's mesh placed on its centre line (`line`, root to tip): its share of the way along it (`t`) and
 * its place round it (`theta`: 0 its face away from `centre`, the head's, 1 its face toward it). The line's own ends
 * (the root's and the tip's apex) sit at the middle of the round. Also the line's length, the lock's mean radius and its
 * points' span (all in the build's units).
 */
export function lockCoatFrame(points, line, centre) {
  const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + len(sub(line[i], line[i - 1])));
  const L = cum.at(-1) || 1, n = line.length;
  let rSum = 0, rN = 0;
  const uv = points.map((p) => {
    let best = Infinity, bi = 0, bf = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = line[i], ab = sub(line[i + 1], a), l2 = dot(ab, ab) || 1e-12, f = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)), d = len(sub(p, addv(a, mulv(ab, f))));
      if (d < best) { best = d; bi = i; bf = f; }
    }
    const a = line[bi], b = line[Math.min(n - 1, bi + 1)], c = addv(a, mulv(sub(b, a), bf)), T = unit(sub(b, a));
    const t = (cum[bi] + (cum[Math.min(n - 1, bi + 1)] - cum[bi]) * bf) / L;
    const r = sub(p, c), rr = sub(r, mulv(T, dot(r, T))), rl = len(rr);
    let out = sub(c, centre); out = sub(out, mulv(T, dot(out, T)));
    if (rl < 1e-6 || len(out) < 1e-9) return [0.5, t];
    rSum += rl; rN++;
    const cos = Math.max(-1, Math.min(1, dot(unit(rr), unit(out))));
    return [Math.acos(cos) / Math.PI, t];
  });
  // (its points' bounding diagonal: the paint reads the same diagonal off the compiled mesh, so the length and the radius
  // land in metres whatever scales the head went through on its way to the hero)
  const lo = [0, 1, 2].map((q) => Math.min(...points.map((p) => p[q]))), hi = [0, 1, 2].map((q) => Math.max(...points.map((p) => p[q])));
  return { uv, length: L, radius: rN ? rSum / rN : 0, span: len(sub(hi, lo)) };
}

