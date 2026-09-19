/**
 * THE LIMBS' MASS — the axes the arm and the leg could not reach, and weight's share of them.
 *
 * `bicep` and `quad` read as girth dials and are not: both scale lobes that add into the limb's
 * FORE/AFT radius, and the lateral radius was bare `baseR`, which nothing reached. Measured before
 * the fix: `bicep: 2` moved the upper arm's x-span by ×1.000 and its y-span by ×1.363; `quad: 2`
 * moved the thigh's x-span by ×1.000. So a heavy arm and a lean arm were the same width head-on —
 * only the profile ever moved. (`forearm` and `calf` escape it: they ride the ring radius itself.)
 *
 * That was also why `proto.weight` stopped at the trunk. The limbs' whole lateral response was the
 * `stockiness` gain applied last, so across weight 0.7 → 2.0 the bust ran ×1.371 and the waist
 * ×1.721 while the upper arm managed ×1.209 — `upperArm/bust` fell 0.388 → 0.342 and `thigh/hip`
 * fell 0.504 → 0.474. A heavier figure read as a heavier TRUNK on the same limbs.
 *
 *   1. the absent channel: every new dial at its default is byte-identical to not passing it;
 *   2. each dial moves its own stacks and no others;
 *   3. width moves width and NOT depth, and the fore/aft dials still move depth alone;
 *   4. the posterior and medial lobes are separable from the anterior ones (fat shape vs muscle);
 *   5. the joint caps take a dial at all;
 *   6. THE GATE: upperArm/bust and thigh/hip hold across the weight range, on both poles.
 */
import { describe, expect, it } from 'vitest';

import { buildPosedFigure, renderFigureToSvg } from './figure-render.js';
import { bodyGirths } from './body-chart.js';
import { PROTO_DEFAULT, WEIGHT_GAIN } from './figure-proto.js';

const NEW_DIALS = ['armWidth', 'tricep', 'thighWidth', 'hamstring', 'adductor', 'deltoid', 'elbowCap'];

// ONE build per distinct proto, and one render per distinct argument, reused by every assertion in
// the file. Both builders are deterministic by construction — seeded dice only, no clock — so a
// repeat call cannot return anything different, and nothing asserted here changes. What changes is
// the clock: this file rebuilt the whole figure on every helper call, at roughly 0.5-8s each, which
// is what carried it past the suite's 30s per-test ceiling under full parallel load and flaked it
// as a timeout rather than a failure. Measured: 71s alone before, and the slowest single test was
// 8.4s. Keep new assertions going through `posed` / `svg` so they stay on the cache.
const POSED = new Map();
const posed = (proto) => {
  const k = JSON.stringify(proto);
  if (!POSED.has(k)) POSED.set(k, buildPosedFigure({}, proto, null));
  return POSED.get(k);
};
const SVG = new Map();
const svg = (args) => {
  const k = JSON.stringify(args);
  if (!SVG.has(k)) SVG.set(k, renderFigureToSvg(args));
  return SVG.get(k);
};

// ONE ring at a fraction along a limb stack. A band would not do — the limb tapers, so a band's
// extent is the max over rings with different centres and is not linear in a dial even when every
// ring is. (The lesson figure-torso.test.js paid for three times.)
const ringAt = (proto, id, frac) => {
  const st = posed(proto).find((s) => s.id === id);
  return st.rings[Math.round(frac * (st.rings.length - 1))];
};
const span = (ring, ax) => Math.max(...ring.polyline.map((q) => q[ax])) - Math.min(...ring.polyline.map((q) => q[ax]));
const xAt = (proto, id, frac) => span(ringAt(proto, id, frac), 'x');
const yAt = (proto, id, frac) => span(ringAt(proto, id, frac), 'y');
// the bellies — where each lobe actually peaks
const ARM = 0.45, THIGH = 0.30, CALF = 0.68;

