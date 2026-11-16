/**
 * THE GAME ROOM — the practice door's room that reconfigures itself into the game's own: one room composed for the
 * world (gameroom/: its needs read from the world, laid from the room primitives, held to the room laws), played on the
 * runtime the game ships, before any level. A training room that becomes the game: the hero on its feel, its foes on
 * their spots, its shift's line on the counters, the cover, pillars and decks its fights and its jump ask for.
 *
 *   for whom     the games with no practice room of their own: a fight hand to hand, a shift, a cast of foes (a shooter
 *                and a platformer have the firing range and the platform room)
 *   the area     the trade's floor, walls and what stands outside (gameroom/area.js), or the world's own (`room.area`);
 *                `area: false` the conceptual plane (work-room.js): pale, ruled every two metres, a low wall
 *   the space    each primitive a block
 *                in its own tone (a counter in its verb's colour); a shift's recipe drawn on the floor as arrows
 *   the hero     the world's own where made, else a mascot of the form chosen (work-room.js workMascot), on the world's
 *                feel (else the everyday walker, or the one chosen)
 *   the foes     on the composition's foe spots: the bestiary's first (the world's own, else the stand-in bestiary's), its
 *                made sketch or a person of its class standing in, still until the page's foe AI is turned on
 *   the shift    the work mechanic on the line (counters, bins, shelves, the pass), the work shown
 *   the dress    each place drawn as the thing of its trade (gameroom/dress.js), fitted to its box, its collider kept:
 *                a kitchen's range and workbenches, a farm's fields and carts, a site's drum and sandbags, a chore's
 *                leaf piles and bin, a hall's tables and shelves; the shift's own trade, else the hall
 *   the camera   overhead where the world is seen from above or works a shift, else a chase the player turns
 *   measured     the room laws (gameroom/laws.js), and the work proof where a shift is laid
 *   a fight      (`fight`: a kind of gameroom/fight.js, the name of one the world keeps (`fights`), or { kind, waves? }) the room composed for ONE FIGHT and played:
 *                the place the kit asks for (its ring marked on the floor, its rifts, perches, urns, a font, a dais), its
 *                foes asleep until their wave (fights.js), every way sealed from the moment the hero steps into the ring
 *                until the last wave is down, then the way on; held to the fight's laws. Where combat is settled: a fight
 *                is tried here and laid in a level, the room itself is never one
 *
 *   gameRoom(G, { refs?, cast?, feel?, seed?, dress?, area?, sound?, fight? }) → { manifest, needs, room, laws, measured?, hero,
 *     feel, dress, area, choices, fight? }   `fight`: { kind, waves, placed, roles, contract } where one is played
 *     (`contract`: what a level laying it would end on and the way through it, for the playthrough: the room ends nothing)   `dress`: a trade (gameroom/dress.js DRESSES), false for the greybox; `area` (gameroom/area.js):
 *     a name, an object over one, false for the plane; each absent, the world's `room`, else the trade's own
 *   gameRoomOf(G)  → true when the world gives the room something to compose (a fight hand to hand, a shift or foes);
 *                    a shooter and a platformer are left to the firing range and the platform room
 *   ROOM_LEGEND
 *
 * Pure (the composition and the proof are seeded). Its page: practice-room-page.js gameRoomHtml.
 */
import { POLES, POLE_IDS } from './feel/cards.js';
import { feelRule, readFeel } from './feel/lower.js';
import { floorOf, dummyFigure, roomHero, roomArsenal } from './practice-room.js';
import { armLevel } from './arsenal.js';
import { bestiaryOf, standFoe } from './foes.js';
import { playerWorld } from '../playscape/player.js';
import { composeMechanics } from '../game/mechanics.js';
import { WORK_COLORS } from '../game/work-mechanics.js';
import { proveWork } from '../worksim/work-proof.js';
import { readCard } from '../worksim/card.js';
import { roomNeeds } from '../gameroom/needs.js';
import { composeRoom } from '../gameroom/compose.js';
import { composeFight, FIGHT_KIND_IDS } from '../gameroom/fight.js';
import { roomLaws, fightLaws } from '../gameroom/laws.js';
import { castRoles, fightWaves, fightCast, fightPlacements, fightMechanic, fightOf } from './fights.js';
import { PERSON } from './quick.js';
import { blocksOf, footprint, PRIMITIVES } from '../gameroom/primitives.js';
import { dressOf, dressPlaces, DRESSES } from '../gameroom/dress.js';
import { readArea, buildArea, raiseWalls, planeFaces, AREAS } from '../gameroom/area.js';
import { practiceLegend } from './practice-mana.js';
import { workMascot, workOf, everydayFeel, flowchart, flat, areaOut, OVERHEAD, WORK_CASTS, WORK_CAST } from './work-room.js';

