/**
 * play-cine — a CUTSCENE PLAYED AS A VIDEO in the play shell (flow.js: a cinematic step's `film` or `video`): the
 * video over the game, on no level's page, left as it ends, as the player skips it (Esc, Enter, Space, its button),
 * or at once when it has no video or the video will not play. Inlined by `toString()` only in a game whose flow has
 * such a step (play-shell.js); a game with none carries not a byte of it.
 *
 *   playCineRuntime({ go, show, app, here }) → { arrive(next, step, was), play(next, step) → true when it took the step }
 *     go(event)   the flow stepped on;  show(name)  the shell's screen switched;  app  the shell's screen element
 *     here()      the step the game is on
 *
 * Self-contained: references nothing outside itself and its argument.
 */
export function playCineRuntime(api) {
  let el = null, btn = null, key = null;
  const isCine = (s) => !!s && s.kind === 'cinematic' && (s.film !== undefined || s.video !== undefined);
  function clear() {
    if (key) { window.removeEventListener('keydown', key, true); key = null; }
    if (el) { try { el.pause(); } catch (e) { /* gone */ } el.remove(); el = null; }
    if (btn) { btn.remove(); btn = null; }
  }
  function end(step) { clear(); if (api.here() === step) api.go('next'); }
  return {
    // a step entered: a cutscene left by another step's event goes with it, and a video carries the level last played
    arrive(next, s, was) {
      clear();
      return isCine(s) && !next.level && was ? { step: next.step, level: was.level } : next;
    },
    play(next, s) {
      if (!isCine(s)) return false;
      api.show('cine');
      api.app.style.display = 'none';
      if (!s.video) { setTimeout(() => end(next), 0); return true; }
      const v = document.createElement('video');
      v.src = s.video; v.autoplay = true; v.playsInline = true; v.controls = false;
      v.setAttribute('data-cine', next.step);
      v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:#000;object-fit:contain;z-index:6';
      v.addEventListener('ended', () => end(next));
      v.addEventListener('error', () => end(next));
      document.body.appendChild(v);
      el = v;
      // (a browser that will not start a video with sound before a gesture plays it muted)
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; const q = v.play(); if (q && q.catch) q.catch(() => end(next)); });
      if (s.skip !== false) {
        btn = document.createElement('button');
        btn.textContent = 'skip'; btn.className = 'link';
        btn.setAttribute('data-cine-skip', '1');
        btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:7;color:#fff;opacity:.7';
        btn.addEventListener('click', () => end(next));
        document.body.appendChild(btn);
        key = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); end(next); } };
        window.addEventListener('keydown', key, true);
      }
      return true;
    },
  };
}