describe('the absent channel', () => {
  it('every new dial is declared at its canonical default', () => {
    for (const d of NEW_DIALS) expect(PROTO_DEFAULT[d]).toBe(1);
  });

  it('a dial at its default is byte-identical to not passing it, on both poles', () => {
    for (const sex of ['male', 'female']) {
      const bare = svg({ proto: { sex } });
      for (const d of NEW_DIALS) expect(svg({ proto: { sex, [d]: 1 } })).toBe(bare);
      const all = Object.fromEntries(NEW_DIALS.map((d) => [d, 1]));
      expect(svg({ proto: { sex, ...all } })).toBe(bare);
    }
  });
});

describe('each dial moves its own stacks and no others', () => {
  const stacksOf = (proto) => Object.fromEntries(posed(proto).map((s) => [s.id, JSON.stringify(s.rings)]));
  const base = stacksOf({});
  const movedBy = (proto) => Object.keys(base).filter((k) => base[k] !== stacksOf(proto)[k]);

  it.each([
    ['armWidth', ['upperArmL', 'upperArmR']],
    ['tricep', ['upperArmL', 'upperArmR']],
    ['thighWidth', ['legL', 'legR']],
    ['hamstring', ['legL', 'legR']],
    ['adductor', ['legL', 'legR']],
    ['deltoid', ['deltoidL', 'deltoidR']],
    ['elbowCap', ['elbowCapL', 'elbowCapR']],
  ])('%s moves exactly %j', (dial, stacks) => {
    expect(movedBy({ [dial]: 1.6 }).sort()).toEqual([...stacks].sort());
  });
});

describe('width moves width, depth moves depth', () => {
  it('armWidth widens the upper arm and leaves its fore/aft exactly alone', () => {
    const y0 = yAt({}, 'upperArmL', ARM), x0 = xAt({}, 'upperArmL', ARM);
    for (const k of [0.6, 1.4, 2]) {
      expect(yAt({ armWidth: k }, 'upperArmL', ARM)).toBeCloseTo(y0, 12);
      expect(xAt({ armWidth: k }, 'upperArmL', ARM)).not.toBeCloseTo(x0, 4);
    }
    // it grows with the dial, and monotonically
    expect(xAt({ armWidth: 0.6 }, 'upperArmL', ARM)).toBeLessThan(x0);
    expect(xAt({ armWidth: 2 }, 'upperArmL', ARM)).toBeGreaterThan(x0 * 1.8);
  });

  it('bicep still moves the fore/aft alone — the behaviour every stored recipe reads', () => {
    const x0 = xAt({}, 'upperArmL', ARM);
    for (const k of [0.6, 1.4, 2]) expect(xAt({ bicep: k }, 'upperArmL', ARM)).toBeCloseTo(x0, 12);
    expect(yAt({ bicep: 2 }, 'upperArmL', ARM)).toBeGreaterThan(yAt({}, 'upperArmL', ARM) * 1.3);
  });

  it('armWidth eases at the elbow so the cap still covers the joint', () => {
    const belly = xAt({ armWidth: 2 }, 'upperArmL', ARM) / xAt({}, 'upperArmL', ARM);
    const elbow = xAt({ armWidth: 2 }, 'upperArmL', 0.95) / xAt({}, 'upperArmL', 0.95);
    expect(elbow).toBeLessThan(belly);
    expect(elbow).toBeGreaterThan(1);
  });

  it('thighWidth widens the thigh and leaves its fore/aft exactly alone', () => {
    const y0 = yAt({}, 'legL', THIGH);
    for (const k of [0.6, 1.4, 2]) expect(yAt({ thighWidth: k }, 'legL', THIGH)).toBeCloseTo(y0, 12);
    expect(xAt({ thighWidth: 2 }, 'legL', THIGH)).toBeCloseTo(xAt({}, 'legL', THIGH) * 2, 3);
  });

  it('quad still moves the fore/aft alone', () => {
    const x0 = xAt({}, 'legL', THIGH);
    for (const k of [0.6, 1.4, 2]) expect(xAt({ quad: k }, 'legL', THIGH)).toBeCloseTo(x0, 12);
  });

  it('thighWidth stays out of the calf, which is calf’s job', () => {
    // the thigh profile has a gaussian tail, so this is small-but-not-zero by construction:
    // measured 7.1 % at the extreme 2, 1.4 % at 1.2, and ~1 % at the value weight itself reaches
    // (1 + 0.14 at weight 2). Small enough that `calf` still owns the lower leg.
    const leak = xAt({ thighWidth: 2 }, 'legL', CALF) / xAt({}, 'legL', CALF);
    expect(leak).toBeGreaterThan(1);
    expect(leak).toBeLessThan(1.10);
    expect(xAt({ thighWidth: 1.2 }, 'legL', CALF) / xAt({}, 'legL', CALF)).toBeLessThan(1.02);
  });
});

