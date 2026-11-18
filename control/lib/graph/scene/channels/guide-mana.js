/**
 * THE GUIDE ON MANA-UI: what the level says and the way on (scene/channels/guide.js: its intro, its lessons, the one
 * thing to do next) drawn by the game UI runtime in the game's look, where the level's guide asks for it (`mana: true`,
 * a played city's: gameworld/city-guide.js) and the page has a mana HUD. The guide still DECIDES (one thing at a time,
 * `window.__mojGuide.view()`) and still plants its pillar of light; this DRAWS, and the guide's own line stays down:
 *
 *   top      a compass strip turned to where the camera looks, the goal's bearing on it; under it the objective with
 *            its metres; a lesson's keys as key caps with what they do, and its place in the run; what is said (the
 *            opening, a line on reaching a stop) as a card, one at a time by weight
 *   bottom   THE KEYS THAT WORK NOW, as key caps: on foot or at the wheel, and the screens the page has (the map, the
 *            bag, the journal). The level's own line of key words is not drawn beside it. They speak when what can be
 *            done changes (a car in reach, the wheel taken, a call on the phone) and step away after a few seconds
 *            (docs/mana-ui.md: a HUD speaks when something changes)
 *   bottom right  THE RIDE, as a car is taken: its name large, said once and gone, as an open-world game names what
 *            you just got into
 *   The objective is an order (a mark, what to do, how far), never a checklist.
 *
 * It reads no device and holds no focus. Emitted only where asked: absent, not one byte.
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const B = (p) => ({ bind: `guide.${p}` });
const region = (at, children) => ({ use: 'region', props: { at, variant: 'bare' }, children });

/** The spec it draws. */
export function guideManaSpec() {
  return { screens: {}, hud: { use: 'hud', children: [
    region('top', [{ use: 'stack', props: { gap: 'tight', align: 'center' }, children: [
      { use: 'compass', props: { heading: B('heading'), markers: B('markers') }, when: B('finding') },
      { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, when: B('objective'), children: [{ use: 'text', props: { value: '◆', role: 'label' } }, { use: 'text', props: { value: B('objective'), role: 'label' } }] },
      { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, when: B('teaching'), children: [{ use: 'text', props: { value: B('lessonAt'), role: 'caption' } }, { use: 'legend', props: { rows: B('lesson') } }] },
      { use: 'moments', props: { rows: B('cards'), as: 'toast' } },
    ] }]),
    { use: 'region', props: { at: 'bottom', variant: 'bare' }, children: [{ use: 'legend', props: { rows: B('keys') }, unless: B('rest') }] },
    { use: 'region', props: { at: 'bottom-right', variant: 'bare' }, when: B('ride.on'), children: [{ use: 'stack', props: { gap: 'tight', align: 'end' }, children: [{ use: 'text', props: { value: B('ride.name'), role: 'display' } }, { use: 'text', props: { value: B('ride.sub'), role: 'caption' }, when: B('ride.sub') }] }] },
  ] } };
}
const GM_CSS = '.moj-gm{position:absolute;inset:0;pointer-events:none;z-index:7}.moj-gm .mana-root{background:none}'
  // (plateless over the world, as the HUD grammar's navigation is: its marks and words haloed)
  + '.moj-gm .mana-region[data-variant=bare],.moj-gm .mana-region[data-variant=bare]::before,.moj-gm .mana-region[data-variant=bare]::after{border:0!important;outline:0!important;background:none!important;box-shadow:none!important}'
  + '.moj-gm .mana-compass{background:transparent!important;border:0!important;box-shadow:none!important;border-bottom:2px solid rgba(255,255,255,.85)!important}'
  + '.moj-gm .mana-compass *,.moj-gm .mana-region[data-variant=bare] .mana-text,.moj-gm .mana-region[data-variant=bare] .mana-legend{color:#fff!important;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 5px rgba(0,0,0,.8),0 0 10px rgba(0,0,0,.45)!important}'
  + '.moj-gm .mana-region[data-variant=bare] .mana-text{font-size:17px;letter-spacing:.2px}'
  // (the ride's name large and leaning, as a title card, in and gone)
  + '.moj-gm .mana-place[data-at=bottom-right] .mana-text[data-role=display]{font-size:58px;font-style:italic;letter-spacing:-.5px;line-height:1;animation:moj-gm-ride 3.2s ease-out both}'
  + '@keyframes moj-gm-ride{0%{opacity:0;transform:translateX(24px)}12%,78%{opacity:1;transform:none}100%{opacity:0}}';

/** A key line as legend rows: 'W A S D  walk · E  get in' → [{ actions: ['W','A','S','D'], label: 'walk' }, { action: 'E', label: 'get in' }]. */
export function keyRows(line) {
  return String(line || '').split(' · ').map((part) => { const i = part.indexOf('  '); if (i < 0) return null; const keys = part.slice(0, i).split(' ').filter(Boolean), label = part.slice(i + 2).trim(); return keys.length === 1 ? { action: keys[0], label } : { actions: keys, label }; }).filter(Boolean);
}

