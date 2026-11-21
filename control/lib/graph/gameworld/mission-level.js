/**
 * THE MISSION — a shooter's first level: the firing range (combat/range.js) stretched into sections with tasks
 * (lib/graph/mission/), played on the runtime the game ships. The range is where the game's guns are written and tried;
 * the mission is the same guns, the same body and the same bands, laid down one line with something to do at each.
 * It is offered to every world the practice door gives a firing range (practice.js), so every game the range makes has
 * a level 1; and it is a level's own form (`levels.<id>.mission`, world.js), laid by levels.js.
 *
 *   the guns     the world's (loadout.js loadoutOf), as the range carries them: its slots, its sights, its knife; each
 *                drawn in the hands as the arms library builds it (arms-kit.js armDetailed), not as its parts' boxes
 *   the body     the range's person from the eye; a feel written, on the platform rule its card is lowered onto (as a
 *                level's hero-less first person stands, levels.js)
 *   the foes     hunters (quick.js SHOOT_FOE), a body of the range's own health (100: the rounds the range counted to
 *                drop a body are the rounds a foe takes), dormant on their spots until their section is walked into;
 *                the run's own figure where made (`refs.foe`), a stand-in person where not
 *   the tasks    the objectives mechanic (game/objectives.js), a section each; the hp the level's own (fail-on-death),
 *                rounds and health on the floor (supplies)
 *   the ground   greybox: the walls, the room primitives as blocks, each section's floor in its own value, the firing
 *                line and the exit marked. Or (`mission.map`) a FIGHTING MAP: an arena map grown under its laws for the
 *                kit's bands (arena-map/generate.js), its phases placed from its own measures (arena-map/phases.js:
 *                arm up, a clear a band, hold the heart, get out) and its blocks laid as the ground (arena-map/ground.js)
 *
 *   missionFor(G)            → the practice door's spec: {} for a world with a firing range, else null
 *   missionPlan(G, { seed?, spec?, grown? }) → { brief, mission, laws, map? } | null   (pure: the composition and its
 *                              laws; with `spec.map`, the map grown, or `grown`, the blocks a level already carries:
 *                              map { template, seed, map, laws })
 *   missionTasks(M, { lift? })      → the objectives mechanic's tasks, from a composition (lift: how high over its feet the
 *                                     body is carried, a first person's eye: where a sealed way puts it back)
 *   missionMechanics(M, { lift? })  → the level's mechanics: objectives, fail-on-death, supplies
 *   missionGround(M)         → { faces, colliders } the greybox (a mission on a map: arena-map/ground.js mapGround)
 *   missionCast(G, M, { refs?, hero?, camera?, crew? }) → { figures, entities, pilot, camera?, legend, audio? } the foes on their
 *                              spots and what the pilot carries (levels.js lays it over its own pilot; the practice room
 *                              over the range's person)
 *   missionStage(G, P)       → a mission level's stage manifest: its ground, its sky and its page's `mission`
 *   missionBuildingCube(G, B, kit) → the cube a mission in a building is read under (gen-7, its bones the building's kit;
 *                              the phases in the building: mission-building.js)
 *   missionMapOf(manifest)   → the map a laid mission carries ({ template, seed, blocks }), or null
 *   missionUi(G, M, brief, { laws }) → the manifest's `mission`: { title, theme, plan, tasks, briefing }
 *   missionLevel(G, { refs?, seed?, spec?, quiet? }) → { manifest, brief, mission, laws, ui } the practice room's build
 *   missionEnds(manifest)    → { spawn, heading, exit, beats } read off a laid mission (levels.js)
 *   MISSION_HP               the player's hp, a hit's cost, what a supply gives
 *
 * Pure but for the composition's seeded dice.
 */
