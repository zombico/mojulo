/**
 * families/blades — a katana: drawn slowly from a wooden saya, carried sheathed at a walk, swung. Pure.
 *
 * Recreated from a layer-by-layer description: each layer's intent kept, mapped onto the gestures. Where the description
 * asked for what the gestures do not have, the layer is built from what they do:
 *   - noise colour (pink, brown): white noise through the layer's filter; under a band-pass or a low-pass the colour
 *     is the filter's.
 *   - a held noise with a slow attack, a sustain, a 6–9 Hz wobble and a band-pass rising across it (the steel scrape):
 *     a train of band-passed bursts, overlapping, one per wobble cycle, each a little higher and the train's level
 *     shaped by the envelope. The wobble is the train's own ripple.
 *   - a band-pass sweeping up and down over noise (the swing's whoosh): a riser to the peak, a downlifter from it.
 *   - a pitch going up then down (the edge whistle): two tones, one bend each.
 *   - Hz where a gesture takes note names (thump, a tone's bend): the nearest note.
 *   - "random" times and ±10 % variation: seeded from the recipe (`seed`), the same every render.
 *   - the room: a send on each layer (0.15); the space itself is the level's mix (an `open` space, or the 0.4 s one
 *     the renders use).
 *
 * `draw`, `carry` and `swing` are the described takes: a whole draw, five seconds of carrying, three swings. A game
 * fires its sounds on its own events, one at a time: `jostle` is one carried step's worth (for the gait channel) and
 * `cut` one swing (for the strike channel), its `take` a, b or c (the three swings' variations).
 */

// a small seeded generator: the variations and the scattered clinks, the same every render
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SEND = 0.15;
const r3 = (v) => Math.round(v * 1000) / 1000;

// CUE 1: the draw, about 3 s
function draw(seed) {
  const out = [];
  // the steel scrape: 2.2 s, a band-pass rising 2.5 → 6 kHz, a 0.15 s attack, a sustain, a 0.5 s decay, gain 0.45,
  // its level wobbling at 6 → 9 Hz (depth about 0.3): one overlapping burst per cycle
  for (let t = 0; t < 2.2;) {
    const u = t / 2.2, rate = 6 + 3 * u;
    const env = Math.min(1, t / 0.15) * Math.min(1, (2.2 - t) / 0.5);
    out.push({ type: 'burst', at: r3(t), decay: r3(1.6 / rate), vol: r3(0.45 * (0.35 + 0.65 * env)), bandpass: Math.round(2500 * Math.pow(6000 / 2500, u)), q: 1.4, send: SEND });
    t += 1 / rate;
  }
  // the saya's wood rasp: 2.4 s, low-passed at 900 Hz, softer and steadier (a denser, jittered train)
  const R = rng(seed(1));
  for (let t = 0; t < 2.4;) {
    const env = Math.min(1, t / 0.1) * Math.min(1, (2.4 - t) / 0.3);
    out.push({ type: 'burst', at: r3(t), decay: 0.12, vol: r3(0.3 * (0.4 + 0.6 * env) * (0.85 + 0.3 * R())), lowpass: 900, send: SEND });
    t += 0.07 * (0.75 + 0.5 * R());
  }
  // fine friction grit: 2–6 ms grains above 4 kHz from 0.1 s for 2 s, their density rising 40 → 90 a second
  [40, 57, 73, 90].forEach((d, i) => out.push({ type: 'grain', at: r3(0.1 + 0.5 * i), over: 0.5, grains: Math.round(d * 0.5), decay: [0.002, 0.006], band: { lo: 4000 }, vol: 0.2, spread: 0.5, seed: seed(2 + i), send: SEND }));
  // the blade clears the mouth: four partials, 3.1 / 4.7 / 6.9 / 9.3 kHz, ringing 0.9 / 0.7 / 0.5 / 0.35 s
  out.push({ type: 'ring', at: 1.9, hz: 3100, decay: 0.9, vol: 0.3, send: SEND, partials: [
    { ratio: 1, gain: 1, decay: 1 }, { ratio: r3(4700 / 3100), gain: 0.7, decay: r3(0.7 / 0.9) }, { ratio: r3(6900 / 3100), gain: 0.5, decay: r3(0.5 / 0.9) }, { ratio: r3(9300 / 3100), gain: 0.35, decay: r3(0.35 / 0.9) },
  ] });
  // a small wood knock as the saya lets go: 180 → 110 Hz over 0.08 s (F#3 → A2)
  out.push({ type: 'thump', at: 2.15, from: 'F#3', to: 'A2', decay: 0.13, vol: 0.2, send: SEND });
  // the air tail: above 5 kHz, 0.3 s
  out.push({ type: 'burst', at: 2.2, decay: 0.3, vol: 0.1, highpass: 5000, send: SEND });
  return out;
}

