/**
 * city-flavors — regional architecture for the METRO city: what makes a downtown read as Paris,
 * Tokyo or New York once its proportions are real. A flavour is data over the metro kernel's own
 * dials (fractal-city.js): the skin palette and material mix, facade affectations, a roof form,
 * height / tower / lot overrides over METRO, and the street's centre-line colour. It names the
 * `locale` region it implies (which picks the religious building) and a climate (palms).
 *
 * The dice roll ONCE, at mint (resolveMintFlavor), and the result is written into the recipe as
 * `flavor`. The planner never rolls: a seed-side roll would change every stored city the day a
 * flavour is added. A recipe with no flavour renders as `north-american`, which overrides nothing.
 *
 * Skin mix: per material [base, core, edge] → weight = base + core·k² + edge·(1 − k), k = 1 at the
 * height-field core → 0 far out (METRO's own mix is glass [0.05, 1.2, 0], stone [0.3, 0, 0],
 * brick [0, 0, 0.5]). Pairs are [glass, frame]: curtainwall panes and mullions, stone's dark windows
 * and the stone (render and tile ride as stone), brick's body and trim. Facade probabilities are per
 * mass, drawn after the palette, so a flavour that sets none leaves every skin as it was.
 */

const WHITE_LINE = '#e3e1d8';
const NEON = ['#ece8dc', '#d9443a', '#f0c23a', '#3a78c9', '#2f9b63', '#e2711d', '#c83f8a'];

