/**
 * sfx-shelf/styles — the looks a sound comes in. Pure data.
 *
 * Four are the palettes (beats/sfx-palettes.js), the same cue ids voiced four ways; `realistic` is the shelf's own: a
 * sound built from several voices at once (a transient, a body, a low end, grit, a tail), each in its own band, held to
 * the register (register.js). A style with no voice for a sound falls back to the
 * one it names (`fallback`); a palette style needs none, since every palette voices every one of its cue ids. `mouth` is
mouth foley (sets/mouth.js): the sounds a voice makes better, swishes and swings. It is an `overlay`: a row it does not
voice is exactly the realistic one, stand-ins included, never a mouth sound standing in.
 */

export const STYLES = Object.freeze({
  arcade: Object.freeze({ palette: true, read: 'chip: square sweeps and blips' }),
  foley: Object.freeze({ palette: true, read: 'thumps, grains, wood and glass' }),
  orchestral: Object.freeze({ palette: true, read: 'timpani, glockenspiel, brass stabs, harp glides' }),
  synth: Object.freeze({ palette: true, read: 'sine and saw sweeps, held tones' }),
  realistic: Object.freeze({ palette: false, fallback: 'foley', read: 'layered: several voices sounding as one, each in its own band' }),
  mouth: Object.freeze({ palette: false, overlay: true, fallback: 'realistic', read: 'mouth foley: a voice saying the sound, its breath swept and traced' }),
});

export const STYLE_NAMES = Object.freeze(Object.keys(STYLES));
