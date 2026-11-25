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
 *   the minimap   at the top right, on her: the map of the screens walked round her (boxMapView), north up
 *   the boss      its bar under the minimap while she is in its room and it stands, its name over it
 *   what is held  the powers and keys she holds, in a line at the foot's left
 *
 *   THE SCREEN (it holds the level while it is up)
 *   pause         on the menu key: the map of the screens she has walked, revealed a screen at a time as she enters it
 *                 (a room's screens joined, the walls between rooms and the doors through them, a gate at its door until
 *                 she holds what opens it, a relic where it lies until taken, the save rooms found, the bosses still
 *                 standing, the screen she stands in), her vitals and her rooms and wakings counted, the relics of the
 *                 box (each found by name, the rest locked); back resumes
 *
 *   boxMapOf({ layout, screen, held }) → the map as data: cells, joins, doors, relics, rooms' middles, the minimap's zoom
 *   boxMapView(map, { seen, here, held, taken, felled, broken }) → { shapes, markers, rooms, focus }: what it shows
 *                (import-free); a secret's prize hidden until its wall is broken
 *   BOX_MAP      the map's measures
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
 * bossOn, bossName, boss, bossMax, heldWord, hasHeld, shapes, markers, focus, zoom, relics, roomsWord, wakeWord }. Pure: a spec is data.
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
      // THE MINIMAP, top right, on her: the screens walked round her; THE BOSS under it, its name over its bar, while she
      // is in its room and it stands
      { use: 'region', props: { at: 'top-right', variant: 'bare' }, children: [col([
        { use: 'map', props: { shapes: B('shapes'), markers: B('markers'), view: 'plan', focus: B('focus'), zoom: B('zoom'), size: 'corner' } },
        { ...col([T(B('bossName'), 'heading'), { use: 'bar', props: { value: B('boss'), max: B('bossMax'), variant: 'boss', figures: false } }], { gap: 'tight', align: 'end' }), when: B('bossOn') },
      ], { gap: 'normal', align: 'end' })] },
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

/** THE MAP's measures: a cell's inset (a share of a cell: the wall between rooms), a door's width across it (a share),
 * and how many cells the minimap shows across */
export const BOX_MAP = Object.freeze({ gap: 0.07, door: 0.34, mini: 5 });

/**
 * The box's map as data, in the map's units (the box a square from 0 to 1, north up): each room's cells as squares inset
 * so the walls between rooms read, the joins between a room's own cells, the doors through the walls (a gate's kind and
 * the token that opens it), the relics where they lie, each room's middle (a save room's, a boss's). What is shown of
 * it is the view's (boxMapView).
 */
export function boxMapOf({ layout: L, screen, held }) {
  const [cols, rows] = L.box, u = 1 / Math.max(cols, rows), ox = (1 - cols * u) / 2, oy = (1 - rows * u) / 2, g = u * BOX_MAP.gap, D = u * BOX_MAP.door;
  const at = (c, r) => r * cols + c, X = (c) => ox + c * u, Y = (r) => oy + (rows - r - 1) * u, roomOf = new Map();
  L.rooms.forEach((R, k) => { for (const [c, r] of R.cells) roomOf.set(at(c, r), k); });
  const box = (x, y, w, h) => ({ x: r3(x), y: r3(y), w: r3(w), h: r3(h) });
  const cells = [...roomOf.keys()].sort((a, b) => a - b).map((i) => { const c = i % cols, r = Math.floor(i / cols); return { i, room: roomOf.get(i), ...box(X(c) + g, Y(r) + g, u - 2 * g, u - 2 * g) }; });
  // (a room's own cells joined across the wall a cell's inset would leave: east, and up)
  const joins = [];
  for (const { i, room } of cells) {
    const c = i % cols, r = Math.floor(i / cols);
    if (c + 1 < cols && roomOf.get(at(c + 1, r)) === room) joins.push({ a: i, b: at(c + 1, r), ...box(X(c + 1) - g, Y(r) + g, 2 * g, u - 2 * g) });
    if (r + 1 < rows && roomOf.get(at(c, r + 1)) === room) joins.push({ a: i, b: at(c, r + 1), ...box(X(c) + g, Y(r) - g, u - 2 * g, 2 * g) });
  }
  // (the doors through the walls between rooms, a gate's marked with what opens it: its held gate's token, a sill's power)
  const doors = L.doors.map((d) => {
    const [[c1, r1], [c2, r2]] = d.cells, a = at(c1, r1), b = at(c2, r2), side = r1 === r2;
    const rect = side ? box(X(Math.max(c1, c2)) - g, Y(r1) + u / 2 - D / 2, 2 * g, D) : box(X(c1) + u / 2 - D / 2, Y(Math.max(r1, r2)) + u - g, D, 2 * g);
    const hg = d.gate ? (held.gates || []).find((x) => x.id === `gate-${d.id}`) : null;
    return { a, b, ...rect, ...(d.gate ? { gate: d.gate, opens: hg ? hg.opens : `gate:${d.gate}` } : {}) };
  });
  // (a prize behind a SECRET wall is no one's to see until the wall is down: its wall's breakable named on it)
  const secretOf = (x) => { const m = /^prize:(.+):(\d+)$/.exec(x.gives); const R = m && L.rooms.find((q) => q.id === m[1]), p = R && R.pockets[Number(m[2])]; return p && p.gate === 'secret' ? `pocket-${R.id}-${m[2]}` : null; };
  const relics = (held.relics || []).map((x) => {
    const s = x.at[1], z = x.at[2], c = Math.floor(s / screen.width), r = Math.floor(z / screen.height), sec = secretOf(x);
    return { id: x.id, cell: at(c, r), x: r3(ox + (s / screen.width) * u), y: r3(oy + (rows - z / screen.height) * u), name: x.name, kind: x.gives.startsWith('key:') ? 'key' : x.gives.startsWith('prize:') ? 'prize' : 'power', ...(sec ? { secret: sec } : {}) };
  });
  const middles = L.rooms.map((R) => { const [c, r, w, h] = R.rect; return { x: r3(X(c) + (w * u) / 2), y: r3(Y(r + h - 1) + (h * u) / 2), ...(R.save ? { save: true } : {}), ...(R.boss ? { boss: R.boss, id: R.id } : {}) }; });
  return { cols, rows, u: r3(u), cells, joins, doors, relics, rooms: middles, zoom: r3(Math.max(cols, rows) / BOX_MAP.mini) };
}

