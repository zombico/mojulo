// The effects proving ground (perlin spike, effect light): a night arena of its own, kept off every level and preset,
// where one effect at a time loops on a heartbeat between a caster and a target, so the light it throws can be seen on
// stone, on live steel (the knight), on the drawn character light (the anime caster) and on a creature (the fox).
//
//   node scripts/spikes/effects/proving-ground.mjs <out-dir> [effect …] [--juice <look>:<flavor>] [--board [looks]] [--rig]
//   (from control/; effects: see EFFECTS)
//
// Writes <effect>.html (fxLight and fxStyle), <effect>-light.html (fxLight alone) and <effect>-off.html for each.
// --juice cel:action: the effect under that composed floor (scene/juice-style.js: a look names its register) instead,
// <effect>-cel-action.html; --juice material:action:voxel at a fidelity too, <effect>-material-action-voxel.html. --board: every look (or the comma-separated ones given) × game type,
// <effect>-<look>-<flavor>.html, and board-<effect>.html with the cells side by side, a row a look, so the compositions
// can be compared by eye. Spike only: the
// payload is composed here and handed to emitThreeWorld; nothing in it is a product surface.
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url).href);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { WORLD_KINDS } = await import('../../../lib/graph/worlds/world-kinds.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const { rollMascot } = await import('../../../lib/graph/egocube/mascot.js');
const { mascotPlanFromSheet } = await import('../../../lib/graph/egocube/mascot-form.js');
const { lowerPlay } = await import('../../../lib/graph/playscape/ui/direction.js');
const { tagFacesWithMetal } = await import('../../../lib/graph/polygonizer/materials.js');
const { resolveMetalSurface } = await import('../../../lib/graph/materials/metal-surface.js');

const out = process.argv[2] || 'proving-ground';
mkdirSync(out, { recursive: true });
// each effect: what the caster's cue does, every `every` seconds; `start`: a cue once at the start (a status worn the
// whole take); `cast`: extra casters (id → pos) the cue may fire from
const WALLS = { wallL: [-2.6, 3.4, 0.5], wallR: [1.4, 3.6, 0.5] };
export const EFFECTS = {
  hadou: { every: 3.2, then: { beam: { who: 'caster', to: 'target', is: 'orb', color: '#5ab8ff' } } },
  laser: { every: 2.6, then: { beam: { who: 'caster', to: 'target', is: 'laser', color: '#ff3a4a' } } },
  serpent: { every: 3, then: { beam: { who: 'caster', to: 'target', is: 'serpent', color: '#b06cff' } } },
  lightning: { every: 2.2, then: { puff: { who: 'target', is: 'strike' } } },
  blast: { every: 3, then: { explode: { who: 'target', is: 'blast' } } },
  fireworks: { every: 3.4, then: { puff: { who: 'target', is: 'fireworks' } } },
  // noise: lightning and flame drawn by the page's noise; walls with spell circles; a hex shield; an itano circus
  'lightning-beam': { every: 2.4, then: { beam: { who: 'caster', to: 'target', is: 'lightning' } } },
  fireball: { every: 3, then: { beam: { who: 'caster', to: 'target', is: 'fireball' } } },
  'sigil-wall': { every: 3.6, cast: WALLS, then: [{ beam: { who: 'wallL', to: 'target', is: 'sigil' } }, { beam: { who: 'wallR', to: 'target', is: 'sigil', color: '#ff7ad0' } }] },
  shield: { every: 1.7, start: { status: { who: 'target', is: 'warded', look: 'ward' } }, then: { beam: { who: 'caster', to: 'target', is: 'orb', color: '#ffb04a' } } },
  itano: { every: 3.4, then: { beam: { who: 'caster', to: 'target', is: 'itano' } } },
  'itano-laser': { every: 2.8, then: { beam: { who: 'caster', to: 'target', is: 'itano-laser' } } },
  // powering up: the caster wears spirit onions (the power-up look's aura) the whole take, firing an orb
  // a weapon's swing: the caster (with --rig) holds a sword and loops its chop, its trail drawn in the look's way
  swing: { every: 1.6, swing: { gesture: 'chop', item: 'sword' }, then: { puff: { who: 'caster', is: 'sparks', color: '#ffe9a8' } } },
  'swing-greatsword': { every: 1.6, swing: { gesture: 'cleave', item: 'greatsword' }, then: { puff: { who: 'caster', is: 'sparks', color: '#ffe9a8' } } },
  'power-up': { every: 3, start: { status: { who: 'caster', is: 'power-up', look: 'power-up' } }, then: { beam: { who: 'caster', to: 'target', is: 'orb', color: '#ffd24a' } } },
};
const { JUICE_LOOK_IDS, JUICE_FLAVOR_IDS, readJuiceStyle } = await import('../../../lib/graph/scene/juice-style.js');
const args = process.argv.slice(3), flag = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; const takes = v !== undefined && (k === '--juice' || k === '--close' || /^[a-z,]+$/.test(v) && v.split(',').every((l) => JUICE_LOOK_IDS.includes(l))); args.splice(i, takes ? 2 : 1); return takes ? v : ''; };
const juiceArg = flag('--juice'), boardArg = flag('--board'), board = boardArg !== null;
// --rig: the caster and the target stand as live characters (figure-rig bodies the page tracks) instead of baked faces, so
// what an effect does to a body shows (the characters' rim light, effect-rim.js)
const rigI = args.indexOf('--rig'), rig = rigI >= 0; if (rig) args.splice(rigI, 1);
// --close caster|target: the camera close on one of them (to see what an effect does to a body)
const closeArg = flag('--close') ?? null;
const cells = board ? (boardArg ? boardArg.split(',') : JUICE_LOOK_IDS).flatMap((look) => JUICE_FLAVOR_IDS.map((flavor) => readJuiceStyle({ look, flavor })))
  : juiceArg ? [(([look, flavor, fidelity]) => readJuiceStyle({ look, flavor, ...(fidelity ? { fidelity } : {}) }))(juiceArg.split(':'))] : null;
