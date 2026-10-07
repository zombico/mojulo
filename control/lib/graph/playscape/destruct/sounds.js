/**
 * sounds — the destruction primitives' sound, as CUES on a timeline, never audio itself. The World page's audio
 * channel plays named cues (`audio.cues: { name: [gestures] }`, beats-sfx gestures); the cut and the collapse only say
 * WHEN which cue fires, how loud and where:
 *
 *   cutSounds(fx, { sounds?, gain? })     → [{ t, cue, gain, mark, at? }]   from a slicing() result (it is attached
 *                                           there as `sounds`)
 *   collapseSounds(run, { sounds?, gain? }) → the same, from a collapse() run's `hits` and its parting
 *
 * A style names a cue per mark (CUT_STYLES[style].sounds); `sounds` on the call overrides any of them: a cue name, or
 * { cue, gain }, or false (silent). DESTRUCT_SFX is a valid beats-sfx manifest defining every default cue, so the
 * timeline plays as it is; a world that defines the same names in its own `audio.cues` re-voices it, and one that
 * maps a mark to its own cue injects it. Sparks are thinned (one cue a window), so a spray is a texture, not a roar.
 */

/** The default cues, as a beats-sfx manifest (gestures the beats kernel plays). */
export const DESTRUCT_SFX = Object.freeze({
  kind: 'beats-sfx',
  title: 'Playscape destruction foley',
  cues: {
    swish: [{ type: 'sweep', from: 'C6', to: 'C4' }, { type: 'grain' }],
    slice: [{ type: 'burst' }, { type: 'sweep', from: 'G6', to: 'D6' }],
    'laser-hum': [{ type: 'tone', note: 'A3' }, { type: 'sweep', from: 'A5', to: 'A5' }],
    sizzle: [{ type: 'grain' }, { type: 'burst' }],
    shing: [{ type: 'ring' }, { type: 'sweep', from: 'E6', to: 'B6' }],
    whoosh: [{ type: 'downlifter' }],
    crack: [{ type: 'impact' }, { type: 'burst' }],
    boom: [{ type: 'impact' }, { type: 'thump', from: 'C3', to: 'C1' }],
    chip: [{ type: 'burst' }],
    thud: [{ type: 'thump', from: 'G2', to: 'D1' }],
    clack: [{ type: 'thump', from: 'C5', to: 'G4' }],
    settle: [{ type: 'grain' }],
  },
});
export const DESTRUCT_CUE_IDS = Object.freeze(Object.keys(DESTRUCT_SFX.cues));

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const resolve = (map, mark) => {
  const v = map[mark];
  if (v === false || v == null) return null;
  return typeof v === 'string' ? { cue: v, gain: 1 } : { cue: v.cue, gain: v.gain ?? 1 };
};

/** The cut's cues: a stroke's mark when it starts, the one-shots (flash, ring) when they fire, sparks thinned. */
export function cutSounds(fx, styleSounds = {}, { sounds = {}, gain = 1, sparkWindow = 0.06 } = {}) {
  const map = { ...styleSounds, ...sounds }, out = [];
  const push = (mark, t, g = 1, at) => { const c = resolve(map, mark); if (c) out.push({ t: r5(t), cue: c.cue, gain: r5(Math.min(1, c.gain * g * gain)), mark, ...(at ? { at } : {}) }); };
  for (const e of fx.elements) {
    if (e.kind === 'blade' || e.kind === 'beam') push(e.kind, e.birth, 1, e.from || undefined);
    else if (e.kind === 'flash' || e.kind === 'ring') push(e.kind, e.birth, 1, e.at);
  }
  // the score sounds once per stroke as the cut starts across the skin (anime: once, when the beat breaks)
  const scores = fx.elements.filter((x) => x.kind === 'score');
  if (scores.length && fx.style === 'anime') push('score', Math.min(...scores.map((x) => x.birth)));
  else if (scores.length) for (const s of fx.strokes) push('score', s.birth, 0.7);
  // sparks: one cue a window, louder for a denser window
  const sparks = fx.elements.filter((x) => x.kind === 'spark').sort((a, b) => a.birth - b.birth);
  for (let i = 0; i < sparks.length;) {
    const t0 = sparks[i].birth; let n = 0;
    while (i < sparks.length && sparks[i].birth < t0 + sparkWindow) { n++; i++; }
    push('spark', t0, Math.min(1, 0.25 + 0.08 * n), sparks[i - 1].at);
  }
  const dust = fx.elements.filter((x) => x.kind === 'dust');
  if (dust.length) push('dust', Math.min(...dust.map((x) => x.birth)), 0.6);
  return out.sort((a, b) => a.t - b.t || a.cue.localeCompare(b.cue));
}

/** The collapse's cues: the parting (once), and each landing hit, heavy or light by the body's mass, loud by speed. */
export function collapseSounds(run, { sounds = {}, gain = 1, heavy = 0.004, parting = 'whoosh' } = {}) {
  const map = { part: parting, hit: 'thud', light: 'clack', rest: 'settle', ...sounds }, out = [];
  const push = (mark, t, g, at) => { const c = resolve(map, mark); if (c && g > 0.02) out.push({ t: r5(t), cue: c.cue, gain: r5(Math.min(1, c.gain * g * gain)), mark, ...(at ? { at } : {}) }); };
  if (run.parting != null) push('part', run.parting, 0.8);
  for (const h of run.hits || []) push(h.mass >= heavy ? 'hit' : 'light', h.t, Math.min(1, h.speed / 6), h.at);
  return out.sort((a, b) => a.t - b.t || a.cue.localeCompare(b.cue));
}
