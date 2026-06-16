/**
 * Civic glyph city composer.
 *
 * A civic glyph is a 2D structured city-layout seed above the architecture
 * registry and mandala planner. It expands into planner-compatible surfaces,
 * density zones, and semideterministic concept selections so the model does
 * not decide every curb object by hand.
 */

export const CIVIC_GLYPH_VERSION = '0.1.0';

function surface(id, kind, contract, rect, maxCoverage, note) {
  const [u, v, w, h] = rect;
  return { id, kind, contract, rect: { u, v, w, h }, maxCoverage, note };
}

export const CIVIC_GLYPHS = [
  {
    id: 'mixed-skyline-mandala',
    label: 'Mixed skyline mandala',
    topology: 'tower-cluster-with-radial-and-rectilinear-massing',
    aliases: [
      'city skyline',
      'skyscraper cluster',
      'downtown towers',
      'mixed radial and angular towers',
      'avengers tower style skyline',
      'heroic tower cityscape',
    ],
    densityBias: 0.78,
    surfaces: [
      surface('scene.ground', 'groundPlane', 'scene', [0.00, 0.00, 1.00, 1.00], 0.92, 'overall city support'),
      surface('street.main', 'roadPlane', 'street', [0.05, 0.62, 0.90, 0.14], 0.92, 'street base for skyline towers'),
      surface('sidewalk.near', 'sidewalk', 'curb', [0.05, 0.76, 0.90, 0.08], 0.82, 'foreground public edge'),
      surface('building.a.mass', 'buildingMass', 'building.mass', [0.07, 0.10, 0.28, 0.46], 0.86, 'rectilinear facade-wrap tower support'),
      surface('building.b.mass', 'buildingMass', 'building.mass', [0.39, 0.15, 0.23, 0.40], 0.86, 'secondary rectilinear tower support'),
      surface('building.radial.node', 'radialBuildingMass', 'building.radialMass', [0.68, 0.08, 0.22, 0.48], 0.82, 'radial/cylindrical heroic tower support'),
      surface('plaza.node', 'plaza', 'publicRealm.node', [0.34, 0.80, 0.28, 0.12], 0.78, 'plaza between tower bases'),
    ],
    zones: [
      { id: 'tower-core', role: 'building', density: 0.92, surfaceRefs: ['building.a.mass', 'building.b.mass', 'building.radial.node'] },
      { id: 'street-base', role: 'urban', density: 0.74, surfaceRefs: ['street.main', 'sidewalk.near'] },
      { id: 'plaza-civic', role: 'civic', density: 0.54, surfaceRefs: ['plaza.node'] },
    ],
    requiredConcepts: ['urban.sidewalk-road', 'building.facade-wrap-tower', 'building.radial-wrap-tower'],
    optionalSpawns: [
      { conceptId: 'facade.storefront-podium', zone: 'tower-core', threshold: 0.24 },
      { conceptId: 'facade.condo-grid', zone: 'tower-core', threshold: 0.42 },
      { conceptId: 'urban.traffic-signals', zone: 'street-base', threshold: 0.44 },
      { conceptId: 'urban.bus-stop-shelter', zone: 'street-base', threshold: 0.52 },
      { conceptId: 'civic.public-realm-kit', zone: 'plaza-civic', threshold: 0.38 },
    ],
  },
  {
    id: 'transit-plaza-grid',
    label: 'Transit plaza grid',
    topology: 'orthogonal-transit-hub',
    aliases: ['transit plaza', 'train airport interchange', 'station plaza', 'transport hub city block'],
    densityBias: 0.68,
    surfaces: [
      surface('scene.ground', 'groundPlane', 'scene', [0.00, 0.00, 1.00, 1.00], 0.92, 'overall city support'),
      surface('street.main', 'roadPlane', 'street', [0.05, 0.56, 0.90, 0.16], 0.92, 'main street and crosswalk support'),
      surface('sidewalk.near', 'sidewalk', 'curb', [0.05, 0.72, 0.90, 0.09], 0.82, 'near curb furniture'),
      surface('sidewalk.far', 'sidewalk', 'curb', [0.05, 0.46, 0.90, 0.08], 0.82, 'far curb furniture'),
      surface('building.a.front', 'facadeFace', 'building.frontFace', [0.08, 0.15, 0.34, 0.26], 0.86, 'commercial frontage'),
      surface('building.b.front', 'facadeFace', 'building.frontFace', [0.45, 0.14, 0.26, 0.24], 0.86, 'secondary frontage'),
      surface('plaza.node', 'plaza', 'publicRealm.node', [0.36, 0.77, 0.24, 0.14], 0.78, 'station plaza'),
      surface('rail.platform', 'railPlatform', 'rail.platform', [0.08, 0.34, 0.42, 0.12], 0.86, 'train station and platforms'),
      surface('terminal.apron', 'transportApron', 'terminal.apron', [0.56, 0.33, 0.36, 0.16], 0.86, 'airport edge/terminal apron'),
      surface('utility.edge', 'utilityEasement', 'utility.easement', [0.84, 0.12, 0.10, 0.30], 0.74, 'utility edge'),
    ],
    zones: [
      { id: 'station-core', role: 'transit', density: 0.86, surfaceRefs: ['rail.platform', 'terminal.apron'] },
      { id: 'commercial-frontage', role: 'commercial', density: 0.72, surfaceRefs: ['building.a.front', 'building.b.front'] },
      { id: 'curb-furniture', role: 'urban', density: 0.66, surfaceRefs: ['sidewalk.near', 'sidewalk.far'] },
      { id: 'plaza-civic', role: 'civic', density: 0.48, surfaceRefs: ['plaza.node'] },
    ],
    requiredConcepts: ['urban.sidewalk-road', 'transport.train-station', 'transport.airport-terminal', 'facade.storefront-podium'],
    optionalSpawns: [
      { conceptId: 'urban.bus-stop-shelter', zone: 'curb-furniture', threshold: 0.25 },
      { conceptId: 'urban.traffic-signals', zone: 'curb-furniture', threshold: 0.36 },
      { conceptId: 'urban.hydrant-utility', zone: 'curb-furniture', threshold: 0.45 },
      { conceptId: 'urban.billboard-signage', zone: 'commercial-frontage', threshold: 0.56 },
      { conceptId: 'civic.public-realm-kit', zone: 'plaza-civic', threshold: 0.42 },
      { conceptId: 'infrastructure.cell-tower', zone: 'station-core', threshold: 0.72 },
    ],
  },
  {
    id: 'market-street-grid',
    label: 'Market street grid',
    topology: 'linear-commercial-street',
    aliases: ['market street', 'shopping street', 'dense storefront city block'],
    densityBias: 0.74,
    surfaces: [
      surface('scene.ground', 'groundPlane', 'scene', [0.00, 0.00, 1.00, 1.00], 0.92, 'overall city support'),
      surface('street.main', 'roadPlane', 'street', [0.06, 0.58, 0.88, 0.15], 0.92, 'market street road'),
      surface('sidewalk.near', 'sidewalk', 'curb', [0.06, 0.73, 0.88, 0.10], 0.82, 'near market sidewalk'),
      surface('sidewalk.far', 'sidewalk', 'curb', [0.06, 0.46, 0.88, 0.09], 0.82, 'far market sidewalk'),
      surface('building.a.front', 'facadeFace', 'building.frontFace', [0.08, 0.14, 0.40, 0.30], 0.86, 'left storefront row'),
      surface('building.b.front', 'facadeFace', 'building.frontFace', [0.52, 0.14, 0.36, 0.28], 0.86, 'right storefront row'),
      surface('plaza.node', 'plaza', 'publicRealm.node', [0.38, 0.82, 0.22, 0.12], 0.78, 'small civic plaza'),
    ],
    zones: [
      { id: 'frontage', role: 'commercial', density: 0.90, surfaceRefs: ['building.a.front', 'building.b.front'] },
      { id: 'curb-furniture', role: 'urban', density: 0.78, surfaceRefs: ['sidewalk.near', 'sidewalk.far'] },
      { id: 'pocket-plaza', role: 'civic', density: 0.52, surfaceRefs: ['plaza.node'] },
    ],
    requiredConcepts: ['urban.sidewalk-road', 'facade.storefront-podium'],
    optionalSpawns: [
      { conceptId: 'urban.newsstand-vendor', zone: 'curb-furniture', threshold: 0.22 },
      { conceptId: 'urban.bus-stop-shelter', zone: 'curb-furniture', threshold: 0.38 },
      { conceptId: 'urban.phone-booth', zone: 'curb-furniture', threshold: 0.52 },
      { conceptId: 'urban.traffic-signals', zone: 'curb-furniture', threshold: 0.45 },
      { conceptId: 'urban.billboard-signage', zone: 'frontage', threshold: 0.55 },
      { conceptId: 'civic.public-realm-kit', zone: 'pocket-plaza', threshold: 0.34 },
    ],
  },
  {
    id: 'industrial-service-edge',
    label: 'Industrial service edge',
    topology: 'yard-dock-utility-spine',
    aliases: ['industrial edge', 'service yard', 'refinery district', 'harbor service city'],
    densityBias: 0.62,
    surfaces: [
      surface('scene.ground', 'groundPlane', 'scene', [0.00, 0.00, 1.00, 1.00], 0.92, 'overall industrial support'),
      surface('street.main', 'roadPlane', 'street', [0.05, 0.57, 0.90, 0.14], 0.92, 'service road'),
      surface('yard.grid', 'yard', 'yard.grid', [0.12, 0.24, 0.48, 0.26], 0.80, 'industrial yard grid'),
      surface('dock.edge', 'dock', 'dock.edge', [0.58, 0.70, 0.34, 0.10], 0.78, 'dock edge'),
      surface('utility.edge', 'utilityEasement', 'utility.easement', [0.76, 0.18, 0.16, 0.32], 0.74, 'utility spine'),
    ],
    zones: [
      { id: 'yard-core', role: 'industrial', density: 0.76, surfaceRefs: ['yard.grid'] },
      { id: 'dock-edge', role: 'dock', density: 0.58, surfaceRefs: ['dock.edge'] },
      { id: 'utility-spine', role: 'infrastructure', density: 0.64, surfaceRefs: ['utility.edge'] },
    ],
    requiredConcepts: ['urban.sidewalk-road', 'industrial.pipe-refinery', 'infrastructure.power-tower'],
    optionalSpawns: [
      { conceptId: 'industrial.harbor-shipyard', zone: 'dock-edge', threshold: 0.48 },
      { conceptId: 'industrial.site-structures', zone: 'yard-core', threshold: 0.58 },
      { conceptId: 'infrastructure.cell-tower', zone: 'utility-spine', threshold: 0.72 },
    ],
  },
];

