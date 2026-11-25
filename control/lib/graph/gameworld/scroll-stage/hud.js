/**
 * THE SCROLL STAGE'S HUD (Blaze Gunner): a scrolling shooter read as the genre reads it, the play left clear between its
 * corners. On the game UI runtime (docs/mana-ui.md), hosted by the page's HUD host (scene/channels/mana-hud.js, its
 * `scroll` feed: read off the world each frame, worlds/controllable/scroll.js, scroll-pods.js, scroll-foes.js), in the
 * game's look.
 *
 *   SCORE, LIVES   top left: the score (each foe down its points, a hull's system its own), the lives left as ×n
 *   HP, SPEED      under them: the ship's hp as a bar of ticks, a tick a hit; the speed's gear
 *   THE PODS       bottom left: the two slots, each its pod's name and its ammo as a bar in the pod's hue, the live one
 *                  marked; an open slot the base gun's word when it is live, else empty
 *   THE BOSS       top right: the boss's systems left as a bar, shown once its hull is on the screen and gone a moment
 *                  after it falls; its name said across the top as it comes in
 *   READY          in the middle as the stage starts and after a life is lost, the lives under it
 *   GAME OVER, STAGE CLEAR  in the middle as the last life goes, and as the boss falls and the track ends; the score under
 *   the keys       at the bottom right for the first seconds, clear of the pods
 *   what it puts away  the level's own rows, the page's hp chip and the radar: a shooter reads its foes on the screen
 *
 *   scrollHud({ theme?, hp, lives, boss?, keys }) → a level manifest's `manaHud`: { spec, theme, feed: { scroll }, css }
 *     hp       the ship's hp (the bar's ticks)
 *     lives    the lives past the first
 *     boss     { id, name, systems } the hull the track holds for (its systems the bar's ticks), or null
 *     keys     the controls line ('arrows / WASD  fly · J or click  fire · …'), drawn as key caps
 *   SCROLL_HUD_THEME   mana-ui's look where the page names none (a World page's: mana-ui's `arcade`; a designed level
 *                      draws it in its game's own look, interface-look.js)
 *   SCROLL_KEYS        the stage's keys as a controls line (the flight goal's legend, flight-goal.js)
 *
 * The state the spec binds (the host writes it each frame): sg { score, lives, livesWord, hp, slots: [{ mark, name, ammo,
 * max, hue, bar }], gear, bossOn, boss, ready, over, clear, end, keysOn, keys, moments }. Pure: a spec is data.
 */
import { keyRowsOf } from '../side-map/hud.js';

export const SCROLL_HUD_THEME = 'arcade';
/** The scroll stage's keys (worlds/controllable/scroll.js, scroll-pods.js; the page's bindings): the d-pad on the arrows
 * or WASD besides. */
export const SCROLL_KEYS = 'J / click  fire · R  speed · 1 / 2  pods · F  eject (hold)';

const B = (p) => ({ bind: `sg.${p}` });
const I = (p) => ({ item: p });
const T = (value, role, more = {}) => ({ use: 'text', props: { value, role, ...more } });
const row = (children, props = {}) => ({ use: 'stack', props: { dir: 'row', ...props }, children });
const col = (children, props = {}) => ({ use: 'stack', props, children });

