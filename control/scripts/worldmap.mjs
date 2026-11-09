#!/usr/bin/env node
/**
 * THE WORLD MAP TEST BED — maps linked at their borders, each loaded as it is walked into (a zoned map: level/zones.js),
 * built and walked with no database, no design loop and no game around it (gameworld/worldmap-bed.js).
 *
 *   cd control
 *   node scripts/worldmap.mjs                        # build the sample (2 × 2 zones) to a temp folder
 *   node scripts/worldmap.mjs --world my-world.json  # a world of your own (a gameworld with a zoned glyph level)
 *   node scripts/worldmap.mjs --out ./wm --serve     # build, then serve it (http://127.0.0.1:4417/) to walk by hand
 *   node scripts/worldmap.mjs --walk                 # build, serve and walk every gate in headless Chrome, timed
 *   node scripts/worldmap.mjs --world w.json --zones A   # build only zone A (its approved sketch lowered: a segment geocubed)
 *   node scripts/worldmap.mjs ... --cdn              # three.js from the pinned CDN (a page host with a CSP: an artifact)
 *   node scripts/worldmap.mjs --reuse --walk         # walk the folder already built
 *   node scripts/worldmap.mjs --walk --shots <dir>   # and a picture at each arrival (for the eyes gate)
 *   node scripts/worldmap.mjs --map-only             # the world map in miniature alone (map.html, model.html), in a moment
 *                                                    # and each segment's planning brief (briefs/<segment>.md)
 *   node scripts/worldmap.mjs --save-world w.json    # the sample written out, to sketch on (level.glyphs.sketch)
 *   node scripts/worldmap.mjs --world w.json --approve B --map-only   # B's sketch approved in the file, redrawn
 *   (served, the miniature is http://127.0.0.1:4417/map.html: the world, a zone, a tile; drill in, cross sideways)
 *
 * The walk teleports the walker onto each exit in turn (the machine gate: the crossing, not the legs between) and reads
 * the next zone's page: which zone loaded, where the walker stands against the gate's arrival, how long the swap took.
 * Whether the seam reads as one land is the eyes gate: serve it and look.
 */
import { register } from 'node:module';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

register('./mcp-stdio-loader.mjs', import.meta.url);

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

const { WORLDMAP_SAMPLE, worldmapGame, buildWorldmap, crossings, worldmapPage, worldmapModelPage, writeBriefs, approveSegment } = await import('../lib/graph/gameworld/worldmap-bed.js');
let world = opt('--world') ? JSON.parse(await fs.readFile(opt('--world'), 'utf8')) : WORLDMAP_SAMPLE;
// (the sample written out, to plan on: edit its sketch, then --world it)
if (opt('--save-world')) { await fs.writeFile(opt('--save-world'), JSON.stringify(world, null, 2)); console.log(`worldmap: the world written to ${opt('--save-world')}`); process.exit(0); }
// (a segment's sketch approved, in the world's own file)
if (opt('--approve')) {
  if (!opt('--world')) { console.error('worldmap: --approve <segment> writes the approval into a world file: --world <file> (--save-world <file> writes the sample out)'); process.exit(2); }
  world = approveSegment(world, opt('--approve'));
  await fs.writeFile(opt('--world'), JSON.stringify(world, null, 2));
  console.log(`worldmap: ${opt('--approve')} approved in ${opt('--world')}`);
}
const dir = path.resolve(opt('--out') ?? path.join(os.tmpdir(), 'mojulo-worldmap', world.id));
const port = Number(opt('--port', '4417'));

