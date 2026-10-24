# URSA — the model under mojulo

Status: draft (2026-10-24). A framing document, not a tool surface: nothing here is routed to, listed or loaded by the
MCP server, and the agent-facing drawers stay free of it (`get_substrate` carries no framing devices or acronyms, by
rule). The audience is a reader who wants the formal shape of what mojulo builds without the genre history behind it.
The lay explainer for the game layer is the cosmos cube; this is the model the cube is one projection of.

**Working expansion: Unified Recipe Space for Agents.** Each word names something the tree enforces: one
representation across outcomes and backends (*unified*), the seeded manifest as the source of every artifact
(*recipe*), a typed design space with a decision procedure over it (*space*), and an agent that navigates it while
mojulo holds no inference of its own (*agents*). See Open questions for the expansion's history.

Every claim below is one of two kinds, and says which:

- **Enforced** — a module or test holds it today; the pointer is the check.
- **Conjecture** — a direction the model implies and the tree does not yet hold. Never cite one as a property.

## 1. The space

**Enforced.** A game is a point in a product space: facets × settings × values. The facets are `FACETS` in
[cosmos/facets/index.js](../control/lib/graph/cosmos/facets/index.js); each facet's settings and values are its own file.
A point may be partial; an unset setting takes its default and is not checked. `validateCube`
([cosmos.js](../control/lib/graph/cosmos/cosmos.js)) rejects an unknown facet, setting or value by name.

Values are not invented in the cube. A sourced setting reads its values from the table that builds them
(`read-sources.js` → `registry.generated.js`, held equal to the live read by `registry.test.js`), so the space is the
tree's own vocabulary, regenerated when the tree changes.

**Conjecture.** The other outcome families (Print, Read, Hear, Observe) have kind registries
([world-kinds.js](../control/lib/graph/worlds/world-kinds.js), [sketch-manifest.js](../control/lib/graph/sketch/sketch-manifest.js))
but no capability marks and no sweep. The space is formal for games; for the rest it is a catalog. "Unified" is a
claim about representation (one recipe shape, one store), not yet about a shared decision procedure.

## 2. The recipe and its contract

**Enforced.** Every artifact is a row in `sketches`: a tiny seeded manifest. Renders are derived on read and are
disposable. A kernel is a pure function of (params, seed): seeded dice only (`mulberry32`), never `Math.random`,
`Date` or `Intl` in a builder, and an absent opt-in channel contributes zero bytes. A kernel's output for minted rows
is a compatibility promise; byte-identical re-render is the baseline test for any kernel change.

Edits are in place and versioned: `update_sketch` archives the previous manifest into `sketch_revisions` before
overwriting, so the row is HEAD and the revisions are history (`beats_revisions` for beats).

**Scope of the promise.** Byte identity holds per (kernel version, runtime). JavaScript's transcendental functions are
not specified bit-exact across engines or versions, which is why the substrate pins a box to the server's version.
Equality across runtimes is a different claim, held by conformance (§3), not by identity.

## 3. Lowering and backends

**Enforced.** Every value in the space names what lowers it (`lowers: 'lib/graph/…#TABLE'`). The cube is the high
level, the recipe the middle, the emitters the backends ([scene/](../control/lib/graph/scene/); native frame z-up,
1 unit = 1 m). Each value carries a mark per engine with a runtime kernel — *built*, *approximated*, *absent* —
read from the tables that engine's export reads ([engines/registry.js](../control/lib/graph/scene/engines/registry.js),
[engine-portability.js](../control/lib/graph/scene/engine-portability.js)).

`dryRun(cube)` returns the verdict — *makeable* (every set value built), *gaps* (some local or partial, named),
*blocked* (some absent, named) — and per engine, what the export loses and what it carries simpler. Lowering is lossy
and says so: the portability report is part of the output, not an apology after it.

Runtime kernels in other languages (Godot's GDScript, Roblox's Luau) are held equal to the web runtime frame by frame
on canonical snapshots over a corpus: [scripts/conformance.mjs](../control/scripts/conformance.mjs). These are second
implementations of parts of the model, which is what makes §7 a standard rather than a file format.

