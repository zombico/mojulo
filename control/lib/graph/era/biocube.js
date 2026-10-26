/**
 * BIOCUBE — what grows in a level, as data: the sibling of the geocube (era/geocube.js), which holds its look. A cube
 * holds no placement and no colour (a plant is painted in the look's ramps); it holds the flora a stage grows, in the
 * kit card's own vocabulary, so a stage reads it by laying it over its card (`withFlora`), not by a drawer of its own.
 * What lives there is `fauna`, beside `flora` (era/biocube-fauna.js).
 *
 *   flora.trees    { clusters, perCluster: [lo, hi], spread, heights: [lo, hi] m, clearTrail, clearCliff, crown?, hero? }
 *                  the card's `trees` (era/nature.js treeItems: `clusters` groves of `perCluster` trees, `spread` m
 *                  round each; `crown` the masses' shape, era/style/isekai-meadow.js; `hero` the one big tree or null).
 *                  The tree's form (a blob's masses, bamboo, blossom) stays the kit's. `compose: 'ikebana'` arranges each
 *                  clump (nature.js arrangedClump); `bands` (true or { hero, far, stock }) builds a tree by how far it
 *                  stands from the trail (isekai.js treeBands): whole near it, stamped from templates, a shell far.
 *                  `kinds` (1 to 6) are what the level's trees are, as composed for it: each a leaf form's name or
 *                  { form, …settings } (era/leaf-forms.js TREE_KIND_KEYS), its colours picked from the theorist's
 *                  offer (era/flora-colours.js); each clump one kind, its crown grown as that kind's leaf branches on
 *                  a gritty land (a quiet land keeps the balls). The manual: the `biocube` sketch-vocab card
 *   flora.grass    { clusters, perCluster, spacing, scatter, fringeEvery, height: [lo, hi] m, kinds?, field? } | null
 *                  the card's `grass` (nature.js grassTufts: `clusters` tussock groups of `perCluster` tufts `spacing`
 *                  m apart, `scatter` a loose share, a tuft every `fringeEvery` m along the trail's fringe; `kinds` the
 *                  grass by place, { fringe, meadow, cliff, scatter } of vegetation/grass.js GRASSES; `field` the sea
 *                  of blades along the trail, { reach m, every m, height } or null; `live` the carpet of grown blades
 *                  round the walker, { kind, density /m², height }, the card's `live`, laid wherever the grass grows,
 *                  or null for none). null: no grass
 *   flora.shrubs   { count, bloom, fruit } | null: bushes by the trail (era/shrubs.js, a recipe's own `shrubs`)
 *   flora.flowers  { share, mix } | null: wildflowers in the live grass (vegetation/wildflowers.js; a recipe's
 *                  `grass.flowers`)
 *   flora.bushes   { kinds, sections? } | absent: bushes and shrubs composed in SECTIONS (era/thickets.js), each kind a
 *                  leaf form with its trunk taken away, blocking a walker or walked through
 *
 *   fauna          a fauna preset id (FAUNA_IDS), a document { swarms, herds }, { from, …changes }, or null (none:
 *                  every preset's): what lives in the level, never an enemy (era/biocube-fauna.js readFauna). A
 *                  document of fauna alone ({ fauna }) lays no flora (`flora: null`): the kit grows its own. A room
 *                  stage lays only the fauna (era/stage.js): nothing grows under a roof
 *
 *   BIOCUBE_PRESETS          meadow (the meadow card's own numbers), upland, grove, forest, bare; the biomes' coast,
 *                            alpine, desert (a geocube's biome lays one: gameworld/compose.js cubeWithLand)
 *   readBiocube(spec)        a preset id, a document, or { from: preset, …changes } (each flora block merged, the
 *                            fauna in its place) → checked
 *   withFlora(card, cube)    an isekai or nature card with the cube's flora laid over its trees and grass
 *
 * Pure. Absent a biocube, a stage grows its card's own flora, byte for byte as before.
 */
