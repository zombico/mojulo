/**
 * THE COCKPIT HUD — a starfighter's instruments as the 90s space-combat sims drew them, on mana-ui (control/lib/mana-ui/),
 * over the view from the cockpit (or the chase), in a phosphor look (the `terminal` theme) unless the level names
 * another. What a pilot reads at a glance, each where that register put it:
 *
 *   over the world   the TARGET in brackets with its range, and the LEAD PIP: where to fire for the bolts to meet it
 *                    (its course and the bolts' speed); the target off screen held at the edge with an arrow
 *   centre           the gunsight
 *   bottom           THE TARGETING COMPUTER: the target's name, how it routes its power (shields up, weapons hot,
 *                    running), its range and closure, its hull, its shields fore and aft
 *   bottom-left      THE FORE SENSOR: what lies ahead, each by its angle off the nose (the nose the middle, the edge
 *                    abeam), up the top; foe, friend and the target told apart
 *   bottom-right     THE AFT SENSOR: what lies behind, by its angle off the tail
 *   left             the craft's shields fore and aft, its hull, its laser charge and how its cannons are linked
 *   right            the speed and the throttle's setting, the power to lasers, shields and engines (pips): where the
 *                    craft has a generator, the generator itself (mana-ui `power`: its tick filling and landing, routed
 *                    by the pips to each feed's gauge, a redirect or a transfer ringed); the warheads
 *   top              the comms: what the level says (its guide's line), one at a time
 *
 * THE COCKPIT itself, drawn in the cockpit view (a card a craft: skyscape/cockpits.js): the canopy's frame bars as the
 * seat sees them (the shelf's own canopy, its facet edges and hoops, or a round window's rim and spokes, projected
 * through the page's camera, each bar as thick as it is near), the cockpit's sides under the sills, and the instrument
 * panel over the screen's foot (its share, 28%), its silhouette the card's; the instruments set into the panel in the
 * card's slots, each a screen in a bezel (the sensors round). In the chase they ride a slim strip along the screen's foot,
 * clear of the craft, on lighter glass.
 *
 * The page is its host: each frame it reads the pilot (controllable/index.js `window.__mojCtrl`: the starfighter rule's
 * facts, worlds/controllable/rules-starfighter.js) into the state mana-ui draws, projecting the target and the pip
 * through the page's camera. It takes no input. The page's own flight readouts and radar are put away under it.
 *
 *   scopeMarks(me, things, side)   → [{ x, y, kind }] a sensor's marks (me { pos, f, u }; things [{ pos, kind }]; side
 *                                    'fore' | 'aft'): pure, the page runs it
 *   leadPoint(from, at, vel, speed) → [x, y, z] where a bolt of that speed fired now meets a body at `at` moving at
 *                                    `vel`, or null when it cannot catch it: pure, the page runs it
 *   cockpitHudSpec(theme?)         → the mana-ui spec
 *   cockpitHudScript({ cockpit? }) → the page's script (emitted only on a page whose pilot is a starfighter; `cockpit`
 *                                    the craft whose cockpit it is, its card's: the general one's when absent)
 *   cockpitPanelCss(card)          → the instruments' places: set in the panel (the cockpit view), along a slim strip
 *                                    at the screen's foot (the chase: CHASE_SLOTS, clear of the craft it follows)
 */
import { manaUiSource, manaUi } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss, readTheme } from '../../../mana-ui/theme.js';
import { cockpitOf, canopyFrame, COCKPITS, CRAFT_PLANS, planOf } from '../../skyscape/cockpits.js';
import { COCKPIT_COLOURS, COCKPIT_THEME, COCKPIT_ALERTS, PLACARDS, cockpitAlerts, keyOnPanel, panelPaint } from './cockpit-look.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/** A sensor's marks: each thing by its angle off the nose (fore) or the tail (aft), the middle dead ahead (or astern),
 *  the edge abeam; its direction round the middle as it lies about the craft (up the top, right the right). */
export function scopeMarks(me, things, side) {
  const f = me.f, u = me.u, y = [u[1] * f[2] - u[2] * f[1], u[2] * f[0] - u[0] * f[2], u[0] * f[1] - u[1] * f[0]];
  const out = [];
  for (const t of things) {
    const d = [t.pos[0] - me.pos[0], t.pos[1] - me.pos[1], t.pos[2] - me.pos[2]], L = Math.hypot(d[0], d[1], d[2]);
    if (L < 1e-6) continue;
    const ax = (d[0] * f[0] + d[1] * f[1] + d[2] * f[2]) / L, right = -(d[0] * y[0] + d[1] * y[1] + d[2] * y[2]) / L, up = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / L;
    if (side === 'fore' ? ax < 0 : ax >= 0) continue;
    const off = Math.acos(Math.min(1, Math.abs(ax))), r = (0.46 * off) / (Math.PI / 2), m = Math.hypot(right, up) || 1;
    out.push({ x: Math.round((0.5 + (r * right) / m) * 1000) / 1000, y: Math.round((0.5 - (r * up) / m) * 1000) / 1000, kind: t.kind });
  }
  return out;
}

/** Where a bolt of `speed` fired from `from` now meets a body at `at` moving at `vel`: the earliest t with
 *  |at + vel t − from| = speed t; null when it cannot be caught. */
export function leadPoint(from, at, vel, speed) {
  const d = [at[0] - from[0], at[1] - from[1], at[2] - from[2]], v = vel || [0, 0, 0];
  const a = v[0] * v[0] + v[1] * v[1] + v[2] * v[2] - speed * speed, b = 2 * (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]), c = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  let t;
  if (Math.abs(a) < 1e-9) t = b < 0 ? -c / b : null;
  else { const D = b * b - 4 * a * c; if (D < 0) return null; const s = Math.sqrt(D), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a); t = Math.min(...[t1, t2].filter((x) => x > 0)); if (!Number.isFinite(t)) t = null; }
  return t == null || !(t > 0) ? null : [at[0] + v[0] * t, at[1] + v[1] * t, at[2] + v[2] * t];
}

const B = (p) => ({ bind: `ck.${p}` }), I = (f) => ({ item: f });
const region = (at, children, extra = {}, bare = false) => ({ use: 'region', props: { at, ...(bare ? { variant: 'bare' } : {}) }, children, ...extra });
const stack = (children, dir = 'column', align = 'stretch') => ({ use: 'stack', props: { dir, gap: 'tight', align }, children });
const text = (value, role = 'body') => ({ use: 'text', props: { value, role } });

