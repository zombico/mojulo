#!/usr/bin/env node
/**
 * The side map for the eyes gate (docs/side-map-principles.md): a geocube `show: 'sidemap'` manifest laid, dressed and
 * held to its laws, written as its elevation (the drawing, SVG and PNG) and, with --shots, its page seen from the side
 * map's camera at a few places (each zone's start, a climb's top, the boss's room).
 *
 *   node scripts/side-map.mjs [manifest.json] [--out dir] [--shots] [--bench]
 *
 * --bench: the render benchmark (gameworld/side-map/benchmark.js): a run, a climb and the boss's room shot on the page and
 * as a role pass, measured by role and held to the frame's principles; bench.html (a contact sheet) and bench.json.
 *
 * With no manifest, a stage of every kind of zone (a rest, a lesson, a chimney that rises, a landing, a cascade, a fight,
 * a chute, the boss's room) in the plant. Prints the laws.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { sideMapOf, assembleSideMap } = await import('../lib/graph/gameworld/side-map/scene.js');
const { drawSideMap } = await import('../lib/graph/gameworld/side-map/drawing.js');

const args = process.argv.slice(2), flag = (f) => args.includes(f), opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const out = path.resolve(opt('--out') ?? 'side-map-out');
const DEFAULT = { kind: 'geocube', show: 'sidemap', cube: 'city-night', seed: 3, sidemap: { premise: 'Galaxy Boy breaks into the reactor plant', zones: [
  { run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 3, teach: 'basic' }, { run: 'up', screens: 2, climb: 'chimney', rises: true },
  { run: 'across', screens: 2, beat: 'landing' }, { run: 'down', screens: 2, drop: 'cascade' }, { run: 'across', screens: 4, teach: 'meet', spawners: 2 },
  { run: 'down', screens: 2, drop: 'chute' }, { room: [1, 1], teach: 'boss' },
] } };
const m = file ? JSON.parse(readFileSync(file, 'utf8')) : DEFAULT;
mkdirSync(out, { recursive: true });
const M = sideMapOf(m), svg = drawSideMap(M);
writeFileSync(path.join(out, 'map.svg'), svg);
for (const l of M.laws) console.log(`${l.holds ? 'holds' : 'LOST '}  ${l.id}: ${l.says}`);

const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');
const { loadSharp } = await import('../lib/sharp-lazy.js');
const sharp = await loadSharp();
writeFileSync(path.join(out, 'map.png'), await sharp(Buffer.from(svg)).png().toBuffer());
console.log(`wrote ${path.join(out, 'map.svg')} and map.png`);

if (flag('--shots')) {
  const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
  const p = assembleSideMap(m), L = M.layout, C = L.camera, W = L.screen.width;
  const shots = L.zones.map((Z) => [`zone-${Z.i}`, Z.run === 'across' ? [Z.rect[0] + W / 2, (Z.i ? L.zones[Z.i - 1].exit : [0, 0])[1]] : Z.run === 'up' ? [(Z.rect[0] + Z.rect[1]) / 2, Z.exit[1] - 4] : [(Z.rect[0] + Z.rect[1]) / 2, Z.exit[1]]]);
  for (const [name, [s, z]] of shots) {
    const look = z + C.lookH, hfov = (2 * Math.atan(Math.tan((C.vfov * Math.PI) / 360) * (16 / 9)) * 180) / Math.PI;
    const html = emitThreeWorld({ ...p, cameras: [{ name, worldFraming: { cameraPosition: [C.dist, s, look + C.dist * C.tilt], lookAt: [0, s, look], horizontalFov: hfov, pictureCenter: [640, 360] } }], inline: true, hud: false });
    writeFileSync(path.join(out, `${name}.png`), await renderWorldToPng(html, { width: 1280, height: 720, deviceScaleFactor: 1 }));
  }
  console.log(`wrote ${shots.length} shots`);
}

if (flag('--bench')) {
  const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
  const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
  const { decodeImage } = await import('../lib/graph/scene/visual-gate.js');
  const { benchmarkShots, rolePayload, measureShot, benchmarkLaws } = await import('../lib/graph/gameworld/side-map/benchmark.js');
  const { payload } = await resolveWorldScene({ manifest: m });
  const shots = benchmarkShots(M.layout, M.dress), measures = [], rows = [];
  let flatPayload = null;
  for (const shot of shots) {
    const hfov = (2 * Math.atan(Math.tan((shot.pose.vfov * Math.PI) / 360) * (16 / 9)) * 180) / Math.PI;
    const cams = [{ name: shot.name, worldFraming: { cameraPosition: shot.pose.at, lookAt: shot.pose.look, horizontalFov: hfov, pictureCenter: [640, 360] } }];
    const pagePng = await renderWorldToPng(emitThreeWorld({ ...payload, cameras: cams, inline: true, hud: false }), { width: 1280, height: 720, deviceScaleFactor: 1 });
    const rolePng = await renderWorldToPng(emitThreeWorld({ ...rolePayload(payload, shot, M.stature), cameras: cams, inline: true, hud: false }), { width: 1280, height: 720, deviceScaleFactor: 1 });
    writeFileSync(path.join(out, `bench-${shot.name}.png`), pagePng); writeFileSync(path.join(out, `bench-${shot.name}-roles.png`), rolePng);
    // (a material that reflects: its flat twin, one baked key and no finish, for the glints the bake adds)
    let flatImg = null;
    if (['kibble', 'plate', 'snow'].includes(shot.material)) {
      flatPayload ??= (await resolveWorldScene({ manifest: { ...m, light: 'flat' } })).payload;
      flatImg = decodeImage(await renderWorldToPng(emitThreeWorld({ ...flatPayload, cameras: cams, inline: true, hud: false }), { width: 1280, height: 720, deviceScaleFactor: 1 }));
    }
    const ms = measureShot({ page: decodeImage(pagePng), roles: decodeImage(rolePng), flat: flatImg }, shot);
    measures.push(ms); rows.push(shot.name);
  }
  const laws = benchmarkLaws(measures);
  writeFileSync(path.join(out, 'bench.json'), JSON.stringify({ measures, laws }, null, 2));
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html><meta charset="utf-8"><title>Side map benchmark</title><style>body{background:#111;color:#ddd;font:14px Helvetica,Arial,sans-serif;margin:20px}img{width:560px;margin-right:8px}h2{font-size:16px;margin:18px 0 6px}li.lost{color:#ff8a7a}</style><h1>The side map's render benchmark</h1><p>The machine gate's measures by role, on the page and its role pass. The eyes gate is the operator's.</p>${rows.map((n) => `<h2>${n}</h2><img src="bench-${n}.png"><img src="bench-${n}-roles.png"><ul>${laws.filter((l) => l.shot === n).map((l) => `<li class="${l.holds ? '' : 'lost'}">${l.holds ? 'holds' : 'lost'} · ${esc(l.id)}: ${esc(l.says)}</li>`).join('')}</ul>`).join('')}`;
  writeFileSync(path.join(out, 'bench.html'), html);
  for (const l of laws) console.log(`${l.holds ? 'holds' : 'LOST '}  bench ${l.shot} ${l.id}: ${l.says}`);
}
