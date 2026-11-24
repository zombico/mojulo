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
 *                      by the hero's blows (BOSS_HP of them); its fall gives what the boss gives and breaks its seal
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
import { isCastle, layCastle, castleLaws } from './castle.js';
import { greyboxOf, FLOOR, boxCameraOf } from './rooms.js';
import { solveBox } from './solve.js';
import { boxLaws } from './laws.js';
import { GATES, readHero } from './gates.js';
import { BOX_THEMES, themeLaws, lookOf } from './themes.js';
import { dressBox } from './dress.js';
import { mapOf, mapLaws } from './explored.js';
import { backdropLaws } from './backdrop.js';

export const BOX_SCENE_KEYS = Object.freeze(['kind', 'show', 'cube', 'seed', 'metroidvania', 'feel', 'stature', 'title', 'viewBox', 'trees']);
/** a boss stand-in's blows to fall */
export const BOSS_HP = 6;
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
  if (m.stature !== undefined && !(Number.isFinite(m.stature) && m.stature > 0.3 && m.stature < 5)) no('stature is the hero\'s height in metres (the screen is sized from it)');
  // (laid by the hero's MEASURED jump where a feel is named: its run's jump and, where its card has one, its air jump)
  const reach = m.feel === undefined ? null : reachOf(readFeel(typeof m.feel === 'string' ? { pole: m.feel, takes: true } : m.feel));
  const jump = reach ? r3(reach.moves.run.height) : undefined;
  return { words: m.metroidvania, hero: readHero({ ...(m.stature !== undefined ? { stature: m.stature } : {}), ...(jump ? { jump } : {}) }) };
}

