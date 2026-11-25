/**
 * THE SCROLL STAGE'S HUD AND MENU (Blaze Gunner): a scrolling shooter read as the genre reads it, in pictures, the play
 * left clear between its corners, drawn as a ship's console (hairlines, dark glass, a soft glow). On the game UI
 * runtime (docs/mana-ui.md), hosted by the page's HUD host
 * (scene/channels/mana-hud.js, its `scroll` feed: read off the world each frame, worlds/controllable/scroll.js,
 * scroll-pods.js, scroll-foes.js), in the game's look.
 *
 *   SCORE          top left: a star and the score (each foe down its points)
 *   SHIPS          under it, a ship's picture for each life left past this one (×n past five)
 *   HULL, SPEED    a heart and the hull's hp as a bar of ticks, a tick a hit; the gear as chevrons, lit to the gear
 *   THE PODS       bottom left, a card each: the pod's own picture in its hue, its name, its ammo as a count and a bar;
 *                  the live one framed bright and marked; an open slot the base gun's (∞) when live, else empty; while
 *                  eject is held, the hold filling under the live card
 *   THE BOSS       top right: a skull and the boss's systems left, shown once its hull is on the screen and gone a moment
 *                  after it falls; its name said across the top as it comes in
 *   READY          in the middle as the stage starts and after a life is lost, the ships left under it
 *   GAME OVER, STAGE CLEAR  in the middle as the last life goes, and as the boss falls and the track ends; the score under
 *   THE HINTS      the controls, bottom right, in the glyphs of the device in hand (the keys, or the pad in its own
 *                  layout): for the first seconds, and again a while when the player picks up the other device; they
 *                  fade out as their time ends. The menu turns them off (remembered on that browser)
 *   what it puts away  the page's hp chip, its radar and its weapon icon: a shooter reads its foes on the screen
 *
 *   THE MENU (Enter, Esc where no game's shell holds it; the pad's start, select in a game's shell): the stage held,
 *   mana-ui's pause (`pause-menu`): resume, the controls sheet (each action, its keys and its pad buttons in the pad's
 *   layout, as key caps), the control hints on or off; aside, the score, the ships and the pods. Back resumes.
 *
 *   scrollHud({ theme?, hp, lives, boss?, stage?, more? }) → a level manifest's `manaHud`:
 *     { spec, theme, feed: { scroll }, css }
 *     hp       the ship's hp (the bar's ticks)
 *     lives    the lives past the first
 *     boss     { id, name, systems } the hull the track holds for (its systems the bar's ticks), or null
 *     stage    the stage's name (the menu's line under PAUSED)
 *     more     a level's further keys line (another mechanic's: 'G  call'), shown with the keys
 *   SCROLL_HUD_THEME   the theme card it is drawn in where the page names none (a World page's: `orbit`, a ship's
 *                      console in dark glass; a designed level draws it in its game's own look, interface-look.js)
 *   SCROLL_KEYS        the stage's keys as a controls line (the flight goal's legend, flight-goal.js)
 *   SCROLL_ICONS       the pictures it draws itself: the ship, the base gun, each pod, a pip; the star, the heart and the
 *                      skull mana-ui's own, so a look that draws its icons as initials still shows them
 *
 * The state the spec binds (the host writes it each frame): sg { score, scoreWord, lives, livesRow, livesMore, hp,
 * slots: [{ live, mark, icon, name, ammoWord, ammo, max, bar, ejOn, ej }], gears: [{ icon }], bossOn, boss, ready, end,
 * endWord, keysOn, keys, moments, menu, aside, sheet, padName, stage }. Pure: a spec is data.
 */
import { IDIOMS } from '../../../mana-ui/idioms.js';
import { ICONS } from '../../../mana-ui/icons.js';
import { scrollControls, SCROLL_CONTROLS } from './controls.js';
import { cardTheme } from '../../playscape/ui/theme-cards/loader.js';

/** The look where the page names none: the `orbit` card, a ship's console in dark glass (Blaze Gunner's own). */
export const SCROLL_HUD_THEME = 'orbit';
/** The scroll stage's keys as a controls line (controls.js; the flight goal's legend). */
export const SCROLL_KEYS = SCROLL_CONTROLS.filter((r) => r.id !== 'fly' && r.id !== 'menu').map((r) => `${r.keys.join(' / ')}  ${r.does}`).join(' · ');