import { loadoutOf } from './loadout.js';
import { rangeBody } from './combat/range-body.js';
import { SHOOT, SHOOT_FOE, SHOOT_TUNE, PERSON, shoulderOf } from './quick.js';
import { ARMS_LEGEND, armDetailed } from './arms-kit.js';
import { standFoe } from './foes.js';
import { libraryFigure, FIGURE_LIBRARY } from './stage-figures.js';
import { dressOrders } from '../foes/dress.js';
import { GRUNT_STYLES, GRUNT_STYLE_IDS } from '../cosmos/packs/comic-hero/grunts.js';
import { playerStates } from '../playscape/player.js';
import { feelRule } from './feel/lower.js';
import { blocksOf, PRIMITIVES } from '../gameroom/primitives.js';
import { missionBrief, readMission, composeMission, missionWalls, missionLaws, SECTIONS, BANDS } from '../mission/index.js';
import { MISSION_LOOK } from './mission-mana.js';
import { growArenaMap } from '../arena-map/generate.js';
import { readTownMap, readCityMap } from '../arena-map/read-town.js';
import { kitOf } from '../arena-map/laws.js';
import { mapGround, mapFloors } from '../arena-map/ground.js';
import { mapFormGround } from '../arena-map/ground-form.js';
import { ERAS } from '../era/eras.js';
import { phasesOnMap, phaseLaws } from '../arena-map/phases.js';
import { interfaceLook } from '../playscape/ui/interface-look.js';

export const MISSION_HP = Object.freeze({ hp: SHOOT.hp, hit: SHOOT.hit, health: SHOOT.health, rounds: SHOOT.rounds, foe: 100 });
// each section's floor, two values a cell: what it is read by before a word of it is
const FLOOR = Object.freeze({
  staging: ['#8b929a', '#848b93'], contact: ['#96908a', '#8f8983'], lane: ['#93918a', '#8c8a83'], overwatch: ['#8f938a', '#888c83'],
  emplacement: ['#948f93', '#8d888c'], holdout: ['#99898a', '#928283'], extract: ['#869688', '#7f8f81'],
});
const WALL = '#6f7278', CROSS = '#7d8086', LINE = '#d8c26a', EXIT = '#7fc98f', CELL = 2;
const r2 = (v) => Math.round(v * 100) / 100;
const flat = (x0, y0, x1, y1, z, fill, group) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill, group, doubleSided: true });
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group });
// a box on the floor: its top and four sides (no bottom), and its collider (the gym's own, combat/gym.js `box`)
function box(x0, y0, x1, y1, h, fill, group) {
  return {
    faces: [
      quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group),
      quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
      quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group),
    ],
    collider: { min: [x0, y0, 0], max: [x1, y1, h] },
  };
}
// the stand-in foe: a person of the figure library, as the practice rooms stand one (practice-room.js dummyFigure)
/** A crew's bodies: `bodies` people of a faction's kind (its first, the rank and file: the rifleman, the soldier, the
 *  tough; or the `kind` named), each rolled on its own seed so no two are one face, dressed by the hero door's own words
 *  (foes/dress.js), standing and walking on the figure library's clips as the stand-in does. A crew is
 *  '<faction>' | { faction, kind?, colourway?, bodies?, masks?: true (CREW_MASKS) | [headgear words] }. */
