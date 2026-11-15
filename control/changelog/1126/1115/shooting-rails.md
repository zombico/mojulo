### Shooting rails: the firing range stretched into a first mission

A shooter's practice is the firing range: the agent writes the game's guns and the creator plays them. Nothing carried
that into a level: a quick shooter laid a trail with posts, a book shooter got one fixed gun, and a template's loadout
reached the range and nowhere else. A world with a firing range now has a **mission**: the range stretched into a first
level with sections and tasks, briefed, played and debriefed on mana-ui. Design notes:
[docs/missions.md](../../../../docs/missions.md).

- **The mission, composed** (`lib/graph/mission/`, pure). Sections are a closed table (staging, contact, lane,
  overwatch, emplacement, holdout, extract): each is what it teaches, the band it is sized from (the range's 5, 15 and
  30 m bodies) and the task that ends it. The brief reads the world's guns to their bands and chooses the sections: a gun
  for the mid band gets the lane, a long gun the long line too, close guns alone a room and a yard held across a room.
  The composition lays them down one line out of the room primitives, a doorway between each on alternate sides, each
  fight's foes at its band from its firing line behind cover of their own. Seeded; the same seed lays the same mission.
- **Its laws** in the game's own numbers, advice never a refusal: walkable, sealed (no way round a task), banded,
  covered within a second of the run, entry-safe, in order (it teaches before it tests), armed, paced.
- **Tasks on the bus** (`game/objectives.js`, the mechanic `objectives`): take, reach, clear, man and hold, done in
  order. A task begins as its section is walked into and wakes its own foes then; met, it opens the way on; the last met
  wins. A sealed way puts a body back. It keeps the tasks met, the foes downed and the seconds taken for the result. It
  has its vocab card and its sounds.
- **The level** (`gameworld/mission-level.js`): the range's own body (its slots, sights and knife), hunters of the
  range's health dormant on their spots, the level's hp, rounds and health on the floor, a greybox ground. With no hero
  it is aimed from the eye; a hero seen from behind aims over its shoulder.
- **Three doors:**
  - the practice door's `mission` room (`bible?book=practice&room=mission`), played from the world alone, with its
    icon on the rail;
  - a level's own form, `levels.<id>.mission: true | { seed?, sections?, foes?, hold?, waves? }`, in place of `walk`;
  - a quick shooter's `mission`, its level in place of the trail, laid from its carried `arms`.

  `design_game` proposes it (a `mission` step with its patch) for a world with a firing range and no mission level. A
  run makes the foes' figure (a gunner rolled in the game's setting), the level and the game. Its card is
  `gameworld-mission`.
- **On mana-ui, end to end** (`gameworld/mission-mana.js`, the page channel `mission`): the briefing over the held
  scene, the HUD (the level's hp, the gun in hand, the objective tracker, the yard's clock) read each frame off the
  scene, the pilot's pause and, on a page played alone, the debrief. Inside a game's shell the shell's own result screen
  is the debrief. A world with a mission and no `ui` of its own gets its shell on mana-ui in the mission's look, so the
  front, the briefing, the HUD, the pause and the result are one runtime. The look is a new theme card, `field-brief`; a
  look with an overlay across the screen is read without it.
- **Two machine gates**, read by `design_game` after a run as `mission_proof` (`gameworld/mission-proof.js`):
  - on the bus: every task done in the order written, every sealed way put the walker back, the last task won;
  - played: the level stepped headless on the runtime by a gunner that walks the laws' grid, aims, raises the sights,
    fires in bursts, takes the gun the range asks for and reloads; a still player must not win. A mission the gunner
    loses says where, with the dials that move it.
- **Fixed: a world's `ui` never reached its made game.** The runner wrote it and `create_game` dropped it, on a make
  and on a remake, so no game made through `design_game` had its shell on mana-ui. It is carried now, as `flow` is.
- The range's body is its own module (`combat/range-body.js`, re-exported by `range.js`), so what carries the same guns
  elsewhere reads the body without the page's emitter. The shooter's foe and its tune are exported from `quick.js`.
- Checked in headless Chromium: the practice page is briefed, begun, paused and debriefed; a sealed way puts the body
  back; the tracker moves on as the rounds are taken. An exported game goes from its mana-ui title into the mission and
  to the shell's result. The gunner wins every feel template that shoots and kits of a rifle, a long gun with a close
  one, and a shotgun with a sidearm, in about a minute; an SMG alone is lost in the yard, and said. Machine gates only:
  nobody has played one.
- Designed, not built yet, each named a gap: the emplacement's mounted gun (its section is in the table with what it
  waits on, and asking for it is refused with that, never laid half), a machine as the hero for a template that owns a
  frame, a dressed mission.
