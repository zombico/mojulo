/**
 * scene-voice — a screenplay's RECORDED lines and DUBS: the WAVs the agent (the Kokoro worker, run by the agent:
 * docs/local-voice-worker.md) or a person hands over, bound and kept, and the tracks and captions they make on the
 * film's screen clock. The door's side of actor/scene.js `voice` (pure): this module reads and writes files.
 *
 *   bindScreenplayVoice(sp) → { voice, dub, advice }: `sp.voice` ({ <n>: <a .wav path> | { audio, text? } | a bound
 *     recording }) and `sp.dub` ({ <locale>: { <n>: … } }) bound (face-acting/recordings.js bindLine: kept
 *     content-addressed under <outcomes>/recordings/, timed by the worker's .timings.json sidecar, else aligned to the
 *     words, else by loudness). n is the spoken line's number, 1 the first, in script order. A recording already bound
 *     must still be held. Advice (never a refusal): a recording made for other words than its line's.
 *   screenClock(S, coverage, fps) → (scene seconds) → screen seconds: the time map's slow motion and freezes (a word is
 *     never dragged: a recording is laid at its line's moment and plays at its own speed)
 *   voiceTrack(S, coverage, { voice, fps, rate? }) → { samples, rate, seconds, placed, over }: every recording at its
 *     line's moment on the screen clock, mixed to one mono track; `over` the lines whose recording runs past the next
 *     line's start
 *   voiceCaptions(S, coverage, { fps, dub? }) → { srt, vtt, cues }: each line on the screen clock, its words as heard
 *     (a dub's own text where it gives one)
 *   wavOf(track) → the track as a 16-bit mono WAV
 */
import { bindLine, readRecording, decodeWav } from '@/lib/graph/face-acting/recordings.js';
import { actScene } from '@/lib/graph/actor/scene.js';
import { programOf, shotAt } from '@/lib/graph/shoot/sample.js';
import { warped } from '@/lib/graph/shoot/time.js';
import { srt, vtt } from '@/lib/graph/persona/captions.js';
import { writeWavMono } from '@/lib/graph/beats/beats-song-dsp.js';

export const VOICE_RATE = 24000;
/** a locale's name: a BCP 47 language tag's shape (en, fr, pt-BR, zh-Hans) */
export const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const r3 = (v) => Math.round(v * 1000) / 1000;
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const MANUAL = "manual: get_motion_vocab({ id: 'scene-film' })";

