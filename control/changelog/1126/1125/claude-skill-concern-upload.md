### Claude flows: the plugin's skills route, so each session reads less

- **The main skill sends a start to its skill.** A start skill that covers the ask (a character, a game, an object, a
  3D exhibit, a home or a room) is used directly; `forward_context`, the routing index, is read only when none does.
- **The plugin's preamble is its own short text.** Under the Claude plugin profile the initialize preamble says what
  mojulo is, that the skills route with `forward_context` behind them, the recipe and gate rules and the secrets rule;
  npm and source builds keep theirs byte for byte.
- **Shorter skill descriptions.** Each start skill's description, read in every session, keeps its lead and the first
  of the person's words that fit half the old budget.
- **The plugin's forward_context leaves the starts to their skills.** Under the plugin profile its character, game,
  object and house rows (and the exhibit's clause) are one line naming the start skills, with what those rows routed
  that no skill carries kept beside it; every other build reads the index unchanged.
- **The repo's own skills describe themselves in a sentence or two**, use case first, their arguments in
  `argument-hint` (`.claude/skills`, read in every session in this repo: 8.6 KB of descriptions to 3.3 KB).
- **CLAUDE.md sheds its architecture map** to `docs/architecture-map.md`, a pointer left in its place.
- plugin.json is `3.2.0-rc.2` while 3.2 is prepared (a change to the plugin moves its version, or an installed copy never
  updates); the release sets 3.2.0.
