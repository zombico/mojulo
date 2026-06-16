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

import { assembleBoxCityScene, emitPreserve3dScene } from './scene-css3d.js';
import { makeLight, scaleHex } from './polygonizer/vexar.js';
import { makeRowhouseFacade } from './building-facade.js';
import { straightPath, sinePath, chainPaths, roadRibbons, groundStreet, offsetPath } from './roads.js';
import { vehicleAntFaces, streetcarCorridor } from './vehicles-css3d.js';

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
  bikeLanes: true,
  powerLines: true,
  anchorTowers: true,
  elevatedFreeways: true,
  subAnchors: true,
  streetcars: false,          // opt-in: a tram line (tracks + wire + stops + trams) down the main street median
  townhouses: false,          // opt-in: attached brownstone / modern-stacked rowhouse rows along block faces
  religiousPlaces: true,      // a CLASS of building (a church): at most one per scene, gated by `locale` (see RELIGIOUS_LOCALE_WEIGHT)
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
  bikes: 'bikeLanes',
  bike: 'bikeLanes',
  bikeLane: 'bikeLanes',
  bikeLanes: 'bikeLanes',
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
  church: 'religiousPlaces',
  churches: 'religiousPlaces',
  religious: 'religiousPlaces',
  religion: 'religiousPlaces',
  worship: 'religiousPlaces',
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
function subdivide(region, gap, rng) {
  const fx = 0.36 + rng() * 0.28, fy = 0.36 + rng() * 0.28;
  const wL = (region.w - gap) * fx, wR = region.w - gap - wL;
  const dB = (region.d - gap) * fy, dT = region.d - gap - dB;
  const x1 = region.x + wL + gap, y1 = region.y + dB + gap;
  return {
    quads: [
      { x: region.x, y: region.y, w: wL, d: dB }, { x: x1, y: region.y, w: wR, d: dB },
      { x: region.x, y: y1, w: wL, d: dT }, { x: x1, y: y1, w: wR, d: dT },
    ],
    vx: region.x + wL + gap / 2,
    hy: region.y + dB + gap / 2,
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
const HARD_CLAIM = new Set([CLAIM.ANCHOR, CLAIM.ROAD, CLAIM.BUILDING, CLAIM.LOT, CLAIM.ALLEY, CLAIM.CORRIDOR]);
function isBuildable(g, rect) {
  const ins = g.cell * 1.05;
  const r = { x: rect.x + ins, y: rect.y + ins, w: rect.w - 2 * ins, d: rect.d - 2 * ins };
  if (r.w <= 0 || r.d <= 0) return false;
  const { c0, c1, r0, r1 } = gridCells(g, r);
  for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) if (HARD_CLAIM.has(g.data[rr * g.cols + c])) return false;
  return true;
}
// every cell of `rect` is exactly `code` — an AREA test (vs the point test cellAt), so a
// thing with extent (a car) can be required to sit ENTIRELY on road/lot, never grazing.
function rectAllClaim(g, rect, code) {
  const { c0, c1, r0, r1 } = gridCells(g, rect);
  if (c1 < c0 || r1 < r0) return false;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (g.data[r * g.cols + c] !== code) return false;
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
function placeBuilding(boxes, rect, size, rng, grid) {
  if (rect.w < 0.85 || rect.d < 0.85) return;
  stampRect(grid, rect, CLAIM.BUILDING, [CLAIM.EMPTY, CLAIM.VERGE]);
  const hr = size === 'xlarge' ? [10, 15] : size === 'large' ? [5, 10] : size === 'medium' ? [3, 5.5] : [1.5, 3];
  const h = hr[0] + rng() * (hr[1] - hr[0]);
  const ratio = Math.max(rect.w, rect.d) / Math.min(rect.w, rect.d);
  const elongated = ratio > 1.6 && Math.min(rect.w, rect.d) > 1.1;     // a long block → mixed-use complex
  let shape = 'box';
  if (elongated && h > 3.0 && rng() < 0.6) shape = 'complex';          // shopping podium + condo tower (above / beside)
  else if (size === 'xlarge') shape = rng() < 0.4 ? 'podium' : rng() < 0.5 ? 'setback' : (rng() < 0.6 ? 'cylinder' : 'box'); // single-block megatower → landmark form
  else if (h > 5.2 && rng() < 0.6) shape = rng() < 0.42 ? 'podium' : (rng() < 0.5 ? 'cylinder' : 'setback');            // tall → tower-on-podium / skyscraper variations
  else if (h > 3.4 && rng() < 0.28) shape = 'podium';                                                                   // mid-rise: a tower on a wide low base
  if (shape === 'podium' && (rect.w < 1.4 || rect.d < 1.2)) shape = 'box';                                              // need room for base + inset tower
  boxes.push({ ...rect, z0: 0, z1: h, kind: 'building', shape });
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
      && isBuildable(grid, block) && rng() < 0.7) {
    placeTownhouses(block, reserved, rng, boxes, grounds, faces, opts, grid, cars);
    return;
  }
  const density = Math.max(0, Math.min(1, Number.isFinite(opts.density) ? opts.density : 0.58));
  const long = block.w >= block.d ? 'x' : 'y', other = long === 'x' ? 'y' : 'x';
  const area = block.w * block.d, big = area > 15, huge = area > 22, alley = 0.55, roll = rng();
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
  if (huge && roll < 0.18) items = [bld(block, 'xlarge')];                               // single-block-takeover megatower
  else if (big && roll < 0.34) items = [bld(block, 'large')];                            // 1 large
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
    if (keepBuilding) placeBuilding(boxes, it.rect, it.size, rng, grid);
    // else: leave the parcel EMPTY → tagged leftover (plaza/greenspace), never a random lot
  }
}

