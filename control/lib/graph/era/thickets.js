/**
 * THICKETS — a level's bushes and shrubs as composed SECTIONS: a patch of bushes of one kind, by the trail or out in the
 * open, each bush a tree kind's leaf branches (era/leaf-forms.js) with the trunk taken away: a few thin stems from its
 * foot, splayed, its limbs and twigs finer, its crown low and wide. A kind says whether a walker is BLOCKED by it (its
 * stems and leaves solid, a collider for an engine) or WALKS THROUGH it (drawn in groups the page lets a walker pass,
 * `payload.soft`). The biocube composes them (`flora.bushes`); the stage draws them through the trees' own path.
 *
 *   flora.bushes = { kinds: [bush kind …] (1–6), sections?: { count, radius: [lo, hi] m, fill (bushes a m²), gap m,
 *                    band: [near, far] m from the trail's edge } }
 *   a bush kind: a leaf form's name, or { form, height: [lo, hi] m, spread, stems, splay, trunk, girth, branch, split,
 *                density, leaf, bark, barkForm, share, walk: 'block' | 'through' } (BUSH_KIND_KEYS; BUSH_DEFAULTS)
 *
 *   readBush(kind)                       → the kind with the bush's defaults under it
 *   checkBushes(b, no)                   the `flora.bushes` block, checked (`no` throws in the biocube's voice)
 *   placeThickets(B, site, opts, seed)   → { items: [{ x, y, h, bushIx, section, band, soft }], colliders, anchors }
 *   clumpBushes(trees, T, B, site, opts) → the arranged clumps' roles a cast names a bush (`clump.hikae: { bush: 0 }`):
 *                                          { trees (the rest), items (those roles as bushes, where they stood) }
 *   SOFT_BRUSH                           the groups a walked-through bush is drawn in (wood, core, chips)
 *
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { LEAF_FORMS, LEAF_FORM_IDS, pickByShare } from './leaf-forms.js';
import { kept } from './reserve.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;

/** A bush is a tree kind with the trunk taken away: thin stems from its foot, finer limbs, a low wide crown. */
export const BUSH_DEFAULTS = Object.freeze({ height: Object.freeze([0.8, 1.5]), spread: 0.6, stems: 5, splay: 26, trunk: 0.12, girth: 0.014, branch: 0.35, split: 0, density: 0.8, walk: 'block' });
export const BUSH_KIND_KEYS = Object.freeze(['form', 'height', 'spread', 'stems', 'splay', 'trunk', 'girth', 'branch', 'split', 'density', 'leaf', 'bark', 'barkForm', 'share', 'walk']);
export const SECTION_DEFAULTS = Object.freeze({ count: 6, radius: Object.freeze([1.5, 3.2]), fill: 0.45, gap: 0.9, band: Object.freeze([1.2, 10]) });
/** The groups a walked-through bush is drawn in, so the page lets the walker pass (its wood, its core, its chips). */
export const SOFT_BRUSH = Object.freeze({ wood: 'flora:brush-wood', core: 'flora:brush', chips: 'flora:brush-chips' });

export const readBush = (k) => ({ ...BUSH_DEFAULTS, ...(typeof k === 'string' ? { form: k } : k) });