/** What a masked crew wears over its faces, a body each in turn: the headgear shelf's words (headgear/cards.js). */
export const CREW_MASKS = Object.freeze(['tacticalMask', 'gasMask', 'respirator']);
/** The holds a crew's body plays by what it carries (the hero door's hold words): firing, and standing. */
export const CREW_HOLDS = Object.freeze({ carbine: Object.freeze({ fire: 'carbineAim', idle: 'carbineLowReady' }), pistol: Object.freeze({ fire: 'pistolIsosceles', idle: 'pistolLowReady' }) });
/** What a crew's body plays when a round lands on it: the figure library's hit, once through (the page's `flinch`). */
export const CREW_FLINCH = 'Hit_Chest';
const CREW_MASK_TONES = Object.freeze({ Mask: '#1b1d20', MaskDomino: '#1b1d20', Helm: '#1b1d20', MaskMouth: '#15171a', MaskTrim: '#2c2f33', MaskSeam: '#2c2f33', MaskFilter: '#2c2f33', Trim: '#2c2f33', MaskLens: '#7d8a88' });
export function crewFigures(crew, seed = 1) {
  const { bodies = 3, masks = null, ...C } = typeof crew === 'string' ? { faction: crew } : crew, kinds = Object.keys(GRUNT_STYLES[C.faction]?.kinds ?? {});
  if (!kinds.length) throw new Error(`mission: no crew '${C.faction}' (${GRUNT_STYLE_IDS.join(', ')})`);
  return Array.from({ length: bodies }, (_, k) => {
    const { gesture: _g, statue: _s, vibe: _v, ...spec } = dressOrders({ people: 'human', dress: { kind: kinds[0], ...C } }, { seed: (seed | 0) + 7 * k }).mint.spec;
    const worn = masks === true ? CREW_MASKS : Array.isArray(masks) && masks.length ? masks : null;
    // (the masks in the crew's own dark, their lenses a dull glass: never the shelf's showier tones)
    if (worn) { spec.headgear = worn[k % worn.length]; spec.palette = { ...spec.palette, ...CREW_MASK_TONES }; }
    // (what it does with the gun in its hands: the hero door's own holds for it, hero-carry.js: the weapon up as it
    // fires (`fire`, the page plays it while its trigger is down), at the low ready as it stands)
    const held = CREW_HOLDS[spec.gear?.right?.item] ?? null;
    if (held) spec.motion = { ...(spec.motion ?? {}), [held.fire]: true, [held.idle]: true };
    return { hero: spec, library: FIGURE_LIBRARY, clips: { ...playerStates([], FIGURE_LIBRARY), forward: 'Walk_Loop', flinch: CREW_FLINCH, ...(held ? { fire: held.fire, idle: held.idle } : {}) } };
  });
}
const r3 = (v) => Math.round(v * 1000) / 1000;
/** A squadmate's share of the pilot's own gun: it helps a fight, it does not win one (the mission is the pilot's). */
export const SQUAD_SHARE = 0.3;
/** The side the pilot and its squad are on (a mission with a squad). */
export const SQUAD_TEAM = 'squad';
const standIn = () => ({ hero: { cast: 'female' }, library: FIGURE_LIBRARY, clips: { ...playerStates([], FIGURE_LIBRARY), forward: 'Walk_Loop' } });
const SKY = Object.freeze({ zenith: [120, 140, 170], horizon: [200, 205, 210], day: 1, stars: 0, seed: 1 });
const BG = '#9aa0a8';

/** The practice door's spec: a world with a firing range has a mission. */
export function missionFor(G) { return loadoutOf(G) ? {} : null; }

// a map grown once for its template, seed and kit (growing is a second or three; a world's run reads its stages more
// than once): kept by those, a few at a time
const GROWN = new Map(), GROWN_KEPT = 8;
function grownMap(template, seed, kit, place = null) {
  const k = JSON.stringify([template, seed, kit, place]);
  if (!GROWN.has(k)) {
    if (GROWN.size >= GROWN_KEPT) GROWN.delete(GROWN.keys().next().value);
    // (a PLACE: a town's or a city's cut read onto the grid, arena-map/read-town.js, then grown with what it is made of kept)
    const given = place ? (place.town ? readTownMap(place.town, { seed, size: place.size, ...(place.block ? { block: place.block } : {}) }) : readCityMap(place.city, { seed, on: place.on, size: place.size, ...(place.at ? { at: place.at } : {}) })) : null;
    GROWN.set(k, growArenaMap({ template, seed, kit, ...(given ? { map: given } : {}) }));
  }
  const g = GROWN.get(k);
  return { ...g, map: structuredClone(g.map) };
}

/** The composition and its laws, for a world and a level's own `mission` (true or its settings). */
export function missionPlan(G, { seed = null, spec = {}, grown = null } = {}) {
  const S = spec === true ? {} : spec, brief = missionBrief(G, S);
  if (!brief) return null;
  const dice = seed ?? S.seed ?? (Number.isInteger(G?.seed) ? G.seed : 1);
  if (brief.map) {
    // ON A MAP: the map grown for the kit under its laws (or the blocks a level carries: growing is the design step, the
    // map its data from then on), the phases placed from its measures; its laws and the map's own, as advice
    const kit = kitOf(brief), G2 = grown ? { template: brief.map.template, seed: dice, map: grown, laws: [] } : grownMap(brief.map.template, dice, kit, brief.map.place ?? null);
    const mission = phasesOnMap(brief, G2.map, { seed: dice });
    mission.climbs = mapGround(G2.map).entities;
    // (the map's upper floors and the ramps up to them, for the minds a hold sends: arena-map/ground.js mapFloors)
    mission.floors = mapFloors(G2.map);
    const mapLawsHeld = G2.laws.map((l) => ({ law: `map:${l.law}`, holds: l.holds, says: l.says }));
    if (brief.squad) mission.squad = brief.squad;
    return { brief, mission, laws: [...phaseLaws(mission, G2.map), ...mapLawsHeld], map: { template: G2.template, seed: G2.seed, map: G2.map } };
  }
  const mission = composeMission(brief, { seed: dice });
  if (brief.squad) mission.squad = brief.squad;
  return { brief, mission, laws: missionLaws(mission, brief) };
}

