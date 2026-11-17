/**
 * A LEVEL'S HUD ROWS ON MANA-UI — the widget language a level writes (`events.hud`, hud-widgets.js) lowered to ONE
 * composition on the game UI runtime (docs/mana-ui.md), drawn by the level page's HUD host
 * (scene/channels/mana-hud.js). The rows keep their meaning and their slots; what changes is who draws them: the
 * theme the game's screens wear, so a level's readouts, its moments and its menus are one look.
 *
 *   hudToMana(rows, { register?, hero?, touch?, style? }) → { spec: { hud }, feed: { rows, hero } }   (touch: the level is
 *                                              steered by a virtual pad: a legend says the thumbs while the pad is up;
 *                                              style: the level carries a style meter, drawn at the right: its tier
 *                                              and the combo; feed.style says the host feeds it; immersive: the HUD
 *                                              of a stylish action game, below: said with the meter unless said not)
 *
 * THE IMMERSIVE HUD (a stylish action game's): NO BOX IS DRAWN. Every region sits on no plate (`bare`): what stands on
 * the screen is letters and figures over the play, haloed, and what changes is said by effects and motion on them (a
 * figure pops as it changes), never by a frame. NO EXPLAINING WORDS: a legend row, a banner and a toast are not drawn
 * (a carved title stays: letters with motion are the principle's own) and a readout carries no caption the play does
 * not need; a mark or an arrow says where to go. feed.immersive says the host dresses the page's own parts to match.
 *     rows      a level's `events.hud` (raw or normalized: normalizing is idempotent)
 *     hero      draw the pilot's own gauges (its health, its sprint) with the rows: true unless said
 *   levelHud(theme, { screen?, style?, ways? }) → a level manifest's `manaHud`: { rows: 'events', theme, style?, ways? }
 *     ways      { var, at: [[x, y, z] | null, …] }: the way on, an arrow toward the place a bus var names by its index
 *               (none while it names none); the page's HUD host draws it (the page lowers the level's
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
 * The state the spec binds (the host writes it from the level's bus): v.<k> a var's value · on.<k> whether a gated or
 * timed row stands · lines.<k> a slot's passing lines · moments [] · hero { hp, hpMax, hasHp, stamina, staminaMax, sprints } · style { on, name, combo }.
 * Pure: a spec is data.
 */
import { normalizeHud, HUD_SLOTS } from './hud-widgets.js';
import { iconOf } from '../../mana-ui/icons.js';
import { THEMES } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';

const B = (path) => ({ bind: path });
// a bar's meaning, read off what it is called
const MEANS = [[/^(hp|health|life|lives|hull)$/, 'hp'], [/^(mp|mana|magic|energy)$/, 'mp'], [/^(xp|exp|experience)$/, 'xp'], [/^(stamina|boost|sprint|breath|fuel)$/, 'stamina'], [/^(shield|armou?r|guard)$/, 'shield'], [/^boss/, 'boss']];
const meaningOf = (w) => { for (const name of [w.var, w.label]) { const k = String(name ?? '').toLowerCase().trim(); for (const [re, v] of MEANS) if (re.test(k)) return v; } return 'plain'; };

