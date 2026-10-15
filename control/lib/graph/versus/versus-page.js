/**
 * versus page — a versus game's playable page, as one self-contained HTML file.
 *
 * The pure modules are inlined by concatenation (they only import from each other, so stripping their import lines
 * and `export ` yields one classic script, as the pixelizer shells do), followed by the browser shell
 * (versus-play.client.js) and the game's data: its title, its roster as recipes (an intent is solved here, on the
 * server; the page compiles the recipes), its stages. Recipes, not renders: the stored game is a few words, the page
 * is regenerated on every read. No network, no CDN.
 *
 *   manifest = { kind: 'game', engine: 'versus', title?, roster?: [intent | { recipe }], stages?: [stage],
 *                arenas?: [{ ref, name?, says? }], rules?: { rounds?, timer?, systems?, … (versus-core readRules) } }
 *
 * A spawned game is extended by editing this manifest (update_sketch): a roster entry's weapon, tunes, own
 * specials and slot overrides (versus-solver.js, versus-compile.js), the rules and their systems.
 * readVersusManifest is the gate: every fighter compiles and every rule reads, or it says why.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { solveFighter } from './versus-solver.js';
import { compileFighter } from './versus-compile.js';
import { readRules } from './versus-core.js';
import { lawStamp } from './versus-laws.js';
import { DEFAULT_ROSTER, DEFAULT_STAGES } from './versus-roster.js';
import { ARENA_PLANE } from './versus-arena.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';

// the level wire a hosted arena speaks (the game shell's own handshake: ready → init → outcome)
export const VERSUS_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });

const SRC = moduleDir(import.meta.url, 'lib/graph/versus');

// the order matters: each module only uses names from the ones before it
export const VERSUS_PAGE_MODULES = Object.freeze([
  'versus-rig.js', 'versus-library.js', 'versus-compile.js', 'versus-input.js', 'versus-core.js', 'versus-cpu.js',
]);

/** A sibling module as a classic-script fragment (import lines and `export ` stripped). */
export const versusSource = (file) =>
  readFileSync(join(SRC, file), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export /gm, '');

const PALETTE = ['#e0503a', '#3a9be0', '#9a4ae0', '#e0a23a', '#3ae08a', '#e03a9a', '#c8c8c8', '#6ad0d0'];

/** A roster entry (an intent, or { recipe }) → the page's entry: id, name, color, archetype, recipe. */
export function rosterEntry(entry, k = 0) {
  // a character (versus-character.js) is measured where the game is served, before it reaches here
  if (entry.hero !== undefined) throw new Error(`versus: roster[${k}] is a character (hero.ref '${entry.hero?.ref}'): it is measured from the store where the game is served`);
  const recipe = entry.recipe ?? solveFighter(entry).recipe;
  return {
    id: recipe.id, name: recipe.name, archetype: recipe.archetype ?? entry.archetype ?? null,
    color: entry.color ?? PALETTE[k % PALETTE.length], recipe,
    ...(entry.character ? { character: entry.character } : {}),
  };
}

/** The game data the page carries. */
export function versusGameData(manifest = {}) {
  const roster = (manifest.roster ?? DEFAULT_ROSTER).map(rosterEntry);
  if (roster.length < 1) throw new Error('versus: a roster needs at least one fighter');
  const stages = manifest.stages ?? DEFAULT_STAGES;
  const rules = rulesOf(manifest.rules);
  // arenas: scapeshift stage worlds carrying the fight channel, hosted in a frame (`src`: their World page)
  const arenas = (manifest.arenas ?? []).map((a) => ({ ref: a.ref, name: a.name ?? a.ref, ...(a.says ? { says: a.says } : {}), src: a.src ?? `/api/sketches/${encodeURIComponent(a.ref)}/world?hud=0` }));
  return { title: manifest.title ?? 'Versus', roster, stages, rules, ...(arenas.length ? { arenas } : {}), wire: VERSUS_WIRE };
}

const rulesOf = (r) => readRules(r);

const MANIFEST_KEYS = ['kind', 'engine', 'title', 'roster', 'stages', 'arenas', 'rules', 'theme'];

/**
 * The gate a versus manifest pays at mint and on every edit: → { ok, errors, laws }. `laws` is each fighter's stamp
 * (versus-laws.js: { id, held, of, broken }): it advises, never refuses.
 */
export function readVersusManifest(manifest = {}) {
  const errors = [];
  for (const k of Object.keys(manifest)) if (!MANIFEST_KEYS.includes(k)) errors.push(`${k}: a versus game takes ${MANIFEST_KEYS.join(', ')}`);
  if (manifest.roster !== undefined && (!Array.isArray(manifest.roster) || !manifest.roster.length)) errors.push('roster is a list of fighters (intents, or { recipe })');
  try { readRules(manifest.rules); } catch (e) { errors.push(e.message.replace(/^versus: /, '')); }
  const ids = new Set();
  const laws = [];
  (Array.isArray(manifest.roster) ? manifest.roster : []).forEach((entry, i) => {
    try {
      const { recipe } = rosterEntry(entry, i);
      if (ids.has(recipe.id)) throw new Error(`id '${recipe.id}' is taken`);
      ids.add(recipe.id);
      laws.push({ id: recipe.id, ...lawStamp(compileFighter(recipe)) });
    } catch (e) { errors.push(`roster[${i}]: ${e.message.replace(/^versus: /, '')}`); }
  });
  return { ok: !errors.length, errors, laws };
}

/** What an arena's fight channel carries: the plane and walls (m), the floor, the roster solved, the rules, the wire. */
export function versusArenaData(v = {}) {
  const roster = (v.roster ?? DEFAULT_ROSTER).map(rosterEntry);
  if (roster.length < 1) throw new Error('versus: an arena needs at least one fighter');
  return { plane: v.plane ?? ARENA_PLANE, half: v.half ?? 8, floor: v.floor ?? 0, roster, rules: rulesOf(v.rules), wire: VERSUS_WIRE };
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The playable page. */
export function emitVersusPage(manifest = {}, { title } = {}) {
  const data = versusGameData({ ...manifest, title: title ?? manifest.title });
  const lib = [...VERSUS_PAGE_MODULES, 'versus-runtime.client.js'].map((f) => `// ── ${f} ──\n${versusSource(f)}`).join('\n');
  const shell = versusSource('versus-play.client.js');
  // the data rides as JSON; `</` is escaped so nothing in a name can close the script
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #0c0a10; overflow: hidden; }
  canvas { display: block; touch-action: none; }
</style>
</head>
<body>
<canvas id="versus"></canvas>
<script>
"use strict";
(function () {
const VERSUS = ${json};
${lib}
${shell}
})();
</script>
</body>
</html>
`;
}