describe('fat shape and muscle shape are different shapes', () => {
  // The figure faces +y, so the anterior half of a limb ring is +y and the posterior half is −y.
  const backOf = (proto, id, frac) => {
    const r = ringAt(proto, id, frac);
    return r.center.y - Math.min(...r.polyline.map((q) => q.y));
  };
  const frontOf = (proto, id, frac) => {
    const r = ringAt(proto, id, frac);
    return Math.max(...r.polyline.map((q) => q.y)) - r.center.y;
  };

  it('tricep fills the BACK of the arm without touching the front', () => {
    expect(frontOf({ tricep: 2 }, 'upperArmL', ARM)).toBeCloseTo(frontOf({}, 'upperArmL', ARM), 12);
    expect(backOf({ tricep: 2 }, 'upperArmL', ARM)).toBeGreaterThan(backOf({}, 'upperArmL', ARM) * 1.2);
  });

  it('bicep drives BOTH lobes, as it always has, and tricep rides on top of it', () => {
    expect(frontOf({ bicep: 2 }, 'upperArmL', ARM)).toBeGreaterThan(frontOf({}, 'upperArmL', ARM));
    expect(backOf({ bicep: 2 }, 'upperArmL', ARM)).toBeGreaterThan(backOf({}, 'upperArmL', ARM));
    expect(backOf({ bicep: 2, tricep: 1.5 }, 'upperArmL', ARM)).toBeGreaterThan(backOf({ bicep: 2 }, 'upperArmL', ARM));
  });

  it('hamstring fills the back of the thigh, adductor the inside, and they are separable', () => {
    const b0 = backOf({}, 'legL', THIGH);
    expect(backOf({ hamstring: 2 }, 'legL', THIGH)).toBeGreaterThan(b0);
    expect(frontOf({ hamstring: 2 }, 'legL', THIGH)).toBeCloseTo(frontOf({}, 'legL', THIGH), 12);
    // the adductor is the MEDIAL side: on the left leg (−x) that is the +x half of the ring
    const medOf = (proto) => {
      const r = ringAt(proto, 'legL', THIGH);
      return Math.max(...r.polyline.map((q) => q.x)) - r.center.x;
    };
    expect(medOf({ adductor: 2 })).toBeGreaterThan(medOf({}));
    expect(medOf({ hamstring: 2 })).toBeGreaterThan(medOf({}));   // the ham lobe reaches medially too
  });
});

describe('the joints take a dial', () => {
  const extentOf = (proto, id, ax) => {
    const st = posed(proto).find((s) => s.id === id);
    const all = st.rings.flatMap((r) => r.polyline);
    return Math.max(...all.map((q) => q[ax])) - Math.min(...all.map((q) => q[ax]));
  };

  it('deltoid scales the shoulder cap on every axis', () => {
    for (const ax of ['x', 'y', 'z']) {
      expect(extentOf({ deltoid: 1.5 }, 'deltoidL', ax)).toBeCloseTo(extentOf({}, 'deltoidL', ax) * 1.5, 6);
    }
  });

  it('elbowCap scales the hinge cap', () => {
    expect(extentOf({ elbowCap: 1.5 }, 'elbowCapL', 'z')).toBeCloseTo(extentOf({}, 'elbowCapL', 'z') * 1.5, 6);
  });

  it('a cap grows ONCE — the dial sizes it, the pole places it', () => {
    // the centre of the cap must not move with the dial (the seat's lesson: radius AND centre is
    // quadratic and builds a ball bolted to a joint)
    const centreOf = (proto, id) => posed(proto).find((s) => s.id === id).rings[0].center;
    for (const [id, dial] of [['deltoidL', 'deltoid'], ['elbowCapL', 'elbowCap']]) {
      const a = centreOf({}, id), b = centreOf({ [dial]: 2 }, id);
      expect(b.x).toBeCloseTo(a.x, 12);
      expect(b.y).toBeCloseTo(a.y, 12);
    }
  });
});

