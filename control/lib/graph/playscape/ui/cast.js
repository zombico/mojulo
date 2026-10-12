/**
 * THE CAST IN CUES — the happenings a character gives the bus and the effects a cue (or a menu's choice) has on one.
 * The character world runs them (worlds/controllable/cast.js); this module reads them and lowers them onto the bus
 * as `{ do: 'ctrl', op, who, … }` intents.
 *
 *   when: { down | gone | spawned | stuck: '<who>' }   it falls / is sent away / appears / can't get through (a glob)
 *       | { arrive: '<who>' | { who, at? } }             it reaches a point of its walk (`at`: the place's name)
 *   then: { spawn: '<who>' | { who, at?, face? } }      wake one minted asleep (dormant: true) or sent away
 *       | { vanish | kill | stop: '<who>' }            send away · fell · end its walk or hold
 *       | { hurt: { who, by } } | { heal: '<who>' | { who, by? } }   its body.hp
 *       | { walk: { who, to, speed?, then?, face?, pose? } }   a dumb path through places: straight lines, no pathfinding
 *
 * A PLACE is a spot's id, an anchor's id (the built map's) or a point [x, y]. SPOTS are action points the play
 * declares: play.spots: [{ id, at: [x, y, z?], face?: degrees, pose?: 'stand' | 'sit' | 'use' | 'talk' | 'lean' }];
 * a walk that ends on one takes its facing and pose, and a cue's zone may be named by one like an anchor.
 *
 *   CAST_WHEN, CAST_THEN, SPOT_POSES, WALK_THEN   the vocabulary, one line each
 *   readSpots(play)                 → [{ id, at, face, pose }] or throws, teaching
 *   spotAnchors(play)               the spots as anchors ({ id, kind: 'spot', at }) for zones
 *   standPoints(anchors)            where a figure stands at a doorway (`<id>@<room>`, each side) or a door (`<id>@front`
 *                                   along its normal, `<id>@back`): DOOR_STAND off the sill, facing it
 *   withStands(anchors)             the anchors and their stand points: what places, zones and the laws look up
 *   readCastWhen(k, w, where) / readCastEffect(k, t, where)   one happening / effect, read
 *   castFire(w, type)               its reaction onto the bus
 *   lowerCastEffect(t, on, frag, places)   an effect onto the bus (an unplaced place drops; the laws name it)
 *   castRefs(play)                  { who: [..], places: [..], spawns: [..], vanished: [..] } every name the cast effects use
 */
import { DOOR_STAND } from '../objects/door.js';
import { readLook, readColor, LOOK_NAMES } from '../elements/elements.js';
import { PUFFS } from '../elements/moments.js';
import { readBeam, beamLanding, BEAM_NAMES } from '../elements/beams.js';
import { readExplosion, EXPLOSION_NAMES } from '../elements/explosions.js';

