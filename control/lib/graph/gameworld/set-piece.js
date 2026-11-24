/**
 * set-piece — a SET PIECE: an insane run or stunt the player plays through while the camera is directed like a film,
 * with a quick-time prompt at the beats a body cannot do on the stick alone. One recipe of data, lowered onto what the
 * runtime already has: the chase line (worlds/controllable/chase-line.js: the stick read along it, its own track camera,
 * its marks), the prompts (worlds/controllable/prompt.js) and the level's cues (playscape/ui/cues.js: a beat is a cue on
 * a mark, its effects the world's own verbs: collapse, blast, spawn, shake, explode…).
 *
 *   setPiece: { id, line: [[x, y], …], half?, z?, pace?,
 *     cams:    [{ at, frame, …dials, cut?, blend?, fov?, shake? }]   where along the line the camera takes each frame
 *     beats:   [{ at, id?, do: effect | [effect] }]                   what happens as the hero passes `at` (metres along)
 *     prompts: [{ at, id?, kind?, button?, says?, lead?, window?, count?, hold?, dir?, slow?, miss?, hurt?, then? }]
 *              a prompt brought up as the hero passes `at`; `then` the effects of a hit; a miss puts the hero back
 *              `back` metres before it (6), on the line, to run at it again
 *     pursuers: [{ id?, figure?, gap?, catch?, pace?, speed?, back? }]   who chases the hero down the line (chase-line.js):
 *              stood behind its start, each the level's figure it names or a stand-in; caught, the hero is put back
 *   }
 *
 *   lowerSetPiece(sp) → { chase, prompts, cues, tempo?, entities?, figures? }   the level's keys: its chase line (with
 *                        its marks, its camera and its pursuers), its prompts, its cues, the world clock's moments its
 *                        slowed prompts ask for, and the pursuers' bodies to stand (a stand-in's figure where none is named)
 *   setPieceLaws(sp)  → [{ law, ok, says }]               advice, never a refusal (docs/set-pieces.md):
 *     on the line   every key, beat and prompt stands on it
 *     directed      the camera keyed from the start, in more than one frame
 *     few           a prompt each SET_PIECE.few metres at most: the run carries the set piece, a prompt the beat it cannot
 *     readable      each prompt far enough on from the last to be read at the hero's pace (its lead and window run at
 *                   `pace`, and a breath between)
 *
 * Pure.
 */
import { readChase, readTrackKeys } from '../worlds/controllable/chase-line.js';
import { readPrompts } from '../worlds/controllable/prompt.js';
// (the stand-in's parts straight from their homes: practice-room.js would loop back through the levels that import this)
import { FIGURE_LIBRARY } from './stage-figures.js';
import { playerStates } from '../playscape/player.js';
const standIn = () => ({ hero: { cast: 'female' }, library: FIGURE_LIBRARY, clips: { ...playerStates([], FIGURE_LIBRARY), forward: 'Walk_Loop' } });

export const SET_PIECE = Object.freeze({ few: 15, breath: 3, back: 6, pace: 7.2 });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100;

// the line's length, and the point `s` metres along it
function along(path) {
  const segs = [];
  let len = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, s0: len }); len += l;
  }
  const at = (s) => {
    const g = segs.find((x) => s <= x.s0 + x.l) || segs[segs.length - 1], u = g.l > 0 ? Math.max(0, Math.min(1, (s - g.s0) / g.l)) : 0;
    return [r2(g.a[0] + (g.b[0] - g.a[0]) * u), r2(g.a[1] + (g.b[1] - g.a[1]) * u)];
  };
  return { len, at };
}

/** A set piece, read (throws naming what it takes; the line and the prompts by their own readers). */
export function readSetPiece(raw) {
  if (!isObj(raw)) throw new Error('setPiece: { id, line, cams, beats?, prompts? }');
  if (typeof raw.id !== 'string' || !/^[a-z0-9-]+$/.test(raw.id)) throw new Error('setPiece: an id of lower-case words and hyphens');
  readChase({ lines: [{ id: raw.id, path: raw.line, ...(raw.half != null ? { half: raw.half } : {}) }] });
  const cams = Array.isArray(raw.cams) && raw.cams.length ? raw.cams : null;
  if (!cams) throw new Error('setPiece: cams, where along the line the camera takes each frame');
  readTrackKeys(cams.map(({ at, ...k }) => ({ s: at, ...k })), 'setPiece.cams');
  const beats = raw.beats ?? [], prompts = raw.prompts ?? [];
  if (!Array.isArray(beats) || !beats.every((b) => isObj(b) && Number.isFinite(b.at) && b.do)) throw new Error('setPiece.beats: [{ at, do: effect | [effect] }]');
  if (!Array.isArray(prompts) || !prompts.every((p) => isObj(p) && Number.isFinite(p.at))) throw new Error('setPiece.prompts: [{ at, kind?, button?, says?, … }]');
  readPrompts(prompts.map((p, i) => promptOf(raw, p, i)));
  return raw;
}

const promptId = (sp, p, i) => p.id ?? `${sp.id}-${i + 1}`;
function promptOf(sp, p, i) {
  const { at: _a, then: _t, back: _b, ...P } = p;
  return { ...P, id: promptId(sp, p, i) };
}