## 4. Relations

**Enforced, in places.** Some things are defined by their relations to a referent rather than by absolute geometry,
so an edit to the referent carries through:

- garments are built over the body's parts ([body-relational-tailor.js](../control/lib/graph/polygonizer/body-relational-tailor.js));
- wearables reach a body through adapters ([plating.md](plating.md));
- a cast is rolled in relation to its anchor, each member against the first ([egocube cast.js](../control/lib/graph/egocube/cast.js)).

Plans reference earlier results by `{ $step, path }` (`forge_plan`), a dependency graph between calls.

**Conjecture.** Relations between stored recipes (this garment on that body, this cast around that hero) are not a
first-class edge in the store; they live inside manifests or inside a plan's run. §7 and §8 need them to be addressable.

## 5. The frontier

**Enforced.** The sweep ([sweep.js](../control/lib/graph/cosmos/sweep.js)) samples the space with seeded dice and, for each
missing value, recounts how many sampled points would step up a verdict if it were built, crediting the value's
`requires` closure so nothing is counted as standing alone. Work packages price a change (`packages.js`, effort
S / M / L). [compose.js](../control/lib/graph/cosmos/compose.js) finds the exact package sets between a point and makeable,
and the pairs whose union makes points neither makes alone.

That last read matters to anyone who knows the optimization: when features complement one another, greedy selection by
marginal gain carries no guarantee, and pairwise synergy is the cheap correction. The build order is recomputed by
every sweep; the generated page is [tool-surface/hillclimb.md](tool-surface/hillclimb.md).

## 6. The agent and the gates

**Enforced.** Mojulo holds state and recipes and no LLM credentials of its own (one opt-in door excepted, named in
`get_substrate`). The agent maps an utterance to a point in the space through routing cards and vocab drawers, and
writes the recipe. Work for outside workers parks on a queue; the agent pulls it.