export const CAST_WHEN = Object.freeze({
  down: 'a character falls: killed, or its hp runs out (its id, a glob)',
  gone: 'a character is sent away (vanish, a wreck that burst)',
  spawned: 'a character appears (a spawn)',
  arrive: 'a character reaches a point of its walk: { arrive: who } any point, or { arrive: { who, at: place } }',
  stuck: "a character's walk can't get through (a second without progress); the walk drops",
  faded: 'a status comes off a character: it ran out or was lifted: { faded: who } any, or { faded: { who, is } }',
  struck: 'a beam reaches a character (its id, a glob)',
  seen: 'a character with sight (rule.mind.perception) newly sees its target (its id, a glob; the target rides as target)',
});
// a world listens for hits when a reaction waits on `hit:<id>` (hp-pool lowers to one): the page then reads the
// cast's facts, where a hit is counted, even when no cue reaches the cast
// (or on `seen`: a sighting is counted there too; or `broke`: a block's break)
export const listensForHits = (events) => !!events && Array.isArray(events.reactions) && events.reactions.some((r) => r && (String(r.on).startsWith('hit:') || r.on === 'seen' || r.on === 'broke'));
const TRANSITS_WORDS = 'smoke | hologram | scan | transporter | galvatron';
export const CAST_THEN = Object.freeze({
  spawn: `wake a character minted asleep (dormant: true) or sent away: { spawn: who | { who, at?: place, face?: degrees, with?: ${TRANSITS_WORDS} } }`,
  vanish: `send a character away (asleep again: hidden, untouchable): { vanish: who | { who, with? } }`,
  kill: 'a character falls (it lies down; down fires)',
  hurt: '{ hurt: { who, by } } takes from its body.hp; at 0 it falls',
  heal: '{ heal: who | { who, by? } } gives back body.hp (no by: all of it)',
  walk: "{ walk: { who, to: place | [places], speed?, then?: 'stay' | 'loop' | 'back', face?, pose? } } a dumb path: straight lines, the world's walls push it out, no pathfinding",
  stop: 'end a walk, or a hold at a spot',
  status: `{ status: { who, is, look?, for?, color? } } the character carries a status: is is any name you give it; look is how it shows on the body as it moves (a preset: ${LOOK_NAMES.join(', ')}; a name in play.looks; or its layers), defaulting to the look called is; for seconds, until lifted, or until the cue ends`,
  lift: '{ lift: who | { who, is? } } take a status off (no is: all of them)',
  transfigure: '{ transfigure: { who, into, with? } } who becomes into (a character minted asleep): into wakes where who stands and who goes; with: galvatron (default: skin to wire, the form morphs, re-skin) or any transit',
  puff: `{ puff: who | { who? | at: place, is?, color?, shake?: 0..1 } } a moment at a character's feet or a place: is ${PUFFS.join(', ')} (smoke by default); shake shakes the camera too`,
  shake: '{ shake: k | { k, for? } } the camera shakes, k 0..1 (0.5 a thump, 1 a quake), over for seconds (0.4), dying away',
  explode: `{ explode: who | { who? | at: place, is?, color?, scale? } } an explosion at a character's feet or a place: is a preset (${EXPLOSION_NAMES.join(', ')}), a name in play.explosions, or its parts (blast by default); scale sizes it`,
  beam: `{ beam: { who, to: who | place, is?, color? } } who fires an attack from its hand at a character or a place: is a preset (${BEAM_NAMES.join(', ')}), a name in play.beams, or its strands (orb by default); struck fires when it lands on a character`,
});
// how a character comes or goes (the page plays it on the body, or on a ghost of it as it goes)
export const TRANSITS = Object.freeze(['smoke', 'hologram', 'scan', 'transporter', 'galvatron']);
export const SPOT_POSES = Object.freeze(['stand', 'sit', 'use', 'talk', 'lean']);
export const WALK_THEN = Object.freeze(['stay', 'loop', 'back']);

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isPt = (p) => Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every(Number.isFinite);
const ID = /^[a-z][a-z0-9-]*$/;

/** play.spots, read. */
export function readSpots(play) {
  const list = play && play.spots;
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('play.spots is a list of { id, at: [x, y, z?], face?, pose? }');
  const seen = new Set();
  return list.map((s, i) => {
    const where = `play.spots[${i}]`;
    if (!isObj(s)) throw new Error(`${where} is { id, at: [x, y, z?], face?, pose? }`);
    if (!isStr(s.id) || !ID.test(s.id)) throw new Error(`${where}.id '${s.id}' is a lower-case word`);
    if (seen.has(s.id)) throw new Error(`play.spots: two spots called '${s.id}'`);
    seen.add(s.id);
    if (!isPt(s.at)) throw new Error(`${where}.at is a point [x, y] or [x, y, z]`);
    if (s.face !== undefined && !Number.isFinite(s.face)) throw new Error(`${where}.face is degrees (0 looks along +x, 90 along +y)`);
    if (s.pose !== undefined && !SPOT_POSES.includes(s.pose)) throw new Error(`${where}.pose is one of: ${SPOT_POSES.join(', ')}`);
    return { id: s.id, at: [s.at[0], s.at[1], s.at[2] ?? 0], face: s.face ?? null, pose: s.pose ?? null };
  });
}

/** The spots as anchors, so a cue's zone may be named by one. */
export const spotAnchors = (play) => readSpots(play).map((s) => ({ id: s.id, kind: 'spot', at: s.at }));

