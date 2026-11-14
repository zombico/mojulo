#!/usr/bin/env node
/**
 * Mouth foley's bake: the shelf's mouth sounds rendered by the local voice worker (Kokoro says a sound word, warp.py's
 * chain makes it a sound effect), traced into recipes (sfx-shelf/trace.js) and written to the generated
 * lib/graph/sfx-shelf/sets/mouth-traces.js. Kokoro is needed only here: the traces play and export without it.
 *
 *   node scripts/mouth-foley/bake.mjs [--check] [--all] [--trial] [--from <dir>] [--wav <dir>]
 *     --check       exit 1 when the page is stale, write nothing (needs the worker, or --from)
 *     --all         render the alternates too (approved takes no row voices yet): WAVs and the report only
 *     --trial       render only the takes awaiting the operator's ears (`trial`), and write nothing: with --wav, each
 *                   take as rendered and as the shelf would play it
 *     --from <dir>  trace <dir>/<id>.wav instead of rendering (no worker needed)
 *     --wav <dir>   write each original and its traced render side by side, to listen (<id>.wav, <id>--traced.wav)
 *
 * The worker is $MOJULO_VOICEGEN, else ~/mojulo-voicegen (install-local-voicegen.sh --ja). Without it, and without
 * --from, the bake says so and leaves the page as it is.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PAGE = resolve(HERE, '../../lib/graph/sfx-shelf/sets/mouth-traces.js');

/**
 * The recipes: a row id, the sound word, the voice, its speed, the chain (warp.py). `with` lays the trace under a
 * family's own cue, `db` under it, its loudest moment on the cue's (a hybrid). `alt` is an approved take no row voices
 * yet: rendered with --all, never written to the page.
 */
const r3 = (v) => Math.round(v * 1000) / 1000;

// a whip's crack: the N-wave's front edge and its back edge 1.8 ms on, each a few milliseconds of bright noise
const nwave = (at, peak = 1) => [{ type: 'burst', decay: 0.004, highpass: 1200, vol: 0.5, at, peak }, { type: 'burst', decay: 0.003, highpass: 2500, vol: 0.5, at: r3(at + 0.0018), peak: r3(peak * 0.7) }];

// a whistled call: a sine bending from one pitch to another (the kernel's `tone`), a breath of band noise on it
const call = (at, from, to, dur, vol = 0.5, more = {}) => ({ at, from, to, dur, vol, ...more });
/** A whistle's cue: each call a `tone` (sine, quick attack) and a little breath through the band it sweeps. */
export function whistleCue(calls) {
  return calls.flatMap((c) => [
    { type: 'tone', wave: c.wave ?? 'sine', hz: c.from, to: c.to, dur: c.dur, attack: 0.006, release: r3(c.dur * 0.35), vol: c.vol, at: r3(c.at), ...(c.vibrato ? { vibrato: c.vibrato } : {}), ...(c.tremolo ? { tremolo: c.tremolo } : {}), ...(c.lowpass ? { lowpass: c.lowpass } : {}) },
    { type: 'burst', decay: r3(c.dur * 0.5), highpass: Math.round(Math.min(c.from, c.to) * 0.85), lowpass: Math.round(Math.max(c.from, c.to) * 1.25), vol: r3(c.vol * 0.12), at: r3(c.at) },
  ]);
}

// a bird's call in the kernel's own syrinx: dB to a vol, and one call from the as-built takes' numbers (body.py
// bird_call: the pitch path, the resonances, the doubled period, the jitter, the rattle, the breath)
const sv = (db) => r3(0.6 * 10 ** (db / 20));
const syr = (at, dur, pitch, formants, more = {}, db = 0) => ({ type: 'syrinx', at: r3(at), dur, pitch, formants: formants.map(([hz, width]) => (Array.isArray(hz) ? { path: hz, width } : { hz, width })), ...more, vol: sv(db) });
const st = (hz, semis) => Math.round(hz * 2 ** (semis / 12));
const honk = (at, d, db) => syr(at, 0.2, [[0, st(480, d)], [1, st(520, d)]], [[1000, 0.35], [2400, 0.4]], { sub: 0.2, jitter: 0.03, noise: 0.1 }, db);
// a rooster's crow: four parts rising, the last held; each `layer` [pitch ratio, its resonances, dB] the same part
// again under it (the tenor), `semis` the whole call moved
const rooster = (layers, semis = 0) => [[0, 0.12, [[0, 500], [1, 540]], -2], [0.14, 0.12, [[0, 600], [1, 640]], -1], [0.28, 0.14, [[0, 700], [1, 720]], 0], [0.45, 0.6, [[0, 750], [0.3, 900], [0.8, 850], [1, 500]], 0]]
  .flatMap(([at, dur, p, db]) => {
    const path = p.map(([t, hz]) => [t, st(hz, semis)]);
    return [syr(at, dur, path, [[1200, 0.7], [2600, 0.6]], { sub: 0.3, jitter: 0.04, noise: 0.2 }, db),
      ...layers.map(([ratio, formants, ldb]) => syr(at, dur, path.map(([t, hz]) => [t, Math.round(hz * ratio)]), formants, { sub: 0.2, jitter: 0.04, noise: 0.08 }, db + ldb))];
  });
