// THE ISLAND'S GATE (the machine gate of island.mjs's page): the page opened headless, each half sampled by role off the
// screen (lit and turned away, at the cube's hour, from the island camera) and the light's swatches read, then the color
// theorist's seen laws (color-theorist/seen.js) run on each era against the palette the page was built from. Advice and
// a stamp, never a refusal; the eyes gate is the operator's.
//
//   node scripts/spikes/form/island-gate.mjs <island.html> [--camera island]
import path from 'node:path';
import { createRequire } from 'node:module';
import { seenLaws } from '../../../lib/graph/color-theorist/seen.js';

const page = path.resolve(process.argv[2] ?? 'island.html'), at = process.argv.indexOf('--camera'), camera = at > 0 ? process.argv[at + 1] : 'island';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`file://${page}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 180_000 });
  const m = await p.evaluate((c) => window.measure({ camera: c }), camera), sw = await p.evaluate(() => window.swatches()), palette = await p.evaluate(() => window.palette);
  const swatches = Object.fromEntries(sw.map((w) => [w.role, { lit: w.lit, shade: w.shade }]));
  const report = { camera, palette, gen6: { seen: m.gen6.roles, laws: seenLaws({ roles: m.gen6.roles }, palette) }, gen7: { seen: m.gen7.roles, laws: seenLaws({ roles: m.gen7.roles, swatches }, palette) } };
  for (const era of ['gen6', 'gen7']) {
    console.log(`${era}: ${Object.entries(report[era].seen).map(([r, v]) => `${r} ${v.lit ?? '-'}/${v.shade ?? '-'}`).join('  ')}`);
    for (const l of report[era].laws) console.log(`  ${l.ok ? 'ok  ' : 'ADVISE'} ${l.law}: ${l.value}`);
  }
  console.log(`palette: ${Object.entries(palette.targets).map(([r, t]) => `${r} ${t.lit}/${t.shade}`).join('  ')}; sky's light ${palette.sky}`);
} finally { await browser.close(); }
