/**
 * THE LEVELS MADE PLAYABLE — each stage of a gameworld's levels as a world the hero pilots. A level is laid as one walk
 * of stages (level/sequential.js), and a stage is already a walkable world kind (`stage`, era/stage.js): its ground,
 * its colliders, its first-person spawn, the beats of its trail or the tiers of its climb. This puts the hero on it as
 * the pilot (playscape/player.js, without the player test's floor), spawned where the stage spawns a walker, facing the
 * way out, with the systems' play block (the stats, the HUD, the powers on their keys) and the game's destruction degree,
 * and a `game` channel whose exit is the stage's own end: a trail's exit beat, a climb's top tier. One game level per
 * stage, in walking order; a level's stages are not joined into one world.
 *
 * WALKABLE, NOT BEATABLE. What a stage's construction gives is ground the hero stands on from the spawn; whether a level
 * can be beaten (the moves, the numbers, the obstacles, the timing) is the creator's to judge in play. Nothing here
 * claims it.
 *
 *   gameStages(G)                          → [{ level, node, section, index, manifest }] every stage, the start level first
 *   stageEnds(manifest)                    → { spawn, heading, exit, exitFrom } read off the laid stage
 *   stageLevelOrder(G, stage, { ref, heroRef, mechanics, title }) → the create_sketch call that makes it
 *   gameStore(G, book)                     → the create_game store: the hero, the gear, the campaign
 *
 * Pure (the stage is assembled to read its ends; nothing is stored).
 */
import { readGameworld, resolveLevel } from './world.js';
import { layLevel } from '../level/index.js';
import { assembleStageScene } from '../era/stage.js';
import { playerWorld, playerStates } from '../playscape/player.js';
import { resolveEquipment } from './equipment.js';
import { outTrailOf } from '../era/out-trail-board.js';
import { TRAVERSAL_MOVES } from './actions.js';
import { sceneFlags, sceneNeeds } from '../playscape/ui/scenes.js';
import { storyScene, levelQuests } from './story.js';

const EYE_FALLBACK = 1.7;
// a person's eye over a hero whose position is its feet (playerWorld's pilot stands at eye 0)
const HERO_EYE = 1.6;
// the ¾ overhead camera: north up the screen, 60° below the horizon, far enough back to read a trail's next turn
const OVERHEAD = Object.freeze({ yaw: Math.PI / 2, tilt: Math.PI / 3, dist: 14, lookH: 1 });
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Every stage of every level, the start level first, then the rest in the world's order. */
export function gameStages(world) {
  const G = readGameworld(world), order = [G.start, ...G.ids.filter((id) => id !== G.start)], out = [];
  for (const level of order) {
    const laid = layLevel(resolveLevel(G, level).level);
    laid.stages.forEach((s, i) => out.push({ level, node: s.node, section: s.section, index: i, manifest: s.manifest }));
  }
  return out;
}

/** Where a stage spawns the hero and where it ends, read off the stage as it lays (drawn once per stage recipe: a
 * stage is pure, so the same recipe always ends the same). */
