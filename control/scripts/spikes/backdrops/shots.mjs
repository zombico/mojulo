#!/usr/bin/env node
/**
 * The side-scrollers' backdrops for the eyes gate (docs/side-scroll-backgrounds.md): each game's first level resolved as
 * its page would be, its play left out (no hero, no foes, no events: the backdrop alone), shot from the game's own side
 * camera at a few places along it, and laid on a contact sheet a game.
 *
 *   node scripts/spikes/backdrops/shots.mjs [out-dir] [giuseppe|galaxy|vampire] [--zones 6,7,9 | --rooms id,id | --at 6,47] [--scenery a,b] [--theme id]   (galaxy: those zones; vampire: those rooms, that theme; giuseppe: there along the lane, those sceneries)
 *
 *   giuseppe   Jumping Giuseppe's strip (the side strip in scoops), framed by SHAPED_CAMERA along the lane
 *   galaxy     Galaxy Boy's plant (the side map), a shot a zone
 *   vampire    Vampire Sonata's castle (the metroidvania box), two rooms a ring, highest first
 *
 * Writes <game>-<n>.png, sheet-<game>.png and <game>.html (the first shot's page, its motion live in a browser).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const lib = (p) => import(pathToFileURL(path.join(control, 'lib/graph', p)).href);
const { platformerGame } = await lib('gameworld/platformer-game.js');
const { vampireSonataGame } = await lib('gameworld/metroidvania/vampire-sonata.js');
const { gameStages, stageLevelOrder } = await lib('gameworld/levels.js');
const { readGameworld } = await lib('gameworld/world.js');
const { resolveWorldScene } = await lib('worlds/world-scene.js');
const { emitThreeWorld } = await lib('scene/scene-three.js');
const { renderWorldToPng } = await lib('scene/scene-png.js');
const { boxOf } = await lib('gameworld/metroidvania/scene.js');
const { boxCameraOf, FLOOR } = await lib('gameworld/metroidvania/rooms.js');
const { sideMapOf } = await lib('gameworld/side-map/scene.js');
const { SHAPED_CAMERA } = await lib('era/geocube-side.js');
const { loadSharp } = await import(pathToFileURL(path.join(control, 'lib/sharp-lazy.js')).href);

const out = path.resolve(process.argv[2] ?? 'backdrop-shots'), only = process.argv[3], zi = process.argv.indexOf('--zones'), zonesAsked = zi > 0 ? process.argv[zi + 1].split(',').map(Number) : null, ri = process.argv.indexOf('--rooms'), roomsAsked = ri > 0 ? process.argv[ri + 1].split(',') : null, ai = process.argv.indexOf('--at'), atAsked = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : null, opt = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
mkdirSync(out, { recursive: true });
const hfovOf = (vfov, aspect) => (2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * aspect) * 180) / Math.PI;
// (the level's manifest, its play left out: the backdrop alone)
function backdropOf(W, stature) {
  const [stage] = gameStages(W), m = { ...stageLevelOrder(W, stage, { heroRef: 'hero-ref', heroStature: stature, ref: 'lvl' }).args.manifest };
  for (const k of ['entities', 'events', 'game', 'manaHud', 'camera', 'figures', 'colliders']) delete m[k];
  return m;
}
async function shoot(name, m, poses) {
  const { payload } = await resolveWorldScene({ manifest: m }), files = [];
  for (const [i, p] of poses.entries()) {
    const cams = [{ name: `${name}-${i}`, worldFraming: { ...payload.cameras[0].worldFraming, ...p } }], html = emitThreeWorld({ ...payload, cameras: cams, inline: true, hud: false });
    if (!i) writeFileSync(path.join(out, `${name}.html`), html);
    const f = path.join(out, `${name}-${i}.png`);
    writeFileSync(f, await renderWorldToPng(html, { width: 1280, height: 720, deviceScaleFactor: 1 }));
    files.push(f);
  }
  const sharp = await loadSharp(), w = 640, h = 360;
  const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(w, h).png().toBuffer(), left: (i % 2) * w, top: Math.floor(i / 2) * h })));
  await sharp({ create: { width: 2 * w, height: h * Math.ceil(files.length / 2), channels: 3, background: '#000' } }).composite(comps).png().toFile(path.join(out, `sheet-${name}.png`));
  console.log(`${name}: ${files.length} shots, sheet-${name}.png`);
}

if (!only || only === 'giuseppe') {
  const m = backdropOf(readGameworld({ id: 'jg', name: 'Jumping Giuseppe', ...platformerGame({}).words }), 1.0), C = SHAPED_CAMERA;
  if (opt('--scenery')) m.side = { ...m.side, scenery: opt('--scenery').split(',') };
  const topAt = (s) => Math.max(0, ...m.side.boxes.filter((b) => b.min[1] <= s && b.max[1] >= s).map((b) => b.max[2]));
  await shoot('giuseppe', m, (atAsked ?? [6, 30, 62, 95, 130]).map((s) => { const look = topAt(s) + C.lookH; return { cameraPosition: [C.dist, s, look + C.dist * Math.sin(C.tilt)], lookAt: [0, s, look], horizontalFov: hfovOf(C.vfov, 16 / 9) }; }));
}
if (!only || only === 'galaxy') {
  const m = backdropOf(readGameworld({ id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words }), 1.67), L = sideMapOf(m).layout, C = L.camera, W = L.screen.width;
  await shoot('galaxy', m, (zonesAsked ? L.zones.filter((Z, i) => zonesAsked.includes(i)) : L.zones.filter((Z, i) => i % 2 === 0 || Z.run !== 'across').slice(0, 8)).map((Z) => {
    const [s, z] = Z.run === 'across' ? [Z.rect[0] + W / 2, (Z.i ? L.zones[Z.i - 1].exit : [0, 0])[1]] : [(Z.rect[0] + Z.rect[1]) / 2, Z.exit[1] - 4], look = z + C.lookH;
    return { cameraPosition: [C.dist, s, look + C.dist * C.tilt], lookAt: [0, s, look] };
  }));
}
if (!only || only === 'vampire') {
  const m = backdropOf(readGameworld(vampireSonataGame({ heroRef: 'hero-ref' })), 1.69), B = boxOf(m), W = B.greybox.screen.width, H = B.greybox.screen.height, C = boxCameraOf(B.stature);
  const rings = new Map();
  for (const r of [...B.layout.rooms].sort((a, b) => b.rect[1] - a.rect[1])) if ((rings.get(r.ring) ?? []).length < 2) rings.set(r.ring, [...(rings.get(r.ring) ?? []), r]);
  await shoot('vampire', m, (roomsAsked ? B.layout.rooms.filter((r) => roomsAsked.includes(r.id)) : [...rings.values()].flat()).map((r) => { const s = (r.rect[0] + 0.5) * W, look = r.rect[1] * H + FLOOR + C.lookH; return { cameraPosition: [C.dist, s, look + C.dist * C.tilt], lookAt: [0, s, look], horizontalFov: hfovOf(C.vfov, W / H) }; }));
}
