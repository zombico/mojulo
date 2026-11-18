/**
 * THE HUD HOST — a level page's in-play HUD on mana-ui (docs/mana-ui.md): one runtime over a state object the page
 * writes each frame, drawn over the scene. What the HUD is (its spec, its theme, what it reads) is the level's own
 * (`manaHud`, written by whoever lays the level: a course's is gameworld/course-hud.js); this channel only hosts it.
 * A level without one carries not a byte of this.
 *
 *   manaHudScript({ spec, theme, feed }, { game? }) → the page's script ('' for none); `game`: the page is a game's
 *     level, so the HUD begins when the game's channel starts (the shell's params in hand)
 *     spec    a mana-ui spec: { hud, screens? } (a screen named `ready` is the start cue: while it is up the pilot's
 *             input is held, the controllable channel's own rule for any screen)
 *     (`touch`: the level is made for a screen and its pilot is steered by a virtual pad: the HUD carries the pad)
 *     theme   a mana-ui theme (a preset's name or a theme object, resolved by the level's author)
 *             or, for a level whose HUD is its own widget rows (`events.hud`): { rows: 'events', theme } and the rows
 *             handed in (`rows`, `register`): lowered by game/hud-mana.js to a spec and the feed below
 *     feed    { rows: { vars, gates, banners, toasts, lines }, hero } a level's rows off its bus (v.<k>, on.<k>,
 *             lines.<k>, moments) and the pilot's own gauges (hero.hp, hero.stamina); and/or, a course's: { kind: 'course', from, to, cue?: { beats, every, go, sub? },
 *             hint?: { seconds }, stamina? } (the pilot's place along +y from `from` to `to`)
 *
 * The state it writes (a spec binds these): course { metres, of, left, says } · run { show, at, of } (the shell's
 * `params.__run`) · hero { stamina, staminaMax, sprints } · coins { count } (the bus's `coins`) · start { count, sub } · hint { show } · moments [].
 * It reads no device: a HUD is seen. A part that is pressed (a level's button row, tapped or clicked) raises its event on
 * the level's bus (`window.__mojBus.press`, there only for a level with such a row). The page's own gauge and its widget rows are hidden while this stands (by a rule
 * on its class: the runtime that draws it is untouched). `window.__mojHud = { rt, state }` for a headless driver.
 */
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { hudToMana } from '../../game/hud-mana.js';
import { LETTER_RIM, letterRimFilter, immersiveCss } from '../../game/immersive-ui.js';
import { hudSubst, fmtDelta } from '../../game/hud-widgets.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/**
 * THE STYLE METER'S MOTION (a stylish action game's HUD draws no box: what changes is said on the letters). The tier's
 * letter fills from its foot as the tier is climbed; a tier gained slams it in, a tier lost shakes it; the top tier glows.
 * The combo's count is struck by each blow and grows heavier as the combo runs. In the theme's own colours and display
 * face; held still for a player who asks for less motion. Only on a page whose level carries the meter.
 */