// THE PICTURES it draws itself, on mana-ui's 24 grid (a mask: only the shape is read, its colour the pod's): the ship nose
// right as it flies, the base gun's twin rounds, and each pod by what it fires
export const SCROLL_ICONS = Object.freeze({
  ship: 'M22 12l-7-2.4-3.2-5.1H9.4l1.5 5H6.2L3.6 6.8H2l1.2 5.2L2 17.2h1.6l2.6-2.7h4.7l-1.5 5h2.4l3.2-5.1z',
  twin: 'M3 7.8h9.5v2.6H3zM3 13.6h9.5v2.6H3zM14.5 7.8H21v2.6h-6.5zM14.5 13.6H21v2.6h-6.5z',
  empty: 'M4 4h16v16H4zM6.5 6.5v11h11v-11z',
  vulcan: 'M2 10.5h4.5a1.5 1.5 0 0 1 0 3H2zM9 10.5h4.5a1.5 1.5 0 0 1 0 3H9zM16 10.5h4.5a1.5 1.5 0 0 1 0 3H16zM2 6h20v1.6H2zM2 16.4h20V18H2z',
  spread: 'M2 11h19v2H2zM2.6 10.2l16.6-6.6.8 1.9L3.4 12.1zM2.6 13.8l.8-1.9L20 18.5l-.8 1.9z',
  cannon: 'M15 5.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM2 10.8h5.5v2.4H2z',
  blade: 'M7 2c8 2.2 13 6 13 10s-5 7.8-13 10c4.5-3.2 7-6.4 7-10S11.5 5.2 7 2z',
  flail: 'M2.5 11h2.5v2H2.5zM6.5 11H9v2H6.5zM10.5 11H13v2h-2.5zM18 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z',
  seeker: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
  grenade: 'M2.5 19c2.6-9.2 8.6-12.8 13.6-11.4l-.6 2C11.4 8.6 6.6 11.6 4.6 19.6zM18 8.5a3.8 3.8 0 1 0 0 7.6a3.8 3.8 0 1 0 0-7.6z',
  wave: 'M2 11.8c1.7-3.4 3.4-5.1 5-5.1s3.3 1.7 5 5.1 3.4 5.1 5 5.1 3.3-1.7 5-5.1v3.4c-1.7 2.6-3.3 4.2-5 4.2s-3.3-1.7-5-5.1-3.4-5.1-5-5.1-3.3 1.7-5 4.8z',
  lance: 'M2 10.4h14v3.2H2zM15.5 6.5L22 12l-6.5 5.5z',
  mine: 'M12 2l1.6 4.4L18 4.6l-1.8 4.3L21 10.5l-4.4 1.5L19 16.4l-4.4-1.6L13 20l-1-4.2-1 4.2-1.6-5.2L5 16.4 7.4 12 3 10.5l4.8-1.6L6 4.6l4.4 1.8z',
  pip: 'M3 5l8 7-8 7zM12 5l8 7-8 7z',
  // (mana-ui's own, drawn here in every look: a theme may draw its icons as initials)
  star: ICONS.star, heart: ICONS.heart, skull: ICONS.skull,
});

const B = (p) => ({ bind: `sg.${p}` });
const I = (p) => ({ item: p });
const T = (value, role, more = {}) => ({ use: 'text', props: { value, role, ...more } });
const icon = (name, size = 's') => ({ use: 'icon', props: { name, size } });
const row = (children, props = {}) => ({ use: 'stack', props: { dir: 'row', ...props }, children });
const col = (children, props = {}) => ({ use: 'stack', props, children });