describe('weight reaches the limbs — the ratio gate', () => {
  // Mass going ON. The range stops at 1 deliberately: below it the HIP girth is not monotonic in
  // weight (see the pinned defect at the foot of this file), so a ratio against it measures the
  // denominator's bug and not the limb.
  const WEIGHTS = [1, 1.15, 1.3, 1.6, 2];
  const girths = (sex, weight) => bodyGirths(posed({ sex, weight }));

  it('every new limb dial has a weight gain — an axis that weight cannot reach is not wired in', () => {
    for (const d of NEW_DIALS) expect(WEIGHT_GAIN[d]).toBeGreaterThan(0);
  });

  it.each(['male', 'female'])('upperArm/bust holds across the weight range (%s)', (sex) => {
    const at1 = girths(sex, 1);
    const ref = at1.upperArm / at1.bust;
    for (const w of WEIGHTS) {
      const g = girths(sex, w);
      // Before the limb axes existed this drifted to −11.8 % (male) / −14.2 % (female) at
      // weight 2: the trunk grew and the arm did not.
      expect(Math.abs((g.upperArm / g.bust) / ref - 1)).toBeLessThan(0.05);
    }
  });

  it.each(['male', 'female'])('thigh/hip holds or rises across the weight range (%s)', (sex) => {
    const at1 = girths(sex, 1);
    const ref = at1.thigh / at1.hip;
    for (const w of WEIGHTS) {
      const g = girths(sex, w);
      const drift = (g.thigh / g.hip) / ref - 1;
      // the anthropometry says a thigh gains slightly FASTER than a hip, so the band is
      // asymmetric on purpose. It used to fall to −5.9 %.
      expect(drift).toBeGreaterThan(-0.04);
      expect(drift).toBeLessThan(0.09);
    }
  });

  it('the WRIST and the ANKLE still fall away — weight is proximal, and distal is bone', () => {
    const lean = girths('male', 1), heavy = girths('male', 2);
    expect(heavy.wrist / heavy.waist).toBeLessThan((lean.wrist / lean.waist) * 0.8);
    expect(heavy.ankle / heavy.hip).toBeLessThan(lean.ankle / lean.hip);
  });

  it('a heavy figure is wider from the FRONT, which is the view that never moved before', () => {
    const x1 = xAt({ weight: 1 }, 'upperArmL', ARM), x2 = xAt({ weight: 2 }, 'upperArmL', ARM);
    const t1 = xAt({ weight: 1 }, 'legL', THIGH), t2 = xAt({ weight: 2 }, 'legL', THIGH);
    expect(x2 / x1).toBeGreaterThan(1.25);
    expect(t2 / t1).toBeGreaterThan(1.25);
  });

  it('the operator’s own dials still multiply on top of what weight set', () => {
    const w = xAt({ weight: 1.6 }, 'upperArmL', ARM);
    expect(xAt({ weight: 1.6, armWidth: 1.4 }, 'upperArmL', ARM)).toBeGreaterThan(w * 1.3);
  });
});