function styleMeterCss() {
  const T = '#moj-mana-hud .mana-place[data-at=right] .mana-stack>.mana-text', F = 'calc(var(--moj-style-fill,0) * 100%)';
  return [
    `${T}{display:inline-block;font-family:var(--mana-display);font-weight:900;font-style:italic;line-height:.9;transform-origin:100% 60%;background-color:transparent}`,
    `${T}:first-child{font-size:5.4em;letter-spacing:-.02em;background:linear-gradient(to top,var(--mana-accent) ${F},var(--mana-ink) ${F});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;text-shadow:none;filter:${letterRimFilter()}}`,
    `${T}:first-child[data-ch]{animation:moj-style-up .42s cubic-bezier(.2,1.5,.4,1) both}`,
    `#moj-mana-hud[data-style-way=down] ${T.slice(14)}:first-child[data-ch]{animation:moj-style-down .5s ease-out both}`,
    `#moj-mana-hud[data-style-top=yes] .mana-place[data-at=right] .mana-stack{filter:drop-shadow(0 0 .6em var(--mana-accent))}`,
    // (the immersive HUD's letters: a light rim and a light shadow in the theme's accents, game/immersive-ui.js)
    `#moj-mana-hud :is(.mana-text,.mana-num,.mana-label){text-shadow:${LETTER_RIM}}`,
    `${T}:nth-child(2){font-size:calc(2.1em + 1.3em * var(--moj-style-heat,0));color:var(--mana-ink);text-shadow:${LETTER_RIM}}`,
    `${T}:nth-child(2)[data-ch]{animation:moj-style-hit .22s cubic-bezier(.2,1.8,.4,1) both}`,
    '@keyframes moj-style-up{0%{opacity:0;transform:scale(2.8) rotate(-14deg)}55%{opacity:1;transform:scale(.92) rotate(3deg)}100%{transform:none}}',
    '@keyframes moj-style-down{0%{opacity:.35;transform:translateX(0)}15%{transform:translateX(-.14em)}30%{transform:translateX(.11em)}45%{transform:translateX(-.07em)}60%{transform:translateX(.03em)}100%{opacity:1;transform:none}}',
    '@keyframes moj-style-hit{0%{transform:scale(1.7) rotate(-6deg);color:var(--mana-accent)}100%{transform:none}}',
    `@media (prefers-reduced-motion:reduce){${T}[data-ch]{animation:none!important}}`,
  ].join('');
}

/**
 * THE VITALS' LOOKS (a stylish game's HUD: no box; the forms do the work). The health and the Halo Meter are one figure
 * anchored by a crest at their root, so a short bar at the game's start reads as composed as a long one at its end: each
 * bar is drawn at its share of the length it reaches by the game's end (--moj-hp-span, --moj-dv-span), the end cap is one
 * shape at any length, and the gauge's stocks keep one rhythm however many there are. Three ways the forms answer:
 *   overlap    one slant; the gauge rides up over the health's lower edge and both run under the crest
 *   contrast   unlike forms: the health a thin pointed blade, the gauge heavy blocks, the crest round
 *   echo       one form twice: the same slant and cap, the gauge a step in and a step down, parallel
 * Lit as the letters are (immersive-ui.js): a light rim in the theme's accents, then the dark that keeps it read.
 */
