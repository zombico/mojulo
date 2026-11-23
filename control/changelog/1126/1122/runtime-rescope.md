### The runtime, said as it is

Every game mojulo makes plays on its own runtime, and the docs now say so, without claiming more than it is.

- **`docs/runtime.md`**: the play runtime's layers (the world step and collision, the character controllers and the
  one jump every feel template tunes, rigid bodies and destructible matter, the event bus and the mechanics that lower
  onto it, navigation, mana-ui, rendering on three.js, sound, input, flow and saves), what the design layer above it
  adds, where an agent extends it, the gaps it has today, and what to say about it.
- **The non-claim changes** (`docs/ursa.md`): "Not an engine" becomes "Not a fidelity rival". Mojulo's games run on
  its own engine; it does not compete with Unreal or Unity on fidelity, and their teams get a handoff of levels,
  assets and the design, never the play.
- **The working description** (`get_substrate`): the pipeline-position paragraph says the games run on mojulo's own
  runtime and that the claim it makes is about fidelity, not about having an engine. "No engine runs its rules" reads
  "no outside engine".
- **The jump's missing moves** (rules-platform.js, opt-in, lowered from a feel card with its takes, as the wall and the
  dash are: gameworld/feel/lower.js): the HANG at the apex while the jump is held (`hang`); the LANDING'S LAG, a hard
  landing's or a heavy body's by its fall, the jump and the dash held in it and a jump pressed in it going as it ends
  (`landLag`); and the STOMP ATTACK (`pound`): the attack in the air turned downward, held, dropped straight, then a
  bounce attack's spring back up or a pound's or a plunge's lag with a pound's higher jump in it. A body landed on takes
  the level's stomp; a plunge's shockwave beside a body is not struck yet, and the lowering says so. Every template
  that asks for one of them now gets it on the rule its game ships; a rule without them is byte-identical.
- **A sound on its side** (opt-in): a game's `sound.pan: true` (gameworld/sound-sheet.js, the sound card) asks the SFX
  mixer for its `pan` (beats-manifest.js `checkSfxMix`, a world's), and the page then hears each placed effect on the
  side its source is, round the camera's yaw where a camera is steered, else the pilot's facing (scene/channels/audio.js
  `__side`: at most 0.8 to a side, eased in over the first 4 m), through a stereo panner after the cue's fader
  (beats-kernel.js `sfxCue`'s `place.pan`; `renderBeatsOffline({ pan })` renders one so). A sound was already placed by
  its distance; its direction is new. Absent, not a byte of it is on the page and every cue is centred as it was.
- **A program for play** (opt-in, game/events-program.js): a level's `events.program: { source, params?, seed?,
  budgetMs? }` runs in the code realm as the level resolves (worlds/world-scene.js), the way a workbench's program makes
  its parts, and returns the bus's data (vars, sources, reactions, watches, timers, sequences, hud), joined to the level's
  own rows; ctx is the level's anchors and entity ids. The page carries only the data, so it needs no fence and the same
  program resolves to the same bytes; a program that throws, runs past its budget or returns something the bus does
  not take fails the resolve with its message and its log. An action world keeps a raw block's program in its recipe
  (scene-action-world.js); the `action` card says how. A level without one resolves as it did.
- The same correction in CLAUDE.md, `docs/tech-requirements.md` and `README-OUTLINE.md`. The README is unchanged: it
  says what the person gets, never how.
- **Two browser tests wait in frames, not seconds** (`scene-takes.live.test.js`, `jrpg-town.live.test.js`). A take
  plays on the line's clock and the town steps its reach once a frame, at most 0.1 s a frame, so a CI runner drawing in
  software under a shard's load missed their wall-clock waits (each failed once in CI and passed in the other attempt
  and locally). Each wait now gives the page a number of frames (a take's length at 0.1 s a frame, twice over; 60 for
  a reach or a cue), and the tests' own time limits were raised to match.
