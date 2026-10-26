/**
 * THE HOLO ARENA — a board game LIFTED into a hologram arena on the World page: the duelists on their podiums at either
 * end, the board projected between them as a floating grid of light, every piece summoned onto it as a hologram, and
 * each event of the game staged as it happens (a summon, a move, an attack, a piece destroyed, a promotion, check, the
 * end) with the life points on the overlay. The game is not changed by it: the tabletop kernel is the referee and the
 * page only depicts what the kernel says, as a sport's arena depicts the contest kernel's calls (contest/*-arena.js).
 * The lift is optional: the same game still plays as its own page (tabletop-page.js).
 *
 *   readHolo(spec) → H            { game, human?, players?, level?, seed?, kit?, look?, crowd?, title? } checked:
 *                                 game the tabletop manifest's (a book game's name, or a game written out); a game of
 *                                 moves (pieces moving on the board: chess, checkers, one written out in the kernel's
 *                                 words); human the player id player 1 holds (the first player); players 0 (an
 *                                 exhibition: the minds play both seats) | 1 (you against the computer) | 2 (hot-seat)
 *   holoBoard(H, G) → B           the board on the stage: the lattice at the arena's cell size, its centre, its height,
 *                                 the room around it with each duelist's podium behind their own side
 *   holoManifest(spec) → a `kind: 'stage'` recipe: one room, the stands, a camera behind player 1's podium, the `holo` key
 *   holoArenaData(v) → the page's data: the game dealt, its board on the stage, each kind's body (its shape resolved),
 *                                 the duelists (each player's id, facing and light), the level wire's names
 *   HOLO_LIFTS                    the lifts a game may take: 'holo' (this arena)
 *   holoClientSource()            the page's client as a classic-script fragment (scene/channels/holo.js inlines it
 *                                 after the kernel and the mind, each built from its closure's source)
 *
 * Stage coordinates are metres, z up; the room's open side is y = 0, where the camera stands for a picture. Pure and
 * deterministic.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { resolveTabletop } from './tabletop-manifest.js';
import { tabletopGame } from './tabletop.js';
import { shapeOf } from './tabletop-shapes.js';
import { lattice } from '../polygonizer/lattice.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';

const SRC = moduleDir(import.meta.url, 'lib/graph/tabletop');
/** The arena's client as a classic-script fragment (import lines and `export ` stripped). */
export const holoClientSource = () => readFileSync(join(SRC, 'holo-arena.client.js'), 'utf8').replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');

export const HOLO_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });
export const HOLO_LIFTS = Object.freeze(['holo']);
export const HOLO_LEVELS = Object.freeze(['easy', 'fair', 'hard']);
export const HOLO_DEFAULTS = Object.freeze({ players: 1, level: 'fair', seed: 1, kit: 'research-lab' });
/** The board's span (m) a cell is sized to, the cell's least and most, the board's height over the floor, the room
 * around it (the gap to a side wall, the podium's distance behind its side) and the room's height. */
