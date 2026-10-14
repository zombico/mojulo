/**
 * shell-for — the one place a resolved game picks its shell: the play shell (play-shell.js) when its manifest says
 * `shell: 'play'`, the arena shell (game-shell.js) otherwise, called exactly as before. The /game route and
 * export_game both come through here.
 */
import { emitGameShell } from './game-shell.js';
import { emitPlayShell } from './play-shell.js';

/** `manifest`, `menu` and `frontArt` default to the resolved ones; export_game passes its copies with folder-relative art. */
export function emitShellFor(resolved, { manifest = resolved.manifest, menu = resolved.menu, frontArt = resolved.frontArt || null } = {}) {
  if (manifest.shell === 'play') return emitPlayShell(manifest, resolved.levels, { stingers: resolved.music, ...(frontArt ? { frontArt } : {}) });
  return emitGameShell(manifest, resolved.levels, menu, resolved.music, resolved.setup);
}
