// The juice board as a contact sheet (the eyes gate's material, not its verdict): each register × game-type cell the
// proving ground wrote (--board, a row a look × game type), stepped through its live channels in headless Chrome from the cue at the start, and
// sampled into one row of frames, so the compositions can be compared side by side without opening every page.
//
//   node scripts/spikes/effects/juice-sheet.mjs <board-dir> <effect> [seconds=2.4] [columns=8] [looks=all]   (from control/)
//
// Writes <board-dir>/sheet-<effect>.png. Spike only.
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url).href);
const { default: sharp } = await import('sharp');
const { renderWorldTraversal } = await import('../../../lib/motion/world-frames.js');
const { JUICE_LOOKS, JUICE_LOOK_IDS, JUICE_FLAVOR_IDS } = await import('../../../lib/graph/scene/juice-style.js');

const [dir, effect, secs = '2.4', colsArg = '8', looksArg = ''] = process.argv.slice(2);
if (!dir || !effect) throw new Error('juice-sheet: <board-dir> <effect> [seconds] [columns]');
const FPS = 30, W = 400, H = 228, cols = Number(colsArg), n = Math.round(Number(secs) * FPS), LABEL = 150;
const cells = (looksArg ? looksArg.split(',') : JUICE_LOOK_IDS).flatMap((look) => JUICE_FLAVOR_IDS.map((flavor) => ({ register: JUICE_LOOKS[look].register, look, flavor })));
const rows = [];
for (const c of cells) {
  const html = readFileSync(`${dir}/${effect}-${c.look}-${c.flavor}.html`, 'utf8');
  const { pngs } = await renderWorldTraversal(html, Array.from({ length: n }, () => null), { fps: FPS, width: W, height: H, settleMs: 800 });
  const pick = Array.from({ length: cols }, (_, i) => pngs[Math.min(pngs.length - 1, Math.round(((i + 1) * (pngs.length - 1)) / cols))]);
  rows.push({ c, pick });
  console.log(effect, c.look, c.flavor, pngs.length, 'frames');
}
const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL}" height="${H}"><rect width="100%" height="100%" fill="#0a0c14"/><text x="10" y="${H / 2 - 6}" fill="#e8ecf6" font-family="sans-serif" font-size="17" font-weight="700">${t[0]}</text><text x="10" y="${H / 2 + 18}" fill="#9aa6c0" font-family="sans-serif" font-size="15">${t[1]}</text></svg>`);
const head = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL + cols * W}" height="40"><rect width="100%" height="100%" fill="#0a0c14"/><text x="10" y="27" fill="#e8ecf6" font-family="sans-serif" font-size="20">${effect}: look × game type, ${secs} s from the cue in ${cols} frames</text></svg>`);
const comp = [{ input: head, left: 0, top: 0 }];
rows.forEach(({ c, pick }, r) => {
  const top = 40 + r * H;
  comp.push({ input: label([`${c.register} · ${c.look}`, c.flavor]), left: 0, top });
  pick.forEach((png, i) => comp.push({ input: png, left: LABEL + i * W, top }));
});
const out = `${dir}/sheet-${effect}${looksArg ? `-${looksArg.replace(/,/g, '-')}` : ''}.png`;
writeFileSync(out, await sharp({ create: { width: LABEL + cols * W, height: 40 + rows.length * H, channels: 3, background: '#0a0c14' } }).composite(comp).png().toBuffer());
console.log(out);
