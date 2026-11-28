/**
 * THE HUD GRAMMAR — an action-adventure's HUD on mana-ui (control/lib/mana-ui/), over play: five places and what each
 * says, in the greybox until the game's look is settled.
 *
 *   top-left      VITALS      the hero's health as hearts (a level var over the hp a heart holds: a hit takes a part),
 *                             and under them its stamina, shown only while it is spent
 *   top           NAVIGATION  a compass strip (the camera's heading), the goal's bearing on it (and the player's pins,
 *                             a map's: scene/channels/map-channel.js), under it the objective in
 *                             a line with its distance, and THE CARD LANE: what the level says (its opening, a line
 *                             said, a way held), one at a time on mana-ui's moment queue
 *   top-right     WHAT IS HELD, a row of icons and never words: the weapon in hand, the sidearm, the item held with
 *                             its count, each under the control of the device in hand (keys, or a pad once one has
 *                             spoken), small. What the body does (the guard, the sprint, the lock) is not equipment: its
 *                             keys are the controls screen's. The level's key reminders are not drawn either
 *   bottom-right  THE MAP     a round scope that turns with the hero: the foes awake and the way on (gameworld/radar.js),
 *                             where the page's own radar was put away
 *   over the world  THE STAMINA as a ring by the hero's shoulder, shown only while it is spent, harm when nearly winded;
 *                             THE LOCK as brackets over the locked foe's head with its health thin under them, in place
 *                             of the page's own diamond. Both on mana-ui's anchors, at points the page's camera projects
 * The hearts empty by quarters: a hit takes part of a heart, and the heart shows it.
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
import { radarMarks, sceneThings, RADAR } from '../../gameworld/radar.js';
import { hitBearing } from '../../gameworld/damage-ring.js';

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
// what the body does is not what it holds: these slots are not drawn (their keys are the controls screen's)
const BODY = Object.freeze(['guard', 'sprint', 'lock']);
const region = (at, children, extra = {}, bare = false) => ({ use: 'region', props: { at, ...(bare ? { variant: 'bare' } : {}) }, children, ...extra });
/** The spec: the three places as regions of a hud (kernel.js components: pips, compass, text, slot). */
export function hudGrammarSpec(g) {
  const G = readHudGrammar(g);
  return { screens: {}, hud: { use: 'hud', children: [
    // (over the world, at the points the page projects: the stamina ring by the hero, the lock over its foe)
    { use: 'anchors', props: { variant: 'bare', rows: B('ring'), row: { use: 'charge', props: { value: I('value'), state: I('state') } } } },
    { use: 'anchors', props: { variant: 'bare', rows: B('lock'), row: { use: 'stack', props: { gap: 'tight', align: 'center' }, children: [{ use: 'reticle', props: { shape: 'bracket' } }, { use: 'bar', props: { value: I('hp'), max: I('hpMax'), variant: 'hp', size: 'thin', figures: false } }] } } },
    region('top-left', [{ use: 'pips', props: { value: B('hearts'), max: B('heartsMax'), shape: 'heart' } }], {}, true),
    region('top', [{ use: 'stack', props: { gap: 'tight', align: 'center' }, children: [
      { use: 'compass', props: { heading: B('heading'), markers: B('markers') } },
      { use: 'text', props: { value: B('objective'), role: 'label' }, when: B('objective') },
      { use: 'moments', props: { rows: B('moments'), as: 'toast' } },
    ] }], {}, true),
    ...(G.slots.some((s) => !BODY.includes(s.id)) ? [region('top-right', [{ use: 'each', props: { dir: 'row', rows: B('slots'), row: { use: 'slot', props: { name: I('name'), key: I('key'), count: I('count'), active: I('active'), disabled: I('disabled') } } } }], {}, true)] : []),
    region('bottom-right', [{ use: 'minimap', props: { shape: 'round', scope: true, markers: B('radar'), north: B('north') } }], { when: B('radarOn') }, true),
  ] } };
}