const want = args.length ? args : Object.keys(EFFECTS);

const NIGHT = { from: 'gothic-night', materials: true };
const figure = async (manifest, at, yaw, group) => {
  const { payload } = await resolveWorldScene({ title: group, manifest });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (p) => [at[0] + p[0] * c - p[1] * s, at[1] + p[0] * s + p[1] * c, at[2] + p[2]];
  const V = (v) => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  return payload.faces.filter((f) => f.group === 'body').map((f) => ({ ...f, group, corners: f.corners.map(P), ...(f.outNormal ? { outNormal: V(f.outNormal) } : {}), ...(f.normal ? { normal: V(f.normal) } : {}) }));
};
// a hero as the page's live character: its figure (the rig, its clips) as a layered hero world resolves it
const rigFigure = async (manifest) => (await resolveWorldScene({ title: 'rig', manifest })).payload.figures.body;
const fox = mascotPlanFromSheet(rollMascot({ brief: 'a robot fox', seed: 1 })).create.spec.plan;
const casterM = expandLayeredManifest({ kind: 'layered', toon: { light: true }, hero: heroRecord({ cast: 'female', head: 'anime', adorn: { type: 'armor', style: 'knight' }, geocube: NIGHT }) });
const targetM = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', adorn: { type: 'armor', style: 'knight' }, geocube: NIGHT }) });
const rigs = rig ? { caster: await rigFigure(casterM), target: await rigFigure(targetM) } : null;
// a swinging caster: the hero holding the item, its swing clip played as its idle (so it loops standing)
// the swinging hero at its game type's timing (hero-swing.js swingTiming: the take's flavor, as a world's composed juice times it)
const swingRig = async (sw, flavor) => { const F = (await WORLD_KINDS.layered.resolve(expandLayeredManifest({ kind: 'layered', toon: { light: true }, hero: heroRecord({ cast: 'female', head: 'anime', gesture: sw.gesture, gear: { right: { item: sw.item } }, geocube: NIGHT }) }), { title: 'rig', ...(flavor ? { swing: flavor } : {}) })).figures.body; return { ...F, clips: { ...F.clips, walk: F.clips[sw.gesture], forward: F.clips[sw.gesture] } }; };
const figures = [
  ...(rig ? [] : await figure(casterM, [-4, 0, 0], -Math.PI / 2, 'caster')),
  ...(rig ? [] : await figure(targetM, [4, 0, 0], Math.PI / 2, 'target')),
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

const base = rig ? [
  { id: 'caster', rule: { type: 'static' }, transform: { pos: [-4, 0, 0], heading: 0 }, body: { type: 'figure-rig', figure: 'caster' } },
  { id: 'target', rule: { type: 'static' }, transform: { pos: [4, 0, 0], heading: Math.PI }, body: { type: 'figure-rig', figure: 'target' } },
] : [
  { id: 'caster', rule: { type: 'walk' }, transform: { pos: [-4, 0, 0] }, body: { type: 'none' } },
  { id: 'target', rule: { type: 'static' }, transform: { pos: [4, 0, 0] }, body: { type: 'none' } },
];
const CLOSE = { caster: -4, target: 4 };
const camera = closeArg && CLOSE[closeArg] !== undefined
  ? { name: 'close', worldFraming: { cameraPosition: [CLOSE[closeArg] - Math.sign(CLOSE[closeArg]) * 1.6, -2.8, 1.55], lookAt: [CLOSE[closeArg], 0, 1.0], horizontalFov: 52, pictureCenter: [560, 390] } }
  : { name: 'arena', worldFraming: { cameraPosition: [0, -8.6, 2.7], lookAt: [0, 0.6, 1.0], horizontalFov: 64, pictureCenter: [560, 390] } };
for (const name of want) {
  const E = EFFECTS[name]; if (!E) throw new Error(`no effect '${name}' (have ${Object.keys(EFFECTS).join(', ')})`);
  const entities = [...base, ...Object.entries(E.cast || {}).map(([id, pos]) => ({ id, rule: { type: 'static' }, transform: { pos }, body: { type: 'none' } }))];
  const cues = [...(E.start ? [{ id: 'wear', when: { start: true }, then: E.start }] : []), { id: 'go', when: { start: true }, then: E.then }, { id: 'again', when: { every: E.every }, then: E.then }];
  const events = lowerPlay({ entities, play: { cues } }, { player: 'caster' });
  // three takes: the floor and the light (<effect>), the light alone (-light), neither (-off); or the composed cells
  const takes = cells ? cells.map((c) => [`-${c.look}-${c.flavor}${c.fidelity ? `-${c.fidelity}` : ''}`, { ...events, fxLight: true, fxStyle: c }]) : [['', { ...events, fxLight: true, fxStyle: true }], ['-light', { ...events, fxLight: true }], ['-off', events]];
  for (const [tag, ev] of takes) {
    const figs = rigs && E.swing ? { ...rigs, caster: await swingRig(E.swing, ev.fxStyle?.flavor ?? null) } : rigs;
    // the swinging caster plays its swing in place, a swing every ~1.4 s (the clock rule: the clip by time, no travel)
    const ents = E.swing && rig ? entities.map((e) => (e.id === 'caster' ? { ...e, rule: { type: 'clock', rate: 0.7 } } : e)) : entities;
    const html = emitThreeWorld({ faces: [...floor, ...wall, ...pillars, ...figures], cameras: [camera], entities: ents, events: ev, ...(figs ? { figures: figs } : {}),
      viewBox: { width: 1120, height: 640 }, title: `proving ground · ${name}`, bg: '#0a0c14', sky: { zenith: [8, 10, 20], horizon: [22, 26, 42], day: 0, stars: 0.6, seed: 3 }, inline: true, capture: true });
    writeFileSync(`${out}/${name}${tag}.html`, html);
  }
  if (board) {
    const cell = (c) => `<figure><iframe src="${name}-${c.look}-${c.flavor}.html" loading="lazy"></iframe><figcaption><b>${c.register} · ${c.look}</b> · ${c.flavor}</figcaption></figure>`;
    writeFileSync(`${out}/board-${name}.html`, `<!doctype html><meta charset="utf-8"><title>juice board · ${name}</title><style>body{margin:0;padding:12px;background:#0a0c14;color:#cfd6e6;font:13px system-ui}h1{font-size:15px;margin:0 0 8px}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}figure{margin:0}iframe{width:100%;aspect-ratio:1120/640;border:0;background:#000}figcaption{padding:4px 0}</style><h1>${name}: look (rows) × game type (columns)</h1><div class="g">${cells.map(cell).join('')}</div>`);
  }
  console.log(name, 'ok');
}
