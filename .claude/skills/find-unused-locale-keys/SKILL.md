---
name: find-unused-locale-keys
description: Find and (on confirmation) delete i18n message keys in control/messages/en.json that are no longer referenced anywhere in control/**. Uses deterministic, conservative static analysis of next-intl translator usage — zero false positives by design (never deletes a live key), at the cost of retaining a few dead keys that sit under dynamically-built key prefixes. Reports first; only deletes after you approve, and deletes from en.json ONLY — run /sync-locales afterward to propagate the removals to every other locale. Invoke as `/find-unused-locale-keys`.
---

# /find-unused-locale-keys

Identify message keys in `control/messages/en.json` that no code under `control/**` references, then — only after you confirm — delete them from `en.json`. Deletion touches **en.json only**; the operator runs `/sync-locales` afterward to sweep the removals across every other locale.

Companion to `/sync-locales` (propagates en.json *edits*, including removals, to other locales) and `/translate-messages` (bootstraps a new locale). This skill is the *garbage collector* for the source catalog — it finds the dead keys and prunes the source; `/sync-locales` carries the deletions out to the translations.

## Why this needs more than grep

~16% of translator call sites in this repo build keys dynamically: `t(\`status.${x}\`)`, `t(\`preview.contexts.${ctx}.${k}\`)`, or `t(routeConfig.labelKey)`. A naïve "does the string `status.building` appear in source?" scan would delete those live keys. The helper script handles this by:

- binding each translator to its namespace (`const t = useTranslations('apps')` → `t('actions.stop')` is `apps.actions.stop`);
- treating a template literal's static prefix as a **protected subtree** (`t(\`status.${x}\`)` protects `<ns>.status.**` — the dynamic part is never resolved);
- protecting the **whole namespace** of a bare `t(var)` call on a namespaced translator;
- surfacing bare `t(var)` calls on a **root** translator (`useTranslations()`) as *blind spots* for human review, backed by a raw dotted-string-literal corpus that catches full-path keys stored in data structures.

The result is deterministic and has **zero false positives** (it never flags a key that any static reference could reach). The trade-off is possible false negatives — a genuinely-dead key sitting under a dynamic prefix is retained rather than risk-deleted. That asymmetry is the right one for a deletion tool.

## Plan of action

### 1. Run detection (read-only)

```
cd control && node scripts/find-unused-locale-keys.mjs
```

It prints a JSON report on stdout:

- `scannedFiles`, `totalLeaves`, `exactUsedCount`, `protectedPrefixCount`
- `unusedCount` + `unused`: the deletable leaf paths (dot-joined), sorted
- `protectedPrefixes`: dynamic-key subtrees that were conservatively kept whole
- `blindSpots`: root-translator `t(var)` sites — `{file, line, translator, kind}`. These are the only places the analysis can't bound; eyeball them (see step 3).
- `parseErrors`: any file that failed to parse (should be empty)

If `unusedCount` is 0, tell the user there's nothing to remove and stop.

### 2. Brief the user

One short summary line, e.g. `744 of 1973 keys appear unused; 20 dynamic subtrees protected; 1 blind spot to review.` Don't dump all 744 — offer to show them grouped by top-level namespace, or write the full list to a temp file if they want to scan it.

It's often most useful to roll the unused set up by top-level namespace so the user can spot whole dead sections (e.g. a top-level `analytics.*` that moved under `data.analytics.*` in a refactor) versus scattered one-offs.

### 3. Surface blind spots before any deletion

For each entry in `blindSpots`, the analysis could not see which key is used. Read those `file:line` sites and confirm the keys they resolve to are stored as full-path string literals somewhere (so the corpus already protected them). The known case is [Breadcrumbs.jsx](control/components/Breadcrumbs.jsx) — `t(crumb.labelKey)` over a static `ROUTES` array of full-path `labelKey` strings, which the corpus catches. If a blind spot resolves to keys NOT present as literals, stop and flag it — deleting under it could be unsafe.

### 4. Get explicit confirmation

Show the user what will happen and **wait for an explicit go-ahead** before deleting. Do not delete in the same turn as detection unless the user already said "find and delete" up front.

### 5. Apply (deletes from en.json ONLY)

```
cd control && node scripts/find-unused-locale-keys.mjs --apply
```

This re-runs detection (deterministic — same set as step 1) and then:

- deletes each unused leaf from **`en.json` only**, pruning any object left empty;
- re-serializes `en.json` as 2-space JSON + trailing newline (byte-identical formatting to the original, so the diff shows only removed keys).

It prints a JSON summary: `deletedLeaves`, `enRemoved`, and a `nextStep` reminder. The other locale files are deliberately left untouched.

### 6. Hand off to /sync-locales

After en.json is pruned, the other locales now carry keys that no longer exist in the source. Tell the user to run `/sync-locales` (diff vs `HEAD`, or vs the pre-deletion ref). Its `removed` path detects each deleted en.json key and strips it from every locale in one sweep — no translation needed for removals. This skill does **not** do that step itself.

### 7. Report

Three to five lines:
- keys removed from en.json (`enRemoved`);
- the explicit next action: run `/sync-locales` to propagate removals;
- reminder that this skill does **not** auto-commit — the user reviews the diff themselves.

## Notes for the orchestrator

- **Scope is `control/**` only.** The bot runtime (`lite-template/`) does not consume `control/messages/`. If that ever changes, widen `listSourceFiles` in the script.
- **Deletion is en.json-only by design.** Cross-locale propagation is `/sync-locales`'s job — keeping one deletion mechanism (the diff-driven `removed` path) avoids two code paths that could drift. After `--apply`, the other locales are intentionally out of sync until `/sync-locales` runs.
- **Don't auto-commit.** The user reviews the diff before staging.
- **Don't run `next build`.** Not needed; nothing is added.
- If `blindSpots` grows (new root-translator dynamic sites), treat each as a manual gate — the safety guarantee only holds if those resolve to literal keys the corpus can see.
- The parser is resolved from `@babel/parser` if installed, else from Next's bundled `next/dist/compiled/babel/parser`. If both are missing the script exits non-zero with a clear message.