/** The page's side (inlined by toString): the runtime mounted, a frame's read of the guide and the pilot. */
export function guideManaPage(ui, spec, css, rowsOf) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-gm'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { guide: { heading: 0, markers: [], objective: '', finding: false, teaching: false, lesson: [], lessonAt: '', cards: [], keys: [], rest: false, ride: { on: false, name: '', sub: '' } } };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  rt.input('keys');
  ui.mount(root, rt, { auto: true });
  window.__mojGuideHost = true;
  const WEIGHT = { intro: 'major', held: 'normal', say: 'normal' }, deg = (r) => r * 180 / Math.PI;
  let said = '', nth = 0, view = null, cards = [], sig = '', keySig = '', keyT = 0, rideOf = null, rideT = -1e9;
  // (a car's name as it is said: 'midSuv' → 'Mid SUV')
  const nameOf = (v) => String(v || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\bsuv\b/ig, 'SUV').replace(/^./, (c) => c.toUpperCase());
  (function tick() {
    requestAnimationFrame(tick);
    const GD = window.__mojGuide, GV = GD && GD.view ? GD.view() : null, C = window.__mojCtrl, W = C && C.world, me = W && W.pilotId ? W.byId[W.pilotId] : null;
    if (!GV || !me) return;
    let yaw = me.transform.heading;
    if (typeof camera !== 'undefined' && typeof THREE !== 'undefined') { view = view || new THREE.Vector3(); camera.getWorldDirection(view); yaw = Math.atan2(view.y, view.x); }
    const heading = Math.round(((90 - deg(yaw)) % 360 + 360) % 360), goal = GV.goal;
    const finding = !!goal && (GV.mode === 'way' || GV.mode === 'say');
    const markers = finding ? [{ bearing: Math.round((deg(Math.atan2(goal.at[0] - me.transform.pos[0], goal.at[1] - me.transform.pos[1])) % 360 + 360) % 360), kind: 'goal' }] : [];
    const objective = GV.mode === 'way' ? (goal ? goal.say + (Number.isFinite(goal.d) ? ' · ' + goal.d + ' m' : '') : GV.text) : '';
    // (a line said, the opening, a way held: each a card once, on the queue)
    const card = WEIGHT[GV.mode] ? GV.mode + ':' + GV.text : '';
    if (card && card !== said) cards = cards.concat([{ id: 'g' + (++nth), text: GV.text, weight: WEIGHT[GV.mode] }]).slice(-6);
    said = card;
    const teaching = GV.mode === 'keys' && GV.keys.length > 0, lesson = teaching ? GV.keys.reduce((a, l) => a.concat(rowsOf(l)), []) : [];
    const lessonAt = teaching && GD.lessons ? Math.min(GD.lessons, GD.lesson() + 1) + ' / ' + GD.lessons : '';
    // the keys that work now: on foot or at the wheel, and the screens this page has
    const cab = !!(me.mount && me.mount.cab), near = !cab && (W.trafficOffer || W.entities.some((e) => e.mount && e.mount.cab && !e.gone && !e.riderId && Math.hypot(e.transform.pos[0] - me.transform.pos[0], e.transform.pos[1] - me.transform.pos[1]) < (e.mount.reach || 2.6)));
    const keys = (cab ? [{ action: 'W', label: 'Drive' }, { action: 'S', label: 'Brake' }, { actions: ['A', 'D'], label: 'Steer' }, { action: 'E', label: 'Get out' }] : [{ actions: ['W', 'A', 'S', 'D'], label: 'Move' }, { action: 'Space', label: 'Jump' }].concat(near ? [{ action: 'E', label: 'Get in' }] : [], me.rule && me.rule.strikeContact ? [{ action: 'Click', label: 'Strike' }] : []))
      .concat(window.__mojMap ? [{ action: 'M', label: 'Map' }] : [], window.__mojBag ? [{ action: 'I', label: 'Bag' }] : [], window.__mojPhone ? [{ action: 'P', label: window.__mojPhone.unread() ? 'Phone (' + window.__mojPhone.unread() + ')' : 'Phone' }] : [], window.__mojQuests ? [{ action: 'J', label: 'Journal' }] : []);
    // (the keys speak as they change, then rest; the ride is named as it is taken, for a few seconds)
    const now = performance.now() / 1000, ks = JSON.stringify(keys);
    if (ks !== keySig) { keySig = ks; keyT = now; }
    const rest = now - keyT > 6, car = cab && me.rule && me.rule.vehicle ? me.id : null;
    if (car !== rideOf) { rideOf = car; if (car) rideT = now; }
    const ride = car && now - rideT < 3.2 ? { on: true, name: nameOf(me.rule.vehicle), sub: me.rule.tuning === 'arcade' ? '' : (me.rule.tuning || '') } : { on: false, name: '', sub: '' };
    const next = JSON.stringify([heading, markers, objective, finding, teaching, lesson, lessonAt, cards.length, keys, rest, ride.on]);
    if (next === sig) return;
    sig = next;
    S.guide = { heading, markers, objective, finding, teaching, lesson, lessonAt, cards, keys, rest, ride };
  })();
  return { state: S, rt };
}

/** The page's script. `theme`: the look the level's HUD wears; `shared`: the page's one runtime (scene-three's prelude). */
export function guideManaScript(theme = null, { shared = null } = {}) {
  const spec = guideManaSpec();
  manaUi.readSpec(spec);
  return `
// THE GUIDE on mana-ui (scene/channels/guide-mana.js): the compass, the objective, a lesson's keys, what is said; the keys that work now
window.__mojGuideMana = (${guideManaPage.toString()})(${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? GM_CSS : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n${GM_CSS}`)}, ${keyRows.toString()});
`;
}
