// Look-dev stills: render explicit interior camera specs over a world-eligible sketch
// through the SAME pipeline forge_motion uses (resolveWorldScene → emitThreeWorld
// capture → renderWorldFrames). A repro harness for furniture and room audits.
//
//   node scripts/lookdev-shots.mjs <ref | manifest.json> <outDir> <shots.json> [--width 1100] [--height 688]
//
// shots.json: [{ id, pos:[x,y,z], target:[x,y,z], hfov?, t?, wireframe? }] in the
// sketch's own units (a floorplan is FEET: eye height ≈ 5.3, not 1.6). A `.json`
// first argument is read as a bare manifest (no database needed); anything else is
// looked up as a stored sketch ref. Prints the mesh bounds and the authored camera so
// a camera that landed inside a wall is obvious.
import { register } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

register('./mcp-stdio-loader.mjs', import.meta.url);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [src, outDir, shotsPath] = positional;
if (!src || !outDir || !shotsPath) {
  console.error('usage: node scripts/lookdev-shots.mjs <ref | manifest.json> <outDir> <shots.json> [--width N] [--height N]');
  process.exit(2);
}
const W = Number(flag('--width', 1100)), H = Number(flag('--height', 688)), ASPECT = W / H;

const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld, verticalFov } = await import('@/lib/graph/scene/scene-three');
const { renderWorldFrames } = await import('@/lib/motion/world-frames.js');

let sketch;
if (src.endsWith('.json')) {
  const manifest = JSON.parse(readFileSync(src, 'utf8'));
  sketch = { ref: path.basename(src, '.json'), title: manifest.title || path.basename(src, '.json'), manifest };
} else {
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  sketch = SketchRepository.getByRef(src);
  if (!sketch) throw new Error(`no sketch '${src}'`);
}
const { payload } = await resolveWorldScene(sketch, {});
mkdirSync(outDir, { recursive: true });

{
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of payload?.faces || []) for (const c of f?.corners || []) for (let k = 0; k < 3; k += 1) {
    if (Number.isFinite(c[k])) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  }
  console.log(`bounds min=[${mn.map((v) => v.toFixed(1))}] max=[${mx.map((v) => v.toFixed(1))}] faces=${payload?.faces?.length}`);
  const wf = payload?.cameras?.[0]?.worldFraming;
  if (wf) console.log(`authored cam pos=[${wf.cameraPosition}] lookAt=[${wf.lookAt}] hfov=${wf.horizontalFov}`);
}

const shots = JSON.parse(readFileSync(shotsPath, 'utf8'));
for (const wire of [false, true]) {
  const group = shots.filter((s) => !!s.wireframe === wire);
  if (!group.length) continue;
  const html = emitThreeWorld({ ...payload, inline: true, capture: true, walk: false, wireframe: wire, decollide: true });
  const specs = group.map((s, i) => ({
    pos: s.pos, target: s.target,
    vfov: verticalFov(s.hfov ?? 55, ASPECT),
    t: Number.isFinite(s.t) ? s.t : i * 100,
  }));
  const { pngs } = await renderWorldFrames(html, specs, { width: W, height: H });
  group.forEach((s, i) => {
    const f = path.join(outDir, `${s.id}${wire ? '-wire' : ''}.png`);
    writeFileSync(f, pngs[i]);
    console.log(`shot ${s.id}${wire ? ' (wireframe)' : ''} -> ${f}`);
  });
}
