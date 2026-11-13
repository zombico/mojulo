/**
 * scene — actors in a SCENE: a screenplay (screenplay.js) played by its cast on one clock, in a set of marks. Each actor
 * is the persona's actor (interpret.js: a register, a style, a role); the scene adds what an actor alone cannot have: a
 * partner to speak to and listen to, a place to stand and to walk to, and a body that faces someone.
 *
 *   actScene({ cast, marks?, script, seed?, voice? }) → { seconds, beats, marks, time?, actors: { <who>: { register, style?, read,
 *     speaks, listens, root, walks } } }
 *     cast    { <who>: { register?, style?, role?, mark?, height? } } (who: the name the script writes, lower case)
 *     marks   { <name>: [x, y] } metres on the floor (+x right, +y away from the camera's first side); none named, the
 *             cast stands in a line facing each other, PAIR apart
 *     read    the actor's read (readScript's shape) on the scene's clock: its own lines spoken, every other beat a held
 *             silence; its face's beats as the scene plays them (below), its body's cues with its listening nods
 *     speaks / listens  [[at, end]] its own lines, and every other speaker's
 *     root    [{ t, x, y, yaw }] where it stands and which way it faces (yaw degrees: 0 faces +y, 90 faces +x), eased
 *     walks   [{ start, end, from, to, distance }] its crosses (body.js plays the walk cycle over them)
 *     time    the screenplay's slow motion and freezes as a time map's moments on the scene's clock (shoot/time.js:
 *             `{ span, speed }`, `{ at, hold }`), which the coverage carries onto its shots; they take no scene time.
 *             Absent when the script says none.
 *     voice   { <n>: a bound recording } the spoken lines recorded (n the line's number, 1 first, in script order; the
 *             door binds each WAV, face-acting/recordings.js bindLine: { recording, seconds, timing, phonemes?,
 *             words?, envelope?, text? }). A recorded line holds the clock its recording's length and the register's
 *             sentence gap; the actor's read of it is FITTED to the recording (its register's rate tuned until the
 *             read meets the recording's length; its words the alignment's where they match one to one), so the face,
 *             the gestures on its stresses and the listener's nods land on the recording, and the line's first beat
 *             speaks the recording (its mouth from the recording's phonemes). A recorded turn carries `recording`.
 *             Absent, the scene is as it was, byte for byte.
 *
 * THE CLOCK: the script's beats in order, each after the last. A line takes its read's time in its speaker's register
 * and style and the gap after it; a cross TURN to face the way, then the distance at WALK metres a second; a turn TURN;
 * a look LOOK; a wait its seconds.
 *
 * THE FACE IN A SCENE: no one reads to the lens. A speaker looks at whom it speaks to (the next line's speaker, else the
 * last, else the nearest); a listener looks at the speaker, in the listening state (perform.js), the held face its
 * role's; while someone crosses, the others watch them go; `looks at` holds until the actor's next line. A gaze is set
 * where its target is, from where the actor stands and the way it faces (yaw, pitch, the distance: perform.js `gaze`),
 * named `partner` where it is an actor. The style's glances away still happen.
 *
 * THE LISTENER'S BODY: a nod on the speaker's stressed words, as often as the style nods (none for a style that never
 * nods).
 *
 * Seeded, pure and deterministic.
 */
import { actRead } from './interpret.js';
import { parseScreenplay } from './screenplay.js';
const TIME_KINDS = ['slow', 'real', 'hold'];
import { styleOf } from './style.js';
import { READ_GAZE, READ_PAD } from '../persona/read.js';
import { deliveryOf } from '../persona/delivery.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

/** the clock's times (s) and speeds: a turn on the spot, a look, the walk's metres a second (the hero's walk, about
 * hero-gaits.js's), the default apart of two actors with no marks (m), an actor's eye height (m) */