function vitalsCss(look) {
  const V = '#moj-mana-hud .mana-stack:has(>.mana-bar:is([data-variant=hp],[data-variant=mp]))', H = `${V}>.mana-bar[data-variant=hp]`, D = `${V}>.mana-bar[data-variant=mp]`, S = `${V}>.mana-bar[data-variant=stamina]`;
  const LIGHT = 'color-mix(in srgb,var(--mana-accent) 60%,#fff)', A2 = 'var(--mana-accent2)';
  // (the gauge's own hue, as health is green whatever the theme: crimson-violet)
  const HALO = 'color-mix(in srgb,#d0124e 40%,#7b2cff)';
  const slant = (k) => `polygon(${k}em 0,100% 0,calc(100% - ${k}em) 100%,0 100%)`;
  const LOOK = {
    overlap: { crest: 'rotate(45deg)', crestW: 2.4, pad: 1.5, hp: { h: 1.05, clip: slant(0.55) }, dv: { h: 0.62, clip: slant(0.4), mt: -0.24, ml: 0.75, gap: 0.2 }, st: { mt: 0 } },
    contrast: { crest: 'none', crestW: 2.1, pad: 2.5, round: true, hp: { h: 0.5, clip: 'polygon(0 0,calc(100% - 1.4em) 0,100% 50%,calc(100% - 1.4em) 100%,0 100%)' }, dv: { h: 1.05, clip: slant(0.3), mt: 0.38, ml: 0, gap: 0.42 }, st: { mt: 0 } },
    echo: { crest: 'rotate(45deg) scale(.8)', crestW: 2, pad: 2.3, hp: { h: 0.8, clip: slant(0.5) }, dv: { h: 0.54, clip: slant(0.5), mt: 0.26, ml: 0.9, gap: 0.16 }, st: { mt: 0 } },
  }[look] || null;
  if (!LOOK) return '';
  const L = LOOK;
  return [
    `${V}{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:0!important;padding:.35em 0 .35em ${L.pad}em;font-size:18px;--moj-full:min(40vw,520px)}`,
    // the crest at the root: what the figure grows from
    `${V}::before{content:"";position:absolute;z-index:3;left:0;top:50%;width:${L.crestW}em;height:${L.crestW}em;margin-top:-${L.crestW / 2}em;transform:${L.crest};${L.round ? 'border-radius:50%;' : ''}background:radial-gradient(circle at 35% 30%,${LIGHT},var(--mana-accent) 45%,color-mix(in srgb,var(--mana-accent) 50%,#000));filter:drop-shadow(.06em .06em 0 ${A2}) drop-shadow(-.03em -.03em 0 #fff8) drop-shadow(0 .12em .2em rgba(0,0,0,.6))}`,
    `${V}>.mana-bar{display:block!important;min-width:0!important;position:relative;filter:drop-shadow(.07em .07em 0 ${A2}) drop-shadow(-.035em -.035em 0 ${LIGHT}) drop-shadow(0 .1em .18em rgba(0,0,0,.65));transition:width .6s cubic-bezier(.2,1.3,.4,1)}`,
    `${V}>.mana-bar>:is(.mana-label,.mana-num){display:none!important}`,
    // (every length in the figure is the figure's: the bar's own small type would shrink it)
    `${V}>.mana-bar,${V}>.mana-bar .mana-track{font-size:18px!important;line-height:1}`,
    `${V}>.mana-bar .mana-track{border:0!important;border-radius:0!important;box-shadow:none!important;background:color-mix(in srgb,#000 58%,transparent)!important;overflow:hidden}`,
    // the health: its share of the full length, its cap, its fill lit from above, the chip a hit took held then drained
    `${H}{width:calc(var(--moj-full) * var(--moj-hp-span,.5))}`,
    `${H} .mana-track{height:${L.hp.h}em!important;clip-path:${L.hp.clip}}`,
    `${H} .mana-track i{background:linear-gradient(180deg,color-mix(in srgb,var(--mana-hp) 35%,#fff) 0 24%,var(--mana-hp) 24% 68%,color-mix(in srgb,var(--mana-hp) 65%,#000))!important}`,
    `${H} .mana-track u{background:color-mix(in srgb,#fff 70%,var(--mana-harm))!important;opacity:.9}`,
    `${H}[data-low=yes] .mana-track i{background:linear-gradient(180deg,color-mix(in srgb,var(--mana-harm) 35%,#fff) 0 24%,var(--mana-harm) 24%)!important;animation:moj-vit-low .5s ease-in-out infinite alternate}`,
    // the Halo Meter: its share of the full stocks, one rhythm of stocks, a full stock alight
    `${D}{width:calc(var(--moj-full) * var(--moj-dv-span,.3) * .82);margin-top:${L.dv.mt}em;margin-left:${L.dv.ml}em;z-index:2}`,
    `${D} .mana-track{height:${L.dv.h}em!important;clip-path:${L.dv.clip}}`,
    `${D} .mana-track i{background:linear-gradient(180deg,color-mix(in srgb,${HALO} 55%,#fff) 0 22%,${HALO} 22% 70%,color-mix(in srgb,${HALO} 60%,#000))!important}`,
    `${D} .mana-track b{position:absolute;top:0;bottom:0;width:${L.dv.gap}em;margin-left:-${L.dv.gap / 2}em;background:#000!important;opacity:.85;transform:skewX(-28deg)}`,
    `${D} .mana-track s{background:color-mix(in srgb,${HALO} 35%,#fff)!important}`,
    // the transformation, said without a word: ready, the gauge breathes; transformed, the whole figure burns gold
    `#moj-mana-hud[data-halo=ready] ${D}{animation:moj-halo-ready .7s ease-in-out infinite alternate}`,
    `#moj-mana-hud[data-halo=on] ${V}>.mana-bar{filter:drop-shadow(0 0 .3em ${HALO}) drop-shadow(0 0 .7em ${HALO})}`,
    `#moj-mana-hud[data-halo=on] ${V}::before{background:radial-gradient(circle at 35% 30%,#fff,${HALO} 55%,color-mix(in srgb,${HALO} 55%,#000));animation:moj-halo-on .5s ease-in-out infinite alternate}`,
    `@keyframes moj-halo-ready{to{filter:drop-shadow(0 0 .45em ${HALO}) brightness(1.35)}}`,
    `@keyframes moj-halo-on{to{scale:1.12}}`,
    // the ready moment, once, the instant it comes full: a ring thrown off the crest and the gauge struck white
    `#moj-mana-hud[data-halo-cue] ${V}::after{content:"";position:absolute;z-index:4;left:${L.crestW / 2}em;top:50%;width:${L.crestW}em;height:${L.crestW}em;margin:-${L.crestW / 2}em 0 0 -${L.crestW / 2}em;border-radius:50%;border:.18em solid color-mix(in srgb,${HALO} 30%,#fff);box-shadow:0 0 .6em ${HALO};pointer-events:none;animation:moj-halo-cue .9s cubic-bezier(.1,.8,.3,1) forwards}`,
    `#moj-mana-hud[data-halo-cue] ${D} .mana-track i{animation:moj-halo-strike .9s ease-out}`,
    `@keyframes moj-halo-cue{from{scale:.4;opacity:1}to{scale:5;opacity:0}}`,
    `@keyframes moj-halo-strike{from{filter:brightness(3) saturate(0)}to{filter:none}}`,
    `${D}[data-ready=yes]{filter:drop-shadow(.07em .07em 0 ${A2}) drop-shadow(-.035em -.035em 0 ${LIGHT}) drop-shadow(0 0 .35em ${HALO})}`,
    // the sprint: a hairline over the health, as long as it
    `${S}{width:calc(var(--moj-full) * var(--moj-hp-span,.5) * .9);margin:${L.st.mt}em 0 .14em .25em}`,
    `${S} .mana-track{height:.2em!important;clip-path:${slant(0.12)};background:color-mix(in srgb,#000 40%,transparent)!important}`,
    `${S} .mana-track i{background:${LIGHT}!important}`,
    '@keyframes moj-vit-low{to{filter:brightness(1.5)}}',
    `@media (prefers-reduced-motion:reduce){${V} *{animation:none!important}}`,
  ].join('');
}