/** The spec it draws (see the header). */
export function scrollHudSpec({ hp = 10, boss = null } = {}) {
  return { screens: {}, hud: { use: 'hud', children: [
    // SCORE and LIVES, the HP under them
    { use: 'region', props: { at: 'top-left', variant: 'bare' }, children: [col([
      row([{ use: 'counter', props: { label: 'Score', value: B('score') } }, { use: 'counter', props: { label: 'Ship', value: B('livesWord'), icon: 'person' } }], { gap: 'loose' }),
      { use: 'bar', props: { label: 'Hull', value: B('hp'), max: hp, variant: 'hp', segments: hp, figures: false } },
      { use: 'counter', props: { label: 'Speed', value: B('gear') } },
    ], { gap: 'tight', align: 'start' })] },
    // THE PODS: the two slots, the live one marked
    { use: 'region', props: { at: 'bottom-left', variant: 'bare' }, children: [
      { use: 'list', id: 'pods', props: { rows: B('slots'), row: row([
        T(I('mark'), 'heading'),
        T(I('name'), 'label'),
        { use: 'bar', props: { value: I('ammo'), max: I('max'), variant: 'mp', figures: false }, when: I('bar') },
      ], { gap: 'tight', align: 'center' }) } },
    ] },
    // THE BOSS: its systems left, while it is on the screen; its name across the top as it comes in
    ...(boss ? [
      { use: 'region', props: { at: 'top-right', variant: 'bare' }, when: B('bossOn'), children: [{ use: 'bar', props: { label: boss.name, value: B('boss'), max: boss.systems, variant: 'boss', segments: boss.systems, figures: false } }] },
      { use: 'region', props: { at: 'top', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 2.2, read: 0.6 } }] },
    ] : []),
    // READY, and the end: GAME OVER or STAGE CLEAR, the score under it
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: B('ready'), children: [col([T('Ready', 'display'), T(B('livesWord'), 'heading')], { align: 'center', gap: 'tight' })] },
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: B('end'), children: [col([T(B('endWord'), 'display'), T(B('scoreWord'), 'heading')], { align: 'center', gap: 'tight' })] },
    // the keys, for the first seconds
    { use: 'region', props: { at: 'bottom-right', variant: 'bare' }, when: B('keysOn'), children: [{ use: 'legend', props: { rows: B('keys') } }] },
  ] } };
}

// THE LOOK of its parts over the game's theme: the hull's ticks and the boss's on black, square, the pods' rows each its
// hue's bar, the live one bright and the other dimmed; READY pulsing (twice a second, still under less motion); what it
// puts away
const R = '#moj-mana-hud';
const SCROLL_HUD_CSS = [
  `${R} .mana-place[data-at=top-left] .mana-bar,${R} .mana-place[data-at=top-right] .mana-bar{min-width:260px}`,
  `${R} .mana-place[data-at=top-left] .mana-track,${R} .mana-place[data-at=top-right] .mana-track{height:14px;border-radius:0;background:#000;box-shadow:0 0 0 2px var(--mana-ink),0 0 0 4px #000}`,
  `${R} .mana-place[data-at=bottom-left] .mana-list .mana-row>.mana-stack{display:grid!important;grid-template-columns:18px 96px 140px;align-items:center;gap:10px;white-space:nowrap}`,
  `${R} .mana-place[data-at=bottom-left] .mana-list .mana-row:not(:has(.mana-text[data-role=heading]:not(:empty))){opacity:.55}`,
  `${R} .mana-place[data-at=bottom-left] .mana-bar{display:block!important;min-width:0!important;width:140px}${R} .mana-place[data-at=bottom-left] .mana-bar .mana-label{display:none}`,
  `${R} .mana-place[data-at=bottom-left] .mana-track{display:block;width:100%;height:10px;border-radius:0;background:#000;box-shadow:0 0 0 2px var(--mana-ink)}`,
  ...[0, 1].map((i) => `${R} .mana-place[data-at=bottom-left] .mana-row:nth-child(${i + 1} of .mana-row) .mana-bar[data-variant] .mana-track i{background:var(--sg-tint-${i},var(--mana-accent2))}`),
  `${R} .mana-place[data-at=center] .mana-text[data-role=display]{letter-spacing:.3em;animation:mana-pulse .5s steps(2,jump-none) infinite}`,
  `${R} .mana-root[data-motion=reduced] .mana-place[data-at=center] .mana-text{animation:none}`,
  `@media (prefers-reduced-motion:reduce){${R} .mana-place[data-at=center] .mana-text{animation:none}}`,
  '.moj-c-radar,.moj-c-hp,div:has(>#__wepIcon){display:none!important}',
].join('\n');

/** A scroll stage's `manaHud` (see the header). */
export function scrollHud({ theme = SCROLL_HUD_THEME, hp = 10, lives = 2, boss = null, keys = '' } = {}) {
  const B0 = boss && typeof boss.id === 'string' && Number.isInteger(boss.systems) && boss.systems > 0 ? { id: boss.id, name: String(boss.name || 'Boss'), systems: boss.systems } : null;
  const H = Math.max(1, Math.round(hp)), L = Math.max(0, Math.round(lives));
  return {
    spec: scrollHudSpec({ hp: H, boss: B0 }), theme, css: SCROLL_HUD_CSS,
    feed: { scroll: { hp: H, lives: L, ...(B0 ? { boss: B0 } : {}), keys: keyRowsOf(keys) } },
  };
}
