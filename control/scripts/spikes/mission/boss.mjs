#!/usr/bin/env node
/**
 * A BOSS FIGHT, PLAYED — a boss off the shelf (lib/graph/boss/: a human boss's gimmick, moves and phases; a vehicle's
 * parts, states and the mechanics that win it) stood in an arena laid for what it wants, the operative carrying the kit
 * it is beaten with, on the controllable world (worlds/controllable/boss.js directs it, mines.js lays the mines; the page
 * draws each move's marks on the floor before it lands and the boss's bar, boss-view.js, mana-hud.js).
 *
 *   cd control
 *   node scripts/spikes/mission/boss.mjs --boss <cinder|glint|breaker|lineman|tank|gunship|walker|siege-walker|brood-walker> --out /abs/dir [--cdn]
 *   node scripts/spikes/mission/boss.mjs --boss <id> --plan     the boss's laws, and its arena's
 *   --guard <ref>                the boss's figure, a character minted in the database (MOJULO_DATA_DIR)
 *   --look <look>=<ref>          the figure one of its looks wears (a phase's `look`: Cinder's `cracked`), repeatable
 *
 * The arenas: a hall of low walls (Cinder: the arc broken by them), of tall cover and perches (Glint), of pillars it
 * tears out (Breaker), of tiles (Lineman); a yard with a block the tank drives round (mines in the kit), a field lined
 * with hard cover under the gunship's runs (a launcher in the kit), a pillared yard for the walker (a launcher); the test
 * apron behind the hangar for the siege walker (barriers and containers against its barrage, its round to mine; mines
 * and a carbine), and the drone yard for the brood walker (roofed shelters against its drones' drops, three pallets of
 * packages; the dart for its gunners, a pistol for its drones, the RF gun to hack a courier). A mecha boss is drawn as its
 * frame (gameworld/combat/boss-figures.js), its figures laid on the page as the frame packs them. `--tank` starts the
 * siege walker folded (its tank phase alone). The hangar's hall opens onto the siege walker's apron (hangar.mjs).
 */
import { register } from 'node:module';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { options, database, starterRoom, writePage, boxFaces } = await import('./lib.mjs');
const o = options(process.argv.slice(2));
database(o.opt('--hero'), o.opt('--guard'));
const { BOSSES, bossLaws } = await import('../../../lib/graph/boss/bosses.js');
const { VEHICLES, vehicleLaws } = await import('../../../lib/graph/boss/vehicles.js');
const { bossRule, bossMind, vehicleEntity, carrierEntities } = await import('../../../lib/graph/boss/stand.js');
const id = o.opt('--boss', 'cinder'), human = !!BOSSES[id], vehicle = !!VEHICLES[id];
if (!human && !vehicle) { console.error(`boss: '${id}' is one of ${[...Object.keys(BOSSES), ...Object.keys(VEHICLES)].join(', ')}`); process.exit(1); }

