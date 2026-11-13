/**
 * THE ROLL ROOM — the practice rooms' sibling for a game whose levels roll (game/roll.js): its hero on a greybox yard
 * whose cover, gems and start are picked by a seed, so what a different map each time plays like is tried, and measured,
 * before any level is laid. Built from the world alone: the run's hero where made, else a stand-in on its feel
 * template's body, moving as that template moves (its run, its jump, its air jump). A flat yard, so the roll is what
 * is tried and not the land.
 *
 *   rollRoom(G, { refs?, cast?, sound? }) → { manifest, yard, hero: 'own' | 'stand-in', ways }
 *     refs    { hero? } as practice-room.js takes them
 *     yard    [[what it is, the ids it rolls]] the room's roll, said on the page
 *     ways    how many different yards there are (game/roll.js rollWays)
 *   rollRoomLevel(G)     → the yard as a level played in Node plays it: { entities, events, game, colliders, faces, roll }
 *                          (the room's own blocks, pickups and roll read and lowered by the same readers the world's
 *                          scene uses; the hero a plain body on the world's feel rule)
 *   coverForms(G)        → [{ form, height, stops }] which forms of cover stop THIS hero: a wall is cover only while
 *                          the hero cannot go over it, and that is its feel's to say (a hero with an air jump clears
 *                          what a soldier is stopped by). Each form laid across a lane and the hero run at it, jumping.
 *   rollRoomMeasured(G)  → { seeds, ways, distinct, lost: [law], forms: { stops: [form], passed: [form] } }: the seeds
 *                          audit (game/roll-audit.js) of the yard and the forms above, before any level; kept by the
 *                          feel it was measured on. A machine gate: advice, never a refusal.
 *   ROLL_LEGEND, YARD, FORMS
 *
 * Pure. Its page (practice-room-page.js rollRoomHtml) says the roll being played beside the measures, and rolls again.
 */
import { feelRule } from './feel/lower.js';
import { floorOf } from './practice-room.js';
import { playerWorld } from '../playscape/player.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { standBlocks } from '../playscape/terrain.js';
import { readRoll, rolledIds, rollWays, pickupsOf } from '../game/roll.js';
import { synthesizeLevel } from '../game/level-synth.js';
import { rollAudit } from '../game/roll-audit.js';
import { simLevel } from '../game/level-sim.js';

const HALF = 14;
// THE YARD's cover, in three lines across the way from the start (south) to the exit (north). No line can shut the yard:
// the walls leave its sides open, and the low wall and the crates are gone round.
const wall = (id, x, y, length, height = 2) => ({ id, form: 'wall', at: [x, y, 0], N: [0, -1], length, height, thick: 0.5 });
export const YARD = Object.freeze({
  blocks: Object.freeze([
    wall('wall-west', -7, -4, 8), wall('wall-mid', 0, -4, 8), wall('wall-east', 7, -4, 8),
    wall('low-west', -6, 3, 9, 1), wall('low-east', 6, 3, 9, 1),
    { id: 'crates-1', form: 'crate', at: [-9, 8, 0], stack: 2 }, { id: 'crates-2', form: 'crate', at: [-3, 7, 0] },
    { id: 'pillar-1', form: 'pillar', at: [3, 8, 0] }, { id: 'crates-3', form: 'crate', at: [9, 7, 0], stack: 2 },
  ]),
  pickups: Object.freeze([
    { id: 'gem-1', item: 'gem', at: [-10, -8, 0.9] }, { id: 'gem-2', item: 'gem', at: [10, -8, 0.9] }, { id: 'gem-3', item: 'gem', at: [0, 0, 0.9] },
    { id: 'gem-4', item: 'gem', at: [-11, 6, 0.9] }, { id: 'gem-5', item: 'gem', at: [11, 6, 0.9] },
  ]),
  exit: Object.freeze([0, 12, 0]),
  roll: Object.freeze({
    cover: [{ of: ['wall-west', 'wall-mid', 'wall-east'], stand: [1, 2] }, { of: ['low-west', 'low-east'], stand: [1, 2] }, { of: ['crates-1', 'crates-2', 'pillar-1', 'crates-3'], stand: [2, 3] }],
    items: [{ of: ['gem-1', 'gem-2', 'gem-3', 'gem-4', 'gem-5'], lay: [2, 4] }],
    start: [{ pos: [0, -12, 0], heading: Math.PI / 2 }, { pos: [-10, -12, 0], heading: Math.PI / 2 }, { pos: [10, -12, 0], heading: Math.PI / 2 }],
  }),
});
export const ROLL_LEGEND = 'W A S D  run · mouse  look · Space  jump · F  sprint · R  the next roll · Shift+R  the one before · H  HUD';
// the forms of cover a level's blocks stand, by what the hero must clear
export const FORMS = Object.freeze([{ form: 'a crate', height: 1 }, { form: 'a low wall', height: 1.2 }, { form: 'a wall', height: 2 }, { form: 'a high wall', height: 3 }]);

const mechanicsOf = () => [{ kind: 'collect', into: 'bag', pickups: YARD.pickups.map((p) => ({ ...p, at: p.at.slice(), radius: 1.5 })) }, { kind: 'bag', slice: 'bag' }, { kind: 'reach-exit', at: YARD.exit.slice(), radius: 2 }];
const ruleOf = (G) => (G && G.feel != null ? feelRule(G.feel) : {});