const zoneOf = (S, M) => (S.zone ? { zone: { at: S.zone.at.slice(), radius: S.zone.radius } } : S.zone === null || !S.x ? {} : { zone: { at: [r2((S.x[0] + S.x[1]) / 2), 0, 1], half: [r2((S.x[1] - S.x[0]) / 2 - 0.8), M.half, 3] } });

/** The objectives mechanic's tasks: a section each, its box the zone that begins it, its doorway the way on. */
export function missionTasks(M, { lift = 0 } = {}) {
  return M.sections.map((S) => {
    const T = S.task;
    return {
      id: S.id, kind: T.kind, text: T.text,
      // (down one line, the section's box; a section with a round zone of its own, that one; none: it begins as the one
      // before is met)
      ...zoneOf(S, M),
      // (a place read at its height, a building's storeys: on its floor, met at the body's eye, never from over or under)
      ...(T.at ? { at: T.planar === false ? [T.at[0], T.at[1], r2(T.at[2] + lift)] : T.at.slice() } : {}), ...(T.planar === false ? { planar: false } : {}),
      ...(T.foes ? { foes: T.foes.slice() } : {}), ...(T.gun ? { gun: T.gun } : {}),
      ...(T.kind === 'hold' ? { seconds: T.seconds, every: T.every, waves: T.waves.map((w) => w.slice()) } : {}),
      ...(S.door ? { door: { at: S.door.at.slice(), back: [S.door.back[0], S.door.back[1], r2(S.door.back[2] + lift)], ...(S.door.radius ? { radius: S.door.radius } : {}) } } : {}),
    };
  });
}

/** The level's mechanics: the tasks, the level's own hp, what lies on the floor. */
export function missionMechanics(M, { lift = 0 } = {}) {
  const drops = M.sections.flatMap((S) => S.drops.map((d) => ({ at: d.at.slice(), gives: d.gives, amount: d.gives === 'health' ? MISSION_HP.health : MISSION_HP.rounds })));
  return [
    { kind: 'objectives', id: 'obj', tasks: missionTasks(M, { lift }) },
    { kind: 'fail-on-death', startHp: MISSION_HP.hp, hits: MISSION_HP.hit },
    ...(drops.length ? [{ kind: 'supplies', max: MISSION_HP.hp, drops }] : []),
  ];
}

/** The greybox: each section's floor, the firing lines, the exit, the walls, every primitive a block. */
export function missionGround(M) {
  const faces = [], colliders = [], H = M.half;
  for (const S of M.sections) {
    const [x0, x1] = S.x, tone = FLOOR[S.kind] ?? FLOOR.staging;
    for (let x = x0, i = 0; x < x1 - 1e-6; x += CELL, i++) for (let y = -H, j = 0; y < H - 1e-6; y += CELL, j++) faces.push(flat(x, y, Math.min(x + CELL, x1), Math.min(y + CELL, H), 0, tone[(i + j) % 2], `mission:floor:${S.id}`));
    if (SECTIONS[S.kind].fight) faces.push(flat(S.line - 0.06, -H, S.line + 0.06, H, 0.012, LINE, 'mission:line'));
  }
  const E = M.anchors.exit;
  faces.push(flat(E[0] - 1.2, E[1] - 1.2, E[0] + 1.2, E[1] + 1.2, 0.012, EXIT, 'mission:exit'));
  const put = (b, fill, group) => { const B = box(b.x[0], b.y[0], b.x[1], b.y[1], b.h, fill, group); faces.push(...B.faces); colliders.push(B.collider); };
  for (const w of missionWalls(M)) put(w, w.group === 'mission:cross' ? CROSS : WALL, w.group);
  for (const p of M.primitives) for (const b of blocksOf(p)) put(b, b.fill ?? PRIMITIVES[p.kind].fill, `mission:${p.kind}`);
  return { faces, colliders };
}

