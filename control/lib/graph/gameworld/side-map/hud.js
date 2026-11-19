/**
 * THE SIDE MAP'S HUD AND SCREENS — a robot hero's side-scroller read as the 8-bit action platformers read: energy as
 * columns of ticks in the top corners and nothing else over the play; the level's own screens over the held level. On
 * the game UI runtime (docs/mana-ui.md, "A HUD that reads as a game"), hosted by the level page's HUD host
 * (scene/channels/mana-hud.js, its `sidemap` feed), in the game's look.
 *
 *   the hero's column   its ENERGY as a column of fine ticks filling from the foot (the lives mechanic's `energy`: a hit
 *                        takes ticks, a life goes when it runs out); a level with no energy draws its lives there, one
 *                        block a life
 *   the weapon's column  beside the hero's, a special weapon's energy in its tint (the gun's `fxColor`, else the
 *                        look's second accent), shown only while the hero holds a gun with energy of its own
 *                        (`energyMax`); the buster has none
 *   the boss's column   at the opposite corner, top right, the boss's energy as a column of fine ticks in its colour,
 *                        shown only once the boss is near and awake and gone a moment after it falls; its name said
 *                        across the top as it comes in
 *   READY               flashing in the middle as the level starts and again after a life is lost, the lives left
 *                        under it (×3): the moment they change is when they are shown
 *   the keys            what the buttons do, as key caps along the foot for the first seconds, then gone
 *   what it puts away    the level's own rows (its energy, its lives chip, the boss's bar), the radar and the melee ring:
 *                        a side scroller reads its foes on the screen, and its buster needs no ring
 *
 *   THE SCREENS (each holds the level while it is up, docs/mana-ui.md "The side map's HUD"):
 *   intro      a world's intro card as the level starts, where it has a boss: a band across the screen, the boss's name
 *              in its hue, the world's, its tell in a line and what it gives; any button, or three seconds, and READY
 *   menu       the start menu (Enter): the weapons in the order earned, the buster first, the slots not yet won locked;
 *              the energy columns at full size, the lives; equip on accept (the loadout's, where the hero has one)
 *   over       GAME OVER when the last life goes, where the level lets the player continue (the lives mechanic's
 *              `continues`): continue from the gate reached, the lives back and the weapons kept, or give up (the level
 *              lost, as before)
 *
 *   sideMapHud({ theme, lives, energy?, boss?, intro?, keys, continues?, slots? }) → a level manifest's `manaHud`:
 *              { spec, theme, feed: { sidemap }, css }
 *     lives      the lives the level starts with
 *     energy     the hero's ticks (SIDE_ENERGY.max), 0 for none (its column then the lives)
 *     boss       { id, name, hp } the boss stood in its last room (boss-cast.js), or null
 *     intro      { world, name, line, gives, hue } a world's intro card (the boss roster's words), or null
 *     keys       the level's controls line ('A / D  run · Space  jump · …'), drawn as key caps
 *     continues  the level offers a continue at GAME OVER
 *     slots      how many weapons the game has to win (the menu's rows: the buster and the rest locked till won)
 *   BOSS_TICKS   how many ticks a column holds (energy in steps, as the genre counts it)
 *   MENU_KEY     the key that opens the start menu
 *
 * The state the spec binds (the host writes it each frame): sm { lives, livesWord, energy, weaponOn, weapon, weaponMax,
 * bossOn, boss, ready, keysOn, keys, moments, weapons, gate, keep }. Pure: a spec is data.
 */
export const BOSS_TICKS = 28;
export const MENU_KEY = 'Enter';

const B = (p) => ({ bind: `sm.${p}` });
const I = (p) => ({ item: p });
const T = (value, role, more = {}) => ({ use: 'text', props: { value, role, ...more } });
const row = (children, props = {}) => ({ use: 'stack', props: { dir: 'row', ...props }, children });
const col = (children, props = {}) => ({ use: 'stack', props, children });

/** A controls line as legend rows: 'A / D  run · Space  jump' → [{ actions: ['A', 'D'], label: 'run' }, { action: 'Space', label: 'jump' }]. */
export function keyRowsOf(line) {
  return String(line || '').split(' · ').map((part) => {
    const i = part.indexOf('  ');
    if (i < 0) return null;
    const keys = part.slice(0, i).split(/\s*\/\s*|\s+/).filter(Boolean), label = part.slice(i + 2).trim();
    return keys.length === 1 ? { action: keys[0], label } : { actions: keys, label };
  }).filter(Boolean);
}

// the hero's column: its energy, or its lives a block each where it has none
const heroColumn = (lives, energy) => (energy > 0
  ? { use: 'bar', props: { value: B('energy'), max: energy, variant: 'hp', figures: false } }
  : { use: 'bar', props: { value: B('lives'), max: lives, variant: 'hp', segments: lives, figures: false } });
const weaponColumn = { use: 'bar', props: { value: B('weapon'), max: B('weaponMax'), variant: 'mp', figures: false }, when: B('weaponOn') };

