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
- The same correction in CLAUDE.md, `docs/tech-requirements.md` and `README-OUTLINE.md`. The README is unchanged: it
  says what the person gets, never how.