/** The stand points of the anchors with a normal (doorways, doors): places like spots, facing the opening. */
export function standPoints(anchors) {
  const out = [];
  for (const a of anchors || []) {
    if (!a || (a.kind !== 'doorway' && a.kind !== 'door') || !Array.isArray(a.N) || !Array.isArray(a.at)) continue;
    const l = Math.hypot(a.N[0], a.N[1]);
    if (!(l > 0)) continue;
    const nx = a.N[0] / l, ny = a.N[1] / l, deg = (x, y) => r3((Math.atan2(y + 0, x + 0) * 180) / Math.PI);
    const side = (s, name) => ({ id: `${a.id}@${name}`, kind: 'stand', of: a.id, at: [r3(a.at[0] + s * nx * DOOR_STAND), r3(a.at[1] + s * ny * DOOR_STAND), a.at[2] ?? 0], face: deg(-s * nx, -s * ny), pose: null });
    // a doorway's normal runs from its first room into its second
    if (a.kind === 'doorway' && Array.isArray(a.between)) out.push(side(-1, a.between[0]), side(1, a.between[1]));
    else out.push(side(1, 'front'), side(-1, 'back'));
  }
  return out;
}
/** The anchors and their stand points. */
export const withStands = (anchors) => (anchors ? [...anchors, ...standPoints(anchors)] : anchors);
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;

function readPlace(p, where) {
  if (isStr(p)) return p;
  if (isPt(p)) return [p[0], p[1], p[2] ?? 0];
  throw new Error(`${where} is a place: a spot's or an anchor's id, or a point [x, y]`);
}

export function readCastWhen(k, w, where) {
  const v = w[k];
  if (k === 'arrive' && isObj(v)) {
    if (!isStr(v.who)) throw new Error(`${where}.arrive.who is a character's id`);
    if (v.at !== undefined && !isStr(v.at)) throw new Error(`${where}.arrive.at is a place's name (a spot or an anchor)`);
    return { kind: 'arrive', who: v.who, at: v.at ?? null };
  }
  if (k === 'faded' && isObj(v)) {
    if (!isStr(v.who)) throw new Error(`${where}.faded.who is a character's id`);
    if (v.is !== undefined && !(isStr(v.is) && ID.test(v.is))) throw new Error(`${where}.faded.is is a status's name`);
    return { kind: 'faded', who: v.who, at: null, ...(v.is ? { is: v.is } : {}) };
  }
  if (!isStr(v)) throw new Error(`${where}.${k} is a character's id (a glob)${k === 'arrive' ? ', or { who, at }' : k === 'faded' ? ', or { who, is }' : ''}`);
  return { kind: k, who: v, at: null };
}

