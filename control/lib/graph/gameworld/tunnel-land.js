/**
 * THE LAND TUNNEL — a look tunnelled from words instead of written as a kit. It starts from a BASE kit's card taken apart
 * into its facets (era/look-facets.js: palette, grammar, geology, flora, sky, air, water) and its swatches; an intent
 * ("a grounded frontier: rust plains, basalt cliffs, sparse scrub, a gas giant in a pale sky, detailed") is read into
 * traits, each a set of ops on one facet and a measure on the look; the look is assessed by its own laws (every ramp
 * climbs, every shadow is a colour, the sky is the brightest thing, every tile paints inside its ramp) and tweaked
 * until they hold. The plan is a LOOK (era/style/looks.js): a card and swatches under an id its content decides,
 * registered so a world, a stage and a sheet can name it like any kit.
 *
 *   LAND_TRAITS                                       the traits, by the words (and colour phrases) that name them
 *   landDomain()                                      → a tunnel domain (gameworld/tunnel.js)
 *   tunnelLand(intent, { seed, base })                → the tunnel's record; its plan { id, base, card, swatches }
 *   composeLook(intent, { seed, base, name })         → the look, registered
 *
 * Pure but for the registry, which is content-addressed: the same words compose the same look under the same id.
 */
import { tunnel } from './tunnel.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { SWATCHES } from '../era/style/swatches.js';
import { registerLook, lookOf } from '../era/style/looks.js';
import { decompileKit, composeKit, rampFrom, resample, desaturate, luma, chroma, toHsl, toRgb, FACETS } from '../era/look-facets.js';
import { fingerprint } from './review.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ── the vocabulary of colour: a colour word and the ramp a noun names ────────────────────────────────────────────────
export const COLOURS = Object.freeze({
  rust: [168, 84, 54], ochre: [190, 146, 74], sand: [206, 180, 134], red: [160, 66, 50], umber: [112, 82, 60], grey: [128, 128, 126], ash: [150, 148, 144],
  lichen: [126, 142, 98], olive: [112, 118, 64], sage: [140, 156, 120], green: [84, 146, 70], moss: [92, 120, 66], teal: [72, 138, 136], violet: [118, 92, 168],
  blue: [84, 122, 186], amber: [214, 158, 84], gold: [208, 172, 86], white: [232, 232, 228], black: [58, 62, 70], basalt: [62, 66, 74], slate: [92, 104, 120],
  chalk: [222, 218, 206], pink: [208, 142, 164], copper: [176, 104, 64], bone: [214, 204, 178], dust: [176, 158, 132], pale: [196, 210, 220],
});
const NOUNS = {
  grass: ['plains', 'ground', 'grass', 'grassland', 'meadows', 'fields', 'steppe', 'flats', 'land'],
  soil: ['soil', 'dust', 'earth', 'trails', 'trail', 'dirt', 'regolith', 'sand'],
  rock: ['cliffs', 'rock', 'rocks', 'stone', 'crags', 'mountains', 'boulders', 'mesas', 'bluffs'],
  foliage: ['trees', 'scrub', 'foliage', 'forest', 'canopy', 'leaves', 'bushes', 'brush'],
  sky: ['sky', 'skies'], cloud: ['clouds'], far: ['hills', 'distance', 'ridges', 'horizon'], bark: ['bark', 'trunks'],
};
/** What a stone says about the rock (its colour) and the cliff (its geology). */
const STONES = { basalt: { colour: 'basalt', geology: { joint: 1.8, bed: 3.4 } }, granite: { colour: 'ash', geology: { joint: 3.4, bed: 4 } }, sandstone: { colour: 'ochre', geology: { bed: 1.3, joint: 4 } }, limestone: { colour: 'bone', geology: { bed: 1.6, joint: 3 } }, chalk: { colour: 'chalk', geology: { bed: 2.2, joint: 5 } }, slate: { colour: 'slate', geology: { bed: 0.9, joint: 2.4 } }, ironstone: { colour: 'rust', geology: { bed: 1.8, joint: 2.8 } } };

const LAND = ['grass', 'soil', 'rock', 'foliage', 'bark', 'far', 'sky', 'cloud'];
const LIGHT_RAMPS = { sky: { lo: 0.4, hi: 0.92, cool: 0.15 }, cloud: { lo: 0.5, hi: 0.97, cool: 0.3 }, far: { lo: 0.32, hi: 0.86, cool: 0.4 } };
const op = (path, to) => ({ path, to });
const T = (words, read, ops, measure, more = {}) => ({ words, read, ops, measure, ...more });
const sat = (ramp) => ramp.reduce((a, c) => a + chroma(c) / Math.max(1, Math.max(...c)), 0) / ramp.length;

