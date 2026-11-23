/**
 * THE RACE'S HUD — what a race on a roadway shows in play (the `laps` mechanic, game/mechanics.js, round a track,
 * roads/track.js), as ONE composition on mana-ui (docs/mana-ui.md), drawn by the level page's HUD host
 * (scene/channels/mana-hud.js, its `kind: 'race'` feed). A race is a forward runner read from behind its kart
 * (docs/course-dress-principles.md): the top third is where the track comes from, the bottom third is the kart's. So the
 * HUD keeps to the corners and the right edge, and nothing stands over the kart or the way ahead.
 *
 *   top-left     your place, large (2nd), over the field (/ 6): the one number a racer reads first. A race with no
 *                rivals shows none
 *   top-right    the lap of the laps (LAP 2/3), this lap's time, and the best lap once there is one
 *   right        the track's map: its line as a dotted route, you and the field on it (a wide frame only)
 *   bottom-right the speed on a dial, in the corner, clear of the kart
 *   centre       the moments: the final lap, the finish with the place
 *   the lights   a screen (it holds the karts and freezes the race's clock): five lights coming on one a beat, then out
 *                together for GO, as a start gantry's do (roads/race-control.js)
 *   (a tall frame: the place and the lap on one plate at the top's middle, no map; the speed in the corner)
 *
 *   raceHud(race, { theme?, screen?, words? }) → { spec, theme, feed } (a level manifest's `manaHud`)
 *     race    { mech, laps, racers, outline?, speedMax?, language?, items? }
 *             mech      the laps mechanic's index in the level's mechanics (its bus vars are `__lap_<mech>` …)
 *             laps      times round; racers: the field, you included (1 alone)
 *             outline   the track's line, [[x, y], …] in metres (its stations): drawn as the map's route
 *             speedMax  the dial's top, km/h; language: the track's design language (its `ui` is its HUD's look)
 *             items     the track lays item boxes (roads/kart-items.js): the held item's slot at the top's middle,
 *                       its pictogram alone (no words), its key in its corner
 *     theme   a mana-ui theme (a preset's or a card's name, or a child theme): the language's look unsaid
 *     words   the HUD's words (pos, lap, time, best, go, final, finish, unit, ready, use), so a game in another language says its own
 *   RACE_HUD_STATE   the state's shape, with the values a sheet or a test draws it on
 *
 * The state the spec binds (the host writes it):
 *   race { place, of, placeSays, field, lap, laps, lapSays, time, best, hasBest, speed, speedMax, markers, solo, hasItem, itemSays,
 *          itemIcon }
 *   start { lit, of, lights, sub } (lights: the lit ones said as marks)   moments [{ id, text, sub?, weight? }]
 *   fx { finish, best }   the screen effects' triggers: the finish (confetti), each lap better than the best (sparkles)
 * Pure: a spec is data.
 */
import { THEMES } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';

const B = (path) => ({ bind: path });
const r3 = (v) => Math.round(v * 1000) / 1000;

export const RACE_HUD_STATE = Object.freeze({
  race: { place: 2, of: 6, placeSays: '2nd', field: '/ 6', lap: 2, laps: 3, lapSays: '2/3', time: 41.3, best: 39.8, hasBest: true, speed: 62, speedMax: 90, solo: false, hasItem: true, itemSays: 'GUMBALL', itemIcon: 'ball',
    markers: [{ x: 0.3, y: 0.4, kind: 'self' }, { x: 0.35, y: 0.32, kind: 'foe' }] },
  start: { lit: 3, of: 5, lights: '● ● ● ○ ○', sub: 'get ready' },
  moments: [],
  fx: { finish: 0, best: 0 },
});
/** The look a race wears unless its game says one: its track's language's, else a kart's or a circuit's. */
export const RACE_LOOKS = Object.freeze({ candy: 'kart-candy', 'grand-prix': 'pit-wall', kart: 'kart-candy', circuit: 'pit-wall' });
/** The dial's top by class, km/h, where the kart's own top speed is not known (roads/classes.js: a kart's 70, a GT's 250). */
export const RACE_DIAL = Object.freeze({ kart: 90, circuit: 280, rally: 200, stadium: 220 });
/** The route's dots: how many round the map (a lap's line resampled), and the map's margin. */
export const ROUTE = Object.freeze({ dots: 56, margin: 0.08 });

/** A track's line, in metres, as the map's route: resampled to ROUTE.dots, laid in the map's square (north up), with
 *  the frame that turns a place on the track into the map's x, y. */
export function raceMap(outline) {
  if (!Array.isArray(outline) || outline.length < 3) return null;
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0, 1), k = (1 - 2 * ROUTE.margin) / span;
  const cx = (Math.max(...xs) - x0) * k, cy = (Math.max(...ys) - y0) * k, ox = ROUTE.margin + (1 - 2 * ROUTE.margin - cx) / 2, oy = ROUTE.margin + (1 - 2 * ROUTE.margin - cy) / 2;
  const frame = { x0: r3(x0), y0: r3(y0), k: Math.round(k * 1e6) / 1e6, ox: r3(ox), oy: r3(oy) };
  const at = (p) => ({ x: r3(frame.ox + (p[0] - x0) * k), y: r3(1 - (frame.oy + (p[1] - y0) * k)) });
  // (the whole lap, evenly: a station every n / dots along it)
  const n = outline.length, step = Math.max(1, n / ROUTE.dots), route = [];
  for (let k = 0; k * step < n && route.length < ROUTE.dots; k++) route.push(at(outline[Math.floor(k * step)]));
  return { route, frame };
}

