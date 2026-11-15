# Practice rooms

A game's play tried before any of its levels exist. Each room is a greybox on the runtime the game ships, built from
the world's recipe alone: the run's hero and foes where they are made, stand-ins where they are not. Rooms are where
the feel chapter's choices are played and measured, and where a game's weapons are tuned before a level is laid.

## The door

`gameworld/practice.js` picks a game's rooms by how it plays (`practiceFor(world)`), never by a list of games:

| Room | Who has it | What it tries |
|---|---|---|
| `practice`, the action room | a feel template that fights hand to hand, or any world with an `arsenal` | swings, strings and cancels, launchers and the juggle, weapons, guard and parry, on a foe that falls and comes back |
| `platform`, the platform room | a platformer's template (its base feel, or a wall kick or a stomp among its moves) | steps, a gap, the double jump's ledge, the wall kick's chimney, foes to stomp |
| `mount`, the mount lane | a world with `mounts` | the horse's gaits, its jump's clearance, the fences, the turn |
| `range`, the firing range | a world that carries guns (below) | the guns from the eye: rounds and seconds to drop a body at 5, 15 and 30 m, cone and climb, marks by matter, switching, the knife |
| `mission`, the first mission | a world that carries guns (it has a firing range) | the range stretched into a level: a section for each band its guns are for, a task in each, the way on sealed until it is met; briefed, played and debriefed on mana-ui: [missions.md](missions.md) |
| `artillery`, the artillery range | a template that owns a machine (`TEMPLATE_FRAMES`) | the machine walking, transforming and driving, its own guns laid by hand onto stands of matter |
| `room`, the game room | a world that fights hand to hand, works a shift or has foes (a shooter and a platformer keep to their own rooms) | one room composed for the game out of room primitives (cover, pillars, decks, counters), its brief read from the world, held to the room laws, played by its hero (its own, or a mascot) with its foes on their spots: [game-room.md](game-room.md) |
| `work`, the work room | a quick work game (`goal: 'work'`) | its Shovels & Buckets shift in a conceptual space seen from overhead: the recipe drawn on the floor as arrows, the work shown in pips over each station and shelf, crates, stations worked by standing at them, shelves, the hand-in; a mascot worker (its form, `orb`, `sprout` or `toon`, chosen from the presets, carried inline) or the world's own hero, and its movement (a feel template, the world's own or the everyday walker), both chosen on its page (`&cast=<form>&feel=<template>`); the shift measured by the work proof at the template's run |

A template whose fights run elsewhere says so instead of opening a room it does not play (`practice-room.js`
`FIGHTS_ELSEWHERE`): the fighting game's own lab, the RPG's battles, the stealth game's close quarters on the range's
knife. A world with no room is told why, in words.

Each room is served at `bible?book=practice&room=<id>`, listed by `design_game`'s readout (`practice.rooms`) and on the
rail, each with its own icon.

The work room and the game room keep their readout and their choices in a menu drawn by mana-ui and driven by the
controls layer, opened by the pilot's pause ([mana-ui.md](mana-ui.md#the-practice-rooms-menu)). The first mission is on
mana-ui whole: its briefing, its HUD, its pause and its debrief ([missions.md](missions.md)). The others still keep a
panel and keys of their own.

## The gun rooms

The firing range and the artillery range are a shooter's paradigm, not the action room's: their own controls (aim
down the sights, fire, reload, switch, a knife on V; walk, transform, drive and lay the gun), their own measures and
their own pages. Nothing of the melee room's model (arsenals, strings, cancels) is forced onto them.

A world's guns are read from what it already carries (`gameworld/loadout.js` `loadoutOf`), never a key of their own:

1. a quick shooter's carried kit (`quick.arms`), with the knife its free hand always holds;
2. the hero's carried items that serve `shoot`, their build words read to the kit word they name, a dressed one's look
   kept as a skin;
3. its feel template's own loadout (`TEMPLATE_LOADOUTS`), the gun side's counterpart of the melee kits.

A world that writes none of these and whose template shoots none has no firing range.

On the range's page, and in the first mission, each gun is drawn in the hands as the arms library builds it, not as
its parts' boxes ([missions.md](missions.md#the-level)).

## Measured

Both kinds of room carry a machine gate before any level, read by `design_game`:

- the action room's feel, played headless on the runtime (`feel/measure.js`), as `feel.measured`;
- the firing range's laws on the world's guns (`practice.js` `rangeMeasured`: `combat/measure.js` `combatLaws`), as
  `practice.measured.range`. The range's body is a stand-in person, so only the guns are held to the laws, never its
  run. The measures take a few seconds a gun and are kept by the guns they were taken on.

- the first mission's structure on the bus and a headless player's win on the runtime (`mission-proof.js`), as
  `mission_proof` after a run.

A law lost is advised as a `feel` step in the readout's `next`, never a refusal. The eyes gate is the operator's: a
room played is the only way to know it feels right.

## Not here yet

The brawler's yard and the run & gun's range (`brawl/brawl-practice.js`) join the door once a world can be a brawler.
