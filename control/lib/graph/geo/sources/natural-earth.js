/**
 * Natural Earth gazetteer.
 *
 * Public-domain country and admin-1 (state/province) boundaries published as
 * GeoJSON by the nvkelso/natural-earth-vector mirror. Offline-friendly: on
 * first use we fetch one of two bulk collections, cache the whole file under
 * `_collections/`, then filter by name. All subsequent queries against the
 * same collection are network-free.
 *
 * Resolution is 1:50m — coarse enough that "the boundary of Sweden" is the
 * country outline, not the coastline at municipality detail. Operators who
 * need a neighborhood ask Nominatim instead.
 *
 * Sovereignty stance: we render what Natural Earth's `ne_admin_0_countries`
 * file says. Disputed regions follow Natural Earth's editorial choices. The
 * card surfaces the source URL so the operator can read NE's rationale.
 *
 * The bulk file is ~5 MB. We fetch it once per collection per operator install
 * and never refetch until the cache file is deleted.
 */

import { readJson, writeJson } from '../cache.js';

const COLLECTIONS = {
  'admin-0': {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
    nameFields: ['NAME', 'NAME_LONG', 'FORMAL_EN', 'ADMIN', 'SOVEREIGNT'],
    altCodeFields: ['ISO_A2', 'ISO_A3', 'ADM0_A3'],
  },
  'admin-1': {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',
    nameFields: ['name', 'name_en', 'name_alt', 'gn_name'],
    altCodeFields: ['iso_3166_2', 'adm1_code'],
  },
};

const DEFAULT_COLLECTION = 'admin-0';
const COLLECTION_CACHE_PREFIX = '_collections';

function normalize(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function loadCollection(level) {
  const collection = COLLECTIONS[level];
  if (!collection) {
    throw new Error(
      `natural-earth: unknown level '${level}' (expected: ${Object.keys(COLLECTIONS).join(', ')})`,
    );
  }
  const cacheKey = `${COLLECTION_CACHE_PREFIX}/${level}`;
  const cached = await readJson('natural-earth', cacheKey);
  if (cached) return { collection, data: cached, fromCache: true };

  const resp = await fetch(collection.url, {
    headers: { 'User-Agent': 'mojulo-map-illustrator/0.1 (+https://github.com/zombico/mojulo)' },
  });
  if (!resp.ok) {
    throw new Error(`natural-earth: fetch failed ${resp.status} ${resp.statusText} (${collection.url})`);
  }
  const data = await resp.json();
  await writeJson('natural-earth', cacheKey, data, { sourceUrl: collection.url, level });
  return { collection, data, fromCache: false };
}

function matchFeatures(data, query, fields) {
  const q = normalize(query);
  if (!q) return [];
  const exact = [];
  const startsWith = [];
  const contains = [];
  for (const feat of data.features || []) {
    const props = feat.properties || {};
    for (const f of fields) {
      const value = props[f];
      const n = normalize(value);
      if (!n) continue;
      if (n === q) {
        exact.push({ feature: feat, field: f, value });
        break;
      }
      if (n.startsWith(q)) {
        startsWith.push({ feature: feat, field: f, value });
        break;
      }
      if (n.includes(q)) {
        contains.push({ feature: feat, field: f, value });
        break;
      }
    }
  }
  return exact.length ? exact : startsWith.length ? startsWith : contains;
}

function describeCandidate({ feature, field, value }, level) {
  const props = feature.properties || {};
  const altFields = COLLECTIONS[level].altCodeFields;
  const codes = altFields.map((f) => props[f]).filter(Boolean).join('/');
  return {
    id: codes || value,
    label: value,
    hint: `${field}=${value}${codes ? ` (${codes})` : ''}`,
  };
}

/**
 * Look up a place by name in the Natural Earth collection. Returns one of:
 *
 *   { kind: 'match', geometry, sourceUrl, properties, fetchedAt }
 *   { kind: 'ambiguous', candidates: [{ id, label, hint }], sourceUrl }
 *   { kind: 'not-found' }
 *
 * The orchestrator decides what to do with ambiguous matches (surface them to
 * the operator so they can pick).
 */
export async function fetchNaturalEarth({ query, level = DEFAULT_COLLECTION } = {}) {
  if (!query) throw new Error('fetchNaturalEarth: query is required');
  const { collection, data } = await loadCollection(level);
  const matches = matchFeatures(data, query, collection.nameFields);
  if (matches.length === 0) {
    return { kind: 'not-found', sourceUrl: collection.url, source: 'natural-earth', level };
  }
  if (matches.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: matches.slice(0, 8).map((m) => describeCandidate(m, level)),
      sourceUrl: collection.url,
      source: 'natural-earth',
      level,
    };
  }
  const { feature } = matches[0];
  return {
    kind: 'match',
    geometry: feature.geometry,
    properties: feature.properties || {},
    sourceUrl: collection.url,
    source: 'natural-earth',
    level,
    fetchedAt: new Date().toISOString(),
  };
}

export const NATURAL_EARTH_LEVELS = Object.keys(COLLECTIONS);