/** A set piece lowered onto the level's keys (see the header). */
export function lowerSetPiece(raw) {
  const sp = readSetPiece(raw), L = along(sp.line), z = Number.isFinite(sp.z) ? sp.z : 0;
  const beats = (sp.beats ?? []).map((b, i) => ({ ...b, mark: b.id ?? `beat-${i + 1}` }));
  const prompts = (sp.prompts ?? []).map((p, i) => ({ ...p, pid: promptId(sp, p, i) }));
  const marks = [...beats.map((b) => ({ at: b.at, id: b.mark })), ...prompts.map((p) => ({ at: p.at, id: `prompt-${p.pid}` }))];
  const chasers = (sp.pursuers ?? []).map((q, i) => ({ ...q, id: q.id ?? `${sp.id}-pursuer-${i + 1}` }));
  const line = { id: sp.id, path: sp.line, ...(sp.half != null ? { half: sp.half } : {}), marks, cams: sp.cams.map(({ at, ...k }) => ({ s: at, ...k })),
    ...(chasers.length ? { pursuers: chasers.map(({ figure: _f, ...q }) => q) } : {}) };
  const chase = readChase({ lines: [line] });
  const P = readPrompts(prompts.map((p, i) => {
    const own = promptOf(sp, p, i);
    // a miss puts the hero back on the line before it, to run at it again
    if ((own.miss ?? 'checkpoint') === 'checkpoint') { const back = L.at(Math.max(0, p.at - (p.back ?? SET_PIECE.back))); own.back = [back[0], back[1], z]; }
    return own;
  }));
  const on = (mark) => `chase:${sp.id}:${mark}`;
  const cues = [
    ...beats.map((b) => ({ id: `${sp.id}-${b.mark}`, when: { on: on(b.mark) }, then: b.do })),
    ...prompts.map((p) => ({ id: `${sp.id}-prompt-${p.pid}`, when: { on: on(`prompt-${p.pid}`) }, then: { prompt: p.pid } })),
    ...prompts.filter((p) => p.then).map((p) => ({ id: `${sp.id}-hit-${p.pid}`, when: { on: `prompt:${p.pid}:hit` }, then: p.then })),
  ];
  const slowed = P.filter((p) => p.slow != null);
  // the pursuers' bodies, stood behind the line's start, facing down it; a stand-in figure where the set piece names none
  const y0 = Math.atan2(sp.line[1][1] - sp.line[0][1], sp.line[1][0] - sp.line[0][0]);
  const entities = chasers.map((q, i) => {
    const back = (q.gap ?? 7) + i * 1.5, side = (i % 2 ? -1 : 1) * 0.8;
    return { id: q.id, rule: { type: 'static', eye: 0 }, body: { type: 'figure-rig', figure: q.figure ?? 'set-piece-pursuer', hittable: false },
      transform: { pos: [r2(sp.line[0][0] - Math.cos(y0) * back - Math.sin(y0) * side), r2(sp.line[0][1] - Math.sin(y0) * back + Math.cos(y0) * side), z], heading: y0 } };
  });
  if (chasers.length) cues.push({ id: `${sp.id}-caught`, when: { on: `chase:${sp.id}:caught` }, then: { say: 'Caught', as: 'toast' } });
  return {
    chase, prompts: P, cues,
    ...(entities.length ? { entities, ...(chasers.some((q) => !q.figure) ? { figures: { 'set-piece-pursuer': standIn() } } : {}) } : {}),
    ...(slowed.length ? { tempo: { moments: slowed.map((p) => ({ on: `prompt:${p.id}`, scale: p.slow, hold: r2(p.lead + p.window + 0.4), ramp: 0.12 })) } } : {}),
  };
}

/** The set piece's laws, as advice (see the header). */
export function setPieceLaws(raw) {
  const sp = readSetPiece(raw), L = along(sp.line), pace = sp.pace ?? SET_PIECE.pace;
  const P = readPrompts((sp.prompts ?? []).map((p, i) => promptOf(sp, p, i))).map((p, i) => ({ ...p, at: sp.prompts[i].at })).sort((a, b) => a.at - b.at);
  const ats = [...sp.cams.map((k) => ['camera key', k.at]), ...(sp.beats ?? []).map((b) => ['beat', b.at]), ...P.map((p) => [`prompt ${p.id}`, p.at])];
  const off = ats.filter(([, a]) => a < 0 || a > L.len + 1e-6);
  const frames = new Set(sp.cams.map((k) => k.frame)), first = Math.min(...sp.cams.map((k) => k.at));
  const crowded = P.filter((p, i) => i > 0 && p.at - P[i - 1].at < SET_PIECE.few);
  const rushed = P.filter((p, i) => i > 0 && p.at - P[i - 1].at < (P[i - 1].lead + P[i - 1].window) * pace + SET_PIECE.breath);
  return [
    { law: 'on the line', ok: off.length === 0, says: off.length ? `${off.map(([w, a]) => `the ${w} at ${a} m`).join(', ')} past the line's ${r2(L.len)} m` : `every key, beat and prompt stands on the line's ${r2(L.len)} m` },
    { law: 'directed', ok: first <= 1e-6 && frames.size > 1, says: first > 1e-6 ? `the camera is first keyed at ${first} m: key it from the start` : frames.size > 1 ? `the camera takes ${frames.size} frames along it` : 'the camera keeps one frame: a set piece is directed, key a second' },
    { law: 'few', ok: crowded.length === 0, says: crowded.length ? `${crowded.map((p) => p.id).join(', ')} within ${SET_PIECE.few} m of the one before: let the run carry it` : `${P.length} prompt${P.length === 1 ? '' : 's'}, none within ${SET_PIECE.few} m of another` },
    { law: 'readable', ok: rushed.length === 0, says: rushed.length ? `${rushed.map((p) => p.id).join(', ')} comes before the one before it is over at ${pace} m/s` : `each prompt is over before the next comes, at ${pace} m/s` },
  ];
}
