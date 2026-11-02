/**
 * readings — the actor's machine gate: what a take measures, law by law. Every phase reads its takes here and the
 * dailies page shows the numbers beside each one. Advisory: a reading is a number and a note, never a refusal, and never
 * the eyes gate (whether it reads as acting is the operator's).
 *
 *   faceReadings(take)   the face as a capture measures it (perform.js's take): `energy` how much the face moves (the
 *                        summed speed of its action units, units a second), `level` how far it is from rest on average
 *                        (the summed units), the blinks, the saccades, the micro-expressions and the brow flashes a
 *                        minute, the tells, the head's travel (degrees a second)
 *   readReadings(read)   the read's delivery (persona/read.js): words a minute, the stressed words, the gaze's holds
 *                        (its targets' shares and the mean hold), the body's gestures (how many, a minute, by cause)
 *   laws({ read, take, listens? })   each law of the actor (the plan's seven) as { reads, note }: `reads` the
 *                        measure where this take carries what it measures, else null and `note` says why
 *
 * The laws: 1 overlap (the joints of a chain peak in order), 2 stroke on stress (a gesture's apex on or just before the
 * stressed word), 3 weight (an idle shifts it), 4 variation (no two uses of a gesture alike), 5 listening (a partner
 * regarded and a live face while the other speaks), 6 humanly possible (within the joints' ranges and speeds), 7 absent
 * adds nothing (the persona's own pins, persona.char.test.js). A body law reads null until the body plays (phase 2).
 *
 * Pure and deterministic.
 */
import { cueSheet } from '../persona/cues.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const perMin = (n, seconds) => r3((n * 60) / seconds);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** the frames of a take inside a set of intervals (s), or every frame */
const framesIn = (take, spans) => {
  const out = [];
  for (let i = 0; i < take.frames; i++) { const t = i / take.fps; if (!spans || spans.some(([a, b]) => t >= a && t < b)) out.push(i); }
  return out;
};

/** the face's motion over a set of frames: the summed speed of its units (a second) and their summed height */
function faceMotion(take, frames) {
  const curves = Object.values(take.curves);
  if (frames.length < 2 || !curves.length) return { energy: 0, level: 0 };
  let speed = 0, height = 0;
  for (const i of frames) {
    for (const c of curves) { height += c[i]; if (i > 0) speed += Math.abs(c[i] - c[i - 1]); }
  }
  return { energy: r3((speed * take.fps) / frames.length), level: r3(height / frames.length) };
}

/** the face as a capture measures it */
export function faceReadings(take) {
  const s = take.seconds, E = take.events ?? {}, M = faceMotion(take, framesIn(take));
  let travel = 0;
  for (const k of ['yaw', 'pitch', 'roll']) { const h = take.head?.[k] ?? []; for (let i = 1; i < h.length; i++) travel += Math.abs(h[i] - h[i - 1]); }
  return {
    seconds: s, energy: M.energy, level: M.level,
    blinks: perMin(E.blinks?.length ?? 0, s), saccades: perMin(E.saccades?.length ?? 0, s), micro: perMin(E.micro?.length ?? 0, s),
    flashes: perMin(E.flashes?.length ?? 0, s), tells: E.tells?.length ?? 0, headTravel: r3(travel / s),
  };
}

/** the read's delivery: its pace, its stresses, where it looks and for how long, the body's gestures */
export function readReadings(read) {
  const words = read.lines.flatMap((L) => L.words), spoken = read.lines.reduce((n, L) => n + (L.end - L.at), 0);
  const gaze = cueSheet('read', read).gaze, holds = gaze.map((g, i) => [g.target, (gaze[i + 1]?.t ?? read.seconds) - g.t]);
  const share = {};
  for (const [target, d] of holds) share[target] = (share[target] ?? 0) + d;
  for (const k of Object.keys(share)) share[k] = r3(share[k] / read.seconds);
  const byCause = {};
  for (const b of read.body) byCause[b.cause] = (byCause[b.cause] ?? 0) + 1;
  return {
    seconds: read.seconds, wordsPerMin: spoken ? r3((words.length * 60) / spoken) : 0, stressed: words.filter((w) => w.emph).length,
    gaze: { share, hold: r3(mean(holds.map(([, d]) => d))), shifts: Math.max(0, gaze.length - 1) },
    gestures: { count: read.body.length, perMin: perMin(read.body.length, read.seconds), byCause },
  };
}

/** law 2: each stressed-word gesture's lead on its word (s; + before the word). A cue is an instant in the read (no
 * apex yet): its time stands for the apex until the body plays */
function strokeLeads(read) {
  const stressedWords = read.lines.flatMap((L) => L.words.filter((w) => w.emph));
  return read.body.filter((b) => b.cause === 'stress').map((b) => {
    const w = stressedWords.reduce((best, x) => (Math.abs(x.t - b.t) < Math.abs(best.t - b.t) ? x : best), stressedWords[0]);
    return r3(w.t - b.t);
  });
}

/** law 5: while another speaks, how much of the time this actor regards a partner, and how live its face is beside its
 * own speaking */
function listeningOf(read, take, listens) {
  const span = listens.reduce((n, [a, b]) => n + (b - a), 0);
  // (the read's beats as held states: each from its time to the next)
  const held = read.beats.map((B, i) => ({ ...B, end: read.beats[i + 1]?.at ?? read.seconds }));
  let regard = 0, state = 0;
  for (const [a, b] of listens) for (const B of held) {
    const lo = Math.max(a, B.at), hi = Math.min(b, B.end);
    if (hi <= lo) continue;
    if (B.gaze === 'listener' || (B.gaze && typeof B.gaze === 'object' && B.gaze.partner)) regard += hi - lo;
    if (B.state === 'listening') state += hi - lo;
  }
  const speaks = read.lines.map((L) => [L.at, L.end]), listen = faceMotion(take, framesIn(take, listens)), talk = faceMotion(take, framesIn(take, speaks));
  return {
    seconds: r3(span), regard: span ? r3(regard / span) : 0, listeningState: span ? r3(state / span) : 0,
    energy: listen.energy, speakingEnergy: talk.energy, live: talk.energy ? r3(listen.energy / talk.energy) : 0,
  };
}

const NO_BODY = 'no body motion yet: the read\'s gestures are cues, played on no skinned body (phase 2)';

/** Each law's reading for one actor's take: { <law>: { reads, note } } */
export function laws({ read, take, listens = null }) {
  const leads = strokeLeads(read);
  return {
    overlap: { reads: null, note: NO_BODY },
    stroke: leads.length
      ? { reads: { gestures: leads.length, lead: { mean: r3(mean(leads)), min: Math.min(...leads), max: Math.max(...leads) } }, note: 'a cue\'s time stands for its apex: the body has no stroke yet, so the lead is where the cue sits on its word' }
      : { reads: null, note: 'no gesture on a stressed word' },
    weight: { reads: null, note: NO_BODY },
    variation: { reads: null, note: NO_BODY },
    listening: listens?.length
      ? { reads: listeningOf(read, take, listens), note: 'regard: the share of the partner\'s turns spent looking at a partner; live: the face\'s motion listening over its motion speaking' }
      : { reads: null, note: 'no partner: a solo read' },
    possible: { reads: null, note: NO_BODY },
    absent: { reads: null, note: 'held by the persona\'s byte pins (persona.char.test.js), not read on a take' },
  };
}

/** Everything one actor's take reads: its face, its delivery and its laws */
export function actorReadings({ read, take, listens = null }) {
  return { face: faceReadings(take), read: readReadings(read), laws: laws({ read, take, listens }) };
}
