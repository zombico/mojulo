/**
 * THE BOX'S HUD AND PAUSE — a metroidvania read as the castle games read: the hero's vitals in the top left and nothing
 * else over the play but what the moment calls for. On the game UI runtime (docs/mana-ui.md "The metroidvania's HUD"),
 * hosted by the level page's HUD host (scene/channels/mana-hud.js, its `box` feed), in the game's look (Vampire
 * Sonata's is the `nocturne` card, re-keyed with the box's theme: BOX_LOOKS).
 *
 *   the vitals    her health and her MP as bars at the top left, their figures beside them, the place she stands in
 *                 over them (the room's locale, else its ring's)
 *   the moments   said in a banner across the top, one at a time by weight: a power found (rare: held longer, its own
 *                 cue), a key, a prize, "Saved", a waking, a boss's fall; a new region's name as she crosses into it;
 *                 a boss's name as she comes into its room
 *   the boss      its bar at the top right while she is in its room and it stands, its name over it
 *   what is held  the powers and keys she holds, in a line at the foot's left
 *
 *   THE SCREEN (it holds the level while it is up)
 *   pause         on the menu key: the map of the rooms she has walked (the one she stands in marked, the save rooms she
 *                 has found, the bosses still standing), her vitals and her rooms and wakings counted, the relics of the
 *                 box (each found by name, the rest locked); back resumes
 *
 *   boxHud({ theme, layout, screen, held, bosses, sounds? }) → a level manifest's `manaHud`: { spec, theme, feed: { box },
 *                 css, sounds? }
 *     layout   the box's layout (box.js layBox): its rooms (their rect, ring, kind, save, boss), its rings' places
 *     screen   { width, height } a cell's metres (rooms.js greyboxOf)
 *     held     the box's held gates' spec (scene.js boxOf `held`): its relics, bosses and saves
 *     looks    each room's look, by id: its locale's place, where it has one
 *     bossHp   a boss stand-in's blows (scene.js BOSS_HP), its bar's length
 *     sounds   what the page carries to hear it (scene/channels/mana-hud-sounds.js hudSounds), or null
 *   BOX_LOOKS    the card each box theme's HUD wears (a re-key's own)
 *   BOX_MENU_KEY the key that opens the pause
 *
 * The state the spec binds (the host writes it each frame): bx { place, hp, hpMax, mp, mpMax, hpWord, mpWord, moments,
 * bossOn, bossName, boss, bossMax, heldWord, hasHeld, shapes, markers, relics, roomsWord, wakeWord }. Pure: a spec is data.
 */
export const BOX_MENU_KEY = 'Enter';
/** The card a box theme's HUD wears: the castle's nocturne, its re-keys' own. */
export const BOX_LOOKS = Object.freeze({ castle: 'nocturne', 'castle-frost': 'nocturne-frost', 'castle-blood': 'nocturne-blood', xeno: 'nocturne-xeno' });

const B = (p) => ({ bind: `bx.${p}` });
const I = (p) => ({ item: p });
const T = (value, role, more = {}) => ({ use: 'text', props: { value, role, ...more } });
const row = (children, props = {}) => ({ use: 'stack', props: { dir: 'row', ...props }, children });
const col = (children, props = {}) => ({ use: 'stack', props, children });
const bars = (figures) => [
  { use: 'bar', props: { label: 'HP', value: B('hp'), max: B('hpMax'), variant: 'hp', figures } },
  { use: 'bar', props: { label: 'MP', value: B('mp'), max: B('mpMax'), variant: 'mp', figures } },
];

