/**
 * fractal-city — a recursive "anchor manji + quadrant" city density generator.
 *
 * The idea: a scene's mandala can be ANCHORED by a dominant structure (a big tower,
 * a curved elevated freeway). When an anchor exists we determine it FIRST, place it,
 * mark its footprint UNALLOCATABLE, then subdivide the remaining region into 4
 * quadrants and fractally generate each in its own space (each quadrant may itself
 * draw an optional sub-anchor). When there is NO anchor, each quadrant just
 * self-generates by its own scatter rules.
 *
 * Output is a flat list of world boxes + ground planes, fed to scene-css3d's
 * renderBoxCityToHtml — dependency-free, same preserve-3d emitter as rooms/cities.
 *
 * This is the GENERATION side (the "density seed") — it composes the glyph/world
 * primitives spatially; it does not change the architecture glyph registry.
 */

import { assembleBoxCityScene, emitPreserve3dScene } from '../scene/scene-css3d.js';
import { makeLight, scaleHex, FLAT_LIGHT } from '../polygonizer/vexar.js';
import { makeRowhouseFacade } from '../architecture/building-facade.js';
import { straightPath, sinePath, chainPaths, roadRibbons, groundStreet, offsetPath } from './roads.js';
import { vehicleAntFaces, streetcarCorridor } from '../vehicles/vehicles-css3d.js';
import { isLandmarkShape, LANDMARK_HEIGHTS } from '../landmarks/index.js';
import { pedestrianFaces, IDLE_POSES, STROLL_POSES, PALETTES } from '../figures/pedestrian-asset.js';

const CITY_ELEMENT_DEFAULTS = {
  buildings: true,
  parkingLots: true,
  cars: true,
  dumpsters: true,
  alleyways: true,
  roads: true,
  sidewalks: true,
  crosswalks: true,
  streetSignals: true,
  streetSigns: true,
  stopSigns: true,
  streetLamps: true,
  cityTrees: true,
  parkDoodads: true,          // benches / trapezoid bins / playgrounds scattered onto the green pockets
  bikeLanes: true,
  powerLines: true,
  anchorTowers: true,
  elevatedFreeways: true,
  subAnchors: true,
  cyclists: false,            // opt-in: clothed protoform riders populate the OUTER bike lanes (requires bikeLanes); see cyclist-asset.js
  streetcars: false,          // opt-in: a tram line (tracks + wire + stops + trams) down the main street median
  townhouses: false,          // opt-in: attached brownstone / modern-stacked rowhouse rows along block faces
  religiousPlaces: true,      // a CLASS of building (a church): at most one per scene, gated by `locale` (see RELIGIOUS_LOCALE_WEIGHT)
  civicDomes: false,          // opt-in: re-tag a FEW of the largest plain buildings as neoclassical domed rotundas (see seedCivicDomes)
};

// ── religious places (churches) ─────────────────────────────────────────────────
// A church is seeded as ONE-PER-SCENE, gated by the scene's `locale`. This table is the
// tuning HATCH: a per-locale appearance weight in [0,1] (prob. a church is placed at all).
// Listed regions are 1 (deterministic during testing — a church always appears so it can
// be inspected); everything else falls to RELIGIOUS_LOCALE_DEFAULT (0 → none) until we
// decide to dial other regions in. Bump a region here to turn it on later.
const RELIGIOUS_LOCALE_WEIGHT = {
  'north-america': 1,
  'south-america': 1,
  'europe': 1,
  'philippines': 1,
  'eastern-europe': 1,
  'russia': 1,
  'middle-east': 1,
  'africa': 1,
  'southeast-asia': 1,
  'east-asia': 1,
  'himalaya': 1,
  'indochina': 1,
};
const RELIGIOUS_LOCALE_DEFAULT = 0;
// Propensity for the DOMED (Eastern-Orthodox) church variant, given a CHURCH appears —
// rises the further EAST you go: rare in the Americas, moderate in (western) Europe,
// dominant in Russia. The remainder splits between the chapel and basilica variants.
const ORTHODOX_LOCALE_WEIGHT = {
  'north-america': 0.1,
  'south-america': 0.08,
  'philippines': 0.04,
  'europe': 0.3,
  'eastern-europe': 0.65,
  'russia': 0.95,
};
const ORTHODOX_LOCALE_DEFAULT = 0.05;
// Propensity for the religious place to be a MOSQUE rather than a church — low across the
// Christian-majority West, dominant in the Middle East, prominent across Africa and
// Southeast Asia, present-but-secondary to churches in the Philippines. Tunable hatch.
const MOSQUE_LOCALE_WEIGHT = {
  'north-america': 0.08,
  'south-america': 0.03,
  'europe': 0.1,
  'eastern-europe': 0.08,
  'russia': 0.05,
  'philippines': 0.25,
  'middle-east': 0.95,
  'africa': 0.6,
  'southeast-asia': 0.7,
};
const MOSQUE_LOCALE_DEFAULT = 0;
// Regional MOSQUE form, given a mosque appears: the cubic 'ottoman' dome-and-minaret form is
// the default everywhere, with locale-distinctive relatives mixed in — the Persian
// pishtaq+bulbous-dome in the Middle East, the West-African mud 'sahelian' in Africa, and the
// Javanese tiered-roof 'nusantara' across Southeast Asia / the Philippines. A per-locale
// distribution (weights need not sum to 1; the remainder falls to 'ottoman'). Tunable hatch.
const MOSQUE_VARIANT_LOCALE_WEIGHT = {
  'middle-east': { persian: 0.45 },
  'africa': { sahelian: 0.7 },
  'southeast-asia': { nusantara: 0.65 },
  'philippines': { nusantara: 0.4 },
};
const MOSQUE_VARIANT_DEFAULT = 'ottoman';
// Propensity for the religious place to be a BUDDHIST TEMPLE, given it is NOT a mosque (the
// church/mosque/temple choice is decided on one rng draw: mosque first, then temple, else
// church — so a temple eats only into the CHURCH share and never perturbs the mosque ratio).
// Buddhism's spread: dominant across East Asia / the Himalaya / mainland Indochina, a sizable
// minority in maritime Southeast Asia (vs. Islam) and a tiny Chinese-diaspora presence in the
// Philippines — and rarer than even the mosque across the Christian-majority West. Tunable.
const TEMPLE_LOCALE_WEIGHT = {
  'east-asia': 0.82,
  'himalaya': 0.92,
  'indochina': 0.85,
  'southeast-asia': 0.4,
  'philippines': 0.06,
  'russia': 0.06,        // Buryatia / Kalmykia
  'north-america': 0.04,
  'south-america': 0.03,
  'europe': 0.04,
};
const TEMPLE_LOCALE_DEFAULT = 0;
// Regional TEMPLE form, given a temple appears: the East-Asian 'pagoda' tower is the default,
// with the Theravada 'stupa' (bell dome + spire) across Indochina / maritime SE-Asia and the
// Himalayan 'tibetan' monastery across the Himalaya / Buddhist Russia. Remainder → 'pagoda'.
const TEMPLE_VARIANT_LOCALE_WEIGHT = {
  'east-asia': { pagoda: 0.85 },
  'himalaya': { tibetan: 0.78, stupa: 0.18 },
  'indochina': { stupa: 0.82 },
  'southeast-asia': { stupa: 0.6, pagoda: 0.2 },
  'philippines': { pagoda: 0.7 },
  'russia': { tibetan: 0.7 },
};
const TEMPLE_VARIANT_DEFAULT = 'pagoda';
const RELIGIOUS_LOCALE_ALIASES = {
  na: 'north-america', us: 'north-america', usa: 'north-america', canada: 'north-america', mexico: 'north-america',
  sa: 'south-america', latam: 'south-america', brazil: 'south-america',
  eu: 'europe', europa: 'europe', 'western-europe': 'europe',
  netherlands: 'europe', nederland: 'europe', dutch: 'europe', holland: 'europe',
  amsterdam: 'europe', rotterdam: 'europe', utrecht: 'europe', utrecth: 'europe',
  belgium: 'europe', belgian: 'europe', brussels: 'europe', flanders: 'europe', flemish: 'europe',
  ph: 'philippines', filipino: 'philippines', pinas: 'philippines',
  ru: 'russia', russian: 'russia', moscow: 'russia', ussr: 'russia',
  'e-europe': 'eastern-europe', ukraine: 'eastern-europe', greece: 'eastern-europe', greek: 'eastern-europe',
  serbia: 'eastern-europe', romania: 'eastern-europe', bulgaria: 'eastern-europe', balkans: 'eastern-europe',
  'middle-east': 'middle-east', mena: 'middle-east', gulf: 'middle-east', arabia: 'middle-east', turkey: 'middle-east',
  egypt: 'middle-east', iran: 'middle-east', uae: 'middle-east', dubai: 'middle-east',
  africa: 'africa', 'north-africa': 'africa', 'west-africa': 'africa', 'sub-saharan-africa': 'africa', nigeria: 'africa',
  'southeast-asia': 'southeast-asia', sea: 'southeast-asia', indonesia: 'southeast-asia', malaysia: 'southeast-asia', 'asia-pacific': 'southeast-asia',
  'east-asia': 'east-asia', china: 'east-asia', japan: 'east-asia', korea: 'east-asia', taiwan: 'east-asia', vietnam: 'east-asia', cjk: 'east-asia',
  himalaya: 'himalaya', tibet: 'himalaya', nepal: 'himalaya', bhutan: 'himalaya', mongolia: 'himalaya',
  indochina: 'indochina', thailand: 'indochina', myanmar: 'indochina', burma: 'indochina', cambodia: 'indochina', laos: 'indochina', 'sri-lanka': 'indochina',
};
const canonLocale = (locale) => {
  if (!locale || typeof locale !== 'string') return null;
  const key = locale.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return RELIGIOUS_LOCALE_ALIASES[key] || key;
};
const isEuropeanLocale = (locale) => canonLocale(locale) === 'europe';
function religiousWeightForLocale(locale) {
  const canon = canonLocale(locale);
  return canon ? (RELIGIOUS_LOCALE_WEIGHT[canon] ?? RELIGIOUS_LOCALE_DEFAULT) : RELIGIOUS_LOCALE_DEFAULT;
}
function orthodoxWeightForLocale(locale) {
  const canon = canonLocale(locale);
  return canon ? (ORTHODOX_LOCALE_WEIGHT[canon] ?? ORTHODOX_LOCALE_DEFAULT) : ORTHODOX_LOCALE_DEFAULT;
}
function mosqueWeightForLocale(locale) {
  const canon = canonLocale(locale);
  return canon ? (MOSQUE_LOCALE_WEIGHT[canon] ?? MOSQUE_LOCALE_DEFAULT) : MOSQUE_LOCALE_DEFAULT;
}
// Pick the regional mosque FORM from the locale distribution (single rng draw against the
// cumulative weights; the leftover probability mass falls through to 'ottoman').
function mosqueVariantForLocale(locale, rng) {
  const canon = canonLocale(locale);
  const dist = canon ? MOSQUE_VARIANT_LOCALE_WEIGHT[canon] : null;
  if (!dist) return MOSQUE_VARIANT_DEFAULT;
  let r = rng(), acc = 0;
  for (const [variant, w] of Object.entries(dist)) { acc += w; if (r < acc) return variant; }
  return MOSQUE_VARIANT_DEFAULT;
}
function templeWeightForLocale(locale) {
  const canon = canonLocale(locale);
  return canon ? (TEMPLE_LOCALE_WEIGHT[canon] ?? TEMPLE_LOCALE_DEFAULT) : TEMPLE_LOCALE_DEFAULT;
}
// Pick the regional temple FORM (single rng draw against cumulative weights; remainder → 'pagoda').
function templeVariantForLocale(locale, rng) {
  const canon = canonLocale(locale);
  const dist = canon ? TEMPLE_VARIANT_LOCALE_WEIGHT[canon] : null;
  if (!dist) return TEMPLE_VARIANT_DEFAULT;
  let r = rng(), acc = 0;
  for (const [variant, w] of Object.entries(dist)) { acc += w; if (r < acc) return variant; }
  return TEMPLE_VARIANT_DEFAULT;
}

// Re-tag ONE already-placed building box as a church (its footprint is already road-clear,
// so there is no new placement/clearance logic). Mutates in place — box count is unchanged.
// Only consumes `rng` when a church is actually seeded, so locale-less seeds stay identical.
function seedReligiousPlace(boxes, locale, rng) {
  const weight = religiousWeightForLocale(locale);
  if (weight <= 0 || rng() >= weight) return 0;
  // candidates: prefer plain massed buildings (not towers-on-podium etc.) with room for a
  // nave; fall back to any building footprint so a listed locale reliably gets its church.
  const big = (b) => Math.min(b.w, b.d) >= 1.1 && b.w * b.d >= 1.6;
  const buildings = boxes.filter((b) => b.kind === 'building');
  let candidates = buildings.filter((b) => (!b.shape || b.shape === 'box') && big(b));
  if (!candidates.length) candidates = buildings.filter((b) => big(b));
  if (!candidates.length) candidates = buildings.filter((b) => Math.min(b.w, b.d) >= 0.85);
  // last resort (tower-only cities): reuse a SUB-anchor footprint — never the root landmark
  // (glass '#aebfd0') the whole layout is organised around.
  if (!candidates.length) candidates = boxes.filter((b) => b.kind === 'anchor' && b.glass !== '#aebfd0' && big(b));
  if (!candidates.length) return 0;
  const largest = () => candidates.reduce((m, b) => (b.w * b.d > m.w * m.d ? b : m), candidates[0]);
  // RELATIVES of the church, decided on ONE rng draw against cumulative thresholds: MOSQUE
  // first, then TEMPLE, else church. Putting mosque first keeps its locale ratio byte-identical
  // to before temples existed — a temple only eats into the CHURCH share, never the mosque's.
  const mw = mosqueWeightForLocale(locale), tw = templeWeightForLocale(locale), roll = rng();
  // MOSQUE (locale-weighted — dominant in the Middle East, prominent in Africa / SE-Asia,
  // secondary to churches in the Philippines, rare in the West). Largest footprint.
  if (roll < mw) {
    const m = largest();
    const mv = mosqueVariantForLocale(locale, rng);
    m.shape = 'mosque'; m.class = 'religious'; m.structure = 'mosque'; m.mosqueVariant = mv; m.locale = locale;
    const cl = Math.min(m.w, m.d);
    m.z1 = m.z0 + (
      mv === 'persian' ? Math.max(4.5, cl * 2.1) + cl * 0.34 + cl * 0.2          // front minaret + cap + crescent
        : mv === 'sahelian' ? Math.max(4, cl * 1.8) + cl * 0.18 + cl * 0.27       // stepped tower + crescent finial
          : mv === 'nusantara' ? cl * 0.82 + cl * 1.2 * 1.15 + cl * 0.18 + cl * 0.24  // hall + tiered roof + finial + crescent
            : Math.max(4, cl * 1.95) + cl * 0.4 + cl * 0.2);                      // ottoman: minaret + cap + crescent
    return 1;
  }
  // BUDDHIST TEMPLE (locale-weighted — dominant across East Asia / the Himalaya / Indochina, a
  // minority in maritime SE-Asia, and rarer than the mosque in the West). Largest footprint.
  if (roll < mw + tw) {
    const t = largest();
    const tv = templeVariantForLocale(locale, rng);
    t.shape = 'temple'; t.class = 'religious'; t.structure = 'temple'; t.templeVariant = tv; t.locale = locale;
    const cl = Math.min(t.w, t.d);
    t.z1 = t.z0 + (
      tv === 'stupa' ? cl * 0.36 + cl * 0.82 + cl * 0.12 + cl * 0.7 + cl * 0.4        // base + bell + harmika + spire + finial
        : tv === 'tibetan' ? Math.max(2.6, cl * 1.0) + cl * 0.42 + cl * 0.14          // block + gyaltsen banner
          : cl * 0.16 + cl * 1.4 + cl * 0.9 * 0.9);                                   // pagoda: podium + tower stack + sorin
    return 1;
  }
  // CHURCH VARIANT from the same pool, locale-weighted: a domed 'orthodox' (more likely the
  // further east), else a grand twin-tower 'basilica' or the single-steeple 'chapel'.
  // 'orthodox' and 'basilica' take the LARGEST footprint (grander); 'chapel' a random one.
  let variant;
  if (rng() < orthodoxWeightForLocale(locale)) variant = 'orthodox';
  else variant = rng() < 0.5 ? 'basilica' : 'chapel';
  const pick = variant === 'chapel'
    ? candidates[Math.floor(rng() * candidates.length)]
    : candidates.reduce((m, b) => (b.w * b.d > m.w * m.d ? b : m), candidates[0]);
  pick.shape = 'church';
  pick.class = 'religious';
  pick.structure = 'church';
  pick.churchVariant = variant;
  pick.locale = locale;
  const cLen = Math.min(pick.w, pick.d);
  pick.z1 = pick.z0 + (
    variant === 'basilica' ? Math.max(4.2, cLen * 1.5) + Math.max(0.34, cLen * 0.18) + cLen * 0.28    // tower + parapet + pinnacle
      : variant === 'orthodox' ? cLen * 1.05 + cLen * 0.78 + cLen * 1.0 + cLen * 0.42                  // body + drum + dome + finial
        : cLen * 0.95 + cLen * 0.6 + cLen * 0.55 + cLen * 0.62 * 1.7);                                 // eave + roof + tower + spire
  return 1;
}

// ── civic domes (neoclassical rotundas) ──────────────────────────────────────────
// "Match SOME buildings with classical domes": after the city is laid, re-tag a FEW of the
// largest plain `box` buildings as civic domed rotundas (shape:'rotunda', class:'civic'),
// each carrying a `domeForm` (the dome geometry the renderer reuses — hemispheric / onion /
// bulbous). Opt-in via the `civicDomes` element flag (off by default → no rng draw → every
// existing seed byte-identical). Runs LAST among the rng consumers, so religious seeds stay
// byte-identical too. Skips footprints already claimed (church/mosque/temple/landmark).
const CIVIC_DOME_FORMS = ['hemispheric', 'onion', 'bulbous'];
function seedCivicDomes(boxes, rng) {
  const big = (b) => Math.min(b.w, b.d) >= 1.2 && b.w * b.d >= 1.8;
  const candidates = boxes
    .filter((b) => b.kind === 'building' && (!b.shape || b.shape === 'box') && big(b))
    .sort((a, b) => b.w * b.d - a.w * a.d);                       // largest-first → prominent civic buildings
  if (!candidates.length) return 0;
  const count = Math.max(1, Math.min(3, Math.round(candidates.length * 0.08)));   // "some"
  let placed = 0;
  for (let i = 0; i < count && i < candidates.length; i += 1) {
    const pick = candidates[i];
    const form = CIVIC_DOME_FORMS[Math.floor(rng() * CIVIC_DOME_FORMS.length)];
    pick.shape = 'rotunda'; pick.class = 'civic'; pick.structure = 'rotunda'; pick.domeForm = form;
    const fM = Math.min(pick.w, pick.d), rDrum = fM * 0.4;
    const domeH = form === 'onion' ? rDrum * 1.5 : form === 'bulbous' ? rDrum * 1.2 : rDrum * 0.92;
    pick.z1 = pick.z0 + fM * 0.1 + fM * 0.85 + domeH + fM * 0.3;  // stylobate + drum + dome + lantern/finial
    placed += 1;
  }
  return placed;
}

const CITY_ELEMENT_ALIASES = {
  building: 'buildings',
  parking: 'parkingLots',
  lots: 'parkingLots',
  car: 'cars',
  dumpster: 'dumpsters',
  alley: 'alleyways',
  alleys: 'alleyways',
  alleyway: 'alleyways',
  road: 'roads',
  sidewalk: 'sidewalks',
  crosswalk: 'crosswalks',
  signal: 'streetSignals',
  signals: 'streetSignals',
  stoplights: 'streetSignals',
  signs: 'streetSigns',
  stop: 'stopSigns',
  stopSigns: 'stopSigns',
  lamps: 'streetLamps',
  streetlamps: 'streetLamps',
  streetLamps: 'streetLamps',
  trees: 'cityTrees',
  tree: 'cityTrees',
  cityTree: 'cityTrees',
  cityTrees: 'cityTrees',
  park: 'parkDoodads',
  parks: 'parkDoodads',
  playground: 'parkDoodads',
  playgrounds: 'parkDoodads',
  bench: 'parkDoodads',
  benches: 'parkDoodads',
  parkDoodads: 'parkDoodads',
  bikes: 'bikeLanes',
  bike: 'bikeLanes',
  bikeLane: 'bikeLanes',
  bikeLanes: 'bikeLanes',
  cyclist: 'cyclists',
  cyclists: 'cyclists',
  riders: 'cyclists',
  power: 'powerLines',
  wires: 'powerLines',
  tower: 'anchorTowers',
  towers: 'anchorTowers',
  freeway: 'elevatedFreeways',
  freeways: 'elevatedFreeways',
  streetcar: 'streetcars',
  tram: 'streetcars',
  trams: 'streetcars',
  streetcars: 'streetcars',
  townhouse: 'townhouses',
  townhouses: 'townhouses',
  rowhouse: 'townhouses',
  rowhouses: 'townhouses',
  rowhomes: 'townhouses',
  brownstone: 'townhouses',
  dutch: 'townhouses',
  dutchrow: 'townhouses',
  dutchRow: 'townhouses',
  'dutch-row': 'townhouses',
  church: 'religiousPlaces',
  churches: 'religiousPlaces',
  religious: 'religiousPlaces',
  religion: 'religiousPlaces',
  worship: 'religiousPlaces',
  civic: 'civicDomes',
  civicdome: 'civicDomes',
  civicdomes: 'civicDomes',
  rotunda: 'civicDomes',
  rotundas: 'civicDomes',
  domes: 'civicDomes',
  capitol: 'civicDomes',
};

export function normalizeFractalCityElements(elements) {
  if (elements == null) return { ...CITY_ELEMENT_DEFAULTS };
  if (Array.isArray(elements)) {
    const out = Object.fromEntries(Object.keys(CITY_ELEMENT_DEFAULTS).map((key) => [key, false]));
    for (const raw of elements) {
      const key = CITY_ELEMENT_ALIASES[raw] || raw;
      if (key in out) out[key] = true;
    }
    return out;
  }
  if (typeof elements === 'object') {
    const out = { ...CITY_ELEMENT_DEFAULTS };
    for (const [raw, value] of Object.entries(elements)) {
      const key = CITY_ELEMENT_ALIASES[raw] || raw;
      if (key in out) out[key] = value !== false;
    }
    return out;
  }
  return { ...CITY_ELEMENT_DEFAULTS };
}

function elementExplicitlyFalse(elements, target) {
  if (!elements || typeof elements !== 'object' || Array.isArray(elements)) return false;
  return Object.entries(elements).some(([raw, value]) => (CITY_ELEMENT_ALIASES[raw] || raw) === target && value === false);
}

// deterministic RNG so a seed reproduces a city
function mulberry32(a) {
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipRect(r, q) {
  const x0 = Math.max(r.x, q.x), y0 = Math.max(r.y, q.y);
  const x1 = Math.min(r.x + r.w, q.x + q.w), y1 = Math.min(r.y + r.d, q.y + q.d);
  if (x1 <= x0 || y1 <= y0) return null;
  return { ...r, x: x0, y: y0, w: x1 - x0, d: y1 - y0 };   // carry flags (e.g. `hard`) so a reserved strip stays reserved at depth
}
// subdivide a region into 4 UNEQUAL quadrants (random split ratios → non-square
// blocks) with a street gap; the split lines become the cross-streets, so the grid
// still makes sense (just irregular). Returns the quads + the street centerlines.
const rectsOverlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);

// If a cross-street centreline `v` would fall INSIDE any reserved span in `spans` (a landmark
// plaza, or a centred sub-anchor tower), push it outside by `clear` (the road's right-of-way
// half-width, sidewalk included) — to whichever side leaves a usable quad — so the street
// FLANKS the mass with its sidewalk flush against its edge instead of cutting across it (which
// leaves the mass stranded at the intersection). Each span is dodged in turn; a span the line
// can't flank (no room either side) is left to the ribbon/sidewalk clip, which still keeps the
// drawn road off it.
function shiftLineOut(v, lo, hi, spans, clear) {
  for (const [alo, ahi] of spans) {
    if (v <= alo || v >= ahi) continue;                         // already clear of this zone
    const left = alo - clear, right = ahi + clear;              // road centre clears the zone by its full half-RoW
    const leftRoom = left - clear - lo, rightRoom = hi - (right + clear);
    if (leftRoom >= rightRoom && leftRoom > 0.5) v = left;
    else if (rightRoom > 0.5) v = right;
  }
  return v;
}

// `avoids` — array of reserved rects this level's cross-streets must flank around.
function subdivide(region, gap, rng, avoids, clear = gap / 2) {
  const fx = 0.36 + rng() * 0.28, fy = 0.36 + rng() * 0.28;
  let vx = region.x + (region.w - gap) * fx + gap / 2;
  let hy = region.y + (region.d - gap) * fy + gap / 2;
  if (avoids && avoids.length) {
    vx = shiftLineOut(vx, region.x, region.x + region.w, avoids.map((a) => [a.x, a.x + a.w]), clear);
    hy = shiftLineOut(hy, region.y, region.y + region.d, avoids.map((a) => [a.y, a.y + a.d]), clear);
  }
  const wL = Math.max(0, (vx - gap / 2) - region.x), wR = Math.max(0, region.x + region.w - (vx + gap / 2));
  const dB = Math.max(0, (hy - gap / 2) - region.y), dT = Math.max(0, region.y + region.d - (hy + gap / 2));
  const x1 = vx + gap / 2, y1 = hy + gap / 2;
  return {
    quads: [
      { x: region.x, y: region.y, w: wL, d: dB }, { x: x1, y: region.y, w: wR, d: dB },
      { x: region.x, y: y1, w: wL, d: dT }, { x: x1, y: y1, w: wR, d: dT },
    ],
    vx, hy,
  };
}

