# locale-sync: deterministic extract → translate → mint

Replaces the fan-out architecture of `/sync-locales` and the full-catalog rewrite of
`/translate-messages` with a deterministic helper script plus a thin orchestration skill.
One locale at a time; the model only ever sees a small flat list of strings, never a
100KB catalog.

## Problem

1. All 26 non-en locales are stale (frozen at 1878 leaf keys from May 30; en.json is at
   1742 today). Against fr.json: 555 en keys missing, 691 fr keys dead. `sv.json` is a
   partial run (1378 keys); `uk.json` is slightly off too (1857).
2. `/sync-locales` fanned out one subagent per locale in parallel; each held the full
   catalog in context and rewrote the whole locale file. Session limits blew up sessions
   mid-write → corrupt or partial locale files. Structural, not incidental.
3. ~14% of en strings are exact repeats ("Loading…" ×17, "Cancel" ×7, "Save" ×6, …) that
   get re-translated every run and can drift apart across keys.
4. Refactoring the code-side strings to share keys is off the table at this point.

## Design

One new script, `control/scripts/locale-sync.mjs`, with two subcommands. All file
assembly is code; the model's only job is translating a flat string list.

**Decision (2026-07-14):** the existing catalogs are too far gone to mine — this sweep
regenerates every locale fresh from today's en.json (`extract --fresh`, empty memory,
todo = all 1498 unique strings). The memory path below stays in the script for *future*
syncs, where the baseline will be the commits this sweep produces.

### Translation memory (no new state files)

For locale X, the baseline is `en.json` **at the last commit that touched
`messages/X.json`** (`git log -1 --format=%H -- control/messages/X.json`), overridable
with `--ref`. Zipping baseline-en with current X.json by key path yields a value-keyed
memory: `EN string → translated string`.

- Keying by *value* (not key path) gives dedup for free: every occurrence of "Save"
  resolves from one memory entry, and repeated strings stay consistent per locale.
- If the memory maps one EN value to multiple translations (hand-fixes), keep the most
  frequent and log the conflict.
- EN strings whose value changed since baseline miss the memory naturally and fall into
  the todo — no explicit modified-key tracking needed.

### `extract <locale> [--ref <ref>]`

1. Build the memory as above.
2. Walk current `en.json` leaves. Memory hit → prefill. Miss → todo.
3. Write to a work dir (`control/data/locale-sync/<locale>/`, gitignored):
   - `todo.json` — `[{ en, keys: [key paths] }]`, deduped, key paths included so the
     translator has context for ambiguous strings.
   - `prefill.json` — key path → translation (everything the memory covered).
4. If a `translations.jsonl` already exists in the work dir (prior crashed run), subtract
   its covered strings from the todo — this is the resume path.
5. Print a one-line summary: N leaves, M prefilled, K unique strings to translate.

### `mint <locale>`

1. Require every todo string to have a line in `translations.jsonl`
   (`{ en, translation }` per line, append-only). Missing lines → fail with the list;
   never mint partial.
2. Rebuild `messages/<locale>.json` in exactly current en.json's key shape from
   prefill + new translations. Dead keys vanish for free.
3. Apply `overrides.json` (key path → translation) last, if present in the work dir —
   the escape hatch for polysemy, where one EN string genuinely needs different
   renderings at different key paths in this locale. Checked in? No — lives in the work
   dir only if the operator creates it; revisit if it earns permanence.
4. Run `node scripts/validate-locale.mjs en <locale>`. On failure, restore the previous
   file (mint writes to a temp path and swaps only on `ok`).
5. On success, clear the work dir.

### The skill (rewritten `/sync-locales`, absorbing `/translate-messages`)

Per locale, strictly sequential:

1. `extract <locale>` → read the one-line summary.
2. Translate the todo:
   - ≤ ~40 strings → inline in the main session, append to `translations.jsonl`.
   - Larger → one worker subagent per chunk of ≤ ~400 strings, **run one at a time**.
     Worker reads its chunk of `todo.json`, appends to `translations.jsonl` line by
     line, returns a single status line. It never reads or writes `messages/*.json`.
   - Worker dies mid-chunk → re-run `extract` (subtracts JSONL lines) and spawn a fresh
     worker for the tail. A blowup costs a retry of the remainder, not the locale.
3. `mint <locale>` → report ok/fail.
4. Move to the next locale.

Worker brief keeps the hard rules from the current translate-messages brief (ICU
placeholders/plural skeletons, brand nouns, register, form of address) minus everything
about file shape — shape is now the mint step's job, and the placeholder rules are
enforced by validate-locale at mint time anyway.

New-locale bootstrap (the old `/translate-messages` job) is the same flow degenerate
case: no baseline commit → empty memory → todo is all 1498 unique strings → chunked
workers → mint → wire the code into `i18n/config.js` `locales` (+ `localeNames` /
`rtlLocales` if new).

## Supersession

- `/sync-locales` skill: rewritten to this orchestration (name kept).
- `/translate-messages` skill: deleted; its bootstrap case folds into `/sync-locales`.
- `scripts/diff-locale.mjs`: deleted; `extract` subsumes it (value-level memory beats
  key-level diff).
- `scripts/validate-locale.mjs`: unchanged, called by `mint`.
- `/find-unused-locale-keys` note ("run /sync-locales afterward") stays valid.

## Numbers (2026-07-14)

en.json: 1742 leaves, 1498 unique values (dup factor 1.16, ~6% of chars). Estimated fr
todo after memory prefill: ~500 unique strings — 3× smaller than a full catalog, and the
worker payload is ~15–25KB vs ~100KB.

## Order of work

1. `locale-sync.mjs` (extract + mint), work-dir gitignore entry.
2. Dry-run against fr: extract, hand-check todo/prefill counts, mint with a stub
   translation pass, validate.
3. Rewrite `/sync-locales` SKILL.md; delete `/translate-messages` and `diff-locale.mjs`.
4. Full run of one real locale (fr) as acceptance; then sweep the rest one at a time.
