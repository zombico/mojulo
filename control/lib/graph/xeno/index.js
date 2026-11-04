/**
 * XENO MAKE-UP: `xenoHeaddress`, the hero's practical-effects appliances, the pieces a make-up crew sculpts, casts in foam
 * latex or silicone, glues on and paints, on whichever head the hero wears (the landmark, the anime, the realistic).
 * Non-human on purpose (the `xeno` prefix): an alien, a beast with a person's features, an actor in appliances.
 *
 *   xenoHeaddress: [ '<card>' | { card, size?, coat?, replaces? } , … ]   (at most XENO_MAX)
 *
 * A CARD (XENO_CARDS) is the appliance as a make-up artist would name it, never a franchise: what it is (`reads`) and,
 * where a picture might show the screen alien it recalls, what it is like (`like`, for the character protocol's X-like
 * stamp). `size` scales it (0.5 … 2); `coat` its texture and colour (hair-coat.js: a card or the beast's cover and
 * pattern; the card's own by default, the skin's colour so it reads blended); `replaces: 'hair'` puts a bald cap under
 * it (the hair's parts left off, the brows and the lashes kept).
 *
 *   validateXenoHeaddress(list)  → error strings (form; the coats in the beast's own words)
 *   withXeno(recipe, hero)        → the recipe wearing the appliances: each a layer-2 part pinned to the head's carrier
 *                                   (./frame.js), its coat's frame on it so the page paints it (hair-coat.js); absent, the
 *                                   recipe as given, every byte
 *   xenoReadout(hero, recipe)     → what each appliance is and where it landed, or null
 *
 * The first cards: `forehead-ridges` (a forehead piece of ridges over the crown), `nose-ridges` (ridges across the
 * bridge of the nose), `head-tails` (two tails from the back of the skull over a bald cap). Pure, deterministic.
 */
import { xenoFrame } from './frame.js';
import { ridgeMesh, tubeMesh } from './appliances.js';
import { validateHairCoat, resolveHairCoat, lockCoatFrame } from '../polygonizer/hair-coat.js';
import { surfaceLocalOffset } from '../polygonizer/surface-pin.js';

export const XENO_MAX = 12;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => a + (b - a) * t;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** the head the sizes are written for: a 23 cm head, crown to chin; a card's metres scale with the head it is on */
const HEAD_M = 0.23;

/** a bump's rise along a piece: nothing at its ends, its peak at `at` */
const rise = (peak, at = 0.5, k = 0.7) => (t) => peak * Math.max(0, Math.sin(Math.PI * Math.min(1, t <= at ? (t / at) * 0.5 : 0.5 + ((t - at) / (1 - at)) * 0.5))) ** k;

/**
 * THE CARDS. Each `build(F, s)` makes its pieces on the frame F at the scale s (the head's height over HEAD_M times the
 * entry's `size`): a list of { name, mesh } (mesh: vertices, faces, line).
 */