/** The roll room (see the header). */
export function rollRoom(G, { refs = {}, cast = 'male', sound = 'realistic' } = {}) {
  const own = typeof refs.hero === 'string';
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'roll room', controls: ROLL_LEGEND, rule: { ...ruleOf(G), move: 'camera' } });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, hero: { cast } } };
  const heroE = { ...P.entities[0], transform: { pos: YARD.roll.start[0].pos.slice(), heading: Math.PI / 2 } };
  const { faces, colliders } = floorOf({ half: HALF });
  const soundOf = (word) => { const v = sound === 'none' ? null : sfxSound(word, { style: sound }); return v && v.gestures ? v.gestures : null; };
  const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land');
  const audio = step ? { footsteps: Object.fromEntries(Object.entries({ step, jump, land }).filter(([, v]) => v)) } : null;
  const manifest = {
    kind: 'controllable', title: `Roll room · ${G?.name ?? G?.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures, entities: [heroE],
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, ...(audio ? { audio } : {}), events: { ...(P.events ?? {}) },
    blocks: YARD.blocks.map((b) => ({ ...b, at: b.at.slice() })), game: { levelRef: 'roll-room', mechanics: mechanicsOf() }, roll: structuredClone(YARD.roll),
  };
  const read = readRoll(YARD.roll, { blocks: YARD.blocks, pickups: pickupsOf(manifest.game.mechanics) });
  const yard = [['the walls (2 m), a line across the way', YARD.roll.cover[0].of], ['the low walls (1 m)', YARD.roll.cover[1].of], ['the crates and the pillar', YARD.roll.cover[2].of], ['the gems', YARD.roll.items[0].of], ['the starts', YARD.roll.start.map((s) => `[${s.pos[0]}, ${s.pos[1]}]`)]];
  return { manifest, yard, hero: own ? 'own' : 'stand-in', ways: rollWays(read) };
}

// the hero as Node plays it: a plain body on the world's feel rule (its figure is the page's)
const bodyOf = (G, at, heading = Math.PI / 2) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...ruleOf(G) }, body: { type: 'none' }, transform: { pos: at.slice(), heading } });

export function rollRoomLevel(G) {
  const mechanics = mechanicsOf(), entities = [bodyOf(G, YARD.roll.start[0].pos)];
  const read = readRoll(YARD.roll, { blocks: YARD.blocks, pickups: pickupsOf(mechanics) }), B = standBlocks(YARD.blocks, { rolled: rolledIds(read) });
  const { game, mechEvents } = synthesizeLevel({ entities, game: { levelRef: 'roll-room', mechanics } });
  const floor = floorOf({ half: HALF });
  return { entities, events: mechEvents, game, colliders: [...floor.colliders, ...B.colliders], faces: floor.faces.map((f) => ({ corners: f.corners })), roll: { cover: read.cover, things: B.things, items: read.items, start: read.start } };
}

export function coverForms(G) {
  return FORMS.map(({ form, height }) => {
    // a lane 4 m wide walled either side, the form across the whole of it 8 m on; the hero run at it and jumping as a
    // player would learn to: from a few distances short of it, the jump held, and again at the top of its arc (an air
    // jump, where its feel has one). One way over is enough: it does not stop this hero
    const colliders = [{ min: [-3, -2, 0], max: [-2, 30, 6] }, { min: [2, -2, 0], max: [3, 30, 6] }, { min: [-2, 8, 0], max: [2, 8.5, height] }];
    const over = [0.8, 1.5, 2.5, 4, 6].some((from) => {
      const sim = simLevel({ entities: [bodyOf(G, [0, 0, 0])], colliders }), me = sim.world.byId.hero;
      let press = 0, jumped = false, again = false, top = 0;
      for (let f = 0; f < 30 * 8; f++) {
        const [, y, z] = me.transform.pos;
        if (y > 9.5) return true;
        if (!jumped && 8 - y < from) { jumped = true; press = 2; top = z; }
        else if (jumped && !again && z < top - 0.01) { again = true; press = 2; }
        if (jumped) top = Math.max(top, z);
        for (const k of Object.keys(sim.input)) delete sim.input[k];
        Object.assign(sim.input, { forward: 1, ...(press > 0 ? { jump: 1 } : {}), ...(jumped ? { jumpHeld: 1 } : {}) });
        press--;
        sim.frame(1 / 30, []);
      }
      return false;
    });
    return { form, height, stops: !over };
  });
}

// the measures by the feel they were taken on (the same feel measures the same: pure, kept); a few at a time
const KEPT = new Map(), KEEP = 16;
export function rollRoomMeasured(G) {
  const key = JSON.stringify(G?.feel ?? null);
  if (KEPT.has(key)) return KEPT.get(key);
  const A = rollAudit(rollRoomLevel(G), { seeds: 24, plays: 2, seconds: 60 }), forms = coverForms(G);
  const out = { seeds: A.seeds, ways: A.ways, distinct: A.distinct, lost: A.laws.filter((l) => !l.holds).map((l) => l.law), ...(A.failed.length ? { worst: A.failed.slice(0, 3).map((f) => `seed ${f.seed}: ${f.says}`) } : {}), forms: { stops: forms.filter((f) => f.stops).map((f) => f.form), passed: forms.filter((f) => !f.stops).map((f) => f.form) } };
  KEPT.set(key, out);
  if (KEPT.size > KEEP) KEPT.delete(KEPT.keys().next().value);
  return out;
}
