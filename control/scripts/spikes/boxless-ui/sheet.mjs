// BOXLESS UI, the spike's sheet: the race's HUD (gameworld/race-hud.js, drawn by the page's own HUD channel,
// scene/channels/mana-hud.js) over a still of a race, boxed as it ships and boxless in each letter dress
// (letter-dress.js), every one at the same moment of the same race: second of four, a gumball held, the final lap
// called. One picture each, and a contact sheet of them all.
//
//   node scripts/spikes/boxless-ui/sheet.mjs --still <a race's still .png> [--out <dir>] [--dress candy,chrome] [--theme kart-candy]
//   (--out: the system's temp folder's boxless-ui unsaid)
//
// The still is any frame of a kart race (a track page's shot); the HUD is laid over it at 1120 × 780.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const still = arg('still'), out = path.resolve(arg('out', path.join(tmpdir(), 'boxless-ui'))), theme = arg('theme', 'kart-candy');
if (!still) { console.error('sheet: --still <a race\'s still .png> is needed'); process.exit(2); }
const { DRESSES, dressCss, dressSvg } = await import('./letter-dress.js');
const { manaHudScript } = await import(path.join(control, 'lib/graph/scene/channels/mana-hud.js'));
const { raceHud } = await import(path.join(control, 'lib/graph/gameworld/race-hud.js'));
const { composeTrack } = await import(path.join(control, 'lib/graph/roads/trackscape-compose.js'));
const { planTrack } = await import(path.join(control, 'lib/graph/roads/track.js'));
const dresses = (arg('dress', Object.keys(DRESSES).join(','))).split(',').filter((d) => DRESSES[d]);
mkdirSync(out, { recursive: true });

// the race: a short kart track's line for the map, four racers, three laps, items
const plan = planTrack(composeTrack('a short kart track', { seed: 1 }));
const hud = raceHud({ mech: 0, laps: 3, racers: 4, items: true, outline: plan.stations.map((p) => [p.x, p.y]), language: 'candy' }, { theme });
const F = hud.feed, at = (u) => { const q = plan.stations[Math.floor(u * plan.stations.length) % plan.stations.length]; return [q.x, q.y, 0]; };
const W = 1120, H = 780, img = 'data:image/png;base64,' + readFileSync(path.resolve(still)).toString('base64');
// a stand-in world and bus, as the controllable and the game channels keep them; the items the page's
const fake = `window.__mojCtrl={world:{pilotId:'me',byId:{me:{speed:17.5,transform:{pos:${JSON.stringify(at(0.1))}}},'rival-1':{team:'rivals',transform:{pos:${JSON.stringify(at(0.16))}}},'rival-2':{team:'rivals',transform:{pos:${JSON.stringify(at(0.04))}}},'rival-3':{team:'rivals',transform:{pos:${JSON.stringify(at(0.55))}}}}}};
window.__mojBus={state:{vars:{__lap_0:0,__race_0:0,__place_0:1},log:[]}};
window.__kiHeld=null; window.__mojItems={held:()=>window.__kiHeld,says:(k)=>({'sugar-rush':'sugar rush',toffee:'toffee',gumball:'gumball'})[k]||k,icon:(k)=>({'sugar-rush':'sweet',toffee:'blob',gumball:'ball'})[k]};`;
const page = (dress) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}#wrap{position:relative;width:${W}px;height:${H}px;background:url(${img}) center/cover}</style>${dress ? `<style>${dressCss(dress, 'html body .mana-hud')}</style>` : ''}</head><body>${dress ? dressSvg(dress) : ''}<div id="wrap"></div><script>${fake}${manaHudScript(hud)}</script></body></html>`;

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const b = await chromium.launch(), shots = [];
for (const d of [null, ...dresses]) {
  const name = d ?? 'boxed', file = path.join(out, `${name}.html`);
  writeFileSync(file, page(d));
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto('file://' + file);
  await p.waitForTimeout(5300);   // the lights, out
  await p.evaluate(() => { window.__kiHeld = 'gumball'; const B = window.__mojBus.state.vars; B.__lap_0 = 1; B.__race_0 = 523; B.__place_0 = 2; });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const B = window.__mojBus.state.vars; B.__race_0 = 905; B.__lap_0 = 2; });
  await p.waitForTimeout(700);
  console.log('shot', name); await p.screenshot({ path: path.join(out, `${name}.png`), timeout: 120000 });
  shots.push({ name, says: d ? DRESSES[d].says : 'as it ships: each part on its plate' });
  await p.close();
}
// the contact sheet: two across, each with its name
const sheet = path.join(out, 'sheet.html');
writeFileSync(sheet, `<!doctype html><html><body style="margin:0;background:#16121a;font:600 15px system-ui;color:#eee"><div style="display:grid;grid-template-columns:repeat(2,560px);gap:10px;padding:10px">${shots.map((s) => `<figure style="margin:0"><img src="${s.name}.png" style="width:560px;display:block"><figcaption style="padding:6px 2px"><b>${s.name}</b> · <span style="opacity:.75;font-weight:400">${s.says}</span></figcaption></figure>`).join('')}</div></body></html>`);
const p = await b.newPage({ viewport: { width: 1150, height: 400 } });
await p.goto('file://' + sheet); await p.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
await b.close();
console.log(`boxless-ui: ${shots.length} looks → ${path.join(out, 'sheet.png')}`);