export const XENO_CARDS = Object.freeze({
  'forehead-ridges': Object.freeze({
    reads: 'a forehead piece of curving ridges: one up the middle from the brow to the hairline, and pairs beside it fanning up and back, blended into the brow',
    like: 'the ridged forehead of a warrior race of 90s TV sci-fi',
    family: 'ridge', region: 'forehead',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'countershade', color: 'seam', reach: 0.15, soft: 0.1 }] }),
    build(F, s) {
      const above = F.front(0, F.browZ + 0.01 * s); if (!above) return [];
      const phi0 = Math.atan2(above.p[2] - F.centre[2], above.p[1] - F.centre[1]);
      const path = (x0, x1, a0, a1, n = 16) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return F.sagittal(lerp(a0, a1, t), lerp(x0, x1, t)); }).filter(Boolean);
      const out = [], R = (name, S, h, w) => { const m = S.length > 2 ? ridgeMesh(S, { height: rise(h, 0.45), width: (t) => w * (0.6 + 0.4 * Math.sin(Math.PI * t)), sink: 0.0015 * s }) : null; if (m) out.push({ name, mesh: m }); };
      // (the piece ends at the hairline, a forehead appliance's edge: the middle ridge the furthest, the pairs before it)
      R('Mid', path(0, 0, phi0, 1.38), 0.014 * s, 0.024 * s);
      for (const [k, x, h, w, top] of [[1, 0.02, 0.011, 0.02, 1.3], [2, 0.038, 0.009, 0.018, 1.2], [3, 0.054, 0.007, 0.015, 1.08]]) {
        R(`R${k}`, path(x * s, x * s * 0.55, phi0 + 0.06 * k, top), h * s, w * s);
        R(`L${k}`, path(-x * s, -x * s * 0.55, phi0 + 0.06 * k, top), h * s, w * s);
      }
      return out;
    },
  }),
  'nose-ridges': Object.freeze({
    reads: 'a short stack of fine ridges across the bridge of the nose, blended at both ends',
    like: 'the ridged nose bridge of a spiritual people of 90s TV sci-fi',
    family: 'ridge', region: 'nose-bridge',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'countershade', color: 'seam', reach: 0.15, soft: 0.1 }] }),
    build(F, s) {
      const top = F.browZ - 0.004 * s, bottom = lerp(F.browZ, F.noseTip[2], 0.55), n = 5, w = 0.0085 * s, out = [];
      for (let k = 0; k < n; k++) {
        const z = lerp(top, bottom, k / (n - 1)), half = w * (1 - 0.15 * k / (n - 1));
        const S = Array.from({ length: 9 }, (_, i) => F.front(lerp(-half, half, i / 8), z)).filter(Boolean);
        // (a hit that dropped off the bridge, into the eye's hollow, is not on the nose: kept to the bridge's own depth)
        const ys = S.map((h) => h.p[1]), ridgeY = Math.max(...ys), kept = S.filter((h) => h.p[1] > ridgeY - 0.006 * s);
        if (kept.length > 2) out.push({ name: `${k}`, mesh: ridgeMesh(kept, { height: rise(0.0032 * s), width: () => 0.0045 * s, sink: 0.0008 * s, K: 7 }) });
      }
      return out;
    },
  }),
  'head-tails': Object.freeze({
    reads: 'two thick tapering tails from the back of the skull, hanging down the back past the shoulders, over a bald cap',
    like: 'the head-tails of a dancer race of 70s–80s space-opera cinema',
    family: 'tail', region: 'occiput', replaces: 'hair',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'countershade', color: 'suit', reach: 0.3, soft: 0.12 }, { kind: 'points', color: 'seam', from: 0.85, soft: 0.1 }] }),
    build(F, s) {
      const out = [];
      for (const [side, sx] of [['R', 1], ['L', -1]]) {
        const root = F.back(sx * 0.03 * s, F.browZ - 0.012 * s); if (!root) continue;
        const R0 = 0.034 * s, Rt = 0.008 * s, len = 0.42 * s, zEnd = F.chinZ - 0.27 * s;
        const line = [sub(root.p, mul(root.n, 0.014 * s)), add(root.p, add(mul(root.n, 0.024 * s), [0, 0, -0.01 * s]))];
        const n = 14, start = line[1];
        for (let i = 1; i <= n; i++) {
          const t = i / n, z = lerp(start[2], zEnd, t ** 0.9), r = lerp(R0, Rt, t);
          const backY = F.backOfBodyAt(z), y = Math.min(lerp(start[1], start[1] - 0.03 * s, t), backY === null ? Infinity : backY - r - 0.012 * s);
          line.push([start[0] + sx * 0.022 * s * t, y, z]);
        }
        const L = line.reduce((a, p, i) => (i ? a + Math.hypot(...sub(p, line[i - 1])) : 0), 0);
        const mesh = tubeMesh(line, { radius: (t) => (t === 0 ? R0 * 1.15 : lerp(R0, Rt, Math.min(1, t * (L / Math.max(len, 1e-6))) ** 0.85)), R: 10 });
        if (mesh) out.push({ name: side, mesh });
      }
      return out;
    },
  }),
});
export const XENO_CARD_IDS = Object.freeze(Object.keys(XENO_CARDS));
const ENTRY_KEYS = ['card', 'size', 'coat', 'replaces'];
const REPLACES = ['hair'];

/** Error strings for a hero's `xenoHeaddress` (empty = valid) */
export function validateXenoHeaddress(list, at = 'xenoHeaddress') {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > XENO_MAX) return [`${at}: a list of at most ${XENO_MAX} appliances, each a card (${XENO_CARD_IDS.join(', ')}) or { card, size?, coat?, replaces? }`];
  const errs = [];
  list.forEach((e, i) => {
    const here = `${at}[${i}]`, card = typeof e === 'string' ? e : isObj(e) ? e.card : undefined;
    if (!XENO_CARDS[card]) { errs.push(`${here}: a card (${XENO_CARD_IDS.join(', ')})${typeof e === 'string' || isObj(e) ? '' : ' or { card, size?, coat?, replaces? }'}`); return; }
    if (!isObj(e)) return;
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) errs.push(`${here}.${k}: not an appliance word (${ENTRY_KEYS.join(', ')})`);
    if (e.size !== undefined && !(Number.isFinite(e.size) && e.size >= 0.5 && e.size <= 2)) errs.push(`${here}.size: 0.5 … 2 (the card's size on this head)`);
    if (e.coat !== undefined) errs.push(...validateHairCoat(e.coat, `${here}.coat`));
    if (e.replaces !== undefined && e.replaces !== null && e.replaces !== false && !REPLACES.includes(e.replaces)) errs.push(`${here}.replaces: 'hair' (a bald cap under it), or false`);
  });
  return errs;
}

/** an entry's words over its card's */
const readEntry = (e) => { const own = typeof e === 'string' ? { card: e } : e, C = XENO_CARDS[own.card];
  return { card: own.card, C, size: own.size ?? 1, coat: own.coat ?? C.coat, replaces: own.replaces === undefined ? C.replaces ?? null : own.replaces || null }; };

