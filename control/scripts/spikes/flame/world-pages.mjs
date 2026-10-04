// Fire in worlds: two live World pages to look at in a browser, built the way the world route builds them.
//   · a dungeon by torchlight (`fire: true`): its chamber fires are braziers, its tunnel lights torches on the walls;
//   · a campfire on a terrain in the wind (`fire: { sources }`), with a ring of torches, leaning in the gusts the
//     grass bends in.
//   node scripts/spikes/flame/world-pages.mjs /absolute/out-dir
import { writeFileSync, mkdirSync } from 'node:fs';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { assembleDungeonScene } = await import('../../../lib/graph/architecture/dungeon-designer.js');
const { assembleTerrainWorld } = await import('../../../lib/graph/terrain/terrain-world.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveFire, firePageChannel } = await import('../../../lib/graph/fire/fire.js');
const { atlasField } = await import('../../../lib/graph/terrain/terrain-atlas.js');

const [dir = 'scripts/spikes/flame'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
// what world-scene.js does with `fire`
const withFire = (payload, fire) => {
  const r = resolveFire(fire, payload.fireSources || [], { explicit: !payload.fireSourcesAll });
  const out = { ...payload, ...(r ? { fire: firePageChannel(r, { terrainAir: !!payload.terrain, day: payload.sky && Number.isFinite(payload.sky.day) ? payload.sky.day : 0 }) } : {}) };
  delete out.fireSources; delete out.fireSourcesAll; return out;
};

// the dungeon: a hub, two side chambers, a corridor and a tube
const dungeon = {
  chambers: [
    { id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 },
    { id: 'west', at: [-19, 5], elevation: -2.5, radius: 6, height: 8 },
    { id: 'north', at: [3, 21], elevation: 1.5, radius: 5.5, height: 7.5 },
  ],
  tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }, { from: 'hub', to: 'north' }],
  fire: true,
};
const dp = withFire(assembleDungeonScene(dungeon, {}), dungeon.fire);
// the page to walk; and a capture copy (its frame loop is the capture API's: one still per frame() call) for checks
writeFileSync(`${dir}/dungeon-fire.html`, emitThreeWorld({ ...dp, inline: true, hud: true }));
writeFileSync(`${dir}/dungeon-fire.capture.html`, emitThreeWorld({ ...dp, inline: true, hud: true, capture: true }));
console.log('dungeon', dp.fire.sources.map((s) => s.kind).join(' '));

// the campfire: a meadow in a breeze, a campfire a few steps from the spawn and four torches around it
const world = { features: [{ feature: 'river' }], climate: 'temperate', seed: 'campfire' };
const probe = assembleTerrainWorld({ kind: 'terrain', world }, { live: true });
// the flattest ground within 60 m of the spawn, out of the water: a campfire wants a level spot
const F0 = atlasField({ world }), [sx, sy] = probe.walk.spawn; let best = null;
for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
  const x = sx + 5 * i, y = sy + 5 * j, z = F0.groundAt(x, y); let v = 0;
  for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, -3]]) v += Math.abs(F0.groundAt(x + dx, y + dy) - z);
  const wet = F0.waterAt ? F0.waterAt(x, y) : null;
  if (!(wet > z) && (!best || v < best.v)) best = { v, x, y };
}
const cx = best.x, cy = best.y;
const fire = { sources: [{ kind: 'campfire', at: [cx, cy] }, ...[0, 1, 2, 3].map((k) => ({ kind: 'torch', at: [cx + 3.2 * Math.cos(k * Math.PI / 2 + 0.6), cy + 3.2 * Math.sin(k * Math.PI / 2 + 0.6)] }))] };
const manifest = { kind: 'terrain', world, grass: { kinds: ['meadow'], density: 3, cover: 0.7 }, wind: { speed: 3, dir: 30, gust: 0.6, debris: false }, fire };
const tp = assembleTerrainWorld(manifest, { live: true, title: 'campfire' });
// a torch stands on its pole: its flame is 1.5 m up
for (const s of tp.fireSources) if (s.kind === 'torch') s.at = [s.at[0], s.at[1], s.at[2] + 1.5];
const gz = F0.groundAt(cx, cy);
tp.cameras = [
  { name: 'by the fire', worldFraming: { cameraPosition: [cx - 3.4, cy - 2.2, gz + 1.5], lookAt: [cx, cy, gz + 0.5], horizontalFov: 70 } },
  { name: 'downwind', worldFraming: { cameraPosition: [cx + 4.5, cy + 2.8, gz + 1.6], lookAt: [cx, cy, gz + 0.7], horizontalFov: 70 } },
  ...tp.cameras,
];
tp.walk = { ...tp.walk, spawn: [cx - 6, cy - 1.5, gz + 1.7] };
const tpf = withFire(tp, manifest.fire);
writeFileSync(`${dir}/campfire.html`, emitThreeWorld({ ...tpf, walk: true, hud: true, inline: true }));
writeFileSync(`${dir}/campfire.capture.html`, emitThreeWorld({ ...tpf, walk: true, hud: true, inline: true, capture: true }));
console.log('campfire', tpf.fire.sources.map((s) => `${s.kind}@${s.at.map((v) => v.toFixed(1))}`).join(' '));
