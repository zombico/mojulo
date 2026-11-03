/**
 * notes — the DIRECTOR'S NOTES on a scene: what a director, a script supervisor or an editor would say after a read-through
 * of the blocking and the coverage (scene.js, coverage.js), each with the principle it rests on and a change to the script
 * that answers it. Advisory, as every gate here: a note suggests, it never refuses; a scene with none is not "good", only
 * free of these. The principles are in docs/cinematics.md.
 *
 *   directorsNotes(S, coverage) → [{ id, at?, who?, says, why, try }] in time order
 *
 *   long-take       a shot that holds more than LONG_TAKE seconds: an audience's attention wants a cut (the listener's
 *                   reaction, the reverse); break the line, or put a direction between
 *   back-turned     a speaker facing more than BACK_TURNED degrees off whom it speaks to: the head cannot carry the eyes
 *                   that far; turn it first
 *   line-flips      a cross that turns the actors' line by more than a right angle: the audience's map of the room flips
 *                   (the coverage keeps its side, but left and right trade); end the cross on the same side, or let the
 *                   wide re-establish it
 *   static          a scene longer than STATIC seconds where no one moves: give the turn of the scene a move
 *   distance        two speakers standing under CLOSE metres apart (crowding each other, no shoulder for an over) or over
 *                   FAR (a conversation across a room): set their marks a conversation apart
 *   no-close        a scene of more than CLOSE_LINES lines with no close-up: save one for the turn, a line with a face of
 *                   its own (a parenthetical)
 *   extra-speaks    a speaking part played as an extra, whose eyes stay off whoever speaks: give it a style that regards
 *                   its partner, unless it is meant to be background
 *   slowed-line     a line under slow motion or a freeze (the scene's time map, shoot/time.js): the voice is not slowed with
 *                   the picture, so mouth and words part; slow the move, the look or the silence, not the words
 *
 * Pure and deterministic.
 */
import { styleOf } from './style.js';

/** the notes' ids, in the order the header gives them (docs/cinematics.md names each; held by notes.test.js) */
export const NOTE_IDS = Object.freeze(['long-take', 'back-turned', 'line-flips', 'static', 'distance', 'no-close', 'extra-speaks', 'slowed-line']);
export const LONG_TAKE = 8, BACK_TURNED = 100, STATIC = 20, CLOSE = 0.7, FAR = 4, CLOSE_LINES = 4;
const r2 = (v) => Math.round(v * 100) / 100;
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const deg = (r) => (r * 180) / Math.PI;
const cap = (w) => w[0].toUpperCase() + w.slice(1);