/** The spec: the instruments in their places, the target and the pip over the world. */
export function cockpitHudSpec() {
  return { screens: {}, hud: { use: 'hud', children: [
    { use: 'anchors', props: { variant: 'bare', rows: B('brackets'), row: stack([{ use: 'reticle', props: { shape: 'bracket' } }, text(I('range'), 'caption')], 'column', 'center') } },
    { use: 'anchors', props: { variant: 'bare', rows: B('pip'), row: { use: 'reticle', props: { shape: 'circle' } } } },
    { use: 'edges', props: { markers: B('edge') } },
    region('center', [{ use: 'reticle', props: { shape: 'cross' } }], {}, true),
    region('top', [{ use: 'moments', props: { rows: B('comms'), as: 'toast' } }], {}, true),
    region('bottom', [stack([
      text(B('tName'), 'heading'),
      // (how it routes its power: shields up, weapons hot, running; nothing said when even)
      text(B('tStance'), 'caption'),
      stack([{ use: 'stat', props: { label: 'range', value: B('tRange') } }, { use: 'stat', props: { label: 'closing', value: B('tClosure') } }], 'row', 'apart'),
      // (the target's shields and hull read off its plan: no words)
      { use: 'shields', props: { fore: B('tFore'), aft: B('tAft'), max: B('tShMax'), hull: B('tHull'), hullMax: 100, shape: B('tPlan') } },
    ])], { when: B('tOn') }),
    region('bottom-left', [{ use: 'minimap', props: { shape: 'round', scope: true, markers: B('fore'), label: 'fore' } }], {}, true),
    region('bottom-right', [{ use: 'minimap', props: { shape: 'round', scope: true, markers: B('aft'), label: 'aft' } }], {}, true),
    region('left', [stack([
      // (the craft's own shields and hull read off its plan: the fore arc over its nose, the aft under its tail)
      { use: 'shields', props: { fore: B('sFore'), aft: B('sAft'), max: B('sMaxOn'), hull: B('hull'), hullMax: B('hullMax'), shape: B('plan') } },
      { use: 'bar', props: { label: 'lasers', value: B('laser'), max: B('laserMax'), variant: 'mp', numbers: false } },
      text(B('linkSay'), 'caption'),
    ])], { when: B('on') }),
    region('right', [stack([
      { use: 'stat', props: { label: 'speed', value: B('speed') } },
      { use: 'bar', props: { label: 'throttle', value: B('throttle'), max: 100, variant: 'plain', numbers: false } },
      // (the generator, where the craft has one: its ticks routed by the pips to the cannons, the shields and the
      // engines, each feed's gauge beside its pips; else the pips alone)
      { use: 'power', props: { phase: B('gPhase'), pulse: B('gTick'), feeds: B('gFeeds') }, when: B('genOn') },
      { use: 'pips', props: { label: 'lasers', value: B('pL'), max: 4 }, when: B('genOff') },
      { use: 'pips', props: { label: 'shields', value: B('pS'), max: 4 }, when: B('genOff') },
      { use: 'pips', props: { label: 'engines', value: B('pE'), max: 4 }, when: B('genOff') },
      { use: 'counter', props: { label: 'warheads', value: B('warheads') }, when: B('warheadsOn') },
    ])], { when: B('on') }),
  ] } };
}

// (the layer over the canvas, taking no pointer; the page's own flight readouts and radar put away under it)
// (the colours of the code as the layer's own variables, cockpit-look.js; a gauge past its threshold coloured by the word
// the root carries for its pool, a warning beating)
const K = COCKPIT_COLOURS;
const HOST_CSS = `.moj-ck{position:absolute;inset:0;pointer-events:none;z-index:7}.moj-ck,.moj-ck-lamps{--ck-label:${K.label};--ck-figure:${K.figure};--ck-normal:${K.normal};--ck-friend:${K.friend};--ck-hostile:${K.hostile};--ck-target:${K.target};--ck-caution:${K.caution};--ck-warning:${K.warning};--ck-shields:${K.shields}}.moj-ck .mana-root{background:none}`
  + '.moj-c-radar,.moj-c-gauge,.moj-c-lock,.moj-c-hp,.moj-c-ehp,.moj-hud-top-left,.moj-w-legend{display:none!important}'
  // (a ship's sensor has no north: its top is the craft's up)
  + '.moj-ck .mana-minimap .mana-north,.moj-ck .mana-minimap [data-north]{display:none!important}'
  + '.moj-ck .mana-anchor>*{background:none!important;padding:0!important}'
  // (the target, selected: magenta, its brackets, its lead pip, its range, its arrow at the edge; the gunsight the
  // phosphor at its brightest)
  + '.moj-ck .mana-anchor .mana-reticle{font-size:40px;color:var(--ck-target);filter:drop-shadow(0 0 3px var(--ck-target))}'
  + '.moj-ck .mana-anchor .mana-text[data-role]{color:var(--ck-target)!important;font-weight:700;letter-spacing:.06em}'
  + '.moj-ck .mana-edge{color:var(--ck-target)!important;border-color:var(--ck-target)!important;background:none!important}'
  + '.moj-ck .mana-place[data-at=center] .mana-reticle{color:var(--ck-figure);opacity:.85}'
  + '.moj-ck .mana-minimap[data-scope=yes]{width:min(20vh,170px);height:min(20vh,170px)}'
  // (the sensors by the sides' code: a hostile red, a friend cyan-blue, the target magenta and larger)
  + '.moj-ck .mana-minimap .mana-marker[data-kind=foe]{color:var(--ck-hostile)}.moj-ck .mana-minimap .mana-marker[data-kind=ally]{color:var(--ck-friend)}'
  + '.moj-ck .mana-minimap .mana-marker[data-kind=target]{color:var(--ck-target);font-size:1.5em;filter:drop-shadow(0 0 2px var(--ck-target))}'
  + '.moj-ck .mana-place[data-at=left],.moj-ck .mana-place[data-at=right]{width:min(18vw,220px)}'
  // (luminance in three steps: a label dim, its figure bright; the comms an advisory, cyan-blue)
  + '.moj-ck .mana-label,.moj-ck .mana-text[data-role=caption]{color:var(--ck-label)!important;letter-spacing:.08em}'
  + '.moj-ck .mana-num,.moj-ck .mana-text[data-role=heading]{color:var(--ck-figure)!important;font-variant-numeric:tabular-nums}'
  + '.moj-ck .mana-place[data-at=top] .mana-toast{color:var(--ck-friend)!important;border-color:var(--ck-friend)!important}'
  + '.moj-ck [data-at=bottom] .mana-text[data-role=heading]{color:var(--ck-target)!important}'
  // (the target's stance by what it means to the pilot: weapons hot a threat, red; shields up the shields' blue)
  + '.moj-ck[data-tstance=lasers] [data-at=bottom] .mana-text[data-role=caption]{color:var(--ck-hostile)!important}'
  + '.moj-ck[data-tstance=shields] [data-at=bottom] .mana-text[data-role=caption]{color:var(--ck-shields)!important}'
  // (the alerts: the cannons low amber; a shield low amber, one down red; the hull past a half amber, a quarter red)
  + '.moj-ck[data-lasers=caution] [data-at=left] .mana-bar .mana-track i,.moj-ck[data-lasers=caution] .mana-pw-feed[data-id=lasers] .mana-pw-pool>i{background:var(--ck-caution)!important}'
  + '.moj-ck[data-lasers=caution] [data-at=left] .mana-bar .mana-label{color:var(--ck-caution)!important}'
  + '.moj-ck[data-hull=caution] [data-at=left] .mana-sh-plan{background:var(--ck-caution)!important}'
  + '.moj-ck[data-hull=warning] [data-at=left] .mana-sh-plan{background:var(--ck-warning)!important;animation:ck-beat .7s steps(2) infinite}'
  + '.moj-ck[data-shields=caution] [data-at=left] .mana-sh-arc{filter:drop-shadow(0 0 3px var(--ck-caution))}'
  + '.moj-ck[data-shields=warning] [data-at=left] .mana-sh-arc{animation:ck-beat .7s steps(2) infinite}'
  + '.moj-ck[data-shields=warning] .mana-pw-feed[data-id=shields] .mana-pw-pool>i,.moj-ck[data-shields=caution] .mana-pw-feed[data-id=shields] .mana-pw-pool>i{background:var(--ck-caution)!important}'
  + '@keyframes ck-beat{50%{opacity:.25}}'
  + '.hud,.hint{display:none!important}';

