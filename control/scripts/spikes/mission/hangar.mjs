#!/usr/bin/env node
/**
 * THE HANGAR, PLAYED — level 1's indoor segment (level1.json) as one page: the hangar bay with its floor 0 lodged under
 * the ground (era/program-core.js `basement: { hall }`), the assault walkers on the line in the main hall, the siege
 * walker in the hall under it, the freight lift between the two (a real opening through the floor, a deck that travels
 * it and carries the operative), the stairwell as the way back out, the keys, the
 * clues and the objectives (worlds/controllable/mission.js), the operative and its kit, guards on both floors. A spike:
 * the stage recipe takes no pilot, so the hero's camera and events are laid on the resolved payload here.
 *
 *   cd control
 *   node scripts/spikes/mission/hangar.mjs --out /abs/dir [--dry] [--hero <ref>] [--guard <ref>] [--vault …] [--roll …]
 *     [--climb …] [--crouch a,b] [--prone a,b] [--capture]
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const hero = opt('--hero'), guard = opt('--guard'), out = path.resolve(opt('--out', 'hangar'));
if (!hero && !guard) process.env.SQLITE_PATH ??= ':memory:';
else if (process.env.MOJULO_DATA_DIR) process.env.SQLITE_PATH ??= path.join(process.env.MOJULO_DATA_DIR, 'mojulo-lite.db');
process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';

const { infiltrationRoom } = await import('../../../lib/graph/gameworld/infiltration-room.js');
const { buildingStage } = await import('../../../lib/graph/gameworld/levels.js');
const { assembleStageScene } = await import('../../../lib/graph/era/stage.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { levelHud } = await import('../../../lib/graph/game/hud-mana.js');
const M = JSON.parse(fss.readFileSync(path.join(here, 'level1.json'), 'utf8'));
const pair = (k) => (opt(k) ? opt(k).split(',') : null);
const G = { id: 'steel-serpents', name: 'Steel Serpents', feel: 'steel-serpents' };
const room = infiltrationRoom(G, { refs: { ...(hero ? { hero } : {}), ...(guard ? { guard } : {}) }, vault: opt('--vault'), roll: opt('--roll'), climb: opt('--climb'),
  crouch: pair('--crouch') ? { idle: pair('--crouch')[0], walk: pair('--crouch')[1] } : null, prone: pair('--prone') ? { idle: pair('--prone')[0], crawl: pair('--prone')[1] } : null });

// THE BUILDING: the hangar bay with its floor 0 a hall high enough for what stands in it
const B = M.building, HALL = Number(opt('--hall', 10));
const m0 = buildingStage({ use: B.use, seed: B.seed }), stage = { ...m0, program: { ...m0.program, basement: { hall: HALL, lift: { at: [0.3, 0.5] } } } };
const dry = assembleStageScene(stage), R = Object.fromEntries(dry.rooms.map((r) => [r.id.replace(/@\d+$/, ''), r.box]));
const need = ['lobby', 'core-0', 'core-1', 'hangar', 'hangar-under', 'flight-ops'].filter((id) => !R[id]);
if (need.length) { console.error(`hangar: the building lays no ${need.join(', ')} (rooms: ${Object.keys(R).join(', ')})`); process.exit(1); }
const parts = Object.keys(R).find((id) => /^parts-1/.test(id));
const mid = (b, dx = 0, dy = 0) => [(b.min[0] + b.max[0]) / 2 + dx, (b.min[1] + b.max[1]) / 2 + dy, b.min[2]];
const r2 = (p) => p.map((v) => +v.toFixed(2));
// the hall along x (its doors at +x); the lift a third of the way in, the line of walkers down its +y side, the siege
// walker under the far two thirds of the hall beneath
const H = R.hangar, U = R['hangar-under'], hx = H.max[0] - H.min[0], hy = H.max[1] - H.min[1];
// (the lift: the opening the building cut for it, era/storeys.js; its deck a slab that fills the opening, flush with the
// floor it is at, starting at the main hall's)
const LA = dry.anchors.find((x) => x.kind === 'lift');
if (!LA) { console.error('hangar: the building cut no lift'); process.exit(1); }
const lift = { a: r2(LA.to), b: r2(LA.at), rect: LA.rect }, DECK = 0.3;
const deck = { id: 'lift-deck', rule: { type: 'static' }, transform: { pos: [lift.a[0], lift.a[1], lift.a[2] - DECK / 2], heading: 0 },
  body: { type: 'mesh', shape: 'box', size: [r2([LA.rect[2] - LA.rect[0]])[0] - 0.06, r2([LA.rect[3] - LA.rect[1]])[0] - 0.06, DECK], color: 0x4a4f55, marker: false } };
const line = [0.22, 0.5, 0.78].map((u) => r2([H.min[0] + hx * u, H.max[1] - 4.5, H.min[2]]));
const siege = r2([U.min[0] + hx * 0.73, U.min[1] + hy * 0.5, U.min[2]]);
const start0 = r2(mid(R.lobby)); start0[2] += 0.05;
// THE LIFT DOWN, SHOT (the page's shoot plan, lib/graph/shoot/: a cued shot the ride plays, the view the plan's through
// it). Three framings on one camera, cut hard:
//   the deck comes down   from the lower hall's floor, low and wide, looking up at the deck in the opening: the depth is
//                         established, and a low lens makes the descent loom
//   what he sees          behind the operative, a medium at his eye, riding him: the walker rises into the frame beyond his
//                         shoulder as the deck goes down, so the reveal is his (the cut turns far more than 30 degrees)
//   the machine           low on the hall's floor before the walker, wide, pushing in: its size, and the push lands the turn
// The first and the last are placed, not said: the framing words size a person, and a machine eight metres tall is not one.
// (`--shot-scale k`: the plan's times stretched k times, for a headless check on a page that runs k times slower than
// the clock the plan plays on; 1 in a build that is played)
const SCALE = Number(opt('--shot-scale', 1)), RIDE = 10, A0 = r2([lift.b[0] + 2, lift.b[1] - 12, 1.3]), WK = r2([siege[0], siege[1], 5.4]);
const shoot = { cameras: [{ id: 'lift', keys: [
  { t: 0, pos: A0, poi: { follow: 'entity:hero', offset: [0, 0, 1] }, lens: '24mm' },
  { t: 3.2, pos: A0, poi: { follow: 'entity:hero', offset: [0, 0, 1] }, lens: '24mm' },
  { t: 3.25, frame: { on: 'entity:hero', size: 'ms', side: 'back', angle: 'eye', place: 'left' } },
  { t: 6.8, frame: { on: 'entity:hero', size: 'ms', side: 'back', angle: 'eye', place: 'left' } },
  { t: 6.85, pos: r2([siege[0] - 12, siege[1] - 7, 1.1]), poi: WK, lens: '28mm' },
  { t: RIDE, pos: r2([siege[0] - 9, siege[1] - 5, 1.1]), poi: WK, lens: '28mm', ease: 'easy ease' },
].map((k) => ({ ...k, t: k.t * SCALE })) }], shots: [{ name: 'lift-down', camera: 'lift', span: [0, RIDE * SCALE], on: 'lift:down' }] };
const mission = {
  items: [
    { id: 'intel-manifest', name: M.items['intel-manifest'].reads, at: r2(mid(R['flight-ops'])) },
    { id: 'lift-key', name: M.items['lift-key'].reads, at: r2(mid(R[parts])) },
    { id: 'intel-siege', name: M.items['intel-siege'].reads, at: r2([siege[0] - 7, siege[1] + 5, siege[2]]) },
  ],
  clues: [
    { id: 'pad', name: M.clues.pad.reads, at: r2([lift.a[0], LA.rect[1] - 1.6, lift.a[2]]) },
    { id: 'log', name: M.clues.log.reads, at: r2(mid(R['flight-ops'], 1.6, 0)) },
    { id: 'tracks', name: M.clues.tracks.reads, at: r2([H.min[0] + hx * 0.7, H.min[1] + hy * 0.5, H.min[2]]) },
  ],
  reveal: { needs: M.reveal.needs, of: M.reveal.of, flag: M.reveal.flag, says: M.reveal.reads },
  ways: [
    { id: 'lift', kind: 'lift', name: 'The freight lift', a: lift.a, b: lift.b, radius: 3.2, secs: RIDE, deck: deck.id, at: 'a', face: Math.atan2(siege[1] - lift.a[1], siege[0] - lift.a[0]), shot: { b: 'lift:down' }, needs: { items: ['lift-key'], flags: [M.reveal.flag] } },
    // (the stairwell: shut from above, the way back out once the proof is in hand)
    { id: 'stairwell', kind: 'stair', name: 'The stairwell', a: r2(mid(R['core-0'], 0, -3)), b: r2(mid(R['core-1'], 0, -3)), radius: 1.6, secs: 3, needs: { items: ['intel-siege'] } },
  ],
  objectives: [
    { id: 'key', says: 'find a way into the hangar', done: 'hangar-key' },
    { id: 'brief', says: M.objectives.brief.reads, done: 'intel-manifest' },
    { id: 'true', says: M.objectives.true.reads, after: M.reveal.flag, done: 'intel-siege' },
  ],
  // (the lobby's door: out to the yard, where the mission ends; a body that came in by it stands in the lobby)
  exits: [{ id: 'lobby-door', name: 'Out to the yard', at: r2(mid(R.lobby, 0, -2.6)), radius: 1.6, to: opt('--yard-page', 'level-1-perimeter.html'), door: 'hangar-bay-1' }],
  arrivals: { 'lobby-door': { at: start0, heading: Math.PI / 2 } },
  leave: M.result.when,
  unsure: 'something in this hangar does not add up: look around',
};
const start = start0;
// the guards: two on the main hall's floor, one below, each the yard's guard on a round of its own
const g0 = room.manifest.entities.find((e) => e.id === 'guard-1');
const rounds = [{ id: 'guard-1', at: [H.min[0] + 4, H.min[1] + 5, H.min[2]], heading: 0 }, { id: 'guard-2', at: [H.max[0] - 5, H.max[1] - 9, H.min[2]], heading: Math.PI }, { id: 'guard-3', at: [U.min[0] + 4, U.max[1] - 5, U.min[2]], heading: 0 }];
const entities = [
  ...room.manifest.entities.filter((e) => e.id === 'hero').map((e) => ({ ...e, rule: { ...e.rule, step: 0.35, mission }, transform: { pos: start, heading: Math.PI / 2 } })),
  ...rounds.map((g) => ({ ...g0, id: g.id, transform: { pos: r2(g.at), heading: g.heading } })),
  deck,
];
const parked = [...line.map((at) => ({ vehicle: 'field walker', role: 'assault', at, heading: -Math.PI / 2 })), { vehicle: 'siege walker', at: siege, heading: Math.PI }];
console.log(`hangar: hall ${JSON.stringify({ min: r2(H.min), max: r2(H.max) })} · under ${JSON.stringify({ min: r2(U.min), max: r2(U.max) })} · lift ${JSON.stringify(lift)} · start ${start}`);
console.log(`hangar: items ${mission.items.map((i) => `${i.id}@${i.at}`).join(' ')} · clues ${mission.clues.map((i) => `${i.id}@${i.at}`).join(' ')} · stairwell ${mission.ways[1].a} ↔ ${mission.ways[1].b} · out ${mission.exits[0].at}`);
if (argv.includes('--dry')) process.exit(0);

const manifest = { ...stage, figures: room.manifest.figures, entities, fxStyle: room.manifest.fxStyle, parked, shoot };
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-1-hangar', title: `${M.name} · the hangar`, manifest }, { era: 'gen-7', live: true });
console.log(`hangar: shoot ${payload.shoot ? `${payload.shoot.cameras.length} camera, cues ${JSON.stringify((payload.shoot.cues ?? []).map((c) => c.on))}, live ${!!payload.shoot.live}` : 'NONE'}`);
const { walkers: _w, ...P } = payload;
const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: room.manifest.events, walk: false, spin: false, hud: false, manaHud: levelHud(opt('--theme', 'field-brief')), inline: true, ...(argv.includes('--capture') ? { capture: true } : {}) });
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'level-1-hangar.html');
await fs.writeFile(file, html);
console.log(`hangar: ${file} (${(html.length / 1e6).toFixed(1)} MB) · hero ${room.hero} · entities ${payload.entities.map((e) => e.id).join(', ')} · colliders ${payload.colliders.length}`);
process.exit(0);
