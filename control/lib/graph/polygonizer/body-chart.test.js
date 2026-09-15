// body charts — the figure's rings as measured (u, v) surfaces + the tailor's tape.
import { describe, expect, it } from 'vitest';

import { buildBodyCharts, bodyGirths, chartPoint, chartPointAtArc, chartGirthAt, crestZAt, rowRing, liftChartCap, pushOutsideTube, resolveU, resolveV, CHART_IDS, U_LINES } from './body-chart.js';
import { buildProtoform } from './figure-proto.js';
import { articulate } from './figure-vajra.js';

const body = (proto = {}) => buildProtoform(articulate({}), proto);

describe('buildBodyCharts', () => {
  it('builds a chart per body region the figure has, rows top → bottom', () => {
    const { charts, worldPerCm, height } = buildBodyCharts(body(), { stature_cm: 170 });
    for (const id of CHART_IDS) expect(charts[id], id).toBeTruthy();
    expect(height).toBeGreaterThan(0);
    expect(worldPerCm).toBeCloseTo(height / 170, 9);
    const t = charts.trunk;
    expect(t.mode).toBe('hull');
    for (let i = 1; i < t.rows.length; i++) expect(t.rows[i].center.z).toBeLessThan(t.rows[i - 1].center.z);
    expect(t.vArc[0]).toBe(0);
    expect(t.vTotal).toBeGreaterThan(0);
    for (const row of t.rows) {
      expect(row.girth).toBeGreaterThan(0);
      expect(row.arc.length).toBe(row.pts.length + 1);
      expect(row.arc[row.pts.length]).toBeCloseTo(row.girth, 9);
    }
  });

  it('is deterministic — the same body yields byte-identical charts', () => {
    const a = buildBodyCharts(body({ sex: 'female' }), { stature_cm: 165 });
    const b = buildBodyCharts(body({ sex: 'female' }), { stature_cm: 165 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('u = 0 is the front, 0.5 the back, 0.25 the figure\'s right; landmarks sit in order', () => {
    const { charts } = buildBodyCharts(body(), { stature_cm: 170 });
    const t = charts.trunk, v = t.landmarks.bust;
    const front = chartPoint(t, 0, v), back = chartPoint(t, 0.5, v), right = chartPoint(t, 0.25, v);
    expect(front.p.y).toBeGreaterThan(back.p.y);
    expect(right.p.x).toBeGreaterThan(Math.abs(right.p.y));
    expect(front.out.y).toBeGreaterThan(0.5);
    const lm = t.landmarks;
    expect(lm.top).toBe(0); expect(lm.bottom).toBe(1);
    expect(lm.collar).toBeLessThan(lm.bust);
    expect(lm.bust).toBeLessThan(lm.waist);
    expect(lm.waist).toBeLessThan(lm.hip);
    // the along-arc placement agrees with the fraction placement
    const byArc = chartPointAtArc(t, null, v * t.vTotal, 0);
    expect(byArc.p).toEqual(front.p);
    expect(byArc.clipped).toBe(false);
    expect(chartPointAtArc(t, 0, -1, 0).clipped).toBe(true);
    const below = chartPointAtArc(t, 0, t.vTotal + 1, 0);   // below the last row the cloth hangs on, straight down
    expect(below.clipped).toBe(false); expect(below.hung).toBeCloseTo(1, 9);
    expect(below.p.z).toBeCloseTo(chartPointAtArc(t, 0, t.vTotal, 0).p.z - 1, 6);
  });

  it('arc-length placement is faithful: two points 10 cm apart around a row are 10 cm apart along it', () => {
    const { charts, worldPerCm } = buildBodyCharts(body(), { stature_cm: 170 });
    const t = charts.trunk, v = t.landmarks.waist, along = v * t.vTotal;
    const a = chartPointAtArc(t, 0, along, 0), b = chartPointAtArc(t, 10 * worldPerCm, along, 0);
    // walk the row between them: chord ≤ arc, and the arc is what was asked for
    const chord = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y, b.p.z - a.p.z) / worldPerCm;
    expect(chord).toBeGreaterThan(8);
    expect(chord).toBeLessThanOrEqual(10.0001);
    // wrapping: −1 cm from the front lands just left of the front
    const w = chartPointAtArc(t, -1 * worldPerCm, along, 0);
    expect(w.p.x).toBeLessThan(a.p.x);
  });

  it('tube charts re-index every ring to start at the front and grow along the limb', () => {
    const { charts } = buildBodyCharts(body(), { stature_cm: 170 });
    const a = charts.armL;
    expect(a.mode).toBe('tube');
    expect(a.landmarks.elbow).toBeGreaterThan(0.3);
    expect(a.landmarks.elbow).toBeLessThan(0.7);
    expect(a.landmarks.shoulder).toBeGreaterThanOrEqual(0); expect(a.landmarks.shoulder).toBeLessThan(0.35);
    expect(charts.legL.landmarks.thigh).toBeLessThan(0.35);
    for (const row of a.rows) {
      const p0 = row.pts[0], c = row.center;
      expect(p0.y - c.y).toBeGreaterThan(-1e-6);   // the first vertex faces forward (+y) or straight out
    }
    expect(chartGirthAt(a, 0.15)).toBeGreaterThan(chartGirthAt(a, 0.98));   // the upper arm is thicker than the wrist
  });

  it('resolves named u lines and v landmarks, refuses unknown ones', () => {
    const { charts } = buildBodyCharts(body(), { stature_cm: 170 });
    expect(resolveU('cf')).toBe(0); expect(resolveU('cb')).toBe(0.5); expect(resolveU('sideR')).toBe(U_LINES.sideR);
    expect(resolveU(1.25)).toBeCloseTo(0.25, 9); expect(resolveU('elsewhere')).toBeNull();
    expect(resolveV(charts.trunk, 'waist')).toBe(charts.trunk.landmarks.waist);
    expect(resolveV(charts.trunk, 0.3)).toBe(0.3); expect(resolveV(charts.trunk, 'shin')).toBeNull();
  });
});

describe('bodyGirths — the tailor\'s tape', () => {
  it('reads bust / waist / hip in cm and they order like a body', () => {
    const g = bodyGirths(body({ sex: 'female' }), { stature_cm: 165 });
    expect(g.stature_cm).toBe(165);
    for (const k of ['bust', 'waist', 'hip', 'neck', 'upperArm', 'wrist', 'thigh', 'ankle', 'arm_length', 'inseam']) expect(g[k], k).toBeGreaterThan(0);
    expect(g.waist).toBeLessThan(g.bust);
    expect(g.waist).toBeLessThan(g.hip);
    expect(g.wrist).toBeLessThan(g.upperArm);
    expect(g.ankle).toBeLessThan(g.thigh);
    expect(g.neck).toBeLessThan(g.bust);
  });

  it('tracks the dimorph dials — the two poles read different tapes at the same stature', () => {
    const f = bodyGirths(body({ sex: 'female' }), { stature_cm: 170 });
    const m = bodyGirths(body({ sex: 'male' }), { stature_cm: 170 });
    expect(f.bust).not.toBe(m.bust);
    expect(f.hip / f.bust).toBeGreaterThan(m.hip / m.bust);   // DIMORPH.female: hip 1.16, ribW 0.90
    expect(f.upperArm).toBeLessThan(m.upperArm);              // limb 0.82
  });

  it('scales with stature — the same body at 180 cm reads bigger than at 160 cm by 180/160', () => {
    const a = bodyGirths(body(), { stature_cm: 160 }), b = bodyGirths(body(), { stature_cm: 180 });
    expect(b.bust / a.bust).toBeCloseTo(180 / 160, 1);
  });
});

describe('the cap — the trunk chart\'s shoulder line (outfit P6)', () => {
  const b = body({ sex: 'female' });
  const { charts, worldPerCm } = buildBodyCharts(b, { stature_cm: 170 });
  const t = charts.trunk;
  const yokeTop = Math.max(...b.find((s) => s.id === 'shoulderYoke').rings.flatMap((rg) => rg.polyline.map((p) => p.z)));

  it('closes the trunk over the yoke: the first row is the crest at the flesh\'s top, cap rows carry t, no other chart has one', () => {
    expect(t.cap).toBeTruthy(); expect(t.cap.rows).toBe(4);
    expect(t.rows[0].cap).toBe(1); expect(t.rows[1].cap).toBe(0.75); expect(t.rows[t.cap.rows].cap).toBeUndefined();
    expect(Math.max(...t.cap.crest.map((c) => c[1]))).toBeCloseTo(yokeTop, 1);
    expect(t.rows[0].center.z).toBeGreaterThan(yokeTop - 0.6 * worldPerCm);
    expect(t.rows[0].center.z).toBeGreaterThan(t.rows[1].center.z);
    expect(crestZAt(t, t.cap.cx + t.cap.W)).toBeCloseTo(yokeTop, 1);   // the acromion end of the crest is the yoke's top
    expect(crestZAt(t, t.cap.cx + 3 * t.cap.W)).toBeNull();
    for (const id of ['armL', 'armR', 'legL', 'legR', 'neck']) { expect(charts[id].cap).toBeUndefined(); for (const row of charts[id].rows) expect(row.cap).toBeUndefined(); }
  });

  it('the crest is the shoulder line walked there and back: u = 0.25 is the acromion, the stand-off there is UP, below the cap it is radial', () => {
    const tip = chartPointAtArc(t, null, 0, 0.25);
    expect(tip.p.x).toBeCloseTo(t.cap.cx + t.cap.W, 3);
    expect(Math.abs(tip.p.y - t.cap.cy)).toBeLessThan(1e-3);
    // the crest ring carries the neck's base: u = 0 is the front of the neck, a neck radius off the centre
    expect(t.cap.rn).toBeGreaterThan(0);
    const front = chartPointAtArc(t, null, 0, 0);
    expect(front.p.y - t.cap.cy).toBeCloseTo(t.cap.rn, 6);
    expect(tip.out.z).toBeCloseTo(1, 6); expect(tip.cap).toBe(1);
    // cloth rests on the crest: the ease scale is rest / ease
    expect(chartPointAtArc(t, null, 0, 0.25, { ease: 3, rest: 1 }).easeScale).toBeCloseTo(1 / 3, 9);
    expect(chartPointAtArc(t, null, 0, 0.25, { ease: 1, rest: 1 }).easeScale).toBeCloseTo(1, 9);
    const side = chartPointAtArc(t, null, t.vArc[t.cap.rows], 0.25);
    expect(Math.abs(side.out.z)).toBeLessThan(1e-6); expect(side.cap).toBe(0); expect(side.easeScale).toBe(1);
    // the cap's along-arc is the surface's over the shoulder (centimetres), not its height (millimetres)
    expect(t.vArc[t.cap.rows] / worldPerCm).toBeGreaterThan(3);
    expect((t.rows[0].center.z - t.rows[t.cap.rows].center.z) / worldPerCm).toBeLessThan(1.5);
    expect(t.landmarks.yoke).toBeCloseTo(t.vArc[t.cap.rows] / t.vTotal, 9);
    expect(t.landmarks.yoke).toBeLessThan(t.landmarks.collar);
  });

  it('rowRing shrinks the ease ring with the cap parameter; liftChartCap raises the cap by a worn stack\'s height above the crest', () => {
    const e = 2 * worldPerCm;
    expect(rowRing(t.rows[0], e)).toBeCloseTo(t.rows[0].girth, 9);
    expect(rowRing(t.rows[t.cap.rows], e)).toBeCloseTo(t.rows[t.cap.rows].girth + 2 * Math.PI * e, 9);
    const z = crestZAt(t, t.cap.cx) + 3 * worldPerCm;
    const hat = { id: 'hat', rings: [{ center: { x: t.cap.cx, y: t.cap.cy, z }, polyline: [{ x: t.cap.cx, y: t.cap.cy, z }, { x: t.cap.cx, y: t.cap.cy - 0.1, z }, { x: t.cap.cx, y: t.cap.cy + 0.1, z }] }] };   // one x, so the crest height under it is one value
    const lifted = liftChartCap(t, [hat]);
    expect(lifted.cap.lift).toBeCloseTo(3 * worldPerCm, 9);
    expect(lifted.rows[0].center.z - t.rows[0].center.z).toBeCloseTo(3 * worldPerCm, 9);
    expect(lifted.rows[t.cap.rows]).toBe(t.rows[t.cap.rows]);   // the hull rows are untouched
    expect(crestZAt(lifted, t.cap.cx) - crestZAt(t, t.cap.cx)).toBeCloseTo(3 * worldPerCm, 9);
    expect(liftChartCap(t, [])).toBe(t);
    const low = { ...hat, rings: [{ ...hat.rings[0], polyline: hat.rings[0].polyline.map((p) => ({ ...p, z: p.z - 10 * worldPerCm })) }] };
    expect(liftChartCap(t, [low])).toBe(t);
    expect(liftChartCap(charts.armL, [hat])).toBe(charts.armL);
  });

  // THE FOOT CHART (footwear P1) — a tube laid across gravity, rows heel → toe.
  it('the foot is a tube chart whose rows run heel → toe, u = 0 the instep and u = 0.5 the sole', () => {
    for (const id of ['footL', 'footR']) {
      const f = charts[id];
      expect(f, id).toBeTruthy();
      expect(f.mode).toBe('tube');
      expect(f.rows.length).toBeGreaterThan(2);
      expect(f.vTotal).toBeGreaterThan(0);
      // the chart runs FORWARD, not down: the toe end is further +y than the heel end, and the
      // two ends sit within a couple of centimetres of the same height (the sole is flat)
      const heel = f.rows[0].center, toe = f.rows[f.rows.length - 1].center;
      expect(toe.y).toBeGreaterThan(heel.y);
      expect(Math.abs(toe.y - heel.y)).toBeGreaterThan(Math.abs(toe.z - heel.z));
      // u = 0 points UP off the instep, u = 0.5 DOWN off the sole, and the instep is above the sole
      const v = f.landmarks.ball;
      const up = chartPoint(f, 0, v), down = chartPoint(f, 0.5, v);
      expect(up.out.z).toBeGreaterThan(0.5);
      expect(down.out.z).toBeLessThan(-0.5);
      expect(up.p.z).toBeGreaterThan(down.p.z);
    }
  });

  it('the foot\'s landmarks are read off the tape: instep and ball are full, the arch between them is narrow', () => {
    const f = charts.footL, lm = f.landmarks, g = (v) => chartGirthAt(f, v);
    expect(lm.heel).toBe(0);
    expect(lm.toe).toBe(1);
    // heel < instep < arch < ball < toe, in order along the foot
    expect(lm.instep).toBeGreaterThan(0);
    expect(lm.arch).toBeGreaterThan(lm.instep);
    expect(lm.ball).toBeGreaterThan(lm.arch);
    expect(lm.ball).toBeLessThan(1);
    // the arch is where the tape reads smallest between the two full rows — that IS its definition
    expect(g(lm.arch)).toBeLessThan(g(lm.instep));
    expect(g(lm.arch)).toBeLessThan(g(lm.ball));
  });

  it('the tape reads the foot: ball, instep and foot_length, on a body that has feet', () => {
    const g = bodyGirths(body(), { stature_cm: 170 });
    expect(g.ball).toBeGreaterThan(0);
    expect(g.instep).toBeGreaterThan(0);
    expect(g.foot_length).toBeGreaterThan(0);
    // a footless body reports null/absent rather than throwing
    const noFeet = body().filter((s) => !/^foot/.test(s.id));
    const gn = bodyGirths(noFeet, { stature_cm: 170 });
    expect(gn.ball).toBeNull();
    expect(gn.instep).toBeNull();
    expect(gn.foot_length).toBeUndefined();
  });

  it('pushOutsideTube moves a point inside the neck out to its skin plus the margin and leaves clear points alone', () => {
    const n = charts.neck, row = n.rows[Math.floor(n.rows.length / 2)];
    const inside = { x: row.center.x + 0.01, y: row.center.y, z: row.center.z };
    const out = pushOutsideTube(n, inside, 0.05);
    const r = Math.hypot(out.x - row.center.x, out.y - row.center.y);
    expect(r).toBeGreaterThan(0.05); expect(out.z).toBe(inside.z);
    const far = { x: row.center.x + 5, y: row.center.y, z: row.center.z };
    expect(pushOutsideTube(n, far, 0.05)).toBe(far);
    const above = { ...inside, z: n.rows[0].center.z + 5 };
    expect(pushOutsideTube(n, above, 0.05)).toBe(above);
  });
});