// which place an instrument is (the spec's regions): the sensors, the computer, the systems, the flight
const SLOT_AT = Object.freeze({ fore: 'bottom-left', aft: 'bottom-right', computer: 'bottom', systems: 'left', flight: 'right' });
const pc = (v) => `${Math.round(v * 10000) / 100}%`;

/** The instruments' places in the chase view: a slim strip along the screen's foot, clear of the craft the camera follows
 *  (the sensors at its ends, the systems and the flight beside them, the targeting computer in the middle). */
export const CHASE_SLOTS = Object.freeze({ fore: [0.01, 0.84, 0.1, 0.995], systems: [0.108, 0.8, 0.235, 0.99], computer: [0.36, 0.86, 0.64, 0.99], flight: [0.765, 0.8, 0.892, 0.99], aft: [0.9, 0.84, 0.99, 0.995] });

/** One view's instruments, each in its slot, a screen (`glass` its opacity: the cockpit's set in the panel, the chase's
 *  over the world); the sensors round; a plan of shields as tall as its screen leaves it (the computer's beside its
 *  readings where the screen is short). */
function placesCss(V, S, { glass = 0.95, inline = false } = {}) {
  const I = ':is(' + Object.values(SLOT_AT).map((a) => `.mana-place[data-at=${a}]`).join(',') + ')', a = (x) => Math.round(x * glass * 100) / 100;
  const out = [
    // (each instrument a screen: glass dark under its phosphor, no plate of the HUD's own; its words small, as an
    // instrument's are)
    `${V} ${I}>*{background:radial-gradient(ellipse at 50% 40%,rgba(18,40,24,${a(0.97)}),rgba(3,9,5,${a(1.02)}))!important;border:0!important;border-radius:6px!important;box-shadow:inset 0 0 10px rgba(0,0,0,${a(0.95)}),inset 0 0 2px rgba(125,255,154,.35)!important;padding:5px 7px!important;opacity:1!important;width:100%;height:100%;box-sizing:border-box;overflow:hidden;position:relative}`,
    `${V} ${I} *{font-size:min(1.55cqh,12px)!important;line-height:1.2!important}`,
    `${V} ${I} .mana-stack{gap:3px!important}`,
    `${V} ${I} .mana-bar .mana-track{min-width:0}`,
    `${V} ${I} .mana-pips{gap:2px}`,
    // (a narrow screen: its readings wrap rather than run into each other, the generator's names giving way to its pips)
    `${V} ${I} .mana-stack[data-dir=row]{flex-wrap:wrap;column-gap:6px;row-gap:1px}`,
    `${V} ${I} .mana-power .mana-pw-feed{grid-template-columns:8px minmax(0,1fr) auto}`,
    `${V} ${I} .mana-power .mana-label{min-width:0;overflow:hidden;text-overflow:clip;white-space:nowrap}`,
    `${V} ${I} .mana-power .mana-pw-pips{font-size:min(1.3cqh,10px)!important;letter-spacing:0}`,
    `${V} ${I} .mana-power{gap:5px}`,
    // (a stat on no highlight of its own: its label dim, its figure bright, as every reading's: HOST_CSS)
    `${V} ${I} .mana-stat *{background:none!important;padding:0!important}`,
    `${V} [data-at=bottom] .mana-text[data-role=heading]{font-size:min(2cqh,15px)!important;letter-spacing:.08em}`,
  ];
  // (the glass over each screen: a faint sheen across its upper corner, as a lit cockpit's glass catches it)
  if (glass > 0.9) out.push(`${V} ${I}>*::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(155deg,rgba(255,255,255,.075),rgba(255,255,255,0) 34%)}`);
  for (const [k, [x0, y0, x1, y1]] of Object.entries(S)) {
    out.push(`${V} .mana-place[data-at=${SLOT_AT[k]}]{left:${pc(x0)};top:${pc(y0)};width:${pc(x1 - x0)};height:${pc(y1 - y0)};right:auto;bottom:auto;transform:none;max-width:none;padding:0;align-items:stretch}`);
  }
  // the sensors round, a CRT each, filling their bezels
  out.push(`${V} .mana-place:is([data-at=bottom-left],[data-at=bottom-right])>*{border-radius:50%!important;padding:0!important;display:flex;align-items:center;justify-content:center}`);
  for (const [k, less] of [['systems', 46], ['computer', inline ? 8 : 50]]) {
    const [, y0, , y1] = S[k], hgt = `calc(${((y1 - y0) * 100).toFixed(2)}cqh - ${less}px)`;
    out.push(`${V} .mana-place[data-at=${SLOT_AT[k]}] .mana-shields{height:${hgt};width:auto;max-width:100%;aspect-ratio:1/1.1;flex:none}`);
  }
  // (the computer's plan beside its readings, at its right, where its screen is short)
  if (inline) {
    const [, y0, , y1] = S.computer;
    out.push(`${V} .mana-place[data-at=bottom] .mana-shields{position:absolute;right:8px;top:4px;margin:0}`);
    // (its readings kept clear of the plan: as wide a margin as the plan is)
    out.push(`${V} .mana-place[data-at=bottom]>*>.mana-stack{padding-right:calc((${((y1 - y0) * 100).toFixed(2)}cqh - 8px) / 1.1 + 12px)}`);
  }
  for (const k of ['fore', 'aft']) {
    const [x0, y0, x1, y1] = S[k], d = `calc(min(${((x1 - x0) * 100).toFixed(2)}cqw, ${((y1 - y0) * 100).toFixed(2)}cqh) * 0.94)`;
    out.push(`${V} .mana-place[data-at=${SLOT_AT[k]}] .mana-minimap[data-scope=yes]{width:${d}!important;height:${d}!important}`);
  }
  return out;
}

