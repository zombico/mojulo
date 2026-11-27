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
 *   the HUD      where the game has a `ui`: her vitals, what is found, the boss's bar and the pause's map on mana-ui
 *                (hud.js), in the game's look re-keyed with the box's theme (BOX_LOOKS), heard in its UI sounds
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
import { LADDER_RATE } from '../side-map/layout.js';
import { boxOf, BOSS_HP } from './scene.js';
import { boxEnds, boxPlaced, castLaws } from './cast.js';
import { HERO } from '../../foes/vocab.js';
import { sideFoe } from '../side-map/cast.js';
import { bestiaryOf } from '../foes.js';
import { FLOOR, boxCameraOf } from './rooms.js';
import { standBosses, bossRow, bossLaws, sideBody } from './bosses.js';
import { reachOf } from '../feel/reach.js';
import { GATES, SECRET } from './gates.js';
import { boxHud, BOX_LOOKS, BOX_MENU_KEY } from './hud.js';
import { interfaceLook } from '../../playscape/ui/interface-look.js';
import { hudSounds } from '../../scene/channels/mana-hud-sounds.js';

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

/** The box's LADDERS (rooms.js greybox `ladders`, climbs.js): each a climbable as the side map's runtime takes it (UP at its
 * foot, the climb owning the body to its head, stepped off onto the landing beside it), at LADDER_RATE. */
export function boxLadders(B) {
  return (B.greybox.ladders ?? []).map((l, i) => {
    const base = [0, l.s, l.z0], length = r3(l.z1 - l.z0);
    return { id: `box-ladder-${i}`, rule: { type: 'climbable', form: 'ladder', base, axis: [0, 0, 1], length, N: [1, 0, 0], Nh: [1, 0, 0], U: [0, 1, 0], half: 0, speed: LADDER_RATE, standoff: 0.35, pitch: 0.3, top: [0, l.off[0], l.off[1]] }, body: { type: 'none' }, transform: { pos: base, heading: Math.PI } };
  });
}