// (what it stands in for is not shown beside it; the layer over the canvas, taking no pointer)
const HOST_CSS = '.moj-hg{position:absolute;inset:0;pointer-events:none;z-index:7}.moj-hg .mana-root{background:none}'
  + '.moj-hud-top-left,.moj-w-legend,.moj-c-radar,.moj-c-gauge,.moj-c-lock{display:none!important}'
  // (and the runtime's bar over a locked foe, where the lock carries the foe's health; a foe targeted with no lock keeps it)
  + 'body:has(.moj-hg .mana-anchors .mana-reticle) .moj-c-ehp{display:none!important}'
  // (a level's passing words off the aim: to the foot's left, on no glow, haloed dark so grass does not eat them)
  + '.moj-hud-center:has(.moj-w-toast){top:auto;bottom:16%;left:7%;transform:none;align-items:flex-start}'
  + '.moj-w-toast{font-size:18px!important;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 6px rgba(0,0,0,.7)!important;color:#fff!important}'
  // (the ring and the lock on no plate; the ring small by the shoulder, harm when nearly spent)
  + '.moj-hg .mana-anchor>*{background:none!important;padding:0!important}'
  + '.moj-hg .mana-anchor .mana-ring{width:34px;height:34px}'
  + '.moj-hg .mana-anchor .mana-charge[data-state=active] .mana-ring::before{background:conic-gradient(var(--mana-harm) calc(var(--r,0) * 1turn),transparent 0)}'
  + '.moj-hg .mana-anchor .mana-reticle{font-size:44px;color:var(--mana-accent)}'
  + '.moj-hg .mana-anchor .mana-bar{width:64px}.moj-hg .mana-anchor .mana-bar .mana-track{width:64px;min-width:0}'
  + '.moj-hg .mana-minimap[data-scope=yes]{width:min(22vh,190px);height:min(22vh,190px)}'
  + '.moj-hg .mana-minimap .mana-marker[data-kind=foe]{color:var(--mana-harm)}.moj-hg .mana-minimap .mana-marker[data-kind=goal]{color:var(--mana-accent)}'
  + '.moj-hg .mana-minimap[data-scope=yes]::after{content:"\\25B2";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px}'
  // (what is held small and quiet in its corner: its keys a caption under it)
  + '.moj-hg .mana-place[data-at=top-right] .mana-slot{transform:scale(.82);transform-origin:top right}'
  // (a game's page shows no viewer's strip (the view cams, wireframe, fly and walk, reverse view, the AI switch) and no
  // corner hint, however it is opened: their keys still answer)
  + '.hud,.hint{display:none!important}';

