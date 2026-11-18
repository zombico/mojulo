#!/usr/bin/env node
/**
 * The side map for the eyes gate (docs/side-map-principles.md): a geocube `show: 'sidemap'` manifest laid, dressed and
 * held to its laws, written as its elevation (the drawing, SVG and PNG) and, with --shots, its page seen from the side
 * map's camera at a few places (each zone's start, a climb's top, the boss's room).
 *
 *   node scripts/side-map.mjs [manifest.json] [--out dir] [--shots]
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
