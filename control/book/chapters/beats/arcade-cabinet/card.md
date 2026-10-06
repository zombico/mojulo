---
{
  "id": "arcade-cabinet",
  "name": "Arcade cabinet",
  "entry": "create_beats",
  "summary": "A ready-to-mint sfx cue pack: the eight-cue chiptune game kit — pickup, laser, jump, land, hurt, powerup, coin, lose — built from the classic gesture vocabulary. The platformer / arcade starter set.",
  "when": "game sound effects for a platformer or arcade game; pickup ding, laser pew, jump and land sounds, a hurt sting, a power-up riser, a coin chime, a game-over fall; retro 8-bit UI feedback"
}
---

A worked example over the sfx kind: the starter kit for an arcade-flavored
game, eight cues from the chiptune gestures. `pickup` and `coin` are bright
up-sweeps (coin adds a glass `ring` tail — the classic chime); `laser` is the
canonical down-sweep pew; `jump` rises, `land` answers with thump + a
lowpassed scuff; `hurt` is a sour down-sweep with a noise bite; `powerup`
climbs three flutter tiers and releases; `lose` is the three-step descending
figure ending on a low thump.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is and wire
cues into a world or game by id (bus reactions and inputs carry
`sound: '<cueId>'`), or use it as a starting point — retune the sweeps to
your game's key, or copy just the cues you need into your own pack. For
naturalistic foley (footsteps, doors, weather) see the sfx kind's own manual
and its reference packs.

## Recipe

See `recipe.json` beside this card — `kind: 'beats-sfx'` with the cues above.
Cues are one-shots; cadence and retriggering belong to the caller.

Pass the `kind` and `params` to the beats mint. The full parameter manual for
the underlying kind is its own card (`id: 'beats-sfx'`).
