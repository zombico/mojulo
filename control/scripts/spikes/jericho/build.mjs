#!/usr/bin/env node
/**
 * HIDDEN JERICHO, THE PROLOGUE'S PAGES — each level of world.json laid as a designed game lays it (gameworld/levels.js:
 * an infiltration level, its opening, its scenes, its script's radio calls) and written as one World page each. A spike:
 * the world is read and laid through the real doors; only the writing of the pages is this script's.
 *
 *   cd control
 *   node scripts/spikes/jericho/build.mjs --out /abs/dir [--hero <ref>] [--level <id>] [--world <file>]
 *
 * `--hero`: Coral, a hero made through the character door in the database the process reads (MOJULO_DATA_DIR); absent,
 * the stand-in person.
 */
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
if (process.env.MOJULO_DATA_DIR) process.env.SQLITE_PATH ??= path.join(process.env.MOJULO_DATA_DIR, 'mojulo-lite.db');
process.env.SQLITE_PATH ??= ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';
const { readGameworld } = await import('../../../lib/graph/gameworld/world.js');
const { gameStages, stageLevelOrder } = await import('../../../lib/graph/gameworld/levels.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');

const W = JSON.parse(fs.readFileSync(opt('--world') ? path.resolve(opt('--world')) : path.join(here, 'world.json'), 'utf8')), out = path.resolve(opt('--out', 'jericho'));
const G = readGameworld(W), heroRef = opt('--hero'), only = opt('--level');
fs.mkdirSync(out, { recursive: true });
for (const st of gameStages(W)) {
  if (only && st.level !== only) continue;
  const ref = `${W.id}-level-${st.level}-0`, L = stageLevelOrder(G, st, { ref, ...(heroRef ? { heroRef } : {}) });
  const { payload } = await resolveWorldScene({ ref, title: L.args.title, manifest: L.args.manifest }, { live: true });
  const html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: true });
  const file = path.join(out, `${st.level}.html`);
  fs.writeFileSync(file, html);
  console.log(`jericho: ${file} (${(html.length / 1e6).toFixed(2)} MB) · ${payload.entities.map((e) => e.id).join(', ')}${(L.laws ?? []).length ? ` · laws ${L.laws.filter((l) => !l.holds).length} advised` : ''}`);
}
process.exit(0);