export const CITY_FLAVORS = {
  // today's metro downtown: every dial is METRO's own
  'north-american': { label: 'North American downtown', locale: 'north-america' },

  // brick walk-ups with fire escapes, a rooftop water tank on anything over six storeys (the city's
  // rule since the 1880s), limestone and Art Deco setbacks, glass in the core
  'new-york': {
    label: 'New York', locale: 'north-america',
    skin: {
      mix: { glass: [0.04, 1.0, 0], stone: [0.3, 0, 0], brick: [0.1, 0, 0.6] },
      brick: [['#7d4a3c', '#cbbfae'], ['#8a5341', '#d3c7b4'], ['#6b4034', '#bfb2a0'], ['#93624c', '#d8ccb8'], ['#5e3f36', '#b8ab98'], ['#6a4a3c', '#c4b7a4']],
      stone: [['#3e464f', '#cdc5b2'], ['#424a52', '#bdb5a4'], ['#3b424a', '#a9a497'], ['#454c55', '#d4ccba']],
      brickMax: 16,
    },
    facade: {
      fireEscape: 0.85,
      kit: [{ item: 'wood-tank', p: 0.75, minFloors: 6 }],
      awning: { p: 0.25, tints: ['#2c3a4c', '#6a2c2c', '#2f4a3a'] },
      storefront: 0.5,
    },
    height: { core: 13, edge: 5, sigmaEdge: 0.45 },
    tower: { shapes: [0.6, 0.85, 0.95] },   // Art Deco setbacks, few cylinders
  },

  // Haussmann: cut stone, French balconies, zinc mansards over one cornice line (17.55 m, 20 m on
  // the wide streets, 1859); cafés with awnings; no towers
  paris: {
    label: 'Paris', locale: 'europe',
    skin: {
      mix: { glass: [0.02, 0.1, 0], stone: [1, 0, 0], brick: [0.02, 0, 0] },
      stone: [['#3d434a', '#d6ccb6'], ['#40464d', '#cfc4ad'], ['#3b4148', '#dcd3bf'], ['#42484f', '#c8bda5'], ['#3e444b', '#d2c9b4']],
      stoneRhythm: ['punched'],
      roof: ['#6b737b', '#747c83', '#656d74'],
    },
    facade: {
      balcony: { p: 0.85, types: ['continuous'], bays: ['all'], floors: [2, 5] },   // continuous, on the second and fifth floors
      awning: { p: 0.35, tints: ['#7a2a2a', '#2f4a3a', '#28324a', '#8a6a3a'] },
      storefront: 0.6,
      sign: { p: 0.08, palette: ['#2a2f36', '#7a2a2a'] },
      roof: { form: 'mansard', p: 0.9, maxFloors: 9, on: ['stone', 'brick'], rise: 1.5, tints: ['#6b737b', '#747c83', '#656d74'] },
    },
    height: { core: 5.4, edge: 5.1, sigmaCore: 0.1, sigmaEdge: 0.08, cap: 6.1 },
    tower: { p: 0 },
    street: { centreLine: WHITE_LINE },
  },

  // yellow London stock brick and red brick, Portland stone, the City's glass towers in the core
  london: {
    label: 'London', locale: 'europe',
    skin: {
      mix: { glass: [0.04, 1.0, 0], stone: [0.2, 0, 0], brick: [0.3, 0, 0.6] },
      brick: [['#a8916a', '#e6ddc9'], ['#b39d74', '#ebe3d0'], ['#9a8462', '#ddd3bf'], ['#a18a66', '#e2d9c5'], ['#8a4b3c', '#e0d6c4'], ['#7e4538', '#d8cebc']],
      stone: [['#3c434b', '#d8d3c4'], ['#40474e', '#cdc8b9'], ['#3e454c', '#e0dccf']],
      roof: ['#55595e', '#5d6166', '#8e8a82'],
    },
    facade: {
      roof: { form: 'hip', p: 0.6, maxFloors: 5, on: ['brick'], rise: 1.1, tints: ['#55595e', '#4d5156', '#5d6166'], chimneys: true },   // slate terraces, stacks on the party walls
      storefront: 0.45,
    },
    height: { core: 9, edge: 3.4, sigmaCore: 0.9, sigmaEdge: 0.35 },
    tower: { p: 0.6 },   // the City's cluster; the rest stays low
    street: { centreLine: WHITE_LINE },
  },

  // Rome, Barcelona, Lisbon, Athens: ochre, rose and cream render with dark shutters, terracotta hip
  // roofs, balconies, a low even skyline
  mediterranean: {
    label: 'Mediterranean', locale: 'europe',
    skin: {
      mix: { glass: [0.02, 0.25, 0], stone: [1, 0, 0], brick: [0.04, 0, 0] },
      stone: [['#3e4a3f', '#d4a86a'], ['#4a3f36', '#c98b6b'], ['#3f4852', '#e0d2b0'], ['#3e4a3f', '#dcc58e'], ['#4a3f36', '#d19a7e'], ['#3f4852', '#e2dccc']],
      stoneRhythm: ['punched'],
      roof: ['#a95f47', '#b36a4f', '#9c5843'],
    },
    facade: {
      balcony: { p: 0.5, types: ['slab', 'french'], bays: ['alt', 'col'] },
      awning: { p: 0.3, tints: ['#9a5a3a', '#3f5a4a', '#c9a24a'] },
      storefront: 0.45,
      roof: { form: 'hip', p: 0.8, maxFloors: 7, on: ['stone', 'brick'], rise: 1.3, tints: ['#a95f47', '#b36a4f', '#9c5843', '#b8735a'] },
    },
    height: { core: 6.5, edge: 4.2, sigmaCore: 0.35, sigmaEdge: 0.25, cap: 9 },
    tower: { p: 0.12 },
    street: { centreLine: WHITE_LINE },
  },

  // zakkyo streets: narrow lots, white and grey tile, vertical blade signs and dense signage, a
  // mixed skyline with glass towers in the core
  tokyo: {
    label: 'Tokyo', locale: 'east-asia',
    skin: {
      mix: { glass: [0.1, 1.0, 0], stone: [0.7, 0, 0], brick: [0, 0, 0] },
      stone: [['#3b434c', '#d9d8d2'], ['#3e464f', '#c9c7bf'], ['#3a424a', '#b8b6ae'], ['#40474f', '#a9aaa6'], ['#3d454d', '#d3cfc4'], ['#454b52', '#8e9194']],
      stoneRhythm: ['banded', 'punched', 'grid'],
    },
    facade: {
      blades: { p: 0.65, minFloors: 3, maxFloors: 10, palette: NEON },
      sign: { p: 0.7, palette: NEON },
      balcony: { p: 0.25, types: ['vertical-rail'], bays: ['alt', 'col'] },
      storefront: 0.7,
    },
    height: { core: 11, edge: 3.6, sigmaCore: 1.0, sigmaEdge: 0.6, slender: 9 },
    lot: { front: [1.3, 2.8], wide: [4, 7], wideP: 0.1, depth: [3, 6] },
    street: { centreLine: WHITE_LINE },
  },

  // Manila, Kuala Lumpur, Bangkok, Singapore: weathered painted concrete, balconies, rooftop tanks,
  // signage, glass in the core, palms
  'southeast-asia': {
    label: 'Southeast Asia', locale: 'southeast-asia', climate: 'tropical',
    skin: {
      mix: { glass: [0.1, 1.1, 0], stone: [0.6, 0, 0], brick: [0, 0, 0] },
      stone: [['#3a4550', '#d8d2c0'], ['#3c4750', '#c9c3a8'], ['#3a4550', '#b9c2b8'], ['#404a52', '#d1bfa6'], ['#3a4550', '#bcb9b1'], ['#3f4852', '#cfc9d0']],
      stoneRhythm: ['grid', 'punched', 'banded'],
    },
    facade: {
      balcony: { p: 0.4, types: ['slab'], bays: ['alt', 'col'] },
      kit: [{ item: 'water-tank', p: 0.3, minFloors: 3 }, { item: 'satellite-dish', p: 0.3, minFloors: 3 }],
      sign: { p: 0.45, palette: NEON },
      blades: { p: 0.2, minFloors: 3, maxFloors: 8, palette: NEON },
      awning: { p: 0.3, tints: ['#2f6b8a', '#8a3a2a', '#3a6a3a'] },
    },
    height: { core: 11, edge: 4 },
  },

  // Mexico City, São Paulo, Buenos Aires, Bogotá: stucco in earth and pastel colours, exposed brick
  // toward the edge, a rooftop tank on most roofs, glass in the core
  'latin-american': {
    label: 'Latin American', locale: 'south-america',
    skin: {
      mix: { glass: [0.04, 0.6, 0], stone: [0.8, 0, 0], brick: [0.1, 0, 0.3] },
      stone: [['#3c434a', '#d6a878'], ['#3c434a', '#c78c7a'], ['#3c434a', '#e0d4b8'], ['#3c434a', '#b7c4b0'], ['#3c434a', '#d8c38a'], ['#3c434a', '#c9b8a8']],
      brick: [['#9a5a44', '#d9cfbd'], ['#a4674d', '#ddd3c1']],
      stoneRhythm: ['punched', 'grid'],
    },
    facade: {
      kit: [{ item: 'water-tank', p: 0.55, minFloors: 2 }],
      balcony: { p: 0.35, types: ['slab'], bays: ['alt', 'col'] },
      sign: { p: 0.3, palette: NEON },
      storefront: 0.45,
    },
    height: { core: 8, edge: 3.4 },
    tower: { p: 0.5 },
  },

  // Dubai, Doha, Abu Dhabi: sand-coloured render, reflective glass, supertall towers, palms
  gulf: {
    label: 'Gulf', locale: 'middle-east', climate: 'tropical',
    skin: {
      mix: { glass: [0.2, 1.4, 0], stone: [0.6, 0, 0], brick: [0, 0, 0] },
      glass: [['#50626e', '#9aa0a6'], ['#5a6b78', '#c3c7ca'], ['#4a5a66', '#3a3f45'], ['#61717a', '#b4b9bc'], ['#566064', '#7c827f']],
      stone: [['#3a4550', '#d8c7a4'], ['#2f3a44', '#cdb893'], ['#3a4550', '#e2d6bb'], ['#2f3a44', '#c4b08c']],
      roof: ['#c9c2b2', '#b8b1a2', '#a8a59e'],
    },
    facade: { balcony: { p: 0.2, types: ['slab'], bays: ['all'] } },
    height: { core: 12, edge: 3 },
    tower: { h: [45, 115], slender: [5, 8], shapes: [0.2, 0.45, 0.6] },   // more round towers
    street: { centreLine: WHITE_LINE },
  },
};