/** The way on's arrow: a letter like the rest (immersive-ui.js), breathing so it is found. */
const wayCss = () => `#moj-way{position:absolute;display:none;pointer-events:none;font:900 2.4em/1 var(--mana-display,system-ui);color:var(--mana-accent,#ffe07a);text-shadow:${LETTER_RIM};animation:moj-way .8s ease-in-out infinite alternate}@keyframes moj-way{to{scale:1.25;opacity:.7}}@media (prefers-reduced-motion:reduce){#moj-way{animation:none}}`;

export function manaHudScript(hud, { game = false, rows = null, register = null, touch = false } = {}) {
  // (a level whose HUD is its own rows, `rows: 'events'`: lowered here, where the page emits them, game/hud-mana.js)
  if (hud && hud.rows === 'events' && !hud.spec) { const L = hudToMana(rows, { register, hero: hud.hero !== false, touch, style: hud.style === true, vitals: hud.vitals ?? null }); hud = { ...hud, spec: L.spec, feed: { ...L.feed, ...(hud.feed ?? {}) } }; }
  if (!hud || !hud.spec) return '';
  // (a HUD of the level's own making, a course's: the level's buttons for a touch screen alone, game/screen-keys.js, are
  // drawn by it too, since the page's own widget rows stand down beside it)
  if (hud.rows !== 'events' && hud.spec.hud && Array.isArray(rows) && rows.some((r) => r && r.touch === true && r.key !== undefined)) {
    const K = hudToMana(rows.filter((r) => r && r.touch === true && r.key !== undefined), { hero: false });
    hud = { ...hud, spec: { ...hud.spec, hud: { ...hud.spec.hud, children: [...(hud.spec.hud.children ?? []), ...K.spec.hud.children] } } };
  }
  // THE TOUCH PAD (controllable/touch.js): on a level made for a screen the HUD draws the virtual pad's stick and pads at
  // its foot, from what the touch layer says of itself each frame (touch.*: on, lane, held, down, buttons); the layer
  // reads the thumbs and draws nothing
  if (touch && hud.spec.hud) {
    const T = (k) => ({ bind: `touch.${k}` });
    const pad = { use: 'region', props: { at: 'bottom', variant: 'bare' }, when: T('on'), children: [{ use: 'touchpad', props: { lane: T('lane'), held: T('held'), down: T('down'), buttons: T('buttons') } }] };
    hud = { ...hud, spec: { ...hud.spec, hud: { ...hud.spec.hud, children: [...(hud.spec.hud.children ?? []), pad] } } };
  }
  // THE WAY ON (a level's `manaHud.ways`: { var, at }): an arrow, no words, toward the place the bus var names (a
  // gauntlet's next arena waiting to be walked into); only then
  const ways = hud.ways && typeof hud.ways.var === 'string' && Array.isArray(hud.ways.at) ? { var: hud.ways.var, at: hud.ways.at } : null;
  const vit = hud.feed && hud.feed.vitals ? hud.feed.vitals : null;
  const R = hud.feed && hud.feed.rows;
  const css = `${manaCss()}\n${themeCss(hud.theme ?? 'greybox')}\n#moj-mana-hud{position:absolute;inset:0;pointer-events:none;z-index:30}.moj-c-gauge,.moj-hud-col${hud.feed && hud.feed.hero ? ',.moj-c-hp' : ''}{display:none!important}${hud.feed && hud.feed.immersive ? immersiveCss('#moj-mana-hud') : ''}${hud.feed && hud.feed.style ? styleMeterCss() : ''}${ways ? wayCss() : ''}${vit ? vitalsCss(vit.look) : ''}`;
  const styled = !!(hud.feed && hud.feed.style);
  return `
// THE HUD on mana-ui (channels/mana-hud.js): the level's own spec over a state this page feeds
(function () {
  const CFG = ${json({ spec: hud.spec, feed: hud.feed ?? {}, ...(ways ? { ways } : {}) })}, GAME = ${game ? 'true' : 'false'};
  const manaUi = ${manaUiSource()};
  const sheet = document.createElement('style'); sheet.textContent = ${json(css)}; document.head.appendChild(sheet);
  // (laid over the scene's own frame, as the level's widgets were: a letterboxed scene keeps its HUD inside it)
  const root = document.createElement('div'); root.id = 'moj-mana-hud'; (document.getElementById('wrap') || document.body).appendChild(root);
  const F = CFG.feed, of = Math.max(1, Math.round((F.to || 0) - (F.from || 0)));
  const st = { touch: { on: false, lane: false, held: null, down: [], buttons: [], hint: '' }, course: { metres: 0, of: of, left: of, says: of + ' ' + (F.left || 'm'), short: of + ' ' + (F.leftShort || 'm') }, run: { show: false, at: 1, of: 1 }, hero: { stamina: 1, staminaMax: 1, sprints: !!F.stamina, hp: 1, hpMax: 1, hasHp: false }, coins: { count: 0 }, start: { count: '', sub: '' }, hint: { show: false }, moments: [], v: {}, on: {}, lines: {}${hud.feed && hud.feed.style ? ", style: { on: false, name: '', combo: 0 }" : ''}${vit ? ", halo: { on: false, fill: 0, stocks: 1 }, vit: { hp: 0, max: 1, has: false, ghost: 0 }" : ''} };
  let hooked = false, clock = 0, cue = null, hintUntil = -1, last = performance.now();
${styled ? '  let sTier = 0;\n' : ''}${vit ? `  // THE VITALS (game/hud-mana.js vitals): the hit's chip held a moment then drained; each bar's length its share of what it
  // reaches by the game's end, so the figure grows across the game and is laid out for its end from the start
  const VIT = CFG.feed.vitals; let vHp = null, vGhost = 0, vHold = 0, vCue = 0, vFull = VIT.full.hp || 0;
  root.dataset.vitals = VIT.look;
  const at = (path) => (typeof path === 'number' ? path : String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), st));
  function vitals() {
    const P = VIT.hp, h = Number(at(P.value)) || 0, mx = Math.max(1, Number(at(P.max)) || 1);
    st.vit.hp = h; st.vit.max = mx; st.vit.has = P.has ? !!at(P.has) : true;
    if (vHp !== null && h < vHp) { vGhost = Math.max(vGhost, vHp); vHold = clock + 0.7; } vHp = h; if (clock > vHold) vGhost = h; st.vit.ghost = vGhost;
    if (!vFull && st.vit.has) vFull = mx * 2;
    if (vFull) root.style.setProperty('--moj-hp-span', String(Math.min(1, mx / vFull)));
    const SM = window.__mojStyle && window.__mojStyle.now(), dv = SM && SM.halo; st.halo.on = !!dv;
    const was = root.dataset.halo; root.dataset.halo = dv ? (dv.on ? 'on' : dv.ready ? 'ready' : '') : '';
    if (root.dataset.halo === 'ready' && was !== 'ready' && was !== 'on') { root.dataset.haloCue = ''; vCue = clock + 0.9; } else if (vCue && clock > vCue) { delete root.dataset.haloCue; vCue = 0; }
    if (dv) { st.halo.fill = dv.fill; st.halo.stocks = dv.stocks; root.style.setProperty('--moj-dv-span', String(Math.min(1, dv.stocks / (VIT.full.halo || 10)))); }
  }