/** The spec it draws (see the header). */
export function boxHudSpec() {
  return {
    screens: {
      pause: { use: 'screen', props: { title: 'Paused', place: 'full' }, children: [row([
        { use: 'window', props: { title: 'The castle' }, children: [{ use: 'map', props: { shapes: B('shapes'), markers: B('markers'), view: 'plan', size: 'panel' } }] },
        col([
          { use: 'window', props: { title: B('place') }, children: [col([...bars(true),
            row([{ use: 'counter', props: { label: 'Rooms', value: B('roomsWord'), icon: 'map' } }, { use: 'counter', props: { label: 'Woken', value: B('wakeWord'), icon: 'heart' } }], { gap: 'loose' })], { gap: 'normal' })] },
          { use: 'window', props: { title: 'Relics' }, children: [{ use: 'list', id: 'relics', props: { rows: B('relics'), row: row([{ use: 'icon', props: { name: I('icon'), size: 's' } }, T(I('name'), 'body')]) } }] },
        ], { gap: 'normal' }),
      ], { gap: 'loose', align: 'start' })] },
    },
    hud: { use: 'hud', children: [
      // THE VITALS: the place she stands in, her health and her MP, top left
      { use: 'region', props: { at: 'top-left', variant: 'bare' }, children: [col([T(B('place'), 'label'), ...bars(false)], { gap: 'tight' })] },
      // THE MOMENTS: across the top, one at a time
      { use: 'region', props: { at: 'top', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 2.6, read: 0.8 } }] },
      // THE BOSS: its name over its bar, top right, while she is in its room and it stands
      { use: 'region', props: { at: 'top-right', variant: 'bare' }, when: B('bossOn'), children: [col([T(B('bossName'), 'heading'), { use: 'bar', props: { value: B('boss'), max: B('bossMax'), variant: 'boss', figures: false } }], { gap: 'tight', align: 'end' })] },
      // WHAT IS HELD: a line at the foot's left
      { use: 'region', props: { at: 'bottom-left', variant: 'bare' }, when: B('hasHeld'), children: [T(B('heldWord'), 'label')] },
    ] },
  };
}

// THE LOOK of its parts over the game's theme: the vitals long and slim, health over magic, figures off in play; the
// boss's bar wide; the pause's map large; the page's own vitals and toast (held-gates-view.js) give way to these
const H = '#moj-mana-hud';
const BOX_HUD_CSS = [
  // (clear of the page's own buttons in its top left corner)
  `${H} .mana-place[data-at=top-left]{padding-top:46px}`,
  `${H} .mana-place[data-at=top-left] .mana-bar{min-width:300px}`,
  `${H} .mana-place[data-at=top-left] .mana-bar[data-variant=mp] .mana-track{height:8px}`,
  `${H} .mana-place[data-at=top-right] .mana-bar{min-width:360px}`,
  `${H} .mana-place[data-at=top-right] .mana-text[data-role=heading]{color:var(--mana-boss,var(--mana-harm))}`,
  `${H} .mana-screen{pointer-events:auto}`,
  `${H} .mana-screen .mana-map{min-width:520px;min-height:360px}`,
].join('\n');

const r3 = (v) => Math.round(v * 1000) / 1000;
const cap = (s) => String(s || '').replace(/^the /i, 'The ');

/** A box level's `manaHud` (see the header). */
export function boxHud({ theme, layout: L, screen, held, looks = {}, bossHp = 1, sounds = null }) {
  const [cols, rows] = L.box, u = 1 / Math.max(cols, rows), ox = (1 - cols * u) / 2, oy = (1 - rows * u) / 2;
  // (the rooms on the map: a square of the box, north up, its rooms each a shape, their places named)
  const rooms = L.rooms.map((r) => { const [c, rr, w, h] = r.rect; return { id: r.id, ring: r.ring, place: cap(looks[r.id]?.place ?? L.rings[r.ring].place), x: r3(ox + c * u), y: r3(oy + (rows - rr - h) * u), w: r3(w * u), h: r3(h * u), ...(r.save ? { save: true } : {}), ...(r.boss ? { boss: r.boss } : {}) }; });
  const cells = Array.from({ length: cols * rows }, () => -1);
  L.rooms.forEach((r, k) => { for (const [c, rr] of r.cells) cells[rr * cols + c] = k; });
  const relics = (held.relics || []).map((x) => ({ id: x.id, name: x.name, kind: x.gives.startsWith('key:') ? 'key' : x.gives.startsWith('prize:') ? 'prize' : 'power' }));
  const bosses = (held.bosses || []).map((b) => ({ id: b.id, name: b.name.replace(/ falls.*$/, '') }));
  return {
    spec: boxHudSpec(), theme, css: BOX_HUD_CSS,
    feed: { box: { screen: [r3(screen.width), r3(screen.height)], cols, rows, cells, rooms, rings: L.rings.map((g) => cap(g.place)), relics, bosses, bossHp, menuKey: BOX_MENU_KEY } },
    ...(sounds ? { sounds } : {}),
  };
}
