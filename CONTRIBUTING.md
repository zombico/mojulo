# Contributing

Thanks for considering a contribution.

This document covers the PR posture, the test surface, and how to run the suite. For architecture, see [docs/BOT-ARCHITECTURE.md](docs/BOT-ARCHITECTURE.md) (bot factory + artifact lifecycle), [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) (MCP control surface), and [CLAUDE.md](CLAUDE.md). For the full test roadmap, see [lite-template/integration/UNIT_TEST_PLAN.md](lite-template/integration/UNIT_TEST_PLAN.md).

## PR posture

Straight up: Claude reviews PRs here. The maintainer is one person, and most read passes are AI-assisted. That shapes what's likely to merge.

**Welcome:**

- **Recipe-shaped additions** — catalysts in [control/lib/mcp/catalysts/](control/lib/mcp/catalysts/), skills, MCP tool descriptions, prompt tweaks, small fixes, docs, dead-code GC. Anything that's a row in an index rather than a change to the substrate.
- **Localization** — new locales, translation fixes, key additions that ride alongside a recipe. Run `/sync-locales` if you can; if you can't, that's fine.
- **Quality** — bug fixes, test coverage on the surfaces named below, doc clarifications.

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

## File layout

- `control/lib/foo.js` → `control/lib/foo.test.js` (co-located).
- `lite-template/test/*.test.js` (the bot's runner uses native CommonJS, kept under `test/` to match `node --test test/**/*.test.js`).

New tests should follow the existing pattern in the package they cover.

## Before submitting a PR

1. `npm test` passes in both packages.
2. `node --check` passes on any `.js`/`.mjs` you edited (CI enforces this).
3. If you touched `control/messages/en.json`, run `node control/scripts/validate-locale.mjs en <code>` for the locales you have changes for (the `/sync-locales` workflow handles propagation if you don't).
4. New strings in JSX are i18n-wrapped per CLAUDE.md.