/** The traits: grounded or stylized, detailed, the rock's geology, what grows, the sky, the air, the water, colours. */
export const LAND_TRAITS = (() => {
  const out = {
    // THE REALISTIC POLE (the isekai look's opposite): colour is the material's, light only moves its value and
    // temperature; the light is smooth over the form, the shadow hard, and the dark gathers into pockets at two scales
    realistic: T(['realism', 'realistic', 'naturalistic', 'lifelike', 'photoreal'], 'the realistic pole: the ground is a material under light — dirt, scree and a packed trail painted in the ramp\'s stops, lit smooth over the form, its shadows hard and its hollows dark, so every stretch holds both a light and a dark',
      [{ pole: 'realistic' }],
      (L) => ({ ok: !!L.card.ground && ['dirt', 'scree', 'packed'].every((t) => L.card.tiles[t]), value: L.card.ground ? `ground: material × light, split ${L.card.ground.split}, cavity ${L.card.ground.cavity}` : 'the ground is banded' })),
    grounded: T(['grounded', 'natural', 'earthy', 'believable'], 'a grounded palette (colour taken down a third) and rock that stands bare: no grass hats, short fringes',
      [{ desat: 0.35 }, op('facets.geology.boulder.minHat', 99), op('facets.grammar.lip.fringe', 0.35), op('facets.grammar.cel', 0.22)],
      (L) => ({ ok: sat(L.swatches.land.grass) <= 0.5 && L.card.boulder.minHat >= 99, value: `grass saturation ${r3(sat(L.swatches.land.grass))}, hats from ${L.card.boulder.minHat}` })),
    stylized: T(['stylized', 'stylised', 'painterly', 'graphic'], 'stylized: the palette locked, light turning to shade in bands, big shapes', [op('facets.grammar.cliffCelR', 2)],
      (L) => ({ ok: !!L.card.lock && L.card.cel > 0, value: `cel ${L.card.cel}` })),
    detailed: T(['detailed', 'detail', 'intricate', 'fine', 'rich'], 'detailed: every ramp seven stops, so a surface turns through more values; more variants of everything',
      [{ resample: 7 }, op('facets.geology.rubble.variants', 12), op('facets.flora.grass.variants', 6), op('facets.flora.trees.variants', 5), op('facets.geology.landform.retreat', 0.2)],
      (L) => ({ ok: LAND.every((r) => !L.swatches.land[r] || L.swatches.land[r].length >= 7), value: LAND.filter((r) => L.swatches.land[r]).map((r) => L.swatches.land[r].length).join('/') })),
    layered: T(['layered', 'stratified', 'bedded', 'banded'], 'cliffs bedded close: many strata', [op('facets.geology.landform.bed', 1.3)], (L) => ({ ok: L.card.landform.bed <= 1.5, value: `beds every ${L.card.landform.bed} m` })),
    'tall-cliffs': T(['tall cliffs', 'towering cliffs', 'high cliffs', 'sheer'], 'tall, sheer cliffs', [op('facets.geology.landform.face', 86), op('facets.geology.landform.throw', 22)], (L) => ({ ok: L.card.landform.face >= 84, value: `${L.card.landform.face}°, ${L.card.landform.throw} m` })),
    craggy: T(['craggy', 'jointed', 'fractured', 'broken'], 'cliffs jointed close: craggy', [op('facets.geology.landform.joint', 2)], (L) => ({ ok: L.card.landform.joint <= 2.2, value: `joints every ${L.card.landform.joint} m` })),
    angular: T(['angular', 'jagged', 'sharp', 'shattered'], 'angular boulders: few faces, sharp tops', [op('facets.geology.boulder.sides', [4, 6]), op('facets.geology.boulder.wobble', 0.05), op('facets.geology.boulder.rings', [[0, 0.95], [0.25, 1], [0.8, 0.7], [1, 0.32]]), op('facets.geology.boulder.height', [0.7, 1.2])],
      (L) => ({ ok: L.card.boulder.sides[1] <= 6, value: `${L.card.boulder.sides.join('–')} sides` })),
    rocky: T(['rocky', 'boulder-strewn', 'stony', 'strewn'], 'boulders strewn along the way', [op('facets.geology.rubble.boulders', 14)], (L) => ({ ok: L.card.rubble.boulders >= 12, value: `${L.card.rubble.boulders} boulders` })),
    sparse: T(['sparse', 'barren', 'arid', 'desert', 'bare', 'frontier'], 'sparse: few trees, thin grass close to the way', [op('facets.flora.trees.clusters', 2), op('facets.flora.trees.perCluster', [1, 2]), op('facets.flora.grass.clusters', 26), op('facets.flora.grass.height', [0.3, 0.6]), op('facets.flora.grass.field', { reach: 3.5, every: 0.9, height: [0.3, 0.6] })],
      (L) => ({ ok: L.card.trees.clusters <= 3, value: `${L.card.trees.clusters} stands, grass ${L.card.grass.height.join('–')} m` })),
    scrub: T(['scrub', 'scrubland', 'shrubs', 'bushes'], 'scrub, not trees: low and wide, small cleft leaves', [op('facets.flora.trees.die', 'cleft'), op('facets.flora.trees.heights', [2.5, 4.5]), op('facets.flora.trees.crown', { height: 0.55, radius: 0.42, masses: [4, 6], squash: 0.7, trunk: 0.05 }), op('facets.flora.trees.hero', { y: 47, side: 1, off: 7, h: 6, masses: [6, 7] })],
      (L) => ({ ok: L.card.trees.heights[1] <= 5, value: `${L.card.trees.heights.join('–')} m` })),
    lush: T(['lush', 'verdant', 'overgrown'], 'lush: stands of trees, deep grass', [op('facets.flora.trees.clusters', 8), op('facets.flora.trees.perCluster', [2, 5]), op('facets.flora.grass.clusters', 90)], (L) => ({ ok: L.card.trees.clusters >= 7, value: `${L.card.trees.clusters} stands` })),
    'gas-giant': T(['gas giant', 'ringed planet', 'giant planet', 'planet', 'gas-giant'], 'a giant world hanging in the day sky', [op('facets.sky.companion', { azimuth: 112, elevation: 30, size: 8, phase: 0.62 })], (L) => ({ ok: !!L.card.companion, value: L.card.companion ? `${L.card.companion.size} × the moon, ${L.card.companion.elevation}° up` : 'none' })),
    'pale-sun': T(['pale sun', 'white sun', 'small sun', 'distant sun', 'cold sun'], 'a small, white, distant sun', [op('facets.sky.sun', { size: 0.9, glow: 0.8 }), op('facets.sky.light.key.color', '#f2efe6')], (L) => ({ ok: L.card.sun && L.card.sun.size <= 1, value: L.card.sun ? `size ${L.card.sun.size}` : 'no sun' })),
    'red-sun': T(['red sun', 'dim sun', 'old sun', 'amber sun'], 'a large, low, red sun', [op('facets.sky.sun', { size: 2.2, glow: 1.6 }), op('facets.sky.light.key.color', '#ffc49a'), op('facets.sky.light.key.elevation', 22)], (L) => ({ ok: L.card.sun && L.card.sun.size >= 2, value: L.card.sun ? `size ${L.card.sun.size}` : 'no sun' })),
    hazy: T(['dusty', 'hazy', 'haze', 'thin air', 'smoggy'], 'dust in the air: the far layers fade', [{ fog: 0.0035 }], (L) => ({ ok: L.card.air.fog.density >= 0.003, value: `haze ${L.card.air.fog.density}` })),
    clear: T(['clear air', 'crisp', 'thin', 'airless'], 'clear air: the far layers keep their colour', [op('facets.air.air.fog.density', 0.0009)], (L) => ({ ok: L.card.air.fog.density <= 0.001, value: `haze ${L.card.air.fog.density}` })),
    vast: T(['vast', 'open', 'expansive', 'wide', 'frontier'], 'vast: the far layers stand further and taller', [{ layers: 1.35 }], (L) => ({ ok: true, value: L.card.layers.map((x) => x.height[1]).join('/') })),
    mountainous: T(['mountainous', 'peaks', 'alpine', 'ranges'], 'mountains behind: the far layers high and peaked', [{ layers: 1.8, peaks: 2 }], (L) => ({ ok: L.card.layers.at(-1).height[1] >= 100, value: L.card.layers.map((x) => x.height[1]).join('/') })),
    silty: T(['silty', 'glacial', 'milky', 'meltwater', 'turbid'], 'water milky with silt', [op('facets.water.water', { fill: '#8fb0ab' })], (L) => ({ ok: L.card.water?.fill === '#8fb0ab', value: L.card.water?.fill ?? 'the base\'s' })),
  };
  // the stones: a rock's colour and its cliff's geology
  // the LEAF DIE a crown is stamped with on the realistic pole (era/isekai-tiles.js LEAF_DIES), by what grows
  for (const [die, words] of Object.entries({ lobed: ['oak', 'oaks', 'maple', 'maples'], lance: ['willow', 'willows', 'reeds', 'eucalyptus'], needle: ['pine', 'pines', 'fir', 'firs', 'conifer', 'conifers', 'spruce'], oval: ['birch', 'birches', 'beech', 'aspen', 'orchard'], cleft: ['thorn', 'thorns', 'acacia', 'acacias'] }))
    out[`leaves-${die}`] = T(words, `${die} leaves: on the realistic pole a crown is stamped with ${die} leaves, figure and ground swapping as the light falls`, [op('facets.flora.trees.die', die)], (L) => ({ ok: L.card.trees.die === die, value: `die ${L.card.trees.die}` }));
  for (const [w, S] of Object.entries(STONES)) out[`stone-${w}`] = T([w], `${w}: the rock ${S.colour}, its cliffs bedded every ${S.geology.bed} m and jointed every ${S.geology.joint} m`,
    [{ ramp: 'rock', colour: S.colour }, op('facets.geology.landform.bed', S.geology.bed), op('facets.geology.landform.joint', S.geology.joint)],
    (L) => ({ ok: L.card.landform.bed === S.geology.bed, value: `beds ${L.card.landform.bed} m, joints ${L.card.landform.joint} m` }), { setBy: 'stone' });
  // colour phrases: a colour word before a noun naming a ramp ("rust plains", "teal sky")
  for (const [c, rgb] of Object.entries(COLOURS)) for (const [ramp, nouns] of Object.entries(NOUNS)) {
    const id = `${ramp}-${c}`;
    out[id] = T(nouns.map((n) => `${c} ${n}`), `the ${ramp} ${c}`, [{ ramp, colour: c }], (L) => { const m = L.swatches.land[ramp][Math.floor(L.swatches.land[ramp].length / 2)]; return { ok: Math.hypot(...m.map((v, k) => v - rgb[k])) < 90, value: hex(m) }; });
  }
  return Object.freeze(out);
})();