// ── townhouse rows ──────────────────────────────────────────────────────────────
// A rowhouse block is ONE continuous wall of narrow ATTACHED units (party walls, no
// inter-unit gaps) sharing datum lines (floor / cornice / stoop landing), varying
// only by tint + stoop handing — NOT N detached buildings. Two treatments:
//  • 'brownstone'      — warm masonry walk-up: tall projecting stoop to a raised
//                        parlor door, cheek-wall rails, heavy continuous cornice,
//                        optional parlor bay window, arched brick windows.
//  • 'modern-stacked'  — panel/glass: flat parapet, mid-height stack-reveal band,
//                        TWO grade-level doors per lot (stacked lower+upper dwellings),
//                        low stoop + slender canopy, optional cantilevered box-bay.
// A row runs along a block's long edge. A 'full' row is DOUBLE-LOADED (mirrored on
// both long edges → doors+stoops on both faces); a 'half' row takes half the
// block-face length with a normal building filling the remainder.

const TOWNHOUSE_DOORS = {
  brownstone: ['#2e3a2c', '#3a2420', '#1d2630', '#2b2622'],          // deep green / oxblood / navy / near-black
  'modern-stacked': ['#2b2e33', '#3a3f45', '#6b5240', '#384047'],   // charcoal / slate / warm-wood / blue-grey
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
function townhouseRow({ block, axis, side, style, loading, depth, lo, hi, rng, boxes, faces, grid }) {
  const runLen = hi - lo;
  if (runLen < 1.6 || depth < 0.6) return 0;
  const target = 1.2 + rng() * 0.3;
  const n = Math.max(2, Math.round(runLen / target));
  const weights = Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1) ? 1.16 : 1.0);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const H = style === 'brownstone' ? 2.9 + rng() * 0.9 : 2.5 + rng() * 0.9;          // one shared height → continuous cornice datum
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
  const style = rng() < 0.5 ? 'brownstone' : 'modern-stacked';
  const loading = crossLen >= 2.4 && rng() < 0.6 ? 'full' : 'half';
  if (loading === 'full') {
    const seam = 0.3, depth = Math.min(2.3, (crossLen - seam) / 2);
    townhouseRow({ block, axis: long, side: 1, style, loading, depth, lo, hi: lo + longLen, rng, boxes, faces, grid });
    townhouseRow({ block, axis: long, side: -1, style, loading, depth, lo, hi: lo + longLen, rng, boxes, faces, grid });
    return;
  }
  const depth = Math.min(2.6, crossLen * 0.7);
  const mid = lo + longLen * (0.46 + rng() * 0.08);
  townhouseRow({ block, axis: long, side: 1, style, loading, depth, lo, hi: mid, rng, boxes, faces, grid });
  const rem = long === 'x'
    ? { x: mid + 0.4, y: block.y, w: block.x + block.w - mid - 0.4, d: block.d }
    : { x: block.x, y: mid + 0.4, w: block.w, d: block.y + block.d - mid - 0.4 };
  if (rem.w > 0.9 && rem.d > 0.9 && isBuildable(grid, rem)) {
    if (opts.elements.buildings) placeBuilding(boxes, rem, 'small', rng, grid);
    else addParkingLot(grounds, rem, rng, opts.elements, grid, cars);
  }
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