// round 10: the environment's creatures and weather, as kernel cues
const hoot = (at, from, to, dur, vol) => whistleCue([call(at, from, to, dur, vol)]);
export const ENV = {
  // a cricket: a high buzz pulsed by its rattle (four pulses a chirp), three chirps
  'cricket-riri': ['リリリ', [0, 0.45, 0.9].map((at, k) => syr(at, 0.13, [[0, 4600], [1, 4650]], [[4600, 0.3]], { rattle: { rate: 30, depth: 1 }, noise: 0.05, release: 0.15 }, -k))],
  // a frog: two croaks, a low buzz rattled hard
  'frog-gero': ['ゲロゲロ', [0, 0.32].map((at, k) => syr(at, 0.25, [[0, 180], [1, 160]], [[500, 0.5], [1300, 0.5]], { sub: 0.5, jitter: 0.03, rattle: { rate: 25, depth: 0.9 }, noise: 0.2 }, -2 * k))],
  // an owl: hoo, then hoo-hoo, soft whistles low
  'owl-hoo': ['ホーホー', [...hoot(0, 420, 400, 0.35, 0.5), ...hoot(0.7, 380, 370, 0.2, 0.42), ...hoot(0.95, 390, 360, 0.45, 0.45)]],
  // a wolf's howl: rising into a long held vowel opening and closing, a slow wobble
  'wolf-howl': ['ワオーン', [syr(0, 2.2, [[0, 380], [0.2, 620], [0.7, 650], [1, 470]], [[[[0, 700], [0.5, 1000], [1, 600]], 0.5], [2400, 0.4]], { jitter: 0.02, rattle: { rate: 6, depth: 0.15 }, noise: 0.15, release: 0.35 })]],
  // a fly: a low buzz wandering in pitch, its wings' flutter
  'fly-buun': ['ブーン', [syr(0, 1.4, [[0, 210], [0.5, 240], [1, 200]], [[900, 1.2], [2600, 0.8]], { rattle: { rate: 12, depth: 0.3 }, noise: 0.05, release: 0.2 })]],
  // thunder near: a crack, then the rumble (low grains over seconds, a dark noise under it)
  'thunder-near': ['ゴロゴロ', [{ type: 'burst', decay: 0.08, highpass: 1500, vol: 0.6 }, { type: 'thump', from: 'C2', to: 'C1', decay: 1.2, vol: 0.6 },
    { type: 'grain', grains: 60, over: 2.5, decay: [0.05, 0.2], band: { lo: 40, hi: 400 }, vol: 0.5, seed: 11, at: 0.05 }, { type: 'burst', decay: 2.5, lowpass: 300, vol: 0.4, at: 0.1 }]],
  // thunder far: no crack, the rumble darker and longer
  'thunder-far': ['ゴロゴロ', [{ type: 'grain', grains: 50, over: 3.5, decay: [0.08, 0.3], band: { lo: 30, hi: 220 }, vol: 0.45, seed: 12 }, { type: 'burst', decay: 3.5, lowpass: 180, vol: 0.35, at: 0.2 }]],
};
// the wolf's howl, in the kernel's tones: a triangle (few overtones: rounded, an 'oo'), a slow vibrato and a waver,
// breath on it; and the same an octave of company under it (a pack's second voice)
const howl = (at, path, dur, vol, more = {}) => [
  { type: 'tone', wave: 'triangle', hz: path[0], to: path[1], dur: r3(dur * 0.25), attack: 0.08, release: 0.05, vol, at: r3(at), vibrato: { rate: 5, depth: 25 } },
  { type: 'tone', wave: 'triangle', hz: path[1], to: path[2], dur: r3(dur * 0.5), attack: 0.02, release: 0.05, vol, at: r3(at + dur * 0.25), vibrato: { rate: 5, depth: 35 }, tremolo: { rate: 3, depth: 0.15 } },
  { type: 'tone', wave: 'triangle', hz: path[2], to: path[3], dur: r3(dur * 0.25), attack: 0.02, release: r3(dur * 0.2), vol, at: r3(at + dur * 0.75), vibrato: { rate: 5, depth: 30 } },
  { type: 'burst', decay: r3(dur * 0.7), highpass: 500, lowpass: 2500, vol: r3(vol * 0.12), at: r3(at) },
  ...(more.pack ? howl(at + 0.4, path.map((h) => Math.round(h * 1.19)), dur * 0.9, r3(vol * 0.6)) : []),
];
export const HOWLS = {
  'howl-tone': ['ワオーン', howl(0, [380, 620, 650, 470], 2.2, 0.5)],
  'howl-pack': ['ワオーン', howl(0, [380, 620, 650, 470], 2.2, 0.5, { pack: true })],
};
// a howl in the syrinx: its resonances follow its own pitch (the first harmonic, `h2` of the second), so it is nearly a
// pure tone; jitter and a slow waver keep it alive, the breath runs through the same resonances
const wolf = (at, path, dur, { h2 = 0.25, noise = 0.25, waver = 0.08, db = 0 } = {}) => syr(at, dur, path,
  [[path, 0.3], [path.map(([t, hz]) => [t, hz * 2]), 0.3]].map(([p, w], k) => [p, w]), { jitter: 0.015, rattle: { rate: 5, depth: waver }, noise, attack: 0.12, release: 0.35 }, db);
