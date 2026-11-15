/**
 * THE HUD GRAMMAR — an action-adventure's HUD on mana-ui (control/lib/mana-ui/), over play: five places and what each
 * says, in the greybox until the game's look is settled.
 *
 *   top-left      VITALS      the hero's health as hearts (a level var over the hp a heart holds: a hit takes a part),
 *                             and under them its stamina, shown only while it is spent
 *   top           NAVIGATION  a compass strip (the camera's heading), the goal's bearing on it, under it the objective in
 *                             a line with its distance, and THE CARD LANE: what the level says (its opening, a line
 *                             said, a way held), one at a time on mana-ui's moment queue
 *   bottom        THE PROMPT  the keys at hand (a lesson, a fight's own keys): each a control and what it does
 *   bottom-right  THE ACTIONS what each button does now: the weapon in hand, the sidearm, the item held with its count,
 *                             each under the control of the device in hand (keys, or a pad once one has spoken)
 *
 * The page is its host: each frame it reads the bus's vars (events.js `window.__mojBus`) and the pilot
 * (controllable/index.js `window.__mojCtrl`) into the state mana-ui draws, and takes no input (a HUD never has the focus).
 * What the level says comes from its GUIDE (guide.js `window.__mojGuide.view()`: the one thing at a time, as data): the
 * guide decides, this draws, and the guide's own line stays down. The ad-hoc parts it stands in for are not shown beside
 * it: the HUD layer's top-left readouts (the hp, an item's count), the legend line, the radar, the stamina gauge.
 *
 *   events.grammar: { hearts: { var, per, max }, slots: [{ id, name, keys?, pad?, var? | label? }], goal?: [x, y], objective?,
 *                     places?: [{ name, box: [x0, y0, x1, y1] }], theme? }
 *                   (`theme`: the look it is drawn in, a mana-ui theme: the game's interface look; none, the greybox)   (a PLACE CARD as the hero comes into each: its name, once on arriving)
 *                   (a slot's `label`: its count is the level's var the HUD row of that label reads)
 *   readHudGrammar(g, at?)   → the word read (throws naming the field), or null for none
 *   hudGrammarSpec(g)        → the mana-ui spec it draws
 *   hudGrammarScript(g)      → the page's script (emitted only where a level has the word: absent, zero bytes)
 */
import { manaUiSource, manaUi } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss, readTheme } from '../../../mana-ui/theme.js';
import { ICONS, iconFor, iconSvg } from '../../playscape/ui/item-icons.js';

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
  if (g.theme !== undefined) { try { readTheme(g.theme); } catch (e) { no(`.theme: ${e.message}`); } }
  if (g.places !== undefined && !(Array.isArray(g.places) && g.places.every((p) => isObj(p) && typeof p.name === 'string' && p.name && Array.isArray(p.box) && p.box.length === 4 && p.box.every(Number.isFinite)))) no('.places is a list of { name, box: [x0, y0, x1, y1] }');
  return { hearts: { var: H.var, per: H.per, max: H.max }, slots: g.slots.map((s) => ({ id: s.id, name: s.name, ...(s.keys ? { keys: String(s.keys) } : {}), ...(s.pad ? { pad: String(s.pad) } : {}), ...(typeof s.var === 'string' ? { var: s.var } : {}), ...(typeof s.label === 'string' ? { label: s.label } : {}), ...(typeof s.icon === 'string' ? { icon: s.icon } : {}) })),
    ...(g.goal ? { goal: [g.goal[0], g.goal[1]] } : {}), ...(g.objective ? { objective: g.objective } : {}), ...(g.places?.length ? { places: g.places.map((p) => ({ name: p.name, box: [...p.box] })) } : {}), ...(g.theme !== undefined ? { theme: g.theme } : {}) };
}

