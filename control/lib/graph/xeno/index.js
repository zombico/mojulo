/**
 * XENO MAKE-UP: `xenoHeaddress`, the hero's practical-effects appliances, the pieces a make-up crew sculpts, casts in foam
 * latex or silicone, glues on and paints, on whichever head the hero wears (the landmark, the anime, the realistic).
 * Non-human on purpose (the `xeno` prefix): an alien, a beast with a person's features, an actor in appliances.
 *
 *   xenoHeaddress: [ '<card>' | { card, size?, coat?, replaces? } | { family, at, …the shape's words } , … ]   (at most XENO_MAX)
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
 * An APPENDAGE WRITTEN WHOLE (`{ family: 'horn' | 'tail', at: { az, el }, … }`, APPENDAGE_FAMILIES) is a protrusion no card
 * names, grown from an address on the cap by the same grammar the horn and tail cards are built in.
 * The first cards: `forehead-ridges` (a forehead piece of ridges over the crown), `nose-ridges` (ridges across the
 * bridge of the nose), `head-tails` (two tails from the back of the skull over a bald cap). Pure, deterministic.
 */
import { xenoFrame } from './frame.js';
import { ridgeMesh, tubeMesh, bladeMesh } from './appliances.js';
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
 * THE APPENDAGE: a protrusion grown from an address on the cap (`at: { az, el }`, ./frame.js toward): a HORN (rising off
 * the skin and sweeping back, tapering hard to its point) or a TAIL (hanging under its own weight, down the back or
 * forward over the shoulders, held off the body). One path for both, walked in steps from the skin: its direction starts
 * between the skin's normal and straight up (`lift` 0 … 1) or straight down (−1 … 0), turns back by `sweep` degrees over its length, out from the
 * midline by `spread`, and falls by `droop` (gravity, growing down the piece); below the chin a tail keeps off the body
 * on its side (`fall`). The root is sunk into the cap and flared, as an appliance is glued; `pair` grows its mirror.
 * A LOBE is the same path flattened (`flat`: its thickness over its width), broad across the middle and pointed at its
 * end, its broad front facing forward and out: a crest, a hood's fold, a fin. `plates` lays that many hard ridged plates
 * across its front, a cast shell glued over a soft foam piece (the plates wear the entry's `shell` coat, the lobe its
 * `coat`); `fall: 'shoulder'` lays its end beside the neck on the shoulder.
 * Any appendage may HUG the head: `over: { az, el }` carries it over the cap from `at` to there, `stand` metres off the
 * skin (most a third of the way), before it hangs free; a lobe does by default.
 * Lengths are metres on a 23 cm head (HEAD_M), scaled with the head.
 */