export const WOLF = {
  'wolf-pure': [wolf(0, [[0, 380], [0.2, 620], [0.7, 650], [1, 470]], 2.2)].map((g) => ({ ...g, formants: [{ ...g.formants[0], gain: 1 }, { ...g.formants[1], gain: 0.25 }] })),
  'wolf-breathy': [wolf(0, [[0, 360], [0.25, 600], [0.75, 640], [1, 430]], 2.6, { noise: 0.5, waver: 0.12 })].map((g) => ({ ...g, formants: [{ ...g.formants[0], gain: 1 }, { ...g.formants[1], gain: 0.15 }] })),
  'wolf-pack': [
    ...[wolf(0, [[0, 380], [0.2, 620], [0.7, 650], [1, 470]], 2.2)],
    ...[wolf(0.5, [[0, 450], [0.2, 740], [0.7, 770], [1, 560]], 2.0, { db: -4 })],
  ].map((g) => ({ ...g, formants: [{ ...g.formants[0], gain: 1 }, { ...g.formants[1], gain: 0.25 }] })),
};
// a howl that ends closing on its ン: the body to `cut` of its length, then the close on its own: the resonance tighter
// on the pitch, a nasal one (~2.5 kHz, a low murmur at `murmur` Hz) and a buzz under it, a push of breath and level
// (`force` dB) and a dip in pitch (`dip` semitones) as the mouth shuts
const closingHowl = (at, path, dur, { db = 0, cut = 0.72, nasal = 0.35, murmur = 0, force = 2, dip = 0 } = {}) => {
  const lerp = (t) => { for (let k = 1; k < path.length; k++) if (t <= path[k][0]) { const [t0, h0] = path[k - 1], [t1, h1] = path[k]; return h0 + ((h1 - h0) * (t - t0)) / (t1 - t0); } return path.at(-1)[1]; };
  const body = path.filter(([t]) => t < cut).map(([t, h]) => [r3(t / cut), h]).concat([[1, Math.round(lerp(cut))]]);
  const endPts = [[0, Math.round(lerp(cut))], [0.6, Math.round(lerp(cut + (1 - cut) * 0.6))], [1, st(path.at(-1)[1], -dip)]];
  const tail = endPts.map(([t, h]) => [t, h]);
  return [
    { ...syr(at, r3(dur * cut + 0.03), body, [[body, 0.3], [body.map(([t, h]) => [t, h * 2]), 0.3]], { jitter: 0.015, rattle: { rate: 5, depth: 0.08 }, noise: 0.25, attack: 0.12, release: 0.06 }, db),
      formants: [{ path: body, width: 0.3, gain: 1 }, { path: body.map(([t, h]) => [t, h * 2]), width: 0.3, gain: 0.25 }] },
    { ...syr(at + dur * cut, r3(dur * (1 - cut)), tail, [], { sub: 0.15, jitter: 0.02, rattle: { rate: 5, depth: 0.1 }, noise: 0.35, attack: 0.04, release: 0.4 }, db + force),
      formants: [{ path: tail, width: 0.18, gain: 1 }, { hz: 2500, width: 0.2, gain: nasal }, ...(murmur ? [{ hz: murmur, width: 0.25, gain: 0.5 }] : [])] },
  ];
};
const pack = (opts) => [...closingHowl(0, [[0, 380], [0.2, 620], [0.7, 650], [1, 470]], 2.2, opts), ...closingHowl(0.5, [[0, 450], [0.2, 740], [0.7, 770], [1, 560]], 2.0, { ...opts, db: -4 })];
WOLF['wolf-pack-close'] = pack({});
WOLF['wolf-pack-force'] = pack({ force: 4, dip: 2, nasal: 0.45 });
WOLF['wolf-pack-nasal'] = pack({ force: 3, dip: 1, nasal: 0.6, murmur: 300 });
// the operator's pick: B, its nasal taken out (the close tighter, the force and the dip kept)
WOLF['wolf-howl'] = pack({ force: 4, dip: 2, nasal: 0 }).map((g) => ({ ...g, formants: g.formants.filter((f) => f.gain !== 0) }));

// bats: the nasal close (C's "ni") sped up `k` times: every pitch and resonance times k, every time over k
const faster = (g, k, at = 0) => ({ ...g, at: r3(at), dur: r3(g.dur / k), attack: r3((g.attack ?? 0.01) / k), pitch: g.pitch.map(([t, h]) => [t, Math.min(12000, Math.round(h * k))]),
  formants: g.formants.map((f) => (f.path ? { ...f, path: f.path.map(([t, h]) => [t, Math.min(16000, Math.round(h * k))]) } : { ...f, hz: Math.min(16000, Math.round(f.hz * k)) })),
  ...(g.rattle ? { rattle: { ...g.rattle, rate: Math.min(200, r3(g.rattle.rate * k)) } } : {}) });
const NI = WOLF['wolf-pack-nasal'][1];
export const BATS = {
  'bat-squeak-4x': [faster(NI, 4)],
  'bat-squeak-6x': [faster(NI, 6)],
  'bat-chatter': [[0, 6], [0.07, 6.6], [0.19, 5.6], [0.26, 6.3], [0.41, 7], [0.47, 6]].map(([at, k], i) => ({ ...faster(NI, k, at), vol: r3(NI.vol * (1 - 0.08 * i)) })),
};