/** The `flora.bushes` block, checked; `no(msg)` throws, `num`, `int`, `range` and `keys` the biocube's checkers. */
export function checkBushes(b, { no, num, int, range, keys, isObj, LEAF_OFFER, BARK_OFFER, BARK_FORM_IDS }) {
  if (b === null) return;
  if (!isObj(b)) no('flora.bushes is null (none) or { kinds, sections? }');
  keys(b, ['kinds', 'sections'], 'flora.bushes');
  if (!(Array.isArray(b.kinds) && b.kinds.length >= 1 && b.kinds.length <= 6)) no(`flora.bushes.kinds is a list of 1 to 6 bush kinds, each a leaf form (${LEAF_FORM_IDS.join(', ')}) or { ${BUSH_KIND_KEYS.join(', ')} }`);
  b.kinds.forEach((k, i) => {
    const at = `flora.bushes.kinds[${i}]`, form = typeof k === 'string' ? k : isObj(k) ? k.form : undefined;
    if (!LEAF_FORMS[form]) no(`${at}${typeof k === 'string' ? '' : '.form'} is a leaf form (${LEAF_FORM_IDS.join(', ')})`);
    if (typeof k === 'string') return;
    keys(k, BUSH_KIND_KEYS, at);
    if (k.height !== undefined) range(k.height, 0.2, 4, `${at}.height`);
    if (k.spread !== undefined) num(k.spread, 0.2, 1.2, `${at}.spread`);
    if (k.stems !== undefined) int(k.stems, 1, 9, `${at}.stems`);
    if (k.splay !== undefined) num(k.splay, 0, 50, `${at}.splay (degrees)`);
    if (k.trunk !== undefined) num(k.trunk, 0, 0.6, `${at}.trunk`);
    if (k.girth !== undefined) num(k.girth, 0.005, 0.06, `${at}.girth`);
    if (k.branch !== undefined) num(k.branch, 0.15, 1.2, `${at}.branch`);
    if (k.split !== undefined) int(k.split, 0, 2, `${at}.split`);
    if (k.density !== undefined) num(k.density, 0.4, 2.5, `${at}.density`);
    if (k.leaf !== undefined) int(k.leaf, 0, LEAF_OFFER, `${at}.leaf (0 the world's, 1 to ${LEAF_OFFER} the theorist's offer)`);
    if (k.bark !== undefined) int(k.bark, 0, BARK_OFFER, `${at}.bark (0 the world's, 1 to ${BARK_OFFER} the theorist's offer)`);
    if (k.barkForm !== undefined && !BARK_FORM_IDS.includes(k.barkForm)) no(`${at}.barkForm is a bark's marks (${BARK_FORM_IDS.join(', ')})`);
    if (k.share !== undefined) num(k.share, 0.05, 20, `${at}.share`);
    if (k.walk !== undefined && k.walk !== 'block' && k.walk !== 'through') no(`${at}.walk is 'block' (a walker stops at it) or 'through' (a walker pushes through it)`);
  });
  if (b.sections !== undefined) {
    const S = b.sections;
    if (!isObj(S)) no('flora.bushes.sections is { count?, radius?, fill?, gap?, band? }');
    keys(S, ['count', 'radius', 'fill', 'gap', 'band'], 'flora.bushes.sections');
    if (S.count !== undefined) int(S.count, 0, 40, 'flora.bushes.sections.count');
    if (S.radius !== undefined) range(S.radius, 0.5, 12, 'flora.bushes.sections.radius');
    if (S.fill !== undefined) num(S.fill, 0.05, 3, 'flora.bushes.sections.fill (bushes a square metre)');
    if (S.gap !== undefined) num(S.gap, 0.2, 4, 'flora.bushes.sections.gap');
    if (S.band !== undefined) range(S.band, 0, 60, 'flora.bushes.sections.band');
  }
}

/**
 * The bushes of a level's sections. Each section a patch round a centre within `band` m of the trail's edge, clear of
 * the trail, the cliff and its apron, the rocks, the trees and the other sections; one kind (by the kinds' shares); its
 * bushes scattered `gap` apart at `fill` a square metre, each a height in its kind's range. A bush is BUILT whole near the
 * trail and its shape alone (`band: 'far'`) past `far` m. A blocking bush taller than a step is a collider.
 */
