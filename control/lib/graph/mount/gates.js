/**
 * gates — the machine gate over one stride of a mount's gait: measured on the solved frames, never on the inputs, so a
 * check fails when the solver drifts from the reference table. Each check says what it saw and what it wanted; all
 * advise, none refuse (the eyes gate is the operator's: the contact sheet beside Muybridge's plates).
 *
 *  footfalls   each hoof's touchdown phase against the table's (relative to LH), its duty against the stride's
 *  aerial      the stride's suspensions, counted
 *  slip        a planted hoof's toe moving with the ground, on its line (m/s of slip at the worst sample, in the world)
 *  ground      no hoof below the ground, planted or swinging
 *  brush       the lower legs of a pair never closer than a cannon's width (the near single file of the gallop)
 *  flight      in a suspension the centre of mass falls at g (realistic register; the stylized exaggerates by design)
 *  ranges      at the gait's preferred speed: the fore fetlock's deepest extension, the knee's fold, the hock's least
 *              angle, the blade's swing on the trunk
 *  reach       no standing leg out of reach (a swing at full reach is reported, not failed)
 *  smooth      no pop: a joint's velocity never jumps by more than half its speed between samples
 *  rigid       every bone keeps its length
 *  sideways    the sway and the girdles' roll inside a sane band (their read is the eyes gate's, from the front)
 *  hip         the femur against the pelvis inside the hip's range (HIP), every clip
 */
import { GAITS, RANGES, G, HIP } from './reference.js';
import { fromPlane } from './pose.js';
import { legRig } from './legs.js';

const DEG = 180 / Math.PI;
const MIRROR = { LF: 'RF', RF: 'LF', LH: 'RH', RH: 'LH' };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r3 = (x) => Math.round(x * 1000) / 1000;

/** the hinds' hip over the frames: its most flexed and most extended against the stand (degrees), checked against HIP */
function hipCheck(B, frames, add) {
  const rig = legRig(B);
  let flex = -Infinity, ext = Infinity, at = '';
  frames.forEach((f, i) => { for (const k of ['LH', 'RH']) { const L = f.legs[k], a = rig.hipFlex({ pair: 'hind', side: k === 'RH' ? 1 : -1, x: L.plane.xh }, f.body, L.solve.angles.femur, L.plane.xh) * DEG; if (a > flex) { flex = a; at = `${k}, frame ${i}`; } ext = Math.min(ext, a); } });
  add('hip', flex <= HIP.flex + 0.5 && -ext <= HIP.extend + 0.5, `the hip flexes to ${r3(flex)}° (${at}) and extends to ${r3(-ext)}° from the stand`, `≤ ${HIP.flex}° and ≤ ${HIP.extend}°`);
}

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

  // slip: a planted toe (in the world) moves back with the ground at L per stride and holds its line
  const HOOF = { LF: 'hoofFL', RF: 'hoofFR', LH: 'hoofHL', RH: 'hoofHR' };
  let slip = 0;
  const ground = -c.L / n;
  for (const k of ['LF', 'RF', 'LH', 'RH']) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (!frames[i].contact[k] || !frames[j].contact[k]) continue;
    const a = frames[i].bones[HOOF[k]].tail, b = frames[j].bones[HOOF[k]].tail;
    slip = Math.max(slip, Math.hypot(b[0] - a[0], b[1] - a[1] - ground) * n / c.T);
  }
  add('slip', slip <= 0.05, `worst planted toe slip ${r3(slip)} m/s`, '≤ 0.05 m/s');

  // ground: the toe and the heel of every hoof, in the world
  let low = Infinity;
  for (const f of frames) for (const k of ['LF', 'RF', 'LH', 'RH']) {
    const L = f.legs[k];
    low = Math.min(low, fromPlane(L.plane, L.distal.toe)[2], fromPlane(L.plane, L.distal.heel)[2]);
  }
  add('ground', low >= -0.01, `lowest hoof point ${r3(low)} m`, '≥ −0.01 m');

  // brush: the lower legs of a pair (knee or hock down) never meet, centre line to centre line, closer than a cannon
  const seg = (f, ids) => ids.map((id) => f.bones[id]);
  const segDist = (a, b) => {
    let m = Infinity;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
      const p = a.head.map((v, d) => v + (a.tail[d] - v) * i / 6), q = b.head.map((v, d) => v + (b.tail[d] - v) * j / 6);
      m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    }
    return m;
  };
  let brush = Infinity, brushAt = '';
  for (const f of frames) for (const [L, R] of [[['cannonFL', 'pasternFL', 'hoofFL'], ['cannonFR', 'pasternFR', 'hoofFR']], [['cannonHL', 'pasternHL', 'hoofHL'], ['cannonHR', 'pasternHR', 'hoofHR']]]) {
    for (const a of seg(f, L)) for (const b of seg(f, R)) { const d = segDist(a, b); if (d < brush) { brush = d; brushAt = `${L[0].slice(0, 7)} pair at ${f.t.toFixed(3)}`; } }
  }
  add('brush', brush >= 0.06 * B.scale, `the lower legs of a pair pass ${r3(brush)} m apart at the closest (${brushAt})`, `≥ ${r3(0.06 * B.scale)} m`);

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

  // the sideways motion, reported (the eyes judge it from the front)
  const span = (xs) => Math.max(...xs) - Math.min(...xs);
  const lateral = {
    sway: r3(span(frames.map((f) => f.body.sway || 0))),
    rollF: r3(span(frames.map((f) => f.body.rollF || 0)) * DEG), rollH: r3(span(frames.map((f) => f.body.rollH || 0)) * DEG),
    neck: r3(span(frames.map((f) => f.body.lat || 0)) * DEG),
  };
  hipCheck(B, frames, add);
  add('sideways', lateral.sway <= 0.1 && lateral.rollF <= 10 && lateral.rollH <= 10,
    `sway ${lateral.sway} m, roll ${lateral.rollF}° at the shoulders and ${lateral.rollH}° at the hips, neck ${lateral.neck}°`, 'sway ≤ 0.1 m, each roll ≤ 10° (range)');
  return { checks, measured: { down, duty, aerial, slip, low, brush, lateral } };
}

