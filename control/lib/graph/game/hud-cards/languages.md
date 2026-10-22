---
{ "id": "languages", "name": "A game in other languages: localized, not translated", "summary": "A game's `languages`: declared once on its gameworld (or its game), each language briefed with its conventions and the words its players already use in games, its lines folded in, played in the player's language from the shell to every level's own words.", "when": "translate my game, localize my game, multilingual, in Japanese, in Spanish, in Arabic, other languages, language picker, i18n, l10n, localization, translation, make it French, for Brazil" }
---

## The loop

You localize; mojulo keeps, checks and plays it. Three calls on the game rail, by the gameworld's ref (or a game's):

1. **Declare** the languages, the source first or added: `design_game({ ref, localize: { languages: ['en', 'ja', 'es-419'] } })`.
   Tags are BCP 47 (`pt-BR`, `zh-Hant`). A language dropped takes its words with it.
2. **Brief** one: `design_game({ ref, localize: { lang: 'ja' } })` answers the language's `conventions` (its script and
   direction, the register its games use, quotes, plural forms, how names cross into its script), the `rules`, the
   `glossary` of gamer words its players expect (HP as PV in French, a stage as ステージ, つづきから for a continue), and a
   batch of `words` still owed: each with what it `is`, `where` it shows, who it is `said_by`, and `fit` when its box
   does not grow.
3. **Fold** your lines in: `design_game({ ref, localize: { lang: 'ja', lines: [{ source, translation }, …] } })`. The
   `source` is the word exactly as the brief gave it. A line that drops a `{slot}` is `refused`; the rest are kept, the
   game is remade in place, and the next batch comes back. Repeat until `owed` is 0.

## What it reaches

- The shell: its title, menus, level list, pause and result screens, and its own words; a language row in options
  (or a link on the title), each language named in itself.
- Each level, served in the language: its HUD, dialogue and choices, quests, menus, signs, prompts, and the words the
  page writes itself (the quest toast, the skip hint, a shop's footer); its numbers in the language's separators.
- The page in the language's tag and direction, its script set as it sets (no forced capitals in Japanese, no gaps
  in Arabic, lines broken where Japanese and Korean break them). Key prompts show the player's own keyboard (Z Q S D on
  AZERTY).

The player's browser picks the language the first time; their choice is kept. `/api/sketches/<game>/game?lang=ja`
opens it in one language without keeping it: the link to check a language, or to share it.

## What stays as written

Text drawn into pictures (a cover's lockup, a comic's sound effects), a pilot's controls legend, the battle kernel's
sentences, a minigame's own hints. A word with no line plays in the source language; nothing refuses.

## Localize, do not translate

Keep each speaker's voice. A joke becomes one that lands. Names cross by sound (Ilse → イルゼ), titles by meaning.
Prefer "×3" and "Coins: 3" to sentences that need plural forms. Leave key letters (W A S D) as written. The glossary is
convention, not law: a game with its own voice may choose otherwise, and the same term reads the same everywhere.
