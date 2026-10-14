// dresser-manual-flow.png and dresser-manual-viewer.png: mint the chest of drawers, gather it into a stash,
// cook an instruction_manual, and lay four of its pages beside the three calls.
//
//   node docs/images/src/dresser-manual/run.mjs [workDir]
//
// Same environment as the other runners. Pages 1 and 9 are captioned by hand in flow.html ("slides onto the
// sides", "a drawer box"); check them if the manual's step order changes. The run refuses if any page has a NaN.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, runJson, sleep, snapHtml } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-dresser-manual'));
mkdirSync(work, { recursive: true });
const env = { ...process.env };
env.MOJULO_DATA_DIR ||= path.join(work, 'data');
env.MOJULO_OUTCOMES_DIR ||= path.join(env.MOJULO_DATA_DIR, 'outcomes');
mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });
const call = (tool, args) => {
  const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
  if (res.ok === false) throw new Error(`${tool}: ${res.error}`);
  return res;
};

const recipe = JSON.parse(readFileSync(path.join(here, '../dresser-sheet/recipe.json'), 'utf8'));
call('mint_solid', { kind: 'workbench', title: 'Plywood chest of drawers', ref: 'dresser_demo', spec: recipe });
const { stash_ref } = call('mint_stash', { title: 'Chest of drawers manual' });
call('gather', { stash_ref, type: 'sketch', metadata: { sketch_ref: 'dresser_demo', label: 'Plywood chest of drawers' } });
const cooked = call('cook', { slices: [{ stash_ref }], aim: 'Plywood chest of drawers', report_md: 'Assembly for the plywood chest of drawers.', publication: { kind: 'instruction_manual' } });
const dir = cooked.outcome_dir;
const steps = readdirSync(dir).filter((f) => /-step-\d+\.svg$/.test(f)).sort();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
  if (readFileSync(path.join(dir, f), 'utf8').includes('NaN')) throw new Error(`${f} has a NaN coordinate: fix the manual before drawing it`);
}

// pages as A4 PNGs (707 × 1000 @2x)
const browser = await launch(false);
const pagePng = async (svgFile) => {
  const out = path.join(work, svgFile.replace(/\.svg$/, '.png'));
  const page = await browser.newPage();
  await page.setViewport({ width: 707, height: 1000, deviceScaleFactor: 2 });
  const svg = readFileSync(path.join(dir, svgFile), 'utf8').replace(/<svg /, '<svg style="width:707px;height:1000px" ');
  await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  await sleep(200);
  writeFileSync(out, await page.screenshot({ type: 'png' }));
  await page.close();
  return out;
};
const cover = await pagePng(readdirSync(dir).find((f) => f.endsWith('-cover.svg')));
const [pa, pb, plast] = [await pagePng(steps[0]), await pagePng(steps[8]), await pagePng(steps.at(-1))];

// the last step in the cook's own viewer
const viewer = await browser.newPage();
await viewer.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1 });
await viewer.goto(pathToFileURL(path.join(dir, 'index.html')).href);
await sleep(800);
const total = Number((await viewer.evaluate(() => document.querySelector('.viewer-counter')?.textContent || '')).split('/').pop()) || steps.length + 3;
for (let i = 1; i < total; i++) { await viewer.keyboard.press('ArrowRight'); await sleep(150); }
writeFileSync(path.join(work, 'dresser-manual-viewer.png'), await viewer.screenshot({ type: 'png' }));
await browser.close();

const fill = { STASH: stash_ref, COOK: cooked.cook_ref, FILES: cooked.file_count, STEPS: steps.length,
  P_COVER: pathToFileURL(cover).href, P_A: pathToFileURL(pa).href, P_B: pathToFileURL(pb).href, P_LAST: pathToFileURL(plast).href };
const html = readFileSync(path.join(here, 'flow.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in fill)) throw new Error(`no value for {{${k}}}`);
  return fill[k];
});
writeFileSync(path.join(work, 'flow.html'), html);
await snapHtml(path.join(work, 'flow.html'), path.join(work, 'dresser-manual-flow.png'), { width: 1800, height: 720 });
console.log(path.join(work, 'dresser-manual-flow.png'));