// ── ops ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const getAt = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setAt(o, path, v) { const ks = path.split('.'), last = ks.pop(); let a = o; for (const k of ks) a = a[k] = a[k] && typeof a[k] === 'object' ? { ...a[k] } : {}; a[last] = clone(v); }
/** Re-cut every tile's windows onto ramps of a new length, in proportion. */
function rescaleTiles(tiles, from, to) {
  const out = {};
  for (const [k, t] of Object.entries(tiles)) {
    const n0 = from[t.ramp] ?? 5, n1 = to[t.ramp] ?? n0, f = (i) => Math.round((i * (n1 - 1)) / Math.max(1, n0 - 1));
    out[k] = t.centred !== undefined ? { ...t, lit: centred(n1, t.centred), shade: centred(n1, t.centred) } : { ...t, lit: [...new Set(t.lit.map(f))], shade: [...new Set(t.shade.map(f))] };
  }
  return out;
}
// a material's window: the ramp's middle (the colour itself; `lift` stops up for a trodden trail, packed and paler) and
// up to two stops either side, as many each way (its outline, its grit; the painter's base is the window's middle) — the light, not the window, makes the shade
const centred = (n, lift = 0) => { const m = Math.min(n - 1, Math.floor((n - 1) / 2) + lift), r = Math.min(2, m, n - 1 - m); return Array.from({ length: 2 * r + 1 }, (_, i) => m - r + i); };
function applyOp(c, o, id) {
  const done = [];
  if (o.path) { setAt(c, o.path, o.to); done.push(`${o.path.replace('facets.', '')} = ${typeof o.to === 'object' ? JSON.stringify(o.to) : o.to}`); return done; }
  const land = c.swatches.land;
  if (o.desat !== undefined) { for (const r of LAND) if (land[r] && r !== 'sky') land[r] = desaturate(land[r], o.desat); for (const r of ['timber', 'rope']) if (Array.isArray(c.swatches.made[r])) c.swatches.made[r] = desaturate(c.swatches.made[r], o.desat * 0.6); done.push(`palette taken down ${o.desat * 100} %`); }
  if (o.resample) { const from = Object.fromEntries(Object.entries(land).map(([k, v]) => [k, v.length])); for (const r of Object.keys(land)) land[r] = resample(land[r], o.resample); c.facets.grammar.tiles = rescaleTiles(c.facets.grammar.tiles, from, Object.fromEntries(Object.keys(land).map((k) => [k, o.resample]))); done.push(`every ramp ${o.resample} stops`); }
  // a ramp round a colour; the sky, the clouds and the far layers are light ramps (zenith to horizon, shade to lit
  // cloud, near ridge to far), never down to a ground's shadow
  if (o.ramp) { const n = land[o.ramp]?.length ?? 5, grounded = c.grounded; land[o.ramp] = rampFrom(COLOURS[o.colour], n, { cool: grounded ? 0.3 : 0.6, sat: grounded ? 0.75 : 1, ...(LIGHT_RAMPS[o.ramp] ?? {}) }); done.push(`${o.ramp} ramp round ${o.colour}`); }
  // the realistic pole: the ground drawn as material × light (era/isekai.js realGround) from three tiles, each a window
  // of its ramp from near its shadow to below its light (the light is the sun's to add)
  if (o.pole === 'realistic') {
    // the POLE, decided here once and read by every drawer (era/style/pole.js): every surface its material
    setAt(c, 'facets.grammar.pole', 'material');
    setAt(c, 'facets.grammar.ground', { scale: 1.6, split: 2, cavity: 0.45, exposure: 1, variants: 16, patches: { fines: 1, gravel: 1, dust: 1, crust: 1, trodden: 1 } });
    for (const [t, r, lift] of [['dirt', 'grass', 0], ['scree', 'rock', 0], ['packed', 'soil', 1], ['grain', 'bark', 0], ['leaf', 'foliage', 0],
      // the PATCHES, laid by cause over the ground (alpha-tested), one family with it: damp fines a stop darker, gravel,
      // drifted dust a stop paler, a lichen crust a stop down, the trail's own fines trodden out at its edge
      ['fines', 'grass', -1], ['gravel', 'rock', 0], ['dust', 'grass', 1], ['crust', 'foliage', -1], ['trodden', 'soil', 0]]) setAt(c, `facets.grammar.tiles.${t}`, { ramp: r, lit: centred(land[r].length, lift), shade: centred(land[r].length, lift), scale: 1.6, centred: lift });
    // and every drawn tile (cliff, rock, hat, fringe, blades …) re-centred: one window, the light makes the band; the
    // clouds are the sky's and keep theirs, a trail's rim and creep match what they lie on
    for (const [t, T0] of Object.entries(c.facets.grammar.tiles)) if (T0.centred === undefined && !['cumulus', 'rim', 'creep'].includes(t)) { const n = land[T0.ramp].length; c.facets.grammar.tiles[t] = { ...T0, lit: centred(n), shade: centred(n), centred: 0 }; }
    // and the rock DRAWN real: the banded cliff paints its light in (lit benches, black ledges) and its rock is two
    // flat blotches; here the cliff is strata and the rock a rock face — a fine mottle, thin fractures — at the scale a
    // rock is read at
    const TT = c.facets.grammar.tiles;
    if (TT.cliff) TT.cliff = { ...TT.cliff, paint: 'strata', scale: 5 };
    // and the crowns their LEAVES: a skin of the look's leaf die in four bands of light, and leaf cards out of the
    // crown's edge (the die is the look's `trees.die`, oval unless what grows says otherwise)
    for (const t of ['canopy', 'leafcard']) TT[t] = { ramp: 'foliage', lit: centred(land.foliage.length), shade: centred(land.foliage.length), scale: 2.4, centred: 0, paint: t };
    for (const t of ['rock', 'hat']) if (TT[t]) TT[t] = { ...TT[t], paint: 'rockface', scale: 2.5 };
    // no grass hats on the rocks (the banded look's signature): a boulder stands bare
    setAt(c, 'facets.geology.boulder.minHat', 99);
    done.push('the ground drawn as material under light: dirt, scree and packed tiles, smooth light, hard shadows, dark hollows');
  }
  // the haze takes the far ramp's colour when the look is built (after any tweak to the far ramp)
  if (o.fog !== undefined) { c.hazeFromFar = true; setAt(c, 'facets.air.air.fog', { color: c.facets.air.air.fog.color, density: o.fog }); done.push(`haze ${o.fog}, the far ramp's colour`); }
  if (o.layers) { c.facets.air.layers = c.facets.air.layers.map((L, i) => ({ ...L, height: L.height.map((h) => r3(h * o.layers * (i ? 1 : 0.8 + 0.2 * o.layers))), ...(o.peaks && L.peaks ? { peaks: L.peaks + o.peaks } : {}) })); done.push(`far layers × ${o.layers}`); }
  return done;
}