export const BIRDS = {
  'crow-kernel': [[0, 0, 0], [0.42, 15, -1.5], [0.84, -10, -3]].map(([at, d, db]) => syr(at, 0.3, [[0, 550 + d], [0.3, 610 + d], [1, 470 + d]], [[1400, 0.6], [2600, 0.5]], { sub: 0.5, jitter: 0.06, noise: 0.35 }, db)),
  'raven-kernel': [[0, 0], [0.42, -2]].map(([at, db]) => syr(at, 0.3, [[0, 320], [0.3, 360], [1, 260]], [[800, 0.6], [1500, 0.6]], { sub: 0.6, jitter: 0.05, rattle: { rate: 35, depth: 0.5 }, noise: 0.25 }, db)),
  'eagle-kernel': [syr(0, 1.0, [[0, 2600], [0.15, 3200], [0.7, 2800], [1, 2200]], [[3000, 1.0]], { jitter: 0.04, rattle: { rate: 45, depth: 0.4 }, noise: 0.4 })],
  'goose-kernel': [honk(0, 0, 0), honk(0.3, -0.5, -1.5)],
  'geese-kernel': [[0, -2.5, 0], [0.34, -2.3, -1], [0.7, -2.8, -1.5], [0.15, 0.2, -3.5], [0.48, -0.3, -4], [0.84, 0.4, -4.5], [0.28, 2.6, -6.5], [0.62, 2.3, -7], [0.96, 2.8, -7.5]].map(([at, d, db]) => honk(at, d, db)),
  'duck-kernel': [0, 1, 2].map((k) => syr(0.22 * k, 0.17, [[0, 380 - 8 * k], [0.3, 420 - 8 * k], [1, 330 - 8 * k]], [[[[0, 800], [0.3, 1500], [1, 900]], 0.5], [2500, 0.3]], { sub: 0.35, jitter: 0.03, noise: 0.15 }, -2 * k)),
  'chicken-kernel': [
    ...[[0, 0], [0.15, -1.5], [0.29, -0.5], [0.46, -2.5], [0.6, -1]].map(([at, db]) => syr(at, 0.06, [[0, 300], [1, 250]], [[800, 0.6], [1800, 0.6]], { sub: 0.2, jitter: 0.03, noise: 0.15, decay: 6 }, db)),
    syr(0.7, 0.3, [[0, 400], [0.4, 650], [1, 550]], [[1000, 0.6], [2200, 0.6]], { sub: 0.3, jitter: 0.03, noise: 0.2, decay: 2.5 }),
  ],
  'rooster-kernel': rooster([]),
  // the rooster with tenor layers under it (8c's ears: "not a high-pitched cluck, but still quite booming"): the same
  // call an octave down through a chest's resonances, then also a fifth down; the third take the whole call 3 semitones
  // lower with both
  'rooster-tenor': rooster([[0.5, [[600, 0.6], [1300, 0.6]], -3]]),
  'rooster-tenor-fifth': rooster([[0.5, [[600, 0.6], [1300, 0.6]], -3], [0.667, [[800, 0.6], [1800, 0.6]], -5]]),
  'rooster-tenor-low': rooster([[0.5, [[550, 0.6], [1200, 0.6]], -2], [0.667, [[750, 0.6], [1700, 0.6]], -5]], -3),
};

