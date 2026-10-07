/**
 * drive — what moves an entry's t. Every entry has a t, how far along its motion it is (a door from closed to open, a
 * platform along its rail, a lift between its stops); the variant says what the motion is, the DRIVE says what moves
 * along it:
 *
 *   clock   time: back and forth (`pingpong`) or round (`loop`) over `period` seconds, from `phase`
 *   ride    a rider: standing on the deck sends it to the far end; it waits `dwell` seconds empty, then comes home
 *   call    a use at a stop sends it there: `{ type: 'call', stops: [t…] }`, each call a stop index
 *   rule    a bus var: the var's value (0 or 1) is the target; the door's `<id>-open`
 *
 * Ride, call and rule move t toward a target at `speed` (t per second); clock sets t from time. All of it is pure and
 * stepped by dt (replay-safe, no wall clock):
 *
 *   initialDrive(drive)                       → state { t, target, wait }
 *   stepDrive(drive, state, dt, signals)      → next state; signals { ridden?, call?, value? }
 *   runDrive(drive, script, dt, until)        → [{ time, t }] a timeline under a script of signals, for tests and cards
 */

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (u) => u * u * (3 - 2 * u);

export const DRIVE_TYPES = Object.freeze(['clock', 'ride', 'call', 'rule']);

export function driveErrors(d, where = 'drive') {
  if (!d || !DRIVE_TYPES.includes(d.type)) return [`${where}.type must be one of ${DRIVE_TYPES.join(', ')}`];
  const e = [];
  if (d.type === 'clock' && !(d.period > 0)) e.push(`${where}.period must be seconds above 0`);
  if (d.type === 'clock' && d.mode && !['pingpong', 'loop'].includes(d.mode)) e.push(`${where}.mode must be pingpong or loop`);
  if (d.type !== 'clock' && !(d.speed > 0)) e.push(`${where}.speed must be t per second above 0`);
  if (d.type === 'ride' && !(d.dwell >= 0)) e.push(`${where}.dwell must be seconds, 0 or more`);
  if (d.type === 'call' && (!Array.isArray(d.stops) || d.stops.length < 2)) e.push(`${where}.stops must list at least two stops (t of each)`);
  if (d.type === 'rule' && typeof d.var !== 'string') e.push(`${where}.var must name a bus var`);
  return e;
}

export const initialDrive = (d) => ({ t: d.type === 'clock' ? clockT(d, 0) : d.type === 'call' ? d.stops[d.home ?? 0] : 0, target: d.type === 'call' ? d.stops[d.home ?? 0] : 0, wait: 0, time: 0 });

function clockT(d, time) {
  const s = ((time / d.period + (d.phase || 0)) % 1 + 1) % 1;
  if (d.mode === 'loop') return s;
  return smooth(1 - Math.abs(s * 2 - 1));   // a triangle, smoothed at the turns: the mover rule's own wave
}

export function stepDrive(d, st, dt, sig = {}) {
  const time = st.time + dt;
  if (d.type === 'clock') return { ...st, time, t: clockT(d, time) };
  let { target, wait } = st;
  if (d.type === 'ride') {
    const atEnd = st.t >= 1 - 1e-9, atHome = st.t <= 1e-9;
    if (sig.ridden && atHome) target = 1;
    if (atEnd && !sig.ridden) { wait += dt; if (wait >= d.dwell) { target = 0; wait = 0; } } else if (!atEnd) wait = 0;
  }
  if (d.type === 'call' && Number.isInteger(sig.call) && d.stops[sig.call] !== undefined) target = d.stops[sig.call];
  if (d.type === 'rule' && sig.value !== undefined) target = clamp01(+sig.value);
  const step = d.speed * dt, t = st.t < target ? Math.min(target, st.t + step) : Math.max(target, st.t - step);
  return { t, target, wait, time };
}

/** A timeline under a script: `script(time, state)` returns the signals for that tick. */
export function runDrive(d, script, dt = 0.1, until = 10) {
  let st = initialDrive(d);
  const out = [{ time: 0, t: st.t }];
  for (let i = 1; i * dt <= until + 1e-9; i++) { st = stepDrive(d, st, dt, script(i * dt, st) || {}); out.push({ time: Math.round(i * dt * 1000) / 1000, t: st.t }); }
  return out;
}
