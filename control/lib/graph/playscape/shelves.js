/**
 * shelves — the playscape builder's view of the encyclopedias it composes. Each adapter reads ONE shelf's own rows
 * and its own setting tags, and hands back `{ id, role, setting }` entries; no adapter reads another shelf, and no
 * shelf imports this file. The setting words are the only thing the shelves share (./setting.js).
 *
 *   SHELVES                     the shelves on hand, by id
 *   sortShelves(world, opts)    every shelf, admitted for one world (see setting.js admit)
 *
 * A shelf with rules and no look (the game idioms) carries no setting: a rule fits any world. What a rule SHOWS
 * comes off the other shelves (its glyph, its effect, its screen look), and those are admitted for the world.
 */
import { GLYPH_IDS, GLYPH_SETTINGS } from '../game/glyph-forms.js';
import { SFX_VERB_IDS, SFX_SETTINGS } from '../game/glyph-sfx.js';
import { HUD_LOOK_SETTINGS } from '../game/hud-widgets.js';
import { PROP_KINDS, DOODAD_KINDS, PROP_SETTINGS } from '../era/props.js';
import { IDIOM_KINDS, IDIOM_ABOUT } from '../worlds/game-idioms.js';
import { admit } from './setting.js';

export const SHELVES = Object.freeze({
  glyph: { about: 'icon-grade pickup and marker forms', entries: () => GLYPH_IDS.map((id) => ({ id: `glyph:${id}`, role: 'pickup', setting: GLYPH_SETTINGS[id] })) },
  sfx: { about: 'glowing effect verbs anchored at a thing', entries: () => SFX_VERB_IDS.map((id) => ({ id: `sfx:${id}`, role: 'effect', setting: SFX_SETTINGS[id] })) },
  hud: { about: 'the screen treatment and type', entries: () => Object.keys(HUD_LOOK_SETTINGS).map((id) => ({ id: `hud:${id}`, role: id.split(':')[0] === 'font' ? 'font' : 'screen', setting: HUD_LOOK_SETTINGS[id] })) },
  prop: { about: 'the things a stage stands about its rooms', entries: () => PROP_KINDS.map((id) => ({ id: `prop:${id}`, role: DOODAD_KINDS.includes(id) ? 'doodad' : 'scatter', setting: PROP_SETTINGS[id] })) },
  idiom: { about: 'reusable rules; no look of their own', entries: () => IDIOM_KINDS.map((id) => ({ id: `idiom:${id}`, role: IDIOM_ABOUT[id].tier, setting: undefined })) },
});

/** Every shelf sorted for one world: `{ <shelf>: { admitted, kept, left } }`. `named` holds entry ids asked for by name. */
export function sortShelves(world, { named = [], shelves = SHELVES } = {}) {
  return Object.fromEntries(Object.entries(shelves).map(([id, s]) => [id, admit(s.entries(), world, { named })]));
}