/** The spec it draws (see the header). */
export function sideMapHudSpec({ lives = 3, energy = 0, boss = null, intro = null, continues = false } = {}) {
  const screens = {
    // THE START MENU: the weapons left, the columns and the lives right
    menu: { use: 'screen', props: { title: 'Paused', place: 'full' }, children: [row([
      { use: 'window', props: { title: 'Weapons' }, children: [{ use: 'list', id: 'weapons', props: { rows: B('weapons'), row: row([
        { use: 'icon', props: { name: I('icon'), size: 's' } },
        T(I('name'), 'heading'),
        { use: 'bar', props: { value: I('e'), max: I('max'), figures: false }, when: I('bar') },
      ]) }, on: { accept: I('then') } }] },
      col([
        { use: 'window', props: { title: 'Energy' }, children: [row([heroColumn(lives, energy), weaponColumn], { gap: 'normal' })] },
        { use: 'counter', props: { label: 'Lives', value: B('livesWord'), icon: 'person' } },
      ], { gap: 'normal' }),
    ], { gap: 'loose', align: 'start' })] },
    ...(continues ? {
      // GAME OVER: how far it got, what is kept, the way on
      over: { use: 'screen', props: { place: 'center', legend: 'none' }, children: [col([
        T('Game over', 'display'),
        row([{ use: 'counter', props: { label: 'Reached', value: B('gate') } }, { use: 'counter', props: { label: 'Kept', value: B('keep') } }], { gap: 'loose' }),
        { use: 'list', id: 'over', props: { variant: 'menu', rows: [{ label: 'Continue', then: { emit: 'sm:continue' } }, { label: 'Give up', then: { emit: 'sm:quit' } }] }, on: { accept: I('then') } },
        T(`Continue: the lives back to ${lives}, from the gate reached`, 'label'),
      ], { gap: 'loose', align: 'center' })] },
    } : {}),
    ...(intro ? {
      // A WORLD'S INTRO CARD: a band across the screen, the boss's name in its hue
      intro: { use: 'screen', props: { place: 'full', legend: 'none', press: 'any' }, children: [col([
        T(intro.world, 'label'),
        T(intro.name, 'display'),
        T(intro.line, 'heading'),
        row([...(intro.gives ? [{ use: 'badge', props: { value: `Gives · ${intro.gives}`, variant: 'muted' } }] : [])]),
        { use: 'button', props: { label: 'Go' }, on: { accept: { emit: 'sm:go' } } },
      ], { gap: 'normal', align: 'start' })] },
    } : {}),
  };
  return { screens, hud: { use: 'hud', children: [
    // THE COLUMNS: the hero's at the top left (its special weapon's beside it), the boss's at the top right while it fights
    { use: 'region', props: { at: 'top-left', variant: 'bare' }, children: [row([heroColumn(lives, energy), weaponColumn], { gap: 'tight', align: 'start' })] },
    ...(boss ? [{ use: 'region', props: { at: 'top-right', variant: 'bare' }, when: B('bossOn'), children: [{ use: 'bar', props: { value: B('boss'), max: boss.hp, variant: 'boss', figures: false } }] }] : []),
    // (the boss's name across the top as it comes in, one moment)
    ...(boss ? [{ use: 'region', props: { at: 'top', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 2.2, read: 0.6 } }] }] : []),
    // READY, flashing in the middle, the lives left under it
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: B('ready'), children: [col([T('Ready', 'display'), T(B('livesWord'), 'heading')], { align: 'center', gap: 'tight' })] },
    // the keys, for the first seconds
    { use: 'region', props: { at: 'bottom', variant: 'bare' }, when: B('keysOn'), children: [{ use: 'legend', props: { rows: B('keys') } }] },
  ] } };
}