Verification is stamped, never assumed. A **machine gate** is measured by the server (a world's physics probed tick by
tick, a level's traversal audited, conformance run). An **eyes gate** is a person who looked. They are never
conflated, the eyes gate is never claimed by the system, and every gate advises and stamps rather than refuses
([bicycles.md](bicycles.md), [responsibility-model.md](responsibility-model.md)).

## Non-claims

- **Not an engine.** "3D" is a pipeline position. Mojulo feeds Godot, Unity, Unreal, Blender and the printer; it does
  not compete with them on fidelity.
- **Not universal in the computational sense.** The space is finite and its gaps are named; a law a scale lacks is a
  gap, never approximated. The sweep exists to measure what is not makeable.
- **Not a cloud.** Single operator, loopback only; no tenancy, no hosted counterpart, no registry mojulo runs.
- **Not bit-identical across runtimes.** See §2.

## 7. Sharing: a standard recipe

What travels today: a folder of `card.md` (frontmatter `id`, `name`, `entry`, `family`, `summary`, `when`) and
`recipe.json` (`{ entry, kind, params, title }`) under a `manifest.json` with `bookVersion` and `requiresMojulo`
([cookbook.js](../control/lib/graph/views/recipe-book/cookbook.js), [cards.js](../control/lib/graph/views/recipe-book/cards.js)).
A cookbook is a valid book; first-wins by card id; forking is saving under your own id; git has no remote and sharing
is the operator's act. That posture stays.

What does not travel, and what URSA would carry instead (**conjecture**, an envelope for discussion, not a format):

```jsonc
{
  "ursa": "0.1",
  "recipe":    { "kind": "double-slit", "params": { "scenario": "particles" }, "seed": 7 },
  "id":        "sha256:…",              // the recipe in canonical JSON, hashed: same recipe, same id, anywhere
  "kernel":    { "kind": "double-slit", "mojulo": "3.1.1" },
  "expect":    { "render": "sha256:…" },// what the sender's re-render produced
  "coords":    { "cosmos": { /* a cube */ } },        // games: the receiver runs dryRun on their own install
  "marks":     { "godot": "built" },    // as minted; the receiver's dryRun is authoritative
  "gates":     [{ "kind": "machine", "check": "traversal", "result": "pass" },
                { "kind": "eyes", "by": "<person>" }],// an attestation by a person, never inferred
  "relations": [{ "role": "worn-by", "ref": "sha256:…" }],
  "lineage":   { "forkedFrom": "sha256:…" },
  "trust":     "data"                   // or "code": a recipe carrying a `program` runs with the operator's privileges
}
```

Two consequences:

- **Compatibility is computed, not declared.** `requiresMojulo` (a range) gives way to the receiver's own `dryRun`.
- **Keyed on kind, not on tool name.** `entry` is a tool name, and a tool fold rewrites every pointer to the old name —
  but a recipe already shared cannot be rewritten. `kind` is the stable key; `entry` is a hint, resolved through an
  alias table (precedent: `create_polygonized_sketch`, a retired alias still answering).

Conformance levels:

| level | claim | seed in the tree |
|---|---|---|
| L0 well-formed | the card and recipe validate | [book/tools/validate.js](../control/book/tools/validate.js) |
| L1 re-mints | it builds on the declared version | the mint path |
| L2 reproduces | the re-render matches `expect`, same kernel version and runtime | the byte-identical re-render tests |
| L3 ports | the claimed engine marks hold | [scripts/conformance.mjs](../control/scripts/conformance.mjs) |

The first code step, when one is taken, is a canonical JSON form and a recipe content hash: every later field rests on
it, and it needs no service.

## 8. Recipes as code: the infrastructure-as-code bridge

`get_substrate` already names the shape: *a recipe ~ infrastructure-as-code for media (the manifest is the source, the
render is disposable).* A standard recipe makes the analogy operational. The working name for the operational form
is **Mojiac** (mojulo + IaC); the principles matter more than the name.

### The mapping

| IaC concept | mojulo today | status |
|---|---|---|
| declarative configuration | the recipe manifest; the cosmos cube | enforced |
| resource | a `sketches` row at a ref | enforced |
| provider | a kind's kernel; an engine backend; an optional worker | enforced |
| plan (what would change) | `dryRun` for capability; `compile_plan` for a call chain; `diff_sketches` for output | enforced, three separate reads |
| apply | mint, `update_sketch`, `execute_plan` | enforced |
| state | the `sketches` table and `sketch_revisions` | enforced, local SQLite |
| references between resources | `{ $step, path }` inside a plan | enforced within a plan run only |
| module | a recipe-book entry; a Door-2 builder; a catalyst | enforced |
| registry | the bundled recipe book; anyone's cookbook as a git repo | enforced, no hosted index |
| lock file | `requiresMojulo` (a range) | **weak**: no kernel or output pin |
| import (bring an existing thing under management) | OpenSCAD in through the `scad` kind ([scene-scad.js](../control/lib/graph/scene/scene-scad.js) goes both ways) | partial |
| outputs | `export_game`, `export_model` (the game folder carries its recipes) | enforced |
| drift detection | none | **missing** |
| policy as code | the gates: advisory, stamped | enforced, and deliberately never refusing |

### Where the analogy breaks, and what that teaches

**Terraform is the wrong ancestor for the core; Nix is the right one.** Terraform manages external, stateful
resources that drift and cost money to destroy, and its state file exists because the world can disagree with the
config. A mojulo artifact is a pure function of its recipe, regenerated on every read: between a recipe and its render
there is nothing to drift. The semantics match Nix and Bazel instead:

| Nix / Bazel | mojulo |
|---|---|
| derivation: a pure build recipe | the recipe |
| purity: no network, no clock in the build | seeded dice only; no `Math.random`, `Date`, `Intl` |
| store path hashed from inputs | the recipe content hash (§7, not yet built) |
| binary cache keyed by that hash | the bake caches (`data/scene-png/`, `data/turntable/`, `data/figure-specs/`) |
| a lock pinning inputs | a kernel-version and render-hash pin (§7, not yet built) |
| hermetic, reproducible builds | the byte-identical re-render baseline |

**Terraform is the right ancestor for the workflow and for the boundary.** Two places in mojulo do have state the
world can change:

1. **The kernel.** A kernel change can change the output of a minted row. That is the drift that exists: re-render a
   recipe and compare against its `expect` hash. A mismatch is either a legitimate emission change (the step says so,
   the pin moves in the same commit) or a regression.
2. **The export boundary.** A Godot project, a Unity pack, a slicer job is real state outside mojulo, and a person
   finishing it in the engine is the intended use. Drift there is a diff between what the recipe emits now and what
   sits in the project folder: which files are still mojulo's, which are the finisher's, and what a re-export would
   overwrite. This is the one place Terraform's plan / apply / state discipline fits without translation.

So the principled split: **Nix semantics for the recipe, Terraform workflow at the export boundary.**

### Principles worth taking

1. **Declarative over imperative.** A recipe states the thing, not the calls that made it. A plan is the imperative
   form and should compile to recipes, not stand in for them.
2. **Plan before apply, and the plan is the review.** The agent writes; a person reads the plan's diff (capability
   verdict, recipe patch, output diff, what an export would overwrite) and approves. This is the existing plan
   discipline (`enter_plan_mode`) given a recipe-level diff to show.
