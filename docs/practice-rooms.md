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
| `artillery`, the artillery range | a template that owns a machine (`TEMPLATE_FRAMES`) | the machine walking, transforming and driving, its own guns laid by hand onto stands of matter |
| `work`, the work room | a quick work game (`goal: 'work'`) | its Shovels & Buckets shift in a conceptual space seen from overhead: the recipe drawn on the floor as arrows, the work shown in pips over each station and shelf, crates, stations worked by standing at them, shelves, the hand-in; a mascot worker (its form, `orb`, `sprout` or `toon`, chosen from the presets, carried inline) or the world's own hero, and its movement (a feel template, the world's own or the everyday walker), both chosen on its page (`&cast=<form>&feel=<template>`); the shift measured by the work proof at the template's run |

A template whose fights run elsewhere says so instead of opening a room it does not play (`practice-room.js`
`FIGHTS_ELSEWHERE`): the fighting game's own lab, the RPG's battles, the stealth game's close quarters on the range's
knife. A world with no room is told why, in words.

Each room is served at `bible?book=practice&room=<id>`, listed by `design_game`'s readout (`practice.rooms`) and on the
rail, each with its own icon.

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

## Measured

Both kinds of room carry a machine gate before any level, read by `design_game`:

- the action room's feel, played headless on the runtime (`feel/measure.js`), as `feel.measured`;
- the firing range's laws on the world's guns (`practice.js` `rangeMeasured`: `combat/measure.js` `combatLaws`), as
  `practice.measured.range`. The range's body is a stand-in person, so only the guns are held to the laws, never its
  run. The measures take a few seconds a gun and are kept by the guns they were taken on.

A law lost is advised as a `feel` step in the readout's `next`, never a refusal. The eyes gate is the operator's: a
room played is the only way to know it feels right.

## Not here yet

The brawler's yard and the run & gun's range (`brawl/brawl-practice.js`) join the door once a world can be a brawler.
