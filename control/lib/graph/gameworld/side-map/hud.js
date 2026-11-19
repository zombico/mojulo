/**
 * THE SIDE MAP'S HUD — a robot hero's side-scroller read as the 8-bit action platformers read: energy as columns of
 * ticks at the top left, nothing else over the play. On the game UI runtime (docs/mana-ui.md, "A HUD that reads as a
 * game"), hosted by the level page's HUD host (scene/channels/mana-hud.js, its `sidemap` feed), in the game's look.
 *
 *   the hero's column   its lives as a column of fine ticks split into one block a life (a hit and a fall each take
 *                        one: the level has no health of its own yet, so the lives are its energy), filling from the foot
 *   the boss's column   beside it, the boss's energy as a column of fine ticks in its colour, shown only once the boss is
 *                        near and awake and gone a moment after it falls; its name said across the top as it comes in
 *   READY               flashing in the middle as the level starts and again after a life is lost
 *   the keys            what the buttons do, as key caps along the foot for the first seconds, then gone
 *   what it puts away    the level's own rows (its lives chip, the boss's bar), the radar and the melee ring: a side
 *                        scroller reads its foes on the screen, and its buster needs no ring
 *
 *   sideMapHud({ theme, lives, boss?, keys }) → a level manifest's `manaHud`: { spec, theme, feed: { sidemap }, css }
 *     lives   the lives the level starts with (its column's height)
 *     boss    { id, name, hp } the boss stood in its last room (boss-cast.js), or null
 *     keys    the level's controls line ('A / D  run · Space  jump · …'), drawn as key caps
 *   BOSS_TICKS   how many ticks a column holds (energy in steps, as the genre counts it)
 *
 * The state the spec binds (the host writes it each frame): sm { lives, bossOn, boss, ready, keysOn, keys, moments }.
 * Pure: a spec is data.
 */
export const BOSS_TICKS = 28;

const B = (p) => ({ bind: `sm.${p}` });

/** A controls line as legend rows: 'A / D  run · Space  jump' → [{ actions: ['A', 'D'], label: 'run' }, { action: 'Space', label: 'jump' }]. */
export function keyRowsOf(line) {
  return String(line || '').split(' · ').map((part) => {
    const i = part.indexOf('  ');
    if (i < 0) return null;
    const keys = part.slice(0, i).split(/\s*\/\s*|\s+/).filter(Boolean), label = part.slice(i + 2).trim();
    return keys.length === 1 ? { action: keys[0], label } : { actions: keys, label };
  }).filter(Boolean);
}

/** The spec it draws (see the header). */
export function sideMapHudSpec({ lives = 3, boss = null } = {}) {
  return { screens: {}, hud: { use: 'hud', children: [
    // THE COLUMNS, top left: the hero's lives, the boss's energy beside them while it fights
    { use: 'region', props: { at: 'top-left', variant: 'bare' }, children: [{ use: 'stack', props: { dir: 'row', gap: 'tight', align: 'start' }, children: [
      { use: 'bar', props: { value: B('lives'), max: lives, variant: 'hp', segments: lives, figures: false } },
      ...(boss ? [{ use: 'bar', props: { value: B('boss'), max: boss.hp, variant: 'boss', figures: false }, when: B('bossOn') }] : []),
    ] }] },
    // (the boss's name across the top as it comes in, one moment)
    ...(boss ? [{ use: 'region', props: { at: 'top', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 2.2, read: 0.6 } }] }] : []),
    // READY, flashing in the middle
    { use: 'region', props: { at: 'center', variant: 'bare' }, when: B('ready'), children: [{ use: 'text', props: { value: 'Ready', role: 'display' } }] },
    // the keys, for the first seconds
    { use: 'region', props: { at: 'bottom', variant: 'bare' }, when: B('keysOn'), children: [{ use: 'legend', props: { rows: B('keys') } }] },
  ] } };
}

// THE LOOK of its parts over the game's theme: each column a bar stood on its end (its track turned a quarter, so it
// fills from the foot), on black in a black and ink frame, its fill cut into BOSS_TICKS fine ticks (the genre's), the
// hero's split by heavy marks into its lives, the boss's in its own colour; READY flashes (twice a second, under the
// three a second the guidelines allow; still under less motion); what it puts away
const P = '#moj-mana-hud .mana-place[data-at=top-left]', H = 224, W = 24, TICK = `calc(${H - 6}px / ${BOSS_TICKS})`;
const SIDE_MAP_HUD_CSS = [
  `${P} .mana-stack{gap:10px;align-items:flex-start}`,
  `${P} .mana-bar{display:block;position:relative;min-width:0!important;width:${W}px;height:${H}px;padding:0;margin:0}`,
  `${P} .mana-bar .mana-label{display:none}`,
  `${P} .mana-bar .mana-track{position:absolute;left:0;top:${H}px;width:${H}px;height:${W}px;box-sizing:border-box;transform:rotate(-90deg);transform-origin:0 0;border:3px solid #000;border-radius:0;background:#000;box-shadow:0 0 0 2px var(--mana-ink),0 0 0 4px #000}`,
  `${P} .mana-bar .mana-track i{background:linear-gradient(90deg,var(--mana-hp) 0 62%,transparent 62%) 0 0/${TICK} 100% repeat-x!important}`,
  `${P} .mana-bar[data-variant=boss] .mana-track i{background:linear-gradient(90deg,var(--mana-boss) 0 62%,transparent 62%) 0 0/${TICK} 100% repeat-x!important}`,
  `${P} .mana-bar .mana-track b{top:0;bottom:0;width:6px;margin-left:-3px;background:#000;outline:0}`,
  '#moj-mana-hud .mana-place[data-at=center] .mana-text[data-role=display]{letter-spacing:.3em;animation:mana-pulse .5s steps(2,jump-none) infinite}',
  '#moj-mana-hud .mana-root[data-motion=reduced] .mana-place[data-at=center] .mana-text{animation:none}',
  '@media (prefers-reduced-motion:reduce){#moj-mana-hud .mana-place[data-at=center] .mana-text{animation:none}}',
  '.moj-c-radar,div:has(>#__wepIcon){display:none!important}',
].join('\n');

/** A side map level's `manaHud` (see the header). */
export function sideMapHud({ theme, lives = 3, boss = null, keys = '' } = {}) {
  const B0 = boss && typeof boss.id === 'string' && Number.isFinite(boss.hp) && boss.hp > 0 ? { id: boss.id, name: String(boss.name || ''), hp: boss.hp } : null;
  const L = Math.max(1, Math.round(lives));
  return { spec: sideMapHudSpec({ lives: L, boss: B0 }), theme, css: SIDE_MAP_HUD_CSS, feed: { sidemap: { lives: L, ...(B0 ? { boss: B0 } : {}), keys: keyRowsOf(keys) } } };
}
