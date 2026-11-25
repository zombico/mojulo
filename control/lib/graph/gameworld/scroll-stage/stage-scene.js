/**
 * THE SCROLL STAGE, BUILT (Blaze Gunner): an airspace's `scroll` (skyscape/airspace.js hands it here), a stage flown
 * through space on a screen that scrolls on its own: the ship on the d-pad (worlds/controllable/scroll.js), the camera
 * carried down its track, and space in its layers behind and in front of the play (space-layers.js), the space map's
 * sky at infinity behind them all.
 *
 *   airspace { kind: 'airspace', scroll: {
 *     view?     'side' (left to right, the default) | 'top' (bottom to top, seen from above)
 *     ship?     { craft?: a space archetype off the craft shelf (CRAFT_ARCHETYPES), its measures the ship's size }
 *     track?    [leg]: { by: [du, dv] screens, pace?: screens a second } | { hold: s } | { hold: true, until: id }
 *               (a SCREEN along is the frame's along, across its across); [{ by: [12, 0] }] where none is given
 *     pace?     screens a second a leg without its own moves at (SCROLL_PACE)
 *     start?    [u, v] screens: where the screen starts (a shot down the stage)
 *     layers?   the space layers laid (SPACE_LAYER_IDS, all where none are named)
 *     pods?     the pods the stage's arsenal carries (POD_IDS, all where none are named: pods.js), lowered onto the ship
 *     targets?  [{ at: [u, v] screens, hp?, carries?: a pod }]: foes standing still on the play plane (a range to try the
 *               arsenal on: a target that carries a pod drops it as it falls)
 *     waves?    [{ at: screens along (they come in as the screen's right edge reaches it), foe: a foe (patterns.js FOES),
 *               count? (1), formation?: line | column | vee | echelon | swarm (FORMATIONS), v?: screens across from the
 *               middle, carries?: a pod (the wave's last foe brings it) }]: the foes, each flying its path and its pattern
 *     hp?       the ship's (SHIP_HP): each bullet in its hitbox takes one
 *     lives?    the ship's lives past its first (SHIP_LIVES): down, it is blown apart and back home on the screen, whole
 *     hulls?    [{ capital: a fleet class, at: screens along, v?: screens across, depth?: camera distances back (HULL_DEPTH;
 *               0: ON THE PLAY PLANE, its near face the plane: terrain flown along and broken, its systems the targets, its
 *               guns turrets, blown up in a chain when its systems are gone, rupa in zero g as Rebel Storm's fleet is),
 *               heading?: 0 (the way the stage scrolls) | 180, seed? }]: capital ships going by behind the fight
 *     interior? { at: screens along, look?, sections: [{ kind, length? }], seed? }: a run flown inside a station or a
 *               facility (interior.js: its walls the terrain, the open between them laid in steps)
 *     backdrop? false (stars alone) | { planets?, nebula?, suns?, worlds?, proximity?, seed? } (skyscape/backdrop.js),
 *               its large world set in the camera's view
 *     seed?
 *   } }
 *
 *   SCROLL_STAGE_KEYS, SCROLL_PACE, SCROLL_CRAFT, HULL_DEPTH, TARGET_HP, SHIP_HP, SHIP_LIVES, FORMATIONS
 *   readScrollStage(v)                → errors (strings); [] when it builds
 *   scrollStageOf(manifest)           → { cam, ship, track, start, extent, interior? }: the stage as numbers, no faces
 *   scrollStagePlay(manifest, { airframe? }) → { entities, camera, figures?, manaHud? }: the ship and the scroll camera (and
 *                                       its HUD on mana-ui, scroll-stage/hud.js), as a level
 *                                       puts them on its manifest (a page resolves a figure from the manifest only: the
 *                                       ship flies its airframe there; `airframe: false` the slab)
 *   assembleScrollStage(manifest, { title? }) → the World payload: faces (the layers, the hulls), sky, bg, cameras (a
 *                                       bookmark at the start), meta.scroll, and the play with the ship a slab (a payload
 *                                       resolves no figures: the space map's own convention, skyscape/airspace.js)
 *
 * Pure: the same stage the same bytes.
 */
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { assembleCraft } from '../../craft-shelf/index.js';
import { CAPITAL_CLASSES } from '../../fleet/classes.js';
import { buildCapital, placeFleet, fleetPayload } from '../../fleet/build.js';
import { readFinish } from '../../scene/page-light.js';
import { planBackdrop } from '../../skyscape/backdrop.js';
import { SPACE_STAR } from '../../skyscape/space.js';
import { SCROLL_VIEWS, SCROLL_VIEW_IDS, scrollCamera, toWorld, trackExtent } from './frame.js';
import { SPACE_LAYER_IDS, SPACE_VOID, layScrollSpace, hazeHulls } from './space-layers.js';
import { POD_IDS, lowerArsenal } from './pods.js';
import { scrollHud } from './hud.js';
import { FOES, FOE_IDS, lowerFoes, HITBOX } from './patterns.js';
import { streamOf } from '../../city/plan/dice.js';
import { readInterior, planInterior } from './interior.js';

