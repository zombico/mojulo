/**
 * families/held — the held voices: sounds that run as long as something drives them, each a sustain spec (the
 * kernel's `sustain`) whose every range runs from the control at 0 to the control at 1. Pure.
 *
 *   booster  a thruster: `jet` a boost whine, the audio channel's thruster synth (scene/channels/audio.js) ported
 *            range for range; `rocket` a rough combustion roar; `ion` a sci-fi drive's hum
 *   engine   a motor by its throttle, idling at 0: a car, a motorbike, a jet's turbine, a propeller's chop, a heavy diesel, a
 *            tracked vehicle's diesel and its tracks, a multirotor drone's motors and props
 *   beam     a held beam weapon by its power: a laser's buzz, a plasma stream's roar
 *   servo    a machine gathering itself: the audio channel's jump servo and its piston chuffs, ported; a walking
 *            machine's hydraulics by its pace
 *   fire     a fire burning on: its roar breathing, its crackle popping faster as it grows
 *   charge   a charge filling: a hum climbing an octave and more, its pulse quickening
 *
 * `sustain: true` marks them: sfxSound gives `{ sustain }` (a spec) for them, not gestures. A chuff train is a
 * sawtooth on the gain with a negative depth: a sharp start, then a fall, each cycle.
 */

const noise = (gain, extra = {}) => ({ kind: 'noise', gain, ...extra });
const osc = (wave, pitch, gain, extra = {}) => ({ kind: 'osc', wave, pitch, gain, ...extra });

export const booster = {
  label: 'a thruster held, by its thrust',
  sustain: true,
  ordered: [],
  dials: { kind: ['jet', 'rocket', 'ion'] },
  defaults: { kind: 'jet' },
  idle: 'silent',
  build(d) {
    if (d.kind === 'jet') return {
      // the channel's synth: an airy band (500 Hz up, its lowpass brightening 1.9 → 3.6 kHz and breathing at 1.1 Hz), a warm
      // body under it, a sine whine rising 720 → 1340 Hz; all three swell with the thrust (its gain node rode thrust ×
      // level, its filters set by the same thrust)
      attack: 0.15, release: 0.15,
      layers: [
        noise([0, 0.5], { band: { lo: 500 }, cutoff: [1900, 3600], q: 0.3, lfo: { to: 'cutoff', rate: [1.1, 1.1], depth: 110 } }),
        noise([0, 0.16], { cutoff: [900, 900], q: 0.3 }),
        osc('sine', [720, 1340], [0, 0.16]),
      ],
    };
    if (d.kind === 'rocket') return {
      attack: 0.1, release: 0.3,
      layers: [
        noise([0, 0.7], { band: { lo: 80 }, cutoff: [600, 5000], lfo: { to: 'gain', rate: [18, 40], depth: 0.3 } }),
        osc('sawtooth', [45, 70], [0, 0.25], { cutoff: [200, 400] }),
        noise([0, 0.12], { band: { lo: 3000 }, pan: 0.2 }),
        noise([0, 0.1], { band: { hi: 200 }, pan: -0.2 }),
      ],
    };
    return {
      attack: 0.2, release: 0.4,
      layers: [
        osc('sawtooth', [110, 220], [0, 0.2], { cutoff: [800, 3000], lfo: { to: 'pitch', rate: [5, 9], depth: 12 } }),
        osc('sine', [880, 1760], [0, 0.08], { pan: 0.25 }),
        noise([0, 0.1], { band: { lo: 4000 }, pan: -0.25 }),
        osc('sine', [55, 110], [0, 0.12]),
      ],
    };
  },
};