const ENDS = new Map();
export function stageEnds(manifest) {
  const key = JSON.stringify(manifest);
  if (!ENDS.has(key)) { if (ENDS.size > 64) ENDS.clear(); ENDS.set(key, readEnds(manifest)); }
  return ENDS.get(key);
}
function readEnds(manifest) {
  const P = assembleStageScene(manifest), walk = P.walk ?? {};
  if (!Array.isArray(walk.spawn)) throw new Error(`levels: the stage '${manifest.trail?.id ?? manifest.meru?.id ?? '?'}' lays no spawn to put the hero at`);
  const eye = Number.isFinite(walk.minEye) ? walk.minEye : EYE_FALLBACK;
  const spawn = [r3(walk.spawn[0]), r3(walk.spawn[1]), r3(walk.spawn[2] - eye)];
  const anchors = P.anchors ?? [];
  let exit = null, exitFrom = null;
  // a trail: the exit beat of its own trail (the pages after the first also carry the trail before it)
  const own = manifest.trail ? `out-trail:${manifest.trail.id}` : null;
  const beat = anchors.find((a) => a.kind === 'beat' && a.beat === 'exit' && (!own || a.trail === own));
  if (beat) { exit = beat.at; exitFrom = 'the trail\'s exit beat'; }
  // a climb: its highest tier (the top it is climbed for)
  if (!exit) {
    const tiers = anchors.filter((a) => a.kind === 'tier' && Array.isArray(a.at));
    const top = tiers.reduce((m, a) => (!m || a.at[2] > m.at[2] ? a : m), null);
    if (top) { exit = top.at; exitFrom = `the climb's top tier, ${top.id}`; }
  }
  if (!exit) throw new Error('levels: the stage lays neither a trail exit nor a climb\'s tiers to end at');
  exit = exit.map(r3);
  // facing the way on: a trail's next beat past where the hero stands (it winds), a climb's foot; else the exit itself
  const d2 = (a) => (a.at[0] - spawn[0]) ** 2 + (a.at[1] - spawn[1]) ** 2;
  const ahead = beat
    ? anchors.filter((a) => a.kind === 'beat' && a.trail === own && Number.isFinite(a.s) && d2(a) > 16).sort((a, b) => a.s - b.s)[0]
    : anchors.filter((a) => a.kind === 'tier' && Array.isArray(a.at) && d2(a) > 16).sort((a, b) => a.at[2] - b.at[2])[0];
  const toward = ahead?.at ?? exit;
  const heading = r3(Math.atan2(toward[1] - spawn[1], toward[0] - spawn[0]));
  // what lies along the way: the trail's own beats (in order) and its hazards, for a goal to be placed on
  const beats = beat ? anchors.filter((a) => a.kind === 'beat' && a.trail === own && Number.isFinite(a.s)).sort((a, b) => a.s - b.s).map((a) => ({ beat: a.beat, at: a.at.map(r3) })) : [];
  const hazards = anchors.filter((a) => a.kind === 'hazard' && Array.isArray(a.at) && (!own || a.trail === own)).map((a) => ({ id: a.id, at: a.at.map(r3) }));
  // a climb's top is reached by climbing, so its zone is a volume: standing beneath the top is not reaching it
  return { spawn, heading, exit, exitFrom, planar: !!beat, beats, hazards };
}

/**
 * The call that makes one stage a game level: `create_sketch` of the stage with the hero as the pilot, the systems'
 * play block and inputs (when the world has systems), and `game: { levelRef, mechanics: [reach-exit], fall }`.
 * `mechanics` is resolveMechanics' result (or null); `ref` the level's own sketch ref (its levelRef).
 */