/**
 * FOUND, NOT FIXED — and pinned so it cannot be lost.
 *
 * `bodyGirths` does not report the hip monotonically in weight below 1: 123.9 cm at 0.6, 122.9 at
 * 0.7, 118.2 at 0.85, then back UP to 121.4 at 1.0. A leaner figure can measure a BIGGER hip than
 * a slightly-lean one.
 *
 * It is the CHART, not the body, and not the explanation already recorded next door:
 *
 *   - the trunk's own lower geometry is strictly monotone across the same range — the widest
 *     lower-trunk ring runs 2.155 / 2.247 / 2.392 / 2.543 at weight 0.6 / 0.7 / 0.85 / 1.0, and
 *     keeps climbing to 4.672 at weight 2;
 *   - the hip LANDMARK does not migrate there either: v holds at 0.9001 / 0.9013 / 0.9004 / 0.9025
 *     over those same four weights. (figure-torso.test.js pins the hip series over wide steps and
 *     attributes the wobble to the landmark moving onto a neighbouring ring. That mechanism is
 *     real further up the range — v breaks to 0.882 by weight 1.6 — but it is NOT what is
 *     happening below 1.)
 *
 * So the wobble enters between the rings and the reported girth, which puts it in the chart's own
 * cross-section assembly, most likely in how the superposed glute and hip-cap masses fold in.
 * Unfixed here because it is `bodyGirths`' business, not the limbs', and every cut-and-sewn
 * garment reads that chart — moving it moves tailoring for every stored recipe.
 *
 * It is why the ratio gate above starts at weight 1: below that it would be measuring this.
 */
describe('the lean end — a chart-side wobble this plan did not touch', () => {
  const hip = (w) => bodyGirths(posed({ sex: 'male', weight: w })).hip;

  it('the reported hip girth is NOT monotonic in weight below 1', () => {
    expect(hip(0.85)).toBeLessThan(hip(0.6));    // leaner measures WIDER — the wobble
    expect(hip(0.85)).toBeLessThan(hip(1));
  });

  it('...while the trunk geometry under it is strictly monotone, so the body is fine', () => {
    const widestLower = (w) => {
      const st = posed({ sex: 'male', weight: w }).find((s) => s.id === 'trunk');
      const zs = st.rings.map((r) => r.center.z), lo = Math.min(...zs), hi = Math.max(...zs);
      let best = 0;
      for (const r of st.rings) {
        if (r.center.z > lo + 0.35 * (hi - lo)) continue;
        const xs = r.polyline.map((q) => q.x), ys = r.polyline.map((q) => q.y);
        best = Math.max(best, (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys)));
      }
      return best;
    };
    const series = [0.6, 0.7, 0.85, 1, 1.3, 2].map(widestLower);
    for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThan(series[i - 1]);
  });

  it('the thigh itself thins monotonically as the figure leans, which is correct', () => {
    const thigh = (w) => bodyGirths(posed({ sex: 'male', weight: w })).thigh;
    expect(thigh(0.6)).toBeLessThan(thigh(0.85));
    expect(thigh(0.85)).toBeLessThan(thigh(1));
  });
});

/**
 * THE DISTAL LIMB — the forearm and the calf, which had the OPPOSITE problem to the proximal one.
 *
 * `forearm` and `calf` never had the missing lateral axis: both ride the ring radius itself, so
 * `forearm: 2` moves the belly ×1.502 on x AND y, and `calf: 2` moves it ×1.354 / ×1.386. What they
 * could not do is say WHERE the mass sits or how thick the joint under it is:
 *
 *   - the forearm's belly crest was pinned at 0.400 for every dial and every weight;
 *   - the calf's crest was pinned at 0.488, against a knee trough at 0.442;
 *   - the ankle answered to nothing at all (`calf: 2` moved the measured ankle 1.3 %);
 *   - the wrist moved only as a SIDE EFFECT of `wristTaper`, which is a flattening dial.
 *
 * INSTRUMENT: a limb's landmarks are TURNING POINTS, not windowed extrema. A max taken over a
 * hand-picked window returns the window's edge as soon as the profile is monotone inside it, which
 * is how the knee first "measured" at 0.605 and again at 0.744 — both of them window bounds. The
 * helpers below walk the profile and find the crest and the trough by where it turns.
 */