/** The page's side (inlined by toString): the state, the runtime mounted, a frame's read of the bus and the pilot. */
export function hudGrammarPage(cfg, ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-hg'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { hud: { hearts: cfg.hearts.max, heartsMax: cfg.hearts.max, stamina: 100, spent: false, heading: 0, markers: [], objective: cfg.objective || '', slots: [], moments: [], ring: [], lock: [], radar: [], north: 0, radarOn: false } };
  // (a point of the world on the HUD, 0..1 of its frame, or null behind the camera)
  let pv = null;
  const onScreen = (x, y, z) => { if (typeof camera === 'undefined' || typeof THREE === 'undefined') return null; pv = pv || new THREE.Vector3(); camera.updateMatrixWorld(); pv.set(x, y, z).project(camera); if (pv.z >= 1) return null; const r = (v) => Math.round(v * 1000) / 1000; return { x: r(pv.x * 0.5 + 0.5), y: r(-pv.y * 0.5 + 0.5) }; };
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
    // (to the quarter: a hit takes part of a heart, and the heart shows it)
    if (Number.isFinite(hp)) S.hud.hearts = Math.max(0, Math.min(cfg.hearts.max, Math.ceil((hp / cfg.hearts.per) * 4) / 4));
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
      // (and the player's own pins, a map's: scene/channels/map-channel.js)
      for (const q of window.__mojPins || []) marks.push({ bearing: Math.round((deg(Math.atan2(q[0] - me.transform.pos[0], q[1] - me.transform.pos[1])) % 360 + 360) % 360), kind: 'item' });
      if (JSON.stringify(marks) !== JSON.stringify(S.hud.markers)) S.hud.markers = marks;
      // (its stamina, where it sprints on one: shown while it is spent)
      const max = me.rule && me.rule.stamina ? (me.rule.boostMax || 0) : 0;
      if (max > 0) { const f = Math.max(0, Math.min(1, (me.boost == null ? max : me.boost) / max)); S.hud.stamina = Math.round(f * 100); S.hud.spent = f < 0.995; }
      // the ring by the hero's shoulder while spent, nearly gone in harm; the lock over its foe's head
      const p = me.transform.pos, h = (me.rule && me.rule.collideHeight) || 1.7, sh = S.hud.spent ? onScreen(p[0], p[1], p[2] + h * 0.85) : null;
      const ring = sh ? [{ x: Math.min(0.97, sh.x + 0.045), y: sh.y, value: Math.round(S.hud.stamina / 5) / 20, state: S.hud.stamina < 25 ? 'active' : 'cooling' }] : [];
      if (JSON.stringify(ring) !== JSON.stringify(S.hud.ring)) S.hud.ring = ring;
      // (the lock over its foe's drawn top, as the runtime measures it for its own bar, controllable/index.js __foeTopOf;
      // its health as the runtime keeps a foe's, on its body)
      const L = W.lock, tg = L && L.target ? W.byId[L.target] : null, top = tg ? (typeof __foeTopOf === 'function' ? __foeTopOf(tg) : 1) : 0;
      const tp = tg && tg.transform && !tg.gone && !tg.downed ? onScreen(tg.transform.pos[0], tg.transform.pos[1], tg.transform.pos[2] + top + 0.1) : null;
      const cur = tg ? (tg.body && Number.isFinite(tg.body.hp) ? tg.body.hp : Number.isFinite(tg.hp) ? tg.hp : tg.hpMax) : 0;
      const lock = tp ? [{ id: String(tg.id), x: tp.x, y: tp.y, hp: Math.max(0, cur || 0), hpMax: tg.hpMax || cur || 1 }] : [];
      if (JSON.stringify(lock) !== JSON.stringify(S.hud.lock)) S.hud.lock = lock;
      // the map: the foes awake round the hero and the way on, on a scope that turns with it
      if (cfg.radar) {
        const things = __gRThings(W, me, at), marks = __gRadar(p, me.transform.heading, things, cfg.radar), north = __gBearing(p, me.transform.heading, [p[0], p[1] + 1, 0]);
        S.hud.radarOn = true;
        if (JSON.stringify(marks) !== JSON.stringify(S.hud.radar)) S.hud.radar = marks;
        if (Math.abs(north - S.hud.north) >= 5) S.hud.north = north;
      }
    }
    // (a place card: the name of the place the hero has come into, the weightiest of the lane's cards)
    if (me && cfg.places) { const x = me.transform.pos[0], y = me.transform.pos[1], at = cfg.places.find((p) => x >= p.box[0] && x < p.box[2] && y >= p.box[1] && y < p.box[3]); if (at && at.name !== place) { place = at.name; S.hud.moments = S.hud.moments.concat([{ id: 'p' + (++nth), text: at.name, weight: 'major' }]).slice(-6); } }
    if (GV) {
      S.hud.objective = GV.goal ? GV.goal.say + (Number.isFinite(GV.goal.d) ? ' · ' + GV.goal.d + ' m' : '') : (GV.mode === 'way' ? GV.text : '');
      // (a line said, the opening, a way held: each a card once, on the queue)
      const card = WEIGHT[GV.mode] ? GV.mode + ':' + GV.text : '';
      if (card && card !== said) S.hud.moments = S.hud.moments.concat([{ id: 'g' + (++nth), text: GV.text, weight: WEIGHT[GV.mode] }]).slice(-6);
      said = card;
    }
    const slots = cfg.slots.filter((s) => cfg.body.indexOf(s.id) < 0).map((s) => { const n = s.var ? Number(vars[s.var]) : NaN; return { name: s.name, key: (pad ? s.pad : s.keys) || '', count: Number.isFinite(n) ? String(n) : '', active: s.id === 'weapon', disabled: s.var ? !(n > 0) : false }; });
    if (JSON.stringify(slots) !== JSON.stringify(S.hud.slots)) S.hud.slots = slots;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return { state: S, rt };
}

