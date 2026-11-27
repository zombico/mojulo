/**
 * THE BOX, BUILT — the geocube kind's `show: 'metroidvania'` (docs/metroidvania-map.md "Played"): a box's words laid
 * (box.js) and built in greybox (rooms.js) for the hero's stature and its measured jump (the feel's reach, feel/reach.js,
 * where the manifest names a feel), as the page plays it: the closed parts as blocks across the lane, each room's back
 * in its ring's shade, the gates in their colours, what is picked up, the bosses.
 *
 *   the CLOSED PARTS   every solid of the greybox a box across the lane (its face toward the camera, its top a lit edge,
 *                      its ends), and a collider; a double-jump gate's sill among them (it never opens: the second jump
 *                      clears it). A stair's ledges are stood on and never walked into: no collider, jumped up through
 *   the GATES          every other gate a BREAKABLE (its faces in its own group, `break:<id>`), held shut by the world's
 *                      held gates (worlds/controllable/held-gates.js) until what opens it is held: a grate, a cracked
 *                      wall, a lock, a boss's seal; a pocket's gate as a door's
 *   the RELICS         what is picked up, standing where it is found: a power in its relic room, a ring's key, a pocket's
 *                      prize; the double jump's taken gives its move (actions.js TRAVERSAL_MOVES)
 *   the THEME          where its words name one (themes.js), the box dressed in it (dress.js): its rings' stone and backs,
 *                      their lamps and baked light, the night over its open rings; the gates keep their colours (the play's)
 *   the SAVE ROOMS     each walked into fills the hero and is where she wakes from then on (held-gates.js)
 *   the EXPLORED MAP   the tiles she walks recorded as she stands in them, a map room's lectern showing its region's
 *                      (worlds/controllable/explore.js), drawn as a minimap and, on M, the whole map (explored.js)
 *   the BOSSES         a stand-in in each boss room until the foes join: a tall block in the boss's colour, struck down
 *                      by the hero's blows (BOSS_HP of them); its fall gives what the boss gives and breaks its seal.
 *                      `bosses: 'stood'` (a level whose foes have joined: level.js) leaves the block off: the boss is a body
 *                      of the world stood in its room (bosses.js), felled as a foe is; `bosses[k].place` says where
 *
 *   BOX_SCENE_KEYS, BOSS_HP
 *   boxOf(m)            → { layout, greybox, solved, laws, stature, held }: the box as data, its held gates' spec in `held`;
 *                       `metroidvania` a box's words or a castle's (castle.js: boxes joined by connectors, laid as one map)
 *   assembleBox(m, ctx) the `geocube` kind's `show: 'metroidvania'`: { metroidvania, feel?, stature?, seed?, trees? } → payload
 *                       (`trees` the hero's trees' runtime spec, gameworld/trees/tree.js lowerTrees, carried to the page)
 *                       (faces, colliders, breakables, heldGates, a camera at the gate), its `metroidvania` (not
 *                       enumerable) the box as data
 *
 * Pure: the same recipe makes the same bytes.
 */
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { readFeel } from '../feel/lower.js';
import { reachOf } from '../feel/reach.js';
import { TRAVERSAL_MOVES } from '../actions.js';
import { layBox } from './box.js';
import { isCastle, layCastle, castleLaws, segmentsOf } from './castle.js';
import { greyboxOf, FLOOR, boxCameraOf } from './rooms.js';
import { solveBox } from './solve.js';
import { boxLaws } from './laws.js';
import { GATES, SECRET, readHero } from './gates.js';
import { boxLookOf } from './cube.js';
import { themeLaws, lookOf } from './themes.js';
import { readGeocube, cubeMatter } from '../../era/geocube.js';
import { readMatterSpec } from '../../rupa/index.js';
import { blockMatter, resolveMatter, cutOfMatter } from '../../rupa/matter.js';
import { dressBox } from './dress.js';
import { piecesOf } from '../../playscape/destruct/breakability.js';
import { mapOf, mapLaws } from './explored.js';
import { backdropLaws } from './backdrop.js';
import { fabricLaws } from './fabric.js';

