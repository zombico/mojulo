/**
 * THE BELT — the game room blown out to a beat 'em up's level: the room's own gameplay (the hero on its feel, the
 * bestiary's foes, the room's primitives) laid along a WAY that is walked along and across and seen from the side, cut
 * into screens held one after another until their waves are down (game/belt-mechanic.js).
 *
 *   the way      runs +y from 0; `depth` metres across (x from -depth/2 to depth/2), a back wall on the far side
 *                (-x), the camera on the near side (+x); a screen is SCREEN metres of it, the frame's width
 *   the brief    the game room's (gameroom/needs.js): the hero's run and jump, whether it fights, how many foes
 *   the hero     armed as the action room arms it (practice-room.js): the world's own where made, else a stand-in with
 *                the world's blade; its arsenal the world's, its feel's kit or the basic one; on the world's feel, moved
 *                in the screen's frame (`move: 'world'`: D along the way, W into it), hittable
 *   the foes     the bestiary's, stood dormant and woken by their wave at the screen's far side and its back: each
 *                screen two waves, each a foe more than the last; the first entry the rank and file, the second joining
 *                from the second screen's second wave
 *   the props    each screen a crate or a low cover or two against the back wall (the room's primitives: cover to round)
 *   the camera   the side camera, square to the way, its depth held (`keel`), kept inside the screen held (`ends`)
 *   the HUD      the mechanic's own rows (the hero's health, the screen, the foes left, GO) on the level's HUD host
 *
 *   beltRoom(G, { refs?, cast?, feel?, seed?, screens? (2), theme? }) → { manifest, needs, belt: { length, depth, screens:
 *     [{ from, to, waves: [[{ id, eid, at }]] }], props }, hero, feel }
 *   BELT   its numbers (SCREEN, DEPTH, the camera's)
 *
 * Pure, seeded.
 */
import { feelRule, readFeel } from './feel/lower.js';
import { dummyFigure, roomArsenal, roomAudio } from './practice-room.js';
import { armLevel, heroStrikes } from './arsenal.js';
import { COMBAT, POSE_LAYERS, actionWall } from './levels.js';
import { bestiaryOf, standFoe } from './foes.js';
import { playerWorld } from '../playscape/player.js';
import { composeMechanics } from '../game/mechanics.js';
import { roomNeeds } from '../gameroom/needs.js';
import { PRIMITIVES, footprint } from '../gameroom/primitives.js';
import { practiceLegend } from './practice-mana.js';
import { everydayFeel } from './work-room.js';
import { PERSON } from './quick.js';
import { levelHud } from '../game/hud-mana.js';
import { streamOf } from '../city/plan/dice.js';

export const BELT = Object.freeze({
  SCREEN: 16,            // a screen's length along the way: the frame's width at the camera's distance
  DEPTH: 7,              // the way's width across
  WALL: 3.4,             // the back wall's height
  // the side camera: square to the way from the near side, raised a little, its depth held, half a frame in from a hold's marks
  camera: Object.freeze({ rule: 'side', yaw: Math.PI, keel: 0, dist: 13.5, tilt: 0.3, lookH: 1.1, ends: 7.5, lerp: 6 }),
});
// a stand-in foe (no bestiary made yet) is a person at a person's size: a class's own scale is its beast's, and would
// draw the person standing in for it four times too tall
const HELD_CONTACT = Object.freeze([0.28, 0.62]), BLADES = Object.freeze(['dagger', 'sword', 'greatsword', 'knife']);
const STAND_IN = Object.freeze({ rule: { stride: 1.6, collideRadius: 0.3, collideHeight: 1.8 }, body: { radius: 0.3, egg: { ...PERSON }, scale: 1 } });
export const BELT_LEGEND = practiceLegend([['pause', 'menu']]);
const TONES = { floor: ['#b9b3a8', '#aea89d'], wall: '#8d8578', kerb: '#d8d2c6', prop: '#9a7f5e', mark: '#e8e2d4', bg: '#cfd8de' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });

