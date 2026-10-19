/**
 * THE `board` WORLD KIND — a tactics board shown on the World page: its ground (the diorama its geocube paints, or the
 * cube's rooms or land under it), its spots drawn over that ground, units standing on them, and the tactical camera
 * (board-camera.js) that plays it. Not walked: the board owns the camera.
 *
 *   { kind: 'board', board?: <board-lay.js spec>, units?: [<board-kernel.js start unit>], camera?: { rotate, edge,
 *     fov, pitches, zooms, yaw }, cursor?: 'C4', battle?: <board-battle.js spec> & { players?: [sides], figures?: false },
 *     map?: <board-map.js spec>, game?, events?, play?, audio? (a level's own, lowered by the world) }
 *   map: an epoch's map (board-map.js: dots and roads), travelled from on the page (its map mode)
 *   units: tokens to look at and move freely; battle: a battle the page plays (the player moves `players`, ['party'] by
 *   default; [] lets the minds fight it out); a battle's units stand as figures (board-figures.js, by the kind's resolver)
 *   unless `figures: false`
 *
 *   boardOverWorld(payload, board) → the changes a level's own `board` makes to its payload (world-scene.js lays it)
 *   assembleBoardScene(manifest, ctx) → payload: the ground's faces (and a stage's own light and sky; a room's without
 *     its ceiling, its walls cut at the waist, no haze), `board` (the page's data: board-page.js boardChannelData), and a camera
 *     at the tactical view's rest, for a picture of it
 */
import { layBoard, spotsNamed } from './board-lay.js';
import { boardStart, boardParse, boardSpotName } from './board-kernel.js';
import { boardCameraInit, boardCameraPose } from './board-camera.js';
import { boardChannelData } from './board-page.js';
import { readBoardTd } from './board-td.js';
import { readBoardRts } from './board-rts.js';
import { rtsSides } from './board-rts-look.js';
import { readBoardBattle } from './board-battle.js';
import { layMap } from './board-map.js';

const KEYS = ['kind', 'board', 'units', 'battle', 'map', 'td', 'rts', 'camera', 'cursor', 'talk', 'title'];
// a level's own keys the world lowers beside the board (its contract, its bus, its play, its sound)
const LEVEL_KEYS = ['game', 'events', 'play', 'audio'];
const CAMERA_KEYS = ['rotate', 'edge', 'fov', 'pitches', 'zooms', 'yaw'];
const ASPECT = 1120 / 780;
const CUTAWAY = 1.5;   // metres over the floor a room's walls are cut at, seen from above (the stage's walls are banded every half metre)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`board: ${m}`); };

