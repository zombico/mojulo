/**
 * WEATHER AUDIO — what a sky sounds like, rolled from principles rather than recorded (weather/weather.js names the
 * sky; this names its sound). Everything lowers onto the beats gestures that exist (grain, ring, burst + filterEnv,
 * thump), so it costs the kernel nothing and every plan is a pure function of its seeds.
 *
 *   BED          continuous texture: a dense train of tiny noise grains in a band (the hiss of rain, the roar of a
 *                gale); the wind is the same bed, its density swelled by two incommensurate slow LFOs (gusts)
 *   GRAINS       the drops: a Poisson-like rain of small events, each a short band of noise, and where the surface
 *                rings, a modal strike (tin, water)
 *   PUNCTUATION  rare big events: thunder, a crack and a rumble
 *
 *   intensity is RATE   a heavier fall is more drops a second, never louder drops
 *   size is BAND        bigger drops sit lower and ring longer; a downpour's band is lower than a drizzle's
 *   the surface is RESONANCE   leaf soft and high, stone a dry click, tin rings, water plinks, sand a hiss, snow hush
 *   distance is LOWPASS + DELAY + LENGTH   thunder: a crack near; far off a rumble, darker, longer, distance / 343 s
 *                after the flash
 *   two dice            the WORLD's picks each parameter's centre inside its range (this world's rain); the EVENT's
 *                jitters round that centre (a slice's seed, and the kernel's per-hit variant): similar, never the same
 *
 * `buildWeatherAudio()` is one closure referencing nothing outside itself, so the page runs the same source
 * (`toString`), as the beats kernel does. The banks are named by weather/weather.js's SOUND_BANKS.
 */
