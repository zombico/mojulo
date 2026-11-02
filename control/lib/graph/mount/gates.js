/**
 * gates — the machine gate over one stride of a mount's gait: measured on the solved frames, never on the inputs, so a
 * check fails when the solver drifts from the reference table. Each check says what it saw and what it wanted; all
 * advise, none refuse (the eyes gate is the operator's: the contact sheet beside Muybridge's plates).
 *
 *  footfalls   each hoof's touchdown phase against the table's (relative to LH), its duty against the stride's
 *  aerial      the stride's suspensions, counted
 *  slip        a planted hoof's toe moving with the ground (m/s of slip at the worst sample)
 *  ground      no hoof below the ground, planted or swinging
 *  flight      in a suspension the centre of mass falls at g (realistic register; the stylized exaggerates by design)
 *  ranges      at the gait's preferred speed: the fore fetlock's deepest extension, the knee's fold, the hock's least
 *              angle, the blade's swing on the trunk
 *  reach       no standing leg out of reach (a swing at full reach is reported, not failed)
 *  smooth      no pop: a joint's velocity never jumps by more than half its speed between samples
 *  rigid       every bone keeps its length
 */
import { GAITS, RANGES, G } from './reference.js';

const DEG = 180 / Math.PI;
const MIRROR = { LF: 'RF', RF: 'LF', LH: 'RH', RH: 'LH' };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r3 = (x) => Math.round(x * 1000) / 1000;