export const engine = {
  label: 'a motor by its throttle, idling at 0',
  sustain: true,
  ordered: [],
  dials: { kind: ['car', 'motorbike', 'jet', 'prop', 'kart', 'boat', 'helicopter', 'diesel', 'tracked', 'multirotor'] },
  defaults: { kind: 'car' },
  idle: 'running',
  build(d) {
    switch (d.kind) {
      case 'motorbike': return { attack: 0.12, release: 0.25, layers: [
        osc('sawtooth', [50, 230], [0.2, 0.4], { cutoff: [900, 4000], q: 1.2, lfo: { to: 'gain', rate: [12, 60], depth: 0.5 } }),
        osc('square', [25, 115], [0.08, 0.15], { cutoff: [300, 900] }),
        noise([0.05, 0.2], { band: { lo: 1000 }, cutoff: [2000, 6000], pan: 0.2 }),
      ] };
      case 'jet': return { attack: 0.6, release: 1, layers: [
        noise([0.15, 0.7], { cutoff: [700, 6000] }),
        osc('sine', [400, 2400], [0.03, 0.12], { pan: 0.2 }),
        noise([0.1, 0.35], { band: { lo: 50, hi: 300 }, pan: -0.2 }),
        noise([0.02, 0.15], { band: { lo: 5000 }, lfo: { to: 'gain', rate: [3, 9], depth: 0.3 } }),
      ] };
      case 'prop': return { attack: 0.4, release: 0.6, layers: [
        osc('sawtooth', [30, 110], [0.2, 0.4], { cutoff: [300, 1500], lfo: { to: 'gain', rate: [15, 55], depth: 0.7 } }),
        noise([0.05, 0.2], { cutoff: [800, 2500], lfo: { to: 'gain', rate: [15, 55], depth: 0.5 } }),
        osc('square', [15, 55], [0.08, 0.15], { cutoff: [200, 500] }),
      ] };
      case 'kart': return { attack: 0.08, release: 0.2, layers: [
        // a small two-stroke: high, buzzy, its firing fast and hard
        osc('sawtooth', [70, 300], [0.15, 0.4], { cutoff: [1200, 5000], q: 1.5, lfo: { to: 'gain', rate: [25, 110], depth: 0.6 } }),
        osc('square', [35, 150], [0.06, 0.12], { cutoff: [400, 1200] }),
        noise([0.03, 0.18], { band: { lo: 2000 }, pan: 0.2 }),
      ] };
      case 'boat': return { attack: 0.3, release: 0.6, layers: [
        // an outboard: the motor's growl, the hull slapping the water, the wake hissing
        osc('sawtooth', [40, 150], [0.15, 0.35], { cutoff: [400, 2000], lfo: { to: 'gain', rate: [12, 40], depth: 0.35 } }),
        noise([0.06, 0.3], { cutoff: [500, 1500], lfo: { to: 'gain', rate: [0.7, 2.2], depth: 0.6 }, pan: -0.2 }),
        noise([0.02, 0.2], { band: { lo: 2500 }, cutoff: [5000, 9000], pan: 0.25 }),
      ] };
      case 'helicopter': return { attack: 0.5, release: 1, layers: [
        // the rotor's chop: noise under a deep gain modulation, its rate the rotor's; a turbine whining over it
        noise([0.12, 0.5], { cutoff: [500, 1600], lfo: { to: 'gain', wave: 'sawtooth', rate: [7, 14], depth: -0.95 } }),
        noise([0.04, 0.15], { band: { hi: 150 }, lfo: { to: 'gain', wave: 'sawtooth', rate: [7, 14], depth: -0.9 } }),
        osc('sine', [1800, 3200], [0.02, 0.1], { pan: 0.25 }),
        noise([0.02, 0.2], { band: { lo: 3000 }, cutoff: [6000, 11000], pan: -0.25 }),
      ] };
      case 'multirotor': return { attack: 0.25, release: 0.5, layers: [
        // a multirotor drone: its props' blade-pass buzz rising with the throttle, two motors a little apart beating
        // against each other, their windings' whine over it and the air torn under the props
        osc('sawtooth', [120, 380], [0.16, 0.38], { cutoff: [900, 4200], q: 1.4 }),
        osc('sawtooth', [126, 396], [0.1, 0.26], { cutoff: [900, 4200], pan: 0.2 }),
        osc('sine', [1500, 5200], [0.02, 0.08], { pan: -0.2 }),
        noise([0.04, 0.22], { band: { lo: 600 }, cutoff: [2000, 7000], pan: 0.1 }),
      ] };
      case 'diesel': return { attack: 0.5, release: 0.9, layers: [
        // a heavy diesel (a truck, a carrier, a walking machine's power pack): a slow knock low down, its firing pulses
        // quickening with the throttle, a sub-rumble under it, its turbo hissing and whining in
        osc('sawtooth', [26, 95], [0.22, 0.5], { cutoff: [260, 1400], q: 1.3, lfo: { to: 'gain', rate: [6, 22], depth: 0.35 } }),
        osc('square', [13, 47], [0.1, 0.2], { cutoff: [150, 400] }),
        noise([0.03, 0.15], { band: { lo: 1800 }, cutoff: [2500, 5000], pan: 0.15 }),
        osc('sine', [900, 2600], [0, 0.05], { pan: -0.15 }),
      ] };
      case 'tracked': return { attack: 0.5, release: 0.9, layers: [
        // a tracked vehicle: its diesel, and its tracks' links clanking over the sprockets, the faster the faster it goes
        osc('sawtooth', [24, 85], [0.22, 0.45], { cutoff: [240, 1200], q: 1.3, lfo: { to: 'gain', rate: [5, 18], depth: 0.35 } }),
        osc('square', [12, 42], [0.1, 0.2], { cutoff: [140, 380] }),
        noise([0, 0.35], { band: { lo: 400 }, cutoff: [1200, 3200], q: 1.5, lfo: { to: 'gain', wave: 'sawtooth', rate: [3, 26], depth: -0.9 }, pan: 0.1 }),
        noise([0.02, 0.1], { band: { lo: 1800 }, cutoff: [2500, 4500], pan: -0.15 }),
      ] };
      default: return { attack: 0.12, release: 0.3, layers: [
        osc('sawtooth', [38, 160], [0.18, 0.55], { cutoff: [500, 2600], q: 1.2, lfo: { to: 'gain', rate: [14, 50], depth: 0.25 } }),
        osc('square', [19, 80], [0.12, 0.28], { cutoff: [300, 900] }),
        noise([0.04, 0.35], { band: { lo: 200 }, cutoff: [600, 3000], pan: 0.15 }),
      ] };
    }
  },
};

