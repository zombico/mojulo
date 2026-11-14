### A level always hears its shell: the game's params and seed are no longer dropped on a slow build

A level page under a game shell waits 1.5 s for the shell's `game-init` before it starts on its presets. The shell
shares the level's thread, so its answer is queued behind the level's own build; when the build ended near the 1.5 s
mark, the presets ran first and the shell's params (the loadout, the door entered by, a staged scene) and its seed were
dropped for that session.

- The wait is counted in time the shell could have answered in (`scene/channels/game.js` `awaitShell`): a tick the
  thread was busy through counts for nothing. A shell that never answers still gets the presets after 1.5 s.
- Measured on a 15.9 MB level in headless Chromium: 4 of about 17 loads started on the presets before; 0 of 13 after.
- The emission pins of the three fixtures whose page carries the game channel are re-pinned.