// (icons the item set has none for: the sprint, the lock, the guard is its shield)
const OWN_ICONS = Object.freeze({
  dash: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  target: '<circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
});
// THE DRESS over the theme: the hearts large, in the theme's accent, on no plate (the world behind them); each slot its
// thing's icon (playscape/ui/item-icons.js, by its `icon` or its name's words) in the theme's ink, its letters not drawn
const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
function dressCss(G) {
  const T = readTheme(G.theme ?? 'greybox').tokens, ink = T.ink, heart = T.accent;
  const svgOf = (id) => (OWN_ICONS[id] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${OWN_ICONS[id]}</svg>` : iconSvg(id));
  const icon = (id) => svgOf(id).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').split('currentColor').join(ink).split('var(--moj-icon-line,rgba(0,0,0,.55))').join(ink).split('stroke-width="1.2"').join('stroke-width="1.6"')
    // (an attribute said twice is an error in an image's XML, where a page's HTML forgave it: the first stands)
    .replace(/(<[a-z]+\b[^>]*?\sstroke-width="[^"]*"[^>]*?)\sstroke-width="[^"]*"/g, '$1');
  return [
    // (a plateless place has no frame of the theme's either: its parts are their own)
    '.moj-hg .mana-region[data-variant=bare],.moj-hg .mana-region[data-variant=bare]::before,.moj-hg .mana-region[data-variant=bare]::after{border:0!important;outline:0!important;background:none!important;box-shadow:none!important}',
    // (the compass no box of its own: its marks on the world, haloed)
    '.moj-hg .mana-compass{background:transparent!important;border:0!important;box-shadow:none!important;border-bottom:2px solid rgba(255,255,255,.85)!important}'
      + '.moj-hg .mana-compass *,.moj-hg .mana-region[data-variant=bare] .mana-text{color:#fff!important;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 5px rgba(0,0,0,.8),0 0 10px rgba(0,0,0,.45)!important}'
      + '.moj-hg .mana-region[data-variant=bare] .mana-text{font-size:17px;letter-spacing:.2px}',
    `.moj-hg .mana-pips[data-shape=heart] .mana-glyphs{color:${heart};font-size:34px;letter-spacing:3px;text-shadow:0 1px 0 rgba(255,255,255,.55),0 2px 6px rgba(0,0,0,.45)}`,
    ...G.slots.map((s) => { const id = s.icon && (ICONS[s.icon] || OWN_ICONS[s.icon]) ? s.icon : iconFor({ key: s.name.toLowerCase(), name: s.name }); return id && (ICONS[id] || OWN_ICONS[id]) ? `.moj-hg .mana-slot[title=${JSON.stringify(s.name)}] .mana-icon{color:transparent;width:70%;height:70%;background:${uri(icon(id))} center/contain no-repeat}` : ''; }),
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
const __gRadar = ${radarMarks.toString()}, __gRThings = ${sceneThings.toString()}, __gBearing = ${hitBearing.toString()};
window.__mojHudGrammar = (${hudGrammarPage.toString()})(${json({ ...G, body: BODY, radar: { ...RADAR, range: 40 } })}, ${manaUiSource()}, ${json(spec)}, ${json(`${manaCss()}\n${themeCss(G0.theme ?? 'greybox')}\n${HOST_CSS}\n${dressCss(G0)}`)});
`;
}
