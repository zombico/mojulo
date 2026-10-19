/**
 * pixelizer-games — the registry of reducer games that have a served shell.
 *
 * A pixelizer game is a self-contained 2D reducer (step(state, action) → state)
 * + a skin, folded into the `game` bucket as a tiny `kind:'game'` sketch whose
 * manifest is a RECIPE (engine:'pixelizer', reducer, presentation facts). This
 * module is the single place three callers agree:
 *   - the mint tool (`create_pixelizer_game`) — validate + build the manifest,
 *   - the play route (`/api/sketches/<ref>/game`) — emit the shell,
 *   - the seed script — the reproducible bootstrap for the canonical rows.
 * Adding a game = one entry here + its shell emitter; it is then both mintable
 * and playable, no route or tool edit needed.
 */

import { emitBricksterShell } from './brickster-shell.js';
import { emitPhilosophersStoneShell } from './philosophers-stone-shell.js';
import { readSaga } from './philosophers-stone-saga.js';

// reducer id → { defaults for the cabinet, shell emitter }. `emit(opts)` returns
// the self-contained playable HTML (opts: { music, title }).
export const PIXELIZER_REDUCERS = {
  brickster: {
    title: 'Brickster',
    tagline: 'stack the falling blocks, clear the lines — the tempo climbs as you level',
    register: '8bit',
    theme: { accent: '#e8b040', accent2: '#00b8c8', style: 'hud' },
    emit: emitBricksterShell,
    godot: true,   // has a GDScript port in lib/graph/scene/godot-arcade-kernel/ (godot-arcade.js)
  },
  'philosophers-stone': {
    title: "Philosopher's Stone",
    tagline: 'a cute-alchemy match-3 — swap reagents to transmute; promote matches into Aqua Vitae, the Athanor furnace, and the Stone itself (Free Play or the timed Alchemist’s Trial)',
    register: '32bit',
    theme: { accent: '#c9a227', accent2: '#7ad1a6', style: 'hud' },
    emit: emitPhilosophersStoneShell,
  },
  // the match-3 SAGA on the same core (philosophers-stone-saga.js): a map of levels, each a move budget for a goal,
  // three stars each, kept in the browser; its recipe carries the map's `saga: { seed, levels }`
  'stone-saga': {
    title: 'Stone Saga',
    tagline: 'a match-3 saga of alchemy — each level a few moves to reach its goal, three stars to earn, the map opening level by level',
    register: '32bit',
    theme: { accent: '#c9a227', accent2: '#7ad1a6', style: 'hud' },
    emit: emitPhilosophersStoneShell,
    saga: true,
  },
};

export const PIXELIZER_REDUCER_IDS = Object.keys(PIXELIZER_REDUCERS);

/**
 * Build a normalized pixelizer game manifest from mint params. Defaults come
 * from the reducer's registry entry; only `reducer` is required.
 */
export function buildPixelizerGameManifest({ reducer, title, tagline, theme, music, register, saga } = {}) {
  const def = PIXELIZER_REDUCERS[reducer];
  if (!def) {
    throw new Error(`unknown pixelizer reducer '${reducer}'. Known: ${PIXELIZER_REDUCER_IDS.join(', ')}`);
  }
  if (saga !== undefined && !def.saga) throw new Error(`saga is the map of a saga reducer (${PIXELIZER_REDUCER_IDS.filter((id) => PIXELIZER_REDUCERS[id].saga).join(', ')}), not '${reducer}'`);
  const name = title || def.title;
  return {
    kind: 'game',                    // → the `game` bucket → arcade + gallery
    engine: 'pixelizer',             // → the /api/sketches/<ref>/game pixelizer branch
    reducer,                         // which reducer's shell to emit
    register: register || def.register,
    title: name,
    music: music !== false,          // default on; folds in beats soundtrack + SFX
    menu: { tagline: tagline || def.tagline },
    theme: theme || def.theme,
    // a saga's map: its seed (the title's, unless named: two sagas of two names are two maps) and its length
    ...(def.saga ? { saga: readSaga({ seed: titleSeed(name), ...(saga && typeof saga === 'object' ? saga : {}) }) } : {}),
  };
}

// a title's seed: FNV-1a over its characters, so a saga's map follows its name, deterministically
const titleSeed = (t) => { let h = 0x811c9dc5; for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h | 0; };

/** Serve a pixelizer game manifest's shell HTML, or throw a teaching error. */
export function emitPixelizerGame(manifest, { title } = {}) {
  const def = PIXELIZER_REDUCERS[manifest?.reducer];
  if (!def) {
    throw new Error(`no served shell for pixelizer reducer '${manifest?.reducer}'. Known: ${PIXELIZER_REDUCER_IDS.join(', ')}`);
  }
  return def.emit({
    music: manifest.music !== false,
    title: title || manifest.title || def.title,
    ...(def.saga ? { saga: manifest.saga ?? true } : {}),
  });
}
