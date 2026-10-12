/**
 * The SCENE channel: a level's scenes (playscape/ui/scenes.js) played on the page by the scene runner
 * (playscape/ui/scene-runner.js, shipped by toString, the same code the tests run). Emitted inside the events channel
 * only when the events carry `scenes`, so a world without scenes keeps every byte.
 *
 * Each frame, after the bus settles: the runner hears the bus log since the last frame, steps (its events go to the
 * bus, its camera ops to the cast), and the page draws the letterbox bars and the text box. While a scene plays the
 * player's input is held through the menus' freeze (`window.__mojMenuOpen`). Space, Enter, E or a click advance a line;
 * holding the key skips, as does Esc.
 */
import { buildSceneRunner } from '../../playscape/ui/scene-runner.js';

export const SCENE_CSS = `
.moj-scene-bar{position:fixed;left:0;right:0;height:0;background:#000;z-index:30;pointer-events:none}
.moj-scene-bar.top{top:0}.moj-scene-bar.bottom{bottom:0}
.moj-scene-box{position:fixed;left:50%;transform:translateX(-50%);width:min(720px,calc(100vw - 32px));box-sizing:border-box;background:var(--moj-panel-a,rgba(12,16,26,.92));border:1px solid var(--moj-line,#2a3b58);border-radius:10px;padding:12px 16px 14px;color:var(--moj-ink,#dfe8f8);font:16px/1.45 var(--moj-font,system-ui);z-index:31;display:none;cursor:pointer}
.moj-scene-who{color:var(--moj-accent,#8fa5c8);font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.moj-scene-more{position:absolute;right:12px;bottom:8px;font-size:12px;opacity:.7}
.moj-scene-on .moj-hud{visibility:hidden}
.moj-scene-hint{position:fixed;right:16px;z-index:31;font:11px var(--moj-font,system-ui);color:#9aa4b4;pointer-events:none;display:none}
`;

export function sceneScript() {
  return `
// SCENES: the runner (playscape/ui/scene-runner.js), the bars, the box, the keys
const __SCN = (${buildSceneRunner.toString()})();
const __scn = __SCN.create(EVENTS.scenes);
const __scnSt = document.createElement('style'); __scnSt.textContent = ${JSON.stringify(SCENE_CSS)}; document.head.appendChild(__scnSt);
const __scnTop = document.createElement('div'); __scnTop.className = 'moj-scene-bar top'; document.body.appendChild(__scnTop);
const __scnBot = document.createElement('div'); __scnBot.className = 'moj-scene-bar bottom'; document.body.appendChild(__scnBot);
const __scnBox = document.createElement('div'); __scnBox.className = 'moj-scene-box';
__scnBox.innerHTML = '<div class="moj-scene-who"></div><div class="moj-scene-say"></div><div class="moj-scene-more">\\u25b8</div>';
document.body.appendChild(__scnBox);
const __scnHint = document.createElement('div'); __scnHint.className = 'moj-scene-hint'; __scnHint.textContent = 'hold Space or Esc to skip'; document.body.appendChild(__scnHint);
const __scnWho = __scnBox.querySelector('.moj-scene-who'), __scnSay = __scnBox.querySelector('.moj-scene-say'), __scnMore = __scnBox.querySelector('.moj-scene-more');
const __SCN_KEYS = { Space: 1, Enter: 1, KeyE: 1 };
let __scnSeen = 0, __scnNext = false, __scnHeld = false, __scnSkip = false, __scnHolding = false, __scnShown = '';
window.addEventListener('keydown', (ev) => {
  if (!__scnHolding) return;
  if (__SCN_KEYS[ev.code]) { ev.preventDefault(); ev.stopImmediatePropagation(); if (!ev.repeat) __scnNext = true; __scnHeld = true; }
  else if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); __scnSkip = true; }
}, true);
window.addEventListener('keyup', (ev) => { if (__SCN_KEYS[ev.code]) __scnHeld = false; }, true);
window.addEventListener('pointerdown', () => { if (__scnHolding) __scnNext = true; }, true);
function __stepScenes(dtSec) {
  const types = [];
  for (let i = __scnSeen; i < __busState.log.length; i++) { const ev = __busState.log[i]; if (ev && ev.type) types.push(ev.type); }
  __scnSeen = __busState.log.length;
  __SCN.hear(__scn, types);
  // the bus vars: a scene's conditions are read against them as its happening comes
  const o = __SCN.step(__scn, dtSec, { next: __scnNext, held: __scnHeld, skip: __scnSkip, vars: __busState.vars });
  __scnNext = false; __scnSkip = false;
  // the beats' events first, and the cast ops they queue (a walk) handed down, so a skip's finish lands them too
  if (o.fire.length) { __BUS.processEvents(__busState, o.fire.map((type) => ({ type }))); __watchFix(); if (window.__mojCtrl) __BUS.syncToCtrl(__busState, window.__mojCtrl.world.entities, window.__mojCtrl.cast); }
  if (o.ops.length && window.__mojCtrl && window.__mojCtrl.cast) window.__mojCtrl.cast(o.ops);
  const v = __SCN.view(__scn), bar = (v.bars * 11).toFixed(2) + 'vh';
  __scnTop.style.height = bar; __scnBot.style.height = bar;
  __scnBox.style.bottom = 'calc(' + bar + ' + 16px)';
  __scnHint.style.top = 'calc(' + bar + ' + 8px)';
  __scnHint.style.display = v.on ? 'block' : 'none';
  const key = v.line ? v.line.name + '|' + v.line.text + '|' + v.line.full : '';
  if (key !== __scnShown) {
    __scnShown = key;
    __scnBox.style.display = v.line ? 'block' : 'none';
    if (v.line) { __scnWho.textContent = v.line.name; __scnSay.textContent = v.line.text; __scnMore.style.visibility = v.line.full ? 'visible' : 'hidden'; }
  }
  // the player's input is held while a scene plays (the menus' freeze); given back when it ends
  if (v.on) window.__mojMenuOpen = true; else if (__scnHolding) window.__mojMenuOpen = false;
  if (v.on !== __scnHolding) document.body.classList.toggle('moj-scene-on', v.on);   // the level's HUD steps aside
  if (!v.on) __scnHeld = false;
  __scnHolding = v.on;
}
window.__mojScenes = { on: () => __SCN.view(__scn).on, view: () => __SCN.view(__scn), next: () => { __scnNext = true; }, skip: () => { __scnSkip = true; } };`;
}