// ── occupancy grid: the single surface-area budget ──────────────────────────────
// Every claim (anchor, road right-of-way, verge, building, lot, alley, corridor) is
// STAMPED into a coarse raster. A cell can only be claimed once, so the budget LOCKS:
// nothing downstream can place into already-claimed space (kills the "road/furniture/car
// runs through the tower" event collisions), and the still-empty remainder is the tagged
// "leftover" layer (the gore/pocket wedges a clipped — later, curved — network leaves).
const CELL = 0.25;
const CLAIM = { EMPTY: 0, ANCHOR: 1, ROAD: 2, VERGE: 3, BUILDING: 4, LOT: 5, ALLEY: 6, CORRIDOR: 7, PLAZA: 8 };
function makeGrid(region, cell = CELL) {
  const cols = Math.max(1, Math.ceil(region.w / cell));
  const rows = Math.max(1, Math.ceil(region.d / cell));
  return { x0: region.x, y0: region.y, cell, cols, rows, data: new Uint8Array(cols * rows) };
}
function gridCells(g, rect) {
  const c0 = Math.max(0, Math.floor((rect.x - g.x0) / g.cell));
  const c1 = Math.min(g.cols - 1, Math.ceil((rect.x + rect.w - g.x0) / g.cell) - 1);
  const r0 = Math.max(0, Math.floor((rect.y - g.y0) / g.cell));
  const r1 = Math.min(g.rows - 1, Math.ceil((rect.y + rect.d - g.y0) / g.cell) - 1);
  return { c0, c1, r0, r1 };
}
// set every cell of `rect` to `code`, but only where the current cell is in `over`
// (default: only overwrite EMPTY). So a building can't paint over a road, a road can
// claim verge but not the anchor, etc. — the overwrite policy IS the precedence rule.
function stampRect(g, rect, code, over = [CLAIM.EMPTY]) {
  const ok = new Set(over);
  const { c0, c1, r0, r1 } = gridCells(g, rect);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * g.cols + c;
    if (ok.has(g.data[i])) g.data[i] = code;
  }
}
function claimedFrac(g, rect) {
  const { c0, c1, r0, r1 } = gridCells(g, rect);
  let tot = 0, hit = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { tot++; if (g.data[r * g.cols + c]) hit++; }
  return tot ? hit / tot : 1;
}
const isClear = (g, rect, tol = 0.04) => claimedFrac(g, rect) <= tol;
// a parcel is BUILDABLE if it is free of HARD claims — EMPTY and VERGE are fine (a
// building fronts onto the sidewalk verge), but road/anchor/corridor/another building/
// lot/alley are not. The rect is INSET by ~one cell before testing so that merely ABUTTING
// a neighbour (sharing a boundary cell) doesn't read as overlap, while any real
// penetration (> one cell) is rejected outright. `isClear` (truly empty) stays for the
// leftover layer and sub-anchor siting.
const HARD_CLAIM = new Set([CLAIM.ANCHOR, CLAIM.ROAD, CLAIM.BUILDING, CLAIM.LOT, CLAIM.ALLEY, CLAIM.CORRIDOR, CLAIM.PLAZA]);
function isBuildable(g, rect) {
  const ins = g.cell * 1.05;
  const r = { x: rect.x + ins, y: rect.y + ins, w: rect.w - 2 * ins, d: rect.d - 2 * ins };
  if (r.w <= 0 || r.d <= 0) return false;
  const { c0, c1, r0, r1 } = gridCells(g, r);
  for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) if (HARD_CLAIM.has(g.data[rr * g.cols + c])) return false;
  return true;
}
// Largest road-clear (and optionally sidewalk-clear) sub-rect inside `rect`, found by
// eroding whole border cell-lines that touch the right-of-way. This is how a BIG mass
// SPENDS its block budget honestly: instead of fronting the sidewalk like a shop (and
// grazing the curb), a tower's footprint is set BACK behind the road/verge bands the
// recursion already claimed. `alsoVerge` true → clear the sidewalk too (megatower sits
// behind the walk → its block ring stays a plaza); false → road-clear only (a large
// mid-rise may still front the walk, it just can't nose into the carriageway). Returns
// null if nothing survives — the block can't AFFORD a set-back mass of that size.
function clearCore(g, rect, alsoVerge) {
  let { c0, c1, r0, r1 } = gridCells(g, rect);
  const blocked = (v) => HARD_CLAIM.has(v) || (alsoVerge && v === CLAIM.VERGE);
  const colHit = (c) => { for (let r = r0; r <= r1; r++) if (blocked(g.data[r * g.cols + c])) return true; return false; };
  const rowHit = (r) => { for (let c = c0; c <= c1; c++) if (blocked(g.data[r * g.cols + c])) return true; return false; };
  for (let guard = 0; guard < 256 && c0 <= c1 && r0 <= r1; guard++) {
    let trimmed = false;
    if (colHit(c0)) { c0++; trimmed = true; }
    if (c0 <= c1 && colHit(c1)) { c1--; trimmed = true; }
    if (r0 <= r1 && rowHit(r0)) { r0++; trimmed = true; }
    if (r0 <= r1 && rowHit(r1)) { r1--; trimmed = true; }
    if (!trimmed) break;
  }
  if (c1 < c0 || r1 < r0) return null;
  return { x: g.x0 + c0 * g.cell, y: g.y0 + r0 * g.cell, w: (c1 - c0 + 1) * g.cell, d: (r1 - r0 + 1) * g.cell };
}
// every cell of `rect` is exactly `code` — an AREA test (vs the point test cellAt), so a
// thing with extent (a car) can be required to sit ENTIRELY on road/lot, never grazing.
function rectAllClaim(g, rect, code) {
  const { c0, c1, r0, r1 } = gridCells(g, rect);
  if (c1 < c0 || r1 < r0) return false;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (g.data[r * g.cols + c] !== code) return false;
  return true;
}
// like rectAllClaim, but the whole rect must sit on ANY of a set of claims — used to
// keep a pedestrian's footprint entirely on walkable surface (verge / plaza), never
// nosing into a road, building, or lot.
function rectAllIn(g, rect, codes) {
  const { c0, c1, r0, r1 } = gridCells(g, rect);
  if (c1 < c0 || r1 < r0) return false;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!codes.has(g.data[r * g.cols + c])) return false;
  return true;
}
function cellAt(g, x, y) {
  const c = Math.floor((x - g.x0) / g.cell), r = Math.floor((y - g.y0) / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return -1;
  return g.data[r * g.cols + c];
}
// a free-standing prop (lamp/tree/pole/sign) may stand on verge/road/empty/plaza but
// NOT inside a building, the anchor, or the tram corridor — tenancy, by the grid.
const PROP_BLOCKED = new Set([CLAIM.ANCHOR, CLAIM.BUILDING, CLAIM.CORRIDOR, CLAIM.LOT]);
const propClear = (g, x, y) => { const v = cellAt(g, x, y); return v !== -1 && !PROP_BLOCKED.has(v); };

// Trees are pedestrian-zone furniture rooted in the ground: they belong on the
// SIDEWALK/verge, a plaza, or open ground — NEVER on the carriageway (ROAD) or an
// alley. Stricter than propClear (which tolerates roads so e.g. crosswalk markings
// can sit on them); without this a corner tree could land in a neighbouring street.
const TREE_SURFACE = new Set([CLAIM.VERGE, CLAIM.PLAZA, CLAIM.EMPTY]);
const treeClear = (g, x, y) => TREE_SURFACE.has(cellAt(g, x, y));

// connected components of still-EMPTY cells → tagged leftover regions, PLUS per-row tile
// runs that exactly cover the empty cells (so emitted ground never overlaps a claim — an
// L-shaped void's bbox would, its row-runs don't). Tagged (gore/pocket) so a later pass
// fills them (park/plaza/flatiron) — the generator KNOWS what it could not build on.
// Phase-2 curvature can swap row-runs for marching-squares without changing callers.
function leftoverComponents(g) {
  const label = new Int32Array(g.data.length).fill(-1), comps = [], stack = [];
  for (let i0 = 0; i0 < g.data.length; i0++) {
    if (g.data[i0] !== CLAIM.EMPTY || label[i0] >= 0) continue;
    const id = comps.length;
    stack.length = 0; stack.push(i0); label[i0] = id;
    let minc = i0 % g.cols, maxc = minc, minr = (i0 - minc) / g.cols, maxr = minr, n = 0;
    while (stack.length) {
      const i = stack.pop(); n++;
      const c = i % g.cols, r = (i - c) / g.cols;
      if (c < minc) minc = c; if (c > maxc) maxc = c;
      if (r < minr) minr = r; if (r > maxr) maxr = r;
      const nb = [];
      if (c > 0) nb.push(i - 1); if (c < g.cols - 1) nb.push(i + 1);
      if (r > 0) nb.push(i - g.cols); if (r < g.rows - 1) nb.push(i + g.cols);
      for (const j of nb) if (label[j] < 0 && g.data[j] === CLAIM.EMPTY) { label[j] = id; stack.push(j); }
    }
    const w = (maxc - minc + 1) * g.cell, d = (maxr - minr + 1) * g.cell;
    const area = n * g.cell * g.cell, fill = w * d ? area / (w * d) : 0;
    const ar = Math.max(w, d) / Math.max(1e-3, Math.min(w, d));
    comps.push({ x: g.x0 + minc * g.cell, y: g.y0 + minr * g.cell, w, d, cells: n, area, fill, tag: (fill < 0.55 || ar > 3.2) ? 'gore' : 'pocket' });
  }
  // tiles: greedy horizontal runs of same-component empty cells (exact cover, no overlap)
  const tiles = [];
  for (let r = 0; r < g.rows; r++) {
    let c = 0;
    while (c < g.cols) {
      const i = r * g.cols + c;
      if (g.data[i] !== CLAIM.EMPTY) { c++; continue; }
      const id = label[i]; let c2 = c + 1;
      while (c2 < g.cols && g.data[r * g.cols + c2] === CLAIM.EMPTY && label[r * g.cols + c2] === id) c2++;
      tiles.push({ x: g.x0 + c * g.cell, y: g.y0 + r * g.cell, w: (c2 - c) * g.cell, d: g.cell, tag: comps[id].tag });
      c = c2;
    }
  }
  return { components: comps, tiles };
}

// ── anchors ───────────────────────────────────────────────────────────────────
function towerAnchor(region, rng, big) {
  const cx = region.x + region.w / 2, cy = region.y + region.d / 2;
  const aw = region.w * (big ? 0.34 : 0.26), ad = region.d * (big ? 0.34 : 0.26);
  const box = {
    x: cx - aw / 2, y: cy - ad / 2, w: aw, d: ad, z0: 0,
    z1: (big ? 10 : 5.5) + rng() * (big ? 5 : 3),
    kind: 'anchor', glass: big ? '#aebfd0' : '#9bb0a4',
  };
  return { boxes: [box], footprint: { x: box.x - 0.7, y: box.y - 0.7, w: box.w + 1.4, d: box.d + 1.4 } };
}

// Coerce the recipe's `landmark` field (a single shape, an array of shapes, or null) into
// a clean list of KNOWN landmark shapes — the cluster the city is organised around.
function normalizeLandmarks(landmark) {
  const arr = Array.isArray(landmark) ? landmark : (landmark == null ? [] : [landmark]);
  return arr.filter((s) => isLandmarkShape(s));
}

// Footprint side as a fraction of the region's MIN dimension, plus the ground-plan aspect
// (along-axis : across-axis). Towers (cn-tower / skytree) sit on a small square base; the
// Taj spreads on a wide plinth; the stadium is a broad oval. This is the landmark's REAL
// "surface-area budget" — what gets reserved on the grid so roads route around it.
const LANDMARK_FOOTPRINT = {
  taj: { frac: 0.34, aspect: 1.0 },
  'cn-tower': { frac: 0.20, aspect: 1.0 },
  skytree: { frac: 0.20, aspect: 1.0 },
  'rogers-centre': { frac: 0.30, aspect: 1.35 },
  skydome: { frac: 0.30, aspect: 1.35 },
  colosseum: { frac: 0.32, aspect: 1.2 },     // elliptical amphitheatre (real Colosseum ≈ 1.2:1)
  arena: { frac: 0.28, aspect: 1.12 },        // modern domed venue, near-round
  'great-pyramid': { frac: 0.34, aspect: 1.0 }, // square base, broad low landmark
  'louvre-pyramid': { frac: 0.30, aspect: 1.0 }, // square glass pyramid, slightly smaller plaza footprint
  'mexican-pyramid': { frac: 0.34, aspect: 1.0 }, // stepped ceremonial pyramid, broad square plinth
  'petronas-towers': { frac: 0.35, aspect: 1.45 }, // twin towers + Y-base/skybridge need a wide plaza
  'big-ben': { frac: 0.22, aspect: 1.0 }, // slender square clock tower with a small Westminster plaza
  stonehenge: { frac: 0.34, aspect: 1.25 }, // broad megalith ring with offset heel stone
  'chinatown-gate': { frac: 0.18, aspect: 1.35 }, // compact paifang gateway, smaller than full monument anchors
  'arc-de-triomphe': { frac: 0.24, aspect: 1.0 }, // monumental arch: compact square plaza footprint
  parthenon: { frac: 0.34, aspect: 2.2 }, // long Doric temple: elongated rectangular stylobate (≈ 2.25:1)
  'griffith-observatory': { frac: 0.34, aspect: 2.3 }, // long Art Deco observatory: three-dome wing, wide plaza
  'washington-monument': { frac: 0.16, aspect: 1.0 }, // slender obelisk: small square base, generous open plaza
  'parliament-hill': { frac: 0.26, aspect: 2.6 }, // long Gothic Centre Block with a central tower
  'mobile-edm-hall': { frac: 0.3, aspect: 1.05 }, // tank-tread base plus protruding fork/cockpit silhouette
  'eiffel-tower': { frac: 0.30, aspect: 1.0 }, // broad four-legged square base (real 125 m span) under a tall lattice pylon
  eiffel: { frac: 0.30, aspect: 1.0 },
  'tokyo-tower': { frac: 0.26, aspect: 1.0 }, // narrower square base (real ≈88 m span) under a taller, slenderer lattice pylon
  tokyo: { frac: 0.26, aspect: 1.0 },
  'empire-state-building': { frac: 0.26, aspect: 1.3 }, // rectangular Art Deco tower lot (real ≈129×86 m base)
  'empire-state': { frac: 0.26, aspect: 1.3 },
  empire: { frac: 0.26, aspect: 1.3 },
  'gateway-arch': { frac: 0.36, aspect: 2.2 }, // wide arch plane (span) but a thin out-of-plane footprint
  gateway: { frac: 0.36, aspect: 2.2 },
  'cloud-gate': { frac: 0.32, aspect: 1.55 }, // broad low mirror blob, elongated bean plan (real ≈20×13 m)
  'chicago-bean': { frac: 0.32, aspect: 1.55 },
  bean: { frac: 0.32, aspect: 1.55 },
  'statue-of-liberty': { frac: 0.24, aspect: 1.0 }, // square pedestal/island base under a tall robed figure
  liberty: { frac: 0.24, aspect: 1.0 },
  'rizal-monument': { frac: 0.28, aspect: 1.1 }, // hexagonal granite base + centred obelisk, bronze figure in the front gap
  rizal: { frac: 0.28, aspect: 1.1 },
};

// A LANDMARK anchor: one or more named monuments laid out as an adjacent CLUSTER, centred
// in the region, each sized to its real ground footprint. Returns the landmark boxes + the
// combined bounding footprint (with margin) so the caller can stamp it CLAIM.ANCHOR *before*
// roads — the road glyph then routes around the reserved budget exactly like a tower anchor.
// The cluster is capped to ~58% of the region's anchor axis (the "zoom out far enough so it
// fits" rule): if the monuments wouldn't fit with road room, the whole cluster scales down.
// Deterministic (no rng) so landmark presence never perturbs the seed stream.
// `sizeRegion` is the BUDGET basis: when a corridor pushes placement into a side band,
// pass the full city region here so the monuments keep their real surface-area budget
// (displacing blocks) instead of being re-budgeted off the shallow band.
function landmarkAnchor(region, landmarks, big = true, sizeRegion = region) {
  const minDim = Math.min(sizeRegion.w, sizeRegion.d);
  const horizontal = region.w >= region.d;             // lay the cluster along the longer axis
  const gap = minDim * 0.05;
  let items = landmarks.map((shape) => {
    const spec = LANDMARK_FOOTPRINT[shape] || { frac: 0.24, aspect: 1 };
    const base = minDim * spec.frac;
    return { shape, w: horizontal ? base * spec.aspect : base, d: horizontal ? base : base * spec.aspect };
  });
  const alongOf = (it) => (horizontal ? it.w : it.d);
  const acrossOf = (it) => (horizontal ? it.d : it.w);
  const along = items.reduce((s, it) => s + alongOf(it), 0) + gap * (items.length - 1);
  const budget = (horizontal ? region.w : region.d) * 0.58;        // leave room for the road network
  let scale = along > budget ? budget / along : 1;
  // ACROSS-AXIS FIT — the same zoom-out rule for the placement band's short axis: the
  // footprint (plaza ring included) must sit INSIDE the band so it never crosses a
  // reserved boulevard. Iterative because the ring margin has a floor (1.8) below
  // which shrinking the cluster stops shrinking the ring.
  const acrossDim = horizontal ? region.d : region.w;
  for (let i = 0; i < 4; i++) {
    const acrossMax = Math.max(...items.map(acrossOf)) * scale;
    const m2 = Math.max(1.8, Math.min(along * scale, acrossMax) * 0.25);
    const need = acrossMax + 2 * m2;
    if (need <= acrossDim) break;
    scale *= acrossDim / need;
  }
  if (scale < 1) items = items.map((it) => ({ ...it, w: it.w * scale, d: it.d * scale }));
  const g = gap * scale;
  const totalAlong = items.reduce((s, it) => s + alongOf(it), 0) + g * (items.length - 1);
  const cx = region.x + region.w / 2, cy = region.y + region.d / 2;
  let cursor = (horizontal ? cx : cy) - totalAlong / 2;
  const boxes = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) {
    const x = horizontal ? cursor : cx - it.w / 2;
    const y = horizontal ? cy - it.d / 2 : cursor;
    boxes.push({
      x, y, w: it.w, d: it.d, z0: 0,
      z1: Math.min(it.w, it.d) * (LANDMARK_HEIGHTS[it.shape] ?? 1),   // bbox-height hint; render computes its own geometry
      kind: 'anchor', glass: big ? '#aebfd0' : '#9bb0a4',
      shape: it.shape, class: 'landmark', structure: it.shape, landmark: it.shape,
    });
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + it.w); maxY = Math.max(maxY, y + it.d);
    cursor += alongOf(it) + g;
  }
  // PLAZA ring around the monuments — a real civic buffer (the road network routes around
  // this whole zone, not just the bases). Scaled off the SMALLER cluster extent so a wide
  // cluster doesn't inflate the short axis into the whole region.
  const m = Math.max(1.8, Math.min(maxX - minX, maxY - minY) * 0.25);
  return { boxes, footprint: { x: minX - m, y: minY - m, w: (maxX - minX) + 2 * m, d: (maxY - minY) + 2 * m } };
}

// ── civic areas (reserved districts) ──────────────────────────────────────────────
// Landmark-like zones that take real surface area and get the SAME up-front reservation a
// monument gets: the footprint is stamped on the grid + pushed to seedReserved BEFORE roads,
// so streets / sidewalks / power / trees route (and clip) around them — the machinery proven
// for the landmark this session. Unlike a monument these need NO bespoke render: each builder
// composes EXISTING city primitives (buildings, parking lots, playgrounds, furniture), which
// assembleBoxCityScene already draws (grounds by `fill`, props by `tint`).
// `frac` = footprint side as a fraction of the region MIN dim; `aspect` = along:across.
const CIVIC_FOOTPRINT = {
  'town-square': { frac: 0.20, aspect: 1.0 },   // squarish open paved plaza
  school: { frac: 0.26, aspect: 1.3 },          // schoolhouse + a yard need room
  'strip-mall': { frac: 0.28, aspect: 1.5 },    // a long retail strip fronting a parking apron
  'city-park': { frac: 0.30, aspect: 1.2 },     // the largest district — open green space wants room to read
};
const CIVIC_AREA_ALIASES = {
  'town-square': 'town-square', townsquare: 'town-square', square: 'town-square', plaza: 'town-square',
  school: 'school', campus: 'school', schoolyard: 'school',
  'strip-mall': 'strip-mall', stripmall: 'strip-mall', retail: 'strip-mall', mall: 'strip-mall', 'plaza-mall': 'strip-mall',
  'city-park': 'city-park', park: 'city-park', greenspace: 'city-park', 'green-space': 'city-park', commons: 'city-park', gardens: 'city-park',
};
// Coerce the recipe's `civicAreas` field (a single name, an array, or junk) into a clean
// list of KNOWN canonical kinds (aliases resolved). Order is preserved → placement order.
export function normalizeCivicAreas(input) {
  const arr = Array.isArray(input) ? input : (input == null ? [] : [input]);
  return arr.map((s) => (typeof s === 'string' ? CIVIC_AREA_ALIASES[s] : null)).filter(Boolean);
}
// stamp a sub-rect of a civic footprint HARD, overwriting the blanket PLAZA reservation — so
// the final car pass sees LOT (not PLAZA) under a lot, and no tree sprouts on a civic building.
const civicStamp = (grid, rect, claim) => stampRect(grid, rect, claim, [CLAIM.EMPTY, CLAIM.VERGE, CLAIM.PLAZA]);

// A paved civic square: a small tree cluster, perimeter benches facing in, corner lamps.
function buildTownSquare(fp, rng, boxes, grounds, faces, opts, grid, cars) {
  const cx = fp.x + fp.w / 2, cy = fp.y + fp.d / 2;
  grounds.push({ kind: 'town-square-paving', civic: 'town-square', x: fp.x + 0.3, y: fp.y + 0.3, w: fp.w - 0.6, d: fp.d - 0.6, z: 0.025, fill: '#bdbcae' });
  for (const [dx, dy] of [[-0.5, -0.4], [0.55, -0.3], [0, 0.55]]) cityTree(boxes, cx + dx, cy + dy, rng, opts.climate);
  const ix = fp.x + 0.7, iy = fp.y + 0.7, ax = fp.x + fp.w - 0.7, ay = fp.y + fp.d - 0.7;
  parkBench(boxes, cx, iy, 'x', rng); parkBench(boxes, cx, ay, 'x', rng);
  parkBench(boxes, ix, cy, 'y', rng); parkBench(boxes, ax, cy, 'y', rng);
  for (const [x, y] of [[ix, iy], [ax, iy], [ix, ay], [ax, ay]]) streetLamp(boxes, x, y);
  if (rng() < 0.85) garbageCan(boxes, cx + 0.9, cy - 0.9, rng);
}

// A school campus: a schoolhouse on a building band + an open green yard with a playground.
function buildSchool(fp, rng, boxes, grounds, faces, opts, grid, cars) {
  const horizontal = fp.w >= fp.d, split = 0.45;     // ~45% building band, ~55% yard
  const bz = horizontal ? { x: fp.x, y: fp.y, w: fp.w * split, d: fp.d } : { x: fp.x, y: fp.y, w: fp.w, d: fp.d * split };
  const yard = horizontal ? { x: fp.x + fp.w * split, y: fp.y, w: fp.w * (1 - split), d: fp.d } : { x: fp.x, y: fp.y + fp.d * split, w: fp.w, d: fp.d * (1 - split) };
  const bld = { x: bz.x + 0.4, y: bz.y + 0.4, w: bz.w - 0.8, d: bz.d - 0.8 };
  if (bld.w > 0.9 && bld.d > 0.9) { placeBuilding(boxes, bld, 'large', rng, grid); civicStamp(grid, bld, CLAIM.BUILDING); boxes[boxes.length - 1].civic = 'school'; }
  grounds.push({ kind: 'school-yard', civic: 'school', x: yard.x + 0.3, y: yard.y + 0.3, w: yard.w - 0.6, d: yard.d - 0.6, z: 0.024, fill: '#3c5a3a' });
  const yx = yard.x + yard.w / 2, yy = yard.y + yard.d / 2;
  const pad = Math.min(yard.w - 0.8, yard.d - 0.8, 3.0);
  if (pad > 1.6) {
    grounds.push({ kind: 'playground-pad', x: yx - pad / 2, y: yy - pad / 2, w: pad, d: pad, z: 0.028, fill: '#c2b083' });
    const along = yard.w >= yard.d ? 'x' : 'y', cross = along === 'x' ? 'y' : 'x';   // two combo pieces side-by-side, turned across (mirrors scatterParkDoodads)
    const combo = PLAY_COMBOS[Math.min(PLAY_COMBOS.length - 1, Math.floor(rng() * PLAY_COMBOS.length))];
    combo.forEach((name, i) => {
      const off = i === 0 ? -0.72 : 0.72;
      PLAY_PIECE[name](boxes, faces, grounds, cross, along === 'x' ? yx + off : yx, along === 'x' ? yy : yy + off, rng);
    });
  }
  parkBench(boxes, yard.x + 0.7, yard.y + 0.7, yard.w >= yard.d ? 'x' : 'y', rng);
  cityTree(boxes, yard.x + yard.w - 0.7, yard.y + 0.7, rng, opts.climate);
  cityTree(boxes, yard.x + 0.7, yard.y + yard.d - 0.7, rng, opts.climate);
}

