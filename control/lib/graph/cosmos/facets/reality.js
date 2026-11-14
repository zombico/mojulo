/**
 * REALITY: how it looks and how its assets are made. The geocube's facet.
 *
 * A facet is data. Each setting either names a SOURCE (a table in the tree whose keys are the values; the registry
 * reads it live, read-sources.js) or lists its VALUES by hand, each with a status and a note. Statuses:
 *   built    a general module makes it today
 *   local    it exists inside one game only: a mine, not a capability
 *   partial  part of it exists; the note says what is missing
 *   absent   nothing makes it yet
 * `lowers` names the module that makes a value. See ../cosmos.js for how a cosmos cube reads a facet.
 */
import { ERAS, ERA_IDS, eraCastConventions } from '../../era/eras.js';

function castStatus(id) {
  const planned = eraCastConventions(id).filter((c) => c.status === 'planned').map((c) => c.id);
  // (a convention made for part of the cast says which, after the planned ones)
  const partial = eraCastConventions(id).filter((c) => c.status === 'partial').map((c) => `${c.id} (${c.note})`);
  // (priced 11-10: the cast's conventions still planned are one large piece of work, and no cast is drawn in an era its
  // world is not: the sweep builds the era's world with it)
  return planned.length || partial.length
    ? { status: 'partial', effort: 'L', requires: [`reality.era=${id}`], lowers: 'lib/graph/era/cast-density.js', note: `the body is built, its density set by the target${planned.length ? `; planned: ${planned.join(', ')}` : ''}${partial.length ? `; partial: ${partial.join('; ')}` : ''}` }
    : { status: 'built', lowers: 'lib/graph/era/cast-density.js', note: 'its density set by the target' };
}

