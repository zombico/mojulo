/**
 * versus levels — the fight level loader: any kind of level a fight can be laid on, each turning its own words into a
 * world recipe and its LANE (versus-lane.js). The fight never knows what the level is; the level never knows the fight
 * beyond where its lane runs. A new kind of level is a row.
 *
 *   FIGHT_LEVELS[kind] = { reads, words, build(words) → { manifest, lane } }
 *     stage    the arena as it was (versus-arena.js arenaManifest: a stage room open to the camera, a crowd, a set);
 *              its recipe unchanged, its lane read from its old words (heading 0)
 *     greybox  a level blocked out in boxes (level/greybox-scene.js), from a preset or its own blocks, its lane named or
 *              the preset's; the presets stress the lane: `flat`, `alley` (walled, little room behind the camera),
 *              `rooftop` (a raised floor), `turned` (off the level's centre, at 35°)
 *
 *   readFightLevel(level)                  → { kind, words } (throws naming the fault)
 *   fightLevel(level, { roster?, rules?, title? }) → the world manifest the fight is played on: the level's recipe with
 *                                            `versus` (its lane, the roster, the rules); a stage's is arenaManifest's
 *   GREYBOX_PRESETS, greyboxPreset(id)     the presets: { reads, blocks, lane }
 *
 * Pure: no clock, no dice.
 */
import { arenaManifest, readArena } from './versus-arena.js';
import { readLane, laneOf, lanePoint } from './versus-lane.js';
import { readGreybox } from '../level/greybox-scene.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
/** a block laid in a lane's frame: its centre `s` along the lane and `n` across it (toward the far side), on `z`, its
 * width along the lane, depth across it, height, turned with the lane */
const laneBlock = (lane, s, n, z, [w, d, h], tone) => { const [x, y] = lanePoint(lane, s, n); return { at: [x, y, r3(z)], size: [w, d, h], turn: lane.heading, tone }; };

/** THE GREYBOX PRESETS: each a lane and the blocks round it, laid in the lane's own frame so a turned lane carries its
 * level with it. The camera's side (the lane's right, −n) is open to the lane's `back` or to the sky. */
const preset = (reads, lane, blocks) => Object.freeze({ reads, lane: Object.freeze(readLane(lane, 'preset.lane')), blocks: (L) => blocks(L) });
export const GREYBOX_PRESETS = Object.freeze({
  flat: preset('an open floor, a few pillars far behind the lane', { at: [0, 0], heading: 0, half: 8, floor: 0 }, (L) => [
    laneBlock(L, 0, 2, -0.3, [34, 22, 0.3], 'floor'),
    ...[-9, -3, 3, 9].map((s) => laneBlock(L, s, 9, 0, [1.2, 1.2, 4], 'prop')),
  ]),
  alley: preset('a walled alley: a wall behind the lane, a wall behind the camera 4 m off, ends closed', { at: [0, 0], heading: 0, half: 6, floor: 0, back: 4 }, (L) => [
    laneBlock(L, 0, 0, -0.3, [28, 9.6, 0.3], 'floor'),
    laneBlock(L, 0, 3.6, 0, [28, 0.6, 6], 'wall'),
    laneBlock(L, 0, -4.6, 0, [28, 0.6, 6], 'wall'),
    laneBlock(L, -14.3, 0, 0, [0.6, 9.6, 6], 'wall'),
    laneBlock(L, 14.3, 0, 0, [0.6, 9.6, 6], 'wall'),
    laneBlock(L, -4, 2.6, 0, [1.4, 1, 1.2], 'prop'), laneBlock(L, 5, 2.7, 0, [2.2, 0.9, 1.6], 'prop'),
  ]),
  rooftop: preset('a roof 9 m up: lips along its edges, a tank behind, the street far below', { at: [0, 0], heading: 0, half: 7, floor: 9 }, (L) => [
    laneBlock(L, 0, 0, 0, [22, 12, 9], 'wall'),
    laneBlock(L, 0, -5.9, 9, [22, 0.2, 0.25], 'edge'), laneBlock(L, 0, 5.9, 9, [22, 0.2, 0.6], 'edge'),
    laneBlock(L, -10.9, 0, 9, [0.2, 12, 0.6], 'edge'), laneBlock(L, 10.9, 0, 9, [0.2, 12, 0.6], 'edge'),
    laneBlock(L, 6, 4, 9, [2, 2, 3], 'prop'),
    laneBlock(L, 0, 15, 0, [34, 8, 6], 'wall'),
    laneBlock(L, 0, 0, -0.3, [70, 50, 0.3], 'floor'),
  ]),
  turned: preset('the lane off the level\'s centre and turned 35°, its floor, a wall behind it and props turned with it', { at: [12, -7], heading: 35, half: 7.5, floor: 0 }, (L) => [
    laneBlock(L, 0, 1, -0.3, [26, 16, 0.3], 'floor'),
    laneBlock(L, 0, 6.5, 0, [26, 0.6, 4.5], 'wall'),
    laneBlock(L, -7, 4.5, 0, [1.6, 1.6, 2.2], 'prop'), laneBlock(L, 6, 4.8, 0, [3, 1.2, 1], 'prop'),
    laneBlock(L, -12.6, 1, 0, [0.6, 16, 2.5], 'wall'), laneBlock(L, 12.6, 1, 0, [0.6, 16, 2.5], 'wall'),
  ]),
});
/** A preset's lane and its blocks laid on it (a lane override moves the blocks with it). */
export function greyboxPreset(id, laneOver = {}) {
  const P = GREYBOX_PRESETS[id];
  if (!P) throw new Error(`versus: a greybox level's preset is one of ${Object.keys(GREYBOX_PRESETS).join(', ')}`);
  const lane = readLane({ ...P.lane, ...laneOver }, 'level.lane');
  return { reads: P.reads, lane, blocks: P.blocks(lane) };
}