export function stageLevelOrder(G, stage, { ref, heroRef, mechanics = null, title, goal, map = null, story = null, carryFrom = null, party = null } = {}) {
  const ends = stageEnds(stage.manifest);
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  // the camera (the gameworld's `camera`, cosmos space.camera). Absent keeps every arg below as it was, so the steps'
  // fingerprints hold: third person with a hero, the old first-person walker without one.
  const cam = G.camera ?? null;
  if (cam === 'top-down' && !heroRef) throw new Error('levels: a top-down camera watches a hero; give the world a hero (quick.hero, or its characters), or play it first-person');
  if (cam === 'side' && !heroRef) throw new Error('levels: a side camera watches a hero run its lane; give the world a hero, or play it first-person');
  if (cam === 'third-person' && !heroRef) throw new Error('levels: a third-person camera follows a hero; give the world a hero, or play it first-person');
  const look = cam === 'first-person', top = cam === 'top-down', lane = cam === 'side' ? stageLane(stage) : null;
  const moveWords = lane ? 'A / D  run' : top ? 'W A S D  move' : look ? `W / S  ${heroRef ? 'run' : 'walk'} · A / D  step aside · mouse  look` : `W / S  ${heroRef ? 'run' : 'walk'} · A / D  turn`;
  const controls = `${moveWords}${heroRef ? ' · Space  jump' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const placed0 = goal ? goal(ends) : [{ kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }) }];
  // a MAP world: the stage's one exit becomes its ways out (each a named reach-exit), and its arrivals move the pilot
  const ways = map ? stageWays(stage, ends, map) : null;
  const placed = ways ? [...placed0.filter((m) => m.kind !== 'reach-exit'), ...ways.mechanics] : placed0;
  const game = { levelRef: ref, mechanics: lane ? placed.map((m) => onLane(m, lane)) : placed, fall: { mode: 'respawn' }, ...(ways && ways.arrive.length ? { arrive: ways.arrive.map((a) => a.from) } : {}) };
  let pilotPart;
  if (heroRef) {
    // first person rides the hero's eye in look mode, its body hidden; top-down moves it in the screen's frame
    const rule = look ? { turnMode: 'look' } : top ? { move: 'world', moveYaw: OVERHEAD.yaw } : lane ? { move: 'lane', lane: lane.line } : undefined;
    const P = playerWorld({ heroRef, id: 'hero', title: name, controls, ...(rule ? { rule } : {}) });
    const events = { ...(P.events || {}), ...(mechanics?.inputs?.length ? { inputs: [...(P.events?.inputs ?? []), ...mechanics.inputs] } : {}) };
    const camera = look ? { rule: 'eye', target: 'hero', height: HERO_EYE, mouseLook: true, hideTarget: true }
      : top ? { rule: 'overhead', target: 'hero', ...OVERHEAD }
        : lane ? { rule: 'side', target: 'hero' }
        : P.camera;
    pilotPart = { figures: P.figures, entities: [{ ...P.entities[0], transform: { pos: ends.spawn, heading: ends.heading } }], camera, events };
  } else {
    // FIRST PERSON: no hero; you are the camera, a walker held at the stage's own eye height. Asked for by name, it
    // looks with the mouse (yaw and pitch) through an `eye` camera; unnamed, it keeps the old tank-turn walker.
    const P = playerWorld({ heroRef: 'none', id: 'player', title: name, controls });   // for its legend only: no figure is kept
    const rule = { type: 'walk', speed: 4.5, turn: 2.4, eye: EYE_FALLBACK, ...(look ? { turnMode: 'look', lookPitch: true, strafe: 1 } : {}) };
    pilotPart = {
      entities: [{ id: 'player', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [ends.spawn[0], ends.spawn[1], ends.spawn[2] + EYE_FALLBACK], heading: ends.heading } }],
      camera: look ? { rule: 'eye', target: 'player', height: 0, mouseLook: true } : { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2 },
      events: P.events || {},
    };
  }
  if (ways && ways.arrive.length) {
    const pilot = pilotPart.entities[0].id, ev = pilotPart.events || {};
    const moves = ways.arrive.map((a) => ({ on: `arrive:${a.from}`, do: 'move', target: pilot, to: lane ? onLane({ at: a.at }, lane).at : a.at }));
    pilotPart = { ...pilotPart, events: { ...ev, reactions: [...(Array.isArray(ev.reactions) ? ev.reactions : []), ...moves] } };
  }
  // POWER KEYS (a map world): every stage hears what the hero holds, and a held power with a move changes the hero's rule
  const pk = map ? powerKeys(G) : [];
  if (pk.length) {
    game.consumes = [{ slice: 'powers' }];
    const base = heroRef ? pilotPart.entities[0].rule : null;
    const grants = Object.fromEntries(base ? pk.filter((p) => p.move).map((p) => [p.id, TRAVERSAL_MOVES[p.move].rule(base)]) : []);
    if (Object.keys(grants).length) game.powers = { slice: 'powers', target: pilotPart.entities[0].id, grants };
  }
  // SCENES (the level's, playscape/ui/scenes.js): the ones this stage plays, its places as spots to frame and walk to,
  // and the story slice carried when the world's scenes use flags
  const scenes = [...(G.scenes?.[stage.level] ?? []).filter((s) => (s.stage ?? (stage.index === 0 ? stage.node : null)) === stage.node).map(({ stage: _, ...s }) => s), ...(story?.scenes ?? [])];
  // THE STORY's people in this stage (story.js bindStory): each a made cast figure standing at its place, after the
  // pilot (entities[0] stays the pilot)
  if (story?.cast?.length) {
    const figures = { ...(pilotPart.figures ?? {}) }, entities = [...pilotPart.entities];
    for (const c of story.cast) {
      if (!c.ref) continue;
      figures[c.id] = { heroRef: c.ref, library: 'quaternius-ual', clips: { ...playerStates([], 'quaternius-ual'), forward: 'Walk_Loop' } };
      entities.push({ id: c.id, rule: { type: 'static', eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 }, body: { type: 'figure-rig', figure: c.id }, transform: { pos: c.at, heading: c.heading } });
    }
    pilotPart = { ...pilotPart, figures, entities };
  }
  // THE PARTY (playscape/ui/party.js): each cast member who joins on a flag, in every stage, on the escort motive. One
  // the story stands here waits at its stand until it joins; elsewhere it is minted asleep behind the start and wakes
  // when the flag is set or carried in.
  const joiners = (party ?? []).filter((p) => p.ref), members = [], stands = [];
  if (joiners.length) {
    const figures = { ...(pilotPart.figures ?? {}) }, entities = [...pilotPart.entities], pilot = entities[0], h = ends.heading;
    joiners.forEach((p, i) => {
      figures[p.id] ??= { heroRef: p.ref, library: 'quaternius-ual', clips: { ...playerStates([], 'quaternius-ual'), forward: 'Walk_Loop' } };
      const rule = { type: 'ai', mind: { motivation: 'escort' }, escort: pilot.id, followDist: 2.5, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(Number.isFinite(pilot.rule?.speed) ? { speed: pilot.rule.speed } : {}) };
      const k = entities.findIndex((e) => e.id === p.id);
      if (k >= 0) {
        entities[k] = { ...entities[k], rule, team: 'party' };
        stands.push({ id: `stand-${p.id}`, at: entities[k].transform.pos.slice(0, 2) });
        members.push({ who: p.id, joins: p.joins, at: `stand-${p.id}` });
      } else {
        const back = 2 + i * 1.2, aside = (i % 2 ? -1 : 1) * 1.2, s = ends.spawn;
        const at = [r3(s[0] - Math.cos(h) * back - Math.sin(h) * aside), r3(s[1] - Math.sin(h) * back + Math.cos(h) * aside), s[2]];
        entities.push({ id: p.id, rule, team: 'party', dormant: true, body: { type: 'figure-rig', figure: p.id }, transform: { pos: at, heading: h } });
        members.push({ who: p.id, joins: p.joins });
      }
    });
    pilotPart = { ...pilotPart, figures, entities };
  }
  let play = mechanics?.play ?? null;
  if (members.length) play = { ...(play ?? {}), party: members, ...(stands.length ? { spots: [...(play?.spots ?? []), ...stands] } : {}), carry: STORY_SLICE };
  // THE QUESTS (story.js, playscape/ui/quests.js): every stage keeps the journal, its flags carried in the story slice
  if (G.quests?.length) play = { ...(play ?? {}), quests: levelQuests(G.quests), carry: STORY_SLICE };
  if (scenes.length) {
    const spots = stageSpots(ends, lane);
    // where a scene's has and done read: the game's inventories and its campaign (only when its scenes ask)
    const asks = sceneNeeds({ scenes }), from = carryFrom && (asks.items.length || asks.done.length) ? carryFrom : null;
    play = { ...(play ?? {}), spots: [...(play?.spots ?? []), ...spots], scenes, ...(storyCarried(G) ? { carry: STORY_SLICE } : {}), ...(from ? { carryFrom: from } : {}) };
  }
  const manifest = { ...stage.manifest, title: name, ...pilotPart, ...(play ? { play } : {}), ...(mechanics?.destruction ? { destruction: mechanics.destruction } : {}), game };
  return { tool: 'create_sketch', args: { title: name, manifest }, ends };
}

/** A stage's places by name: its start (the spawn), its exit, its pockets and landmarks in trail order (pocket,
 * pocket-2…), each on the lane when the stage is run side on. */
export function stageSpots(ends, lane = null) {
  const at = (p) => (lane ? onLane({ at: p }, lane).at : p);
  const named = (kind) => ends.beats.filter((b) => b.beat === kind).map((b, i) => ({ id: i ? `${kind}-${i + 1}` : kind, at: at(b.at) }));
  return [{ id: 'start', at: at(ends.spawn) }, { id: 'exit', at: at(ends.exit) }, ...named('pocket'), ...named('landmark')];
}

/** The flags slice a world's scenes ride between levels, when any of them reads or sets a flag. */
export const STORY_SLICE = 'story';
export const storyCarried = (G) => Object.values(G.scenes ?? {}).some((list) => sceneFlags({ scenes: list.map(({ stage: _, ...s }) => s) }).length > 0)
  || sceneFlags({ scenes: (G.story ?? []).map((m) => storyScene(m)) }).length > 0 || !!G.quests?.length
  || Object.values(G.characters?.cast ?? {}).some((m) => m.joins);

/**
 * A side-scroller's lane on a stage: the trail's own spine, one point a metre on the ground plane, the way the trail
 * runs (spawn to exit), and the ground under it. A climb has no spine to run, so a side camera refuses it by name.
 */
export function stageLane(stage) {
  if (stage.manifest.trail === undefined) throw new Error(`levels: a side camera runs a trail's lane, and the stage '${stage.level}/${stage.node}' is a climb with no trail to run; play this world top-down or third-person, or leave the climb out`);
  const { site } = outTrailOf(stage.manifest), line = [];
  for (let y = 0; y <= site.D + 1e-9; y += 1) line.push([r3(site.trailX(y)), r3(y)]);
  return { line, ground: (x, y) => site.ground(x, y) };
}