export function gaitGates(B, c, { n = 192 } = {}) {
  const spec = GAITS[c.gait];
  const feet = c.lead === 'left' ? Object.fromEntries(Object.entries(spec.feet).map(([k, v]) => [MIRROR[k], v])) : spec.feet;
  const frames = Array.from({ length: n }, (_, i) => c.poseAt(i / n));
  const checks = [];
  const add = (name, pass, saw, want) => checks.push({ name, pass, saw, want });

  // footfalls and duty
  const down = {}, duty = {};
  for (const k of ['LF', 'RF', 'LH', 'RH']) {
    const s = frames.map((f) => f.contact[k]);
    duty[k] = s.filter(Boolean).length / n;
    for (let i = 0; i < n; i++) if (s[i] && !s[(i - 1 + n) % n]) { down[k] = i / n; break; }
  }
  const rel = (k) => (((down[k] - down.LH) % 1) + 1) % 1;
  const want = (k) => (((feet[k] - feet.LH) % 1) + 1) % 1;
  const phaseErr = Math.max(...['LF', 'RF', 'RH'].map((k) => { const d = Math.abs(rel(k) - want(k)); return Math.min(d, 1 - d); }));
  add('footfalls', phaseErr <= 0.02, `worst touchdown ${r3(phaseErr)} of a stride off the table`, '≤ 0.02');
  const dutyErr = Math.max(...Object.values(duty).map((d) => Math.abs(d - c.duty)));
  add('duty', dutyErr <= 0.02, `${Object.entries(duty).map(([k, d]) => `${k} ${d.toFixed(2)}`).join(' ')}`, `${c.duty.toFixed(2)} ± 0.02`);

  // suspensions
  const none = frames.map((f) => !Object.values(f.contact).some(Boolean));
  let aerial = 0;
  for (let i = 0; i < n; i++) if (none[i] && !none[(i - 1 + n) % n]) aerial++;
  add('aerial', aerial === spec.aerial, `${aerial} suspension(s)`, `${spec.aerial}`);

  // slip: a planted toe moves back with the ground at L per stride
  let slip = 0;
  const ground = -c.L / n;
  for (const k of ['LF', 'RF', 'LH', 'RH']) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (!frames[i].contact[k] || !frames[j].contact[k]) continue;
    const dy = frames[j].legs[k].distal.toe[0] - frames[i].legs[k].distal.toe[0];
    slip = Math.max(slip, Math.abs(dy - ground) * n / c.T);
  }
  add('slip', slip <= 0.05, `worst planted toe slip ${r3(slip)} m/s`, '≤ 0.05 m/s');

  // ground
  let low = Infinity;
  for (const f of frames) for (const k of ['LF', 'RF', 'LH', 'RH']) low = Math.min(low, f.legs[k].distal.toe[1], f.legs[k].distal.heel[1]);
  add('ground', low >= -0.01, `lowest hoof point ${r3(low)} m`, '≥ −0.01 m');

  // flight: the centre of mass's acceleration in the suspensions' middle samples
  if (spec.aerial > 0 && B.register === 'realistic') {
    const dt = c.T / n, acc = [];
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      if (none[a] && none[i] && none[b]) acc.push((frames[b].body.z - 2 * frames[i].body.z + frames[a].body.z) / (dt * dt));
    }
    const mean = acc.reduce((s, x) => s + x, 0) / Math.max(1, acc.length);
    add('flight', acc.length > 0 && Math.abs(mean + G) <= 0.2 * G, `the body falls at ${r3(-mean)} m/s² in the suspension`, `${G} ± 20 %`);
  }

  // ranges
  // the ranges are the preferred speed's: checked there (within 15 %), an extended or collected gait folds more or less
  const R = RANGES[c.gait], atPreferred = Math.abs(c.speed / Math.sqrt(B.scale) - spec.preferred) <= 0.15 * Math.abs(spec.preferred);
  if (R && atPreferred) {
    let fet = -Infinity, carp = 0, hock = Infinity, bladeLo = Infinity, bladeHi = -Infinity;
    for (const f of frames) {
      for (const k of ['LF', 'RF']) {
        const L = f.legs[k];
        if (f.contact[k]) fet = Math.max(fet, (L.distal.pastern - L.solve.cannon) * DEG);
        carp = Math.max(carp, L.solve.angles.carpus * DEG);
        const rel = (L.solve.blade - f.body.pitch) * DEG;   // the blade on the trunk, not in the world
        bladeLo = Math.min(bladeLo, rel); bladeHi = Math.max(bladeHi, rel);
      }
      for (const k of ['LH', 'RH']) hock = Math.min(hock, f.legs[k].solve.angles.hock * DEG);
    }
    const inR = (x, [a, b]) => x >= a && x <= b;
    add('fetlock', inR(fet, R.fetlockFore), `fore fetlock at most ${fet.toFixed(1)}° past straight`, `${R.fetlockFore[0]}–${R.fetlockFore[1]}°`);
    add('knee', inR(carp, R.carpus), `knee folds to ${carp.toFixed(1)}°`, `${R.carpus[0]}–${R.carpus[1]}°`);
    add('hock', inR(hock, R.hockMin), `hock closes to ${hock.toFixed(1)}°`, `${R.hockMin[0]}–${R.hockMin[1]}°`);
    add('blade', inR(bladeHi - bladeLo, R.scapula), `the blade swings ${(bladeHi - bladeLo).toFixed(1)}°`, `${R.scapula[0]}–${R.scapula[1]}°`);
  }

  // reach
  let standing = 0, swinging = 0;
  for (const f of frames) for (const k of f.clamps) { if (f.contact[k]) standing++; else swinging++; }
  add('reach', standing === 0, `${standing} standing sample(s) out of reach, ${swinging} swinging at full reach`, 'no standing leg out of reach');

  // smooth: per bone end, the largest velocity jump against that point's top speed
  let pop = 0, popAt = '';
  for (const id of Object.keys(frames[0].bones)) for (const end of ['head', 'tail']) {
    const p = frames.map((f) => f.bones[id][end]);
    const v = p.map((q, i) => { const r = p[(i + 1) % n]; return [r[0] - q[0], r[1] - q[1], r[2] - q[2]]; });
    const top = Math.max(...v.map((w) => Math.hypot(...w)));
    if (top < 1e-6) continue;
    for (let i = 0; i < n; i++) {
      const w = v[(i + 1) % n], u = v[i], j = Math.hypot(w[0] - u[0], w[1] - u[1], w[2] - u[2]) / top;
      if (j > pop) { pop = j; popAt = `${id}.${end} at ${(i / n).toFixed(3)}`; }
    }
  }
  add('smooth', pop <= 0.5, `largest velocity jump ${r3(pop)} of its top speed (${popAt})`, '≤ 0.5');

  // rigid
  let stretch = 0;
  for (const id of Object.keys(frames[0].bones)) {
    const l0 = dist(frames[0].bones[id].head, frames[0].bones[id].tail);
    for (const f of frames) stretch = Math.max(stretch, Math.abs(dist(f.bones[id].head, f.bones[id].tail) - l0));
  }
  add('rigid', stretch <= 1e-6, `largest bone length change ${stretch.toExponential(1)} m`, '≤ 1e-6 m');

  return { checks, measured: { down, duty, aerial, slip, low } };
}