import { GRASSES } from '../vegetation/grass.js';
import { WILDFLOWER_KINDS } from '../vegetation/wildflowers.js';
import { validateShrubs } from './shrubs.js';
import { LEAF_FORMS, LEAF_FORM_IDS, TREE_KIND_KEYS } from './leaf-forms.js';
import { LEAF_OFFER, BARK_OFFER, HARMONIES, CLUMP_ROLES } from './flora-colours.js';
import { BARK_FORM_IDS } from '../matte-paint/dressed.js';
import { readFauna } from './biocube-fauna.js';
import { checkBushes } from './thickets.js';

const no = (m) => { throw new Error(`biocube: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fz = (o) => Object.freeze(o);

const MEADOW = fz({
  trees: fz({ clusters: 5, perCluster: [1, 4], spread: 5, heights: [6, 10], clearTrail: 3.5, clearCliff: 5 }),
  grass: fz({ clusters: 60, perCluster: [8, 16], spacing: 0.3, scatter: 0.18, fringeEvery: 0.45, height: [0.5, 0.95], field: fz({ reach: 7, every: 0.7, height: [0.55, 1.0] }), live: fz({ kind: 'meadow', density: 5, height: [0.45, 0.9] }) }),
  shrubs: null,
  flowers: null,
});
export const BIOCUBE_PRESETS = fz({
  // the meadow card's own flora: a meadow kit's stage with it grows as without it
  meadow: fz({ title: 'Meadow', reads: 'a few groves on a grassy bank, the trail edged in tall grass', flora: MEADOW }),
  // a windswept upland: lone trees and pairs, grass short and thin, no field along the trail
  upland: fz({ title: 'Upland', reads: 'lone trees on a windswept upland, the grass short and thin', flora: fz({
    trees: fz({ clusters: 4, perCluster: [1, 2], spread: 3, heights: [4, 7], clearTrail: 4, clearCliff: 5 }),
    grass: fz({ clusters: 30, perCluster: [5, 9], spacing: 0.35, scatter: 0.3, fringeEvery: 0.8, height: [0.25, 0.5], kinds: fz({ fringe: 'fescue', meadow: 'fescue', cliff: 'sedge', scatter: 'needlegrass' }), field: null, live: fz({ kind: 'fescue', density: 3, height: [0.2, 0.4] }) }),
    shrubs: null, flowers: null }) }),
  // a grove: many trees close in clusters, the grass thin under them, bushes by the trail
  grove: fz({ title: 'Grove', reads: 'trees close in groves, the grass thin under them, bushes along the way', flora: fz({
    trees: fz({ clusters: 9, perCluster: [3, 6], spread: 4, heights: [7, 12], clearTrail: 3, clearCliff: 4 }),
    grass: fz({ clusters: 35, perCluster: [6, 12], spacing: 0.3, scatter: 0.12, fringeEvery: 0.6, height: [0.4, 0.8], field: fz({ reach: 3, every: 0.9, height: [0.45, 0.8] }), live: fz({ kind: 'meadow', density: 3.5, height: [0.35, 0.75] }) }),
    shrubs: fz({ count: 18, bloom: 0.3, fruit: 0.3 }), flowers: null }) }),
  // a forest: clumps arranged (tallest at the back, open toward the trail) close across the level, built by the trail's
  // bands (whole near it, stamped further off, a shell far away: era/isekai.js treeBands)
  forest: fz({ title: 'Forest', reads: 'a forest of arranged clumps, the near trees whole and the far ones their shapes', flora: fz({
    trees: fz({ clusters: 14, perCluster: [3, 7], spread: 5, heights: [8, 14], clearTrail: 3, clearCliff: 4, compose: 'ikebana', bands: true }),
    grass: fz({ clusters: 30, perCluster: [6, 12], spacing: 0.3, scatter: 0.12, fringeEvery: 0.6, height: [0.4, 0.8], field: fz({ reach: 3, every: 0.9, height: [0.45, 0.8] }), live: fz({ kind: 'meadow', density: 3, height: [0.35, 0.75] }) }),
    shrubs: fz({ count: 14, bloom: 0.25, fruit: 0.3 }), flowers: null }) }),
  // THE BIOMES' flora (a cube's biome lays it with its ground and its palette's character: gameworld/compose.js)
  // a coast: a few low wind-flattened trees, marram on the dunes and the banks, no field along the trail
  coast: fz({ title: 'Coast', reads: 'a few low wind-bent trees, marram grass on the banks and the dunes', flora: fz({
    trees: fz({ clusters: 3, perCluster: [1, 3], spread: 3, heights: [4, 7], clearTrail: 4, clearCliff: 5, crown: fz({ squash: 0.7 }) }),
    grass: fz({ clusters: 40, perCluster: [5, 10], spacing: 0.35, scatter: 0.22, fringeEvery: 0.7, height: [0.35, 0.75], kinds: fz({ fringe: 'marram', meadow: 'marram', cliff: 'sedge', scatter: 'fescue' }), field: null, live: fz({ kind: 'marram', density: 3, height: [0.3, 0.7] }) }),
    shrubs: fz({ count: 8, bloom: 0.15, fruit: 0 }), flowers: null }) }),
  // alpine: conifers standing in stands, the grass short and fine, a few flowers in it
  alpine: fz({ title: 'Alpine', reads: 'conifers in stands on a high meadow, the grass short, a few flowers in it', flora: fz({
    trees: fz({ clusters: 7, perCluster: [2, 5], spread: 4, heights: [7, 13], clearTrail: 3.5, clearCliff: 4, crown: fz({ squash: 1.3 }), kinds: fz(['spire']) }),
    grass: fz({ clusters: 45, perCluster: [6, 12], spacing: 0.3, scatter: 0.25, fringeEvery: 0.6, height: [0.15, 0.4], kinds: fz({ fringe: 'fescue', meadow: 'fescue', cliff: 'sedge', scatter: 'fescue' }), field: null, live: fz({ kind: 'fescue', density: 4, height: [0.15, 0.35] }) }),
    shrubs: null, flowers: fz({ share: 0.15 }) }) }),
  // desert: almost nothing grows: a lone low tree, needlegrass in sparse clumps, a few dry bushes
  desert: fz({ title: 'Desert', reads: 'dry ground: a lone low tree, needlegrass in sparse clumps, a few dry bushes', flora: fz({
    trees: fz({ clusters: 1, perCluster: [1, 1], spread: 3, heights: [3, 5], clearTrail: 4, clearCliff: 5, hero: null }),
    grass: fz({ clusters: 14, perCluster: [3, 6], spacing: 0.4, scatter: 0.05, fringeEvery: 1.6, height: [0.2, 0.45], kinds: fz({ fringe: 'needlegrass', meadow: 'needlegrass', cliff: 'needlegrass', scatter: 'needlegrass' }), field: null, live: null }),
    shrubs: fz({ count: 6, bloom: 0.05, fruit: 0 }), flowers: null }) }),
  // bare ground: no trees, no grass
  bare: fz({ title: 'Bare', reads: 'bare ground: rock and earth, nothing growing', flora: fz({ trees: fz({ clusters: 0, perCluster: [1, 1], spread: 3, heights: [6, 10], clearTrail: 3.5, clearCliff: 5, hero: null }), grass: null, shrubs: null, flowers: null }) }),
});
export const BIOCUBE_IDS = fz(Object.keys(BIOCUBE_PRESETS));

const GRASS_IDS = Object.keys(GRASSES);
const num = (v, lo, hi, at) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) no(`${at} is a number ${lo} to ${hi}`); };
const int = (v, lo, hi, at) => { if (!(Number.isInteger(v) && v >= lo && v <= hi)) no(`${at} is an integer ${lo} to ${hi}`); };
const range = (v, lo, hi, at, whole = false) => { if (!(Array.isArray(v) && v.length === 2 && v.every((x) => (whole ? Number.isInteger(x) : Number.isFinite(x)) && x >= lo && x <= hi) && v[0] <= v[1])) no(`${at} is [lo, hi], ${whole ? 'whole numbers ' : ''}${lo} to ${hi}, lo ≤ hi`); };
const keys = (o, ok, at) => { for (const k of Object.keys(o)) if (!ok.includes(k)) no(`${at}.${k} is not a setting (${ok.join(', ')})`); };

// a level's tree kinds (era/leaf-forms.js): a form's name, or a form with its proportions and its colours' picks
function checkKinds(kinds) {
  if (!(Array.isArray(kinds) && kinds.length >= 1 && kinds.length <= 6)) no(`flora.trees.kinds is a list of 1 to 6 tree kinds, each a leaf form (${LEAF_FORM_IDS.join(', ')}) or { ${TREE_KIND_KEYS.join(', ')} }`);
  kinds.forEach((k, i) => {
    const at = `flora.trees.kinds[${i}]`, form = typeof k === 'string' ? k : isObj(k) ? k.form : undefined;
    if (!LEAF_FORMS[form]) no(`${at}${typeof k === 'string' ? '' : '.form'} is a leaf form (${LEAF_FORM_IDS.join(', ')})`);
    if (typeof k === 'string') return;
    keys(k, TREE_KIND_KEYS, at);
    if (k.scale !== undefined) num(k.scale, 0.4, 2, `${at}.scale`);
    if (k.trunk !== undefined) num(k.trunk, 0.15, 0.8, `${at}.trunk`);
    if (k.girth !== undefined) num(k.girth, 0.015, 0.12, `${at}.girth`);
    if (k.spread !== undefined) num(k.spread, 0.12, 0.6, `${at}.spread`);
    if (k.density !== undefined) num(k.density, 0.4, 2.5, `${at}.density`);
    if (k.stems !== undefined) int(k.stems, 1, 4, `${at}.stems`);
    if (k.splay !== undefined) num(k.splay, 0, 40, `${at}.splay (degrees)`);
    if (k.branch !== undefined) num(k.branch, 0.3, 1.6, `${at}.branch`);
    if (k.split !== undefined) int(k.split, 0, 2, `${at}.split`);
    if (k.leaf !== undefined) int(k.leaf, 0, LEAF_OFFER, `${at}.leaf (0 the world's, 1 to ${LEAF_OFFER} the theorist's offer)`);
    if (k.bark !== undefined) int(k.bark, 0, BARK_OFFER, `${at}.bark (0 the world's, 1 to ${BARK_OFFER} the theorist's offer)`);
    if (k.barkForm !== undefined && !BARK_FORM_IDS.includes(k.barkForm)) no(`${at}.barkForm is a bark's marks (${BARK_FORM_IDS.join(', ')})`);
    if (k.share !== undefined) num(k.share, 0.05, 20, `${at}.share`);
    if (k.evergreen !== undefined && typeof k.evergreen !== 'boolean') no(`${at}.evergreen is true (it keeps its leaves in a bare season) or false`);
  });
}