export const FLAVOR_ALIASES = {
  'north-america': 'north-american', 'north-american': 'north-american', na: 'north-american', us: 'north-american', usa: 'north-american',
  canada: 'north-american', toronto: 'north-american', chicago: 'north-american', 'los-angeles': 'north-american', la: 'north-american',
  'new-york': 'new-york', 'new-york-city': 'new-york', nyc: 'new-york', ny: 'new-york', manhattan: 'new-york', brooklyn: 'new-york',
  paris: 'paris', france: 'paris', haussmann: 'paris', parisian: 'paris',
  london: 'london', uk: 'london', england: 'london', britain: 'london', british: 'london',
  mediterranean: 'mediterranean', rome: 'mediterranean', italy: 'mediterranean', barcelona: 'mediterranean', spain: 'mediterranean',
  lisbon: 'mediterranean', portugal: 'mediterranean', athens: 'mediterranean', greece: 'mediterranean', naples: 'mediterranean', marseille: 'mediterranean',
  tokyo: 'tokyo', japan: 'tokyo', osaka: 'tokyo', japanese: 'tokyo',
  'southeast-asia': 'southeast-asia', sea: 'southeast-asia', manila: 'southeast-asia', philippines: 'southeast-asia', 'kuala-lumpur': 'southeast-asia',
  malaysia: 'southeast-asia', bangkok: 'southeast-asia', thailand: 'southeast-asia', singapore: 'southeast-asia', jakarta: 'southeast-asia', 'ho-chi-minh-city': 'southeast-asia',
  'latin-american': 'latin-american', 'latin-america': 'latin-american', latam: 'latin-american', 'mexico-city': 'latin-american', mexico: 'latin-american',
  'sao-paulo': 'latin-american', brazil: 'latin-american', 'buenos-aires': 'latin-american', argentina: 'latin-american', bogota: 'latin-american', colombia: 'latin-american', lima: 'latin-american',
  gulf: 'gulf', dubai: 'gulf', doha: 'gulf', 'abu-dhabi': 'gulf', uae: 'gulf', qatar: 'gulf', riyadh: 'gulf',
};