export const APPENDAGE_FAMILIES = Object.freeze({
  horn: Object.freeze({ length: 0.2, width: 0.044, tip: 0.006, lift: 0.8, sweep: 70, spread: 8, droop: 0, fall: 'back' }),
  tail: Object.freeze({ length: 0.42, width: 0.066, tip: 0.016, lift: -0.45, sweep: 0, spread: 0, droop: 0.85, fall: 'back' }),
  lobe: Object.freeze({ length: 0.62, width: 0.12, tip: 0.01, lift: 0.5, sweep: 0, spread: 0, droop: 0.8, fall: 'shoulder', flat: 0.3, plates: 11, over: Object.freeze({ az: 100, el: -25 }), stand: 0.05 }),
});
const APPENDAGE_RANGES = Object.freeze({ length: [0.02, 0.8], width: [0.005, 0.12], tip: [0.001, 0.1], lift: [-1, 1], sweep: [-90, 180], spread: [-60, 60], droop: [0, 1], flat: [0.15, 1], plates: [0, 24], stand: [0, 0.15] });
const FALLS = ['back', 'front', 'shoulder'];
const APPENDAGE_KEYS = ['family', 'at', 'over', 'pair', ...Object.keys(APPENDAGE_RANGES), 'fall', 'coat', 'shell', 'replaces', 'size'];
const unitv = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** The pieces one appendage spec grows on the frame F at the scale s: [{ name, mesh, role? }] (role 'shell': a plate) */
export function appendage(F, s, A, label = '') {
  const out = [], sides = A.pair ? [['R', 1], ['L', -1]] : [['', 1]];
  for (const [side, sx] of sides) {
    const hit = F.toward(sx * A.at.az, A.at.el); if (!hit) continue;
    const r0 = (A.width * s) / 2, rt = (A.tip * s) / 2, L = A.length * s, N = 20, step = L / N;
    const out1 = hit.p[0] - F.centre[0], outward = [Math.abs(out1) > 1e-4 ? Math.sign(out1) : sx, 0, 0];
    const la = Math.abs(A.lift);
    let dir = unitv(add(mul(hit.n, 1 - la), mul([0, 0, Math.sign(A.lift)], la)));
    const line = [sub(hit.p, mul(hit.n, r0 * 0.9)), hit.p];
    let p = hit.p, i0 = 1;
    // (HUGGING the head: over the cap from `at` to `over`, standing off the skin by `stand` (most a third of the way), as a
    // hood's fold or a crest is shaped to the skull; it hangs free from there with whatever length is left)
    if (A.over) {
      const M = 18; let run = 0;
      for (let k = 1; k <= M; k++) {
        const u = k / M, h = F.toward(sx * lerp(A.at.az, A.over.az, u), lerp(A.at.el, A.over.el, u)); if (!h) break;
        const q = add(h.p, mul(h.n, (A.stand ?? 0.03) * s * (0.3 + Math.sin(Math.PI * u ** 0.7)))); run += Math.hypot(...sub(q, p));
        if (run > L) break;
        line.push(q); dir = unitv(sub(q, p)); p = q;
      }
      i0 = Math.max(1, Math.round((run / L) * N) + 1);
    }
    const turn = (A.sweep * Math.PI) / 180 / N, splay = (A.spread * Math.PI) / 180 / N;
    for (let i = i0; i <= N; i++) {
      const t = i / N, r = r0 + (rt - r0) * t;
      dir = unitv(add(add(add(dir, mul([0, -1, 0], turn)), mul(outward, splay)), mul([0, 0, -1], A.droop * 0.35 * Math.min(1, 0.4 + t))));
      // (below the chin a tail falls to its side of the body, kept off it by its own radius and a finger's gap)
      // (and drapes in toward where it lies: over the shoulder onto the chest beside the neck, or down the middle of the back)
      if (p[2] < F.chinZ + 0.02 * s && A.droop > 0) {
        const tx = F.centre[0] + (A.pair ? sx : 0) * (A.fall === 'front' ? 0.085 : A.fall === 'shoulder' ? 0.11 : 0.03) * s;
        dir = unitv(add(dir, [Math.max(-0.3, Math.min(0.3, (tx - p[0]) * 6 / s)), A.fall === 'front' ? 0.18 : A.fall === 'shoulder' ? 0 : -0.18, 0]));
      }
      p = add(p, mul(dir, step));
      if (p[2] < F.chinZ) {
        if (A.fall === 'front') { const fy = F.frontOfBodyAt(p[2]); if (fy !== null) p = [p[0], Math.max(p[1], fy + r + 0.01 * s), p[2]]; }
        else if (A.fall === 'back') { const by = F.backOfBodyAt(p[2]); if (by !== null) p = [p[0], Math.min(p[1], by - r - 0.01 * s), p[2]]; }
      }
      line.push(p);
    }
    if (A.flat === undefined) {
      const mesh = tubeMesh(line, { radius: (t) => (t === 0 ? r0 * 1.2 : r0 + (rt - r0) * Math.min(1, t) ** 0.9), R: 12 });
      if (mesh) out.push({ name: `${label}${side}`, mesh });
      continue;
    }
    // A LOBE: broad across its middle (the width), narrower at its root, pointed at its end; its front forward and out
    const half = (t) => (t <= 0.35 ? r0 * (0.55 + 0.45 * (t / 0.35)) : r0 - (r0 - rt) * ((t - 0.35) / 0.65) ** 1.2);
    const head = [F.centre[0], F.centre[1], F.browZ];
    const mesh = bladeMesh(line, { radius: half, flat: A.flat, R: 14, face: (i) => add([0, 1, 0], mul(unitv(sub(line[i], head)), 0.7)) });
    if (!mesh) continue;
    out.push({ name: `${label}${side}`, mesh });
    // its PLATES: hard ridges across its front, each spanning the face, a gap between them
    const P = Math.round(A.plates || 0), rings = mesh.front.length, gap = (0.84 * L) / Math.max(1, P - 1);
    for (let k = 0; k < P; k++) {
      const t = P > 1 ? 0.08 + (0.84 * k) / (P - 1) : 0.5, i = Math.min(rings - 1, Math.max(1, Math.round(t * (line.length - 1)))), r = half(i / (line.length - 1));
      const w = mesh.across[i], f = mesh.front[i];
      const S = Array.from({ length: 9 }, (_, j) => { const x = -0.9 + (1.8 * j) / 8, y = Math.sqrt(1 - x * x);
        return { p: add(line[i], add(mul(w, r * x), mul(f, r * A.flat * y))), n: unitv(add(mul(w, A.flat * x), mul(f, y))) }; });
      const plate = ridgeMesh(S, { height: rise(0.0045 * s, 0.5, 0.4), width: () => Math.min(0.7 * gap, 0.018 * s), sink: 0.0012 * s, K: 7 });
      if (plate) out.push({ name: `${label}${side}Plate${k}`, mesh: plate, role: 'shell' });
    }
  }
  return out;
}
/** a card made of appendage specs (each its family's defaults under its own words) */
const grown = (...specs) => (F, s) => specs.flatMap((A, i) => appendage(F, s, { ...APPENDAGE_FAMILIES[A.family], ...A }, A.label ?? `${i}`));
const BANDED = Object.freeze({ color: '#e9e3d7', pattern: Object.freeze([{ kind: 'stripes', color: '#33507c', period: 0.05, width: 0.38, wobble: 0.25 }]) });

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
        if (kept.length > 2) out.push({ name: `Bar${k}`, mesh: ridgeMesh(kept, { height: rise(0.0032 * s), width: () => 0.0045 * s, sink: 0.0008 * s, K: 7 }) });
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
  'swept-horns': Object.freeze({
    reads: 'two hollow horns from the top of the head, rising and sweeping back, tapering hard to their points, their roots blended into the cap',
    like: 'the swept horns of a horned humanoid; a demon\'s, a satyr\'s',
    family: 'horn', region: 'crown',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'stripes', color: 'seam', period: 0.04, width: 0.22, wobble: 0.3 }, { kind: 'points', color: 'suit', from: 0.8, soft: 0.1 }] }),
    build: grown({ family: 'horn', at: { az: 32, el: 52 }, pair: true, label: 'Horn' }),
  }),
  'front-tails': Object.freeze({
    reads: 'two head-tails from behind the temples, falling forward over the shoulders onto the chest, over a bald cap',
    like: 'the forward-falling head-tails of a striped hunter race of space-opera animation',
    family: 'tail', region: 'temples', replaces: 'hair',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'countershade', color: 'suit', reach: 0.3, soft: 0.12 }] }),
    build: grown({ family: 'tail', at: { az: 94, el: -4 }, pair: true, length: 0.44, width: 0.07, droop: 0.9, fall: 'front', spread: 6, label: 'Front' }),
  }),
  'horned-tails': Object.freeze({
    reads: 'hollow horns rising and sweeping back from the top of a bald cap, two head-tails falling forward over the shoulders and one down the back, all banded pale over dark',
    like: 'the banded horns and head-tails of a young warrior of a predator race in 2000s space-opera animation',
    family: 'horn', region: 'crown', replaces: 'hair',
    coat: BANDED,
    build: grown(
      { family: 'horn', at: { az: 34, el: 50 }, pair: true, length: 0.23, width: 0.05, lift: 0.85, sweep: 85, spread: 10, label: 'Horn' },
      { family: 'tail', at: { az: 94, el: -4 }, pair: true, length: 0.46, width: 0.072, droop: 0.9, fall: 'front', spread: 6, label: 'Front' },
      { family: 'tail', at: { az: 180, el: 6 }, length: 0.4, width: 0.07, droop: 0.95, fall: 'back', label: 'Back' },
    ),
  }),
  'chitin-crest': Object.freeze({
    reads: 'two broad lobes rising off the brow, arching back over the skull and falling beside the neck to the shoulders, like a hood: a hard ribbed shell of plates over each lobe\'s front, the lobe soft and fleshy behind, over a bald cap',
    like: 'the scalp crest of an all-female blue-skinned race of 2000s space-opera games',
    family: 'lobe', region: 'brow to shoulders', replaces: 'hair',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'countershade', color: 'suit', reach: 0.35, soft: 0.15 }] }),
    shell: Object.freeze({ color: 'Skin', cover: { kind: 'chitin', size: 'small' }, pattern: [{ kind: 'countershade', color: 'seam', reach: 0.5, soft: 0.1 }] }),
    build: grown({ family: 'lobe', at: { az: 14, el: 62 }, pair: true, label: 'Lobe' }),
  }),
  'cheek-ridges': Object.freeze({
    reads: 'a fine ridge down each cheek from under the eye toward the jaw, blended at both ends',
    like: 'the cheek ridges of many 90s TV sci-fi aliens',
    family: 'ridge', region: 'cheeks',
    coat: Object.freeze({ color: 'Skin', pattern: [{ kind: 'countershade', color: 'seam', reach: 0.15, soft: 0.1 }] }),
    build(F, s) {
      const out = [], top = F.browZ - 0.03 * s, bottom = lerp(F.noseTip[2], F.chinZ, 0.45);
      for (const [side, sx] of [['R', 1], ['L', -1]]) {
        const S = Array.from({ length: 12 }, (_, i) => { const t = i / 11; return F.front(sx * lerp(0.036, 0.042, t) * s, lerp(top, bottom, t)); }).filter(Boolean);
        if (S.length > 2) out.push({ name: side, mesh: ridgeMesh(S, { height: rise(0.0028 * s, 0.4), width: (t) => 0.005 * s * (0.6 + 0.4 * Math.sin(Math.PI * t)), sink: 0.0008 * s, K: 7 }) });
      }
      return out;
    },
  }),
});
export const XENO_CARD_IDS = Object.freeze(Object.keys(XENO_CARDS));
/** a piece written whole wears its family's card's coats, and its pieces are named for the family */
const WRITTEN_DEFAULTS = Object.freeze({ horn: { label: 'Horn', card: XENO_CARDS['swept-horns'] }, tail: { label: 'Tail', card: XENO_CARDS['front-tails'] }, lobe: { label: 'Lobe', card: XENO_CARDS['chitin-crest'] } });
const ENTRY_KEYS = ['card', 'size', 'coat', 'shell', 'replaces'];
const REPLACES = ['hair'];