export const beam = {
  label: 'a held beam weapon, by its power',
  sustain: true,
  ordered: [],
  dials: { kind: ['laser', 'plasma'] },
  defaults: { kind: 'laser' },
  idle: 'silent',
  build(d) {
    return d.kind === 'plasma' ? { attack: 0.06, release: 0.25, layers: [
      osc('sawtooth', [90, 140], [0, 0.25], { cutoff: [800, 3000], lfo: { to: 'gain', rate: [20, 45], depth: 0.4 } }),
      noise([0, 0.45], { cutoff: [1000, 3500], lfo: { to: 'cutoff', rate: [6, 11], depth: 400 } }),
      noise([0, 0.12], { band: { lo: 4000 }, pan: 0.3 }),
      osc('sine', [45, 70], [0, 0.15]),
    ] } : { attack: 0.05, release: 0.15, layers: [
      osc('sawtooth', [220, 330], [0, 0.28], { cutoff: [1500, 5000], lfo: { to: 'gain', rate: [30, 60], depth: 0.4 } }),
      osc('sine', [1760, 2640], [0, 0.08], { pan: -0.25 }),
      noise([0, 0.15], { band: { lo: 3000 }, pan: 0.25 }),
      osc('sine', [110, 165], [0, 0.12]),
    ] };
  },
};

export const servo = {
  label: 'a machine gathering itself: a servo straining, pistons chuffing faster',
  sustain: true,
  ordered: [],
  dials: { kind: ['hydraulic', 'walker'] },
  defaults: { kind: 'hydraulic' },
  idle: 'silent',
  build(d) {
    // a walking machine's hydraulics by its pace: its pump whining up, its valves chuffing with its steps, a hiss over it
    if (d.kind === 'walker') return { attack: 0.2, release: 0.4, layers: [
      osc('sawtooth', [90, 180], [0, 0.3], { cutoff: [300, 1600], q: 3 }),
      noise([0, 0.25], { band: { lo: 200 }, cutoff: [600, 2400], q: 1.2, lfo: { to: 'gain', wave: 'sawtooth', rate: [1, 4], depth: -1 } }),
      noise([0, 0.06], { band: { lo: 2000 }, cutoff: [3500, 9000], pan: 0.2 }),
    ] };
    // the channel's synth: a sawtooth motor 66 → 140 Hz through a resonant lowpass 240 → 760 Hz (Q 4), its gain rising with the
    // charge; the chuffs a noise thump through 130 Hz up and a lowpass 480 → 1000 Hz, quickening as it coils
    return { attack: 0.05, release: 0.08, layers: [
      osc('sawtooth', [66, 140], [0, 0.5], { cutoff: [240, 760], q: 4 }),
      noise([0, 0.3], { band: { lo: 130 }, cutoff: [480, 1000], q: 1.2, lfo: { to: 'gain', wave: 'sawtooth', rate: [4, 13], depth: -1 } }),
      noise([0, 0.05], { band: { lo: 3000 }, pan: 0.2 }),
    ] };
  },
};

export const fire = {
  label: 'a fire burning on, by its size',
  sustain: true,
  ordered: [],
  dials: { kind: ['open'] },
  defaults: { kind: 'open' },
  idle: 'running',
  build() {
    return { attack: 0.8, release: 1.2, layers: [
      noise([0.08, 0.5], { cutoff: [700, 2500], lfo: { to: 'gain', rate: [0.3, 0.9], depth: 0.3 } }),
      noise([0.02, 0.2], { band: { lo: 1500 }, cutoff: [3000, 7000], lfo: { to: 'gain', wave: 'sawtooth', rate: [7, 19], depth: -0.9 }, pan: 0.25 }),
      noise([0.02, 0.12], { band: { lo: 2500 }, lfo: { to: 'gain', wave: 'sawtooth', rate: [5.3, 13.7], depth: -0.9 }, pan: -0.25 }),
      noise([0.05, 0.3], { band: { hi: 300 } }),
    ] };
  },
};

export const charge = {
  label: 'a charge filling',
  sustain: true,
  ordered: [],
  dials: { kind: ['energy'] },
  defaults: { kind: 'energy' },
  idle: 'silent',
  build() {
    return { attack: 0.05, release: 0.12, layers: [
      osc('sawtooth', [110, 880], [0, 0.25], { cutoff: [600, 6000], lfo: { to: 'gain', rate: [6, 32], depth: 0.5 } }),
      osc('sine', [220, 1760], [0, 0.1], { pan: 0.2 }),
      noise([0, 0.12], { band: { lo: 3000 }, pan: -0.2 }),
      osc('sine', [55, 110], [0, 0.1]),
    ] };
  },
};
