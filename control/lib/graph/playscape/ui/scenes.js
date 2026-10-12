/**
 * SCENES — a level's directed moments: the camera taken from the player, the cast moved, lines said, and the camera
 * handed back. A scene starts as a cue does and plays its beats in order; while it plays the player's input is held,
 * letterbox bars show, a click (or the interact key) advances a line and holding it, or Esc, skips to the end.
 *
 *   play.scenes: [{ id,
 *     when:  a cue's when (cues.js): a happening, { start: true }, { on: '<event>' }, { enter: … }, …
 *     once?: false            (a scene plays the first time only, unless once: false)
 *     names?: { <who>: '<name the box shows>' },
 *     beats: [
 *       { shot: { frame, on: [who], move?, side?, lerp?, cut? }, for?: s }   the camera directs (rules-basic `shot`):
 *                                                  frame: SHOT_FRAMES; on: the entities it frames; `for` holds it
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
 *   sceneProgram(play)     → what the runner plays: [{ id, beats: [{ kind: shot | fire | until | wait | line, … }] }]
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
    for (const k of Object.keys(s)) if (!['id', 'when', 'beats', 'once', 'names'].includes(k)) throw err(`${at}.${k} is not part of a scene (id, when, beats, once, names)`);
    if (typeof s.id !== 'string' || !ID.test(s.id)) throw err(`${at}.id is a lowercase id ("arrival", "the-mayor")`);
    if (seen.has(s.id)) throw err(`${at}.id '${s.id}' appears twice`);
    seen.add(s.id);
    if (!isObj(s.when)) throw err(`${at}.when is a cue's when: { start: true }, { enter: '<zone>' }, { on: '<event>' }…`);
    if (s.once !== undefined && typeof s.once !== 'boolean') throw err(`${at}.once is true (the default: the first time only) or false`);
    if (s.names !== undefined && !(isObj(s.names) && Object.values(s.names).every(words))) throw err(`${at}.names is { <who>: '<name the box shows>' }`);
    if (!Array.isArray(s.beats) || !s.beats.length) throw err(`${at}.beats is the scene, in order: ${Object.keys(SCENE_BEATS).join(', ')}`);
    const beats = s.beats.map((b, j) => readBeat(b, `${at}.beats[${j}]`, ctx));
    return { id: s.id, when: s.when, once: s.once !== false, names: { ...(s.names || {}) }, beats };
  });
}

const nameOf = (names, who) => names[who] || who.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** The cues the scenes lower to: each scene's start, each `do` beat, each `until`. */
export function sceneCues(play) {
  const cues = [];
  for (const sc of readScenes(play)) {
    cues.push({ id: `scene-${sc.id}`, when: sc.when, ...(sc.once ? { once: true } : {}), then: { emit: `scene:${sc.id}` } });
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
  return readScenes(play).map((sc) => {
    const beats = [];
    let said = 0;
    const line = (l) => { said++; beats.push({ kind: 'line', who: l.who, name: nameOf(sc.names, l.who), text: l.say ?? `[${nameOf(sc.names, l.who)}: line ${said}]`, ...(l.expression ? { expression: l.expression } : {}) }); };
    sc.beats.forEach((b, n) => {
      if (b.kind === 'shot') beats.push({ kind: 'shot', shot: b.shot, ...(b.for ? { for: b.for } : {}) });
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
    return { id: sc.id, beats };
  });
}
