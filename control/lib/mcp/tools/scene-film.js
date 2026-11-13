/**
 * scene-film — the cinematics department's FILM, one core for the door and the script: a screenplay played by its cast
 * (actor/scene.js), shot by its coverage (actor/coverage.js), written as a Blender film pack (actor/scene-film.js) with
 * each actor a skinned GLB of its hero carrying the scene's face take and act.
 *
 *   forge_motion({ subject: { screenplay }, shot: { motion: 'coverage' }, export: 'blender' }) and
 *   scripts/export-scene-blender.mjs both write through `writeSceneFilm`, so the pack is the same bytes either way.
 *
 *   THE SCREENPLAY: { cast: { <who>: { persona?, hero?, register?, style?, role?, mark?, height? } }, marks?, script,
 *   seed?, world_ref?, voice?, dub? } (who: the name the script writes, lower case). A cast member plays
 *     - from a PERSONA's ref (create_character as 'persona'): the persona is the actor, its hero the body and its
 *       register, style and role its playing; the scene's own words for the part win over the persona's;
 *     - from a HERO: a minted hero's ref, or a hero spec (the hero door's words);
 *     - from nothing: the default hero (the baseline's realistic hero, actor/baseline.js).
 *   A hero acts only where its face takes a performance: the realistic hero (its relational head) or the anime head.
 *   THE SET: `world_ref`, a stored world whose named places are marks (actor/set.js), its Blender pack under the actors.
 *   THE VOICE: `voice: { <n>: <a .wav path> | { audio, text? } }` the spoken lines recorded (n the line's number, 1 the
 *   first), which set the scene's clock and its mouths; `dub: { <locale>: { <n>: … } }` the lines dubbed, to picture
 *   (scene-voice.js binds them; the recipe keeps them bound, so a re-forge needs no path).
 *
 *   prepareScreenplay(screenplay, { getRow }) → { screenplay, kept, set, advice }   the IO before the plan: the set read,
 *     the recordings bound; `screenplay` what the plan plays (the set's places among its marks), `kept` what a recipe
 *     keeps (the screenplay as written, its recordings bound)
 *   resolveSceneCast(screenplay, { getRow, style? }) → { cast, heroes, sources }   the words actScene reads, each
 *     actor's hero ({ ref } | { spec }) and where each part came from (refs looked up through getRow)
 *   planSceneFilm(screenplay, { getRow, style?, grain?, set? }) → { S, coverage, notes, cast, heroes, sources }   no mint
 *   writeSceneFilm({ outDir, screenplay, getRow, title?, style?, grain?, grade?, fps?, hero?, log? }) → the summary
 *     (the actors minted and written as actors/<who>.glb, the pack's files beside them)
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { actScene } from '@/lib/graph/actor/scene.js';
import { coverScene } from '@/lib/graph/actor/coverage.js';
import { standingOf, openGround, floorUnder, middleOf, EASE } from '@/lib/graph/actor/ground.js';
import { PAIR } from '@/lib/graph/actor/scene.js';
import { faceSight } from '@/lib/graph/shoot/clearance.js';
import { sceneActOf } from '@/lib/graph/actor/act.js';
import { directorsNotes } from '@/lib/graph/actor/notes.js';
import { sceneFilmFiles, LOOKS } from '@/lib/graph/actor/scene-film.js';
import { BASELINE } from '@/lib/graph/actor/baseline.js';
import { styleErrors } from '@/lib/graph/actor/style.js';
import { readGrade } from '@/lib/graph/scene/channels/grade.js';
import { isPersonaKind } from '@/lib/graph/persona/persona.js';

export { LOOKS };
export const SCENE_CAST_KEYS = Object.freeze(['persona', 'hero', 'register', 'style', 'role', 'mark', 'height']);
export const SCREENPLAY_KEYS = Object.freeze(['cast', 'marks', 'props', 'script', 'seed', 'world_ref', 'voice', 'dub']);
/** what a prop takes: what it is, where it stands (metres or a mark), how it is turned (degrees), and how much larger
 * it stands than it was made (a thing made in no real unit is read as metres) */
export const PROP_KEYS = Object.freeze(['ref', 'at', 'turn', 'scale']);
/** the grain words: the scene shown on ones, twos or threes (shoot/time.js), the camera on ones */
export const GRAINS = Object.freeze({ ones: 1, twos: 2, threes: 3 });

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const MANUAL = "manual: get_motion_vocab({ id: 'scene-film' })";

/** A grain word or number → 1 | 2 | 3 | null (none given) */
export function readGrain(raw, at = 'grain') {
  if (raw == null) return null;
  const g = Object.hasOwn(GRAINS, raw) ? GRAINS[raw] : ({ 1: 1, 2: 2, 3: 3 })[raw];
  if (g === undefined) throw new Error(`${at}: ${Object.keys(GRAINS).join(' | ')}`);
  return g;
}