/** A level's trees' seasons: in leaf, or bare (era/isekai.js treeFaces). */
export const TREE_SEASONS = Object.freeze(['leafy', 'bare']);

function checkTrees(t) {
  if (!isObj(t)) no('flora.trees is { clusters, perCluster, spread, heights, clearTrail, clearCliff, crown?, hero? }');
  keys(t, ['clusters', 'perCluster', 'spread', 'heights', 'clearTrail', 'clearCliff', 'crown', 'hero', 'compose', 'bands', 'kinds', 'clump', 'harmony', 'season'], 'flora.trees');
  // (the SEASON: 'bare' the leaves fallen, the trees and bushes their limbs and twigs, but a kind that is evergreen)
  if (t.season !== undefined && !TREE_SEASONS.includes(t.season)) no(`flora.trees.season is ${TREE_SEASONS.join(' or ')} (the leaves fallen: limbs and twigs, but an evergreen kind)`);
  if (t.kinds !== undefined) checkKinds(t.kinds);
  // (an ikebana clump's cast, era/nature.js arrangedClump: which kind each role takes; and the harmony its colours are
  // solved in, era/flora-colours.js)
  if (t.clump !== undefined) {
    if (t.compose !== 'ikebana') no("flora.trees.clump casts an arranged clump's roles: compose 'ikebana'");
    if (!isObj(t.clump)) no(`flora.trees.clump is { ${CLUMP_ROLES.join(', ')} }, each a kind's place in \`kinds\` (from 0) or { bush: n } (a kind of \`flora.bushes\`)`);
    keys(t.clump, CLUMP_ROLES, 'flora.trees.clump');
    for (const [r, v] of Object.entries(t.clump)) {
      if (isObj(v)) { keys(v, ['bush'], `flora.trees.clump.${r}`); int(v.bush, 0, 5, `flora.trees.clump.${r}.bush (a kind's place in \`flora.bushes.kinds\`, from 0)`); continue; }
      if (!t.kinds) no(`flora.trees.clump.${r} casts a tree kind: name the kinds (or { bush: n } for a bush)`);
      int(v, 0, t.kinds.length - 1, `flora.trees.clump.${r} (a kind's place in \`kinds\`, from 0)`);
    }
  }
  if (t.harmony !== undefined) {
    if (!HARMONIES.includes(t.harmony)) no(`flora.trees.harmony is ${HARMONIES.join(', ')}`);
    if (!(t.kinds || t.clump) || t.compose !== 'ikebana') no("flora.trees.harmony colours an arranged clump's roles: name the kinds (or cast the clump) and compose 'ikebana'");
  }
  if (t.compose !== undefined && t.compose !== 'ikebana' && t.compose !== false) no("flora.trees.compose is 'ikebana' (a clump arranged: era/nature.js arrangedClump) or false (scattered)");
  if (t.bands !== undefined && t.bands !== true && t.bands !== false) {
    if (!isObj(t.bands)) no('flora.trees.bands is true or { hero?, far?, stock? } (era/isekai.js treeBands)');
    keys(t.bands, ['hero', 'far', 'stock'], 'flora.trees.bands');
    if (t.bands.hero !== undefined) num(t.bands.hero, 0, 60, 'flora.trees.bands.hero');
    if (t.bands.far !== undefined) num(t.bands.far, 1, 200, 'flora.trees.bands.far');
    if (t.bands.stock !== undefined) int(t.bands.stock, 1, 8, 'flora.trees.bands.stock');
    if ((t.bands.hero ?? 6) >= (t.bands.far ?? 15)) no('flora.trees.bands: hero is nearer than far');
  }
  int(t.clusters, 0, 40, 'flora.trees.clusters'); range(t.perCluster, 1, 20, 'flora.trees.perCluster', true); num(t.spread, 0.5, 20, 'flora.trees.spread');
  range(t.heights, 1, 40, 'flora.trees.heights'); num(t.clearTrail, 0, 20, 'flora.trees.clearTrail'); num(t.clearCliff, 0, 20, 'flora.trees.clearCliff');
  if (t.crown !== undefined) {
    if (!isObj(t.crown)) no('flora.trees.crown is { height, radius, masses, squash, trunk }');
    keys(t.crown, ['height', 'radius', 'masses', 'squash', 'trunk'], 'flora.trees.crown');
    if (t.crown.height !== undefined) num(t.crown.height, 0.3, 0.9, 'flora.trees.crown.height');
    if (t.crown.radius !== undefined) num(t.crown.radius, 0.1, 0.8, 'flora.trees.crown.radius');
    if (t.crown.masses !== undefined) range(t.crown.masses, 1, 12, 'flora.trees.crown.masses', true);
    if (t.crown.squash !== undefined) num(t.crown.squash, 0.4, 1.4, 'flora.trees.crown.squash');
    if (t.crown.trunk !== undefined) num(t.crown.trunk, 0.01, 0.15, 'flora.trees.crown.trunk');
  }
  if (t.hero !== undefined && t.hero !== null) {
    if (!isObj(t.hero)) no('flora.trees.hero is null (none) or { y, side, off, h, masses }');
    keys(t.hero, ['y', 'side', 'off', 'h', 'masses'], 'flora.trees.hero');
    num(t.hero.y, 0, 400, 'flora.trees.hero.y'); if (t.hero.side !== 1 && t.hero.side !== -1) no('flora.trees.hero.side is 1 or -1 (which side of the trail)');
    num(t.hero.off, 0, 30, 'flora.trees.hero.off'); num(t.hero.h, 2, 40, 'flora.trees.hero.h'); range(t.hero.masses, 1, 16, 'flora.trees.hero.masses', true);
  }
}
function checkGrass(g) {
  if (g === null) return;
  if (!isObj(g)) no('flora.grass is null (none) or { clusters, perCluster, spacing, scatter, fringeEvery, height, kinds?, field? }');
  keys(g, ['clusters', 'perCluster', 'spacing', 'scatter', 'fringeEvery', 'height', 'kinds', 'field', 'live'], 'flora.grass');
  int(g.clusters, 0, 200, 'flora.grass.clusters'); range(g.perCluster, 1, 40, 'flora.grass.perCluster', true); num(g.spacing, 0.1, 2, 'flora.grass.spacing');
  num(g.scatter, 0, 1, 'flora.grass.scatter'); num(g.fringeEvery, 0.2, 5, 'flora.grass.fringeEvery'); range(g.height, 0.1, 3, 'flora.grass.height');
  if (g.kinds !== undefined) {
    if (!isObj(g.kinds)) no('flora.grass.kinds is { fringe?, meadow?, cliff?, scatter? }');
    keys(g.kinds, ['fringe', 'meadow', 'cliff', 'scatter'], 'flora.grass.kinds');
    for (const [k, v] of Object.entries(g.kinds)) if (!GRASS_IDS.includes(v)) no(`flora.grass.kinds.${k} is one of ${GRASS_IDS.join(', ')}`);
  }
  if (g.field !== undefined && g.field !== null) {
    if (!isObj(g.field)) no('flora.grass.field is null (none) or { reach, every, height }');
    keys(g.field, ['reach', 'every', 'height'], 'flora.grass.field');
    num(g.field.reach, 0.5, 30, 'flora.grass.field.reach'); num(g.field.every, 0.3, 5, 'flora.grass.field.every'); range(g.field.height, 0.1, 3, 'flora.grass.field.height');
  }
  if (g.live !== undefined && g.live !== null) {
    if (!isObj(g.live)) no('flora.grass.live is null (none) or { kind, density, height }');
    keys(g.live, ['kind', 'density', 'height'], 'flora.grass.live');
    if (!GRASS_IDS.includes(g.live.kind)) no(`flora.grass.live.kind is one of ${GRASS_IDS.join(', ')}`);
    num(g.live.density, 0.5, 12, 'flora.grass.live.density'); range(g.live.height, 0.1, 3, 'flora.grass.live.height');
  }
}
function checkFlowers(f) {
  if (f === null) return;
  if (!isObj(f)) no('flora.flowers is null (none) or { share, mix? }');
  keys(f, ['share', 'mix'], 'flora.flowers');
  num(f.share, 0, 1, 'flora.flowers.share');
  if (f.mix !== undefined && (!isObj(f.mix) || Object.entries(f.mix).some(([k, v]) => !WILDFLOWER_KINDS.includes(k) || !(Number.isFinite(v) && v >= 0)) || !Object.values(f.mix).some((v) => v > 0))) no(`flora.flowers.mix weighs some of ${WILDFLOWER_KINDS.join(', ')} (numbers ≥ 0, one over 0)`);
}