export const RECIPES = [
  { id: 'swing', text: 'シュッ', voice: 'jm_kumo', speed: 1.0, chain: 'swoosh' },
  { id: 'blade-swing', text: 'ザシュッ', voice: 'jm_kumo', speed: 1.3, chain: 'blade-kiin', ring: { text: 'キーン', voice: 'jm_kumo', speed: 1.0 } },
  { id: 'katana-swing', text: 'ヒュン', voice: 'jm_kumo', speed: 1.2, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'net-swish', text: 'スパッ', voice: 'jm_kumo', speed: 1.3, chain: 'air' },
  { id: 'swell-in', text: 'スッ', voice: 'jm_kumo', speed: 1.2, chain: 'reverse' },
  // approved takes, not yet a row's voice
  { id: 'alt-shun', alt: true, text: 'シュン', voice: 'jm_kumo', speed: 1.2, chain: 'swoosh' },
  { id: 'alt-shua', alt: true, text: '唰', voice: 'zm_yunjian', speed: 1.2, chain: 'swoosh' },
  { id: 'alt-hyuun', alt: true, text: 'ヒューン', voice: 'jm_kumo', speed: 1.0, chain: 'swoosh' },
  { id: 'alt-jf-shu', alt: true, text: 'シュッ', voice: 'jf_alpha', speed: 1.3, chain: 'swoosh' },
  { id: 'alt-en-swish', alt: true, text: 'swish', voice: 'am_onyx', speed: 1.2, chain: 'swoosh' },
  { id: 'alt-katana-hu', alt: true, text: '呼', voice: 'zm_yunjian', speed: 1.0, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'alt-katana-su', alt: true, text: 'スッ', voice: 'jm_kumo', speed: 1.2, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'alt-katana-whoosh', alt: true, text: 'whoosh', voice: 'am_onyx', speed: 1.0, chain: 'swoosh', with: { family: 'katana', dials: { act: 'swing', weight: 'light' }, db: -6 } },
  { id: 'alt-blade-shu', alt: true, text: 'シュッ', voice: 'jm_kumo', speed: 1.0, chain: 'blade' },
  { id: 'alt-blade-shing', alt: true, text: 'shing', voice: 'am_onyx', speed: 1.2, chain: 'blade-kiin', ring: { text: 'キーン', voice: 'jm_kumo', speed: 1.0 } },
  { id: 'alt-swell-shua', alt: true, text: '唰', voice: 'zm_yunjian', speed: 1.2, chain: 'reverse' },
  // the voiced hum pitched down and traced reads as a lightsaber, not a heavy blade: kept to refine toward a saber
  { id: 'alt-saber-bun', alt: true, text: 'ブン', voice: 'jm_kumo', speed: 1.2, chain: 'heavy' },
  { id: 'alt-saber-buon', alt: true, text: 'ブォン', voice: 'jm_kumo', speed: 1.1, chain: 'heavy' },
  // round 6, the body builds (body.py): the word is the score, its syllables cut once, held, layered or struck under
  // ~150 ms; the takes the operator passed by ear (2026-11-10), rendered sample for sample as they were heard.
  // `text` is the score the build cuts its syllables from (said here; body.py holds the cut). `voiced` traces the voicing
  // (a creature's throat); a build with metal in it strikes its rings with the kernel's own `ring` (bakeRings).
  { id: 'step-grass', build: 'step-grass', text: 'サッ' },
  { id: 'wade', build: 'wade', text: 'バシャッ' },
  { id: 'fire-crackle', build: 'fire-crackle', text: 'パチパチ' },
  { id: 'growl', build: 'growl', text: 'グ', voiced: true },
  { id: 'snarl', build: 'snarl', text: 'ガ', voiced: true },
  { id: 'roar-lion', build: 'roar-lion', text: 'オア', voiced: true },
  { id: 'roar-bear', build: 'roar-bear', text: 'エア', voiced: true },
  // (traced as air: the operator's pick of four, 2026-11-11; a voiced trace lost the screech)
  { id: 'roar-monster', build: 'roar-monster', text: 'イア' },
  { id: 'punch', build: 'punch', text: 'シュッ' },
  { id: 'kick', build: 'kick', text: 'ブン' },
  { id: 'staff-swing', build: 'staff-swing', text: 'ヒュン' },
  { id: 'staff-twirl', build: 'staff-twirl', text: 'ブンブン' },
  { id: 'nunchaku', build: 'nunchaku', text: 'ヒュンヒュン' },
  { id: 'sword-guard', build: 'sword-guard', text: 'チャキッ' },
  { id: 'latch', build: 'latch', text: 'カチャ' },
  { id: 'armour-clank', build: 'armour-clank', text: 'ガチャ' },
  { id: 'coin-drop', build: 'coin-drop', text: 'チャリン' },
  { id: 'ricochet', build: 'ricochet', text: 'チュン' },
  { id: 'spark', build: 'spark', text: 'パチッ' },
  { id: 'electric-crackle', build: 'electric-crackle', text: 'バチバチ' },
  { id: 'drip', build: 'drip', text: 'ピチャ' },
  { id: 'scissors', build: 'scissors', text: 'チョキン' },
  { id: 'ticking', build: 'ticking', text: 'カチカチ' },
  // round 7, passed by ear (2026-11-11): each a row's mouth voice
  ...[
    ['jump', 'jump-pyon', 'ピョン'], ['bounce-pad', 'jump-pyoon', 'ピョーン'], ['land', 'land-suta', 'スタッ'], ['dodge', 'dash-shuta', 'シュタッ'],
    ['slide', 'slide-zuza', 'ズザーッ'], ['hit', 'hit-bashi', 'バシッ'], ['uppercut', 'heavy-hit-doka', 'ドカッ'], ['down', 'body-fall-dosa', 'ドサッ'],
    ['stab', 'stab-zubu', 'ズブッ'], ['katana-draw', 'sword-draw-shakiin', 'シャキーン'], ['katana-sheathe', 'sheathe-chakin', 'チャキン'],
    ['blade-clash', 'clash-gakin', 'ガキン'], ['arrow-hit', 'arrow-thunk-tosu', 'トスッ'], ['shuriken', 'shuriken-shushu', 'シュシュッ'],
    ['sparkle', 'sparkle-kirakira', 'キラキラ'], ['eat', 'eat-mogumogu', 'モグモグ'], ['potion-drink', 'gulp-goku', 'ゴクッ'],
    // the door creak's trace (as air) heard as a lion's short roar
    ['roar-lion-short', 'creak-gii', 'ギィ'], ['roar-lion-rough', 'creak-gii-fast', 'ギィ'],
    // round 7b, passed; and the takes heard as something else, tagged as that
    ['power-up', 'power-up-arp', 'キュイーン'], ['power-up-rings', 'power-up-chime', 'キラリン'], ['door-creak', 'creak-pulses', 'ギギギ'],
    ['horse-neigh', 'creak-squeal', 'キィ'], ['bubbles', 'bubbles-blip', 'ポコポコ'], ['bubbling', 'bubbles-pops', 'ポコポコ'],
    ['button', 'button-kachi', 'カチッ'], ['lever', 'lever-gakon', 'ガコン'], ['rattle', 'hiss-shaa', 'シャー'], ['bucket-splash', 'squeak-chuu', 'チュー'],
    ['power-up-glass', 'glass-break-parin', 'パリン'], ['wood-impact', 'step-wood-kotsu', 'コツ'], ['metal-impact', 'step-metal-kan', 'カン'],
  ].map(([id, build, text]) => ({ id, build, text })),
  // round 8b: the syrinx raven and eagle traced as air, heard as a dog barking and a cat hissing (the operator)
  { id: 'dog-bark', build: 'raven-syrinx', text: 'グワッ' },
  { id: 'cat-hiss', build: 'eagle-syrinx', text: 'キィーアー' },
  // round 8c: the rooster traced as a buzz, heard as a trumpet
  { id: 'trumpet-call', build: 'rooster-syrinx', text: 'コケコッコー', maxHz: 1200 },
  // round 7c, passed: the steps heel and toe; the birds whistled (below)
  { id: 'step-wood', build: 'step-wood-heel', text: 'トン' },
  { id: 'step-metal', build: 'step-metal-heel', text: 'ガン' },
  // round 8b, trials: rendered by --trial for the operator's ears, never written until they pass (and get a row)
  // the whip: a whop (the staff's swish), then カッ cut short, sped up, loud; the third take with the kernel's crack on it
  { id: 'whip-whop-cak', build: 'whip-whop-cak', text: 'ヒュッ・カッ', trial: true },
  { id: 'whip-whop-cak-fast', build: 'whip-whop-cak-fast', text: 'ヒュッ・カッ', trial: true },
  { id: 'whip-whop-cak-loud', build: 'whip-whop-cak-fast', text: 'ヒュッ・カッ', trial: true, plus: nwave(0.29, 2) },
  { id: 'whip-whop-cak-louder', build: 'whip-whop-cak-fast', text: 'ヒュッ・カッ', trial: true, plus: nwave(0.29, 3.5) },
  // birds as a syrinx: a buzz at the bird's pitch, its period jittered and doubled, through the bird's resonances, the
  // word's breath its noise; the word the rhythm and the pitch shape
  // the birds in the kernel's own syrinx (8c's ears: as built beats any trace): the cue is the recipe, nothing traced
  // passed (2026-11-11): each a row's voice
  ...[['crow', 'crow-kernel', 'カァ'], ['raven', 'raven-kernel', 'グワッ'], ['eagle', 'eagle-kernel', 'キィーアー'], ['goose', 'goose-kernel', 'ガー'],
    ['geese', 'geese-kernel', 'ガーガー'], ['duck', 'duck-kernel', 'グワッグワッ'], ['chicken', 'chicken-kernel', 'コッコッ']].map(([id, b, text]) => ({ id, text, cue: BIRDS[b] })),
  // the rooster: the operator's pick of four, as first heard (no tenor)
  { id: 'rooster', text: 'コケコッコー', cue: BIRDS['rooster-kernel'] },
  // round 10, passed: what a game's environments need most. Footsteps on each ground (traced: a crunch is noise)
  ...[
    ['step-gravel', 'step-gravel-jari', 'ジャリッ'], ['step-snow', 'step-snow-saku', 'サクッ'], ['step-dirt', 'step-dirt-za', 'ザッ'], ['step-sand', 'step-sand-sa', 'サッ'],
    ['step-mud', 'step-mud-becha', 'ベチャ'], ['step-water', 'step-puddle-basha', 'バシャ'], ['step-leaves', 'step-leaves-gasa', 'ガサッ'], ['raindrop', 'raindrop-potsu', 'ポツ'],
  ].map(([id, build, text]) => ({ id, build, text })),
  // the world's small creatures in the kernel's syrinx and tones, and thunder in its noise; the howl heard as a siren
  ...[['cricket', 'cricket-riri'], ['frog', 'frog-gero'], ['owl', 'owl-hoo'], ['fly', 'fly-buun'], ['lightning-strike', 'thunder-near'], ['thunder-far', 'thunder-far'], ['siren', 'wolf-howl']]
    .map(([id, e]) => ({ id, text: ENV[e][0], cue: ENV[e][1] })),
  // round 10b's howls, heard as other things: the kernel's tones as an arcade howl, the held voice traced as air as
  // a lion, with its hum as a motor
  { id: 'retro-howl', text: 'ワオーン', cue: HOWLS['howl-tone'][1] },
  { id: 'retro-howl-duo', text: 'ワオーン', cue: HOWLS['howl-pack'][1] },
  { id: 'roar-lion-long', build: 'howl-voice', text: 'ウオーン' },
  { id: 'motor-rev', build: 'howl-voice', text: 'ウオーン', maxHz: 900 },
  // the wolf's howl, round 10c (trials): the syrinx with its resonance locked on its own pitch (a near-pure tone, an
  // organic one: jitter, a waver, breath), the first harmonic and a little of the second
  { id: 'wolf-howl', text: 'ワオーン', cue: WOLF['wolf-howl'] },
  // bats (trials): the wolf's nasal "ni" sped up into squeaks, a chatter of them, and wings
  // bats (passed 2026-11-11): the wolf's nasal "ni" sped up into squeaks, a chatter of them, and wings
  ...[['bat-squeak', 'bat-squeak-4x'], ['bat-squeak-high', 'bat-squeak-6x'], ['bat-chatter', 'bat-chatter']].map(([id, b]) => ({ id, text: 'キッ', cue: BATS[b] })),
  { id: 'bat-wings', build: 'bat-wings', text: 'バサバサ' },
  // whistled birds (whistleCue), passed in 7c: the kernel's own tones, the word's pitch shape their score; nothing traced
  { id: 'bird-chirp', text: 'ピヨピヨ', whistle: [0, 1, 2].flatMap((k) => [call(k * 0.2, 2800, 3600, 0.06, 0.5 - 0.08 * k), call(k * 0.2 + 0.05, 3500, 2500, 0.08, 0.45 - 0.08 * k)]) },
  { id: 'sparrow', text: 'チュンチュン', whistle: [0, 1, 2, 3].map((k) => call(k * 0.1, 4300 - 80 * k, 2700, 0.05, 0.5 - 0.05 * (k % 2))) },
  { id: 'bird-trill', text: 'ピピピッ', whistle: [0, 1, 2, 3, 4, 5].map((k) => call(k * 0.055, 3300, 3900, 0.035, 0.45)) },
  { id: 'bird-warble', text: 'ピーヨ', whistle: [call(0, 3000, 3400, 0.35, 0.45, { vibrato: { rate: 28, depth: 120 } }), call(0.36, 3300, 2400, 0.12, 0.4)] },
].map((r) => (r.build ? { voice: 'jm_kumo', speed: 1, chain: 'body', ...r } : r));

