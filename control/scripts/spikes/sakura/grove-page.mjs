// A cherry grove in bloom, in the wind: a live terrain World page (cherry trees in place of the climate's, a lawn and a
// meadow under them, petals from the crowns) written to a file to look at in a browser.
//   node scripts/spikes/sakura/grove-page.mjs /absolute/out.html [speed m/s] [petals]
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);   // the @/ alias
const { assembleTerrainWorld } = await import('../../../lib/graph/terrain/terrain-world.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { atlasField } = await import('../../../lib/graph/terrain/terrain-atlas.js');
const { plantsConfig, plantsKernel } = await import('../../../lib/graph/terrain/terrain-plants.js');

const [out = 'scripts/spikes/sakura/grove.html', speed = '6', petals = '4000'] = process.argv.slice(2);
const world = { features: [{ feature: 'river' }], climate: 'temperate', seed: 'hanami' };
const manifest = {
  kind: 'terrain', world,
  plants: { kinds: ['cherry'], variants: 3 },
  grass: { kinds: ['lawn', 'meadow'], density: 4, cover: 0.8 },
  wind: { speed: Number(speed), dir: 20, gust: 0.7, scale: 10, debris: { petals: Number(petals), leaves: 0, dust: 300, radius: 30 } },
};
const payload = assembleTerrainWorld(manifest, { live: true, title: 'cherry grove' });

// bookmarks where the grove is thickest near the spawn: under the trees, and standing back at the edge
const field = atlasField({ world }), V = plantsConfig(field, { kinds: ['cherry'] }), PK = plantsKernel(field, V);
const [sx, sy] = payload.walk.spawn; let best = null;
for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
  const x0 = sx + i * 40, y0 = sy + j * 40, a = PK.plantsIn(x0, y0, 40), n = a.length / 9;
  if (!best || n > best.n) best = { n, x: x0 + 20, y: y0 + 20 };
}
const gz = field.groundAt(best.x, best.y), d = (20 * Math.PI) / 180, ux = Math.cos(d), uy = Math.sin(d);
payload.cameras = [
  { name: 'under the trees', worldFraming: { cameraPosition: [best.x - 4 * ux, best.y - 4 * uy, gz + 1.6], lookAt: [best.x + 6 * ux, best.y + 6 * uy, gz + 3], horizontalFov: 75 } },
  { name: 'grove edge', worldFraming: { cameraPosition: [best.x - 22 * ux + 6 * uy, best.y - 22 * uy - 6 * ux, gz + 3], lookAt: [best.x, best.y, gz + 3.5], horizontalFov: 65 } },
  { name: 'downwind', worldFraming: { cameraPosition: [best.x + 10 * ux, best.y + 10 * uy, gz + 1.7], lookAt: [best.x - 4 * ux, best.y - 4 * uy, gz + 2.5], horizontalFov: 75 } },
  ...payload.cameras,
];
writeFileSync(out, emitThreeWorld({ ...payload, walk: true, hud: true, inline: true }));
console.log(`wrote ${out}`, `trees in the thickest 40 m: ${best.n}`, JSON.stringify(payload.meta.wind), JSON.stringify(payload.meta.plants));