/** Error lines for a screenplay's shape (empty = valid); the script's words are checked by actScene */
export function screenplayErrors(sp) {
  if (!isPlain(sp)) return ['a screenplay is { cast: { <who>: { persona? | hero?, register?, style?, role?, mark? } }, marks?, script, seed? }'];
  const errs = [];
  const extra = Object.keys(sp).filter((k) => !SCREENPLAY_KEYS.includes(k));
  if (extra.length) errs.push(`a screenplay takes ${SCREENPLAY_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (typeof sp.script !== 'string' || !sp.script.trim()) errs.push('script: the screenplay\'s text ("NAME: the line", "NAME (worried): the line", "Mara crosses to the table.")');
  if (!isPlain(sp.cast) || !Object.keys(sp.cast).length) errs.push('cast: { <who>: { persona?: <ref> | hero?: <ref> | <a hero spec>, … } }, one actor at least');
  else for (const [who, C] of Object.entries(sp.cast)) {
    if (!isPlain(C)) { errs.push(`cast.${who}: { persona? | hero?, register?, style?, role?, mark?, height? }`); continue; }
    const bad = Object.keys(C).filter((k) => !SCENE_CAST_KEYS.includes(k));
    if (bad.length) errs.push(`cast.${who}: a part takes ${SCENE_CAST_KEYS.join(', ')} (not ${bad.join(', ')})`);
    if (C.persona !== undefined && (typeof C.persona !== 'string' || !C.persona)) errs.push(`cast.${who}.persona: a persona's ref (create_character as 'persona')`);
    if (C.persona !== undefined && C.hero !== undefined) errs.push(`cast.${who}: a persona or a hero, not both (the persona's hero is its body)`);
    if (C.hero !== undefined && !(typeof C.hero === 'string' && C.hero) && !isPlain(C.hero)) errs.push(`cast.${who}.hero: a hero's ref or a hero spec`);
    if (C.style !== undefined) errs.push(...styleErrors(C.style, `cast.${who}.style`));
  }
  if (sp.marks !== undefined && !isPlain(sp.marks)) errs.push('marks: { <name>: [x, y] } (metres)');
  if (sp.props !== undefined) {
    if (!isPlain(sp.props)) errs.push('props: { <name>: { ref, at: [x, y] | <a mark>, turn?, scale? } }: anything mojulo made, stood in the scene');
    else for (const [name, Q] of Object.entries(sp.props)) {
      const at = `props.${name}`;
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) errs.push(`${at}: a prop is named as a mark is (lower-case letters, digits, - and _)`);
      if (!isPlain(Q)) { errs.push(`${at}: { ref, at: [x, y] | <a mark>, turn?, scale? }`); continue; }
      const bad = Object.keys(Q).filter((k) => !PROP_KEYS.includes(k));
      if (bad.length) errs.push(`${at}: a prop takes ${PROP_KEYS.join(', ')} (not ${bad.join(', ')})`);
      if (typeof Q.ref !== 'string' || !Q.ref) errs.push(`${at}.ref: the ref of anything mojulo made (a solid, a building, a vehicle, a world)`);
      if (!(typeof Q.at === 'string' && Q.at) && !(Array.isArray(Q.at) && Q.at.length >= 2 && Q.at.slice(0, 2).every(Number.isFinite))) errs.push(`${at}.at: where it stands, [x, y] in metres or a mark's name`);
      if (Q.turn !== undefined && !Number.isFinite(Q.turn)) errs.push(`${at}.turn: degrees it is turned about the vertical`);
      if (Q.scale !== undefined && !(Number.isFinite(Q.scale) && Q.scale > 0)) errs.push(`${at}.scale: how many times larger it stands than it was made (above 0)`);
    }
  }
  if (sp.world_ref !== undefined && (typeof sp.world_ref !== 'string' || !sp.world_ref)) errs.push('world_ref: a stored world\'s ref, the set');
  if (sp.voice !== undefined && !isPlain(sp.voice)) errs.push('voice: { <line number>: <a .wav path> | { audio, text? } }');
  if (sp.dub !== undefined && !isPlain(sp.dub)) errs.push('dub: { <locale>: { <line number>: <a .wav path> | { audio, text } } }');
  return errs;
}

/** Where a hero's face can act: the realistic hero's relational head or the anime head (layered.js `perform`) */
const acts = (record) => record?.head === 'relational' || record?.head === 'anime';

/** The cast's words, heroes and sources: a persona's playing under the scene's own words for the part */
export function resolveSceneCast(sp, { getRow, style = null } = {}) {
  const errs = screenplayErrors(sp);
  if (errs.length) throw new Error(`screenplay refused:\n - ${errs.join('\n - ')}\n(${MANUAL})`);
  const cast = {}, heroes = {}, sources = {};
  for (const [who, C] of Object.entries(sp.cast)) {
    const { persona, hero, ...words } = C;
    let playing = {}, heroOf = null, source = 'the default hero';
    if (persona !== undefined) {
      const row = getRow?.(persona);
      if (!row || !isPersonaKind(row.manifest?.kind)) throw new Error(`cast.${who}.persona: '${persona}' is ${row ? `a ${row.manifest?.kind ?? 'sketch'}` : 'no sketch'}, not a persona (create_character as 'persona')`);
      const P = row.manifest.persona;
      playing = Object.fromEntries(['register', 'style', 'role'].filter((k) => P[k] !== undefined).map((k) => [k, P[k]]));
      heroOf = { ref: P.hero };
      source = `persona ${persona} (hero ${P.hero})`;
    } else if (typeof hero === 'string') { heroOf = { ref: hero }; source = `hero ${hero}`; }
    else if (isPlain(hero)) { heroOf = { spec: hero }; source = 'a hero spec'; }
    cast[who] = { ...playing, ...words, ...(style && (words.style ?? playing.style) === undefined ? { style } : {}) };
    heroes[who] = heroOf;
    sources[who] = source;
  }
  return { cast, heroes, sources };
}

/** The scene as played and shot, before any actor is minted: the blocking, the coverage and the director's notes */
export function planSceneFilm(sp, { getRow, style = null, grain = null, set = null } = {}) {
  const { cast, heroes, sources } = resolveSceneCast(sp, { getRow, style });
  // (a set that says what stands on its floor: the crosses go round it, actor/route.js)
  const S = actScene({ ...sp, cast, ...(set?.floor_plan ? { floor_plan: set.floor_plan } : {}) });
  // (on a set with walled rooms the cameras stand inside them: actor/coverage.js fitRoom)
  const walled = set?.rooms?.some((r) => r.walled) ? set.rooms : null;
  // (and on any set they stand where they see the cast: the set's faces as a line of sight, coverage.js fitSight)
  const sight = set?.faces?.length ? faceSight(set.faces) : null;
  const coverage = coverScene(S, { grain: readGrain(grain), ...(walled ? { rooms: walled } : {}), ...(sight ? { sight } : {}) });
  return { S, coverage, notes: directorsNotes(S, coverage), cast, heroes, sources };
}