/** The instruments' places: in the cockpit, set in the card's panel; in the chase, along a slim strip over the world. */
export function cockpitPanelCss(card) {
  return [...placesCss('.moj-ck[data-view=cockpit]', card.panel.slots), ...placesCss('.moj-ck[data-view=chase]', CHASE_SLOTS, { glass: 0.62, inline: true }), ...chaseLampsCss()].join('\n');
}

/** The master lamps in the chase: a pair over the targeting computer's screen, dark until a caution or a warning lights
 *  one (the warning beating), as the cockpit's stand on its glare shield. Absent in the cockpit (its own are drawn). */
function chaseLampsCss() {
  const [x0, y0, x1] = CHASE_SLOTS.computer;
  return [
    '.moj-ck-lamps{display:none}',
    `.moj-ck-lamps[data-view=chase]{display:flex;gap:6px;position:absolute;z-index:7;pointer-events:none;left:${pc((x0 + x1) / 2)};top:calc(${pc(y0)} - 24px);transform:translateX(-50%);padding:3px;border-radius:3px;background:rgba(6,8,10,.72);box-shadow:0 0 0 1px rgba(0,0,0,.6)}`,
    '.moj-ck-lamp{font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;padding:4px 8px;border-radius:2px;white-space:nowrap}',
    '.moj-ck-lamp[data-lamp=caution]{color:var(--ck-caution);background:color-mix(in srgb,var(--ck-caution) 14%,transparent);opacity:.6}',
    '.moj-ck-lamp[data-lamp=warning]{color:var(--ck-warning);background:color-mix(in srgb,var(--ck-warning) 14%,transparent);opacity:.6}',
    '.moj-ck-lamps[data-mcaution] .moj-ck-lamp[data-lamp=caution]{background:var(--ck-caution);color:#1a0d00;opacity:1;box-shadow:0 0 10px var(--ck-caution)}',
    '.moj-ck-lamps[data-mwarning] .moj-ck-lamp[data-lamp=warning]{background:var(--ck-warning);color:#1a0d00;opacity:1;box-shadow:0 0 10px var(--ck-warning);animation:ck-beat .7s steps(2) infinite}',
  ];
}

/** The cockpit drawn over the world (inlined by toString): the canopy's bars projected through the camera, the sides
 *  under the sills or the ball round its window, the panel and its bezels. Redrawn when the view's shape changes. */