// A strip mall: one long shallow retail building fronting a parking apron with cars + lamps.
function buildStripMall(fp, rng, boxes, grounds, faces, opts, grid, cars) {
  const horizontal = fp.w >= fp.d, split = 0.35;     // back ~35% building strip, front ~65% apron
  const strip = horizontal ? { x: fp.x, y: fp.y, w: fp.w, d: fp.d * split } : { x: fp.x, y: fp.y, w: fp.w * split, d: fp.d };
  const apron = horizontal ? { x: fp.x, y: fp.y + fp.d * split, w: fp.w, d: fp.d * (1 - split) } : { x: fp.x + fp.w * split, y: fp.y, w: fp.w * (1 - split), d: fp.d };
  const bld = { x: strip.x + 0.35, y: strip.y + 0.35, w: strip.w - 0.7, d: strip.d - 0.7 };
  if (bld.w > 0.9 && bld.d > 0.6) { placeBuilding(boxes, bld, 'medium', rng, grid); civicStamp(grid, bld, CLAIM.BUILDING); boxes[boxes.length - 1].civic = 'strip-mall'; }
  const lot = { x: apron.x + 0.3, y: apron.y + 0.3, w: apron.w - 0.6, d: apron.d - 0.6 };
  if (lot.w > 1 && lot.d > 1) {
    civicStamp(grid, lot, CLAIM.LOT);                // pre-claim LOT over PLAZA so the deferred-car pass (rectAllClaim LOT) keeps the apron's cars
    grounds.push({ kind: 'strip-mall-apron', civic: 'strip-mall', x: lot.x, y: lot.y, w: lot.w, d: lot.d, z: 0.022, fill: '#43474d' });
    addParkingLot(grounds, lot, rng, opts.elements, grid, cars);
    streetLamp(boxes, lot.x + 0.5, lot.y + lot.d - 0.5);
    streetLamp(boxes, lot.x + lot.w - 0.5, lot.y + lot.d - 0.5);
  }
}

// Recursively scatter greenery over a rect: at each level EITHER drop a clump here OR
// subdivide into four jittered cells and recurse — so groves cluster at several scales (the
// park is "fractal in its own space"). Plants are point furniture gated by `treeClear`, so
// they skip the pond / community-centre / trail cells carved before this runs.
function scatterGreenery(rect, depth, rng, boxes, grid, density, climate = 'temperate') {
  if (rect.w < 1.1 || rect.d < 1.1) return;
  if (depth <= 0 || rng() < 0.34) {                      // terminal → a clump filling this cell
    const n = Math.max(1, Math.min(9, Math.round(rect.w * rect.d * density)));
    for (let i = 0; i < n; i++) {
      const x = rect.x + 0.3 + rng() * Math.max(0.01, rect.w - 0.6);
      const y = rect.y + 0.3 + rng() * Math.max(0.01, rect.d - 0.6);
      if (!treeClear(grid, x, y)) continue;              // pond (LOT) / building / trail (ALLEY) → skip
      if (rng() < 0.5) cityShrub(boxes, x, y, rng);      // half groundcover shrubs, half trees (cityTree picks conifers itself)
      else cityTree(boxes, x, y, rng, climate);
    }
    return;
  }
  const fx = 0.4 + rng() * 0.2, fy = 0.4 + rng() * 0.2;
  const vx = rect.x + rect.w * fx, hy = rect.y + rect.d * fy;
  for (const q of [
    { x: rect.x, y: rect.y, w: vx - rect.x, d: hy - rect.y }, { x: vx, y: rect.y, w: rect.x + rect.w - vx, d: hy - rect.y },
    { x: rect.x, y: hy, w: vx - rect.x, d: rect.y + rect.d - hy }, { x: vx, y: hy, w: rect.x + rect.w - vx, d: rect.y + rect.d - hy },
  ]) scatterGreenery(q, depth - 1, rng, boxes, grid, density, climate);
}

// A CITY PARK: an open green space, greenery-first, that VARIES per seed — a pond, looping
// trails, and a medium community-centre building each appear probabilistically. Whatever is
// carved (pond=LOT, building=BUILDING, trail=ALLEY) is a non-plantable claim, so the fractal
// greenery scatter routes around it. Deterministic; renders entirely from existing primitives.
function buildCityPark(fp, rng, boxes, grounds, faces, opts, grid, cars) {
  grounds.push({ kind: 'park-lawn', civic: 'city-park', x: fp.x, y: fp.y, w: fp.w, d: fp.d, z: 0.018, fill: '#3a5a36' });
  // POND (~60%): an off-centre water body with a sandy shore ring; LOT-claimed so no plant
  // roots in it. The water rect is DEFERRED (drawn after the trails) so a trail meeting the
  // pond reads as ending at the shore rather than paving across the water.
  let pondDraw = null;
  if (rng() < 0.6) {
    const pw = fp.w * (0.3 + rng() * 0.16), pd = fp.d * (0.3 + rng() * 0.16);
    const px = fp.x + (0.12 + rng() * 0.4) * (fp.w - pw), py = fp.y + (0.12 + rng() * 0.4) * (fp.d - pd);
    const shore = { x: px - 0.4, y: py - 0.4, w: pw + 0.8, d: pd + 0.8 };
    civicStamp(grid, shore, CLAIM.LOT);                  // shore + water are non-plantable (LOT over the park's PLAZA)
    grounds.push({ kind: 'park-shore', civic: 'city-park', x: shore.x, y: shore.y, w: shore.w, d: shore.d, z: 0.02, fill: '#7c7558' });
    pondDraw = { kind: 'park-pond', civic: 'city-park', water: true, x: px, y: py, w: pw, d: pd, z: 0.026, fill: '#33697a' };
  }
  // COMMUNITY CENTRE (~50%): a medium civic building tucked at one edge of the park.
  if (rng() < 0.5) {
    const cw = fp.w * 0.3, cd = fp.d * 0.3;
    const edge = Math.floor(rng() * 4);                  // 0..3 → one of the four corners
    const cx = edge % 2 ? fp.x + fp.w - cw - 0.5 : fp.x + 0.5;
    const cy = edge < 2 ? fp.y + 0.5 : fp.y + fp.d - cd - 0.5;
    const bld = { x: cx, y: cy, w: cw, d: cd };
    if (bld.w > 1 && bld.d > 1) { placeBuilding(boxes, bld, 'medium', rng, grid); civicStamp(grid, bld, CLAIM.BUILDING); boxes[boxes.length - 1].civic = 'city-park'; }
  }
  // TRAILS (~65%): a gravel spine across the long axis + one perpendicular branch; ALLEY-claimed
  // (hard, no cars, non-plantable) so the greenery beads along them instead of overgrowing them.
  if (rng() < 0.65) {
    const tw = 0.55, horizontal = fp.w >= fp.d;
    const spineFixed = (horizontal ? fp.y : fp.x) + (horizontal ? fp.d : fp.w) * (0.35 + rng() * 0.3);
    const spine = horizontal
      ? { x: fp.x + 0.4, y: spineFixed - tw / 2, w: fp.w - 0.8, d: tw }
      : { x: spineFixed - tw / 2, y: fp.y + 0.4, w: tw, d: fp.d - 0.8 };
    const branchAt = (horizontal ? fp.x : fp.y) + (horizontal ? fp.w : fp.d) * (0.3 + rng() * 0.4);
    const branch = horizontal
      ? { x: branchAt - tw / 2, y: fp.y + 0.4, w: tw, d: fp.d - 0.8 }
      : { x: fp.x + 0.4, y: branchAt - tw / 2, w: fp.w - 0.8, d: tw };
    for (const t of [spine, branch]) {
      civicStamp(grid, t, CLAIM.ALLEY);
      grounds.push({ kind: 'park-trail', civic: 'city-park', x: t.x, y: t.y, w: t.w, d: t.d, z: 0.022, fill: '#9a8f6e' });
    }
  }
  if (pondDraw) grounds.push(pondDraw);                  // water on top → trails meet the shore, not the water
  // FRACTAL GREENERY over the whole footprint — plants land only on the green (PLAZA) cells,
  // skipping every carved non-plantable claim above. Dense so the park stays greenery-first
  // even when a pond + centre + trails have taken their bites. A lamp or two for night reads.
  scatterGreenery(fp, 4, rng, boxes, grid, 0.75, opts.climate);
  streetLamp(boxes, fp.x + 0.7, fp.y + 0.7);
  streetLamp(boxes, fp.x + fp.w - 0.7, fp.y + fp.d - 0.7);
}

const CIVIC_BUILDERS = { 'town-square': buildTownSquare, school: buildSchool, 'strip-mall': buildStripMall, 'city-park': buildCityPark };

// Place each requested civic area into a DISTINCT slice of the region, reserved up front so
// roads route around it. Candidate centres are a 3×3 lattice ordered FAR-from-centre first
// (districts gravitate to edges/corners, leaving the middle to the landmark / anchor tower),
// with an rng jitter on the ordering. A district that can't fit clear of the corridor /
// landmark / earlier districts is SKIPPED. Returns the count actually placed.
function placeCivicAreas(region, kinds, grid, rng, boxes, grounds, faces, opts, cars, seedReserved) {
  const minDim = Math.min(region.w, region.d), horizontal = region.w >= region.d, margin = 0.6;
  const cx0 = region.x + region.w / 2, cy0 = region.y + region.d / 2;
  const cands = [];
  for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
    const x = region.x + region.w * fx, y = region.y + region.d * fy;
    cands.push({ x, y, key: -Math.hypot(x - cx0, y - cy0) + rng() * 0.6 });
  }
  cands.sort((a, b) => a.key - b.key);
  let placed = 0;
  for (const kind of kinds) {
    const spec = CIVIC_FOOTPRINT[kind]; if (!spec) continue;
    const base = minDim * spec.frac;
    const w = Math.min(horizontal ? base * spec.aspect : base, region.w * 0.4);
    const d = Math.min(horizontal ? base : base * spec.aspect, region.d * 0.4);
    let fp = null;
    for (const c of cands) {
      const x = Math.max(region.x + margin, Math.min(c.x - w / 2, region.x + region.w - margin - w));
      const y = Math.max(region.y + margin, Math.min(c.y - d / 2, region.y + region.d - margin - d));
      const cand = { x, y, w, d };
      if (w > 1.2 && d > 1.2 && isClear(grid, cand, 0.04)) { fp = cand; break; }
    }
    if (!fp) continue;
    stampRect(grid, fp, CLAIM.PLAZA);                                  // blanket reservation: nothing from the recursion builds inside
    seedReserved.push({ ...fp, hard: true });                          // roads / sidewalks / power clip around it
    grounds.push({ kind: 'civic-area', civic: kind, x: fp.x, y: fp.y, w: fp.w, d: fp.d, z: 0.015, fill: '#8f9189' });   // full-footprint base under the builder's primitives (also the district's reserved extent)
    CIVIC_BUILDERS[kind](fp, rng, boxes, grounds, faces, opts, grid, cars);
    placed++;
  }
  return placed;
}

// an elevated freeway anchor, drawn through the road primitive as a MIX of segments:
// straight on-ramp → smooth sine sweep → straight off-ramp. Reserves the swath it covers.
function freewayAnchor(region, rng) {
  const cy = region.y + region.d * 0.5, amp = region.d * 0.22;
  const xa = region.x, xb = region.x + region.w;
  const x1 = region.x + region.w * 0.18, x2 = region.x + region.w * 0.82;
  const path = chainPaths(
    straightPath([xa, cy], [x1, cy], 3),
    sinePath([x1, cy], [x2, cy], { amplitude: amp, waves: 1.6, n: 26 }),
    straightPath([x2, cy], [xb, cy], 3),
  );
  const width = 2.6, lift = 2.6, deck = 0.4, deckTop = lift + deck;
  const road = roadRibbons({ path, width, lift, deck, laneLine: true, pillarEvery: 4 });
  const boxes = [...road.boxes], ribbons = [...road.ribbons];
  // guardrails: a low wall hugging each deck edge, following the sweep as a thin ribbon
  for (const off of [-(width / 2 - 0.1), width / 2 - 0.1]) {
    ribbons.push({ path: offsetPath(path, off), z0: deckTop, z1: deckTop + 0.34, width: 0.12, tint: '#8b9097' });
  }
  // median lamps: poles spaced down the centreline, each a dark post + a warm head
  for (let i = 5; i < path.length - 2; i += 6) {
    const [x, y] = path[i];
    boxes.push({ kind: 'freeway-lamp', x: x - 0.07, y: y - 0.07, w: 0.14, d: 0.14, z0: deckTop, z1: deckTop + 1.5, tint: '#3a3d42' });
    boxes.push({ kind: 'freeway-lamp', x: x - 0.16, y: y - 0.16, w: 0.32, d: 0.32, z0: deckTop + 1.4, z1: deckTop + 1.56, tint: '#f2d18a' });
  }
  return { boxes, ribbons, footprint: { x: region.x, y: cy - amp - 1.5, w: region.w, d: 2 * amp + 3 } };
}

// ── fill (the fractal "rest") ───────────────────────────────────────────────────
// a parking lot is now a DELIBERATE parcel (like a building): it claims its own cells
// (LOT) so nothing else lands on it, and it never spawns as a leak-fill over the anchor.
// Asphalt pad + stripes; cars are deferred as INTENTS (emitted in a final grid-checked
// pass) so a car can never end up parked under a tower decided later in the recursion.
function addParkingLot(grounds, c, rng, elements, grid, cars) {
  if (!elements.parkingLots) return;
  stampRect(grid, c, CLAIM.LOT, [CLAIM.EMPTY, CLAIM.VERGE]);
  grounds.push({ kind: 'lot-asphalt', x: c.x, y: c.y, w: c.w, d: c.d, z: 0.03, fill: '#43474d' });
  for (let i = 1; i < 4; i++) { const sx = c.x + c.w * (i / 4); grounds.push({ kind: 'lot-stripe', x: sx - 0.03, y: c.y + 0.15, w: 0.06, d: c.d - 0.3, z: 0.05, fill: '#c6c0ad' }); }
  if (elements.cars) {
    const s = Math.max(0.45, Math.min(0.82, c.d * 0.26));           // fit the car to the stall depth
    const cols = Math.max(1, Math.min(2, Math.floor(c.w / (0.84 * s + 0.3))));   // lots stay sparse — traffic lives on the road
    for (let k = 0; k < cols; k++) {
      if (rng() < 0.7) continue;                                     // only ~30% of stalls occupied
      const dir = rng() < 0.5 ? 1 : -1;                             // sample a lot-context vehicle (weighted)
      cars.push({ context: 'lot', cx: c.x + (c.w / cols) * (k + 0.5), cy: c.y + c.d * 0.5, axis: 'y', dir, scale: s });
    }
  }
}

// draw a straight street a→b, but CLIP it out of every reserved footprint, so a
// road never runs under a building/anchor. The run is split into surviving spans.
function pushStreet(ribbons, a, b, opt, reserved) {
  const vert = Math.abs(a[0] - b[0]) < Math.abs(a[1] - b[1]);
  const hw = opt.width / 2, fixed = vert ? a[0] : a[1];
  let spans = [[vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]), vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0])]];
  for (const r of reserved) {
    const cLo = vert ? r.x : r.y, cHi = vert ? r.x + r.w : r.y + r.d;          // reserved extent across the street
    if (cHi <= fixed - hw || cLo >= fixed + hw) continue;                       // doesn't block this street
    const bLo = vert ? r.y : r.x, bHi = vert ? r.y + r.d : r.x + r.w;           // reserved extent along the street
    spans = spans.flatMap(([s, e]) => (bHi <= s || bLo >= e) ? [[s, e]] : [[s, Math.min(e, bLo)], [Math.max(s, bHi), e]]);
  }
  for (const [s, e] of spans) if (e - s > 0.6) ribbons.push(...groundStreet(vert ? [fixed, s] : [s, fixed], vert ? [fixed, e] : [e, fixed], opt).ribbons);
}

// Surviving along-axis spans of a sidewalk band (centre `fixed`, half-width `hw`, running
// lo→hi along the `vert ? y : x` axis) after subtracting every reserved footprint it crosses
// — the walk twin of pushStreet's clip, so a sidewalk band never paves across a reserved
// plaza/anchor when shiftLineOut couldn't flank the street out of it. With no blocking
// footprint this returns the full [lo,hi] span unchanged, so ordinary blocks are untouched.
function bandSpans(lo, hi, fixed, hw, vert, reserved) {
  let spans = [[lo, hi]];
  for (const r of reserved) {
    const cLo = vert ? r.x : r.y, cHi = vert ? r.x + r.w : r.y + r.d;            // reserved extent across the band
    if (cHi <= fixed - hw || cLo >= fixed + hw) continue;                        // doesn't block this band
    const bLo = vert ? r.y : r.x, bHi = vert ? r.y + r.d : r.x + r.w;            // reserved extent along the band
    spans = spans.flatMap(([s, e]) => (bHi <= s || bLo >= e) ? [[s, e]] : [[s, Math.min(e, bLo)], [Math.max(s, bHi), e]]);
  }
  return spans.filter(([s, e]) => e - s > 0.6);
}

// place car ants in the LANES of a coherent (major) street pair — offset to a
// right-hand lane, oriented along travel, spaced out, skipping the junction box
// and any reserved footprint. `context:'street'` → mix can include buses/box-trucks.
function placeStreetCars(cars, vx, hy, region, streetW, rng, bikeLanes) {
  // ants are RAILED to the centre of one of the two driving lanes with OPPOSING
  // travel per lane. The rail is fixed regardless of vehicle size (each ant is
  // centred on it, so a bus and a car share the line). When the road carries edge
  // bike lanes the driving lane is narrower, so the rail moves inboard.
  // Each ant is pushed as an INTENT; the final grid-checked pass drops any whose lane
  // cell is not actually ROAD (clipped by the anchor, or a sub-anchor decided later) —
  // so cars never drive through a tower regardless of recursion order.
  const laneOff = streetW * (bikeLanes ? 0.18 : 0.25), scale = 0.9, step = 3.4, keep = 0.72;
  for (const [lx, dir] of [[vx + laneOff, 1], [vx - laneOff, -1]])           // vertical street: two opposing lanes along y
    for (let y = region.y + 2.2; y < region.y + region.d - 1.8; y += step) {
      if (Math.abs(y - hy) < streetW * 1.1 || rng() > keep) continue;
      cars.push({ context: 'street', cx: lx, cy: y, axis: 'y', dir, scale });
    }
  for (const [ly, dir] of [[hy - laneOff, 1], [hy + laneOff, -1]])           // horizontal street: two opposing lanes along x
    for (let x = region.x + 2.2; x < region.x + region.w - 1.8; x += step) {
      if (Math.abs(x - vx) < streetW * 1.1 || rng() > keep) continue;
      cars.push({ context: 'street', cx: x, cy: ly, axis: 'x', dir, scale });
    }
}

// CYCLISTS in the OUTER bike lane of a major street pair. Mirrors placeStreetCars but
// rails to the bike-lane strip (outboard of the inboard car rail at 0.18, inboard of
// the curb at 0.5) and is sparser. Uses a POSITION-SEEDED local rng so enabling
// cyclists is purely additive — the main rng stream (cars, buildings) is untouched, so
// the same seed's city is unchanged and cyclists merely populate its existing bike lanes.
function placeBikeLaneCyclists(cars, vx, hy, region, streetW) {
  const seed = ((Math.floor(vx * 1000) * 73856093) ^ (Math.floor(hy * 1000) * 19349663)) >>> 0;
  const rng = mulberry32(seed || 1);
  const bikeOff = streetW * 0.40, scale = 0.9, step = 5.0, keep = 0.5;
  for (const [lx, dir] of [[vx + bikeOff, 1], [vx - bikeOff, -1]])           // vertical street: outer lane each side, with travel
    for (let y = region.y + 2.6; y < region.y + region.d - 2.0; y += step) {
      if (Math.abs(y - hy) < streetW * 1.2 || rng() > keep) continue;
      cars.push({ context: 'bike', cx: lx, cy: y, axis: 'y', dir, scale });
    }
  for (const [ly, dir] of [[hy - bikeOff, 1], [hy + bikeOff, -1]])           // horizontal street
    for (let x = region.x + 2.6; x < region.x + region.w - 2.0; x += step) {
      if (Math.abs(x - vx) < streetW * 1.2 || rng() > keep) continue;
      cars.push({ context: 'bike', cx: x, cy: ly, axis: 'x', dir, scale });
    }
}

// PEDESTRIAN GROUPS — scatter solo / duo / family clusters onto the city's walkable
// surface (verge sidewalks + plazas). Runs AFTER the grid is final (post-recurse), so it
// reads a settled surface map and emits straight into faces[] — no deferral needed (the
// grid won't change under it). Seeded from the city seed via a fresh local rng and run
// last, so it's purely ADDITIVE: the main rng stream is untouched and every existing seed
// reproduces byte-identically with people off. See human-seeder.plan.md / pedestrian-asset.js.
const PED_SURFACE = new Set([CLAIM.VERGE, CLAIM.PLAZA]);
const GROUP_WEIGHTS = { solo: 0.5, duo: 0.3, family: 0.2 };

function placePedestrianGroups(region, grid, people, faces, seed) {
  const opts = (people && typeof people === 'object') ? people : {};
  const density = Math.max(0, Math.min(1, Number.isFinite(opts.density) ? opts.density : 0.5));
  const kinds = Array.isArray(opts.groups) && opts.groups.length ? opts.groups : ['solo', 'duo', 'family'];
  const weights = kinds.map((k) => GROUP_WEIGHTS[k] ?? 0.1);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const rng = mulberry32(((seed >>> 0) ^ 0x9e3779b1) >>> 0);
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const pickKind = () => { let r = rng() * wsum; for (let i = 0; i < kinds.length; i++) { r -= weights[i]; if (r <= 0) return kinds[i]; } return kinds[kinds.length - 1]; };

  const STEP = 0.6;     // candidate spacing along the surface scan (units)
  const footR = 0.06;   // half-footprint for the grid-check — just the FEET; the body may
                        // overhang a curb (sidewalks are ~1 cell wide), like a real person.
  const MIN_GAP = 0.6;  // keep group centres apart so plazas don't clump
  const taken = [];
  const onWalk = (x, y) => rectAllIn(grid, { x: x - footR, y: y - footR, w: footR * 2, d: footR * 2 }, PED_SURFACE);
  const side = (ax, ay, ct, st, d) => [ax - st * d, ay + ct * d];   // group-local lateral offset
  const emit = (x, y, heading, archetype, poseList, scale) => {
    if (!onWalk(x, y)) return false;
    faces.push(...pedestrianFaces({
      cx: x, cy: y,
      heading: heading + (rng() - 0.5) * 0.5,
      scale: scale * (0.94 + rng() * 0.12),
      archetype, pose: pick(poseList), palette: pick(PALETTES),
    }));
    return true;
  };

  for (let y = region.y + 0.4; y < region.y + region.d - 0.4; y += STEP)
    for (let x = region.x + 0.4; x < region.x + region.w - 0.4; x += STEP) {
      const ax = x + (rng() - 0.5) * STEP * 0.6, ay = y + (rng() - 0.5) * STEP * 0.6;   // jitter off the lattice
      if (!onWalk(ax, ay) || rng() > density) continue;
      if (taken.some(([tx, ty]) => Math.hypot(tx - ax, ty - ay) < MIN_GAP)) continue;
      taken.push([ax, ay]);
      const kind = pickKind();
      const th = rng() * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const adultPose = rng() < 0.5 ? IDLE_POSES : STROLL_POSES;
      if (kind === 'solo') {
        emit(ax, ay, th, rng() < 0.5 ? 'adultM' : 'adultF', adultPose, 1);
      } else if (kind === 'duo') {
        const [lx, ly] = side(ax, ay, ct, st, -0.32), [rx, ry] = side(ax, ay, ct, st, 0.32);
        emit(lx, ly, th + 0.26, 'adultM', adultPose, 1);
        emit(rx, ry, th - 0.26, 'adultF', adultPose, 1);
      } else {   // family — paired or single parent, + 1-2 kids
        if (rng() < 0.3) {
          const [px, py] = side(ax, ay, ct, st, -0.16), [kx, ky] = side(ax, ay, ct, st, 0.16);
          emit(px, py, th + 0.15, rng() < 0.5 ? 'adultM' : 'adultF', IDLE_POSES, 1);
          emit(kx, ky, th - 0.15, 'child', STROLL_POSES, 0.92);
          if (rng() < 0.4) { const [kx2, ky2] = side(ax, ay, ct, st, 0.34); emit(kx2, ky2, th, 'child', IDLE_POSES, 0.92); }
        } else {
          const [lx, ly] = side(ax, ay, ct, st, -0.36), [rx, ry] = side(ax, ay, ct, st, 0.36);
          emit(lx, ly, th + 0.18, 'adultM', IDLE_POSES, 1);
          emit(rx, ry, th - 0.18, 'adultF', IDLE_POSES, 1);
          const kids = 1 + (rng() < 0.5 ? 1 : 0);
          for (let i = 0; i < kids; i++) {
            const off = kids === 1 ? 0 : (i === 0 ? -0.14 : 0.14);
            const [kx, ky] = side(ax, ay, ct, st, off);
            emit(kx, ky, th + (rng() - 0.5) * 0.5, 'child', STROLL_POSES, 0.92);
          }
        }
      }
    }
}

// A STREETCAR CORRIDOR is the canonical way to depict a streetcar in a generated
// city: the symmetric road | bay | track+tram | bay | road cross-section
// (streetcarCorridor), run as a BOULEVARD straight down the region's longer axis with
// the track UNINTERRUPTED end-to-end. The whole corridor is reserved as a `hard`
// footprint so blocks (and the anchor) route around it instead of crossing it.
function cityStreetcarCorridor(region, rng) {
  const horizontal = region.w >= region.d, axis = horizontal ? 'x' : 'y';
  const fixed = horizontal ? region.y + region.d / 2 : region.x + region.w / 2;
  const lo = (horizontal ? region.x : region.y) + 0.5;
  const hi = (horizontal ? region.x + region.w : region.y + region.d) - 0.5;
  return streetcarCorridor({ axis, fixed, lo, hi, roadWidth: 2.0, bayWidth: 0.7, sep: 0.04, tracks: 2, trackSep: 1.0, tramScale: 0.85, wireZ: 1.5, stopAt: [0.26, 0.6], carScale: 0.85, rng });
}