/**
 * The IO a screenplay asks before it is planned: its set read (a world's named places among the marks, the floor under
 * the cast) and its recordings bound. `screenplay` is what the plan plays; `kept` what a recipe keeps: the screenplay as
 * written, its recordings bound (so a re-forge needs no path), the set's places never copied in (the world is read
 * again on every forge).
 */
export async function prepareScreenplay(sp, { getRow } = {}) {
  const errs = screenplayErrors(sp);
  if (errs.length) throw new Error(`screenplay refused:\n - ${errs.join('\n - ')}\n(${MANUAL})`);
  // (the props are the set's: the plan plays the screenplay without them, a recipe keeps them as written)
  const { props, ...written } = sp;
  let play = written, set = null;
  if (sp.world_ref !== undefined) {
    const row = getRow?.(sp.world_ref);
    if (!row?.manifest) throw new Error(`world_ref: '${sp.world_ref}' is ${row ? 'a sketch with no recipe' : 'no sketch'} (a stored world is the set; ${MANUAL})`);
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
    const { setPlaces, castOnSet } = await import('@/lib/graph/actor/set.js');
    const { payload } = await resolveWorldScene(row);
    const places = setPlaces(payload);
    if (!payload) throw new Error(`world_ref: '${sp.world_ref}' (${row.manifest.kind}) has no form to stand in (${MANUAL})`);
    // (a world that names no place, an object, a city, a landscape, is a set all the same: the cast is stood on the
    // clear ground nearest its middle, a place called `ground`; actor/ground.js)
    if (!Object.keys(places.marks).length && !Object.keys(sp.marks ?? {}).length) {
      const raw = setFaces(payload, 0);
      if (!raw.length) throw new Error(`world_ref: '${sp.world_ref}' (${row.manifest.kind}) has nothing to stand on (no faces, no rooms, no anchors): give the screenplay its own marks`);
      // (the floor is the ground under where the cast ends up, not under the world's middle, which may be the inside
      // of a thing: stood first on the lowest the world goes, then again on the ground found under that spot)
      const mid = middleOf(raw), width = Math.max(0, Object.keys(sp.cast).length - 1) * PAIR;
      const spot = (floor) => openGround(raw.map((f) => ({ corners: f.corners.map((c) => [c[0], c[1], c[2] - floor]) })), mid, { width });
      let z = floorUnder(raw, [Infinity, Infinity]), at = spot(z);
      const under = floorUnder(raw, at);
      if (Math.abs(under - z) > 1e-3) { z = under; at = spot(z); }
      places.marks.ground = at; places.floors.ground = z;
    }
    const on = castOnSet(written, places);
    play = on.screenplay;
    const faces = setFaces(payload, on.floor);
    // (what stands on the set's floor: a world that says so is taken at its word (a decorated room's pieces); any
    // other is read from its faces, about where the scene is played: actor/ground.js)
    const plan = on.floor_plan ?? groundPlan(faces, play);
    set = { ref: sp.world_ref, title: row.title ?? null, kind: row.manifest.kind, floor: on.floor, rooms: places.rooms, ...(plan ? { floor_plan: plan } : {}), places: Object.keys(places.marks).length, faces };
  }
  const advice = [];
  if (props && Object.keys(props).length) {
    // ANYTHING mojulo made stood in the scene: its faces join the set's, so it is walked round, seen past and boarded
    // like the rest (actor/ground.js), and its name is a place: the clear ground nearest its south side
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
    set = set ?? { ref: null, title: null, kind: 'props', floor: 0, rooms: [], places: 0, faces: [] };
    const marks = { ...play.marks }, stood = [];
    for (const [name, Q] of Object.entries(props)) {
      const row = getRow?.(Q.ref);
      if (!row?.manifest) throw new Error(`props.${name}.ref: '${Q.ref}' is ${row ? 'a sketch with no recipe' : 'no sketch'} (${MANUAL})`);
      const { payload } = await resolveWorldScene(row);
      const raw = payload ? setFaces(payload, 0) : [];
      if (!raw.length) throw new Error(`props.${name}.ref: '${Q.ref}' (${row.manifest.kind}) has no form to stand in a scene (${MANUAL})`);
      const at = Array.isArray(Q.at) ? Q.at : marks[Q.at];
      if (!at) throw new Error(`props.${name}.at: no mark '${Q.at}' (${Object.keys(marks).join(', ') || 'the scene has none'})`);
      const k = Q.scale ?? 1, placed = placeProp(k === 1 ? raw : raw.map((f) => ({ corners: f.corners.map((c) => [c[0] * k, c[1] * k, c[2] * k]) })), at, Q.turn ?? 0);
      set.faces.push(...placed.faces);
      stood.push({ name, ...placed });
    }
    for (const P of stood) if (!Object.hasOwn(marks, P.name)) marks[P.name] = openGround(set.faces, [P.at[0], P.at[1] - P.half[1] - EASE], { seek: 4 });
    // (with no world under them the cast would be stood on the first places named, the props' own: a part with no mark
    // gets one of its own on the clear ground nearest the stage's middle, the cast in a line as on any set)
    let cast = play.cast;
    if (sp.world_ref === undefined) {
      const free = Object.keys(cast).filter((w) => cast[w].mark === undefined);
      const mid = free.length ? openGround(set.faces, [0, 0], { width: Math.max(0, free.length - 1) * PAIR }) : null;
      free.forEach((w, i) => { const id = `${w}-mark`; if (!Object.hasOwn(marks, id)) marks[id] = [Math.round((mid[0] + (i - (free.length - 1) / 2) * PAIR) * 1000) / 1000, mid[1]]; cast = { ...cast, [w]: { ...cast[w], mark: id } }; });
    }
    play = { ...play, marks, cast };
    set.props = stood.map((P) => ({ name: P.name, ref: props[P.name].ref, at: P.at, size: P.size }));
    set.places += stood.length;
    advice.push(...stood.map((P) => ({ id: 'prop-board-only', says: `prop "${P.name}" stands in the plan and the storyboard; the Blender film does not carry it yet`, try: 'board the scene with it; build it into the set\'s world for the render' })));
    const own = groundPlan(stood.flatMap((P) => P.faces), play);
    // (in a room that says its own pieces, the props' ground is added to them; anywhere else the whole ground is read again)
    if (set.floor_plan && set.rooms.some((R) => R.walled)) { set.floor_plan = { ...set.floor_plan, blocks: [...set.floor_plan.blocks, ...(own?.blocks ?? [])] }; set.blocks = own?.blocks ?? []; }
    else { const plan = groundPlan(set.faces, play); if (plan) { set.floor_plan = plan; set.blocks = plan.blocks; } }
  } else if (set?.floor_plan && !set.rooms.some((R) => R.walled)) set.blocks = set.floor_plan.blocks;
  const { bindScreenplayVoice } = await import('@/lib/mcp/tools/scene-voice.js');
  const bound = bindScreenplayVoice(play);
  const withBound = (x) => ({ ...x, ...(bound.voice ? { voice: bound.voice } : {}), ...(bound.dub ? { dub: bound.dub } : {}) });
  return { screenplay: withBound(play), kept: withBound(sp), set, advice: [...advice, ...bound.advice] };
}

