/**
 * SCENES — a level's directed moments: the camera taken from the player, the cast moved, lines said, and the camera
 * handed back. A scene starts as a cue does and plays its beats in order; while it plays the player's input is held,
 * letterbox bars show, a click (or the interact key) advances a line and holding it, or Esc, skips to the end.
 *
 *   play.scenes: [{ id,
 *     when:  a cue's when (cues.js): a happening, { start: true }, { on: '<event>' }, { enter: … }, …
 *     if?:   a condition or a list, all of which must hold when the happening comes, else the scene waits for the next:
 *            { flag: '<name>' } (set) | { not: '<name>' } (unset) | { chapter: '<id>' } (turned) | { var, gte|gt|lte|lt|eq|ne }
 *     sets?: ['<flag>', …]     flags the scene sets as it ends (with play.carry, written to the game store and carried
 *                              into the levels after, as chapters are)
 *     once?: false            (a scene plays the first time its happening comes and its conditions hold, unless false)
 *     names?: { <who>: '<name the box shows>' },
 *     beats: [
 *       { shot: { frame, on: [who], move?, side?, lerp?, cut? }, for?: s }   the camera directs (rules-basic `shot`):
 *                                                  frame: SHOT_FRAMES; on: the characters, or spots, it frames (a
 *                                                  lone spot is seen from where the pilot stands); `for` holds it
 *       { do: effect | [effect] }                  the cast and the world, as a cue's then (walk, spawn, say, set…)
 *       { until: a when }                          waits for a happening (a walk's arrive, a var, an event)
 *       { wait: s }                                waits that many seconds
 *       { line: { who, say?, expression? } }        the text box: the speaker's name, the line typed on; a click goes on
 *       { banter: { with: [a, b], lines: [{ who, say?, expression? }], frame?: 'over' | 'close' } }
 *                                                  two talk: the camera opens on both, then cuts to whoever speaks
 *     ] }]
 *
 * The words are a slot: a line without `say` shows its placeholder, `[Name: line n]`. Mojulo supplies the speaker, the
 * box, the camera and the pacing.
 *
 * Lowering: the scene's `when` becomes a cue emitting `scene:<id>`; each `do` a cue on `scene:<id>:<n>`; each `until` a
 * cue emitting `scene-heard:<id>:<n>`. The page's scene runner (scene-runner.js) hears the bus, fires the beats'
 * events, gives the camera its shots (the cast ops `shot` / `unshot`) and draws the box; at the end it fires
 * `scene-end:<id>`, so a cue can follow on.
 *
 *   readScenes(play)       → [{ id, when, once, beats }] or throws, teaching
 *   sceneCues(play)        → the cues the scenes lower to (cues.js reads them as its own)
 *   withSceneCues(play)    → play with those cues appended (the same object without scenes)
 *   sceneProgram(play)     → what the runner plays: [{ id, once, if?, beats: [{ kind: shot | fire | until | wait | line }] }]
 *   sceneBus(play)         → the bus rows beside the cues: a var per flag (flag-<name>), set when it is set here or
 *                            carried in
 *   sceneContract(game, play) → the level contract with the carry rows (game.on flag:<name> → setFlag, game.flags for
 *                            the game channel to push what is held); the same object when the play does not carry
 *
 * Carried flags arrive after the page starts (the shell's params), so in a level that carries, a scene on
 * { start: true } waits for `flags-ready`, which the game channel pushes once the held flags are on the bus.
 */
import { readEffect, effectContext } from './cues.js';

export const SHOT_FRAMES = Object.freeze({
  wide: 'the place and everyone in it',
  low: 'from below, looking up at them',
  profile: 'side on',
  corner: 'from high in a corner',
  overhead: 'from above',
  two: 'two in one frame, across the line between them',
  close: 'a face',
  over: 'over one shoulder at the other (the first is framed, the second is the shoulder)',
});
export const SHOT_MOVES = Object.freeze({ hold: 'stands where it cut, turning with them', track: 'keeps its place beside them', push: 'closes in over the shot', orbit: 'circles them' });
export const SCENE_BEATS = Object.freeze({
  shot: 'the camera directs: { frame, on: [who], move? }, for? s',
  do: 'the cast and the world, as a cue\'s then',
  until: 'waits for a happening (a cue\'s when)',
  wait: 'waits seconds',
  line: 'the text box: { who, say?, expression? }, a click goes on',
  banter: 'two talk: { with: [a, b], lines: [{ who, say? }], frame? }',
});

