---
{
  "id": "math",
  "name": "Cayley city (math structure)",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a finite group as a walkable town — plazas are elements, generators are streets, and walking a relation returns you home.",
  "when": "Reach for this on framing like 'show me a group as a place / make ℤ/12 (or D₄ / S₃ / the quaternions) walkable / a Cayley diagram you can walk / embody an abstract structure / walk a group relation'."
}
---

Mint a finite group as a walkable Cayley city from a tiny RECIPE — the same fractal-generation path as `compose_world(base:'city')`, but the geometry comes from group theory instead of a street grid. The substrate stores ONLY the recipe (`manifest.kind === 'math-structure'`, `structure:{ family, n }`); the whole town is regenerated deterministically on render at `/api/sketches/<ref>/world` (a live first-person WASD world) and `/api/sketches/<ref>/scene`.

The bet (math-worlds.plan.md): abstract objects read as esoteric because they have no natural body. A group *does* have one here. Every element is a plaza; every generator is a visually distinct street TYPE (the grand boulevard is the rotation, the narrow spoke is the flip); the cyclic subgroup of the highest-order generator is a ring road, and its cosets are the concentric rings around it. So the layout draws the group the way a mathematician does — ℤ/n as one modular clock, Dₙ as rotations-inside / reflections-outside, Q₈ and S₃ as two rings. Walking a word spells an element; walking a **relation** (e.g. `srsr` in D₄, or `a` around ℤ/n) brings you back to your gold home plaza. The theorem is the loop, felt underfoot — and because the world is deterministic, an agent can compile a walk to waypoints and probe-assert the return.

## Parameters

Pass these via `compose_world`'s `overrides` (identity-adapted for this base). `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `structure` (object) — WHICH group and how it's presented:
  - `family` (string) — one of `cyclic` (ℤ/n — one ring, the modular clock), `dihedral` (Dₙ — symmetries of an n-gon; two rings), `symmetric` (Sₙ; n=3 ships as the worked example — two triangles), `quaternion` (Q₈ — the eight unit quaternions; two rings of four). Defaults to `dihedral`.
  - `n` (integer) — the family's size parameter: the ℤ/n modulus, the Dₙ polygon order, or the Sₙ degree. Ignored by `quaternion`. Keep |G| ≤ ~16 (the plan's scale-creep guard: a city for S₅ is 120 plazas — treat bigger structures as a subgroup/quotient navigation story, not a bigger render).
  - `innerRadius` (number, optional) — radius of the innermost ring in world units (default 7).
  - `ringGap` (number, optional) — spacing between concentric rings (default 6.5).
- `title` (string) — Title for the resulting sketch artifact.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.

The result's `stats` reports the group title, order, generator symbols, and its defining relations — the relations are the walks worth compiling. Reach for this on framing like 'show me a group as a place / make D₄ walkable / a Cayley diagram you can walk / walk a group relation'.