/**
 * A thing's faces stood in the scene: its middle over `at`, its lowest point on the floor, turned `turn` degrees about
 * the vertical (clockwise from above). → { faces, at, half: [x, y] its half extents as stood, size: [x, y, z] }
 */
export function placeProp(faces, at, turn = 0) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (const i of [0, 1, 2]) { lo[i] = Math.min(lo[i], c[i]); hi[i] = Math.max(hi[i], c[i]); }
  const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], a = (turn * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), r3 = (v) => Math.round(v * 1000) / 1000;
  const put = (c) => { const x = c[0] - mid[0], y = c[1] - mid[1]; return [r3(at[0] + x * co + y * si), r3(at[1] - x * si + y * co), r3(c[2] - lo[2])]; };
  const out = faces.map((f) => ({ corners: f.corners.map(put) }));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of out) for (const c of f.corners) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
  return { faces: out, at: [r3(at[0]), r3(at[1])], half: [r3((x1 - x0) / 2), r3((y1 - y0) / 2)], size: [r3(x1 - x0), r3(y1 - y0), r3(hi[2] - lo[2])] };
}

/** What stands on a set's floor, read from its faces about the marks the scene uses (the cast's, and each the script
 * names); null where nothing stands there */
function groundPlan(faces, play) {
  const script = String(play.script ?? '').toLowerCase(), cast = Object.values(play.cast ?? {}).map((C) => C.mark);
  const about = Object.entries(play.marks ?? {}).filter(([id]) => cast.includes(id) || script.includes(id.replace(/-/g, ' ')) || script.includes(id)).map(([, p]) => p);
  const { blocks } = standingOf(faces, { about });
  return blocks.length ? { blocks, rooms: [] } : null;
}

/** A set's faces in the scene's frame: metres, its floor at z 0 (what the coverage's cameras are framed in) */
function setFaces(payload, floor) {
  const k = Number.isFinite(payload?.metersPerUnit) && payload.metersPerUnit > 0 ? payload.metersPerUnit : 1;
  // (an object's own page stands it on a studio floor, `studio`: that is the page's, not the thing's)
  return (payload?.faces ?? []).filter((f) => Array.isArray(f?.corners) && f.corners.length >= 3 && !f.studio).map((f) => ({ corners: f.corners.map((c) => [c[0] * k, c[1] * k, c[2] * k - floor]) }));
}

/** how bright a room's house lights are (W of a Blender area light per m² of floor), and how far under the ceiling */
const HOUSE_W_PER_M2 = 30, HOUSE_DROP = 0.15;
/** The house lights of a set's walled rooms: one soft panel under each ceiling, over the middle of the floor, in the
 * scene's frame (metres, the set's floor at z 0): [{ room, at, size, watts }] */
export function houseLights(rooms) {
  const r2 = (v) => Math.round(v * 100) / 100;
  return (rooms ?? []).filter((R) => R.walled && Number.isFinite(R.h)).map((R) => {
    const w = R.max[0] - R.min[0], d = R.max[1] - R.min[1];
    return { room: R.id, at: [r2((R.min[0] + R.max[0]) / 2), r2((R.min[1] + R.max[1]) / 2), r2(R.h - HOUSE_DROP)], size: [r2(w * 0.6), r2(d * 0.6)], watts: Math.round(w * d * HOUSE_W_PER_M2) };
  });
}

/** Advice on a scene shot on a set: a shot whose camera has the set between it and the actors (shoot/clearance.js) */
export async function setAdvice(plan, set) {
  if (!set?.faces?.length) return [];
  const { shootSightlines } = await import('@/lib/graph/shoot/clearance.js');
  return shootSightlines(plan.coverage, set.faces).map((h) => ({ id: 'set-blocks', shot: h.shot, at: h.at, says: `shot "${h.shot}": the set stands between its camera and the actors (at [${h.at.join(', ')}])`, try: 'move the cast toward the middle of the room (their marks), or set the scene where the room is larger' }));
}