export function raceHud(race, { theme = null, screen = null, words = {} } = {}) {
  const portrait = !!screen && (screen === 'phone' || screen.pole === 'phone' || screen.orientation === 'portrait');
  const w = { pos: 'pos', lap: 'lap', time: 'time', best: 'best', go: 'go', final: 'final lap', finish: 'finish', unit: 'km/h', ready: 'get ready', use: 'F', ...words };
  const laps = Number.isInteger(race.laps) && race.laps > 0 ? race.laps : 1, racers = Number.isInteger(race.racers) && race.racers > 0 ? race.racers : 1;
  const map = raceMap(race.outline), TALL = { frame: 'portrait' }, field = racers > 1;
  // the parts
  const place = { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'end' }, children: [
    { use: 'text', props: { value: B('race.placeSays'), role: 'display' } }, { use: 'text', props: { value: B('race.field'), role: 'label' } }] };
  const lap = { use: 'counter', props: { label: w.lap, value: B('race.lapSays') } };
  const times = { use: 'stack', props: { dir: 'column', gap: 'tight', align: 'end' }, children: [
    { use: 'timer', props: { seconds: B('race.time'), format: 'mmss', label: w.time } },
    { use: 'timer', props: { seconds: B('race.best'), format: 'mmss', label: w.best }, when: B('race.hasBest') }] };
  const speed = { use: 'region', props: { at: 'bottom-right' }, children: [{ use: 'gauge', props: { value: B('race.speed'), max: B('race.speedMax'), unit: w.unit } }] };
  // the HELD ITEM (a race with item boxes): one large slot at the top's middle, there all race, its pictogram filling it
  // and the key that uses it in its corner; empty, its frame dashed. No words: it is read at a glance, as a genre's
  // item box is, never read through (mana-ui's `slot`, its own frame: the region under it bare)
  // (active while one is held: its frame the accent, so a box just taken catches the eye)
  const held = { use: 'slot', props: { name: B('race.itemIcon'), key: w.use, size: 'l', active: B('race.hasItem') } };
  const item = race.items ? [{ use: 'region', props: { at: 'top', variant: 'bare' }, unless: TALL, children: [held] }] : [];
  const moments = { use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 1.1, read: 0.4 } }] };
  // ONE composition, laid by the frame it is drawn in. A wide frame: the place in the top-left corner, the laps and the
  // times in the top-right, the map on the right edge; a tall one: the place and the lap on one plate in the top's middle
  const hud = { use: 'hud', children: [
    ...(field ? [{ use: 'region', props: { at: 'top-left' }, unless: TALL, children: [place] }] : []),
    { use: 'region', props: { at: 'top-right' }, unless: TALL, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'end' }, children: [...(laps > 1 ? [lap] : []), times] }] },
    ...(map ? [{ use: 'region', props: { at: 'right' }, unless: TALL, children: [{ use: 'minimap', props: { markers: B('race.markers'), route: map.route, shape: 'round' } }] }] : []),
    { use: 'region', props: { at: 'top' }, when: TALL, children: [{ use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [...(field ? [place] : []), ...(laps > 1 ? [lap] : []), { use: 'timer', props: { seconds: B('race.time'), format: 'mmss' } }] }] },
    ...item, speed, moments,
    // the screen's effects (mana-ui's `effect`: pure CSS over everything, catching nothing): confetti on the finish,
    // sparkles on a lap better than the best
    { use: 'effect', props: { kind: 'confetti', on: B('fx.finish') } }, { use: 'effect', props: { kind: 'sparkles', on: B('fx.best'), count: 24 } }] };
  // the lights are a SCREEN: while one is up the karts are held, and the host freezes the race's clock until GO
  // (the lights as large as the title's words, on a plate: read at a glance, as a gantry's are from the grid)
  const ready = { use: 'screen', props: { layer: 'overlay', place: 'center', legend: 'none' }, children: [{ use: 'window', props: { variant: 'plain' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [
    { use: 'text', props: { value: B('start.lights'), role: 'display' } }, { use: 'text', props: { value: B('start.sub'), role: 'label' } }] }] }] };
  // (a card's name is resolved here to the theme it is: the page's channel reads a theme, never a shelf)
  const named = theme ?? RACE_LOOKS[race.language] ?? RACE_LOOKS[race.cls] ?? 'kart-candy', base = typeof named === 'string' && !THEMES[named] ? cardTheme(named) : named;
  return {
    spec: { screens: { ready }, hud },
    theme: portrait ? (typeof base === 'string' ? { from: base, distance: 'hand' } : { ...base, distance: 'hand' }) : base,
    feed: { kind: 'race', mech: race.mech ?? 0, laps, racers, ...(race.items ? { items: true } : {}), lights: { count: 5, every: 0.8, hold: 0.6 }, words: { go: w.go.toUpperCase(), final: w.final.toUpperCase(), finish: w.finish.toUpperCase(), ready: w.ready },
      speedMax: Number.isFinite(race.speedMax) && race.speedMax > 0 ? race.speedMax : 120, ...(map ? { frame: map.frame } : {}) },
  };
}