export function cockpitFramePage(F, card) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'moj-ck-frame');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;display:none';
  (document.getElementById('wrap') || document.body).appendChild(svg);
  const METAL = '#14171b', EDGE = '#3b424b', WALL = '#0d0f12';
  let key = '', lamps = {};
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  function draw(W, H, vfov) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const t = Math.tan((vfov * Math.PI) / 360), f = H / 2 / t, A = W / H;
    // a point of the frame on the screen (null behind the eye)
    const at = (p) => (p[2] > 0.04 ? [W / 2 + ((p[0] / p[2]) / (t * A)) * (W / 2), H / 2 - ((p[1] / p[2]) / t) * (H / 2)] : null);
    const g = el('g', {});
    if (F.fill === 'round') {
      // the ball round its window: all but the window, the inside of the hull
      const c = at([0, 0, F.window.z]), r = (F.window.r / F.window.z) * f;
      g.appendChild(el('path', { d: 'M0 0H' + W + 'V' + H + 'H0Z M' + (c[0] - r) + ' ' + c[1] + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z', fill: WALL, 'fill-rule': 'evenodd' }));
    } else {
      // the cockpit's sides under its sills: each sill's line down to the screen's foot and out to its edge
      for (const B of F.bars.filter((x) => x.sill)) {
        const pts = B.pts.map(at).filter(Boolean);
        if (pts.length < 2) continue;
        const side = pts[pts.length - 1][0] > W / 2 ? W : 0;
        g.appendChild(el('path', { d: 'M' + pts.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'L' + side + ' ' + pts[pts.length - 1][1].toFixed(1) + 'L' + side + ' ' + H + 'L' + pts[0][0].toFixed(1) + ' ' + H + 'Z', fill: WALL }));
      }
    }
    // the bars: each segment as thick as it is near (its radius over its depth), dark metal under a lit edge
    for (const B of F.bars) {
      if (!(B.r > 0)) continue;
      // (a bar at one depth, a ring round a window: one stroke, so it reads as one piece)
      const zs = B.pts.map((p) => p[2]);
      if (Math.min(...zs) > 0.04 && Math.max(...zs) / Math.min(...zs) < 1.2) {
        const q = B.pts.map(at), w = Math.min(H * 0.12, Math.max(2, (2 * B.r * f) / zs[0])), d = 'M' + q.map((x) => x[0].toFixed(1) + ' ' + x[1].toFixed(1)).join('L');
        g.appendChild(el('path', { d, stroke: METAL, 'stroke-width': w.toFixed(1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }));
        g.appendChild(el('path', { d, stroke: EDGE, 'stroke-width': Math.max(1, w * 0.18).toFixed(1), 'stroke-linejoin': 'round', fill: 'none' }));
        continue;
      }
      for (let i = 1; i < B.pts.length; i++) {
        const p0 = B.pts[i - 1], p1 = B.pts[i];
        if (p0[2] <= 0.04 && p1[2] <= 0.04) continue;
        const a = at(p0[2] > 0.04 ? p0 : [p0[0] + (p1[0] - p0[0]) * ((0.05 - p0[2]) / (p1[2] - p0[2])), p0[1] + (p1[1] - p0[1]) * ((0.05 - p0[2]) / (p1[2] - p0[2])), 0.05]);
        const b = at(p1[2] > 0.04 ? p1 : [p1[0] + (p0[0] - p1[0]) * ((0.05 - p1[2]) / (p0[2] - p1[2])), p1[1] + (p0[1] - p1[1]) * ((0.05 - p1[2]) / (p0[2] - p1[2])), 0.05]);
        const z = Math.max(0.05, (Math.max(p0[2], 0.05) + Math.max(p1[2], 0.05)) / 2), w = Math.min(H * 0.12, Math.max(2, (2 * B.r * f) / z));
        const d = 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
        g.appendChild(el('path', { d, stroke: METAL, 'stroke-width': w.toFixed(1), 'stroke-linecap': 'round', fill: 'none' }));
        g.appendChild(el('path', { d, stroke: EDGE, 'stroke-width': Math.max(1, w * 0.22).toFixed(1), 'stroke-linecap': 'round', fill: 'none', transform: 'translate(0 ' + (-w * 0.25).toFixed(1) + ')' }));
      }
    }
    // THE PANEL (cockpit-look.js): painted metal by the card, darker toward the pilot's knees; the screens' phosphor
    // spilling onto it; a glare shield's lip along its top, its shadow under it; the star's light on that lip as the
    // craft rolls under it (`ckKey`, set each frame); each screen in a bevelled bezel held by four screws (the sensors
    // in a knurled ring), its placard under it; the master caution and warning lamps standing on the lip
    const P = card.paint, PL = card.placards || {}, top = card.panel.top.map(([x, y]) => [x * W, y * H]), topD = top.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
    const yTop = Math.min(...top.map((q) => q[1])), u = H / 720;
    const defs = el('defs', {});
    const grad = (id, stops, attrs) => { const n = el(attrs && attrs.r ? 'radialGradient' : 'linearGradient', Object.assign({ id }, attrs || { x1: 0, y1: 0, x2: 0, y2: 1 })); for (const [o, c, a] of stops) n.appendChild(el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a })); defs.appendChild(n); };
    grad('ckPanel', [[0, P.paint], [0.45, P.paint], [1, P.shade]], { x1: 0, y1: yTop / H, x2: 0, y2: 1, gradientUnits: 'objectBoundingBox' });
    grad('ckGlow', [[0, card.glow, 0.22], [0.6, card.glow, 0.06], [1, card.glow, 0]], { r: 0.5, cx: 0.5, cy: 0.5 });
    grad('ckKeyBand', [[0, '#ffffff', 0.55], [1, '#ffffff', 0]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(defs);
    g.appendChild(el('path', { d: 'M0 ' + H + 'L' + topD + 'L' + W + ' ' + H + 'Z', fill: 'url(#ckPanel)' }));
    // (the screens' light on the metal round them)
    for (const k in card.panel.slots) { const [x0, y0, x1, y1] = card.panel.slots[k]; g.appendChild(el('ellipse', { cx: (((x0 + x1) / 2) * W).toFixed(1), cy: (((y0 + y1) / 2) * H).toFixed(1), rx: ((x1 - x0) * W * 0.85).toFixed(1), ry: ((y1 - y0) * H * 0.8).toFixed(1), fill: 'url(#ckGlow)' })); }
    // (the lip: its shadow on the panel under it, its body, its edge)
    g.appendChild(el('path', { d: 'M' + topD, stroke: '#000000', 'stroke-opacity': 0.45, 'stroke-width': (14 * u).toFixed(1), fill: 'none', transform: 'translate(0 ' + (9 * u).toFixed(1) + ')' }));
    g.appendChild(el('path', { d: 'M' + topD, stroke: P.lip, 'stroke-width': (9 * u).toFixed(1), 'stroke-linejoin': 'round', fill: 'none' }));
    g.appendChild(el('path', { d: 'M' + topD, stroke: P.bevel, 'stroke-width': (1.4 * u).toFixed(1), fill: 'none', transform: 'translate(0 ' + (-4 * u).toFixed(1) + ')' }));
    // (the star's light: the lip's edge catching it, and a sheen down the panel's top; its strength each frame)
    const keyG = el('g', { id: 'ckKey', opacity: 0 });
    keyG.appendChild(el('path', { d: 'M' + topD, stroke: P.lit, 'stroke-width': (3 * u).toFixed(1), fill: 'none', transform: 'translate(0 ' + (-4 * u).toFixed(1) + ')' }));
    keyG.appendChild(el('path', { d: 'M0 ' + (yTop + 30 * u).toFixed(1) + 'L' + topD + 'L' + W + ' ' + (yTop + 30 * u).toFixed(1) + 'Z', fill: 'url(#ckKeyBand)', opacity: 0.35, transform: 'translate(0 ' + (5 * u).toFixed(1) + ')' }));
    g.appendChild(keyG);
    const screw = (x, y) => { const r = 2.6 * u; g.appendChild(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), fill: P.screw, stroke: P.shade, 'stroke-width': (0.8 * u).toFixed(1) })); g.appendChild(el('path', { d: 'M' + (x - r * 0.7).toFixed(1) + ' ' + (y + r * 0.3).toFixed(1) + 'L' + (x + r * 0.7).toFixed(1) + ' ' + (y - r * 0.3).toFixed(1), stroke: P.shade, 'stroke-width': (0.9 * u).toFixed(1) })); };
    for (const k in card.panel.slots) {
      const [x0, y0, x1, y1] = card.panel.slots[k], pad = 7 * u, round = k === 'fore' || k === 'aft';
      if (round) {
        const cx = ((x0 + x1) / 2) * W, cy = ((y0 + y1) / 2) * H, rr = (Math.min((x1 - x0) * W, (y1 - y0) * H) / 2) + pad;
        g.appendChild(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (rr + 2 * u).toFixed(1), fill: P.bezel, stroke: '#000000', 'stroke-opacity': 0.6, 'stroke-width': (2 * u).toFixed(1) }));
        // (the knurled ring, its bevel lit above, the well inside)
        g.appendChild(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (rr - 1.5 * u).toFixed(1), fill: 'none', stroke: P.screw, 'stroke-opacity': 0.55, 'stroke-width': (2.4 * u).toFixed(1), 'stroke-dasharray': (1.2 * u).toFixed(1) + ' ' + (2.2 * u).toFixed(1) }));
        g.appendChild(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (rr - pad * 0.55).toFixed(1), fill: P.well }));
      } else {
        const X0 = x0 * W - pad, Y0 = y0 * H - pad, X1 = x1 * W + pad, Y1 = y1 * H + pad;
        g.appendChild(el('rect', { x: X0.toFixed(1), y: Y0.toFixed(1), width: (X1 - X0).toFixed(1), height: (Y1 - Y0).toFixed(1), rx: (3 * u).toFixed(1), fill: P.bezel, stroke: '#000000', 'stroke-opacity': 0.6, 'stroke-width': (1.6 * u).toFixed(1) }));
        // (its bevel: lit along the top and the left, dark along the bottom and the right)
        g.appendChild(el('path', { d: 'M' + (X0 + 1.5 * u).toFixed(1) + ' ' + (Y1 - 2 * u).toFixed(1) + 'V' + (Y0 + 1.5 * u).toFixed(1) + 'H' + (X1 - 2 * u).toFixed(1), stroke: P.bevel, 'stroke-width': (1.2 * u).toFixed(1), fill: 'none' }));
        g.appendChild(el('path', { d: 'M' + (X1 - 1.5 * u).toFixed(1) + ' ' + (Y0 + 2 * u).toFixed(1) + 'V' + (Y1 - 1.5 * u).toFixed(1) + 'H' + (X0 + 2 * u).toFixed(1), stroke: '#000000', 'stroke-opacity': 0.55, 'stroke-width': (1.2 * u).toFixed(1), fill: 'none' }));
        g.appendChild(el('rect', { x: (x0 * W - 2 * u).toFixed(1), y: (y0 * H - 2 * u).toFixed(1), width: ((x1 - x0) * W + 4 * u).toFixed(1), height: ((y1 - y0) * H + 4 * u).toFixed(1), rx: (2 * u).toFixed(1), fill: P.well }));
        const sI = 3.6 * u; screw(X0 + sI, Y0 + sI); screw(X1 - sI, Y0 + sI); screw(X0 + sI, Y1 - sI); screw(X1 - sI, Y1 - sI);
      }
      // (its placard: the screen's name, stencilled, on a dark plate where the panel has room under it)
      const name = PL[k];
      if (name && (1 - y1) * H > 9 * u) {
        const cx = ((x0 + x1) / 2) * W, py = Math.min(H - 5 * u, y1 * H + pad + 6.5 * u), fs = 7.5 * u, pw = name.length * fs * 0.68 + 8 * u;
        g.appendChild(el('rect', { x: (cx - pw / 2).toFixed(1), y: (py - fs * 0.8).toFixed(1), width: pw.toFixed(1), height: (fs * 1.15).toFixed(1), rx: (1 * u).toFixed(1), fill: P.placard }));
        const t = el('text', { x: cx.toFixed(1), y: (py + fs * 0.12).toFixed(1), 'text-anchor': 'middle', fill: P.ink, 'fill-opacity': 0.75, 'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', 'font-size': fs.toFixed(1), 'letter-spacing': (0.6 * u).toFixed(1), 'font-weight': 600 });
        t.textContent = name; g.appendChild(t);
      }
    }
    // the master lamps on the lip, either side of its middle: housings dark, their faces lit from the HUD each frame
    lamps = {};
    for (const [k, side, label] of [['caution', -1, 'MASTER CAUTION'], ['warning', 1, 'MASTER WARNING']]) {
      const w = 64 * u, h = 15 * u, cx = W / 2 + side * (w / 2 + 5 * u), y = yTop - h - 3 * u;
      g.appendChild(el('rect', { x: (cx - w / 2 - 2 * u).toFixed(1), y: (y - 2 * u).toFixed(1), width: (w + 4 * u).toFixed(1), height: (h + 4 * u).toFixed(1), rx: (2 * u).toFixed(1), fill: P.lip, stroke: '#000000', 'stroke-opacity': 0.6, 'stroke-width': (1 * u).toFixed(1) }));
      const face = el('rect', { x: (cx - w / 2).toFixed(1), y: y.toFixed(1), width: w.toFixed(1), height: h.toFixed(1), rx: (1.5 * u).toFixed(1), fill: card.lamps[k], 'fill-opacity': 0.14 });
      g.appendChild(face);
      const t = el('text', { x: cx.toFixed(1), y: (y + h * 0.68).toFixed(1), 'text-anchor': 'middle', fill: card.lamps[k], 'fill-opacity': 0.35, 'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', 'font-size': (7 * u).toFixed(1), 'font-weight': 700, 'letter-spacing': (0.4 * u).toFixed(1) });
      t.textContent = label; g.appendChild(t);
      lamps[k] = { face, t };
    }
    svg.appendChild(g);
  }
  // each frame: the star's light on the panel (`look.key` 0..1), the master lamps lit by the alerts (a warning beating)
  return function step(inCockpit, look) {
    svg.style.display = inCockpit ? 'block' : 'none';
    if (!inCockpit || typeof camera === 'undefined') return;
    const W = svg.clientWidth || window.innerWidth, H = svg.clientHeight || window.innerHeight, k = W + 'x' + H + ':' + camera.fov;
    if (k !== key) { key = k; draw(W, H, camera.fov || 60); }
    if (!look) return;
    const kg = svg.querySelector('#ckKey');
    if (kg) kg.setAttribute('opacity', (Math.round(look.key * 100) / 100).toString());
    for (const n in lamps) {
      const on = !!look[n] && (n !== 'warning' || look.beat), L = lamps[n];
      L.face.setAttribute('fill-opacity', on ? '0.95' : '0.14'); L.t.setAttribute('fill', on ? '#1a0d00' : card.lamps[n]); L.t.setAttribute('fill-opacity', on ? '0.9' : '0.35');
    }
  };
}

