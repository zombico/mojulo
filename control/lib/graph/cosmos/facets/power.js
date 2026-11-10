/**
 * POWER: the verbs and rules, whoever holds them. Shape as in reality.js. `multi` settings take a list.
 */
export const POWER = Object.freeze({
  id: 'power',
  asks: 'what can be done?',
  settings: {
    mechanics: {
      multi: true,
      source: { module: 'lib/graph/game/mechanics.js', table: 'MECHANIC_KINDS' },
      // built 10-25 (battle city): a sport is two layers, what happens at the ball (the movement stack and a free
      // body) and the game state (a contest kernel, deterministic as a board game's: who may stand where, who has the
      // ball, the clock and its stoppages, the score, the fouls and the restart each one triggers). Three shapes of
      // contest, one kernel (lib/graph/contest), each a page's own frame simulation
      planned: {
        meet: { status: 'built', lowers: 'lib/graph/contest/meet-sim.js', note: 'an athletic event (contest-kernel.js the referee): lanes, the set and the gun on a seeded delay, a false start, the clock or the measure, attempts, the placings; the sprint, the hurdles cleared on the stride, the long jump from the board; up to four local players on one keyboard, the rest the computer\'s. A quick game (design_game quick.meet) played on the World page (meet-arena.js); the runners are stick figures, the hero library\'s clips the step after' },
        contest: { status: 'built', lowers: 'lib/graph/contest/contest-kernel.js', note: 'a match called by the contest kernel, never the agent: a net game (match-sim.js: tennis on two pads, the serve, the rally, 15 30 40), a turn sport (turn-sim.js: golf and bowling hot-seat, a charged aimed shot), a team goal game (team-sim.js: soccer and hockey on two pads, possession, throw-ins and corners, offside against the ball, fouls, the clock); the ball the physics property\'s sphere on its register\'s card, the hit the swing\'s strike; a sport not in the book written out (sports.js resolveSport, the distilled-rulebook catalyst). A quick game (design_game quick.contest) on the World page' },
        // priced 10-25 (the comic hero pack): a blow that moves its target, a body or a prop lifted and hurled, street props
        // that break. Built 11-04 (natural knockback, worlds/controllable/knock.js, an opt-in builder): a blow carries
        // joules apart from its hurt, said on a power (`kinetic`, `impact`: gameworld/actions.js), a weapon or a strike, or
        // laid on a level (`knockback`); no gameworld key lays it on every level yet, a power's energy does
        knockback: { status: 'built', since: '2026-11-04', lowers: 'lib/graph/worlds/controllable/knock.js', note: 'a blow carries joules apart from its hurt: a direct hit pushes its target along the blow, an impact spreads as a shock split between the ground and what stands near; what passes a body\'s footing is thrown, an arc then a slide, a wall stopping it with a stagger; a power\'s kinetic and impact (tap, light, heavy, massive or joules), a level\'s knockback' },
        // (11-10: local, the brawler's clinch throws the body it holds, forward into the crowd or behind, and a weapon is
        // thrown with special at the first foe lined up ahead: brawl-core.js; nothing else throws a body yet)
        throw: { status: 'local', effort: 'M', pkg: 'comic-blows', requires: ['power.mechanics=knockback'], lowers: 'lib/graph/brawl/brawl-core.js', note: 'lift a body or a prop and hurl it; what it lands on takes the hit. Built in the brawler alone: its clinch throws the body it holds into the crowd, a weapon is thrown at the first foe lined up (brawl-core.js); an action hero, a stealth game or a comic hero has none (the knockback it lands with is built)' },
        // built (the destruction degree, playscape/destruct/breakability.js): a gameworld's mechanics.destruction, copied
        // onto every level it makes; how much breaks is `destruction` below
        destructible: { status: 'built', lowers: 'lib/graph/playscape/destruct/breakability.js', note: 'things break under a blow, a round or a blast into pieces and a puff, each break kept by the aftermath: a gameworld\'s mechanics.destruction; how much breaks, and by what law, is power.destruction' },
      },
    },
    kit: { source: { module: 'lib/graph/game/kits.js', table: 'KITS' } },
    rules: {
      multi: true,
      source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'engineRules' },
      // priced 10-25 (the comic hero pack): the hero's leap, a platform rule with a long rise and a landing that cracks the ground
      // (11-10: partial. Its parts run: the platform rule's stop-and-charge leap (rules-platform.js chargeMax), the vayo
      // jump on the hero's own air, the slam a hard landing staggers what is near with (knock.js); no key says the leap)
      planned: {
        'super-jump': { status: 'partial', effort: 'M', pkg: 'comic-blows', requires: ['power.rules=platform'], lowers: 'lib/graph/worlds/controllable/rules-platform.js', note: 'a charged leap several storeys high with a hang at its top and a landing that staggers what stands near: the charged leap, the air jump and the landing slam each run (rules-platform.js, vayo-move.js, knock.js); nothing composes them into one move a hero is given' },
      },
    },
    combat: {
      multi: true,
      values: {
        melee: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-melee.js' },
        ranged: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-ranged.js' },
        // built 10-12: play.battle (playscape/ui/battles.js) composes a fight of a cue, a talk menu and guarded hp vars;
        // 10-16: play.rpg (playscape/rpg) is the party's: a kernel the page runs, rounds in speed order
        'turn-based': { status: 'built', lowers: 'lib/graph/playscape/rpg/rpg.js', note: 'a party of classed characters (classes switched, each with its own rank and skill tree) against packs of foes in rounds: attack, skills, items, guard, flee; elements, statuses, xp, levels, gold and drops (play.rpg); the one-on-one play.battle remains' },
        // built 10-19 (strategy board): fought on the board's spots, not in a window over a frozen field
        tactics: { status: 'built', requires: ['space.board=spots'], lowers: 'lib/graph/gameworld/board-levels.js', note: 'battles.on: board: each stage that meets packs a tactics battle on its own ground, the book\'s party deployed (classes, ranks, skills, gear carried), speed turns of move, act and face, facing and height, a plain foe mind, spoils into the party' },
        // built 10-15: a one-on-one fight from the side as its own frame simulation (versus/versus-core.js: 60 Hz, integer
        // millimetres; normals, specials, supers, throws, blocking, rounds), played by two local players or the CPU. A
        // quick game's goal fight; the World page draws it on a stage arena (scene/channels/versus.js).
        // 11-08 (the fight on any level): a level that names a lane is fought on (versus-lane.js: a stage, a greybox), its
        // characters fighting with their own strikes on their own models (versus-hero.js, versus-character.js)
        versus: { status: 'built', lowers: 'lib/graph/versus/versus-core.js', note: 'a 1v1 fighter from the side: a frame simulation of normals, specials, supers, throws, blocks and rounds, two local players or the CPU (quick goal fight), fought on a stage arena or on any level that names a lane (versus-lane.js), its characters\' own strikes and models' },
        // local 11-09 (1109-gen-bodywork): the brawler, many bodies down a belt, two sides, each a compiled fighter (the
        // fight's frame data: the same frame, damage and recovery), the crowd's mind (two close in, one swings at a time),
        // waves, the clinch and its throws, the street's things, a boss; built as its own sim and its practice yard, reached
        // from a greybox's `brawl` block, not yet from design_game
        brawl: { status: 'local', effort: 'M', pkg: 'brawler', requires: ['space.levelForm=belt'], lowers: 'lib/graph/brawl/brawl-core.js', note: 'a beat-em-up down a belt (brawl-core.js, brawl-crowd.js, brawl-moves.js): many bodies, the crowd taking turns, waves held at gates, the clinch and its throws, the street\'s things, a boss; its practice yard (brawl-practice.js) and readouts in mana-ui; reached from a greybox\'s brawl block and the spikes, not yet from a gameworld' },
        // local 11-08 (1108-realism-combat-tester): a big gun on a mount (worlds/controllable/turret.js), aimed by hand on any
        // base, its rounds' flight and drag (ordnance.js) and what they do to matter (terminal.js: a hole, a breach, a
        // spall, a crater); played on the artillery range, not yet from a gameworld
        artillery: { status: 'local', effort: 'L', pkg: 'crewed', lowers: 'lib/graph/gameworld/combat/artillery.js', note: 'one gun on a mount aimed by hand on any base (a plinth, a tracked hull, a field vehicle, a walker, a fighter, a helicopter, a boat), its rounds flown with drag and answered by matter (ordnance.js, terminal.js); the artillery range only, not yet from a gameworld' },
      },
    },
    // how much of a world breaks, and by what law (a gameworld's mechanics.destruction, breakability.js DEGREES): counted
    // breaks by degree, or `physical` (11-03, destructible physics, internal name rupa: worlds/controllable/rupa.js, opt-in,
    // never a default): matter broken by what it is made of. Web only
    destruction: {
      values: {
        none: { status: 'built', note: 'nothing breaks' },
        objects: { status: 'built', lowers: 'lib/graph/playscape/destruct/breakability.js', note: 'the action default: crates, barrels, pots, glass and planks break under a blow' },
        cover: { status: 'built', lowers: 'lib/graph/playscape/destruct/breakability.js', note: 'what a fighter hides behind breaks too: a firefight eats its cover' },
        world: { status: 'built', lowers: 'lib/graph/playscape/destruct/breakability.js', note: 'walls and structures break, counted blow by blow' },
        physical: { status: 'built', since: '2026-11-03', requires: ['power.mechanics=destructible'], lowers: 'lib/graph/worlds/controllable/rupa.js', note: 'matter breaks by what it is made of: joules against toughness, load paths so a building stands or falls, plastic matter dented and holed, panels torn off, fire that spreads by its heat, ground that craters and is dug, water that floods and pools, trees felled, dust and smoke on the one wind; a geocube says what its world is made of; only when asked' },
      },
    },
    // built 11-10 (1110-practice-room-slice): how a hero's melee is played. `strike` the body's own blow, one swing a
    // press; `strings` the combo manifest (gameworld/combos.js): moves chained at their cancels into strings, launchers and
    // the juggle, air strings, specials on a modifier and an MP pool, weapons stepped through, a sidearm; a world's
    // `arsenal` (arsenal.js), a template's kit (Fallen Angel's, Fable of Artesia's) or edits over it, laid on every
    // level's hero that strikes. Its practice room (practice-room.js) plays it before any level; its measures
    // (feel/measure.js) hold the runtime to what each move asks
    moveset: {
      values: {
        strike: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-melee.js', note: 'the held weapon\'s swing, one a press, its contact the swing\'s downstroke' },
        strings: { status: 'built', since: '2026-11-10', requires: ['power.combat=melee'], lowers: 'lib/graph/gameworld/arsenal.js', note: 'the combo manifest (combos.js): strings chained at their cancels, launchers and the juggle, air strings, specials and MP, weapons and a sidearm; a world\'s arsenal, a template\'s kit; measured move by move on its practice room' },
      },
    },
    // built 11-07 (the action slice): what a hero does against a blow, the feel card's guard lowered onto the runtime
    // (feel/lower.js): a held block with its blockstun, push back and stamina cost, a guard met inside its window a parry
    // that staggers the attacker open; the orbit camera's lock-on (worlds/controllable/lock.js) beside it
    defence: {
      values: {
        none: { status: 'built', note: 'a blow lands or misses; the dodge is the hero\'s roll' },
        guard: { status: 'built', since: '2026-11-07', requires: ['power.combat=melee'], lowers: 'lib/graph/gameworld/feel/lower.js', note: 'a held block: blockstun and push back, each blow met costing stamina, the guard broken into a stagger when it runs dry; the walk slowed to the guard\'s share (a feel card with a guard)' },
        parry: { status: 'built', since: '2026-11-07', requires: ['power.defence=guard'], lowers: 'lib/graph/gameworld/feel/lower.js', note: 'a blow met within the guard\'s first moments is parried: the attacker staggered open for the riposte; every foe\'s blow can be' },
      },
    },
    // built 11-05 (game feel, gameworld/feel/): how the hero's motion is tuned. `default` the runtime's own numbers; `card`
    // a card of the action lab (a platformer's, an action game's, a template's) lowered onto the hero's platform rule
    // (lower.js) and held to the lab's numbers (scripts/spikes/action-lab/verify.mjs): the jump's arc and its coyote and
    // buffer, the run and its turn, the sprint on a stamina gauge, the dodge, the strike's contact and hitstop
    feel: {
      values: {
        default: { status: 'built', note: 'the runtime\'s own motion' },
        card: { status: 'built', since: '2026-11-05', requires: ['power.rules=platform'], lowers: 'lib/graph/gameworld/feel/lower.js', note: 'a gameworld\'s feel: an action lab card lowered onto the hero\'s platform rule and held to its numbers: the jump\'s arc, coyote and buffer, the run and its turn, a sprint on a stamina gauge, the dodge, the strike\'s contact and hitstop; the vayo moves tuned by it' },
      },
    },
    // built 11-08 (1108-realism-combat-tester): how a gun plays. `simple` a round on its cone and a cooldown; `realistic`
    // small arms as small arms: a spread that builds and settles once the trigger rests, a climbing recoil, rounds by
    // cartridge with their flash and their blow marking what they hit by its matter, the gun in the hero's hands over the
    // shoulder or gloved in first person, a quick knife in the free hand; measured by the combat book (combat/measure.js)
    gunplay: {
      values: {
        simple: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-ranged.js', note: 'a round on its cone, its cooldown and magazine' },
        realistic: { status: 'built', since: '2026-11-08', requires: ['power.combat=ranged'], lowers: 'lib/graph/gameworld/rounds.js', note: 'a spread that builds and settles, a climbing recoil, rounds by cartridge, their blow marking matter, the gun in the hero\'s hands, a quick knife; a shooter\'s goal or a hero carrying arms; measured by the combat book' },
        // local 11-10 (1109-run-and-gun): the run & gun's guns on the brawler's belt, rounds that FLY slow enough to see and
        // step off (never a hitscan), lobs and bursts, a stream that cannot pin a body, poise; the gunner's buttons (eight
        // aims, plant, roll, a grenade), the shooting crowd firing on a warning, entrances, cover and riders; its practice
        // the range and its wave tester (brawl-practice.js, brawl-waves.js); waits on the brawler's door
        arcade: { status: 'local', effort: 'M', pkg: 'brawler', requires: ['power.combat=brawl'], lowers: 'lib/graph/brawl/brawl-guns.js', note: 'the run & gun\'s guns on the belt (brawl-guns.js, brawl-gunner.js): rounds that fly and are stepped off, lobs and bursts, poise, eight aims, a roll, the shooting crowd on its warning; its range and wave tester (brawl-practice.js, brawl-waves.js)' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS' } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS' } },
    summons: { multi: true, source: { module: 'lib/graph/board/board-battle.js', table: 'BOARD_SUMMONS' } },
    // resource, stamina, unlock, transform, equip: stats, cues, HUD and menus on the bus, fired by their keys
    systems: {
      multi: true,
      source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS' },
      // built 10-12: a pad the player uses (E) wakes what stands asleep there, paid from a var (a cue's if and add): a
      // defence's towers. Free placement on a board's spots: maze (10-19).
      planned: {
        place: { status: 'built', lowers: 'lib/graph/playscape/ui/cues.js', note: 'on pads: a cue (use, if: gold, add, spawn) wakes what was minted asleep there; a defence\'s towers (quick goal defend); on any free spot of a board: maze' },
        // built 10-19 (the strategy board): the maze defence's placement
        maze: { status: 'built', requires: ['space.board=spots'], lowers: 'lib/graph/board/board-td.js', note: 'a tower on any free spot of a board, paid from the purse, where every gate and every walking foe keeps a way to the base: the road bends round the towers (board td; quick defend with board)' },
        // priced 10-19: the real-time strategist's verbs
        // built 10-19 (the strategy board): the skirmish's orders
        orders: { status: 'built', requires: ['space.camera=tactical'], lowers: 'lib/graph/board/board-rts.js', note: 'select a unit or a box of them and order it: move, attack-move, attack, hold, stop, gather; buildings train for gold and send out to a rally point; an enemy mind plays the other side (board rts; quick conquer)' },
        // built 10-19 (the strategy board): a side's ladder, its technology what it fields
        // built 11-03 (triggered breaks, worlds/controllable/trigger.js, an opt-in builder): the game or the player sets off
        // what a world can break, a cue's effect on the bus, the breaks coming back as happenings a cue waits on
        triggers: { status: 'built', since: '2026-11-03', requires: ['power.mechanics=destructible'], lowers: 'lib/graph/worlds/controllable/trigger.js', note: 'a cue (a zone entered, a lever, a timer, a boss\'s fall) sets off a blast, a collapse, a break or a dig, and a later cue waits on what was breached or fell; counted breaks or destructible physics alike' },
        research: { status: 'built', requires: ['power.systems=orders'], lowers: 'lib/graph/board/board-rts-tech.js', note: 'each side a civilization whose technology is its roster (hand weapons arm infantry, armour is heavy, machine weapons are siege, a turret shoots), climbing a ladder researched one step at a time: its machines, then its showpieces, and income steps; drawn as crafted (quick conquer sides)' },
      },
    },
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN' } },
    // the gear that moves the hero through the air, its directions held by the gear: a line to a face above and ahead (a
    // swinger), and later one to an edge or a roof (a grapnel) or two to any face in a cone (a twin hook). The city stalker (10-19)
    gear: {
      values: {
        none: { status: 'built', note: 'the hero\'s own legs: jumps, glides and climbs' },
        // built 10-19 (phase 3): a body owner after the wall, the line to a face found for the hero
        swinger: { status: 'built', lowers: 'lib/graph/worlds/controllable/swing.js', note: 'a line to a building\'s face above and ahead, found for the hero (rule.gear), swung on under a pivot drawn toward the hero\'s line, its arc clear of the street, released with its speed; a zip to the face from the ground; no face in reach, no swing' },
      },
    },
    // the moves a power gives the hero (gameworld/actions.js TRAVERSAL_MOVES: a power's `move`), found or started with:
    // the second jump, the glide, the high jump, the wall and the line (which unlock space.traversal=wall and
    // power.gear=swinger), and the vayo moves (11-04, rupa-vayo: worlds/controllable/vayo-move.js), special abilities that
    // move the hero on its own air, shaped by the power's element, tuned by the game's feel card
    moves: {
      multi: true,
      source: {
        module: 'lib/graph/gameworld/actions.js', table: 'TRAVERSAL_MOVES',
        since: { 'vayo-dash': '2026-11-04', 'vayo-jump': '2026-11-04', 'vayo-air-dash': '2026-11-04', 'vayo-jetpack': '2026-11-04', 'vayo-flight': '2026-11-04' },
      },
    },
    idiom: { source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS' } },
  },
});