const GREYBOX_WORDS = ['preset', 'lane', 'blocks', 'title'];
export const FIGHT_LEVELS = Object.freeze({
  stage: Object.freeze({
    reads: 'a stage room open to the camera (a kit and its look), the crowd behind the lane, or a set (the ring)',
    words: ['kit', 'look', 'width', 'depth', 'height', 'crowd', 'dress', 'seed', 'set', 'title'],
    build(words) {
      const manifest = arenaManifest(words);
      return { manifest, lane: laneOf(manifest.versus) };
    },
  }),
  greybox: Object.freeze({
    reads: 'a level blocked out in boxes, from a preset (flat, alley, rooftop, turned) or its own blocks and lane',
    words: GREYBOX_WORDS,
    build(words) {
      const own = words.blocks !== undefined;
      if (!own && words.preset === undefined) throw new Error('versus: a greybox level names a preset (flat, alley, rooftop, turned) or its own blocks and lane');
      if (own && words.preset !== undefined) throw new Error('versus: a greybox level is a preset or its own blocks, not both');
      if (own && !isObj(words.lane)) throw new Error('versus: a greybox level of its own blocks names its lane { at, heading, half, floor, back? }');
      const P = own ? { lane: readLane(words.lane, 'level.lane'), blocks: words.blocks } : greyboxPreset(words.preset, words.lane);
      const manifest = { kind: 'greybox', ...(words.title ? { title: words.title } : {}), blocks: readGreybox({ blocks: P.blocks }).blocks };
      return { manifest, lane: P.lane };
    },
  }),
});
export const FIGHT_LEVEL_KINDS = Object.freeze(Object.keys(FIGHT_LEVELS));

/** Read a fight level: `{ kind, …its words }` (throws naming the fault). */
export function readFightLevel(level, where = 'level') {
  if (!isObj(level)) throw new Error(`versus: ${where} is { kind: ${FIGHT_LEVEL_KINDS.join(' | ')}, …its words }`);
  const { kind, ...words } = level;
  const row = FIGHT_LEVELS[kind];
  if (!row) throw new Error(`versus: ${where}.kind is one of ${FIGHT_LEVEL_KINDS.join(', ')}`);
  for (const k of Object.keys(words)) if (!row.words.includes(k)) throw new Error(`versus: ${where}.${k} is not a ${kind} level's word (${row.words.join(', ')})`);
  // (its values too, where the game is designed and not where it is built: a stage's words read, any other level built,
  // which is cheap and says the first fault by name)
  if (kind === 'stage') readArena(words);
  else row.build(words);
  return { kind, words };
}

/** The world manifest a fight is played on: the level's recipe with its `versus` block (the lane, the roster, the rules). */
export function fightLevel(level, { roster, rules, title } = {}) {
  const { kind, words } = readFightLevel(level);
  // (a stage is the arena as it always was: its recipe arenaManifest's, byte for byte)
  if (kind === 'stage') return arenaManifest({ ...words, ...(title ? { title } : {}), ...(roster ? { roster } : {}), ...(rules ? { rules } : {}) });
  const { manifest, lane } = FIGHT_LEVELS[kind].build({ ...words, ...(title && !words.title ? { title } : {}) });
  return { ...manifest, versus: { lane, ...(roster ? { roster } : {}), ...(rules ? { rules } : {}) } };
}
