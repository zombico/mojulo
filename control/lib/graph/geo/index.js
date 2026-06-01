/**
 * Map illustrator — turn a place query into polygon marks + a geo audit block.
 *
 * Public surface:
 *
 *   buildMapMarks({
 *     source,           // 'natural-earth' | 'osm-nominatim'
 *     query,            // free-text place name ("Sweden", "Söder Stockholm")
 *     viewBox,          // { width, height } — same one the sketch will use
 *     projection,       // 'equirectangular-bbox' (default) | 'web-mercator'
 *     tolerancePx,      // simplification budget in screen px (default 0.5)
 *     level,            // natural-earth: 'admin-0' (default) | 'admin-1'
 *   }) -> {
 *     kind: 'match' | 'ambiguous' | 'not-found',
 *     marks?: Mark[],                              // when 'match'
 *     geo?: { source, query, projection, tolerancePx, level?, sourceUrl, fetchedAt },
 *     candidates?: { id, label, hint }[],          // when 'ambiguous'
 *     sourceUrl?: string,                          // always when known
 *   }
 *
 * Returns a self-describing result; the caller (the sketch_vocab card's flow)
 * decides whether to call `create_sketch`, surface candidates, or push back.
 *
 * The function is pure with respect to {source, query, viewBox, projection,
 * tolerancePx, level} given the cache is warm — replay yields identical
 * marks. The only impurity is the network on a cold cache.
 *
 * See lite-template/integration/app-system/0530/MAP_ILLUSTRATOR_PRINCIPLES.md.
 */

import { fetchNaturalEarth, NATURAL_EARTH_LEVELS } from './sources/natural-earth.js';
import { fetchOsmNominatim } from './sources/osm-nominatim.js';
import { normalizeGeometry } from './geometry.js';
import { simplifyRing } from './simplify.js';
import {
  PROJECTIONS,
  computeBbox,
  pixelToleranceToDegrees,
  projectRings,
} from './project.js';
import { DEFAULT_THEME, MAP_THEMES, getMapTheme } from './palette.js';

export const SOURCES = ['natural-earth', 'osm-nominatim'];
export const DEFAULT_SOURCE = 'natural-earth';
export const DEFAULT_PROJECTION = 'equirectangular-bbox';
export const DEFAULT_PIXEL_TOLERANCE = 0.5;
export const THEMES = Object.keys(MAP_THEMES);

const Z_OUTER = 10;
const Z_HOLE = 20;

function roundCoord(n) {
  return Math.round(n * 100) / 100;
}

async function fetchBySource(source, opts) {
  switch (source) {
    case 'natural-earth':
      return fetchNaturalEarth(opts);
    case 'osm-nominatim':
      return fetchOsmNominatim(opts);
    default:
      throw new Error(`buildMapMarks: unknown source '${source}' (expected: ${SOURCES.join(', ')})`);
  }
}

function regionIdFor(result, query) {
  const props = result.properties || {};
  if (result.source === 'natural-earth') {
    return (
      props.ISO_A2 ||
      props.ISO_A3 ||
      props.ADM0_A3 ||
      props.iso_3166_2 ||
      props.adm1_code ||
      props.NAME ||
      query
    );
  }
  if (result.source === 'osm-nominatim') {
    return `osm:${props.osm_type}/${props.osm_id}`;
  }
  return query;
}

export async function buildMapMarks({
  source = DEFAULT_SOURCE,
  query,
  viewBox,
  projection = DEFAULT_PROJECTION,
  tolerancePx = DEFAULT_PIXEL_TOLERANCE,
  level,
  theme = DEFAULT_THEME,
} = {}) {
  if (!query) throw new Error('buildMapMarks: query is required');
  if (!viewBox || !(viewBox.width > 0) || !(viewBox.height > 0)) {
    throw new Error('buildMapMarks: viewBox { width, height } required');
  }
  if (!PROJECTIONS.includes(projection)) {
    throw new Error(
      `buildMapMarks: unknown projection '${projection}' (expected: ${PROJECTIONS.join(', ')})`,
    );
  }
  if (!(tolerancePx >= 0)) {
    throw new Error('buildMapMarks: tolerancePx must be a non-negative number');
  }
  if (source === 'natural-earth' && level && !NATURAL_EARTH_LEVELS.includes(level)) {
    throw new Error(
      `buildMapMarks: unknown natural-earth level '${level}' (expected: ${NATURAL_EARTH_LEVELS.join(', ')})`,
    );
  }
  const palette = getMapTheme(theme);

  const fetchOpts = source === 'natural-earth' ? { query, level: level || 'admin-0' } : { query };
  const result = await fetchBySource(source, fetchOpts);

  if (result.kind !== 'match') {
    return {
      kind: result.kind,
      candidates: result.candidates,
      sourceUrl: result.sourceUrl,
      source,
      query,
    };
  }

  const rings = normalizeGeometry(result.geometry);
  const bbox = computeBbox(rings.map((r) => r.ring));
  const degTolerance = pixelToleranceToDegrees({
    pixelTolerance: tolerancePx,
    bbox,
    viewBox,
  });

  const simplified = rings.map((r) => ({
    ...r,
    ring: degTolerance > 0 ? simplifyRing(r.ring, degTolerance) : r.ring,
  }));

  const projected = projectRings(
    simplified.map((r) => r.ring),
    { projection, viewBox, bbox },
  );

  const regionId = regionIdFor(result, query);
  const marks = simplified.map((r, i) => {
    const isHole = r.role === 'hole';
    return {
      kind: 'polygon',
      id: isHole ? `${regionId}#hole-${r.polygonIndex}-${i}` : regionId,
      role: r.role,
      points: projected[i].map(([x, y]) => [roundCoord(x), roundCoord(y)]),
      fill: isHole ? palette.holeFill : palette.outerFill,
      stroke: isHole ? palette.holeStroke : palette.outerStroke,
      strokeWidth: isHole ? palette.holeStrokeWidth : palette.outerStrokeWidth,
      z: isHole ? Z_HOLE : Z_OUTER,
    };
  });

  return {
    kind: 'match',
    marks,
    geo: {
      source,
      query,
      projection,
      tolerancePx,
      theme,
      ...(source === 'natural-earth' ? { level: level || 'admin-0' } : {}),
      regionId,
      sourceUrl: result.sourceUrl,
      fetchedAt: result.fetchedAt,
    },
    sourceUrl: result.sourceUrl,
  };
}
