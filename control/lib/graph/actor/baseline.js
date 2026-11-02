/**
 * baseline — what the actor is measured against: one hero, one speech for one speaker and one short scene for two, and
 * what the PERSONA alone makes of them today (persona/), before any actor exists. Every phase of the actor reads the same
 * three; the persona's outputs for them are pinned (persona/persona.char.test.js), so a change the actor makes to the
 * persona's path shows as a moved pin, not a surprise.
 *
 *   BASELINE.hero   the hero spec the dailies mint (a realistic gen-7 head, the one a persona's face is drawn on)
 *   BASELINE.solo   { register, script }: one speaker, two paragraphs, a stress, a pause and an aside
 *   BASELINE.scene  { cast: { <who>: { register } }, lines: [{ who, line }] }: a two-hander, each line a turn
 *
 *   sceneReads(scene, { style? }) → { seconds, actors: { <who>: { register, read, speaks: [[at, end]], listens: [[at, end]] } } }
 *     the scene as the persona alone can play it (every actor in `style` where one is given, interpret.js): each speaker reads its own lines in its register, the partner's
 *     turns held as pauses of the partner's length, so every actor's read is on the scene's one clock. The persona has
 *     no partner to look at and no listening: while the other speaks it holds its register's look (the lens). That is
 *     the gap the actor fills, measured by readings.js.
 *
 * The fixtures are frozen: the pins rest on them. A new case is a new fixture beside these, never an edit.
 * Pure and deterministic.
 */
import { READ_PAD } from '../persona/read.js';
import { actRead } from './interpret.js';
import { deliveryOf } from '../persona/delivery.js';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

export const BASELINE = freeze({
  hero: { form: 'realistic', cast: 'female', face: { seed: 11, ethnicity: 'western' }, target: { resolution: '1080p', framing: 'close' } },
  solo: {
    register: 'speech',
    script: `I used to think the harbour was the edge of the world. Every boat that left it fell off the end, and every boat that came back had climbed up again.

My father fixed the ones that climbed. [pause] He never asked where they had been. (He didn't have to.) He could read it in the hull, the way you read a *face*.`,
  },
  scene: {
    cast: { mara: { register: 'briefing' }, jon: { register: 'documentary' } },
    lines: [
      { who: 'mara', line: 'You kept the *key*.' },
      { who: 'jon', line: 'I kept everything. [pause] That was the trouble.' },
      { who: 'mara', line: 'Three years, Jon. Not one letter.' },
      { who: 'jon', line: 'I wrote them. (Every week.) I just never sent them.' },
      { who: 'mara', line: 'Then send one *now*.' },
    ],
  },
});

const r3 = (v) => Math.round(v * 1000) / 1000;

/** how long a turn holds the scene's clock: its words read in its speaker's register (and style), and the gap after it */
function turnSeconds(line, register, style) {
  const R = actRead({ script: line, register, ...(style !== undefined ? { style } : {}) });
  return r3(R.lines.at(-1).end - READ_PAD.lead + deliveryOf(register).gap.sentence);
}

/** The scene as the persona alone plays it: each speaker's read on the scene's clock (see the header) */
export function sceneReads(scene, { style } = {}) {
  const cast = Object.keys(scene.cast);
  for (const L of scene.lines) if (!cast.includes(L.who)) throw new Error(`baseline: '${L.who}' speaks but is not in the cast (${cast.join(', ')})`);
  const turns = scene.lines.map((L) => ({ who: L.who, line: L.line, seconds: turnSeconds(L.line, scene.cast[L.who].register, style) }));
  const actors = {};
  for (const who of cast) {
    if (!turns.some((T) => T.who === who)) continue;   // (a cast member with no line has no read: the extra the actor adds)
    const script = turns.map((T) => (T.who === who ? T.line : `[pause ${T.seconds}]`)).join(' ');
    const read = actRead({ script, register: scene.cast[who].register, ...(style !== undefined ? { style } : {}) });
    actors[who] = { register: read.register, read };
  }
  // (who speaks when: each actor's own lines; who listens when: everyone else's)
  for (const [who, A] of Object.entries(actors)) A.speaks = A.read.lines.map((L) => [L.at, L.end]);
  for (const [who, A] of Object.entries(actors)) A.listens = Object.entries(actors).filter(([w]) => w !== who).flatMap(([, B]) => B.speaks).sort((a, b) => a[0] - b[0]);
  return { seconds: Math.max(...Object.values(actors).map((A) => A.read.seconds)), actors };
}