/** each face turned outward from the line it was built along (a ridge's top and its buried underside, a tube's wall) */
function orientOut(mesh) {
  const L = mesh.line;
  const nearest = (c) => L.reduce((b, p) => (Math.hypot(...sub(p, c)) < Math.hypot(...sub(b, c)) ? p : b), L[0]);
  return { ...mesh, faces: mesh.faces.map((f) => { const [a, b, c] = f.map((i) => mesh.vertices[i]), cen = mul(add(add(a, b), c), 1 / 3), nrm = cross(sub(b, a), sub(c, a));
    return dot(nrm, sub(cen, nearest(cen))) < 0 ? [f[0], f[2], f[1]] : f; }) };
}

/** The hero as its make-up wears it: a bald cap under an appliance that replaces the hair, lowered into the words every
 * head builds by (the game heads' `hair: 'none'`, the realistic face's `scalp: 'none'`), so each head is bald by its own
 * rules: the realistic skin's scalp bare too (dermal-map.js `bareScalp`: no follicles painted). Nothing replaced: the hero
 * as given. */
export function xenoWorn(hero) {
  const list = hero?.xenoHeaddress;
  if (!Array.isArray(list) || !list.some((e) => XENO_CARDS[typeof e === 'string' ? e : e?.card] && readEntry(e).replaces === 'hair')) return hero;
  return hero.form === 'realistic' ? { ...hero, face: { ...(hero.face && typeof hero.face === 'object' ? hero.face : {}), scalp: 'none' }, skin: { ...(hero.skin && typeof hero.skin === 'object' ? hero.skin : {}), bareScalp: true } } : { ...hero, hair: 'none' };
}

/** The recipe wearing the hero's appliances; absent, the recipe as given. */
export function withXeno(recipe, hero) {
  const list = hero?.xenoHeaddress;
  if (!Array.isArray(list) || !list.length || !recipe?.parts) return recipe;
  const F = xenoFrame(recipe); if (!F) return recipe;
  const parts = { ...recipe.parts }, entries = list.map(readEntry), base = F.height / HEAD_M;
  // a bald cap: the hair's parts left off (the brows and the lashes kept), and their names out of the dials
  if (entries.some((e) => e.replaces === 'hair')) {
    const gone = Object.keys(parts).filter((n) => /^hair/.test(n) && !/^hair(Brows|Lashes)/.test(n));
    for (const n of gone) delete parts[n];
    // (the realistic skin paints the shadow of a clipped scalp's hair, hairClip.scalp: under a bald cap there is none)
    if (recipe.hairClip?.scalp) recipe = { ...recipe, hairClip: { ...recipe.hairClip, scalp: null } };
    if (gone.length && recipe.dials) {
      const g = new Set(gone);
      recipe = { ...recipe, dials: Object.fromEntries(Object.entries(recipe.dials).map(([k, d]) => [k, Array.isArray(d?.parts) ? { ...d, parts: d.parts.filter((n) => !g.has(n)) } : d])) };
    }
  }
  const cap = (s) => s.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
  entries.forEach((E, i) => {
    const pieces = E.C.build(F, base * E.size), spec = resolveHairCoat(E.coat);
    for (const { name, mesh: raw } of pieces) {
      if (!raw?.faces?.length) continue;
      const mesh = orientOut(raw), root = mesh.line[0], pin = F.pinNear(root); if (!pin) continue;
      const frame = F.frameOf(pin), Fr = lockCoatFrame(mesh.vertices, mesh.line, F.centre);
      parts[`xeno${cap(E.card)}${i}${name}`] = {
        layer: 2, closure: 'closed', pin, group: 'Skin',
        offsets: Object.fromEntries(mesh.vertices.map((p, k) => [`v${k}`, surfaceLocalOffset(frame, p).map(r6)])),
        faces: Object.fromEntries(mesh.faces.map((f, k) => [`f${k}`, f.map((v) => `v${v}`)])),
        coat: { spec, uv: Object.fromEntries(Fr.uv.map((q, k) => [`v${k}`, [r6(q[0]), r6(q[1])]])), length: r6(Fr.length), radius: r6(Fr.radius), span: r6(Fr.span) },
      };
    }
  });
  return { ...recipe, parts };
}

/** What the appliances are and where they landed: per entry its card, its family and region, its pieces. */
export function xenoReadout(hero, recipe) {
  const list = hero?.xenoHeaddress; if (!Array.isArray(list) || !list.length) return null;
  return list.map((e, i) => { const E = readEntry(e), prefix = `xeno${E.card.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}${i}`;
    const pieces = Object.keys(recipe?.parts || {}).filter((n) => n.startsWith(prefix)).length;
    return { card: E.card, family: E.C.family, region: E.C.region, reads: E.C.reads, ...(E.size !== 1 ? { size: E.size } : {}), ...(E.replaces ? { replaces: E.replaces } : {}), pieces, ...(pieces ? {} : { landed: 'not placed: the head this hero wears has no frame for it (a blank trunk, a beast\'s own skull)' }) }; });
}
