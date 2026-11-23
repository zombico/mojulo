/**
 * RELEASE SAMPLES (key-offs): the sound a keyboard makes when a key is let go, not a note: a grand piano's felt damper
 * falling back onto its strings, a Rhodes' damper touching its tine, a harpsichord's jack falling back and its damper
 * stopping the string, an electric organ's key click. Each card is an instrument's key-off in one register (`keyOff`,
 * `at`: the register's middle as MIDI); conditioning measures no pitch for it (it has none) and hands it to the page
 * beside the instrument's notes, and the kernel plays the nearest register's when a note's key is let go
 * (beats-kernel.js; a patch's `keyOff`, its level in dB under the note). Four takes a register, short.
 */

const card = (inst, register, at, prompt) => ({
  id: `${inst}-keyoff-${register}`, band: `${inst}~release:${register}`, instrument: inst, keyOff: true, at, role: 'instrument',
  prompt: `${prompt}, no note ringing, no music, no voice`, seconds: 1, influence: 0.8, loop: false, takes: 4, tags: ['instrument', inst, 'release', register],
});

export const CARDS = [
  card('piano', 'low', 40, 'the sound of a grand piano key released in the bass: the felt damper falling back onto the heavy strings, a soft muted thump with a little low string buzz cut short'),
  card('piano', 'mid', 60, 'the sound of a grand piano key released near middle C: the felt damper falling back onto the strings, a soft muted thump and a tiny felt brush'),
  card('piano', 'high', 80, 'the sound of a grand piano key released in the treble: the small felt damper touching the strings, a faint soft tap'),
  card('rhodes', 'low', 50, 'the sound of a Rhodes electric piano key released low on the keyboard: the felt damper touching the metal tine, a soft dull thud and a faint metallic tick'),
  card('rhodes', 'high', 70, 'the sound of a Rhodes electric piano key released high on the keyboard: the felt damper touching the tine, a tiny soft tick'),
  card('harpsichord', 'low', 48, 'the sound of a harpsichord key released low on the keyboard: the jack falling back, its quill brushing the string, a soft wooden click and a short buzz as the damper stops the string'),
  card('harpsichord', 'high', 72, 'the sound of a harpsichord key released high on the keyboard: the jack falling back, a light wooden click and a tiny buzz as the damper stops the string'),
  card('organ', 'mid', 60, 'the sound of an electric drawbar organ key released: a short faint key click'),
];