export function buildWeatherAudio() {
  const SLICE = 0.5;   // seconds of weather a slice of plans covers
  const TAU = 6.283185307179586;
  const fr = (x) => x - Math.floor(x);
  // one draw for (seed, a, b): the dice both sides share
  const roll = (seed, a, b) => fr(Math.sin((seed >>> 0) * 12.9898 + a * 78.233 + (b || 0) * 37.719 + 1.3) * 43758.5453);
  const hashName = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const lerp = (a, b, u) => a + (b - a) * u;

  // bed: band [lo, hi] Hz, per-grain vol, density (grains a second at full share), gust (0…1, how far the LFOs swell it)
  // drops: events a second at full share, size [small, big] (0…1)
  const BANKS = {
    still: { bed: { band: [180, 900], vol: 0.07, density: 6 } },
    breeze: { bed: { band: [300, 1800], vol: 0.09, density: 10 }, gust: 0.35 },
    drizzle: { bed: { band: [3500, 9000], vol: 0.07, density: 16 }, drops: { rate: 4, size: [0.05, 0.25] } },
    rain: { bed: { band: [2400, 8000], vol: 0.1, density: 26 }, drops: { rate: 14, size: [0.2, 0.5] }, gust: 0.15 },
    downpour: { bed: { band: [1300, 7000], vol: 0.13, density: 38 }, drops: { rate: 32, size: [0.45, 0.9] }, gust: 0.25 },
    storm: { bed: { band: [900, 6500], vol: 0.14, density: 38 }, drops: { rate: 34, size: [0.5, 0.95] }, gust: 0.6 },
    hush: { bed: { band: [150, 1300], vol: 0.05, density: 6 }, gust: 0.15 },
    gale: { bed: { band: [260, 2600], vol: 0.15, density: 30 }, gust: 1 },
    dust: { bed: { band: [420, 3300], vol: 0.08, density: 16 }, gust: 0.5 },
    rustle: { bed: { band: [1800, 7000], vol: 0.06, density: 8 }, drops: { rate: 6, size: [0.02, 0.2] }, gust: 0.4 },
  };
  // the surface a fall lands on: what a drop sounds like there
  //   hi: a lowpass on the drop's band (soft); click: a highpass lift (dry); ring: { material, hz: [lo, hi], decay, share }
  //   drops: how much of the drop rate survives (snow: none); bed: a lowpass on the bed (sand, snow)
  const SURFACES = {
    leaf: { hi: 5200, drops: 1 },
    stone: { click: 1.6, drops: 1 },
    tin: { ring: { material: 'metal', hz: [700, 1700], decay: 0.3, share: 0.5 }, drops: 1 },
    water: { ring: { material: 'glass', hz: [1300, 2800], decay: 0.2, share: 0.6 }, drops: 1 },
    sand: { hi: 3200, drops: 0.3, bed: 3000 },
    snow: { drops: 0, bed: 1500 },
  };

  /** This world's voice for a bank: each parameter's centre inside its range, from the world's seed (one dice). */
  function voiceFor(worldSeed, bank) {
    const B = BANKS[bank] || BANKS.still, k = hashName(bank);
    const d = (n) => roll(worldSeed, k, n);
    return {
      bank,
      size: B.drops ? lerp(B.drops.size[0], B.drops.size[1], d(1)) : 0,   // how big this world's drops are
      tone: lerp(-0.3, 0.3, d(2)),                                         // octaves the bed's band is shifted
      gustA: lerp(0.07, 0.14, d(3)), gustB: lerp(0.029, 0.058, d(4)),    // Hz, incommensurate
      pitch: d(5),                                                          // where in a ring's range this world's tin sits
    };
  }

  /** The gust at t: two incommensurate slow LFOs, 0…1. */
  const gustAt = (voice, t) => 0.5 + 0.25 * Math.sin(TAU * voice.gustA * t) + 0.25 * Math.sin(TAU * voice.gustB * t + 1.7);

  /** One slice (SLICE seconds from t) of a bank at `share` (0…1): the gestures to play, seeded by the slice's number. */
  function sliceCues(bank, share, voice, surface, t, n, worldSeed) {
    const B = BANKS[bank], S = SURFACES[surface] || SURFACES.stone, out = [];
    if (!B || share <= 0.01) return out;
    const seed = (Math.imul(worldSeed >>> 0, 2654435761) ^ Math.imul(n + 1, 40503) ^ hashName(bank)) >>> 0;
    const oct = Math.pow(2, voice.tone), g = B.gust ? 1 + B.gust * (gustAt(voice, t + SLICE / 2) * 2 - 1) : 1;
    // the bed: a dense train of small grains; intensity is how many
    // (a surface that closes the bed's top may not close it below its own floor: the band stays a band)
    const hi = Math.min(S.bed || 1e9, B.bed.band[1] * oct), lo = Math.min(B.bed.band[0] * oct, hi * 0.6);
    const grains = Math.round(B.bed.density * share * g * SLICE);
    if (grains > 0) out.push({ type: 'grain', at: 0, grains, over: SLICE, decay: [0.05, 0.14], band: { lo, hi }, vol: B.bed.vol, spread: 0.5, seed });
    // the drops: size is band (bigger lower, longer), the surface its resonance
    if (B.drops && S.drops > 0) {
      const size = voice.size, c = 5400 - 4300 * size, rate = B.drops.rate * share * S.drops;
      const count = Math.round(rate * SLICE + roll(seed, 1, 1) - 0.5);
      const dHi = Math.min(S.hi || 1e9, c * 1.7), dLo = Math.min(Math.max(150, (c / 1.7) * (S.click || 1)), dHi * 0.6);
      if (count > 0) out.push({ type: 'grain', at: 0, grains: count, over: SLICE, decay: [0.012 + 0.03 * size, 0.03 + 0.07 * size], band: { lo: dLo, hi: dHi }, vol: 0.32, spread: 0.7, seed: seed ^ 0x51ED });
      if (S.ring) {
        const rings = Math.round(rate * S.ring.share * SLICE * 0.5 + roll(seed, 2, 2) - 0.5);
        for (let i = 0; i < Math.min(rings, 6); i++) {
          const at = roll(seed, 3, i) * SLICE, hz = lerp(S.ring.hz[0], S.ring.hz[1], fr(voice.pitch + 0.37 * roll(seed, 4, i)));
          out.push({ type: 'ring', at, material: S.ring.material, hz, decay: S.ring.decay * (0.6 + 0.8 * size), vol: 0.07 + 0.06 * roll(seed, 5, i) });
        }
      }
    }
    return out;
  }

  /** A flash's thunder: { delay (s after the flash: distance / 343), gestures }. Near is a crack; far is a rumble,
   *  darker and longer for its distance. */
  function thunderCues(flash, worldSeed) {
    const d = flash.dist, seed = (Math.imul(worldSeed >>> 0, 2654435761) ^ (flash.seed >>> 0)) >>> 0;
    const lp = Math.max(180, Math.min(2400, 2400 * Math.exp(-d / 2500))), length = 1.6 + d / 1200, vol = 0.95 / (1 + d / 2500);
    const out = [];
    if (flash.near) {
      out.push({ type: 'burst', at: 0, decay: 0.1, vol: vol, highpass: 2200 });
      out.push({ type: 'thump', at: 0, from: 130, to: 42, decay: 0.55, vol: vol * 0.9 });
    }
    // the rumble: overlapping dark swells, each its own onset, length and weight; the filter closing as it dies
    const pieces = 3 + Math.floor(roll(seed, 1, 1) * 3);
    for (let i = 0; i < pieces; i++) {
      const at = (flash.near ? 0.04 : 0) + i * length * 0.16 + roll(seed, 2, i) * 0.35, w = 0.45 + 0.55 * roll(seed, 3, i);
      out.push({ type: 'burst', at, decay: length * (0.45 + 0.55 * roll(seed, 4, i)), vol: vol * 0.7 * w, lowpass: lp, filterEnv: { from: lp, to: Math.max(90, lp * 0.15), decay: length * 0.8 } });
    }
    out.push({ type: 'thump', at: flash.near ? 0.1 : 0.05, from: 70, to: 32, decay: length * 0.7, vol: vol * 0.6 });
    return { delay: d / 343, gestures: out };
  }

  return { SLICE, BANKS, SURFACES, voiceFor, gustAt, sliceCues, thunderCues };
}