/** The foes on their spots (dormant, woken by their section's task) and what the pilot carries. `hero`: the pilot has a
 * body (its eye over its feet); `camera`: the world's, so a hero seen from behind aims over its shoulder (quick.js
 * SHOULDER: its rounds converge on the crosshair). `refs.foe`: the foes' made figure, or a pool of them cycled. */
export function missionCast(G, M, { refs = {}, hero = false, camera = null, quiet = false, crew = null } = {}) {
  const L = loadoutOf(G);
  if (!L) throw new Error('mission: this world carries no gun (a quick shooter\'s arms, a hero\'s carried gun, or a feel template that shoots)');
  // the range's own body: its slots, its sights and its knife, its rounds counted against a body of the range's health
  const R = rangeBody({ weapons: L.weapons, ...(L.skins ? { skins: L.skins } : {}), foe: { hp: MISSION_HP.foe }, quiet, name: G?.name ?? G?.id ?? 'mission' });
  const figures = {}, entities = [], part = { figures, entities };
  const pool = Array.isArray(refs.foe) ? refs.foe : typeof refs.foe === 'string' ? [refs.foe] : null;
  const tune = { ...SHOOT_TUNE, body: { ...SHOOT_TUNE.body, hp: MISSION_HP.foe } };
  // (`crew`: the foes dressed as one crew, each of its kinds in turn: foes/dress.js, a faction of the grunts; a made
  // figure given wins; none of either, the stand-in)
  const dressed = !pool && crew ? crewFigures(crew, M.seed) : null;
  let n = 0;
  for (const S of M.sections) for (const f of S.foes) standFoe(null, part, { id: f.id, entry: SHOOT_FOE, at: f.at.slice(), heading: f.heading }, { figure: pool ? libraryFigure(pool[n++ % pool.length]) : dressed ? dressed[n++ % dressed.length] : standIn(), tune, more: { dormant: true } });
  // THE SQUAD (`M.squad`, the level's `mission.squad`): who fights beside the pilot. Each a body at the pilot's shoulder
  // as the mission begins, on the pilot's side (a team: no round of theirs harms the pilot, nor the pilot's them), its
  // mind an escort's: it keeps by the pilot and fights whom it sees of the other side. It carries the pilot's
  // first gun and three times a foe's health; nothing of the mission counts it, and it can fall
  // (its gun is the pilot's own first, fired from a body's eye, never run dry, at a share of its harm (the fight is the pilot's): a foe's gun is counted in hits on the
  // pilot's bar and would not drop a foe)
  const own = R.pilot.rule.loadout?.[0]?.weapon ?? null, mateGun = own ? (({ reserve: _r, sfx: _s, ...w }) => ({ ...w, eye: 1.4, damage: Math.round((w.damage ?? 1) * SQUAD_SHARE * 100) / 100 }))(own) : null;
  for (let k = 0; k < (M.squad ?? 0); k++) {
    const sp = M.anchors.spawn, h = M.heading, side = (k % 2 ? -1 : 1) * 1.3 * (1 + Math.floor(k / 2));
    const at = [r3(sp[0] - Math.sin(h) * side - Math.cos(h) * 1.2), r3(sp[1] + Math.cos(h) * side - Math.sin(h) * 1.2), sp[2]];
    standFoe(null, part, { id: `ally-${k + 1}`, entry: SHOOT_FOE, at, heading: h }, { figure: standIn(), tune: { ...tune, ...(mateGun ? { weapon: mateGun } : {}), team: SQUAD_TEAM, rule: { ...tune.rule, mind: { motivation: 'escort' }, escort: 'player', followDist: 4, target: 'enemy' }, body: { ...tune.body, hp: MISSION_HP.foe * 3 } } });
  }
  // A WAVE IS SENT TO THE FIGHT: the foes a hold wakes know where the body is (the mind with no `perception`: the arena's
  // brain, worlds/controllable/mind.js) and path to it, where a hunter by sight and memory woken out of sight has seen
  // no one and stands where it was put. The foes of a clear keep their class's sight and memory: they are found
  const sent = new Set(M.sections.filter((S) => S.task.kind === 'hold').flatMap((S) => S.foes.map((f) => f.id)));
  // ON A MAP WITH FLOORS a sent wave crosses them: the match player's mind (it goes to where its foe is, by a ramp to
  // another floor and down one: `rule.floors`), its path kept to ground it can stand on (`navLedges`: round a well,
  // along a gallery, never out over a drop; a mission whose upper floors are railed all round says `ledges: false`, and
  // its minds ask the ground nothing: a probe a cell is a ray through the page, dear on a big place). It keeps to ramps: a mind climbs no ladder, and reaches no floor over a floor
  const floors = M.floors?.length ? M.floors : null;
  for (const e of entities) {
    if (!sent.has(e.id) || !e.rule?.mind) continue;
    if (floors) e.rule = { ...e.rule, mind: { ...e.rule.mind, motivation: 'frag', perception: 'memory' }, floors: structuredClone(floors), ...(M.ledges === false ? {} : { navLedges: true }) };
    else if (e.rule.mind.perception) { const { perception: _p, ...mind } = e.rule.mind; e.rule = { ...e.rule, mind }; }
  }
  // (a map's ladders: the runtime's climbs, arena-map/ground.js)
  if (M.climbs?.length) entities.push(...structuredClone(M.climbs));
  // (a hero's guns are fired from its eye over its feet, and over its shoulder they converge on the crosshair: the kit's
  // own placing, arms-kit.js kitSlot)
  const over = shoulderOf(camera ?? 'third-person', hero) && camera !== 'first-person' ? shoulderOf(camera ?? 'third-person', hero) : null;
  const place = (w) => (hero ? { ...w, eye: 1.5, ...(over ? { converge: true } : {}) } : w);
  // (and each gun is drawn in the hands as the arms library builds it, not as its boxes: arms-kit.js armDetailed)
  const loadout = R.pilot.rule.loadout ? R.pilot.rule.loadout.map((slot) => armDetailed({ ...slot, weapon: place(slot.weapon) })) : null, knife = R.pilot.rule.knife ?? null;
  const pilot = {
    ...(M.squad ? { team: SQUAD_TEAM } : {}),
    rule: { collideRadius: 0.3, collideHeight: 1.7, ...(loadout ? { loadout, gunplay: true } : {}), ...(knife ? { knife } : {}) },
    ...(loadout ? { weapon: loadout[0].weapon } : {}),
    body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } },
  };
  return { figures, entities, pilot, ...(over ? { camera: over } : {}), legend: ARMS_LEGEND, body: R.pilot, eyeCamera: R.payload.camera, ...(R.payload.audio ? { audio: R.payload.audio } : {}) };
}