export const BOX_SCENE_KEYS = Object.freeze(['kind', 'show', 'cube', 'seed', 'metroidvania', 'feel', 'stature', 'title', 'viewBox', 'trees', 'bosses', 'destruction', 'matter', 'segment']);
/** a boss stand-in's blows to fall */
export const BOSS_HP = 6;
/** a stood boss keeps this far from its room's walls (its doorways): it never follows her out */
const CLEAR_WALL = 2.5;
/** a boss room's bar, how deep into the room from its doorway */
const SHUT_DEEP = 0.5;
const HALF = 1.5, BACK = -3, LIT = 0.14, RELIC = 0.5;
const SOLID = '#8d8a84', EDGE = '#d9d5cb', LEDGE = '#c4c0b6', BOSS = '#b0353a', KEY = '#e8c547', PRIZE = '#f3efe6';
const RING_BACK = ['#3a4150', '#3d3650', '#4a3540', '#552c30', '#4a2638'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`geocube metroidvania: ${m}`); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const FACE = { top: [0, 0, 1], px: [1, 0, 0], ny: [0, -1, 0], py: [0, 1, 0] };
const quad = (out, corners, n, fill, group) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group });
};
const face = (out, x, s0, s1, z0, z1, fill, group) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) quad(out, [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], FACE.px, fill, group); };
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k)));
/** a block across the lane: its face, its lit top edge, its top and its ends */
function block(out, h, s0, s1, z0, z1, fill, edge, group) {
  face(out, h, s0, s1, z0, Math.max(z0, z1 - LIT), fill, group);
  face(out, h, s0, s1, Math.max(z0, z1 - LIT), z1, edge, group);
  quad(out, [[-h, s0, z1], [h, s0, z1], [h, s1, z1], [-h, s1, z1]], FACE.top, edge, group);
  for (const [s, n] of [[s0, FACE.ny], [s1, FACE.py]]) quad(out, [[-h, s, z0], [h, s, z0], [h, s, z1], [-h, s, z1]], n, shade(fill, 0.78), group);
}

/** The manifest read: the box's words, the hero's stature and its measured jump. */
function readBoxScene(m) {
  if (!isObj(m)) no('a box is { kind: \'geocube\', show: \'metroidvania\', metroidvania: { box, powers, rings }, feel?, stature? }');
  for (const k of Object.keys(m)) if (!BOX_SCENE_KEYS.includes(k)) no(`${k} is not a box's word (${BOX_SCENE_KEYS.join(', ')})`);
  if (m.metroidvania === undefined) no('metroidvania is the box\'s words: { box: [cols, rows], powers, rings }');
  if (m.bosses !== undefined && m.bosses !== 'stood') no('bosses is \'stood\' (each boss a body of the world the level stands in its room) or absent (a stand-in block)');
  if (m.stature !== undefined && !(Number.isFinite(m.stature) && m.stature > 0.3 && m.stature < 5)) no('stature is the hero\'s height in metres (the screen is sized from it)');
  // (laid by the hero's MEASURED jump where a feel is named: its run's jump and, where its card has one, its air jump)
  const reach = m.feel === undefined ? null : reachOf(readFeel(typeof m.feel === 'string' ? { pole: m.feel, takes: true } : m.feel));
  const jump = reach ? r3(reach.moves.run.height) : undefined;
  if (m.segment !== undefined && !(isCastle(m.metroidvania) && typeof m.segment === 'string')) no('segment is one of a castle\'s boxes, its map (castle.js segmentsOf): a castle\'s words alone are cut');
  return { words: m.metroidvania, stood: m.bosses === 'stood', ...(m.segment !== undefined ? { segment: m.segment } : {}), hero: readHero({ ...(m.stature !== undefined ? { stature: m.stature } : {}), ...(jump ? { jump } : {}) }) };
}

/** What a box's secret walls are under destructible physics: its cube's wall matter (cubeMatter, stone where it says
 * none), and the world's blows (its level's `matter`: a swing's joules and the power, SECRET.power unsaid). */
