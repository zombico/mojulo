/**
 * THE COCKPIT HUD — a starfighter's instruments as the 90s space-combat sims drew them, on mana-ui (control/lib/mana-ui/),
 * over the view from the cockpit (or the chase), in a phosphor look (the `terminal` theme) unless the level names
 * another. What a pilot reads at a glance, each where that register put it:
 *
 *   over the world   the TARGET in brackets with its range, and the LEAD PIP: where to fire for the bolts to meet it
 *                    (its course and the bolts' speed); the target off screen held at the edge with an arrow
 *   centre           the gunsight
 *   bottom           THE TARGETING COMPUTER: the target's name, range and closure, its hull, its shields fore and aft
 *   bottom-left      THE FORE SENSOR: what lies ahead, each by its angle off the nose (the nose the middle, the edge
 *                    abeam), up the top; foe, friend and the target told apart
 *   bottom-right     THE AFT SENSOR: what lies behind, by its angle off the tail
 *   left             the craft's shields fore and aft, its hull, its laser charge and how its cannons are linked
 *   right            the speed and the throttle's setting, the power to lasers, shields and engines (pips), the
 *                    warheads
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
      { use: 'pips', props: { label: 'lasers', value: B('pL'), max: 4 } },
      { use: 'pips', props: { label: 'shields', value: B('pS'), max: 4 } },
      { use: 'pips', props: { label: 'engines', value: B('pE'), max: 4 } },
      { use: 'counter', props: { label: 'warheads', value: B('warheads') }, when: B('warheadsOn') },
    ])], { when: B('on') }),
  ] } };
}

// (the layer over the canvas, taking no pointer; the page's own flight readouts and radar put away under it)
const HOST_CSS = '.moj-ck{position:absolute;inset:0;pointer-events:none;z-index:7}.moj-ck .mana-root{background:none}'
  + '.moj-c-radar,.moj-c-gauge,.moj-c-lock,.moj-c-hp,.moj-c-ehp,.moj-hud-top-left,.moj-w-legend{display:none!important}'
  // (a ship's sensor has no north: its top is the craft's up)
  + '.moj-ck .mana-minimap .mana-north,.moj-ck .mana-minimap [data-north]{display:none!important}'
  + '.moj-ck .mana-anchor>*{background:none!important;padding:0!important}'
  + '.moj-ck .mana-anchor .mana-reticle{font-size:40px;color:var(--mana-accent)}'
  + '.moj-ck .mana-minimap[data-scope=yes]{width:min(20vh,170px);height:min(20vh,170px)}'
  + '.moj-ck .mana-minimap .mana-marker[data-kind=foe]{color:var(--mana-harm)}.moj-ck .mana-minimap .mana-marker[data-kind=ally]{color:var(--mana-accent)}'
  + '.moj-ck .mana-minimap .mana-marker[data-kind=target]{color:var(--mana-accent2);font-size:1.4em}'
  + '.moj-ck .mana-place[data-at=left],.moj-ck .mana-place[data-at=right]{width:min(18vw,220px)}'
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
    // (a stat's figure on no highlight of its own: the screen's phosphor)
    `${V} ${I} .mana-stat *{background:none!important;color:var(--mana-accent)!important;padding:0!important}`,
    `${V} [data-at=bottom] .mana-text[data-role=heading]{font-size:min(2cqh,15px)!important;letter-spacing:.08em}`,
  ];
  for (const [k, [x0, y0, x1, y1]] of Object.entries(S)) {
    out.push(`${V} .mana-place[data-at=${SLOT_AT[k]}]{left:${pc(x0)};top:${pc(y0)};width:${pc(x1 - x0)};height:${pc(y1 - y0)};right:auto;bottom:auto;transform:none;max-width:none;padding:0;align-items:stretch}`);
  }
  // the sensors round, a CRT each, filling their bezels
  out.push(`${V} .mana-place:is([data-at=bottom-left],[data-at=bottom-right])>*{border-radius:50%!important;padding:0!important;display:flex;align-items:center;justify-content:center}`);
  for (const [k, less] of [['systems', 34], ['computer', inline ? 8 : 50]]) {
    const [, y0, , y1] = S[k], hgt = `calc(${((y1 - y0) * 100).toFixed(2)}cqh - ${less}px)`;
    out.push(`${V} .mana-place[data-at=${SLOT_AT[k]}] .mana-shields{height:${hgt};width:auto;max-width:100%;aspect-ratio:1/1.1;flex:none}`);
  }
  // (the computer's plan beside its readings, at its right, where its screen is short)
  if (inline) out.push(`${V} .mana-place[data-at=bottom] .mana-shields{position:absolute;right:8px;top:4px;margin:0}`);
  for (const k of ['fore', 'aft']) {
    const [x0, y0, x1, y1] = S[k], d = `calc(min(${((x1 - x0) * 100).toFixed(2)}cqw, ${((y1 - y0) * 100).toFixed(2)}cqh) * 0.94)`;
    out.push(`${V} .mana-place[data-at=${SLOT_AT[k]}] .mana-minimap[data-scope=yes]{width:${d}!important;height:${d}!important}`);
  }
  return out;
}

/** The instruments' places: in the cockpit, set in the card's panel; in the chase, along a slim strip over the world. */
export function cockpitPanelCss(card) {
  return [...placesCss('.moj-ck[data-view=cockpit]', card.panel.slots), ...placesCss('.moj-ck[data-view=chase]', CHASE_SLOTS, { glass: 0.62, inline: true })].join('\n');
}