export const SCROLL_STAGE_KEYS = Object.freeze(['view', 'ship', 'track', 'pace', 'start', 'layers', 'pods', 'targets', 'waves', 'hp', 'lives', 'hulls', 'interior', 'backdrop', 'seed']);
/** A leg's pace where it names none: a tenth of a screen a second (an arcade scroll's unhurried crawl). */
export const SCROLL_PACE = 0.1;
/** The ship a stage flies where it names none: the craft shelf's hero gunship (craft-shelf/hero-gunship.js), Blaze
 * Gunner's own: a classic hero fighter in profile, its keel blade and its gun rail. */
export const SCROLL_CRAFT = 'heroGunship';
/** How far behind the play a hull stands where it names no depth (camera distances): back enough that a capital ship
 * reads whole and quiet behind the fight. */
export const HULL_DEPTH = -4;
/** The ship's hp where the stage names none: ten hits. */
export const SHIP_HP = 10;
/** The ship's lives past its first where the stage names none. */
export const SHIP_LIVES = 2;
/** How a wave flies in, its members' places off its lead (along, across) in spacings: a new formation is a row. */
export const FORMATIONS = Object.freeze({
  line: (k) => [k, 0],                       // one after another down the same line: a snake
  column: (k, n) => [0, k - (n - 1) / 2],      // side by side across the screen
  vee: (k, n) => [Math.abs(k - (n - 1) / 2), k - (n - 1) / 2],
  echelon: (k, n) => [k, (k - (n - 1) / 2) * 0.7],
  swarm: (k, n, die) => [die() * Math.max(1, n / 2), (die() - 0.5) * Math.max(1.5, n / 2)],
});
/** A hull's system's hp (a target on a capital ship on the play plane): a pod's work, not a tap's. */
export const SYSTEM_HP = 14;
/** A target's hp where it names none: a few taps of the base gun. */
export const TARGET_HP = 4;
const HULL_KEYS = ['capital', 'at', 'v', 'depth', 'heading', 'seed'];
const DEFAULT_TRACK = Object.freeze([Object.freeze({ by: Object.freeze([12, 0]) })]);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = Number.isFinite;
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const r2 = (v) => Math.round(v * 100) / 100;
const unit = (v) => { const L = Math.hypot(...v) || 1; return v.map((x) => Math.round((x / L) * 1e4) / 1e4); };

