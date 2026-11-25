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
 * A race's (`feed.kind: 'race'`, gameworld/race-hud.js): race { place, of, placeSays, field, lap, laps, lapSays, time,
 * best, hasBest, speed, speedMax, markers, solo } · start { lit, of, sub }: its lights held as a screen with the world
 * frozen (`window.__mojFreeze`, the race's clock with it) until they go out, then read off the laps mechanic's vars.
 * It reads no device: a HUD is seen. A part that is pressed (a level's button row, tapped or clicked) raises its event on
 * the level's bus (`window.__mojBus.press`, there only for a level with such a row). The page's own gauge and its widget rows are hidden while this stands (by a rule
 * on its class: the runtime that draws it is untouched). `window.__mojHud = { rt, state }` for a headless driver.
 *
 * THE PILOT'S PARTS (a level's rows with `hero`, game/hud-mana.js), read each frame off what the page already has and
 * drawn in its stead: the health (the pilot's, or the level's health row: its highest as its max) at rest while full and
 * the screen's edge closing in under half; the gun in hand off its loadout or its weapon (the page's own weapon panel put
 * away); the world clock's slow-motion as a charge (the moment a dodge sets off, else the first); the page's radar as a
 * scope (radar.js marks; the canvas put away), its damage ring as arcs (window.__mojDamageRing; its bars put away) and
 * its weapon selector as the wheel (window.__mojWc; its panel put away). What the page lacks stands down.
 *
 * THE TALK BOX (`talk`: the page plays a level's scenes, playscape/ui/talk-box.js): the scenes' lines and choices drawn
 * by mana-ui's talk presenter in the HUD's theme, a second runtime on this one's kernel and sheet over a root of its own
 * (`#moj-mana-talk`), fed each frame from the scene runner's view (window.__mojScenes). The page's own box and its hint
 * stand down, and the HUD steps aside while a scene plays (as the page's own HUD does). The input stays the scene
 * channel's: a press goes on, holding or Esc skips, and a choice's row pressed is that answer. `window.__mojTalk = { rt,
 * state, face? }` for a headless driver.
 *   talk: true, or { faces?, speakers? }: `faces` the speakers' own figures are drawn live in the box's face
 *   (scene/channels/talk-face.js: the page's renderer, its bodies and the frame's pre-pass hook `window.__mojTalkFace`,
 *   which scene-three.js calls before each render on such a page); `speakers` the level's sheet (talk-box.js
 *   readSpeakers), a speaker whose portrait is `none` shown by the box alone. A speaker with no body on the page, or one
 *   hidden (the player's in first person), has no face.
 */
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { hudToMana } from '../../game/hud-mana.js';
import { LETTER_RIM, letterRimFilter, immersiveCss } from '../../game/immersive-ui.js';
import { hudSubst, fmtDelta } from '../../game/hud-widgets.js';
import { manaControls, manaHostSource } from '../../controls/mana-controls.js';
import { radarMarks, sceneThings, RADAR, planSvg, planBox, radarPlan, planFloors, floorPlanSvg } from '../../gameworld/radar.js';
import { hitBearing } from '../../gameworld/damage-ring.js';
import { boxMapView } from '../../gameworld/metroidvania/hud.js';
import { talkSpec, talkState, TALK_GLYPHS } from '../../playscape/ui/talk-box.js';
import { faceFrame, buildTalkFace } from './talk-face.js';

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


// the talk box's own place (the presenter's root over the HUD's; the box over the scene's bottom letterbox bar, as the
// page's own box sat over the bottom one), the page's box and hint put away, the HUD aside while a
// scene plays; a choice's rows take the pointer
const TALK_CSS = '#moj-mana-talk{position:fixed;inset:0;pointer-events:none;z-index:32}'
  + '#moj-mana-talk .mana-place[data-at=bottom]{bottom:calc(11vh + 12px);width:min(92%,max(62%,560px));align-items:stretch}'
  + '#moj-mana-talk .mana-place[data-at=bottom] :is(.mana-region,.mana-window){align-self:stretch;box-sizing:border-box}'
  + '#moj-mana-talk .mana-each>*{pointer-events:auto;cursor:pointer}'
  + '.moj-scene-box,.moj-scene-hint{display:none!important}.moj-scene-on #moj-mana-hud{visibility:hidden}';

export function manaHudScript(hud, { game = false, rows = null, register = null, touch = false, radarMap = null, talk = false, boss = false, shared = null } = {}) {
  // (a level whose HUD is its own rows, `rows: 'events'`: lowered here, where the page emits them, game/hud-mana.js)
  if (hud && hud.rows === 'events' && !hud.spec) { const L = hudToMana(rows, { register, hero: hud.hero !== false, touch, ...(hud.radar ? { radar: hud.radar } : {}), ...(boss ? { boss: true } : {}), style: hud.style === true, vitals: hud.vitals ?? null }); hud = { ...hud, spec: L.spec, feed: { ...L.feed, ...(hud.feed ?? {}) } }; }
  // (a level's radar look, game/hud-mana.js RADAR_LOOK: its size and a square scope's face are this HUD's own CSS, and its
  // floor the plan and the guards of the pilot's floor alone; absent, not one byte)
  const RL = hud && hud.radar ? hud.radar : null, floorRadar = !!(RL && RL.floor);
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
  const radarCss = !RL ? '' : (RL.size === 'large' ? '#moj-mana-hud .mana-minimap{width:calc(260 * var(--mana-du));height:calc(260 * var(--mana-du))}' : '')
    + (RL.shape === 'square' ? '#moj-mana-hud .mana-minimap[data-shape=square][data-scope=yes]{border-radius:calc(6 * var(--mana-du));background:color-mix(in srgb,var(--mana-panel) 38%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--mana-ink) 40%,transparent);overflow:hidden}'
      + '#moj-mana-hud .mana-minimap[data-shape=square] .mana-planclip{border-radius:calc(6 * var(--mana-du))}#moj-mana-hud .mana-minimap[data-shape=square] .mana-bezel::before{display:none}'
      + '#moj-mana-hud .mana-minimap[data-shape=square][data-scope=yes]::before{border-radius:0}'
      + '#moj-mana-hud .mana-minimap[data-shape=square] .mana-cone{border-radius:0}' : '');
  // THE WAY ON (a level's `manaHud.ways`: { var, at }): an arrow, no words, toward the place the bus var names (a
  // gauntlet's next arena waiting to be walked into); only then
  const ways = hud.ways && typeof hud.ways.var === 'string' && Array.isArray(hud.ways.at) ? { var: hud.ways.var, at: hud.ways.at } : null;
  const vit = hud.feed && hud.feed.vitals ? hud.feed.vitals : null;
  const R = hud.feed && hud.feed.rows;
  // (a race's feed, gameworld/race-hud.js: its lights, laps, times and map; any other HUD carries none of it)
  const race = !!(hud.feed && hud.feed.kind === 'race');
  // (`shared`: the page carries the runtime and the theme's sheet once for its HUD and its screens, scene-three's
  // prelude: this host names it and adds only its own rules; alone on a page, it carries both itself, as it did)
  const css = `${shared ? '' : `${manaCss()}\n${themeCss(hud.theme ?? 'greybox')}\n`}${radarCss ? `${radarCss}\n` : ''}#moj-mana-hud{position:absolute;inset:0;pointer-events:none;z-index:30}.moj-c-gauge,.moj-hud-col${hud.feed && hud.feed.hero ? ',.moj-c-hp,#__radar,#__wc,#__damageRing,div:has(>#__wepIcon)' : ''}{display:none!important}`
    // (money in a corner: the coin and a figure that leads, large, the way an open world shows the cash in hand)
    + '#moj-mana-hud .mana-place:is([data-at=top-right],[data-at=top-left])>.mana-region>.mana-counter:has(>[data-icon=coin]) .mana-num{font:800 38px/1 var(--mana-display);letter-spacing:-.5px}'
    + '#moj-mana-hud .mana-place>.mana-region>.mana-counter:has(>[data-icon=coin]){gap:10px;align-items:center}'
    + (talk ? TALK_CSS : '')
    + `${hud.feed && hud.feed.immersive ? immersiveCss('#moj-mana-hud') : ''}${hud.feed && hud.feed.style ? styleMeterCss() : ''}${ways ? wayCss() : ''}${vit ? vitalsCss(vit.look) : ''}`;
  const styled = !!(hud.feed && hud.feed.style);
  const H = !!(hud.feed && hud.feed.hero);
  const faces = !!(talk && talk.faces), speakers = (talk && talk.speakers) || {};
  // (a HUD of the level's own making may bring its parts' look over the theme: a side map's, gameworld/side-map/hud.js)
  const sheetCss = hud.css ? `${css}\n${hud.css}` : css, SM = hud.feed && hud.feed.sidemap ? hud.feed.sidemap : null;
  // (a BOX's vitals, moments, boss and pause, gameworld/metroidvania/hud.js; and the HUD's SOUNDS where its look is heard,
  // mana-hud-sounds.js: its cues played by the beats kernel the set needs. Either absent, not a byte of it)
  const BX = hud.feed && hud.feed.box ? hud.feed.box : null, HS = hud.sounds && hud.sounds.sounds ? hud.sounds : null;
  return `
// THE HUD on mana-ui (channels/mana-hud.js): the level's own spec over a state this page feeds
(function () {
  const CFG = ${json({ spec: hud.spec, feed: hud.feed ?? {}, ...(ways ? { ways } : {}) })}, GAME = ${game ? 'true' : 'false'};
  const manaUi = ${shared || manaUiSource()};${H ? `
  const __hRadar = ${radarMarks.toString()}, __hThings = ${sceneThings.toString()}, __hBearing = ${hitBearing.toString()}, __hR = ${json({ ...RADAR, range: 40 })};
  // (the map under the scope, radar.js: the level's plan from its own colliders and its tall grass, drawn once, the first
  // frame the radar is up; laid under the scope each frame at the radar's scale, ahead at the top)
  const __hPlanSvg = ${planSvg.toString()}, __hPlanBox = ${planBox.toString()}, __hPlanAt = ${radarPlan.toString()};
  let __hPlan = null;${floorRadar ? `
  // (the radar of one floor: the level's floors, each one's plan drawn the first time the pilot stands on it)
  const __hFloors = ${planFloors.toString()}, __hFloorSvg = ${floorPlanSvg.toString()};
  let __hFl = null, __hBox = null; const __hFlPlans = {};` : ''}${radarMap ? `
  // (the land under it too, a level's \`radar.map\`: its contours and its trail, read when the level was built)
  const __hLand = ${json(radarMap)};` : ''}` : ''}
  const sheet = document.createElement('style'); sheet.textContent = ${json(sheetCss)}; document.head.appendChild(sheet);
  // (laid over the scene's own frame, as the level's widgets were: a letterboxed scene keeps its HUD inside it)
  const root = document.createElement('div'); root.id = 'moj-mana-hud'; (document.getElementById('wrap') || document.body).appendChild(root);
  const F = CFG.feed, of = Math.max(1, Math.round((F.to || 0) - (F.from || 0)));
  const st = { touch: { on: false, lane: false, held: null, down: [], buttons: [], hint: '' }, course: { metres: 0, of: of, left: of, says: of + ' ' + (F.left || 'm'), short: of + ' ' + (F.leftShort || 'm') }, run: { show: false, at: 1, of: 1 }, gun: { on: false }, focus: { on: false }, radar: { on: false, marks: [], north: 0 }, ring: { on: false, hits: [] }, wheel: { open: false, slots: [], title: '' }, top: {}, hero: { stamina: 1, staminaMax: 1, sprints: !!F.stamina, hp: 1, hpMax: 1, hasHp: false }, coins: { count: 0 }, start: { count: '', sub: '' }, hint: { show: false }, moments: [], v: {}, on: {}, lines: {}${hud.feed && hud.feed.style ? ", style: { on: false, name: '', combo: 0 }" : ''}${vit ? ", halo: { on: false, fill: 0, stocks: 1 }, vit: { hp: 0, max: 1, has: false, ghost: 0 }" : ''} };
  ${SM ? `// A SIDE MAP's columns and screens (gameworld/side-map/hud.js): the energy, the boss's while it fights, READY and the
  // lives under it, the keys at first; the intro card, the start menu and GAME OVER over the held level
  const SMF = F.sidemap, SMK = ${json({ keys: manaControls().keys, pad: manaControls().pad })};
  st.sm = { lives: SMF.lives, livesWord: '×' + SMF.lives, energy: SMF.energy || 0, weaponOn: false, weapon: 0, weaponMax: 1, bossOn: false, boss: SMF.boss ? SMF.boss.hp : 0, ready: !SMF.intro, keysOn: true, keys: SMF.keys, moments: [], weapons: [], gate: '', keep: 'Weapons' };
  let smLives = -1, smReady = SMF.intro ? -1 : 2.4, smKeys = 8, smBoss = null, smOn = false, smOff = -1, smTint = null, smUp = null, smQuiet = false, smIntro = -1, smOver = -1;
  if (SMF.intro && SMF.intro.hue) root.style.setProperty('--sm-hue', SMF.intro.hue);
  // (a screen up holds the level as a level's own menus do: no input to the pilot, the world and its clock stopped, and
  // the shell's Esc menu not asked for over it, scene-three's .moj-menu-hud)
  const smHold = document.createElement('div'); smHold.className = 'moj-menu-hud'; smHold.style.display = 'none'; document.body.appendChild(smHold);
  function smOpen(id) { smQuiet = true; try { rt.close(); rt.open(id); } finally { smQuiet = false; } smUp = id; window.__mojMenuOpen = true; window.__mojFreeze = true; smHold.textContent = id; view.paint(); smTints(); }
  function smClose() { if (!smUp) return; smUp = null; smQuiet = true; try { rt.close(); } finally { smQuiet = false; } window.__mojMenuOpen = false; window.__mojFreeze = false; setTimeout(function () { if (!smUp) smHold.textContent = ''; }, 0); view.paint(); }
  // (an event raised on the level's bus, heard by its mechanics and its game: a continue, a giving up)
  function smBus(type) { const M = window.__mojBus; if (M && M.bus && M.state) M.bus.processEvents(M.state, [{ type: type }]); }
  function smPilot() { const W = window.__mojCtrl && window.__mojCtrl.world; return W && W.pilotId ? W.byId[W.pilotId] : null; }
  // the start menu's weapons: the loadout's held slots in order (the buster first), the rest of the game's locked
  function smWeapons() {
    const me = smPilot(), lo = me && ((me.pilotRule && me.pilotRule.loadout) || (me.rule && me.rule.loadout)), ws = me && me.loadoutWeapons, rows = [];
    if (Array.isArray(lo) && ws) lo.forEach(function (c, i) {
      if (me.loadoutHeld && !me.loadoutHeld[i]) return;
      const w = ws[i], en = !!(w && w.energyMax > 0);
      rows.push({ name: (c && c.name) || 'Weapon', icon: rows.length ? 'bolt' : 'target', bar: en, e: en ? Math.max(0, Math.round(w.energy == null ? w.energyMax : w.energy)) : 0, max: en ? w.energyMax : 1, tint: w && typeof w.fxColor === 'string' ? w.fxColor : '', then: { emit: 'sm:equip', i: i } });
    });
    else rows.push({ name: 'Buster', icon: 'target', bar: false, e: 0, max: 1, tint: '', then: { emit: 'sm:equip', i: -1 } });
    while (rows.length < SMF.slots) rows.push({ name: '— — —', icon: 'lock', bar: false, e: 0, max: 1, tint: '#555555', then: { emit: 'sm:none' } });
    st.sm.weapons = rows;
  }
  function smTints() { const R = root.querySelectorAll('.mana-screen .mana-list .mana-row'); st.sm.weapons.forEach(function (w, i) { if (R[i]) { if (w.tint) R[i].style.setProperty('--tint', w.tint); else R[i].style.removeProperty('--tint'); } }); }
  function smEquip(i) {
    const me = smPilot(), lo = me && ((me.pilotRule && me.pilotRule.loadout) || (me.rule && me.rule.loadout));
    if (!me || !Array.isArray(lo) || !me.loadoutWeapons || i < 0 || !me.loadoutWeapons[i]) return;
    me.loadoutIdx = i; me.weapon = me.loadoutWeapons[i];
    if (me.body && lo[i] && lo[i].figure) me.body.figure = lo[i].figure;
  }
  function smGo() { smClose(); smReady = clock + 2.2; smKeys = clock + 8; }
  function smAct(e) {
    if (e.emit === 'mana:closed') {
      if (smQuiet || !smUp) return;
      const was = smUp; smUp = null;
      // (a back: the menu resumes, the card goes on to READY; GAME OVER is left only by its choices)
      if (was === 'over') { smOpen('over'); return; }
      if (was === 'intro') { smGo(); return; }
      window.__mojMenuOpen = false; window.__mojFreeze = false; setTimeout(function () { if (!smUp) smHold.textContent = ''; }, 0);
      return;
    }
    if (e.emit === 'sm:go') { smGo(); return; }
    if (e.emit === 'sm:continue') { smBus('continue'); smOver = -1; smClose(); smReady = clock + 2.2; return; }
    if (e.emit === 'sm:quit') { smClose(); smBus('giveup'); return; }
    if (e.emit === 'sm:equip') { smEquip(e.i); smClose(); return; }
  }
` : ''}
${HS ? `  // THE HUD'S SOUNDS (mana-hud-sounds.js): the look's set, its cues heard as the runtime emits them, muted with the game's
  // sound; the recordings decoded before the first where the library voices the set
  const HSC = { K: (${HS.K})(), of: (${HS.of}), n: 0, cues: ${json(HS.sounds)}${HS.samples ? `, samples: ${json(HS.samples)}` : ''} };
  function hsReady() {
    if (HSC.engine !== undefined) return HSC.engine;
    try { const C = window.AudioContext || window.webkitAudioContext; HSC.ctx = new C(); HSC.engine = HSC.K.createEngine(HSC.ctx);
      if (HSC.samples) HSC.engine.loadSamples({ cards: HSC.samples.cards, bytes: Object.fromEntries(Object.entries(HSC.samples.bytes).map(function (kv) { return [kv[0], Uint8Array.from(atob(kv[1]), function (c) { return c.charCodeAt(0); }).buffer]; })) }); } catch (err) { HSC.engine = null; }
    return HSC.engine;
  }
  function hsHear(e) {
    const ms = window.__mojManaState; if (ms && ms.ui && ms.ui.settings && ms.ui.settings.sound === 0) return;
    if (window.__mojMuted) return;
    const g = HSC.cues[HSC.of(e)] || HSC.cues[e.sound], E = g && hsReady();
    if (!E) return;
    if (HSC.ctx.state === 'suspended') HSC.ctx.resume();
    E.playCue(g, null, null, 1, ++HSC.n);
  }
  window.__mojHudSounds = { set: ${json(HS.set)}, heard: function () { return HSC.n; } };
` : ''}${BX ? `  // A BOX's vitals, moments, boss and pause (gameworld/metroidvania/hud.js): the room she stands in read off her place in
  // the box's cells; what is found said as it is taken; the pause's map of the rooms walked
  const BXF = F.box;
  st.bx = { place: '', hp: 1, hpMax: 1, mp: 0, mpMax: 1, moments: [], bossOn: false, bossName: '', boss: 0, bossMax: BXF.bossHp || 1, heldWord: '', hasHeld: false, shapes: [], markers: [], focus: { x: 0.5, y: 0.5 }, zoom: BXF.map ? BXF.map.zoom : 1, relics: [], roomsWord: '0', wakeWord: '0' };
  let bxUp = null, bxQuiet = false, bxSeen = 0, bxSeenMap = 0, bxBrokeN = 0, bxRoom = -1, bxRing = -1, bxN = 0, bxHeld = '', bxCell = -1;
  // (the screens walked, revealed one at a time as she enters each: the map's view, gameworld/metroidvania/hud.js)
  const bxCells = {}, bxBossSaid = new Set(), __bxView = ${boxMapView.toString()};
  const bxHoldEl = document.createElement('div'); bxHoldEl.className = 'moj-menu-hud'; bxHoldEl.style.display = 'none'; document.body.appendChild(bxHoldEl);
  function bxOpen(id) { bxQuiet = true; try { rt.close(); rt.open(id); } finally { bxQuiet = false; } bxUp = id; window.__mojMenuOpen = true; window.__mojFreeze = true; bxHoldEl.textContent = id; view.paint(); }
  function bxShut() { window.__mojMenuOpen = false; window.__mojFreeze = false; setTimeout(function () { if (!bxUp) bxHoldEl.textContent = ''; }, 0); }
  function bxMoment(m) { st.bx.moments = st.bx.moments.concat([Object.assign({ id: 'bx' + (++bxN) }, m)]).slice(-8); }
  // (the map: the screens walked, the one she stands in marked, a room's screens joined and the doors between rooms; a
  // gate until she holds its opener, a relic until taken; the save rooms found; the bosses still standing. The minimap
  // the same on her, the pause's the whole box)
  function bxMap() {
    const G = window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.heldGates;
    const WB = window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.breakables, broken = {};
    if (WB) WB.forEach(function (b) { if (b.broken) broken[b.id] = 1; });
    const V = __bxView(BXF.map, { seen: bxCells, here: bxCell, held: G && G.held, taken: G && G.taken, felled: G && G.felled, broken: broken });
    st.bx.shapes = V.shapes; st.bx.markers = V.markers; st.bx.focus = V.focus; st.bx.roomsWord = V.rooms + ' of ' + BXF.rooms.length;
    st.bx.relics = BXF.relics.map(function (x) { const got = !!(G && G.taken && G.taken[x.id] != null); return { name: got ? x.name : '— — —', icon: got ? (x.kind === 'key' ? 'key' : x.kind === 'power' ? 'star' : 'gem') : 'lock' }; });
  }
  function bxAct(e) {
    if (e.emit === 'mana:closed') { if (bxQuiet || !bxUp) return; bxUp = null; bxShut(); }
  }
` : ''}  let hooked = false, clock = 0, cue = null, hintUntil = -1, last = performance.now();
${race ? `  // A RACE's (gameworld/race-hud.js): the lights, then the laps, the place and the times off the laps mechanic's vars
  const RACE = F.kind === 'race' ? { m: F.mech || 0, lights: null, done: 0, lapStart: 0, best: 0, over: false } : null;
  if (RACE) { st.race = { place: 1, of: F.racers, placeSays: '1st', field: '/ ' + F.racers, lap: 1, laps: F.laps, lapSays: '1/' + F.laps, time: 0, best: 0, hasBest: false, speed: 0, speedMax: F.speedMax, markers: [], solo: F.racers < 2, hasItem: false, itemSays: '—', itemIcon: '' }; st.fx = { finish: 0, best: 0 }; st.start = { lit: 0, of: F.lights.count, lights: '', sub: F.words.ready }; }
  const lightsSay = function (n) { const out = []; for (let i = 0; i < F.lights.count; i++) out.push(i < n ? '●' : '○'); return out.join(' '); };
  const nth = function (n) { const t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };` : ''}
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
    ${SM ? "if (e && typeof e.emit === 'string' && (e.emit.indexOf('sm:') === 0 || e.emit === 'mana:closed')) { smAct(e); return; }" : ''}${BX ? "if (e && e.emit === 'mana:closed') { bxAct(e); return; }" : ''}
    if (e && typeof e.key === 'string') { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key: e.key, code: e.code || e.key, bubbles: true, cancelable: true })); return; }
    if (e && typeof e.emit === 'string' && window.__mojBus && window.__mojBus.press) window.__mojBus.press(e.emit);
  }
  const rt = manaUi.runtime(CFG.spec, { read: function (p) { return manaUi.readPath(st, p); }, act: ${HS ? "function (e, from) { if (e && typeof e.sound === 'string') { hsHear(e); return; } press(e, from); }" : 'press'}, now: function () { return clock; }${HS ? `, cues: ${json(HS.cues)}` : ''} });
  rt.glyphs({ keys: { jump: 'Space', steer: 'A · D' }, pad: { xbox: { jump: 'A', steer: 'L' }, playstation: { jump: '✕', steer: 'L' }, nintendo: { jump: 'B', steer: 'L' } }, touch: { jump: 'tap', steer: 'swipe' } });
  // (the device in hand: a touch screen, or the page told to be one, as the touch layer reads it)
  const __tq = new URLSearchParams(location.search).get('touch');
  rt.input(__tq === '1' || (__tq !== '0' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'touch' : 'keys');
  const view = manaUi.mount(root, rt, { auto: true });
  window.__mojHud = { rt: rt, state: st };${talk ? `
  // THE TALK BOX (see the header): the scenes' lines in this HUD's look, its own runtime over its own root
  const __talkOf = (${talkState.toString()});
  const talkRoot = document.createElement('div'); talkRoot.id = 'moj-mana-talk'; (document.getElementById('wrap') || document.body).appendChild(talkRoot);
  const tst = { talk: __talkOf(null) }; let talkKey = '';
  const trt = manaUi.runtime(${json(talkSpec())}, { read: function (p) { return manaUi.readPath(tst, p); }, act: function () {}, now: function () { return clock; } });
  trt.glyphs(${json(TALK_GLYPHS)});
  trt.input(__tq === '1' || (__tq !== '0' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'touch' : 'keys');
  manaUi.mount(talkRoot, trt, { auto: true });
  // a choice's row pressed is that answer (the scene channel hears the press as well: an answer taken wins over a press)
  talkRoot.addEventListener('pointerdown', function (ev) {
    const r = ev.target && ev.target.closest ? ev.target.closest('.mana-each>*') : null;
    if (r && window.__mojScenes) window.__mojScenes.pick(Array.prototype.indexOf.call(r.parentNode.children, r));
  });
  window.__mojTalk = { rt: trt, state: tst };${faces ? `
  // THE FACES (scene/channels/talk-face.js): who speaks, drawn live in the box's face by the frame's pre-pass
  const __TF = (${buildTalkFace.toString()})(THREE, renderer, scene, (${faceFrame.toString()}));
  const SPK = ${json(speakers)};
  let talkFace = null;
  window.__mojTalk.face = __TF;
  // the speaker's body and facing, when they have one shown and their sheet does not say none (hero: the player's)
  function faceOf(who) {
    const C = window.__mojCtrl, W = C && C.world, B = C && C.bodies;
    if (!W || !B || (SPK[who] && SPK[who].portrait === 'none')) return null;
    const id = W.byId[who] ? who : who === 'hero' ? W.pilotId : null, E = id && W.byId[id], b = id && B[id];
    return E && b && b.visible && !E.gone ? { who: id, b: b, h: (E.transform && E.transform.heading) || 0 } : null;
  }
  window.__mojTalkFace = function () {
    const el = talkFace && talkRoot.querySelector('.mana-portrait .mana-ph');
    if (el) __TF.draw(talkFace.who, talkFace.b, talkFace.h, el); else __TF.hide();
  };` : ''}
  function talkStep() {
    const S = window.__mojScenes, G = window.__mojStage, v = S ? S.view() : null;${faces ? `
    talkFace = v && v.on && v.line ? faceOf(v.line.who) : null;` : ''}
    const T = __talkOf(v, { noSkip: !!(G && G.on && !G.skip)${faces ? ', face: !!talkFace' : ''} }), k = JSON.stringify(T);
    if (k !== talkKey) { talkKey = k; tst.talk = T; }
  }` : ''}
  ${SM ? `// the keys and the pad drive the screens while one is up (controls/mana-host.js: with none up a key is play's); the
  // menu key opens the start menu over play
  const __smHost = ${manaHostSource()};
  __smHost.connect(rt, view, { keys: SMK.keys, pad: SMK.pad });
  window.addEventListener('keydown', function (e) {
    if (e.key !== SMF.menuKey || e.repeat || smUp || window.__mojMenuOpen || st.sm.lives <= 0) return;
    smWeapons(); smOpen('menu'); e.preventDefault();
  });` : ''}${BX ? `
  // the keys and the pad drive the pause while it is up; the menu key opens it over play
  const __bxHost = ${manaHostSource()};
  __bxHost.connect(rt, view, { keys: ${json(manaControls().keys)}, pad: ${json(manaControls().pad)} });
  window.addEventListener('keydown', function (e) {
    if (e.key !== BXF.menuKey || e.repeat || bxUp || window.__mojMenuOpen) return;
    bxMap(); bxOpen('pause'); e.preventDefault();
  });` : ''}
  // the level has started (the shell's params are in): its place in the run, and the start cue
  function begin(params) {
    const R = params && params.__run;
    if (R && R.of > 1) { st.run.show = true; st.run.at = R.at; st.run.of = R.of; }
    if (F.hint && (!R || R.at === 1)) hintUntil = 1e9;   // (shown from the cue; timed from GO)
    ${SM ? "if (F.sidemap.intro) { smOpen('intro'); smIntro = clock + 3.2; }   // (a world's intro card, then READY)" : ''}
${race ? `    // (a race's lights: the karts held and the race's clock frozen, the world's, until they go out)
    if (RACE && CFG.spec.screens && CFG.spec.screens.ready) { RACE.lights = { t0: clock }; st.start.lit = 0; rt.open('ready'); view.paint(); }
    else ` : '    '}if (F.cue && CFG.spec.screens && CFG.spec.screens.ready) { cue = { t0: clock }; st.start.count = F.cue.beats[0]; st.start.sub = F.cue.sub || ''; rt.open('ready'); view.paint(); }
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
  ${H ? `// THE PILOT'S PARTS (see the header): read off the page, each standing only where the page has the thing
  const calm = { gun: '', gunT: 0, hp: -1, hpT: 0 }, SAY = { dodge: 'Dodge', strike: 'Strike', 'last-down': 'Last foe', down: 'A foe down', 'down:foe': 'A foe down' };
  function pilot(W, me, V) {
    const h = st.hero;
    // (the health: the level's row where one is the health, its highest as its max; else the pilot's own)
    if (F.hpVar && V) { const v = Number(st.v[F.hpVar]) || 0; st.top[F.hpVar] = Math.max(st.top[F.hpVar] || 1, v); h.hp = v; h.hpMax = st.top[F.hpVar]; }
    const share = h.hpMax > 0 && (F.hpVar || h.hasHp) ? h.hp / h.hpMax : 1;
    h.peril = Math.round(Math.min(1, Math.max(0, (0.5 - share) / 0.45)) * 20) / 20;
    if (h.hp !== calm.hp) { calm.hp = h.hp; calm.hpT = clock; }
    h.rest = share >= 1 && clock - calm.hpT > 3;
    // the gun in hand: its slot on the loadout, else the weapon it carries
    const lo = me.rule && me.rule.loadout, slot = lo ? lo[me.loadoutIdx || 0] : null, w = me.weapon, G = st.gun;
    // (a holstered sidearm, the open city's: its readout only while it is drawn, worlds/controllable/combat-melee.js gunOut)
    G.on = !!(slot || w) && !(me.rule && me.rule.holster && !me.gunOut);
    if (G.on) {
      const melee = !!(slot && (slot.fire === 'melee' || slot.strike) && !slot.weapon);
      G.name = (slot && slot.name) || (w && w.name) || '';
      G.mode = melee || !w ? '' : w.fireClass === 'lob' ? 'Launcher' : w.auto ? 'Auto' : w.burst > 1 ? 'Burst' : 'Semi';
      G.reloading = !melee && !!(w && w.reloading);
      G.rounds = melee || !w || w.reloading ? 0 : (w.ammo == null ? 0 : w.ammo);
      G.size = melee || !w || !Number.isFinite(w.magazine) ? 0 : w.magazine;
      G.reserve = melee || !w ? '' : Number.isFinite(w.reserve) ? w.reserve : '∞';
      const key = [G.name, G.rounds, G.reloading].join('|');
      if (key !== calm.gun) { calm.gun = key; calm.gunT = clock; }
      G.rest = G.size > 0 && G.rounds >= G.size && !G.reloading && clock - calm.gunT > 3;
    }
    // the slow-motion: the moment a dodge sets off (else the first), filling as it comes back, draining as it runs
    const T = W.tempo, ms = T && T.moments, Fc = st.focus;
    Fc.on = !!(ms && ms.length);
    if (Fc.on) {
      let i = ms.findIndex(function (m) { return m.on === 'dodge'; }); if (i < 0) i = 0;
      const m = ms[i], P = T.playing;
      if (P && P.m === m) { const all = 2 * (m.ramp || 0) + m.hold; Fc.state = 'active'; Fc.value = Math.round(Math.max(0, 1 - P.t / (all || 1)) * 20) / 20; Fc.label = ''; }
      else { const cd = m.cooldown || 0, r = cd > 0 ? Math.min(1, (T.real - T.fired[i]) / cd) : 1; Fc.value = Math.round((isFinite(r) ? r : 1) * 20) / 20; Fc.state = Fc.value >= 1 ? 'ready' : 'cooling'; Fc.label = Fc.state === 'ready' ? (SAY[m.on] || m.on) : ''; }
    }
    // the page's radar, as a scope; its damage ring, as arcs; its weapon selector, as the wheel
    const R = st.radar; R.on = !!document.getElementById('__radar');
    if (R.on && me.transform) { const p = me.transform.pos, cfgR = me.rule && me.rule.radarRange > 0 ? Object.assign({}, __hR, { range: me.rule.radarRange }) : __hR;${floorRadar ? `
      // (the floor the pilot stands on: the highest a body's height under its feet; on a stair, the one it left until it
      // is all but up. Its plan alone, and the foes within a storey of it)
      if (!__hFl && W.colliders && W.colliders.length) { __hFl = __hFloors(W.colliders); __hBox = __hPlanBox(W.colliders, null); }
      const foot = p[2] - ((me.rule && me.rule.eye) || 0), fz = (__hFl || []).reduce((a, z) => (z <= foot + 1 ? z : a), (__hFl && __hFl[0]) || 0);
      R.marks = __hRadar(p, me.transform.heading, __hThings(W, me, null).filter((t) => Math.abs(((t.at && t.at[2]) || 0) - fz) < 3), cfgR); R.north = __hBearing(p, me.transform.heading, [p[0], p[1] + 1, 0]);
      if (__hBox) { const k = String(fz); if (!__hFlPlans[k]) __hFlPlans[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(__hFloorSvg(__hPlanSvg, W.colliders, __hBox, fz)); R.plan = Object.assign({ src: __hFlPlans[k] }, __hPlanAt(__hBox, p, me.transform.heading, cfgR.range)); } }` : ` R.marks = __hRadar(p, me.transform.heading, __hThings(W, me, null), cfgR); R.north = __hBearing(p, me.transform.heading, [p[0], p[1] + 1, 0]);
      if (!__hPlan && W.colliders && W.colliders.length) { const box = __hPlanBox(W.colliders, null); __hPlan = { box, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(__hPlanSvg(W.colliders, null, box, { rel: true, veils: W.veils || []${radarMap ? ', relief: __hLand.relief, trail: __hLand.trail' : ''} })) }; }
      if (__hPlan) R.plan = Object.assign({ src: __hPlan.src }, __hPlanAt(__hPlan.box, p, me.transform.heading, cfgR.range)); }`}
    // JAMMED (the pilot inside a chaff cloud, combat-ranged.js state.jams): the radar reads nothing, its scope a static
    {
      const p = me && me.transform ? me.transform.pos : null, t = W.time || 0;
      const jam = R.on && p && (W.jams || []).some(function (j) { return j.until > t && Math.hypot(p[0] - j.at[0], p[1] - j.at[1]) <= j.r; });
      if (jam) { R.marks = []; R.plan = null; }
      let J = window.__mojJam;
      if (jam && !J) {
        const css = document.createElement('style'); css.textContent = '@keyframes mojJam{0%{background-position:0 0}100%{background-position:0 9px}}'; document.head.appendChild(css);
        J = window.__mojJam = document.createElement('div');
        J.style.cssText = 'position:absolute;pointer-events:none;z-index:31;border-radius:50%;display:none;align-items:center;justify-content:center;font:700 11px/1 ui-monospace,monospace;letter-spacing:.2em;color:#cfe3ff;text-shadow:0 0 4px #000;background:repeating-linear-gradient(0deg,rgba(200,215,230,.22) 0 1px,rgba(20,28,40,.5) 1px 3px);animation:mojJam .18s steps(3) infinite';
        J.textContent = 'JAMMED'; root.appendChild(J);
      }
      if (J) {
        const sc = jam ? root.querySelector('[data-scope="yes"]') : null;
        if (sc) { const a = sc.getBoundingClientRect(), b = root.getBoundingClientRect(); J.style.borderRadius = getComputedStyle(sc).borderRadius || '50%'; J.style.left = (a.left - b.left) + 'px'; J.style.top = (a.top - b.top) + 'px'; J.style.width = a.width + 'px'; J.style.height = a.height + 'px'; J.style.display = 'flex'; }
        else J.style.display = 'none';
      }
    }
${boss ? `    // THE BOSS (worlds/controllable/boss.js): the first standing, its name, title, health and its phases' ticks
    { const Bs = W.bosses || {}, k = Object.keys(Bs).find((id) => !Bs[id].down), b = k ? Bs[k] : null; st.boss = b ? { on: true, name: b.name, title: b.title || '', hp: Math.max(0, b.hp), hpMax: b.hpMax || 1, phases: Math.max(1, b.phases || 1) } : { on: false }; }
` : ''}    const D = window.__mojDamageRing; st.ring.on = !!(D && D.hits && D.hits.length); st.ring.hits = st.ring.on ? D.hits : [];
    const C = window.__mojWc && window.__mojWc.view ? window.__mojWc.view() : null;
    st.wheel.open = !!(C && C.open);
    if (st.wheel.open) { st.wheel.title = C.title || ''; st.wheel.slots = C.rows; }
  }
  ` : ''}(function tick() {
    requestAnimationFrame(tick);${talk ? `
    talkStep();` : ''}
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
    ${H ? 'if (me) pilot(W, me, V);' : ''}
    if (V && V.coins != null) st.coins.count = V.coins;
${ways ? '    way(V);\n' : ''}${hud.feed && hud.feed.immersive ? '    if (!bared) bare();\n' : ''}    if (ROWS && V) rows(window.__mojBus.state, V);
${vit ? '    if (F.hero) vitals();\n' : ''}    if (cue) {
      const k = Math.floor((clock - cue.t0) / F.cue.every);
      if (k < F.cue.beats.length) st.start.count = F.cue.beats[k];
      else { cue = null; rt.close(); st.moments = st.moments.concat([{ id: 'go', text: F.cue.go, weight: 'major' }]); if (hintUntil > 0) hintUntil = clock + F.hint.seconds; }
    }
${race ? `    if (RACE) {
      const L = F.lights;
      if (RACE.lights) {
        // (the world held from a beat in, once the camera has found the kart: a world frozen on its first frame has no view)
        if (clock - RACE.lights.t0 > 0.3) window.__mojFreeze = true;
        const k = Math.floor((clock - RACE.lights.t0) / L.every);
        st.start.lit = Math.min(L.count, k); st.start.lights = lightsSay(st.start.lit);
        if (clock - RACE.lights.t0 >= L.count * L.every + L.hold) { RACE.lights = null; window.__mojFreeze = false; st.start.lit = 0; rt.close(); st.moments = st.moments.concat([{ id: 'go', text: F.words.go, weight: 'major' }]); }
      }
      if (V && !RACE.over) {
        const done = V['__lap_' + RACE.m] || 0, t = (V['__race_' + RACE.m] || 0) / 10;
        if (done > RACE.done) {
          const lapT = t - RACE.lapStart; RACE.lapStart = t; RACE.done = done;
          // (a lap better than the best so far: its sparkles, a screen effect that touches nothing)
          if (lapT > 0 && (!st.race.hasBest || lapT < st.race.best)) { if (st.race.hasBest) st.fx.best += 1; st.race.best = lapT; st.race.hasBest = true; }
          if (done >= F.laps) { RACE.over = true; st.fx.finish = 1; st.moments = st.moments.concat([{ id: 'finish', text: F.words.finish, sub: F.racers > 1 ? nth(st.race.place) : '', weight: 'decisive' }]); }
          else if (done === F.laps - 1 && F.laps > 1) st.moments = st.moments.concat([{ id: 'final', text: F.words.final, weight: 'major' }]);
        }
        st.race.lap = Math.min(F.laps, done + 1); st.race.lapSays = st.race.lap + '/' + F.laps;
        if (!RACE.over) st.race.time = Math.max(0, t - RACE.lapStart);
        const pl = V['__place_' + RACE.m]; if (pl != null) { st.race.place = pl; st.race.placeSays = nth(pl); }
      }
      if (me) st.race.speed = Math.round(Math.abs(me.speed || 0) * 3.6);
      // (the item held, a race with item boxes: roads/kart-items.js, the page's window.__mojItems)
      if (F.items && window.__mojItems && W) { const it = window.__mojItems.held(W.pilotId); st.race.hasItem = !!it; st.race.itemSays = it ? String(window.__mojItems.says(it)).toUpperCase() : '—'; st.race.itemIcon = it && window.__mojItems.icon ? String(window.__mojItems.icon(it)) : ''; }
      // the field on the map: you, and the rivals (their team), each at its place on the track's square
      if (F.frame && W) {
        const Fr = F.frame, at = function (p) { return { x: Fr.ox + (p[0] - Fr.x0) * Fr.k, y: 1 - (Fr.oy + (p[1] - Fr.y0) * Fr.k) }; }, mk = [];
        for (const id in W.byId) { const e = W.byId[id]; if (!e || !e.transform || id === W.pilotId || e.team !== 'rivals') continue; const q = at(e.transform.pos); mk.push({ x: q.x, y: q.y, kind: 'foe' }); }
        if (me && me.transform) { const q = at(me.transform.pos); mk.push({ x: q.x, y: q.y, kind: 'self' }); }
        st.race.markers = mk;
      }
    }
` : ''}    st.hint.show = clock < hintUntil;
    ${SM ? `// (the side map's: READY at the start and after a life lost, the lives under it; the energy; the keys for the first
    // seconds; the boss's column once it is near and awake, its name said as it comes in, gone a moment after it falls)
    if (V && V.lives != null) { if (smLives >= 0 && V.lives < smLives && V.lives > 0) smReady = clock + 2.2; smLives = V.lives; st.sm.lives = V.lives; st.sm.livesWord = '×' + V.lives; }
    if (V && V.energy != null) st.sm.energy = Math.max(0, V.energy);
    st.sm.ready = !smUp && clock < smReady; st.sm.keysOn = !smUp && clock < smKeys;
    if (smUp === 'intro' && clock > smIntro) smGo();
    // GAME OVER: the last life gone, a moment after (the hero back at its gate), where the level offers a continue
    if (SMF.continues && V && V.lives != null && V.lives <= 0 && smUp !== 'over') {
      if (smOver < 0) smOver = clock + 1;
      else if (clock > smOver) {
        const cam = W && W.entities ? W.entities.find(function (x) { return x.rule && Array.isArray(x.rule.zones) && x.frame; }) : null;
        st.sm.gate = cam ? 'Gate ' + ((cam._zoneAt || 0) + 1) + ' of ' + cam.rule.zones.length : 'Gate';
        smOpen('over');
      }
    }
    // (a special weapon's column: the held gun's own energy, in its tint, while it has one; the buster has none)
    const smW = me && me.weapon && me.weapon.energyMax > 0 ? me.weapon : null;
    st.sm.weaponOn = !!smW; if (smW) { st.sm.weapon = Math.max(0, smW.energy ?? smW.energyMax); st.sm.weaponMax = smW.energyMax; }
    const smT = smW && typeof smW.fxColor === 'string' ? smW.fxColor : ''; if (smT !== smTint) { smTint = smT; if (smT) root.style.setProperty('--sm-weapon', smT); else root.style.removeProperty('--sm-weapon'); }
    if (F.sidemap.boss && V) {
      if (smBoss === null) for (const k in V) if (/^boss_\\d+$/.test(k)) { smBoss = k; break; }
      const bv = smBoss ? Number(V[smBoss]) : NaN, Bo = W && W.byId ? W.byId[F.sidemap.boss.id] : null;
      if (Number.isFinite(bv)) st.sm.boss = Math.max(0, bv);
      if (!smOn && Bo && me && !Bo.dormant && Math.hypot(Bo.transform.pos[0] - me.transform.pos[0], Bo.transform.pos[1] - me.transform.pos[1]) < 24) { smOn = true; st.sm.moments = st.sm.moments.concat([{ id: 'boss', text: F.sidemap.boss.name, weight: 'decisive' }]); }
      if (smOn && st.sm.boss <= 0 && smOff < 0) smOff = clock + 1.5;
      st.sm.bossOn = smOn && (smOff < 0 || clock < smOff);
    }` : ''}
    ${BX ? `// (the box's: her vitals; what is found said as it is taken; the room she stands in, a new region named as she crosses
    // into it and a boss as she comes into its room; the boss's bar while it stands; what she holds)
    if (me && me.body) { st.bx.hpMax = me.hpMax || 1; st.bx.hp = Math.max(0, Number.isFinite(me.body.hp) ? me.body.hp : st.bx.hpMax); const MP = me.rule && me.rule.moveset && me.rule.moveset.mp; st.bx.mpMax = MP ? MP.max : 1; st.bx.mp = MP ? Math.max(0, me.mp == null ? MP.max : me.mp) : 0; }
    const BG = W && W.heldGates;
    if (BG) {
      while (bxSeen < BG.got.length) {
        const g = BG.got[bxSeen++], R0 = BXF.relics.find(function (x) { return x.id === g.id; }), Bo = BXF.bosses.find(function (x) { return x.id === g.id; });
        if (g.kind === 'save') bxMoment({ text: 'Saved', sub: st.bx.place, weight: 'normal', icon: 'star' });
        else if (g.kind === 'wake') bxMoment({ text: 'You wake', sub: g.name.replace(/^Woken in /, ''), weight: 'major' });
        else if (Bo) bxMoment({ text: Bo.name + ' falls', sub: g.name.indexOf(' · ') > 0 ? g.name.split(' · ').pop() : '', weight: 'decisive', tier: 'rare' });
        else if (R0 && R0.kind === 'power') bxMoment({ text: R0.name, sub: 'A power', weight: 'major', tier: 'rare', icon: 'star' });
        else if (R0 && R0.kind === 'key') bxMoment({ text: R0.name, sub: 'A key', weight: 'normal', icon: 'key' });
        else if (R0) bxMoment({ text: R0.name, sub: 'Found', weight: 'minor', icon: 'gem' });
      }
      // (redrawn on anything got, and on a wall broken: a secret's prize comes onto the map)
      const nb = W.breakables ? W.breakables.reduce(function (n, b) { return n + (b.broken ? 1 : 0); }, 0) : 0;
      if (bxSeen !== bxSeenMap || nb !== bxBrokeN) { bxSeenMap = bxSeen; bxBrokeN = nb; bxMap(); }
      st.bx.wakeWord = String(BG.deaths || 0);
      const hw = BXF.relics.filter(function (x) { return x.kind !== 'prize' && BG.taken[x.id] != null; }).map(function (x) { return x.name; }).join(' · ');
      if (hw !== bxHeld) { bxHeld = hw; st.bx.heldWord = hw; st.bx.hasHeld = !!hw; }
    }
    if (me && me.transform) {
      const ps = me.transform.pos, ft = ps[2] - ((me.rule && me.rule.eye) || 0), c = Math.floor(ps[1] / BXF.screen[0]), r = Math.floor(ft / BXF.screen[1]);
      const k = c >= 0 && r >= 0 && c < BXF.cols && r < BXF.rows ? BXF.cells[r * BXF.cols + c] : -1;
      const ci = k >= 0 ? r * BXF.cols + c : -1;
      if (ci >= 0 && ci !== bxCell) { bxCell = ci; bxCells[ci] = 1; bxMap(); }
      if (k >= 0 && k !== bxRoom) {
        bxRoom = k; const R = BXF.rooms[k]; st.bx.place = R.place;
        if (R.ring !== bxRing) { if (bxRing >= 0) bxMoment({ text: BXF.rings[R.ring], weight: 'major' }); bxRing = R.ring; }
        if (R.boss && !bxBossSaid.has(k) && !(BG && BG.felled['boss-' + R.id] != null)) { bxBossSaid.add(k); bxMoment({ text: R.boss, sub: 'Boss', weight: 'decisive' }); }
      }
      const R = bxRoom >= 0 ? BXF.rooms[bxRoom] : null, bb = R && R.boss && W.breakables ? W.breakables.find(function (b) { return b.id === 'boss-' + R.id; }) : null;
      st.bx.bossOn = !!(bb && !bb.broken && Number.isFinite(bb.hp)); if (st.bx.bossOn) { st.bx.bossName = R.boss; st.bx.boss = Math.max(0, bb.hp); st.bx.bossMax = BXF.bossHp || 1; }
      else if (BG && BG.spec && BG.spec.bosses) {
        // (a boss STOOD as a body of the world (gameworld/metroidvania/bosses.js): the one whose room she stands in, standing;
        // its bar its health against its form's (a boss of two forms fills again as its second, named as it), else its own)
        const p = me.transform.pos;
        for (const Bd of BG.spec.bosses) {
          const e = Bd.entity && W.byId[Bd.entity], q = Bd.room;
          if (!e || !q || !e.body || e.downed || e.gone || BG.felled[Bd.id] != null || !(p[1] >= q[0] && p[1] <= q[1] && p[2] >= q[2] && p[2] <= q[3])) continue;
          if (e.hudMax == null) e.hudMax = e.body.hp;
          const Md = e.body.modes && e.body.modes[e.modeIdx || 0];
          st.bx.bossOn = true; st.bx.bossName = (Md && Md.title) || Bd.title || Bd.id; st.bx.boss = Math.max(0, e.body.hp); st.bx.bossMax = (Md && Md.hp) || e.hudMax || 1;
          break;
        }
      }
    }` : ''}
    // (the touch layer's word for its pad, when the page has one)
    // (a page whose touch layer draws itself still says whether it is up: a button for a touch screen alone reads it)
    const TT = window.__mojTouch; if (TT) { if (TT.view) st.touch = TT.view(); else st.touch.on = !!TT.on() && !window.__mojMenuOpen; }
  })();
})();`;
}
