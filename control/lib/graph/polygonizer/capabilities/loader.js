/**
 * Sketch-method catalog loader.
 *
 * Per-family capability catalogs in this directory expose nested objects
 * like ARCH_CAPABILITIES (one family, one description, one knobs map of
 * knob -> [{ value, default?, describe }]). The loader flattens those
 * into per-method records keyed by `<family>:<knob>:<value>` (or
 * `<family>:family` for the family-root record), which the embeddings
 * pipeline indexes into meta_embeddings under source_kind='sketch_method'.
 *
 * Each record's `describe` field is the prose that gets embedded. The
 * `sketch_what_possible` MCP tool retrieves these per turn and the host
 * agent narrates them to the user to run an inverse-stable-diffusion
 * loop: vague prompt -> retrieve methods -> ask user to fill knobs ->
 * accumulate -> call create_sketch with a fully-resolved spec.
 *
 * Scope: scene/figure illustration only. Chart/infographic vocabulary
 * lives under source_kind='sketch_vocab' and is loaded by
 * lib/graph/sketch-vocab/loader.js. Don't merge the two — a chart that
 * embeds an illustration goes through create_sketch as a separate call.
 *
 * Adding a new family: import its CAPABILITIES export and push it into
 * CATALOGS. The flat shape and id convention are enforced at load time.
 */

import { ARCH_CAPABILITIES } from './architectural-construction.js';

const CATALOGS = [ARCH_CAPABILITIES];

function flattenCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    throw new Error('capabilities loader: catalog must be a plain object');
  }
  const family = catalog.family;
  if (!family || typeof family !== 'string') {
    throw new Error('capabilities loader: catalog.family must be a non-empty string');
  }
  const records = [];
  records.push({
    id: `${family}:family`,
    family,
    knob: null,
    value: null,
    isDefault: false,
    describe: String(catalog.description || ''),
  });
  const knobs = catalog.knobs || {};
  for (const [knob, values] of Object.entries(knobs)) {
    if (!Array.isArray(values)) {
      throw new Error(`capabilities loader: ${family}.${knob} must be an array`);
    }
    for (const entry of values) {
      if (!entry || typeof entry !== 'object' || !entry.value) {
        throw new Error(`capabilities loader: ${family}.${knob} entry missing value`);
      }
      records.push({
        id: `${family}:${knob}:${entry.value}`,
        family,
        knob,
        value: entry.value,
        isDefault: Boolean(entry.default),
        describe: String(entry.describe || ''),
      });
    }
  }
  return records;
}

let _cache = null;

export function getSketchMethodCatalog() {
  if (_cache) return _cache;
  const all = new Map();
  for (const catalog of CATALOGS) {
    for (const record of flattenCatalog(catalog)) {
      if (all.has(record.id)) {
        throw new Error(`capabilities loader: duplicate sketch_method id: ${record.id}`);
      }
      all.set(record.id, record);
    }
  }
  _cache = all;
  return _cache;
}

export function listSketchMethodFamilies() {
  return [...new Set([...getSketchMethodCatalog().values()].map((r) => r.family))];
}

export function getKnobValuesForFamily(family) {
  const out = {};
  for (const record of getSketchMethodCatalog().values()) {
    if (record.family !== family || !record.knob) continue;
    if (!out[record.knob]) out[record.knob] = [];
    out[record.knob].push({
      value: record.value,
      isDefault: record.isDefault,
      describe: record.describe,
    });
  }
  return out;
}

export function _resetSketchMethodCacheForTests() {
  _cache = null;
}