// ── the realism palette (the material pole's): what reads as real ground ───────────────────────────────────────────
// a material ramp keeps one hue (the light moves it, the ramp doesn't), is muted (natural ground is rarely more than
// half saturated, less at its ends), sits low-middle (a material reflects a tenth to two fifths of the light: the sun
// makes it bright), and the ground's materials are one family (they part by value and texture, not by hue)
const REAL = { ramps: ['grass', 'soil', 'rock', 'bark'], hue: 18, sat: 0.55, satEnds: 0.45, albedo: [40, 150], family: 50 };
const hsv = (c) => { const mx = Math.max(...c); return mx ? chroma(c) / mx : 0; };
const hueGap = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const midOf = (r) => r[Math.floor((r.length - 1) / 2)];
const tinted = (c) => chroma(c) >= 18;   // a grey has no hue to keep
const groundHue = (land) => toHsl(midOf(land.grass))[0];
function realBreaks(land) {
  const out = { hue: [], sat: [], albedo: [], family: [] }, g = groundHue(land);
  for (const r of REAL.ramps) {
    const R = land[r]; if (!R) continue; const m = midOf(R), h = toHsl(m)[0];
    if (tinted(m) && R.slice(1, -1).some((c) => tinted(c) && hueGap(toHsl(c)[0], h) > REAL.hue)) out.hue.push(r);
    if (r !== 'grass' && tinted(m) && tinted(midOf(land.grass)) && hueGap(h, g) > REAL.family) out.family.push(r);
    if (luma(m) < REAL.albedo[0] || luma(m) > REAL.albedo[1]) out.albedo.push(r);
  }
  for (const r of [...REAL.ramps, 'foliage']) { const R = land[r]; if (R && R.some((c, i) => hsv(c) > (i === 0 || i === R.length - 1 ? REAL.satEnds : REAL.sat))) out.sat.push(r); }
  return out;
}
/** A ramp rebuilt round its middle made real: saturation under the ceiling, value in the band, hue toward the family,
 *  and almost no hue lean from shadow to light. */
