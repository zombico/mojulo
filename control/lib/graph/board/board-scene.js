/**
 * THE `board` WORLD KIND — a tactics board shown on the World page: its ground (the diorama its geocube paints, or the
 * cube's rooms or land under it), its spots drawn over that ground, units standing on them, and the tactical camera
 * (board-camera.js) that plays it. Not walked: the board owns the camera.
 *
 *   { kind: 'board', board?: <board-lay.js spec>, units?: [<board-kernel.js start unit>], camera?: { rotate, edge,
 *     fov, pitches, zooms, yaw }, cursor?: 'C4', battle?: <board-battle.js spec> & { players?: [sides], figures?: false } }
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
import { readBoardBattle } from './board-battle.js';

const KEYS = ['kind', 'board', 'units', 'battle', 'camera', 'cursor', 'title'];
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

// the board's part of a page, from a laid board and what stands on it: the page's data and a camera at its rest
function boardParts(L, { units = [], battle: b, camera: c, cursor } = {}) {
  const camera = readCamera(c);
  if (!Array.isArray(units)) no('units are [{ id, side, at: \'C4\', move?, jump?, spd?, hp?, … }]');
  if (units.length && b !== undefined) no('units or battle: tokens to look at, or a battle to play; not both');
  if (units.length) boardStart(L.board, {}, units);   // the kernel says what cannot stand, before a page is made
  let battle;
  if (b !== undefined) {
    const { players = ['party'], figures: _figures, ...spec } = b ?? {};   // figures: stood by board-figures.js
    if (!Array.isArray(players) || !players.every((x) => typeof x === 'string')) no('battle.players are the sides the player moves: [\'party\'] (or [] to watch)');
    const { cfg, units: read, deploy: names, rpg, legs } = readBoardBattle(spec);
    // the deploy spots, and each member without a spot put on the next free one (the player may place them again)
    let deploy, fielded = read, placed = [];
    if (names) {
      const B = L.board, taken = new Set(read.filter((u) => u.at !== undefined).map((u) => boardParse(B, u.at)));
      // a block of them keeps the spots someone can stand on (a prop, a hole or a cliff in it is passed over)
      deploy = [...new Set(names.flatMap((n) => spotsNamed(n, B.cols, B.rows).map(([cc, r]) => r * B.cols + cc)))].filter((i) => B.spots[i] && B.spots[i].walk);
      const free = deploy.filter((i) => !taken.has(i));
      fielded = read.map((u) => {
        if (u.at !== undefined) return u;
        if (!free.length) no(`battle.deploy: ${deploy.length} spots to stand on for more of the party than fit (a cap, or more spots)`);
        placed.push(u.id);
        return { ...u, at: boardSpotName(B, free.shift()) };
      });
    }
    boardStart(L.board, cfg, fielded);
    // the party battles' book and each class's legs ride along, so a game's party can be stood as the store has it
    battle = { cfg, units: fielded, players, rpg: { party: rpg.party, classes: rpg.classes, skills: rpg.skills, gear: rpg.gear, rules: rpg.rules }, legs, ...(deploy ? { deploy, placed } : {}) };
  }
  // in rooms, what is drawn on a spot keeps to the floor inside the walls (a wall cut at the waist is hollow from above)
  const clip = L.source.side === 'inside' && L.scene ? L.scene.rooms.map((r) => [r.box.min[0], r.box.min[1], r.box.max[0], r.box.max[1]]) : undefined;
  const data = boardChannelData(L, { units, camera, cursor, drape: L.drape, clip, battle });
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
  for (const k of Object.keys(manifest)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of the board kind (settings: ${KEYS.filter((x) => x !== 'kind').join(', ')})`);
  const L = layBoard(manifest.board ?? {});
  const { data, cameras } = boardParts(L, manifest);
  const title = ctx.title || `mojulo board · ${L.source.geocube} · ${L.source.side}`;
  if (L.faces) return { faces: L.faces, cameras, title, bg: '#141920', board: data };
  const { walk: _walk, cameras: _cams, haze, ...scene } = L.scene;
  const D = dressed(L.scene, L);
  return { ...scene, ...(L.source.side === 'inside' ? {} : { haze }), faces: D.faces, cameras, title, walk: false, board: data };
}

const OVER_KEYS = ['cols', 'rows', 'cell', 'step', 'origin', 'holes', 'battle', 'units', 'camera', 'cursor'];
/**
 * A board laid over a world's own stage (a level's `board`: its spots a layer over the level's ground, inside or out),
 * → the changes to that world's payload: its faces dressed for the board's camera, the board's data, its camera at rest,
 * no walking and no camera entity (the board owns the view). The world's other keys (its game contract, its events,
 * its entities) stand.
 *   board: { cols?, rows?, cell?, step?, origin?, holes?, battle?, units?, camera?, cursor? }
 */
export function boardOverWorld(P, spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) no(`a level's board is { ${OVER_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(spec)) if (!OVER_KEYS.includes(k)) no(`board.${k} is not a setting of a board over a level (settings: ${OVER_KEYS.join(', ')}); its ground is the level's own`);
  if (!Array.isArray(P.faces) || !P.faces.length) no('a board lies over a level\'s ground, and this world has none');
  const side = Array.isArray(P.rooms) && P.rooms.length ? 'inside' : 'outside';
  const { battle, units, camera, cursor, ...lay } = spec;
  const L = layBoard({ ...lay, from: 'stage', side }, { scene: P });
  const { data, cameras } = boardParts(L, { battle, units, camera, cursor });
  const D = dressed(P, L);
  return { ...D, cameras, walk: false, camera: null, board: data };
}