// a chain that keeps the voiced hum traces its voicing; the rest are air (trace.js `voicing`)
const VOICED_CHAINS = new Set(['heavy']);

export function workerDir() {
  const w = process.env.MOJULO_VOICEGEN || join(homedir(), 'mojulo-voicegen');
  return existsSync(join(w, 'venv/bin/python')) && existsSync(join(w, 'models/kokoro-v1.0.onnx')) ? w : null;
}

function renderRecipes(recipes0, worker) {
  const recipes = recipes0.filter((r) => !r.whistle && !r.cue);
  const out = mkdtempSync(join(tmpdir(), 'mouth-foley-'));
  const list = join(out, 'recipes.json');
  writeFileSync(list, JSON.stringify(recipes.map(({ id, text, voice, speed, chain, ring, build }) => ({ id, text, voice, speed, chain, ...(ring ? { ring } : {}), ...(build ? { build } : {}) }))));
  execFileSync(join(worker, 'venv/bin/python'), [join(HERE, 'warp.py'), '--worker', worker, '--recipes', list, '--out', out], { stdio: ['ignore', 'pipe', 'inherit'] });
  return out;
}


// the kernel's ring: a partial's `decay` is about 7.83 of its amplitude's time constant (measured: τ = decay / 7.83)
const RING_TAU = 7.83;
/**
 * A build's rings as the kernel's own `ring` gestures (the tracer would hear a ring as hiss): each at its time, its
 * modes as partials (a mode's level falls with its decay, as warp's resonator gives it), its level the ring's in the
 * build's own mix, scaled as the traced dry part was (`scale`: the traced render's peak over the dry file's).
 */