const B = (p) => ({ bind: `hud.${p}` }), I = (f) => ({ item: f });
const region = (at, children, extra = {}, bare = false) => ({ use: 'region', props: { at, ...(bare ? { variant: 'bare' } : {}) }, children, ...extra });
/** The spec: the three places as regions of a hud (kernel.js components: pips, compass, text, slot). */
export function hudGrammarSpec(g) {
  const G = readHudGrammar(g);
  return { screens: {}, hud: { use: 'hud', children: [
    region('top-left', [{ use: 'stack', props: { gap: 'tight' }, children: [
      { use: 'pips', props: { value: B('hearts'), max: B('heartsMax'), shape: 'heart' } },
      { use: 'bar', props: { value: B('stamina'), max: 100, variant: 'mp', figures: false, size: 'thin' }, when: B('spent') },
    ] }], {}, true),
    region('top', [{ use: 'stack', props: { gap: 'tight', align: 'center' }, children: [
      { use: 'compass', props: { heading: B('heading'), markers: B('markers') } },
      { use: 'text', props: { value: B('objective'), role: 'label' }, when: B('objective') },
      { use: 'moments', props: { rows: B('moments'), as: 'toast' } },
    ] }]),
    region('bottom', [{ use: 'each', props: { dir: 'row', rows: B('prompts'), row: { use: 'prompt', props: { glyph: I('glyph'), label: I('label') } } } }], { when: B('prompting') }),
    ...(G.slots.length ? [region('bottom-right', [{ use: 'each', props: { dir: 'row', rows: B('slots'), row: { use: 'slot', props: { name: I('name'), key: I('key'), count: I('count'), active: I('active'), disabled: I('disabled') } } } }], {}, true)] : []),
  ] } };
}

// (what it stands in for is not shown beside it; the layer over the canvas, taking no pointer)
const HOST_CSS = '.moj-hg{position:absolute;inset:0;pointer-events:none;z-index:7}.moj-hg .mana-root{background:none}'
  + '.moj-hud-top-left,.moj-w-legend,.moj-c-radar,.moj-c-gauge{display:none!important}';

/** The page's side (inlined by toString): the state, the runtime mounted, a frame's read of the bus and the pilot. */
export function hudGrammarPage(cfg, ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-hg'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { hud: { hearts: cfg.hearts.max, heartsMax: cfg.hearts.max, stamina: 100, spent: false, heading: 0, markers: [], objective: cfg.objective || '', slots: [], moments: [], prompts: [], prompting: false } };
  // (a key line, 'F F  dodge · F  sprint': each part its control before the double space, the rest what it does)
  // (a note after a key's words was the old line's, 'the green bar is your stamina': the HUD shows what it pointed at)
  const promptsOf = (lines) => { const out = []; for (const line of lines) for (const part of String(line).split(' · ')) { const i = part.indexOf('  '); if (i < 0) { if (!out.length) out.push({ glyph: '', label: part }); } else out.push({ glyph: part.slice(0, i), label: part.slice(i + 2) }); } return out; };
  const WEIGHT = { intro: 'major', held: 'normal', say: 'normal' };
  let said = '', nth = 0, view = null, place = '';
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
    // (what the level says: its guide's one thing, guide.js; a level with none, the word's own goal and line)
    const GV = window.__mojGuide && window.__mojGuide.view ? window.__mojGuide.view() : null;
    if (me) {
      // (the camera's heading where there is one, as the player looks; the runtime's is anticlockwise from east, a
      // compass reads clockwise from north)
      let yaw = me.transform.heading;
      if (typeof camera !== 'undefined' && typeof THREE !== 'undefined') { view = view || new THREE.Vector3(); camera.getWorldDirection(view); yaw = Math.atan2(view.y, view.x); }
      S.hud.heading = Math.round(((90 - deg(yaw)) % 360 + 360) % 360);
      const at = GV ? (GV.goal ? GV.goal.at : null) : cfg.goal;
      const marks = at ? [{ bearing: Math.round((deg(Math.atan2(at[0] - me.transform.pos[0], at[1] - me.transform.pos[1])) % 360 + 360) % 360), kind: 'goal' }] : [];
      if (JSON.stringify(marks) !== JSON.stringify(S.hud.markers)) S.hud.markers = marks;
      // (its stamina, where it sprints on one: shown while it is spent)
      const max = me.rule && me.rule.stamina ? (me.rule.boostMax || 0) : 0;
      if (max > 0) { const f = Math.max(0, Math.min(1, (me.boost == null ? max : me.boost) / max)); S.hud.stamina = Math.round(f * 100); S.hud.spent = f < 0.995; }
    }
    // (a place card: the name of the place the hero has come into, the weightiest of the lane's cards)
    if (me && cfg.places) { const x = me.transform.pos[0], y = me.transform.pos[1], at = cfg.places.find((p) => x >= p.box[0] && x < p.box[2] && y >= p.box[1] && y < p.box[3]); if (at && at.name !== place) { place = at.name; S.hud.moments = S.hud.moments.concat([{ id: 'p' + (++nth), text: at.name, weight: 'major' }]).slice(-6); } }
    if (GV) {
      S.hud.objective = GV.goal ? GV.goal.say + (Number.isFinite(GV.goal.d) ? ' · ' + GV.goal.d + ' m' : '') : (GV.mode === 'way' ? GV.text : '');
      const keys = GV.mode === 'keys' ? promptsOf(GV.keys) : [];
      if (JSON.stringify(keys) !== JSON.stringify(S.hud.prompts)) { S.hud.prompts = keys; S.hud.prompting = keys.length > 0; }
      // (a line said, the opening, a way held: each a card once, on the queue)
      const card = WEIGHT[GV.mode] ? GV.mode + ':' + GV.text : '';
      if (card && card !== said) S.hud.moments = S.hud.moments.concat([{ id: 'g' + (++nth), text: GV.text, weight: WEIGHT[GV.mode] }]).slice(-6);
      said = card;
    }
    const slots = cfg.slots.map((s) => { const n = s.var ? Number(vars[s.var]) : NaN; return { name: s.name, key: (pad ? s.pad : s.keys) || '', count: Number.isFinite(n) ? String(n) : '', active: s.id === 'weapon', disabled: s.var ? !(n > 0) : false }; });
    if (JSON.stringify(slots) !== JSON.stringify(S.hud.slots)) S.hud.slots = slots;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return { state: S, rt };
}