/** Error strings for a hero's `xenoHeaddress` (empty = valid) */
export function validateXenoHeaddress(list, at = 'xenoHeaddress') {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > XENO_MAX) return [`${at}: a list of at most ${XENO_MAX} appliances, each a card (${XENO_CARD_IDS.join(', ')}), { card, size?, coat?, replaces? }, or an appendage written whole ({ family: ${Object.keys(APPENDAGE_FAMILIES).join(' | ')}, at: { az, el }, … })`];
  const errs = [];
  list.forEach((e, i) => {
    const here = `${at}[${i}]`;
    // an appendage WRITTEN WHOLE: a family, where on the cap, and its shape's words over the family's
    if (isObj(e) && e.card === undefined && e.family !== undefined) {
      if (!APPENDAGE_FAMILIES[e.family]) { errs.push(`${here}.family: ${Object.keys(APPENDAGE_FAMILIES).join(' | ')} (or name a card)`); return; }
      for (const k of Object.keys(e)) if (!APPENDAGE_KEYS.includes(k)) errs.push(`${here}.${k}: not an appendage word (${APPENDAGE_KEYS.join(', ')})`);
      for (const k of ['at', 'over']) if ((k === 'at' || e[k] !== undefined) && (!isObj(e[k]) || !Number.isFinite(e[k].az) || !Number.isFinite(e[k].el) || e[k].el < -40 || e[k].el > 90)) errs.push(`${here}.${k}: { az: degrees round from the front (90 the side, 180 the back), el: −40 … 90 degrees up from the brow line }`);
      for (const [k, [lo, hi]] of Object.entries(APPENDAGE_RANGES)) if (e[k] !== undefined && !(Number.isFinite(e[k]) && e[k] >= lo && e[k] <= hi)) errs.push(`${here}.${k}: ${lo} … ${hi}`);
      if (e.fall !== undefined && !FALLS.includes(e.fall)) errs.push(`${here}.fall: ${FALLS.map((f) => `'${f}'`).join(' | ')}`);
      if (e.shell !== undefined) errs.push(...validateHairCoat(e.shell, `${here}.shell`));
      if (e.family !== 'lobe' && (e.flat !== undefined || e.plates !== undefined || e.shell !== undefined)) errs.push(`${here}: flat, plates and shell are a lobe's words`);
      if (e.pair !== undefined && typeof e.pair !== 'boolean') errs.push(`${here}.pair: true or false`);
      if (e.size !== undefined && !(Number.isFinite(e.size) && e.size >= 0.5 && e.size <= 2)) errs.push(`${here}.size: 0.5 … 2`);
      if (e.coat !== undefined) errs.push(...validateHairCoat(e.coat, `${here}.coat`));
      if (e.replaces !== undefined && e.replaces !== null && e.replaces !== false && !REPLACES.includes(e.replaces)) errs.push(`${here}.replaces: 'hair', or false`);
      return;
    }
    const card = typeof e === 'string' ? e : isObj(e) ? e.card : undefined;
    if (!XENO_CARDS[card]) { errs.push(`${here}: a card (${XENO_CARD_IDS.join(', ')}), or an appendage written whole ({ family: ${Object.keys(APPENDAGE_FAMILIES).join(' | ')}, at: { az, el }, … })`); return; }
    if (!isObj(e)) return;
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) errs.push(`${here}.${k}: not an appliance word (${ENTRY_KEYS.join(', ')})`);
    if (e.size !== undefined && !(Number.isFinite(e.size) && e.size >= 0.5 && e.size <= 2)) errs.push(`${here}.size: 0.5 … 2 (the card's size on this head)`);
    if (e.coat !== undefined) errs.push(...validateHairCoat(e.coat, `${here}.coat`));
    if (e.shell !== undefined) errs.push(...validateHairCoat(e.shell, `${here}.shell`));
    if (e.replaces !== undefined && e.replaces !== null && e.replaces !== false && !REPLACES.includes(e.replaces)) errs.push(`${here}.replaces: 'hair' (a bald cap under it), or false`);
  });
  return errs;
}

