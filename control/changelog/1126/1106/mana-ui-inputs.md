### The game UI's keyboard: the keypad, the usual keys and typing into a name

- **The keys a player reaches for anyway drive a mana-ui menu.** Past the two remappable slots of each menu action
  (arrows or W A S D, Enter or Space, Esc or Backspace, `[` `]`), the menu scheme carries what every player has learnt
  (`also` on an action in `controls/schemes.js`): the keypad (8 4 6 2 move, 5 and the keypad's Enter accept, 0 backs
  out, + and − turn the tabs), Tab and Shift+Tab to move down and up, and Page Down and Page Up to turn the tabs. They
  are never remapped and never listed on the controls screen; a slot's binding on the same key wins
  (`controls/mana-controls.js manaControls`).
- **Sane defaults in the host** (`controls/mana-host.js`). A held key repeats a move (a long list scrolls, a slider
  runs) and never a pick or a back, so a held Enter buys once and a held Esc leaves one screen. A chord (Ctrl, Alt or
  Meta held) stays the browser's and the system's: a reload, a tab switch and a copy still work over a menu.
- **A name is typed straight in from a keyboard.** With a text entry in focus, the keys type into it (W types a W and
  does not move the cursor), Backspace and Delete erase, Enter is done, and the arrows, Esc and Tab still move and back
  out. A pad still types from the letter grid. The runtime takes text, never keys: `rt.typing(seat)`,
  `rt.type(text, seat)` (the entry's charset and max kept, a lower-case letter read as its capital), `rt.erase(seat)`
  and `rt.submit(seat)`.
- **The previews agree.** The board and `manaUiPage` without a host drive their frames with the same keys
  (`PREVIEW_KEYS`, held to the menu scheme by a test) and type into a name the same way (`previewKey`).
