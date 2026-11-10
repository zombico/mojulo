/**
 * THE MOUNT LANE — a greybox lane for a game's hero and its horse (lib/graph/mount/, the controllable runtime's `ride`
 * rule, its getting on and off: worlds/controllable/mount.js): get on, ride up through the gaits, time them, jump the
 * fences, turn, get off. Built from the world alone, before any level: the run's hero where made, else a stand-in on the
 * template's body; the world's first horse's coat (its `mounts`).
 *
 * THE LANE (metres, along +y): the start line at 0, a post either side every 10 m (red at each 50), the 100 m split timed
 * from the start line; three fences across it (0.5, 0.8 and 1.1 m: the horse clears up to its `jump.clear`, and is
 * pulled up at one above it); open ground past 200 m to turn, a ring of pylons 15 m round. The horse stands at the start,
 * saddled, the hero beside it.
 *
 *   mountLane(G, { refs?, cast?, coat?, sound? }) → { manifest, coat, fences: [[y, height]], start: { hero, horse } }
 *   LANE_LEGEND   the keys
 *
 * Pure. Its page (practice-room-page.js mountLaneHtml) sets each gait's speed and the jump's clearance beside the live ones.
 */
import { feelRule } from './feel/lower.js';
import { playerWorld } from '../playscape/player.js';
import { sfxSound } from '../sfx-shelf/resolve.js';

export const FENCES = Object.freeze([[60, 0.5], [110, 0.8], [160, 1.1]]);
export const LANE_START = Object.freeze({ hero: [-2.4, -6, 0], horse: [0, -6, 0] });
export const LANE_LEGEND = 'E  get on / off · W  urge on (up through the gaits) · S  check, rein back · A / D  turn · Space  jump (a trot or faster) · K  back to the start · H  HUD';

/** The lane's ground: 5 m tiles (a grey field, the lane in sand), the posts, the fences, the turning ring. */
function laneGround() {
  const X0 = -30, X1 = 30, Y0 = -20, Y1 = 240, TILE = 5, faces = [], colliders = [];
  const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });
  for (let x = X0; x < X1; x += TILE) for (let y = Y0; y < Y1; y += TILE) {
    const lane = x >= -5 && x < 5 && y >= 0 && y < 200;
    faces.push(quad([x, y, 0], [x + TILE, y, 0], [x + TILE, y + TILE, 0], [x, y + TILE, 0], lane ? (((y / TILE) | 0) % 2 ? '#b9a27c' : '#c4ad86') : (((x + y) / TILE) % 2 ? '#7f8a74' : '#8a947e'), lane ? 'lane:sand' : 'lane:field'));
  }
  const box = (x0, y0, x1, y1, h, fill, group, solid = true) => {
    faces.push(quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group),
      quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
      quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group));
    if (solid) colliders.push({ min: [x0, y0, 0], max: [x1, y1, h], hold: false });
  };
  box(-5, -0.15, 5, 0.15, 0.02, '#f2efe6', 'lane:line', false);
  box(-5, 99.85, 5, 100.15, 0.02, '#f2efe6', 'lane:line', false);
  for (let y = 0; y <= 200; y += 10) for (const x of [-5.6, 5.4]) box(x, y - 0.1, x + 0.2, y + 0.1, y % 50 ? 1.0 : 1.6, y % 50 ? '#e9e5da' : '#c8473b', 'lane:post', false);
  for (const [y, h] of FENCES) { box(-5, y - 0.15, 5, y + 0.15, h, '#8b5a3c', 'lane:fence'); for (const x of [-5.3, 5.0]) box(x, y - 0.2, x + 0.3, y + 0.2, h + 0.3, '#5f3e2a', 'lane:standard', false); }
  for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI; box(15 * Math.cos(a) - 0.3, 220 + 15 * Math.sin(a) - 0.3, 15 * Math.cos(a) + 0.3, 220 + 15 * Math.sin(a) + 0.3, 0.9, '#e0873a', 'lane:pylon', false); }
  return { faces, colliders };
}

/** The mount lane (see the header). */
export function mountLane(G, { refs = {}, cast = 'male', coat = null, sound = 'realistic' } = {}) {
  const own = typeof refs.hero === 'string';
  // (the game's horse: its first mount's coat, else a bay)
  const coatOf = coat ?? (Array.isArray(G.mounts) ? G.mounts[0]?.coat : null) ?? 'bay';
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'mount lane', controls: LANE_LEGEND, ...(G.feel != null ? { rule: feelRule(G.feel) } : {}) });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, hero: { cast } } };
  const e0 = P.entities[0];
  const soundOf = (word) => { const v = sound === 'none' ? null : sfxSound(word, { style: sound }); return v && v.gestures ? v.gestures : null; };
  const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land');
  const audio = step ? { footsteps: Object.fromEntries(Object.entries({ step, jump, land }).filter(([, v]) => v)) } : null;
  const { faces, colliders } = laneGround();
  const manifest = {
    kind: 'controllable', title: `Mount lane · ${G.name ?? G.id ?? 'game'}`, bg: '#a9c0cf', faces, colliders, figures,
    entities: [{ ...e0, transform: { pos: LANE_START.hero.slice(), heading: Math.PI / 2 } }], camera: P.camera,
    mounts: [{ at: LANE_START.horse.slice(0, 2), heading: Math.PI / 2, coat: coatOf }], ...(audio ? { audio } : {}), events: { ...(P.events ?? {}) },
  };
  return { manifest, coat: coatOf, fences: FENCES.map((f) => f.slice()), start: { hero: LANE_START.hero.slice(), horse: LANE_START.horse.slice() } };
}
