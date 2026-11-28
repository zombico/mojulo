/**
 * play-cine — a CUTSCENE PLAYED AS A VIDEO in the play shell (flow.js: a cinematic step's `film` or `video`): the
 * video over the game, on no level's page, left as it ends, as the player skips it (Esc, Enter, Space, its button),
 * or at once when it has no video or the video will not play. Inlined by `toString()` only in a game whose flow has
 * such a step (play-shell.js); a game with none carries not a byte of it.
 *
 * A STORY SLIDESHOW (a cinematic's or a cutscene's `slides`: [{ say, art? }]) the same way, over the game: each slide's
 * picture over the screen (none: black), its words on the shell's mana-ui (its `story` screen, play-shell-mana.js, in
 * the game's theme; a shell without one: a plain line in the lower third), which slide of how many under them. Any key
 * but Esc, a click or a tap goes on (not in its first moment: the press that started the game is no press), the last
 * goes on to the step after; Esc or its button skips the rest, unless the step says `skip: false`.
 *
 *   playCineRuntime({ go, show, app, here }) → { arrive(next, step, was), play(next, step) → true when it took the step }
 *     go(event)   the flow stepped on;  show(name)  the shell's screen switched;  app  the shell's screen element
 *     here()      the step the game is on
 *
 * Self-contained: references nothing outside itself and its argument.
 */
export function playCineRuntime(api) {
  let el = null, btn = null, key = null, tap = null, words = null, story = null;
  const isSlides = (s) => !!s && (s.kind === 'cinematic' || s.kind === 'cutscene') && Array.isArray(s.slides) && s.slides.length > 0;
  const isCine = (s) => isSlides(s) || (!!s && s.kind === 'cinematic' && (s.film !== undefined || s.video !== undefined));
  function clear() {
    if (key) { window.removeEventListener('keydown', key, true); key = null; }
    if (tap) { window.removeEventListener('pointerdown', tap, true); tap = null; }
    if (words) { words.remove(); words = null; }
    if (story) { const R = story; story = null; try { R.close(); } catch (e) { /* gone */ } }
    if (el) { try { el.pause(); } catch (e) { /* gone */ } el.remove(); el = null; }
    if (btn) { btn.remove(); btn = null; }
  }
  function end(step) { clear(); if (api.here() === step) api.go('next'); }
  // A SLIDESHOW: the picture a layer under mana-ui's root, the words on its story screen (else a line of the player's own)
  function slides(next, s) {
    const S = s.slides, R = window.__mojManaUi, U = window.__mojManaState, canSkip = s.skip !== false;
    let i = -1, up = false;
    const pic = document.createElement('div');
    pic.setAttribute('data-cine', next.step); pic.setAttribute('data-slides', String(S.length));
    pic.style.cssText = 'position:fixed;inset:0;z-index:39;background:#000 center / cover no-repeat';
    document.body.appendChild(pic);
    el = { pause() {}, remove() { pic.remove(); } };
    if (R && U && U.ui) { try { U.ui.story = { say: '', step: '' }; R.open('story'); story = R; } catch (e) { story = null; } }
    if (!story) {
      words = document.createElement('div');
      words.setAttribute('data-cine-words', '1');
      words.style.cssText = 'position:fixed;left:8vw;right:8vw;bottom:9vh;z-index:41;color:#fff;font:500 clamp(16px,2.4vw,26px)/1.45 system-ui,sans-serif;text-shadow:0 2px 8px #000;text-align:center';
      document.body.appendChild(words);
    }
    const show = (k) => {
      i = k;
      const x = S[i], step = (i + 1) + ' / ' + S.length;
      pic.style.backgroundImage = x.art ? 'url("' + String(x.art).replace(/["\\\n\r]/g, '') + '")' : 'none';
      pic.setAttribute('data-slide', String(i));
      if (story) U.ui.story = { say: x.say, step: step };
      else { words.textContent = ''; const p = document.createElement('div'); p.textContent = x.say; const c = document.createElement('div'); c.textContent = step; c.style.cssText = 'opacity:.6;font-size:.6em;margin-top:.6em'; words.appendChild(p); words.appendChild(c); }
    };
    const on = () => { if (!up) return; if (i + 1 < S.length) show(i + 1); else end(next); };
    setTimeout(() => { up = true; }, 400);
    if (canSkip) {
      btn = document.createElement('button');
      btn.textContent = 'skip'; btn.className = 'link';
      btn.setAttribute('data-cine-skip', '1');
      btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:42;color:#fff;opacity:.7';
      btn.addEventListener('click', () => end(next));
      document.body.appendChild(btn);
    }
    key = (e) => {
      if (e.repeat) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { if (canSkip) end(next); return; }
      on();
    };
    window.addEventListener('keydown', key, true);
    tap = (e) => { if (btn && e.target === btn) return; e.stopPropagation(); on(); };
    window.addEventListener('pointerdown', tap, true);
    show(0);
  }
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
      if (isSlides(s)) { slides(next, s); return true; }
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
