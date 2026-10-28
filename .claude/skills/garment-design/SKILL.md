---
name: garment-design
description: Design an outfit for a hero on the realistic body from a brief, the way a fashion designer and a tailor would — turn the brief into stylism words (genre, register, target silhouette or 'balance', the canon western | anime) or an outfit card, say why principle by principle (docs/garment-principles.md), mint it, read the dressed outline and its advice in that canon, adjust the WORDS (never hand-built geometry) at most three times, and show the operator the sheet; the eyes gate is theirs. Use when asked to dress a character, design a costume or an outfit, "make this character's clothes striking", or to compare outfits on different figures. Invoke as `/garment-design <brief>`.
---

# /garment-design

A garment here is DATA: stylism words or an outfit card, worn on the realistic body by the tailor
(`control/lib/graph/polygonizer/body-relational-tailor.js`, `body-relational-wear.js`). This skill is the designer's
order of moves over them. Read [docs/garment-principles.md](../../../docs/garment-principles.md) before the first
brief of a session: it is the why behind every choice below. Its kit and folds section says how the realistic body
makes a belt, a strap, a pouch or a holster and folds the cloth (`body-relational-kit.js`, `body-relational-folds.js`):
pick the pieces by word (an outfit card's `pieces`, a vest's `cut`), and read a piece that hangs open, floats or sinks
as a finding against those rules, not a word to tune round.

Never hand-build a garment, and never edit a kernel to land one brief. When the words cannot say what a brief asks,
name the missing primitive or card field and stop there: that is a change of its own, with its own plan.

## 1. The brief, in words

Settle these with the operator (propose; they correct):

| ask | word |
|---|---|
| the world it belongs to | `stylism.genre`: `fantasy` · `modern` · `scifi` · `alien` |
| how heightened | `stylism.register`: `grounded` · `storybook` · `heroic` · `mythic` |
| the shape it reads as | `stylism.silhouette`: an outline (`wedge` T, `bell` A, `column` H, `needle` I, `barrel` O, `hourglass` X), a named silhouette (`operative`, `samurai`, `princess` …), or `balance` (the outline the FIGURE is dressed toward) |
| the canon it is judged in | `stylism.canon`: `western` (fashion, tailoring) · `anime` (game and anime costume) |
| how much detail, and where | `stylism.detail` (`plain` … `ornate`), `stylism.focal`, `stylism.motif` |
| a specific garment | an outfit card (`outfit: { type: 'outfit', style, language }`: lengths, fits, cuts as words) under or instead of the stylism |
| a martial artist | the loose words: `martialPants`, `wideTrousers`, `gi` |

The figure is the hero's: `cast`, `form: 'realistic'`, `physique` (`athletic` · `skinny` · `heavyset` · `jacked`).
Name the canon every time: without it the proportion stage does not run.

## 2. Say why, before minting

One line per principle the brief touches, in the operator's terms: the family it aims for and why it suits this
figure (the dressing rules), where its strongest division falls (on thirds, never halves), the leg line, whether it
is loose above and below and where it comes back to the body, its one focal, its flair pieces (anime: one to three).

## 3. Mint and read

```bash
# the sheet: palette colours, the front, ¾, side and back, a stride, and the outline panel
node .claude/skills/body-study/body.mjs <cast> --palette --outline \
  --hero '{"form":"realistic","physique":"…","stylism":{…}}' --acts '[{}, {"gait":"walk","phase":0.25}]' --out <dir>
# the readout: dress.stylism (the notes: what the proportion stage moved, the balance's pick, each with why) and
# dress.outline (family, fit, returns, divisions, flair, advice in the canon)
cd control && node scripts/mcp-stdio.mjs call create_character --json '{"as":"hero","spec":{…}}'
```

Read the sheet (Read the PNG). Then the readout's notes and advice.

## 4. Adjust the words, at most three times

Each advice line names what moves it: a length word, a fit, a cut, a belt, a target outline. Change the words, mint,
read again. Record each change and the principle behind it. Stop after three rounds or when the advice is empty or
only says what the brief chose on purpose (a gi is loose above and below by design: its returns carry it).

## 5. Show it

Send the operator the sheet and the outline panel with the rationale and what changed. Say which gate ran: the machine
gate (the read's bands, starting points) passed or not, line by line; the eyes gate is theirs. Never claim it passed.