// (the screen says only where the menu is; the keys are its How to play: practice-mana.js)
export const ROOM_LEGEND = practiceLegend([['pause', 'menu']]);
const PLANE = { plane: '#ece6db', rule: '#d9d0c1', wall: '#ddd5c8', bg: '#f4f0e8' };
// the chase in the room: farther and higher than a body's own, the room being what is looked at (the player turns it)
const ORBIT = Object.freeze({ steer: 'orbit', mouseLook: true, dist: 9, height: 4.5, lookH: 0.8 });
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Whether the world gives the game room something to compose: a fight hand to hand, a shift or foes. A shooter and a
 * platformer are left to their own rooms (the firing range, the platform room). */
export function gameRoomOf(G) {
  if (!G) return false;
  return !!(workOf(G) || (G.foes && Object.keys(G.foes).length) || roomNeeds({ ...G, quick: undefined }).fights);
}

/** The game room (see the header). */
export function gameRoom(G, { refs = {}, cast = WORK_CAST, feel = null, seed = null, dress = null, area = undefined, sound = 'realistic', fight = null } = {}) {
  // (a fight asked by the name the world keeps it under, fights.js, is that one: its kind, its seed, its waves)
  const named = typeof fight === 'string' ? fightOf(G, fight) : null;
  const needs = roomNeeds(G), theSeed = seed ?? named?.seed ?? (Number.isInteger(G?.seed) ? G.seed : 1);
  const FT = named ?? (fight ? (typeof fight === 'string' ? { kind: fight } : fight) : null);
  if (FT && !needs.fights) throw new Error('game room: a fight is composed for a world that fights hand to hand (a feel that strikes, or an arsenal)');
  const room = FT ? composeFight(needs, { kind: FT.kind, seed: theSeed }) : composeRoom(needs, { seed: theSeed });
  const laws = FT ? fightLaws(room, needs) : roomLaws(room, needs), A = room.anchors, half = room.half;
  const overhead = needs.camera === 'top-down' || !!needs.work;

  // THE HERO: the world's own, else a mascot; on the feel (the world's, the one chosen, else the everyday walker)
  const F = feel ?? G?.feel ?? everydayFeel();
  readFeel(F);
  const rule = { ...feelRule(F), ...(overhead ? { move: 'world', moveYaw: OVERHEAD.yaw } : { move: 'camera' }) };
  // (a FIGHT's hero is the action room's: the game's own or a stand-in holding the world's blade, struck with as a held
  // blade strikes and armed with the kit below; it can be hit, as on a stage where foes stand: gauntlet-cast.js)
  const AH = FT ? roomHero({ ...(G ?? {}), feel: F }, { refs, cast: ['male', 'female'].includes(cast) ? cast : 'male', pos: A.spawn.slice(), heading: Math.PI / 2, title: 'game room' }) : null;
  const own = AH ? AH.own : typeof refs.hero === 'string';
  const M = AH || own ? null : workMascot(cast, { speed: rule.speed });
  const P = AH ? AH.P : playerWorld({ heroRef: own ? refs.hero : 'mascot', id: 'hero', title: 'game room', controls: ROOM_LEGEND, rule, ...(M ? { pilot: M.pilot } : {}) });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = AH ? AH.figures : { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, layered: M.layered } };
  const heroE = AH ? { ...AH.heroE, body: { ...AH.heroE.body, hittable: true, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } } } : { ...P.entities[0], transform: { pos: A.spawn.slice(), heading: Math.PI / 2 } };

  // THE FOES on their spots, facing the spawn
  const part = { figures, entities: [heroE] };
  // A FIGHT'S FOES: each wave's on its spots (fights.js), asleep until the wave wakes it
  let fought = null;
  if (FT) {
    const B = bestiaryOf(G ?? {}), waves = fightWaves(G, FT.kind, FT.waves ?? null), placed = fightPlacements(G, room, fightCast(G, FT.kind, FT.waves ?? null)), dummy = dummyFigure('male');
    for (const p of placed.flat()) {
      const made = typeof refs.foes?.[p.eid] === 'string';
      standFoe(G?.foes ? G : null, part, { id: p.id, eid: made ? p.eid : undefined, entry: p.rank ? { ...B[p.eid], rank: p.rank } : B[p.eid], at: p.at.slice(), heading: p.heading }, { ...(made ? { ref: refs.foes[p.eid] } : { figure: dummy }), more: { dormant: true } });
    }
    fought = { kind: FT.kind, waves, placed, roles: castRoles(G), mechanic: fightMechanic(room, placed) };
  } else if (A.foes.length) {
    const B = bestiaryOf(G ?? {}), eid = Object.keys(B)[0], entry = B[eid], made = typeof refs.foes?.[eid] === 'string', dummy = dummyFigure('male');
    A.foes.forEach((at, k) => {
      const heading = r3(Math.atan2(A.spawn[1] - at[1], A.spawn[0] - at[0]));
      standFoe(G?.foes ? G : null, part, { id: `foe-${k + 1}`, eid: made ? eid : undefined, entry, at: at.slice(), heading }, made ? { ref: refs.foes[eid] } : { figure: dummy });
    });
  }

  // THE DRESS (gameroom/dress.js): each place drawn as the thing of its trade, fitted to its box (its collider kept);
  // `dress: false` the greybox
  const dressAsk = dress ?? G?.room?.dress ?? null, card = room.work ? room.work.card : null;
  const trade = dressAsk === false ? null : dressOf(card, dressAsk);
  const places = room.primitives.map((p) => { const f = footprint(p); return { id: p.id, kind: p.kind, at: p.at, size: [r3(f.x[1] - f.x[0]), r3(f.y[1] - f.y[0]), p.h ?? PRIMITIVES[p.kind].h], ...(p.sid ? { sid: p.sid, verb: p.verb } : {}), ...(p.item ? { item: p.item } : {}) }; });
  const D = trade ? dressPlaces(places.filter((p) => p.kind !== 'platform'), trade, { card: room.work ? room.work.card : null }) : { faces: [], dressed: new Set(), laid: [] };
  // THE SPACE: the plane, its rules, the wall in its tone; each primitive a block (a counter in its verb's colour), a
  // dressed one drawn by its thing instead
  const blocks = room.primitives.flatMap((p) => blocksOf(p).map((b) => ({ ...b, ...(p.kind === 'counter' && p.verb ? { fill: WORK_COLORS[p.verb] } : {}), ...(D.dressed.has(p.id) ? { group: `room:dressed:${p.id}` } : {}) })));
  const shell = floorOf({ half, blocks });
  // THE AREA (gameroom/area.js): the floor, the walls and what stands outside, the trade's own or the world's; cut away
  // on the south, where either camera starts (the chase behind the spawn would pull in off a full wall there, the
  // overhead looks over it); `area: false` the plane
  const AA = readArea(area !== undefined ? area : G?.room?.area, dressOf(card, typeof dressAsk === 'string' ? dressAsk : null));
  const AR = AA ? buildArea(AA, { half, cut: ['s'], seed: room.seed }) : null;
  const plane = AR ? AR.faces : planeFaces(half, [PLANE.plane, PLANE.rule]);
  const kept = shell.faces.filter((f) => f.group !== 'room:floor' && !String(f.group).startsWith('room:dressed:') && !(AR && f.group === 'room:wall')).map((f) => (f.group === 'room:wall' ? { ...f, fill: PLANE.wall } : f));
  // the anchors marked on the floor: the spawn and the goal, a ring each
  const ring = (at, r, fill, group, n = 4) => Array.from({ length: n }, (_, q) => q).map((q) => { const a = (q * 2 * Math.PI) / n, b = a + (2 * Math.PI) / n, c = (t) => [at[0] + r * Math.cos(t), at[1] + r * Math.sin(t)], ci = (t) => [at[0] + (r - 0.12) * Math.cos(t), at[1] + (r - 0.12) * Math.sin(t)]; return flat(c(a), c(b), ci(b), ci(a), 0.006, fill, group); });
  // (a fight's: its ring, where it begins, and each rift a wave comes in at)
  const fightMarks = FT ? [...ring(A.ring.at, A.ring.r, '#c9a15f', 'room:ring', 32), ...(A.rifts ?? []).flatMap((q) => ring(q.at, 0.8, '#8c3b2f', 'room:rift'))] : [];
  const marks = [...ring(A.spawn, 0.9, '#7fa8c9', 'room:spawn'), ...(room.work ? [] : ring(A.goal, 0.9, '#7fc98f', 'room:goal')), ...fightMarks];
  // a shift's recipe on the floor
  const RC = room.work ? readCard(room.work.card) : null;
  const flow = RC ? flowchart(RC, room.work.layout, room.work.layout.serve, null, 0) : [];
  const faces = [...plane, ...marks, ...flow, ...kept, ...D.faces];

  // THE SHIFT on the line
  let events = { ...(P.events ?? {}) }, measured = null;
  if (room.work) {
    const L = room.work.layout;
    const params = { card: room.work.card, at: { origin: [0, -0.4, 0], stations: L.stations, crates: L.crates, shelves: L.shelves, serve: L.serve }, heading: 0, reach: 1.6, bases: false, show: true };
    const composed = composeMechanics([{ kind: 'work', ...params }], { player: 'hero', spawn: A.spawn, fall: 'none' });
    if (composed.errors?.length) throw new Error(`game room: ${composed.errors.join('; ')}`);
    const ev = composed.events, pe = events;
    events = { ...pe, vars: { ...(pe.vars ?? {}), ...ev.vars } };
    for (const [k, v] of Object.entries(ev)) if (Array.isArray(v) && v.length) events[k] = [...(pe[k] ?? []), ...v];
    measured = proveWork(params, { player: 'hero', spawn: A.spawn, speed: rule.speed });
  }
  // THE FIGHT on the bus: the wave gauntlet, entered at the ring, its ways sealed
  if (fought) {
    const composed = composeMechanics([fought.mechanic], { player: 'hero', spawn: A.spawn, fall: 'none' });
    const ev = composed.events, pe = events;
    // (the room has no shell to end in: the way on opens, and the fight is there to be played again)
    events = { ...pe, vars: { ...(pe.vars ?? {}), ...ev.vars } };
    for (const [k, v] of Object.entries(ev)) if (Array.isArray(v) && v.length) events[k] = [...(pe[k] ?? []), ...v];
    // (what a level would end on, and the way a scripted player walks it: into the ring, then on; playthrough.js reads it)
    fought.contract = { on: composed.on, audits: [{ kind: 'walkto', via: [A.ring.at.slice()], target: A.goal.slice() }] };
  }
  const manifest0 = {
    kind: 'controllable', title: `Game room · ${G?.name ?? G?.id ?? 'game'}`, bg: AR ? AR.bg : PLANE.bg, faces, colliders: raiseWalls(shell.colliders, half, AR?.heights), figures: part.figures, entities: part.entities,
    camera: overhead ? { ...OVERHEAD } : { ...P.camera, ...ORBIT }, ...(fought ? { lock: true } : {}), events,
  };
  // (a fight's hero plays the kit and its foes are numbered by it: the world's arsenal, else its feel template's)
  const manifest = fought ? armLevel({ arsenal: roomArsenal({ ...(G ?? {}), feel: F }).arsenal, ...(G?.loadout ? { loadout: G.loadout } : {}) }, manifest0) : manifest0;
  const feels = POLE_IDS.map((id) => ({ id, name: POLES[id].name, base: POLES[id].base, run: feelRule(id).speed }));
  return {
    manifest, needs, room, laws, ...(measured ? { measured } : {}), hero: own ? 'own' : AH ? 'stand-in' : 'mascot', ...(M ? { mascot: { form: cast, thesis: M.thesis } } : {}),
    feel: readFeel(F).pole, dress: trade ? { trade, about: DRESSES[trade].about, laid: D.laid } : null, area: areaOut(AA, AR),
    choices: { feels, casts: WORK_CASTS, dresses: Object.keys(DRESSES), areas: Object.keys(AREAS), ...(needs.fights && !needs.work ? { fights: FIGHT_KIND_IDS, ...(G?.fights ? { kept: Object.keys(G.fights) } : {}) } : {}) },
    ...(fought ? { fight: { ...(named ? { name: named.name } : {}), seed: theSeed, kind: fought.kind, waves: fought.waves, placed: fought.placed, roles: fought.roles, contract: fought.contract } } : {}),
  };
}
