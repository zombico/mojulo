/**
 * con-laws — what a construction machine is held to, MEASURED from what was built and how its chain moves, never
 * stated: each joint's range is its ram's (con-chain.js), and the envelope is the tool's tip swept over those ranges.
 *
 *   arcs            each ram-driven joint's working arc (degrees): a ram too short or mounted wrong leaves a front
 *                   that cannot fold or reach
 *   reach           the tip's farthest along the ground from the slew axis (m)
 *   depth           the tip's lowest below the ground
 *   cutHeight       the tip's highest
 *   dumpHeight      the tip's highest with the bucket opened to dump: its teeth plumb under its pin (into a truck)
 *   tail            the counterweight's swing radius from the slew axis (as built)
 *   groundPressure  the class's mass on its tracks' contact (kPa)
 *   lift            the rated load over the side at 6 m, its pin 1.5 m up: 75% of the load that tips it about its
 *                   track's centreline (ISO 10567's share), from every part's mass where it is built and posed (t)
 *   mass            the parts' mass against the class's (a share off)
 *   clearance       the tool never enters the cab over its joints' ranges
 *   transport       its width and its height folded for shipping (its `transport` pose), against a road's limits
 *                   (advisory)
 *   measure.*       a point swept over the joints it names (`over`), the joints it holds at a share of their ranges
 *                   (`at`), the rest at the machine's rest pose: its highest (`take: 'max'`) or how far below the
 *                   ground it goes (`take: 'depth'`): a blade's lift and its drop, a ripper's depth, a loader's hinge
 *                   pin, its dump clearance
 * The excavator's envelope (reach, depth, the heights) and its lift are read where a machine has a boom, a stick and a
 * tool; every other law where its band is given.
 *
 * Each law: { id, value, band, ok, says }. Read once a process per machine. Pure.
 */
import { apply } from './con-common.js';
import { framesOf, rangeOf, solveChain } from './con-chain.js';

const G = 9.81;
const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;
const span = (r, n) => Array.from({ length: n + 1 }, (_, i) => r[0] + ((r[1] - r[0]) * i) / n);

