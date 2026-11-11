// The exhibit audit's page half: every stop framed. It opens a toured World page (an exhibit's world.html, or a room of
// an exported gallery) in headless Chrome, seats each stop and reads where its lit parts land (lib/graph/exhibit/
// page-audit.js through the page's window.__mojTour.view()), and reports page errors. Machine gate: it advises; the
// eyes gate is the operator's.
//
//   node scripts/exhibit-audit.mjs <page.html> [--width 1280 --height 800] [--json]
//
// For a gallery folder, run it on each rooms/<ref>.html.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!file) { console.error('usage: node scripts/exhibit-audit.mjs <page.html> [--width 1280 --height 800] [--json]'); process.exit(2); }
const page0 = path.resolve(process.env.INIT_CWD || process.cwd(), file);
const width = Number(flag('--width')) || 1280, height = Number(flag('--height')) || 800;

const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');
const { auditStops } = await import('@/lib/graph/exhibit/page-audit');

const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_WEBGL_ARGS], protocolTimeout: 600000 });
let out;
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto('file://' + page0, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => window.__mojTour, { timeout: 120000 }).catch(() => {});
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  out = { page: page0, viewport: { width, height }, ...(await auditStops((fn, arg) => page.evaluate(fn, arg), { settle })), errors };
  if (errors.length) out.findings.push({ level: 'warn', code: 'page-error', says: `${errors.length} page error(s): ${errors[0]}` });
  out.warnings = out.findings.filter((f) => f.level === 'warn').length;
} finally {
  await browser.close();
}
if (args.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`exhibit audit (machine gate) ${out.page} at ${width}x${height}`);
  for (const s of out.stops) console.log(`  ${String(s.at + 1).padStart(2)} ${s.id}: ${s.framed === null ? 'lights nothing (not measured)' : `${s.framed ? 'framed' : 'NOT framed'} (on screen ${Math.round(s.onScreen * 100)}%, fills ${Math.round(s.share * 1000) / 10}%)`}`);
  for (const f of out.findings) console.log(`  ${f.level}: ${f.at ? `${f.at} ` : ''}${f.says}`);
  console.log(`  ${out.warnings || 0} warning(s). The eyes gate is the operator's: nobody has looked yet.`);
}
process.exit(0);