/** The page's side (inlined by toString): the state, the runtime mounted, a frame's read of the pilot. */
export function cockpitHudPage(cfg, ui, spec, css, frame) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-ck'; (document.getElementById('wrap') || document.body).appendChild(root);
  // (the master lamps in the chase, over the targeting computer: the cockpit's own stand on its glare shield, __ckFrame;
  // beside the HUD's root, not in it, which the runtime draws over; it carries the view and the alerts' words itself)
  const lampsEl = document.createElement('div'); lampsEl.className = 'moj-ck-lamps';
  for (const [k, say] of [['caution', 'MASTER CAUTION'], ['warning', 'MASTER WARNING']]) { const l = document.createElement('span'); l.className = 'moj-ck-lamp'; l.dataset.lamp = k; l.textContent = say; lampsEl.appendChild(l); }
  root.parentNode.appendChild(lampsEl);
  const S = { ck: { on: false, shOn: false, sMaxOn: 0, plan: cfg.plan || '', tPlan: '', tShMax: 0, tOn: false, tShOn: false, brackets: [], pip: [], edge: [], fore: [], aft: [], comms: [], tName: '', tStance: '', tRange: '', tClosure: '', tHull: 0, tFore: 0, tAft: 0, sFore: 0, sAft: 0, sMax: 1, hull: 0, hullMax: 1, laser: 0, laserMax: 1, linkSay: '', speed: '', throttle: 0, pL: 2, pS: 2, pE: 2, warheads: '', warheadsOn: false, genOn: false, genOff: true, gPhase: 0, gTick: 0, gFeeds: [] } };
  let pv = null;
  // (a point of the world on the HUD, 0..1 of its frame, `back` when it is behind the camera)
  const screenOf = (q) => { if (typeof camera === 'undefined' || typeof THREE === 'undefined') return null; pv = pv || new THREE.Vector3(); camera.updateMatrixWorld(); pv.set(q[0], q[1], q[2]).project(camera); return { x: (pv.x + 1) / 2, y: (1 - pv.y) / 2, back: pv.z >= 1 }; };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const set = (k, v) => { if (JSON.stringify(v) !== JSON.stringify(S.ck[k])) S.ck[k] = v; };
  const rangeSay = (d) => (d < 1000 ? d + ' m' : (d / 1000).toFixed(2) + ' km');
  const LINK = { 1: 'single fire', 2: 'dual fire', 4: 'quad fire' };
  const STANCE_SAY = { shields: 'shields up', lasers: 'weapons hot', engines: 'running' };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  ui.mount(root, rt, { auto: true });
  let said = '', nth = 0;
  const genX = { n: 0, to: null, t: -1 };
  const lastAt = {};
  function step() {
    const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.pilotId ? W.byId[W.pilotId] : null;
    // the cockpit view, or the chase: the cockpit drawn and its instruments set in the panel, or floating
    const inCockpit = !!(W && W.camera && W.camera.rule && W.camera.rule.type === 'cockpit');
    if (root.dataset.view !== (inCockpit ? 'cockpit' : 'chase')) root.dataset.view = lampsEl.dataset.view = inCockpit ? 'cockpit' : 'chase';
    if (me && me.sfF) {
      set('on', true);
      const sh = me.ship, w = me.weapon;
      // THE ALERTS (cockpit-look.js): each pool against its thresholds, amber a caution, red a warning; the root carries
      // each as a word its gauges are coloured by, and the master lamps light for either (a warning beating)
      const hullMax = me.hpMax || (me.body && me.body.hp) || 1;
      const A = __ckAlerts({ hull: me.body && Number.isFinite(me.body.hp) ? me.body.hp / hullMax : null, shields: sh && sh.shMax > 0 ? [sh.sh[0] / sh.shMax, sh.sh[1] / sh.shMax] : null, lasers: w && w.energyMax > 0 ? w.energy / w.energyMax : null }, cfg.alerts);
      for (const pool of ['hull', 'shields', 'lasers']) { const v = A.warning.includes(pool) ? 'warning' : A.caution.includes(pool) ? 'caution' : ''; if ((root.dataset[pool] || '') !== v) { if (v) root.dataset[pool] = v; else delete root.dataset[pool]; } }
      for (const [k, on] of [['mcaution', A.caution.length > 0], ['mwarning', A.warning.length > 0]]) if (!!lampsEl.dataset[k] !== on) { if (on) lampsEl.dataset[k] = 'on'; else delete lampsEl.dataset[k]; }
      const sun = typeof SKY !== 'undefined' && SKY && SKY.sun && Array.isArray(SKY.sun.dir) ? SKY.sun.dir : null;
      if (frame) frame(inCockpit, { key: __ckKey(sun, me.sfF, me.sfU), caution: A.caution.length > 0, warning: A.warning.length > 0, beat: Math.floor(performance.now() / 350) % 2 === 0 });
      set('shOn', !!(sh && sh.shMax > 0)); set('sMaxOn', sh && sh.shMax > 0 ? sh.shMax : 0);
      if (sh) { set('sFore', Math.round(sh.sh[0] * 10) / 10); set('sAft', Math.round(sh.sh[1] * 10) / 10); set('sMax', sh.shMax || 1); set('pL', sh.pow.lasers); set('pS', sh.pow.shields); set('pE', sh.pow.engines); set('linkSay', (LINK[sh.link] || '') + (sh.mode !== 'even' ? ' · shields ' + sh.mode : '')); }
      set('hull', Math.max(0, me.body && Number.isFinite(me.body.hp) ? me.body.hp : 0)); set('hullMax', me.hpMax || (me.body && me.body.hp) || 1);
      if (w && w.energyMax > 0) { set('laser', Math.round(w.energy)); set('laserMax', w.energyMax); }
      // the generator: its tick's fill, its beat, and each feed (its share of the routing, its gauge, what the last tick
      // gave it, and whether that was the other's redirected, or a transfer just made into it), each named by its
      // three-letter mnemonic, as a cockpit's switches are, so the narrowest screen holds it
      const G = sh && sh.gen;
      set('genOn', !!G); set('genOff', !G);
      if (G) {
        const r2 = (v) => Math.round(v * 100) / 100, Lt = G.last || {}, of = (u) => r2(Math.min(1, (u || 0) / G.out)), nowT = performance.now() / 1000;
        if (G.xfer && G.xfer.n !== genX.n) { genX.n = G.xfer.n; genX.to = G.xfer.units > 0 ? G.xfer.to : null; genX.t = nowT; }
        const xTo = genX.to && nowT - genX.t < 0.8 ? genX.to : null;
        set('gPhase', r2(G.phase)); set('gTick', G.n);
        set('gFeeds', [
          { id: 'lasers', label: 'las', share: sh.pow.lasers / 4, pips: sh.pow.lasers, max: 4, fill: w && w.energyMax > 0 ? r2(w.energy / w.energyMax) : 0, got: of(Lt.lasers), spill: (Lt.toLasers || 0) > 0.01 || xTo === 'lasers' },
          ...(sh.shMax > 0 ? [{ id: 'shields', label: 'shd', share: sh.pow.shields / 4, pips: sh.pow.shields, max: 4, fill: r2((sh.sh[0] + sh.sh[1]) / (2 * sh.shMax)), got: of(Lt.shields), spill: (Lt.toShields || 0) > 0.01 || xTo === 'shields' }] : []),
          { id: 'engines', label: 'eng', share: sh.pow.engines / 4, pips: sh.pow.engines, max: 4, fill: r2(Math.min(1, (me.airspeed || 0) / Math.max(1, me.topSpeed || 1))), got: of(Lt.engines), spill: false },
        ]);
      }
      set('speed', Math.round(me.airspeed || 0) + ' m/s'); set('throttle', Math.round((me.throttle || 0) * 100));
      const nW = Number.isFinite(me.missilesLeft) ? me.missilesLeft : null; set('warheadsOn', nW != null); set('warheads', nW != null ? String(nW) : '');
      // the sensors: every craft round, foe and friend and the target told apart
      const things = [];
      for (const e of W.entities) {
        if (e === me || e.isCamera || e.gone || e.downed || e.dormant || !e.body || !e.body.hittable) continue;
        things.push({ pos: e.transform.pos, kind: e.id === me.target ? 'target' : e.team && e.team === me.team ? 'ally' : 'foe' });
      }
      const fr = { pos: me.transform.pos, f: me.sfF, u: me.sfU };
      set('fore', __ckScope(fr, things, 'fore')); set('aft', __ckScope(fr, things, 'aft'));
      // the target: bracketed where it is, its pip where to fire, held at the edge when off screen
      const T = me.target ? W.byId[me.target] : null, I = me.tgtInfo;
      if (T && I) {
        const now = performance.now() / 1000, L = lastAt[T.id];
        const vel = T.vel || (L && now > L.t ? [(T.transform.pos[0] - L.p[0]) / (now - L.t), (T.transform.pos[1] - L.p[1]) / (now - L.t), (T.transform.pos[2] - L.p[2]) / (now - L.t)] : [0, 0, 0]);
        lastAt[T.id] = { t: now, p: T.transform.pos.slice() };
        const at = screenOf(T.transform.pos), lp = w && w.projectileSpeed > 0 && w.fireClass === 'lob' ? __ckLead(me.transform.pos, T.transform.pos, vel, w.projectileSpeed) : null, ps = lp ? screenOf(lp) : null;
        const inside = at && !at.back && at.x >= 0 && at.x <= 1 && at.y >= 0 && at.y <= 1;
        set('brackets', inside ? [{ id: T.id, x: r3(at.x), y: r3(at.y), range: rangeSay(I.d) }] : []);
        set('pip', ps && !ps.back && ps.x >= 0 && ps.x <= 1 && ps.y >= 0 && ps.y <= 1 ? [{ id: 'pip', x: r3(ps.x), y: r3(ps.y) }] : []);
        set('edge', !inside && at ? [{ x: r3(at.back ? 1 - at.x : at.x), y: r3(at.back ? 2 : at.y), kind: 'target' }] : []);
        set('tOn', true); set('tName', I.name); set('tStance', STANCE_SAY[I.stance] || ''); if ((root.dataset.tstance || '') !== (I.stance || '')) { if (I.stance) root.dataset.tstance = I.stance; else delete root.dataset.tstance; } set('tRange', rangeSay(I.d)); set('tClosure', I.closure + ' m/s');
        set('tShOn', !!I.shields); set('tShMax', I.shields ? 100 : 0); set('tHull', I.hull == null ? 0 : I.hull);
        // (its plan by its craft: a shelf craft's figure is craft-<archetype>)
        const fg = T.body && typeof T.body.figure === 'string' ? T.body.figure : '', arch = fg.indexOf('craft-') === 0 ? fg.slice(6) : '';
        set('tPlan', (cfg.plans && cfg.plans[arch]) || cfg.dart || ''); set('tFore', I.shields ? I.shields[0] : 0); set('tAft', I.shields ? I.shields[1] : 0);
      } else { set('tOn', false); set('brackets', []); set('pip', []); set('edge', []); }
    } else { set('on', false); delete lampsEl.dataset.mcaution; delete lampsEl.dataset.mwarning; if (frame) frame(inCockpit, null); }
    // the comms: the level's guide's line, each said once
    const GV = window.__mojGuide && window.__mojGuide.view ? window.__mojGuide.view() : null;
    const card = GV && GV.text ? GV.mode + ':' + GV.text : '';
    if (card && card !== said) S.ck.comms = S.ck.comms.concat([{ id: 'c' + (++nth), text: GV.text, weight: GV.mode === 'intro' ? 'major' : 'normal' }]).slice(-6);
    said = card;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return { state: S, rt };
}

