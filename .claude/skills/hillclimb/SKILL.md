---
name: hillclimb
description: Pick the next game capability to build from the cosmos sweep, build it as one composed concept rather than value by value, and re-sweep. Use when choosing or starting game-making work (cameras, topology, combat, quests, shots, passage of time…), when asked "what should we build next" or "what can we make", or after a capability lands, to record the move.
---

# /hillclimb

The cosmos cube (`control/lib/graph/cosmos`) describes a game as six facets of settings; the registry marks each
value built, local, partial or absent. The sweep rolls worlds and asks which are makeable. This skill turns that
into the next build. Internal: nothing here is an MCP surface.

## 1. Read where it stands

```bash
cd control && npm run tool-surface
```

Read [docs/tool-surface/hillclimb.md](../../../docs/tool-surface/hillclimb.md). It ranks three ways:

- **One at a time**: packages by worlds lifted per unit of effort. Cheap and high is the default pick.
- **Recipes**: the exact package sets worlds wait on. A recipe many worlds share is a target worth building whole.
- **Pairs with synergy**: worlds made only when both are built. High synergy means one concept split in two: build
  them together, and declare them one package in `lib/graph/cosmos/packages.js` (members name it with `pkg`).

An unpriced row ("–") cannot be compared. Price it first (`effort: 'S' | 'M' | 'L'` on the registry value, or on the
package) from a read-only look at what exists, then regenerate.

## 2. Choose, and say why

Name the pick, the rows it comes from, and what else it moves: the genre probes it touches, and whether it is web-only
(`godot: false`). Prefer a composed concept (a package, a recipe, a synergy pair) over a single value when the page
shows one. Confirm with the operator before building.

## 3. Build it the house way

- The plan section and the Unreleased changelog entry before code (CLAUDE.md, Plans and changelog).
- Opt-in: an absent key keeps every byte; char and trace pins re-pinned only with a stripped-source proof.
- Mark the registry: the value's `status`, `lowers` (the module that makes it) and `godot`.
- Tests next to the change; `test:critical` and `test:deep:changed` before the commit.

## 4. Re-sweep and record the move

```bash
cd control && npm run tool-surface
```

Compare "Where it stands" and the genre probes with step 1. Write the before and after into the plan's Log. Commit
the regenerated pages with the change; `scripts/tool-surface.test.js` fails on a stale one.
