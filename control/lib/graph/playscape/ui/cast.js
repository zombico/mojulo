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

export const CAST_WHEN = Object.freeze({
  down: 'a character falls: killed, or its hp runs out (its id, a glob)',
  gone: 'a character is sent away (vanish, a wreck that burst)',
  spawned: 'a character appears (a spawn)',
  arrive: 'a character reaches a point of its walk: { arrive: who } any point, or { arrive: { who, at: place } }',
  stuck: "a character's walk can't get through (a second without progress); the walk drops",
});
export const CAST_THEN = Object.freeze({
  spawn: 'wake a character minted asleep (dormant: true) or sent away: { spawn: who | { who, at?: place, face?: degrees } }',
  vanish: 'send a character away (asleep again: hidden, untouchable)',
  kill: 'a character falls (it lies down; down fires)',
  hurt: '{ hurt: { who, by } } takes from its body.hp; at 0 it falls',
  heal: '{ heal: who | { who, by? } } gives back body.hp (no by: all of it)',
  walk: "{ walk: { who, to: place | [places], speed?, then?: 'stay' | 'loop' | 'back', face?, pose? } } a dumb path: straight lines, the world's walls push it out, no pathfinding",
  stop: 'end a walk, or a hold at a spot',
});
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
  if (!isStr(v)) throw new Error(`${where}.${k} is a character's id (a glob)${k === 'arrive' ? ', or { who, at }' : ''}`);
  return { kind: k, who: v, at: null };
}

export function readCastEffect(k, t, where) {
  const v = t[k], w = `${where}.${k}`;
  const who = isStr(v) ? v : isObj(v) && isStr(v.who) ? v.who : null;
  if (!who) throw new Error(k === 'hurt' || k === 'walk' ? `${w}.who is a character's id` : `${w} is a character's id, or { who, … }`);
  const o = isObj(v) ? v : {};
  const out = { kind: 'cast', op: k, who, page: true };
  if (k === 'hurt') {
    if (!(Number.isFinite(o.by) && o.by > 0)) throw new Error(`${w}.by is how much hp it takes`);
    out.by = o.by;
  }
  if (k === 'heal' && o.by !== undefined) { if (!(Number.isFinite(o.by) && o.by > 0)) throw new Error(`${w}.by is how much hp it gives`); out.by = o.by; }
  if (k === 'spawn') {
    if (o.at !== undefined) out.at = readPlace(o.at, `${w}.at`);
    if (o.face !== undefined) { if (!Number.isFinite(o.face)) throw new Error(`${w}.face is degrees`); out.face = o.face; }
  }
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

/** A cast happening's reaction: the character world's event, matched to the who (and the place). */
export const castFire = (w, type) => ({ on: w.kind, match: { entity: w.who, ...(w.at ? { at: w.at } : {}) }, do: 'emit', type });

const placeAt = (ref, places) => (Array.isArray(ref) ? { at: ref, name: null } : (places || []).find((p) => p.id === ref) || null);

/** A cast effect onto the bus, on one event. Places resolve here; one the map doesn't carry drops the effect. */
export function lowerCastEffect(t, on, frag, places = []) {
  const r = { on, do: 'ctrl', op: t.op, who: t.who };
  if (t.by !== undefined) r.by = t.by;
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
    who.add(t.who);
    if (t.op === 'spawn') { spawns.add(t.who); if (isStr(t.at)) places.add(t.at); }
    if (t.op === 'vanish' || t.op === 'kill') vanished.add(t.who);
    if (t.op === 'walk') for (const p of t.to) if (isStr(p)) places.add(p);
  }
  // a cast happening's character, and the one a zone watches in place of the player
  for (const w of whens) if (w && (CAST_WHEN[w.kind] || w.who) && isStr(w.who) && !w.who.includes('*')) who.add(w.who);
  return { who: [...who], places: [...places], spawns: [...spawns], vanished: [...vanished] };
}