/** The spec it draws (see the header). */
export function scrollHudSpec({ hp = 10, boss = null } = {}) {
  const screens = {
    // THE MENU: mana-ui's pause over the held stage; back resumes
    menu: { use: 'pause-menu', props: { title: 'Paused', sub: B('stage'), items: B('menu'), aside: B('aside') } },
    // THE CONTROLS SHEET: each action, its keys, its pad buttons in the pad's own layout
    controls: { use: 'screen', props: { title: 'Controls', layer: 'modal', place: 'left' }, children: [{ use: 'window', props: { variant: 'ghost' }, children: [col([
      row([T('', 'caption'), T('Keyboard', 'caption'), T(B('padName'), 'caption')], { gap: 'normal' }),
      { use: 'each', props: { rows: B('sheet'), row: row([T(I('does'), 'label'), { use: 'legend', props: { rows: I('keys') } }, { use: 'legend', props: { rows: I('pad') } }], { gap: 'normal', align: 'center' }) } },
      { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } },
    ], { gap: 'tight' })] }] },
  };
  const hud = { use: 'hud', children: [
    // SCORE, SHIPS, HULL, SPEED: each its picture
    { use: 'region', props: { at: 'top-left', variant: 'bare' }, children: [col([
      row([icon('sg-star', 'm'), T(B('score'), 'heading')], { gap: 'tight', align: 'center' }),
      row([{ use: 'each', props: { rows: B('livesRow'), dir: 'row', row: icon('sg-ship') } }, T(B('livesMore'), 'label')], { gap: 'tight', align: 'center' }),
      row([icon('sg-heart'), { use: 'bar', props: { value: B('hp'), max: hp, variant: 'hp', segments: hp, figures: false } }], { gap: 'tight', align: 'center' }),
      { use: 'each', props: { rows: B('gears'), dir: 'row', row: icon(I('icon')) } },
    ], { gap: 'tight', align: 'start' })] },
    // THE PODS: a card each, the live one marked; the eject's hold under it
    { use: 'region', props: { at: 'bottom-left', variant: 'bare' }, children: [{ use: 'each', props: { rows: B('slots'), dir: 'row', row: col([
      row([icon(I('icon'), 'l'), col([T(I('name'), 'caption'), T(I('ammoWord'), 'heading')], { gap: 'tight' }), T(I('mark'), 'label')], { gap: 'tight', align: 'center' }),
      { use: 'bar', props: { value: I('ammo'), max: I('max'), variant: 'mp', figures: false }, when: I('bar') },
      { use: 'bar', props: { value: I('ej'), max: 1, variant: 'boss', figures: false }, when: I('ejOn') },
    ], { gap: 'tight' }) } }] },
    // THE BOSS: its systems left, while it is on the screen; its name across the top as it comes in
    ...(boss ? [
      { use: 'region', props: { at: 'top-right', variant: 'bare' }, when: B('bossOn'), children: [row([icon('sg-skull', 'm'), { use: 'bar', props: { label: boss.name, value: B('boss'), max: boss.systems, variant: 'boss', segments: boss.systems, figures: false } }], { gap: 'tight', align: 'center' })] },
      { use: 'region', props: { at: 'top', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 2.2, read: 0.6 } }] },
    ] : []),
    // READY, and the end: GAME OVER or STAGE CLEAR, the score under it
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: B('ready'), children: [col([T('Ready', 'display'), row([{ use: 'each', props: { rows: B('livesRow'), dir: 'row', row: icon('sg-ship', 'm') } }])], { align: 'center', gap: 'tight' })] },
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: B('end'), children: [col([T(B('endWord'), 'display'), T(B('scoreWord'), 'heading')], { align: 'center', gap: 'tight' })] },
    // THE HINTS: the controls in the device's glyphs, for a while (the host fades them out)
    { use: 'region', props: { at: 'bottom-right', variant: 'bare' }, when: B('keysOn'), children: [{ use: 'legend', props: { rows: B('keys') } }] },
  ] };
  // (the pause is mana-ui's own idiom: its def carried with the spec, as the HUD's host loads none)
  const P = IDIOMS['pause-menu'];
  return { screens, hud, defs: { 'pause-menu': { params: P.params, node: P.node } } };
}

