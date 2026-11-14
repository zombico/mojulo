/**
 * WORK PACKAGES: a set of registry values one change fills, so the sweep can price a change rather than a value. A
 * value names its package with `pkg`; a value without one is its own package. `effort` is a rough size, S / M / L,
 * weighed 1 / 3 / 8 when the sweep ranks lifts per unit of work. A value with no effort is unsized: the facet's owner
 * has not priced it, and the ranking lists it last.
 */
export const EFFORT_WEIGHT = Object.freeze({ S: 1, M: 3, L: 8 });

export const PACKAGES = Object.freeze({
  'mind-lift': { name: 'Lift the arena brain into a general mind', effort: 'M' },
  quests: { name: 'Quests and choices: ordered steps, a giver, a journal, the player\'s answers', effort: 'M' },
  'strategy-board': { name: 'The strategy board: spots over the ground and the tactical camera that plays them', effort: 'L' },
  shot: { name: 'The 3D shot and banter: a directed camera, subjects, a text box, two speakers', effort: 'L' },
  seats: { name: 'The seats kernel: a controller bound to each player, who join and leave', effort: 'M' },
  'battle-city': { name: 'Battle city: a contest kernel over the movement stack (a meet and a match), the court, the team, the ball and the hit', effort: 'L' },
  // the comic hero pack (10-25): the first pack of game cubes; its gaps, priced so the sweep ranks them
  'comic-look': { name: 'The comic look: a geocube look on the cel register with an ink outline, by day and by night', effort: 'M' },
  // (11-10: knockback is built, natural knockback 11-04; the breakable street is built, the destruction degree: its
  // package is gone. What is left of the blows is the hero's throw and its leap composed into one move)
  'comic-blows': { name: 'Comic blows: a body or a prop lifted and thrown by any hero, the storeys-high leap composed into one move', effort: 'M' },
  cape: { name: 'The cape: a garment that trails the gait and lifts in a leap', effort: 'M' },
  'comic-panel': { name: 'The comic panel: a beat held as a still with a border, a caption and an onomatopoeia', effort: 'S' },
  // hostile encounters (10-27): the foe classes' moves and attacks that do not run yet, priced so the sweep ranks them
  // the time map (11-02): the screen's clock built offline, the world clock in play (11-02); a replay in play and a grain to each layer
  // the brawler (11-09): its sim, crowd and belt built as their own, waiting on the door that makes one from a gameworld
  // (11-10: the run & gun rides the same door: its guns on the belt, its shooting crowd, its range)
  brawler: { name: 'The brawler from a gameworld: a world that says it is a beat-em-up or a run & gun laid down a belt, its crowd, waves and boss', effort: 'M' },
  // the scrolling screen (11-10): built in the brawler's belt, waiting on the shared camera every group level plays under
  scroll: { name: 'The scrolling screen: the belt\'s camera (on with the players, never back, held at a gate) for every level a group plays', effort: 'M' },
  // sound (11-10): a quick game says its music and effects, and the SFX shelf is read by the rooms; (11-13) a gameworld's
  // `sound` lays the sound sheet on every level, the shelf read by word; a designed gameworld's score has no word yet
  sound: { name: 'Sound from a gameworld: a world says its score and its effects, a level reads the SFX shelf by word, the mixer placing each cue', effort: 'M' },
  // the game UI (11-10): the shell, the RPG, the brawler and the fighter run on mana-ui; a level's own HUD does not
  'game-ui': { name: 'The level\'s HUD on mana-ui: the HUD, talk menus, quest log and pause as compositions of the one runtime, so a theme, a language and a headset reach them', effort: 'L' },
  // crewed machines (11-10): the artillery range drives and flies them; a gameworld's hero does not get into one yet
  crewed: { name: 'Crewed machines from a gameworld: the hero gets into a tank, a truck, a walker, a boat, a helicopter or a fighter and drives or flies it, its gun on a turret', effort: 'L' },
  replay: { name: 'Replay in play: a recorded world clock, a moment shown again slowed and from another camera (the kill cam\'s replay)', effort: 'M' },
  keying: { name: 'Keying: a body\'s clips stepped on twos or threes in play, each layer its own grain (characters on twos, the camera on ones)', effort: 'M' },
  // the main quest (11-04): what a long game's spine still waits on, priced so the sweep ranks it
  'quest-turns': { name: 'Quest turns: a main quest\'s chapter lowered to its world overlay, the world turned as the chapter opens', effort: 'M' },
  'side-quests': { name: 'Side quests by the main quest: hung on its beats, near its path or anywhere, as loose as it says', effort: 'M' },
  'hostile-encounters': { name: 'Hostile encounters: foe classes on a level, the touch and the stomp, the pace, the hop, the dive and the charge', effort: 'L' },
});