const ID = /^[a-z][a-z0-9-]*$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`play.scenes${m}`);
const words = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 400;
const FLAG = /^[a-z][a-z0-9-]{0,47}$/;
const CMP = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne'];
export const flagVar = (name) => `flag-${name}`;
export const flagEvent = (name) => `flag:${name}`;
export const flagCarried = (name) => `flag-carried:${name}`;
export const FLAGS_READY = 'flags-ready';

// a condition, read: { var, op, n } over the bus vars
function readCond(c, at) {
  if (!isObj(c)) throw err(`${at} is { flag } | { not } | { chapter } | { var, gte|gt|lte|lt|eq|ne }`);
  const keys = Object.keys(c);
  if (c.flag !== undefined || c.not !== undefined) {
    const k = c.flag !== undefined ? 'flag' : 'not';
    if (keys.length !== 1 || !FLAG.test(c[k] ?? '')) throw err(`${at} is { ${k}: '<flag>' } (a lowercase name, met-mayor)`);
    return { var: flagVar(c[k]), op: k === 'flag' ? 'eq' : 'ne', n: 1, flag: c[k] };
  }
  if (c.chapter !== undefined) {
    if (keys.length !== 1 || !ID.test(c.chapter)) throw err(`${at} is { chapter: '<chapter id>' } (a chapter turned, here or carried in)`);
    return { var: `chapter-${c.chapter}`, op: 'eq', n: 1 };
  }
  if (typeof c.var === 'string' && c.var) {
    const ops = keys.filter((k) => CMP.includes(k));
    if (ops.length !== 1 || keys.length !== 2 || !Number.isFinite(c[ops[0]])) throw err(`${at} is { var, and one of ${CMP.join(', ')}: a number }`);
    return { var: c.var, op: ops[0], n: c[ops[0]] };
  }
  throw err(`${at} is { flag } | { not } | { chapter } | { var, gte|gt|lte|lt|eq|ne }`);
}

function readShot(s, at) {
  if (!isObj(s)) throw err(`${at}.shot is { frame, on: [who], move?, side?, lerp?, cut? }`);
  for (const k of Object.keys(s)) if (!['frame', 'on', 'move', 'side', 'lerp', 'cut', 'rate', 'fov', 'lookH'].includes(k)) throw err(`${at}.shot.${k} is not part of a shot (frame, on, move, side, lerp, cut, rate, fov, lookH)`);
  const frame = s.frame ?? 'wide';
  if (!SHOT_FRAMES[frame]) throw err(`${at}.shot.frame is one of ${Object.keys(SHOT_FRAMES).join(', ')}`);
  const on = typeof s.on === 'string' ? [s.on] : s.on;
  if (!Array.isArray(on) || !on.length || !on.every((w) => typeof w === 'string' && w)) throw err(`${at}.shot.on names who it frames: an entity id, or a list of them`);
  if (frame === 'over' && on.length !== 2) throw err(`${at}.shot: an over-the-shoulder frames two, [the one seen, the shoulder]`);
  if (s.move !== undefined && !SHOT_MOVES[s.move]) throw err(`${at}.shot.move is one of ${Object.keys(SHOT_MOVES).join(', ')}`);
  if (s.side !== undefined && s.side !== 1 && s.side !== -1) throw err(`${at}.shot.side is 1 or -1 (which side of the line the camera stands)`);
  for (const k of ['lerp', 'rate', 'fov', 'lookH']) if (s[k] !== undefined && !Number.isFinite(s[k])) throw err(`${at}.shot.${k} is a number`);
  if (s.cut !== undefined && typeof s.cut !== 'boolean') throw err(`${at}.shot.cut is true (a cut, the default) or false (eased in)`);
  return { ...s, frame, on };
}

