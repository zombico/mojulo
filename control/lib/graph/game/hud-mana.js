/**
 * A LEVEL'S HUD ROWS ON MANA-UI — the widget language a level writes (`events.hud`, hud-widgets.js) lowered to ONE
 * composition on the game UI runtime (docs/mana-ui.md), drawn by the level page's HUD host
 * (scene/channels/mana-hud.js). The rows keep their meaning and their slots; what changes is who draws them: the
 * theme the game's screens wear, so a level's readouts, its moments and its menus are one look.
 *
 *   hudToMana(rows, { register?, hero? }) → { spec: { hud }, feed: { rows, hero } }
 *     rows      a level's `events.hud` (raw or normalized: normalizing is idempotent)
 *     hero      draw the pilot's own gauges (its health, its sprint) with the rows: true unless said
 *   levelHud(theme, { screen? }) → a level manifest's `manaHud`: { rows: 'events', theme } (the page lowers the level's
 *     rows where it emits them, so a mechanic's rows, merged late, are in)
 *
 * What each row becomes:
 *   readout text → stat · counter → counter (its label's pictogram, where the icon shelf has one) · bar → bar (its
 *   meaning by its name: hp, mp, xp, stamina, shield, boss) · clock → timer
 *   banner → a moment (one on screen at a time, by weight)        toast → a line of its slot's feed, aged by its ttl
 *   legend → words in its slot, for its ttl                        title → stays the carved letters' (title-carve.js)
 * A row's `id` and `when` gate it as they did (the bus vars ui-<id>, ui-<id>-state, phase): the host says which stand.
 * A row's colour is not carried: the theme owns the look.
 *
 * The state the spec binds (the host writes it from the level's bus): v.<k> a var's value · on.<k> whether a gated or
 * timed row stands · lines.<k> a slot's passing lines · moments [] · hero { hp, hpMax, hasHp, stamina, staminaMax, sprints }.
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

export function hudToMana(rows, { register = null, hero = true } = {}) {
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
    } else if (w.kind === 'banner') banners.push({ on: w.on, text: w.text, ...cond(w) });
    else if (w.kind === 'toast') {
      if (!lines[w.slot]) lines[w.slot] = `l${Object.keys(lines).length}`;
      toasts.push({ ...(w.var ? { var: w.var } : { on: w.on }), text: w.text, ttl: w.ttl, line: lines[w.slot], ...cond(w) });
    } else if (w.kind === 'legend') bySlot[w.slot].push({ use: 'text', props: { value: w.text, role: 'label' }, ...gate(w, i, w.ttl || 0) });
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
    regions.push({ use: 'region', props: { at: slot, ...(bare ? { variant: 'bare' } : {}) }, children: kids.length === 1 ? kids : [{ use: 'stack', props: { dir: 'column', gap: 'tight', align }, children: kids }] });
  }
  return { spec: { screens: {}, hud: { use: 'hud', children: regions } }, feed: { rows: { vars, gates, banners, toasts, lines: Object.values(lines) }, ...(hero ? { hero: true } : {}) } };
}

/** A level's `manaHud` in a look (a mana-ui preset's name, a card's, or a theme object): its rows are the level's own. */
export function levelHud(theme, { screen = null } = {}) {
  const base = typeof theme === 'string' && !THEMES[theme] ? cardTheme(theme) : theme ?? 'console';
  const portrait = !!screen && (screen === 'phone' || screen.pole === 'phone' || screen.orientation === 'portrait');
  return { rows: 'events', theme: portrait ? (typeof base === 'string' ? { from: base, distance: 'hand' } : { ...base, distance: 'hand' }) : base };
}