/** The manifest's `mission`: what the page's mission channel draws from (mission-mana.js: the title, the theme, the
 * tasks, the briefing's words) and the plan levels.js reads its ends off (missionEnds). */
export function missionUi(G, M, brief, { laws = [], map = null } = {}) {
  const name = G?.name ?? G?.id ?? 'game';
  return {
    title: name,
    theme: G?.ui !== undefined ? interfaceLook(G).theme : MISSION_LOOK,
    plan: M.on === 'building'
      // (in a building: its anchors, the heart, each phase's entry and the frame its grid is read in, the building itself
      // the stage's: its plan regenerates from its program)
      ? { on: 'building', heading: M.heading, anchors: { spawn: M.anchors.spawn.slice(), exit: M.anchors.exit.slice() }, heart: M.heart.slice(), sections: M.sections.map((S) => ({ id: S.id, entry: S.entry.slice() })), frame: structuredClone(M.frame) }
      : M.on === 'map'
      // (on a map: its anchors, each phase's entry and the map it is fought on, its blocks as grown: the level is rebuilt
      // from them, mapGround, and never regrown)
      ? { on: 'map', ...(M.origin ? { origin: M.origin.slice() } : {}), heading: M.heading, anchors: { spawn: M.anchors.spawn.slice(), exit: M.anchors.exit.slice() }, heart: M.heart.slice(), sections: M.sections.map((S) => ({ id: S.id, entry: S.entry.slice() })), ...(map ? { map: { template: map.template, seed: map.seed, blocks: structuredClone(map.map) } } : {}) }
      : { heading: M.heading, half: M.half, length: M.length, anchors: { spawn: M.anchors.spawn.slice(), exit: M.anchors.exit.slice() }, sections: M.sections.map((S) => ({ id: S.id, x: S.x.slice(), entry: S.entry.slice() })) },
    tasks: M.sections.map((S) => ({ id: S.id, text: S.task.text, kind: S.task.kind, ...(SECTIONS[S.kind]?.radio ? { say: SECTIONS[S.kind].radio } : {}), ...(Array.isArray(S.task.at) ? { at: S.task.at.slice(0, 2) } : {}), ...(S.task.kind === 'hold' ? { seconds: S.task.seconds } : {}), ...(S.foes.length ? { foes: S.foes.length } : {}) })),
    briefing: {
      kit: brief.guns.map((g) => `${g.name}${g.band ? `: the ${g.band} band, ${BANDS[g.band].m} m` : ': the free hand'}`),
      sections: M.sections.map((S) => `${S.task.text}: ${SECTIONS[S.kind].teaches}`),
      ...(map ? { map: `${map.template}, grown on seed ${map.seed}${brief.why.map ? `: ${brief.why.map}` : ''}` } : {}),
      laws: laws.map((l) => `${l.holds ? 'holds' : 'advise'} · ${l.law}: ${l.says}`),
    },
  };
}