/** a line as it is heard: the read's markup (stress, pauses, asides' brackets) taken out, lower case, its words only */
const heard = (text) => String(text).replace(/\*([^*]+)\*/g, '$1').replace(/\[pause[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
/** a line as it is captioned: the markup out, its words as written */
export const spokenText = (text) => String(text).replace(/\*([^*]+)\*/g, '$1').replace(/\[pause[^\]]*\]\s*/g, '').replace(/\s+/g, ' ').trim();

/** One recording bound: a path, { audio, text? }, or one already bound (kept, if it is still held) */
function bindOne(v, text, at) {
  if (typeof v === 'string') {
    if (!/\.wav$/i.test(v)) throw new Error(`${at}: a recording is a .wav file's path (or { audio, text })`);
    return bindLine({ text, audio: v });
  }
  if (!isPlain(v)) throw new Error(`${at}: a .wav path, { audio: <path>, text? } or a bound recording { recording, seconds, … }`);
  if (v.audio !== undefined) {
    if (typeof v.audio !== 'string' || !/\.wav$/i.test(v.audio)) throw new Error(`${at}.audio: a .wav file's path`);
    return bindLine({ ...(v.phonemes ? { phonemes: v.phonemes } : {}), text: v.text ?? text, audio: v.audio });
  }
  if (typeof v.recording === 'string' && Number.isFinite(v.seconds)) {
    if (!readRecording(v.recording)) throw new Error(`${at}: recording ${v.recording} is not held here: give its WAV again ({ audio: <path> })`);
    return v;
  }
  throw new Error(`${at}: a .wav path, { audio: <path>, text? } or a bound recording { recording, seconds, … }`);
}

/** The screenplay's recordings bound (see the header) */
export function bindScreenplayVoice(sp) {
  const advice = [];
  if (sp.voice === undefined && sp.dub === undefined) return { voice: undefined, dub: undefined, advice };
  const { voice: _v, dub: _d, ...plain } = sp;
  const lines = actScene(plain).turns;
  const lineOf = (n, at) => {
    const k = Number(n);
    if (!Number.isInteger(k) || k < 1 || k > lines.length) throw new Error(`${at}: the script has ${lines.length} spoken line${lines.length === 1 ? '' : 's'}, numbered 1 to ${lines.length} in script order (not ${n}; ${MANUAL})`);
    return lines[k - 1];
  };
  const bindAll = (map, at, { locale = null } = {}) => {
    if (!isPlain(map)) throw new Error(`${at}: { <line number>: <a .wav path> | { audio, text? } }`);
    return Object.fromEntries(Object.entries(map).map(([n, v]) => {
      const T = lineOf(n, `${at}.${n}`), own = isPlain(v) && typeof v.text === 'string' ? v.text : null;
      const B = bindOne(v, locale ? own ?? spokenText(T.text) : spokenText(T.text), `${at}.${n}`);
      // (a recording made for other words: the original's words, or the dub's own text where it gives one)
      if (!locale && own && heard(own) !== heard(T.text)) advice.push({ id: 'voice-words', line: Number(n), says: `line ${n}'s recording was made for "${own}", but the line reads "${spokenText(T.text)}"`, try: 'record the line again, or change the script to what was said' });
      return [n, { ...B, text: locale ? own ?? spokenText(T.text) : spokenText(T.text) }];
    }));
  };
  const voice = sp.voice === undefined ? undefined : bindAll(sp.voice, 'voice');
  let dub;
  if (sp.dub !== undefined) {
    if (!isPlain(sp.dub)) throw new Error(`dub: { <locale>: { <line number>: <a .wav path> | { audio, text } } } (${MANUAL})`);
    dub = Object.fromEntries(Object.entries(sp.dub).map(([loc, map]) => {
      if (!LOCALE.test(loc)) throw new Error(`dub.${loc}: a locale is a language tag (fr, ja, pt-BR)`);
      return [loc, bindAll(map, `dub.${loc}`, { locale: loc })];
    }));
  }
  return { voice, dub, advice };
}

/** scene seconds → screen seconds, under the coverage's time map (identity without one) */
export function screenClock(S, coverage, fps = 24) {
  if (!coverage.shots.some(warped)) return (t) => t;
  const program = programOf({ ...coverage, fps }), frames = Math.max(1, Math.round(program.total * fps));
  const clock = Array.from({ length: frames }, (_, f) => shotAt(program, f / fps).t);
  return (t) => { const f = clock.findIndex((c) => c >= t - 1e-6); return r3((f < 0 ? frames : f) / fps); };
}

/** a recording's samples at `rate` (linear resampling), mono */
function samplesAt(id, rate) {
  const bytes = readRecording(id);
  if (!bytes) throw new Error(`recording ${id} is not held here: give its WAV again`);
  const W = decodeWav(bytes);
  if (W.sampleRate === rate) return W.samples;
  const n = Math.floor((W.samples.length * rate) / W.sampleRate), out = new Float32Array(n), k = W.sampleRate / rate;
  for (let i = 0; i < n; i++) { const x = i * k, j = Math.floor(x), u = x - j; out[i] = (W.samples[j] ?? 0) * (1 - u) + (W.samples[j + 1] ?? W.samples[j] ?? 0) * u; }
  return out;
}

/** The scene's recordings (its own, or a dub's) on the screen clock, mixed (see the header) */
export function voiceTrack(S, coverage, { voice, fps = 24, rate = VOICE_RATE, screen = null } = {}) {
  const at = screen ?? screenClock(S, coverage, fps);
  const total = at(S.seconds), placed = [], over = [];
  const lines = S.turns;
  let end = total;
  const clips = [];
  lines.forEach((T, k) => {
    const rec = voice?.[k + 1] ?? voice?.[String(k + 1)];
    if (!rec) return;
    const t0 = at(T.at), samples = samplesAt(rec.recording, rate);
    clips.push({ t0, samples });
    placed.push({ line: k + 1, at: t0, seconds: r3(samples.length / rate), recording: rec.recording });
    const next = lines[k + 1];
    if (next && t0 + samples.length / rate > at(next.at) + 0.05) over.push({ line: k + 1, by: r3(t0 + samples.length / rate - at(next.at)) });
    end = Math.max(end, t0 + samples.length / rate);
  });
  const out = new Float32Array(Math.ceil(end * rate));
  for (const { t0, samples } of clips) { const o = Math.round(t0 * rate); for (let i = 0; i < samples.length && o + i < out.length; i++) out[o + i] += samples[i]; }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return { samples: out, rate, seconds: r3(out.length / rate), placed, over };
}

/** The scene's lines as captions on the screen clock (a dub's own words where it gives them) */
export function voiceCaptions(S, coverage, { fps = 24, dub = null, screen = null } = {}) {
  const at = screen ?? screenClock(S, coverage, fps);
  const cues = S.turns.map((T, k) => {
    const D = dub?.[k + 1] ?? dub?.[String(k + 1)];
    const start = at(T.at), end = D ? Math.max(at(T.end), start + D.seconds) : at(T.end);
    return { start: r3(start), end: r3(end), text: `${T.who.toUpperCase()}: ${D?.text ?? spokenText(T.text)}` };
  });
  return { cues, srt: srt(cues), vtt: vtt(cues) };
}

/** A track as a 16-bit mono WAV */
export const wavOf = (track) => writeWavMono(track.samples, track.rate);

/** ISO 639-2 codes an MP4's tracks are tagged with, for the locales a dub most often is (others are named by title) */
const ISO639_2 = Object.freeze({ en: 'eng', fr: 'fra', es: 'spa', de: 'deu', it: 'ita', pt: 'por', ja: 'jpn', zh: 'zho', ko: 'kor', ru: 'rus', ar: 'ara', hi: 'hin', nl: 'nld', sv: 'swe', pl: 'pol', tr: 'tur' });

/**
 * An MP4 given its sound: the scene's voice the first audio track, each dub's another, each tagged with its language
 * and named; each's captions a subtitle track (mov_text) beside it. Written over the MP4 in place.
 *   muxSound(mp4, { audio?, captions?, dubs?: { <locale>: { audio, captions } }, original? }, { dir })
 */
export async function muxSound(mp4, sound, { dir, original = 'en' } = {}) {
  const { resolveFfmpeg, runFfmpeg } = await import('@/lib/motion/ffmpeg');
  const { renameSync } = await import('node:fs');
  const path = (await import('node:path')).default;
  const bin = await resolveFfmpeg();
  const tracks = [...(sound.audio ? [{ locale: original, audio: sound.audio, captions: sound.captions, title: 'voice' }] : []),
    ...Object.entries(sound.dubs ?? {}).map(([L, D]) => ({ locale: L, audio: D.audio, captions: D.captions, title: `dub ${L}` }))];
  if (!tracks.length) return null;
  const tmp = `${mp4}.sound.mp4`, args = ['-y', '-i', mp4];
  for (const T of tracks) args.push('-i', path.join(dir, T.audio));
  const subs = tracks.filter((T) => T.captions);
  for (const T of subs) args.push('-i', path.join(dir, T.captions));
  args.push('-map', '0:v');
  tracks.forEach((_, i) => args.push('-map', `${i + 1}:a`));
  subs.forEach((_, i) => args.push('-map', `${tracks.length + 1 + i}:s`));
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-c:s', 'mov_text');
  const tag = (kind, i, T) => { const lang = ISO639_2[T.locale.split('-')[0]]; return [...(lang ? [`-metadata:s:${kind}:${i}`, `language=${lang}`] : []), `-metadata:s:${kind}:${i}`, `title=${T.title}`]; };
  tracks.forEach((T, i) => args.push(...tag('a', i, T)));
  subs.forEach((T, i) => args.push(...tag('s', i, T)));
  // (the picture's length is the film's: a last word that runs on is cut where the picture ends)
  args.push('-shortest', tmp);
  await runFfmpeg(bin, args);
  renameSync(tmp, mp4);
  return { audio: tracks.map((T) => T.locale), subtitles: subs.map((T) => T.locale) };
}