const GLYPH_BY_ID = new Map(CIVIC_GLYPHS.map((glyph) => [glyph.id, glyph]));

function hashSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed || 'civic-glyph')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

export function listCivicGlyphs() {
  return CIVIC_GLYPHS.map(({ id, label, topology, aliases, densityBias }) => ({
    id,
    label,
    topology,
    aliases,
    densityBias,
  }));
}

export function getCivicGlyph(id) {
  return GLYPH_BY_ID.get(id) || null;
}

export function expandCivicGlyph({
  glyph = 'transit-plaza-grid',
  seed = glyph,
  density,
  variation = 0.35,
  forceConcepts = [],
} = {}) {
  const source = getCivicGlyph(glyph);
  if (!source) throw new Error(`Unknown civic glyph '${glyph}'.`);
  const random = mulberry32(hashSeed(`${seed}:${source.id}`));
  const globalDensity = clamp01(density ?? source.densityBias);
  const variationAmount = clamp01(variation);
  const conceptIds = [...source.requiredConcepts];
  const spawnPlan = [];

  for (const spawn of source.optionalSpawns) {
    const zone = source.zones.find((item) => item.id === spawn.zone);
    const zoneDensity = clamp01((zone?.density ?? 1) * (0.25 + globalDensity * 0.75));
    const jitter = (random() - 0.5) * variationAmount;
    const score = clamp01(zoneDensity + jitter);
    const selected = score >= spawn.threshold;
    spawnPlan.push({
      conceptId: spawn.conceptId,
      zone: spawn.zone,
      threshold: spawn.threshold,
      score: Number(score.toFixed(3)),
      selected,
    });
    if (selected) conceptIds.push(spawn.conceptId);
  }

  for (const conceptId of forceConcepts) {
    if (!conceptIds.includes(conceptId)) conceptIds.push(conceptId);
  }

  const densityMap = source.zones.map((zone) => ({
    ...zone,
    effectiveDensity: Number(clamp01(zone.density * (0.25 + globalDensity * 0.75)).toFixed(3)),
  }));

  return {
    civicGlyphVersion: CIVIC_GLYPH_VERSION,
    glyph: source.id,
    label: source.label,
    topology: source.topology,
    seed,
    density: globalDensity,
    variation: variationAmount,
    surfaces: source.surfaces.map((item) => ({
      ...item,
      rect: { ...item.rect },
    })),
    densityMap,
    spawnPlan,
    conceptIds: [...new Set(conceptIds)],
  };
}