/** The box's rooms as the side map's camera zones, in the order the spiral walks them. */
export function boxCamera(B, { target = 'hero' } = {}) {
  const { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, C = boxCameraOf(B.stature);
  const room = new Map(L.rooms.map((r) => [r.id, r]));
  // (a castle's segment: its own rooms' zones alone, castle.js segmentsOf)
  const mine = B.segment ? new Set(B.segment.rooms) : null;
  const zones = L.walk.filter((id) => !mine || mine.has(id)).map((id) => {
    const r = room.get(id), [c, rr, w, h] = r.rect, s0 = c * W, z0 = rr * H;
    return { rect: [r3(s0), r3((c + w) * W), r3(z0), r3((rr + h) * H)], lock: r.kind === 'corridor' ? 'z' : r.kind === 'shaft' && w === 1 ? 's' : null, checkpoint: [r3(s0 + IN), r3(z0 + FLOOR)] };
  });
  return { rule: 'side-map', target, screen: [W, H], dist: C.dist, tilt: C.tilt, lookH: C.lookH, stature: B.stature, limbo: LIMBO, zones };
}

/** Where she stands on coming into a segment through a door (castle.js segmentsOf `arrivals`): inside the door, on the
 * floor of its room on this side, IN metres in from it → [s, z] */
export function arrivalAt(B, arrival) {
  const W = B.greybox.screen.width, H = B.greybox.screen.height, mine = new Set(B.segment.rooms), rooms = B.layout.rooms;
  const inSeg = (c) => rooms.some((r) => mine.has(r.id) && r.cells.some((x) => x[0] === c[0] && x[1] === c[1]));
  const c = arrival.cells.find(inSeg), o = arrival.cells.find((x) => x !== c), right = o[0] > c[0];
  return [r3(right ? (c[0] + 1) * W - IN : c[0] * W + IN), r3(c[1] * H + FLOOR)];
}
// (the s of a segment's door, its edge on the next segment, castle.js segmentsOf: where the way out is taken)
const doorEdge = (B, X) => { const c = Math.min(...X.cells.map((q) => q[0])); return r3((c + 1) * B.greybox.screen.width); };

/** The flags slice a castle's segments carry the hero's gains in (game/mechanics.js `journey`). */
export const JOURNEY_SLICE = 'journey';

/** A castle segment's WAYS (castle.js segmentsOf over the megaworld's map, levels.js mapPlan; each way names the
 * segment it leads to): an exit at the door it crosses by, as she reaches the door's edge, and where she stands
 * coming in by it, IN metres inside the door on its floor.
 *   → { exits: [reach-exit], arrive: [{ from: ref, at: [0, s, z] }] } */
export function segmentWays(B, map) {
  const seg = B.segment, exits = [], arrive = [];
  for (const w of [...(map.on ?? []), ...(map.back ?? [])]) {
    const X = w.segment != null ? seg.exits.find((x) => x.to === w.segment) : null;
    if (!X) continue;
    const [s, z] = arrivalAt(B, X), edge = doorEdge(B, X), inward = Math.sign(s - edge);
    exits.push({ kind: 'reach-exit', exit: w.id, at: [0, r3(edge + 0.4 * inward), r3(z + 1)], radius: 1.2, planar: false, ...(w.needs ? { needs: w.needs } : {}) });
    arrive.push({ from: w.to, at: [0, s, r3(z + 0.05)] });
  }
  return { exits, arrive };
}

/** The box's HUD in the game's look: a castle's card re-keyed with its theme (a frost castle's frost card), its sounds
 *  the look's own set. */
function boxHudOf(G, B) {
  const { layout: L, greybox: Gb } = B, id = B.look?.id, keyed = G.ui?.theme === BOX_LOOKS.castle && id && BOX_LOOKS[id] ? BOX_LOOKS[id] : null;
  const look = interfaceLook(keyed ? { ...G, ui: { ...G.ui, theme: keyed } } : G).theme;
  // (each room's place as it is dressed: its locale's, else its ring's)
  const X = B.look ? B.look.theme.locales ?? {} : {}, looks = B.dress ? Object.fromEntries(Object.entries(B.dress.plan).filter(([, p]) => p.locale && X[p.locale]).map(([id, p]) => [id, { place: X[p.locale].place }])) : {};
  return boxHud({ theme: look, layout: L, screen: Gb.screen, held: B.held, looks, bossHp: BOSS_HP, sounds: hudSounds(look) });
}

/** A metroidvania level's order: the stage's box built for the world's hero and played by it. */
export function boxLevelOrder(G, stage, { ref, heroRef, heroGaits = null, heroStature = null, pilot = null, title, mechanics = null, audio = null, extra = null, foeFrom = [], bossRefs = {}, map = null } = {}) {
  if (!heroRef) throw new Error('levels: a metroidvania is played by a hero seen from the side; give the world a hero (its characters)');
  const name = title ?? `${G.name ?? G.id} · ${stage.label ?? stage.level}`, stature = heroStature ?? SIDE_MAP_STATURE;
  // (its BOSSES stood as bodies of the world once its foes have joined, bosses.js: the stand-in blocks left off the box)
  const stood = !!(extra && foeFrom.length);
  // (its SECRET walls break: the game's own degree where it says one (`physical` breaks them by their matter, rupa, at the
  // box's blows unless the level says its own), else by counted blows with no degree said)
  const secretive = (stage.manifest.metroidvania?.rings ?? []).some((r) => (r.pockets ?? []).some((p) => GATES[p.gate]?.by === 'blows'));
  const degree = secretive && !stage.manifest.destruction ? (mechanics?.destruction ?? G.mechanics?.destruction ?? null) : null;
  const manifest0 = { ...stage.manifest, ...(G.feel ? { feel: G.feel } : {}), stature, ...(stood ? { bosses: 'stood' } : {}), ...(degree ? { destruction: degree } : {}),
    ...(degree === 'physical' && stage.manifest.matter === undefined ? { matter: { power: SECRET.power } } : {}) };
  const B = boxOf(manifest0), { layout: L, greybox: Gb } = B, W = Gb.screen.width, H = Gb.screen.height;
  // (a castle's SEGMENT, its manifest's `segment`: one map of the castle, castle.js segmentsOf; she starts at the castle's
  // gate where the segment holds it, else at the first door she can come in by; the shell's arrival moves her to the
  // door she came through, `ways`)
  const seg = B.segment ?? null, span = seg ? [seg.cols[0] * W, (seg.cols[1] + 1) * W] : null, inSpan = (s) => !span || (s >= span[0] - 1e-6 && s <= span[1] + 1e-6);
  const camera = boxCamera(B), spawn = [0, ...(seg && !seg.entry ? arrivalAt(B, seg.arrivals[0]) : camera.zones[0].checkpoint)];
  spawn[2] = r3(spawn[2] + 0.05);
  // the hero: the feel's rule on the lane, as tall as it stands
  const written = G.feel ? feelRule(G.feel) : null;
  const rule0 = { ...(written ?? {}), move: 'lane', lane: [[0, -20], [0, r3(L.box[0] * W + 20)]], collideHeight: stature };
  // (her TREES, the world's: the skill tree on how she moves and the tech tree on her spells and attacks, learned as she
  // plays: trees/tree.js lowered on her rule and her own strings, the techs' strings in her moveset held shut until learned)
  const T = G.trees ? treesOfBox(G, L, rule0, { placed: foeFrom.length ? boxPlaced(L, Gb, foeFrom, { bestiary: bestiaryOf(G) }) : [] }) : null, rule = T?.moveset ? { ...rule0, moveset: T.moveset } : rule0;
  const ladders = boxLadders(B).filter((l) => inSpan(l.rule.base[1]));
  const controls = `A / D  run · Space  jump${ladders.length ? ' · W / S  climb' : ''}${written?.dash ? ' · F  dash' : ''}${written?.buster ? ' · J  fire (hold: charge)' : ''}${written?.moveset && written?.strike === 'melee' ? ' · J  cut (press again: the string)' : ''}${T ? ' · T  skills and techs' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
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
  const foes0 = (X?.entities ?? []).filter((e) => e.team !== 'foes' || inSpan(e.transform.pos[1])).map((e) => (e.team === 'foes' ? standIn(sideFoe(e, stature), figures, bestiaryOf(G)) : e));
  // (its BOSSES, each in its room at its tier, a stand-in of its class until its figure is made: bosses.js)
  const Bs = stood ? standBosses(G, B, { stature, refs: bossRefs }) : null;
  Object.assign(figures, Bs?.figures ?? {});
  const bossIn = (e) => !seg || seg.rooms.includes(B.bosses.find((b) => b.id === e.id)?.place.room);
  const foes = [...foes0, ...(Bs?.entities ?? []).filter(bossIn).map((e) => standIn(e, figures, {}, bossRow(B.bosses.find((b) => b.id === e.id).name).class))];
  // (a figure is drawn when a body stands as it, or will: a mode it becomes, a boss's second form)
  const used = (e, k) => e.body?.figure === k || (e.body?.modes ?? []).some((M) => M.figure === k);
  const drawnFigures = Object.fromEntries(Object.entries(figures).filter(([k]) => !((k.startsWith('foe-') || k.startsWith('boss-')) && foes.every((e) => !used(e, k)))));
  // the goal: the throne's far side, behind its boss
  const throne = L.rooms.filter((r) => L.rings[r.ring].core).at(-1), [tc, tr, tw] = throne.rect;
  const reach = !seg || seg.rooms.includes(throne.id) ? { kind: 'reach-exit', at: [0, r3((tc + tw) * W - 2.5), r3(tr * H + FLOOR + 1)], radius: 2.5, planar: false } : null;
  const lives = G.mechanics?.lives ? [{ kind: 'lives', start: G.mechanics.lives, falls: [SIDE_FALL] }] : [];
  // (a segment's WAYS, the megaworld's map over the castle, levels.js mapPlan: each way out an exit at the door it
  // crosses into the next segment by, and coming in by it she stands inside that door; what she gains goes with her,
  // the journey)
  const ways = seg && map ? segmentWays(B, map) : null;
  const ev = W0.events ?? {};
  const events = { ...ev, sources: [...(ev.sources ?? []), { type: 'zone', zone: SIDE_FALL, at: [0, 0, LIMBO], half: [1e6, 1e6, 200], watch: 'hero' }],
    ...(ways?.arrive.length ? { reactions: [...(ev.reactions ?? []), ...ways.arrive.map((a) => ({ on: `arrive:${a.from}`, do: 'move', target: 'hero', to: a.at }))] } : {}) };
  const manifest = {
    ...manifest0, ...(T ? { trees: T.spec } : {}), title: name, figures: drawnFigures, entities: [hero1, ...foes, ...ladders], camera, events,
    game: { levelRef: ref, mechanics: [...(reach ? [reach] : []), ...(ways?.exits ?? []), ...lives, ...(ways ? [{ kind: 'journey', slice: JOURNEY_SLICE }] : [])], fall: 'none',
      ...(ways?.arrive.length ? { arrive: ways.arrive.map((a) => a.from) } : {}) },
    ...(mechanics?.play || X?.play ? { play: { ...(mechanics?.play ?? {}), ...(X?.play ?? {}) } } : {}),
    ...(audio ? { audio } : {}),
    ...(G.ui !== undefined ? { manaHud: boxHudOf(G, B) } : {}),
  };
  const cast = foeFrom.length ? castLaws(L, Gb, boxPlaced(L, Gb, foeFrom, { bestiary: bestiaryOf(G) }), { bestiary: bestiaryOf(G), hp: V.hp, hit: HERO.hit }) : [];
  return { tool: 'create_sketch', args: { title: name, manifest }, laws: [...B.laws.map((l) => ({ ...l, id: `metroidvania:${l.id}` })), ...(T ? T.laws.map((l) => ({ ...l, id: `trees:${l.id}` })) : []), ...cast.map((l) => ({ ...l, id: `foes:${l.id}` })), ...(stood ? bossLaws(B, { body: sideBody(G.feel ? reachOf(readFeel(typeof G.feel === 'string' ? { pole: G.feel, takes: true } : G.feel)) : null) }).map((l) => ({ ...l, id: `bosses:${l.id}` })) : [])] };
}
