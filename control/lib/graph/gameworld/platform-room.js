/**
 * THE PLATFORM ROOM — the practice room's sibling for a game tuned toward the platformer: its hero on a greybox course of
 * the moves its feel asks for (steps, a gap, a ledge for the double jump, a chimney for the wall kick), with walkers on
 * the floor, a platform and the ledge and a hopper on the floor to stomp, each felled one coming back. Built from the world
 * alone, before any level: the run's hero where made (else a stand-in on the template's body), the bestiary's walker and
 * hopper (made, or a person of their class standing in).
 *
 *   platformRoom(G, { refs?, cast?, sound? }) → { manifest, course, hero: 'own' | 'stand-in', foes: [{ id, class, made }] }
 *     refs   { hero?, foes?: { <bestiary id>: ref } } as practice-room.js takes them
 *     course [[what it tests, [x0, y0, x1, y1, height]]] the course's blocks, said on the page
 *   PLATFORM_LEGEND   the keys
 *
 * Pure. Its page (practice-room-page.js platformRoomHtml) sets the card's numbers beside the live ones.
 */
import { feelRule } from './feel/lower.js';
import { standFoe, bestiaryOf, stompOf } from './foes.js';
import { floorOf, dummyFigure } from './practice-room.js';
import { playerWorld } from '../playscape/player.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { PERSON } from './quick.js';

const STEP = '#a4917a', PLAT = '#7f8fa3', LEDGE = '#8a7fa3', CHIM = '#6f7c70';
// the course: what each block tests, and where it stands (metres)
export const COURSE = Object.freeze([
  ['the stair 0.6', [-10, -2, -8, 0, 0.6], STEP], ['the stair 1.2', [-10, 0, -8, 2, 1.2], STEP], ['the stair 1.8', [-10, 2, -8, 4, 1.8], STEP],
  ['the near platform 1.8', [-6, 3, -3, 7, 1.8], PLAT], ['the far platform 1.8 (a 2.5 m gap)', [-0.5, 3, 2.5, 7, 1.8], PLAT],
  ['the ledge 3.0 (the double jump)', [5, 3, 10, 8, 3], LEDGE],
  ['the chimney (5 m, 1.6 m apart: the wall kick)', [6, -9, 7, -4, 5], CHIM], ['', [8.6, -9, 9.6, -4, 5], CHIM],
]);
// where the foes stand: walkers on the floor, the near platform and the ledge, a hopper on the floor
const PLACES = Object.freeze([['walker', [-2, -4, 0], 0], ['walker', [1, 5, 1.8], Math.PI / 2], ['walker', [7.5, 5.5, 3], 0], ['hopper', [3, -6, 0], 0]]);
export const PLATFORM_LEGEND = 'W A S D  run · mouse  look · Space  jump (again in the air: the double jump; at a wall: the kick) · F  sprint · land on a foe: the stomp (Space held: higher) · Shift+F  foe AI · K  reset · H  HUD';

/** The platform room (see the header). */
export function platformRoom(G, { refs = {}, cast = 'male', sound = 'realistic' } = {}) {
  const own = typeof refs.hero === 'string';
  // THE HERO: on the feel's rule, moving where the camera looks, stomping as a level's hero stomps (foes.js stompOf) and
  // taking the foes' touches (hittable, a person's egg)
  const rule = { ...(G.feel != null ? feelRule(G.feel) : {}), move: 'camera', stomp: stompOf(G) };
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'platform room', controls: PLATFORM_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, hero: { cast } } };
  const e0 = P.entities[0];
  const heroE = { ...e0, body: { ...e0.body, hittable: true, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } }, transform: { pos: [0, -8, 0], heading: Math.PI / 2 } };

  // THE FOES: the bestiary's entry of each class (the world's own, else a stand-in's), made or a person of its class
  const B = bestiaryOf(G), part = { figures, entities: [heroE] }, foes = [];
  PLACES.forEach(([cls, at, heading], k) => {
    const eid = Object.keys(B).find((id) => B[id].class === cls) ?? null, entry = eid ? B[eid] : { class: cls }, made = !!eid && typeof refs.foes?.[eid] === 'string';
    standFoe(G, part, { id: `foe-${k + 1}`, eid: made ? eid : undefined, entry, at: at.slice(), heading }, made ? { ref: refs.foes[eid] } : { figure: dummyFigure(cast) });
    foes.push({ id: `foe-${k + 1}`, class: cls, made });
  });

  const { faces, colliders } = floorOf({ half: 12, blocks: COURSE.map(([, [x0, y0, x1, y1, h], fill], k) => ({ id: `course-${k + 1}`, x: [x0, x1], y: [y0, y1], h, fill, group: 'room:course' })) });
  const soundOf = (word) => { const v = sound === 'none' ? null : sfxSound(word, { style: sound }); return v && v.gestures ? v.gestures : null; };
  const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land');
  const audio = step ? { footsteps: Object.fromEntries(Object.entries({ step, jump, land }).filter(([, v]) => v)) } : null;
  const manifest = {
    kind: 'controllable', title: `Platform room · ${G.name ?? G.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures: part.figures, entities: part.entities,
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, ...(audio ? { audio } : {}), events: { ...(P.events ?? {}) },
  };
  return { manifest, course: COURSE.filter(([n]) => n).map(([n, b]) => [n, b]), hero: own ? 'own' : 'stand-in', foes };
}
