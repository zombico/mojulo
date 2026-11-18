/**
 * A LEVEL'S HUD ROWS ON MANA-UI — the widget language a level writes (`events.hud`, hud-widgets.js) lowered to ONE
 * composition on the game UI runtime (docs/mana-ui.md), drawn by the level page's HUD host
 * (scene/channels/mana-hud.js). The rows keep their meaning and their slots; what changes is who draws them: the
 * theme the game's screens wear, so a level's readouts, its moments and its menus are one look.
 *
 *   hudToMana(rows, { register?, hero?, touch? }) → { spec: { hud }, feed: { rows, hero } }   (touch: the level is steered
 *                                              by a virtual pad: a legend says the thumbs while the pad is up)
 *     rows      a level's `events.hud` (raw or normalized: normalizing is idempotent)
 *     hero      draw the pilot's own gauges (its health, its sprint) with the rows: true unless said
 *   levelHud(theme, { screen? }) → a level manifest's `manaHud`: { rows: 'events', theme } (the page lowers the level's
 *     rows where it emits them, so a mechanic's rows, merged late, are in)
 *
 * What each row becomes:
 *   readout text → stat · counter → counter (its label's pictogram, where the icon shelf has one) · bar → bar (its
 *   meaning by its name: hp, mp, xp, stamina, shield, boss) · clock → timer
 *   banner → a moment (one on screen at a time, by weight)        toast → a line of its slot's feed, aged by its ttl
 *   button → a button in its slot, tapped: its event raised on the level's bus (the host's act)
 *   legend → words in its slot, for its ttl                        title → stays the carved letters' (title-carve.js)
 * A row's `id` and `when` gate it as they did (the bus vars ui-<id>, ui-<id>-state, phase): the host says which stand.
 * A row's colour is not carried: the theme owns the look.
 *
 * Drawn as a game draws its HUD, not a dashboard (docs/mana-ui.md, "A HUD that reads as a game"): no box over the world
 * (a corner's parts on a scrim, the others bare); the health one long bar in cells at the bottom left with no label and
 * no number (the pilot's own, or the level's row that is the health, folded in), its sprint thin under it and, on a
 * level with a world clock, the slow-motion's charge as a ring beside it; the screen's edge closing in as the health
 * runs out; and, read off the page's own probes, the gun in hand at the bottom right (its wireframe, its rounds as
 * cartridges), the radar as a scope at the top right, the damage ring as arcs and the weapon wheel while it is held
 * open. Each stands only where the page has the thing (gun.on, focus.on, radar.on, ring.on, wheel.open).
 *
 * The state the spec binds (the host writes it from the level's bus): v.<k> a var's value · on.<k> whether a gated or
 * timed row stands · lines.<k> a slot's passing lines · moments [] · hero { hp, hpMax, hasHp, stamina, staminaMax, sprints,
 * rest, peril } · gun { on, name, mode, rounds, size, reserve, reloading, rest } · focus { on, value, state, label } ·
 * radar { on, marks, north } · ring { on, hits } · wheel { open, title, slots }.
 * Pure: a spec is data.
 */
import { normalizeHud, HUD_SLOTS } from './hud-widgets.js';
import { iconOf } from '../../mana-ui/icons.js';
import { THEMES } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';

const B = (path) => ({ bind: path });
// a bar's meaning, read off what it is called
const MEANS = [[/^(hp|health|life|lives|hull)$/, 'hp'], [/^(mp|mana|magic|energy)$/, 'mp'], [/^(xp|exp|experience)$/, 'xp'], [/^(stamina|boost|sprint|breath|fuel)$/, 'stamina'], [/^(shield|armou?r|guard)$/, 'shield'], [/^boss/, 'boss']];
// money, read off what a counter is called (a coin, cash, gold): drawn as money
const MONEY = /^(coins?|cash|money|gold|dollars?|credits?|bucks)$/i;
const meaningOf = (w) => { for (const name of [w.var, w.label]) { const k = String(name ?? '').toLowerCase().trim(); for (const [re, v] of MEANS) if (re.test(k)) return v; } return 'plain'; };

