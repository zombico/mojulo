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
 *   the BOSSES   once its foes have joined (`extra` and the level's `foes`), each boss a body of the world in its room
 *                (bosses.js: a foe class at the boss's rank, at its tier, its health its blows, kept to its room), its bar
 *                the castle's; felled, it gives what its stand-in gave; its laws beside the box's, each `bosses:<id>`
 *   the VITALS   health on her body and MP on her moveset (BOX_VITALS): no
 *                lives. A save room fills both and is where she wakes; her health spent, she wakes in the last she stood
 *                in, keeping everything (held-gates.js)
 *   a FALL       out of the frame's bottom (none is laid: every room has its floor), counted as the side map counts it
 *   the GOAL     the throne's far side, behind the core's boss
 *   the TREES    the world's `trees` (trees/tree.js): the skill tree on how she moves, the tech tree on her spells and
 *                attacks, lowered on her rule and her own strings, learned as she plays (worlds/controllable/trees.js) with
 *                the points what she holds gives; their laws beside the box's, each `trees:<id>`
 *
 *   boxLevelOrder(G, stage, { ref, heroRef, heroGaits?, heroStature?, pilot?, title?, mechanics?, audio?, extra?, foeFrom?,
 *                 bossRefs? })   (`bossRefs` { <castle boss id>: its figure's sketch }, the runner's `boss-<id>` steps)
 *     → { tool: 'create_sketch', args: { title, manifest }, laws }   laws: the box's own (laws.js), each `metroidvania:<id>`
 *
 * Pure.
 */
import { playerWorld } from '../../playscape/player.js';
import { feelRule, readFeel, feelCard, takesOfCard, feelCombos } from '../feel/lower.js';
import { readTrees, lowerTrees, treeLaws } from '../trees/tree.js';
import { SIDE_MAP_STATURE } from '../side-map/scene.js';
import { SIDE_FALL, LIMBO } from '../side-map/play.js';
import { boxOf } from './scene.js';
import { boxEnds, boxPlaced, castLaws } from './cast.js';
import { HERO } from '../../foes/vocab.js';
import { sideFoe } from '../side-map/cast.js';
import { bestiaryOf } from '../foes.js';
import { FLOOR, boxCameraOf } from './rooms.js';
import { standBosses, bossRow, bossLaws, sideBody } from './bosses.js';
import { reachOf } from '../feel/reach.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
/** The world's trees lowered on a box's hero: the runtime's spec, her moveset with the techs' strings in it, and the
 * trees' laws (the points a box gives: each boss, power, key and pocket's prize it holds at the trees' rates). */
function treesOfBox(G, L, rule, { placed = [] } = {}) {
  const R = readTrees(G.trees), powers = L.powers ?? {};
  const { spec, moveset } = lowerTrees(R, { rule, combos: G.feel ? feelCombos(G.feel) : null, powers });
  const held = { boss: L.rooms.filter((r) => r.boss).length, power: Object.keys(powers).length, key: L.rooms.filter((r) => r.key).length, prize: L.rooms.reduce((n, r) => n + r.pockets.length, 0) };
  // (and the souls its foes give as they fall, by their ranks)
  const B = bestiaryOf(G), souls = R.souls ? placed.reduce((n, p) => n + (B[p.eid]?.rank === 'elite' ? R.souls.elite : R.souls.minion), 0) : 0;
  const earnable = Object.entries(R.points).reduce((n, [k, v]) => n + v * (held[k] ?? 0), 0) + (R.souls ? Math.floor(souls / R.souls.per) : 0);
  return { spec, moveset, laws: treeLaws(R, { powers, earnable }) };
}

/** the stand-ins' shades by class: what a greybox foe is read as before its figure is made */
export const STAND_IN = Object.freeze({ walker: '#8c9c7a', swooper: '#4a4a5e', charger: '#8a6e9c', guard: '#b4b6c4', hopper: '#7a9c9c', lurker: '#5e7a5e', turret: '#9c7a5e', lobber: '#9c8a5e', pursuer: '#9c4a5e', stalker: '#6e5e9c' });
function standIn(e, figures, bestiary, cls0 = null) {
  const F = figures[e.body?.figure];
  if (!F || F.heroRef || F.ref || F.workbot || F.bell) return e;
  const cls = cls0 ?? bestiary[String(e.body.figure).replace(/^foe-/, '')]?.class ?? null, h = e.rule?.collideHeight ?? 1, r = e.rule?.collideRadius ?? 0.4, flies = cls === 'swooper';
  const { figure: _f, scale: _s, fit: _fit, ...body } = e.body;
  // (a walker's block twice its height, centred on its feet: the floor's slab hides the half under it; a flyer's its own size)
  return { ...e, body: { ...body, type: 'mesh', shape: 'box', size: [r3(r * 1.6), r3(r * 2.2), r3(flies ? h : h * 2)], color: STAND_IN[cls] ?? '#9c8c7a', marker: false } };
}

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
export function boxLevelOrder(G, stage, { ref, heroRef, heroGaits = null, heroStature = null, pilot = null, title, mechanics = null, audio = null, extra = null, foeFrom = [], bossRefs = {} } = {}) {
  if (!heroRef) throw new Error('levels: a metroidvania is played by a hero seen from the side; give the world a hero (its characters)');
  const name = title ?? `${G.name ?? G.id} · ${stage.label ?? stage.level}`, stature = heroStature ?? SIDE_MAP_STATURE;
  // (its BOSSES stood as bodies of the world once its foes have joined, bosses.js: the stand-in blocks left off the box)
  const stood = !!(extra && foeFrom.length);
  const manifest0 = { ...stage.manifest, ...(G.feel ? { feel: G.feel } : {}), stature, ...(stood ? { bosses: 'stood' } : {}) };
  const B = boxOf(manifest0), { layout: L, greybox: Gb } = B, W = Gb.screen.width, H = Gb.screen.height;
  const camera = boxCamera(B), spawn = [0, ...camera.zones[0].checkpoint];
  spawn[2] = r3(spawn[2] + 0.05);
  // the hero: the feel's rule on the lane, as tall as it stands
  const written = G.feel ? feelRule(G.feel) : null;
  const rule0 = { ...(written ?? {}), move: 'lane', lane: [[0, -20], [0, r3(L.box[0] * W + 20)]], collideHeight: stature };
  // (her TREES, the world's: the skill tree on how she moves and the tech tree on her spells and attacks, learned as she
  // plays: trees/tree.js lowered on her rule and her own strings, the techs' strings in her moveset held shut until learned)
  const T = G.trees ? treesOfBox(G, L, rule0, { placed: foeFrom.length ? boxPlaced(L, Gb, foeFrom, { bestiary: bestiaryOf(G) }) : [] }) : null, rule = T?.moveset ? { ...rule0, moveset: T.moveset } : rule0;
  const controls = `A / D  run · Space  jump${written?.dash ? ' · F  dash' : ''}${written?.buster ? ' · J  fire (hold: charge)' : ''}${written?.moveset && written?.strike === 'melee' ? ' · J  cut (press again: the string)' : ''}${T ? ' · T  skills and techs' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const takes = G.feel && readFeel(G.feel).takes ? takesOfCard(feelCard(G.feel)) : null;
  const W0 = playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), walk: false, id: 'hero', title: name, controls, rule, ...(takes ? { takes } : {}) });
  // (her VITALS, an action RPG's and never a run and gun's lives: health on her body, struck by what she meets; MP the
  // moveset's own pool, the arsenal's (combat-melee.js `mp`), filled at a save room and never on its own)
  const V = BOX_VITALS, E0 = W0.entities[0];
  const hero = { ...E0, transform: { pos: spawn, heading: Math.PI / 2 }, hpMax: V.hp, body: { ...E0.body, hittable: true, hp: V.hp },
    rule: { ...E0.rule, ...(E0.rule.moveset ? { moveset: { ...E0.rule.moveset, mp: { max: V.mp, regen: 0 } } } : {}) } };
  // its FOES (cast.js): the level's bestiary haunting its rooms, region by region, stood by the stage's extra (the runner's
  // foe cast, foes.js hostileCast) on the lane's rail; what the cast gives the hero (its hit egg) laid over her own, never
  // a stomp (the castle refuses it: gates.js REFUSED_MOVES)
  const X = extra && foeFrom.length ? extra(boxEnds(L, Gb, foeFrom, { spawn, bestiary: bestiaryOf(G) })) : null;
  const { stomp: _stomp, ...given } = X?.pilot?.rule ?? {};
  const hero1 = X?.pilot ? { ...hero, rule: { ...hero.rule, ...given, ...(written ?? {}), ...(T?.moveset ? { moveset: hero.rule.moveset } : {}) }, body: { ...(X.pilot.body ?? {}), ...hero.body } } : hero;
  // its bodies as their rows draw them: the anime hero's own look and light, never the run and gun's cel (whose feel it
  // borrows: a metroidvania's hero is drawn as mojulo draws its anime heroes)
  const figures = { ...(W0.figures ?? {}), ...(X?.figures ?? {}) };
  // (each foe at the side map's game scale, sideFoe; one whose figure is not made yet, a greybox's, stood as a STAND-IN:
  // a block of its size in its class's shade, its figure left off the page)
  const foes0 = (X?.entities ?? []).map((e) => (e.team === 'foes' ? standIn(sideFoe(e, stature), figures, bestiaryOf(G)) : e));
  // (its BOSSES, each in its room at its tier, a stand-in of its class until its figure is made: bosses.js)
  const Bs = stood ? standBosses(G, B, { stature, refs: bossRefs }) : null;
  Object.assign(figures, Bs?.figures ?? {});
  const foes = [...foes0, ...(Bs?.entities ?? []).map((e) => standIn(e, figures, {}, bossRow(B.bosses.find((b) => b.id === e.id).name).class))];
  const drawnFigures = Object.fromEntries(Object.entries(figures).filter(([k]) => !((k.startsWith('foe-') || k.startsWith('boss-')) && foes.every((e) => e.body?.figure !== k))));
  // the goal: the throne's far side, behind its boss
  const throne = L.rooms.filter((r) => L.rings[r.ring].core).at(-1), [tc, tr, tw] = throne.rect;
  const reach = { kind: 'reach-exit', at: [0, r3((tc + tw) * W - 2.5), r3(tr * H + FLOOR + 1)], radius: 2.5, planar: false };
  const lives = G.mechanics?.lives ? [{ kind: 'lives', start: G.mechanics.lives, falls: [SIDE_FALL] }] : [];
  const ev = W0.events ?? {};
  const events = { ...ev, sources: [...(ev.sources ?? []), { type: 'zone', zone: SIDE_FALL, at: [0, 0, LIMBO], half: [1e6, 1e6, 200], watch: 'hero' }] };
  const manifest = {
    ...manifest0, ...(T ? { trees: T.spec } : {}), title: name, figures: drawnFigures, entities: [hero1, ...foes], camera, events,
    game: { levelRef: ref, mechanics: [reach, ...lives], fall: 'none' },
    ...(mechanics?.play || X?.play ? { play: { ...(mechanics?.play ?? {}), ...(X?.play ?? {}) } } : {}),
    ...(audio ? { audio } : {}),
  };
  const cast = foeFrom.length ? castLaws(L, Gb, boxPlaced(L, Gb, foeFrom, { bestiary: bestiaryOf(G) }), { bestiary: bestiaryOf(G), hp: V.hp, hit: HERO.hit }) : [];
  return { tool: 'create_sketch', args: { title: name, manifest }, laws: [...B.laws.map((l) => ({ ...l, id: `metroidvania:${l.id}` })), ...(T ? T.laws.map((l) => ({ ...l, id: `trees:${l.id}` })) : []), ...cast.map((l) => ({ ...l, id: `foes:${l.id}` })), ...(stood ? bossLaws(B, { body: sideBody(G.feel ? reachOf(readFeel(typeof G.feel === 'string' ? { pole: G.feel, takes: true } : G.feel)) : null) }).map((l) => ({ ...l, id: `bosses:${l.id}` })) : [])] };
}