function realRamp(R, groundH, family) {
  const n = R.length, m = midOf(R);
  let [h, sl, l] = toHsl(m);
  if (family && tinted(m)) h = groundH + Math.sign((((h - groundH) % 360) + 540) % 360 - 180) * REAL.family * 0.6;
  let c = toRgb([((h % 360) + 360) % 360, sl, l]);
  for (let k = 0; k < 12 && hsv(c) > REAL.sat * 0.85; k++) { const [a, b, d] = toHsl(c); c = toRgb([a, b * 0.88, d]); }
  for (let k = 0; k < 20 && luma(c) > REAL.albedo[1] - 6; k++) c = c.map((v) => v * 0.94);
  for (let k = 0; k < 20 && luma(c) < REAL.albedo[0] + 6; k++) c = c.map((v) => Math.min(255, v * 1.08 + 2));
  const out = rampFrom(c.map(Math.round), n, { cool: 0.06, sat: 1, lo: 0.1, hi: 0.8 });
  return out.map((s, i) => { let x = s; const cap = i === 0 || i === n - 1 ? REAL.satEnds : REAL.sat; for (let k = 0; k < 12 && hsv(x) > cap; k++) { const [a, b, d] = toHsl(x); x = toRgb([a, b * 0.85, d]); } return x; });
}