export function readScrollStage(v) {
  if (!isObj(v)) return ['airspace.scroll is { view?, ship?, track?, pace?, start?, layers?, hulls?, backdrop?, seed? }: a stage on a screen that scrolls'];
  const e = [], at = (k) => `airspace.scroll.${k}`;
  for (const k of Object.keys(v)) if (!SCROLL_STAGE_KEYS.includes(k)) e.push(`${at(k)} is not a scroll stage's word (${SCROLL_STAGE_KEYS.join(', ')})`);
  if (v.view !== undefined && !SCROLL_VIEW_IDS.includes(v.view)) e.push(`${at('view')} is 'side' (left to right) or 'top' (bottom to top)`);
  if (v.ship !== undefined) {
    if (!isObj(v.ship) || Object.keys(v.ship).some((k) => k !== 'craft')) e.push(`${at('ship')} is { craft? }`);
    else if (v.ship.craft !== undefined && CRAFT_ARCHETYPES[v.ship.craft]?.realm !== 'space') e.push(`${at('ship.craft')} is a space craft off the shelf (${Object.keys(CRAFT_ARCHETYPES).filter((k) => CRAFT_ARCHETYPES[k].realm === 'space').join(', ')})`);
  }
  if (v.track !== undefined) {
    if (!Array.isArray(v.track) || !v.track.length) e.push(`${at('track')} is a list of legs: { by: [du, dv] screens, pace? } | { hold: s } | { hold: true, until: id }`);
    else v.track.forEach((L, k) => {
      const w = `${at('track')}[${k}]`;
      if (!isObj(L)) e.push(`${w} is a leg`);
      else if (L.by !== undefined) { if (!pair(L.by) || (L.by[0] === 0 && L.by[1] === 0)) e.push(`${w}.by is [du, dv] screens, not both 0`); if (L.pace !== undefined && !(isNum(L.pace) && L.pace > 0)) e.push(`${w}.pace is screens a second`); }
      else if (L.hold !== undefined) { if (!(L.hold === true ? typeof L.until === 'string' && L.until : isNum(L.hold) && L.hold > 0)) e.push(`${w}.hold is seconds, or true with until: the id of what must fall`); }
      else e.push(`${w} is { by, pace? } or { hold }`);
    });
  }
  if (v.pace !== undefined && !(isNum(v.pace) && v.pace > 0)) e.push(`${at('pace')} is screens a second`);
  if (v.start !== undefined && !pair(v.start)) e.push(`${at('start')} is [u, v] screens`);
  if (v.layers !== undefined && !(Array.isArray(v.layers) && v.layers.every((l) => SPACE_LAYER_IDS.includes(l)))) e.push(`${at('layers')} names space layers (${SPACE_LAYER_IDS.join(', ')})`);
  if (v.pods !== undefined && !(Array.isArray(v.pods) && v.pods.every((p) => POD_IDS.includes(p)))) e.push(`${at('pods')} names pods (${POD_IDS.join(', ')})`);
  if (v.targets !== undefined) {
    if (!Array.isArray(v.targets)) e.push(`${at('targets')} is a list of { at: [u, v] screens, hp?, carries? }`);
    else v.targets.forEach((T, k) => {
      const w = `${at('targets')}[${k}]`;
      if (!isObj(T) || !pair(T.at)) { e.push(`${w} is { at: [u, v] screens, hp?, carries? }`); return; }
      for (const f of Object.keys(T)) if (!['at', 'hp', 'carries'].includes(f)) e.push(`${w}.${f} is not a target's word (at, hp, carries)`);
      if (T.hp !== undefined && !(isNum(T.hp) && T.hp > 0)) e.push(`${w}.hp is a positive number`);
      if (T.carries !== undefined && !POD_IDS.includes(T.carries)) e.push(`${w}.carries is a pod (${POD_IDS.join(', ')})`);
      if (T.carries !== undefined && v.pods !== undefined && !v.pods.includes(T.carries)) e.push(`${w}.carries '${T.carries}', which the stage's pods leave out`);
    });
  }
  if (v.waves !== undefined) {
    if (!Array.isArray(v.waves)) e.push(`${at('waves')} is a list of { at, foe, count?, formation?, v?, carries? }`);
    else v.waves.forEach((Wv, k) => {
      const w = `${at('waves')}[${k}]`;
      if (!isObj(Wv)) { e.push(`${w} is { at, foe, … }`); return; }
      for (const f of Object.keys(Wv)) if (!['at', 'foe', 'count', 'formation', 'v', 'carries'].includes(f)) e.push(`${w}.${f} is not a wave's word (at, foe, count, formation, v, carries)`);
      if (!isNum(Wv.at) || Wv.at < 0) e.push(`${w}.at is screens along the stage`);
      if (!FOES[Wv.foe] || !FOES[Wv.foe].craft) e.push(`${w}.foe is a foe that flies (${FOE_IDS.filter((id) => FOES[id].craft).join(', ')}); a turret comes with its hull`);
      if (Wv.count !== undefined && !(Number.isInteger(Wv.count) && Wv.count >= 1 && Wv.count <= 12)) e.push(`${w}.count is 1 to 12`);
      if (Wv.formation !== undefined && !FORMATIONS[Wv.formation]) e.push(`${w}.formation is ${Object.keys(FORMATIONS).join(' | ')}`);
      if (Wv.v !== undefined && !(isNum(Wv.v) && Math.abs(Wv.v) < 0.5)) e.push(`${w}.v is screens across from the middle (under a half either way)`);
      if (Wv.carries !== undefined && !POD_IDS.includes(Wv.carries)) e.push(`${w}.carries is a pod (${POD_IDS.join(', ')})`);
      if (Wv.carries !== undefined && v.pods !== undefined && !v.pods.includes(Wv.carries)) e.push(`${w}.carries '${Wv.carries}', which the stage's pods leave out`);
    });
  }
  if (v.hp !== undefined && !(Number.isInteger(v.hp) && v.hp >= 1)) e.push(`${at('hp')} is a whole number of hits, 1 or more`);
  if (v.lives !== undefined && !(Number.isInteger(v.lives) && v.lives >= 0 && v.lives <= 9)) e.push(`${at('lives')} is a whole number, 0 to 9`);
  if (v.hulls !== undefined) {
    if (!Array.isArray(v.hulls)) e.push(`${at('hulls')} is a list of { capital, at, v?, depth?, heading?, seed? }`);
    else v.hulls.forEach((H, k) => {
      const w = `${at('hulls')}[${k}]`;
      if (!isObj(H)) { e.push(`${w} is { capital, at, … }`); return; }
      for (const f of Object.keys(H)) if (!HULL_KEYS.includes(f)) e.push(`${w}.${f} is not a hull's word (${HULL_KEYS.join(', ')})`);
      if (!CAPITAL_CLASSES[H.capital]) e.push(`${w}.capital is a fleet class (${Object.keys(CAPITAL_CLASSES).join(', ')})`);
      if (!isNum(H.at)) e.push(`${w}.at is screens along the stage`);
      if (H.v !== undefined && !isNum(H.v)) e.push(`${w}.v is screens across`);
      if (H.depth !== undefined && !(isNum(H.depth) && H.depth <= 0)) e.push(`${w}.depth is camera distances behind the play (negative), or 0: on the play plane`);
      if (H.heading !== undefined && ![0, 180].includes(H.heading)) e.push(`${w}.heading is 0 (the way the stage scrolls) or 180`);
      if (H.seed !== undefined && !Number.isInteger(H.seed)) e.push(`${w}.seed is a whole number`);
    });
  }
  if (v.interior !== undefined) e.push(...readInterior(v.interior, at('interior')));
  if (v.backdrop !== undefined && v.backdrop !== false && !isObj(v.backdrop)) e.push(`${at('backdrop')} is false (stars alone) or { planets?, nebula?, suns?, worlds?, proximity?, seed? }`);
  if (isObj(v.backdrop) && v.backdrop.toward !== undefined) e.push(`${at('backdrop')}: its large world stands in the camera's view; toward is not a scroll stage's word`);
  if (v.seed !== undefined && !Number.isInteger(v.seed)) e.push(`${at('seed')} is a whole number`);
  return e;
}