// THE LOOK of its parts over the game's theme: each column a bar stood on its end (its track turned a quarter, so it
// fills from the foot), on black in a black and ink frame, its fill cut into BOSS_TICKS fine ticks (the genre's), the
// boss's in its own colour; READY flashes (twice a second, under the three a second the guidelines allow; still under
// less motion); the menu's columns the HUD's, its weapons' bars ticked across in their tints; GAME OVER in the harm
// colour; the intro's band across the screen, its name in the boss's hue; what it puts away
const P = '#moj-mana-hud :is(.mana-place[data-at=top-left],.mana-place[data-at=top-right],.mana-screen .mana-window:not(:has(.mana-list)))', H = 224, W = 24, TICK = `calc(${H - 6}px / ${BOSS_TICKS})`;
const fill = (c) => `linear-gradient(90deg,${c} 0 62%,transparent 62%) 0 0/${TICK} 100% repeat-x!important`;
const M = '#moj-mana-hud .mana-screen';
const SIDE_MAP_HUD_CSS = [
  `${P} .mana-stack{gap:10px;align-items:flex-start}`,
  `${P} .mana-bar{display:block;position:relative;min-width:0!important;width:${W}px;height:${H}px;padding:0;margin:0}`,
  `${P} .mana-bar .mana-label{display:none}`,
  `${P} .mana-bar .mana-track{position:absolute;left:0;top:${H}px;width:${H}px;height:${W}px;box-sizing:border-box;transform:rotate(-90deg);transform-origin:0 0;border:3px solid #000;border-radius:0;background:#000;box-shadow:0 0 0 2px var(--mana-ink),0 0 0 4px #000}`,
  `${P} .mana-bar .mana-track i{background:${fill('var(--mana-hp)')}}`,
  `${P} .mana-bar[data-variant=mp] .mana-track i{background:${fill('var(--sm-weapon,var(--mana-accent2))')}}`,
  `${P} .mana-bar[data-variant=boss] .mana-track i{background:${fill('var(--mana-boss)')}}`,
  `${P} .mana-bar .mana-track b{top:0;bottom:0;width:6px;margin-left:-3px;background:#000;outline:0}`,
  '#moj-mana-hud .mana-place[data-at=center] .mana-text[data-role=display]{letter-spacing:.3em;animation:mana-pulse .5s steps(2,jump-none) infinite}',
  '#moj-mana-hud .mana-root[data-motion=reduced] .mana-place[data-at=center] .mana-text{animation:none}',
  '@media (prefers-reduced-motion:reduce){#moj-mana-hud .mana-place[data-at=center] .mana-text{animation:none}}',
  // (the screens: the held level dimmed under them, their parts taking the pointer)
  `${M}{pointer-events:auto;background:rgba(6,10,36,.86)}`,
  `${M} .mana-window .mana-list .mana-row>.mana-stack{display:grid!important;grid-template-columns:24px 220px 1fr;align-items:center;gap:18px;white-space:nowrap}`,
  `${M} .mana-list .mana-icon{width:22px;height:22px;font-size:0;background:var(--tint,var(--mana-accent2));border:3px solid #000;box-shadow:0 0 0 2px var(--mana-ink);border-radius:0}`,
  `${M} .mana-list .mana-row:has([data-icon=lock]){opacity:.4}`,
  `${M} .mana-list .mana-bar{min-width:0!important;width:100%;display:block!important}${M} .mana-list .mana-bar .mana-label{display:none}`,
  `${M} .mana-list .mana-bar .mana-track{display:block;height:16px;border:3px solid #000;border-radius:0;background:#000;box-shadow:0 0 0 2px var(--mana-ink);transform:none}`,
  `${M} .mana-list .mana-bar .mana-track i{background:linear-gradient(90deg,var(--tint,var(--mana-accent2)) 0 62%,transparent 62%) 0 0/calc(100%/${BOSS_TICKS}) 100% repeat-x!important}`,
  `${M} .mana-list .mana-bar .mana-track b{display:none}`,
  `${M} .mana-text[data-role=display]{font-size:96px;letter-spacing:.14em;text-shadow:6px 6px 0 #000}`,
  `${M}:has(.mana-list[data-variant=menu]) .mana-text[data-role=display]{color:var(--mana-harm)}`,
  `${M}[data-press=any]{justify-content:center;align-items:stretch;padding:0}`,
  `${M}[data-press=any]>.mana-stack{background:var(--mana-panel);border-top:4px solid var(--mana-ink);border-bottom:4px solid var(--mana-ink);padding:36px 9vw}`,
  `${M}[data-press=any] .mana-text[data-role=display]{color:var(--sm-hue,var(--mana-accent));font-size:112px}`,
  `${M}[data-press=any] .mana-button{opacity:.6}`,
  '.moj-c-radar,div:has(>#__wepIcon){display:none!important}',
].join('\n');

/** A side map level's `manaHud` (see the header). */
export function sideMapHud({ theme, lives = 3, energy = 0, boss = null, intro = null, keys = '', continues = false, slots = 8 } = {}) {
  const B0 = boss && typeof boss.id === 'string' && Number.isFinite(boss.hp) && boss.hp > 0 ? { id: boss.id, name: String(boss.name || ''), hp: boss.hp } : null;
  const N0 = intro && typeof intro.name === 'string' && intro.name ? { world: String(intro.world || ''), name: intro.name, line: String(intro.line || ''), gives: String(intro.gives || ''), hue: /^#[0-9a-f]{6}$/i.test(intro.hue || '') ? intro.hue : null } : null;
  const L = Math.max(1, Math.round(lives)), E = Math.max(0, Math.round(energy));
  return {
    spec: sideMapHudSpec({ lives: L, energy: E, boss: B0, intro: N0, continues: !!continues }),
    theme, css: SIDE_MAP_HUD_CSS,
    feed: { sidemap: { lives: L, ...(E ? { energy: E } : {}), ...(B0 ? { boss: B0 } : {}), ...(N0 ? { intro: N0 } : {}), ...(continues ? { continues: true } : {}), slots: Math.max(1, Math.round(slots)), menuKey: MENU_KEY, keys: keyRowsOf(keys) } },
  };
}