/** The cockpit drawn over the world (inlined by toString): the canopy's bars projected through the camera, the sides
 *  under the sills or the ball round its window, the panel and its bezels. Redrawn when the view's shape changes. */
export function cockpitFramePage(F, card) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'moj-ck-frame');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;display:none';
  (document.getElementById('wrap') || document.body).appendChild(svg);
  const METAL = '#14171b', EDGE = '#3b424b', PANEL = '#1b1f24', WALL = '#0d0f12';
  let key = '';
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
    // the panel: its silhouette over the screen's foot, a glare shield's lip along its top, and a bezel at each slot
    const top = card.panel.top.map(([x, y]) => [x * W, y * H]);
    g.appendChild(el('path', { d: 'M0 ' + H + 'L' + top.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'L' + W + ' ' + H + 'Z', fill: PANEL }));
    g.appendChild(el('path', { d: 'M' + top.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L'), stroke: '#2c3238', 'stroke-width': Math.max(2, H * 0.006).toFixed(1), fill: 'none' }));
    for (const k in card.panel.slots) {
      const [x0, y0, x1, y1] = card.panel.slots[k], pad = H * 0.006, round = k === 'fore' || k === 'aft';
      if (round) { const cx = ((x0 + x1) / 2) * W, cy = ((y0 + y1) / 2) * H, rr = (Math.min((x1 - x0) * W, (y1 - y0) * H) / 2) + pad; g.appendChild(el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: rr.toFixed(1), fill: '#07090b', stroke: '#30363d', 'stroke-width': (pad * 1.4).toFixed(1) })); }
      else g.appendChild(el('rect', { x: (x0 * W - pad).toFixed(1), y: (y0 * H - pad).toFixed(1), width: ((x1 - x0) * W + 2 * pad).toFixed(1), height: ((y1 - y0) * H + 2 * pad).toFixed(1), rx: (pad * 1.5).toFixed(1), fill: '#07090b', stroke: '#30363d', 'stroke-width': (pad * 1.4).toFixed(1) }));
    }
    svg.appendChild(g);
  }
  return function step(inCockpit) {
    svg.style.display = inCockpit ? 'block' : 'none';
    if (!inCockpit || typeof camera === 'undefined') return;
    const W = svg.clientWidth || window.innerWidth, H = svg.clientHeight || window.innerHeight, k = W + 'x' + H + ':' + camera.fov;
    if (k !== key) { key = k; draw(W, H, camera.fov || 60); }
  };
}

