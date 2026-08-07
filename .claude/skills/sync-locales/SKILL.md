---
name: sync-locales
description: Sync or regenerate control/messages/<locale>.json from en.json via the deterministic locale-sync helper — extract the unique-string todo, translate it (inline or one worker subagent at a time), mint and validate. One locale at a time, never parallel. Invoke as `/sync-locales <locale> [<locale> ...]` for an incremental sync, `/sync-locales --fresh <locale> ...` for full regeneration, and also to bootstrap brand-new locales (supersedes the old /translate-messages).
---

# /sync-locales

Bring `control/messages/<locale>.json` files in line with `control/messages/en.json`
using [control/scripts/locale-sync.mjs](control/scripts/locale-sync.mjs). The model's
only job is translating a flat list of unique strings; all file assembly, dedup,
resume bookkeeping, and validation are deterministic script code.

Why this shape: the previous skill fanned out parallel subagents that each held the
full ~100KB catalog in context and rewrote whole locale files — session limits blew
up sessions mid-write and corrupted locales. Here workers run **strictly one at a
time**, read only a todo slice, append line-by-line to a JSONL, and never touch
`messages/*.json`. A blown worker costs a retry of its remaining strings, nothing more.

## Invocation

`/sync-locales <code> [<code> ...] [--fresh]` — BCP-47 codes (`es`, `fr`, `pt-BR`, …).
No codes → **stop and ask** which locales. `--fresh` (or the user asking to
"regenerate") skips the translation memory and retranslates everything.

## Per-locale flow (strictly sequential across locales)

### 0. Sanity checks (once, before any locale)

- Reject codes not matching `^[a-z]{2,3}(-[A-Z]{2})?$`, and reject `en`.
- Every code must be in `localeNames` in [control/i18n/config.js](control/i18n/config.js).
  If missing, ask the user for the autonym, add it, and add the code to `rtlLocales`
  if the script is RTL.
- `cd control && node scripts/validate-locale.mjs en en` must print `en.json: ok`.

### 1. Extract

```
cd control && node scripts/locale-sync.mjs extract <locale> [--fresh]
```

- Incremental (default): translation memory comes from en.json at the last commit that
  touched `<locale>.json`, so only new/changed strings land in the todo.
- Use `--fresh` when the user asked for regeneration or `<locale>.json` doesn't exist yet.
- The summary line reports how many unique strings need translation. Work dir:
  `control/data/locale-sync/<locale>/` (gitignored).

### 2. Translate the todo

Read the count from the extract summary:

- **0 strings** → go straight to mint.
- **≤ 40 strings** → translate inline: read `todo.json`, append one
  `{"en": "...", "translation": "..."}` JSON line per string to
  `control/data/locale-sync/<locale>/translations.jsonl` (bash heredoc append is fine).
  Follow the Translation Rules below.
- **> 40 strings** → chunk into slices of ≤ 400 and spawn **one worker subagent per
  chunk, waiting for each to finish before spawning the next** (`run_in_background:
  false`, `subagent_type: general-purpose`). Never spawn workers in parallel. Each
  worker gets the Worker Brief below with `<LOCALE_CODE>`, `<LOCALE_NAME>` (autonym
  from `localeNames`), `<START>`, `<END>` filled in.

After all chunks, re-run `extract` (same flags). If it reports > 0 remaining (a worker
died mid-chunk), spawn one fresh worker for the remainder — the JSONL subtraction makes
this resumable. Repeat until 0.

### 3. Mint

```
cd control && node scripts/locale-sync.mjs mint <locale>
```

Mint refuses on incomplete coverage, validates via `validate-locale.mjs`, restores the
previous file on failure, and clears the work dir on success. On validation failure,
fix the offending JSONL lines (or add an `overrides.json` in the work dir mapping dotted
key path → translation for per-key exceptions) and re-run mint. Give up after 2 fix
attempts and report the locale as failed, leaving its work dir intact for inspection.

### 4. Wire (new locales only)

If the locale wasn't in the `locales` array in `control/i18n/config.js`, add it —
alphabetical, `en` first. Existing locales need no wiring.

## Report

Per locale: strings translated vs prefilled, minted ok / failed. Note that RTL locales
(`ar`, `fa`, `ur`, `he`) may need visual review, and that dev picks the change up on
hot-reload. **Don't auto-commit.** Don't run `next build`.

---

## Worker Brief

Each worker receives this verbatim with the placeholders filled in:

> You are translating UI strings from English into **<LOCALE_NAME>** (locale code
> `<LOCALE_CODE>`) for the Mojulo control panel, a developer-facing tool.
>
> Read `/Users/fombico/Documents/mojulo/control/data/locale-sync/<LOCALE_CODE>/todo.json`
> — a JSON array of `{ en, keys }` entries. Your slice is entries with index `<START>`
> (inclusive) to `<END>` (exclusive). The `keys` are the UI key paths where the string
> appears — use them as context for ambiguous strings.
>
> For each entry in your slice, append one line to
> `/Users/fombico/Documents/mojulo/control/data/locale-sync/<LOCALE_CODE>/translations.jsonl`:
>
> ```
> {"en": "<exact source string>", "translation": "<your translation>"}
> ```
>
> Append in batches of ~50 lines using `cat >> ...translations.jsonl <<'EOF'` so partial
> progress survives if you die. `en` must byte-match the source string. Never modify
> existing lines, never write any other file, never touch `control/messages/`.
>
> Follow the Translation Rules exactly. When done, return ONE line:
> `<LOCALE_CODE> chunk <START>-<END>: ok (<n> lines appended)` — do not dump
> translations in your response.

## Translation Rules (inline and worker translation both follow these)

1. **Preserve every ICU placeholder unchanged** — `{name}`, `{count}`, etc.: same
   name, same braces, none added or removed.
2. **Preserve ICU plural/select skeletons** — in
   `{count, plural, one {file} other {files}}` translate only the words inside the
   innermost braces; keep `plural`/`select`/`one`/`other`/`=0`/`#` verbatim. Add the
   target language's extra plural categories (Russian `few`/`many`, Arabic
   `zero`/`two`/`few`/`many`, …) in standard ICU order; always keep `other`.
3. **Don't translate brands or code tokens**: Mojulo, Anthropic, OpenAI, Gemini,
   Cohere, Bedrock, Docker, GHCR, Fly.io, SQLite, Next.js; file extensions, env var
   names, CLI flags, URL paths, model IDs.
4. **Register**: terse, slightly technical UI copy — match the source's directness, no
   fluff. Prefer the informal second person where the language has one (tú/du/tu);
   Japanese です/ます; Korean 해요체.
5. Repeated strings get **one** translation (the dedup is the point) — pick the
   rendering that fits all the listed key contexts; per-key exceptions belong in
   `overrides.json`, not the JSONL.