async function bakeRings(rings, scale, renderCue, onset = 0) {
  const out = [];
  for (const ring of rings) {
    const f0 = ring.modes[0][0], tmax = Math.max(...ring.modes.map((m) => m[1])), tmin = Math.min(...ring.modes.map((m) => m[1]));
    // where the build's mix cut the ring, the kernel's is down 40 dB (4.6 time constants) by then: the length heard
    const reach = ring.end ? Math.min(tmax, (ring.end - ring.at) / 4.6) : tmax;
    // (a trace plays from its sound's onset, the ring from its time in the file: the ring is placed from the onset)
    const g = { type: 'ring', at: r3(Math.max(0, ring.at - onset)), hz: Math.round(f0), decay: r3(reach * RING_TAU),
      partials: ring.modes.map(([f, t]) => ({ ratio: r3(f / f0), gain: r3(tmin / t), decay: r3(t / tmax) })), vol: 0.5 };
    const pk = peakOf((await renderCue([{ ...g, at: 0 }])).channels).pk;
    out.push({ ...g, vol: r3((0.5 * ring.peak * scale) / (pk || 1)) });
  }
  return out;
}
function peakOf(channels) {
  const m = channels.length > 1 ? channels[0].map((v, i) => (v + channels[1][i]) / 2) : channels[0];
  let at = 0, pk = 0;
  for (let i = 0; i < m.length; i++) if (Math.abs(m[i]) > pk) { pk = Math.abs(m[i]); at = i; }
  return { at, pk };
}