/** The page's side (inlined by toString): the state, the runtime mounted, a frame's read of the pilot. */
export function cockpitHudPage(cfg, ui, spec, css, frame) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-ck'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { ck: { on: false, shOn: false, sMaxOn: 0, plan: cfg.plan || '', tPlan: '', tShMax: 0, tOn: false, tShOn: false, brackets: [], pip: [], edge: [], fore: [], aft: [], comms: [], tName: '', tRange: '', tClosure: '', tHull: 0, tFore: 0, tAft: 0, sFore: 0, sAft: 0, sMax: 1, hull: 0, hullMax: 1, laser: 0, laserMax: 1, linkSay: '', speed: '', throttle: 0, pL: 2, pS: 2, pE: 2, warheads: '', warheadsOn: false } };
  let pv = null;
  // (a point of the world on the HUD, 0..1 of its frame, `back` when it is behind the camera)
  const screenOf = (q) => { if (typeof camera === 'undefined' || typeof THREE === 'undefined') return null; pv = pv || new THREE.Vector3(); camera.updateMatrixWorld(); pv.set(q[0], q[1], q[2]).project(camera); return { x: (pv.x + 1) / 2, y: (1 - pv.y) / 2, back: pv.z >= 1 }; };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const set = (k, v) => { if (JSON.stringify(v) !== JSON.stringify(S.ck[k])) S.ck[k] = v; };
  const rangeSay = (d) => (d < 1000 ? d + ' m' : (d / 1000).toFixed(2) + ' km');
  const LINK = { 1: 'single fire', 2: 'dual fire', 4: 'quad fire' };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  ui.mount(root, rt, { auto: true });
  let said = '', nth = 0;
  const lastAt = {};
  function step() {
    const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.pilotId ? W.byId[W.pilotId] : null;
    // the cockpit view, or the chase: the cockpit drawn and its instruments set in the panel, or floating
    const inCockpit = !!(W && W.camera && W.camera.rule && W.camera.rule.type === 'cockpit');
    if (root.dataset.view !== (inCockpit ? 'cockpit' : 'chase')) root.dataset.view = inCockpit ? 'cockpit' : 'chase';
    if (frame) frame(inCockpit);
    if (me && me.sfF) {
      set('on', true);
      const sh = me.ship, w = me.weapon;
      set('shOn', !!(sh && sh.shMax > 0)); set('sMaxOn', sh && sh.shMax > 0 ? sh.shMax : 0);
      if (sh) { set('sFore', Math.round(sh.sh[0] * 10) / 10); set('sAft', Math.round(sh.sh[1] * 10) / 10); set('sMax', sh.shMax || 1); set('pL', sh.pow.lasers); set('pS', sh.pow.shields); set('pE', sh.pow.engines); set('linkSay', (LINK[sh.link] || '') + (sh.mode !== 'even' ? ' · shields ' + sh.mode : '')); }
      set('hull', Math.max(0, me.body && Number.isFinite(me.body.hp) ? me.body.hp : 0)); set('hullMax', me.hpMax || (me.body && me.body.hp) || 1);
      if (w && w.energyMax > 0) { set('laser', Math.round(w.energy)); set('laserMax', w.energyMax); }
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
        set('tOn', true); set('tName', I.name); set('tRange', rangeSay(I.d)); set('tClosure', I.closure + ' m/s');
        set('tShOn', !!I.shields); set('tShMax', I.shields ? 100 : 0); set('tHull', I.hull == null ? 0 : I.hull);
        // (its plan by its craft: a shelf craft's figure is craft-<archetype>)
        const fg = T.body && typeof T.body.figure === 'string' ? T.body.figure : '', arch = fg.indexOf('craft-') === 0 ? fg.slice(6) : '';
        set('tPlan', (cfg.plans && cfg.plans[arch]) || cfg.dart || ''); set('tFore', I.shields ? I.shields[0] : 0); set('tAft', I.shields ? I.shields[1] : 0);
      } else { set('tOn', false); set('brackets', []); set('pip', []); set('edge', []); }
    } else set('on', false);
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
  const theme = cfg.theme ?? 'terminal', id = COCKPITS[cfg.cockpit] ? cfg.cockpit : 'strikeFoil', card = cockpitOf(id);
  readTheme(theme);
  const spec = cockpitHudSpec();
  manaUi.readSpec(spec);
  return `
// THE COCKPIT HUD (scene/channels/cockpit-hud.js): the starfighter's instruments on mana-ui, in its cockpit (${id})
const __ckScope = ${scopeMarks.toString()}, __ckLead = ${leadPoint.toString()};
const __ckFrame = (${cockpitFramePage.toString()})(${json(canopyFrame(id))}, ${json({ panel: card.panel })});
window.__mojCockpitHud = (${cockpitHudPage.toString()})(${json({ cockpit: id, plan: planOf(id), plans: CRAFT_PLANS, dart: planOf(null) })}, ${manaUiSource()}, ${json(spec)}, ${json(`${manaCss()}\n${themeCss(theme)}\n${HOST_CSS}\n${cockpitPanelCss(card)}`)}, __ckFrame);
`;
}