export const TURN = 0.6, LOOK = 0.3, WALK = 1.05, PAIR = 1.4, EYES = 1.55;
/** a listener's nod: how long after the stressed word it starts, and the share of the style's stress gestures it nods */
export const NOD = Object.freeze({ after: 0.15, share: 0.5, plain: 0.3 });
/** while anyone crosses, the watchers' gaze is set again every so often (s) */
export const FOLLOW = 0.4;

const r3 = (v) => Math.round(v * 1000) / 1000;
const deg = (r) => (r * 180) / Math.PI;
const headingTo = (a, b) => deg(Math.atan2(b[0] - a[0], b[1] - a[1]));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const smooth = (u) => u * u * (3 - 2 * u);

/** where an actor stands and faces at s on its root's keys ([{ t, x, y, yaw }]): the place linear between keys, the
 * facing eased; before the first key the first, after the last the last */
export function placeOn(K, s) {
  if (s <= K[0].t) return K[0];
  for (let k = 1; k < K.length; k++) if (s <= K[k].t) { const a = K[k - 1], c = K[k], u = (s - a.t) / Math.max(1e-6, c.t - a.t), v = smooth(u), lin = u; return { x: a.x + (c.x - a.x) * lin, y: a.y + (c.y - a.y) * lin, yaw: a.yaw + wrap(c.yaw - a.yaw) * v }; }
  return K.at(-1);
}

/** the cast's marks: the set's, else a line along x, PAIR apart, centred */
function marksOf(scene) {
  if (scene.marks && Object.keys(scene.marks).length) return scene.marks;
  const names = Object.keys(scene.cast), n = names.length;
  return Object.fromEntries(names.map((w, i) => [`${w}-mark`, [r3((i - (n - 1) / 2) * PAIR), 0]]));
}

/** how long a line holds the clock: its words in its speaker's register and style, and the gap after */
function lineSeconds(text, C) {
  const R = actRead({ script: text, register: C.register ?? 'anchor', ...(C.style ? { style: C.style } : {}), ...(C.role ? { role: C.role } : {}) });
  return { speak: r3(R.lines.at(-1).end - READ_PAD.lead), hold: r3(R.lines.at(-1).end - READ_PAD.lead + deliveryOf(R.register).gap.sentence) };
}

/** how long a recorded line holds the clock: its recording, and the gap after in its speaker's register and style */
function recordedSeconds(text, C, rec) {
  const R = actRead({ script: text, register: C.register ?? 'anchor', ...(C.style ? { style: C.style } : {}), ...(C.role ? { role: C.role } : {}) });
  return { speak: r3(rec.seconds), hold: r3(rec.seconds + deliveryOf(R.register).gap.sentence) };
}

/** a read's speaking length: its last line's end, less the read's lead */
const spokenOf = (R) => (R.lines.length ? R.lines.at(-1).end - READ_PAD.lead : 0);

/** a recorded line read alone, FITTED to its recording: its register's rate tuned (twice) until the read's length meets the
 * recording's (the script's [pause] marks left out: a recording has its own); its words, and each sentence's span, the
 * alignment's where the words match one to one (else the fitted read's) */
