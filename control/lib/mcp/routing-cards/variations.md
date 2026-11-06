---
{
  "id": "variations",
  "name": "Variations of a design, in passes",
  "summary": "n visual takes on anything already made, from a concept in words: colour, size, silhouette, surface treatment, detail; freshly rolled so no two orders look alike, routed to the department that owns it, worked pass after pass.",
  "when": "\"give me five versions of this sword\", \"show me some alternatives for this chair\", \"palette-swap this monster into elemental versions\", \"make a few faction liveries of the jeep\", \"spin out variants of this prop so I can pick\", \"a kaleidoscope of takes on my boss\", \"more like the second one, less like the third\"",
  "entry": "run_experiment_sweep"
}
---
→ `run_experiment_sweep({ ref, concept: 'darker, corrupted elites', n: 4 })`: the design at `ref` read by its leaves (any kind), only what is seen varied (ids, positions and gameplay numbers never), each variant minted into one folder (the gallery is the contact sheet), `ref` unchanged. Show the folder; the eyes gate is the person's. Next pass: `keep: [refs liked]`, `reject: [refs not]` (kept ones are crossed). `principles: { lock: [ptr], palette: [hex], bounds }` hold what must not move; `at: '/parts/blade'` narrows; `spread: 'wild'` goosed, `'near'` refine; `roll` (in the answer) replays one order. Take one onto the design: its `patch` through `update_sketch` (a game's: `design_game({ ref, patch })`). Inside a game, a chapter's own variations are proposed, not minted: `design_game({ ref, chapter, vary: { concept, n } })`. One value swept by hand: `{ ref, path, values }`.