// ── the look's laws ─────────────────────────────────────────────────────────────────────────────────────────────────
export const LOOK_LAWS = Object.freeze([
  { law: 'ramps-climb', want: 'every ramp climbs from shadow to light', test: (L) => { const bad = Object.entries(L.swatches.land).filter(([, r]) => r.some((c, i) => i && luma(c) < luma(r[i - 1]) - 1)).map(([k]) => k); return { ok: !bad.length, value: bad.join(', ') || 'all climb' }; } },
  { law: 'shade-is-colour', want: 'the darkest stop of every ramp is a colour, never black', test: (L) => { const bad = Object.entries(L.swatches.land).filter(([, r]) => luma(r[0]) < 14 || chroma(r[0]) < 6).map(([k]) => k); return { ok: !bad.length, value: bad.join(', ') || 'all coloured' }; } },
  { law: 'sky-brightest', want: 'by day, the sky\'s light end is as light as anything on the ground (by night the light is in the world)', test: (L) => { if (L.card.night) return { ok: true, value: 'night: the light is in the world' }; if (L.card.void) return { ok: true, value: 'the void: no air, the sky the darkest thing' }; const s = luma(L.swatches.land.sky.at(-1)), g = Math.max(luma(L.swatches.land.grass.at(-1)), luma(L.swatches.land.rock.at(-2))); return { ok: s >= g - 4, value: `sky ${Math.round(s)} · ground ${Math.round(g)}` }; } },
  { law: 'tiles-in-ramp', want: 'every tile paints from stops its ramp has', test: (L) => { const bad = Object.entries(L.card.tiles).filter(([, t]) => [...t.lit, ...t.shade].some((i) => i >= (L.swatches.land[t.ramp]?.length ?? 0))).map(([k]) => k); return { ok: !bad.length, value: bad.join(', ') || 'all inside' }; } },
  // aerial perspective: the far ridges are the ground seen through the air, so they sit between the ground and the sky
  { law: 'aerial-perspective', want: 'by day the far layers sit between the ground and the sky, past halfway to the sky\'s colour; by night they are silhouettes', test: (L) => {
    // the far ramp's middle lies near the line from the ground's middle to the sky's light end (in colour), past
    // halfway; by night the far ridges are silhouettes, darker than the sky's horizon
    if (L.card.night) { const f = L.swatches.land.far, s = L.swatches.land.sky.at(-1); return { ok: luma(f[Math.floor(f.length / 2)]) < luma(s), value: 'night: the far layers silhouettes' }; }
    // in vacuum nothing hazes the distance: the far layers are the ground, a little darker, never the void's colour
    if (L.card.void) { const { far, sky, grass } = L.swatches.land, f = far[Math.floor(far.length / 2)], g = grass[Math.floor(grass.length / 2)]; return { ok: luma(f) <= luma(g) + 4 && luma(f) > luma(sky.at(-1)) + 8, value: `the void: far ${hex(f)} crisp, under ground ${hex(g)}, over the sky` }; }
    const { far, sky, grass } = L.swatches.land, f = far[Math.floor(far.length / 2)], s = sky.at(-1), g = grass[Math.floor(grass.length / 2)];
    const gs = s.map((v, k) => v - g[k]), L2 = gs.reduce((a, v) => a + v * v, 0) || 1, t = Math.max(0, Math.min(1, f.reduce((a, v, k) => a + (v - g[k]) * gs[k], 0) / L2));
    const off = Math.hypot(...f.map((v, k) => v - (g[k] + gs[k] * t)));
    return { ok: off <= 40 && t >= 0.3, value: `far ${hex(f)}: ${Math.round(t * 100)} % of the way from ground ${hex(g)} to sky ${hex(s)}, ${Math.round(off)} off it` };
  } },
  // POCKETING (the realistic pole): contrast per stretch of ground at two scales — the landform's (a flat in the sun
  // against the same flat in shade: the sky's fill alone) and the tile's (the material's darkest texel against its
  // lightest). Banded looks have the cel for that, and pass.
  { law: 'pocketing', want: 'on the realistic pole, every stretch of ground holds a light and a dark: sun on a flat at least 1.8 × its shade, and the ground tile spanning 2.5 × from its darkest to its lightest texel', test: (L) => {
    const G = L.card.ground; if (!G) return { ok: true, value: 'banded: the cel draws the dark' };
    const Lt = L.card.light, rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), amb = rgb(Lt.ambient).map((v) => v * Lt.fill), sun = rgb(Lt.key.color), el = Math.sin((Lt.key.elevation * Math.PI) / 180);
    const shade = luma(amb), lit = luma(amb.map((v, k) => Math.min(1, v + sun[k] * Lt.sunGain * el))), T0 = L.card.tiles.dirt, ramp = L.swatches.land[T0.ramp];
    const span = luma(ramp[Math.max(...T0.lit)]) / Math.max(1, luma(ramp[Math.min(...T0.lit)]));
    return { ok: lit / shade >= 1.8 && span >= 2.5, value: `sun ${r3(lit / shade)} × shade · tile ${r3(span)} × dark to light` };
  } },
  // THE REALISM PALETTE (the material pole; a banded look stands aside)
  ...[['hue-steady', 'hue', 'on the realistic pole a material ramp keeps one hue: the light shifts it, not the ramp'], ['chroma-ceiling', 'sat', 'on the realistic pole natural ground is muted: no stop past half saturated, its ends less'],
    ['albedo-band', 'albedo', 'on the realistic pole a material\'s middle sits low-middle (the sun makes it bright)'], ['one-family', 'family', 'on the realistic pole the ground\'s materials are one hue family: they part by value and texture']]
    .map(([law, k, want]) => ({ law, want, test: (L) => { if (L.card.pole !== 'material') return { ok: true, value: 'banded: the ramps are the drawing' }; const b = realBreaks(L.swatches.land)[k]; return { ok: !b.length, value: b.length ? b.join(', ') : 'all' }; } })),
  // the SKY'S FILL (the material pole): shade is the sky's light, cooler than the sun's but a grey with a lean, not a
  // blue — a strongly coloured fill tints every rock in shade
  { law: 'sky-fill', want: 'on the realistic pole the sky\'s fill leans cool but stays near grey (chroma ≤ 48)', test: (L) => {
    if (L.card.pole !== 'material') return { ok: true, value: 'banded: the fill is the drawing\'s' };
    const a = [1, 3, 5].map((i) => parseInt(L.card.light.ambient.slice(i, i + 2), 16)); return { ok: chroma(a) <= 48, value: `fill ${L.card.light.ambient}, chroma ${chroma(a)}` };
  } },
  { law: 'locked', want: 'every locked group names a ramp the palette has', test: (L) => { const bad = Object.entries(L.card.lock).filter(([, r]) => !L.swatches.land[r]).map(([g]) => g); return { ok: !bad.length, value: bad.join(', ') || 'all' }; } },
]);

