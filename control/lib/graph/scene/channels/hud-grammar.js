/**
 * THE HUD GRAMMAR — an action-adventure's HUD on mana-ui (control/lib/mana-ui/), over play: five places and what each
 * says, in the greybox until the game's look is settled.
 *
 *   top-left      VITALS      the hero's health as hearts (a level var over the hp a heart holds: a hit takes a part)
 *   top           NAVIGATION  a compass strip, the goal's bearing on it, and under it the objective in a line
 *   bottom-right  THE ACTIONS what each button does now: the weapon in hand, the sidearm, the item held with its count,
 *                             each under the control of the device in hand (keys, or a pad once one has spoken)
 *
 * The page is its host: each frame it reads the bus's vars (events.js `window.__mojBus`) and the pilot
 * (controllable/index.js `window.__mojCtrl`) into the state mana-ui draws, and takes no input (a HUD never has the focus).
 * The ad-hoc parts it stands in for are not shown beside it: the HUD layer's top-left readouts (the hp, an item's
 * count), the legend line, the radar.
 *
 *   events.grammar: { hearts: { var, per, max }, slots: [{ id, name, keys?, pad?, var? | label? }], goal?: [x, y], objective? }
 *                   (a slot's `label`: its count is the level's var the HUD row of that label reads)
 *   readHudGrammar(g, at?)   → the word read (throws naming the field), or null for none
 *   hudGrammarSpec(g)        → the mana-ui spec it draws
 *   hudGrammarScript(g)      → the page's script (emitted only where a level has the word: absent, zero bytes)
 */
