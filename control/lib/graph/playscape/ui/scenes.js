/**
 * SCENES — a level's directed moments: the camera taken from the player, the cast moved, lines said, and the camera
 * handed back. A scene starts as a cue does and plays its beats in order; while it plays the player's input is held,
 * letterbox bars show, a click (or the interact key) advances a line and holding it, or Esc, skips to the end.
 *
 *   play.scenes: [{ id,
 *     when:  a cue's when (cues.js): a happening, { start: true }, { on: '<event>' }, { enter: … }, …
 *     if?:   a condition or a list, all of which must hold when the happening comes, else the scene waits for the next:
 *            { flag: '<name>' } (set) | { not: '<name>' } (unset) | { chapter: '<id>' } (turned) | { var, gte|gt|lte|lt|eq|ne }
 *            | { has: '<item>' } (held: carried in from the store's inventory, or picked up here)
 *            | { done: '<level>' } (that level completed in the campaign)
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
 *       { choose: { who?, say?, options: [{ say?, sets?: [flag], beats?: [beat] }] } }
 *                                                  the player answers: 2 to 4 options under the question (its own
 *                                                  line, or the last one said); the one picked sets its flags at once
 *                                                  and plays its beats, then the scene goes on
 *     ] }]
 *
 * The words are a slot: a line without `say` shows its placeholder, `[Name: line n]`; an option without one, `[Choice n]`. Mojulo supplies the speaker, the
 * box, the camera and the pacing.
 *
 * Lowering: the scene's `when` becomes a cue emitting `scene:<id>`; each `do` a cue on `scene:<id>:<n>`; each `until` a
 * cue emitting `scene-heard:<id>:<n>`. The page's scene runner (scene-runner.js) hears the bus, fires the beats'
 * events, gives the camera its shots (the cast ops `shot` / `unshot`) and draws the box; at the end it fires
 * `scene-end:<id>`, so a cue can follow on. A beat inside an option is keyed by its path, `<n>-<option>-<m>`.
 *
 *   readScenes(play)       → [{ id, when, once, beats }] or throws, teaching
 *   sceneCues(play)        → the cues the scenes lower to (cues.js reads them as its own)
 *   withSceneCues(play)    → play with those cues appended (the same object without scenes)
 *   sceneProgram(play)     → what the runner plays: [{ id, once, if?, beats: [{ kind: shot | fire | until | wait | line | choose | jump }] }]
 *   sceneBus(play)         → the bus rows beside the cues: a var per flag (flag-<name>), set when it is set here or
 *                            carried in (the quests' flags too: quests.js)
 *   sceneContract(game, play) → the level contract with the carry rows (game.on flag:<name> → setFlag, game.flags for
 *                            the game channel to push what is held); the same object when the play does not carry
 *
 * What is carried in: `play.carry` names the flags slice; `play.carryFrom: { items?: [inventory slices], campaign?:
 * '<progression slice>', levels?: { <name>: '<level ref>' } }` names where `has` and `done` read (levels maps a done's
 * name to the ref the campaign records; without it the name is the ref).
 *
 * Carried flags arrive after the page starts (the shell's params), so in a level that carries, a scene on
 * { start: true } waits for `flags-ready`, which the game channel pushes once the held flags are on the bus.
 */
