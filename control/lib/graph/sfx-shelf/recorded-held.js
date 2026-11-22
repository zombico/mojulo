/**
 * sfx-shelf/recorded-held — the shelf's held voices voiced by the sound library's loops, where it is installed: an
 * engine as its steady loops at known revs, crossfaded by the revs the control drives and each bent in pitch by those
 * revs over its own; a tyre or a road as one loop, louder and a little higher as the control rises.
 *
 * The recordings are shared; the TUNING is the row's: which engine it is, the revs its control spans (idle at 0, the
 * redline at 1), how it is filtered and how loud. The open city's car at the wheel (`road-car-engine`, through a small
 * speaker, short of its redline) and a racing car (`car-engine`, the whole range, bright) drive the same hatchback
 * loops their own ways. A row with no tuning, or whose engine the library does not hold, keeps its synthesized voice,
 * which every recorded voice carries as its `fallback`.
 *
 *   `HELD_TUNINGS`                  row id → { engine, rpm: [idle, redline], level?, band? } | { loop, rate?, level? }
 *   `recordedHeld(id, synthesized, { cab })` → the recorded held voice for a row (its synthesized spec the fallback; a
 *                                     row voiced only by its recording, `synthesized` null, has none), or null. `cab`
 *                                     hears an engine as the open city's car at the wheel does (CAB: short of its
 *                                     redline, through a small speaker), whichever engine it is
 *   `CAB`                           that hearing: the share of the engine's revs the city drives it to, the speaker's band
 *
 * Reads the library's index (sound-library/library.js); timeless.
 */
import { recordedEngine, recordedLoop } from '../sound-library/library.js';

export const HELD_TUNINGS = Object.freeze({
  // a racing car: the whole range, open
  'car-engine': Object.freeze({ engine: 'hatchback', rpm: [900, 6500] }),
  // the open city's car at the wheel: heard from the cab through a small speaker, never thrashed to its redline
  'road-car-engine': Object.freeze({ engine: 'hatchback', rpm: [850, 5000], band: Object.freeze({ lo: 60, hi: 5200 }) }),
  'kart-engine': Object.freeze({ engine: 'kart', rpm: [2000, 14000] }),
  'motorbike-engine': Object.freeze({ engine: 'sportbike', rpm: [1200, 13000] }),
  'diesel-engine': Object.freeze({ engine: 'diesel', rpm: [700, 2600] }),
  'tank-engine': Object.freeze({ engine: 'diesel', rpm: [700, 2400] }),
  // the vehicle registry's engines (sfx-shelf/vehicle-sounds.js)
  'v8-engine': Object.freeze({ engine: 'v8', rpm: [800, 6500] }),
  'race-engine': Object.freeze({ engine: 'racecar', rpm: [3000, 15000] }),
  'supercar-engine': Object.freeze({ engine: 'v12', rpm: [1000, 9000] }),
  'electric-motor': Object.freeze({ engine: 'electric', rpm: [1000, 16000] }),
  'scooter-engine': Object.freeze({ engine: 'scooter', rpm: [1800, 10500] }),
  'vtwin-engine': Object.freeze({ engine: 'vtwin', rpm: [900, 5200] }),
  'locomotive-engine': Object.freeze({ engine: 'locomotive', rpm: [300, 900] }),
  'boat-engine': Object.freeze({ engine: 'outboard', rpm: [800, 6000] }),
  'prop-engine': Object.freeze({ engine: 'prop', rpm: [700, 2700] }),
  'jet-engine': Object.freeze({ engine: 'jet', rpm: [20, 100] }),
  // the tyres past their grip, and the road under them
  'tire-squeal': Object.freeze({ loop: 'tire-screech', rate: [0.94, 1.06] }),
  'road-roar': Object.freeze({ loop: 'road-roar-loop', rate: [0.7, 1.25] }),
  // what a vehicle runs on, by its speed (or its rotor, its pump, its pace)
  'tank-tracks': Object.freeze({ loop: 'tank-tracks', rate: [0.6, 1.3] }),
  'rail-wheels': Object.freeze({ loop: 'rail-clack', rate: [0.5, 1.6] }),
  helicopter: Object.freeze({ loop: 'rotor-wash', rate: [0.85, 1.15] }),
  'drone-motors': Object.freeze({ loop: 'quadcopter', rate: [0.8, 1.3] }),
  'bicycle-freewheel': Object.freeze({ loop: 'freewheel', rate: [0.6, 1.4] }),
  hooves: Object.freeze({ loop: 'hooves', rate: [0.7, 1.5] }),
  'walker-hydraulics': Object.freeze({ loop: 'hydraulic-whine', rate: [0.8, 1.3] }),
  'sail-wind': Object.freeze({ loop: 'sails', rate: [0.9, 1.1] }),
});

const r4 = (v) => Math.round(v * 1e4) / 1e4;

// the open city's car at the wheel, whichever car it is (road-car-engine's own tuning is this, on the hatchback)
export const CAB = Object.freeze({ redline: 0.75, band: Object.freeze({ lo: 60, hi: 5200 }) });

export function recordedHeld(id, synthesized, { cab = false } = {}) {
  const T = HELD_TUNINGS[id];
  if (!T) return null;
  const S = synthesized || {}, fall = synthesized ? { fallback: synthesized } : {};
  const base = { attack: S.attack, release: S.release, level: S.level, send: S.send };
  for (const k of Object.keys(base)) if (base[k] === undefined) delete base[k];
  if (T.loop) {
    const card = recordedLoop(T.loop);
    if (!card) return null;
    return { ...base, layers: [{ kind: 'sample', library: card, gain: [0, T.level ?? 1], rate: T.rate || [1, 1] }], ...fall };
  }
  const idle = T.rpm[0], red = cab ? Math.round(T.rpm[0] + (T.rpm[1] - T.rpm[0]) * CAB.redline) : T.rpm[1];
  const band = cab ? T.band || CAB.band : T.band;
  // the loops inside the tuning's revs (a little either side): one recorded far past its redline is never heard
  const loops = recordedEngine(T.engine).filter((l) => l.rpm >= idle * 0.85 && l.rpm <= red * 1.15);
  if (!loops.length) return null;
  const at = (rpm) => Math.max(0, Math.min(1, (rpm - idle) / (red - idle)));
  const xs = loops.map((l) => at(l.rpm));
  const layers = loops.map((l, i) => ({
    kind: 'sample', library: l.card,
    // its place among its neighbours on the control: full below the lowest and above the highest
    window: [r4(i ? xs[i - 1] : xs[i]), r4(xs[i]), r4(i < xs.length - 1 ? xs[i + 1] : xs[i])],
    gain: [0, T.level ?? 1],
    // the revs at each end of the control over the revs it was recorded at
    rate: [r4(idle / l.rpm), r4(red / l.rpm)],
    ...(band ? { band: { ...band } } : {}),
  }));
  return { ...base, layers, ...fall };
}
