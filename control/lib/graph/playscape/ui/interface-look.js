/**
 * THE INTERFACE'S LOOK — how a game's menus, front and HUD are dressed, worked by the interface department with the art
 * director and the colour theorist (a gameworld's `ui`, the interface chapter's: gameworld/chapters.js):
 *
 *   ui: {
 *     theme?:     '<preset>' | '<theme card>' | 'world' | { from?: <the same>, …the theme's words }
 *                 the look: a preset (mana-ui/theme.js), a card from the shelf (theme-cards/), the world's own look
 *                 (the default), or a theme written here over any of them (a child theme)
 *     colour?:    'world' | 'theme'     whose colours: the world's palette, solved by the colour theorist (the default
 *                 when the world has one), or the theme's own
 *     languages?: { <code>: { <key>: word } }, language?: '<code>'   the game's languages (mana-ui's words.test.js)
 *   }
 *
 * THE WORLD'S LOOK, absent a theme, is the art director's: the register the game's intent sets (a souls-like grave, a
 * tactics game calm on paper, a fighter in the party language: INTENT_LOOKS), in the colours the colour theorist solves
 * for the world (its palette's `ui`: ink, panel, line, accent, accent2), moving as its juice register moves (an anime
 * game snaps where its look would only ease).
 *
 *   INTENT_LOOKS                       the intent's genre → the preset its look starts from (console when none)
 *   readUi(ui, where?)                 → errors[] (teaching); shape and words only
 *   worldLook(G)                       → the world's look as a theme ({ from, …}): the art director's words
 *   interfaceLook(G)                   → { theme, from: { look, colour }, advice }: the theme mana-ui draws the game in,
 *                                        where its words and colours came from, and what its colours read like
 */
import { readTheme, themeAdvice, THEMES } from '../../../mana-ui/theme.js';
import { manaUi } from '../../../mana-ui/kernel.js';
import { THEME_CARDS, THEME_CARD_IDS, cardTheme } from './theme-cards/loader.js';
import { solvePalette } from '../../color-theorist/solve.js';
import { juiceOfGame, juiceSuggestion } from '../../gameworld/juice.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['theme', 'colour', 'languages', 'language'];

// the art director's register by the game's intent (gameworld/intent.js GENRES): where its look starts
export const INTENT_LOOKS = Object.freeze({
  'dungeon-crawler': 'grim', 'survival-horror': 'grim', roguelike: 'grim',
  tactics: 'tactician', rts: 'tactician', 'tower-defense': 'tactician',
  jrpg: 'rebel', 'long-rpg': 'rebel', 'story-adventure': 'rebel', 'cinematic-action': 'rebel',
  'arena-brawler': 'arcade', 'versus-fighter': 'arcade', 'arena-shooter': 'arcade', 'space-shooter': 'arcade', 'pixel-puzzle': 'arcade', 'block-puzzle': 'arcade', 'endless-runner': 'arcade', rhythm: 'arcade',
  'co-op-brawler': 'street', 'city-stalker': 'street', 'co-op-scroller': 'street',
  shooter: 'mecha', 'air-combat': 'mecha', 'flight-sim': 'mecha', 'driver-and-gunner': 'mecha', 'split-deathmatch': 'mecha', stealth: 'terminal',
  'party-mash': 'idol', 'co-op-kitchen': 'idol', 'match-3-saga': 'idol', collectathon: 'idol', 'co-op-platformer': 'idol', 'kart-racer': 'idol',
  farming: 'storybook', 'top-down-adventure': 'storybook', metroidvania: 'console',
  racing: 'modern', 'athletics-meet': 'modern', 'net-game': 'modern', 'turn-sport': 'modern', 'team-goal-game': 'modern',
});
// looks that keep still on purpose: an anime register does not make them snap
const CALM = new Set(['grim', 'tactician', 'storybook', 'terminal']);

/** The world's palette as the colour theorist solves it, or null (a world with none). */
function paletteOf(G) {
  const p = G && G.style && G.style.palette;
  if (!p) return null;
  try { return solvePalette(p === 'auto' ? {} : p); } catch { return null; }
}
const registerOf = (G) => { try { const J = juiceOfGame(G) || juiceSuggestion(G); return J ? J.fxStyle.register : null; } catch { return null; } };