import { manaUiSource, manaUi } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/** The word read: its hearts, its slots, its goal and its objective. */
export function readHudGrammar(g, at = 'events.grammar') {
  if (g === undefined || g === null || g === false) return null;
  const no = (m) => { throw new Error(`hud grammar: ${at} ${m}`); };
  if (!isObj(g)) no('is { hearts: { var, per, max }, slots: [{ id, name, keys?, pad?, var? }], goal?, objective? }');
  const H = g.hearts;
  if (!isObj(H) || typeof H.var !== 'string' || !(H.per > 0) || !(Number.isInteger(H.max) && H.max > 0 && H.max <= 20)) no('.hearts is { var: the level var its health is, per: the hp a heart holds (above 0), max: how many hearts (1 to 20) }');
  if (!Array.isArray(g.slots) || g.slots.length > 6) no('.slots is a list of up to 6 actions');
  g.slots.forEach((s, i) => { if (!isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string' || !s.name) no(`.slots[${i}] is { id, name, keys?, pad?, var?, label? }`); });
  if (g.goal !== undefined && !(Array.isArray(g.goal) && g.goal.length >= 2 && g.goal.slice(0, 2).every(Number.isFinite))) no('.goal is [x, y], where the level\'s way ends');
  if (g.objective !== undefined && typeof g.objective !== 'string') no('.objective is a line');
  return { hearts: { var: H.var, per: H.per, max: H.max }, slots: g.slots.map((s) => ({ id: s.id, name: s.name, ...(s.keys ? { keys: String(s.keys) } : {}), ...(s.pad ? { pad: String(s.pad) } : {}), ...(typeof s.var === 'string' ? { var: s.var } : {}), ...(typeof s.label === 'string' ? { label: s.label } : {}) })),
    ...(g.goal ? { goal: [g.goal[0], g.goal[1]] } : {}), ...(g.objective ? { objective: g.objective } : {}) };
}

const B = (p) => ({ bind: `hud.${p}` }), I = (f) => ({ item: f });
const region = (at, children, extra = {}) => ({ use: 'region', props: { at }, children, ...extra });
/** The spec: the three places as regions of a hud (kernel.js components: pips, compass, text, slot). */
export function hudGrammarSpec(g) {
  const G = readHudGrammar(g);
  return { screens: {}, hud: { use: 'hud', children: [
    region('top-left', [{ use: 'pips', props: { value: B('hearts'), max: B('heartsMax'), shape: 'heart' } }]),
    region('top', [{ use: 'stack', props: { gap: 'tight', align: 'center' }, children: [
      { use: 'compass', props: { heading: B('heading'), markers: B('markers') } },
      ...(G.objective ? [{ use: 'text', props: { value: B('objective'), role: 'label' } }] : []),
    ] }]),
    ...(G.slots.length ? [region('bottom-right', [{ use: 'each', props: { dir: 'row', rows: B('slots'), row: { use: 'slot', props: { name: I('name'), key: I('key'), count: I('count'), active: I('active') } } } }])] : []),
  ] } };
}

// (what it stands in for is not shown beside it; the layer over the canvas, taking no pointer)
const HOST_CSS = '.moj-hg{position:absolute;inset:0;pointer-events:none;z-index:7}.moj-hg .mana-root{background:none}'
  + '.moj-hud-top-left,.moj-w-legend,.moj-c-radar{display:none!important}'
  // (the guide's line sits under the navigation until the two share one card lane)
  + '.moj-gd{transform:translateY(64px)}';

/** The page's side (inlined by toString): the state, the runtime mounted, a frame's read of the bus and the pilot. */
export function hudGrammarPage(cfg, ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-hg'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { hud: { hearts: cfg.hearts.max, heartsMax: cfg.hearts.max, heading: 0, markers: [], objective: cfg.objective || '', slots: [] } };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  ui.mount(root, rt, { auto: true });
  let pad = false;
  window.addEventListener('gamepadconnected', () => { pad = true; });
  window.addEventListener('keydown', () => { pad = false; });
  window.addEventListener('mousedown', () => { pad = false; });
  const deg = (r) => r * 180 / Math.PI;
  function step() {
    const bus = window.__mojBus, vars = bus && bus.state ? bus.state.vars : {};
    const hp = Number(vars[cfg.hearts.var]);
    // (a part of a heart is a heart still held: it empties with its last hp)
    if (Number.isFinite(hp)) S.hud.hearts = Math.max(0, Math.min(cfg.hearts.max, Math.ceil(hp / cfg.hearts.per)));
    const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.pilotId ? W.byId[W.pilotId] : null;
    if (me) {
      // (the runtime's heading is anticlockwise from east; a compass reads clockwise from north)
      const h = ((90 - deg(me.transform.heading)) % 360 + 360) % 360;
      S.hud.heading = Math.round(h);
      if (cfg.goal) { const dx = cfg.goal[0] - me.transform.pos[0], dy = cfg.goal[1] - me.transform.pos[1]; S.hud.markers = [{ bearing: Math.round((deg(Math.atan2(dx, dy)) % 360 + 360) % 360), kind: 'goal' }]; }
    }
    const slots = cfg.slots.map((s) => { const n = s.var ? Number(vars[s.var]) : NaN; return { name: s.name, key: (pad ? s.pad : s.keys) || '', count: Number.isFinite(n) ? String(n) : '', active: s.id === 'weapon' }; });
    if (JSON.stringify(slots) !== JSON.stringify(S.hud.slots)) S.hud.slots = slots;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return { state: S, rt };
}

/** The page's script (see the header). */
export function hudGrammarScript(g, hud = []) {
  const G0 = readHudGrammar(g), spec = hudGrammarSpec(G0);
  // (a slot that counts by a `label` reads the level's var of that label: the HUD's own row, events.hud)
  const varOf = (label) => (Array.isArray(hud) ? hud.find((r) => r && r.label === label && typeof r.var === 'string')?.var : undefined);
  const G = { ...G0, slots: G0.slots.map(({ label, ...s }) => ({ ...s, ...(s.var === undefined && label && varOf(label) ? { var: varOf(label) } : {}) })) };
  manaUi.readSpec(spec);
  return `
// THE HUD GRAMMAR (scene/channels/hud-grammar.js): the hero's hearts, the compass and the goal, the actions; mana-ui's
window.__mojHudGrammar = (${hudGrammarPage.toString()})(${json(G)}, ${manaUiSource()}, ${json(spec)}, ${json(`${manaCss()}\n${themeCss('greybox')}\n${HOST_CSS}`)});
`;
}