/** A goal's placed points moved onto the lane (pockets and landmarks sit off the trail, where a lane cannot reach), each
 * at the height it stood above its own ground. */
function onLane(m, lane) {
  const move = (at) => {
    let best = Infinity, q = at;
    for (let i = 1; i < lane.line.length; i++) {
      const [ax, ay] = lane.line[i - 1], dx = lane.line[i][0] - ax, dy = lane.line[i][1] - ay, L2 = dx * dx + dy * dy || 1e-12;
      const u = Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - ay) * dy) / L2)), x = ax + dx * u, y = ay + dy * u;
      const d2 = (at[0] - x) ** 2 + (at[1] - y) ** 2;
      if (d2 < best) { best = d2; q = [x, y]; }
    }
    return [r3(q[0]), r3(q[1]), r3(lane.ground(q[0], q[1]) + (at[2] - lane.ground(at[0], at[1])))];
  };
  return {
    ...m,
    ...(Array.isArray(m.at) ? { at: move(m.at) } : {}),
    ...(Array.isArray(m.pickups) ? { pickups: m.pickups.map((pk) => ({ ...pk, at: move(pk.at) })) } : {}),
    ...(Array.isArray(m.hazards) ? { hazards: m.hazards.map((h) => ({ ...h, at: move(h.at) })) } : {}),
  };
}