const CACHE = new Map();
export function conLaws(arch, ctx, { corners, physics, posed }) {
  if (CACHE.has(arch.key)) return CACHE.get(arch.key);
  const band = arch.laws, laws = [];
  const law = (id, value, b, ok, says) => laws.push({ id, value, band: b, ok, says });
  const R = Object.fromEntries(Object.keys(arch.joints).map((k) => [k, rangeOf(arch, k, ctx)]));
  const [tipBody, tipHp] = arch.tip.split('.'), tipLocal = ctx.hp(tipBody, tipHp);
  const tipAt = (j) => apply(framesOf(arch, { slew: 0, ...j }, ctx)[tipBody], tipLocal);
  const digs = Boolean(R.boom && R.stick && R.tool);

  // ── the arcs (a slide's, its travel in metres) ──
  for (const [k, r] of Object.entries(R)) if (r && band.arcs?.[k]) {
    const slide = arch.joints[k].kind === 'slide', a = slide ? r2(r[1] - r[0]) : r1(r[1] - r[0]), b = band.arcs[k];
    law(`arc.${k}`, a, b, a >= b[0] && a <= b[1], `the ${k}'s working ${slide ? 'travel' : 'arc'}, ${arch.joints[k].ram ? `its ${arch.joints[k].ram}'s stroke` : 'its own'}`);
  }

  // ── the measures: a point over the joints it names ──
  for (const [id, m] of Object.entries(band.measure ?? {})) {
    const [b, h] = m.point.split('.'), p0 = ctx.hp(b, h), rest = posed('rest');
    // (the joints it holds: a share of each one's range, a dump clearance's arms at full lift and its bucket dumped)
    const base = { ...rest, ...Object.fromEntries(Object.entries(m.at ?? {}).map(([k, v]) => [k, R[k] ? R[k][0] + v * (R[k][1] - R[k][0]) : v])) };
    let combos = [{}];
    for (const j of m.over ?? []) combos = combos.flatMap((c) => span(R[j], m.over.length > 1 ? 24 : 60).map((v) => ({ ...c, [j]: v })));
    const zs = combos.map((c) => apply(framesOf(arch, { ...base, ...c }, ctx)[b], p0)[2]);
    const v = r2(m.take === 'depth' ? -Math.min(...zs) : Math.max(...zs));
    law(id, v, m.band, v >= m.band[0] && v <= m.band[1], m.says);
  }

  // ── the envelope: the tip over the boom, the stick and the tool ──
  let reach = 0, low = Infinity, high = -Infinity, dump = -Infinity;
  if (digs) for (const b of span(R.boom, 60)) for (const t of span(R.tool, 8)) {
    let prev = null;
    for (const s of span(R.stick, 60)) {
      const p = tipAt({ boom: b, stick: s, tool: t });
      if (p[2] < low) low = p[2];
      if (p[2] > high) high = p[2];
      if (prev && (prev[2] > 0) !== (p[2] > 0)) { const f = prev[2] / (prev[2] - p[2]); reach = Math.max(reach, prev[1] + (p[1] - prev[1]) * f); }
      prev = p;
    }
  }
  // (dumping: the bucket opened until its teeth hang plumb under its pin, wherever its tool's range lets them)
  const toolPin = digs ? ctx.hp(tipBody, 'pin') : null, hang = digs ? Math.hypot(tipLocal[1] - toolPin[1], tipLocal[2] - toolPin[2]) : 0;
  if (digs) for (const b of span(R.boom, 60)) for (const s of span(R.stick, 60)) {
    const lean = Math.atan2(tipLocal[2] - toolPin[2], tipLocal[1] - toolPin[1]) * 180 / Math.PI, t = -90 - (b + s) - lean;
    if (t < R.tool[0] || t > R.tool[1]) continue;
    const p = tipAt({ boom: b, stick: s, tool: t });
    if (p[2] > dump) dump = p[2];
  }
  void hang;
  const envelope = digs ? { reach: r2(reach), depth: r2(-low), cutHeight: r2(high), dumpHeight: r2(dump) } : null;
  for (const [id, says] of [['reach', 'its tip\'s farthest along the ground'], ['depth', 'its tip\'s lowest below the ground'], ['dumpHeight', 'its tip\'s highest with the bucket opened to dump, its teeth plumb under its pin'], ['cutHeight', 'its tip\'s highest']]) {
    const b = band[id];
    if (b && envelope) { const v = envelope[id]; law(id, v, b, v >= b[0] && v <= b[1], says); }
  }

  // ── the tail: the counterweight's swing, as built ──
  const rest = framesOf(arch, { slew: 0 }, ctx), cw = arch.layout.find((e) => ctx.row(e.sku).kind === 'con-counterweight');
  if (cw && band.tail) {
    const tail = r2(Math.max(...corners(cw.sku).map((p) => { const q = apply(rest[cw.id], p); return Math.hypot(q[0], q[1]); })));
    law('tail', tail, band.tail, tail >= band.tail[0] && tail <= band.tail[1], 'its counterweight\'s swing about the slew axis');
  }

  // ── the ground pressure: the class's mass on its tracks ──
  const under = arch.layout.find((e) => ctx.row(e.sku).kind === 'con-undercarriage'), shoe = under && ctx.row(under.sku).dims.shoe;
  if (shoe && band.groundPressure) {
    const kPa = r1((physics.mass * G) / (2 * shoe * physics.wheelbase) / 1000);
    law('groundPressure', kPa, band.groundPressure, kPa >= band.groundPressure[0] && kPa <= band.groundPressure[1], 'its mass on its tracks\' length on the ground');
  }

  // ── the mass: every part's ──
  const count = (e) => (e.pair ? 2 : 1);
  const mass = arch.layout.reduce((s, e) => s + ctx.row(e.sku).mass * count(e), 0);
  const off = Math.abs(mass - physics.mass) / physics.mass;
  law('mass', Math.round(mass), [Math.round(physics.mass * (1 - band.mass)), Math.round(physics.mass * (1 + band.mass))], off <= band.mass, 'its parts\' mass against its class\'s');

  // ── the rated lift over the side ──
  if (band.lift && digs) {
    const pin = ctx.hp('stick', 'tip'), at = (j) => apply(framesOf(arch, { slew: 0, ...j }, ctx).stick, pin);
    const tool = (R.tool[0] + R.tool[1]) / 2, want = [6, 1.5];
    let best = null;
    const tryAt = (b, s) => { const p = at({ boom: b, stick: s, tool }), e = (p[1] - want[0]) ** 2 + (p[2] - want[1]) ** 2; if (!best || e < best.e) best = { b, s, e }; };
    for (const b of span(R.boom, 120)) for (const s of span(R.stick, 140)) tryAt(b, s);
    for (let k = 0; k < 3; k++) { const c = { ...best }, w = 2 / (k + 1) ** 2; for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) tryAt(Math.max(R.boom[0], Math.min(R.boom[1], c.b + (w * i) / 10)), Math.max(R.stick[0], Math.min(R.stick[1], c.s + (w * j) / 10))); }
    const chain = solveChain(arch, { slew: 90, boom: best.b, stick: best.s, tool }, ctx);
    const gauge = physics.track, line = -gauge / 2, loadX = apply(chain.frames.stick, pin)[0];
    let M = 0;
    for (const e of arch.layout) {
      if (e.ram || e.link) continue;
      const pts = corners(e.sku), c = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);
      M += ctx.row(e.sku).mass * count(e) * (apply(chain.frames[e.id], c)[0] - line);
    }
    for (const s of chain.struts) {
      const e = ctx.entry(s.id), m = ctx.row(e.sku).mass / (e.ram ? 2 : 1), mid = apply(s.frame, [0, s.length / 2, 0]);
      M += m * (mid[0] - line);
    }
    const tips = M / (line - loadX), rated = r1((0.75 * tips) / 1000);
    law('lift', rated, band.lift, rated >= band.lift[0] && rated <= band.lift[1], 'its rated load over the side at 6 m (75% of tipping about its track)');
  }

  // ── the clearance: the tool never in the cab ──
  const cab = arch.layout.find((e) => ctx.row(e.sku).kind === 'con-cab'), tool = arch.layout.find((e) => e.joint === 'tool');
  if (cab && tool) {
    const box = corners(cab.sku).map((p) => apply(rest[cab.id], p)), lo = [0, 1, 2].map((k) => Math.min(...box.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...box.map((p) => p[k])));
    const w = ctx.row(tool.sku).dims.width ?? 0, pts = (ctx.outline(tool.id) ?? [tipLocal]).flatMap((p) => [[p[0] - w / 2, p[1], p[2]], [p[0] + w / 2, p[1], p[2]]]);
    // (over every joint that carries the tool; a slew and a hitch held where they rest, the cab turning with them)
    const moving = Object.keys(R).filter((k) => R[k] && arch.joints[k].kind !== 'slew'), base = posed('rest');
    let combos = [{}];
    for (const k of moving) combos = combos.flatMap((c) => span(R[k], k === 'tool' ? 6 : moving.length > 3 ? 10 : 24).map((v) => ({ ...c, [k]: v })));
    let hit = 0;
    for (const c of combos) {
      const F = framesOf(arch, { ...base, ...c }, ctx)[tool.id];
      if (pts.some((p) => { const q = apply(F, p); return q.every((v, k) => v > lo[k] && v < hi[k]); })) { hit++; if (process.env.CON_DEBUG) console.log('cab hit', JSON.stringify(c)); }
    }
    law('clearance', hit, [0, 0], hit === 0, 'its tool never enters its cab over its joints\' ranges');
  }

  // ── the transport size: folded to travel ──
  if (band.transport && arch.poses.transport) {
    const F = framesOf(arch, posed('transport'), ctx), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const e of arch.layout) {
      if (e.ram || e.link) continue;
      for (const p of corners(e.sku)) { const q = apply(F[e.id], p); for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; } }
    }
    const W = r2(hi[0] - lo[0]), H = r2(hi[2] - Math.max(0, lo[2]));
    law('transport', { W, H }, band.transport, W <= band.transport.W && H <= band.transport.H, 'its width and its height folded for shipping, within a road\'s (advisory)');
  }

  const out = { ok: laws.every((l) => l.ok), laws, envelope, mass: Math.round(mass) };
  CACHE.set(arch.key, out);
  return out;
}
