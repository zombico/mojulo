/**
 * Visual review of the food shelf (lib/graph/food): a work card's things as the food shelf reads them off the card, each
 * drawn on the World page from a three-quarter view above (the way a kitchen's overhead camera sees it), laid out raw,
 * then made, then dishes, captioned with what each is read as, and the card's food laws. No database writes. The eyes
 * gate is the operator's.
 *
 * From control/:
 *   node scripts/render-food.mjs <output-directory> [card|all] [--card '<a Shovels & Buckets card as json>']
 * Cards are the work starters (worksim/scenarios.js) by name. Writes <card>/<item>.png, <card>/sheet.html and
 * <card>-sheet.png.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { foodOf, foodFaces } = await import('../lib/graph/food/derive.js');
const { foodLaws } = await import('../lib/graph/food/laws.js');
const { SCENARIOS } = await import('../lib/graph/worksim/scenarios.js');
const { readCard, isRaw } = await import('../lib/graph/worksim/card.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');
const { loadPuppeteer } = await import('../lib/graph/scene/puppeteer-lazy.js');
const { resolveChromium, launchChromium } = await import('../lib/graph/scene/chromium.js');

const args = process.argv.slice(2), out = path.resolve(args[0] ?? 'food-review');
const own = args.indexOf('--card') >= 0 ? JSON.parse(args[args.indexOf('--card') + 1]) : null;
const asked = own ? [own.id ?? 'card'] : !args[1] || args[1] === 'all' ? Object.keys(SCENARIOS) : args[1].split(',');
const W = 360, H = 300;
const words = (s) => String(s).replace(/-/g, ' ');

for (const id of asked) {
  const card = own ?? SCENARIOS[id];
  if (!card) throw new Error(`render-food: a card is a starter (${Object.keys(SCENARIOS).join(', ')}) or --card`);
  const C = readCard(card), F = foodOf(card), dir = path.join(out, id);
  mkdirSync(dir, { recursive: true });
  // raw first, then what a station makes, then the dishes
  const rank = (i) => (isRaw(C, i) ? 0 : F[i].kind === 'dish' ? 2 : 1);
  const items = Object.keys(F).sort((a, b) => rank(a) - rank(b));
  const tiles = [];
  for (const item of items) {
    const L = F[item], faces = foodFaces(L, { size: 0.95, tall: true });
    // a floor under it, the three-quarter view from above the screen's bottom
    const floor = { corners: [[-0.9, -0.9, -0.002], [0.9, -0.9, -0.002], [0.9, 0.9, -0.002], [-0.9, 0.9, -0.002]], fill: '#e9e4da', doubleSided: true };
    const html = emitThreeWorld({ faces: [floor, ...faces], inline: true, hud: false, chrome: false, title: item, bg: '#e9e4da', metersPerUnit: 1,
      cameras: [{ name: 'quarter', worldFraming: { cameraPosition: [1.05, -1.8, 1.6], lookAt: [0, 0, 0.3], horizontalFov: 34, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H } });
    const png = await renderWorldToPng(html, { width: W, height: H, deviceScaleFactor: 1, settleMs: 900 });
    writeFileSync(path.join(dir, `${item}.png`), png);
    const read = L.kind === 'dish' ? `${L.dish} · ${L.parts.map((p) => words(p.item)).join(' + ')}` : L.kind === 'block' ? 'no row: a block in its name\'s colour' : `${L.ingredient} · ${L.state}${L.vessel ? ` · in a ${L.vessel}` : ''}`;
    tiles.push({ item, png: png.toString('base64'), read, rank: rank(item) });
  }
  const laws = foodLaws(card);
  const sheet = `<!doctype html><meta charset="utf-8"><title>${id} food</title><style>body{margin:0;padding:18px;background:#f4f0e8;font:13px system-ui,sans-serif;color:#2b2a28}h1{font-size:18px;margin:0 0 4px}.row{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0 4px}.k{font:600 11px system-ui;letter-spacing:2px;text-transform:uppercase;opacity:.6;margin-top:10px}figure{margin:0;width:${W / 2}px}img{width:${W / 2}px;height:${H / 2}px;border-radius:8px;display:block}figcaption b{display:block;font-size:13px;margin-top:4px}figcaption span{font-size:11px;opacity:.7}ul{margin:10px 0 0;padding-left:18px;font-size:12px}</style>
<h1>${card.name ?? id}: its food, read off the card</h1>
${['raw', 'made', 'dishes'].map((k, r) => tiles.some((t) => t.rank === r) ? `<div class="k">${k}</div><div class="row">${tiles.filter((t) => t.rank === r).map((t) => `<figure><img src="data:image/png;base64,${t.png}"><figcaption><b>${words(t.item)}</b><span>${t.read}</span></figcaption></figure>`).join('')}</div>` : '').join('')}
<ul>${laws.map((l) => `<li>${l.holds ? '✓' : '✗'} <b>${l.law}</b>: ${l.says}</li>`).join('')}</ul>`;
  writeFileSync(path.join(dir, 'sheet.html'), sheet);
  // the sheet itself as one picture
  const puppeteer = await loadPuppeteer(), browser = await launchChromium({ executablePath: await resolveChromium(), headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 4 * (W / 2 + 12) + 36, height: 600, deviceScaleFactor: 2 });
  await page.setContent(sheet, { waitUntil: 'load' });
  writeFileSync(path.join(out, `${id}-sheet.png`), await page.screenshot({ fullPage: true }));
  await browser.close();
  void puppeteer;
  console.log(`${id}: ${items.length} things → ${path.join(out, `${id}-sheet.png`)}; ${laws.map((l) => `${l.holds ? '✓' : '✗'} ${l.law}`).join(' ')}`);
}
void readFileSync;