import { readEffect, effectContext } from './cues.js';
import { questFlags } from './quests.js';

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
  choose: 'the player answers: { who?, say?, options: [{ say?, sets?, beats? }] } (2 to 4)',
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
  if (!isObj(c)) throw err(`${at} is { flag } | { not } | { has } | { done } | { chapter } | { var, gte|gt|lte|lt|eq|ne }`);
  const keys = Object.keys(c);
  if (c.flag !== undefined || c.not !== undefined) {
    const k = c.flag !== undefined ? 'flag' : 'not';
    if (keys.length !== 1 || !FLAG.test(c[k] ?? '')) throw err(`${at} is { ${k}: '<flag>' } (a lowercase name, met-mayor)`);
    return { var: flagVar(c[k]), op: k === 'flag' ? 'eq' : 'ne', n: 1, flag: c[k] };
  }
  if (c.has !== undefined || c.done !== undefined) {
    const k = c.has !== undefined ? 'has' : 'done';
    if (keys.length !== 1 || !(typeof c[k] === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(c[k]))) throw err(`${at} is { ${k}: '<${k === 'has' ? 'item' : 'level'}>' }`);
    return { var: `${k}-${c[k]}`, op: 'eq', n: 1, [k]: c[k] };
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
  throw err(`${at} is { flag } | { not } | { has } | { done } | { chapter } | { var, gte|gt|lte|lt|eq|ne }`);
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

function readChoose(C, at, ctx, depth) {
  if (!isObj(C)) throw err(`${at}.choose is { who?, say?, options: [{ say?, sets?, beats? }] }`);
  for (const k of Object.keys(C)) if (!['who', 'say', 'options'].includes(k)) throw err(`${at}.choose.${k} is not part of a choice (who, say, options)`);
  if (C.say !== undefined && (typeof C.who !== 'string' || !C.who)) throw err(`${at}.choose.who is who asks (its say is their question)`);
  const ask = C.who !== undefined ? readLine({ who: C.who, ...(C.say !== undefined ? { say: C.say } : {}) }, `${at}.choose`) : null;
  if (!Array.isArray(C.options) || C.options.length < 2 || C.options.length > 4) throw err(`${at}.choose.options is 2 to 4 answers: [{ say?, sets?, beats? }, …]`);
  if (depth > 2) throw err(`${at}.choose: choices nest at most three deep`);
  const options = C.options.map((o, k) => {
    const oat = `${at}.choose.options[${k}]`;
    if (!isObj(o)) throw err(`${oat} is { say?, sets?, beats? }`);
    for (const x of Object.keys(o)) if (!['say', 'sets', 'beats'].includes(x)) throw err(`${oat}.${x} is not part of an option (say, sets, beats)`);
    if (o.say !== undefined && !words(o.say)) throw err(`${oat}.say is the answer, in words (leave it out for a placeholder)`);
    if (o.sets !== undefined && !(Array.isArray(o.sets) && o.sets.every((x) => FLAG.test(x ?? '')))) throw err(`${oat}.sets is a list of flags the answer sets (lowercase names: ['took-the-job'])`);
    if (o.beats !== undefined && !(Array.isArray(o.beats) && o.beats.length)) throw err(`${oat}.beats is what follows the answer, in order (beats, as the scene's)`);
    const beats = (o.beats || []).map((b, j) => readBeat(b, `${oat}.beats[${j}]`, ctx, depth + 1));
    return { ...(o.say !== undefined ? { say: o.say.trim() } : {}), sets: [...(o.sets || [])], beats };
  });
  return { kind: 'choose', choose: { ...(ask ? { ask } : {}), options } };
}

function readBeat(b, at, ctx, depth = 0) {
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
  if (kind === 'choose') return readChoose(b.choose, at, ctx, depth);
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

// every beat of a scene with its key: `<n>` at the top, `<n>-<option>-<m>` inside a choice
function eachBeat(beats, fn, pre = '') {
  beats.forEach((b, n) => {
    const key = `${pre}${n}`;
    fn(b, key);
    if (b.kind === 'choose') b.choose.options.forEach((o, k) => eachBeat(o.beats, fn, `${key}-${k}-`));
  });
}
// the flags a scene sets: as it ends, and by the answers its choices take
function setsOf(sc) {
  const out = new Set(sc.sets);
  eachBeat(sc.beats, (b) => { if (b.kind === 'choose') for (const o of b.choose.options) for (const f of o.sets) out.add(f); });
  return [...out];
}

// a play with flags to keep: scenes, or quests (quests.js) whose steps are flags
const hasStory = (play) => !!play && (play.scenes !== undefined || play.quests !== undefined);

/** Every flag the scenes read or set, and the quests read. */
export function sceneFlags(play) {
  const out = new Set(questFlags(play));
  for (const sc of readScenes(play)) { for (const c of sc.if) if (c.flag) out.add(c.flag); for (const f of setsOf(sc)) out.add(f); }
  return [...out].sort();
}
/** What the scenes' conditions read of the store: { flags, items, done }. */
export function sceneNeeds(play) {
  const items = new Set(), done = new Set();
  for (const sc of readScenes(play)) for (const c of sc.if) { if (c.has) items.add(c.has); if (c.done) done.add(c.done); }
  return { flags: sceneFlags(play), items: [...items].sort(), done: [...done].sort() };
}
// what the level carries in for its scenes (empty parts left out), or null: its start scenes then need not wait
function carried(play) {
  if (!hasStory(play)) return null;
  const N = sceneNeeds(play), F = isObj(play.carryFrom) ? play.carryFrom : {};
  const out = {};
  if (typeof play.carry === 'string' && play.carry && N.flags.length) out.flags = { slice: play.carry, names: N.flags };
  if (Array.isArray(F.items) && F.items.length && N.items.length) out.items = { slices: [...F.items], names: N.items };
  if (typeof F.campaign === 'string' && F.campaign && N.done.length) out.done = { slice: F.campaign, levels: Object.fromEntries(N.done.map((d) => [d, (isObj(F.levels) && F.levels[d]) || d])) };
  return Object.keys(out).length ? out : null;
}
const carries = (play) => !!carried(play);

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
    eachBeat(sc.beats, (b, n) => {
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
    const lineOf = (l) => { said++; return { kind: 'line', who: l.who, name: nameOf(sc.names, l.who), text: l.say ?? `[${nameOf(sc.names, l.who)}: line ${said}]`, ...(l.expression ? { expression: l.expression } : {}) }; };
    const line = (l) => beats.push(lineOf(l));
    // flattened: a choice's options play inline after it, each ending in a jump past the rest
    const lay = (list, pre) => list.forEach((b, n) => {
      const key = `${pre}${n}`;
      if (b.kind === 'shot') beats.push({ kind: 'shot', shot: place(b.shot), ...(b.for ? { for: b.for } : {}) });
      else if (b.kind === 'do') beats.push({ kind: 'fire', event: `scene:${sc.id}:${key}` });
      else if (b.kind === 'until') beats.push({ kind: 'until', event: `scene-heard:${sc.id}:${key}` });
      else if (b.kind === 'wait') beats.push({ kind: 'wait', wait: b.wait });
      else if (b.kind === 'line') line(b.line);
      else if (b.kind === 'choose') {
        const C = b.choose;
        const ch = { kind: 'choose', ...(C.ask ? { ask: lineOf(C.ask) } : {}), options: C.options.map((o, k) => ({ text: o.say ?? `[Choice ${k + 1}]`, fire: o.sets.map(flagEvent), to: 0 })) };
        beats.push(ch);
        const jumps = [];
        C.options.forEach((o, k) => {
          ch.options[k].to = beats.length;
          lay(o.beats, `${key}-${k}-`);
          const j = { kind: 'jump', to: 0 };
          jumps.push(j); beats.push(j);
        });
        for (const j of jumps) j.to = beats.length;
      } else {
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
    lay(sc.beats, '');
    return { id: sc.id, once: sc.once, ...(sc.if.length ? { if: sc.if.map(({ var: v, op, n }) => ({ var: v, op, n })) } : {}), beats };
  });
}

/** The flags' bus rows: a var each, set when the flag is set here (`flag:<name>`) or carried in (`flag-carried:<name>`). */
export function sceneBus(play) {
  if (!hasStory(play)) return null;
  const { flags, items, done } = sceneNeeds(play);
  if (!flags.length && !items.length && !done.length) return null;
  const vars = {}, reactions = [];
  for (const f of flags) {
    vars[flagVar(f)] = 0;
    reactions.push({ on: flagEvent(f), do: 'set', var: flagVar(f), to: 1 }, { on: flagCarried(f), do: 'set', var: flagVar(f), to: 1 });
  }
  // an item held: carried in, or picked up here (a collect's pickup:<item>)
  for (const it of items) { vars[`has-${it}`] = 0; reactions.push({ on: `pickup:${it}`, do: 'set', var: `has-${it}`, to: 1 }, { on: `has-carried:${it}`, do: 'set', var: `has-${it}`, to: 1 }); }
  for (const d of done) { vars[`done-${d}`] = 0; reactions.push({ on: `done-carried:${d}`, do: 'set', var: `done-${d}`, to: 1 }); }
  return { vars, reactions };
}

/** The level contract with the scenes' carry rows: each flag set here written to the carry slice, the flags held pushed
 *  in at start. The same object when the play does not carry, or its scenes use no flags. */
export function sceneContract(game, play) {
  const C = game && typeof game === 'object' ? carried(play) : null;
  if (!C) return game;
  const consumes = Array.isArray(game.consumes) ? [...game.consumes] : [];
  const consume = (slice) => { if (!consumes.some((c) => c && c.slice === slice)) consumes.push({ slice }); };
  let out = { ...game };
  if (C.flags) {
    // what is set here: the scenes' sets and answers, and the quests' flags (a cue may set those: emit 'flag:<name>')
    const slice = C.flags.slice, sets = new Set([...readScenes(play).flatMap(setsOf), ...questFlags(play)]);
    const produces = isObj(game.produces) ? game.produces : {};
    const events = Array.isArray(produces.events) ? produces.events : [];
    const on = { ...(game.on || {}) };
    for (const f of sets) on[flagEvent(f)] = { emit: { type: 'setFlag', slice, key: f, value: true } };
    out = { ...out, produces: { ...produces, events: events.some((e) => e && e.type === 'setFlag' && e.slice === slice) ? events : [...events, { type: 'setFlag', slice }] }, on };
    consume(slice);
  }
  for (const s of C.items ? C.items.slices : []) consume(s);
  if (C.done) consume(C.done.slice);
  return { ...out, consumes, flags: { ...(C.flags ? C.flags : { names: [] }), ...(C.items ? { items: C.items } : {}), ...(C.done ? { done: C.done } : {}) } };
}