// the larger of the two side-bands left when the corridor strip is removed from the
// region — where the root anchor goes so the boulevard stays clear.
function sideRegionAvoiding(region, fp, axis) {
  if (axis === 'x') {
    const below = { x: region.x, y: region.y, w: region.w, d: fp.y - region.y };
    const above = { x: region.x, y: fp.y + fp.d, w: region.w, d: region.y + region.d - (fp.y + fp.d) };
    return below.d >= above.d ? below : above;
  }
  const left = { x: region.x, y: region.y, w: fp.x - region.x, d: region.d };
  const right = { x: fp.x + fp.w, y: region.y, w: region.x + region.w - (fp.x + fp.w), d: region.d };
  return left.w >= right.w ? left : right;
}

function splitRect(rect, axis, frac, gapW) {
  if (axis === 'x') { const a = (rect.w - gapW) * frac; return [{ x: rect.x, y: rect.y, w: a, d: rect.d }, { x: rect.x + a + gapW, y: rect.y, w: rect.w - a - gapW, d: rect.d }]; }
  const a = (rect.d - gapW) * frac; return [{ x: rect.x, y: rect.y, w: rect.w, d: a }, { x: rect.x, y: rect.y + a + gapW, w: rect.w, d: rect.d - a - gapW }];
}
function bld(rect, size) { return { rect, kind: 'building', size }; }

// ── town profile dwellings ──────────────────────────────────────────────────────
// Residential walls + a real pitched roof (roof.js, scaled to town size by the scene
// assembler's `roof` box-tag dispatch). Detached HOUSE for small/medium lots, a small
// walk-up APARTMENT for large square-ish lots — all capped at ~1–3 storeys. No towers /
// condos / podiums / setbacks: that height + shape ceiling is what reads as a town.
// residential wall palette, grouped by CLADDING MATERIAL so each tint pairs with a sensible
// World texture (brick reds → brick; painted colours → clapboard; warm neutrals/clay → stucco).
// The tint is the CSS-3D flat read AND the colour the World multiply-lights the (neutral) texel by.
const TOWN_WALL_SETS = {
  brick:     ['#b46a4a', '#a85f48', '#9c6450', '#b07a5e', '#8f5a48', '#bd8f86', '#c39a8e'],
  clapboard: ['#e6e0d0', '#b6c2a6', '#a8b794', '#aab7bd', '#9fb0b8', '#e1d6a4', '#d8c98f', '#ece6d6', '#c8b9d0'],
  stucco:    ['#cabfa8', '#dfd6c2', '#d8cdb8', '#c7b9a0', '#cfc7ba', '#c4977e', '#cda98e', '#c2b39c', '#bdbdb6'],
};
const TOWN_WALL_MATERIALS = ['clapboard', 'clapboard', 'clapboard', 'stucco', 'stucco', 'brick'];   // siding most common
const SHUTTER_TINTS = ['#2e3a2c', '#26323f', '#3a2420', '#41463f', '#5b4636', '#8a8f86', '#b7b1a3'];   // green / navy / oxblood / charcoal / wood / grey / cream
function pickTownCladding(rng) {
  const material = TOWN_WALL_MATERIALS[Math.floor(rng() * TOWN_WALL_MATERIALS.length)];
  const set = TOWN_WALL_SETS[material];
  return { wallTex: material, tint: set[Math.floor(rng() * set.length)], shutter: SHUTTER_TINTS[Math.floor(rng() * SHUTTER_TINTS.length)] };
}
const TOWN_ROOFS_PITCHED = ['bungalow', 'mission', 'farmhouse', 'colonial', 'pavilion', 'manor'];
const TOWN_ROOFS_FLAT = ['tofu-deck', 'tofu-stacked'];
const TOWN_APARTMENT_PITCHED = ['mission', 'manor', 'bungalow'];
// pick a roof, deliberately MIXING flat (tofu) blocks with pitched forms across both dwelling
// types — apartments lean ~half flat, detached houses get an occasional flat/modern variation.
function pickTownRoof(apartment, rng) {
  if (apartment) return rng() < 0.5 ? TOWN_ROOFS_FLAT[Math.floor(rng() * TOWN_ROOFS_FLAT.length)] : TOWN_APARTMENT_PITCHED[Math.floor(rng() * TOWN_APARTMENT_PITCHED.length)];
  if (rng() < 0.16) return rng() < 0.5 ? 'tofu-deck' : 'modern-shed';   // occasional flat/modern house among the pitched
  return TOWN_ROOFS_PITCHED[Math.floor(rng() * TOWN_ROOFS_PITCHED.length)];
}
const STOREY_H = 0.82;                                                          // one residential storey, town scale
function placeTownDwelling(boxes, rect, size, rng, minDim, front, cladding) {
  const apartment = size === 'large' && minDim >= 1.3 && rng() < 0.55;          // a corner walk-up, occasionally
  let storeys, h;
  if (apartment) { storeys = 2 + (rng() < 0.5 ? 1 : 0); h = storeys * STOREY_H + 0.5 + rng() * 0.3; }   // 2–3 storey walk-up
  else {
    storeys = rng() < (size === 'small' ? 0.3 : 0.6) ? 2 : 1;                   // mostly 1-storey on small lots; a real 1↔2 mix elsewhere
    h = storeys * STOREY_H + 0.16 + rng() * 0.24;                              // jitter → varied silhouettes
  }
  const roof = pickTownRoof(apartment, rng);
  const { wallTex, tint, shutter } = cladding || pickTownCladding(rng);
  boxes.push({ ...rect, z0: 0, z1: h, kind: 'house', shape: apartment ? 'low-apartment' : 'house', roof, tint, wallTex, shutter, front, storeys });
}

// ── town parcels: property line → fence → set-back house + yard (+ optional driveway) ──
// A town lot is NOT filled by its building the way a city parcel is. The lot edge is the
// PROPERTY LINE (fenced); the house sits SET BACK inside it, leaving a front yard toward the
// street, side yards, and a smaller back yard. Driveways are optional. Bounded yards are what
// turn a massed block into a residential street.
// fence styles, weighted: picket & hedge most common, then low-wall / stone / chain-link.
const FENCE_STYLES = ['picket', 'picket', 'picket', 'hedge', 'hedge', 'low-wall', 'stone', 'chain-link'];
// FORMALIZED fence heights, as a fraction of one house STOREY (STOREY_H), so every fence reads at
// a believable scale against the houses: a picket ≈ a third of a storey (waist/chest-high vs a
// door), a privacy hedge taller, a low/stone wall lower. Tuned once here, not scattered literals.
const FENCE_HEIGHTS = { picket: 0.34, hedge: 0.50, 'low-wall': 0.28, stone: 0.36, 'chain-link': 0.33 };
const fenceHeight = (style, rng) => STOREY_H * (FENCE_HEIGHTS[style] || 0.34) * (0.94 + rng() * 0.12);   // ±6% jitter

// a fence run between two axis-aligned points, one of several styles. Kept CHEAP (≤ ~4 boxes/run)
// — a town has hundreds of property lines, so per-leaf plants here would blow the face budget.
// `fence` = { style, h } chosen once per lot so a lot's whole perimeter reads at one height.
function fenceRun(boxes, x0, y0, x1, y1, rng, fence = {}) {
  const style = fence.style || 'picket', h = fence.h || fenceHeight(style, rng);
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 0.16) return;
  const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  const rail = (th, z1, tint) => horiz
    ? boxes.push({ x: Math.min(x0, x1), y: (y0 + y1) / 2 - th / 2, w: Math.abs(x1 - x0), d: th, z0: 0, z1, kind: 'fence', tint })
    : boxes.push({ x: (x0 + x1) / 2 - th / 2, y: Math.min(y0, y1), w: th, d: Math.abs(y1 - y0), z0: 0, z1, kind: 'fence', tint });
  const posts = (every, ps, z1, tint) => { const n = Math.max(1, Math.round(len / every)); for (let i = 0; i <= n; i++) { const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t; boxes.push({ x: cx - ps / 2, y: cy - ps / 2, w: ps, d: ps, z0: 0, z1, kind: 'fence', tint }); } };
  if (style === 'hedge') { rail(0.16, h, '#5f7a45'); return; }                             // clipped hedge, full height
  if (style === 'chain-link') { rail(0.02, h * 0.92, '#a4a9af'); posts(0.9, 0.05, h, '#7c8187'); return; }
  if (style === 'low-wall' || style === 'stone') { rail(style === 'stone' ? 0.09 : 0.07, h, style === 'stone' ? '#9c958a' : '#b9b2a4'); return; }
  rail(0.045, h * 0.82, '#d4cebf');                                                         // picket: rail just below the post caps
  posts(0.8, 0.07, h, '#c4bdac');
}

// one property-line edge with an optional [t0,t1] gap (a gate / driveway curb-cut); the gap is
// flanked by two gate posts a touch taller than the fence run.
function fenceEdge(boxes, x0, y0, x1, y1, rng, fence, gap) {
  const run = (a, b, c, d) => fenceRun(boxes, a, b, c, d, rng, fence);
  if (!gap) { run(x0, y0, x1, y1); return; }
  const [t0, t1] = gap, px = (t) => x0 + (x1 - x0) * t, py = (t) => y0 + (y1 - y0) * t;
  if (t0 > 0.03) run(x0, y0, px(t0), py(t0));
  if (t1 < 0.97) run(px(t1), py(t1), x1, y1);
  for (const t of [t0, t1]) boxes.push({ x: px(t) - 0.05, y: py(t) - 0.05, w: 0.1, d: 0.1, z0: 0, z1: fence.h * 1.12, kind: 'fence', tint: '#b6ac98' });
}

// fence the four property-line edges; the front edge carries a gate (or driveway) gap. Style +
// a height (formalized to the house scale) are chosen once per lot so its perimeter reads as one fence.
function placeLotFence(boxes, lot, front, gap, rng) {
  const style = FENCE_STYLES[Math.floor(rng() * FENCE_STYLES.length)];
  const fence = { style, h: fenceHeight(style, rng) };
  const x0 = lot.x, y0 = lot.y, x1 = lot.x + lot.w, y1 = lot.y + lot.d;
  const g = (side) => (side === front ? (gap || [0.42, 0.58]) : null);
  fenceEdge(boxes, x0, y0, x1, y0, rng, fence, g('y-'));
  fenceEdge(boxes, x0, y1, x1, y1, rng, fence, g('y+'));
  fenceEdge(boxes, x0, y0, x0, y1, rng, fence, g('x-'));
  fenceEdge(boxes, x1, y0, x1, y1, rng, fence, g('x+'));
}

// lay out one residential lot: lawn + set-back roofed house + property-line fence, with an
// optional driveway leading to a GARAGE, and (on spacious lots) yard shrubbery + a tree.
// `front` ∈ {y-,y+,x-,x+} is the street-facing edge; everything sets back from it. Placement is
// done in an oriented frame: R(fo, fd, co, cw) = a rect `fo` in from the front edge, depth `fd`,
// `co` along the cross axis (from its min), width `cw` — so one body serves all four fronts.
function placeTownParcel(boxes, grounds, parcel, size, rng, opts = {}) {
  const inset = 0.05;
  const lot = { x: parcel.x + inset, y: parcel.y + inset, w: parcel.w - 2 * inset, d: parcel.d - 2 * inset };
  if (lot.w < 0.8 || lot.d < 0.8) { placeTownDwelling(boxes, parcel, size, rng, Math.min(parcel.w, parcel.d), opts.front); return; }
  grounds.push({ kind: 'front-lawn', x: lot.x, y: lot.y, w: lot.w, d: lot.d, z: 0.012, fill: '#6f8a4e' });
  const front = opts.front || (lot.w >= lot.d ? 'y-' : 'x-');
  const vertical = front === 'y-' || front === 'y+';
  const crossLen = vertical ? lot.w : lot.d, depthLen = vertical ? lot.d : lot.w;
  const spacious = !!opts.spacious;
  const fy = (spacious ? 0.40 : 0.32) + rng() * 0.10, by = 0.13 + rng() * 0.06, sy = (spacious ? 0.20 : 0.15) + rng() * 0.06;
  const R = (fo, fd, co, cw) => front === 'y-' ? { x: lot.x + co, y: lot.y + fo, w: cw, d: fd }
    : front === 'y+' ? { x: lot.x + co, y: lot.y + lot.d - fo - fd, w: cw, d: fd }
      : front === 'x-' ? { x: lot.x + fo, y: lot.y + co, w: fd, d: cw }
        : { x: lot.x + lot.w - fo - fd, y: lot.y + co, w: fd, d: cw };
  const P = (fo, co) => front === 'y-' ? [lot.x + co, lot.y + fo] : front === 'y+' ? [lot.x + co, lot.y + lot.d - fo]
    : front === 'x-' ? [lot.x + fo, lot.y + co] : [lot.x + lot.w - fo, lot.y + co];
  const bStart = sy * crossLen, Wb = crossLen * (1 - 2 * sy);        // buildable cross band
  const houseFo = fy * depthLen, houseFd = depthLen * (1 - fy - by);
  const cladding = pickTownCladding(rng);
  const driveSide = rng() < 0.5 ? 0 : 1;
  // GARAGE (attached): a strip on the driveway side, fronting the street beside the house.
  const gw = Math.min(0.95, crossLen * 0.36);
  let garage = false, houseCo = bStart, houseCw = Wb;
  if ((opts.driveway ?? false) && size !== 'large' && Wb - gw - 0.08 > 0.7 && rng() < 0.6) {
    garage = true;
    if (driveSide === 0) { houseCo = bStart + gw + 0.08; houseCw = Wb - gw - 0.08; }
    else houseCw = Wb - gw - 0.08;
  }
  placeTownDwelling(boxes, R(houseFo, houseFd, houseCo, houseCw), size, rng, Math.min(houseCw, houseFd), front, cladding);
  let gap = null;
  const garageCo = driveSide === 0 ? bStart : bStart + Wb - gw;
  if (garage) {
    const gd = Math.min(gw * 1.05, houseFd * 0.85), gh = 0.86 + rng() * 0.12;
    const groof = ['modern-shed', 'bungalow', 'tofu-deck'][Math.floor(rng() * 3)];
    boxes.push({ ...R(houseFo, gd, garageCo, gw), z0: 0, z1: gh, kind: 'garage', roof: groof, tint: cladding.tint, wallTex: cladding.wallTex, front, storeys: 1 });
    const dwW = Math.min(gw * 0.82, 0.7), dwCo = garageCo + (gw - dwW) / 2, dr = R(0, houseFo + 0.05, dwCo, dwW);
    grounds.push({ kind: 'driveway', x: dr.x, y: dr.y, w: dr.w, d: dr.d, z: 0.02, fill: '#5b5f64' });
    gap = [dwCo / crossLen, (dwCo + dwW) / crossLen];
  } else if ((opts.driveway ?? false) && size !== 'large') {        // plain driveway, no garage
    const dwW = Math.min(0.55, Wb * 0.4), dwCo = driveSide === 0 ? bStart : bStart + Wb - dwW, dr = R(0, houseFo, dwCo, dwW);
    grounds.push({ kind: 'driveway', x: dr.x, y: dr.y, w: dr.w, d: dr.d, z: 0.02, fill: '#5b5f64' });
    gap = [dwCo / crossLen, (dwCo + dwW) / crossLen];
  }
  // SHRUBBERY: spacious lots are mostly SHRUBS with an occasional front-yard tree (trees kept
  // sparse so the street doesn't read as a forest); plain lots rarely get one shrub.
  if (spacious) {
    if (rng() < 0.4) { const t = P(fy * depthLen * (0.4 + rng() * 0.3), rng() < 0.5 ? bStart * 0.6 : crossLen - bStart * 0.6); cityTree(boxes, t[0], t[1], rng, opts.climate || 'temperate'); }
    for (let i = 0, ns = 3 + (rng() < 0.5 ? 1 : 0); i < ns; i++) { const p = P(0.06 + rng() * fy * depthLen * 0.7, bStart + rng() * Wb); cityShrub(boxes, p[0], p[1], rng); }
  } else if (rng() < 0.3) { const p = P(0.06 + rng() * fy * depthLen * 0.6, bStart + rng() * Wb); cityShrub(boxes, p[0], p[1], rng); }
  placeLotFence(boxes, lot, front, gap, rng);
}

// a town PARK block: lawn + a fenced playground (one curated PLAY_COMBO on a pad) + scattered
// trees / shrubs + a bench and bin. Reuses the city park primitives. Returns false (→ caller
// fills it with houses) if the block is too small or already claimed.
function fillTownPark(block, rng, boxes, grounds, faces, opts, grid) {
  if (block.w < 2.2 || block.d < 2.2 || !isBuildable(grid, block)) return false;
  stampRect(grid, block, CLAIM.PLAZA, [CLAIM.EMPTY, CLAIM.VERGE]);   // claim so leftover/cars/tree-scatter skip the park
  grounds.push({ kind: 'park-lawn', x: block.x, y: block.y, w: block.w, d: block.d, z: 0.014, fill: '#5f7e42' });
  const climate = opts.climate || 'temperate';
  const px = block.x + block.w * (0.4 + rng() * 0.2), py = block.y + block.d * (0.4 + rng() * 0.2);
  const pad = Math.min(block.w - 0.7, block.d - 0.7, 1.7);          // playground pad + a 2-piece combo
  grounds.push({ kind: 'playground-pad', x: px - pad / 2, y: py - pad / 2, w: pad, d: pad, z: 0.028, fill: '#c2b083' });
  const along = rng() < 0.5 ? 'x' : 'y', cross = along === 'x' ? 'y' : 'x';
  PLAY_COMBOS[Math.floor(rng() * PLAY_COMBOS.length)].forEach((name, i) => {
    const off = i === 0 ? -0.5 : 0.5, cx = along === 'x' ? px + off : px, cy = along === 'x' ? py : py + off;
    PLAY_PIECE[name](boxes, faces, grounds, cross, cx, cy, rng);
  });
  for (let i = 0, nT = 2 + Math.floor(rng() * 3); i < nT; i++) {     // edge trees (kept off the pad)
    const tx = block.x + 0.4 + rng() * (block.w - 0.8), ty = block.y + 0.4 + rng() * (block.d - 0.8);
    if (Math.hypot(tx - px, ty - py) > pad * 0.75) cityTree(boxes, tx, ty, rng, climate);
  }
  for (let i = 0; i < 4; i++) cityShrub(boxes, block.x + 0.3 + rng() * (block.w - 0.6), block.y + 0.3 + rng() * (block.d - 0.6), rng);
  parkBench(boxes, block.x + block.w * 0.3, block.y + 0.45, 'x', rng);
  garbageCan(boxes, block.x + 0.5, block.y + 0.5, rng);
  placeLotFence(boxes, { x: block.x + 0.06, y: block.y + 0.06, w: block.w - 0.12, d: block.d - 0.12 }, block.w >= block.d ? 'y-' : 'x-', null, rng);
  return true;
}

// town block fill: ~14% of blocks are POCKET PARKS (playground + greenery); the rest are two
// back-to-back rows of lots, each facing the street on its side (a suburban double-loaded block;
// one row on a shallow block). ~30% of housing blocks are SPACIOUS — fewer, wider lots with
// deeper yards, more driveways/garages, and yard planting. Each lot is a placeTownParcel.
function fillTownBlock(block, rng, boxes, grounds, faces, opts, grid) {
  if (opts.elements.parkDoodads && rng() < 0.14 && fillTownPark(block, rng, boxes, grounds, faces, opts, grid)) return;
  const TOWN_SIZES = ['small', 'small', 'medium', 'medium', 'large'];
  const pick = () => TOWN_SIZES[Math.floor(rng() * TOWN_SIZES.length)];
  const spacious = rng() < 0.3, lotW = spacious ? 3.4 : 2.4;
  const lay = (parcel, front) => {
    if (parcel.w < 1.0 || parcel.d < 1.0) return;
    if (!isBuildable(grid, parcel)) return;
    stampRect(grid, parcel, CLAIM.BUILDING, [CLAIM.EMPTY, CLAIM.VERGE]);   // claim the whole lot so the leftover/tree pass skips the yard
    if (rng() < 0.12) {                                              // occasional vacant GREEN lot — lawn + shrubs (+ a tree)
      const yard = { x: parcel.x + 0.05, y: parcel.y + 0.05, w: parcel.w - 0.1, d: parcel.d - 0.1 };
      grounds.push({ kind: 'front-lawn', x: yard.x, y: yard.y, w: yard.w, d: yard.d, z: 0.012, fill: '#6f8a4e' });
      for (let i = 0, ns = 2 + Math.floor(rng() * 3); i < ns; i++) cityShrub(boxes, yard.x + 0.2 + rng() * (yard.w - 0.4), yard.y + 0.2 + rng() * (yard.d - 0.4), rng);
      if (rng() < 0.5) cityTree(boxes, yard.x + yard.w * 0.5, yard.y + yard.d * 0.5, rng, opts.climate);
      placeLotFence(boxes, yard, front, null, rng);
      return;
    }
    placeTownParcel(boxes, grounds, parcel, pick(), rng, { front, driveway: rng() < (spacious ? 0.62 : 0.45), spacious, climate: opts.climate });
  };
  if (block.w >= block.d) {
    const twoRow = block.d >= 2.4, rowD = twoRow ? block.d / 2 : block.d;
    const rows = twoRow ? [[0, 'y-'], [1, 'y+']] : [[0, 'y-']];
    const n = Math.max(1, Math.round(block.w / lotW)), pw = block.w / n;
    for (const [ri, front] of rows) for (let i = 0; i < n; i++) lay({ x: block.x + i * pw, y: block.y + ri * rowD, w: pw, d: rowD }, front);
  } else {
    const twoRow = block.w >= 2.4, rowW = twoRow ? block.w / 2 : block.w;
    const cols = twoRow ? [[0, 'x-'], [1, 'x+']] : [[0, 'x-']];
    const n = Math.max(1, Math.round(block.d / lotW)), pd = block.d / n;
    for (const [ci, front] of cols) for (let i = 0; i < n; i++) lay({ x: block.x + ci * rowW, y: block.y + i * pd, w: rowW, d: pd }, front);
  }
}

function placeBuilding(boxes, rect, size, rng, grid, opts = {}) {
  if (rect.w < 0.85 || rect.d < 0.85) return;
  stampRect(grid, rect, CLAIM.BUILDING, [CLAIM.EMPTY, CLAIM.VERGE]);
  const minDim = Math.min(rect.w, rect.d);
  if (opts.profile === 'town') { placeTownDwelling(boxes, rect, size, rng, minDim); return; }
  // CONDO: a slab-block apartment TOWER (partitioned-balcony loggia). Seeded deliberately on
  // tall, square-ish lots so it reads taller than the lot's size class would otherwise give,
  // and as a plain box so the loggia can wrap/spiral around every face (large ones do).
  const condo = size !== 'small' && minDim >= 1.3 && rng() < 0.34;
  const hr = condo ? [6.5, 12] : size === 'large' ? [5, 10] : size === 'medium' ? [3, 5.5] : [1.5, 3];
  const h = hr[0] + rng() * (hr[1] - hr[0]);
  const ratio = Math.max(rect.w, rect.d) / minDim;
  const elongated = ratio > 1.6 && minDim > 1.1;                       // a long block → mixed-use complex
  let shape = 'box';
  if (condo) shape = 'box';                                            // flat faces for the wrap-around loggia
  else if (elongated && h > 3.0 && rng() < 0.6) shape = 'complex';     // shopping podium + condo tower (above / beside)
  else if (h > 5.2 && rng() < 0.6) shape = rng() < 0.42 ? 'podium' : (rng() < 0.5 ? 'cylinder' : 'setback');            // tall → tower-on-podium / skyscraper variations
  else if (h > 3.4 && rng() < 0.28) shape = 'podium';                                                                   // mid-rise: a tower on a wide low base
  if (shape === 'podium' && (rect.w < 1.4 || rect.d < 1.2)) shape = 'box';                                              // need room for base + inset tower
  boxes.push({ ...rect, z0: 0, z1: h, kind: 'building', shape, condo });
}

// ── alleyway: a narrow service corridor between two buildings sharing a block ────
// Rather than spend real 3D prop boxes, an alley is dressed with cheap flat
// "stickers" — billboard quads standing on the alley floor, each facing OUT along
// the corridor so they read when you look down the alley from the street. The
// corridor RUNS along the axis perpendicular to the block split (`run`), and is
// narrow along the split axis. This keeps alley scenery shrewd: facades, not solids.
const alleyRect = (a, axis, gapW) => axis === 'x'
  ? { x: a.x + a.w, y: a.y, w: gapW, d: a.d }   // split along x → gap is a thin vertical slot, corridor runs along y
  : { x: a.x, y: a.y + a.d, w: a.w, d: gapW };  // split along y → gap is a thin horizontal slot, corridor runs along x

// one flat vertical sticker standing on the alley floor. `t` ∈ [0,1] positions it
// along the corridor; `w` is its panel width (capped to the slot), `h` its height.
function alleyBillboard(faces, alley, run, t, w, h, fill) {
  if (run === 'y') {
    const cx = alley.x + alley.w / 2, py = alley.y + alley.d * t, hw = Math.min(w, alley.w * 0.92) / 2;
    faces.push({ kind: 'alley-sticker', corners: [[cx - hw, py, 0], [cx + hw, py, 0], [cx + hw, py, h], [cx - hw, py, h]], fill, doubleSided: true });
  } else {
    const cy = alley.y + alley.d / 2, px = alley.x + alley.w * t, hd = Math.min(w, alley.d * 0.92) / 2;
    faces.push({ kind: 'alley-sticker', corners: [[px, cy - hd, 0], [px, cy + hd, 0], [px, cy + hd, h], [px, cy - hd, h]], fill, doubleSided: true });
  }
}