/** The world's look: the intent's register and the juice's motion (its colours are the colour theorist's: interfaceLook). */
export function worldLook(G) {
  const base = INTENT_LOOKS[G && G.intent && G.intent.from] || 'console', anime = registerOf(G) === 'anime';
  const B = THEMES[base];
  return {
    name: `${(G && G.name) || 'The world'}'s look`, from: base,
    ...(anime && !CALM.has(base) && B.motion === 'ease' ? { motion: 'snap' } : {}),
    ...(anime && !CALM.has(base) && B.slant === 'none' ? { slant: 'light' } : {}),
  };
}

// a theme as written in `ui.theme`, its `from` resolved (a preset stays a word, a card and the world become themes)
function resolveTheme(t, G) {
  const W = () => worldLook(G);
  if (t === undefined || t === 'world') return W();
  if (typeof t === 'string') return THEMES[t] ? { from: t } : cardTheme(t, { world: W() });
  const f = t.from;
  const from = f === undefined || THEMES[f] ? f : f === 'world' ? W() : cardTheme(f, { world: W() });
  return { ...t, ...(from !== undefined ? { from } : {}) };
}

/** A `ui` as written: every fault said. */
export function readUi(ui, where = 'ui') {
  if (!isObj(ui)) return [`${where} is { ${KEYS.join('?, ')}? }: the interface's look (a preset, a theme card, the world's, or a theme of its own), whose colours, and the game's languages`];
  const errors = [];
  for (const k of Object.keys(ui)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not an interface setting (${KEYS.join(', ')})`);
  const t = ui.theme;
  if (typeof t === 'string' && t !== 'world' && !THEMES[t] && !THEME_CARDS[t]) errors.push(`${where}.theme '${t}' is a preset (${Object.keys(THEMES).join(', ')}), a theme card (${THEME_CARD_IDS.join(', ')}), world, or a theme of its own ({ from?, …words })`);
  else if (t !== undefined && typeof t !== 'string' && !isObj(t)) errors.push(`${where}.theme is a preset's or a card's name, world, or { from?, …the theme's words }`);
  else if (isObj(t) && typeof t.from === 'string' && t.from !== 'world' && !THEMES[t.from] && !THEME_CARDS[t.from]) errors.push(`${where}.theme.from '${t.from}' is a preset, a theme card or world`);
  else { try { readTheme(resolveTheme(t, {})); } catch (e) { errors.push(`${where}.theme: ${e.message}`); } }
  if (ui.colour !== undefined && !['world', 'theme'].includes(ui.colour)) errors.push(`${where}.colour is world (the world's palette, solved by the colour theorist) or theme (the theme's own)`);
  if (ui.languages !== undefined || ui.language !== undefined) {
    try { manaUi.readSpec({ screens: {}, languages: ui.languages, language: ui.language }); } catch (e) { errors.push(`${where}: ${e.message}`); }
  }
  return errors;
}

/** The look a game's interface is drawn in: its theme, where it came from, and what its colours read like. */
export function interfaceLook(G) {
  const ui = (G && G.ui) || {}, K = paletteOf(G);
  const colour = ui.colour || (K ? 'world' : 'theme');
  let theme = resolveTheme(ui.theme, G);
  // the colour theorist's colours over the look's (the world's palette, unless the look keeps its own)
  if (colour === 'world' && K) theme = { ...theme, tokens: { ink: K.ui.ink, panel: K.ui.panel, line: K.ui.line, accent: K.ui.accent, accent2: K.ui.accent2 } };
  const look = ui.theme === undefined || ui.theme === 'world' ? `the world's: ${INTENT_LOOKS[G && G.intent && G.intent.from] || 'console'} by its intent` : typeof ui.theme === 'string' ? (THEMES[ui.theme] ? `the preset ${ui.theme}` : `the card ${ui.theme}`) : 'its own';
  return { theme, from: { look, colour: colour === 'world' && K ? 'the world\'s palette' : 'the theme\'s own' }, advice: themeAdvice(theme) };
}