const WA = buildWeatherAudio();
export const { SLICE, BANKS, SURFACES: SURFACE_VOICES, voiceFor, gustAt, sliceCues, thunderCues } = WA;

/**
 * The page's side, appended to the audio channel when `audio.weather` is set: every slice it reads the weather
 * channel's look (window.__mojWeather: its state's pool shares, its lightning) and plays the slice's cues; thunder is
 * played when its flash's delay is up. Presentation only: it reads the sky and never writes to it.
 * `cfg`: { level? (0…1 gain), surface? } (the weather's own surface is the default).
 */
export function weatherAudioScript() {
  return `
// weather sound: beds, drops and thunder rolled from the sky's look (beats/weather-audio.js)
if (__AUDIO.weather) {
  const __WA = (${buildWeatherAudio.toString()})(), __WC = __AUDIO.weather, __wVoices = {};
  let __wN = 0, __wPrev = null, __wFlash = null, __wFlashAt = -1e9;
  setInterval(() => {
    const MW = window.__mojWeather;
    if (!MW || !MW.cur) return;
    const t = MW.clock(), from = __wPrev == null ? t : __wPrev;
    __wPrev = t;   // (moves on while muted: unmuting does not replay the thunder it missed)
    if (!__beatsEng || __beatsMuted) return;
    const L = MW.cur(), surface = __WC.surface || MW.W.surface || 'stone', gain = __WC.level == null ? 1 : __WC.level, when = __beatsCtx.currentTime + 0.05;
    // the banks of the states showing, each at its share (two states in a blend share a bank)
    const banks = {};
    for (const n of Object.keys(L.sh)) { const st = MW.states[n]; if (st) banks[st.sound] = (banks[st.sound] || 0) + L.sh[n]; }
    for (const b of Object.keys(banks)) {
      const v = __wVoices[b] || (__wVoices[b] = __WA.voiceFor(MW.seed, b));
      const cue = __WA.sliceCues(b, Math.min(1, banks[b]), v, surface, t, __wN, MW.seed);
      if (cue.length) __beatsEng.playCue(cue, when, null, gain, __wN + 1);
    }
    __wN++;
    // thunder: each flash's crack or rumble arrives distance / 343 s after it, and still arrives when the sky has moved on
    // (the last lightning the sky had, at its full share, for as long as the farthest thunder can be late)
    if (L.S.flash) { __wFlash = { ...L.S.flash, share: 1 }; __wFlashAt = t; }
    if (__wFlash && t - __wFlashAt < 30) {
      for (const f of MW.flashes(__wFlash, Math.max(0, from - 30), t)) {
        const th = __WA.thunderCues(f, MW.seed), due = f.at + th.delay;
        if (due > from && due <= t) __beatsEng.playCue(th.gestures, when, null, gain, (f.seed >>> 0) + 1);
      }
    }
  }, ${Math.round(SLICE * 1000)});
}`;
}
