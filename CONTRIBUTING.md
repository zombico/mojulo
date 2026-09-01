# Contributing

Thanks for considering a contribution.

Mojulo has **two front doors, and they are deliberately not the same size.**

The wide one is the **recipe book** — a separate public repo of mintable recipes that mojulo reads off your local disk. Adding an entry there needs no core change, no substrate review, and no long-term maintenance promise from me. That is where contributions land best, and it is where I would like most of them to go.

The narrow one is **this repo**. Core is kernels and primitives with deliberately frozen rosters. Bug fixes, tests, docs, and localization are welcome; concept PRs will likely sit — see [Core PRs](#core-prs), where I'm straight about why.

Straight up: Claude reviews PRs here. The maintainer is one person and most read passes are AI-assisted. That shapes what's likely to merge, in both repos.

There are also four [open requests](#open-requests) — things I actively want and won't get to alone. For three of them a good issue is worth more than a PR.

---

## The recipe book — the front door

**Repo: [zombico/mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book)** · **[its CONTRIBUTING guide](https://github.com/zombico/mojulo-recipe-book/blob/main/CONTRIBUTING.md)** — Apache 2.0, same as here, with PR and issue templates. That guide is the operational one (exactly how to make and send an entry); this section is the stance behind it.

A catalog of mintable recipes — chapters of study objects, worked examples, presets, worlds, loops, objects, and shots — that a host agent operates deterministically through mojulo's own tools. Fully text and JSON. No build step, no dependencies, no UI, no loops of its own. **The clone is the library.**

```bash
git clone https://github.com/zombico/mojulo-recipe-book.git
# then, in control/.env or the environment:
MOJULO_RECIPE_BOOK=/path/to/mojulo-recipe-book
```

Restart the control plane. Without the clone, mojulo behaves byte-for-byte as before — the book is **strictly additive** and never load-bearing for core capability. Nothing is ever fetched at runtime: you clone, the substrate reads local disk. That is the same loopback posture as everything else here.

The split that makes this the wide door: **core absorbs capability, the book absorbs repertoire.** Core stays lightweight and slow-moving; the catalog takes the unbounded growth axis, stays inspectable as plain files, and stays greppable without a running mojulo.

### Two kinds of entry — the two doors

**Door 1 — `recipe` (data).** `card.md` + `recipe.json`: pure params over a kind mojulo already ships. The agent reads the card and mints through the existing tool. **Nothing from the book is executed.** Door 1 is multi-family — the card's `entry` frontmatter is the routing key:

| `entry` | goes to | book chapters today |
|---|---|---|
| `create_view`, `compose_world` | view vocab | `science/`, `math/`, `worlds/` |
| `create_beats` | beats vocab | `beats/` |
| `mint_solid`, `edit_solid` | solid vocab | `solids/` |
| `forge_motion`, `stitch_motion` | motion vocab | `motion/` |

An `entry` tool this install doesn't have is warned and skipped, not fatal — a book written for a newer mojulo degrades gracefully.

**Door 2 — `builder` (code).** `card.md` + `builder.js` (+ `builder.test.js`): a **new view kind that lands without touching core**. Mojulo's loader dynamically imports the builder at boot and registers it into the `create_view` enum and the world render dispatch. This is the one place book content executes, and it carries a contract (below). `create_view` is the only Door-2 lane today; other families' lanes get built when someone actually wants to author a kind outside core.

### Entry format

```
chapters/<chapter>/<entry-id>/
├── card.md          # JSON frontmatter + markdown body — required
├── recipe.json      # Door 1
└── builder.js       # Door 2  (+ builder.test.js)
```

`card.md` frontmatter is JSON between `---` fences: `id`, `name`, `family` (views: `science` | `math` | `bio`), `entry`, `summary`, `when`.

**`when` is the load-bearing line.** It's the intent phrasing that should recall the entry later, and it leads the embedding — it is what makes your contribution findable by meaning months from now. Write it the way an operator would *ask*, not the way a librarian would *file*. Card bodies deliberately never name entry tools (the `entry` field carries that), which keeps the prose host-agnostic.

`recipe.json` is `{ entry, kind, params, title }`. Then add the row to `manifest.json`:

```json
{ "type": "recipe", "chapter": "math", "dir": "two-branches", "id": "two-branches", "since": "0.4.0" }
```

### The Door-2 builder contract

A builder module is **pure**: no imports, no I/O, no `Math.random`, no `Date.now`. Same recipe in, byte-identical scene out, forever.

```js
export const kind = {
  id: 'my-kind',                 // the create_view enum id
  manifestKind: 'my-kind-view',  // the stored manifest kind
  family: 'science',             // science | math | bio
  title: 'mojulo my kind',
};
export function plan(recipe, ctx) { /* → { faces, movers?, fields?, bounds, stats } */ }
export function assemble(recipe, ctx) { /* → the emitThreeWorld payload */ }
```

Anything of mojulo's your builder needs is **injected, never imported** — core path aliases (`@/lib/...`) don't resolve from outside this repo. Every `plan` / `assemble` call receives `ctx.toolkit`: versioned, frozen, and **append-only**. Toolkit v1 carries `effects: { buildVolumeFrag, SDF_GLSL }`. Feature-check it (`ctx.toolkit?.version >= N`) and throw a teaching error rather than crashing; a purely geometric builder can ignore it entirely.

The toolkit grows by **demonstrated need, not speculation**. If your builder needs a namespace that isn't there, open an issue *with the builder attached* — a working thing that needs one more surface is the argument for adding it.

**The compatibility promise.** A stored artifact is a tiny `{ kind, params }` recipe that your builder regenerates on *every* render, forever. Once a kind has minted user artifacts, its output for given params is a promise you're making. `manifest.json`'s `requiresMojulo` and each entry's `since` gate code drift — a book newer than the installed substrate loads no entries and warns. Knowledge drift is tolerable; code drift is gated, never trusted.

Two gotchas already paid for: declare GLSL uniforms **once**, inside `globals` (duplicates fail the compile and you get a black canvas), and a book kind colliding with a core kind is skipped — core wins, always.

### Both gates, and say which you ran

Every entry passes two gates, never conflated (see [docs/bicycles.md](docs/bicycles.md)):

- **Machine gate** — the recipe mints clean through the real tool; Door-2 builders ship `builder.test.js` (native `node:test`, no deps) against a mocked toolkit.
- **Eyes gate** — you render it and *look at it*. A recipe that mints without throwing and renders off-frame is not done. One authored entry (`neon-arcade-sign`) minted fine, failed the eyes gate, and was pulled rather than shipped. That's the standard.

Put both in the PR: what you ran, and what you saw.

### Sending one — you probably don't author it by hand

If you've already minted something in mojulo and tuned it until it's right, **`save_recipe` writes the contribution for you**. It emits `card.md` + `recipe.json` into your cookbook in this book's exact format, because a cookbook *is* a valid book:

```
mint → tune → save_recipe({ ref, id, when }) → copy the folder into a fork → PR
```

Fork the book repo, drop the folder in `chapters/<chapter>/<id>/`, add the manifest row, bump `bookVersion`, open the PR. The merge bar there is far lower than here — an entry is a folder: additive, deletable, and it does not enlarge the substrate I have to carry. Full checklist and the PR template: [the book's CONTRIBUTING](https://github.com/zombico/mojulo-recipe-book/blob/main/CONTRIBUTING.md).

---

## Keep your own recipe book

You don't need my repo, or a PR, to have a book. **Mojulo writes one for you.**

The **cookbook** is your own book, structurally identical to the upstream one — same `manifest.json`, same `card.md` + `recipe.json`. It lives beside your instance's data (`<data dir>/cookbook`; `MOJULO_COOKBOOK` overrides) and it is **its own git repo with no remote**: mojulo makes local commits only, an inspectable ledger of what you kept. Pushing or sharing is your act, with your git. The substrate never reaches out.

The loop it closes is *mint → tweak → **keep** → recall by intent*:

```
create_view / create_beats  →  (tune it until it's right)  →  save_recipe({ ref, id, when })
```

`save_recipe` reads the stored sketch, extracts its manifest into `recipe.json`, drafts `card.md`, appends the manifest row, commits the save, and reindexes — so the entry is recallable through `get_view_vocab` / `get_beats_vocab` immediately and `semantic_search` right after. The agent writes `when` from the conversation ("the pendulum setup for my Tuesday class"), which is exactly why *paraphrased* recall still finds it months later. It covers `create_view` recipes today (core **and** attached-book kinds) plus `create_beats`; solids and motion join by the same lane pattern.

Precedence is first-wins: **core kinds > your cookbook > the upstream clone.** "Forking" an upstream entry means saving it under your own id. There is no merge machinery and there won't be.

The cookbook is **Door-1 only**, by design. Auto-loading executable code out of a directory the agent writes into is a decision that deserves its own deliberation, not a side effect of a save feature.

### Publishing yours

Because a cookbook *is* a valid book, sharing falls out for free:

- **Give it a remote and push.** A friend clones it and points `MOJULO_RECIPE_BOOK` at it. Yours is now their upstream — no involvement from me, no involvement from this repo.
- **Or copy a folder into a PR** against [mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book/blob/main/CONTRIBUTING.md). That is the entire contribution mechanism.
- Before handing it out: bump `bookVersion` and set `requiresMojulo` honestly, and **read the folder first**. It sits beside your instance data and its `when` lines were written from your conversations.

If you build a themed collection — a semester of physics lessons, an ambient-loop set, a house style of solids — publishing it as your own book is a first-class outcome, not a consolation prize for not getting merged here.

---

## Open requests

Things I actively want and am not going to get to alone. Issues, spikes, screenshots, prose, and half-formed opinions all count. For the last three especially: **a well-argued issue beats a PR.**

### 1. Math and science views — the chapters want filling

Core ships **31 science kinds, 16 math, 5 bio**. The book's science chapter has six entries, math has four, and **bio has none**. That gap is repertoire, not capability — precisely what the book exists to absorb.

- **Door 1 is nearly free.** A preset over an existing kind, plus the `when` line that makes it findable. The math chapter's model is one teaching moment per entry (`slope-equals-height`, `tangent-blowup`, `two-branches`, `area-remembers`): one idea, framed so the render *is* the argument. If you teach, your lesson settings already are the contribution.
- **Door 2 is the real ask.** A new study object core doesn't have, landing without touching core. `foucault-pendulum` (no toolkit needed) and `aurora` (volumetric) are the two worked examples to read. Fields I'd love and can't cover: statistics and inference, linear algebra beyond `transform-view`, number theory, chemistry and molecular structure, geology, ecology and population dynamics, economics — and **anything at all in bio**.
- **Corrections are wanted just as much.** If a shipped kind models the physics or the math wrong, that is a core bug, and a fix for it merges here.

### 2. Native WebGL — thinking wanted

Mojulo has two live scene backends over the *same* engine-agnostic payload (`{ faces, cameras, viewBox, unitScale, title, bg, sky }`): a dependency-free CSS-3D `preserve-3d` renderer for the looked-at Scene tier, and a three.js WebGL renderer ([scene-three.js](control/lib/graph/scene/scene-three.js), three pinned and vendored, ~1MB) for the moved-through World tier. And the effects layer already hand-writes raw GLSL — the raymarched fog overlay composites over the three.js meshes, occluding against a grid-culled scene SDF.

So the substrate is already half native, and I want to think properly about the other half. In the order I'd want them answered:

- **What would a hand-written WebGL2 backend actually buy?** Lighting is baked into vertex colours and the mesh path is unlit `MeshBasicMaterial` + `vertexColors` — a very narrow slice of three. Candidate wins: artifact size (a minted world that opens from `file://` with no CDN and no vendor blob), startup cost, full control of the raymarch composite. Candidate losses: OrbitControls, glTF read/write, and everything three quietly handles that I'd rediscover the hard way.
- **Is the payload contract already the right seam for a third backend,** or would adding one expose three-isms baked into it? A concrete port of one world kind answers this better than an opinion.
- **The effects overlay is where native looks most obviously right.** Should the raymarch layer own its own GL context and stop being a three material at all?
- **WebGPU:** distraction, or the actual answer that makes the whole question moot?

I'm not asking for a rewrite. I'm asking for a spike, a measurement, or a well-argued *"don't."*

Start at [docs/raymarch-effects-layer.md](docs/raymarch-effects-layer.md) and [docs/scene-css3d-lighting.md](docs/scene-css3d-lighting.md).

### 3. Unreal + Godot handoff — integration suggestions and idiom seams

The law at the engine seam: **mojulo authors truth at home; the edge tool consumes it and never guesses.** Engines are edge consumers, like Blender — optional, operator-hosted, never a dependency, never a runtime the substrate supervises. What crosses is a derived artifact; the recipe stays sovereign.

What exists today: an engine-agnostic **score** ([engine-score.js](control/lib/graph/scene/engine-score.js)) — colliders, spawn, cameras, entities, declarative mechanics, audio binding, plus an **honest-loss ledger** of what did *not* travel — in mojulo's z-up frame at `1 unit = 1 meter`, with each engine emitter owning its own frame and unit conversion. On top of it: a Godot project emitter and pack, and an **advisory** portability check ([engine-portability.js](control/lib/graph/scene/engine-portability.js)) that tells you at authoring time whether your gameplay lives inside the shared vocabulary — `reach-exit`, `collect`, `hazard-damage`, `fail-on-death`, `survive`. Advisory only: mojulo advises, the operator decides. Unreal is aligned-for and not built.

Where I want practitioner input, because I am not an engine person:

- **Idiom — the big one.** The generated Godot project is text, deterministic, and mine to shape. Does it read like something a Godot developer would keep and extend, or like machine output they'd rewrite on sight? Node naming, scene-tree shape, script placement, resource layout, `.tscn` vs `.tres` choices. This is taste I don't have, and it is the whole difference between a handoff and a dump.
- **Unreal's honest shape.** What *is* the deterministic-text form there? Datasmith? A JSON manifest a small editor plugin consumes? Something else entirely? I'd much rather be told the right shape once than guess at it through a release.
- **The mechanics vocabulary.** Five kinds, deliberately tiny, chosen to be expressible in both engines' idioms with no runtime of ours. What's the next one that earns its place in **both** — and what does saying it natively cost in each?
- **The loss ledger.** Movers, live physics, fx, sprite sfx, and the game shell don't travel. Which of those *should* travel as declarative data, and which are genuinely re-orchestrate-in-engine work that mojulo should keep refusing to fake? Getting this line wrong in either direction is the expensive mistake.
- **`moj:*` extras.** Exported glTF carries them as node metadata and nothing consumes them. What would a stock import pipeline in each engine actually want to find there?

`export_model` → `.glb` is already near-perfect Godot input (`KHR_materials_unlit` imports as Unshaded, `COLOR_0` lands in `ARRAY_COLOR`, FK rig clips play on a stock AnimationPlayer). The gap isn't geometry — it's whether an operator ends up with a **level** instead of a mesh.

### 4. Bug reports with a reproducer

Least glamorous, most useful. A minted recipe that renders wrong, plus the `ref` and what you expected, is a complete report — recipes are tiny and deterministic, so a paste of the manifest reproduces your bug exactly on my machine. That property is the whole reason this substrate stores recipes instead of renders; please use it.

---

## Core PRs

**Welcome here:**

- **Recipe-shaped additions** — catalysts in [control/lib/mcp/catalysts/](control/lib/mcp/catalysts/), skills, MCP tool descriptions, prompt tweaks, small fixes, docs, dead-code GC. Anything that's a row in an index rather than a change to the substrate.
- **Correctness fixes to shipped kinds** — a view that models its physics or math wrong is a bug, and it merges.
- **Localization** — new locales, translation fixes, key additions riding alongside another change. Run `/sync-locales` if you can; if you can't, that's fine.
- **Quality** — bug fixes, test coverage on the surfaces named below, doc clarifications.

**A new view kind is usually a *book* contribution, not a core one.** Door 2 exists precisely so a new study object lands without touching core, and a book entry is reviewed as a folder rather than as a change to the substrate. Core keeps kernels and primitives; the book keeps repertoire. If your kind genuinely needs a primitive core doesn't expose, that's an issue about the toolkit surface — bring the builder with it.

**Probably won't merge — and I'll be straight about why:**

Concept PRs — new rings, new paradigms, new core abstractions, changes to deliberation surfaces, anything that shifts *how* mojulo works rather than *what* it offers — will likely sit. The reason isn't that the work is insufficient, and often I won't even disagree with it. It's a maintenance-burden veto: if I can't carry the implications going forward and can't explain *why* the change is shaped the way it is, the PR stays unmerged. AI-assisted review can call a PR safe; that's not the same as the maintainer being able to live with it.

If you have a concept PR you believe in, **fork it**. Mojulo is Apache 2.0 for exactly this reason — apply the idea deeply on your own line, extract value, ship something. The license is the open door; the merge bar is the maintainer's. Those are two different doors and both are real.

## Running tests

```bash
# Bot runtime (Node's built-in node:test, no extra deps)
cd lite-template
npm install
npm test

# Control plane (Vitest)
cd control
npm install
npm test
```

Both run in CI on every PR via [.github/workflows/test.yml](.github/workflows/test.yml) — Linux + macOS on Node 20.

## Test surface

Tests target three surfaces where a regression would be either silent or load-bearing:

1. **Public attack surface.** Auth, file uploads, user-controlled inputs — anything reachable from the open internet has tests. A regression here is a CVE.
2. **Silent corruption.** Hash chains, key encryption, artifact ZIP shape — bugs that ship to a user and aren't noticed for weeks.
3. **Install success.** The README must work on a fresh clone. CI smoke-tests this.

If you're adding a test, mapping it to one of those surfaces is the fastest path to merge. Tests for React rendering, framework glue (`path.join`, route wiring), translation fluency, or IO-heavy mocked wiring tend to lock in implementation details without catching regressions a user would notice — they'll usually be asked to retarget. Coverage percentages aren't a goal.

Rule of thumb when in doubt: **would a regression here be silent, or loud?** Silent regressions deserve tests; loud ones (which throw or visibly fail the first time you run the feature) usually don't.

Recipe determinism is a fourth, quieter case of #2: a builder whose output shifts for unchanged params silently breaks every artifact ever minted from it. Character/snapshot tests are the right tool there, in core and in the book alike.

## File layout

- `control/lib/foo.js` → `control/lib/foo.test.js` (co-located).
- `lite-template/test/*.test.js` (the bot's runner uses native CommonJS, kept under `test/` to match `node --test test/**/*.test.js`).

New tests should follow the existing pattern in the package they cover.

## Before submitting

**A book PR** ([mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book)):

1. The entry mints clean through the real tool, and the manifest row is added.
2. Door-2 builders: `builder.test.js` passes, the builder is pure (no imports, no I/O, no `Math.random`, no `Date.now`), and it feature-checks any toolkit namespace it uses.
3. You looked at the render. Say what you saw — a screenshot is ideal.
4. The `when` line is written as intent phrasing, not as a filing label.

**A core PR** (this repo):

1. `npm test` passes in both packages.
2. `node --check` passes on any `.js`/`.mjs` you edited (CI enforces this).
3. If you touched `control/messages/en.json`, run `node control/scripts/validate-locale.mjs en <code>` for the locales you have changes for (the `/sync-locales` workflow handles propagation if you don't).
4. New strings in JSX are i18n-wrapped per [CLAUDE.md](CLAUDE.md).

## Further reading

- [CLAUDE.md](CLAUDE.md) — orientation: commands, invariants, architecture map.
- [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) — the headless control surface.
- [docs/POLYGONIZER-SYNTHESIS.md](docs/POLYGONIZER-SYNTHESIS.md) — the polygonizer / manji-tree substrate.
- [docs/bicycles.md](docs/bicycles.md) — the two-gate doctrine (machine gate, eyes gate).
- [docs/install-capabilities.md](docs/install-capabilities.md) — kernel, packs, and the two install-gated groups.
- [docs/chatbot/README.md](docs/chatbot/README.md) — the chatbot factory, an optional pack since 2.0.
- [TERMS.md](TERMS.md), [docs/responsibility-model.md](docs/responsibility-model.md) — the operator-owns-consequences posture that user-facing copy should follow.