describe('the distal limb — where the mass sits, and the joint under it', () => {
  const DISTAL = { forearmDrop: 0, wristGirth: 1, calfDrop: 0, ankleGirth: 1 };
  const girthOf = (ring) => {
    let L = 0;
    const p = ring.polyline;
    for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z);
    return L;
  };
  const profile = (proto, id) => posed(proto).find((s) => s.id === id).rings.map(girthOf);
  // the leg's three landmarks, by turning point: thigh crest → knee trough → calf crest
  const legMarks = (proto) => {
    const g = profile(proto, 'legL'), n = g.length, f = (i) => i / (n - 1);
    let ti = 0;
    for (let i = 1; i < n; i++) { if (g[i] >= g[ti]) ti = i; else break; }
    let ki = ti; while (ki + 1 < n && g[ki + 1] < g[ki]) ki++;
    let ci = ki; while (ci + 1 < n && g[ci + 1] > g[ci]) ci++;
    return { thigh: f(ti), knee: f(ki), calf: f(ci), calfGirth: g[ci] };
  };
  // The FOREARM needs the opposite instrument to the leg: it has TWO crests, because `elbowFill`
  // raises one at t ≈ 0.06 before the belly at 0.40. Walking to the first turning point stops on
  // the elbow every time (measured 0.16). The belly is the GLOBAL max, so that is what is taken —
  // the leg's calf is not (the thigh outranks it), which is why that one walks the turns instead.
  const armCrest = (proto) => {
    const g = profile(proto, 'forearmL'), n = g.length;
    let bi = 0;
    for (let i = 1; i < n; i++) if (g[i] > g[bi]) bi = i;
    return { at: bi / (n - 1), girth: g[bi] };
  };

  it('every distal dial is declared at its canonical default', () => {
    for (const [d, v] of Object.entries(DISTAL)) expect(PROTO_DEFAULT[d]).toBe(v);
  });

  it('a distal dial at its default is byte-identical to not passing it, on both poles', () => {
    for (const sex of ['male', 'female']) {
      const bare = svg({ proto: { sex } });
      for (const [d, v] of Object.entries(DISTAL)) expect(svg({ proto: { sex, [d]: v } })).toBe(bare);
      expect(svg({ proto: { sex, ...DISTAL } })).toBe(bare);
    }
  });

  it('each distal dial moves its own stacks and no others', () => {
    const stacksOf = (proto) => Object.fromEntries(posed(proto).map((s) => [s.id, JSON.stringify(s.rings)]));
    const base = stacksOf({});
    const moved = (proto) => Object.keys(base).filter((k) => base[k] !== stacksOf(proto)[k]).sort();
    expect(moved({ forearmDrop: 0.15 })).toEqual(['forearmL', 'forearmR']);
    expect(moved({ wristGirth: 1.5 })).toEqual(['forearmL', 'forearmR']);
    expect(moved({ calfDrop: 0.1 })).toEqual(['legL', 'legR']);
    expect(moved({ ankleGirth: 1.5 })).toEqual(['legL', 'legR']);
  });

  it('the canonical landmarks are where the fix assumed they were', () => {
    const m = legMarks({});
    expect(m.knee).toBeCloseTo(0.442, 2);
    expect(m.calf).toBeCloseTo(0.488, 2);
    expect(m.calf).toBeGreaterThan(m.knee);       // the calf crest is BELOW the knee trough
    expect(armCrest({}).at).toBeCloseTo(0.400, 2);
  });

  it('forearmDrop slides the forearm belly, in both directions', () => {
    expect(armCrest({ forearmDrop: 0.2 }).at).toBeGreaterThan(armCrest({}).at + 0.15);
    expect(armCrest({ forearmDrop: -0.2 }).at).toBeLessThan(armCrest({}).at - 0.15);
  });

  it('calfDrop slides the calf crest DOWN the shank, monotonically', () => {
    const at = [0, 0.02, 0.06, 0.08, 0.1, 0.12].map((d) => legMarks({ calfDrop: d }).calf);
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThanOrEqual(at[i - 1]);
    expect(at[at.length - 1]).toBeGreaterThan(at[0] + 0.1);
  });

  it('...and UPWARD it is bounded by the knee, because a gastroc does not sit above the joint', () => {
    // The crest cannot climb past the knee trough: negative values concentrate the mass instead,
    // which reads as a shorter, tighter calf. That is anatomy, not a clamp — and it is why this
    // dial is named for the direction it can actually travel.
    const m0 = legMarks({});
    for (const d of [-0.02, -0.04, -0.06]) {
      const m = legMarks({ calfDrop: d });
      expect(m.calf).toBeLessThanOrEqual(m0.calf + 1e-9);
      expect(m.calf).toBeGreaterThan(m.knee);
    }
    expect(legMarks({ calfDrop: -0.04 }).calfGirth).toBeGreaterThan(m0.calfGirth);
  });

  it('wristGirth is the wrist’s own axis, which wristTaper only ever moved as a side effect', () => {
    const g0 = bodyGirths(posed({}));
    const wrist = (proto) => bodyGirths(posed(proto)).wrist / g0.wrist;
    expect(wrist({ wristGirth: 1.5 })).toBeGreaterThan(1.4);
    expect(wrist({ wristGirth: 0.7 })).toBeLessThan(0.8);
    // it is localized at the hand end (t³), so it barely reaches the belly: measured 3.8 % at 1.5
    expect(armCrest({ wristGirth: 1.5 }).girth / armCrest({}).girth).toBeLessThan(1.05);
    // and it leaves the ankle alone entirely
    expect(bodyGirths(posed({ wristGirth: 1.5 })).ankle).toBeCloseTo(g0.ankle, 6);
  });

  it('ankleGirth is the ankle’s own axis, and stays out of the calf', () => {
    const g0 = bodyGirths(posed({}));
    const ankle = (proto) => bodyGirths(posed(proto)).ankle / g0.ankle;
    expect(ankle({ ankleGirth: 1.5 })).toBeGreaterThan(1.2);
    expect(ankle({ ankleGirth: 0.7 })).toBeLessThan(0.9);
    expect(legMarks({ ankleGirth: 1.5 }).calfGirth).toBeCloseTo(legMarks({}).calfGirth, 6);
    expect(bodyGirths(posed({ ankleGirth: 1.5 })).wrist).toBeCloseTo(g0.wrist, 6);
  });
});

