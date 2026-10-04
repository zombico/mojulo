// Emits a live terrain World page (grass, plants, wind) to a file, for looking at the wind in a browser.
//   node scripts/spikes/wind/world-page.mjs /absolute/out.html [speed] [grass kinds, comma-separated]
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);   // the @/ alias
const { assembleTerrainWorld } = await import('../../../lib/graph/terrain/terrain-world.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { atlasField } = await import('../../../lib/graph/terrain/terrain-atlas.js');
const { grassConfig, grassKernelOf, resolveTerrainGrass } = await import('../../../lib/graph/terrain/terrain-grass.js');

const [out = 'scripts/spikes/wind/world-wind.html', speed = '7', kinds = 'tussock,pampas,fountain,meadow,sedge,needlegrass'] = process.argv.slice(2);
const manifest = {
  kind: 'terrain', world: { features: [{ feature: 'river' }], climate: 'temperate', seed: 'vale' },
  grass: { kinds: kinds.split(','), density: 5, cover: 0.7 }, plants: true,
  ...(Number(speed) > 0 ? { wind: { speed: Number(speed), dir: 30, gust: 0.6 } } : {}),
};
const payload = assembleTerrainWorld(manifest, { live: true, title: 'wind' });
// bookmarks in the densest grass near the spawn: one eye-level in it, one standing back
const field = atlasField({ world: manifest.world }), V = grassConfig(field, resolveTerrainGrass(manifest.grass)), GK = grassKernelOf(field, V);
const [sx, sy] = payload.walk.spawn; let best = null;
for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) { const x0 = sx + i * 16, y0 = sy + j * 16, n = GK.plantsIn(x0, y0, 16).length / 9; if (!best || n > best.n) best = { n, x: x0 + 8, y: y0 + 8 }; }
const gz = field.groundAt(best.x, best.y), dx = Math.cos(Math.PI / 6), dy = Math.sin(Math.PI / 6);
payload.cameras = [
  { name: 'meadow', worldFraming: { cameraPosition: [best.x - 3 * dy, best.y + 3 * dx, gz + 0.9], lookAt: [best.x + 4 * dy, best.y - 4 * dx, gz + 0.6], horizontalFov: 70 } },
  { name: 'meadow-wide', worldFraming: { cameraPosition: [best.x - 14 * dy, best.y + 14 * dx, gz + 4], lookAt: [best.x, best.y, gz + 0.5], horizontalFov: 65 } },
  ...payload.cameras,
];
console.log('densest tile', best.n, 'tufts at', best.x.toFixed(0), best.y.toFixed(0));
writeFileSync(out, emitThreeWorld({ ...payload, walk: true, hud: true, inline: true }));
console.log(`wrote ${out}`, JSON.stringify(payload.meta.wind || null));