// THE PROFILE a hull on the play plane shows the side view: a capital ship's flanks (port and starboard, the fleet's ±y) are
// the side view's depth, so what stands entirely off its body's flanks (its radiator wings on their trusses) would stand
// toward the camera in front of its own profile; it is left off, the elevation kept. The top view keeps all: its flanks
// lie in the screen's plane.
const BODY = ['drive', 'core', 'hull', 'bow', 'deck', 'armour', 'tank', 'hangar'];
function profileOf(B, view) {
  if (view !== 'side') return B;
  const body = B.pieces.filter((p) => BODY.includes(p.role)), lo = Math.min(...body.map((p) => p.min[1])), hi = Math.max(...body.map((p) => p.max[1]));
  const off = new Set(B.pieces.filter((p) => p.min[1] >= hi - 1e-6 || p.max[1] <= lo + 1e-6).map((p) => p.id));
  if (!off.size) return B;
  return { ...B, pieces: B.pieces.filter((p) => !off.has(p.id)), faces: B.faces.filter((f) => !off.has(f.piece)), lights: B.lights.filter((l) => !off.has(l.piece)),
    hardpoints: B.hardpoints.filter((h) => !off.has(h.id)), systems: (B.systems || []).filter((y) => !off.has(y.block)), anchor: B.anchor.filter((a) => !off.has(a)), core: B.core.filter((c) => !off.has(c)) };
}