/**
 * The machine gate over a ONE-SHOT (motion.js): sampled on its timeline at `hz` (192 a stride of its quicker gait). The seams: its first frame is the
 * first cycle's pose at its entry phase (or the stand), its last the second's at its exit phase (or the stand); a
 * planted hoof does not move in the WORLD (the root's travel added back); no hoof in the ground; no standing leg out of
 * reach (a swing at full reach reported); no pop; rigid bones; the lower legs of a pair never brush.
 */
export function shotGates(B, clip, { hz, stand } = {}) {
  // sampled as finely as the cycle gate samples the quicker gait's stride (192 a stride), so a pop reads the same
  hz = hz ?? 192 * Math.max(clip.A.f ?? 0, clip.B.f ?? 0);
  const n = Math.max(24, Math.round(clip.duration * hz)), dt = clip.duration / n;
  const frames = Array.from({ length: n + 1 }, (_, i) => clip.poseAt(i * dt));
  const checks = [];
  const add = (name, pass, saw, want) => checks.push({ name, pass, saw, want });
  const maxd = (a, b) => Math.max(...Object.keys(a).flatMap((id) => ['head', 'tail'].map((e) => dist(a[id][e], b[id][e]))));
  const entryPose = clip.A.poseAt ? clip.A.poseAt(clip.entry.phase).bones : stand.bones;
  const exitPose = clip.B.poseAt ? clip.B.poseAt(clip.exit.phase).bones : stand.bones;
  const e0 = maxd(frames[0].bones, entryPose), e1 = maxd(frames[n].bones, exitPose);
  add('seams', e0 <= 1e-4 && e1 <= 1e-4, `opens ${e0.toExponential(1)} m and closes ${e1.toExponential(1)} m off the cycles' poses`, '≤ 1e-4 m');

  const HOOF = { LF: 'hoofFL', RF: 'hoofFR', LH: 'hoofHL', RH: 'hoofHR' };
  let slip = 0, low = Infinity, standing = 0, swinging = 0;
  for (let i = 0; i <= n; i++) {
    const f = frames[i];
    for (const k of ['LF', 'RF', 'LH', 'RH']) {
      const L = f.legs[k];
      low = Math.min(low, fromPlane(L.plane, L.distal.toe)[2], fromPlane(L.plane, L.distal.heel)[2]);
      if (i < n && f.contact[k] && frames[i + 1].contact[k]) {
        const a = f.bones[HOOF[k]].tail, b = frames[i + 1].bones[HOOF[k]].tail;
        slip = Math.max(slip, Math.hypot(b[0] - a[0], (b[1] + frames[i + 1].root) - (a[1] + f.root)) / dt);
      }
    }
    for (const k of f.clamps) { if (f.contact[k]) standing++; else swinging++; }
  }
  add('slip', slip <= 0.05, `worst planted toe slip ${r3(slip)} m/s in the world`, '≤ 0.05 m/s');
  add('ground', low >= -0.01, `lowest hoof point ${r3(low)} m`, '≥ −0.01 m');
  add('reach', standing === 0, `${standing} standing sample(s) out of reach, ${swinging} swinging at full reach`, 'no standing leg out of reach');

  let pop = 0, popAt = '';
  for (const id of Object.keys(frames[0].bones)) for (const end of ['head', 'tail']) {
    const p = frames.map((f) => [f.bones[id][end][0], f.bones[id][end][1] + f.root, f.bones[id][end][2]]);
    const v = p.slice(0, -1).map((q, i) => p[i + 1].map((x, d) => x - q[d]));
    const top = Math.max(...v.map((w) => Math.hypot(...w)));
    if (top < 1e-6) continue;
    for (let i = 0; i + 1 < v.length; i++) {
      const j = Math.hypot(...v[i + 1].map((x, d) => x - v[i][d])) / top;
      if (j > pop) { pop = j; popAt = `${id}.${end} at ${(i * dt).toFixed(3)} s`; }
    }
  }
  add('smooth', pop <= 0.5, `largest velocity jump ${r3(pop)} of its top speed (${popAt})`, '≤ 0.5');

  let stretch = 0;
  for (const id of Object.keys(frames[0].bones)) {
    const l0 = dist(frames[0].bones[id].head, frames[0].bones[id].tail);
    for (const f of frames) stretch = Math.max(stretch, Math.abs(dist(f.bones[id].head, f.bones[id].tail) - l0));
  }
  add('rigid', stretch <= 1e-6, `largest bone length change ${stretch.toExponential(1)} m`, '≤ 1e-6 m');
  hipCheck(B, frames, add);
  return { checks, measured: { e0, e1, slip, low, standing, swinging, pop } };
}