function cityTree(boxes, x, y, rng) {
  const h = 1.7 + rng() * 0.45;
  const crown = 0.58 + rng() * 0.18;
  boxes.push({ kind: 'city-tree-trunk', x: x - 0.08, y: y - 0.08, w: 0.16, d: 0.16, z0: 0, z1: h, tint: '#6a4932' });
  boxes.push({ kind: 'city-tree-canopy', x: x - crown * 0.5, y: y - crown * 0.5, w: crown, d: crown, z0: h * 0.72, z1: h + crown * 0.55, tint: rng() < 0.5 ? '#477b45' : '#5b8a44' });
  boxes.push({ kind: 'city-tree-canopy', x: x - crown * 0.34, y: y - crown * 0.62, w: crown * 0.78, d: crown * 0.78, z0: h * 0.94, z1: h + crown * 0.78, tint: '#3f6e34' });
}

// doodads anchored to the REAL main intersection (vx,hy). Every prop is a TENANT of the
// verge/road: it is placed only where the grid cell is clear of building/anchor/corridor
// (propClear), so furniture never stands inside a tower. Crosswalk arms are gated on the
// road arm actually existing (the anchor may have clipped it away), and power poles are
// placed per-pole with lines drawn only between consecutive placed poles — so a utility
// line can't thread through a building.
function intersectionDoodads(vx, hy, region, swW, streetW, boxes, grounds, elements, rng, grid, major) {
  if (elements.streetSignals) for (const [sx, sy] of [[vx - 1.0, hy - 1.0], [vx + 1.0, hy + 1.0]]) {           // stoplights
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
    if (propClear(grid, sx, sy) && rng() < 0.58) cityTree(boxes, sx, sy, rng);
  }
  if (elements.crosswalks) {
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
  for (let x = region.x + 2.5; x < region.x + region.w - 1; x += 6.5) {
    if (!propClear(grid, x, py)) { placed.push(null); continue; }                  // skip poles that would stand in a building/anchor
    boxes.push({ kind: 'power-pole', x, y: py, w: 0.16, d: 0.16, z0: 0, z1: top, tint: '#5a4f44' });
    boxes.push({ kind: 'power-pole', x: x - 0.4, y: py - 0.05, w: 0.95, d: 0.07, z0: top - 0.3, z1: top - 0.22, tint: '#4a4138' });
    placed.push(x);
  }
  for (let i = 0; i < placed.length - 1; i++) {                                    // span only between two ADJACENT placed poles
    if (placed[i] == null || placed[i + 1] == null) continue;
    for (const off of [-0.32, 0, 0.32])
      boxes.push({ kind: 'power-line', x: placed[i], y: py + off, w: placed[i + 1] - placed[i], d: 0.035, z0: top - 0.27, z1: top - 0.24, tint: '#202224' });
  }
}

function recurse(region, depth, rootAnchor, rng, boxes, ribbons, grounds, faces, reservedAbove, opts, grid, cars) {
  const reserved = [...reservedAbove];
  // 1. anchor (bindu) first — root: explicit; deeper: probabilistic sub-anchor. Both
  //    stamp their footprint ANCHOR so roads/buildings/furniture route around them. A
  //    sub-anchor is now refused if its footprint is already claimed (the hard tram
  //    corridor, or a parent anchor's clipped strip) — it can't be planted on them.
  if (rootAnchor) {
    const enabled = rootAnchor === 'freeway' ? opts.elements.elevatedFreeways : opts.elements.anchorTowers;
    if (enabled) {
      const a = rootAnchor === 'freeway' ? freewayAnchor(region, rng) : towerAnchor(region, rng, true);
      boxes.push(...a.boxes); if (a.ribbons) ribbons.push(...a.ribbons); reserved.push(a.footprint);
      stampRect(grid, a.footprint, CLAIM.ANCHOR);
    }
  } else if (opts.subAnchors && depth >= 1 && rng() < opts.subAnchorChance) {
    const a = towerAnchor(region, rng, false);
    if (isClear(grid, a.footprint, 0.05)) {
      boxes.push(...a.boxes); reserved.push(a.footprint); stampRect(grid, a.footprint, CLAIM.ANCHOR);
    }
  }
  // 2. early-stop OR forced leaf → fill the block. Stopping early on a mid-size region
  //    yields a BIGGER block, so block sizes vary.
  const small = region.w < 9 && region.d < 9;
  if (depth <= 0 || region.w < 4.5 || region.d < 4.5 || (small && rng() < 0.32)) {
    fillBlock(region, reserved, rng, boxes, grounds, faces, opts, grid, cars);
    return;
  }
  // 3. the top-down mandala IS the road skeleton: the cross-streets are the gesture lines
  //    of this level. Subdivide with VARIED ratios (non-square blocks), CLAIM the road
  //    right-of-way (verge then carriageway) into the grid, draw the streets, recurse.
  const gap = STREET;
  const { quads, vx, hy } = subdivide(region, gap, rng);
  const major = depth >= opts.maxDepth;                      // primary axes → wider, 2-lane
  const streetW = gap * (major ? 2.04 : 0.85);               // main car road widened ~20% (1.7 → 2.04)
  const swW = streetW + 1.3;                                 // sidewalk (lighter, wider) under each street
  // claim the right-of-way: verge band (over empty), then carriageway (over empty/verge,
  // never over the anchor) — this is the surface-area budget for these two gestures.
  stampRect(grid, { x: vx - swW / 2, y: region.y, w: swW, d: region.d }, CLAIM.VERGE, [CLAIM.EMPTY]);
  stampRect(grid, { x: region.x, y: hy - swW / 2, w: region.w, d: swW }, CLAIM.VERGE, [CLAIM.EMPTY]);
  stampRect(grid, { x: vx - streetW / 2, y: region.y, w: streetW, d: region.d }, CLAIM.ROAD, [CLAIM.EMPTY, CLAIM.VERGE]);
  stampRect(grid, { x: region.x, y: hy - streetW / 2, w: region.w, d: streetW }, CLAIM.ROAD, [CLAIM.EMPTY, CLAIM.VERGE]);
  if (opts.elements.sidewalks) {
    grounds.push({ kind: 'sidewalk', x: vx - swW / 2, y: region.y, w: swW, d: region.d, z: 0.018, fill: '#b0aa9c' });
    grounds.push({ kind: 'sidewalk', x: region.x, y: hy - swW / 2, w: region.w, d: swW, z: 0.018, fill: '#b0aa9c' });
    // broad panel joints: light-gray seams running across each walk at a wide spacing
    const JOINT = 2.4;
    for (let yy = region.y + JOINT; yy < region.y + region.d - 0.3; yy += JOINT)
      grounds.push({ kind: 'sidewalk-joint', x: vx - swW / 2, y: yy, w: swW, d: 0.05, z: 0.02, fill: '#c9c8c3' });
    for (let xx = region.x + JOINT; xx < region.x + region.w - 0.3; xx += JOINT)
      grounds.push({ kind: 'sidewalk-joint', x: xx, y: hy - swW / 2, w: 0.05, d: swW, z: 0.02, fill: '#c9c8c3' });
  }
  if (opts.elements.roads) {
    const bikeLanes = major && opts.elements.bikeLanes && rng() < 0.72 ? 'outer' : null;
    if (major) {
      // a coherent junction: the two streets are drawn as four half-segments that
      // STOP at the curb (so lane lines don't cross through the box) + a plain
      // pavement patch in the box. Every span is clipped out of reserved
      // footprints, so the road never runs under the anchor/buildings.
      const half = streetW / 2, opt = { width: streetW, laneLine: true, lanes: 2, bikeLanes };
      if (propClear(grid, vx, hy)) grounds.push({ kind: 'junction', x: vx - half, y: hy - half, w: streetW, d: streetW, z: 0.045, fill: '#3a414b' });
      pushStreet(ribbons, [vx, region.y], [vx, hy - half], opt, reserved);
      pushStreet(ribbons, [vx, hy + half], [vx, region.y + region.d], opt, reserved);
      pushStreet(ribbons, [region.x, hy], [vx - half, hy], opt, reserved);
      pushStreet(ribbons, [vx + half, hy], [region.x + region.w, hy], opt, reserved);
      if (opts.elements.cars) placeStreetCars(cars, vx, hy, region, streetW, rng, bikeLanes);
    } else {
      const opt = { width: streetW, laneLine: false, lanes: 1, bikeLanes };
      pushStreet(ribbons, [vx, region.y], [vx, region.y + region.d], opt, reserved);
      pushStreet(ribbons, [region.x, hy], [region.x + region.w, hy], opt, reserved);
    }
  }
  // dress EVERY junction node (not just the root): each is a real crossing. propClear /
  // armRoad gating keeps furniture on the verge and off the anchor; power lines stay major.
  intersectionDoodads(vx, hy, region, swW, streetW, boxes, grounds, opts.elements, rng, grid, major);
  for (const q of quads) {
    const qReserved = reserved.map((r) => clipRect(r, q)).filter(Boolean);
    recurse(q, depth - 1, null, rng, boxes, ribbons, grounds, faces, qReserved, opts, grid, cars);
  }
}

/**
 * Plan a fractal city.
 * @param {object} o
 * @param {{x,y,w,d}} o.region  world footprint of the whole scene
 * @param {number}    o.depth   quadrant recursion depth (2 → 16 leaf cells)
 * @param {number}    o.seed
 * @param {'tower'|'freeway'|null} o.anchor  root anchor manji (null → no anchor: each area self-generates)
 * @param {boolean}   o.subAnchors  allow probabilistic sub-anchors per quadrant
 * @returns {{ boxes, grounds, stats }}
 */
export function planFractalCity({ region = { x: 2, y: 2, w: 30, d: 18 }, depth = 2, seed = 1, anchor = 'tower', subAnchors = true, density = 0.58, subAnchorChance = 0.4, elements, locale = null } = {}) {
  const rng = mulberry32(seed >>> 0 || 1);
  const recipeElements = normalizeFractalCityElements(elements);
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
  let corridor = null;
  if (recipeElements.streetcars) {
    const horizontal = region.w >= region.d;
    corridor = cityStreetcarCorridor(region, rng);
    seedReserved.push({ ...corridor.footprint, hard: true });
    stampRect(grid, corridor.footprint, CLAIM.CORRIDOR);
    if (anchor && (anchor === 'freeway' ? recipeElements.elevatedFreeways : recipeElements.anchorTowers)) {
      const ar = sideRegionAvoiding(region, corridor.footprint, horizontal ? 'x' : 'y');   // anchor to one side of the boulevard
      if (ar.w > 4 && ar.d > 4) {
        const a = anchor === 'freeway' ? freewayAnchor(ar, rng) : towerAnchor(ar, rng, true);
        boxes.push(...a.boxes); if (a.ribbons) ribbons.push(...a.ribbons); seedReserved.push(a.footprint);
        stampRect(grid, a.footprint, CLAIM.ANCHOR);
      }
    }
  }
  recurse(region, depth, corridor ? null : (anchor || null), rng, boxes, ribbons, grounds, faces, seedReserved, { density, elements: recipeElements, subAnchors: subAnchors && recipeElements.subAnchors && recipeElements.anchorTowers, subAnchorChance, maxDepth: depth }, grid, cars);
  if (corridor) { ribbons.push(...corridor.ribbons); boxes.push(...corridor.boxes); grounds.push(...corridor.grounds); faces.push(...corridor.faces); }
  // FINAL CAR PASS: emit each deferred vehicle only if its lane/stall cell is actually
  // the right surface — ROAD for street ants, LOT for parked ants. This is what makes the
  // recursion ORDER not matter: a car decided at the root survives only if no anchor /
  // sub-anchor / corridor decided later claimed the cell it sits on.
  for (const it of cars) {
    const need = it.context === 'lot' ? CLAIM.LOT : CLAIM.ROAD;
    const len = 1.7 * it.scale, wid = 0.8 * it.scale;          // approx vehicle extent (length along travel)
    const carRect = it.axis === 'y'
      ? { x: it.cx - wid / 2, y: it.cy - len / 2, w: wid, d: len }
      : { x: it.cx - len / 2, y: it.cy - wid / 2, w: len, d: wid };
    if (!rectAllClaim(grid, carRect, need)) continue;          // AREA test: the WHOLE car must sit on road/lot, no nosing into a tower
    faces.push(...vehicleAntFaces({ rng, context: it.context, cx: it.cx, cy: it.cy, axis: it.axis, dir: it.dir, scale: it.scale }));
  }
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
  // RELIGIOUS PLACE (church): one-per-scene, locale-gated. Runs AFTER the city is laid so
  // it re-tags an existing (road-clear) building; the `&&` short-circuits before any rng
  // draw when off / locale-less.
  const religiousPlaces = (recipeElements.religiousPlaces && seedReligiousPlace(boxes, locale, rng)) || 0;
  const stats = {
    boxes: boxes.length,
    ribbons: ribbons.length,
    anchors: boxes.filter((b) => b.kind === 'anchor').length,
    freeway: boxes.some((b) => b.kind === 'pillar'),
    buildings: boxes.filter((b) => b.kind === 'building').length,
    townhouses: boxes.filter((b) => b.kind === 'townhouse').length,
    streetcar: boxes.some((b) => b.kind === 'tram-pole'),
    religiousPlaces,
    leftover: leftover.filter((c) => c.area >= 0.5).length,
    leftoverArea: Math.round(leftover.reduce((a, c) => a + c.area, 0) * 100) / 100,
  };
  return { boxes, grounds, ribbons, faces, sources: lampSources(boxes), stats, elements: recipeElements, locale };
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
export function assembleFractalCityScene(opts = {}) {
  const plan = planFractalCity(opts);
  const { boxes, grounds, ribbons, faces } = plan;
  const time = opts.time || (opts.night ? 'night' : opts.day ? 'day' : null);
  const night = time === 'night', day = time === 'day';
  const region = opts.region || DEFAULT_REGION;
  let sources = night ? (opts.sources || plan.sources) : day ? [daySun(region)] : (opts.sources || []);
  const cap = opts.maxLamps ?? 20;                              // sample lamps down so the night bake stays bounded
  if (night && sources.length > cap) sources = Array.from({ length: cap }, (_, i) => sources[Math.floor(i * (sources.length / cap))]);
  return assembleBoxCityScene({
    boxes, grounds, ribbons, faces,
    sources,
    diffusion: opts.diffusion || (night ? NIGHT_DIFFUSION : day ? DAY_DIFFUSION : {}),
    moonlight: opts.moonlight ?? (night ? true : undefined),  // cool directional moonlight on rooftops / moon-facing walls
    light: opts.light || (night ? makeLight({ direction: [0.2, 0.3, -0.9], ambient: 0.18, diffuse: 0.1 })
      : day ? makeLight({ direction: [0.35, 0.4, -0.85], ambient: 0.5, diffuse: 0.4 }) : undefined),
    cameras: opts.cameras || FRACTAL_CAMERAS,
    viewBox: opts.viewBox || { width: 1120, height: 780 },
    unitScale: opts.unitScale || 22,
    title: opts.title || (night ? 'mojulo fractal city · night' : day ? 'mojulo fractal city · day' : 'mojulo fractal city'),
    ...(opts.sky ? { sky: opts.sky } : night ? { sky: { preset: 'night', stars: true, moon: true, seed: opts.seed ?? 7 } } : day ? { sky: { preset: 'day' } } : {}),
  });
}

export function renderFractalCityToHtml(opts = {}) {
  return emitPreserve3dScene(assembleFractalCityScene(opts));
}