/** The stage as numbers: its camera from its ship, its track and start in metres, the centres it sweeps. */
export function scrollStageOf(manifest) {
  const S = manifest.scroll || {}, errs = readScrollStage(S);
  if (errs.length) throw new Error(errs.join('; '));
  const view = S.view ?? 'side', craft = S.ship?.craft ?? SCROLL_CRAFT;
  const M = assembleCraft(craft, { attitude: 'level', pose: { gear: 0 } }).readout.measures;
  const ship = { craft, length: M.length, breadth: view === 'side' ? M.height : M.span };
  const cam = scrollCamera(ship.length, { view }), A = cam.screen.along, C = cam.screen.across;
  const track = (S.track ?? DEFAULT_TRACK).map((L) => (L.by ? { by: [r2(L.by[0] * A), r2(L.by[1] * C)], pace: r2((L.pace ?? S.pace ?? SCROLL_PACE) * A) } : { ...L }));
  const start = S.start ? [r2(S.start[0] * A), r2(S.start[1] * C)] : [0, 0];
  const arsenal = lowerArsenal(S.pods ?? POD_IDS, { L: ship.length, S: cam.screen.across });
  const targets = (S.targets ?? []).map((T, k) => ({ id: `target-${k}`, at: [r2(T.at[0] * A), r2(T.at[1] * C)], hp: T.hp ?? TARGET_HP, ...(T.carries ? { carries: T.carries } : {}) }));
  // the waves: each member's place off its wave's lead, a spacing the size of its body and a half
  const kinds = [...new Set((S.waves ?? []).map((Wv) => Wv.foe))], foeSet = lowerFoes(kinds, { L: ship.length, S: C });
  const sizeOf = Object.fromEntries(kinds.map((k) => { const M = assembleCraft(FOES[k].craft, { attitude: 'level', pose: { gear: 0 } }).readout.measures; return [k, Math.max(M.length, view === 'side' ? M.height : M.span)]; }));
  const foes = (S.waves ?? []).flatMap((Wv, w) => {
    const n = Wv.count ?? 1, sp = sizeOf[Wv.foe] * 1.5, die = streamOf(S.seed ?? manifest.seed ?? 1, 'scroll-wave', String(w)), form = FORMATIONS[Wv.formation ?? 'line'];
    return Array.from({ length: n }, (_, k) => {
      const [du, dv] = form(k, n, die);
      return { id: `foe-${w}-${k}`, kind: Wv.foe, enter: r2(Wv.at * A + du * sp), v: r2((Wv.v ?? 0) * C + dv * sp), r: r2(sizeOf[Wv.foe] * 0.42), ...(Wv.carries && k === n - 1 ? { carries: Wv.carries } : {}) };
    });
  });
  // the hulls ON THE PLAY PLANE (depth 0): built and placed as Rebel Storm's fleet is, their near face the plane (the
  // whole ship behind it, so the ship is drawn before it and its silhouette is its collision), their blocks rupa's
  const V = SCROLL_VIEWS[view], seed = S.seed ?? manifest.seed ?? 1;
  const plane = (S.hulls ?? []).map((H, k) => ({ H, k })).filter(({ H }) => H.depth === 0).map(({ H, k }) => {
    const id = `hull-${k}`, B = profileOf(buildCapital(H.capital, { seed: H.seed ?? seed }), view), heading = (H.heading ?? 0) === 180 ? 270 : 90;
    const at0 = toWorld(view, [H.at * A, (H.v ?? 0) * C, 0]), P0 = placeFleet(B, { at: at0, heading, id });
    const near = Math.max(...P0.blocks.flatMap((b) => [b.min, b.max].map((q) => q[0] * V.toward[0] + q[1] * V.toward[1] + q[2] * V.toward[2])));
    return { id, H, P: placeFleet(B, { at: at0.map((x, i) => r2(x - V.toward[i] * near)), heading, id }) };
  });
  const turretSet = plane.length ? lowerFoes(['turret'], { L: ship.length, S: C }) : null;
  // the INTERIOR (interior.js): a run flown inside a station or a facility, its walls and the open between them
  const interior = S.interior ? planInterior(S.interior, { cam, track, start, seed }) : null;
  return { view, cam, ship, track, start, extent: trackExtent(track, start), seed, arsenal, targets, foes, foeSet, hp: S.hp ?? SHIP_HP, lives: S.lives ?? SHIP_LIVES, plane, turretSet, interior };
}