/** A biocube: a preset id, a document ({ title?, reads?, flora }), or { from: preset, …changes } → the cube, checked. */
export function readBiocube(spec) {
  if (typeof spec === 'string') { if (!BIOCUBE_PRESETS[spec]) no(`'${spec}' is not a biocube (${BIOCUBE_IDS.join(', ')})`); return readBiocube({ from: spec }); }
  if (!isObj(spec)) no(`a biocube is a preset id (${BIOCUBE_IDS.join(', ')}), a document or { from, …changes }`);
  keys(spec, ['id', 'from', 'title', 'reads', 'flora', 'fauna'], 'biocube');
  // (a biocube of fauna alone lays no flora of its own: the kit's grows as it would, flora null)
  const faunaOnly = spec.from === undefined && spec.flora === undefined && spec.fauna !== undefined && spec.fauna !== null;
  const base = spec.from === undefined ? null : BIOCUBE_PRESETS[spec.from] ?? no(`from '${spec.from}' is not a biocube (${BIOCUBE_IDS.join(', ')})`);
  if (faunaOnly) return { id: spec.id ?? 'biocube', title: spec.title ?? 'Biocube', reads: spec.reads ?? '', flora: null, fauna: readFauna(spec.fauna) };
  const F0 = base ? base.flora : {}, F1 = spec.flora ?? {};
  if (!isObj(F1)) no('flora is { trees?, grass?, shrubs?, flowers?, bushes? }');
  keys(F1, ['trees', 'grass', 'shrubs', 'flowers', 'bushes'], 'flora');
  // (each block over the preset's: an object merged, null or a whole block in its place)
  const over = (k) => (F1[k] === undefined ? F0[k] : F1[k] === null || !isObj(F0[k]) ? F1[k] : { ...F0[k], ...F1[k] });
  // (bushes composed in sections, era/thickets.js: only where a document names them, so a preset reads as it did)
  const bu = over('bushes') ?? null;
  const flora = { trees: over('trees'), grass: over('grass') ?? null, shrubs: over('shrubs') ?? null, flowers: over('flowers') ?? null, ...(bu ? { bushes: bu } : {}) };
  if (flora.trees === undefined) no('flora.trees is wanted (a document names its trees, or builds from a preset)');
  checkTrees(flora.trees); checkGrass(flora.grass); checkFlowers(flora.flowers);
  if (flora.bushes) checkBushes(flora.bushes, { no, num, int, range, keys, isObj, LEAF_OFFER, BARK_OFFER, BARK_FORM_IDS });
  // (a clump's role cast as a bush names one of the bushes' kinds)
  for (const [r, v] of Object.entries(flora.trees.clump ?? {})) if (isObj(v) && !(flora.bushes && v.bush < flora.bushes.kinds.length)) no(`flora.trees.clump.${r}.bush is a kind's place in \`flora.bushes.kinds\`${flora.bushes ? ` (0 to ${flora.bushes.kinds.length - 1})` : ': name the bushes'}`);
  if (flora.shrubs !== null) { const e = validateShrubs(flora.shrubs); if (e.length || !isObj(flora.shrubs)) no(`flora.shrubs: ${e.join('; ') || 'is null or { count, bloom, fruit }'}`); }
  // (what lives there: none unless asked, a preset grows no fauna)
  const fauna = spec.fauna === undefined || spec.fauna === null ? null : readFauna(spec.fauna);
  return { id: spec.id ?? spec.from ?? 'biocube', title: spec.title ?? base?.title ?? 'Biocube', reads: spec.reads ?? base?.reads ?? '', flora, fauna };
}