export function hudToMana(rows, { register = null, hero = true, touch = false } = {}) {
  const { widgets } = normalizeHud(Array.isArray(rows) ? rows : [], register ? { register } : {});
  const vars = {}, keyOf = new Map(), gates = [], banners = [], toasts = [], lines = {};
  const varKey = (name) => { if (!keyOf.has(name)) { const k = `v${keyOf.size}`; keyOf.set(name, k); vars[k] = name; } return keyOf.get(name); };
  const bySlot = Object.fromEntries(HUD_SLOTS.map((s) => [s, []]));
  // a row that is gated (a part's id, its phases) or timed stands while the host says so
  const gate = (w, i, ttl = 0) => { if (!w.id && !w.when && !ttl) return {}; const k = `r${i}`; gates.push({ k, ...(w.id ? { id: w.id } : {}), ...(w.when ? { when: w.when } : {}), ...(ttl ? { ttl } : {}) }); return { when: B(`on.${k}`) }; };
  const cond = (w) => ({ ...(w.id ? { id: w.id } : {}), ...(w.when ? { when: w.when } : {}) });
  let hpRow = false, hpStrip = null;
  widgets.forEach((w, i) => {
    if (w.kind === 'readout') {
      const value = B(`v.${varKey(w.var)}`), label = w.label ?? '';
      // (the row that is the health becomes the health strip, the pilot's own drawn by it: one health on the screen)
      if (hero && !hpStrip && meaningOf(w) === 'hp') { hpStrip = { gate: gate(w, i), value, max: w.as === 'bar' && w.max !== undefined ? (typeof w.max === 'string' ? B(`v.${varKey(w.max)}`) : w.max) : B(`top.${varKey(w.var)}`), k: varKey(w.var) }; hpRow = true; return; }
      if (w.as === 'bar') {
        const variant = meaningOf(w); if (variant === 'hp') hpRow = true;
        bySlot[w.slot].push({ use: 'bar', props: { value, max: typeof w.max === 'string' ? B(`v.${varKey(w.max)}`) : w.max, ...(variant !== 'plain' ? { variant } : {}), ...(label ? { label } : {}) }, ...gate(w, i) });
      } else if (w.as === 'stars') bySlot[w.slot].push({ use: 'pips', props: { value, max: w.max, shape: 'star', ...(label ? { label } : {}) }, ...gate(w, i) });
      else if (w.as === 'clock') bySlot[w.slot].push({ use: 'timer', props: { seconds: value, ...(label ? { label } : {}) }, ...gate(w, i) });
      // (money is a coin and a figure, never the word beside a number: the shape is the label)
      else if (w.as === 'counter' && MONEY.test(String(label || w.var).trim())) bySlot[w.slot].push({ use: 'counter', props: { label: '', value, icon: 'coin' }, ...gate(w, i) });
      else if (w.as === 'counter') { const icon = iconOf(label) ?? iconOf(w.var); bySlot[w.slot].push({ use: 'counter', props: { label, value, ...(icon ? { icon } : {}) }, ...gate(w, i) }); }
      else bySlot[w.slot].push({ use: 'stat', props: { label, value }, ...gate(w, i) });
    } else if (w.kind === 'banner') banners.push({ on: w.on, text: w.text, ...cond(w) });
    else if (w.kind === 'toast') {
      if (!lines[w.slot]) lines[w.slot] = `l${Object.keys(lines).length}`;
      toasts.push({ ...(w.var ? { var: w.var } : { on: w.on }), text: w.text, ttl: w.ttl, line: lines[w.slot], ...cond(w) });
    } else if (w.kind === 'button') {
      // (a button: tapped or clicked, it raises its event on the level's bus; the HUD's host carries the effect there)
      // (a keyed one presses its key; one for a touch screen alone stands while the virtual pad does)
      bySlot[w.slot].push({ use: 'button', props: { label: w.label }, on: { accept: w.key ? { key: w.key, code: w.code } : { emit: w.press } }, ...(w.touch ? { when: B('touch.on') } : gate(w, i)) });
    } else if (w.kind === 'legend') {
      const keys = { use: 'text', props: { value: w.text, role: 'label' } };
      // (a level steered by a virtual pad, `touch`: while the pad is up the line says what the thumbs do, not the keys)
      bySlot[w.slot].push(touch ? { use: 'stack', props: { gap: 'tight' }, ...gate(w, i, w.ttl || 0), children: [{ ...keys, unless: B('touch.on') }, { use: 'text', props: { value: B('touch.hint'), role: 'label' }, when: B('touch.on') }] } : { ...keys, ...gate(w, i, w.ttl || 0) });
    }
    // (a title is carved letters in the scene: the title channel's, as before)
  });
  const regions = [], layers = [];
  for (const slot of HUD_SLOTS) {
    const kids = [...bySlot[slot], ...(lines[slot] ? [{ use: 'feed', props: { rows: B(`lines.${lines[slot]}`), max: 6 } }] : []), ...(slot === 'center' && banners.length ? [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 1.6, read: 0.4 } }] : [])];
    if (!kids.length) continue;
    // (no box over the world: a corner's parts on a scrim, the rest bare with the halo)
    const align = slot.endsWith('left') ? 'start' : slot.endsWith('right') ? 'end' : 'center', corner = slot.includes('-');
    regions.push({ use: 'region', props: { at: slot, variant: corner ? 'scrim' : 'bare' }, children: kids.length === 1 ? kids : [{ use: 'stack', props: { dir: 'column', gap: 'tight', align }, children: kids }] });
  }
  if (hero) {
    // THE PILOT, at the bottom left: the health a strip in cells (the level's health row folded in, else its own), its
    // sprint thin under it, the slow-motion's charge beside them; resting while full
    const hp = hpStrip ? { value: hpStrip.value, max: hpStrip.max } : { value: B('hero.hp'), max: B('hero.hpMax') };
    regions.unshift({ use: 'region', props: { at: 'bottom-left', variant: 'scrim', rest: B('hero.rest') }, children: [{ use: 'stack', props: { dir: 'row', gap: 'normal', align: 'center' }, children: [
      { use: 'charge', props: { value: B('focus.value'), state: B('focus.state'), icon: 'clock', label: B('focus.label') }, when: B('focus.on') },
      { use: 'stack', props: { gap: 'tight' }, children: [
        { use: 'bar', props: { ...hp, variant: 'hp', segments: 4, size: 'large', figures: false }, ...(hpStrip ? hpStrip.gate : { when: B('hero.hasHp') }) },
        { use: 'bar', props: { value: B('hero.stamina'), max: B('hero.staminaMax'), variant: 'stamina', size: 'thin', figures: false }, when: B('hero.sprints') },
      ] },
    ] }] });
    // THE GUN IN HAND, at the bottom right: its wireframe, its rounds as cartridges; resting while full
    regions.push({ use: 'region', props: { at: 'bottom-right', variant: 'scrim', rest: B('gun.rest') }, when: B('gun.on'), children: [{ use: 'magazine', props: { name: B('gun.name'), mode: B('gun.mode'), rounds: B('gun.rounds'), size: B('gun.size'), reserve: B('gun.reserve'), reloading: B('gun.reloading') } }] });
    // THE RADAR, a scope at the top right (where the page's stood), and the wheel while it is held open
    regions.push({ use: 'region', props: { at: 'top-right', variant: 'bare' }, when: B('radar.on'), children: [{ use: 'minimap', props: { shape: 'round', scope: true, markers: B('radar.marks'), north: B('radar.north') } }] });
    regions.push({ use: 'region', props: { at: 'center', variant: 'bare' }, when: B('wheel.open'), children: [{ use: 'wheel', props: { rows: B('wheel.slots'), title: B('wheel.title') } }] });
    // the screen's edge, closing in as the health runs out; where a hit came from, as arcs round the aim
    layers.push({ use: 'peril', props: { level: B('hero.peril') } }, { use: 'threat', props: { markers: B('ring.hits') }, when: B('ring.on') });
  }
  return { spec: { screens: {}, hud: { use: 'hud', children: [...layers, ...regions] } }, feed: { rows: { vars, gates, banners, toasts, lines: Object.values(lines) }, ...(hero ? { hero: true, ...(hpStrip ? { hpVar: hpStrip.k } : {}) } : {}) } };
}

/** A level's `manaHud` in a look (a mana-ui preset's name, a card's, or a theme object): its rows are the level's own. */
export function levelHud(theme, { screen = null } = {}) {
  const base = typeof theme === 'string' && !THEMES[theme] ? cardTheme(theme) : theme ?? 'console';
  const portrait = !!screen && (screen === 'phone' || screen.pole === 'phone' || screen.orientation === 'portrait');
  return { rows: 'events', theme: portrait ? (typeof base === 'string' ? { from: base, distance: 'hand' } : { ...base, distance: 'hand' }) : base };
}
