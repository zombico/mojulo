/**
 * ITEM ICONS — the flat 24 px icons a menu draws an item by (the world draws it by its glyph, game/glyph-forms.js). Each
 * is SVG drawn in `currentColor` (the fill) with a darker line (`--moj-icon-line`), so the UI guide's tokens and a kind's
 * colour dress it; nothing here names a colour.
 *
 *   ICONS            { <id>: '<svg inner markup>' } every glyph form, and the things menus hold besides
 *   ICON_IDS
 *   iconFor(item)    the item's icon id: its own (play.items[…].icon), else one guessed from its words, else its glyph
 *                    form, else 'item'
 *   iconSvg(id)      the whole <svg>, sized by its box (the menu's tile)
 */
const L = 'stroke="var(--moj-icon-line,rgba(0,0,0,.55))" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"';

export const ICONS = Object.freeze({
  item: `<rect x="5" y="7" width="14" height="12" rx="2" fill="currentColor" ${L}/><path d="M5 11h14M10 11v3h4v-3" fill="none" ${L}/>`,
  gem: `<path d="M7 4h10l4 5-9 11L3 9z" fill="currentColor" ${L}/><path d="M3 9h18M9 4l3 5 3-5M12 9v11" fill="none" ${L}/>`,
  coin: `<circle cx="12" cy="12" r="8" fill="currentColor" ${L}/><circle cx="12" cy="12" r="5" fill="none" ${L}/>`,
  key: `<path d="M11 10.5h10v3h-2v3h-2.5v-3H11z" fill="currentColor" ${L}/><circle cx="7.5" cy="12" r="4.5" fill="currentColor" ${L}/><circle cx="7.5" cy="12" r="1.6" fill="var(--moj-icon-line,rgba(0,0,0,.55))"/>`,
  heart: `<path d="M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15 12 20 12 20z" fill="currentColor" ${L}/>`,
  star: `<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" ${L}/>`,
  orb: `<circle cx="12" cy="12" r="8" fill="currentColor" ${L}/><path d="M8 9a4.5 4.5 0 0 1 4-2.5" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6" stroke-linecap="round"/>`,
  flag: `<path d="M6 21V3" fill="none" ${L} stroke-width="2"/><path d="M6 4h12l-3 4 3 4H6z" fill="currentColor" ${L}/>`,
  skull: `<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.4V20h9v-4.1c1.7-1 3-2.8 3-5.4A7.5 7.5 0 0 0 12 3z" fill="currentColor" ${L}/><circle cx="9" cy="11" r="1.6" fill="var(--moj-icon-line,rgba(0,0,0,.55))"/><circle cx="15" cy="11" r="1.6" fill="var(--moj-icon-line,rgba(0,0,0,.55))"/>`,
  potion: `<path d="M10 3h4v5l4.5 7.5A3 3 0 0 1 16 20H8a3 3 0 0 1-2.5-4.5L10 8z" fill="currentColor" ${L}/><path d="M9 3h6M7 14h10" fill="none" ${L}/>`,
  sword: `<path d="M20.5 3.5L21 3l-.5 4.5-9 9-3-3 9-9z" fill="currentColor" ${L}/><path d="M6 12.5l5.5 5.5-1.5 1.5-5.5-5.5z" fill="currentColor" ${L}/><path d="M7.5 16.5L4 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="3.6" cy="20.4" r="1.4" fill="currentColor" ${L}/>`,
  cloak: `<path d="M8 3h8l1 3 3 15H4L7 6z" fill="currentColor" ${L}/><path d="M9 3c0 3 6 3 6 0M12 6v15" fill="none" ${L}/>`,
  armor: `<path d="M8 3l4 2 4-2 4 3-2 4v10H6V10L4 6z" fill="currentColor" ${L}/><path d="M12 5v15M6 10h12" fill="none" ${L}/>`,
  helmet: `<path d="M4 15a8 8 0 0 1 16 0v3H4z" fill="currentColor" ${L}/><path d="M12 7v11M8 15h8" fill="none" ${L}/>`,
  shield: `<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" fill="currentColor" ${L}/><path d="M12 6v12" fill="none" ${L}/>`,
  bow: `<path d="M6 3c8 3 8 15 0 18" fill="none" ${L} stroke-width="2.2"/><path d="M6 3v18M4 12h16M17 9l3 3-3 3" fill="none" ${L}/>`,
  staff: `<path d="M7 21L17 7" fill="none" ${L} stroke-width="2.2"/><circle cx="18" cy="6" r="3" fill="currentColor" ${L}/>`,
  scroll: `<path d="M7 4h10a2 2 0 0 1 2 2v12H9a2 2 0 0 1-2-2z" fill="currentColor" ${L}/><path d="M5 6a2 2 0 0 1 2-2v12a2 2 0 1 1-2-2zM10 8h6M10 11h6M10 14h4" fill="none" ${L}/>`,
  candle: `<rect x="9" y="9" width="6" height="11" rx="1" fill="currentColor" ${L}/><path d="M12 3c2 2 1.6 4 0 5-1.6-1-2-3 0-5z" fill="#ffc94d" ${L}/>`,
  food: `<path d="M12 7c4-2 8 0 8 5s-4 9-8 8c-4 1-8-3-8-8s4-7 8-5z" fill="currentColor" ${L}/><path d="M12 7c0-2 1-3 3-4" fill="none" ${L}/>`,
  ring: `<circle cx="12" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 6l2-3 2 3-2 2z" fill="currentColor" ${L}/>`,
  bomb: `<circle cx="11" cy="14" r="7" fill="currentColor" ${L}/><path d="M15 8l2-2M17 6c1-1 2-1 3 0" fill="none" ${L}/>`,
  bag: `<path d="M6 9h12l1 11H5z" fill="currentColor" ${L}/><path d="M9 9V7a3 3 0 0 1 6 0v2" fill="none" ${L}/>`,
});
export const ICON_IDS = Object.keys(ICONS);

// words an item's id may carry → its icon (the first that matches); an id with none falls to its glyph form
const WORDS = [
  [/potion|tonic|elixir|draught|vial|flask/, 'potion'], [/sword|blade|dagger|sabre|saber|knife|katana/, 'sword'],
  [/shield|buckler/, 'shield'], [/cloak|cape|robe|mantle/, 'cloak'], [/armou?r|mail|vest|coat|plate|tunic/, 'armor'],
  [/helm|helmet|hat|hood|crown|cap\b/, 'helmet'], [/bow|crossbow/, 'bow'], [/staff|wand|rod/, 'staff'], [/scroll|map|letter|note|book|page/, 'scroll'],
  [/candle|torch|lamp|lantern|oil/, 'candle'], [/apple|bread|ration|food|meat|berry|herb|mushroom|fish/, 'food'],
  [/ring|amulet|necklace|charm/, 'ring'], [/bomb|grenade|powder/, 'bomb'], [/bag|pouch|sack|satchel/, 'bag'],
  [/coin|gold|money|cash|token|shell|scrip/, 'coin'], [/gem|crystal|jewel|diamond|emerald|ruby/, 'gem'], [/key/, 'key'],
  [/heart|life|health/, 'heart'], [/star|shard/, 'star'], [/orb|mana|energy|soul|essence/, 'orb'], [/skull|bone|curse/, 'skull'],
];
export function iconFor(item) {
  if (item && item.icon && ICONS[item.icon]) return item.icon;
  const words = String((item && (item.key || item.name)) || '').toLowerCase();
  for (const [re, id] of WORDS) if (re.test(words)) return id;
  return item && item.form && ICONS[item.form] ? item.form : 'item';
}
export const iconSvg = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ICONS.item}</svg>`;