// a sticker stuck FLAT to one of the two flanking building walls (AC unit / vent /
// graffiti) — even cheaper scenery: a single quad on the wall plane, nudged into the
// alley so it doesn't z-fight the wall. `side` 0/1 picks which flanking wall.
function alleyWallSticker(faces, alley, run, side, t, w, h, z0, fill) {
  const eps = 0.02;
  if (run === 'y') {
    const px = side ? alley.x + alley.w - eps : alley.x + eps, cy = alley.y + alley.d * t, hw = Math.min(w, alley.d * 0.9) / 2;
    faces.push({ kind: 'alley-sticker', corners: [[px, cy - hw, z0], [px, cy + hw, z0], [px, cy + hw, z0 + h], [px, cy - hw, z0 + h]], fill, doubleSided: true });
  } else {
    const py = side ? alley.y + alley.d - eps : alley.y + eps, cx = alley.x + alley.w * t, hw = Math.min(w, alley.w * 0.9) / 2;
    faces.push({ kind: 'alley-sticker', corners: [[cx - hw, py, z0], [cx + hw, py, z0], [cx + hw, py, z0 + h], [cx - hw, py, z0 + h]], fill, doubleSided: true });
  }
}

// wall-prop palette: [tint, width, height, mount-z]. z stays under ~1.45 so a sticker
// never pokes above the shortest (1.5u) flanking building.
const ALLEY_WALL_PROPS = [
  { tint: '#6e7479', w: 0.42, h: 0.32, z0: 1.05 },   // AC unit (mounted high)
  { tint: '#3f444a', w: 0.28, h: 0.28, z0: 1.10 },   // wall vent
  { tint: '#9a5a3a', w: 0.70, h: 0.50, z0: 0.42 },   // graffiti (warm)
  { tint: '#3f7a86', w: 0.70, h: 0.46, z0: 0.46 },   // graffiti (cool)
];

// dress a designated alley: a darker service floor, a handful of free-standing flat
// stickers (gate across one mouth, a dumpster, one or two garbage cans), and a couple
// of stickers stuck flat to the flanking building walls (AC units / vents / graffiti).
function dressAlleyway(alley, run, rng, grounds, faces) {
  if (alley.w < 0.2 || alley.d < 0.2) return;
  grounds.push({ kind: 'alley-floor', x: alley.x, y: alley.y, w: alley.w, d: alley.d, z: 0.04, fill: '#2b2e31' });
  if (rng() < 0.6) alleyBillboard(faces, alley, run, rng() < 0.5 ? 0.05 : 0.95, 5, 1.0, '#6b7176');   // chain-link gate spanning a mouth
  alleyBillboard(faces, alley, run, 0.28 + rng() * 0.14, 0.5, 0.5, '#3f6b45');                          // dumpster
  const cans = 1 + (rng() < 0.5 ? 1 : 0);                                                                // 1–2 garbage cans down the run
  for (let i = 0; i < cans; i++) alleyBillboard(faces, alley, run, 0.62 + i * 0.16 + rng() * 0.06, 0.16, 0.4, '#565f68');
  const wallN = 1 + (rng() < 0.5 ? 1 : 0);                                                               // 1–2 wall-mounted stickers on the flanking faces
  for (let i = 0; i < wallN; i++) {
    const p = ALLEY_WALL_PROPS[Math.floor(rng() * ALLEY_WALL_PROPS.length)];
    alleyWallSticker(faces, alley, run, rng() < 0.5 ? 0 : 1, 0.25 + rng() * 0.5, p.w, p.h, p.z0, p.tint);
  }
}

// fill a block by a COMPOSITION rule: 1 large / 2 medium / 1 medium+2 small /
// building+lot / 4 small. Sub-rects partition the block (alleys between). A parking lot
// is now a DELIBERATE 'lot' parcel, never a leak-fill: a sub-rect whose cells are already
// claimed (anchor / corridor / road spill) is simply SKIPPED, leaving the cells for the
// tagged leftover layer (plaza/park) instead of paving a lot under the tower.
function fillBlock(region, reserved, rng, boxes, grounds, faces, opts, grid, cars) {
  const m = 0.72, block = { x: region.x + m, y: region.y + m, w: region.w - 2 * m, d: region.d - 2 * m };  // inset clears the (now wider) road spill
  if (block.w < 1.3 || block.d < 1.3) return;
  // TOWNHOUSE ROWS (opt-in): some eligible blocks become a residential rowhouse wall
  // instead of the massed composition. The `&&` chain short-circuits on the (default
  // false) flag, so rng is untouched when off.
  if (opts.elements.townhouses && block.w > 2.8 && block.d > 1.5 && Math.min(block.w, block.d) > 1.5
      && isBuildable(grid, block) && rng() < (opts.profile === 'town' ? 0.34 : 0.7)) {   // town: a MINORITY of blocks are rows → houses + townhouses mix
    placeTownhouses(block, reserved, rng, boxes, grounds, faces, opts, grid, cars);
    return;
  }
  // TOWN: the remaining blocks are detached residential lots (property line → fence → set-back
  // house + yard), not the city's massed composition.
  if (opts.profile === 'town') { fillTownBlock(block, rng, boxes, grounds, faces, opts, grid); return; }
  const density = Math.max(0, Math.min(1, Number.isFinite(opts.density) ? opts.density : 0.58));
  const long = block.w >= block.d ? 'x' : 'y', other = long === 'x' ? 'y' : 'x';
  // the REAL budget is the road/walk-clear INTERIOR, not the raw block. A mass must be able
  // to AFFORD its set-back footprint: a megatower the verge+road-clear core (it sits behind
  // the sidewalk → its ring is a plaza), a large mid-rise only a road-clear one (it may still
  // front the walk). A block that can't pay falls through to smaller massing on the geometric
  // block, fronting the sidewalk exactly as before — so small/medium shops are unchanged.
  const coreMid = clearCore(grid, block, false) || block;
  const big = coreMid.w * coreMid.d > 15;
  const alley = 0.55, roll = rng();
  // ~1:4 → dress the narrow gap on the FAR side of sub-rect `a` as a service alleyway,
  // claiming it as an ALLEY parcel (its dumpster/garbage tenants live there, not in lots).
  const tryAlley = (a, axis) => {
    if (opts.elements.alleyways && rng() < 0.25) {
      const ar = alleyRect(a, axis, alley);
      if (!isBuildable(grid, ar)) return;               // alley slot overlaps an anchor/claim → don't dress it (no stickers inside the tower)
      stampRect(grid, ar, CLAIM.ALLEY, [CLAIM.EMPTY, CLAIM.VERGE]);
      dressAlleyway(ar, axis === 'x' ? 'y' : 'x', rng, grounds, faces);
    }
  };
  let items;
  // XL megatowers removed: the big-block space is left to monuments. The largest a block
  // produces now is a single road-clear LARGE mid-rise; huge blocks fall to that or to the
  // multi-building compositions below, never a single block-eating set-back tower.
  if (big && roll < 0.34) items = [bld(coreMid, 'large')];                               // 1 large, road-clear core
  else if (roll < 0.5) {                                                                                 // 2 medium — the canonical pair flanking a narrow gap
    const [a, b] = splitRect(block, long, 0.5, alley); items = [bld(a, 'medium'), bld(b, 'medium')];
    tryAlley(a, long);
  }
  else if (roll < 0.66) {                                                                                // 1 medium + 2 small
    const [a, b] = splitRect(block, long, 0.52, alley); const [c, e] = splitRect(b, other, 0.5, alley); items = [bld(a, 'medium'), bld(c, 'small'), bld(e, 'small')];
    tryAlley(a, long);                                                                                   // gap between the medium and the small pair
  }
  else if (roll < 0.8) { const [a, b] = splitRect(block, long, 0.58, alley); items = [bld(a, 'medium'), { rect: b, kind: 'lot' }]; }     // building + lot
  else {                                                                                                 // 4 small
    const [l, r] = splitRect(block, 'x', 0.5, alley); const [a, b] = splitRect(l, 'y', 0.5, alley); const [c, e] = splitRect(r, 'y', 0.5, alley); items = [bld(a, 'small'), bld(b, 'small'), bld(c, 'small'), bld(e, 'small')];
    tryAlley(l, 'x');                                                                                    // central back-alley between the two columns
  }
  for (const it of items) {
    if (it.rect.w < 0.7 || it.rect.d < 0.7) continue;
    if (!isBuildable(grid, it.rect)) continue;                        // already-claimed cells (anchor/corridor/road) → leave for the leftover layer
    if (it.kind === 'lot') { addParkingLot(grounds, it.rect, rng, opts.elements, grid, cars); continue; }   // deliberate lot parcel
    const keepBuilding = opts.elements.buildings && rng() < (0.45 + density * 0.55);
    if (keepBuilding) placeBuilding(boxes, it.rect, it.size, rng, grid, opts);
    // else: leave the parcel EMPTY → tagged leftover (plaza/greenspace), never a random lot
  }
}

// ── townhouse rows ──────────────────────────────────────────────────────────────
// A rowhouse block is ONE continuous wall of narrow ATTACHED units (party walls, no
// inter-unit gaps) sharing datum lines (floor / cornice / stoop landing), varying
// only by tint + stoop handing — NOT N detached buildings. Three treatments:
//  • 'brownstone'      — warm masonry walk-up: tall projecting stoop to a raised
//                        parlor door, cheek-wall rails, heavy continuous cornice,
//                        optional parlor bay window, arched brick windows.
//  • 'modern-stacked'  — panel/glass: flat parapet, mid-height stack-reveal band,
//                        TWO grade-level doors per lot (stacked lower+upper dwellings),
//                        low stoop + slender canopy, optional cantilevered box-bay.
//  • 'dutch-row'       — narrow low-countries brick rows: tight bay rhythm, pale trim
//                        bands, modest stoops, and stepped / neck / bell-ish gables.
// A row runs along a block's long edge. A 'full' row is DOUBLE-LOADED (mirrored on
// both long edges → doors+stoops on both faces); a 'half' row takes half the
// block-face length with a normal building filling the remainder.

const TOWNHOUSE_DOORS = {
  brownstone: ['#2e3a2c', '#3a2420', '#1d2630', '#2b2622'],          // deep green / oxblood / navy / near-black
  'modern-stacked': ['#2b2e33', '#3a3f45', '#6b5240', '#384047'],   // charcoal / slate / warm-wood / blue-grey
  'dutch-row': ['#173629', '#3b1f1c', '#16283a', '#2f251c'],         // canal-house green / oxblood / navy / dark timber
};

const faceLabel = (axis, side) => axis === 'x' ? (side > 0 ? '+y' : '-y') : (side > 0 ? '+x' : '-x');

// an axis-aligned box projecting OUTWARD from a unit's front plane: centred at run
// fraction `cf`, run-width `rw` (world units), projecting `pd` out, between z0..z1.
function frontBox(u, axis, side, cf, rw, pd, z0, z1, kind, tint) {
  if (axis === 'x') {
    const ac = u.x + cf * u.w, front = side > 0 ? u.y + u.d : u.y;
    return { kind, x: ac - rw / 2, y: side > 0 ? front : front - pd, w: rw, d: pd, z0, z1, tint };
  }
  const ac = u.y + cf * u.d, front = side > 0 ? u.x + u.w : u.x;
  return { kind, x: side > 0 ? front : front - pd, y: ac - rw / 2, w: pd, d: rw, z0, z1, tint };
}
// a flat door/panel quad on the front plane (slightly proud by `o`), doubleSided so
// winding is irrelevant. f0,f1 are run fractions across the unit; z0,z1 the height.
function frontQuad(u, axis, side, f0, f1, z0, z1, o, kind, fill) {
  const pt = (af, z) => axis === 'x'
    ? [u.x + af * u.w, (side > 0 ? u.y + u.d : u.y) + side * o, z]
    : [(side > 0 ? u.x + u.w : u.x) + side * o, u.y + af * u.d, z];
  return { kind, doubleSided: true, fill, corners: [pt(f0, z0), pt(f1, z0), pt(f1, z1), pt(f0, z1)] };
}

// dress one placed unit with its style-specific stoop, doors, cornice, and bay.
function dressTownhouseUnit(u, axis, side, style, idx, rng, boxes, faces) {
  const run = axis === 'x' ? u.w : u.d, z1 = u.z1;
  const frame = u.facade.frame, glass = u.facade.glass;
  const door = TOWNHOUSE_DOORS[style][idx % TOWNHOUSE_DOORS[style].length];

  if (style === 'dutch-row') {
    const trim = scaleHex(frame, 1.05);
    boxes.push(frontBox(u, axis, side, 0.5, run, 0.08, z1 - 0.1, z1 + 0.02, 'townhouse-cornice', trim));
    boxes.push(frontBox(u, axis, side, 0.5, run * 0.86, 0.05, z1 * 0.34, z1 * 0.34 + 0.05, 'townhouse-reveal', trim));
    boxes.push(frontBox(u, axis, side, 0.5, run * 0.86, 0.05, z1 * 0.64, z1 * 0.64 + 0.05, 'townhouse-reveal', trim));
    const nr = 2 + Math.floor(rng() * 2), riserH = 0.09, landing = nr * riserH;
    for (let s = 0; s < nr; s++) {
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.52, 0.28 * (nr - s) / nr, s * riserH, (s + 1) * riserH, 'townhouse-stoop', '#9c9588'));
    }
    faces.push(frontQuad(u, axis, side, 0.39, 0.61, landing + 0.03, Math.min(z1 * 0.34, landing + 0.88), 0.03, 'townhouse-door', door));
    faces.push(frontQuad(u, axis, side, 0.36, 0.64, Math.min(z1 * 0.34, landing + 0.88), Math.min(z1 * 0.34 + 0.16, landing + 1.06), 0.032, 'townhouse-door-transom', '#d9c99e'));
    if (idx % 2 === 0) {
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.48, 0.2, z1 * 0.48, z1 * 0.72, 'townhouse-bay', scaleHex(glass, 0.98)));
    }
    const roof = idx % 4;
    if (roof === 0) {                                           // stepped gable
      for (let s = 0; s < 3; s++) {
        const rw = run * (0.72 - s * 0.18);
        boxes.push(frontBox(u, axis, side, 0.5, rw, 0.12, z1 + s * 0.16, z1 + (s + 1) * 0.16, 'townhouse-gable', scaleHex(glass, 0.96)));
      }
    } else if (roof === 1) {                                    // neck gable: narrow raised center
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.66, 0.1, z1, z1 + 0.16, 'townhouse-gable', scaleHex(glass, 0.96)));
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.36, 0.12, z1 + 0.16, z1 + 0.5, 'townhouse-gable', scaleHex(glass, 0.98)));
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.46, 0.13, z1 + 0.48, z1 + 0.58, 'townhouse-gable-cap', trim));
    } else if (roof === 2) {                                    // bell suggestion: broad cap over pinched middle
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.54, 0.12, z1, z1 + 0.42, 'townhouse-gable', scaleHex(glass, 0.98)));
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.78, 0.13, z1 + 0.3, z1 + 0.48, 'townhouse-gable-cap', trim));
    } else {                                                    // simple triangular/corniced parapet read
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.68, 0.1, z1, z1 + 0.24, 'townhouse-gable', scaleHex(glass, 0.96)));
      boxes.push(frontBox(u, axis, side, 0.5, run * 0.44, 0.12, z1 + 0.2, z1 + 0.42, 'townhouse-gable', scaleHex(glass, 0.98)));
    }
    return;
  }

  if (style === 'brownstone') {
    boxes.push(frontBox(u, axis, side, 0.5, run, 0.16, z1 - 0.2, z1 - 0.02, 'townhouse-cornice', scaleHex(frame, 0.88)));
    const hand = idx % 2 ? 0.34 : 0.66;                      // alternate stoop handing → saw-tooth read
    const stoopRun = run * 0.42, srf = stoopRun / run;
    const nr = 5 + Math.floor(rng() * 3), riserH = 0.11, parlor = nr * riserH, stoopDepth = 0.44;
    for (let s = 0; s < nr; s++) {                           // steps: outermost deepest, climbing to the landing
      boxes.push(frontBox(u, axis, side, hand, stoopRun, stoopDepth * (nr - s) / nr, s * riserH, (s + 1) * riserH, 'townhouse-stoop', '#8a857a'));
    }
    for (const rcf of [hand - srf / 2, hand + srf / 2]) {    // cheek-wall rails flanking the steps
      boxes.push(frontBox(u, axis, side, rcf, 0.07, stoopDepth, 0, parlor + 0.06, 'townhouse-rail', scaleHex(frame, 0.96)));
    }
    const dh = Math.min(0.98, (z1 - parlor) * 0.55);
    faces.push(frontQuad(u, axis, side, hand - srf * 0.3, hand + srf * 0.3, parlor + 0.02, parlor + dh, 0.03, 'townhouse-door', door));   // raised parlor door
    faces.push(frontQuad(u, axis, side, hand - srf * 0.22, hand + srf * 0.22, 0.06, 0.5, 0.012, 'townhouse-door', '#1a1f1d'));            // garden door under the stoop
    if (rng() < 0.5) {                                       // parlor bay / oriel, off the stoop side
      const bf = hand < 0.5 ? 0.72 : 0.28;
      boxes.push(frontBox(u, axis, side, bf, run * 0.34, 0.28, parlor * 0.6, parlor * 0.6 + (z1 - parlor) * 0.5, 'townhouse-bay', scaleHex(glass, 1.0)));
    }
    return;
  }

  // modern-stacked
  boxes.push(frontBox(u, axis, side, 0.5, run, 0.06, z1 - 0.08, z1, 'townhouse-cornice', scaleHex(frame, 0.8)));       // flat parapet cap
  boxes.push(frontBox(u, axis, side, 0.5, run, 0.05, z1 * 0.5 - 0.04, z1 * 0.5 + 0.04, 'townhouse-reveal', scaleHex(frame, 0.66)));  // stack-reveal split
  const nr = 1 + Math.floor(rng() * 3), riserH = 0.1, landing = nr * riserH, stoopRun = run * 0.52, stoopDepth = 0.3;
  for (let s = 0; s < nr; s++) {
    boxes.push(frontBox(u, axis, side, 0.5, stoopRun, stoopDepth * (nr - s) / nr, s * riserH, (s + 1) * riserH, 'townhouse-stoop', '#7c7f84'));
  }
  const dh = Math.min(0.92, z1 * 0.42);
  for (const df of [0.34, 0.66]) {                           // TWO grade-level doors (stacked lower + upper dwelling)
    faces.push(frontQuad(u, axis, side, df - 0.1, df + 0.1, landing + 0.02, landing + dh, 0.03, 'townhouse-door', door));
  }
  boxes.push(frontBox(u, axis, side, 0.5, run * 0.64, 0.32, landing + dh + 0.02, landing + dh + 0.08, 'townhouse-canopy', '#4a4f55'));    // slender entry canopy
  if (rng() < 0.5) boxes.push(frontBox(u, axis, side, 0.5, run * 0.5, 0.3, z1 * 0.58, z1 * 0.86, 'townhouse-bay', scaleHex(glass, 1.0)));  // cantilevered upper box-bay
}

// lay ONE row of attached units along `axis`, against the `side` long edge of the
// block (side +1 → high cross-edge facing camera; -1 → low cross-edge), between run
// positions lo..hi. Units tile EXACTLY (no gaps) with slightly wider bookends.
function townhouseRow({ block, axis, side, style, loading, depth, lo, hi, rng, boxes, faces, grid, profile }) {
  const runLen = hi - lo;
  if (runLen < 1.6 || depth < 0.6) return 0;
  const target = style === 'dutch-row' ? 0.82 + rng() * 0.2 : 1.2 + rng() * 0.3;
  const n = Math.max(2, Math.round(runLen / target));
  const weights = Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1) ? 1.16 : 1.0);
  const wsum = weights.reduce((a, b) => a + b, 0);
  // town rows are low — 2-storey stacked / walk-up — not the city's 3–4 storey rowhomes.
  const H = profile === 'town' ? 1.8 + rng() * 0.5
    : style === 'dutch-row' ? 2.8 + rng() * 0.65 : style === 'brownstone' ? 2.9 + rng() * 0.9 : 2.5 + rng() * 0.9;          // one shared height → continuous cornice datum
  const seedBase = (Math.floor((block.x * 53.3 + block.y * 31.7 + lo * 17.1) * 100) >>> 0) || 1;
  let cursor = lo, placed = 0;
  for (let i = 0; i < n; i++) {
    const uw = runLen * weights[i] / wsum;
    const u = axis === 'x'
      ? { x: cursor, y: side > 0 ? block.y + block.d - depth : block.y, w: uw, d: depth }
      : { x: side > 0 ? block.x + block.w - depth : block.x, y: cursor, w: depth, d: uw };
    cursor += uw;
    if (!isBuildable(grid, u)) break;                    // a row is ATTACHED: stop at the first blocked unit rather than leaving a gap
    stampRect(grid, u, CLAIM.BUILDING, [CLAIM.EMPTY, CLAIM.VERGE]);
    const facade = makeRowhouseFacade(style, (seedBase + i * 2654435761) >>> 0, i);
    u.z0 = 0; u.z1 = H; u.facade = facade;
    boxes.push({
      kind: 'townhouse', structure: 'townhouse-row', style, unitIndex: i, units: n,
      loading, face: faceLabel(axis, side), row: `${block.x.toFixed(2)},${block.y.toFixed(2)},${axis},${side},${lo.toFixed(2)}`,
      x: u.x, y: u.y, w: u.w, d: u.d, z0: 0, z1: H, facade,
    });
    dressTownhouseUnit(u, axis, side, style, i, rng, boxes, faces);
    placed += 1;
  }
  return placed;
}

// compose a townhouse block: pick style + loading, place the row(s). 'full' →
// double-loaded (a row on each long edge); 'half' → one row over half the face
// length, a normal building filling the remainder.
function placeTownhouses(block, reserved, rng, boxes, grounds, faces, opts, grid, cars) {
  const long = block.w >= block.d ? 'x' : 'y';
  const longLen = long === 'x' ? block.w : block.d, crossLen = long === 'x' ? block.d : block.w;
  const lo = long === 'x' ? block.x : block.y;
  const style = chooseTownhouseStyle(opts.locale, rng, opts.profile);
  const profile = opts.profile;
  const loading = crossLen >= 2.4 && rng() < 0.6 ? 'full' : 'half';
  if (loading === 'full') {
    const seam = 0.3, depth = Math.min(2.3, (crossLen - seam) / 2);
    townhouseRow({ block, axis: long, side: 1, style, loading, depth, lo, hi: lo + longLen, rng, boxes, faces, grid, profile });
    townhouseRow({ block, axis: long, side: -1, style, loading, depth, lo, hi: lo + longLen, rng, boxes, faces, grid, profile });
    return;
  }
  const depth = Math.min(2.6, crossLen * 0.7);
  const mid = lo + longLen * (0.46 + rng() * 0.08);
  townhouseRow({ block, axis: long, side: 1, style, loading, depth, lo, hi: mid, rng, boxes, faces, grid, profile });
  const rem = long === 'x'
    ? { x: mid + 0.4, y: block.y, w: block.x + block.w - mid - 0.4, d: block.d }
    : { x: block.x, y: mid + 0.4, w: block.w, d: block.y + block.d - mid - 0.4 };
  if (rem.w > 0.9 && rem.d > 0.9 && isBuildable(grid, rem)) {
    if (opts.elements.buildings) placeBuilding(boxes, rem, 'small', rng, grid, opts);
    else addParkingLot(grounds, rem, rng, opts.elements, grid, cars);
  }
}

function chooseTownhouseStyle(locale, rng, profile) {
  if (isEuropeanLocale(locale)) {
    const r = rng();
    if (r < 0.7) return 'dutch-row';
    return r < 0.88 ? 'brownstone' : 'modern-stacked';
  }
  if (profile === 'town') return rng() < 0.45 ? 'modern-stacked' : 'brownstone';   // ~45% of town rows are 2-storey stacked
  return rng() < 0.5 ? 'brownstone' : 'modern-stacked';
}

const STREET = 1.1;

function streetLamp(boxes, x, y) {
  boxes.push({ kind: 'street-lamp', x: x - 0.045, y: y - 0.045, w: 0.09, d: 0.09, z0: 0, z1: 2.35, tint: '#555b62' });
  boxes.push({ kind: 'street-lamp', x: x - 0.42, y: y - 0.035, w: 0.42, d: 0.07, z0: 2.18, z1: 2.26, tint: '#555b62' });
  boxes.push({ kind: 'street-lamp', x: x - 0.55, y: y - 0.08, w: 0.18, d: 0.16, z0: 2.06, z1: 2.22, tint: '#f0d982' });
}

function stopSign(boxes, x, y) {
  boxes.push({ kind: 'stop-sign', x: x - 0.035, y: y - 0.035, w: 0.07, d: 0.07, z0: 0, z1: 1.42, tint: '#70777f' });
  boxes.push({ kind: 'stop-sign', x: x - 0.18, y: y - 0.045, w: 0.36, d: 0.09, z0: 1.18, z1: 1.52, tint: '#b93632' });
}