/** THE SHOOTER'S HUD WITH NO MISSION (a quick shooter's level, a deathmatch): the mission's page with nothing of a
 *  mission in it: the gun in hand, the health, the screen's edge, the radar, the damage ring, the map and the pause, in
 *  the world's own look (its `ui`), the level's own counters and end left the page's. A world's `mission` key, as a
 *  mission's is (scene/channels/mission.js). `rect`: where it is fought ([x0, y0, x1, y1], a bout's arena), the map's box. */
export const shooterHudUi = (G, { rect = null } = {}) => ({ title: G?.name ?? G?.id ?? 'game', theme: G?.ui !== undefined ? interfaceLook(G).theme : MISSION_LOOK, tasks: [], plain: true, ...(rect ? { rect: rect.map((v) => Math.round(v * 100) / 100) } : {}) });

/** A mission level's stage (levels.js gameStages): its ground and what its page draws from, the pilot and the cast laid
 * over it by levelOrder. `P`: missionPlan's. */
/** The cube a mission is read under: the world's own (its style's), in the SEVENTH GENERATION unless the cube names its
 * era (era/eras.js: an era is a render, and the cube's is the read's default). A mission is fought among bodies that
 * move: the form render's live light (the actors' shadows, the hour's map, contact occlusion) is what parts them from
 * the floor. Its greybox and its figures are still drawn as paint under that light (era/era-marks.js says which). */
export function missionCube(G) {
  const c = G?.style?.geocube ?? 'valley-morning', cube = typeof c === 'string' ? { from: c } : c;
  return cube.era ? cube : { ...cube, era: 'gen-7' };
}

/** The cube a mission in a building is read under (levels.js, a building level with a mission beside it): the world's
 * own, in the seventh generation unless it names its era (missionCube), its bones the building's own kit (the room kit
 * its use names: era/programs.js), so the building is laid as it would be and drawn by the form render (era/stage.js:
 * `form.room`, its lamps placed and its tiles read as material). A building that names its own cube keeps it, its era
 * the seventh generation unless it names one. */
export function missionBuildingCube(G, B, kit) {
  if (B.geocube !== undefined) { const c = typeof B.geocube === 'string' ? { from: B.geocube } : B.geocube; return c.era ? c : { ...c, era: 'gen-7' }; }
  const c = missionCube(G);
  return { ...c, inside: { ...(c.inside ?? {}), bones: kit } };
}