/** The box as data: laid, built, solved, held to its laws, and what its world holds shut. */
export function boxOf(m) {
  const R = readBoxScene(Object.fromEntries(Object.entries(m).filter(([k]) => BOX_SCENE_KEYS.includes(k))));
  // (a box, or a castle of boxes joined by their connectors: castle.js, laid as one map)
  const castle = isCastle(R.words), layout = castle ? layCastle(R.words) : layBox(R.words), greybox = greyboxOf(layout, { hero: R.hero }), solved = solveBox(layout);
  // (and, dressed, its theme's: each ring unlike the last of its box, every gate standing out from its room)
  const gateRings = (d) => [...new Set([d.a, d.b].map((id) => layout.rooms.find((r) => r.id === id).ring))];
  const T = layout.theme ? BOX_THEMES[layout.theme] : null, looks = T ? layout.rings.map((r, k) => (r.look !== undefined ? T.looks[r.look] : lookOf(T, k, layout.rings.length))) : null;
  const breaks = new Set(layout.rings.filter((r, k) => k && (r.connector || layout.rings[k - 1].connector || r.box !== layout.rings[k - 1].box)).map((r) => r.i));
  const laws = [...(castle ? castleLaws(layout, { solved, greybox }) : boxLaws(layout, { solved, greybox })), ...(T ? themeLaws(layout.theme, looks, layout.doors.filter((d) => d.gate && d.gate !== 'double-jump').map((d) => ({ kind: d.gate, colour: GATES[d.gate].colour, rings: gateRings(d) })), { breaks }).map((l) => ({ ...l, id: `theme:${l.id}` })) : [])];
  const W = greybox.screen.width, H = greybox.screen.height, room = new Map(layout.rooms.map((r) => [r.id, r]));
  const floorOf = (r) => r.rect[1] * H + FLOOR, midOf = (r) => (r.rect[0] + r.rect[2] / 2) * W;
  const tokenOf = (kind, door) => (kind === 'key' ? `key:${room.get(door.a).ring}` : kind === 'boss' ? `boss:${door.a}` : `gate:${kind}`);
  const breakables = [], gates = [], relics = [], bosses = [];
  // the gates that open (a sill never does: it stays a closed part)
  for (const g of greybox.gates) {
    if (g.shape === 'sill') continue;
    const door = g.door ? layout.doors.find((d) => d.id === g.door) : null, id = g.door ? `gate-${g.door}` : `pocket-${g.pocket.replace('#', '-')}`;
    breakables.push({ id, min: [-HALF, g.s0, g.z0], max: [HALF, g.s1, g.z1] });
    gates.push({ id, kind: g.kind, opens: door ? tokenOf(g.kind, door) : `gate:${g.kind}`, ...(g.kind === 'wall-break' ? { hp: 2 } : {}) });
  }
  const rule = (power) => (power && layout.powers[power] && GATES[layout.powers[power].opens].move ? TRAVERSAL_MOVES[GATES[layout.powers[power].opens].move].rule() : null);
  for (const r of layout.rooms) {
    const z = floorOf(r), s = midOf(r);
    if (r.key) relics.push({ id: `relic-key-${r.ring}`, at: [0, r3(s), r3(z + 1)], gives: `key:${r.ring}`, name: `${layout.rings[r.ring].place}'s key`, colour: KEY });
    if (r.boss) {
      // (the stand-in toward the room's far side from the way in: clear of its hole and its door)
      const inAt = layout.doors.find((d) => d.b === r.id && d.kind !== 'shortcut'), fromRight = inAt && room.get(inAt.a).rect[0] > r.rect[0];
      const at = r.rect[0] * W + (fromRight ? 0.22 : 0.72) * r.rect[2] * W, id = `boss-${r.id}`;
      breakables.push({ id, min: [-0.9, r3(at - 1), r3(z)], max: [0.9, r3(at + 1), r3(z + 3.2)], hp: BOSS_HP });
      const R0 = rule(r.finds);
      bosses.push({ id, name: r.boss, gives: [`boss:${r.id}`, ...(r.finds ? [`gate:${layout.powers[r.finds].opens}`] : [])], ...(R0 ? { rule: R0 } : {}), ...(r.finds ? { power: layout.powers[r.finds].name ?? r.finds } : {}) });
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
  const held = { target: 'hero', gates, relics: relics.map(({ colour, ...x }) => x), bosses: bosses.map(({ power, ...b }) => (power ? { ...b, name: `${b.name} falls · ${power}` } : { ...b, name: `${b.name} falls` })), saves };
  // DRESSED in its theme where its words name one (dress.js), and held to the backdrop's craft (backdrop.js)
  const B0 = { layout, greybox, stature: R.hero.stature }, dress = layout.theme ? dressBox(B0, BOX_THEMES[layout.theme]) : null;
  if (dress) laws.push(...backdropLaws(B0, dress).map((l) => ({ ...l, id: `backdrop:${l.id}` })));
  // THE EXPLORED MAP (explored.js): the tiles walked as she stands in them (worlds/controllable/explore.js), each map room's
  // lectern showing its region's tiles, the map's own data for the page's minimap and its map (explored-view.js)
  const tilesOf = (k) => layout.rooms.filter((r) => r.ring === k).flatMap((r) => r.cells.map((q) => `${q[0]},${q[1]}`));
  laws.push(...mapLaws(layout).map((l) => ({ ...l, id: `map:${l.id}` })));
  const explored = { target: 'hero', tile: [r3(W), r3(H)], tiles: layout.rooms.flatMap((r) => r.cells.map((q) => `${q[0]},${q[1]}`)),
    maps: layout.rooms.filter((r) => r.mapRoom).map((r) => ({ room: r.id, name: layout.rings[r.ring].place, rect: [r3(r.rect[0] * W), r3((r.rect[0] + r.rect[2]) * W), r3(r.rect[1] * H), r3((r.rect[1] + r.rect[3]) * H)], reveals: tilesOf(r.ring) })),
    map: mapOf(layout) };
  return { layout, greybox, solved, laws, stature: R.hero.stature, hero: R.hero, breakables, held, relics, bosses, explored, ...(dress ? { dress } : {}) };
}

/** The `geocube` kind's `show: 'metroidvania'`. */
export function assembleBox(m, ctx = {}) {
  const B = boxOf(m), { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, faces = [];
  // DRESSED in its theme where its words name one (dress.js: its rings' stone, backs, lamps and light, the night over its
  // open rings); else the greybox, each room's back in its ring's shade
  const T = L.theme ? BOX_THEMES[L.theme] : null, D = T ? B.dress : null;
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
    // (dressed: its flames haloed and dust hanging in their light, the page's glow sprites and motes)
    ...(D ? { glow: D.glow, ...(D.motes ? { motes: D.motes } : {}) } : {}),
    cameras: [{ name: 'metroidvania', worldFraming: { cameraPosition: [r5(C.dist), r5(s0), r5(look + C.dist * C.tilt)], lookAt: [0, r5(s0), r5(look)], horizontalFov: r5(hfov) } }],
    viewBox: m.viewBox || { width: 1280, height: 720 },
    title: ctx.title || m.title || 'mojulo geocube · metroidvania',
    bg: T ? T.night.zenith : '#0c0b10',
    sky: T ? { zenith: hexRgb(T.night.zenith).map((v) => Math.round(v * 255)), horizon: hexRgb(T.night.horizon).map((v) => Math.round(v * 255)), day: 0, stars: 0, seed: 1 } : { zenith: [12, 11, 16], horizon: [26, 22, 34], day: 0, stars: 0, seed: 1 },
    pack: true,
  };
  Object.defineProperty(payload, 'metroidvania', { value: B, enumerable: false });
  return payload;
}