/**
 * The jump's machine gate: the one-shot gate, and the flight (the centre of mass falls at g between launch and
 * touchdown, the realistic register) and the clearance (every leg's segments over the rail where they pass it, and the
 * belly, a barrel's depth under the centre of mass, over it too).
 */
export function jumpGates(B, clip, { stand, hz } = {}) {
  const r = shotGates(B, clip, { stand, hz });
  const add = (name, pass, saw, want) => r.checks.push({ name, pass, saw, want });
  const { launch, touchdown } = clip.flight, n = 120, acc = [], dt = (touchdown - launch) / n;
  for (let i = 2; i < n - 1; i++) {
    const t = launch + i * dt, z = (u) => clip.poseAt(u).body.z;
    acc.push((z(t + dt) - 2 * z(t) + z(t - dt)) / (dt * dt));
  }
  const mean = acc.reduce((a, b) => a + b, 0) / acc.length;
  if (B.register === 'realistic') add('flight', Math.abs(mean + G) <= 0.02 * G, `the body falls at ${r3(-mean)} m/s² in the air`, `${G} ± 2 %`);
  const { y: fy, height, spread } = clip.fence, half = spread / 2 + 0.06;
  let clear = Infinity, at = '';
  for (let i = 0; i <= 200; i++) {
    const t = launch - 0.15 + (touchdown - launch + 0.3) * i / 200, f = clip.poseAt(t);
    for (const [id, b] of Object.entries(f.bones)) {
      if (!/^(radius|cannon|pastern|hoof|tibia|femur|humerus)/.test(id)) continue;
      for (let j = 0; j <= 6; j++) {
        const p = b.head.map((x, d) => x + (b.tail[d] - x) * j / 6), y = p[1] + f.root;
        if (Math.abs(y - fy) <= half && p[2] - height < clear) { clear = p[2] - height; at = `${id} at ${t.toFixed(3)} s`; }
      }
    }
    const belly = f.body.z - 0.32 * B.scale;
    if (Math.abs(f.root - fy) <= half + 0.4 && belly - height < clear) { clear = belly - height; at = `the belly at ${t.toFixed(3)} s`; }
  }
  add('clears', clear >= 0.02, `${clear === Infinity ? 'nothing passes the rail' : `the lowest point over the rail is ${r3(clear)} m above it (${at})`}`, '≥ 0.02 m');
  return r;
}