function readLine(l, at) {
  if (!isObj(l)) throw err(`${at} is { who, say?, expression? }`);
  for (const k of Object.keys(l)) if (!['who', 'say', 'expression'].includes(k)) throw err(`${at}.${k} is not part of a line (who, say, expression)`);
  if (typeof l.who !== 'string' || !l.who) throw err(`${at}.who is the speaker's entity id`);
  if (l.say !== undefined && !words(l.say)) throw err(`${at}.say is the line, in words (leave it out for a placeholder)`);
  if (l.expression !== undefined && !(typeof l.expression === 'string' && ID.test(l.expression))) throw err(`${at}.expression is a word (smiling, worried…)`);
  return { who: l.who, ...(l.say !== undefined ? { say: l.say.trim() } : {}), ...(l.expression ? { expression: l.expression } : {}) };
}

function readBeat(b, at, ctx) {
  if (!isObj(b)) throw err(`${at} is one beat: ${Object.keys(SCENE_BEATS).map((k) => `{ ${k} }`).join(', ')}`);
  const kinds = Object.keys(b).filter((k) => SCENE_BEATS[k]);
  if (kinds.length !== 1) throw err(`${at} is one beat (${Object.keys(SCENE_BEATS).join(', ')}): it names ${kinds.length ? kinds.join(' and ') : Object.keys(b).join(', ') || 'none'}`);
  const kind = kinds[0];
  const extra = Object.keys(b).filter((k) => k !== kind && !(kind === 'shot' && k === 'for'));
  if (extra.length) throw err(`${at}.${extra[0]} is not part of a ${kind} beat`);
  if (kind === 'shot') {
    if (b.for !== undefined && !(Number.isFinite(b.for) && b.for > 0)) throw err(`${at}.for is seconds the shot holds before the next beat`);
    return { kind, shot: readShot(b.shot, at), ...(b.for ? { for: b.for } : {}) };
  }
  if (kind === 'do') {
    const list = Array.isArray(b.do) ? b.do : [b.do];
    if (!list.length) throw err(`${at}.do is an effect, or a list of them (a cue's then)`);
    list.forEach((t, i) => readEffect(t, `play.scenes${at}.do[${i}]`, ctx));
    return { kind, do: list };
  }
  if (kind === 'until') {
    if (!isObj(b.until)) throw err(`${at}.until is a cue's when: { arrive: 'who' }, { on: '<event>' }, { var, gte }…`);
    return { kind, until: b.until };
  }
  if (kind === 'wait') {
    if (!(Number.isFinite(b.wait) && b.wait > 0 && b.wait <= 120)) throw err(`${at}.wait is seconds, more than 0 and at most 120`);
    return { kind, wait: b.wait };
  }
  if (kind === 'line') return { kind, line: readLine(b.line, `${at}.line`) };
  const B = b.banter;
  if (!isObj(B)) throw err(`${at}.banter is { with: [a, b], lines: [{ who, say? }], frame? }`);
  for (const k of Object.keys(B)) if (!['with', 'lines', 'frame'].includes(k)) throw err(`${at}.banter.${k} is not part of a banter (with, lines, frame)`);
  if (!Array.isArray(B.with) || B.with.length !== 2 || !B.with.every((w) => typeof w === 'string' && w) || B.with[0] === B.with[1]) throw err(`${at}.banter.with is the two who talk: [a, b]`);
  if (B.frame !== undefined && !['over', 'close'].includes(B.frame)) throw err(`${at}.banter.frame is 'over' (over the listener's shoulder, the default) or 'close'`);
  if (!Array.isArray(B.lines) || !B.lines.length) throw err(`${at}.banter.lines is the exchange: [{ who, say? }, …]`);
  const lines = B.lines.map((l, i) => readLine(l, `${at}.banter.lines[${i}]`));
  for (const [i, l] of lines.entries()) if (!B.with.includes(l.who)) throw err(`${at}.banter.lines[${i}].who '${l.who}' is not one of the two talking (${B.with.join(', ')})`);
  return { kind, banter: { with: [...B.with], lines, frame: B.frame ?? 'over' } };
}