export const HOLO_SPAN = 11, HOLO_CELL = Object.freeze([0.9, 1.6]), HOLO_LIFT = 0.9, HOLO_SIDE = 5, HOLO_PODIUM = 4.5, HOLO_H = 12;
/** The duelists' colours when the game names none: the hologram's light for each seat. */
export const HOLO_COLOURS = Object.freeze(['#36d6ff', '#ff4f7a', '#ffd23a', '#5cff8a']);
/** A piece with no body of its own stands as this one. */
export const HOLO_FALLBACK = 'pawn';
const KIT_LOOK = { 'island-plaza': 'island-noon' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const even = (v) => 2 * Math.ceil(v / 2);   // the stage's rooms sit on a one-metre grid: even metres keep the centre whole
const fail = (m) => { throw new Error(`holo: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['game', 'human', 'players', 'level', 'seed', 'kit', 'look', 'crowd', 'title'];

/** The game the kernel plays, dealt, and the family it is: only a game of moves is lifted yet. */
function holoGame(H) {
  let G;
  try { G = resolveTabletop({ kind: 'tabletop', game: H.game, seed: H.seed, ...(H.title ? { title: H.title } : {}) }).G; } catch (e) { fail(e.message.replace(/^tabletop: /, '')); }
  const { K, L } = tabletopGame(G);
  const family = K.round ? 'a game of rounds' : K.card ? 'a card game' : K.tile ? 'a tile game' : K.euro ? 'a euro game' : null;
  if (family) fail(`${G.title ?? 'the game'} is ${family}: the holo arena lifts a game of moves (pieces moving on a board: chess, checkers, one written out) for now; ${family} plays on its own page (create_game { tabletop })`);
  return { G, K, L };
}

/** The arena's words, checked. */
export function readHolo(spec = {}) {
  if (!isObj(spec)) fail(`a holo arena is { ${KEYS.map((k) => (k === 'game' ? k : `${k}?`)).join(', ')} }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) fail(`a holo arena has no '${k}' (${KEYS.join(', ')})`);
  if (spec.game === undefined) fail('game names the board game: chess or checkers (the book), or a game written out in the tabletop kernel\'s words');
  const H = { ...HOLO_DEFAULTS, ...spec };
  if (!(Number.isInteger(H.players) && H.players >= 0 && H.players <= 2)) fail('players is 0 (an exhibition), 1 (you against the computer) or 2 (hot-seat, both at the keyboard)');
  if (!HOLO_LEVELS.includes(H.level)) fail(`level is one of ${HOLO_LEVELS.join(', ')} (the computer's)`);
  if (!(Number.isInteger(H.seed) && H.seed >= 0)) fail('seed is a whole number, 0 or more');
  if (!ARENA_KITS.includes(H.kit)) fail(`kit '${H.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (H.crowd !== undefined && H.crowd !== false && !isObj(H.crowd)) fail('crowd is false or { rows?, fill? }');
  if (H.title !== undefined && typeof H.title !== 'string') fail('title is a string');
  const { G, K } = holoGame(H);
  if (K.players.length !== 2) fail(`the holo arena seats two duelists; ${G.title ?? 'the game'} has ${K.players.length} players`);
  const human = H.human ?? K.players[0].id;
  if (K.sideOf[human] === undefined) fail(`human '${human}' is not a player (${K.players.map((p) => p.id).join(', ')})`);
  return {
    game: H.game, ...(H.human !== undefined ? { human: H.human } : {}), players: H.players, level: H.level, seed: H.seed, kit: H.kit,
    ...(H.look ? { look: H.look } : {}), crowd: H.crowd === false ? false : { rows: 3, fill: 0.7, ...(H.crowd ?? {}) }, ...(H.title ? { title: H.title } : {}),
  };
}

/** The board on the stage, its room and the podiums. */
export function holoBoard(H, G = holoGame(H).G) {
  const L0 = lattice(G.board);
  const span = Math.max(L0.size[0], L0.size[1]) / L0.cell;   // the board's span in cells
  const cell = r3(Math.min(HOLO_CELL[1], Math.max(HOLO_CELL[0], HOLO_SPAN / span)));
  const L = lattice({ ...G.board, cell });
  const room = { w: even(L.size[0] + 2 * HOLO_SIDE), d: even(L.size[1] + 2 * (HOLO_PODIUM + 2)), h: HOLO_H };
  return { L, cell, room, centre: [0, r3(room.d / 2), HOLO_LIFT], podium: HOLO_PODIUM };
}

/** The venue: a stage set with its camera side open, the stands behind the far duelist, the arena the page lifts. */
export function holoManifest(spec = {}) {
  const H = readHolo(spec), { G } = holoGame(H), B = holoBoard(H, G);
  const title = H.title ?? `${G.title ?? 'board game'} · holo arena`;
  return {
    kind: 'stage',
    kit: H.kit,
    ...(H.look ?? KIT_LOOK[H.kit] ? { reference: H.look ?? KIT_LOOK[H.kit] } : {}),
    title,
    dress: false,
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'arena', x: r3(-B.room.w / 2), y: 0, w: B.room.w, d: B.room.d, h: B.room.h, open: ['-y'] }],
    lights: 'auto',
    ...(H.crowd ? { stands: { from: r3(B.room.d - 0.5), rows: H.crowd.rows, fill: H.crowd.fill, shade: 0.55, seed: H.seed } } : {}),
    camera: { name: 'duelist', worldFraming: { cameraPosition: [0, r3(B.centre[1] - B.L.size[1] / 2 - B.podium - 1), 6], lookAt: [0, B.centre[1], B.centre[2]], horizontalFov: 58, pictureCenter: [640, 360] } },
    holo: { ...H, ...(H.title ? {} : { title }) },
  };
}

// a shape with every name on the shelf resolved, so the page needs no shelf
function shapeTree(ref) {
  const s = shapeOf(ref);
  return s.form === 'group' ? { form: 'group', parts: s.parts.map((p) => ({ ...p, shape: shapeTree(p.shape) })) } : s;
}

/** The page's data: the game dealt, its board on the stage, each kind's body and value, the players, the wire. */
export function holoArenaData(v = {}) {
  const H = readHolo(v), { G, K } = holoGame(H), B = holoBoard(H, G);
  const kinds = Object.fromEntries(Object.entries(G.pieces || {}).map(([kind, P]) => [kind, {
    name: P.name ?? kind, shape: shapeTree(P.shape ?? HOLO_FALLBACK), value: typeof P.value === 'number' ? P.value : 1, ...(P.royal ? { royal: true } : {}),
  }]));
  // (each duelist's light is the arena's, not the game's: a chess set's white and black are a table's colours)
  const duelists = K.players.map((p, s) => ({ id: p.id, facing: p.facing, colour: HOLO_COLOURS[s] }));
  return {
    ...H, title: H.title ?? `${G.title ?? 'board game'}`, human: H.human ?? K.players[0].id,
    G, L: B.L, board: { cell: B.cell, centre: B.centre, room: B.room, podium: B.podium }, kinds, duelists, wire: HOLO_WIRE,
  };
}