// a body that blows apart when it falls: Rebel Storm's space blast at its own size (combat-match.js explodeUnit, its
// `blast` the fireball's reach), at its centre on the play plane (its egg centred, `cz` 0: a side view's up is the world's)
const blastOf = (r) => ({ blast: r2(r * 2.4), egg: { a: r, c: r, cz: 0 } });
// the ship on the d-pad, a quarter of a screen back of the middle, and the camera carried down the track
function playOf(G, { airframe = true, stage = '' } = {}) {
  const { view, cam, ship, track, start, arsenal, targets, foes, foeSet, hp, lives, plane, turretSet } = G, V = SCROLL_VIEWS[view], at = [-cam.screen.along / 4, 0], back = Math.atan2(-V.along[1], -V.along[0]);
  // (a target: a drone's block in the foes' colour, its size a ship's breadth, on the play plane facing back at the ship)
  const tsize = r2(ship.breadth * 0.8);
  const body = airframe ? { type: 'figure-rig', figure: 'craft' } : { type: 'mesh', shape: 'box', size: view === 'side' ? [r2(ship.breadth / 3), ship.length, ship.breadth] : [ship.breadth, ship.length, r2(ship.breadth / 3)], color: '#e9eef4' };
  return {
    entities: [{ id: 'player', pilotable: true, rule: { type: 'scroll-ship', size: [ship.length, ship.breadth], at, arsenal, hitbox: { r: foeSet.hitbox || r2(HITBOX * ship.length), at: r2(ship.length * 0.2) }, invuln: 1, hp, lives }, ambient: { type: 'static' }, body: { ...body, hp, ...blastOf(r2(ship.length / 2)) },
      transform: { pos: toWorld(view, [start[0] + at[0], start[1] + at[1], 0]).map(r2), heading: Math.atan2(V.along[1], V.along[0]) } },
    ...targets.map((T) => ({ id: T.id, team: 'foes', rule: { type: 'static', ...(T.carries ? { carries: T.carries } : {}) },
      body: { type: 'mesh', shape: 'box', size: [tsize, tsize, tsize], color: T.carries ? arsenal.pods[T.carries].hue : '#c04a3a', hp: T.hp, radius: r2(tsize * 0.7), ...blastOf(r2(tsize * 0.7)) },
      transform: { pos: toWorld(view, [T.at[0], T.at[1], 0]).map(r2), heading: back } })),
    // (each foe waits off the right edge at where it comes in, then flies its path: worlds/controllable/scroll-foes.js)
    ...foes.map((F) => {
      const K = foeSet.foes[F.kind];
      return { id: F.id, team: 'foes', rule: { type: 'scroll-foe', enter: F.enter, v: F.v, path: K.path, speed: K.speed, ...(K.pattern ? { pattern: foeSet.patterns[K.pattern] } : {}), safe: foeSet.safe, hue: foeSet.hue, score: K.score, ...(F.carries ? { carries: F.carries } : {}) },
        body: { ...(airframe ? { type: 'figure-rig', figure: `foe-${F.kind}` } : { type: 'mesh', shape: 'box', size: [F.r, F.r * 2, F.r], color: '#c04a3a' }), hp: K.hp, radius: F.r, ...blastOf(F.r) },
        transform: { pos: toWorld(view, [F.enter + F.r, F.v, 0]).map(r2), heading: back } };
    }),
    // a hull on the play plane (Rebel Storm's procedural enemy, gameworld/flight-sortie.js): the hull no target of its own,
    // down with the last of its SYSTEMS (each a target on its block), then blown up in a chain (worlds/controllable/rupa.js);
    // its GUNS turrets on their hardpoints, fixed, firing at the ship, down with their mounts
    ...plane.flatMap(({ id, P }) => {
      const core = P.blocks.filter((b) => P.core.includes(b.id)), mid = core.length ? [0, 1, 2].map((k) => r2(core.reduce((s, b) => s + (b.min[k] + b.max[k]) / 2, 0) / core.length)) : P.bounds.min;
      const sys = P.systems.map((y, k) => ({ ...y, eid: `${id}-${y.kind}${k + 1}` })), T = turretSet.foes.turret, sysHp = SYSTEM_HP, gunR = r2(ship.length * 0.25);
      return [
        { id, team: 'foes', rule: { type: 'static' }, structure: { systems: sys.map((y) => y.eid), prefix: `${id}/`, blowTime: 3.5 },
          body: { type: 'mesh', shape: 'box', size: [1, 1, 1], color: '#000000', hittable: false, hp: 100, radius: 2 }, transform: { pos: mid, heading: 0, pitch: 0 } },
        ...sys.map((y) => ({ id: y.eid, team: 'foes', onBlock: y.block, rule: { type: 'static', score: 800 },
          body: { type: 'mesh', shape: 'box', size: [1, 1, 1], color: '#000000', hittable: true, hp: sysHp, poise: 99, radius: r2(Math.max(y.size, ship.length * 0.4)), ...blastOf(r2(y.size)) },
          transform: { pos: y.at, heading: 0, pitch: 0 } })),
        ...P.hardpoints.map((Hp, k) => {
          const q = [Hp.at[0] * V.along[0] + Hp.at[1] * V.along[1] + Hp.at[2] * V.along[2], Hp.at[0] * V.across[0] + Hp.at[1] * V.across[1] + Hp.at[2] * V.across[2]];
          return { id: `${id}-gun${k + 1}`, team: 'foes', onBlock: Hp.block,
            rule: { type: 'scroll-foe', enter: r2(q[0]), v: 0, at: q.map(r2), path: T.path, speed: 0, pattern: turretSet.patterns[T.pattern], safe: turretSet.safe, hue: turretSet.hue, score: T.score },
            body: { type: 'mesh', shape: 'box', size: [gunR, gunR, gunR], color: '#2a2d31', hp: T.hp, radius: gunR, ...blastOf(gunR) }, transform: { pos: Hp.at, heading: back } };
        }),
      ];
    })],
    camera: { rule: 'scroll', target: 'player', view, dist: cam.dist, screen: [cam.screen.along, cam.screen.across], start, track },
    // (a hull on the play plane breaks as Rebel Storm's fleet does: destructible matter, weightless, gameworld/levels.js)
    ...(plane.length && airframe ? { destruction: 'physical', matter: { g: 0, power: 1e3 } } : {}),
    // (its HUD on mana-ui, scroll-stage/hud.js: a level's and a World page's, the page's HUD host reading the world)
    ...(airframe ? { manaHud: scrollHud({ hp, lives, stage, boss: bossHud(G) }) } : {}),
    ...(airframe ? { figures: { craft: { craft: { archetype: ship.craft, flying: true, gear: 'up' } }, ...Object.fromEntries(Object.keys(foeSet.foes).map((k) => [`foe-${k}`, { craft: { archetype: foeSet.foes[k].craft, flying: true, gear: 'up' } }])) } } : {}),
  };
}