/**
 * The idle's machine gate: sampled at `hz` over the clip; every hoof planted (its toe still in the world); no hoof in the
 * ground; no leg out of reach; rigid bones; no pop; and a LOOP (a layer) closes on its own first frame.
 */
export function idleGates(B, clip, { hz = 60, loop = false } = {}) {
  const n = Math.max(24, Math.round(clip.duration * hz)), dt = clip.duration / n;
  const frames = Array.from({ length: n + 1 }, (_, i) => clip.poseAt(i * dt));
  const checks = [];
  const add = (name, pass, saw, want) => checks.push({ name, pass, saw, want });
  const HOOF = { LF: 'hoofFL', RF: 'hoofFR', LH: 'hoofHL', RH: 'hoofHR' };
  let slip = 0, low = Infinity, clamps = 0;
  for (let i = 0; i <= n; i++) {
    const f = frames[i];
    for (const k of ['LF', 'RF', 'LH', 'RH']) {
      const L = f.legs[k];
      low = Math.min(low, fromPlane(L.plane, L.distal.toe)[2], fromPlane(L.plane, L.distal.heel)[2]);
      if (i < n) { const a = f.bones[HOOF[k]].tail, b = frames[i + 1].bones[HOOF[k]].tail; slip = Math.max(slip, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt); }
    }
    clamps += f.clamps.length;
  }
  add('slip', slip <= 0.01, `worst toe drift ${r3(slip)} m/s`, '≤ 0.01 m/s (planted)');
  add('ground', low >= -0.01, `lowest hoof point ${r3(low)} m`, '≥ −0.01 m');
  add('reach', clamps === 0, `${clamps} sample(s) out of reach`, 'none');
  let stretch = 0;
  for (const id of Object.keys(frames[0].bones)) {
    const l0 = dist(frames[0].bones[id].head, frames[0].bones[id].tail);
    for (const f of frames) stretch = Math.max(stretch, Math.abs(dist(f.bones[id].head, f.bones[id].tail) - l0));
  }
  add('rigid', stretch <= 1e-6, `largest bone length change ${stretch.toExponential(1)} m`, '≤ 1e-6 m');
  let pop = 0, popAt = '';
  for (const id of Object.keys(frames[0].bones)) for (const end of ['head', 'tail']) {
    const p = frames.map((f) => f.bones[id][end]);
    const v = p.slice(0, -1).map((q, i) => p[i + 1].map((x, d) => x - q[d]));
    const top = Math.max(...v.map((w) => Math.hypot(...w)));
    if (top < 1e-5) continue;
    for (let i = 0; i + 1 < v.length; i++) { const j = Math.hypot(...v[i + 1].map((x, d) => x - v[i][d])) / top; if (j > pop) { pop = j; popAt = `${id}.${end} at ${(i * dt).toFixed(2)} s`; } }
  }
  add('smooth', pop <= 0.5, `largest velocity jump ${r3(pop)} of its top speed (${popAt})`, '≤ 0.5');
  hipCheck(B, frames, add);
  if (loop) {
    const e = Math.max(...Object.keys(frames[0].bones).flatMap((id) => ['head', 'tail'].map((x) => dist(frames[0].bones[id][x], frames[n].bones[id][x]))));
    add('loops', e <= 1e-9, `the loop closes ${e.toExponential(1)} m off its first frame`, '≤ 1e-9 m');
  }
  return { checks };
}
