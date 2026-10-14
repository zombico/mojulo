---
{ "id": "front", "name": "The front of a game: title, start menu, credits, end", "summary": "A light-shell game's `front`: its title screen drawn over a cover (create_cover for_kind 'game', whose archetype leaves the menu a zone) or an image, an attract screen, the start menu (continue, play, levels, options, credits), the credits roll, and the end when the last level is first cleared.", "when": "title screen, start menu, main menu, press start, game cover, key art, box art, credits, credits roll, the end, game complete, options menu, new game, continue" }
---

## Where it goes

`front` sits on a game with `shell: 'play'` (create_game, or a gameworld's `front` setting, which the run carries
onto the game it makes). The arena shell has its own title: its `menu`. Absent, the light shell is as it was.

```json
"front": {
  "cover": "keep-cover",
  "press": true,
  "menu": ["continue", "play", "levels", "options", "credits"],
  "credits": {
    "roll": [{ "role": "Design", "names": ["Ada"] }, { "role": "Music", "names": ["Bo", "Cy"] }],
    "thanks": "Everyone who played it first."
  },
  "end": { "text": "Dawn comes to the keep." }
}
```

| key | what it is |
|---|---|
| `cover` | a cover sketch's ref, or `{ "art": "<image url/path>" }`. A cover carries its own title lockup; a game cover's archetype (`logo-center`, `lower-third`, `hero-side`) reserves a menu zone the menu is placed in. An image is drawn full-bleed with the title over it. |
| `layout` | `center` · `lower-third` · `left` · `right`: where the title and the menu sit when no cover zone says (default `center`) |
| `tagline` | words under the title (a cover's own lockup carries its tagline itself) |
| `press` | `true` ("press start") or its words: an attract screen first; any key, click or pad button shows the menu |
| `menu` | the start menu in order, from `continue` (shown once something was played), `play` (start / new game), `levels` (the list; a game of several levels), `options` (sound, reset progress), `credits` (needs `credits`). Default: what the game has. A run has no `continue` or `levels`. |
| `credits` | `{ roll?: [{ role, names: [..] }], thanks?, closing?, attribution? }`: the roll, read from the menu and after the end; `attribution: false` drops the closing "made with mojulo" line |
| `end` | `{ text?, credits? }`: the card when the last level is first cleared ("The end" by default), then the roll (unless `credits: false`), then the title. A run ends at its own result. |

## The cover

`create_cover({ title, for_kind: 'game', format })`: `key-art` (16:9, the title's backdrop: the default), `capsule`
(the store's 460 × 215), `box` (the box front), `icon` (square). Subtext role `tagline`, metadata kind `studio`.
In the Claude plugin the illustration starts as a placeholder: the operator uploads the picture into a
stash on the dashboard (add image), and the agent maps it, `create_cover … art: { stash, item }`, or on a cover
already made `update_sketch` patch `/slots/illustration` = `{ "realizer": "upload", "from": { "stash", "item" } }`.
export_game writes the cover's composite into `assets/cover.png`.

Keys: up / down (or W / S) move the focus, Enter / Space / E pick, Escape goes back; the pad's d-pad, A and B.
The front reads the game's `theme` tokens like every screen of the shell.
