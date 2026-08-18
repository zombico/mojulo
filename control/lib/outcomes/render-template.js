/**
 * Outcome template renderer — shared partial composition + slot substitution.
 *
 * Two passes, in order:
 *   1. `{{>partial_name}}` references are recursively expanded against
 *      `lib/outcomes/partials/<name>.html`. Partials can reference other
 *      partials; a small DEPTH cap prevents accidental cycles.
 *   2. `{{slot_name}}` substitutions are applied from the supplied slots map.
 *
 * Order matters: partials may carry their own `{{slot_name}}` placeholders
 * that the slots map fills in the second pass. This keeps partials inert
 * fragments instead of mini-templates with their own slot interfaces.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../module-dir.js';
const HERE = moduleDir(import.meta.url, 'lib/outcomes');
const PARTIALS_DIR = path.join(HERE, 'partials');

const PARTIAL_RE = /\{\{>([a-z0-9_-]+)\}\}/g;
const SLOT_RE = /\{\{([a-z_]+)\}\}/g;

const MAX_PARTIAL_DEPTH = 8;

const partialCache = new Map();

async function loadPartial(name) {
  if (partialCache.has(name)) return partialCache.get(name);
  const filePath = path.join(PARTIALS_DIR, `${name}.html`);
  const body = await fs.readFile(filePath, 'utf8');
  partialCache.set(name, body);
  return body;
}

async function expandPartials(source, depth = 0) {
  if (depth > MAX_PARTIAL_DEPTH) {
    throw new Error(`partial expansion exceeded depth ${MAX_PARTIAL_DEPTH} — likely a cycle`);
  }
  const matches = [...source.matchAll(PARTIAL_RE)];
  if (matches.length === 0) return source;
  let out = '';
  let last = 0;
  for (const m of matches) {
    out += source.slice(last, m.index);
    const partial = await loadPartial(m[1]);
    out += await expandPartials(partial, depth + 1);
    last = m.index + m[0].length;
  }
  out += source.slice(last);
  return out;
}

function substituteSlots(source, slots) {
  return source.replace(SLOT_RE, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(slots, key)) return slots[key];
    return m;
  });
}

/**
 * Render a template string: expand `{{>partial}}` references, then substitute
 * `{{slot}}` placeholders from the slots map. Unknown slot keys are left in
 * place (debug aid — surfacing them in the rendered HTML makes missing wiring
 * obvious).
 *
 * @param {string} source — the template body
 * @param {Record<string, string>} slots — slot name → escaped/safe value
 * @returns {Promise<string>}
 */
export async function renderTemplate(source, slots) {
  const expanded = await expandPartials(source);
  return substituteSlots(expanded, slots);
}

// Test seam — also lets the cache be cleared in tests that swap partial files.
export const _internals = { PARTIAL_RE, SLOT_RE, expandPartials, substituteSlots, partialCache };