export function hudToMana(rows, { register = null, hero = true, touch = false, style = false, immersive = style } = {}) {
  const { widgets } = normalizeHud(Array.isArray(rows) ? rows : [], register ? { register } : {});
  const vars = {}, keyOf = new Map(), gates = [], banners = [], toasts = [], lines = {};
  const varKey = (name) => { if (!keyOf.has(name)) { const k = `v${keyOf.size}`; keyOf.set(name, k); vars[k] = name; } return keyOf.get(name); };
  const bySlot = Object.fromEntries(HUD_SLOTS.map((s) => [s, []]));
  // a row that is gated (a part's id, its phases) or timed stands while the host says so
  const gate = (w, i, ttl = 0) => { if (!w.id && !w.when && !ttl) return {}; const k = `r${i}`; gates.push({ k, ...(w.id ? { id: w.id } : {}), ...(w.when ? { when: w.when } : {}), ...(ttl ? { ttl } : {}) }); return { when: B(`on.${k}`) }; };
  const cond = (w) => ({ ...(w.id ? { id: w.id } : {}), ...(w.when ? { when: w.when } : {}) });
  let hpRow = false;
  widgets.forEach((w, i) => {
    if (w.kind === 'readout') {
      const value = B(`v.${varKey(w.var)}`), label = w.label ?? '';
      if (w.as === 'bar') {
        const variant = meaningOf(w); if (variant === 'hp') hpRow = true;
        bySlot[w.slot].push({ use: 'bar', props: { value, max: typeof w.max === 'string' ? B(`v.${varKey(w.max)}`) : w.max, ...(variant !== 'plain' ? { variant } : {}), ...(label ? { label } : {}) }, ...gate(w, i) });
      } else if (w.as === 'clock') bySlot[w.slot].push({ use: 'timer', props: { seconds: value, ...(label ? { label } : {}) }, ...gate(w, i) });
      else if (w.as === 'counter') { const icon = iconOf(label) ?? iconOf(w.var); bySlot[w.slot].push({ use: 'counter', props: { label, value, ...(icon ? { icon } : {}) }, ...gate(w, i) }); }
      else bySlot[w.slot].push({ use: 'stat', props: { label, value }, ...gate(w, i) });
    } else if (immersive && (w.kind === 'banner' || w.kind === 'toast')) return;   // (no passing words either: the play says it)
    else if (w.kind === 'banner') banners.push({ on: w.on, text: w.text, ...cond(w) });
    else if (w.kind === 'toast') {
      if (!lines[w.slot]) lines[w.slot] = `l${Object.keys(lines).length}`;
      toasts.push({ ...(w.var ? { var: w.var } : { on: w.on }), text: w.text, ttl: w.ttl, line: lines[w.slot], ...cond(w) });
    } else if (w.kind === 'button') {
      // (a button: tapped or clicked, it raises its event on the level's bus; the HUD's host carries the effect there)
      // (a keyed one presses its key; one for a touch screen alone stands while the virtual pad does)
      bySlot[w.slot].push({ use: 'button', props: { label: w.label }, on: { accept: w.key ? { key: w.key, code: w.code } : { emit: w.press } }, ...(w.touch ? { when: B('touch.on') } : gate(w, i)) });
    } else if (w.kind === 'legend') {
      if (immersive) return;   // (the immersive HUD says nothing in words that the play shows)
      const keys = { use: 'text', props: { value: w.text, role: 'label' } };
      // (a level steered by a virtual pad, `touch`: while the pad is up the line says what the thumbs do, not the keys)
      bySlot[w.slot].push(touch ? { use: 'stack', props: { gap: 'tight' }, ...gate(w, i, w.ttl || 0), children: [{ ...keys, unless: B('touch.on') }, { use: 'text', props: { value: B('touch.hint'), role: 'label' }, when: B('touch.on') }] } : { ...keys, ...gate(w, i, w.ttl || 0) });
    }
    // (a title is carved letters in the scene: the title channel's, as before)
  });
  // the pilot's own gauges lead the top-left: its health (unless a row is already the health), its sprint
  const own = hero ? [...(hpRow ? [] : [{ use: 'bar', props: { value: B('hero.hp'), max: B('hero.hpMax'), variant: 'hp', label: 'HP' }, when: B('hero.hasHp') }]), { use: 'bar', props: { value: B('hero.stamina'), max: B('hero.staminaMax'), variant: 'stamina', figures: false }, when: B('hero.sprints') }] : [];
  bySlot['top-left'] = [...own, ...bySlot['top-left']];
  const regions = [];
  for (const slot of HUD_SLOTS) {
    const kids = [...bySlot[slot], ...(lines[slot] ? [{ use: 'feed', props: { rows: B(`lines.${lines[slot]}`), max: 6 } }] : []), ...(slot === 'center' && banners.length ? [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 1.6, read: 0.4 } }] : [])];
    if (!kids.length) continue;
    const align = slot.endsWith('left') ? 'start' : slot.endsWith('right') ? 'end' : 'center', bare = kids.every((k) => k.use === 'feed' || k.use === 'moments');
    regions.push({ use: 'region', props: { at: slot, ...(bare || immersive ? { variant: 'bare' } : {}) }, children: kids.length === 1 ? kids : [{ use: 'stack', props: { dir: 'column', gap: 'tight', align }, children: kids }] });
  }
  // THE STYLE METER (worlds/controllable/style.js), where the level carries one: at the right, on no plate, in letters
  // alone: its tier's name, and under it the combo's count while there is one (each blow pops it); it stands while
  // there is style to show
  if (style) regions.push({ use: 'region', props: { at: 'right', variant: 'bare' }, when: B('style.on'), children: [{ use: 'stack', props: { gap: 'tight', align: 'end' }, children: [
    { use: 'text', props: { value: B('style.name'), role: 'numeral' } },   // (a numeral: marked as it changes, so the host's motion plays)
    { use: 'text', props: { value: B('style.combo'), role: 'numeral' }, when: B('style.combo') },
  ] }] });
  return { spec: { screens: {}, hud: { use: 'hud', children: regions } }, feed: { rows: { vars, gates, banners, toasts, lines: Object.values(lines) }, ...(hero ? { hero: true } : {}), ...(style ? { style: true } : {}), ...(immersive ? { immersive: true } : {}) } };
}

/** A level's `manaHud` in a look (a mana-ui preset's name, a card's, or a theme object): its rows are the level's own. */
export function levelHud(theme, { screen = null, style = false, ways = null } = {}) {
  const base = typeof theme === 'string' && !THEMES[theme] ? cardTheme(theme) : theme ?? 'console';
  const portrait = !!screen && (screen === 'phone' || screen.pole === 'phone' || screen.orientation === 'portrait');
  return { rows: 'events', theme: portrait ? (typeof base === 'string' ? { from: base, distance: 'hand' } : { ...base, distance: 'hand' }) : base, ...(style ? { style: true } : {}), ...(ways ? { ways } : {}) };
}