` : ''}${hud.feed && hud.feed.immersive ? `  // (the immersive HUD, game/immersive-ui.js: the page's own weapon panel on no plate either)
  let bared = false;
  function bare() { const a = document.getElementById('__ammoTxt'), pnl = a && a.parentElement && a.parentElement.parentElement; if (pnl) { bared = true; pnl.style.background = 'transparent'; pnl.style.border = '0'; } }
` : ''}${ways ? `  // the way on: an arrow over the place while it is in view, at the screen's edge pointing to it while it is not
  const wayEl = document.createElement('div'); wayEl.id = 'moj-way'; wayEl.textContent = '\u27A4'; const wayV = new THREE.Vector3();
  function way(V) {
    const k = V ? V[CFG.ways.var] : -1, P = k >= 0 ? CFG.ways.at[k] : null;
    if (!P || typeof camera === 'undefined') { wayEl.style.display = 'none'; return; }
    if (!wayEl.parentNode) (root.querySelector('.mana-root') || root).appendChild(wayEl);
    wayV.set(P[0], P[1], (P[2] || 0) + 1.6).project(camera);
    let x = wayV.x, y = wayV.y, ang = Math.PI / 2;
    const behind = wayV.z > 1; if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 0.86 || Math.abs(y) > 0.78) { const m = Math.max(Math.abs(x) / 0.86, Math.abs(y) / 0.78) || 1; x /= m; y /= m; ang = Math.atan2(-y, x); }
    wayEl.style.display = 'block'; wayEl.style.left = ((x + 1) * 50) + '%'; wayEl.style.top = ((1 - y) * 50) + '%'; wayEl.style.transform = 'translate(-50%,-50%) rotate(' + ang.toFixed(3) + 'rad)';
  }