/** The sound a planned scene carries: its voice track, each dub's, the captions; null where nothing is recorded */
export async function writeSceneSound({ dir, plan, screenplay, fps = 24, prefix = '' }) {
  const recorded = plan.S.turns.some((T) => T.recording), dubs = screenplay.dub ? Object.keys(screenplay.dub) : [];
  if (!recorded && !dubs.length) return null;
  const { voiceTrack, voiceCaptions, screenClock, wavOf } = await import('@/lib/mcp/tools/scene-voice.js');
  const { dubAdvice } = await import('@/lib/graph/actor/dub.js');
  const screen = screenClock(plan.S, plan.coverage, fps), out = { dubs: {}, advice: [] };
  const put = (file, data) => { mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); writeFileSync(path.join(dir, file), data); return file; };
  const caps = voiceCaptions(plan.S, plan.coverage, { fps, screen });
  out.captions = put(`${prefix}captions.srt`, caps.srt); put(`${prefix}captions.vtt`, caps.vtt);
  if (recorded) {
    const T = voiceTrack(plan.S, plan.coverage, { voice: screenplay.voice, fps, screen });
    out.audio = put(`${prefix}voice.wav`, wavOf(T));
    out.voice = { lines: T.placed.length, seconds: T.seconds, ...(T.over.length ? { over: T.over } : {}) };
  }
  for (const L of dubs) {
    const T = voiceTrack(plan.S, plan.coverage, { voice: screenplay.dub[L], fps, screen }), C = voiceCaptions(plan.S, plan.coverage, { fps, dub: screenplay.dub[L], screen });
    out.dubs[L] = { audio: put(`${prefix}voice.${L}.wav`, wavOf(T)), captions: put(`${prefix}captions.${L}.srt`, C.srt), lines: T.placed.length };
    put(`${prefix}captions.${L}.vtt`, C.vtt);
    out.advice.push(...dubAdvice(plan.S.turns, screenplay.dub[L], L));
  }
  if (!dubs.length) delete out.dubs;
  return out;
}

/** A hero source ({ ref } | { spec } | null) → { key, manifest, record }, refused where its face cannot act */
async function heroSource(src, { who, getRow, fallback }) {
  const { heroRecord } = await import('@/lib/mcp/tools/layered.js');
  if (src?.ref) {
    const row = getRow?.(src.ref);
    if (!row?.manifest?.hero) throw new Error(`cast.${who}: '${src.ref}' is ${row ? `a ${row.manifest?.kind ?? 'sketch'}` : 'no sketch'}, not a hero (create_character as 'hero')`);
    const record = row.manifest.hero;
    if (!acts(record)) throw new Error(`cast.${who}: hero '${src.ref}' cannot act a scene: a face's performance is the realistic hero's (form: 'realistic') or the anime hero's (head: 'anime')`);
    return { key: `ref:${src.ref}`, ref: src.ref, manifest: row.manifest, record };
  }
  const spec = src?.spec ?? fallback;
  const record = heroRecord(spec);
  if (!acts(record)) throw new Error(`cast.${who}: this hero cannot act a scene: a face's performance is the realistic hero's (form: 'realistic') or the anime hero's (head: 'anime')`);
  return { key: `spec:${JSON.stringify(spec)}`, manifest: { kind: 'layered', hero: record }, record };
}

/** what a pack writes that depends on its scene: cleared before a pack is made again in the same folder */
const PACK_SOURCES = Object.freeze(['shots', 'actors', 'audio', 'set', 'shot.json', 'light.py', 'set.py', 'dub.py', 'atmosphere.json']);

/**
 * Write the scene film pack into outDir: actors/<who>.glb, then the pack's files (actor/scene-film.js). Returns the
 * summary the door and the script report: the files, the actors (bytes, seconds to mint, where each part came from),
 * the scene's seconds, its shots and the director's notes.
 */
