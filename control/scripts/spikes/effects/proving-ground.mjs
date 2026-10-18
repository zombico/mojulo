// The effects proving ground (perlin spike, effect light): a night arena of its own, kept off every level and preset,
// where one effect at a time loops on a heartbeat between a caster and a target, so the light it throws can be seen on
// stone, on live steel (the knight), on the drawn character light (the anime caster) and on a creature (the fox).
//
//   node scripts/spikes/effects/proving-ground.mjs <out-dir> [effect …]   (from control/; effects: see EFFECTS)
//
// Writes <effect>.html (fxLight and fxStyle), <effect>-light.html (fxLight alone) and <effect>-off.html for each. Spike only: the
// payload is composed here and handed to emitThreeWorld; nothing in it is a product surface.
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url).href);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const { rollMascot } = await import('../../../lib/graph/egocube/mascot.js');
const { mascotPlanFromSheet } = await import('../../../lib/graph/egocube/mascot-form.js');
const { lowerPlay } = await import('../../../lib/graph/playscape/ui/direction.js');
const { tagFacesWithMetal } = await import('../../../lib/graph/polygonizer/materials.js');
const { resolveMetalSurface } = await import('../../../lib/graph/materials/metal-surface.js');

const out = process.argv[2] || 'proving-ground';
mkdirSync(out, { recursive: true });
// each effect: what the caster's cue does, every `every` seconds
export const EFFECTS = {
  hadou: { every: 3.2, then: { beam: { who: 'caster', to: 'target', is: 'orb', color: '#5ab8ff' } } },
  laser: { every: 2.6, then: { beam: { who: 'caster', to: 'target', is: 'laser', color: '#ff3a4a' } } },
  serpent: { every: 3, then: { beam: { who: 'caster', to: 'target', is: 'serpent', color: '#b06cff' } } },
  lightning: { every: 2.2, then: { puff: { who: 'target', is: 'strike' } } },
  blast: { every: 3, then: { explode: { who: 'target', is: 'blast' } } },
  fireworks: { every: 3.4, then: { puff: { who: 'target', is: 'fireworks' } } },
};
const want = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(EFFECTS);

const NIGHT = { from: 'gothic-night', materials: true };
const figure = async (manifest, at, yaw, group) => {
  const { payload } = await resolveWorldScene({ title: group, manifest });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (p) => [at[0] + p[0] * c - p[1] * s, at[1] + p[0] * s + p[1] * c, at[2] + p[2]];
  const V = (v) => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  return payload.faces.filter((f) => f.group === 'body').map((f) => ({ ...f, group, corners: f.corners.map(P), ...(f.outNormal ? { outNormal: V(f.outNormal) } : {}), ...(f.normal ? { normal: V(f.normal) } : {}) }));
};
const fox = mascotPlanFromSheet(rollMascot({ brief: 'a robot fox', seed: 1 })).create.spec.plan;
const figures = [
  ...(await figure(expandLayeredManifest({ kind: 'layered', toon: { light: true }, hero: heroRecord({ cast: 'female', head: 'anime', adorn: { type: 'armor', style: 'knight' }, geocube: NIGHT }) }), [-4, 0, 0], -Math.PI / 2, 'caster')),
  ...(await figure(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', adorn: { type: 'armor', style: 'knight' }, geocube: NIGHT }) }), [4, 0, 0], Math.PI / 2, 'target')),
  ...(await figure(expandLayeredManifest({ kind: 'layered', plan: { ...fox, materials: { Body: { metal: 'steel', finish: 'brushed' } } }, geocube: NIGHT }), [0, 1.8, 0], Math.PI, 'fox')),
];

// the arena: a flagstone floor, a low stone wall behind, steel pillars at the corners of the lane
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group });
const floor = [];
for (let i = -12; i < 12; i++) for (let j = -8; j < 8; j++) {
  const v = ((i * 7 + j * 13) % 5 + 5) % 5, g = 34 + v * 3;   // moonlit flagstones: dark, so a light has room
  floor.push(quad([i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0], `#${[g, g + 2, g + 8].map((x) => x.toString(16).padStart(2, '0')).join('')}`, 'floor'));
}
const box = (x0, y0, x1, y1, h, fill, group) => [
  quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group),
  quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
  quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group),
];
const wall = box(-12, 4.5, 12, 5.2, 2.4, '#3a3834', 'wall');
const steel = resolveMetalSurface({ metal: 'steel', finish: 'brushed' });
const pillars = [[-2, -1.6], [2, -1.6], [-2, 2.6], [2, 2.6]].flatMap(([x, y], k) => tagFacesWithMetal(box(x - 0.25, y - 0.25, x + 0.25, y + 0.25, 2.6, steel.hex, `pillar${k}`), steel));

const entities = [
  { id: 'caster', rule: { type: 'walk' }, transform: { pos: [-4, 0, 0] }, body: { type: 'none' } },
  { id: 'target', rule: { type: 'static' }, transform: { pos: [4, 0, 0] }, body: { type: 'none' } },
];
const camera = { name: 'arena', worldFraming: { cameraPosition: [0, -8.6, 2.7], lookAt: [0, 0.6, 1.0], horizontalFov: 64, pictureCenter: [560, 390] } };
for (const name of want) {
  const E = EFFECTS[name]; if (!E) throw new Error(`no effect '${name}' (have ${Object.keys(EFFECTS).join(', ')})`);
  const events = lowerPlay({ entities, play: { cues: [{ id: 'go', when: { start: true }, then: E.then }, { id: 'again', when: { every: E.every }, then: E.then }] } }, { player: 'caster' });
  // three takes: the floor and the light (<effect>), the light alone (-light), neither (-off)
  for (const [tag, ev] of [['', { ...events, fxLight: true, fxStyle: true }], ['-light', { ...events, fxLight: true }], ['-off', events]]) {
    const html = emitThreeWorld({ faces: [...floor, ...wall, ...pillars, ...figures], cameras: [camera], entities, events: ev,
      viewBox: { width: 1120, height: 640 }, title: `proving ground · ${name}`, bg: '#0a0c14', sky: { zenith: [8, 10, 20], horizon: [22, 26, 42], day: 0, stars: 0.6, seed: 3 }, inline: true, capture: true });
    writeFileSync(`${out}/${name}${tag}.html`, html);
  }
  console.log(name, 'ok');
}