// one carried step: the footfall's knock, the saya and the floor answering, a little cloth
function step(t, vol, seed, i) {
  return [
    // 120 → 70 Hz over 0.06 s (B2 → C#2)
    { type: 'thump', at: r3(t), from: 'B2', to: 'C#2', decay: 0.1, vol: r3(vol), send: SEND },
    // wood partials 410 and 880 Hz, 0.12 s
    { type: 'ring', at: r3(t + 0.01), hz: 410, decay: 0.12, vol: 0.12, send: SEND, partials: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: r3(880 / 410), gain: 0.6, decay: 0.7 }] },
    // cloth, loosely with the step: 5–15 ms grains, 700–1800 Hz
    { type: 'grain', at: r3(Math.max(0, t - 0.05)), over: 0.2, grains: 5, decay: [0.005, 0.015], band: { lo: 700, hi: 1800 }, vol: 0.1, spread: 0.5, seed: seed(10 + i), send: SEND },
  ];
}
// the saya's creak: brown noise band-passed 300 → 500 Hz over 0.25 s (a riser through that band)
const creak = (t) => ({ type: 'riser', at: r3(t), dur: 0.25, from: 300, to: 500, q: 2.5, vol: 0.15, send: SEND });
// a faint tsuba clink: 3.8 and 6.2 kHz, 0.15 s
const clink = (t) => ({ type: 'ring', at: r3(t), hz: 3800, decay: 0.15, vol: 0.08, send: SEND, partials: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: r3(6200 / 3800), gain: 0.6, decay: 0.8 }] });

// CUE 2: carried for 5 s, six steps 0.75 s apart
function carry(seed) {
  const R = rng(seed(1)), out = [];
  [0.3, 1.05, 1.8, 2.55, 3.3, 4.05].forEach((t, i) => out.push(...step(t, 0.3 * (0.9 + 0.2 * R()), seed, i)));
  // the cloth between the steps (the rest of the 8 a second over 5 s)
  out.push({ type: 'grain', at: 0, over: 5, grains: 10, decay: [0.005, 0.015], band: { lo: 700, hi: 1800 }, vol: 0.1, spread: 0.5, seed: seed(2), send: SEND });
  for (const t of [0.28, 1.78, 3.28]) out.push(creak(t));
  // three clinks at seeded times between 0.8 and 4.5 s
  const times = [R(), R(), R()].map((u) => 0.8 + 3.7 * u).sort((a, b) => a - b);
  for (const t of times) out.push(clink(t));
  return out;
}

// one swing: a whoosh peaking 0.18 s in, an edge whistle 900 → 1800 → 700 Hz, an air thump at the end of the cut.
// `speed` scales its times (0.9 is 10 % faster), `gain` its levels.
function swing(t0, gain, speed, seedOf) {
  const s = speed, g = gain;
  return [
    // the whoosh: white noise band-passed 600 → 3500 Hz up to its peak, then 3500 → 900 Hz falling away
    { type: 'riser', at: r3(t0), dur: r3(0.18 * s), from: 600, to: 3500, q: 1.2, vol: r3(0.5 * g), seed: seedOf(1), send: SEND },
    { type: 'downlifter', at: r3(t0 + 0.18 * s), dur: r3(0.2 * s), from: 3500, to: 900, q: 1.2, vol: r3(0.5 * g), seed: seedOf(2), send: SEND },
    // the edge whistle: 900 → 1800 Hz (A6), then down to 700 Hz (F5)
    { type: 'tone', at: r3(t0), hz: 900, to: 'A6', dur: r3(0.15 * s), wave: 'sine', attack: 0.02, release: 0.01, vol: r3(0.08 * g), send: SEND },
    { type: 'tone', at: r3(t0 + 0.15 * s), hz: 1760, to: 'F5', dur: r3(0.15 * s), wave: 'sine', attack: 0.005, release: 0.04, vol: r3(0.08 * g), send: SEND },
    // the air thump where the cut ends: low-passed at 400 Hz
    { type: 'burst', at: r3(t0 + 0.2 * s), decay: r3(0.12 * s), vol: r3(0.15 * g), lowpass: 400, send: SEND },
  ];
}
const TAKES = { a: [1, 1], b: [1.1, 0.9], c: [1.2, 1.15] };   // gain ×, speed × (b 10 % faster, c 15 % slower)

export const katana = {
  label: 'a katana: drawn from its saya, carried at a walk, swung',
  dials: { act: ['draw', 'carry', 'swing', 'jostle', 'cut'], take: ['a', 'b', 'c'] },
  defaults: { act: 'cut', take: 'a' },
  // a recreation held to its description, to be compared with the recording it describes: not yet to the register
  // (its draw and swing fill fewer bands than the register asks; families.js `reference`)
  reference: true,
  ordered: [{ dial: 'take', values: ['a', 'c'], rises: ['ms'] }],
  build(d, seed) {
    switch (d.act) {
      case 'carry': return carry(seed);
      case 'swing': return [['a', 0.4], ['b', 2.2], ['c', 4.0]].flatMap(([k, t], i) => swing(t, TAKES[k][0], TAKES[k][1], (j) => seed(20 + 10 * i + j)));
      case 'jostle': return [...step(0, 0.3, seed, 0), creak(0), clink(0.12)];
      case 'cut': return swing(0, TAKES[d.take][0], TAKES[d.take][1], (j) => seed(20 + j));
      default: return draw(seed);
    }
  },
};
