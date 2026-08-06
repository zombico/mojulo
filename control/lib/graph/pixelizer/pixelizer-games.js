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

// reducer id → { defaults for the cabinet, shell emitter }. `emit(opts)` returns
// the self-contained playable HTML (opts: { music, title }).
export const PIXELIZER_REDUCERS = {
  brickster: {
    title: 'Brickster',
    tagline: 'stack the falling blocks, clear the lines — the tempo climbs as you level',
    register: '8bit',
    theme: { accent: '#e8b040', accent2: '#00b8c8', style: 'hud' },
    emit: emitBricksterShell,
  },
  'philosophers-stone': {
    title: "Philosopher's Stone",
    tagline: 'a cute-alchemy match-3 — swap reagents to transmute; promote matches into Aqua Vitae, the Athanor furnace, and the Stone itself (Free Play or the timed Alchemist’s Trial)',
    register: '32bit',
    theme: { accent: '#c9a227', accent2: '#7ad1a6', style: 'hud' },
    emit: emitPhilosophersStoneShell,
  },
};

export const PIXELIZER_REDUCER_IDS = Object.keys(PIXELIZER_REDUCERS);

/**
 * Build a normalized pixelizer game manifest from mint params. Defaults come
 * from the reducer's registry entry; only `reducer` is required.
 */
export function buildPixelizerGameManifest({ reducer, title, tagline, theme, music, register } = {}) {
  const def = PIXELIZER_REDUCERS[reducer];
  if (!def) {
    throw new Error(`unknown pixelizer reducer '${reducer}'. Known: ${PIXELIZER_REDUCER_IDS.join(', ')}`);
  }
  return {
    kind: 'game',                    // → the `game` bucket → arcade + gallery
    engine: 'pixelizer',             // → the /api/sketches/<ref>/game pixelizer branch
    reducer,                         // which reducer's shell to emit
    register: register || def.register,
    title: title || def.title,
    music: music !== false,          // default on; folds in beats soundtrack + SFX
    menu: { tagline: tagline || def.tagline },
    theme: theme || def.theme,
  };
}

/** Serve a pixelizer game manifest's shell HTML, or throw a teaching error. */
export function emitPixelizerGame(manifest, { title } = {}) {
  const def = PIXELIZER_REDUCERS[manifest?.reducer];
  if (!def) {
    throw new Error(`no served shell for pixelizer reducer '${manifest?.reducer}'. Known: ${PIXELIZER_REDUCER_IDS.join(', ')}`);
  }
  return def.emit({
    music: manifest.music !== false,
    title: title || manifest.title || def.title,
  });
}
