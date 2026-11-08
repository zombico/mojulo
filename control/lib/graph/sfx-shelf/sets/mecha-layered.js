/**
 * sfx-shelf/sets/mecha-layered — mech combat's sounds in the realistic style: each one its floor (sets/mecha.js, every
 * gesture kept in order) given what the SFX mixer can do, and the layers it lacked. Pure data.
 *
 * How a sound is layered (the shelf's own register, `realistic`; the words are layers.js):
 *   transient   a few milliseconds of bright noise, centred and dry: where the ear hears it start
 *   body        the floor's pitched voice, kept clean
 *   harmonics   a driven, highpassed copy of the body: the overtones that let it read on a small speaker
 *   sub         a clean low thump, centred, never driven and never sent: the weight
 *   grit        grain trains panned apart: the width
 *   tail        a noise burst darkening as it fades (`filterEnv`), sent to the space: where the room answers
 *   detail      what the thing is made of: a metal plate's ring, a hydraulic hiss, a mechanism's clack
 *   duck        the big hits (a charged shot, a bazooka, a landing) dip the score under them
 *
 * `over(id, treat, add)` is the floor cue with gesture `i` given `treat[i]` (its chain, pan, send, a level), then
 * `add`'s layers after it. Each cue meets its floor on the yardstick (measure.js `meetsFloor`, the deep sweep holds
 * every one); whether it sounds better is the operator's ears, never claimed here.
 */
import { MECHA } from './mecha.js';
import { drive, transient, sub, grit, tail, plate, duck, harmonicsOf, freeze } from '../layers.js';

const over = (id, treat, add) => [...MECHA.cues[id].map((g, i) => ({ ...g, ...(treat[i] || {}) })), ...add];
const harmonics = (id, i, vol, cut) => harmonicsOf(MECHA.cues[id][i], vol, cut);

