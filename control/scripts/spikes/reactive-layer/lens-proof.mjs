// THE LENS IN CHROME, in a turn-based fight: mana-ui's screen layer (the RPG UI's `lens`) on a World page with the
// party battle channel (scene/channels/rpg-channel.js), its figures standing still while the round plays. A juice's
// `lens` step on every hit draws round the figure struck; one shot a kind, a beat into the strike, beside the bare
// fight. And the same hit where the beat's world answers the figure (a flash over the field): the lens yields.
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
const { lowerPlay } = await import(path.join(control, 'lib/graph/playscape/ui/direction.js'));

// the world: a checkered ground, blocks behind, the party's figure (the pilot) and the wolves' figure facing it
const faces = [], quad = (c, fill) => faces.push({ corners: c, fill });
for (let i = -6; i < 6; i++) for (let j = -2; j < 10; j++) quad([[i * 4, j * 4, 0], [(i + 1) * 4, j * 4, 0], [(i + 1) * 4, (j + 1) * 4, 0], [i * 4, (j + 1) * 4, 0]], (i + j) % 2 ? '#6fbf4a' : '#5aa63c');
const box = (x, y, w, h, fill) => { const [x0, x1, y0, y1] = [x - w / 2, x + w / 2, y - w / 2, y + w / 2]; quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], fill); quad([[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill); quad([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill); quad([[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill); quad([[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill); };
[['#ff4f86', -9, 18], ['#35b4ff', -4, 24], ['#ffd03a', 0, 30], ['#a066ff', 5, 22], ['#ff8a1f', 10, 16], ['#2ad1a0', -12, 30]].forEach(([c, x, y], k) => box(x, y, 2.4, 2 + (k % 3) * 1.4, c));
const ENTITIES = [
  { id: 'hero', rule: { type: 'walk' }, transform: { pos: [-2, 8, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 1.8], color: '#fff3e2' } },
  { id: 'wolf-1', transform: { pos: [3, 10, 0] }, body: { type: 'mesh', shape: 'box', size: [1.4, 0.9, 1.2], color: '#7a6a5a' } },
];

const page = (hit) => {
  const play = { rpg: { party: [{ id: 'ayla', class: 'fighter' }], encounters: [{ id: 'wolves', foes: ['wolf'], who: 'wolf-1', at: [3, 10] }], juice: { on: { hit, miss: [{ act: 'strike', at: 'actor' }], cast: [{ act: 'cast', at: 'actor' }] } } } };
  // (a miss and a cast lose their default lens here: every strike on these pages is a hit's)
  const events = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
  return emitThreeWorld({ faces, entities: ENTITIES, events, cameras: [{ name: 'view', position: [0.5, 2.5, 2.6], target: [0.5, 9.2, 0.7], fov: 42 }], viewBox: { width: 1120, height: 700 }, title: 'lens', bg: '#9fd3ff', metersPerUnit: 1, inline: true, wireframe: false, walk: false, spin: false });
};

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const b = await chromium.launch(), shots = [];
// a fight on the page, played until a hit's beat draws its strike (or the round is over); its shot a beat in
const shoot = async (name, html, { strike = true } = {}) => {
  const f = path.join(out, `${name}.html`); writeFileSync(f, html);
  const p = await b.newPage({ viewport: { width: 1120, height: 700 } }), errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto('file://' + f); await p.waitForTimeout(2500);
  await p.addStyleTag({ content: 'button,.hint,[class*=hint]{visibility:hidden!important}' });
  const started = await p.evaluate(() => !!(window.__mojRpg && window.__mojRpg.start('wolves')));
  let struck = 0, hits = 0, seen = [];
  for (let i = 0; i < 160; i++) {
    await p.waitForTimeout(60);
    const s = await p.evaluate(() => { const S = window.__mojRpg.state(); return { mode: S.mode, phase: S.phase, struck: document.querySelectorAll('.moj-rpg-lens .mana-struck').length }; });
    // (a hit's flash over the field, caught mid-fade: the yields page's proof that its hits played)
    if (s.phase === 'play' && await p.evaluate(() => Number(getComputedStyle(document.querySelector('.moj-rpg-flash')).opacity) > 0.02)) hits++;
    if (s.phase === 'command' || s.phase === 'end') await p.evaluate(() => window.__mojRpg.act('accept'));
    if (s.struck) seen.push(s.struck);
    if (strike && s.struck) { struck = s.struck; await p.waitForTimeout(60); break; }
    // (no strike to wait for: the shot a beat into the round, or into a hit's flash where the lens would have played)
    if (!strike && s.phase === 'play' && (hits >= 1 || i >= 40)) { await p.waitForTimeout(60); break; }
    if (!s.mode) break;
  }
  const lens = await p.evaluate(() => { const L = document.querySelector('.mana-lens'); return { lens: !!L, struck: document.querySelectorAll('.mana-struck').length, raised: L ? (() => { let n = L, raised = []; while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.zIndex !== 'auto' || cs.isolation === 'isolate' || cs.contain !== 'none' || cs.containerType !== 'normal') raised.push(n.className || n.id || n.tagName); n = n.parentElement; } return raised; })() : null, kinds: [...document.querySelectorAll('.mana-struck')].map((e) => e.getAttribute('data-kind')) }; });
  await p.screenshot({ path: path.join(out, `${name}.png`) });
  // (and close, round the wolves' figure: the fight's own camera stands back)
  const at = await p.evaluate(() => { const w = window.__mojCtrl.world.byId['wolf-1'], q = window.__mojCtrl.project(w.transform.pos[0], w.transform.pos[1], w.transform.pos[2] + 0.6); return [q[0], q[1]]; });
  await p.screenshot({ path: path.join(out, `${name}-near.png`), clip: { x: Math.max(0, at[0] - 120), y: Math.max(0, at[1] - 75), width: 240, height: 150 } });
  await p.close();
  shots.push({ name, started, flashes: hits, everStruck: seen.length, ...lens, errs }); console.log(name, JSON.stringify({ started, flashes: hits, everStruck: seen.length, ...lens }), errs.length ? errs[0] : '');
};
await shoot('bare', page([{ act: 'hurt' }]), { strike: false });
for (const kind of ['ring', 'lift', 'shade', 'ink']) await shoot(kind, page([{ act: 'hurt' }, { lens: kind }]));
await shoot('yields', page([{ act: 'hurt' }, { flash: '#ffffff', for: 0.4 }, { lens: 'ring' }]), { strike: false });
const sheet = path.join(out, 'sheet.html');
writeFileSync(sheet, `<!doctype html><body style="margin:0;background:#16121a;font:600 13px system-ui;color:#eee"><div style="display:grid;grid-template-columns:repeat(3,480px);gap:8px;padding:8px">${shots.map((s) => `<figure style="margin:0"><img src="${s.name}.png" style="width:480px;display:block"><img src="${s.name}-near.png" style="width:480px;display:block;image-rendering:pixelated"><figcaption style="padding:4px 2px">${s.name === 'bare' ? 'the fight, no lens step' : s.name === 'yields' ? 'a hit with a flash over the field: the lens yields' : `lens · ${s.name}`} <span style="opacity:.6;font-weight:400">(${s.struck} drawn)</span></figcaption></figure>`).join('')}</div></body>`);
const p = await b.newPage({ viewport: { width: 1470, height: 900 } }); await p.goto('file://' + sheet); await p.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
await b.close();
console.log(`lens-proof → ${path.join(out, 'sheet.png')}`);
