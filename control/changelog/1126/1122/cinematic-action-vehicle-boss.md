### Cinematic action game: the siege walker, fought as a boss

- **A boss fought in phases** (`rule.boss`, worlds/controllable/boss.js, opt-in): one big body that is not shot down but
  taken apart. Each phase is a way it fights and a way it is beaten, each named in the rule (`phases`, each `then` the
  phase it is forced into), and its weak spots are data (`spots`: where each one is on the body in each form, what hurts
  it, from where it can be hit, what its loss does). Two kinds of phase: a WALKER stands and lays a barrage on the pilot
  (its shells' and missiles' landing places drawn as rings on the ground as they are fired; a burst hurts a pilot in its
  reach, less toward its edge, half through cover and nothing behind it: the line from the burst to the chest and to the
  head, each blocked by a collider), reloads standing with its tails, and walks on to where its first shell fell; a TANK
  drives to a ring round the pilot, lays its gun at its traverse (a sight line from the muzzle, blinking once locked) and
  fires along the line, bursting on the first thing it meets. The PILOT'S MINES are an item of its carry (carry.js): used
  from the item menu, one is laid at its feet and armed a second later; the boss's tread sets it off (a walker's leg on
  the mine's side, worn together to `legs.break` it cannot stand; a tank's drive broken for `stun` seconds). Crates of
  mines are walked onto. A round reaches a spot through a body of its own (`rule.bossSpot`), put where the spot is each
  step and hittable only from where the spot can be hit (behind it, off its side); a sleep dart hurts no machine. A
  broken stand is a beat of staggering and the frame's own fold (`transform:tank`). Destroyed, the mission holds its
  item (`down.item`). Seeded dice only. It wraps the world's step: every other page keeps every byte.
- **The siege walker as the boss** (gameworld/combat/boss-fight.js `siegeWalkerBoss`): the mecha shelf's siege walker,
  rigged as the artillery range rigs it, its two phases. Standing: barrages, its tails reloading it (eight seconds; 1.8
  times that with one reloader shot down from behind, three times with both), its legs broken by mines laid where it
  will walk (three mines). Folded: the tank, its spots the tank's (its engine deck from behind, its sights from anywhere:
  shot out, its aim scatters and its lay slows) and those its fold opens: its HIPS, bare between its folded legs, from its
  sides (each one shot out, its turn and its traverse slower, its core hit), and its reloaders still on its back. Its
  spots stand on its own bodies in each form (frames.js `places`).
- **How a tank is beaten, once** (`tankPhase`, `tankSpots`): the tank's phase and its weak spots as their own words, so
  any tank of the game is fought the same way (a mine under its wheels, keep moving round its slow traverse, its engine
  from behind) with spots of its own.
- **The tails' reload, as a clip** (frames.js `frameBase(…, { reload: true })`): a frame whose backpack is served by twin
  tails carries `tails:reload`, both tails turned from stowed to the spare behind their weapon, up to the weapon's
  magazine and stowed again (the backpack's own tail poses, each stretch eased, its keys placed by the chain as the fold's
  are). Opt-in: a frame base asked for nothing new is as it was.
- **The fight shown** (scene/channels/controllable/boss-view.js, emitted only where a body has `rule.boss`): the walker's
  howitzer and launcher turned on their mounts by its aim, a reloader shot off gone from its back, the shells and missiles
  on their arcs, the rings closing as they come, the bursts, the mines blinking, the tank's sight line; a mark on each
  weak spot of the phase (lit where the pilot stands to hit it, dim where it must go round), smoke from what is shot out;
  its HUD (what it is doing and for how long: the reload is the window; its core's bar and a pip a part; the mines left;
  the pilot down, R to try again). Its sounds are the SFX shelf's (`audio.boss`), its footfalls each foot's planting.
- **Played with the operative** (scripts/spikes/mission/boss.mjs, siege.json): level 1's boss as a page, the test apron
  behind the hangar with its cover (jersey barriers to crouch behind, containers, crates), mine crates and supplies, the
  operative's mines first in its item menu (a tap of H lays one). The hangar's hall opens onto it once the proof of the
  siege walker is held (hangar.mjs `apron-door`). `--tank` starts the walker folded, to try the second phase alone.
- What lifting it onto the rail would take: a level's boss as a recipe key read by the game rail (the boss's place, its
  frame, its tune), its HUD on mana-ui (its panel is the page's own DOM today), its fight in the game book's foes chapter
  and its audit (a fight proved headless: the boss.test.js worlds as the measure), and the hangar's door as the play
  shell's hop.