export function readCastEffect(k, t, where, ctx = {}) {
  const v = t[k], w = `${where}.${k}`;
  // a puff stands at a place, or at a character
  if (k === 'puff' && isObj(v) && v.who === undefined) {
    if (v.at === undefined) throw new Error(`${w} is a character's id, or { at: place, is? }`);
    return { kind: 'cast', op: 'puff', who: null, at: readPlace(v.at, `${w}.at`), ...puffOpts(v, w), page: true };
  }
  // an explosion is a puff carrying its parts: at a place, or at a character's feet
  if (k === 'explode') {
    const o = isStr(v) ? { who: v } : v;
    if (!isObj(o) || (o.who === undefined && o.at === undefined)) throw new Error(`${w} is a character's id, or { who | at: place, is?, color?, scale? }`);
    const name = isStr(o.is) ? o.is : o.is === undefined ? 'blast' : null;
    const out = { kind: 'cast', op: 'puff', who: isStr(o.who) ? o.who : null, is: name || 'explosion', spec: readExplosion(o.is ?? 'blast', `${w}.is`, ctx.explosions), page: true };
    if (o.who === undefined) out.at = readPlace(o.at, `${w}.at`);
    if (o.color !== undefined) out.color = readColor(o.color, `${w}.color`);
    if (o.scale !== undefined) { if (!(Number.isFinite(o.scale) && o.scale > 0 && o.scale <= 10)) throw new Error(`${w}.scale is how big, 0.1 to 10`); out.scale = o.scale; }
    return out;
  }
  // a shake is the camera's: no one, no place
  if (k === 'shake') {
    const o = Number.isFinite(v) ? { k: v } : v;
    if (!isObj(o) || !(Number.isFinite(o.k) && o.k > 0 && o.k <= 1)) throw new Error(`${w} is how hard, 0..1, or { k, for? }`);
    if (o.for !== undefined && !(Number.isFinite(o.for) && o.for > 0 && o.for <= 3)) throw new Error(`${w}.for is seconds (to 3)`);
    return { kind: 'cast', op: 'shake', who: null, k: o.k, ...(o.for !== undefined ? { for: o.for } : {}), page: true };
  }
  const who = isStr(v) ? v : isObj(v) && isStr(v.who) ? v.who : null;
  if (!who) throw new Error(k === 'hurt' || k === 'walk' || k === 'status' ? `${w}.who is a character's id` : `${w} is a character's id, or { who, … }`);
  const o = isObj(v) ? v : {};
  const out = { kind: 'cast', op: k, who, page: true };
  if (k === 'hurt') {
    if (!(Number.isFinite(o.by) && o.by > 0)) throw new Error(`${w}.by is how much hp it takes`);
    out.by = o.by;
  }
  if (k === 'heal' && o.by !== undefined) { if (!(Number.isFinite(o.by) && o.by > 0)) throw new Error(`${w}.by is how much hp it gives`); out.by = o.by; }
  if ((k === 'spawn' || k === 'vanish' || k === 'transfigure') && o.with !== undefined) {
    if (!TRANSITS.includes(o.with)) throw new Error(`${w}.with is how it comes or goes: ${TRANSITS.join(', ')}`);
    out.with = o.with;
  }
  if (k === 'transfigure') { if (!isStr(o.into) || o.into === who) throw new Error(`${w}.into is the character it becomes (minted asleep)`); out.into = o.into; }
  if (k === 'puff') Object.assign(out, puffOpts(o, w));
  if (k === 'spawn') {
    if (o.at !== undefined) out.at = readPlace(o.at, `${w}.at`);
    if (o.face !== undefined) { if (!Number.isFinite(o.face)) throw new Error(`${w}.face is degrees`); out.face = o.face; }
  }
  if (k === 'status') {
    if (!(isStr(o.is) && ID.test(o.is))) throw new Error(`${w}.is is the status's name, a lower-case word ('poisoned', 'blessed', 'marked')`);
    out.is = o.is;
    // its look: given, or the one called by its name (play.looks, then the presets)
    out.look = o.look !== undefined ? readLook(o.look, `${w}.look`, ctx.looks) : readLook(o.is, `${w}.is`, ctx.looks);
    if (o.for !== undefined) { if (!(Number.isFinite(o.for) && o.for > 0)) throw new Error(`${w}.for is seconds`); out.for = o.for; }
    if (o.color !== undefined) out.color = readColor(o.color, `${w}.color`);
  }
  if (k === 'beam') {
    if (o.to === undefined) throw new Error(`${w}.to is a character's id or a place`);
    out.to = isStr(o.to) ? o.to : readPlace(o.to, `${w}.to`);
    out.spec = readBeam(o.is ?? 'orb', `${w}.is`, ctx.beams, ctx.explosions);
    if (isStr(o.is)) out.name = o.is;
    if (o.color !== undefined) out.color = readColor(o.color, `${w}.color`);
  }
  if (k === 'lift' && o.is !== undefined) { if (!(isStr(o.is) && ID.test(o.is))) throw new Error(`${w}.is is a status's name`); out.is = o.is; }
  if (k === 'walk') {
    if (o.to === undefined) throw new Error(`${w}.to is a place or a list of places`);
    out.to = (isPt(o.to) || !Array.isArray(o.to) ? [o.to] : o.to).map((p, i) => readPlace(p, `${w}.to${Array.isArray(o.to) && !isPt(o.to) ? `[${i}]` : ''}`));
    if (!out.to.length) throw new Error(`${w}.to names at least one place`);
    if (o.speed !== undefined) { if (!(Number.isFinite(o.speed) && o.speed > 0)) throw new Error(`${w}.speed is metres a second`); out.speed = o.speed; }
    if (o.then !== undefined) { if (!WALK_THEN.includes(o.then)) throw new Error(`${w}.then is one of: ${WALK_THEN.join(', ')}`); out.then = o.then; }
    if (o.face !== undefined) { if (!Number.isFinite(o.face)) throw new Error(`${w}.face is degrees`); out.face = o.face; }
    if (o.pose !== undefined) { if (!SPOT_POSES.includes(o.pose)) throw new Error(`${w}.pose is one of: ${SPOT_POSES.join(', ')}`); out.pose = o.pose; }
  }
  return out;
}

