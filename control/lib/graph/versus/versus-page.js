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
 *                rules?: { rounds?, timer? } }
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { solveFighter } from './versus-solver.js';
import { DEFAULT_ROSTER, DEFAULT_STAGES } from './versus-roster.js';

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
  const recipe = entry.recipe ?? solveFighter(entry).recipe;
  return {
    id: recipe.id, name: recipe.name, archetype: recipe.archetype ?? entry.archetype ?? null,
    color: entry.color ?? PALETTE[k % PALETTE.length], recipe,
  };
}

/** The game data the page carries. */
export function versusGameData(manifest = {}) {
  const roster = (manifest.roster ?? DEFAULT_ROSTER).map(rosterEntry);
  if (roster.length < 1) throw new Error('versus: a roster needs at least one fighter');
  const stages = manifest.stages ?? DEFAULT_STAGES;
  const rules = { ...(manifest.rules?.rounds ? { rounds: manifest.rules.rounds } : {}), ...(manifest.rules?.timer ? { timer: manifest.rules.timer } : {}) };
  return { title: manifest.title ?? 'Versus', roster, stages, rules };
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The playable page. */
export function emitVersusPage(manifest = {}, { title } = {}) {
  const data = versusGameData({ ...manifest, title: title ?? manifest.title });
  const lib = VERSUS_PAGE_MODULES.map((f) => `// ── ${f} ──\n${versusSource(f)}`).join('\n');
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
