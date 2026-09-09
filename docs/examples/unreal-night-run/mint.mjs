// Mint the Night Run recipes into the local mojulo database, in dependency order (music, then
// the three levels, then the game). Run from control/ with the repo-dev env:
//   MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes" node ../docs/examples/unreal-night-run/mint.mjs
// Each file is a stored sketch as { ref, title, manifest }; beats kinds go through create_beats
// (kind + params), everything else through create_sketch (manifest). Re-running updates in place.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'recipes');
const order = ['night-run-music-menu', 'night-run-music-city', 'night-run-music-cave', 'night-run-music-lounge', 'night-run-city', 'night-run-cave', 'night-run-lounge', 'night-run-demo'];
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => order.indexOf(a.replace('.json', '')) - order.indexOf(b.replace('.json', '')));
const call = (tool, args) => {
  try {
    return JSON.parse(execFileSync('node', ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) {
    const text = String(e.stdout || e.message);
    if (/already exists/.test(text)) return { ok: true, skipped: 'exists' };
    throw new Error(`${tool} ${args.ref}: ${text.trim().slice(0, 200)}`);
  }
};
for (const f of files) {
  const { ref, title, manifest } = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  let out;
  if (String(manifest.kind).startsWith('beats-')) {
    const { kind, ...params } = manifest;
    // beats have no in-place update tool; an existing ref is left as it is (the recipes are deterministic)
    out = call('create_beats', { ref, title, kind, params });
  } else {
    try { out = call('update_sketch', { ref, title, manifest }); }
    catch { out = call('create_sketch', { ref, title, manifest }); }
  }
  console.log(out.skipped ? 'kept' : out.ok ? 'ok  ' : 'FAIL', ref, out.ok ? '' : JSON.stringify(out).slice(0, 200));
}
