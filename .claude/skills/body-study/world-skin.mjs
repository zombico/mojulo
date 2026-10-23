// THE HERO ON THE WORLD PAGE — the realistic hero (the hero door's record) resolved as the World page resolves it
// (worlds/world-scene.js) and photographed in headless Chromium (motion/world-frames.js), the face close and the whole
// figure, front and three-quarter: what the page itself draws (its palette, its light, its skin texture), not a study's
// own render. The eyes gate's look at the page.
//
//   node .claude/skills/body-study/world-skin.mjs [--cast male|female] [--hero '{…}'] [--size 640] [--out dir]
//   e.g. --hero '{"face":{"seed":3,"age":55}}'
//
// Writes face-front.png, face-three.png, body-front.png, body-three.png and sheet.png.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
const CONTROL = resolve(dirname(new URL(import.meta.url).pathname), '../../../control');
register(pathToFileURL(`${CONTROL}/scripts/mcp-stdio-loader.mjs`).href);
process.chdir(CONTROL);
const sharp = createRequire(join(CONTROL, 'package.json'))('sharp');
const { heroRecord, expandLayeredManifest, withRolledFace } = await import('@/lib/mcp/tools/layered.js');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
const { renderWorldFrames } = await import('@/lib/motion/world-frames.js');

const args = process.argv.slice(2);
let cast = 'male', extra = {}, size = 640, out = '/tmp/world-skin';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--cast') cast = args[++i];
  else if (a === '--hero') extra = JSON.parse(args[++i]);
  else if (a === '--size') size = +args[++i];
  else if (a === '--out') out = args[++i];
  else throw new Error(`world-skin: unknown flag ${a}`);
}
mkdirSync(out, { recursive: true });
// (a `face` in --hero is rolled as the mint rolls it, layered.js withRolledFace; its own fit is left to a mint)
const M = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withRolledFace({ cast, form: 'realistic', ...extra })) });
const t0 = Date.now(), { payload } = await resolveWorldScene({ ref: 'world-skin', title: 'world skin', manifest: M });
const faces = (payload.faces ?? []).filter((f) => !f.studio);
console.error(`world-skin: resolved in ${Date.now() - t0} ms; textures ${Object.keys(payload.textures || {}).join(', ') || 'none'}; ${faces.filter((f) => f.texture).length} of ${faces.length} faces textured`);
// the head's height: the highest skin corner
let top = -Infinity; for (const f of faces) for (const c of f.corners) top = Math.max(top, c[2]);
const page = emitThreeWorld({ ...payload, faces, sky: null, bg: '#e9e7e3', wireframe: false, walk: false, spin: false, decollide: true, hud: false, inline: true, capture: true, xr: null, figures: {} });
const head = top - 0.12, mid = top / 2, at = (az, d, z) => { const a = (az * Math.PI) / 180; return [Math.sin(a) * d, Math.cos(a) * d, z]; };
const shots = [['face-front', at(0, 0.75, head), [0, 0, head], 22], ['face-three', at(35, 0.75, head), [0, 0, head], 22], ['body-front', at(0, 4.2, mid), [0, 0, mid], 28], ['body-three', at(35, 4.2, mid), [0, 0, mid], 28]];
const { pngs } = await renderWorldFrames(page, shots.map(([, pos, target, vfov]) => ({ pos, target, vfov })), { width: size, height: size });
shots.forEach(([name], i) => writeFileSync(join(out, `${name}.png`), pngs[i]));
await sharp({ create: { width: size * 4, height: size, channels: 3, background: '#e9e7e3' } }).composite(pngs.map((input, i) => ({ input, left: i * size, top: 0 }))).png().toFile(join(out, 'sheet.png'));
console.error(`world-skin: ${join(out, 'sheet.png')}`);