const lookOfCandidate = (c) => {
  const facets = clone(c.facets), far = c.swatches.land.far;
  facets.palette.palette = c.swatches.land;
  if (c.hazeFromFar) facets.air.air = { ...facets.air.air, fog: { ...facets.air.air.fog, color: hex(far[Math.min(far.length - 1, Math.floor(far.length * 0.6))]) } };
  return { card: composeKit({ facets, frame: c.frame }), swatches: c.swatches };
};

export function landDomain() {
  return {
    id: 'land', TRAITS: LAND_TRAITS,
    start(seed, base = 'isekai-meadow') {
      const card = ISEKAI_STYLES[base] ?? lookOf(base)?.card, sw = SWATCHES[base] ?? lookOf(base)?.swatches;
      if (!card || !sw?.land) throw new Error(`tunnel: land: '${base}' is not a kit with land ramps to start from (${Object.keys(ISEKAI_STYLES).join(', ')})`);
      const D = decompileKit(clone(card));
      return { base: lookOf(base)?.base ?? base, facets: D.facets, frame: D.frame, swatches: clone(sw), grounded: false, setBy: {} };
    },
    pull(cand, Tr, id) {
      const c = clone(cand), changed = [];
      if (id === 'grounded' || id === 'realistic') c.grounded = true;   // (a ramp made after leans less cool: the light gives the shade its colour)
      for (const o of Tr.ops) {
        const key = o.path ?? (o.ramp ? `ramp.${o.ramp}` : Object.keys(o)[0]);
        if (c.setBy[key] && c.setBy[key] !== id) { changed.push(`${key.replace('facets.', '')}: kept from ${c.setBy[key]}`); continue; }
        changed.push(...applyOp(c, o, id));
        c.setBy[key] = id;
      }
      return { candidate: c, changed };
    },
    build: (cand) => lookOfCandidate(cand),
    measure: (Tr, id, L) => Tr.measure(L),
    laws: (L) => LOOK_LAWS.map((l) => ({ law: l.law, want: l.want, ...l.test(L) })),
    tweak(cand, failed) {
      const c = clone(cand), changed = [], land = c.swatches.land;
      for (const l of failed.laws) {
        if (l.law === 'ramps-climb') { for (const r of Object.keys(land)) land[r] = [...land[r]].sort((a, b) => luma(a) - luma(b)); changed.push('every ramp sorted shadow to light'); }
        else if (l.law === 'shade-is-colour') { for (const r of Object.keys(land)) { const [a, b] = land[r]; if (luma(a) < 14 || chroma(a) < 6) land[r][0] = a.map((v, k) => Math.round((v + b[k]) / 2 + (k === 2 ? 10 : 0))); } changed.push('the darkest stops lifted toward a cool colour'); }
        else if (l.law === 'sky-brightest') { const s = land.sky; land.sky = s.map((col, i) => (i === s.length - 1 ? col.map((v) => Math.min(255, Math.round(v + (255 - v) * 0.5))) : col)); changed.push('the sky\'s light end lifted'); }
        else if (l.law === 'aerial-perspective') { const g = land.grass[Math.floor(land.grass.length / 2)], sk = land.sky.at(-1), n = land.far.length; land.far = Array.from({ length: n }, (_, i) => { const t = 0.45 + 0.45 * (i / Math.max(1, n - 1)); return g.map((v, k) => Math.round(v + (sk[k] - v) * t)); }); changed.push('the far layers mixed from the ground toward the sky'); }
        else if (l.law === 'pocketing') {
          // what fails says which: the landform's (the fill down, the shade deeper) or the tile's (its window wider)
          const [, sun, tile] = /sun ([\d.]+) .* tile ([\d.]+)/.exec(l.value) ?? [];
          if (+sun < 1.8) { const Lt = c.facets.sky.light; Lt.fill = r3(Lt.fill * 0.82); changed.push(`the sky's fill taken down to ${Lt.fill}: the shade deeper`); }
          if (+tile < 2.5) for (const t of ['dirt', 'scree']) {   // (the trail keeps its paler window)
            const T0 = c.facets.grammar.tiles[t], n = land[T0.ramp].length, lo = Math.min(...T0.lit), hi = Math.max(...T0.lit);
            T0.lit = lo > 0 ? [lo - 1, ...T0.lit] : hi < n - 1 ? [...T0.lit, hi + 1] : T0.lit; T0.shade = [...T0.lit]; changed.push(`the ${t} tile's window a stop wider`);
          }
        }
        else if (['hue-steady', 'chroma-ceiling', 'albedo-band', 'one-family'].includes(l.law)) {
          const b = realBreaks(land), g = groundHue(land), redo = new Set([...b.hue, ...b.sat, ...b.albedo, ...b.family]);
          for (const r of redo) land[r] = realRamp(land[r], g, b.family.includes(r));
          if (redo.size) changed.push(`made real (one hue, muted, low-middle, one family): ${[...redo].join(', ')}`);
        }
        else if (l.law === 'sky-fill') {
          const Lt = c.facets.sky.light, a = [1, 3, 5].map((i) => parseInt(Lt.ambient.slice(i, i + 2), 16)), g = luma(a);
          Lt.ambient = hex(a.map((v) => v + (g - v) * 0.4)); changed.push(`the sky's fill taken toward grey: ${Lt.ambient}`);
        }
        else if (l.law === 'tiles-in-ramp') { for (const t of Object.values(c.facets.grammar.tiles)) { const n = land[t.ramp].length; t.lit = t.lit.map((i) => Math.min(i, n - 1)); t.shade = t.shade.map((i) => Math.min(i, n - 1)); } changed.push('tile windows held inside their ramps'); }
      }
      return { candidate: c, changed: changed.length ? changed : ['no tweak for what fails'] };
    },
    plan: (cand, L) => ({ base: cand.base, card: L.card, swatches: L.swatches }),
  };
}