/** The page's script: the helpers, the runtime, the spec and its look. */
export function cockpitHudScript(cfg = {}) {
  const theme = cfg.theme ?? COCKPIT_THEME, id = COCKPITS[cfg.cockpit] ? cfg.cockpit : 'strikeFoil', card = cockpitOf(id);
  readTheme(theme);
  const spec = cockpitHudSpec();
  manaUi.readSpec(spec);
  return `
// THE COCKPIT HUD (scene/channels/cockpit-hud.js): the starfighter's instruments on mana-ui, in its cockpit (${id})
const __ckScope = ${scopeMarks.toString()}, __ckLead = ${leadPoint.toString()}, __ckAlerts = ${cockpitAlerts.toString()}, __ckKey = ${keyOnPanel.toString()};
const __ckFrame = (${cockpitFramePage.toString()})(${json(canopyFrame(id))}, ${json({ panel: card.panel, paint: panelPaint(card), placards: PLACARDS, glow: COCKPIT_COLOURS.normal, lamps: { caution: COCKPIT_COLOURS.caution, warning: COCKPIT_COLOURS.warning } })});
window.__mojCockpitHud = (${cockpitHudPage.toString()})(${json({ cockpit: id, plan: planOf(id), plans: CRAFT_PLANS, dart: planOf(null), alerts: COCKPIT_ALERTS })}, ${manaUiSource()}, ${json(spec)}, ${json(`${manaCss()}\n${themeCss(theme)}\n${HOST_CSS}\n${cockpitPanelCss(card)}`)}, __ckFrame);
`;
}