/** The scenes, read: [{ id, when, once, names, beats }], or throws a message that teaches. */
export function readScenes(play) {
  const S = play && play.scenes;
  if (S === undefined) return [];
  if (!Array.isArray(S)) throw err(' is a list of { id, when, beats, once?, names? }');
  const seen = new Set(), ctx = effectContext(play);
  return S.map((s, i) => {
    const at = `[${i}]`;
    if (!isObj(s)) throw err(`${at} is { id, when, beats, once?, names? }`);
    for (const k of Object.keys(s)) if (!['id', 'when', 'beats', 'once', 'names', 'if', 'sets'].includes(k)) throw err(`${at}.${k} is not part of a scene (id, when, beats, if, sets, once, names)`);
    if (typeof s.id !== 'string' || !ID.test(s.id)) throw err(`${at}.id is a lowercase id ("arrival", "the-mayor")`);
    if (seen.has(s.id)) throw err(`${at}.id '${s.id}' appears twice`);
    seen.add(s.id);
    if (!isObj(s.when)) throw err(`${at}.when is a cue's when: { start: true }, { enter: '<zone>' }, { on: '<event>' }…`);
    if (s.once !== undefined && typeof s.once !== 'boolean') throw err(`${at}.once is true (the default: the first time only) or false`);
    if (s.names !== undefined && !(isObj(s.names) && Object.values(s.names).every(words))) throw err(`${at}.names is { <who>: '<name the box shows>' }`);
    if (!Array.isArray(s.beats) || !s.beats.length) throw err(`${at}.beats is the scene, in order: ${Object.keys(SCENE_BEATS).join(', ')}`);
    const beats = s.beats.map((b, j) => readBeat(b, `${at}.beats[${j}]`, ctx));
    const conds = s.if === undefined ? [] : (Array.isArray(s.if) ? s.if : [s.if]).map((c, j) => readCond(c, `${at}.if${Array.isArray(s.if) ? `[${j}]` : ''}`));
    if (s.sets !== undefined && !(Array.isArray(s.sets) && s.sets.every((x) => FLAG.test(x ?? '')))) throw err(`${at}.sets is a list of flags the scene sets as it ends (lowercase names: ['met-mayor'])`);
    return { id: s.id, when: s.when, once: s.once !== false, names: { ...(s.names || {}) }, beats, if: conds, sets: [...(s.sets || [])] };
  });
}

/** Every flag the scenes read or set. */
export function sceneFlags(play) {
  const out = new Set();
  for (const sc of readScenes(play)) { for (const c of sc.if) if (c.flag) out.add(c.flag); for (const f of sc.sets) out.add(f); }
  return [...out].sort();
}
// does the level carry flags in, so that its start scenes must wait for them?
const carries = (play) => !!(play && typeof play.carry === 'string' && play.carry && sceneFlags(play).length);

const nameOf = (names, who) => names[who] || who.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** The cues the scenes lower to: each scene's start, each `do` beat, each `until`. */
export function sceneCues(play) {
  const cues = [], wait = carries(play);
  for (const sc of readScenes(play)) {
    // the happening always reaches the runner: `once` and `if` are the runner's, so a scene whose conditions failed can
    // play when its happening comes again
    const when = wait && sc.when && sc.when.start === true ? { on: FLAGS_READY } : sc.when;
    cues.push({ id: `scene-${sc.id}`, when, then: { emit: `scene:${sc.id}` } });
    if (sc.sets.length) cues.push({ id: `scene-${sc.id}-sets`, when: { on: `scene-end:${sc.id}` }, then: sc.sets.map((f) => ({ emit: flagEvent(f) })) });
    sc.beats.forEach((b, n) => {
      if (b.kind === 'do') cues.push({ id: `scene-${sc.id}-do-${n}`, when: { on: `scene:${sc.id}:${n}` }, then: b.do });
      if (b.kind === 'until') cues.push({ id: `scene-${sc.id}-until-${n}`, when: b.until, then: { emit: `scene-heard:${sc.id}:${n}` } });
    });
  }
  return cues;
}