/** A kit card with the cube's flora laid over it: its trees and grass in the card's own keys (a grass of null: none).
 *  A cube of fauna alone (flora null): the card as it is. */
export function withFlora(card, cube) {
  if (!cube.flora) return card;
  const F = cube.flora, { kinds, clump, harmony, ...T } = F.trees, G = F.grass;
  // (the cube's tree kinds go to the card as its trees' `leafKinds`, their clump's cast and harmony beside them)
  const trees = { ...card.trees, ...T, ...(T.crown ? { crown: { ...card.trees?.crown, ...T.crown } } : {}), ...(kinds ? { leafKinds: kinds } : {}),
    ...(clump ? { leafClump: clump } : {}), ...(harmony ? { leafHarmony: harmony } : {}) };
  if (T.hero === null) trees.hero = null;
  const { live: GL, ...G0 } = G ?? {};
  const grass = G === null || !card.grass ? null : { ...card.grass, ...G0, kinds: { ...card.grass.kinds, ...(G.kinds ?? {}) }, ...(G.field === undefined ? {} : { field: G.field }) };
  // (the live carpet: the card's, its kind, density and height the cube's)
  const live = GL && card.live ? { ...card.live, ...GL } : card.live;
  // (the cube's bushes, composed in sections: era/thickets.js)
  return { ...card, trees, grass, ...(live !== undefined ? { live } : {}), ...(F.bushes ? { thickets: F.bushes } : {}) };
}