export const REALITY = Object.freeze({
  id: 'reality',
  asks: 'how does it look, and how are its assets made?',
  settings: {
    // the look's generation (era/eras.js), drawn at the target's resolution; how dense is the target's, not the era's
    // (priced 11-10: an era short of built is the form render reaching every surface a level draws: large)
    era: { values: Object.fromEntries(ERA_IDS.map((id) => [id, ERAS[id].world.status === 'built' ? ERAS[id].world : { ...ERAS[id].world, effort: 'L' }])) },
    // the cast in the same era (era/cast-density.js): built where its body is, partial while conventions are planned
    cast: { values: Object.fromEntries(ERA_IDS.map((id) => [id, castStatus(id)])) },
    look: {
      source: { module: 'lib/graph/era/sixth-gen.js', table: 'SIXTH_GEN_LOOKS' },
      // priced 10-25 (the comic hero pack): the comic page as a look. The parts exist and no look names them: the geocube's
      // `cel` register (colour-register.js: three bands, an outline, inked creases), effect-style's ink and echoes, the
      // color theorist's palette; a look row that composes them is the gap, by day and by night
      planned: {
        'comic-day': { status: 'absent', effort: 'M', pkg: 'comic-look', note: 'a sixth-gen look on the cel register: an ink outline, three bands, a bold two-ramp palette, a flat noon sky; the halftone is not promised' },
        'comic-night': { status: 'absent', effort: 'S', pkg: 'comic-look', requires: ['reality.look=comic-day'], note: 'the comic look by night: the same ink and bands, a city-night palette, rim light on the cast' },
      },
    },
    kit: { source: { module: 'lib/graph/era/stage.js', table: 'STAGE_KITS' } },
    medium: {
      values: {
        '3d': { status: 'built', lowers: 'lib/graph/scene/scene-three.js' },
        // built 10-12: a world's `pixel` (a gameworld's style.pixel) draws the page small and blows it up unsmoothed
        pixel: { status: 'built', lowers: 'lib/graph/scene/scene-three.js', note: 'the World page drawn at 1/2 to 1/8 of its size, blown up without smoothing (style.pixel); no palette snap yet, and true 2D sprite levels are another thing' },
        // built 10-19 (mobile genres): a 2D board game on a pixelizer reducer (create_pixelizer_game): one page, no world
        board: { status: 'built', lowers: 'lib/graph/pixelizer/pixelizer-games.js', note: 'a 2D board or falling-blocks game on a pixelizer reducer (falling blocks, match-3, the match-3 saga): one page, no world or level audit' },
      },
    },
    climate: { source: { module: 'lib/graph/weather/weather.js', table: 'CLIMATES' } },
    // how the effects are drawn and timed (gameworld/juice.js, scene/juice-style.js: a world's `juice`): the register the
    // attacks, blasts, puffs and a battle's beats are composed in, by the game type's flavor. Absent, nothing is laid
    juice: { source: { module: 'lib/graph/scene/juice-style.js', table: 'JUICE_REGISTERS', since: { anime: '2026-11-03', western: '2026-11-03' } } },
    // the look laid over every frame of a game's levels (11-02 the impact cam and the grade; gameworld/grade.js: a world's
    // `grade`), the base its moments' looks push from and return to
    grade: {
      values: {
        none: { status: 'built', note: 'the frames as the renderer draws them' },
        graded: { status: 'built', since: '2026-11-02', lowers: 'lib/graph/gameworld/grade.js', note: 'a world\'s grade over every level: a word (film, noir, bleach, vivid, pastel, cold, warm), dials, or the register\'s own (anime drawn vivid, western on film); a tempo moment\'s look pushes from it and returns' },
      },
    },
    // the game's own screens (the interface department; its runtime is mana-ui, lib/mana-ui: one runtime every game's UI
    // is to run on, greybox first, a theme a layer over it). What runs on it today, and what is still its old DOM
    interface: {
      multi: true,
      values: {
        hud: { status: 'built', lowers: 'lib/graph/scene/channels/events.js', note: 'a level\'s HUD, its talk menus, quest log and pause, drawn by the page as they always were' },
        // built 11-07 (a HUD that reads as a game): a mana-ui theme laid over the level\'s HUD as a sheet
        'hud-look': { status: 'built', since: '2026-11-07', lowers: 'lib/mana-ui/theme.js', note: 'a world\'s hud: a mana-ui theme preset its levels\' HUD wears (a bare HUD\'s parts on the scene itself, no cards); a sheet over the old HUD, not mana-ui components' },
        // built 11-05 (the front): the game's title over its cover, its menu, options, credits and end
        front: { status: 'built', since: '2026-11-05', lowers: 'lib/graph/game/play-front.js', note: 'a world\'s front: the title over a cover, the menu, options, credits and the end card' },
        // built 11-09 (the shell on mana-ui): the shell's screens as mana-ui compositions in the world's look
        themed: { status: 'built', since: '2026-11-09', requires: ['reality.interface=front'], lowers: 'lib/graph/game/play-shell-mana.js', note: 'a world\'s ui: the shell\'s attract, title, level list, options, results and loading screens on mana-ui, in the world\'s look (its guide lowered to a theme: type on a frame sized by the screen and the seat, a halo over the world, a legend bar, lean, transitions, sound cues), in its languages' },
        // partial 11-06 (the RPG on mana-ui; 11-09 the brawl yard, the fighter\'s lab): some games\' own screens run on
        // mana-ui; a level\'s HUD, talk, quest log and pause do not yet
        'in-game': { status: 'partial', effort: 'L', pkg: 'game-ui', lowers: 'lib/graph/playscape/rpg/rpg-ui.js', note: 'screens inside play on mana-ui: the RPG\'s battles, party menu, shops and inn, the brawler\'s readouts, the fighter\'s select and lab, a broadcast\'s menus; a level\'s HUD, its talk menus, quest log and pause are still the page\'s own DOM, so a headset gets them as lines' },
      },
    },
    // what a game sounds like. A quick game says its music and its effects; a gameworld's `sound` (11-13) lays the sound
    // sheet on every level it builds, the SFX shelf read by word; a designed gameworld has no word for its score yet
    sound: {
      multi: true,
      values: {
        none: { status: 'built', note: 'silent, as a world is until it says otherwise' },
        score: { status: 'partial', effort: 'M', pkg: 'sound', lowers: 'lib/graph/beats/score-suggest.js', note: 'a field score by the level\'s place and play, an explore and a combat score crossfaded on the fight (auto), a rhythm run on its beat: a quick game\'s music; a designed gameworld\'s levels have no word for it' },
        sfx: { status: 'partial', effort: 'M', pkg: 'sound', lowers: 'lib/graph/beats/sfx-palettes.js', note: 'action sounds wired to the goal\'s events in the music\'s key, in a palette (arcade, foley, orchestral, synth): a quick game\'s sfx; a designed gameworld\'s levels take the sound sheet (shelf) and no palette' },
        shelf: { status: 'local', effort: 'M', pkg: 'sound', lowers: 'lib/graph/sfx-shelf/roster.js', note: 'the SFX shelf: a sound a row under the words people say, built from gesture layers and held voices, a realistic style, a mixer that places a cue by distance in one space; read by the practice, platform and combat rooms, the mount lane and the fighter, and by the levels of a game on the sound sheet (a `sound` of its own, or a quick game\'s sfx: sheet): its first weapon, its ground, its doors, a foe spotting the hero; a level\'s guns, rides and its foes\' attacks are not on the sheet yet' },
      },
    },
  },
});
