/**
 * OpenStreetMap Nominatim gazetteer.
 *
 * Live, granular down to neighborhoods. Two-call flow:
 *
 *   1. /search?q=<query>&polygon_geojson=1&format=jsonv2 — returns ranked
 *      candidates with their geometry inline.
 *
 * We do not chain the /lookup endpoint — the search response already carries
 * a polygon when `polygon_geojson=1` is set, so a single call gives us
 * everything we need. The orchestrator handles disambiguation.
 *
 * Nominatim has a strict 1 req/sec usage policy and REQUIRES a descriptive
 * User-Agent identifying the application + a contact. The operator can swap
 * the public endpoint for a self-hosted instance via OSM_NOMINATIM_ENDPOINT.
 *
 * Sovereignty stance: we render what Nominatim returns. OSM's editorial
 * choices on disputed boundaries are not ours to relitigate.
 */

import { readJson, writeJson } from '../cache.js';
import { slugifyQuery } from '../slug.js';

const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org';
const SEARCH_LIMIT = 8;

function endpoint() {
  return process.env.OSM_NOMINATIM_ENDPOINT || DEFAULT_ENDPOINT;
}

function userAgent() {
  const contact = process.env.OSM_NOMINATIM_CONTACT || 'unknown';
  return `mojulo-map-illustrator/0.1 (+${contact})`;
}

function pickGeometry(entry) {
  const g = entry.geojson;
  if (!g) return null;
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') return g;
  return null;
}

function describeCandidate(entry) {
  return {
    id: `osm:${entry.osm_type}/${entry.osm_id}`,
    label: entry.display_name || entry.name || String(entry.osm_id),
    hint: `${entry.type || ''}${entry.class ? ' ' + entry.class : ''}`.trim() || undefined,
  };
}

export async function fetchOsmNominatim({ query } = {}) {
  if (!query) throw new Error('fetchOsmNominatim: query is required');

  const cacheKey = slugifyQuery(query);
  const cached = await readJson('osm-nominatim', cacheKey);
  let entries;
  let sourceUrl;
  if (cached) {
    entries = cached.entries;
    sourceUrl = cached.sourceUrl;
  } else {
    const url = new URL('/search', endpoint());
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('polygon_geojson', '1');
    url.searchParams.set('limit', String(SEARCH_LIMIT));
    sourceUrl = url.toString();
    const resp = await fetch(sourceUrl, { headers: { 'User-Agent': userAgent() } });
    if (!resp.ok) {
      throw new Error(`osm-nominatim: fetch failed ${resp.status} ${resp.statusText} (${sourceUrl})`);
    }
    entries = await resp.json();
    await writeJson('osm-nominatim', cacheKey, { entries, sourceUrl }, { sourceUrl, query });
  }

  const withGeometry = entries.filter((e) => pickGeometry(e));
  if (withGeometry.length === 0) {
    return { kind: 'not-found', sourceUrl, source: 'osm-nominatim' };
  }
  if (withGeometry.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: withGeometry.map(describeCandidate),
      sourceUrl,
      source: 'osm-nominatim',
    };
  }
  const entry = withGeometry[0];
  return {
    kind: 'match',
    geometry: pickGeometry(entry),
    properties: {
      osm_type: entry.osm_type,
      osm_id: entry.osm_id,
      display_name: entry.display_name,
      class: entry.class,
      type: entry.type,
    },
    sourceUrl,
    source: 'osm-nominatim',
    fetchedAt: new Date().toISOString(),
  };
}