// A street tree: ONE box with shape:'tree' carrying a taiji-plant sub-spec. The
// box-city dispatch (assembleBoxCityScene → plantBoxToFaces) meshes it to real
// branched, canopy-hatted geometry at assemble time, lit by the scene light and
// rendered identically in CSS-3D and the three.js World. Bark + canopy greens
// auto-vary per position, so a street of trees reads as individuals. rng is the
// deterministic city rng, so the same seed yields the same trees.
//
// `climate` gates the species mix: 'tropical'/'equatorial' swaps conifers for
// coconut PALMS (about half the trees) and keeps the broadleaf canopy/weeping
// variety; everything else (temperate) keeps conifers and no palms.
function cityTree(boxes, x, y, rng, climate = 'temperate') {
  const tropical = climate === 'tropical' || climate === 'equatorial';
  if (tropical && rng() < 0.5) { cityPalm(boxes, x, y, rng); return; }

  let h = 1.5 + rng() * 0.5;                  // 1.5–2.0 trunk; branches add ~1 more
  // Columnar street-tree defaults: tight fork + strong gravitropism so a canopy
  // stays over the trunk and never overhangs an adjacent building.
  const plant = {
    stemRadius: 0.09 + rng() * 0.04,
    depth: 1,
    branches: rng() < 0.5 ? 3 : 4,
    foliage: 'cluster',
    clusterSize: 0.38 + rng() * 0.12,
    foliageTiers: 4,
    branchAngle: 22,
    upBias: 0.55,
    lengthRatio: 0.62,
  };
  const pick = rng();
  if (!tropical && pick < 0.16) {                 // temperate evergreen conifer
    plant.foliage = 'conifer';
    plant.clusterSize = 0.34 + rng() * 0.1;
    plant.branchAngle = 16;
  } else if (pick < 0.42) {                        // classic broadleaf puff
    // defaults already set
  } else if (pick < 0.64) {                        // spreading shade dome
    plant.foliage = 'canopy';
    plant.branches = 4;
    plant.foliageTiers = 5;
    plant.clusterSize = 0.32 + rng() * 0.08;
    plant.branchAngle = 24;
    plant.upBias = 0.5;
    plant.lengthRatio = 0.6;
  } else if (pick < 0.80) {                        // weeping
    plant.foliage = 'weeping';
    plant.branches = 3;
    plant.foliageTiers = 5;
    plant.clusterSize = 0.32 + rng() * 0.08;
    plant.branchAngle = 20;
    plant.upBias = 0.5;
    plant.lengthRatio = 0.6;
  } else if (pick < 0.91) {                        // two-tier layered canopy (taller)
    h = 1.1 + rng() * 0.4;
    plant.foliage = 'canopy';
    plant.depth = 3;
    plant.branches = 2;
    plant.foliageLevels = 2;
    plant.foliageTiers = 4;
    plant.clusterSize = 0.24 + rng() * 0.06;
    plant.branchAngle = 28;
    plant.upBias = 0.45;
    plant.lengthRatio = 0.74;
  } else {                                         // codominant "V" trunk
    plant.depth = 2;
    plant.branches = 2;
    plant.forkStyle = 'planar';
    plant.clusterSize = 0.32 + rng() * 0.08;
    plant.branchAngle = 24;
    plant.upBias = 0.4;
    plant.lengthRatio = 0.78;
  }
  plant.height = h;
  boxes.push({
    kind: 'city-tree', shape: 'tree',
    x: x - 0.18, y: y - 0.18, w: 0.36, d: 0.36, z0: 0, z1: h + 1.4,   // slim footprint bbox (render computes its own geometry)
    plant,
  });
}

// A coconut palm street tree: taller than a broadleaf, a slender bowed trunk and
// a fountain crown of drooping fronds. Tropical only (see cityTree). Fronds/pinnae
// are kept modest so a beachfront avenue of them stays browser-light.
function cityPalm(boxes, x, y, rng) {
  const h = 2.4 + rng() * 1.1;
  boxes.push({
    kind: 'city-palm', shape: 'palm',
    x: x - 0.2, y: y - 0.2, w: 0.4, d: 0.4, z0: 0, z1: h + 1.6,
    plant: {
      height: h,
      stemRadius: 0.1 + rng() * 0.04,
      bend: 0.05 + rng() * 0.12,
      fronds: 8 + Math.floor(rng() * 3),       // 8–10
      pinnae: 8 + Math.floor(rng() * 3),        // 8–10
      upFronds: 3,
      droop: 0.5 + rng() * 0.2,
      trunkSegments: 6 + Math.floor(rng() * 4), // ringed trunk
      coconuts: rng() < 0.5 ? 0 : 4,
      // ~1 in 4 is a fan palm
      ...(rng() < 0.25 ? { frondType: 'fan' } : {}),
    },
  });
}

// A park SHRUB: the same taiji-plant box as a tree, but LOW and BUSHY — a short stem, many
// wide-angle branches, little gravitropism → a rounded groundcover blob. Meshed by the same
// assembleBoxCityScene → plantBoxToFaces dispatch (shape:'shrub' ∈ PLANT_BOX_SHAPES).
function cityShrub(boxes, x, y, rng) {
  const h = 0.4 + rng() * 0.4;                   // 0.4–0.8 — knee-to-waist height bush
  boxes.push({
    kind: 'city-shrub', shape: 'shrub',
    x: x - 0.22, y: y - 0.22, w: 0.44, d: 0.44, z0: 0, z1: h + 0.4,
    plant: {
      height: h,
      stemRadius: 0.05 + rng() * 0.03,
      depth: 1,
      branches: 4 + Math.floor(rng() * 3),       // 4–6 → dense
      foliage: 'cluster',
      clusterSize: 0.42 + rng() * 0.16,
      foliageTiers: 3,
      branchAngle: 38 + rng() * 12,              // wide spread → rounded bush
      upBias: 0.18,
      lengthRatio: 0.55,
    },
  });
}

// ── park doodads ────────────────────────────────────────────────────────────────
// Furniture scattered onto the GREEN POCKETS (the planted leftover, #3c5a3a). Same
// idiom as streetLamp/cityTree: multi-box assemblies of lit cityBox prisms, plus a few
// sloped `faces` quads where a box can't lean (the slide chute). Everything is sized
// small against the lamp (2.35u) and tree (~3u) so it reads as ground furniture.
// Axis-aware via two tiny mappers: a = ALONG the piece's long axis, c = ACROSS it.
const PLAY_PALETTE = ['#d8513b', '#3f8ecc', '#e6b73c', '#4a9d5b', '#c7643b'];
const paPick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
// emit an axis-aligned box spanning along∈[a0,a1], across∈[c0,c1] about centre (cx,cy)
function paBox(boxes, kind, axis, cx, cy, a0, a1, c0, c1, z0, z1, tint) {
  const [x, w, y, d] = axis === 'x' ? [cx + a0, a1 - a0, cy + c0, c1 - c0] : [cx + c0, c1 - c0, cy + a0, a1 - a0];
  boxes.push({ kind, x, y, w, d, z0, z1, tint });
}
// emit a (possibly sloped) quad; pts are [along, across, z]
function paFace(faces, axis, cx, cy, pts, fill) {
  const corners = pts.map(([a, c, z]) => (axis === 'x' ? [cx + a, cy + c, z] : [cx + c, cy + a, z]));
  faces.push({ corners, fill, doubleSided: true });
}

// trapezoid bin: narrow body → wider rim → dark lid; reads as a tapered public can.
function garbageCan(boxes, x, y, rng) {
  const tint = rng() < 0.5 ? '#3f6b45' : '#566069';
  boxes.push({ kind: 'park-bin', x: x - 0.13, y: y - 0.13, w: 0.26, d: 0.26, z0: 0, z1: 0.40, tint });
  boxes.push({ kind: 'park-bin', x: x - 0.17, y: y - 0.17, w: 0.34, d: 0.34, z0: 0.40, z1: 0.52, tint });
  boxes.push({ kind: 'park-bin', x: x - 0.18, y: y - 0.18, w: 0.36, d: 0.36, z0: 0.52, z1: 0.59, tint: '#2b2e31' });
}

// bench: a SLATTED wooden bench — two seat planks (gap between) + two stacked backrest
// planks + two end legs. Oriented `axis` = run ALONG the green pocket's long edge.
// `face` (±1) flips which ACROSS side the backrest sits on, so a bench can be turned to
// FACE the gathering space (movement-flow kernel #5) rather than always backing one way.
function parkBench(boxes, x, y, axis, rng, face = 1) {
  const wood = rng() < 0.5 ? '#8a6c43' : '#9a7b4e', frame = '#3d444b';
  const L = 1.42, B = 0.46;
  const ac = (lo, hi) => (face >= 0 ? [lo, hi] : [-hi, -lo]);   // mirror the across span when facing the other way
  paBox(boxes, 'park-bench', axis, x, y, -L / 2, L / 2, ...ac(-0.18, -0.04), 0.32, 0.38, wood);    // seat plank (front)
  paBox(boxes, 'park-bench', axis, x, y, -L / 2, L / 2, ...ac(0.02, 0.16), 0.32, 0.38, wood);      // seat plank (rear)
  paBox(boxes, 'park-bench', axis, x, y, -L / 2, L / 2, ...ac(B / 2 - 0.06, B / 2), 0.42, 0.52, wood);  // backrest plank (lower)
  paBox(boxes, 'park-bench', axis, x, y, -L / 2, L / 2, ...ac(B / 2 - 0.06, B / 2), 0.58, 0.70, wood);  // backrest plank (upper)
  for (const ae of [-L / 2 + 0.08, L / 2 - 0.16]) paBox(boxes, 'park-bench', axis, x, y, ae, ae + 0.08, -B / 2 + 0.06, B / 2 - 0.04, 0, 0.32, frame);
}

// playground pieces — each centred on (cx,cy), oriented along `axis`, bright primaries.
function pgSwings(boxes, faces, axis, cx, cy, rng) {
  const metal = '#6a7178';
  paBox(boxes, 'play-swing', axis, cx, cy, -0.82, 0.82, -0.04, 0.04, 1.30, 1.40, metal);          // top beam
  for (const ae of [-0.78, 0.78]) for (const ce of [-0.32, 0.32]) paBox(boxes, 'play-swing', axis, cx, cy, ae - 0.035, ae + 0.035, ce - 0.035, ce + 0.035, 0, 1.37, metal);  // 4 splayed posts
  for (const ae of [-0.34, 0.34]) {
    paBox(boxes, 'play-swing', axis, cx, cy, ae - 0.02, ae + 0.02, -0.02, 0.02, 0.50, 1.30, '#2c2f33');   // chain
    paBox(boxes, 'play-swing', axis, cx, cy, ae - 0.13, ae + 0.13, -0.13, 0.13, 0.44, 0.50, paPick(rng, PLAY_PALETTE)); // seat
  }
}
function pgSlide(boxes, faces, axis, cx, cy, rng) {
  const metal = '#6a7178', chute = paPick(rng, PLAY_PALETTE);
  paBox(boxes, 'play-slide', axis, cx, cy, -0.95, -0.48, -0.28, 0.28, 1.00, 1.10, '#9aa3ad');      // platform
  for (const ae of [-0.90, -0.54]) for (const ce of [-0.24, 0.24]) paBox(boxes, 'play-slide', axis, cx, cy, ae - 0.04, ae + 0.04, ce - 0.04, ce + 0.04, 0, 1.00, metal); // platform posts
  for (let i = 0; i < 3; i++) paBox(boxes, 'play-slide', axis, cx, cy, -1.00, -0.88, -0.18, 0.18, 0.30 + i * 0.32, 0.36 + i * 0.32, metal);   // ladder rungs
  paFace(faces, axis, cx, cy, [[-0.48, -0.22, 1.00], [-0.48, 0.22, 1.00], [0.92, 0.22, 0.07], [0.92, -0.22, 0.07]], chute);                    // sloped chute
  for (const ce of [-0.22, 0.22]) paFace(faces, axis, cx, cy, [[-0.48, ce, 1.12], [-0.48, ce, 1.00], [0.92, ce, 0.07], [0.92, ce, 0.20]], metal); // side rails
}
function pgGym(boxes, faces, axis, cx, cy, rng) {
  const a = paPick(rng, PLAY_PALETTE), b = paPick(rng, PLAY_PALETTE);
  for (const ae of [-0.55, 0.55]) for (const ce of [-0.55, 0.55]) paBox(boxes, 'play-gym', axis, cx, cy, ae - 0.04, ae + 0.04, ce - 0.04, ce + 0.04, 0, 1.20, a);  // corner posts
  for (const ce of [-0.55, 0.55]) paBox(boxes, 'play-gym', axis, cx, cy, -0.55, 0.55, ce - 0.04, ce + 0.04, 1.12, 1.20, b);   // top beams (along)
  for (const ae of [-0.55, 0.55]) paBox(boxes, 'play-gym', axis, cx, cy, ae - 0.04, ae + 0.04, -0.55, 0.55, 1.12, 1.20, b);   // top beams (across)
  for (const ce of [-0.55, 0.55]) paBox(boxes, 'play-gym', axis, cx, cy, -0.55, 0.55, ce - 0.03, ce + 0.03, 0.58, 0.64, b);   // mid bars
}
function pgSeesaw(boxes, faces, axis, cx, cy, rng) {
  paBox(boxes, 'play-seesaw', axis, cx, cy, -0.12, 0.12, -0.12, 0.12, 0, 0.30, '#6a7178');          // fulcrum
  paBox(boxes, 'play-seesaw', axis, cx, cy, -0.08, 0.08, -0.08, 0.08, 0.30, 0.40, '#566069');
  paBox(boxes, 'play-seesaw', axis, cx, cy, -0.88, 0.88, -0.08, 0.08, 0.34, 0.42, paPick(rng, PLAY_PALETTE));   // plank
  for (const ae of [-0.78, 0.78]) paBox(boxes, 'play-seesaw', axis, cx, cy, ae - 0.03, ae + 0.03, -0.05, 0.05, 0.42, 0.64, '#2c2f33');  // handles
}
function pgSandbox(boxes, grounds, axis, cx, cy, rng) {
  const S = 0.74, wood = '#9a7b4e';
  grounds.push({ kind: 'play-sand', x: cx - S, y: cy - S, w: 2 * S, d: 2 * S, z: 0.03, fill: '#cdba86' });
  for (const e of [-S, S]) {
    paBox(boxes, 'play-sandbox', axis, cx, cy, -S, S, e - 0.07, e + 0.07, 0, 0.16, wood);
    paBox(boxes, 'play-sandbox', axis, cx, cy, e - 0.07, e + 0.07, -S, S, 0, 0.16, wood);
  }
}
// Curated 2-piece "minibox" combos rather than a random scatter. The rule the pairings
// encode: the SEESAW only ever appears beside the SWING, and the SANDBOX never lands next
// to the seesaw (toddlers' sand vs. a swinging plank). Every combo is one of these.
const PLAY_COMBOS = [
  ['seesaw', 'swing'],
  ['swing', 'slide'],
  ['gym', 'swing'],
  ['slide', 'sandbox'],
  ['gym', 'sandbox'],
];
// uniform dispatch so a combo can place any piece by name (sandbox needs `grounds` for its sand tile)
const PLAY_PIECE = {
  swing: (b, f, g, ax, x, y, r) => pgSwings(b, f, ax, x, y, r),
  slide: (b, f, g, ax, x, y, r) => pgSlide(b, f, ax, x, y, r),
  gym: (b, f, g, ax, x, y, r) => pgGym(b, f, ax, x, y, r),
  seesaw: (b, f, g, ax, x, y, r) => pgSeesaw(b, f, ax, x, y, r),
  sandbox: (b, f, g, ax, x, y, r) => pgSandbox(b, g, ax, x, y, r),
};

// rejection-sample a w×d footprint that lands fully on EMPTY grass inside `comp`; on a hit
// claim it (CLAIM.PLAZA so later doodads can't overlap) and return the centre, else null.
function placeOnGrass(grid, comp, w, d, rng, tries = 14) {
  for (let t = 0; t < tries; t++) {
    const cx = comp.x + w / 2 + rng() * Math.max(0, comp.w - w);
    const cy = comp.y + d / 2 + rng() * Math.max(0, comp.d - d);
    const rect = { x: cx - w / 2, y: cy - d / 2, w, d };
    if (isClear(grid, rect, 0.001)) { stampRect(grid, rect, CLAIM.PLAZA); return { x: cx, y: cy }; }
  }
  return null;
}

// scatter benches / bins / playgrounds across the green pockets. Big pockets get a sand
// pad + ONE curated 2-piece combo; bins and benches then fill the remaining grass around
// it. Benches run ALONG the pocket's long edge. All draws come from the deterministic rng.
function scatterParkDoodads(leftover, grid, boxes, grounds, faces, rng) {
  for (const comp of leftover) {
    if (comp.tag !== 'pocket' || comp.area < 1.4) continue;
    if (comp.area >= 7 && Math.min(comp.w, comp.d) >= 2.6) {
      const pad = Math.min(comp.w - 0.4, comp.d - 0.4, 3.0);
      const spot = placeOnGrass(grid, comp, pad, pad, rng, 18);
      if (spot) {
        grounds.push({ kind: 'playground-pad', x: spot.x - pad / 2, y: spot.y - pad / 2, w: pad, d: pad, z: 0.028, fill: '#c2b083' });
        // lay the two combo pieces side-by-side along `along`, each turned ACROSS it so
        // their long extents run parallel and never collide.
        const along = rng() < 0.5 ? 'x' : 'y', cross = along === 'x' ? 'y' : 'x';
        const combo = PLAY_COMBOS[Math.min(PLAY_COMBOS.length - 1, Math.floor(rng() * PLAY_COMBOS.length))];
        combo.forEach((name, i) => {
          const off = i === 0 ? -0.72 : 0.72;
          const cx = along === 'x' ? spot.x + off : spot.x;
          const cy = along === 'x' ? spot.y : spot.y + off;
          PLAY_PIECE[name](boxes, faces, grounds, cross, cx, cy, rng);
        });
      }
    }
    const benchAxis = comp.w >= comp.d ? 'x' : 'y';            // benches run ALONG the pocket's long edge, never across it
    const benchFW = benchAxis === 'x' ? 1.6 : 0.7, benchFD = benchAxis === 'x' ? 0.7 : 1.6;
    const cans = Math.min(4, 1 + Math.floor(comp.area / 9));
    const benches = Math.min(3, Math.floor(comp.area / 14));
    // movement-flow (kernel #5): face each bench TOWARD the pocket centroid (its local
    // gathering point) — the field's "face the attractor", instead of always backing one way.
    const gx = comp.x + comp.w / 2, gy = comp.y + comp.d / 2;
    for (let i = 0; i < benches; i++) {
      const s = placeOnGrass(grid, comp, benchFW, benchFD, rng);
      if (!s) continue;
      const face = benchAxis === 'x' ? (gy >= s.y ? -1 : 1) : (gx >= s.x ? -1 : 1);  // backrest away from the centre
      parkBench(boxes, s.x, s.y, benchAxis, rng, face);
    }
    for (let i = 0; i < cans; i++) { const s = placeOnGrass(grid, comp, 0.42, 0.42, rng); if (s) garbageCan(boxes, s.x, s.y, rng); }
  }
}

// doodads anchored to the REAL main intersection (vx,hy). Every prop is a TENANT of the
// verge/road: it is placed only where the grid cell is clear of building/anchor/corridor
// (propClear), so furniture never stands inside a tower. Crosswalk arms are gated on the
// road arm actually existing (the anchor may have clipped it away), and power poles are
// placed per-pole with lines drawn only between consecutive placed poles — so a utility
// line can't thread through a building.
function intersectionDoodads(vx, hy, region, swW, streetW, boxes, grounds, elements, rng, grid, major, signalized = true, reserved = [], climate = 'temperate', profile = null) {
  const signalKit = signalized && (profile !== 'town' || major);    // town: stoplights + crosswalks only on the WIDE main street, not residential corners
  if (elements.streetSignals && signalKit) for (const [sx, sy] of [[vx - 1.0, hy - 1.0], [vx + 1.0, hy + 1.0]]) {           // stoplights — signalized tiers only
    if (!propClear(grid, sx, sy)) continue;
    boxes.push({ kind: 'street-signal', x: sx, y: sy, w: 0.14, d: 0.14, z0: 0, z1: 1.9, tint: '#3a3d42' });
    boxes.push({ kind: 'street-signal', x: sx - 0.06, y: sy - 0.05, w: 0.26, d: 0.16, z0: 1.5, z1: 2.06, tint: '#26282b' });
    ['#e0463a', '#e3b13a', '#46c06a'].forEach((c, i) => boxes.push({ kind: 'street-signal', x: sx + 0.01, y: sy - 0.07, w: 0.1, d: 0.04, z0: 1.56 + i * 0.15, z1: 1.66 + i * 0.15, tint: c }));
  }
  if (elements.streetSigns) for (const [sx, sy] of [[vx + 1.0, hy - 1.0], [vx - 1.0, hy + 1.0]]) {           // street signs
    if (!propClear(grid, sx, sy)) continue;
    boxes.push({ kind: 'street-sign', x: sx, y: sy, w: 0.09, d: 0.09, z0: 0, z1: 1.6, tint: '#6b7176' });
    boxes.push({ kind: 'street-sign', x: sx - 0.28, y: sy - 0.03, w: 0.56, d: 0.06, z0: 1.32, z1: 1.52, tint: '#2f7a4a' });
  }
  if (elements.stopSigns) for (const [sx, sy] of [[vx + 1.55, hy - 1.55], [vx - 1.55, hy + 1.55]]) { if (propClear(grid, sx, sy)) stopSign(boxes, sx, sy); }
  if (elements.streetLamps) for (const [sx, sy] of [[vx - 1.8, hy - 1.8], [vx + 1.8, hy - 1.8], [vx - 1.8, hy + 1.8], [vx + 1.8, hy + 1.8]]) {
    if (propClear(grid, sx, sy) && rng() < 0.74) streetLamp(boxes, sx, sy);
  }
  if (elements.cityTrees) for (const [sx, sy] of [[vx - swW * 0.62, hy - swW * 0.9], [vx + swW * 0.62, hy + swW * 0.9], [vx - swW * 0.95, hy + swW * 0.55], [vx + swW * 0.95, hy - swW * 0.55]]) {
    if (treeClear(grid, sx, sy) && rng() < 0.58) cityTree(boxes, sx, sy, rng, climate);   // sidewalk/verge/open ground only — never the carriageway
  }
  if (elements.crosswalks && signalKit) {
    // Continental stripes parallel to the road, just outside the junction box. Each of
    // the four crossings is emitted ONLY if its road arm actually exists past the curb —
    // sample the carriageway centre a little down the arm; if it's not ROAD (anchor clip),
    // skip that crossing so stripes never lead into a wall.
    const half = streetW / 2;                       // curb line: half the road width from centre
    const bandD = 1.1;                              // crosswalk depth along the road
    const u = streetW / 9;                          // stripe == gap width (5 bars + 4 gaps span the road)
    const armRoad = (x, y) => cellAt(grid, x, y) === CLAIM.ROAD;
    for (const dir of [-1, 1]) {                     // crossings of the vertical road, N and S
      if (!armRoad(vx, hy + dir * (half + bandD * 0.5))) continue;
      const y = dir > 0 ? hy + half + 0.15 : hy - half - 0.15 - bandD;
      for (let i = 0; i < 5; i++)                    // bars long in y (along the road), spread across x
        grounds.push({ kind: 'crosswalk-vertical-road-stripe', x: vx - half + i * 2 * u, y, w: u, d: bandD, z: 0.065, fill: '#d6d0bd' });
    }
    for (const dir of [-1, 1]) {                     // crossings of the horizontal road, E and W
      if (!armRoad(vx + dir * (half + bandD * 0.5), hy)) continue;
      const x = dir > 0 ? vx + half + 0.15 : vx - half - 0.15 - bandD;
      for (let i = 0; i < 5; i++)                    // bars long in x (along the road), spread across y
        grounds.push({ kind: 'crosswalk-horizontal-road-stripe', x, y: hy - half + i * 2 * u, w: bandD, d: u, z: 0.065, fill: '#d6d0bd' });
    }
  }
  if (!elements.powerLines || !major) return;                                     // power lines follow the MAIN street only
  const py = hy + swW / 2 - 0.25, top = 3.0, placed = [];                          // power line on the sidewalk verge
  const inReserved = (x, y) => reserved.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d);
  // a wire span [xa,xb] is blocked if any reserved footprint straddling the pole line lies
  // across it — so the line never threads over a landmark plaza/anchor between two poles
  // placed just outside it (the pole gate alone can't catch a plaza narrower than the span).
  const spanBlocked = (xa, xb) => reserved.some((r) => py >= r.y && py <= r.y + r.d && r.x < xb && r.x + r.w > xa);
  for (let x = region.x + 2.5; x < region.x + region.w - 1; x += 6.5) {
    if (!propClear(grid, x, py) || inReserved(x, py)) { placed.push(null); continue; } // skip poles in a building/anchor/reserved plaza
    boxes.push({ kind: 'power-pole', x, y: py, w: 0.16, d: 0.16, z0: 0, z1: top, tint: '#5a4f44' });
    boxes.push({ kind: 'power-pole', x: x - 0.4, y: py - 0.05, w: 0.95, d: 0.07, z0: top - 0.3, z1: top - 0.22, tint: '#4a4138' });
    placed.push(x);
  }
  for (let i = 0; i < placed.length - 1; i++) {                                    // span only between two ADJACENT placed poles
    if (placed[i] == null || placed[i + 1] == null) continue;
    if (spanBlocked(placed[i], placed[i + 1])) continue;                          // …and never across a reserved plaza/anchor between them
    for (const off of [-0.32, 0, 0.32])
      boxes.push({ kind: 'power-line', x: placed[i], y: py + off, w: placed[i + 1] - placed[i], d: 0.035, z0: top - 0.27, z1: top - 0.24, tint: '#202224' });
  }
}