export function placeThickets(B, site, { rocks = [], trees = [], reserved = null, far = 15 } = {}, seed = 1) {
  const S = { ...SECTION_DEFAULTS, ...(B.sections || {}) }, K = B.kinds.map(readBush), H = (a, b, c) => hash3(a, b, (seed | 0) * 131 + c);
  const { W, D, trailDist, halfWAt, cliffX, apronAt } = site, edge = (x, y) => trailDist(x, y) - halfWAt(y);
  const clearOf = (x, y, r) => x > cliffX(y) + 2.5 + r && x < W - 1.5 && y > 1.5 && y < D - 1.5 && apronAt(x, y) < 0.02 && !(site.clear && site.clear(x, y))
    && (!reserved || kept(reserved, x, y, r)) && rocks.every((q) => Math.hypot(q.x - x, q.y - y) > (q.size ?? 1) * 0.7 + 0.4) && trees.every((t) => Math.hypot(t.x - x, t.y - y) > 1.2);
  const centres = [];
  for (let i = 0; i < 600 && centres.length < S.count; i++) {
    const x = W * H(i, 1, 7), y = D * H(i, 2, 11), r = S.radius[0] + (S.radius[1] - S.radius[0]) * H(i, 3, 13), e = edge(x, y);
    if (e < S.band[0] + r * 0.4 || e > S.band[1] + r || !clearOf(x, y, 0.5)) continue;
    if (centres.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 1.5)) continue;
    centres.push({ x, y, r, kind: pickByShare(B.kinds, H(i, 4, 17)) });
  }
  const items = [], colliders = [], anchors = [];
  centres.forEach((c, si) => {
    const k = K[c.kind], want = Math.max(1, Math.round(Math.PI * c.r * c.r * S.fill)), mine = [];
    for (let q = 0, tries = 0; mine.length < want && tries < want * 12; tries++, q++) {
      const a = 2 * Math.PI * H(si * 97 + q, 5, 19), d = c.r * Math.sqrt(H(si * 97 + q, 6, 23)), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      if (edge(x, y) < S.band[0] * 0.6 || !clearOf(x, y, 0.3) || mine.some((m) => Math.hypot(m.x - x, m.y - y) < S.gap)) continue;
      // (taller toward the section's middle: a patch mounds)
      const h = k.height[0] + (k.height[1] - k.height[0]) * (0.55 * (1 - d / c.r) + 0.45 * H(si * 97 + q, 7, 29));
      mine.push({ x: r5(x), y: r5(y), h: r5(h), bushIx: c.kind, section: si, band: edge(x, y) > far ? 'far' : 'hero', soft: k.walk === 'through', cluster: -3 - si });
    }
    for (const m of mine) {
      items.push(m);
      if (!m.soft && m.h > 0.45) {
        const R = k.spread * m.h * 0.75, z = site.ground(m.x, m.y);
        colliders.push({ min: [r5(m.x - R), r5(m.y - R), r5(z)], max: [r5(m.x + R), r5(m.y + R), r5(z + m.h)], of: `thicket:${si}` });
      }
    }
    if (mine.length) anchors.push({ id: `thicket:${si}`, kind: 'thicket', at: [r5(c.x), r5(c.y), r5(site.ground(c.x, c.y))], radius: r5(c.r), bushes: mine.length, walk: k.walk });
  });
  return { items, colliders, anchors };
}

/** The bush a blocking bush's collider is, round its foot to its height. */
const colliderOf = (m, k, site, of) => { const R = k.spread * m.h * 0.75, z = site.ground(m.x, m.y); return { min: [r5(m.x - R), r5(m.y - R), r5(z)], max: [r5(m.x + R), r5(m.y + R), r5(z + m.h)], of }; };

/**
 * An arranged clump's roles that its cast names a BUSH (`flora.trees.clump: { hikae: { bush: i }, filler: { bush: j } }`,
 * `i` a kind of `flora.bushes`): each such tree taken out and a bush of that kind stood where it stood, its height in the
 * kind's range by its dice. → { trees, items, colliders }
 */
export function clumpBushes(trees, T, B, site, { far = 15 } = {}) {
  const C = T.leafClump;
  if (!C || !B || !Object.values(C).some((v) => typeof v === 'object')) return { trees, items: [], colliders: [] };
  const K = B.kinds.map(readBush), keep = [], items = [], colliders = [], edge = (x, y) => site.trailDist(x, y) - site.halfWAt(y);
  for (const t of trees) {
    const c = t.role ? C[t.role] : undefined;
    if (!c || typeof c !== 'object') { keep.push(t); continue; }
    const k = K[c.bush], h = r5(k.height[0] + (k.height[1] - k.height[0]) * hash3(Math.round(t.x * 100), Math.round(t.y * 100), 4177));
    const m = { x: t.x, y: t.y, h, bushIx: c.bush, section: -1, band: edge(t.x, t.y) > far ? 'far' : 'hero', soft: k.walk === 'through', cluster: t.cluster, role: t.role };
    items.push(m);
    if (!m.soft && m.h > 0.45) colliders.push(colliderOf(m, k, site, `clump:${t.cluster}:${t.role}`));
  }
  return { trees: keep, items, colliders };
}