// the boss the track holds for, as the HUD names it: its hull's class (a corvette's 'Corvette') and its systems
function bossHud(G) {
  const id = [...G.track].reverse().find((L) => L && L.hold === true && L.until)?.until, H = id && G.plane.find((h) => h.id === id);
  return H ? { id, name: String(H.P.label || H.H.capital).replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase()), systems: H.P.systems.length } : null;
}

/** The ship and the scroll camera, as a level puts them on its manifest. */
export const scrollStagePlay = (manifest, { airframe = true } = {}) => playOf(scrollStageOf(manifest), { airframe, stage: typeof manifest?.title === 'string' ? manifest.title : '' });

/** The World payload of a scroll stage. */
export function assembleScrollStage(manifest, { title = 'Blaze Gunner' } = {}) {
  const S = manifest.scroll || {}, G = scrollStageOf(manifest), { view, cam, ship, track, start, extent, seed } = G, V = SCROLL_VIEWS[view];
  // the key: from behind the camera, over the ship and a little ahead, so the profiles turned to the camera are lit (the
  // side map's key, never the cube's own bearing); the star the backdrop's worlds are lit by
  const sun = unit(V.toward.map((t, i) => t * 0.6 + V.up[i] * 0.7 + V.along[i] * 0.35));
  const space = layScrollSpace(cam, extent, { seed, ...(S.layers ? { layers: S.layers } : {}) });
  const hulls = (S.hulls ?? []).map((H, k) => ({ H, k })).filter(({ H }) => H.depth !== 0).map(({ H, k }) => {
    const d = (H.depth ?? HULL_DEPTH) * cam.dist, pos = toWorld(view, [H.at * cam.screen.along, (H.v ?? 0) * cam.screen.across, d]).map(r2);
    // (built and placed as Rebel Storm's fleet is, fleet/build.js: its pieces blocks, its faces in their blocks' groups, so
    // the page's hull kibble plates each block in parallax as it plates a capital ship flown past; its bow the way the
    // stage scrolls, a quarter turn from the fleet's +x, or back down it)
    const id = `hull-${k}`, P = placeFleet(buildCapital(H.capital, { seed: H.seed ?? seed }), { at: pos, heading: (H.heading ?? 0) === 180 ? 270 : 90, id });
    const F = fleetPayload([P], { physical: false });
    return { faces: hazeHulls(F.faces, cam, d), kibble: F.kibble?.blocks ?? {}, scale: F.kibble?.scale, report: { id, kind: H.capital, label: P.label, at: pos, heading: H.heading ?? 0, blocks: P.blocks.length } };
  });
  const kibble = Object.assign({}, ...hulls.map((h) => h.kibble)), kScale = hulls.find((h) => h.scale)?.scale;
  // the sky at infinity: the space map's stars, and its backdrop's large world set in the camera's view, a little ahead
  // and over it
  const look = unit(V.toward.map((t, i) => -t + V.along[i] * 0.22 + V.up[i] * 0.16));
  const B = S.backdrop === false ? null : planBackdrop({ star: sun, seed: S.backdrop?.seed ?? seed, toward: look, ...Object.fromEntries(['planets', 'nebula', 'suns', 'worlds', 'proximity'].filter((k) => S.backdrop?.[k] !== undefined).map((k) => [k, S.backdrop[k]])) });
  const hfov = 2 * Math.atan(Math.tan((cam.vfov * Math.PI) / 360) * cam.aspect) * (180 / Math.PI);
  const look0 = toWorld(view, [start[0], start[1], 0]), eye0 = toWorld(view, [start[0], start[1], cam.dist]);
  return {
    faces: [...space.faces, ...hulls.flatMap((h) => h.faces)],
    sky: { space: true, seed: 7, center: [0, 0, 0], radius: 7000, follow: true, sun: { dir: sun, size: SPACE_STAR.size, glow: SPACE_STAR.glow }, ...(B ? { backdrop: B } : {}) },
    bg: SPACE_VOID,
    ...(Object.keys(kibble).length ? { kibble: { scale: kScale, blocks: kibble } } : {}),
    // (the hulls on the play plane: the world's fleet, made breakable under physical by the world scene, fleet/build.js
    // fleetPayload; its kibble the world scene's)
    ...(G.plane.length ? { physicalFleet: G.plane.map((h) => h.P) } : {}),
    // (the finish: the bloom, so what is hot glows: a drive's plume, the shots, the sun, the lit windows of a hull)
    finish: readFinish({ finish: { bloom: { strength: 0.9, radius: 0.8 } } }),
    ...playOf(G, { airframe: false }),
    cameras: [{ name: 'start', worldFraming: { cameraPosition: eye0.map(r2), lookAt: look0.map(r2), horizontalFov: r2(hfov) } }],
    viewBox: { width: 1280, height: Math.round(1280 / cam.aspect) },
    title,
    meta: { scroll: { view, screen: cam.screen, dist: cam.dist, ship, track, extent, layers: space.report, hulls: hulls.map((h) => h.report) } },
  };
}