function recurse(region, depth, rootAnchor, rng, boxes, ribbons, grounds, faces, reservedAbove, opts, grid, cars) {
  const reserved = [...reservedAbove];
  let subAnchorFp = null;                                       // a sub-anchor placed THIS level → its cross-streets must flank it
  // 1. anchor (bindu) first — root: explicit; deeper: probabilistic sub-anchor. Both
  //    stamp their footprint ANCHOR so roads/buildings/furniture route around them. A
  //    sub-anchor is now refused if its footprint is already claimed (the hard tram
  //    corridor, or a parent anchor's clipped strip) — it can't be planted on them.
  if (rootAnchor) {
    const enabled = rootAnchor === 'freeway' ? opts.elements.elevatedFreeways : opts.elements.anchorTowers;
    if (enabled) {
      const a = rootAnchor === 'freeway' ? freewayAnchor(region, rng) : towerAnchor(region, rng, true);
      if (opts.baseScale && opts.baseScale !== 1 && rootAnchor === 'tower') shrinkAnchorAbout(a, opts.baseScale, false);   // root tower sized off the enlarged region → footprint needs correcting (height is absolute, scales downstream)
      boxes.push(...a.boxes); if (a.ribbons) ribbons.push(...a.ribbons); reserved.push(a.footprint);
      stampRect(grid, a.footprint, CLAIM.ANCHOR);
    }
  } else if (opts.subAnchors && depth >= 1 && rng() < opts.subAnchorChance) {
    const a = towerAnchor(region, rng, false);
    if (isClear(grid, a.footprint, 0.05)) {
      boxes.push(...a.boxes); reserved.push(a.footprint); stampRect(grid, a.footprint, CLAIM.ANCHOR);
      subAnchorFp = a.footprint;     // this level's cross-streets must FLANK it, not cut across it
    }
  }
  // 2. early-stop OR forced leaf → fill the block. Stopping early on a mid-size region
  //    yields a BIGGER block, so block sizes vary.
  const small = region.w < 11 && region.d < 11;                          // raised ceiling → more single big blocks, room for set-back megatowers
  if (depth <= 0 || region.w < 4.5 || region.d < 4.5 || (small && rng() < (opts.profile === 'town' ? 0.6 : 0.42))) {   // town stops earlier → bigger residential blocks, fewer streets
    fillBlock(region, reserved, rng, boxes, grounds, faces, opts, grid, cars);
    return;
  }
  // 3. the top-down mandala IS the road skeleton: the cross-streets are the gesture lines
  //    of this level. Subdivide with VARIED ratios (non-square blocks), CLAIM the road
  //    right-of-way (verge then carriageway) into the grid, draw the streets, recurse.
  const gap = STREET;
  const major = depth >= opts.maxDepth;                      // the top-level cross is the WIDE main street (town keeps it; its side streets stay narrow)
  const signalized = depth >= opts.maxDepth - 1;             // signal heads + painted crosswalks only on the top tiers; the smallest streets keep their stop signs
  const streetW = gap * (major ? 2.82 : 1.176) * (opts.profile === 'town' ? 0.78 : 1);   // narrower residential carriageway for town (main street still ~2.4× the side streets)
  const swW = streetW + 1.3;                                 // sidewalk (lighter, wider) under each street
  // keep the cross-streets clear of reserved masses at any level whose region still overlaps
  // one — a landmark plaza (inherited via opts.avoid) OR a centred sub-anchor tower placed
  // THIS level — so the mass keeps its budget and sits IN a block instead of being bisected /
  // stranded at the intersection. The clearance is the road's FULL right-of-way half-width
  // (sidewalk included), so the flanking street's sidewalk sits flush against the mass's edge.
  const avoidList = [...(opts.avoid || []), ...(subAnchorFp ? [subAnchorFp] : [])].filter((r) => rectsOverlap(region, r));
  const { quads, vx, hy } = subdivide(region, gap, rng, avoidList, swW / 2);
  // don't fracture into scraps: if this cross would carve off a child too small to host
  // anything (the short-axis cut of an already-shallow region is the usual culprit), keep
  // the parent WHOLE and let fillBlock compose its interior — every block then stays
  // substantial enough to place objects, and small central blocks stop manifesting. A
  // child clipped to ~0 by a landmark is intentional emptiness, not a scrap, so ignore it.
  const MIN_BLOCK = 3.2;
  const isScrap = (q) => (q.w > 0.4 && q.w < MIN_BLOCK) || (q.d > 0.4 && q.d < MIN_BLOCK);
  // A landmark plaza deliberately shoves a cross-street out to flank the monument, which can
  // pin one band thin against the region edge. That sliver is intentional emptiness (it just
  // recurses down to a fillBlock leaf), NOT a fracture to bail on — so the whole-region
  // fallback applies only when no avoid zone forced the geometry.
  if (!avoidList.length && quads.some(isScrap)) {
    fillBlock(region, reserved, rng, boxes, grounds, faces, opts, grid, cars);
    return;
  }
  // claim the right-of-way: verge band (over empty), then carriageway (over empty/verge,
  // never over the anchor) — this is the surface-area budget for these two gestures.
  stampRect(grid, { x: vx - swW / 2, y: region.y, w: swW, d: region.d }, CLAIM.VERGE, [CLAIM.EMPTY]);
  stampRect(grid, { x: region.x, y: hy - swW / 2, w: region.w, d: swW }, CLAIM.VERGE, [CLAIM.EMPTY]);
  stampRect(grid, { x: vx - streetW / 2, y: region.y, w: streetW, d: region.d }, CLAIM.ROAD, [CLAIM.EMPTY, CLAIM.VERGE]);
  stampRect(grid, { x: region.x, y: hy - streetW / 2, w: region.w, d: streetW }, CLAIM.ROAD, [CLAIM.EMPTY, CLAIM.VERGE]);
  if (opts.elements.sidewalks) {
    // clip each walk band out of the reserved footprints (landmark plaza / anchor) it crosses,
    // exactly as pushStreet clips the carriageway — so the gray walk never paves across the
    // monument when shiftLineOut couldn't flank the street clear of it.
    const half = swW / 2;
    const vSpans = bandSpans(region.y, region.y + region.d, vx, half, true, reserved);
    const hSpans = bandSpans(region.x, region.x + region.w, hy, half, false, reserved);
    for (const [s, e] of vSpans) grounds.push({ kind: 'sidewalk', x: vx - half, y: s, w: swW, d: e - s, z: 0.018, fill: '#b0aa9c' });
    for (const [s, e] of hSpans) grounds.push({ kind: 'sidewalk', x: s, y: hy - half, w: e - s, d: swW, z: 0.018, fill: '#b0aa9c' });
    // broad panel joints: light-gray seams running across each walk at a wide spacing — only
    // where the walk band actually survives (never floating over a clipped-out plaza span).
    const JOINT = 2.4;
    for (let yy = region.y + JOINT; yy < region.y + region.d - 0.3; yy += JOINT)
      if (vSpans.some(([s, e]) => yy >= s && yy <= e)) grounds.push({ kind: 'sidewalk-joint', x: vx - half, y: yy, w: swW, d: 0.05, z: 0.02, fill: '#c9c8c3' });
    for (let xx = region.x + JOINT; xx < region.x + region.w - 0.3; xx += JOINT)
      if (hSpans.some(([s, e]) => xx >= s && xx <= e)) grounds.push({ kind: 'sidewalk-joint', x: xx, y: hy - half, w: 0.05, d: swW, z: 0.02, fill: '#c9c8c3' });
  }
  if (opts.elements.roads) {
    const bikeLanes = major && opts.elements.bikeLanes && (opts.profile === 'town' || rng() < 0.72) ? 'outer' : null;   // town's one main street always gets bike lanes (→ cyclists)
    if (major) {
      // a coherent junction: the two streets are drawn as four half-segments that
      // STOP at the curb (so lane lines don't cross through the box) + a plain
      // pavement patch in the box. Every span is clipped out of reserved
      // footprints, so the road never runs under the anchor/buildings.
      const half = streetW / 2, opt = { width: streetW, laneLine: true, lanes: 2, bikeLanes };
      // the junction PATCH is paving, so the whole square must clear reserved zones (propClear
      // tolerates PLAZA, and the patch can spill its half-width into a plaza even when its centre
      // sits just outside) — else a crossing beside a landmark/civic plaza paves into it.
      const patch = { x: vx - half, y: hy - half, w: streetW, d: streetW };
      if (propClear(grid, vx, hy) && !reserved.some((r) => rectsOverlap(patch, r))) grounds.push({ kind: 'junction', ...patch, z: 0.045, fill: '#3a414b' });
      pushStreet(ribbons, [vx, region.y], [vx, hy - half], opt, reserved);
      pushStreet(ribbons, [vx, hy + half], [vx, region.y + region.d], opt, reserved);
      pushStreet(ribbons, [region.x, hy], [vx - half, hy], opt, reserved);
      pushStreet(ribbons, [vx + half, hy], [region.x + region.w, hy], opt, reserved);
      if (opts.elements.cars && !opts.traffic) placeStreetCars(cars, vx, hy, region, streetW, rng, bikeLanes);   // moving cars (traffic) replace the static street ants
      if (bikeLanes && opts.elements.cyclists) placeBikeLaneCyclists(cars, vx, hy, region, streetW);
    } else {
      const opt = { width: streetW, laneLine: false, lanes: 1, bikeLanes };
      pushStreet(ribbons, [vx, region.y], [vx, region.y + region.d], opt, reserved);
      pushStreet(ribbons, [region.x, hy], [region.x + region.w, hy], opt, reserved);
    }
  }
  // dress EVERY junction node (not just the root): each is a real crossing. propClear /
  // armRoad gating keeps furniture on the verge and off the anchor; power lines stay major.
  intersectionDoodads(vx, hy, region, swW, streetW, boxes, grounds, opts.elements, rng, grid, major, signalized, reserved, opts.climate, opts.profile);
  // children inherit the avoid list PLUS this level's sub-anchor, so deeper cross-streets also
  // flank the tower (it sits in a block at every tier, never re-bisected on the way down).
  const childOpts = subAnchorFp ? { ...opts, avoid: [...(opts.avoid || []), subAnchorFp] } : opts;
  for (const q of quads) {
    const qReserved = reserved.map((r) => clipRect(r, q)).filter(Boolean);
    recurse(q, depth - 1, null, rng, boxes, ribbons, grounds, faces, qReserved, childOpts, grid, cars);
  }
}

// Uniformly scale a generated scene about the region's origin corner by factor `s` (a similarity
// transform — every internal ratio street:block / prop:building / height:footprint is preserved
// exactly). Used by the `baseScale` knob: a city generated in an ENLARGED region is scaled back
// DOWN to read identically to the default city, just with proportionally MORE, smaller blocks in
// the same frame. Mutates the arrays in place. Geometric fields audited against the consumers in
// scene-css3d (boxes/grounds x,y,w,d,z*; ribbons path+width+z0,z1; faces corners[x,y,z]).
function scaleSceneAbout(origin, s, { boxes, grounds, ribbons, faces }) {
  const ox = origin.x, oy = origin.y;
  const px = (x) => ox + (x - ox) * s, py = (y) => oy + (y - oy) * s;
  for (const b of boxes) {
    b.x = px(b.x); b.y = py(b.y); b.w *= s; b.d *= s;
    if (typeof b.z0 === 'number') b.z0 *= s;
    if (typeof b.z1 === 'number') b.z1 *= s;
  }
  for (const g of grounds) {
    g.x = px(g.x); g.y = py(g.y); g.w *= s; g.d *= s;
    if (typeof g.z === 'number') g.z *= s;
  }
  for (const r of ribbons) {
    if (Array.isArray(r.path)) r.path = r.path.map(([x, y]) => [px(x), py(y)]);
    if (typeof r.width === 'number') r.width *= s;
    if (typeof r.z0 === 'number') r.z0 *= s;
    if (typeof r.z1 === 'number') r.z1 *= s;
  }
  for (const f of faces) {
    if (Array.isArray(f.corners)) f.corners = f.corners.map(([x, y, z]) => [px(x), py(y), z * s]);
  }
}

// Pre-shrink a ROOT anchor's footprint (and, for footprint-relative masses, its height) about its
// own centre by `s`, so it scales UNIFORMLY with the rest of the city under the baseScale output
// transform. A root anchor is sized as a fraction of the (baseScale-ENLARGED) generation region,
// which would otherwise leave its footprint invariant under the output scale — for the generic
// tower (absolute height) that means a SQUAT tower; for a landmark (footprint-relative height) it
// means a monument that never shrinks. Pre-shrinking the footprint by `s` here cancels the region
// enlargement so the output scale lands the anchor at `s`× the default — preserving the default
// city's anchor:block ratio. `withHeight` also scales z (use for footprint-relative masses like a
// landmark; leave false for the tower, whose absolute height already scales correctly downstream).
// No-op semantics live at the call sites (only invoked when s !== 1). Sub-anchors need no
// correction: they are sized to a recursively-subdivided quad, which already scales with baseScale.
function shrinkAnchorAbout(anchor, s, withHeight) {
  const fp = anchor.footprint;
  const cx = fp.x + fp.w / 2, cy = fp.y + fp.d / 2;
  const sh = (r) => {
    r.x = cx + (r.x - cx) * s; r.y = cy + (r.y - cy) * s; r.w *= s; r.d *= s;
    if (withHeight) { if (typeof r.z0 === 'number') r.z0 *= s; if (typeof r.z1 === 'number') r.z1 *= s; }
  };
  for (const b of anchor.boxes) sh(b);
  sh(fp);
}

/**
 * Plan a fractal city.
 * @param {object} o
 * @param {{x,y,w,d}} o.region  world footprint of the whole scene
 * @param {number}    o.depth   quadrant recursion depth (2 → 16 leaf cells)
 * @param {number}    o.baseScale  object size vs. the (fixed) region; default 1. <1 SHRINKS every
 *   object while the region + camera stay put → proportionally MORE, smaller blocks in the same
 *   frame ("zoom out, show more"). A uniform similarity transform, so all relative scale is kept.
 * @param {number}    o.seed
 * @param {'tower'|'freeway'|null} o.anchor  root anchor manji (null → no anchor: each area self-generates)
 * @param {boolean}   o.subAnchors  allow probabilistic sub-anchors per quadrant
 * @param {string|string[]|null} o.landmark  one named landmark shape, or an array of them
 *   for an adjacent CLUSTER (taj | cn-tower | skytree | rogers-centre | skydome). The
 *   monument(s) become the city's root anchor — sized to their real ground footprint and
 *   RESERVED on the grid before roads, so the streets route around them. e.g.
 *   ['rogers-centre', 'cn-tower'] places the Toronto pair side by side.
 * @returns {{ boxes, grounds, stats }}
 */
// ── ambient-walker loop planner (city/walkers.plan.md P1) ──────────────────────────────
// Grid-validated CLOSED sidewalk/plaza rings for the `walkers` channel. Seeded off the city
// seed, additive, and run only when opted in — a walkers-off city never calls this and is
// byte-identical. Each loop is a rounded rectangle whose whole band sits on PED_SURFACE
// (verge + plaza), grown from a walkable seed until its perimeter would leave the walkable
// area (so it hugs a block's sidewalk ring or fills an open plaza). Paths are in city units
// (z on the ground) — the same space as the static pedestrians.
const WALKER_LOOP_KINDS = new Set(['building', 'anchor', 'townhouse', 'house', 'midtower', 'garage']);
const WALKER_SOLID = new Set([CLAIM.BUILDING, CLAIM.ANCHOR, CLAIM.LOT]);   // masses a walker must never cross
function planCityWalkerLoops(grid, region, seed, opt, boxes) {
  const o = (opt && typeof opt === 'object') ? opt : {};
  const want = Math.max(1, Math.min(24, Number.isFinite(o.count) ? o.count : 8));
  const cell = grid.cell;
  const rng = mulberry32(((seed >>> 0) ^ 0x51ed2701) >>> 0);
  const band = cell;   // the ring edge is a one-cell-thick band (a verge is ~1 cell wide)
  // per-edge cell census of a ring [cx±hw, cy±hh]: how much of it is sidewalk (verge/plaza) vs. a solid
  // mass (building/anchor/lot). A loop is followed BLINDLY (ambient decoration, no runtime collision),
  // so the ONLY hard rule is it must never cross a building; brushing a road at a corner reads as a
  // pedestrian crossing the street. So we accept a ring that clears every solid mass AND rides mostly
  // on real sidewalk — not one that is 100% verge (blocks rarely have an unbroken sidewalk ring).
  const ringStats = (cx, cy, hw, hh) => {
    const rects = [
      { x: cx - hw, y: cy - hh, w: 2 * hw, d: band },        // south
      { x: cx - hw, y: cy + hh - band, w: 2 * hw, d: band },  // north
      { x: cx - hw, y: cy - hh, w: band, d: 2 * hh },        // west
      { x: cx + hw - band, y: cy - hh, w: band, d: 2 * hh },  // east
    ];
    let tot = 0, ped = 0, solid = 0;
    for (const r of rects) {
      const { c0, c1, r0, r1 } = gridCells(grid, r);
      for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) {
        const v = grid.data[rr * grid.cols + c]; tot++;
        if (PED_SURFACE.has(v)) ped++; else if (WALKER_SOLID.has(v)) solid++;
      }
    }
    return { tot, pedFrac: tot ? ped / tot : 0, solid };
  };
  const ok = (cx, cy, hw, hh) => { const s = ringStats(cx, cy, hw, hh); return s.tot > 0 && s.solid === 0 && s.pedFrac >= 0.35; };
  const cands = [];
  // PRIMARY: a sidewalk ring around each block, the footprint pushed OUT into its fronting verge. Try a
  // few offsets and keep the first that clears the neighbours + rides the sidewalk.
  for (const b of (boxes || [])) {
    if (!b || !(b.w > 0) || !(b.d > 0) || !WALKER_LOOP_KINDS.has(b.kind)) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
    for (const off of [cell, cell * 1.5, cell * 2, cell * 2.5, cell * 3]) {
      const hw = b.w / 2 + off, hh = b.d / 2 + off;
      if (ok(cx, cy, hw, hh)) { cands.push({ cx, cy, hw, hh, area: hw * hh }); break; }
    }
  }
  // FALLBACK: inscribe + grow rings in open walkable areas (plazas), for strolls with no block to hug.
  const MINH = cell * 3, MAXH = Math.min(region.w, region.d) * 0.3, GROW = cell;
  const step = Math.max(cell * 4, Math.min(region.w, region.d) / 8);
  for (let sy = region.y + step * 0.5; sy < region.y + region.d; sy += step)
    for (let sx = region.x + step * 0.5; sx < region.x + region.w; sx += step) {
      if (!ok(sx, sy, MINH, MINH)) continue;
      let hw = MINH, hh = MINH;
      while (hw + GROW < MAXH && ok(sx, sy, hw + GROW, hh)) hw += GROW;
      while (hh + GROW < MAXH && ok(sx, sy, hw, hh + GROW)) hh += GROW;
      cands.push({ cx: sx, cy: sy, hw, hh, area: hw * hh });
    }
  // biggest loops first (they read best), spaced apart so they don't overlap, capped at `want`.
  cands.sort((a, b) => b.area - a.area);
  const loops = [], taken = [];
  for (const c of cands) {
    if (loops.length >= want) break;
    if (taken.some(([tx, ty, tr]) => Math.hypot(tx - c.cx, ty - c.cy) < (tr + Math.max(c.hw, c.hh)) * 0.5)) continue;
    rng();   // one draw per accepted loop keeps selection seed-varying without perturbing geometry
    loops.push({ path: roundedRingPath(c.cx, c.cy, c.hw, c.hh, Math.min(c.hw, c.hh) * 0.3), style: 'bumble' });
    taken.push([c.cx, c.cy, Math.max(c.hw, c.hh)]);
  }
  return loops;
}
// closed rounded-rectangle polyline (city units, z on ground): straight sides + quarter-arc corners
// sampled so the walker's tangent heading turns smoothly instead of snapping 90° at each corner.
function roundedRingPath(cx, cy, hw, hh, r) {
  r = Math.max(0, Math.min(r, hw, hh));
  const K = 5, Z = 0.02, pts = [];
  const corners = [
    { ox: cx + hw - r, oy: cy + hh - r, a0: 0 },                 // NE
    { ox: cx - hw + r, oy: cy + hh - r, a0: Math.PI / 2 },       // NW
    { ox: cx - hw + r, oy: cy - hh + r, a0: Math.PI },           // SW
    { ox: cx + hw - r, oy: cy - hh + r, a0: 3 * Math.PI / 2 },   // SE
  ];
  for (const c of corners)
    for (let i = 0; i <= K; i++) { const a = c.a0 + (i / K) * (Math.PI / 2); pts.push([c.ox + r * Math.cos(a), c.oy + r * Math.sin(a), Z]); }
  pts.push([pts[0][0], pts[0][1], Z]);   // repeat the first point → seamless closed loop
  return pts;
}

// ── ambient-traffic lane planner (the driver-ants: moving cars) ─────────────────────────
// Read the FINAL grid (post-recurse, like the walker-loop planner) and extract the MAIN AVENUES as
// two-lane pacman corridors for the `cars` channel. A road corridor is a band of CLAIM.ROAD cells that
// spans the region (a full-length avenue); each becomes TWO opposing lanes, offset either side of the
// centre-line. Which lane travels which way is the driving-side convention (right-hand default; left
// flips it) — so a two-way road has cars going opposite directions, and a left-hand city drives on the
// left. Lane paths are authored in TRAVEL order (so the car's tangent heading = its direction) and
// extended a little past the region edge so the pacman wrap pops off-screen. City units, z on the road.
const CAR_LANE_Z = 0.06;
function planCityCarLanes(grid, region, opt) {
  const o = (opt && typeof opt === 'object') ? opt : {};
  const side = o.side === 'left' ? -1 : 1;         // right-hand traffic by default
  const cell = grid.cell, cols = grid.cols, rows = grid.rows;
  const isRoad = (c, r) => grid.data[r * cols + c] === CLAIM.ROAD;
  const margin = cell * 8;                          // extend lanes past the edge so the wrap is off-screen
  // collect road BANDS along one axis: consecutive lines (rows or cols) that are mostly road spanning
  // the region → { c: centre line index, w: thickness (cells), lo/hi: road extent along the line }.
  const bandsAlong = (vertical) => {
    const nLines = vertical ? cols : rows, nCross = vertical ? rows : cols;
    const lineFrac = [];
    for (let l = 0; l < nLines; l++) {
      let n = 0; for (let k = 0; k < nCross; k++) { const c = vertical ? l : k, r = vertical ? k : l; if (isRoad(c, r)) n++; }
      lineFrac.push(n / nCross);
    }
    const bands = []; let s = -1;
    for (let l = 0; l <= nLines; l++) {
      const on = l < nLines && lineFrac[l] > 0.5;   // this line is a road (spans >half the region)
      if (on && s < 0) s = l; else if (!on && s >= 0) { bands.push([s, l - 1]); s = -1; }
    }
    return bands.map(([a, b]) => {
      const mid = Math.round((a + b) / 2);
      // road extent along the mid line (first→last road cell, the avenue's span)
      let lo = -1, hi = -1;
      for (let k = 0; k < nCross; k++) { const c = vertical ? mid : k, r = vertical ? k : mid; if (isRoad(c, r)) { if (lo < 0) lo = k; hi = k; } }
      return { mid, w: (b - a + 1), lo, hi };
    }).filter((bd) => bd.lo >= 0 && bd.hi > bd.lo);
  };
  const hBands = bandsAlong(false), vBands = bandsAlong(true);
  // keep only the MAIN avenues: the widest bands (the top-tier cross is ~2.4× a side street). Adaptive
  // so it works across seeds/regions; a side street that happens to span the region is dropped.
  const maxW = Math.max(1, ...hBands.map((b) => b.w), ...vBands.map((b) => b.w));
  const keep = (bd) => bd.w >= 0.55 * maxW;
  const lanes = [];
  const laneOffOf = (wCells) => Math.max(cell, wCells * cell * 0.22);   // half-lane offset from the centre
  const wx = (c) => grid.x0 + (c + 0.5) * cell, wy = (r) => grid.y0 + (r + 0.5) * cell;
  for (const b of hBands) {   // horizontal avenue (travel along x)
    if (!keep(b)) continue;
    const cy = wy(b.mid), off = laneOffOf(b.w), lo = wx(b.lo) - margin, hi = wx(b.hi) + margin;
    // right-hand: the south lane (lower y) travels +x, the north lane −x (left flips it)
    lanes.push({ axis: 'x', cross: cy - off, lo, hi, dir: side });
    lanes.push({ axis: 'x', cross: cy + off, lo, hi, dir: -side });
  }
  for (const b of vBands) {   // vertical avenue (travel along y)
    if (!keep(b)) continue;
    const cx = wx(b.mid), off = laneOffOf(b.w), lo = wy(b.lo) - margin, hi = wy(b.hi) + margin;
    // right-hand: the east lane (higher x) travels +y, the west lane −y
    lanes.push({ axis: 'y', cross: cx + off, lo, hi, dir: side });
    lanes.push({ axis: 'y', cross: cx - off, lo, hi, dir: -side });
  }
  return lanes;
}
// a lane spec → a straight pacman path [[x,y,z]...] authored in TRAVEL order (so the car faces its dir).
export function carLaneToPath(L) {
  const z = CAR_LANE_Z;
  const a = L.dir >= 0 ? L.lo : L.hi, b = L.dir >= 0 ? L.hi : L.lo;
  return L.axis === 'x' ? [[a, L.cross, z], [b, L.cross, z]] : [[L.cross, a, z], [L.cross, b, z]];
}