let made;
if (flag('--map-only')) {
  // (the miniature alone: drawn from the recipe in a moment, no zone built; its walk links wait on a full build)
  made = worldmapGame(world);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'map.html'), worldmapPage(world, made));
  await fs.writeFile(path.join(dir, 'model.html'), await worldmapModelPage(world, made));
  await writeBriefs(world, made, dir);
  console.log(`worldmap: the miniature, ${path.join(dir, 'map.html')}; its model, ${path.join(dir, 'model.html')}`);
} else if (flag('--reuse')) {
  made = worldmapGame(world);
  console.log(`worldmap: reusing ${dir}`);
} else {
  console.log(`worldmap: building '${world.name ?? world.id}' into ${dir}`);
  const t = Date.now();
  ({ made } = await buildWorldmap(world, { outDir: dir, log: (s) => console.log(`  ${s}`), ...(opt('--zones') ? { only: opt('--zones').split(',') } : {}), ...(flag('--cdn') ? { cdn: true } : {}) }));
  console.log(`worldmap: built in ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

if (!flag('--serve') && !flag('--walk')) { console.log(`worldmap: open with  node scripts/worldmap.mjs --reuse --serve --out ${dir}`); process.exit(0); }

// a plain static server over the folder
const server = http.createServer(async (rq, rs) => {
  const u = new URL(rq.url, 'http://x'), p = path.join(dir, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!p.startsWith(dir)) { rs.writeHead(403).end(); return; }
  try { const b = await fs.readFile(p); rs.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'application/json' }).end(b); }
  catch { rs.writeHead(404).end(); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const url = `http://127.0.0.1:${port}/`;
console.log(`worldmap: serving ${url}`);
if (!flag('--walk')) { console.log('worldmap: W / S walk, A / D turn; walk out through a gap in a zone\'s border to cross. Ctrl-C to stop.'); await new Promise(() => {}); }

// THE WALK
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('../lib/graph/scene/chromium.js');
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
const SETTLE = 4000;
const frameOf = () => page.frames().find((f) => f.parentFrame() && /\/levels\//.test(f.url()));
// a zone is ready: its frame is the level asked for, its walker stands, the shell's veil is down
async function ready(ref, timeout = 240000, near = null) {
  const t0 = Date.now();
  for (;;) {
    const f = frameOf();
    if (f && f.url().endsWith(`/levels/${ref}.html`)) {
      const pos = await f.evaluate(() => { const W = window.__mojCtrl?.world, p = W && (W.byId[W.pilotId] || W.entities[0]); return p?.transform ? p.transform.pos.slice() : null; }).catch(() => null);
      const veil = await page.evaluate(() => { const v = document.getElementById('veil'); return v ? getComputedStyle(v).display : 'none'; });
      if (pos && veil === 'none') {
        // (the arrival is heard on the level's first frames: read where the walker stands once they have run)
        const ms = Date.now() - t0;
        // (up to SETTLE ms, until the walker stands by `near`)
        let settled = pos;
        for (const t1 = Date.now(); Date.now() - t1 < SETTLE;) {
          await new Promise((r) => setTimeout(r, 200));
          settled = await f.evaluate(() => { const W = window.__mojCtrl.world, p = W.byId[W.pilotId] || W.entities[0]; return p.transform.pos.slice(); });
          if (!near || Math.hypot(settled[0] - near[0], settled[1] - near[1]) <= 3) break;
        }
        return { ms, settleMs: Date.now() - t0 - ms, pos: settled };
      }
    }
    if (Date.now() - t0 > timeout) throw new Error(`worldmap: '${ref}' never got ready (${Math.round(timeout / 1000)} s)`);
    await new Promise((r) => setTimeout(r, 150));
  }
}
const first = made.game.levels[0].ref;
let t = Date.now();
await page.goto(url);
let at = await ready(first);
console.log(`walk: ${first} ready in ${((Date.now() - t) / 1000).toFixed(1)} s (the shell, then the zone's page)`);
const rows = [];
for (const c of crossings(made)) {
  const f = frameOf();
  // (onto the exit, at the walker's eye over the ground: the reach-exit fires on the next frames)
  await f.evaluate((p) => { const W = window.__mojCtrl.world, e = W.byId[W.pilotId] || W.entities[0]; e.transform.pos[0] = p[0]; e.transform.pos[1] = p[1]; e.transform.pos[2] = p[2] + 1.7; }, c.at);
  t = Date.now();
  const r = await ready(c.to, 240000, c.arrive);
  const off = Math.hypot(r.pos[0] - c.arrive[0], r.pos[1] - c.arrive[1]);
  rows.push({ ...c, ms: r.ms, off });
  if (opt('--shots')) { await fs.mkdir(opt('--shots'), { recursive: true }); await new Promise((q) => setTimeout(q, 1500)); await page.screenshot({ path: path.join(opt('--shots'), `${String(rows.length).padStart(2, '0')}-${made.zones[c.from].id}-to-${made.zones[c.to].id}.png`) }); }
  console.log(`walk: ${c.from} --${c.exit}--> ${c.to}: loaded in ${(r.ms / 1000).toFixed(1)} s, set down ${off.toFixed(1)} m from the gate's arrival (${(r.settleMs / 1000).toFixed(1)} s after)${off > 3 ? '  (FAR)' : ''}`);
}
const bad = rows.filter((r) => r.off > 3);
console.log(`walk: ${rows.length} crossings, ${bad.length} set down far from their gate; page errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
await browser.close();
server.close();
process.exit(bad.length || errors.length ? 1 : 0);
