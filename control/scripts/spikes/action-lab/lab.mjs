// action-lab: writes the playable page, action-lab.html, one self-contained file: lib's feel page (lib/graph/gameworld/
// feel/page.js: the kernel inlined as text, so the page steps the same code the gate runs) with the takes baked for both
// casts and Mojulo Fighter's versus loop.
//   node scripts/spikes/action-lab/lab.mjs /abs/out/dir [--cached]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const T = await import('./takes.mjs');

const out = process.argv[2];
if (!out) { console.error('usage: node scripts/spikes/action-lab/lab.mjs /abs/out/dir'); process.exit(2); }
mkdirSync(out, { recursive: true });
// the bake takes a while (two casts); `--cached` reuses the last one written beside the page while the page is iterated
const cache = join(out, 'action-lab.data.json');
const DATA = process.argv.includes('--cached') && existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : { male: T.bake('male'), female: T.bake('female') };
writeFileSync(cache, JSON.stringify(DATA));

// Mojulo Fighter plays mojulo's versus loop itself: its pure modules and its runtime inlined (as versus-page.js inlines
// them), in a closure of their own (their names, BTN among them, stay out of the kernel's), the roster solved here
const VP = await import('../../../lib/graph/versus/versus-page.js');
const { SUPERS } = await import('../../../lib/graph/versus/versus-library.js');
const vsLib = [...VP.VERSUS_PAGE_MODULES, 'versus-runtime.client.js'].map((f) => `// ── ${f} ──\n${VP.versusSource(f)}`).join('\n');
const VS_DATA = { ...VP.versusGameData({}), supers: Object.entries(SUPERS).map(([id, r]) => ({ id, says: r.says, lock: r.lock?.kind ?? null })) };

// the page is lib's (lib/graph/gameworld/feel/page.js), the same a made game's feel page is drawn from
const { feelPageHtml } = await import('../../../lib/graph/gameworld/feel/page.js');
const html = feelPageHtml({ data: DATA, versus: { lib: vsLib, data: VS_DATA } });
writeFileSync(join(out, 'action-lab.html'), html);
console.log(`wrote ${join(out, 'action-lab.html')} (${(html.length / 1024).toFixed(0)} KB)`);