/**
 * THE MAP of an interconnected world: for each stage (in gameStages order), the ways out of it and where they lead. The
 * stages of one level join both ways; a link joins its `from` level's last stage and its `to` level's first, both ways;
 * a keyed link locks the way from `from` to `to` with `{ has: key }`, and lays the key on `keyAt`'s last stage.
 *   mapPlan(G, stages, refs) → [{ on: [way], back: [way], keys: [item] }]   way: { id, to: ref, gate? }
 */
/** A map world's keys that are the hero's powers (picked up into `powers`, not the bag), each with its move, or null. */
export function powerKeys(G) {
  if (G.topology !== 'interconnected') return [];
  const powers = G.characters?.hero?.actions?.powers ?? [];
  const keyed = new Set(G.links.filter((l) => l.key).map((l) => l.key));
  return powers.filter((p) => keyed.has(p.id)).map((p) => ({ id: p.id, move: p.move ?? null }));
}

export function mapPlan(G, stages, refs) {
  const plan = stages.map(() => ({ on: [], back: [], keys: [], powers: [] }));
  const isPower = new Set(powerKeys(G).map((p) => p.id));
  const of = (lvl) => stages.map((s, i) => (s.level === lvl ? i : -1)).filter((i) => i >= 0);
  for (const id of G.ids) {
    const ix = of(id);
    for (let k = 0; k + 1 < ix.length; k++) { plan[ix[k]].on.push({ to: refs[ix[k + 1]] }); plan[ix[k + 1]].back.push({ to: refs[ix[k]] }); }
  }
  for (const l of G.links) {
    const a = of(l.from), b = of(l.to);
    if (!a.length || !b.length) continue;
    const last = a[a.length - 1], first = b[0];
    const slice = isPower.has(l.key) ? 'powers' : 'bag';
    plan[last].on.push({ to: refs[first], ...(l.key ? { gate: { has: l.key, slice } } : {}) });
    plan[first].back.push({ to: refs[last] });
    if (l.key) { const at = of(l.keyAt); plan[at[at.length - 1]][slice === 'powers' ? 'powers' : 'keys'].push(l.key); }
  }
  for (const p of plan) {
    p.on.forEach((w, j) => { w.id = j ? `on-${j + 1}` : 'on'; });
    p.back.forEach((w, j) => { w.id = j ? `back-${j + 1}` : 'back'; });
  }
  return plan;
}