export const MECHA_LAYERED = freeze({
  label: 'Mech combat, layered',
  floor: 'mecha',
  cues: {
    // an eighteen-metre machine's foot: a sub under the floor's tick, the ground crunching wide, a plate in the foot
    // ringing, the ankle's hydraulics breathing out after
    'mech-step': over('mech-step', { 0: { send: 0.1 }, 1: { vol: 0.2 } }, [
      sub('C2', 'E1', 0.16, 0.104),
      grit(10, 0.06, 250, 2200, 0.24, 4101, { pan: -0.35, send: 0.3 }),
      grit(6, 0.05, 900, 4200, 0.15, 4102, { pan: 0.35, send: 0.3 }),
      transient(3800, 0.012, 0.15, { at: 0.004 }),
      plate('D4', 0.12, 0.05, { at: 0.005, send: 0.25 }),
      { type: 'burst', at: 0.06, decay: 0.05, vol: 0.05, highpass: 3000, pan: 0.2, send: 0.2 },
    ]),
    // the landing: the floor's double thump driven, a plate clang ringing through the frame, debris settling both
    // sides, the score dipping under the weight
    'mech-land': over('mech-land', {}, [
      harmonics('mech-land', 3, 0.18),
      harmonics('mech-land', 2, 0.18),
      sub('E1', 'A0', 0.4, 0.16),
      plate('G3', 0.45, 0.08, { at: 0.004, send: 0.45 }),
      grit(24, 0.35, 300, 3500, 0.21, 4201, { at: 0.05, pan: -0.5, send: 0.4 }),
      grit(20, 0.3, 600, 5000, 0.15, 4202, { at: 0.07, pan: 0.5, send: 0.4 }),
      tail(0.5, 2400, 200, 0.12, { at: 0.02, send: 0.5 }),
      duck(3, 0.08, 0.35),
    ]),
    // the roll: three contacts as the floor has them, each with a scrape, the thrusters' whoosh carrying it across
    'mech-dodge': over('mech-dodge', {}, [
      harmonics('mech-dodge', 5, 0.18),
      harmonics('mech-dodge', 3, 0.18),
      harmonics('mech-dodge', 1, 0.18),
      tail(0.45, 6000, 600, 0.12, { pan: -0.2, send: 0.35 }),
      grit(10, 0.12, 800, 5000, 0.18, 4301, { pan: -0.4, send: 0.25 }),
      grit(10, 0.12, 800, 5000, 0.165, 4302, { at: 0.28, pan: 0.4, send: 0.25 }),
      grit(10, 0.12, 800, 5000, 0.18, 4303, { at: 0.5, pan: 0, send: 0.25 }),
      sub('D2', 'A0', 0.25, 0.088, { at: 0.5 }),
    ]),
    // the blip a weapon with no sound of its own fires: the floor's square sweep tamed and saturated, a sine body
    // under it, a crackle beside it
    'beam-blip': over('beam-blip', { 0: { vol: 0.24, chain: [{ type: 'drive', amount: 0.25, tone: 9000 }] } }, [
      transient(4000, 0.01, 0.225),
      { type: 'sweep', wave: 'sine', from: 'E5', to: 'A3', dur: 0.1, vol: 0.12, send: 0.1 },
      grit(8, 0.08, 2000, 9000, 0.18, 4401, { pan: 0.3, send: 0.3 }),
    ]),
    // the beam rifle: a crack where it starts, the floor's body saturated, its flutter and grit set apart, a clean sub,
    // the ionised air hissing out into the space
    'beam-rifle-shot': over('beam-rifle-shot', { 3: { pan: 0.3, send: 0.35 }, 4: { pan: -0.25, send: 0.2 } }, [
      harmonics('beam-rifle-shot', 0, 0.08, 900),
      transient(3500, 0.015, 0.45),
      sub('A1', 'E1', 0.2, 0.12),
      tail(0.4, 9000, 400, 0.18, { at: 0.02, send: 0.5 }),
      grit(16, 0.18, 3000, 11000, 0.14, 4511, { pan: 0.25, send: 0.35 }),
    ]),
    // a beam landing on armour: the floor's hit with a hard metal contact over it, the plate ringing, sparks thrown
    'beam-rifle-hit': over('beam-rifle-hit', { 0: { pan: -0.15 } }, [
      harmonics('beam-rifle-hit', 3, 0.1, 500),
      transient(4200, 0.012, 0.375),
      plate('E4', 0.25, 0.06, { send: 0.3 }),
      grit(18, 0.25, 600, 6000, 0.18, 4501, { at: 0.03, pan: 0.4, send: 0.4 }),
      sub('C2', 'G0', 0.18, 0.088),
    ]),
    // the charge: the floor's rising sweep and flutter set apart, a pulsing hum climbing under them, a sub swelling
    'beam-charge': over('beam-charge', { 0: { chain: [{ type: 'filter', mode: 'lowpass', freq: 7000 }] }, 1: { pan: -0.3 }, 2: { pan: 0.3, send: 0.3 } }, [
      { type: 'tone', note: 'E3', to: 'E4', dur: 1.05, wave: 'sawtooth', lowpass: 1800, vol: 0.08, attack: 0.3, tremolo: { rate: 14, depth: 0.4 }, send: 0.2 },
      { type: 'tone', note: 'E1', to: 'B1', dur: 1, wave: 'sine', vol: 0.12, attack: 0.5, send: 0 },
    ]),
    // the charged shot: the rifle's layering, heavier: a deeper sub, a longer ionised tail, the score ducking under it
    'beam-charged-shot': over('beam-charged-shot', { 3: { pan: 0.3, send: 0.4 }, 4: { pan: -0.3, send: 0.25 } }, [
      harmonics('beam-charged-shot', 0, 0.1, 500),
      transient(3200, 0.018, 0.48),
      sub('E1', 'A0', 0.5, 0.16),
      tail(0.7, 10000, 300, 0.18, { at: 0.02, send: 0.6 }),
      grit(20, 0.25, 3000, 11000, 0.14, 4551, { pan: -0.25, send: 0.4 }),
      duck(5, 0.15, 0.5),
    ]),
    // the bazooka: a crack, the floor's report driven, a sub that shoves, the rocket hissing away
    'bazooka-shot': over('bazooka-shot', { 1: { ...drive(0.3, 3000), send: 0.25 }, 3: { pan: -0.3, send: 0.3 } }, [
      harmonics('bazooka-shot', 0, 0.18),
      transient(2500, 0.01, 0.525),
      sub('D1', 'A0', 0.5, 0.2),
      tail(0.5, 7000, 1200, 0.15, { at: 0.03, pan: 0.2, send: 0.4 }),
      duck(4, 0.1, 0.4),
    ]),
    // the bazooka's round bursting: a crack, the floor's blast driven, a boom under it, debris thrown both ways, a
    // rumble rolling into the space, the score ducking hard
    'bazooka-hit': over('bazooka-hit', { 2: { pan: -0.2, send: 0.4 } }, [
      harmonics('bazooka-hit', 1, 0.18),
      transient(2000, 0.02, 0.6),
      sub('A1', 'A0', 0.9, 0.22),
      grit(30, 0.8, 300, 5000, 0.195, 4601, { at: 0.05, pan: -0.55, send: 0.45 }),
      grit(26, 0.7, 500, 6500, 0.165, 4602, { at: 0.08, pan: 0.55, send: 0.45 }),
      tail(1.2, 1500, 120, 0.25, { at: 0.04, lowpass: 400, send: 0.6 }),
      duck(9, 0.25, 0.9),
    ]),
    // one round: a needle of a transient, the floor's report driven, the action clacking, a little sub; short enough
    // for eight rounds a second
    'machine-gun-shot': over('machine-gun-shot', {}, [
      harmonics('machine-gun-shot', 1, 0.18),
      transient(5000, 0.006, 0.375),
      sub('D2', 'G1', 0.06, 0.08),
      { type: 'burst', at: 0.02, decay: 0.008, vol: 0.08, highpass: 3500, pan: 0.25, send: 0.1 },
      grit(4, 0.04, 1500, 8000, 0.12, 4701, { pan: -0.25, send: 0.25 }),
    ]),
    // the saber swung: the floor's ozone crackle spread across the arc, a hum riding the stroke, a whoosh opening up
    'saber-swing': over('saber-swing', { 1: { pan: -0.3 }, 3: { send: 0.25 }, 4: { pan: -0.35, send: 0.3 }, 5: { pan: 0.3 } }, [
      { type: 'tone', note: 'A3', dur: 0.45, wave: 'sawtooth', lowpass: 2600, vol: 0.06, attack: 0.04, vibrato: { rate: 7, depth: 25 }, send: 0.2 },
      { type: 'burst', decay: 0.4, vol: 0.26, highpass: 600, filterEnv: { from: 900, to: 7000, decay: 0.4 }, pan: 0.15, send: 0.3 },
      grit(30, 0.45, 1500, 6000, 0.16, 4901, { pan: -0.4, send: 0.3 }),
    ]),
    // the saber connecting: the floor's nine layers set apart, the thumps driven, the crackle crushed to an electric
    // fizz, a plate ringing, the score dipping
    'saber-hit': over('saber-hit', { 0: { pan: -0.3, send: 0.3 }, 2: { pan: 0.3, send: 0.3 }, 3: { pan: 0.2 }, 5: { pan: -0.2 } }, [
      harmonics('saber-hit', 8, 0.18),
      harmonics('saber-hit', 6, 0.18),
      grit(20, 0.2, 1500, 9000, 0.18, 4801, { chain: [{ type: 'crush', bits: 6, mix: 0.5 }], pan: 0.4, send: 0.3 }),
      plate('A4', 0.3, 0.05, { send: 0.4 }),
      sub('E1', 'A0', 0.22, 0.1),
      duck(3, 0.06, 0.3),
    ]),
  },
});