function readCamera(c) {
  if (c === undefined) return {};
  if (!isObj(c)) no(`camera is { ${CAMERA_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(c)) if (!CAMERA_KEYS.includes(k)) no(`camera.${k} is not a camera setting (settings: ${CAMERA_KEYS.join(', ')})`);
  for (const k of ['rotate', 'edge']) if (c[k] !== undefined && typeof c[k] !== 'boolean') no(`camera.${k} is true or false`);
  if (c.fov !== undefined && !(c.fov >= 10 && c.fov <= 60)) no('camera.fov is degrees, 10 to 60 (narrow reads close to isometric)');
  if (c.pitches !== undefined && !(Array.isArray(c.pitches) && c.pitches.length && c.pitches.every((p) => p >= 15 && p <= 80))) no('camera.pitches are degrees below the horizon, 15 to 80 each');
  if (c.zooms !== undefined && !(Array.isArray(c.zooms) && c.zooms.length && c.zooms.every((z) => z > 0.1 && z <= 2))) no('camera.zooms are shares of the distance that frames the board, over 0.1 and up to 2 each');
  if (c.yaw !== undefined && !(Number.isInteger(c.yaw) && c.yaw >= 0 && c.yaw <= 3)) no('camera.yaw is 0 to 3: which diagonal the view starts on');
  return c;
}

// the story's slots a level's own scenes fill (`when: { on: 'slot:<name>' }`): the ones the page raises
export const SLOTS = Object.freeze({ battle: ['before', 'after'], map: ['begin'] });
export function slotsOf(play) {
  const names = new Set((play?.scenes ?? []).map((sc) => sc?.when?.on).filter((on) => typeof on === 'string' && on.startsWith('slot:')).map((on) => on.slice(5)));
  return [...SLOTS.battle, ...SLOTS.map].filter((n) => names.has(n));
}

// the board's part of a page, from a laid board and what stands on it: the page's data and a camera at its rest
// how a scene is told on the board: its words over the speaker (bubble, on unless false), a portrait of them beside
function readTalk(t) {
  if (t === undefined) return null;
  if (!isObj(t)) no('talk is { bubble?, portrait? }: the words over whoever speaks (true unless false), a close portrait of them beside (false unless true)');
  for (const k of Object.keys(t)) if (!['bubble', 'portrait'].includes(k)) no(`talk.${k} is not part of it (bubble, portrait)`);
  for (const k of Object.keys(t)) if (typeof t[k] !== 'boolean') no(`talk.${k} is true or false`);
  return Object.keys(t).length ? { ...t } : null;
}

// a skirmish: the board's, and its sides (each a civilization's own words: board-rts-look.js) when it names them
function readRts(B, x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || x.sides === undefined) return readBoardRts(B, x);
  const { sides, ...rest } = x;
  return { ...readBoardRts(B, rest), sides: rtsSides(sides) };
}
function boardParts(L, { units = [], battle: b, td: d, rts: x, camera: c, cursor, play, talk: t } = {}) {
  if ([d !== undefined, x !== undefined, b !== undefined, Array.isArray(units) && units.length > 0].filter(Boolean).length > 1) no('td, rts, battle or units: a defence, a skirmish, a battle, or tokens to look at; one of them');
  // a defence or a skirmish is watched from above as a commander would: the RTS form (panning, the edge scrolling; a
  // skirmish's keys are its orders, so it does not turn), unless it says
  const camera = readCamera(c ?? (x !== undefined ? { edge: true, rotate: false } : d !== undefined ? { edge: true } : undefined)), talk = readTalk(t);
  const td = d !== undefined ? readBoardTd(L.board, d) : null, rts = x !== undefined ? readRts(L.board, x) : null;
  if (!Array.isArray(units)) no('units are [{ id, side, at: \'C4\', move?, jump?, spd?, hp?, … }]');
  if (units.length && b !== undefined) no('units or battle: tokens to look at, or a battle to play; not both');
  if (units.length) boardStart(L.board, {}, units);   // the kernel says what cannot stand, before a page is made
  let battle;
  if (b !== undefined) {
    const { players = ['party'], figures: _figures, ...spec } = b ?? {};   // figures: stood by board-figures.js
    if (!Array.isArray(players) || !players.every((x) => typeof x === 'string')) no('battle.players are the sides the player moves: [\'party\'] (or [] to watch)');
    const { cfg, units: read, deploy: names, rpg, legs, draw } = readBoardBattle(spec);
    // a drawn battle's packs: each stands in the far rows on its own (only the one drawn is fought)
    const packOf = {};
    (draw ?? []).forEach((ids, t) => { for (const id of ids) packOf[id] = t; });
    // the deploy spots, and each member without a spot put on the next free one (the player may place them again)
    let deploy, fielded = read, placed = [];
    if (names) {
      const B = L.board, taken = new Set(read.filter((u) => u.at !== undefined).map((u) => boardParse(B, u.at)));
      // a block of them keeps the spots someone can stand on (a prop, a hole or a cliff in it is passed over)
      const blocks = names === 'near' ? [`A1:${boardSpotName(B, B.cols * 2 - 1)}`] : names;
      deploy = [...new Set(blocks.flatMap((n) => spotsNamed(n, B.cols, B.rows).map(([cc, r]) => r * B.cols + cc)))].filter((i) => B.spots[i] && B.spots[i].walk);
      const free = deploy.filter((i) => !taken.has(i));
      // a foe with no spot stands in the far rows, from the middle out, on what nobody else stands on
      const mid = (B.cols - 1) / 2, far = B.spots.map((sp, i) => i).filter((i) => B.spots[i] && B.spots[i].walk && !taken.has(i) && deploy.indexOf(i) < 0)
        .sort((a, b) => Math.floor(b / B.cols) - Math.floor(a / B.cols) || Math.abs((a % B.cols) - mid) - Math.abs((b % B.cols) - mid) || a - b);
      const next = {};
      fielded = read.map((u) => {
        if (u.at !== undefined) return u;
        if (u.side === 'foe') {
          const t = packOf[u.id] ?? 0, k = next[t] = (next[t] ?? -1) + 1;
          if (k >= far.length) no('battle: no spot left for the foes to stand on');
          return { ...u, at: boardSpotName(B, far[k]) };
        }
        if (!free.length) no(`battle.deploy: ${deploy.length} spots to stand on for more of the party than fit (a cap, or more spots)`);
        placed.push(u.id);
        return { ...u, at: boardSpotName(B, free.shift()) };
      });
    }
    // a drawn battle: its units the first pack's until the battle starts, each pack able to stand
    const packs = draw ? draw.map((ids) => fielded.filter((u) => ids.includes(u.id))) : null;
    const standing = draw ? fielded.filter((u) => packOf[u.id] === undefined).concat(packs[0]) : fielded;
    for (const list of packs ? packs.map((p) => fielded.filter((u) => packOf[u.id] === undefined).concat(p)) : [fielded]) boardStart(L.board, cfg, list);
    // the party battles' book and each class's legs ride along, so a game's party can be stood as the store has it
    battle = { cfg, units: standing, ...(packs ? { draw: packs } : {}), players, rpg: { party: rpg.party, classes: rpg.classes, skills: rpg.skills, gear: rpg.gear, rules: rpg.rules }, legs, ...(deploy ? { deploy, placed } : {}) };
  }
  // in rooms, what is drawn on a spot keeps to the floor inside the walls (a wall cut at the waist is hollow from above)
  const clip = L.source.side === 'inside' && L.scene ? L.scene.rooms.map((r) => [r.box.min[0], r.box.min[1], r.box.max[0], r.box.max[1]]) : undefined;
  const data = boardChannelData(L, { units, camera, cursor, drape: L.drape, clip, battle, slots: slotsOf(play), talk, td, rts });
  const B = L.board, O = L.frame.origin, zs = B.spots.filter(Boolean).map((s) => O[2] + s.h * B.step);
  const P = boardCameraPose(boardCameraInit({ bounds: [O[0], O[1], O[0] + B.cols * B.cell, O[1] + B.rows * B.cell], z: (Math.min(...zs) + Math.max(...zs)) / 2, ...camera }));
  const hfov = (2 * Math.atan(Math.tan((P.fov * Math.PI) / 360) * ASPECT) * 180) / Math.PI;
  const cameras = [{ name: 'board', worldFraming: { cameraPosition: P.pos, lookAt: P.target, horizontalFov: Math.round(hfov * 100) / 100 } }];
  return { data, cameras };
}
// a stage seen from the board's camera: a room as a dollhouse (its ceiling gone, its walls cut at the waist, its haze, a
// walker's few metres of air, gone too), the land as it is
function dressed(scene, L) {
  if (L.source.side !== 'inside') return { faces: scene.faces };
  const z = L.frame.origin[2] + CUTAWAY;
  return { faces: scene.faces.filter((f) => !/:ceiling$/.test(f.group || '') && Math.min(...f.corners.map((c) => c[2])) < z), haze: undefined };
}

export function assembleBoardScene(manifest = {}, ctx = {}) {
  for (const k of Object.keys(manifest)) if (!KEYS.includes(k) && !LEVEL_KEYS.includes(k)) no(`'${k}' is not a setting of the board kind (settings: ${KEYS.filter((x) => x !== 'kind').join(', ')}; a level's own: ${LEVEL_KEYS.join(', ')})`);
  if (manifest.map !== undefined && (manifest.battle !== undefined || manifest.units !== undefined)) no('map, battle or units: an epoch\'s map is travelled, not fought on');
  const L = layBoard(manifest.board ?? {});
  const { data: d0, cameras } = boardParts(L, manifest);
  // an epoch's map: its dots and roads over the diorama, the store's progression slice it reads its cleared dots from
  const data = manifest.map !== undefined ? { ...d0, map: { ...layMap(L.board, manifest.map), slice: 'campaign' } } : d0;
  const title = ctx.title || `mojulo board · ${L.source.geocube} · ${L.source.side}`;
  if (L.faces) return { faces: L.faces, cameras, title, bg: '#141920', board: data };
  const { walk: _walk, cameras: _cams, haze, ...scene } = L.scene;
  const D = dressed(L.scene, L);
  return { ...scene, ...(L.source.side === 'inside' ? {} : { haze }), faces: D.faces, cameras, title, walk: false, board: data };
}

const OVER_KEYS = ['cols', 'rows', 'cell', 'step', 'origin', 'holes', 'battle', 'units', 'td', 'rts', 'camera', 'cursor', 'talk'];
/**
 * A board laid over a world's own stage (a level's `board`: its spots a layer over the level's ground, inside or out),
 * → the changes to that world's payload: its faces dressed for the board's camera, the board's data, its camera at rest,
 * no walking and no camera entity (the board owns the view). The world's other keys (its game contract, its events,
 * its entities) stand.
 *   board: { cols?, rows?, cell?, step?, origin?, holes?, battle?, units?, td?, rts?, camera?, cursor?, talk? }
 */
export function boardOverWorld(P, spec = {}, { play } = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) no(`a level's board is { ${OVER_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(spec)) if (!OVER_KEYS.includes(k)) no(`board.${k} is not a setting of a board over a level (settings: ${OVER_KEYS.join(', ')}); its ground is the level's own`);
  if (!Array.isArray(P.faces) || !P.faces.length) no('a board lies over a level\'s ground, and this world has none');
  const side = Array.isArray(P.rooms) && P.rooms.length ? 'inside' : 'outside';
  const { battle, units, td, rts, camera, cursor, talk, ...lay } = spec;
  const L = layBoard({ ...lay, from: 'stage', side }, { scene: P });
  const { data, cameras } = boardParts(L, { battle, units, td, rts, camera, cursor, play, talk });
  const D = dressed(P, L);
  return { ...D, cameras, walk: false, camera: null, board: data };
}
