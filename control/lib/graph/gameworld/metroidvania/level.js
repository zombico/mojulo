/**
 * A METROIDVANIA LEVEL (a world's `levels.<id>.metroidvania`, laid by levels.js `gameStages` as one stage, section
 * `metroidvania`): the box built on the side map's runtime (scene.js, the geocube's `show: 'metroidvania'`) and played by
 * the world's hero, built for the hero's own height and measured jump, so the box, its laws and its play agree.
 *
 *   the HERO     the world's hero on the platform rule its feel lowers (feel/lower.js), running the lane the box is built
 *                along (+y at x 0), standing in the gate room, drawn as its row draws it (an anime hero's own look and
 *                light: never the cel of the run and gun whose feel it borrows), a fifth larger in the frame than a side
 *                map's hero (rooms.js BOX_FRAME)
 *   the CAMERA   the side map's (worlds/controllable/sidemap.js), a ROOM a camera zone in the order the spiral walks them:
 *                a corridor's height held, a shaft's side held, a turn and a hall framed whole where they fit a screen
 *   the GATES    the box's held gates (worlds/controllable/held-gates.js): each shut until what opens it is held, the
 *                double jump's sill a closed part the second jump clears; what is picked up gives what it gives (the
 *                double jump its move), a boss's stand-in struck down gives its power and breaks its seal
 *   the VITALS   health on her body and MP on her moveset (BOX_VITALS): no
 *                lives. A save room fills both and is where she wakes; her health spent, she wakes in the last she stood
 *                in, keeping everything (held-gates.js)
 *   a FALL       out of the frame's bottom (none is laid: every room has its floor), counted as the side map counts it
 *   the GOAL     the throne's far side, behind the core's boss
 *
 *   boxLevelOrder(G, stage, { ref, heroRef, heroGaits?, heroStature?, pilot?, title?, mechanics?, audio? })
 *     → { tool: 'create_sketch', args: { title, manifest }, laws }   laws: the box's own (laws.js), each `metroidvania:<id>`
 *
 * Pure.
 */
import { playerWorld } from '../../playscape/player.js';
import { feelRule, readFeel, feelCard, takesOfCard } from '../feel/lower.js';
import { SIDE_MAP_STATURE } from '../side-map/scene.js';
import { SIDE_FALL, LIMBO } from '../side-map/play.js';
import { boxOf } from './scene.js';
import { FLOOR, boxCameraOf } from './rooms.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
/** A box's hero's VITALS: her health and her MP (levels and their growth are the stats' to come) */
export const BOX_VITALS = Object.freeze({ hp: 100, mp: 40 });
/** where the hero stands in a room as it comes back to it: a little in from its near wall, on its floor */
const IN = 2.5;

/** The box's rooms as the side map's camera zones, in the order the spiral walks them. */
export function boxCamera(B, { target = 'hero' } = {}) {
  const { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, C = boxCameraOf(B.stature);
  const room = new Map(L.rooms.map((r) => [r.id, r]));
  const zones = L.walk.map((id) => {
    const r = room.get(id), [c, rr, w, h] = r.rect, s0 = c * W, z0 = rr * H;
    return { rect: [r3(s0), r3((c + w) * W), r3(z0), r3((rr + h) * H)], lock: r.kind === 'corridor' ? 'z' : r.kind === 'shaft' ? 's' : null, checkpoint: [r3(s0 + IN), r3(z0 + FLOOR)] };
  });
  return { rule: 'side-map', target, screen: [W, H], dist: C.dist, tilt: C.tilt, lookH: C.lookH, stature: B.stature, limbo: LIMBO, zones };
}

/** A metroidvania level's order: the stage's box built for the world's hero and played by it. */
export function boxLevelOrder(G, stage, { ref, heroRef, heroGaits = null, heroStature = null, pilot = null, title, mechanics = null, audio = null } = {}) {
  if (!heroRef) throw new Error('levels: a metroidvania is played by a hero seen from the side; give the world a hero (its characters)');
  const name = title ?? `${G.name ?? G.id} · ${stage.label ?? stage.level}`, stature = heroStature ?? SIDE_MAP_STATURE;
  const manifest0 = { ...stage.manifest, ...(G.feel ? { feel: G.feel } : {}), stature };
  const B = boxOf(manifest0), { layout: L, greybox: Gb } = B, W = Gb.screen.width, H = Gb.screen.height;
  const camera = boxCamera(B), spawn = [0, ...camera.zones[0].checkpoint];
  spawn[2] = r3(spawn[2] + 0.05);
  // the hero: the feel's rule on the lane, as tall as it stands
  const written = G.feel ? feelRule(G.feel) : null;
  const rule = { ...(written ?? {}), move: 'lane', lane: [[0, -20], [0, r3(L.box[0] * W + 20)]], collideHeight: stature };
  const controls = `A / D  run · Space  jump${written?.dash ? ' · F  dash' : ''}${written?.buster ? ' · J  fire (hold: charge)' : ''}${written?.moveset && written?.strike === 'melee' ? ' · J  cut (press again: the string)' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const takes = G.feel && readFeel(G.feel).takes ? takesOfCard(feelCard(G.feel)) : null;
  const W0 = playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), walk: false, id: 'hero', title: name, controls, rule, ...(takes ? { takes } : {}) });
  // (her VITALS, an action RPG's and never a run and gun's lives: health on her body, struck by what she meets; MP the
  // moveset's own pool, the arsenal's (combat-melee.js `mp`), filled at a save room and never on its own)
  const V = BOX_VITALS, E0 = W0.entities[0];
  const hero = { ...E0, transform: { pos: spawn, heading: Math.PI / 2 }, hpMax: V.hp, body: { ...E0.body, hittable: true, hp: V.hp },
    rule: { ...E0.rule, ...(E0.rule.moveset ? { moveset: { ...E0.rule.moveset, mp: { max: V.mp, regen: 0 } } } : {}) } };
  // its bodies as their rows draw them: the anime hero's own look and light, never the run and gun's cel (whose feel it
  // borrows: a metroidvania's hero is drawn as mojulo draws its anime heroes)
  const figures = W0.figures ?? {};
  // the goal: the throne's far side, behind its boss
  const throne = L.rooms.filter((r) => L.rings[r.ring].core).at(-1), [tc, tr, tw] = throne.rect;
  const reach = { kind: 'reach-exit', at: [0, r3((tc + tw) * W - 2.5), r3(tr * H + FLOOR + 1)], radius: 2.5, planar: false };
  const lives = G.mechanics?.lives ? [{ kind: 'lives', start: G.mechanics.lives, falls: [SIDE_FALL] }] : [];
  const ev = W0.events ?? {};
  const events = { ...ev, sources: [...(ev.sources ?? []), { type: 'zone', zone: SIDE_FALL, at: [0, 0, LIMBO], half: [1e6, 1e6, 200], watch: 'hero' }] };
  const manifest = {
    ...manifest0, title: name, figures, entities: [hero], camera, events,
    game: { levelRef: ref, mechanics: [reach, ...lives], fall: 'none' },
    ...(mechanics?.play ? { play: mechanics.play } : {}),
    ...(audio ? { audio } : {}),
  };
  return { tool: 'create_sketch', args: { title: name, manifest }, laws: B.laws.map((l) => ({ ...l, id: `metroidvania:${l.id}` })) };
}