` : ''}  // a HUD part pressed (a level's button row): its event raised on the level's bus, as a key bound to it would
  // (a keyed one, game/screen-keys.js: that key pressed, heard by whatever listens for it)
  function press(e) {
    if (e && typeof e.key === 'string') { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key: e.key, code: e.code || e.key, bubbles: true, cancelable: true })); return; }
    if (e && typeof e.emit === 'string' && window.__mojBus && window.__mojBus.press) window.__mojBus.press(e.emit);
  }
  const rt = manaUi.runtime(CFG.spec, { read: function (p) { return manaUi.readPath(st, p); }, act: press, now: function () { return clock; } });
  rt.glyphs({ keys: { jump: 'Space', steer: 'A · D' }, pad: { xbox: { jump: 'A', steer: 'L' }, playstation: { jump: '✕', steer: 'L' }, nintendo: { jump: 'B', steer: 'L' } }, touch: { jump: 'tap', steer: 'swipe' } });
  // (the device in hand: a touch screen, or the page told to be one, as the touch layer reads it)
  const __tq = new URLSearchParams(location.search).get('touch');
  rt.input(__tq === '1' || (__tq !== '0' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'touch' : 'keys');
  const view = manaUi.mount(root, rt, { auto: true });
  window.__mojHud = { rt: rt, state: st };
  // the level has started (the shell's params are in): its place in the run, and the start cue
  function begin(params) {
    const R = params && params.__run;
    if (R && R.of > 1) { st.run.show = true; st.run.at = R.at; st.run.of = R.of; }
    if (F.hint && (!R || R.at === 1)) hintUntil = 1e9;   // (shown from the cue; timed from GO)
    if (F.cue && CFG.spec.screens && CFG.spec.screens.ready) { cue = { t0: clock }; st.start.count = F.cue.beats[0]; st.start.sub = F.cue.sub || ''; rt.open('ready'); view.paint(); }
    else if (hintUntil > 0) hintUntil = clock + F.hint.seconds;
  }
  // A LEVEL'S ROWS (game/hud-mana.js): its vars read off the bus, its gated and timed rows said on or off, its banners
  // called as moments and its toasts as lines when the bus's log names their event (or their var changes)
  const ROWS = F.rows || null;
  ${R ? `${hudSubst.toString()}
  ${fmtDelta.toString()}
  function glob(str, pat) {   // the game.on glob: '*' spans, literals anchor at both ends
    str = String(str); if (pat === '*') return true;
    const parts = pat.split('*'); if (parts.length === 1) return str === pat;
    let pos = 0;
    for (let i = 0; i < parts.length; i++) { const p = parts[i]; if (!p) continue; const at = str.indexOf(p, pos); if (at < 0 || (i === 0 && at !== 0)) return false; pos = at + p.length; }
    return !parts[parts.length - 1] || pos === str.length;
  }
  function stands(w, V) {   // a part not hidden (ui-<id>, ui-<id>-state), in one of its phases
    if (w.id && (V['ui-' + w.id] === 0 || V['ui-' + w.id + '-state'] === 0)) return false;
    return !(w.when && w.when.indexOf(typeof V.phase === 'number' ? V.phase : 0) < 0);
  }
  let logN = -1, seq = 0; const live = [], prev = {};
  ROWS.lines.forEach(function (k) { st.lines[k] = []; });
  function line(tw, text) { live.push({ k: tw.line, text: text, until: clock + tw.ttl }); st.lines[tw.line] = st.lines[tw.line].concat([{ text: text }]); }
  function rows(bus, V) {
    for (const k in ROWS.vars) { const raw = V[ROWS.vars[k]]; st.v[k] = raw != null ? raw : 0; }
    for (const g of ROWS.gates) st.on[g.k] = stands(g, V) && (!g.ttl || clock < g.ttl);
    const log = bus.log || [];
    if (logN < 0 || log.length < logN) logN = logN < 0 ? log.length : 0;
    for (let i = logN; i < log.length; i++) {
      const ev = log[i]; if (!ev || !ev.type) continue;
      for (const b of ROWS.banners) if (glob(ev.type, b.on) && stands(b, V)) st.moments = st.moments.slice(-5).concat([{ id: 'b' + (seq++), text: hudSubst(b.text, V, { event: ev }) }]);
      for (const tw of ROWS.toasts) if (tw.on && glob(ev.type, tw.on) && stands(tw, V)) line(tw, hudSubst(tw.text, V, { event: ev }));
    }
    logN = log.length;
    ROWS.toasts.forEach(function (tw, i) {   // the var toast: fires on a change, seeded silently on its first frame
      if (!tw.var) return;
      const raw = V[tw.var], v = typeof raw === 'number' ? raw : 0;
      if (prev[i] === undefined) prev[i] = v;
      else if (v !== prev[i]) { const d = v - prev[i]; prev[i] = v; if (stands(tw, V)) line(tw, hudSubst(tw.text, V, { delta: fmtDelta(d), value: v })); }
    });
    for (let i = live.length - 1; i >= 0; i--) if (clock >= live[i].until) { const l = live[i]; live.splice(i, 1); const at = st.lines[l.k].findIndex(function (r) { return r.text === l.text; }); if (at >= 0) st.lines[l.k] = st.lines[l.k].filter(function (_, j) { return j !== at; }); }
  }` : 'function rows() {}'}
  (function tick() {
    requestAnimationFrame(tick);
    // (hooked once the game's channel is up, which on a level of a game may be some frames after this one: its start
    // hands over the shell's params, the run among them. A page with no game begins at once)
    if (!hooked && (!GAME || (window.__mojGame && window.__mojGame.onStart))) { hooked = true; if (GAME) window.__mojGame.onStart(begin); else begin(null); }
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
    const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.pilotId && W.byId[W.pilotId];
    if (me && me.transform) {
      const m = Math.max(0, Math.min(of, me.transform.pos[1] - (F.from || 0)));
      st.course.metres = Math.round(m); st.course.left = of - Math.round(m); st.course.says = st.course.left + ' ' + (F.left || 'm'); st.course.short = st.course.left + ' ' + (F.leftShort || 'm');
      if (F.stamina && me.rule) { const max = me.rule.boostMax || 1; st.hero.staminaMax = max; st.hero.stamina = Math.max(0, Math.min(max, me.boost == null ? max : me.boost)); }
    }
    // the pilot's own gauges (a level's rows, feed.hero): its health where it has one, its sprint where its rule has one
    if (F.hero && me) {
      const hm = Number.isFinite(me.hpMax) && me.hpMax > 0 ? me.hpMax : 0;
      st.hero.hasHp = hm > 0; st.hero.hpMax = hm || 1; st.hero.hp = Math.max(0, Math.min(hm, me.hp == null ? hm : me.hp));
      const bm = me.rule && me.rule.boostMax > 0 ? me.rule.boostMax : 0;
      st.hero.sprints = bm > 0; st.hero.staminaMax = bm || 1; st.hero.stamina = Math.max(0, Math.min(bm, me.boost == null ? bm : me.boost));
    }
${hud.feed && hud.feed.style ? `    // the style meter (worlds/controllable/style.js), where the page says it: it stands while there is style to show
    const SM = window.__mojStyle && window.__mojStyle.now(); if (SM) { st.style.on = SM.points > 0 || SM.combo > 0; st.style.name = SM.name; st.style.combo = SM.combo; if (SM.tier !== sTier) { root.dataset.styleWay = SM.tier > sTier ? 'up' : 'down'; sTier = SM.tier; root.dataset.styleTop = SM.tier === SM.tiers.length - 1 ? 'yes' : 'no'; } root.style.setProperty('--moj-style-fill', String(SM.fill)); root.style.setProperty('--moj-style-heat', String(Math.min(1, SM.combo / 30))); }
` : ''}    const V = window.__mojBus && window.__mojBus.state && window.__mojBus.state.vars;
    if (V && V.coins != null) st.coins.count = V.coins;
${ways ? '    way(V);\n' : ''}${hud.feed && hud.feed.immersive ? '    if (!bared) bare();\n' : ''}    if (ROWS && V) rows(window.__mojBus.state, V);
${vit ? '    if (F.hero) vitals();\n' : ''}    if (cue) {
      const k = Math.floor((clock - cue.t0) / F.cue.every);
      if (k < F.cue.beats.length) st.start.count = F.cue.beats[k];
      else { cue = null; rt.close(); st.moments = st.moments.concat([{ id: 'go', text: F.cue.go, weight: 'major' }]); if (hintUntil > 0) hintUntil = clock + F.hint.seconds; }
    }
    st.hint.show = clock < hintUntil;
    // (the touch layer's word for its pad, when the page has one)
    // (a page whose touch layer draws itself still says whether it is up: a button for a touch screen alone reads it)
    const TT = window.__mojTouch; if (TT) { if (TT.view) st.touch = TT.view(); else st.touch.on = !!TT.on() && !window.__mojMenuOpen; }
  })();
})();`;
}
