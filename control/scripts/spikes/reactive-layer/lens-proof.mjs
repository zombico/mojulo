// THE LENS IN CHROME: mana-ui's screen layer (a spec's `lens`) on a World page, through the real HUD host
// (scene/channels/mana-hud.js): a foe standing in the world, struck (its `hits` raised as the runtime raises them on a
// hit), its strike drawn round it, one shot a kind a beat into the strike, beside the bare picture. And the same hit
// during a world moment (a tempo look up): the lens stands down.
//
//   node scripts/spikes/reactive-layer/lens-proof.mjs [--out <dir>]
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', path.join(tmpdir(), 'lens-proof')));
mkdirSync(out, { recursive: true });
const { emitThreeWorld } = await import(path.join(control, 'lib/graph/scene/scene-three.js'));
const { hudToMana } = await import(path.join(control, 'lib/graph/game/hud-mana.js'));

// the world: a checkered ground, blocks, and the foe: a tall pale block at (3.2, 12)
const faces = [], quad = (c, fill) => faces.push({ corners: c, fill });
for (let i = -6; i < 6; i++) for (let j = -2; j < 10; j++) quad([[i * 4, j * 4, 0], [(i + 1) * 4, j * 4, 0], [(i + 1) * 4, (j + 1) * 4, 0], [i * 4, (j + 1) * 4, 0]], (i + j) % 2 ? '#6fbf4a' : '#5aa63c');
const box = (x, y, w, h, fill) => { const [x0, x1, y0, y1] = [x - w / 2, x + w / 2, y - w / 2, y + w / 2]; quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], fill); quad([[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill); quad([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill); quad([[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill); quad([[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill); };
[['#ff4f86', -9, 18], ['#35b4ff', -4, 24], ['#ffd03a', 0, 30], ['#a066ff', 5, 22], ['#ff8a1f', 10, 16], ['#2ad1a0', -12, 30]].forEach(([c, x, y], k) => box(x, y, 2.4, 2 + (k % 3) * 1.4, c));
box(3.2, 12, 1.6, 4.2, '#fff3e2');
const FOE = { pos: [3.2, 12, 0], radius: 2.1 };

const page = (kind) => {
  const spec = hudToMana([], { hero: true }).spec;
  spec.lens.children[0].props.kind = kind;
  const html = emitThreeWorld({ faces, cameras: [{ name: 'view', position: [0, -6, 5.5], target: [1, 16, 1.5], fov: 55 }], viewBox: { width: 1120, height: 700 }, title: 'lens', bg: '#9fd3ff', metersPerUnit: 1, inline: true, wireframe: false, walk: false, spin: false, manaHud: { spec, theme: 'console', feed: {} } });
  // the stand-in world, as the controllable runtime keeps it (no runtime on this page): the pilot, the foe
  const world = `<script>window.__mojCtrl = { world: { pilotId: 'me', byId: { me: { id: 'me', team: 'us', transform: { pos: [0, -4, 0] }, hits: 0 }, foe: { id: 'foe', team: 'foes', transform: { pos: ${JSON.stringify(FOE.pos)} }, body: { radius: ${FOE.radius}, hp: 100 }, hpMax: 100, hits: 0 } }, entities: [] } }; window.__mojCtrl.world.entities = Object.values(window.__mojCtrl.world.byId);</script>`;
  return html.replace('<body>', `<body>${world}`);
};

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const b = await chromium.launch(), shots = [];
const shoot = async (name, html, { strike = true, moment = false } = {}) => {
  const f = path.join(out, `${name}.html`); writeFileSync(f, html);
  const p = await b.newPage({ viewport: { width: 1120, height: 700 } }), errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto('file://' + f); await p.waitForTimeout(2500);
  await p.addStyleTag({ content: 'button,.hint,[class*=hint]{visibility:hidden!important}' });
  if (moment) await p.evaluate(() => { window.__mojCtrl.world.tempo = { playing: { on: 'strike' } }; });
  if (strike) await p.evaluate(() => { const f = window.__mojCtrl.world.byId.foe; f.hits = 1; f.body.hp = 60; });
  await p.waitForTimeout(strike ? 130 : 50);
  const lens = await p.evaluate(() => { const L = document.querySelector('.mana-lens'); return { lens: !!L, struck: document.querySelectorAll('.mana-struck').length, under: L ? (() => { let n = L, raised = []; while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.zIndex !== 'auto' || cs.isolation === 'isolate' || cs.contain !== 'none' || cs.containerType !== 'normal') raised.push(n.className || n.id || n.tagName); n = n.parentElement; } return raised; })() : null }; });
  await p.screenshot({ path: path.join(out, `${name}.png`) });
  await p.close();
  shots.push({ name, ...lens, errs }); console.log(name, JSON.stringify(lens), errs.length ? errs[0] : '');
};
await shoot('bare', page('ring'), { strike: false });
for (const kind of ['ring', 'lift', 'shade', 'ink']) await shoot(kind, page(kind));
await shoot('moment', page('ring'), { moment: true });
const sheet = path.join(out, 'sheet.html');
writeFileSync(sheet, `<!doctype html><body style="margin:0;background:#16121a;font:600 13px system-ui;color:#eee"><div style="display:grid;grid-template-columns:repeat(3,480px);gap:8px;padding:8px">${shots.map((s) => `<figure style="margin:0"><img src="${s.name}.png" style="width:480px;display:block"><figcaption style="padding:4px 2px">${s.name === 'bare' ? 'the foe before it is hit' : s.name === 'moment' ? 'the same hit while a world moment plays: the lens stands down' : `strike · ${s.name}`} <span style="opacity:.6;font-weight:400">(${s.struck} drawn)</span></figcaption></figure>`).join('')}</div></body>`);
const p = await b.newPage({ viewport: { width: 1470, height: 400 } }); await p.goto('file://' + sheet); await p.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
await b.close();
console.log(`lens-proof → ${path.join(out, 'sheet.png')}`);