/** an entry's words over its card's */
const readEntry = (e) => {
  if (isObj(e) && e.card === undefined && e.family !== undefined) {
    const A = { ...APPENDAGE_FAMILIES[e.family], ...e }, own = WRITTEN_DEFAULTS[e.family], C = { family: e.family, region: `az ${e.at.az}° el ${e.at.el}°`, reads: `a ${e.family} written whole${e.pair ? ', paired' : ''}`, build: (F, s) => appendage(F, s, A, own.label) };
    return { card: e.family, C, size: e.size ?? 1, coat: e.coat ?? own.card.coat, shell: e.shell ?? own.card.shell ?? null, replaces: e.replaces || null, written: true };
  }
  const own = typeof e === 'string' ? { card: e } : e, C = XENO_CARDS[own.card];
  return { card: own.card, C, size: own.size ?? 1, coat: own.coat ?? C.coat, shell: own.shell ?? C.shell ?? null, replaces: own.replaces === undefined ? C.replaces ?? null : own.replaces || null }; };

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
  const known = (e) => XENO_CARDS[typeof e === 'string' ? e : e?.card] || (isObj(e) && e.card === undefined && APPENDAGE_FAMILIES[e.family] && isObj(e.at));
  if (!Array.isArray(list) || !list.some((e) => known(e) && readEntry(e).replaces === 'hair')) return hero;
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
    const pieces = E.C.build(F, base * E.size), spec = resolveHairCoat(E.coat), shell = E.shell ? resolveHairCoat(E.shell) : spec;
    for (const { name, mesh: raw, role } of pieces) {
      if (!raw?.faces?.length) continue;
      const mesh = orientOut(raw), root = mesh.line[0], pin = F.pinNear(root); if (!pin) continue;
      const frame = F.frameOf(pin), Fr = lockCoatFrame(mesh.vertices, mesh.line, F.centre);
      parts[`xeno${cap(E.card)}${i}${name}`] = {
        layer: 2, closure: 'closed', pin, group: 'Skin',
        offsets: Object.fromEntries(mesh.vertices.map((p, k) => [`v${k}`, surfaceLocalOffset(frame, p).map(r6)])),
        faces: Object.fromEntries(mesh.faces.map((f, k) => [`f${k}`, f.map((v) => `v${v}`)])),
        coat: { spec: role === 'shell' ? shell : spec, uv: Object.fromEntries(Fr.uv.map((q, k) => [`v${k}`, [r6(q[0]), r6(q[1])]])), length: r6(Fr.length), radius: r6(Fr.radius), span: r6(Fr.span) },
      };
    }
  });
  return { ...recipe, parts };
}

/** What the appliances are and where they landed: per entry its card, its family and region, its pieces. */
export function xenoReadout(hero, recipe) {
  const list = hero?.xenoHeaddress; if (!Array.isArray(list) || !list.length) return null;
  return list.map((e, i) => { const E = readEntry(e), prefix = `xeno${E.card.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}${i}`;
    const pieces = Object.keys(recipe?.parts || {}).filter((n) => n.startsWith(prefix) && !/^\d/.test(n.slice(prefix.length))).length;
    return { ...(E.written ? { written: true } : {}), card: E.card, family: E.C.family, region: E.C.region, reads: E.C.reads, ...(E.size !== 1 ? { size: E.size } : {}), ...(E.replaces ? { replaces: E.replaces } : {}), pieces, ...(pieces ? {} : { landed: 'not placed: the head this hero wears has no frame for it (a blank trunk, a beast\'s own skull)' }) }; });
}