// THE ARENA: a floor, its walls, its cover (each a box: drawn, a collider, and named so a tear can take it)
const R = (n) => Math.round(n * 1000) / 1000;
const ARENAS = {
  cinder: { size: [40, 40], floor: '#5a5650', cover: [...[-12, -4, 4, 12].flatMap((x) => [[x, -6, 3, 0.6, 1.1], [x, 6, 3, 0.6, 1.1]]), [-14, 12, 1.2, 1.2, 1], [14, -12, 1.2, 1.2, 1]], fill: '#7d7468' },
  // (Glint's: a loading yard, tall cover between three gantry decks he locks from, each 1.8 m up on four legs; low enough
  // that a stun landing out in front of one sees his eyes, high enough to want climbing)
  glint: { size: [56, 36], floor: '#55595a', cover: [[-16, -8, 2.4, 2.4, 2.6], [-6, 6, 2.4, 2.4, 2.6], [4, -6, 4, 1, 2.2], [14, 8, 2.4, 2.4, 2.6], [-2, -12, 6, 1, 2.2], [16, -4, 2, 2, 2.6]], fill: '#6f7477', perches: [[23, 12, 1.8], [23, -12, 1.8], [8, 14, 1.8]], deck: '#8a6f3c' },
  breaker: { size: [44, 44], floor: '#5b5752', cover: [[-10, -10], [10, -10], [-10, 10], [10, 10], [0, -16], [0, 16], [-16, 0], [16, 0]].map(([x, y]) => [x, y, 1.6, 1.6, 4]), fill: '#8a8278' },
  lineman: { size: [42, 42], floor: '#4a5056', tiles: 3, cover: [[-9, -9, 1.6, 1.6, 1.4], [9, 9, 1.6, 1.6, 1.4], [-9, 9, 1.6, 1.6, 1.4], [9, -9, 1.6, 1.6, 1.4]], fill: '#3f4e3f' },
  tank: { size: [90, 64], floor: '#5d5a4f', cover: [[0, 0, 22, 14, 6], [-30, -22, 3, 1, 1.2], [30, 22, 3, 1, 1.2], [-30, 22, 2.4, 2.4, 2.6], [30, -22, 2.4, 2.4, 2.6]], fill: '#7a7466', route: [[-26, -16], [26, -16], [26, 16], [-26, 16]] },
  gunship: { size: [120, 60], floor: '#56604d', cover: [-40, -24, -8, 8, 24, 40].flatMap((x, k) => [[x, k % 2 ? 4 : -4, 4, 1, 2.2]]).concat([[-20, 14, 6, 2.4, 2.6], [20, -14, 6, 2.4, 2.6]]), fill: '#8b8b82', runs: [[-70, 0], [70, 0]] },
  // (the test apron: jersey barriers a crouch hides behind, containers a body stands behind, crates; its round past them)
  'siege-walker': { size: [92, 60], floor: '#6f7275', fill: '#8a8c88', route: [[24, 0], [8, -16], [-16, -14], [-24, 0], [-16, 14], [8, 16]],
    cover: [[-30, -7, 0.6, 5, 1.1], [-30, 7, 0.6, 5, 1.1], [-20, 0, 0.6, 6, 1.1], [-12, -13, 0.6, 5, 1.1], [-12, 13, 0.6, 5, 1.1], [-2, 0, 0.6, 4, 1.1], [8, -6, 0.6, 5, 1.1], [8, 6, 0.6, 5, 1.1],
      [-24, -20, 2.4, 6.1, 2.6], [-24, 20, 2.4, 6.1, 2.6], [-4, -22, 6.1, 2.4, 2.6], [-4, 22, 6.1, 2.4, 2.6], [32, -14, 2.4, 6.1, 2.6], [32, 14, 2.4, 6.1, 2.6], [-36, -14, 1.2, 1.2, 2.4], [-36, 14, 1.2, 1.2, 2.4]] },
  // (the drone yard: barriers and containers, roofed shelters a drone's drop does not reach under, three pallets)
  'brood-walker': { size: [92, 64], floor: '#6e7174', fill: '#8a8c88',
    cover: [[-28, -10, 0.6, 5, 1.1], [-28, 10, 0.6, 5, 1.1], [-18, -4, 0.6, 4, 1.1], [-18, 4, 0.6, 4, 1.1], [2, 24, 6, 0.6, 1.1], [2, -24, 6, 0.6, 1.1], [20, 26, 5, 0.6, 1.1], [20, -26, 5, 0.6, 1.1],
      [-22, -20, 2.4, 6.1, 2.6], [-22, 20, 2.4, 6.1, 2.6], [-4, 12, 6.1, 2.4, 2.6], [-4, -12, 6.1, 2.4, 2.6], [38, 12, 2.4, 6.1, 2.6], [38, -12, 2.4, 6.1, 2.6]],
    shelters: [[-30, 0, 5, 4], [-8, 22, 6, 4], [-8, -22, 6, 4], [30, 20, 5, 4], [30, -20, 5, 4]], packages: [[-14, 18], [-14, -18], [36, 0]], walker: [10, 0] },
  walker: { size: [64, 64], floor: '#585650', cover: [[-14, -14], [14, -14], [-14, 14], [14, 14], [0, 0]].map(([x, y]) => [x, y, 2.4, 2.4, 3.4]), fill: '#7e786e', route: [[-20, -20], [20, -20], [20, 20], [-20, 20]] },
};
const A = ARENAS[id], [AW, AD] = A.size;
const LIGHT = { sun: [-0.42, -0.55, 0.72], sky: [0.5, 0.53, 0.58], key: [0.62, 0.58, 0.52] };
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const shade = (hex, n) => { const L = Math.hypot(...LIGHT.sun), c = Math.max(0, (n[0] * LIGHT.sun[0] + n[1] * LIGHT.sun[1] + n[2] * LIGHT.sun[2]) / L); return '#' + [1, 3, 5].map((i, k) => Math.round(Math.max(0, Math.min(1, enc(lin(parseInt(hex.slice(i, i + 2), 16) / 255) * (LIGHT.sky[k] * (0.75 + 0.25 * n[2]) + LIGHT.key[k] * c) * 1.25))) * 255).toString(16).padStart(2, '0')).join(''); };
const faces = [], colliders = [], cover = [];
const put = (fs) => { for (const f of fs) { const fill = shade(f.fill, f.normal); faces.push({ ...f, fill, cornerFills: f.corners.map(() => fill) }); } };
// (the floor, in tiles where the boss works the floor's tiles)
if (A.tiles) for (let x = -AW / 2; x < AW / 2; x += A.tiles) for (let y = -AD / 2; y < AD / 2; y += A.tiles) { const k = (Math.round(x / A.tiles) + Math.round(y / A.tiles)) % 2 ? 1 : 0.86, c = '#' + [1, 3, 5].map((i) => Math.round(parseInt(A.floor.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join(''); put([{ corners: [[x, y, 0], [x + A.tiles, y, 0], [x + A.tiles, y + A.tiles, 0], [x, y + A.tiles, 0]], fill: c, normal: [0, 0, 1], outNormal: [0, 0, 1], group: 'arena:floor' }]); }
else put(boxFaces([-AW / 2, -AD / 2, -0.4], [AW / 2, AD / 2, 0], A.floor, 'arena:floor'));
// (its walls round it, a body's height and more)
for (const [mn, mx] of [[[-AW / 2 - 1, -AD / 2 - 1, 0], [AW / 2 + 1, -AD / 2, 4]], [[-AW / 2 - 1, AD / 2, 0], [AW / 2 + 1, AD / 2 + 1, 4]], [[-AW / 2 - 1, -AD / 2, 0], [-AW / 2, AD / 2, 4]], [[AW / 2, -AD / 2, 0], [AW / 2 + 1, AD / 2, 4]]]) { put(boxFaces(mn, mx, '#6b6a66', 'arena:wall')); colliders.push({ min: mn, max: mx }); }
// (the perches: a deck on four legs at each, its top where the boss stands)
for (const [x, y, z] of A.perches && A.deck ? A.perches : []) {
  const deck = [[x - 1.6, y - 1.6, z - 0.25], [x + 1.6, y + 1.6, z]];
  put(boxFaces(deck[0], deck[1], A.deck, 'arena:deck')); colliders.push({ min: deck[0], max: deck[1] });
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const mn = [x + sx * 1.45 - 0.1, y + sy * 1.45 - 0.1, 0], mx = [x + sx * 1.45 + 0.1, y + sy * 1.45 + 0.1, z - 0.25]; put(boxFaces(mn, mx, '#4b4f52', 'arena:deck')); colliders.push({ min: mn, max: mx }); }
}
// (the shelters: four posts and a roof on them, cover from what falls on a body under it)
for (const [x, y, w, d] of A.shelters || []) {
  const h = 2.6, x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2;
  for (const [px, py] of [[x0, y0], [x1 - 0.2, y0], [x0, y1 - 0.2], [x1 - 0.2, y1 - 0.2]]) { const mn = [R(px), R(py), 0], mx = [R(px + 0.2), R(py + 0.2), h]; put(boxFaces(mn, mx, '#4f5256', 'arena:shelter')); colliders.push({ min: mn, max: mx }); }
  const mn = [R(x0 - 0.3), R(y0 - 0.3), h], mx = [R(x1 + 0.3), R(y1 + 0.3), h + 0.18]; put(boxFaces(mn, mx, '#5a6a52', 'arena:shelter-roof')); colliders.push({ min: mn, max: mx });
}
A.cover.forEach(([x, y, w, d, h], k) => { const mn = [R(x - w / 2), R(y - d / 2), 0], mx = [R(x + w / 2), R(y + d / 2), h]; put(boxFaces(mn, mx, A.fill, 'arena:cover')); colliders.push({ min: mn, max: mx }); cover.push({ id: `cover-${k + 1}`, min: mn, max: mx }); });

if (o.has('--plan')) {
  const L = human ? bossLaws(id) : vehicleLaws(id);
  console.log(`${id}: ${human ? `${BOSSES[id].name}, ${BOSSES[id].title}` : VEHICLES[id].name} · arena ${AW} × ${AD} m, ${cover.length} pieces of cover`);
  for (const l of L) console.log(`  ${l.holds ? 'holds  ' : 'ADVISED'} · ${l.law}: ${l.says}`);
  process.exit(0);
}

// THE OPERATIVE AND THE BOSS
// (the kit it is beaten with: a flash counter's stun grenades)
const kitWords = human ? ['carbine', ...((BOSSES[id].counters || []).some((c) => c.takes.includes('stun')) ? ['stun'] : []), 'frag'] : id === 'tank' ? ['carbine', 'mine', 'bazooka'] : id === 'siege-walker' ? ['carbine', 'mine'] : id === 'brood-walker' ? ['dart', 'handgun'] : ['carbine', 'bazooka', 'frag'];
const G = { id: 'steel-serpents', name: 'Steel Serpents', feel: 'steel-serpents', quick: { arms: kitWords } };
const { room, hero: h0, guard: g0 } = await starterRoom(o, G);
const start = [0, -AD / 2 + 5, 0.05];
const mission = { result: { at: [0, AD / 2 + 50, 0], radius: 1, when: [] }, hints: [{ at: start, radius: 4, says: human ? `${BOSSES[id].name}, ${BOSSES[id].title}. Read the floor: every move is marked before it lands. Dive through, step out, or get behind cover.${(BOSSES[id].counters || []).map((c) => c.tip ? ` ${c.tip[0].toUpperCase()}${c.tip.slice(1)}.` : '').join('')}` : `${VEHICLES[id].name}. ${VEHICLES[id].wins.map((w) => w.says).join('. ')}.` }] };
// (the siege walker's mines: enough for both its legs and both its wheels, a few to miss with; the brood walker's RF gun,
// a slot of its own: held on a courier, it jams its link and hacks it)
let loadout = h0.rule.loadout || [];
if (id === 'siege-walker') loadout = loadout.map((sl) => (sl.weapon && sl.weapon.place ? { ...sl, weapon: { ...sl.weapon, reserve: 9 } } : sl));
if (id === 'brood-walker') { const base = loadout.find((sl) => sl.weapon && sl.weapon.stun) || loadout[0]; loadout = [...loadout, { ...base, name: 'RF gun', weapon: { fireClass: 'sight', auto: true, rof: 10, damage: 0, magazine: 999, reserve: null, reload: 0.5, range: 60, coreAngle: 2.5, assistAngle: 6, quiet: true, jam: true, spread: { base: 0, move: 0, bloom: 0, recover: 5, max: 0 }, recoil: { kick: 0, recover: 5, max: 0 } } }]; }
const hero = { ...h0, rule: { ...h0.rule, step: 0.35, mission, radarRange: 36, loadout }, body: { ...h0.body, hp: 100 }, transform: { pos: start, heading: Math.PI / 2 } };
let boss;
// (the figure each of its looks wears: the guard's figure with another character's ref)
const looks = {}, figures = { ...room.manifest.figures };
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--look') { const [look, ref] = String(process.argv[i + 1]).split('='); figures[`boss-${look}`] = { ...figures[g0.body.figure], heroRef: ref }; looks[look] = `boss-${look}`; }
if (human) {
  const arena = { center: [0, 0], r: Math.min(AW, AD) / 2, z: 0, ...(A.perches ? { perches: A.perches } : {}), cover };
  boss = { ...g0, id: 'boss', team: 'guards', rule: { ...g0.rule, foe: undefined, alarm: undefined, guardRadius: 60, standoff: 8, mind: { ...(g0.rule.mind || {}), ...bossMind(id) }, boss: bossRule(id, { arena, seed: 7, ...(Object.keys(looks).length ? { figures: looks } : {}) }) },
    body: { ...g0.body, hp: 1600 }, transform: { pos: A.perches ? [A.perches[0][0], A.perches[0][1], (A.perches[0][2] ?? 0) + 0.05] : [0, AD / 2 - 8, 0.05], heading: A.perches ? Math.PI : -Math.PI / 2 } };
  // (a marksman's only shot is his lock, told by its glint: as a sentry he holds his perch and his fire between them, his
  // reach nil; the director aims every lock)
  if (A.perches) boss.rule = { ...boss.rule, range: 0.1, guardAt: [A.perches[0][0], A.perches[0][1]] };
} else {
  const at = id === 'gunship' ? [A.runs[0][0], A.runs[0][1], 16] : A.walker ? [A.walker[0], A.walker[1], 0] : [A.route[0][0], A.route[0][1], 0];
  boss = vehicleEntity(id, { at, heading: A.walker ? Math.PI / 2 : 0, hp: id === 'siege-walker' ? 600 : id === 'brood-walker' ? 330 : 1200, ...(A.route ? { route: A.route } : {}), ...(A.runs ? { runs: A.runs } : {}), ...(A.packages ? { packages: A.packages.map(([x, y]) => ({ id: `pallet-${x}-${y}`, at: [x, y, 0] })) } : {}), seed: 7 });
  if (id === 'siege-walker' && o.has('--tank')) boss.rule.boss.start = 'tank';
}
// (a carrier's gunners, drawn as the yard's guard is, and its drones)
const riders = VEHICLES[id] && VEHICLES[id].carrier ? carrierEntities(id, { at: boss.transform.pos, heading: boss.transform.heading, crewBody: { ...g0.body, hpBar: 'none' } }) : [];
// (a mecha boss drawn as its frame: its figures, and its drones')
const bossFigs = VEHICLES[id] && VEHICLES[id].frame ? (await import('../../../lib/graph/gameworld/combat/boss-figures.js')).bossFigures(id) : {};
// (the room's cast light: its bodies drawn under one light, as a level's are; without it a made figure bakes under none)
const manifest = { kind: 'controllable', faces, colliders, entities: [hero, boss, ...riders], figures, fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade, ...(room.manifest.castLight ? { castLight: room.manifest.castLight } : {}),
  bg: '#b9c4cb', sky: { zenith: [86, 112, 138], horizon: [196, 204, 210], day: 1, stars: 0, seed: 5 } };
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { payload } = await resolveWorldScene({ ref: `steel-serpents-boss-${id}`, title: `${human ? BOSSES[id].name : VEHICLES[id].name} · Steel Serpents`, manifest }, { era: 'gen-7', live: true });
const out = path.resolve(o.opt('--out', 'boss'));
// (the mecha's figures as the frame packs them: the controllable kind would read them as a person's)
const page = await writePage({ ...payload, figures: { ...payload.figures, ...bossFigs } }, room, path.join(out, `boss-${id}.html`), { capture: o.has('--capture'), cdn: o.has('--cdn') });
console.log(`boss: ${page.file} (${page.mb} MB) · ${human ? `${BOSSES[id].name}: ${Object.keys(BOSSES[id].moves).join(', ')}` : `${VEHICLES[id].name}: ${Object.keys(VEHICLES[id].parts).join(', ')}`} · kit ${kitWords.join(', ')}`);
process.exit(0);