/** A stage's ways out laid on its own ground: the first way on at the trail's exit, the first way back just behind
 * the spawn, any more at its pockets then its landmarks; a key on a beat of its own; and for each way, the point a pilot
 * coming in by it arrives at, a few metres inside (the way back's arrival is the spawn itself). */
function stageWays(stage, ends, plan) {
  if (stage.manifest.trail === undefined) throw new Error(`levels: a map world's stages are trails, whose ends and pockets carry its ways; '${stage.level}/${stage.node}' is a climb`);
  const side = ends.beats.filter((b) => b.beat === 'pocket').concat(ends.beats.filter((b) => b.beat === 'landmark'));
  const h = ends.heading, behind = [r3(ends.spawn[0] - 2.4 * Math.cos(h)), r3(ends.spawn[1] - 2.4 * Math.sin(h)), ends.spawn[2]];
  const toward = (p, q, d) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, t = Math.min(1, d / L); return [r3(p[0] + (q[0] - p[0]) * t), r3(p[1] + (q[1] - p[1]) * t), r3(p[2] + (q[2] - p[2]) * t + 1)]; };
  const extra = [...plan.on.slice(1), ...plan.back.slice(1)];
  if (extra.length > side.length) throw new Error(`levels: '${stage.level}/${stage.node}' has ${extra.length + 2} ways out and room for ${side.length + 2} (its exit, its start, ${side.length} pocket or landmark beat${side.length === 1 ? '' : 's'}): link fewer levels to it`);
  const spot = new Map();
  if (plan.on[0]) spot.set(plan.on[0], { at: ends.exit, arrive: toward(ends.exit, ends.spawn, 4) });
  if (plan.back[0]) spot.set(plan.back[0], { at: behind, arrive: null });
  extra.forEach((w, j) => spot.set(w, { at: side[j].at, arrive: toward(side[j].at, ends.spawn, 3) }));
  const mechanics = [], arrive = [];
  for (const w of [...plan.on, ...plan.back]) {
    const s = spot.get(w);
    mechanics.push({ kind: 'reach-exit', exit: w.id, at: s.at, radius: w === plan.back[0] ? 1.2 : 2.5, ...(ends.planar ? {} : { planar: false }) });
    if (s.arrive) arrive.push({ from: w.to, at: s.arrive });
  }
  // the keys found here, on a beat of their own: items into the bag, powers into `powers` (one row of pickups)
  const found = [...plan.keys.map((item) => ({ item, into: 'bag' })), ...(plan.powers ?? []).map((item) => ({ item, into: 'powers' }))];
  if (found.length) {
    const free = ends.beats.filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead' && !extra.some((_, j) => side[j] === b));
    const beat = free[Math.floor(free.length / 2)] ?? ends.beats[Math.floor(ends.beats.length / 2)];
    const at = (j) => [beat.at[0] + j * 1.5, beat.at[1], beat.at[2]];
    for (const into of ['bag', 'powers']) {
      const row = found.map((f, j) => ({ ...f, j })).filter((f) => f.into === into);
      if (row.length) mechanics.push({ kind: 'collect', into, pickups: row.map((f) => ({ item: f.item, at: at(f.j), radius: 1.6 })) });
    }
  }
  return { mechanics, arrive, exits: [...plan.on, ...plan.back].map((w) => ({ id: w.id, to: w.to, ...(w.gate ? { gate: w.gate } : {}) })) };
}