// anchor default is `null` (a plain city), NOT 'tower' — a giant central landmark must be OPT-IN via
// an explicit anchor:'tower'|'freeway'. This keeps the generator default aligned with the mint default
// (mintFractalCity) + the theme adapter's intent, so a recipe that merely OMITS `anchor` can never
// silently grow a tower in the middle of the streets (the default-drift bug, city/walkers.plan.md).
export function planFractalCity({ region = { x: 2, y: 2, w: 30, d: 18 }, depth = 2, seed = 1, anchor = null, subAnchors = true, density = 0.58, subAnchorChance = 0.4, elements, locale = null, landmark = null, civicAreas = null, climate = 'temperate', baseScale = 1, profile = 'city', people = null, walkers = null, traffic = null } = {}) {
  const rng = mulberry32(seed >>> 0 || 1);
  // baseScale (<1) SHRINKS every object while the frame stays fixed → proportionally MORE, smaller
  // blocks in the same scene. Implemented as a similarity transform: generate in an ENLARGED region
  // (region / baseScale), then scale the whole output back DOWN by baseScale about the region origin
  // (see scaleSceneAbout below). Because it is a uniform scale every internal ratio is preserved, so
  // the harmony of the default city is kept exactly. baseScale === 1 leaves region + RNG stream
  // untouched → byte-identical to the un-scaled generator (every existing seed reproduces).
  const bs = Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1;
  const frameOrigin = { x: region.x, y: region.y };
  if (bs !== 1) region = { x: region.x, y: region.y, w: region.w / bs, d: region.d / bs };
  const recipeElements = normalizeFractalCityElements(elements);
  if (isEuropeanLocale(locale) && !elementExplicitlyFalse(elements, 'townhouses')) recipeElements.townhouses = true;
  if (profile === 'town' && !elementExplicitlyFalse(elements, 'townhouses')) recipeElements.townhouses = true;   // town mixes detached houses with townhouse rows
  if (profile === 'town' && !elementExplicitlyFalse(elements, 'cyclists')) recipeElements.cyclists = true;       // riders populate the main street's bike lanes
  const boxes = [];
  const ribbons = [];
  const faces = [];                                            // first-class CSS3D vehicles (cars), emitted as raw faces
  const cars = [];                                             // deferred vehicle INTENTS → grid-checked in a final pass
  const grounds = [{ x: region.x - 1, y: region.y - 1, w: region.w + 2, d: region.d + 2, z: 0, fill: '#4a4d47' }];
  const grid = makeGrid(region);                              // the single surface-area budget — every claim stamps here
  // STREETCAR (opt-in): a corridor boulevard runs straight down the region's longer
  // axis with the track uninterrupted; its strip is claimed (CORRIDOR) so the rest of the
  // city — including the root anchor and any sub-anchor — is generated around it.
  const seedReserved = [];
  const landmarks = normalizeLandmarks(landmark);
  let corridor = null;
  let anchorRegion = region;                                   // where the root anchor sits — whole region, or one side of a boulevard
  if (recipeElements.streetcars) {
    const horizontal = region.w >= region.d;
    corridor = cityStreetcarCorridor(region, rng);
    seedReserved.push({ ...corridor.footprint, hard: true });
    stampRect(grid, corridor.footprint, CLAIM.CORRIDOR);
    anchorRegion = sideRegionAvoiding(region, corridor.footprint, horizontal ? 'x' : 'y');
  }
  // ROOT ANCHOR, RESERVED BEFORE ROADS. A landmark (or landmark CLUSTER, e.g. CN Tower +
  // Rogers Centre) takes the anchor role, sized to its real ground footprint; otherwise the
  // generic tower/freeway. Either way the footprint is stamped CLAIM.ANCHOR up front so the
  // road glyph (and everything else) routes around it — the landmark gets its surface-area
  // budget instead of being slotted in after the streets are already drawn.
  let placedRootAnchor = false;
  let landmarkZone = null;                                     // reserved plaza footprint → roads avoid it (opts.avoid)
  if (landmarks.length && recipeElements.anchorTowers && anchorRegion.w > 4 && anchorRegion.d > 4) {
    // Budget off the FULL region and take NO baseScale pre-shrink: a landmark's
    // LANDMARK_FOOTPRINT is its REAL surface-area budget, so under baseScale (<1) the
    // monuments stay frame-true while only the generic fabric densifies — the plaza
    // reservation displaces blocks/props to pay for it. (The generic tower below keeps
    // its pre-shrink: it has no real-world budget to honour.)
    const la = landmarkAnchor(anchorRegion, landmarks, true, region);
    boxes.push(...la.boxes); seedReserved.push({ ...la.footprint, hard: true });
    stampRect(grid, la.footprint, CLAIM.PLAZA);              // claim the whole plaza (incl. the ring) so nothing builds on it
    // the monument BASES are a hard claim, not plaza: PLAZA is a TREE_SURFACE (so the civic
    // ring can hold trees), but a tree must never sprout up through a monument itself.
    for (const b of la.boxes) stampRect(grid, b, CLAIM.ANCHOR, [CLAIM.PLAZA]);
    grounds.push({ kind: 'landmark-plaza', x: la.footprint.x, y: la.footprint.y, w: la.footprint.w, d: la.footprint.d, z: 0.02, fill: '#bdbcae' });
    landmarkZone = la.footprint;
    placedRootAnchor = true;
  } else if (corridor && anchor && (anchor === 'freeway' ? recipeElements.elevatedFreeways : recipeElements.anchorTowers) && anchorRegion.w > 4 && anchorRegion.d > 4) {
    const a = anchor === 'freeway' ? freewayAnchor(anchorRegion, rng) : towerAnchor(anchorRegion, rng, true);
    if (bs !== 1 && anchor === 'tower') shrinkAnchorAbout(a, bs, false);   // tower height is absolute (scales downstream); only its footprint needs correcting
    boxes.push(...a.boxes); if (a.ribbons) ribbons.push(...a.ribbons); seedReserved.push(a.footprint);
    stampRect(grid, a.footprint, CLAIM.ANCHOR);
    placedRootAnchor = true;
  }
  // CIVIC AREAS, RESERVED BEFORE ROADS too. Each requested district (town-square / school /
  // strip-mall) claims a distinct slice — far from the centre so it composes WITH a centred
  // landmark — and joins seedReserved, so roads / sidewalks / power / trees route around it
  // exactly like the monument. Built from existing primitives, so no bespoke render.
  const civicKinds = normalizeCivicAreas(civicAreas);
  const placedCivicAreas = civicKinds.length
    ? placeCivicAreas(anchorRegion, civicKinds, grid, rng, boxes, grounds, faces, { elements: recipeElements, locale, climate }, cars, seedReserved)
    : 0;
  // recurse plants the root tower ONLY if we didn't already place an anchor (landmark or
  // corridor-side) and there's no corridor — preserving the original centred-tower path.
  const recurseRoot = (placedRootAnchor || corridor) ? null : (anchor || null);
  recurse(region, depth, recurseRoot, rng, boxes, ribbons, grounds, faces, seedReserved, { density, elements: recipeElements, locale, climate, subAnchors: subAnchors && recipeElements.subAnchors && recipeElements.anchorTowers, subAnchorChance, maxDepth: depth, avoid: landmarkZone ? [landmarkZone] : [], baseScale: bs, profile, traffic }, grid, cars);
  if (corridor) { ribbons.push(...corridor.ribbons); boxes.push(...corridor.boxes); grounds.push(...corridor.grounds); faces.push(...corridor.faces); }
  // FINAL CAR PASS: emit each deferred vehicle only if its lane/stall cell is actually
  // the right surface — ROAD for street ants, LOT for parked ants. This is what makes the
  // recursion ORDER not matter: a car decided at the root survives only if no anchor /
  // sub-anchor / corridor decided later claimed the cell it sits on.
  // TOWN keeps fewer vehicles in the budget — a residential street is calm — and runs NO TRUCKS
  // (cars / buses / cyclists only). Deterministic index subsample, so it never perturbs the city
  // stream (city iterates all, no exclude).
  const carPass = profile === 'town' ? cars.filter((_, i) => i % 2 === 0) : cars;
  const carExclude = profile === 'town' ? ['truck'] : undefined;
  for (const it of carPass) {
    const need = it.context === 'lot' ? CLAIM.LOT : CLAIM.ROAD;   // bike-lane cyclists ride on ROAD
    const isBike = it.context === 'bike';
    const len = (isBike ? 0.62 : 1.7) * it.scale, wid = (isBike ? 0.22 : 0.8) * it.scale;  // a cyclist's footprint is far smaller than a car's
    const carRect = it.axis === 'y'
      ? { x: it.cx - wid / 2, y: it.cy - len / 2, w: wid, d: len }
      : { x: it.cx - len / 2, y: it.cy - wid / 2, w: len, d: wid };
    if (!rectAllClaim(grid, carRect, need)) continue;          // AREA test: the WHOLE car must sit on road/lot, no nosing into a tower
    faces.push(...vehicleAntFaces({ rng, context: it.context, exclude: carExclude, cx: it.cx, cy: it.cy, axis: it.axis, dir: it.dir, scale: it.scale }));
  }
  // PEDESTRIAN GROUPS: scatter solo/duo/family clusters onto the now-final walkable grid
  // (verge + plaza). Additive + seed-deterministic; runs after vehicles, before the scene
  // scale-down so people shrink with everything else (like cars).
  if (people) placePedestrianGroups(region, grid, people, faces, seed);
  // AMBIENT-WALKER LOOPS (city/walkers.plan.md): grid-validated closed rings for the `walkers`
  // channel, planned off the now-final walkable grid. Opt-in only (null ⇒ untouched); paths ride
  // the output scale-down below, exactly like the faces + static people.
  const walkerLoops = walkers ? planCityWalkerLoops(grid, region, seed, walkers, boxes) : null;
  // AMBIENT TRAFFIC (driver-ants): main-avenue lanes for moving cars, read off the final road grid.
  const carLanes = traffic ? planCityCarLanes(grid, region, traffic) : null;
  // LEFTOVER LAYER: the still-EMPTY cells, flood-filled into tagged components. Emitted as
  // ground tiles (pocket → planted green, gore → neutral plaza) so the void a clipped /
  // (phase-2) curved network leaves reads as deliberate open space, not a hole.
  const { components: leftover, tiles: leftoverTiles } = leftoverComponents(grid);
  const bigLeftover = leftover.filter((c) => c.area >= 0.5);
  const bigTags = new Set(bigLeftover.map((c) => c.tag));      // skip crumb-only tags
  for (const t of leftoverTiles) {
    if (!bigTags.has(t.tag)) continue;
    grounds.push({ kind: `leftover-${t.tag}`, x: t.x, y: t.y, w: t.w, d: t.d, z: 0.022, fill: t.tag === 'pocket' ? '#3c5a3a' : '#54514a', leftover: t.tag });
  }
  // PARK DOODADS: bins / benches / playgrounds scattered onto the planted (pocket) green.
  // Runs AFTER the grass tiles are laid so claimed footprints never punch holes in the lawn.
  if (recipeElements.parkDoodads) scatterParkDoodads(leftover, grid, boxes, grounds, faces, rng);
  // RELIGIOUS PLACE (church): one-per-scene, locale-gated. Runs AFTER the city is laid so
  // it re-tags an existing (road-clear) building; the `&&` short-circuits before any rng
  // draw when off / locale-less.
  const religiousPlaces = (recipeElements.religiousPlaces && seedReligiousPlace(boxes, locale, rng)) || 0;
  // CIVIC DOMES (rotundas): opt-in, re-tags a few of the largest plain buildings. Runs LAST
  // (after the church) so its rng draws never perturb any byte-identical seed; the `&&`
  // short-circuits before any draw when off.
  const civicDomes = (recipeElements.civicDomes && seedCivicDomes(boxes, rng)) || 0;
  // OUTPUT SCALE-DOWN: shrink the whole (enlarged-region) scene back into the original frame. Runs
  // after every box/ground/ribbon/face exists and before lampSources(boxes), so the derived light
  // sources read the scaled lamp-head positions.
  if (bs !== 1) scaleSceneAbout(frameOrigin, bs, { boxes, grounds, ribbons, faces });
  // walker paths aren't in the face sets scaleSceneAbout touches — apply the SAME shrink so a
  // baseScale<1 city's loops stay aligned with the streets they ride.
  if (walkerLoops && bs !== 1) for (const L of walkerLoops) L.path = L.path.map((p) => [frameOrigin.x + (p[0] - frameOrigin.x) * bs, frameOrigin.y + (p[1] - frameOrigin.y) * bs, p[2] * bs]);
  // car lanes ride the same output shrink (a lane's cross/lo/hi are city coords about frameOrigin).
  if (carLanes && bs !== 1) for (const L of carLanes) {
    const fx = frameOrigin.x, fy = frameOrigin.y, f = L.axis === 'x' ? fy : fx, o = L.axis === 'x' ? fx : fy;
    L.cross = f + (L.cross - f) * bs; L.lo = o + (L.lo - o) * bs; L.hi = o + (L.hi - o) * bs;
  }
  const stats = {
    boxes: boxes.length,
    ribbons: ribbons.length,
    anchors: boxes.filter((b) => b.kind === 'anchor').length,
    freeway: boxes.some((b) => b.kind === 'pillar'),
    buildings: boxes.filter((b) => b.kind === 'building').length,
    townhouses: boxes.filter((b) => b.kind === 'townhouse').length,
    streetcar: boxes.some((b) => b.kind === 'tram-pole'),
    religiousPlaces,
    civicDomes,
    landmarks: boxes.filter((b) => b.class === 'landmark').length,   // monuments placed as the reserved root anchor
    civicAreas: placedCivicAreas,                                    // reserved districts (town-square/school/strip-mall) actually placed
    civicAreasSkipped: civicKinds.length - placedCivicAreas,         // requested but couldn't fit clear → skipped (no silent truncation)
    leftover: leftover.filter((c) => c.area >= 0.5).length,
    leftoverArea: Math.round(leftover.reduce((a, c) => a + c.area, 0) * bs * bs * 100) / 100,   // gen-space area → frame-space (×baseScale²)
    parkDoodads: boxes.filter((b) => b.kind === 'park-bin' || b.kind === 'park-bench' || (b.kind && b.kind.startsWith('play-'))).length,
  };
  return { boxes, grounds, ribbons, faces, sources: lampSources(boxes), stats, elements: recipeElements, locale, ...(walkerLoops ? { walkerLoops } : {}), ...(carLanes ? { carLanes } : {}) };
}

// Derive light SOURCES from the warm lamp HEADS the generator already places — each
// street/freeway lamp becomes a downward warm cone for the night diffusion bake. The
// generator emitted the geometry; this just reads the heads back as emitters.
function lampSources(boxes) {
  const sources = [];
  for (const b of boxes) {
    const at = (s) => sources.push({ pos: [b.x + b.w / 2, b.y + b.d / 2, b.z0], dir: [0, 0, -1], ...s });
    if (b.kind === 'street-lamp' && b.tint === '#f0d982') at({ spread: 66, color: [1, 0.78, 0.44], intensity: 2.6, rays: 72, bounces: 1, glowBlur: 22, glowSpread: 10, fixtureR: 0.2 });
    else if (b.kind === 'freeway-lamp' && b.tint === '#f2d18a') at({ spread: 72, color: [1, 0.8, 0.5], intensity: 2.3, rays: 56, bounces: 1, glowBlur: 18, glowSpread: 8, fixtureR: 0.16 });
  }
  return sources;
}

const FRACTAL_CAMERAS = [
  { name: 'street', worldFraming: { cameraPosition: [-7, 31, 9], lookAt: [16, 8, 5], horizontalFov: 82, pictureCenter: [560, 390] } },
  { name: 'aerial', worldFraming: { cameraPosition: [16, -9, 27], lookAt: [16, 11, 1], horizontalFov: 60, pictureCenter: [560, 390] } },
];

const NIGHT_DIFFUSION = { soft: true, gain: 2.6, softness: 1.0, shadows: true, shadowStrength: 1.15, shadowMaxAlpha: 0.5 };
const DAY_DIFFUSION = { soft: true, gain: 1.9, softness: 1.05, shadows: true, shadowStrength: 1.0, shadowMaxAlpha: 0.4 };
const DEFAULT_REGION = { x: 2, y: 2, w: 30, d: 18 };

// the DAY sun: one external warm source high above + to the side, aimed at the city
// centre — its traced rays light the rooftops/streets and cast building shadows.
function daySun(region) {
  const cx = region.x + region.w / 2, cy = region.y + region.d / 2;
  const sx = region.x + region.w * 1.0, sy = region.y - region.d * 0.55, sz = 36;
  const dx = cx - sx, dy = cy - sy, dz = -sz, dl = Math.hypot(dx, dy, dz) || 1;
  return { pos: [sx, sy, sz], dir: [dx / dl, dy / dl, dz / dl], spread: 40, color: [1, 0.95, 0.82], intensity: 2.5, rays: 440, bounces: 1, fixture: false };
}

/**
 * Plan + render a fractal city as self-contained preserve-3d HTML.
 * `opts.time` ('day' | 'night') — or `opts.day` / `opts.night` — selects the
 * daylight setting: a DAY sun (rooftops lit + building shadows + day sky) or a NIGHT
 * scene (streetlamp sources + moonlight + starry sky). `opts.maxLamps` caps the night
 * bake on dense cities.
 */
// ── INSTANCED STREET FURNITURE (renderer-convergence.plan.md, 1b) ────────────────────────────
// Fixed-geometry furniture classes (lamp poles/arms/heads, sign posts, park bins/benches,
// tram poles, …) repeat identically across a city modulo translation. With `instancing: true`
// on the manifest, eligible boxes leave the flat face soup and ship as ONE realized template +
// N position transforms (the `repeats` payload channel) — the biggest copy-count win the
// channel was built for. Eligibility is by SIGNATURE (kind + dims + tint), not a curated kind
// list, restricted to plain-branch boxes (no facade/shape/roof/curtainwall — those realize
// bespoke geometry). Trees/palms stay expanded: each carries its own `plant` spec (individuals
// by design). APPROXIMATE by declaration: the template freezes the first instance's shading
// (cityBox's camera-facing lit asymmetry is per-position), so instancing only engages in the
// PLAIN lighting mode — night/day diffusion, moonlight, and groundShadows are all
// position-dependent bakes the template cannot carry; under any of them furniture stays
// expanded (recorded in `repeatsInfo.disabled`, never silent).
const FURNITURE_MIN_COPIES = 6;
const FURNITURE_SPECIAL_KINDS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house', 'garage']);
function extractFurnitureRepeats(boxes) {
  const bySig = new Map();
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b || typeof b.kind !== 'string' || FURNITURE_SPECIAL_KINDS.has(b.kind)) continue;
    if (b.shape || b.roof || b.curtainwall || b.facade || b.plant || b.class) continue;
    const sig = `${b.kind}|${b.w.toFixed(6)}|${b.d.toFixed(6)}|${(b.z0 || 0).toFixed(6)}|${b.z1.toFixed(6)}|${b.tint || ''}`;
    (bySig.get(sig) || bySig.set(sig, []).get(sig)).push(i);
  }
  const drop = new Set();
  const groups = [];
  const skipped = [];
  for (const [sig, idx] of bySig) {
    const kind = sig.slice(0, sig.indexOf('|'));
    if (idx.length < FURNITURE_MIN_COPIES) { skipped.push({ kind, sig, count: idx.length }); continue; }
    const b0 = boxes[idx[0]];
    groups.push({
      name: `furniture:${kind}:${groups.length}`,
      // template centred at the XY origin; z stays absolute (ground-mounted furniture)
      template: { ...b0, x: -b0.w / 2, y: -b0.d / 2 },
      transforms: idx.map((i) => ({ pos: [boxes[i].x + boxes[i].w / 2, boxes[i].y + boxes[i].d / 2, 0] })),
    });
    for (const i of idx) drop.add(i);
  }
  return { boxes: drop.size ? boxes.filter((_, i) => !drop.has(i)) : boxes, groups, skipped };
}

export function assembleFractalCityScene(opts = {}) {
  const plan = planFractalCity(opts);
  let { boxes, grounds, ribbons, faces } = plan;
  // opt-in real-mullion curtainwall reveal on the plain glass towers (not townhouses/landmarks/
  // shaped masses, which carry their own form). `curtainwall` may be true or an opts object.
  if (opts.curtainwall) {
    const CW = new Set(['building', 'anchor', 'midtower']);
    boxes = boxes.map((b) => (CW.has(b.kind) && !b.shape ? { ...b, curtainwall: opts.curtainwall } : b));
  }
  // UNSHADED (GI-bake raw-albedo export): the city normally shades its own faces via
  // scaleHex(tint, litFactor(n, L)) + baked diffusion/moonlight/ground-shadows. For a clean GI
  // base we force plain daylight-free lighting with FLAT_LIGHT (litFactor ≡ 1 ⇒ fill = raw tint)
  // and skip every baked-lighting pass, so Blender's GI is the ONLY lighting. Fixed material
  // tints (glass 0.62 etc.) stay — those are albedo, not directional shading.
  const unshaded = opts.unshaded === true;
  const time = unshaded ? null : (opts.time || (opts.night ? 'night' : opts.day ? 'day' : null));
  const night = time === 'night', day = time === 'day';
  const region = opts.region || DEFAULT_REGION;
  let sources = unshaded ? [] : (night ? (opts.sources || plan.sources) : day ? [daySun(region)] : (opts.sources || []));
  const cap = opts.maxLamps ?? 20;                              // sample lamps down so the night bake stays bounded
  if (night && sources.length > cap) sources = Array.from({ length: cap }, (_, i) => sources[Math.floor(i * (sources.length / cap))]);
  // instanced street furniture (see extractFurnitureRepeats): opt-in + plain lighting mode only
  const plainLit = !night && !day && !sources.length && !opts.moonlight && !opts.groundShadows;
  let furniture = null;
  if (opts.instancing) {
    if (plainLit) {
      const ex = extractFurnitureRepeats(boxes);
      boxes = ex.boxes;
      furniture = ex;
    } else {
      furniture = { groups: [], skipped: [], disabled: 'position-dependent lighting (night/day/moonlight/groundShadows) — furniture stays expanded' };
    }
  }
  const scene = assembleBoxCityScene({
    boxes, grounds, ribbons, faces,
    sources,
    diffusion: unshaded ? {} : (opts.diffusion || (night ? NIGHT_DIFFUSION : day ? DAY_DIFFUSION : {})),
    moonlight: unshaded ? undefined : (opts.moonlight ?? (night ? true : undefined)),  // cool directional moonlight on rooftops / moon-facing walls
    light: unshaded ? FLAT_LIGHT : (opts.light || (night ? makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.18, diffuse: 0.1 })
      : day ? makeLight({ direction: [0.35, 0.4, -0.85], ambient: 0.5, diffuse: 0.4 }) : undefined)),
    cameras: opts.cameras || FRACTAL_CAMERAS,
    viewBox: opts.viewBox || { width: 1120, height: 780 },
    unitScale: opts.unitScale || 22,
    title: opts.title || (night ? 'mojulo fractal city · night' : day ? 'mojulo fractal city · day' : 'mojulo fractal city'),
    // opt-in per-building ground shadows (off by default). For day the dir defaults to the
    // sun (sources[0]) → directional cast; for night the downward lamps give grounding blobs.
    groundShadows: unshaded ? false : (opts.groundShadows ?? false),
    creaseSeams: opts.creaseSeams ?? false,            // opt-in vgl concave contact-shadow feather
    ...(opts.sky ? { sky: opts.sky } : night ? { sky: { preset: 'night', stars: true, moon: true, seed: opts.seed ?? 7 } } : day ? { sky: { preset: 'day' } } : {}),
  });
  if (furniture) {
    // each template realizes through the SAME assembler (one box, no grounds) so its faces are
    // byte-identical to what the expanded path would have produced at the template's position.
    if (furniture.groups.length) {
      scene.repeats = furniture.groups.map((g) => ({
        template: assembleBoxCityScene({
          boxes: [g.template], cameras: opts.cameras || FRACTAL_CAMERAS,
          viewBox: opts.viewBox || { width: 1120, height: 780 }, unitScale: opts.unitScale || 22,
          light: opts.light,
        }).faces,
        transforms: g.transforms,
        group: g.name,
      }));
    }
    // adoption ledger — what got instanced, what fell below the copy threshold, or why the
    // whole pass stood down. Never silent (renderer-convergence "no silent caps").
    scene.repeatsInfo = {
      instanced: furniture.groups.map((g) => ({ group: g.name, copies: g.transforms.length })),
      skipped: furniture.skipped || [],
      ...(furniture.disabled ? { disabled: furniture.disabled } : {}),
    };
  }
  // carry the planned walker loops (paths + style, city units) onto the payload; the world resolve
  // bakes the rig + finalizes `walkers` (figure + scale). Absent when `walkers` isn't requested.
  if (plan.walkerLoops && plan.walkerLoops.length) scene.walkerLoops = plan.walkerLoops;
  if (plan.carLanes && plan.carLanes.length) scene.carLanes = plan.carLanes;
  return scene;
}

export function renderFractalCityToHtml(opts = {}) {
  return emitPreserve3dScene({ ...assembleFractalCityScene(opts), signs: opts.signs });
}

/**
 * cityThemeAdapter — the world-composer seam for the `city` base (see world-composer.plan.md).
 *
 * Maps a resolved theme's ABSTRACT slots (already deep-merged with per-call overrides) onto
 * the params `mintFractalCity` accepts. The city consumes what it can render — context
 * (time / locale / climate / massing) and asset (monument→landmark, civic→civicAreas, an
 * element toggle map, anchor) — and silently IGNORES slots it can't express (material /
 * palette / wall-style), which is the whole point of the role vocabulary: a pack written for
 * a richer base still resolves here, just with fewer knobs honored. Pure; leaves value
 * validation (landmark enum, climate enum, locale normalization) to mintFractalCity.
 */
export function cityThemeAdapter(slots = {}) {
  const ctx = slots.context || {};
  const asset = slots.asset || {};
  const out = {};
  if (ctx.time === 'day' || ctx.time === 'night') out.time = ctx.time;
  if (typeof ctx.locale === 'string') out.locale = ctx.locale;
  if (typeof ctx.climate === 'string') out.climate = ctx.climate;
  if (Number.isFinite(ctx.density)) out.density = ctx.density;
  if (Number.isFinite(ctx.depth)) out.depth = ctx.depth;
  if (Number.isFinite(ctx.baseScale)) out.baseScale = ctx.baseScale;
  if (asset.anchor === 'tower' || asset.anchor === 'freeway') out.anchor = asset.anchor;
  if (asset.monument) out.landmark = asset.monument;
  if (Array.isArray(asset.civic) && asset.civic.length) out.civicAreas = asset.civic;
  if (asset.elements && typeof asset.elements === 'object') out.elements = { ...asset.elements };
  // Effect channels ride the top level of the slot bag (they are render toggles, not
  // theme roles): opt-in volumetric fog + the audio channel pass through to the mint,
  // which owns their validation (fog: true | tuning object; audio: object). Absent ⇒
  // omitted ⇒ off — same default as every other opt-in here.
  if (slots.fog !== undefined) out.fog = slots.fog;
  if (slots.audio !== undefined) out.audio = slots.audio;
  return out;
}