export function fittedRead(text, C, rec, seed = 1) {
  const reg = C.register ?? 'anchor', base = typeof reg === 'string' ? { from: reg } : { ...reg };
  // (the recording carries its own pauses: the script's [pause] marks are not read into it)
  const said = text.replace(/\[pause[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim() || text;
  const read = (rate) => actRead({ script: said, register: rate === null ? reg : { ...base, rate }, ...(C.style ? { style: C.style } : {}), ...(C.role ? { role: C.role } : {}), seed });
  let R = read(null), rate = deliveryOf(reg).rate;
  for (let k = 0; k < 2 && spokenOf(R) > 0 && rec.seconds > 0; k++) {
    rate = Math.min(2, Math.max(0.05, rate * (spokenOf(R) / rec.seconds)));
    R = read(r3(rate));
  }
  const aligned = Array.isArray(rec.words) ? rec.words : null, words = R.lines.flatMap((L) => L.words);
  if (aligned && aligned.length === words.length) {
    let k = 0;
    R = { ...R, lines: R.lines.map((L) => {
      const words = L.words.map((x) => { const A = aligned[k++]; return { ...x, t: r3(READ_PAD.lead + A.t), dur: r3(A.dur) }; });
      return words.length ? { ...L, at: words[0].t, end: r3(words.at(-1).t + words.at(-1).dur), words } : L;
    }) };
  }
  return R;
}

/** The scene played (see the header) */
export function actScene(scene) {
  const cast = scene.cast ?? {}, names = Object.keys(cast);
  if (names.length < 1) throw new Error('scene: a cast of one actor at least ({ <who>: { register?, style?, role?, mark? } })');
  const marks = marksOf(scene), beats = parseScreenplay(scene.script, { cast, marks });
  for (const [w, C] of Object.entries(cast)) if (C.mark !== undefined && !Object.hasOwn(marks, C.mark)) throw new Error(`scene: ${w}'s mark '${C.mark}' is not in the set (${Object.keys(marks).join(', ')})`);

  // ─── the blocking: where each stands to begin with, facing the nearest other ─────────────────────────────────────
  const at = {}, yaw = {};
  names.forEach((w, i) => { at[w] = [...(marks[cast[w].mark] ?? marks[`${w}-mark`] ?? Object.values(marks)[i % Object.keys(marks).length])]; });
  const nearest = (w, p = at[w]) => names.filter((o) => o !== w).sort((a, b) => Math.hypot(at[a][0] - p[0], at[a][1] - p[1]) - Math.hypot(at[b][0] - p[0], at[b][1] - p[1]))[0];
  for (const w of names) { const o = nearest(w); yaw[w] = o ? r3(headingTo(at[w], at[o])) : 0; }
  const root = Object.fromEntries(names.map((w) => [w, [{ t: 0, x: at[w][0], y: at[w][1], yaw: yaw[w] }]])), walks = Object.fromEntries(names.map((w) => [w, []]));
  const turnTo = (w, t, y, dur) => { root[w].push({ t: r3(t), x: at[w][0], y: at[w][1], yaw: yaw[w] }); yaw[w] = r3(yaw[w] + wrap(y - yaw[w])); root[w].push({ t: r3(t + dur), x: at[w][0], y: at[w][1], yaw: yaw[w] }); };

  // ─── the clock: each beat after the last ───────────────────────────────────────────────────────────────────────────
  const turns = [], moves = [], looks = [], time = [];
  let t = READ_PAD.lead, slow = null, ln = 0;
  const voice = scene.voice ?? null;
  beats.forEach((b, i) => {
    if (b.kind === 'line') {
      ln += 1;
      const rec = voice ? voice[ln] ?? voice[String(ln)] ?? null : null;
      const S = rec ? recordedSeconds(b.text, cast[b.who], rec) : lineSeconds(b.text, cast[b.who]);
      turns.push({ who: b.who, text: b.text, at: r3(t), end: r3(t + S.speak), hold: S.hold, ...(b.face ? { face: b.face } : {}), ...(rec ? { recording: rec.recording, line: ln } : {}), i });
      t += S.hold;
    } else if (b.kind === 'cross') {
      const to = marks[b.to.mark], from = [...at[b.who]], d = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (d > 1e-3) {
        turnTo(b.who, t, headingTo(from, to), TURN);
        const start = t + TURN, end = start + d / WALK;
        at[b.who] = [...to];
        root[b.who].push({ t: r3(end), x: to[0], y: to[1], yaw: yaw[b.who] });
        walks[b.who].push({ start: r3(start), end: r3(end), from, to: [...to], distance: r3(d) });
        moves.push({ who: b.who, start: r3(t), end: r3(end) });
        t = end;
      }
    } else if (b.kind === 'turn') {
      const p = b.to.actor ? at[b.to.actor] : marks[b.to.mark];
      turnTo(b.who, t, headingTo(at[b.who], p), TURN); t += TURN;
    } else if (b.kind === 'look') { looks.push({ who: b.who, at: r3(t), to: b.to }); t += LOOK; }
    else if (b.kind === 'wait') t += b.seconds;
    // (the screen's clock: a slowed stretch from where it is said to where real time comes back; a freeze at its instant)
    else if (b.kind === 'slow') { if (slow && t > slow.at) time.push({ span: [r3(slow.at), r3(t)], speed: slow.speed }); slow = { at: t, speed: b.speed }; }
    else if (b.kind === 'real') { if (slow && t > slow.at) time.push({ span: [r3(slow.at), r3(t)], speed: slow.speed }); slow = null; }
    else if (b.kind === 'hold') time.push({ at: r3(t), hold: b.seconds });
  });
  // (the scene ends its tail after its last line's words, or after its last direction)
  const last = beats.filter((b) => !TIME_KINDS.includes(b.kind)).at(-1);
  const seconds = r3((last.kind === 'line' ? turns.at(-1).end : t) + READ_PAD.tail);
  if (slow && seconds > slow.at) time.push({ span: [r3(slow.at), seconds], speed: slow.speed });

  // ─── where each stands and faces at a time (the root's eased keys) ─────────────────────────────────────────────────
  const placeAt = (w, s) => placeOn(root[w], s);
  /** the gaze from `w` at s to a point: yaw off its facing (+ its right), pitch, the distance */
  const gazeTo = (w, s, p, h = EYES, extra = {}) => {
    const P = placeAt(w, s), dx = p[0] - P.x, dy = p[1] - P.y, d = Math.max(0.3, Math.hypot(dx, dy));
    const eyes = (cast[w].height ?? EYES / 0.93) * 0.93;
    return { yaw: r3(Math.max(-80, Math.min(80, wrap(headingTo([P.x, P.y], p) - P.yaw)))), pitch: r3(deg(Math.atan2(h - eyes, d))), distance: r3(d), ...extra };
  };
  const eyesOf = (o) => (cast[o].height ?? EYES / 0.93) * 0.93;
  const actorGaze = (w, s, o) => { const P = placeAt(o, s); return gazeTo(w, s, [P.x, P.y], eyesOf(o), { partner: o }); };

  // whom w regards at s: whom it speaks to, the one who speaks, the one who crosses, what it was told to look at
  const turnAt = (s) => turns.find((T) => s >= T.at - 1e-6 && s < T.end);
  const addressee = (T) => { const nx = turns.find((x) => x.i > T.i && x.who !== T.who), pv = [...turns].reverse().find((x) => x.i < T.i && x.who !== T.who); return nx?.who ?? pv?.who ?? nearest(T.who); };
  const regard = (w, s) => {
    const T = turnAt(s), mv = moves.find((m) => m.who !== w && s >= m.start && s < m.end);
    const told = [...looks].reverse().find((l) => l.who === w && l.at <= s && !turns.some((x) => x.who === w && x.at > l.at && x.at <= s));
    if (T && T.who === w) return addressee(T);
    if (T) return T.who;
    if (mv) return mv.who;
    if (told) return told.to.actor ?? { mark: told.to.mark };
    return [...turns].reverse().find((x) => x.at <= s && x.who !== w)?.who ?? nearest(w);
  };
  const gazeOf = (w, s) => { const g = regard(w, s); return g === undefined ? undefined : typeof g === 'string' ? actorGaze(w, s, g) : gazeTo(w, s, marks[g.mark]); };

  // ─── each actor's read on the clock: its own lines, every other beat a silence of its length ───────────────────────
  const rnd = mulberry32(((scene.seed ?? 1) >>> 0) * 2654435761 >>> 0);
  const actors = {};
  for (const w of names) {
    const C = cast[w], parts = [];
    let cursor = READ_PAD.lead;
    for (const T of turns) {
      if (T.at > cursor + 1e-6) parts.push(`[pause ${r3(T.at - cursor)}]`);
      if (T.who === w) { parts.push(T.recording ? `[pause ${r3(T.hold)}]` : T.text); cursor = T.at + T.hold; }
      else { parts.push(`[pause ${r3(T.hold)}]`); cursor = T.at + T.hold; }
    }
    if (!turns.some((T) => T.who === w)) { actors[w] = silentActor(w, C, seconds, root[w], walks[w], gazeOf, turns); continue; }
    const vOf = (T) => voice[T.line] ?? voice[String(T.line)];
    // (every line of its recorded: no words left to read, so its read is the first line's fitted read with nothing spoken
    // but its opening, each recorded line then laid in)
    const allRecorded = turns.every((T) => T.who !== w || T.recording);
    let read;
    if (allRecorded) { const T0 = turns.find((T) => T.who === w), F0 = fittedRead(T0.text, C, vOf(T0), scene.seed ?? 1); read = { ...F0, lines: [], body: [], beats: F0.beats.filter((b) => b.at < READ_PAD.lead - 1e-6 && b.say === undefined) }; }
    else read = actRead({ script: parts.join(' '), register: C.register ?? 'anchor', ...(C.style ? { style: C.style } : {}), ...(C.role ? { role: C.role } : {}), seed: scene.seed ?? 1 });
    // (a recorded line: its placeholder's silence given over to its read, fitted to the recording, its first beat speaking it)
    for (const T of turns) if (T.who === w && T.recording) read = withRecorded(read, T, fittedRead(T.text, C, vOf(T), scene.seed ?? 1), vOf(T));
    const speaks = read.lines.map((L) => [L.at, L.end]), listens = turns.filter((T) => T.who !== w).map((T) => [T.at, T.end]);
    // (the face: each beat's gaze where the scene puts it, the style's glances kept; a listening beat at each other
    // speaker's line; the gaze set again while anyone crosses; a line's parenthetical face on its own words)
    const own = turns.filter((T) => T.who === w), says = read.beats.filter((b) => b.say !== undefined);
    const glance = (g) => g === READ_GAZE.away || g === READ_GAZE.notes;
    const beatsOut = read.beats.map((b) => {
      const L = says.indexOf(b), face = L >= 0 ? own[Math.min(L, own.length - 1)]?.face : undefined;
      const listening = listens.some(([a, e]) => b.at >= a - 1e-6 && b.at < e);
      return { ...b, ...(glance(b.gaze) ? {} : { gaze: gazeOf(w, b.at) }), ...(listening && b.say === undefined ? { state: 'listening' } : {}), ...(face ? { face } : {}) };
    });
    const base = (s) => [...beatsOut].reverse().find((b) => b.at <= s) ?? beatsOut[0];
    // (a held beat: the last one's face, carriage, emote and onset, nothing it did once: no line, flash or tell)
    const held = (s, extra) => { const B = base(s); return { at: r3(s), face: B.face, state: B.state, head: B.head, ...(B.emote ? { emote: B.emote } : {}), ...(B.onset ? { onset: B.onset } : {}), gaze: gazeOf(w, s), ...extra }; };
    // (a beat close to where another speaker starts is that start's: it listens from there)
    const inTurn = (s) => listens.some(([a, e]) => s >= a - 0.01 && s < e);
    for (const m of moves) for (let s = m.start; s < m.end; s += FOLLOW) if (!beatsOut.some((b) => Math.abs(b.at - s) < 0.01)) beatsOut.push(held(s, inTurn(s) ? { state: 'listening' } : {}));
    for (const [a] of listens) { const near = beatsOut.find((b) => Math.abs(b.at - a) < 0.01 && b.say === undefined); if (near) near.state = 'listening'; else beatsOut.push(held(a, { state: 'listening' })); }
    const clean = beatsOut.map((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined))).sort((x, y) => x.at - y.at);
    // (the listener's nods on the speaker's stresses)
    const S = C.style ? styleOf(C.style) : null, nods = S ? (S.gesture.vocab.includes('nod') ? S.gesture.stress * NOD.share : 0) : NOD.plain, body = [...read.body];
    if (nods > 0) for (const T of turns.filter((x) => x.who !== w)) for (const word of stressedWords(T, cast)) if (rnd() < nods) body.push({ t: r3(T.at + word + NOD.after), gesture: 'nod', cause: 'listen' });
    body.sort((x, y) => x.t - y.t);
    actors[w] = { register: read.register, ...(C.style ? { style: styleOf(C.style).name } : {}), read: { ...read, seconds, beats: clean, body }, speaks, listens, root: root[w], walks: walks[w] };
  }
  return { seconds, beats, marks, turns: turns.map(({ i: _i, ...T }) => T), ...(time.length ? { time: time.sort((x, y) => (x.at ?? x.span[0]) - (y.at ?? y.span[0]) || (x.at !== undefined ? -1 : 1)) } : {}), actors };
}

/** a speaker's stressed words' times into its line (s): its words read alone in its register and style */
function stressedWords(T, cast) {
  const C = cast[T.who], R = actRead({ script: T.text, register: C.register ?? 'anchor', ...(C.style ? { style: C.style } : {}) });
  // (a recorded line's stresses where its recording puts them: the natural read scaled to the recording's length)
  const k = T.recording && spokenOf(R) > 0 ? (T.end - T.at) / spokenOf(R) : 1;
  return R.lines.flatMap((L) => L.words.filter((x) => x.emph).map((x) => (x.t - READ_PAD.lead) * k));
}

/** the actor's read with a recorded turn's span given over to the line's fitted read (F), shifted onto the turn: its lines,
 * its beats (the placeholder's own dropped), its body's cues; the first speaking beat's say the recording, the others
 * silent (the recording speaks the whole line) */
function withRecorded(read, T, F, rec) {
  const off = T.at - READ_PAD.lead, a = T.at - 1e-6, e = T.at + T.hold - 1e-6;
  const inF = (s) => s >= READ_PAD.lead - 1e-6 && s < READ_PAD.lead + T.hold - 1e-6;
  const shift = (s) => r3(s + off);
  const lines = F.lines.map((L) => ({ ...L, at: shift(L.at), end: shift(L.end), words: L.words.map((x) => ({ ...x, t: shift(x.t) })) }));
  let first = true;
  const say = { text: rec.text ?? T.text, recording: rec.recording, seconds: rec.seconds, ...(rec.timing ? { timing: rec.timing } : {}), ...(rec.phonemes ? { phonemes: rec.phonemes } : {}), ...(rec.words ? { words: rec.words } : {}), ...(rec.envelope ? { envelope: rec.envelope } : {}) };
  const beats = F.beats.filter((b) => inF(b.at)).map((b) => {
    if (b.say === undefined) return { ...b, at: shift(b.at) };
    const { say: _s, ...rest } = b;
    if (first) { first = false; return { ...rest, at: r3(T.at), say }; }
    return { ...rest, at: shift(b.at) };
  });
  const body = F.body.filter((c) => inF(c.t)).map((c) => ({ ...c, t: shift(c.t) }));
  return {
    ...read,
    lines: [...read.lines, ...lines].sort((x, y) => x.at - y.at),
    beats: [...read.beats.filter((b) => b.at < a || b.at >= e), ...beats].sort((x, y) => x.at - y.at),
    body: [...read.body.filter((c) => c.t < a || c.t >= e), ...body].sort((x, y) => x.t - y.t),
  };
}

/** an actor with no line: a held read of the scene's length, listening throughout, watching */
function silentActor(w, C, seconds, root, walks, gazeOf, turns) {
  const listens = turns.map((T) => [T.at, T.end]), beats = [{ at: 0, face: C.role?.face ?? 'neutral', state: 'listening', gaze: gazeOf(w, 0), ...(C.role?.emote ? { emote: C.role.emote } : {}) }];
  for (const T of turns) beats.push({ ...beats[0], at: T.at, gaze: gazeOf(w, T.at) });
  return { register: C.register ?? 'anchor', ...(C.style ? { style: styleOf(C.style).name } : {}), read: { register: C.register ?? 'anchor', seconds, lines: [], beats, body: [], voice: {} }, speaks: [], listens, root, walks };
}