3. **Idempotence.** Applying the same recipe twice changes nothing. Already true of re-render; a project-level apply
   would need it at the export boundary too.
4. **Content-addressed identity.** A resource is named by what it is, so sharing, caching, forking and lineage fall
   out of one hash.
5. **Pinned inputs, recorded outputs.** A lock records the kernel versions and the render hashes; `verify` re-renders
   and compares. This is the drift check §8 lacks.
6. **Modules with interfaces.** A book entry declares its params with defaults and ranges (the card's params table);
   that is already a module interface. Making relations addressable (§4) is what lets modules compose by reference.
7. **Git is the backend.** Single operator, loopback only: no remote state, no locking service, no teams. The
   project's state lives in files the operator commits; sharing is their push.
8. **Policy advises.** IaC policy engines refuse. Mojulo's gates stamp and ship, and a refusal names what it protects.
   Keep that: a Mojiac gate reports, the operator decides.

### What a Mojiac project could look like (conjecture)

A folder the agent writes and the operator commits:

```text
my-game/
  mojulo.project.json   resources by name: recipes, relations between them by name, targets
  mojulo.lock.json      per resource: recipe hash, kernel version, expected render hash
  exports/godot/        the boundary: emitted files and the finisher's own, told apart
```

and four verbs over it, thin over the existing CLI (`node scripts/mcp-stdio.mjs call …`):

- `plan` — dryRun every game's cube, diff each recipe against the store, report what an export would overwrite;
- `apply` — mint or `update_sketch` to match, export to targets;
- `verify` — re-render against the lock: L2 for every resource, drift named;
- `lock` — record hashes and kernel versions after a reviewed apply.

None of this is built, and none of it adds a listed tool: it is a project file and a CLI over the registry that
already exists. The tool surface stays what it is; the agent keeps driving by conversation and Mojiac is what the
conversation leaves behind in git.

## Open questions

1. **The expansion.** First proposed as *Universal Relational Space Algorithmic-driven engine*. Revised because
   "universal" contradicts the named-gap design, "engine" invites the fidelity contest the substrate rules out and
   collides with `scene/engines/`, and the agent was absent. *Relational* survives as §4. Keep the revision, or keep
   the original words with "universal" defined narrowly in the first paragraph?
2. **The name collision.** Blackmagic sells URSA cinema cameras, close to a media studio. Check before a paper title.
3. **Canonical JSON.** Which canonicalization (key order, number form, absent vs default params) defines the hash, and
   does a default-valued param hash the same as an omitted one?
4. **Runtime pinning for L2.** Pin the Node major, or the V8 version, or accept L2 as same-install only?
5. **Relations in the store.** An edge table between refs, or relations kept inside manifests and resolved by hash?
6. **The export boundary.** How a project folder marks which files are mojulo's and which the finisher's, per engine.
7. **Mojiac's name.** "IaC" says infrastructure, and this is media; "recipes as code" says it plainly. Keep Mojiac as
   the CLI's name and use the plain phrase in prose? Avoid "Terraform" in public copy: it is a trademark.