export function missionStage(G, P) {
  // (a map read by the seventh generation: its blocks as material under the cube's day, arena-map/ground-form.js, drawn by
  // the form render; in the sixth, or on the lane, the greybox as painted)
  const cube = missionCube(G), formed = !!P.map && ERAS[cube.era]?.surface === 'form';
  const ground = P.map ? (formed ? mapFormGround(P.map.map, { cube }) : mapGround(P.map.map)) : missionGround(P.mission);
  return { kind: 'controllable', title: 'mission', geocube: cube, bg: BG, faces: ground.faces, colliders: ground.colliders, ...(formed ? { form: ground.form } : {}), sky: { ...SKY }, mission: missionUi(G, P.mission, P.brief, { laws: P.laws, map: P.map ?? null }) };
}

/** The blocks a laid mission's map was grown into, carried by its manifest (`mission.plan.map`), or null. */
export const missionMapOf = (manifest) => manifest?.mission?.plan?.map ?? null;

/** The mission as the practice room plays it: the range's person from the eye, on the mission's ground. */
export function missionLevel(G, { refs = {}, seed = null, spec = true, quiet = false } = {}) {
  const P = missionPlan(G, { seed, spec: readMission(spec ?? true) });
  if (!P) throw new Error('mission: this world carries no gun (a quick shooter\'s arms, a hero\'s carried gun, or a feel template that shoots)');
  const { brief, mission: M, laws } = P, C = missionCast(G, M, { refs, quiet }), stage = missionStage(G, P);
  // the body: the range's walker, or (a feel written) the platform rule its card is lowered onto, at the eye
  const felt = G?.feel != null ? feelRule(G.feel) : null, eye = brief.eye;
  // (on a fighting map, the platform rule with or without a feel: the walker climbs no ramp and drops off no edge)
  const rule = felt
    ? { type: 'platform', speed: 4.5, walkSpeed: 1.6, turn: 2.4, eye, step: 0.3, ...felt, turnMode: 'look', lookPitch: true, strafe: 1, ...C.pilot.rule }
    : M.on === 'map' ? { ...C.body.rule, type: 'platform', walkSpeed: 1.6, step: 0.3 } : { ...C.body.rule };
  const A = M.anchors;
  const player = { id: 'player', pilotable: true, ...(C.pilot.team ? { team: C.pilot.team } : {}), rule, ...(C.pilot.weapon ? { weapon: C.pilot.weapon } : {}), body: { type: 'none', ...C.pilot.body }, transform: { pos: [A.spawn[0], A.spawn[1], A.spawn[2] + eye], heading: M.heading } };
  const name = G?.name ?? G?.id ?? 'game';
  const manifest = {
    ...stage, title: `Mission · ${name}`,
    figures: C.figures, entities: [player, ...C.entities], camera: C.eyeCamera,
    events: { hud: [{ text: `W / S  walk · A / D  step aside · mouse  look · ${C.legend}${C.pilot.rule.knife ? ' · V  knife' : ''}`, ttl: 20 }] },
    ...(C.audio ? { audio: C.audio } : {}),
    // (played alone, before it is a level of a game: its own name; levels.js names a level's. Its result card is put away:
    // the debrief is mana-ui's, or the shell's own result screen)
    game: { levelRef: `${G?.id ?? 'game'}-mission`, mechanics: missionMechanics(M, { lift: eye }), fall: { mode: 'respawn' }, complete: false },
  };
  return { manifest, brief, mission: M, laws, ...(P.map ? { map: P.map } : {}) };
}

/** A laid mission's anchors, read off its manifest (the stage levels.js carries: `mission.plan`). */
export function missionEnds(manifest) {
  const M = manifest?.mission?.plan;
  if (!M) throw new Error('mission: the stage carries no mission plan');
  return { spawn: M.anchors.spawn.slice(), heading: M.heading, exit: M.anchors.exit.slice(), exitFrom: [r2(M.anchors.exit[0] - 2), M.anchors.exit[1], 0], beats: M.sections.map((S) => ({ beat: S.id, at: S.entry.slice() })), planar: true };
}

export { BANDS as MISSION_BANDS };
