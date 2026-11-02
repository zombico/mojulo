### The world clock: a live world's time slowed, held and ramped on what happens, the camera keeping real time

A world's `tempo` names moments that fire on what happens in play: a blow landing, a foe going down, the
last foe going down, a dodge. While one plays, the world steps slower or holds for a while and ramps back, and the
camera keeps real time, moving through the moment. That brings slow motion, the freeze and bullet time into play, on
the clock the impact cam will ride (`control/lib/graph/worlds/controllable/world-clock.js`).

- **The moments.** `tempo: { moments: [{ on, scale, hold, ramp?, cooldown? }] }`.
  - `on`: what fires a moment:
    - `strike`: a melee connect;
    - `down`: any body downed;
    - `down:foe`: a body other than the pilot downed;
    - `last-down`: the last foe downed, a finisher;
    - `dodge`: the pilot dodging;
    - any other name, fired from outside by the page.
  - `scale`: the world's speed, 0 (held) to 1.
  - `hold`, `ramp`, `cooldown`: real seconds.
  - A slower moment takes over a faster one, eased from where the world is. A cooldown keeps a multi-kill from
    ping-ponging the clock.
- **The words.** `finisher`, `kill-cam`, `impact` (a heavy blow holds the world for a beat, a foe going down slows it)
  and `bullet` (a dodge slows the world). A list mixes words and moments. The live world's manual says them.
- **The camera keeps real time.** The world steps at the scale and the camera's rule at the real step, so it moves
  through a held world. A freeze holds every body still while the camera goes on. A hitstop's frames run on the world's
  scaled clock.
- **The page.** A world with a tempo composes the clock into its page. The bodies, their clips and their effects step on
  the world's time; the camera, the HUD and the input step on real time. `window.__mojTempo` says where the clock is
  and fires a moment by name. The web page plays it; Godot and Roblox step on real time (marked absent).
- **A game's tempo** (`design_game`, `control/lib/graph/gameworld/tempo.js`). A gameworld's `tempo` (a word, moments,
  or `'auto'`) is laid on every level. `'auto'` is the game type's own: an action game slows on its finisher; the
  realistic, platformer and pinball flavors keep real time, where a blow's weight is the hitstop's. The gameworld's
  juice card names it.
- **The impact cam's bridge.** A moment that fires cues the live shoot plan's shot waiting on `tempo:<what fired it>`.
  A close-up with `on: 'tempo:last-down'` cuts in as the finisher slows the world.
- **A fix on the way.** A live world with a shoot plan stopped on its first frame. The world probed its ground through
  the camera gizmos, whose frustum has no lines until the camera is posed. A live plan's gizmos now take no raycast;
  every other plan's page is unchanged.
- **The cosmos cube.** The Time facet's `tempo` values (slow, ramp, freeze and bullet) are built for play on the web,
  through the world clock. A replay in play is the gap left: a recorded world clock, a moment shown again from another
  camera. Its package (`replay`) replaces the world clock's on the hillclimb page.
  - Of 500 random worlds, 160 are now makeable (129 before).
  - Of 500 worlds near the genre probes, 343 are (329 before).
- **Absent, nothing changes.** A world without a tempo gets no state, and its page keeps every byte.