export function secretMatterOf(m) {
  const wall = (() => { try { return m.cube !== undefined ? cubeMatter(readGeocube(m.cube)).wall?.matter : null; } catch { return null; } })() || 'stone';
  const spec = readMatterSpec(m.matter ?? { power: SECRET.power }, 'matter');
  return { matter: wall, swing: spec.swing ?? 300, power: spec.power ?? 1 };
}
/** A secret wall's matter: its stone, as thin a facing over its hollow as breaks in SECRET.blows at the world's power. */
export function secretMatter(b, W) {
  // (a hair under its blows, so the last one always takes it: a fill is rounded where it is minted)
  const want = SECRET.blows * W.swing * W.power * 0.97, whole = blockMatter(b, { matter: W.matter, fill: 1 }, 'secret.matter');
  const fill = Math.min(1, want / whole.joules);
  return { ...blockMatter(b, { matter: W.matter, fill }, 'secret.matter'), cut: cutOfMatter(resolveMatter(W.matter)) };
}

/** The box as data: laid, built, solved, held to its laws, and what its world holds shut. */
export function boxOf(m) {
  const R = readBoxScene(Object.fromEntries(Object.entries(m).filter(([k]) => BOX_SCENE_KEYS.includes(k)))), stood = R.stood;
  // (a box, or a castle of boxes joined by their connectors: castle.js, laid as one map)
  const castle = isCastle(R.words), layout = castle ? layCastle(R.words) : layBox(R.words), greybox = greyboxOf(layout, { hero: R.hero }), solved = solveBox(layout);
  // (a castle's SEGMENT: one map of it, its box and the connector out of it, laid in the castle whole and cut to it as
  // it is built, castle.js segmentsOf; its laws the castle's, whole)
  const segment = R.segment !== undefined ? segmentsOf(layout).find((g) => g.id === R.segment) : null;
  if (R.segment !== undefined && !segment) no(`segment '${R.segment}' is none of the castle's (${segmentsOf(layout).map((g) => g.id).join(', ')})`);
  // (its LOOK: its words' theme, else its cube's box, else the greybox: cube.js)
  const look = boxLookOf(layout, m.cube), T = look?.theme ?? null;
  // (and, dressed, its theme's: each ring unlike the last of its box, every gate standing out from its room; a ring's look
  // its words name, a castle's, else its place among the box's rings)
  const gateRings = (d) => [...new Set([d.a, d.b].map((id) => layout.rooms.find((r) => r.id === id).ring))];
  const looks = T ? layout.rings.map((r, k) => (r.look !== undefined ? T.looks[r.look] : lookOf(T, k, layout.rings.length))) : null;
  const breaks = new Set(layout.rings.filter((r, k) => k && (r.connector || layout.rings[k - 1].connector || r.box !== layout.rings[k - 1].box)).map((r) => r.i));
  const laws = [...(castle ? castleLaws(layout, { solved, greybox }) : boxLaws(layout, { solved, greybox })), ...(T ? themeLaws(T, looks, layout.doors.filter((d) => d.gate && d.gate !== 'double-jump').map((d) => ({ kind: d.gate, colour: GATES[d.gate].colour, rings: gateRings(d) })), { breaks }).map((l) => ({ ...l, id: `theme:${l.id}` })) : [])];
  const W = greybox.screen.width, H = greybox.screen.height, room = new Map(layout.rooms.map((r) => [r.id, r]));
  const floorOf = (r) => r.rect[1] * H + FLOOR, midOf = (r) => (r.rect[0] + r.rect[2] / 2) * W;
  const tokenOf = (kind, door) => (kind === 'key' ? `key:${room.get(door.a).ring}` : kind === 'boss' ? `boss:${door.a}` : `gate:${kind}`);
  const breakables = [], gates = [], relics = [], bosses = [];
  // the gates that open (a sill never does: it stays a closed part)
  // (a SECRET wall: a breakable none of the held gates holds, found by blows; under destructible physics its room's own
  // wall matter, its fill set so its joules are its blows at the world's power: secretMatter)
  const secrets = [], physical = m.destruction === 'physical', wallMatter = physical ? secretMatterOf(m) : null;
  for (const g of greybox.gates) {
    if (g.shape === 'sill') continue;
    const door = g.door ? layout.doors.find((d) => d.id === g.door) : null, id = g.door ? `gate-${g.door}` : `pocket-${g.pocket.replace('#', '-')}`;
    if (GATES[g.kind].by === 'blows') {
      const b = { id, min: [-HALF, g.s0, g.z0], max: [HALF, g.s1, g.z1], hp: SECRET.blows };
      breakables.push(wallMatter ? { ...b, ...secretMatter(b, wallMatter) } : b);
      secrets.push({ id, room: g.pocket.split('#')[0] });
      continue;
    }
    breakables.push({ id, min: [-HALF, g.s0, g.z0], max: [HALF, g.s1, g.z1] });
    gates.push({ id, kind: g.kind, opens: door ? tokenOf(g.kind, door) : `gate:${g.kind}`, ...(g.kind === 'wall-break' ? { hp: 2 } : {}) });
  }
  // (a stood boss's room SHUT behind her while it stands: a bar across each of its doorways, a grate over each hole in
  // its floor and its ceiling; held-gates.js lays them as she comes in and lifts them as it falls)
  const shutOf = (r) => {
    const s0 = r.rect[0] * W, s1 = (r.rect[0] + r.rect[2]) * W, z0 = r.rect[1] * H, z1 = (r.rect[1] + r.rect[3]) * H;
    const ways = greybox.doorways.filter((d) => d.s >= s0 - 0.5 && d.s <= s1 + 0.5 && d.z0 >= z0 - 0.5 && d.z0 <= z1)
      .map((d) => { const k = d.s < (s0 + s1) / 2 ? 1 : -1; return { min: [-HALF, r3(Math.min(d.s, d.s + k * SHUT_DEEP)), r3(d.z0)], max: [HALF, r3(Math.max(d.s, d.s + k * SHUT_DEEP)), r3(d.z1)], is: 'bar' }; });
    const holes = greybox.holes.filter((q) => q.s1 > s0 && q.s0 < s1 && (Math.abs(q.z - z0) < 1e-3 || Math.abs(q.z - z1) < 1e-3))
      .map((q) => ({ min: [-HALF, r3(q.s0), r3(q.z)], max: [HALF, r3(q.s1), r3(q.z + FLOOR)], is: 'grate' }));
    return [...ways, ...holes];
  };
  const rule = (power) => (power && layout.powers[power] && GATES[layout.powers[power].opens].move ? TRAVERSAL_MOVES[GATES[layout.powers[power].opens].move].rule() : null);
  for (const r of layout.rooms) {
    const z = floorOf(r), s = midOf(r);
    if (r.key) relics.push({ id: `relic-key-${r.ring}`, at: [0, r3(s), r3(z + 1)], gives: `key:${r.ring}`, name: `${layout.rings[r.ring].place}'s key`, colour: KEY });
    if (r.boss) {
      // (the stand-in toward the room's far side from the way in: clear of its hole and its door)
      const inAt = layout.doors.find((d) => d.b === r.id && d.kind !== 'shortcut'), fromRight = inAt && room.get(inAt.a).rect[0] > r.rect[0];
      const at = r.rect[0] * W + (fromRight ? 0.22 : 0.72) * r.rect[2] * W, id = `boss-${r.id}`;
      // (STOOD, `bosses: 'stood'`: the boss a body of the world, a foe at the boss's rank the level stands there, level.js;
      // its fall felled as the entity's: held-gates.js `entity`. Else its stand-in block, struck down)
      const R0 = rule(r.finds), span = [r3(r.rect[0] * W + CLEAR_WALL), r3((r.rect[0] + r.rect[2]) * W - CLEAR_WALL)];
      if (!stood) breakables.push({ id, min: [-0.9, r3(at - 1), r3(z)], max: [0.9, r3(at + 1), r3(z + 3.2)], hp: BOSS_HP });
      bosses.push({ id, name: r.boss, gives: [`boss:${r.id}`, ...(r.finds ? [`gate:${layout.powers[r.finds].opens}`] : [])], ...(R0 ? { rule: R0 } : {}), ...(r.finds ? { power: layout.powers[r.finds].name ?? r.finds } : {}),
        ...(stood ? { entity: id, title: r.boss.replace(/^the\s+/i, (t) => t[0].toUpperCase() + t.slice(1)), room: [r3(r.rect[0] * W), r3((r.rect[0] + r.rect[2]) * W), r3(r.rect[1] * H), r3((r.rect[1] + r.rect[3]) * H)], shut: shutOf(r) } : {}),
        place: { room: r.id, at: [0, r3(at), r3(z)], heading: r3(fromRight ? Math.PI / 2 : -Math.PI / 2), span } });
    } else if (r.finds) {
      const R0 = rule(r.finds);
      relics.push({ id: `relic-${r.id}`, at: [0, r3(s), r3(z + 1)], gives: `gate:${layout.powers[r.finds].opens}`, name: layout.powers[r.finds].name ?? r.finds, ...(R0 ? { rule: R0 } : {}), colour: GATES[layout.powers[r.finds].opens].colour });
    }
  }
  greybox.pockets.forEach((p) => {
    const k = layout.rooms.find((r) => r.id === p.room).pockets.findIndex((q) => q.holds === p.holds && q.gate === p.gate);
    relics.push({ id: `prize-${p.room}-${k}`, at: [0, r3(p.at[0] + (p.gate === 'double-jump' ? 0 : 0.3)), r3(p.at[1] + 0.9)], gives: `prize:${p.room}:${k}`, name: p.holds, colour: PRIZE });
  });
  // (a boss's fall is its seal's opener; and its stand-in's id the seal's boss)
  // (its save rooms: walked into, the hero is full and wakes there; the gate room first, where she wakes before any)
  const saves = layout.rooms.filter((r) => r.save).sort((a, b) => a.walk - b.walk).map((r) => ({ id: r.id, name: layout.rings[r.ring].place, rect: [r3(r.rect[0] * W), r3((r.rect[0] + r.rect[2]) * W), r3(r.rect[1] * H), r3((r.rect[1] + r.rect[3]) * H)], at: [r3(midOf(r)), r3(floorOf(r))] }));
  const held = { target: 'hero', gates, relics: relics.map(({ colour, ...x }) => x), bosses: bosses.map(({ power, place: _p, ...b }) => (power ? { ...b, name: `${b.name} falls · ${power}` } : { ...b, name: `${b.name} falls` })), saves };
  // DRESSED in its theme where its words name one (dress.js), and held to the backdrop's craft (backdrop.js)
  const B0 = { layout, greybox, stature: R.hero.stature }, dress = look ? dressBox(B0, look.theme) : null;
  if (dress) laws.push(...backdropLaws(B0, dress).map((l) => ({ ...l, id: `backdrop:${l.id}` })), ...fabricLaws(B0, dress.fabric).map((l) => ({ ...l, id: `fabric:${l.id}` })));
  // (its secret walls: each breaks in its blows, counted, or by its joules at the world's power under physics)
  if (secrets.length) {
    // (by its matter, it falls on exactly its last blow: more than the blows before it hold, no more than all of them)
    const off = breakables.filter((b) => secrets.some((x) => x.id === b.id)).filter((b) => { if (!b.joules) return b.hp !== SECRET.blows; const n = b.joules / (wallMatter.swing * wallMatter.power); return !(n > SECRET.blows - 1 && n <= SECRET.blows); });
    laws.push({ id: 'secrets', holds: !off.length, says: off.length ? `secret walls off their ${SECRET.blows} blows: ${off.map((b) => b.id).join(', ')}` : `${secrets.length} secret wall${secrets.length === 1 ? '' : 's'}, each broken in ${SECRET.blows} blows${wallMatter ? ` as ${wallMatter.matter}, by its matter` : ', counted'}` });
  }
  // THE EXPLORED MAP (explored.js): the tiles walked as she stands in them (worlds/controllable/explore.js), each map room's
  // lectern showing its region's tiles, the map's own data for the page's minimap and its map (explored-view.js)
  const tilesOf = (k) => layout.rooms.filter((r) => r.ring === k).flatMap((r) => r.cells.map((q) => `${q[0]},${q[1]}`));
  laws.push(...mapLaws(layout).map((l) => ({ ...l, id: `map:${l.id}` })));
  const explored = { target: 'hero', tile: [r3(W), r3(H)], tiles: layout.rooms.flatMap((r) => r.cells.map((q) => `${q[0]},${q[1]}`)),
    maps: layout.rooms.filter((r) => r.mapRoom).map((r) => ({ room: r.id, name: layout.rings[r.ring].place, rect: [r3(r.rect[0] * W), r3((r.rect[0] + r.rect[2]) * W), r3(r.rect[1] * H), r3((r.rect[1] + r.rect[3]) * H)], reveals: tilesOf(r.ring) })),
    map: mapOf(layout) };
  return { layout, greybox, solved, laws, stature: R.hero.stature, hero: R.hero, breakables, held, relics, bosses, secrets, explored, ...(segment ? { segment } : {}), ...(physical ? { physical: true } : {}), ...(look ? { look } : {}), ...(dress ? { dress } : {}) };
}