export function withSceneCues(play) {
  if (!play || play.scenes === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...sceneCues(play)] };
}

/** What the page's runner plays: each scene's beats flattened (a banter into its shots and lines), placeholders filled. */
export function sceneProgram(play) {
  // a spot named in a shot is a point the camera frames (its z, or the ground under it on the page)
  const spots = new Map(((play && play.spots) || []).filter((p) => p && typeof p.id === 'string' && Array.isArray(p.at)).map((p) => [p.id, p.at]));
  const place = (shot) => {
    const at = shot.on.filter((w) => spots.has(w)).map((w) => spots.get(w));
    if (!at.length) return shot;
    const on = shot.on.filter((w) => !spots.has(w));
    return { ...shot, on, at };
  };
  return readScenes(play).map((sc) => {
    const beats = [];
    let said = 0;
    const line = (l) => { said++; beats.push({ kind: 'line', who: l.who, name: nameOf(sc.names, l.who), text: l.say ?? `[${nameOf(sc.names, l.who)}: line ${said}]`, ...(l.expression ? { expression: l.expression } : {}) }); };
    sc.beats.forEach((b, n) => {
      if (b.kind === 'shot') beats.push({ kind: 'shot', shot: place(b.shot), ...(b.for ? { for: b.for } : {}) });
      else if (b.kind === 'do') beats.push({ kind: 'fire', event: `scene:${sc.id}:${n}` });
      else if (b.kind === 'until') beats.push({ kind: 'until', event: `scene-heard:${sc.id}:${n}` });
      else if (b.kind === 'wait') beats.push({ kind: 'wait', wait: b.wait });
      else if (b.kind === 'line') line(b.line);
      else {
        const [a, c] = b.banter.with;
        beats.push({ kind: 'shot', shot: { frame: 'two', on: [a, c] } });
        b.banter.lines.forEach((l, i) => {
          const other = l.who === a ? c : a;
          // the opening line plays over the two-shot; after it, the camera cuts to whoever speaks
          if (i > 0) beats.push({ kind: 'shot', shot: b.banter.frame === 'close' ? { frame: 'close', on: [l.who] } : { frame: 'over', on: [l.who, other] } });
          line(l);
        });
      }
    });
    return { id: sc.id, once: sc.once, ...(sc.if.length ? { if: sc.if.map(({ var: v, op, n }) => ({ var: v, op, n })) } : {}), beats };
  });
}

/** The flags' bus rows: a var each, set when the flag is set here (`flag:<name>`) or carried in (`flag-carried:<name>`). */
export function sceneBus(play) {
  if (!play || play.scenes === undefined) return null;
  const flags = sceneFlags(play);
  if (!flags.length) return null;
  const vars = {}, reactions = [];
  for (const f of flags) {
    vars[flagVar(f)] = 0;
    reactions.push({ on: flagEvent(f), do: 'set', var: flagVar(f), to: 1 }, { on: flagCarried(f), do: 'set', var: flagVar(f), to: 1 });
  }
  return { vars, reactions };
}

/** The level contract with the scenes' carry rows: each flag set here written to the carry slice, the flags held pushed
 *  in at start. The same object when the play does not carry, or its scenes use no flags. */
export function sceneContract(game, play) {
  if (!game || typeof game !== 'object' || !carries(play)) return game;
  const slice = play.carry, flags = sceneFlags(play), sets = new Set(readScenes(play).flatMap((sc) => sc.sets));
  const produces = isObj(game.produces) ? game.produces : {};
  const events = Array.isArray(produces.events) ? produces.events : [];
  const consumes = Array.isArray(game.consumes) ? game.consumes : [];
  const on = { ...(game.on || {}) };
  for (const f of sets) on[flagEvent(f)] = { emit: { type: 'setFlag', slice, key: f, value: true } };
  return {
    ...game,
    produces: { ...produces, events: events.some((e) => e && e.type === 'setFlag' && e.slice === slice) ? events : [...events, { type: 'setFlag', slice }] },
    on,
    consumes: consumes.some((c) => c && c.slice === slice) ? consumes : [...consumes, { slice }],
    flags: { slice, names: flags },
  };
}
