// THE REACTIVE TOP LAYER, the spike's probe: a small world drawn by the World page's own emitter (scene-three.js, its
// three.js canvas), and over it each effect of layer-effects.js laid by CSS alone, after the page has drawn: one
// screenshot each, beside the bare picture, and a contact sheet. What Chrome supports is asked of Chrome itself.
//
//   node scripts/spikes/reactive-layer/probe.mjs [--out <dir>] [--only hurt,xray] [--isolate]
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', path.join(tmpdir(), 'reactive-layer')));
mkdirSync(out, { recursive: true });
const { LAYER_EFFECTS, effectHtml, AT } = await import('./layer-effects.js');
const { emitThreeWorld } = await import(path.join(control, 'lib/graph/scene/scene-three.js'));
const only = arg('only', null)?.split(','), ISOLATE = process.argv.includes('--isolate');
// (--isolate: the layer its own stacking context, contained and raised, as the confetti's is: its overlays then blend
// with nothing beneath them, the finding this flag shows)

// the world: a checkered ground, a ring of coloured blocks, a tall white one standing where the anchor falls
const faces = [];
const quad = (c, fill) => faces.push({ corners: c, fill });
for (let i = -6; i < 6; i++) for (let j = -2; j < 10; j++) quad([[i * 4, j * 4, 0], [(i + 1) * 4, j * 4, 0], [(i + 1) * 4, (j + 1) * 4, 0], [i * 4, (j + 1) * 4, 0]], (i + j) % 2 ? '#6fbf4a' : '#5aa63c');
const box = (x, y, w, h, fill) => {
  const [x0, x1, y0, y1] = [x - w / 2, x + w / 2, y - w / 2, y + w / 2];
  quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], fill);
  quad([[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill); quad([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill);
  quad([[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill); quad([[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill);
};
[['#ff4f86', -9, 18], ['#35b4ff', -4, 24], ['#ffd03a', 0, 30], ['#a066ff', 5, 22], ['#ff8a1f', 10, 16], ['#2ad1a0', -12, 30]].forEach(([c, x, y], k) => box(x, y, 2.4, 2 + (k % 3) * 1.4, c));
box(3.2, 12, 1.6, 4.2, '#fff3e2');
const page = emitThreeWorld({ faces, cameras: [{ name: 'view', position: [0, -6, 5.5], target: [1, 16, 1.5], fov: 55 }], viewBox: { width: 1120, height: 700 }, title: 'reactive layer', bg: '#9fd3ff', metersPerUnit: 1, inline: true, wireframe: false, walk: false, spin: false });

// the probe: lay one effect over the drawn page (its canvas styled, its overlays and filters in a layer over the canvas)
const lay = (e) => { const L = effectHtml(e, AT); return `
<script>(function () { const go = () => { const c = document.querySelector('canvas'); if (!c) return setTimeout(go, 50);
  const host = c.parentElement; host.style.position = host.style.position || 'relative';
  if (${JSON.stringify(L.canvas)}) c.style.cssText += ';' + ${JSON.stringify(L.canvas)};
  const layer = document.createElement('div'); layer.id = 'rl-layer'; layer.style.cssText = ${JSON.stringify(ISOLATE ? 'position:absolute;inset:0;pointer-events:none;overflow:hidden;contain:strict;z-index:20' : 'position:absolute;inset:0;pointer-events:none;overflow:hidden')};
  layer.innerHTML = ${JSON.stringify(L.svg + L.html)}; host.appendChild(layer); window.__rl = true; }; setTimeout(go, 1200); })();</script>`; };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const b = await chromium.launch(), shots = [];
const shoot = async (name, html) => {
  const f = path.join(out, `${name}.html`); writeFileSync(f, html);
  const p = await b.newPage({ viewport: { width: 1120, height: 700 } }), errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto('file://' + f); await p.waitForTimeout(2600);
  // (the page's own UI chrome hidden: the orbit buttons, the hint)
  await p.addStyleTag({ content: 'button,.hint,[class*=hint]{visibility:hidden!important}' });
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, `${name}.png`) });
  // (its cost: frames the page draws in two seconds with the effect up and the world turning, against the bare page's;
  // in a software renderer only the ratio means anything)
  const fps = await p.evaluate(() => new Promise((done) => { let n = 0; const c = document.querySelector('canvas'); const t0 = performance.now(); const tick = () => { n++; if (c) c.style.setProperty('--rl-t', String(n)); if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else done(Math.round((n * 1000) / (performance.now() - t0))); }; requestAnimationFrame(tick); }));
  const support = name === 'bare' ? await p.evaluate(() => ({
    'mix-blend-mode': CSS.supports('mix-blend-mode', 'difference'), 'backdrop-filter': CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'),
    'backdrop-filter url()': CSS.supports('backdrop-filter', 'url(#x)'), 'filter url()': CSS.supports('filter', 'url(#x)'), 'container units': CSS.supports('width', '10cqw'),
    'conic-gradient': CSS.supports('background', 'conic-gradient(red,blue)'), 'mask-image': CSS.supports('mask-image', 'radial-gradient(red,blue)') || CSS.supports('-webkit-mask-image', 'radial-gradient(red,blue)'),
  })) : null;
  await p.close();
  return { name, errs, support, fps };
};
const bare = await shoot('bare', page);
console.log('Chrome supports', JSON.stringify(bare.support));
for (const e of LAYER_EFFECTS.filter((x) => !only || only.includes(x.id))) {
  const at = page.lastIndexOf('</body>'), r = await shoot(e.id, page.slice(0, at) + lay(e) + page.slice(at));
  shots.push({ ...e, errs: r.errs, fps: r.fps }); console.log(e.id, r.errs.length ? `errors: ${r.errs[0]}` : 'ok', `${r.fps} fps (bare ${bare.fps})`);
}
const sheet = path.join(out, 'sheet.html');
writeFileSync(sheet, `<!doctype html><body style="margin:0;background:#16121a;font:600 13px system-ui;color:#eee"><div style="display:grid;grid-template-columns:repeat(4,370px);gap:8px;padding:8px">${[{ id: 'bare', family: '—', means: 'the picture as the game draws it', ways: [] }, ...shots].map((s) => `<figure style="margin:0"><img src="${s.id}.png" style="width:370px;display:block"><figcaption style="padding:4px 2px 2px"><b>${s.id}</b> <span style="opacity:.6;font-weight:400">${s.family} · ${s.ways.join(' + ')}</span><div style="opacity:.75;font-weight:400;font-size:12px">${s.means}</div>${s.fails ? `<div style="color:#ff9a9a;font-weight:400;font-size:12px">fails: ${s.fails}</div>` : ''}</figcaption></figure>`).join('')}</div></body>`);
const p = await b.newPage({ viewport: { width: 1520, height: 400 } }); await p.goto('file://' + sheet); await p.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
await b.close();
console.log(`reactive-layer: ${shots.length} effects → ${path.join(out, 'sheet.png')}`);
