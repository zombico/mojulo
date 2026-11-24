/**
 * THE QUICK-TIME PROMPT ON MANA-UI (worlds/controllable/prompt.js): the button the prompt asks for, as the device draws it
 * (the controls layer's own glyph: a key cap on a keyboard, a face button on a pad), in the middle of the screen with
 * its word under it (Grab, Climb, Hold), and a ring round it that closes as its window runs out.
 *
 *   told     the key and its word come up, the ring whole and dim: what to press, before it can be pressed
 *   open     the ring lit and closing, from whole to nothing over the window
 *   hit      the key flashes and goes; miss: it shakes and goes
 *
 * The ring is a style layer over the composition (mana-ui draws the key and the word; the ring is the host's sheet,
 * driven by the share left, `--moj-pr-u`), so a theme dresses the key as it dresses every key cap. It reads no device
 * (the glyph is the controls layer's, `__mojCtrl.label`) and holds no focus. Emitted only into a page whose world has
 * prompts: absent, not one byte.
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/** The spec it draws: the key and its word, in the middle, while a prompt is up. */
export function promptManaSpec() {
  return { screens: {}, hud: { use: 'hud', children: [
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: { bind: 'prompt.up' }, children: [
      { use: 'legend', props: { rows: { bind: 'prompt.rows' } } },
    ] },
  ] } };
}

const PR_CSS = '.moj-pr{position:absolute;inset:0;pointer-events:none;z-index:8}.moj-pr .mana-root{background:none}'
  + '.moj-pr .mana-region[data-variant=bare],.moj-pr .mana-region[data-variant=bare]::before,.moj-pr .mana-region[data-variant=bare]::after{border:0!important;outline:0!important;background:none!important;box-shadow:none!important}'
  + '.moj-pr .mana-legend{color:#fff!important;font-weight:700;font-size:20px;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 6px rgba(0,0,0,.7)}'
  // (the ring: whole and dim while told, lit and closing while open; a flash on a hit, a shake on a miss)
  + '.moj-pr::after{content:"";position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;opacity:0;transition:opacity .12s;'
  + 'background:conic-gradient(var(--moj-pr-c,#fff) calc(var(--moj-pr-u,1) * 360deg),rgba(255,255,255,.14) 0);'
  + '-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 6px),#000 calc(100% - 5px));mask:radial-gradient(farthest-side,transparent calc(100% - 6px),#000 calc(100% - 5px))}'
  + '.moj-pr[data-phase=told]::after{opacity:.45}.moj-pr[data-phase=open]::after{opacity:1}'
  + '.moj-pr[data-phase=hit]::after{opacity:1;--moj-pr-c:#ffe9a8;animation:moj-pr-hit .28s ease-out both}'
  + '.moj-pr[data-phase=miss]::after{opacity:1;--moj-pr-c:#ff6b5a;animation:moj-pr-miss .3s ease-out both}'
  + '@keyframes moj-pr-hit{0%{transform:scale(1)}100%{transform:scale(1.5);opacity:0}}'
  + '@keyframes moj-pr-miss{0%,100%{transform:none}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}';

/** The page's side (inlined by toString): the runtime mounted, the world's prompt read each frame. */
export function promptManaPage(ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-pr'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { prompt: { up: false, rows: [] } };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  ui.mount(root, rt, { auto: true });
  const WORD = { press: '', mash: 'Mash', hold: 'Hold', aim: '' }, ARROW = { up: '▲', down: '▼', left: '◀', right: '▶' };
  // (a prompt's button as the controls layer binds it: the action is interact's key and button)
  const BOUND = { act: 'interact', jump: 'jump', fire: 'fire', melee: 'melee', dive: 'jump', boost: 'boost' };
  let sig = '', last = null, endT = 0;
  (function tick() {
    requestAnimationFrame(tick);
    const C = window.__mojCtrl, W = C && C.world, P = W && W.prompt;
    if (!P) return;
    const U = P.up, now = performance.now() / 1000;
    if (U) {
      last = U.id;
      const key = U.kind === 'aim' ? ARROW[U.dir] : (C.label && C.label(BOUND[U.button] || U.button)) || U.button.toUpperCase();
      const says = (U.P && U.P.says) || WORD[U.kind] || '';
      const open = U.t >= U.opens, u = open ? Math.max(0, (U.closes - U.t) / (U.closes - U.opens)) : 1;
      root.dataset.phase = open ? 'open' : 'told';
      root.style.setProperty('--moj-pr-u', u.toFixed(3));
      const next = JSON.stringify([key, says]);
      if (next !== sig) { sig = next; S.prompt = { up: true, rows: [says ? { action: key, label: says } : { action: key }] }; }
    } else if (last) {
      // just answered: its flash or its shake, then down
      root.dataset.phase = P.results[last] === 'hit' ? 'hit' : 'miss';
      endT = now; last = null; sig = '';
      S.prompt = { up: false, rows: [] };
    } else if (root.dataset.phase && now - endT > 0.35) root.dataset.phase = '';
  })();
  return { state: S, rt };
}

/** The page's script. `theme`: the look the level's HUD wears; `shared`: the page's one runtime (scene-three's prelude). */
export function promptManaScript(theme = null, { shared = null } = {}) {
  const spec = promptManaSpec();
  manaUi.readSpec(spec);
  return `
// THE QUICK-TIME PROMPT on mana-ui (scene/channels/prompt-mana.js): the button as the device draws it, its word, its ring closing
window.__mojPromptMana = (${promptManaPage.toString()})(${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? PR_CSS : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n${PR_CSS}`)});
`;
}