/**
 * WEIGHT AND THE DISTAL LIMB — measured, and deliberately NOT re-gained.
 *
 * The proximal pass had to add weight gains because there was no axis to gain on. The distal pass
 * does not: `forearm` and `calf` already scale both axes and already carry gains (0.10 / 0.14), and
 * the terminal joints already move about as much as a real one does — measured at weight 2, wrist
 * ×1.151 and ankle ×1.148 against roughly ×1.12 and ×1.18 lean-to-obese. Those are inside the
 * reference's own slop, so chasing them with a new gain would be over-fitting a remembered table.
 *
 * So the distal gap was EXPRESSIVE, not relational: the dials below let an operator author a calf,
 * and `weight` was already reaching the lower limb correctly. None of the four is in WEIGHT_GAIN,
 * and that is the finding rather than an omission.
 */
describe('weight and the distal limb — already right, and pinned that way', () => {
  it('the distal dials are deliberately absent from WEIGHT_GAIN', () => {
    for (const d of ['forearmDrop', 'wristGirth', 'calfDrop', 'ankleGirth']) {
      expect(WEIGHT_GAIN[d]).toBeUndefined();
    }
  });

  it('the distal segments still fall away from their proximal partners as weight goes on', () => {
    const girthOf = (ring) => {
      let L = 0;
      const p = ring.polyline;
      for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z);
      return L;
    };
    // both of these segments carry their belly as the stack's global max (see armCrest above)
    const crest = (w, id) => Math.max(...posed({ weight: w }).find((s) => s.id === id).rings.map(girthOf));
    // ring girths, not tailor's landmarks — the TREND is the claim, not the absolute ratio
    const fa = (w) => crest(w, 'forearmL') / crest(w, 'upperArmL');
    expect(fa(2)).toBeLessThan(fa(1));
    expect(fa(1)).toBeCloseTo(0.683, 2);
    expect(fa(2)).toBeCloseTo(0.597, 2);
  });
});