// a puff's kind, its colour and how hard it shakes the camera
function puffOpts(o, w) {
  const out = {};
  if (o.is !== undefined) { if (!PUFFS.includes(o.is)) throw new Error(`${w}.is is one of: ${PUFFS.join(', ')}`); out.is = o.is; }
  if (o.color !== undefined) out.color = readColor(o.color, `${w}.color`);
  if (o.shake !== undefined) { if (!(Number.isFinite(o.shake) && o.shake > 0 && o.shake <= 1)) throw new Error(`${w}.shake is how hard the camera shakes, 0..1`); out.shake = o.shake; }
  return out;
}

/** A cast happening's reaction: the character world's event, matched to the who (and the place). */
export const castFire = (w, type) => ({ on: w.kind, match: { entity: w.who, ...(w.at ? { at: w.at } : {}), ...(w.is ? { is: w.is } : {}) }, do: 'emit', type });

const placeAt = (ref, places) => (Array.isArray(ref) ? { at: ref, name: null } : (places || []).find((p) => p.id === ref) || null);

/** A cast effect onto the bus, on one event. Places resolve here; one the map doesn't carry drops the effect. */
export function lowerCastEffect(t, on, frag, places = []) {
  const r = { on, do: 'ctrl', op: t.op, who: t.who };
  if (t.by !== undefined) r.by = t.by;
  for (const k of ['is', 'for', 'color', 'with', 'into', 'shake', 'k', 'spec', 'scale']) if (t[k] !== undefined) r[k] = t[k];
  if (t.op === 'shake') delete r.who;
  if (t.op === 'beam') {
    // at a place when one is called so, else at the character of that name
    const p = placeAt(t.to, places);
    r.to = p ? p.at.slice() : t.to;
    r.spec = t.spec; r.land = beamLanding(t.spec);
    if (t.name) r.name = t.name;
  }
  if (t.op === 'puff') { if (!t.who) delete r.who; if (t.at !== undefined) { const p = placeAt(t.at, places); if (!p) return frag; r.at = p.at.slice(); } }
  if (t.op === 'spawn') {
    if (t.at !== undefined) { const p = placeAt(t.at, places); if (!p) return frag; r.at = p.at.slice(); if (t.face === undefined && Number.isFinite(p.face)) r.face = p.face; }
    if (t.face !== undefined) r.face = t.face;
  }
  if (t.op === 'walk') {
    const ps = t.to.map((x) => placeAt(x, places));
    if (ps.some((p) => !p)) return frag;
    r.points = ps.map((p) => [p.at[0], p.at[1]]);
    r.names = t.to.map((x, i) => (Array.isArray(x) ? String(i) : x));
    const end = ps[ps.length - 1];
    for (const k of ['speed', 'then']) if (t[k] !== undefined) r[k] = t[k];
    const face = t.face ?? end.face, pose = t.pose ?? end.pose;
    if (Number.isFinite(face)) r.face = face;
    if (pose) r.pose = pose;
  }
  frag.reactions.push(r);
  return frag;
}

/** Every name the play's cast effects and happenings use (for the laws). */
export function castRefs(effects, whens) {
  const who = new Set(), places = new Set(), spawns = new Set(), vanished = new Set();
  for (const t of effects) {
    if (t.kind !== 'cast') continue;
    if (t.who) who.add(t.who);
    if (t.op === 'spawn') { spawns.add(t.who); if (isStr(t.at)) places.add(t.at); }
    if (t.op === 'vanish' || t.op === 'kill' || t.op === 'transfigure') vanished.add(t.who);
    if (t.op === 'transfigure') { who.add(t.into); spawns.add(t.into); }
    if (t.op === 'puff' && isStr(t.at)) places.add(t.at);
    if (t.op === 'walk') for (const p of t.to) if (isStr(p)) places.add(p);
  }
  // a cast happening's character, and the one a zone watches in place of the player
  for (const w of whens) if (w && (CAST_WHEN[w.kind] || w.who) && isStr(w.who) && !w.who.includes('*')) who.add(w.who);
  return { who: [...who], places: [...places], spawns: [...spawns], vanished: [...vanished] };
}