// THE LOOK of its parts over the game's theme, a ship's console: hairlines and dark glass, cut corners, mono numerals, a
// soft glow, nothing heavy. Its pictures as masks in the theme's line colour (each pod's in its hue, by slot:
// --sg-tint-<n> on the HUD's root); the hull's and the boss's bars thin lines of light in a hairline; the pod cards glass,
// the live one edged in its hue and the other dimmed, their ammo bars in their hues, the eject's hold in the harm colour;
// READY breathing slowly (still under less motion); the hints fading out as their time ends (the host's
// data-sg-hint=fade on the root); the menu's sheet a grid; what it puts away
const R = '#moj-mana-hud';
const url = (d) => `url("data:image/svg+xml,${`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${d}' fill-rule='evenodd'/></svg>`.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;
const POD_CARD = `${R} .mana-place[data-at=bottom-left] .mana-each>*`;
const mix = (c, pc) => `color-mix(in srgb,${c} ${pc}%,transparent)`;
const LINE = 'var(--mana-line)', GLOW = `drop-shadow(0 0 4px ${mix(LINE, 55)})`;
const CUT = 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))';
const SCROLL_HUD_CSS = [
  // the pictures, lit in the line colour
  `${R} [data-icon^=sg-]{font-size:0!important;position:relative;display:inline-block;width:18px;height:18px;border:0;background:transparent;color:${LINE};filter:${GLOW}}`,
  `${R} [data-icon^=sg-][data-size=m]{width:24px;height:24px}${R} [data-icon^=sg-][data-size=l]{width:38px;height:38px}`,
  `${R} [data-icon^=sg-]::before{content:"";position:absolute;inset:0;background:currentColor;-webkit-mask:var(--sg-icon) center/contain no-repeat;mask:var(--sg-icon) center/contain no-repeat}`,
  ...Object.entries(SCROLL_ICONS).map(([k, d]) => `${R} [data-icon=sg-${k}]{--sg-icon:${url(d)}}`),
  `${R} [data-icon=sg-pip-off]{--sg-icon:${url(SCROLL_ICONS.pip)};opacity:.22;filter:none}`,
  `${R} [data-icon=sg-empty]{opacity:.35;filter:none}`,
  `${R} [data-icon=sg-ship]{color:var(--mana-accent2)}`,
  // the numerals: mono, spaced, lit
  `${R} .mana-place[data-at=top-left] .mana-text[data-role=heading]{font-family:var(--mana-mono);font-weight:500;letter-spacing:.14em;text-shadow:0 0 8px ${mix(LINE, 45)}}`,
  // the hull's bar and the boss's: thin lines of light in a hairline
  `${R} .mana-place[data-at=top-left] .mana-bar,${R} .mana-place[data-at=top-right] .mana-bar{min-width:220px}`,
  `${R} .mana-place[data-at=top-left] .mana-track,${R} .mana-place[data-at=top-right] .mana-track{height:6px;border-radius:0;transform:none;background:${mix(LINE, 10)};border:1px solid ${mix(LINE, 55)};box-shadow:0 0 10px ${mix(LINE, 18)}}`,
  `${R} .mana-place[data-at=top-left] .mana-track i,${R} .mana-place[data-at=top-right] .mana-track i{box-shadow:0 0 8px currentColor}`,
  `${R} .mana-place[data-at=top-left] .mana-track b,${R} .mana-place[data-at=top-right] .mana-track b{width:2px;background:var(--mana-panel);outline:0}`,
  `${R} .mana-place[data-at=top-right] .mana-label{font-family:var(--mana-mono);letter-spacing:.18em;font-size:12px;color:${LINE}}`,
  // the pod cards: dark glass, cut at two corners, the live one edged in its hue
  `${R} .mana-place[data-at=bottom-left] .mana-each{display:flex;gap:10px;align-items:flex-end}`,
  `${POD_CARD}{width:168px;padding:8px 12px 10px;clip-path:${CUT};background:linear-gradient(135deg,${mix('var(--mana-panel)', 78)},${mix('var(--mana-panel)', 38)});border:1px solid ${mix(LINE, 30)};opacity:.5;transition:opacity .2s}`,
  `${POD_CARD}:has(.mana-text[data-role=label]:not(:empty)){opacity:1;border-color:${mix('var(--sg-tint)', 85)};box-shadow:inset 0 0 22px ${mix('var(--sg-tint)', 22)}}`,
  ...[0, 1].map((i) => `${POD_CARD}:nth-child(${i + 1}){--sg-tint:var(--sg-tint-${i},${LINE})}`),
  `${POD_CARD} [data-icon^=sg-]{color:var(--sg-tint);filter:drop-shadow(0 0 5px ${mix('var(--sg-tint)', 60)})}`,
  `${POD_CARD} .mana-text[data-role=caption]{font-family:var(--mana-mono);font-size:11px;letter-spacing:.22em;color:${mix('var(--mana-ink)', 70)}}`,
  `${POD_CARD} .mana-text[data-role=heading]{font-family:var(--mana-mono);font-weight:500;font-size:24px;line-height:1;letter-spacing:.06em;font-variant-numeric:tabular-nums}`,
  `${POD_CARD} .mana-text[data-role=label]{margin-left:auto;font-size:10px;color:var(--sg-tint)}`,
  `${POD_CARD} .mana-bar{display:block!important;min-width:0!important;width:100%;margin-top:6px}${POD_CARD} .mana-bar .mana-label{display:none}`,
  `${POD_CARD} .mana-track{display:block;width:100%;height:4px;border:0;border-radius:0;transform:none;background:${mix('var(--sg-tint)', 16)}}`,
  `${POD_CARD} .mana-bar[data-variant=mp] .mana-track i{background:var(--sg-tint)!important;box-shadow:0 0 6px var(--sg-tint)}`,
  `${POD_CARD} .mana-bar[data-variant=boss] .mana-track{height:2px}${POD_CARD} .mana-bar[data-variant=boss] .mana-track i{background:var(--mana-harm)!important}`,
  // READY and the end: spaced wide, light, breathing
  '@keyframes sg-breathe{0%,100%{opacity:1}50%{opacity:.45}}',
  `${R} .mana-place[data-at=center] .mana-text[data-role=display]{font-family:var(--mana-mono);font-weight:400;letter-spacing:.6em;color:${LINE};text-shadow:0 0 18px ${mix(LINE, 60)};animation:sg-breathe 1.6s ease-in-out infinite}`,
  `${R} .mana-root[data-motion=reduced] .mana-place[data-at=center] .mana-text{animation:none}`,
  `@media (prefers-reduced-motion:reduce){${R} .mana-place[data-at=center] .mana-text{animation:none}}`,
  // the hints: in softly, out as their time ends
  '@keyframes sg-in{from{opacity:0}to{opacity:1}}',
  `${R} .mana-place[data-at=bottom-right]>.mana-region{animation:sg-in .4s ease-out;transition:opacity .9s ease-in}`,
  `${R}[data-sg-hint=fade] .mana-place[data-at=bottom-right]>.mana-region{opacity:0}`,
  // the menu: the stage held under it, taking the pointer; the sheet a grid of what, keys, pad
  `${R} .mana-screen{pointer-events:auto}`,
  `${R} .mana-screen .mana-window>.mana-stack>.mana-stack[data-dir=row],${R} .mana-screen .mana-each>.mana-stack[data-dir=row]{display:grid!important;grid-template-columns:130px 220px 220px;align-items:center;gap:14px}`,
  `${R} .mana-screen .mana-each .mana-legend{display:flex;gap:6px;margin:0;padding:0;background:none;border:0;position:static}`,
  // what it puts away
  '.moj-c-radar,.moj-c-hp,div:has(>#__wepIcon){display:none!important}',
].join('\n');

/** A scroll stage's `manaHud` (see the header). */
export function scrollHud({ theme = cardTheme(SCROLL_HUD_THEME), hp = 10, lives = 2, boss = null, stage = '', more = '' } = {}) {
  const B0 = boss && typeof boss.id === 'string' && Number.isInteger(boss.systems) && boss.systems > 0 ? { id: boss.id, name: String(boss.name || 'Boss'), systems: boss.systems } : null;
  const H = Math.max(1, Math.round(hp)), L = Math.max(0, Math.round(lives));
  return {
    // (the theme without its overlay or its stage: a grid drawn over the screen would lie across the play, and the
    // menu stands over the held stage itself, not a show of its own)
    spec: scrollHudSpec({ hp: H, boss: B0 }), theme: { ...(typeof theme === 'string' ? { from: theme } : theme), overlay: 'none', stage: 'none' }, css: SCROLL_HUD_CSS,
    feed: { scroll: {
      hp: H, lives: L, ...(B0 ? { boss: B0 } : {}), stage: String(stage || ''),
      // (the controls as each device says them; `in`: the level plays in a game's shell, whose pause holds Esc and start)
      controls: { off: scrollControls({ more }), in: scrollControls({ shell: true, more }) },
    } },
  };
}