/** Tunnel a look from words. */
export function tunnelLand(intent, { seed = 1, base = 'isekai-meadow', passes = 6 } = {}) {
  return tunnel(landDomain(), { intent, seed, base, passes });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').filter((w) => !['a', 'an', 'the', 'of', 'and', 'with', 'in', 'but'].includes(w)).slice(0, 3).join('-') || 'look';
/**
 * A look composed from words and registered: its id is `name` (or the intent's first words) and its content's print,
 * so a recipe names the same look every time it is read. → { id, base, read, card, swatches, record }
 */
export function composeLook(intent, { seed = 1, base = 'isekai-meadow', name } = {}) {
  const record = tunnelLand(intent, { seed, base }), P = record.plan;
  const id = `${name ?? slug(intent)}-${fingerprint([P.base, P.card, P.swatches]).slice(0, 6)}`;
  const principles = [`Composed from words: "${intent}".`, ...record.read.traits.map((t) => `${LAND_TRAITS[t.id].read[0].toUpperCase()}${LAND_TRAITS[t.id].read.slice(1)}.`)];
  const look = registerLook({ id, base: P.base, read: intent, card: { ...P.card, principles }, swatches: { ...P.swatches, land: P.swatches.land } });
  return { ...look, record };
}

export { FACETS };