/** Bake: { page (the generated JS), report }. `dir` holds <id>.wav for every recipe. */
export async function bake(recipes, dir, { wav = null } = {}) {
  const { traceSound, refineTrace } = await import('../../lib/graph/sfx-shelf/trace.js');
  const { renderBeatsOffline } = await import('../../lib/graph/beats/beats-render.js');
  const { decodeWav } = await import('../../lib/graph/beats/audio-measure.js');
  const { measureSound } = await import('../../lib/graph/sfx-shelf/measure.js');
  const { familyCue } = await import('../../lib/graph/sfx-shelf/families.js');
  const renderCue = async (cue) => {
    const { wav: bytes } = await renderBeatsOffline({ kind: 'beats-sfx', title: 'mouth foley', cues: { c: cue } }, { cue: 'c', tail: 0.3, sampleRate: 44100 });
    return { bytes: Buffer.from(bytes), ...decodeWav(Buffer.from(bytes)) };
  };
  const entries = {}, report = [];
  if (wav) mkdirSync(wav, { recursive: true });
  for (const r of recipes) {
    if (r.whistle || r.cue) {
      // the kernel's own tones or syrinx: the cue is the recipe, nothing to trace; its render is the take
      const cue = r.cue ?? whistleCue(r.whistle), out = await renderCue(cue), m = measureSound(out.channels.length > 1 ? out.channels : out.channels[0], out.sr);
      report.push({ id: r.id, frames: 0, error: 0, voiced: false, original: m, traced: m });
      if (wav) { writeFileSync(join(wav, `${r.id}.wav`), out.bytes); writeFileSync(join(wav, `${r.id}--traced.wav`), out.bytes); }
      if (!r.alt && !r.trial) entries[r.id] = { text: r.text, chain: r.cue ? 'syrinx' : 'whistle', cue };
      continue;
    }
    const file = join(dir, `${r.id}.wav`), dryFile = join(dir, `${r.id}--dry.wav`);
    const { sr, channels } = decodeWav(readFileSync(file));
    // a build with rings: the dry part traced, the rings struck by the kernel
    const split = existsSync(dryFile) ? { dry: decodeWav(readFileSync(dryFile)), rings: JSON.parse(readFileSync(join(dir, `${r.id}.rings.json`), 'utf8')) } : null;
    const src = split ? split.dry : { sr, channels };
    const { gesture, targets, onset } = traceSound(src.channels, src.sr, { voicing: VOICED_CHAINS.has(r.chain) || !!r.voiced || !!r.maxHz, ...(r.maxHz ? { maxHz: r.maxHz } : {}) });
    const refined = await refineTrace(gesture, targets, (g) => renderCue([g]));
    let trace = refined.gesture, cue = [trace];
    if (split) {
      const scale = peakOf((await renderCue([trace])).channels).pk / (peakOf(split.dry.channels).pk || 1);
      cue = [trace, ...(await bakeRings(split.rings, scale, renderCue, onset))];
    }
    // `plus`: the recipe's own kernel gestures laid on the trace at their time in the file (a whip's crack: a sonic
    // boom a couple of milliseconds long, shorter than a trace's 10 ms frame)
    // (each at a `peak` of the take's own loudest moment: rendered alone, its vol set so its peak is that share of the
    // traced sound's peak, as a ring's is)
    // A peak over 1 is louder than the take: the render's limiter holds the trace at full scale, so the trace is turned
    // down under it instead (the contrast is the loudness: a whip's crack over its whop).
    if (r.plus) {
      const top = Math.max(1, ...r.plus.map((g) => g.peak ?? 1));
      if (top > 1) { trace = { ...trace, vol: r3((trace.vol ?? 1) / top) }; cue[0] = trace; }
      const tracePk = peakOf((await renderCue([{ ...trace, vol: trace.vol ?? 1 }])).channels).pk * top;
      for (const { peak = 1, ...g } of r.plus) {
        const pk = peakOf((await renderCue([{ ...g, at: 0 }])).channels).pk;
        cue.push({ ...g, at: r3(Math.max(0, (g.at ?? 0) - onset)), vol: r3(((g.vol ?? 0.5) * (peak / top) * tracePk) / (pk || 1)) });
      }
    }
    if (r.with) {
      // the hybrid: the voice under the family's own cue, its loudest moment on the cue's
      const base = familyCue(r.with.family, r.with.dials);
      const b = peakOf((await renderCue(base)).channels), v = peakOf((await renderCue([trace])).channels);
      trace = { ...trace, at: r3(Math.max(0, b.at - v.at) / 44100), vol: r3((10 ** (r.with.db / 20) * b.pk) / v.pk) };
      cue = [...base, trace];
    }
    const out = await renderCue(cue);
    const mo = measureSound(channels.length > 1 ? channels : channels[0], sr), mt = measureSound(out.channels.length > 1 ? out.channels : out.channels[0], out.sr);
    report.push({ id: r.id, frames: trace.lv.length, error: refined.error, voiced: !!trace.voiced, original: mo, traced: mt });
    if (wav) { copyFileSync(file, join(wav, `${r.id}.wav`)); writeFileSync(join(wav, `${r.id}--traced.wav`), out.bytes); }
    if (!r.alt && !r.trial) entries[r.id] = { text: r.text, voice: r.voice, speed: r.speed, chain: r.chain, ...(r.build ? { build: r.build } : {}), ...(r.ring ? { ring: r.ring } : {}), ...(r.with ? { with: { family: r.with.family, dials: r.with.dials } } : {}), trace, ...(split ? { rings: cue.slice(1, 1 + split.rings.length) } : {}), ...(r.plus ? { plus: cue.slice(cue.length - r.plus.length) } : {}) };
    if (wav && r.trial) writeFileSync(join(wav, `${r.id}.cue.json`), JSON.stringify(cue));
  }
  return { page: pageJs(entries), report };
}

function pageJs(entries) {
  return [
    '/**',
    ' * sfx-shelf/sets/mouth-traces — the mouth sounds traced into recipes (sfx-shelf/trace.js), one per row the mouth set',
    ' * voices. Generated by `node scripts/mouth-foley/bake.mjs` from each recipe (the sound word, its voice and speed,',
    ' * the chain) rendered by the local voice worker: do not edit. `with` is a family cue the trace is laid under.',
    ' */',
    '',
    'export const MOUTH_TRACES = Object.freeze({',
    ...Object.entries(entries).map(([id, e]) => `  '${id}': ${JSON.stringify(e)},`),
    '});',
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const check = args.includes('--check'), from = opt('--from'), wav = opt('--wav');
  const trial = args.includes('--trial');
  const recipes = RECIPES.filter((r) => (trial ? r.trial : args.includes('--all') || (!r.alt && !r.trial)));
  let dir = from;
  if (!dir) {
    const worker = workerDir();
    if (!worker) {
      console.log('mouth-foley: no voice worker (set MOJULO_VOICEGEN or run install-local-voicegen.sh --ja); the traces stand as they are');
      process.exit(0);
    }
    dir = renderRecipes(recipes, worker);
  }
  const { page, report } = await bake(recipes, dir, { wav });
  for (const r of report) {
    console.log(`  ${r.id.padEnd(20)} frames ${String(r.frames).padStart(3)}  missed ${String(r.error).padStart(4)} dB  ms ${r.original.ms}→${r.traced.ms}  centroid ${r.original.centroidHz}→${r.traced.centroidHz}  heard ${r.original.heard}→${r.traced.heard}`);
  }
  if (wav) writeFileSync(join(wav, 'report.json'), JSON.stringify(report, null, 2));
  if (trial) { console.log('mouth-foley: trials rendered; the page is untouched'); process.exit(0); }
  const stale = !existsSync(PAGE) || readFileSync(PAGE, 'utf8') !== page;
  if (check) {
    console.log(stale ? 'mouth-traces.js is stale: run node scripts/mouth-foley/bake.mjs' : 'mouth-traces.js is current');
    process.exit(stale ? 1 : 0);
  }
  if (stale) writeFileSync(PAGE, page);
  console.log(stale ? `wrote ${PAGE}` : 'mouth-traces.js already current');
}