/** A flavour key from a name, city or country ('Paris', 'nyc', 'Buenos Aires'), or null when unknown. */
export function normalizeCityFlavor(v) {
  if (!v || typeof v !== 'string') return null;
  const key = v.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[ãáâ]/g, 'a').replace(/[óô]/g, 'o');
  return FLAVOR_ALIASES[key] || (CITY_FLAVORS[key] ? key : null);
}

// the landmark's own city, so a recipe that names a monument gets its streets too
export const LANDMARK_HOME_FLAVOR = {
  'eiffel-tower': 'paris', eiffel: 'paris', 'arc-de-triomphe': 'paris', 'louvre-pyramid': 'paris',
  'big-ben': 'london',
  colosseum: 'mediterranean', parthenon: 'mediterranean',
  'empire-state-building': 'new-york', 'empire-state': 'new-york', empire: 'new-york', 'statue-of-liberty': 'new-york', liberty: 'new-york',
  'cn-tower': 'north-american', 'rogers-centre': 'north-american', skydome: 'north-american', 'parliament-hill': 'north-american',
  'gateway-arch': 'north-american', gateway: 'north-american', 'washington-monument': 'north-american', 'griffith-observatory': 'north-american',
  'cloud-gate': 'north-american', 'chicago-bean': 'north-american', bean: 'north-american',
  'tokyo-tower': 'tokyo', tokyo: 'tokyo', skytree: 'tokyo',
  'petronas-towers': 'southeast-asia', 'rizal-monument': 'southeast-asia', rizal: 'southeast-asia',
  'mexican-pyramid': 'latin-american',
};

// the flavours a `locale` region rolls among (a region with none listed rolls over all)
const REGION_FLAVORS = {
  'north-america': ['north-american', 'new-york'],
  europe: ['paris', 'london', 'mediterranean'],
  'east-asia': ['tokyo'],
  'southeast-asia': ['southeast-asia'], philippines: ['southeast-asia'], indochina: ['southeast-asia'],
  'south-america': ['latin-american'],
  'middle-east': ['gulf'],
};
// the open roll: today's look twice as likely as any one other
const ROLL_WEIGHTS = { 'north-american': 2 };

function mix32(a) {
  let t = (a + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The flavour a new metro mint writes: the recipe's own (normalized), else the first landmark with a
 * home city, else a seeded roll within the `region` (a canonical locale), else over every flavour.
 * Pure and deterministic; the caller stores the result so the list may grow without moving a row.
 */
export function resolveMintFlavor({ flavor = null, landmarks = [], region = null, seed = 1 } = {}) {
  const asked = normalizeCityFlavor(flavor);
  if (asked) return asked;
  for (const shape of landmarks) if (LANDMARK_HOME_FLAVOR[shape]) return LANDMARK_HOME_FLAVOR[shape];
  const pool = (region && REGION_FLAVORS[region]) || Object.keys(CITY_FLAVORS);
  const weights = pool.map((k) => ROLL_WEIGHTS[k] || 1), total = weights.reduce((a, b) => a + b, 0);
  let u = mix32(((Math.trunc(seed) >>> 0) ^ 0x0f1a70) >>> 0) * total;
  for (let i = 0; i < pool.length; i++) { u -= weights[i]; if (u < 0) return pool[i]; }
  return pool[pool.length - 1];
}
