/**
 * THE STUNT ROOM — the practice room for a cinematic action game: one set piece (set-piece.js) on a greybox of rooftops,
 * played before there are levels. The hero runs the roofs east on a chase line, jumps a gap onto a roof whose edge gives
 * (a slowed Grab), is shaken by a blast as it runs on, turns north, drops onto a lower roof and climbs its lip (a mashed
 * Climb), while the camera is directed along the way: low behind, then ahead looking back, a low cut for the jump, wide
 * for the blast, beside, over the shoulder. Built from the world alone: the run's hero where made, else the template's
 * star, Tariq (lost-nomad.js).
 *
 *   stuntRoom(G, { refs?, cast? }) → { manifest, setPiece, laws, roofs, hero: 'own' | 'stand-in' }
 *     setPiece  the set piece it lays (its line, cams, beats and prompts), said on the page
 *     laws      setPieceLaws on it: advice
 *     roofs     [[what it is, [x0, y0, x1, y1, height]]]
 *   STUNT_LEGEND   the keys
 *
 * Pure. A practice room's manifest: the page is the World page's, the chase line, the track camera and the prompts its
 * opt-in channels.
 */
import { feelRule } from './feel/lower.js';
import { floorOf } from './practice-room.js';
import { playerWorld } from '../playscape/player.js';
import { lowerSetPiece, setPieceLaws } from './set-piece.js';
import { TARIQ } from './lost-nomad.js';

const ROOF = '#b49a7c', LOW = '#9c8468', LIP = '#8a6f55';
const H = 6;   // the roofs' height (m)
// the roofs: a run east, a gap, the next roof, a turn north, a drop onto a lower roof with a lip to climb
export const ROOFS = Object.freeze([
  ['the first roof', [-3, -4, 18, 4, H], ROOF],
  ['the far roof (a 3 m gap)', [21, -4, 42, 4, H], ROOF],
  ['the roof north', [34, 4, 42, 20, H], ROOF],
  ['the lower roof (a 2 m drop)', [34, 22.5, 42, 36, H - 2], LOW],
  ['its lip', [34, 36, 42, 37, H - 0.9], LIP],
]);
// the set piece on them: its line down the middle of the roofs, east then north
export const STUNT_SET_PIECE = Object.freeze({
  id: 'rooftops', line: [[0, 0], [38, 0], [38, 34]], half: 2.6, z: H,
  cams: [
    { at: 0, frame: 'chase' },
    { at: 7, frame: 'lead', fov: 68 },
    { at: 17, frame: 'low', cut: true },
    { at: 24, frame: 'chase' },
    { at: 30, frame: 'wide', shake: 0.5 },
    { at: 40, frame: 'profile', cut: true },
    { at: 55, frame: 'over' },
  ],
  beats: [
    { at: 21.5, id: 'edge', do: [{ shake: 0.5 }, { puff: { at: [21.5, 0, H], is: 'dust' } }] },
    { at: 31, id: 'blast', do: [{ explode: { at: [36, -6, H] } }, { shake: 0.9 }] },
  ],
  // (two of them behind the hero down the way: the lead frame shows them over its shoulder)
  pursuers: [{ id: 'pursuer-1', gap: 7 }, { id: 'pursuer-2', gap: 9 }],
  prompts: [
    { at: 22.5, id: 'grab', says: 'Grab', slow: 0.3, then: { say: 'Hold on', as: 'toast' } },
    { at: 62, id: 'climb', kind: 'mash', count: 5, window: 1.2, says: 'Climb' },
  ],
});
export const STUNT_LEGEND = 'W A S D  run (down the way, whichever way the camera looks) · Space  jump · F  sprint · E  the prompt\'s button · K  reset';

/** The stunt room (see the header). */
export function stuntRoom(G, { refs = {}, cast = 'male' } = {}) {
  const own = typeof refs.hero === 'string';
  const rule = { ...(G.feel != null ? feelRule(G.feel) : {}), move: 'camera' };
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'stunt room', controls: STUNT_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero;
  // (the star: the world's own hero where made, else Lost Nomad's, Tariq; `cast: 'stand-in'` a plain stand-in for a quick page)
  const figures = { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, hero: cast === 'stand-in' ? { cast: 'male' } : TARIQ } };
  const e0 = P.entities[0];
  const hero = { ...e0, body: { ...e0.body, hittable: true, hp: 100 }, transform: { pos: [1, 0, H], heading: 0 } };
  const { faces, colliders } = floorOf({ half: 45, blocks: ROOFS.map(([, [x0, y0, x1, y1, h], fill], k) => ({ id: `roof-${k + 1}`, x: [x0, x1], y: [y0, y1], h, fill, group: 'room:roofs' })) });
  const sp = STUNT_SET_PIECE, L = lowerSetPiece(sp);
  const manifest = {
    kind: 'controllable', title: `Stunt room · ${G.name ?? G.id ?? 'game'}`, bg: '#1c1a18', faces, colliders, figures: { ...figures, ...(L.figures ?? {}) }, entities: [hero, ...(L.entities ?? [])],
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, events: { ...(P.events ?? {}) },
    chase: L.chase, prompts: L.prompts, ...(L.tempo ? { tempo: L.tempo } : {}), play: { cues: L.cues },
  };
  return { manifest, setPiece: sp, laws: setPieceLaws(sp), roofs: ROOFS.map(([n, b]) => [n, b]), hero: own ? 'own' : 'stand-in' };
}