/** The notes on a scene and its coverage (see the header) */
export function directorsNotes(S, coverage) {
  const notes = [], names = Object.keys(S.actors), smooth = (u) => u * u * (3 - 2 * u);
  const placeAt = (w, s) => { const K = S.actors[w].root; if (s <= K[0].t) return K[0]; for (let k = 1; k < K.length; k++) if (s <= K[k].t) { const a = K[k - 1], c = K[k], u = (s - a.t) / Math.max(1e-6, c.t - a.t); return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, yaw: a.yaw + wrap(c.yaw - a.yaw) * smooth(u) }; } return K.at(-1); };
  const turnsIn = (a, b) => S.turns.filter((T) => T.at < b && T.end > a);
  const addressee = (T) => { const i = S.turns.indexOf(T), nx = S.turns.slice(i + 1).find((x) => x.who !== T.who), pv = S.turns.slice(0, i).reverse().find((x) => x.who !== T.who); return nx?.who ?? pv?.who ?? names.find((w) => w !== T.who); };

  // long takes: a shot over dialogue held too long
  for (const s of coverage.shots) {
    const held = s.span[1] - s.span[0], lines = turnsIn(...s.span);
    if (held > LONG_TAKE && lines.length) notes.push({ id: 'long-take', at: r2(s.span[0]), says: `Shot ${s.name.split(' ')[0]} holds ${r2(held)} s on one framing.`, why: 'An audience reads a framing in a few seconds; after that a cut to the listener\'s reaction, or the reverse, keeps the scene alive (cut on the line, show who it lands on).', try: `Break ${cap(lines[0].who)}'s line with a beat of the listener: a direction between its sentences ("${cap(addressee(lines[0]) ?? lines[0].who)} looks at ${cap(lines[0].who)}."), or a short answer.` });
  }
  // back turned: a speaker facing away from whom it speaks to
  for (const T of S.turns) {
    const to = addressee(T); if (!to) continue;
    const P = placeAt(T.who, T.at), Q = placeAt(to, T.at), off = Math.abs(wrap(deg(Math.atan2(Q.x - P.x, Q.y - P.y)) - P.yaw));
    if (off > BACK_TURNED) notes.push({ id: 'back-turned', at: r2(T.at), who: T.who, says: `${cap(T.who)} speaks to ${cap(to)} facing ${Math.round(off)}° away.`, why: 'The eyes carry a line, and a head turns only so far: past a right angle the eyes cannot reach a partner behind, and the line plays to the wall.', try: `Turn ${cap(T.who)} first: "${cap(T.who)} turns to ${cap(to)}." before the line (or play it as a line said away, on purpose).` });
  }
  // the line flips across a cross
  if (names.length >= 2) {
    const lineAt = (s) => { const a = placeAt(names[0], s), b = placeAt(names[1], s); return Math.atan2(b.y - a.y, b.x - a.x); };
    for (const w of names) for (const x of S.actors[w].walks) {
      const turn = Math.abs(wrap(deg(lineAt(x.end) - lineAt(x.start))));
      if (turn > 90) notes.push({ id: 'line-flips', at: r2(x.start), who: w, says: `${cap(w)}'s cross turns the actors' line by ${Math.round(turn)}°.`, why: 'The audience holds a map of the room from the first wide; a move that carries an actor across the line trades left and right, and the cuts after it read as a jump (the 180° rule).', try: `End ${cap(w)}'s cross on the same side of ${cap(names.find((o) => o !== w))} (another mark), or keep it in the wide long enough to show the new picture.` });
    }
  }
  // a still scene
  const moved = names.some((w) => S.actors[w].root.length > 1);
  if (!moved && S.seconds > STATIC) notes.push({ id: 'static', says: `No one moves in ${r2(S.seconds)} s.`, why: 'A move motivated by the scene (a thought turning, a decision made) gives the actors a new picture and the coverage a reason for its wide.', try: `On the line where the scene turns, move someone: "${cap(names[0])} crosses to <a mark>." (marks: ${Object.keys(S.marks).join(', ')}).` });
  // distance between speakers
  if (names.length >= 2) for (const T of S.turns) {
    const to = addressee(T); if (!to) continue;
    const P = placeAt(T.who, T.at), Q = placeAt(to, T.at), d = Math.hypot(Q.x - P.x, Q.y - P.y);
    if (d < CLOSE || d > FAR) { notes.push({ id: 'distance', at: r2(T.at), who: T.who, says: `${cap(T.who)} and ${cap(to)} stand ${r2(d)} m apart for a line.`, why: d < CLOSE ? 'Under arm\'s length the actors crowd each other and the over-the-shoulder has no shoulder to look past.' : 'Across a room a conversation becomes a call; the overs lose their listener and the eyelines go thin.', try: `Set their marks ${CLOSE * 2}–${FAR / 1.6} m apart, a conversation's distance.` }); break; }
  }
  // no close-up
  if (S.turns.length > CLOSE_LINES && !coverage.shots.some((s) => s.camera.startsWith('close-'))) notes.push({ id: 'no-close', says: `${S.turns.length} lines and no close-up.`, why: 'Coverage widens to establish and tightens to land: a close saved for the turn of the scene tells the audience which line matters.', try: 'Give the line that turns the scene a face of its own: "NAME (determined): …"; the coverage closes on it.' });
  // a speaking part played as an extra
  for (const w of names) {
    const st = S.actors[w].style;
    if (st && S.actors[w].speaks.length && styleOf(st).gaze.line && styleOf(st).gaze.line !== 'lens') notes.push({ id: 'extra-speaks', who: w, says: `${cap(w)} speaks but plays as ${st}: its eyes stay off whoever speaks.`, why: 'A partner\'s eyes are half of every line; a background player\'s wander on purpose.', try: `Give ${cap(w)} a style that regards its partner (thespian, action-star, anime-mocap), unless it is meant to be background.` });
  }
  // a line under the time map: slowed or held while it is spoken
  for (const T of S.turns) {
    const m = (S.time ?? []).find((x) => (x.span ? x.span[0] < T.end && x.span[1] > T.at : x.at > T.at && x.at < T.end));
    if (m) notes.push({ id: 'slowed-line', at: r2(T.at), who: T.who, says: `${cap(T.who)}'s line plays ${m.span ? `at ${m.speed} speed` : `through a ${m.hold} s freeze`}.`, why: 'Slow motion stretches the picture, not the voice: the words run at their own pace while the mouth crawls, or stop mid-word on a freeze. A film slows the action round a line (the move, the look, the silence after) and plays the line itself in real time.', try: m.span ? `Bring real time back before ${cap(T.who)} speaks ("Real time."), and start the slow motion after the line.` : `Freeze after ${cap(T.who)}'s line ends, on the look that answers it.` });
  }
  return notes.sort((a, b) => (a.at ?? -1) - (b.at ?? -1));
}