/** The `geocube` kind's `show: 'metroidvania'`. */
export function assembleBox(m, ctx = {}) {
  const B = boxOf(m), { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, faces = [];
  // DRESSED in its theme where its words name one (dress.js: its rings' stone, backs, lamps and light, the night over its
  // open rings); else the greybox, each room's back in its ring's shade
  const T = B.look ? B.look.theme : null, D = T ? B.dress : null;
  if (D) faces.push(...D.faces);
  // (each MAP ROOM's lectern: a stand and an open book glowing, behind the lane in its room's middle, its region's tiles
  // shown as she walks in: explore.js)
  const glowFaces = [];
  for (const r of L.rooms.filter((x) => x.mapRoom)) {
    const s = (r.rect[0] + r.rect[2] / 2) * W + 2.2, z = r.rect[1] * H + FLOOR, x = -1.2;
    face(faces, x, s - 0.08, s + 0.08, z, z + 0.95, '#4a3a2c', 'box:lectern');
    face(faces, x, s - 0.32, s + 0.32, z, z + 0.08, '#3a2c22', 'box:lectern');
    face(faces, x + 0.01, s - 0.42, s + 0.42, z + 0.95, z + 1.12, '#6a5238', 'box:lectern');
    face(glowFaces, x + 0.02, s - 0.36, s + 0.36, z + 1.08, z + 1.2, '#9fe8e0', 'box:flame');
  }
  if (glowFaces.length) faces.push(...glowFaces.map((f) => ({ ...f, glow: '0 0 6px 2px #7fe0d8' })));
  for (const r of T ? [] : L.rooms) {
    const [c, rr, w, h] = r.rect, base = RING_BACK[r.ring % RING_BACK.length];
    face(faces, BACK, c * W, (c + w) * W, rr * H, (rr + h) * H, base, 'box:back');
    for (let k = 0; k < w; k++) face(faces, BACK + 0.01, (c + k) * W + 0.4, (c + k) * W + 0.7, rr * H, (rr + h) * H, shade(base, 0.82), 'box:back');   // (a pillar a cell: the screens counted on the wall)
  }
  // the closed parts, a sill among them
  if (!T) for (const s of G.solids) block(faces, HALF, s.s0, s.s1, s.z0, s.z1, s.role === 'ledge' || s.role === 'lip' ? LEDGE : SOLID, EDGE, s.role === 'ledge' || s.role === 'lip' ? 'box:ledge' : 'box:solid');
  const sills = G.gates.filter((g) => g.shape === 'sill');
  for (const g of sills) block(faces, HALF, g.s0, g.s1, g.z0, g.z1, GATES[g.kind].colour, shade(GATES[g.kind].colour, 1.2), 'box:sill');
  // the gates that open, each its own group
  for (const b of B.breakables) {
    // (a secret wall drawn as its room's wall: its stone, a course or two, one crack only the eye that looks will see)
    const sec = B.secrets.find((x) => x.id === b.id);
    if (sec) {
      // (in a dressed box, the alcove's own back wall copied across to stand in its mouth: the same blocks, mortar and
      // baked light, so nothing tells it from the wall but the blow; the band above it, by the alcove's roof, the wall's
      // own colour; in the greybox, a solid's block)
      const g = `break:${b.id}`, mine = [], back = D ? G.solids.find((x) => x.room === sec.room && x.role === 'niche' && x.z0 <= b.min[2] + 1e-3 && x.s0 > b.max[1] + 2) : null;
      const twin = back ? D.faces.filter((f) => (f.group === 'box:stone' || f.group === 'box:mortar') && f.corners.every((q) => q[1] >= back.s0 - 0.02 && q[1] <= back.s1 + 0.02 && q[2] >= back.z0 - 0.02 && q[2] <= back.z1 + 0.02)) : [];
      if (twin.length) {
        const ds = b.min[1] - back.s0;
        for (const f of twin) mine.push({ ...f, corners: f.corners.map((q) => [q[0], r5(q[1] + ds), q[2]]), group: g, node: b.id });
        const avg = rgbHex([0, 1, 2].map((k) => twin.reduce((a, f) => a + hexRgb(f.fill)[k], 0) / twin.length));
        if (b.max[2] > back.z1 + 1e-3) face(mine, HALF + 0.008, b.min[1], b.max[1], back.z1, b.max[2], avg, g);
      } else block(mine, b.max[0], b.min[1], b.max[1], b.min[2], b.max[2], SOLID, EDGE, g);
      for (const f of mine) faces.push({ ...f, node: b.id });
      continue;
    }
    const g = B.held.gates.find((x) => x.id === b.id), boss = !g;
    const fill = boss ? BOSS : GATES[g.kind].colour;
    block(faces, b.max[0], b.min[1], b.max[1], b.min[2], b.max[2], fill, shade(fill, 1.25), `break:${b.id}`);
    if (g && GATES[g.kind].shape === 'grate') for (let y = b.min[1] + 0.3; y < b.max[1] - 0.1; y += 0.5) face(faces, HALF + 0.02, y, y + 0.12, b.min[2], b.max[2], '#1c1428', `break:${b.id}`);
    if (g && GATES[g.kind].shape === 'cracked') face(faces, HALF + 0.02, (b.min[1] + b.max[1]) / 2 - 0.08, (b.min[1] + b.max[1]) / 2 + 0.08, b.min[2], b.max[2], '#2a1608', `break:${b.id}`);
    if (boss) face(faces, b.max[0] + 0.02, b.min[1] + 0.45, b.max[1] - 0.45, b.max[2] - 1.0, b.max[2] - 0.7, '#ffd36b', `break:${b.id}`);   // (its eyes: a lit band)
  }
  // the relics: a small block standing where each is found
  for (const x of B.relics) block(faces, RELIC / 2, x.at[1] - RELIC / 2, x.at[1] + RELIC / 2, x.at[2] - RELIC / 2, x.at[2] + RELIC / 2, x.colour, shade(x.colour, 1.25), `break:${x.id}`);
  // the camera at the gate, framed as the side map frames the hero
  const C = boxCameraOf(B.stature), first = L.rooms[0], s0 = first.rect[0] * W + W / 2, look = first.rect[1] * H + FLOOR + C.lookH;
  const hfov = (2 * Math.atan(Math.tan((C.vfov * Math.PI) / 360) * (W / H)) * 180) / Math.PI;
  // (a stair's ledges and lips are stood on, never walked into: faces with no collider, jumped up through from under them)
  const colliders = [...G.solids.filter((s) => s.role !== 'ledge' && s.role !== 'lip'), ...sills].map((s) => ({ min: [-HALF, s.s0, s.z0], max: [HALF, s.s1, s.z1] }));
  const payload = {
    faces, lights: [], colliders, breakables: B.breakables, heldGates: B.held, explored: B.explored, ...(m.trees ? { trees: m.trees } : {}),
    // (a secret wall pre-cut as a block is, so the page throws its pieces as it breaks: its stone, its colour)
    ...(B.secrets.length ? { breakPieces: piecesOf(B.breakables.filter((b) => B.secrets.some((x) => x.id === b.id)), faces) } : {}),
    // (dressed: its flames haloed and dust hanging in their light, the page's glow sprites and motes)
    // (its flames alive and its backdrop moving: the page's flames and ambient channels)
    ...(D ? { glow: D.glow, ...(D.motes ? { motes: D.motes } : {}), ...(D.live ? { flames: D.live } : {}), ...(D.ambient ? { ambient: D.ambient } : {}) } : {}),
    cameras: [{ name: 'metroidvania', worldFraming: { cameraPosition: [r5(C.dist), r5(s0), r5(look + C.dist * C.tilt)], lookAt: [0, r5(s0), r5(look)], horizontalFov: r5(hfov) } }],
    viewBox: m.viewBox || { width: 1280, height: 720 },
    title: ctx.title || m.title || 'mojulo geocube · metroidvania',
    bg: T ? T.night.zenith : '#0c0b10',
    sky: T ? { zenith: hexRgb(T.night.zenith).map((v) => Math.round(v * 255)), horizon: hexRgb(T.night.horizon).map((v) => Math.round(v * 255)), day: 0, stars: 0, seed: 1 } : { zenith: [12, 11, 16], horizon: [26, 22, 34], day: 0, stars: 0, seed: 1 },
    pack: true,
  };
  const P = B.segment ? cutToSegment(payload, B) : payload;
  Object.defineProperty(P, 'metroidvania', { value: B, enumerable: false });
  return P;
}

/**
 * A castle's SEGMENT on its page (castle.js segmentsOf): the castle built whole, what the page carries cut to the
 * segment's columns: its faces, its solids, its gates, relics, saves and bosses, its flames and motes. What lies beyond
 * its exits is the next segment's page. Its explored map stays the castle's whole.
 */
export function cutToSegment(P, B) {
  const g = B.segment, W = B.greybox.screen.width, s0 = g.cols[0] * W, s1 = (g.cols[1] + 1) * W, rooms = new Set(g.rooms);
  const over = (a, b) => b >= s0 - 1e-6 && a <= s1 + 1e-6, inside = (s) => s >= s0 - 1e-6 && s <= s1 + 1e-6;
  const faceIn = (f) => { const ss = f.corners.map((q) => q[1]); return over(Math.min(...ss), Math.max(...ss)); };
  const breakables = P.breakables.filter((b) => over(b.min[1], b.max[1])), kept = new Set(breakables.map((b) => b.id));
  const doorIn = (id) => { const d = B.layout.doors.find((x) => `gate-${x.id}` === id); return d ? rooms.has(d.a) || rooms.has(d.b) : true; };
  const H = P.heldGates;
  const heldGates = { ...H, gates: H.gates.filter((x) => kept.has(x.id) || (!P.breakables.some((b) => b.id === x.id) && doorIn(x.id))),
    relics: H.relics.filter((x) => inside(x.at[1])), bosses: H.bosses.filter((x) => rooms.has(x.id.replace(/^boss-/, ''))),
    saves: H.saves.filter((x) => rooms.has(x.id)) };
  // (what is found beyond the segment, so a gain carried in holds and does what it does here: the journey, held-gates.js)
  const away = [...H.relics.filter((x) => !heldGates.relics.includes(x)).map((x) => ({ id: x.id, gives: [x.gives], ...(x.rule ? { rule: x.rule } : {}) })),
    ...H.bosses.filter((x) => !heldGates.bosses.includes(x)).map((x) => ({ id: x.id, gives: [...(x.gives || [])], ...(x.rule ? { rule: x.rule } : {}) }))];
  if (away.length) heldGates.elsewhere = away;
  return { ...P, faces: P.faces.filter(faceIn), colliders: P.colliders.filter((c) => over(c.min[1], c.max[1])), breakables, heldGates,
    ...(P.breakPieces ? { breakPieces: { ...P.breakPieces, breakables: P.breakPieces.breakables.filter((b) => kept.has(b.id)) } } : {}),
    ...(P.flames ? { flames: P.flames.filter((x) => inside(x.at[1])) } : {}),
    ...(P.motes ? { motes: { ...P.motes, boxes: P.motes.boxes.filter((q) => over(q[1], q[4])) } } : {}),
    segment: { id: g.id, cols: [...g.cols] } };
}
