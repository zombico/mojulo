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
  // (11-26: the seats kernel's lobby folded into the couch: every seat value but split, built as one)
  // (11-27: every seat its own, versus, free-for-all and teams built; what is left)
  couch: { name: 'Couch play: a seat a job (one drives, one shoots) and turns', effort: 'L' },
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
  // (sound: built 11-13, the sound sheet on every level and the score by request; 11-16 a played city's: its package is
  // gone)
  // the game UI (11-10): the shell, the RPG, the brawler and the fighter run on mana-ui; a level's own HUD does not
  // (11-14: a level's HUD rows, its pause button and its touch pad are mana-ui's on a world that says `ui`; what is left is smaller)
  'game-ui': { name: 'The rest of play on mana-ui: a level\'s talk menus and quest log as compositions of the one runtime, and the HUD host on a world that says no `ui`, so a theme, a language and a headset reach every screen', effort: 'M' },
  // crewed machines (11-10): the artillery range drives and flies them; a gameworld's hero does not get into one yet
  crewed: { name: 'Crewed machines from a gameworld: the hero gets into a tank, a truck, a walker, a boat, a helicopter or a fighter and drives or flies it, its gun on a turret', effort: 'L' },
  // the lorecube (11-15): its join tables, its manual and its tree are made and checked; no gameworld key takes a part.
  // Named for the join, as the film's order is one: the parts are structured orders the departments can be handed
  lorecube: { name: 'Orders from lore: a world says its power system (what opposes what, its reserve, who holds a share, a manual, a tree) and its levels are laid from it: elements and weaknesses on an action game\'s foes, the reserve on its gauge, a book\'s battles fielding the manual and its party the tree', effort: 'L' },
  // a room's condition (11-15): debris, weathering, wetness and daylight are a stage recipe's words; the join is the
  // level keys of a designed game that carry them
  condition: { name: 'A room\'s condition from a gameworld: the level keys that carry a place\'s state of repair, its debris, its wetness and its daylight onto a designed game\'s levels', effort: 'M' },
  replay: { name: 'Replay in play: a recorded world clock, a moment shown again slowed and from another camera (the kill cam\'s replay)', effort: 'M' },
  // (keying: built 11-23, a level's bodies on twos or threes, each layer its own grain: its package is gone)
  // the main quest (11-04): what a long game's spine still waits on, priced so the sweep ranks it
  'quest-turns': { name: 'Quest turns: a main quest\'s chapter lowered to its world overlay, the world turned as the chapter opens', effort: 'M' },
  'side-quests': { name: 'Side quests by the main quest: hung on its beats, near its path or anywhere, as loose as it says', effort: 'M' },
  'hostile-encounters': { name: 'Hostile encounters: foe classes on a level, the touch and the stomp, the pace, the hop, the dive and the charge', effort: 'L' },
  // the traditional side-scroller map (11-17): a level as the camera's path, read as words; what laying it waits on
  'side-map': { name: 'The traditional side-scroller map: a chain of camera zones laid in screens and reach, its climbs, its laws, its camera and its closed parts painted', effort: 'L' },
});