export function beltRoom(G, { refs = {}, cast = 'male', feel = null, seed = null, screens = 2, theme = null, sound = 'realistic' } = {}) {
  if (!(Number.isInteger(screens) && screens >= 1 && screens <= 12)) throw new Error('belt: screens is how many screens the way has, 1 to 12');
  const needs = roomNeeds(G), dice = streamOf(seed ?? (Number.isInteger(G?.seed) ? G.seed : 1), 'belt', 'props');
  const half = BELT.DEPTH / 2, length = screens * BELT.SCREEN;

  // THE HERO, armed as the action room arms it (practice-room.js): the game's own (its sketch, and its sheathed twin), or
  // a stand-in on the template's body with the world's blade in hand; on the world's feel, moved in the screen's frame
  // (D along the way, W into it), hittable; the arsenal the world's, its feel template's kit, or the basic one
  const F = feel ?? G?.feel ?? everydayFeel();
  readFeel(F);
  const { arsenal, kit } = roomArsenal({ ...(G ?? {}), feel: F });
  const held = (G?.characters?.hero?.adornment?.items ?? []).find((it) => it.slot === 'right' && (it.serves ?? []).includes('strike'))?.build?.item;
  const blade = BLADES.includes(held) ? held : 'sword';
  const own = typeof refs.hero === 'string' && heroStrikes(G);
  const rule0 = { ...feelRule(F), move: 'world', moveYaw: BELT.camera.yaw };
  const rule = Array.isArray(rule0.strikeContact) ? rule0 : { ...rule0, strikeContact: [...HELD_CONTACT] };
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'belt', controls: BELT_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero, clipped = { ...lib, clips: { ...lib.clips, guard: 'walk' } };
  const drawnFig = own ? { ...clipped, heroRef: refs.hero } : { ...clipped, hero: { cast, gear: { right: { item: blade } } } };
  const sheathFig = own ? (typeof refs.sheathed === 'string' ? { ...clipped, heroRef: refs.sheathed } : null) : { ...clipped, hero: { cast, gear: { back: { item: blade } } } };
  const figures = { hero: drawnFig, ...(sheathFig ? { 'hero-sheathed': sheathFig } : {}) };
  const spawn = [0, 2, 0], e0 = P.entities[0];
  const heroE = { ...e0, body: { ...e0.body, ...(sheathFig ? { figure: 'hero-sheathed' } : {}), layers: POSE_LAYERS, hittable: true, radius: 0.5, egg: { ...PERSON } },
    rule: { ...e0.rule, ...actionWall(e0.rule), combat: { ...COMBAT, ...(sheathFig ? { drawn: 'hero', sheathed: 'hero-sheathed' } : {}) } },
    transform: { pos: spawn.slice(), heading: Math.PI / 2 } };
  const part = { figures, entities: [heroE] };

  // THE PROPS: a crate or a low cover or two a screen, against the back wall, clear of the screen's marks
  const props = [];
  for (let s = 0; s < screens; s++) {
    const n = 1 + (dice() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const kind = dice() < 0.5 ? 'crate' : 'cover-low', y = r3(s * BELT.SCREEN + 3 + ((k + dice() * 0.6) * (BELT.SCREEN - 6)) / n);
      props.push({ kind, id: `${kind}-${s + 1}-${k + 1}`, at: [r3(-half + 1.1), y, 0], rot: 90 });
    }
  }
  // THE WAY: the floor in screens (their marks a line across), the back wall, a kerb on the near side; walls as colliders
  const faces = [], colliders = [];
  for (let y = 0; y < length; y += 2) for (let x = -half; x < half; x += 1.75) faces.push(quad([x, y, 0], [x + 1.75, y, 0], [x + 1.75, y + 2, 0], [x, y + 2, 0], TONES.floor[(Math.round(x / 1.75) + y / 2 + 400) % 2], 'belt:floor'));
  for (let s = 1; s < screens; s++) { const y = s * BELT.SCREEN; faces.push(quad([-half, y - 0.06, 0.004], [half, y - 0.06, 0.004], [half, y + 0.06, 0.004], [-half, y + 0.06, 0.004], TONES.mark, 'belt:mark')); }
  const box = ([x0, x1], [y0, y1], h, group, fill, drawn = true) => {
    if (drawn) faces.push(quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group), quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
      quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group));
    colliders.push({ min: [x0, y0, 0], max: [x1, y1, h], hold: false });
  };
  box([-half - 0.6, -half], [-3, length + 3], BELT.WALL, 'belt:wall', TONES.wall);
  faces.push(quad([half, 0, 0], [half + 0.25, 0, 0], [half + 0.25, length, 0], [half, length, 0], TONES.kerb, 'belt:kerb'));
  box([half, half + 0.5], [-3, length + 3], 2.4, 'belt:near', TONES.kerb, false);        // the near side: held, not drawn (the camera looks over it)
  box([-half - 0.6, half + 0.5], [-3.5, -3], 2.4, 'belt:end', TONES.wall, false);
  box([-half - 0.6, half + 0.5], [length + 3, length + 3.5], 2.4, 'belt:end', TONES.wall, false);
  for (const p of props) { const f = footprint(p); box(f.x, f.y, p.h ?? PRIMITIVES[p.kind].h, `belt:${p.id}`, TONES.prop); }

  // THE FOES: each screen two waves, woken at its far side and along its back; the bestiary's first the rank and file
  const B = bestiaryOf(G ?? {}), ids = Object.keys(B), dummy = dummyFigure('male');
  const laid = [];
  let n = 0;
  for (let s = 0; s < screens; s++) {
    const from = s * BELT.SCREEN, to = from + BELT.SCREEN, waves = [];
    for (let w = 0; w < 2; w++) {
      const count = Math.max(1, (needs.foes || 3) - 1 + s + w), wave = [];
      for (let i = 0; i < count; i++) {
        const eid = ids[1] && i === count - 1 && s + w >= 2 ? ids[1] : ids[0];
        // (the far side first, spread across the way; the rest along the back, ahead of the hero)
        const at = i < 3 ? [r3(-half + 1.4 + (i * (BELT.DEPTH - 2.8)) / 2), r3(to - 1.2 - (i % 2) * 0.9), 0] : [r3(-half + 1.2), r3(to - 4 - (i - 3) * 2.2), 0];
        wave.push({ id: `foe-${++n}`, eid, at });
      }
      waves.push(wave);
    }
    laid.push({ from, to, waves });
  }
  for (const S of laid) for (const wave of S.waves) for (const p of wave) {
    const made = typeof refs.foes?.[p.eid] === 'string';
    standFoe(G?.foes ? G : null, part, { id: p.id, eid: made ? p.eid : undefined, entry: B[p.eid], at: p.at.slice(), heading: -Math.PI / 2 }, { ...(made ? { ref: refs.foes[p.eid] } : { figure: dummy, tune: STAND_IN }), more: { dormant: true } });
  }

  // THE RULES: the belt on the bus, beside the player's own events
  const composed = composeMechanics([{ kind: 'belt', across: half, screens: laid.map((S) => ({ from: S.from, to: S.to, waves: S.waves.map((wave) => ({ foes: wave.map((p) => ({ id: p.id, at: p.at })) })) })) }], { player: 'hero', spawn, fall: 'none' });
  if (composed.errors?.length) throw new Error(`belt: ${composed.errors.join('; ')}`);
  const pe = P.events ?? {}, ev = composed.events, events = { ...pe, vars: { ...(pe.vars ?? {}), ...ev.vars } };
  for (const [k, v] of Object.entries(ev)) if (Array.isArray(v) && v.length) events[k] = [...(pe[k] ?? []), ...v];
  // (its cues reach the cast: the waves' spawns, the screen's hold)
  events.cast = true;

  const audio = roomAudio(arsenal, sound);
  // (the arsenal laid on the hero that strikes and on its foes, their health in the kit's strings: arsenal.js)
  const manifest = armLevel({ arsenal }, {
    kind: 'controllable', title: `Belt · ${G?.name ?? G?.id ?? 'game'}`, bg: TONES.bg, faces, colliders, figures: part.figures, entities: part.entities,
    camera: { ...P.camera, ...BELT.camera, target: 'hero' }, ...(audio ? { audio } : {}), events, manaHud: levelHud(theme ?? 'arcade'),
  });
  return { manifest, needs, arsenal, kit, belt: { length, depth: BELT.DEPTH, screens: laid, props }, hero: own ? 'own' : 'stand-in', feel: readFeel(F).pole };
}