/**
 * What the map shows (import-free: the page runs this source): `seen` the cells walked ({ <cell>: 1 }), `here` the cell
 * she stands in, `held` the tokens she holds, `taken` the relics taken, `felled` the bosses felled (the held gates'
 * state), `broken` the breakables broken ({ <id>: 1 }: a secret's prize shown once its wall is down). → { shapes, markers,
 * rooms: the rooms seen, focus: her cell's middle }
 */
export function boxMapView(M, S) {
  const seen = S.seen || {}, held = S.held || {}, taken = S.taken || {}, felled = S.felled || {}, broken = S.broken || {}, here = S.here == null ? -1 : S.here;
  const shapes = [], markers = [], rooms = {};
  let focus = { x: 0.5, y: 0.5 };
  for (const C of M.cells) {
    if (!seen[C.i]) continue;
    rooms[C.room] = 1;
    shapes.push({ kind: C.i === here ? 'park' : 'building', x: C.x, y: C.y, w: C.w, h: C.h });
    if (C.i === here) focus = { x: C.x + C.w / 2, y: C.y + C.h / 2 };
  }
  for (const J of M.joins) if (seen[J.a] && seen[J.b]) shapes.push({ kind: 'building', x: J.x, y: J.y, w: J.w, h: J.h });
  for (const D of M.doors) {
    if (!seen[D.a] && !seen[D.b]) continue;
    shapes.push({ kind: 'walk', x: D.x, y: D.y, w: D.w, h: D.h });
    if (D.gate && held[D.opens] == null) markers.push({ x: D.x + D.w / 2, y: D.y + D.h / 2, kind: 'poi', icon: 'lock', label: D.gate });
  }
  for (const R of M.relics) if (seen[R.cell] && taken[R.id] == null && !(R.secret && !broken[R.secret])) markers.push({ x: R.x, y: R.y, kind: 'item', icon: R.kind === 'key' ? 'key' : R.kind === 'power' ? 'star' : 'gem', label: R.name });
  M.rooms.forEach((R, k) => {
    if (!rooms[k]) return;
    if (R.save) markers.push({ x: R.x, y: R.y, kind: 'goal', label: 'Save' });
    if (R.boss && felled['boss-' + R.id] == null) markers.push({ x: R.x, y: R.y, kind: 'foe', label: R.boss });
  });
  if (here >= 0 && seen[here]) markers.push({ x: focus.x, y: focus.y, kind: 'self', you: true, heading: 90 });
  return { shapes, markers, rooms: Object.keys(rooms).length, focus };
}

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
    feed: { box: { screen: [r3(screen.width), r3(screen.height)], cols, rows, cells, rooms, rings: L.rings.map((g) => cap(g.place)), relics, bosses, bossHp, menuKey: BOX_MENU_KEY, map: boxMapOf({ layout: L, screen, held }) } },
    ...(sounds ? { sounds } : {}),
  };
}
