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
| `roll`, the roll room | a world whose levels roll (`roll`) | a yard whose cover, gems and start a seed picks, on the game's own hero: a different map each time, and which forms of cover stop this hero |

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

- the roll room's yard (`roll-room.js` `rollRoomMeasured`), as `practice.measured.roll`: a sample of its seeds walked by
  the seeds audit (`game/roll-audit.js`), and each form of cover laid across a lane with the hero run at it, jumping. A
  wall is cover only while the hero cannot go over it, and that is its feel's to say: a hero on its feet is stopped by a
  crate, one with an air jump goes over a 2 m wall. A law lost, or a hero no form stops, is advised as a `roll` step.

A law lost is advised as a `feel` step in the readout's `next`, never a refusal. The eyes gate is the operator's: a
room played is the only way to know it feels right.

## The roll room

A level with a `roll` is a case that plays a different map each time: its seed picks which of its blocks stand, which of
its pickups lie and where the pilot sets out. The roll room is that, on a flat walled yard, before any level: three lines
of cover (walls, low walls, crates and a pillar), five gems and three starts, none of whose rolls shuts the yard. The
page says the roll being played (its seed, what stands, how many gems lie, the start) beside the measures; R rolls the
next seed and Shift+R the one before (the page's own `?seed=`). Its CLI is `scripts/spikes/roll-room/room.mjs`, which
needs no database: `--feel <template>` builds the page on a stand-in, `--measure` reads every template.

### The course, for a hero that runs on momentum

A feel on the pinball base has no use for a yard to walk. Its roll room is the rolled course (`roll-course.js`): a lane
seen from behind the hero, three lanes wide, with a slot every so many metres in which a seed stands a hurdle, a block
or a wall of posts that leaves an outer lane open. The course is sized by time, not by reach. `paceOf` measures the
hero on the shipped rule: its top speed, the window in which a jump clears each thing, and how long a lane change
takes when steered as a player learns to (the sideways speed builds and keeps, so the push must be taken back in
time). A slot stands every (the neediest ask + a rest) of the top speed. The sight a course asks of its level is
(its need + the player's reaction) × the hero's speed.

The course is dressed by role, not thing by thing (`course-dress.js`): the way, the two kinds of ask (go over, go
round), their tells and the exit each have a colour from a theme card, the rail yard first. A tell is paint that
carries a measure: a jump's window is painted on the way as a strip, and arrows before a set of posts point at the
open lane from where the lane change must begin; each is part of its ask's rolled thing. The dress has a gate of its
own, measured in OKLab: the asks are read against the way, told apart by hue, louder than anything that is not an
ask, and told ahead in their own hue.

Where the eye is on a course, and so what is worth making, is in [course-dress-principles.md](course-dress-principles.md):
the screen in thirds from top to bottom (where stuff comes from, where it comes to view, where you react), the
vanishing point on the upper line, a third of the screen the size of one designed piece. The course is followed by
a camera that frames those bands (`course-view.js`), and the room's readout says whether it does (`view`).

The course is drawn for the design book as a course map (`course-map.js`: the course from above, on its side, read
left to right, with its asks, its tells, a run through it and its flanks as lettered cells), at
`bible?book=practice&room=roll&view=map`.

Its machine gate is the reaction bot, which knows how to play and lacks what a player lacks: it sees a thing only
inside a sight distance, and acts on it only a reaction time after. The room's readout says whether a 0.4 s reaction
with the course's own sight runs a sample of seeds clean, and whether a 0.8 s one still finishes. The bot is the same
on every run: it finds what is possible, not what is comfortable.

## Not here yet

The brawler's yard and the run & gun's range (`brawl/brawl-practice.js`) join the door once a world can be a brawler.