// THE DRESS over the theme: the hearts large, in the theme's accent, on no plate (the world behind them); each slot its
// thing's icon (playscape/ui/item-icons.js, by its `icon` or its name's words) in the theme's ink, its letters not drawn
const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
function dressCss(G) {
  const T = readTheme(G.theme ?? 'greybox').tokens, ink = T.ink, heart = T.accent;
  const icon = (id) => iconSvg(id).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').split('currentColor').join(ink).split('var(--moj-icon-line,rgba(0,0,0,.55))').join(ink).split('stroke-width="1.2"').join('stroke-width="1.6"')
    // (an attribute said twice is an error in an image's XML, where a page's HTML forgave it: the first stands)
    .replace(/(<[a-z]+\b[^>]*?\sstroke-width="[^"]*"[^>]*?)\sstroke-width="[^"]*"/g, '$1');
  return [
    // (a plateless place has no frame of the theme's either: its parts are their own)
    '.moj-hg .mana-region[data-variant=bare],.moj-hg .mana-region[data-variant=bare]::before,.moj-hg .mana-region[data-variant=bare]::after{border:0!important;outline:0!important;background:none!important;box-shadow:none!important}',
    `.moj-hg .mana-pips[data-shape=heart] .mana-glyphs{color:${heart};font-size:34px;letter-spacing:3px;text-shadow:0 1px 0 rgba(255,255,255,.55),0 2px 6px rgba(0,0,0,.45)}`,
    ...G.slots.map((s) => { const id = s.icon && ICONS[s.icon] ? s.icon : iconFor({ key: s.name.toLowerCase(), name: s.name }); return id && ICONS[id] ? `.moj-hg .mana-slot[title=${JSON.stringify(s.name)}] .mana-icon{color:transparent;width:70%;height:70%;background:${uri(icon(id))} center/contain no-repeat}` : ''; }),
  ].filter(Boolean).join('\n');
}

/** The page's script (see the header). */
export function hudGrammarScript(g, hud = []) {
  const G0 = readHudGrammar(g), spec = hudGrammarSpec(G0);
  // (a slot that counts by a `label` reads the level's var of that label: the HUD's own row, events.hud)
  const varOf = (label) => (Array.isArray(hud) ? hud.find((r) => r && r.label === label && typeof r.var === 'string')?.var : undefined);
  const { theme: _theme, ...G1 } = G0;
  const G = { ...G1, slots: G0.slots.map(({ label, icon: _icon, ...s }) => ({ ...s, ...(s.var === undefined && label && varOf(label) ? { var: varOf(label) } : {}) })) };
  manaUi.readSpec(spec);
  return `
// THE HUD GRAMMAR (scene/channels/hud-grammar.js): the hero's hearts, the compass and the goal, the actions; mana-ui's
window.__mojHudGrammar = (${hudGrammarPage.toString()})(${json(G)}, ${manaUiSource()}, ${json(spec)}, ${json(`${manaCss()}\n${themeCss(G0.theme ?? 'greybox')}\n${HOST_CSS}\n${dressCss(G0)}`)});
`;
}