/**
 * The game's store, from the book: the hero (a character slice, started at the systems' base numbers), the gear (an
 * inventory slice, when the table has a filled class), the campaign (a progression slice: each level unlocks the next).
 * `book` is resolveBook's.
 */
export function gameStore(world, book) {
  const G = readGameworld(world), S = book?.mechanics?.play.stats;
  const stats = S ? Object.fromEntries(S.stats.filter((x) => Number.isFinite(x.base ?? x.value)).map((x) => [x.id, x.base ?? x.value])) : {};
  const slices = [{ name: 'hero', kind: 'character', ...(Object.keys(stats).length ? { init: { stats } } : {}) }];
  if (resolveEquipment(G).rows.some((r) => r.build)) slices.push({ name: 'gear', kind: 'inventory' });
  slices.push({ name: 'campaign', kind: 'progression' });
  // a map world whose doors are keyed carries the items in a bag and the hero's powers in `powers`
  const pk = new Set(powerKeys(G).map((p) => p.id));
  if (G.topology === 'interconnected' && G.links.some((l) => l.key && !pk.has(l.key))) slices.push({ name: 'bag', kind: 'inventory' });
  if (pk.size) slices.push({ name: 'powers', kind: 'inventory' });
  // the world's scenes read and set flags: a story slice carries them from level to level
  if (storyCarried(G)) slices.push({ name: STORY_SLICE, kind: 'flags' });
  return { slices };
}

/** The create_game `levels` list: the stages' level refs in walking order, each after the first unlocked by the one
 * before it (`refs` in the order of gameStages). */
export function gameLevels(stages, refs, plan = null) {
  // a map world (`plan`: mapPlan's): no chain of gates; each level lists its exits, and the first level is where it starts
  if (plan) {
    return stages.map((s, i) => {
      const exits = [...plan[i].on, ...plan[i].back].map((w) => ({ id: w.id, to: w.to, ...(w.gate ? { gate: w.gate } : {}) }));
      return { ref: refs[i], title: `${s.level} · ${s.node}`, ...(exits.length ? { exits } : {}) };
    });
  }
  return stages.map((s, i) => ({ ref: refs[i], title: `${s.level} · ${s.node}`, ...(i > 0 ? { gate: { completed: refs[i - 1] } } : {}) }));
}