export async function writeSceneFilm({ outDir, screenplay, getRow, title = 'scene', style = null, grain = null, grade = null, fps = 24, hero = null, log = () => {}, prepared = null, cache = null, render = null }) {
  if (style !== null) { const e = styleErrors(style, 'style'); if (e.length) throw new Error(e.join('; ')); }
  const graded = readGrade(grade, 'grade');
  if (!Number.isFinite(fps) || fps < 1 || fps > 120) throw new Error('fps: a frame rate, 1 to 120');
  { const { renderErrors } = await import('@/lib/graph/film/render-plan.js'); const e = renderErrors(render); if (e.length) throw new Error(e.join('; ')); }
  const P = prepared ?? await prepareScreenplay(screenplay, { getRow });
  const plan = planSceneFilm(P.screenplay, { getRow, style, grain, set: P.set });
  const { S, coverage, notes, heroes, sources } = plan;
  // (heroes resolved, and refused, before the first slow mint)
  const srcs = {};
  for (const w of Object.keys(S.actors)) srcs[w] = await heroSource(heroes[w], { who: w, getRow, fallback: hero ?? BASELINE.hero });

  const { expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
  const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf.js');
  const { attachRecordings } = await import('@/lib/graph/face-acting/recordings.js');
  const { dubbedRead, dubTake } = await import('@/lib/graph/actor/dub.js');
  const dubs = P.screenplay.dub ?? null;
  // (a pack made again in its folder: what the last one wrote that this one may not (a shot the scene no longer has,
  //  an actor cut from it, a dub, the lights) would be built and rendered with it, so the pack's own sources go first;
  //  what a build and a render made stays for the render worker, which sees the pack is another: film/pack-stamp.js)
  for (const f of PACK_SOURCES) rmSync(path.join(outDir, f), { recursive: true, force: true });
  mkdirSync(path.join(outDir, 'actors'), { recursive: true });
  // (a hero expanded once a call: `cache` shares it across a film's scenes)
  const expanded = cache ?? new Map(), actors = {}, minted = {};
  for (const w of Object.keys(S.actors)) {
    const src = srcs[w], t0 = Date.now();
    const named = `${title} · ${w}`;
    if (!expanded.has(src.key)) expanded.set(src.key, { ...expandLayeredManifest(src.ref ? { ...src.manifest, title: named } : { kind: 'layered', title: named, hero: src.record }), hero: src.record });
    const base = expanded.get(src.key), take = sceneActOf(S.actors[w]);
    // (a dub to picture: the same acting, the mouth the locale's: a face take of its own, face:dub-<locale>)
    const dubbed = dubs ? Object.fromEntries(Object.keys(dubs).map((L) => [dubTake(L), { ...take.perform.scene, beats: dubbedRead(S.actors[w], S.turns, dubs[L]).beats }])) : {};
    const manifest = { ...base, hero: { ...base.hero, perform: { ...(base.hero.perform ?? {}), ...take.perform, ...dubbed }, acts: take.acts } };
    // (the lit export: the realistic body's smooth normals and no light baked into its colours, so either look shades it)
    const { payload } = await resolveWorldScene({ ref: `scene-${w}`, title: `${title} · ${w}`, manifest }, { face: true, unshaded: true });
    // (a recorded line's WAV rides its face take in the GLB, as a hero's recorded performance does)
    attachRecordings(payload);
    const glb = facesToGlb(payload, { generator: `mojulo scene film · ${w}`, clips: '_all', skinned: true, lit: true });
    writeFileSync(path.join(outDir, 'actors', `${w}.glb`), Buffer.from(glb.bytes));
    actors[w] = { take: 'scene' };
    minted[w] = { glb: `actors/${w}.glb`, bytes: glb.bytes.byteLength, seconds: Math.round((Date.now() - t0) / 1000), plays: sources[w] };
    log(`actors/${w}.glb: ${(glb.bytes.byteLength / 1e6).toFixed(1)} MB, ${minted[w].seconds} s`);
  }
  const sound = await writeSceneSound({ dir: outDir, plan, screenplay: P.screenplay, fps, prefix: 'audio/' });
  let setPack = null, atmosphere = null;
  if (P.set?.ref) {
    const { buildBlenderPack } = await import('@/lib/graph/scene/blender-pack.js');
    await buildBlenderPack({ ref: P.set.ref, outDir: path.join(outDir, 'set'), log });
    setPack = { ref: P.set.ref, ...(P.set.title ? { title: P.set.title } : {}), floor: P.set.floor, pack: 'set/' };
    // (the set's light is its world's: the sky, the lamps and the fog it declares, read as the world's own film reads them)
    const { filmAtmosphere } = await import('@/lib/motion/blender-film.js');
    const world = getRow(P.set.ref);
    atmosphere = filmAtmosphere({ payload: (await resolveWorldScene(world, { unshaded: true })).payload, manifest: world.manifest ?? {} });
    // (a walled set with no light of its own would render black: its house lights, actor/scene-film.js actors.py house)
    const house = !atmosphere.sky && !atmosphere.lamps.length ? houseLights(P.set.rooms) : [];
    if (house.length) setPack.house = house;
  }
  const files = sceneFilmFiles({ S, coverage, actors, fps, title, atmosphere, grade: graded, sound: sound ? { audio: sound.audio ?? null, captions: sound.captions, ...(sound.dubs ? { dubs: Object.fromEntries(Object.entries(sound.dubs).map(([L, D]) => [L, { audio: D.audio, captions: D.captions, face: `face:${dubTake(L)}` }])) } : {}) } : null, set: setPack, render });
  for (const f of files) { mkdirSync(path.dirname(path.join(outDir, f.file)), { recursive: true }); writeFileSync(path.join(outDir, f.file), f.text); }
  return {
    files: [...Object.values(minted).map((m) => m.glb), ...files.map((f) => f.file)],
    shotFiles: files.filter((f) => f.file.startsWith('shots/')).map((f) => f.file),
    actors: minted,
    seconds: S.seconds,
    shots: coverage.shots.map((s) => ({ name: s.name, span: s.span })),
    cameras: coverage.cameras.length,
    notes: notes.map((n) => ({ id: n.id, ...(n.at !== undefined ? { at: n.at } : {}), says: n.says, try: n.try })),
    fps,
    grade: graded,
    ...(sound ? { sound } : {}),
    ...(P.set ? { set: (({ faces: _f, ...rest }) => rest)(P.set) } : {}),
    advice: [...P.advice, ...(prepared ? [] : await setAdvice(plan, P.set)), ...(sound?.advice ?? [])],
  };
}

/** The pack's title as a file-safe word (the shots are written as `shots/<title>-NN.json`) */
export const packTitle = (title) => String(title ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'scene';

/** shot.params a screenplay takes */
export const SCREENPLAY_PARAMS = Object.freeze(['look', 'style', 'grain', 'grade', 'hero', 'render']);

/** The forms a screenplay is forged to: its storyboard (the default: no mint, seconds), the storyboard and its animatic,
 * or the Blender film (each actor minted: minutes) */
export const SCREENPLAY_EXPORTS = Object.freeze(['storyboard', 'mp4', 'blender']);

/** The storyboard of a planned scene, written into dir: index.html (the board) and storyboard.json; with `animatic`, the
 * board's panels held on the scene's screen clock as motion.mp4 (actor/storyboard.js) */
export async function writeStoryboard({ dir, plan, title, fps = 24, animatic = false, screenplay = null, set = null, panels = false }) {
  const { storyboardOf, storyboardHtml, storyboardJson, animaticSegments, animaticFrameSvg } = await import('@/lib/graph/actor/storyboard.js');
  const heights = Object.fromEntries(Object.entries(plan.cast).filter(([, C]) => Number.isFinite(C.height)).map(([w, C]) => [w, C.height]));
  const board = storyboardOf(plan.S, plan.coverage, { notes: plan.notes, title, fps, heights, ...(set ? { rooms: set.rooms, ...(set.blocks?.length ? { blocks: set.blocks } : {}), set: { ref: set.ref ?? 'props', title: set.title ?? (set.ref ? null : 'its props') } } : {}) });
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), storyboardHtml(board));
  writeFileSync(path.join(dir, 'storyboard.json'), `${JSON.stringify(storyboardJson(board), null, 2)}\n`);
  // (each panel's frame as its own file: a film's book strings them along its scenes)
  if (panels) { mkdirSync(path.join(dir, 'panels'), { recursive: true }); for (const p of board.panels) writeFileSync(path.join(dir, 'panels', `${String(p.n).padStart(2, '0')}.svg`), p.frame); }
  // (the sound: the voice track, each dub's, the captions, beside the board; under the animatic)
  const sound = screenplay ? await writeSceneSound({ dir, plan, screenplay, fps }) : null;
  let mp4 = null;
  if (animatic) {
    const { encodeStitchMp4 } = await import('@/lib/motion/encode-mp4');
    const segs = frameAligned(animaticSegments(board), fps);
    mp4 = await encodeStitchMp4(segs.map((g) => ({ frameSvgs: [animaticFrameSvg(board, g, { width: 640, height: 360 })], fps: 1 / g.seconds, title })), path.join(dir, 'motion.mp4'), { fps, width: 960, bg: '#000000' });
    if (sound) {
      const { muxSound } = await import('@/lib/mcp/tools/scene-voice.js');
      mp4 = { ...mp4, tracks: await muxSound(path.join(dir, 'motion.mp4'), sound, { dir, seconds: mp4.durationSec }) };
    }
  }
  return { board, mp4, sound };
}

/** segments whose ends fall on frames, so a long cut never drifts from its sound (each rounded at its running end) */
export function frameAligned(segs, fps) {
  let at = 0;
  return segs.map((g) => { const a = Math.round(at * fps), b = Math.round((at + g.seconds) * fps); at += g.seconds; return { ...g, seconds: Math.max(1, b - a) / fps }; });
}

/**
 * forge_motion's SCREENPLAY family, into the motion's outcome folder, its recipe filed as every motion's is (recipe.json,
 * a Motion Project tag and stash):
 *   storyboard  (the default) index.html, the board: a panel a coverage shot, drawn with stand-ins; no mint, seconds
 *   mp4         the board and its animatic (motion.mp4): each panel held its shot's length, the line under it
 *   blender     the board and the scene as a Blender film pack (`blender/`): each actor minted, minutes
 * The tool never launches Blender: the answer names the command that builds the pack where one is found.
 */
export async function forgeScreenplay({ title, subject, shot, exportFormat, tagRef = null }) {
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { StashRepository } = await import('@/lib/db/repositories/stashes');
  const { OpsTagRepository } = await import('@/lib/db/repositories/ops-tags');
  const { outcomeDirFor, outcomeUrlFor } = await import('@/lib/outcomes-paths');
  const { randomUUID } = await import('node:crypto');
  if (!title || typeof title !== 'string') throw new Error('title is required');
  const extraSubject = Object.keys(subject).filter((k) => k !== 'screenplay');
  if (extraSubject.length) throw new Error(`subject.screenplay is a family of its own (not with ${extraSubject.join(', ')}); a set under the scene is to come (${MANUAL})`);
  const form = exportFormat ?? 'storyboard';
  if (!SCREENPLAY_EXPORTS.includes(form)) throw new Error(`a screenplay is forged to export: 'storyboard' (the board, the default), 'mp4' (the board and its animatic) or 'blender' (the film; not '${form}'; ${MANUAL})`);
  const S = shot ?? {};
  if (S.motion !== undefined && S.motion !== 'coverage') throw new Error(`a screenplay is shot by its coverage: shot: { motion: 'coverage' } (not '${S.motion}'; ${MANUAL})`);
  const P = S.params ?? {};
  const extra = Object.keys(P).filter((k) => !SCREENPLAY_PARAMS.includes(k));
  if (extra.length) throw new Error(`a screenplay's shot.params are ${SCREENPLAY_PARAMS.join(', ')} (not ${extra.join(', ')}; ${MANUAL})`);
  const look = P.look ?? 'film';
  if (!LOOKS.includes(look)) throw new Error(`shot.params.look: ${LOOKS.join(' | ')}`);
  const fps = S.fps ?? 24;
  const getRow = (r) => SketchRepository.getByRef(r);
  // (refused before anything is written: the script, the cast and its refs, the set, the recordings)
  const prep = await prepareScreenplay(subject.screenplay, { getRow });
  const plan = planSceneFilm(prep.screenplay, { getRow, style: P.style ?? null, grain: P.grain ?? null, set: prep.set });
  prep.advice.push(...await setAdvice(plan, prep.set));

  const ref = `mo_${randomUUID().replace(/-/g, '').slice(0, 12)}`, dir = outcomeDirFor(ref), filmDir = path.join(dir, 'blender');
  const { board, mp4, sound } = await writeStoryboard({ dir, plan, title, fps, animatic: form === 'mp4', screenplay: prep.screenplay, set: prep.set });
  const film = form === 'blender' ? await writeSceneFilm({
    outDir: filmDir, screenplay: subject.screenplay, getRow, title: packTitle(title), style: P.style ?? null,
    grain: P.grain ?? null, grade: P.grade ?? null, fps, hero: P.hero ?? null, prepared: prep, render: P.render ?? null,
  }) : null;
  const recipe = {
    motion_ref: ref, title, subject: { screenplay: prep.kept },
    shot: { motion: 'coverage', params: P, fps }, export: form,
    meta: { motion: 'coverage', fps, frames: Math.round(board.screen * fps), durationSec: board.screen, createdAt: Math.floor(Date.now() / 1000) },
  };
  writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(recipe, null, 2));

  const tag = tagRef ? OpsTagRepository.getByRef(tagRef) : OpsTagRepository.forge({
    title: `Motion: ${title}`,
    descriptorMd: `A motion project. A screenplay acted by its cast and shot by its coverage: its storyboard${mp4 ? ' and animatic' : ''}${film ? ' and its Blender film pack' : ''} at ${ref}. Members: the recipe stash and the motion.`,
  });
  if (!tag) throw new Error(`tag_ref '${tagRef}' not found`);
  const stash = StashRepository.mint({ title: `Motion: ${title}` });
  for (const w of Object.keys(plan.S.actors)) {
    const C = subject.screenplay.cast[w] ?? {}, member = C.persona ?? (typeof C.hero === 'string' ? C.hero : null);
    if (member) StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', title: `${w} — ${title}`, metadata: { sketch_ref: member, label: `${title} · ${w}` } });
  }
  StashRepository.gather({ stashRef: stash.stashRef, type: 'script', title: 'shot recipe — coverage', body: JSON.stringify(recipe, null, 2), metadata: { language: 'js' } });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'stash', memberRef: stash.stashRef });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'motion', memberRef: ref });

  const url = outcomeUrlFor(ref);
  const notes = plan.notes.map((n) => ({ id: n.id, ...(n.at !== undefined ? { at: n.at } : {}), says: n.says, try: n.try }));
  return {
    ok: true,
    motion_ref: ref,
    tag_ref: tag.tagRef,
    stash_ref: stash.stashRef,
    url,
    seconds: plan.S.seconds,
    screen_seconds: board.screen,
    frames: recipe.meta.frames,
    storyboard: { page: `${url}index.html`, panels: board.panels.length, json: `${url}storyboard.json` },
    shots: board.panels.map((p) => ({ n: p.n, name: p.name, span: p.span, lens_mm: p.lens_mm, move: p.move, lines: p.lines.length, ...(p.notes.length ? { notes: p.notes.map((N) => N.id) } : {}) })),
    ...(mp4 ? { mp4_path: `${url}motion.mp4`, animatic: { seconds: mp4.durationSec ?? board.screen, bytes: mp4.bytes ?? null, ...(mp4.tracks ? { tracks: mp4.tracks } : {}) } } : {}),
    ...(sound ? { sound: {
      captions: `${url}${sound.captions}`,
      ...(sound.audio ? { voice: { track: `${url}${sound.audio}`, ...sound.voice } } : {}),
      ...(sound.dubs ? { dubs: Object.fromEntries(Object.entries(sound.dubs).map(([L, D]) => [L, { track: `${url}${D.audio}`, captions: `${url}${D.captions}`, lines: D.lines }])) } : {}),
    } } : {}),
    ...(prep.set ? { set: { ref: prep.set.ref, title: prep.set.title, kind: prep.set.kind, floor: prep.set.floor, places: prep.set.places, marks: Object.fromEntries(Object.entries(prep.screenplay.cast).map(([w, C]) => [w, C.mark])) } } : {}),
    ...(prep.advice.length || sound?.advice?.length ? { advice: [...prep.advice, ...(sound?.advice ?? [])] } : {}),
    notes,
    ...(film ? {
      actors: film.actors,
      blender: {
        dir: filmDir,
        files: film.files.length,
        scene_md: `${url}blender/SCENE.md`,
        look,
        command: `node scripts/export-scene-blender.mjs --build ${filmDir} --look ${look}`,
        render: 'then: <blender> -b film.blend --python film_render.py -- --preset draft (EEVEE) | final (Cycles)',
        note: 'Each actor a skinned GLB with its act and face take, the coverage\'s cameras cut at markers, the look built in Blender. Blender runs on the operator\'s machine; mojulo did not launch it.',
      },
    } : {}),
    message:
      `Screenplay ${film ? 'filmed' : 'boarded'}: ${Object.keys(plan.S.actors).length} actors, ${plan.S.seconds} s, ${board.panels.length} shots. The storyboard is at ${url}index.html (a panel a shot, drawn with stand-ins: approve the cut there before the film is made)`
      + (mp4 ? `; its animatic at ${url}motion.mp4${mp4.tracks ? ` (sound: ${mp4.tracks.audio.join(', ')})` : ''}` : '')
      + (prep.set ? `; on the set ${prep.set.title ?? prep.set.ref} (${prep.set.places} places to stand)` : '')
      + (sound?.voice ? `; ${sound.voice.lines} recorded line${sound.voice.lines === 1 ? '' : 's'} set the clock and the mouths` : '')
      + (sound?.dubs ? `; dubbed to picture in ${Object.keys(sound.dubs).join(', ')}` : '')
      + (film ? `; the Blender film pack at ${filmDir} (SCENE.md): build it with blender.command, render with film_render.py` : '; export \'blender\' makes the film from the same plan (each actor minted: minutes)')
      + `. ${notes.length ? `${notes.length} director's notes (notes): each says what to try in the script; none stops the film.` : 'No director\'s notes.'}`
      + (prep.advice.length || sound?.advice?.length ? ` Advice on the recordings (advice): ${[...prep.advice, ...(sound?.advice ?? [])].length}.` : '')
      + ` Filed under ops tag ${tag.tagRef}.`,
  };
}
