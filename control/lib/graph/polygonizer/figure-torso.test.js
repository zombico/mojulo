/**
 * THE TORSO'S DEPTH AXIS — the fore/aft the trunk could not reach.
 *
 * `chestWidth` has always scaled the ribcage's CROSS-SECTION: breadth and depth by the same
 * multiplier, so a deep-chested or slab-flat torso was unreachable at any setting. `chestDepth`
 * and `pelvisDepth` trim the fore/aft alone, on top of it — the torso's half of the treatment the
 * limbs got (length in the cast, girth in proto).
 *
 *   1. the absent channel: both dials at 1 are byte-identical to before they existed;
 *   2. depth moves depth and NOT width, at both ends of the trunk;
 *   3. chestWidth still scales both axes — every stored recipe reads the same;
 *   4. the two compose: broad AND flat is now reachable, and so is narrow and deep;
 *   5. the waist between them follows, because its depth is their interpolation;
 *   6. the female pole's breast surface rides the same dial;
 *   7. a garment still fits a re-proportioned trunk;
 *   8. the STOMACH and the HIPS, the same treatment: `dantien` / `gluteSize` scale their mass
 *      uniformly, so a forward gut, a high or low belly, a shelf buttock and the hip's own flesh
 *      were all unreachable. bellyDepth / bellyDrop / gluteRear / hipFlare are those four axes.
 */
import { describe, expect, it } from 'vitest';

import { buildPosedFigure, renderFigureToSvg, figurePatternReport } from './figure-render.js';
import { bodyGirths } from './body-chart.js';
import { PROTO_DEFAULT, applyWeight } from './figure-proto.js';

const pts = (stacks, id) => stacks.filter((s) => (id ? s.id === id : true)).flatMap((s) => s.rings.flatMap((r) => r.polyline));
const span = (p, ax) => Math.max(...p.map((q) => q[ax])) - Math.min(...p.map((q) => q[ax]));
const trunk = (proto) => pts(buildPosedFigure({}, proto, null), 'trunk');
const widthOf = (proto) => span(trunk(proto), 'x');
const depthOf = (proto) => span(trunk(proto), 'y');
// ONE ring's own fore/aft, at a height fraction up the trunk. A band would not do: the egg
// profile tapers, so a band's y-extent is the max over many rings with different depths AND
// different centres, and is not linear in the dial even when every ring is.
const ringDepthAt = (proto, frac) => {
  const st = buildPosedFigure({}, proto, null).find((s) => s.id === 'trunk');
  const zs = st.rings.map((r) => r.center.z), lo = Math.min(...zs), hi = Math.max(...zs);
  const target = lo + frac * (hi - lo);
  let best = st.rings[0];
  for (const r of st.rings) if (Math.abs(r.center.z - target) < Math.abs(best.center.z - target)) best = r;
  return span(best.polyline, 'y');
};
const ringWidthAt = (proto, frac) => {
  const st = buildPosedFigure({}, proto, null).find((s) => s.id === 'trunk');
  const zs = st.rings.map((r) => r.center.z), lo = Math.min(...zs), hi = Math.max(...zs);
  const target = lo + frac * (hi - lo);
  let best = st.rings[0];
  for (const r of st.rings) if (Math.abs(r.center.z - target) < Math.abs(best.center.z - target)) best = r;
  return span(best.polyline, 'x');
};
const CHEST = 0.86, HIP = 0.02;
const chestDepthAt = (proto) => ringDepthAt(proto, CHEST);
const hipDepthAt = (proto) => ringDepthAt(proto, HIP);

describe('the absent channel', () => {
  it('both dials default to 1 and are declared', () => {
    expect(PROTO_DEFAULT.chestDepth).toBe(1);
    expect(PROTO_DEFAULT.pelvisDepth).toBe(1);
  });

  it('a dial at its default is byte-identical to not passing it', () => {
    const bare = renderFigureToSvg({});
    expect(renderFigureToSvg({ proto: { chestDepth: 1 } })).toBe(bare);
    expect(renderFigureToSvg({ proto: { pelvisDepth: 1 } })).toBe(bare);
    expect(renderFigureToSvg({ proto: { chestDepth: 1, pelvisDepth: 1 } })).toBe(bare);
    for (const sex of ['male', 'female']) {
      const b = renderFigureToSvg({ proto: { sex } });
      expect(renderFigureToSvg({ proto: { sex, chestDepth: 1, pelvisDepth: 1 } })).toBe(b);
    }
  });
});

describe('depth moves depth, not width', () => {
  const w0 = widthOf({});

  it('chestDepth deepens the ribcage and leaves the breadth exactly alone', () => {
    for (const k of [0.6, 1.4, 2]) {
      expect(widthOf({ chestDepth: k })).toBeCloseTo(w0, 12);
      expect(chestDepthAt({ chestDepth: k })).toBeCloseTo(chestDepthAt({}) * k, 6);
    }
  });

  it('pelvisDepth deepens the lower trunk and leaves the breadth alone', () => {
    for (const k of [0.7, 1.5]) {
      expect(widthOf({ pelvisDepth: k })).toBeCloseTo(w0, 12);
      expect(hipDepthAt({ pelvisDepth: k })).toBeGreaterThan(k > 1 ? hipDepthAt({}) : 0);
      if (k > 1) expect(hipDepthAt({ pelvisDepth: k })).toBeGreaterThan(hipDepthAt({}));
      else expect(hipDepthAt({ pelvisDepth: k })).toBeLessThan(hipDepthAt({}));
    }
  });

  // Not a hard partition, and it should not be: the lower trunk's depth is the LERP from the hip
  // to the ribcage, so the chest's dial bleeds downward as the waist climbs toward it — that bleed
  // IS the smooth torso. The claim is that each dial dominates its own end. The asymmetry is real:
  // pelvisDepth does not reach the chest at all, because up there the lerp is entirely the chest's.
  it('each dial dominates its own end', () => {
    const chestK = 1.6;
    const atChest = chestDepthAt({ chestDepth: chestK }) / chestDepthAt({});
    const atHip = hipDepthAt({ chestDepth: chestK }) / hipDepthAt({});
    expect(atChest).toBeCloseTo(chestK, 6);          // full effect where it belongs
    expect(atHip).toBeLessThan(1.05);                // barely anything at the far end
    expect(chestDepthAt({ pelvisDepth: 1.6 })).toBeCloseTo(chestDepthAt({}), 6);
  });
});

describe('composition with chestWidth', () => {
  it('chestWidth still scales BOTH axes — a stored recipe reads the same', () => {
    const k = 1.4;
    expect(ringWidthAt({ chestWidth: k }, CHEST)).toBeCloseTo(ringWidthAt({}, CHEST) * k, 6);
    expect(chestDepthAt({ chestWidth: k })).toBeCloseTo(chestDepthAt({}) * k, 6);
  });

  it('broad AND flat is now reachable, and so is narrow and deep', () => {
    const broadFlat = { chestWidth: 1.4, chestDepth: 1 / 1.4 };
    expect(ringWidthAt(broadFlat, CHEST)).toBeCloseTo(ringWidthAt({}, CHEST) * 1.4, 6);
    expect(chestDepthAt(broadFlat)).toBeCloseTo(chestDepthAt({}), 6);
    const narrowDeep = { chestWidth: 0.8, chestDepth: 1.6 };
    expect(widthOf(narrowDeep)).toBeLessThan(widthOf({}));
    expect(chestDepthAt(narrowDeep)).toBeGreaterThan(chestDepthAt({}));
  });

  it('the waist follows its neighbours — its depth is their interpolation', () => {
    const waistDepth = (proto) => ringDepthAt(proto, 0.42);
    expect(waistDepth({ chestDepth: 1.6, pelvisDepth: 1.6 })).toBeGreaterThan(waistDepth({}));
    expect(waistDepth({ chestDepth: 0.7, pelvisDepth: 0.7 })).toBeLessThan(waistDepth({}));
  });
});

describe('the rest of the body follows', () => {
  it('the female breast surface rides chestDepth', () => {
    const bust = (proto) => bodyGirths(buildPosedFigure({}, { sex: 'female', ...proto }, null), { stature_cm: 170 }).bust;
    expect(bust({ chestDepth: 1.5 })).toBeGreaterThan(bust({}));
    expect(bust({ chestDepth: 0.7 })).toBeLessThan(bust({}));
  });

  it('a garment still fits a re-proportioned trunk', () => {
    for (const proto of [{ chestDepth: 1.5 }, { chestDepth: 0.7 }, { pelvisDepth: 1.4 }, { chestWidth: 1.3, chestDepth: 0.75 }]) {
      const stacks = buildPosedFigure({}, proto, 'tee');
      expect(stacks.length).toBeGreaterThan(0);
      for (const q of pts(stacks)) expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z)).toBe(true);
    }
  });

  it('a cut-and-sewn piece re-drafts off the deeper body', () => {
    const rect = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
    const draft = (proto) => {
      const g = bodyGirths(buildPosedFigure({}, proto, null), { stature_cm: 170 });
      return {
        id: 'shift', stature_cm: g.stature_cm, ease_cm: 2, stitch_cm: 2,
        pieces: [
          { id: 'front', fit: 'pattern', chart: 'trunk', outline: rect(g.bust / 2 + 4, 40), anchor: { piece: [0, 40], chart: { u: 'cf', v: 'collar' } } },
          { id: 'back', fit: 'pattern', chart: 'trunk', outline: rect(g.bust / 2 + 4, 40), anchor: { piece: [0, 40], chart: { u: 'cb', v: 'collar' } } },
        ],
        seams: [{ a: { piece: 'front', edge: 'right' }, b: { piece: 'back', edge: 'left' } }, { a: { piece: 'front', edge: 'left' }, b: { piece: 'back', edge: 'right' } }],
      };
    };
    for (const proto of [{}, { chestDepth: 1.5 }, { chestDepth: 0.7 }]) {
      const report = figurePatternReport({ proto, garment: draft(proto) });
      expect(report).not.toBeNull();
      for (const piece of report[0].pieces) { expect(piece.clipped).toBe(0); expect(piece.strain.max).toBeLessThan(2); }
    }
  });
});

// ── the stomach and the hips ────────────────────────────────────────────────
const massOf = (proto, id) => buildPosedFigure({}, proto, null).find((s) => s.id === id).rings.flatMap((r) => r.polyline);
const ext = (p, ax) => [Math.min(...p.map((q) => q[ax])), Math.max(...p.map((q) => q[ax]))];

describe('the stomach', () => {
  const belly = (proto) => massOf(proto, 'dantien');

  it('the dials are declared and absent == default', () => {
    expect(PROTO_DEFAULT.bellyDepth).toBe(1);
    expect(PROTO_DEFAULT.bellyDrop).toBe(0);
    const bare = renderFigureToSvg({});
    expect(renderFigureToSvg({ proto: { bellyDepth: 1, bellyDrop: 0 } })).toBe(bare);
  });

  it('bellyDepth deepens the mass MOSTLY forward — the flanks and back still fill', () => {
    const [b0, f0] = ext(belly({}), 'y');
    const [b1, f1] = ext(belly({ bellyDepth: 1.8 }), 'y');
    expect(f1 - b1).toBeGreaterThan((f0 - b0) * 1.7);         // it really is 1.8× deeper
    expect(span(belly({ bellyDepth: 1.8 }), 'x')).toBeCloseTo(span(belly({}), 'x'), 10);
    expect(span(belly({ bellyDepth: 1.8 }), 'z')).toBeCloseTo(span(belly({}), 'z'), 10);
    // measured: front +0.758, back −0.188. Pinning the back entirely read as a ball hung off the
    // front; a real middle is carried mostly, not only, forward.
    expect(f1 - f0).toBeGreaterThan(Math.abs(b1 - b0) * 2);
    expect(b1).toBeLessThan(b0);
  });

  it('dantien still scales the whole mass — a stored recipe reads the same', () => {
    for (const ax of ['x', 'y', 'z']) expect(span(belly({ dantien: 1.8 }), ax)).toBeCloseTo(span(belly({}), ax) * 1.8, 6);
  });

  it('bellyDrop slides the mass along its own height and changes nothing else', () => {
    const lowZ = ext(belly({ bellyDrop: 0.6 }), 'z'), z0 = ext(belly({}), 'z');
    expect(lowZ[0]).toBeLessThan(z0[0]);
    expect(lowZ[1] - lowZ[0]).toBeCloseTo(z0[1] - z0[0], 10);   // same size, moved
    expect(ext(belly({ bellyDrop: -0.5 }), 'z')[0]).toBeGreaterThan(z0[0]);
    for (const ax of ['x', 'y']) expect(span(belly({ bellyDrop: 0.6 }), ax)).toBeCloseTo(span(belly({}), ax), 10);
  });
});

describe('the hips', () => {
  it('the dials are declared and absent == default', () => {
    expect(PROTO_DEFAULT.gluteRear).toBe(1);
    expect(PROTO_DEFAULT.hipFlare).toBe(1);
    const bare = renderFigureToSvg({});
    expect(renderFigureToSvg({ proto: { gluteRear: 1, hipFlare: 1 } })).toBe(bare);
  });

  it('gluteRear projects the buttock REARWARD without widening it', () => {
    const g0 = massOf({}, 'gluteL'), g1 = massOf({ gluteRear: 1.6 }, 'gluteL');
    expect(ext(g1, 'y')[0]).toBeLessThan(ext(g0, 'y')[0]);              // further back
    expect(span(g1, 'x')).toBeCloseTo(span(g0, 'x'), 10);               // not wider
    expect(span(g1, 'z')).toBeCloseTo(span(g0, 'z'), 10);               // not taller
    expect(span(massOf({ gluteRear: 0.5 }, 'gluteL'), 'y')).toBeLessThan(span(g0, 'y'));
  });

  it('gluteSize still scales all three axes', () => {
    const g0 = massOf({}, 'gluteL'), g1 = massOf({ gluteSize: 1.6 }, 'gluteL');
    for (const ax of ['x', 'y', 'z']) expect(span(g1, ax)).toBeGreaterThan(span(g0, ax));
    expect(span(g1, 'x')).toBeCloseTo(span(g0, 'x') * 1.6, 6);
  });

  it('gluteRear rides the sex pole rather than replacing it', () => {
    // the female pole already projects 30 % less; the dial multiplies that, it does not reset it
    const rear = (proto) => -ext(massOf(proto, 'gluteL'), 'y')[0];
    expect(rear({ sex: 'female' })).toBeLessThan(rear({ sex: 'male' }));
    expect(rear({ sex: 'female', gluteRear: 1.6 })).toBeGreaterThan(rear({ sex: 'female' }));
    expect(rear({ sex: 'female', gluteRear: 1.6 })).toBeLessThan(rear({ sex: 'male', gluteRear: 1.6 }));
  });

  it('hipFlare gives the hip cap the dial every other mass already had', () => {
    const h0 = massOf({}, 'hipCapL'), h1 = massOf({ hipFlare: 1.5 }, 'hipCapL');
    for (const ax of ['x', 'y', 'z']) expect(span(h1, ax)).toBeCloseTo(span(h0, ax) * 1.5, 6);
    expect(span(massOf({ hipFlare: 0.7 }, 'hipCapL'), 'x')).toBeLessThan(span(h0, 'x'));
  });

  it('a garment still fits over a re-massed stomach and hips', () => {
    for (const proto of [{ bellyDepth: 1.8 }, { bellyDrop: 0.6 }, { gluteRear: 1.6 }, { hipFlare: 1.5 }, { bellyDepth: 1.6, gluteRear: 1.4, hipFlare: 1.3 }]) {
      for (const garment of ['tee', 'trousers']) {
        const stacks = buildPosedFigure({}, proto, garment);
        expect(stacks.length).toBeGreaterThan(0);
        for (const q of pts(stacks)) expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z)).toBe(true);
      }
    }
  });
});

// ── WEIGHT — one dial, distributed ─────────────────────────────────────────
describe('weight', () => {
  const girths = (proto) => bodyGirths(buildPosedFigure({}, proto, null), { stature_cm: 170 });
  const bellyFwd = (proto) => Math.max(...massOf(proto, 'dantien').map((q) => q.y));

  it('weight 1 is byte-identical to not passing it, on both poles', () => {
    expect(PROTO_DEFAULT.weight).toBe(1);
    expect(renderFigureToSvg({ proto: { weight: 1 } })).toBe(renderFigureToSvg({}));
    for (const sex of ['male', 'female']) {
      expect(renderFigureToSvg({ proto: { sex, weight: 1 } })).toBe(renderFigureToSvg({ proto: { sex } }));
    }
  });

  it('is monotone through the body', () => {
    const w = [0.7, 1, 1.3, 1.6, 2];
    for (const key of ['bust', 'waist']) {
      const series = w.map((v) => girths({ weight: v })[key]);
      for (let i = 1; i < series.length; i++) expect(series[i], `${key} at weight ${w[i]}`).toBeGreaterThan(series[i - 1]);
    }
    // The HIP is measured at a landmark the chart places by height, and a change in proportion can
    // move that landmark onto a neighbouring ring — so its fine-grained series is noisy (122.4 at
    // 0.7, 125.8 at 0.85, 121.4 at 1.0) even though the geometry is not. It is monotone over any
    // step wide enough to clear the landmark's own jitter, which is what is pinned.
    const hips = [0.7, 1.3, 2].map((v) => girths({ weight: v }).hip);
    for (let i = 1; i < hips.length; i++) expect(hips[i]).toBeGreaterThan(hips[i - 1]);
  });

  // The whole point of weight NOT being stockiness: mass does not go on evenly.
  it('distributes unevenly — the middle gains, the distal limb barely does', () => {
    const g0 = girths({}), g1 = girths({ weight: 1.6 });
    const gain = (k) => g1[k] / g0[k];
    // RE-PINNED with the limb-mass step, which is a declared emission change for weight ≠ 1.
    // This assertion used to read `['waist','hip','bust']` each outgaining `['wrist','thigh',
    // 'upperArm']`, and that blanket ordering WAS the defect: it held only because a limb's
    // lateral radius had no dial for weight to gain on, so the proximal limbs could not keep up
    // with the trunk by construction. `upperArm/bust` fell 0.388 → 0.342 across weight 1 → 2.
    // measured at weight 1.6: waist 1.356 · neck 1.253 · upperArm 1.217 · bust 1.185 ·
    // thigh 1.183 · hip 1.138 · wrist 1.092 · ankle 1.090.
    // What the dial actually promises — and what survives — is the trunk↔EXTREMITY separation:
    // the middle gains most, the hand and the foot barely move. The proximal limbs now sit
    // between the two, which is the point of figure-limb.test.js's ratio gate. The hip is the
    // least responsive trunk landmark and no longer outgains the thigh; the anthropometry says a
    // thigh gains slightly faster than a hip, and that is now pinned there.
    expect(gain('waist')).toBeGreaterThan(gain('wrist') * 1.10);
    expect(gain('hip')).toBeGreaterThan(gain('wrist'));
    for (const k of ['waist', 'bust']) for (const l of ['wrist', 'ankle']) {
      expect(gain(k), `${k} vs ${l}`).toBeGreaterThan(gain(l));
    }
    // the proximal limbs track the trunk's middle without overtaking it, and clear the distal ends
    for (const k of ['upperArm', 'thigh']) {
      expect(gain(k), `${k} vs waist`).toBeLessThan(gain('waist'));
      expect(gain(k), `${k} vs wrist`).toBeGreaterThan(gain('wrist'));
      expect(gain(k), `${k} vs ankle`).toBeGreaterThan(gain('ankle'));
    }
    // ...whereas stockiness moves everything by the same factor, which is what IT is for
    const s0 = girths({}), s1 = girths({ stockiness: 1.3 });
    expect(s1.waist / s0.waist).toBeCloseTo(s1.upperArm / s0.upperArm, 1);
  });

  it('the waist un-tucks and the V-taper flattens as weight goes on', () => {
    const ratio = (w) => girths({ weight: w }).waist / girths({ weight: w }).bust;
    expect(ratio(1.6)).toBeGreaterThan(ratio(1));                    // measured 0.645 -> 0.688
    expect(ratio(2)).toBeGreaterThan(ratio(1.6));
    // Lean does NOT sharpen the V symmetrically — measured 0.660 at weight 0.7, above the
    // canonical 0.645 — because the ribcage sheds proportionally more than the waist does. That
    // is the profile behaving like a body, not a defect: a lean figure is narrower everywhere.
  });

  // THE STRUCTURAL PIN. `bellyDepth` multiplies the fore/aft `dantien` already scaled and
  // `stockiness` multiplies the result again, so driving all three from one dial compounds. The
  // first tuning reached 4.77× forward and a belly wider than the trunk — a detached sphere.
  it('the belly never leaves the trunk\'s silhouette, at any weight', () => {
    for (const w of [0.6, 1, 1.4, 1.8, 2.2, 3]) {
      const b = massOf({ weight: w }, 'dantien'), t = massOf({ weight: w }, 'trunk');
      const bw = Math.max(...b.map((q) => Math.abs(q.x))), tw = Math.max(...t.map((q) => Math.abs(q.x)));
      expect(bw, `weight ${w}`).toBeLessThan(tw);
    }
  });

  it('the middle swells through the TRUNK, not by inflating the separate mass', () => {
    // bellyFill is what weight drives; dantien/bellyDepth barely move, so the heavy middle is one
    // continuous silhouette rather than a sphere overlapping a torso.
    const w = applyWeight({ ...PROTO_DEFAULT, weight: 1.6 });
    expect(w.bellyFill).toBeGreaterThan(0.4);
    expect(w.dantien).toBeLessThan(1.1);
    expect(w.bellyDepth).toBeLessThan(1.1);
    const trunkSpan = (p) => span(massOf(p, 'trunk'), 'y');
    expect(trunkSpan({ bellyFill: 0.5 })).toBeGreaterThan(trunkSpan({}));
    expect(renderFigureToSvg({ proto: { bellyFill: 0 } })).toBe(renderFigureToSvg({}));
  });

  // GROW ONCE. Both masses were authored so their dial scaled the radius AND slid the centre away
  // from the body, so reach grew quadratically: the seat hit 80 % of the trunk's own depth behind
  // it at weight 2 against a canonical 55 %, and the side profile read as spheres bolted on. The
  // centres are now fixed to the sex pole — the dial sizes the mass, the pole places it — so the
  // jut ratio FALLS as weight rises, because the torso outgrows what sits on it.
  it('a size dial grows a mass about a fixed centre, not away from the body', () => {
    const sym = (id, proto) => {
      const [b0, f0] = ext(massOf({}, id), 'y'), [b1, f1] = ext(massOf(proto, id), 'y');
      return [f1 - f0, b0 - b1];                                // growth forward, growth backward
    };
    const [df, db] = sym('dantien', { dantien: 1.8 });          // measured 0.473 / 0.473
    expect(df).toBeCloseTo(db, 2);
    const [gf, gb] = sym('gluteL', { gluteSize: 1.8 });
    expect(gf).toBeCloseTo(gb, 2);
  });

  it('so the masses stay proportional as the body gets heavier', () => {
    const jut = (proto, id, dir) => {
      const m = buildPosedFigure({}, proto, null);
      const g = m.find((s) => s.id === id).rings, t = m.find((s) => s.id === 'trunk').rings;
      const zc = g.reduce((a, r) => a + r.center.z, 0) / g.length;
      let near = t[0];
      for (const r of t) if (Math.abs(r.center.z - zc) < Math.abs(near.center.z - zc)) near = r;
      const ys = near.polyline.map((q) => q.y), tf = Math.max(...ys), tb = Math.min(...ys);
      const all = g.flatMap((r) => r.polyline.map((q) => q.y));
      return (dir > 0 ? Math.max(...all) - tf : tb - Math.min(...all)) / (tf - tb);
    };
    // canonical: belly 0.188, seat 0.551. Both FALL with weight — 0.009 / 0.490 at 1.3, −0.229 /
    // 0.391 at 2 — because `bellyFill` swells the trunk itself and the seat grows about a fixed
    // centre. Neither may ever climb, which is what made the profile grotesque.
    let lastB = jut({}, 'dantien', 1), lastG = jut({}, 'gluteL', -1);
    for (const w of [1.15, 1.3, 1.6, 2, 3]) {
      const b = jut({ weight: w }, 'dantien', 1), g = jut({ weight: w }, 'gluteL', -1);
      expect(b, `belly at weight ${w}`).toBeLessThanOrEqual(lastB + 1e-9);
      expect(g, `seat at weight ${w}`).toBeLessThanOrEqual(lastG + 1e-9);
      lastB = b; lastG = g;
    }
  });

  it('is a GLOBAL GAIN, so an explicit dial multiplies on top rather than replacing it', () => {
    const plain = bellyFwd({ weight: 1.5 });
    expect(bellyFwd({ weight: 1.5, dantien: 1.4 })).toBeGreaterThan(plain);
    expect(bellyFwd({ weight: 1.5, dantien: 0.6 })).toBeLessThan(plain);
  });

  // The operator's ask: one figure, RELATIVE to the frame it is applied to.
  // Every gain is a MULTIPLIER, so weight is relative to the frame by construction: scale the
  // frame uniformly and the same weight buys the same proportional gain.
  it('is relative to the frame — a uniform rescale buys the same gain', () => {
    const gain = (base) => girths({ ...base, weight: 1.5 }).waist / girths(base).waist;
    const g0 = gain({});
    for (const base of [{ stockiness: 1.25 }, { stockiness: 0.8 }, { height: 1.2 }]) {
      expect(gain(base), JSON.stringify(base)).toBeCloseTo(g0, 1);
    }
  });

  // ...but only approximately when the frame change re-orders the HULL. A trunk girth is the
  // outermost of several competing stacks, so widening the ribcage past the belly moves the waist
  // reading from the belly onto the ribcage, and weight's belly-heavy profile then buys less
  // there. Measured, not hidden: chestWidth 1.3 shifts the waist gain 1.17 → 1.25. It stays the
  // same KIND of change, which is what the dial promises; it is not a fixed ratio.
  it('shifts, bounded, when a frame change moves which stack the hull reads', () => {
    const gain = (base) => girths({ ...base, weight: 1.5 }).waist / girths(base).waist;
    const g0 = gain({});
    for (const base of [{ chestWidth: 1.3 }, { chestWidth: 0.8 }, { dantien: 1.4 }, { sex: 'female' }]) {
      const g = gain(base);
      expect(g, JSON.stringify(base)).toBeGreaterThan(1);           // still a gain
      expect(Math.abs(g - g0), JSON.stringify(base)).toBeLessThan(0.25);
    }
  });

  it('dresses across the range', () => {
    for (const w of [0.7, 1.3, 1.8]) for (const garment of ['tee', 'trousers']) {
      const stacks = buildPosedFigure({}, { weight: w }, garment);
      expect(stacks.length).toBeGreaterThan(0);
      for (const q of pts(stacks)) expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z)).toBe(true);
    }
  });
});

// ── the side profile stays convex ──────────────────────────────────────────
// The operator's rule, the same one the head's cheeks and nose were held to: no concave sections.
// A heavy figure had a concave BELT between the belly swell and the ribcage, because the swell
// peaked below the waist and died before the ribs picked up. This measures the lateral outline
// against its OWN upper convex hull, which is what "is it concave" actually means.
describe('the lateral outline', () => {
  const concavity = (proto) => {
    const st = buildPosedFigure({}, proto, null).filter((s) => s.flesh);
    const pts = st.flatMap((s) => s.rings.flatMap((r) => r.polyline));
    const f = [];
    for (let z = 5.2; z <= 7.4; z += 0.1) {
      let best = -1e9;
      for (const q of pts) if (Math.abs(q.z - z) < 0.06 && q.y > best) best = q.y;
      if (best > -1e8) f.push([+z.toFixed(1), best]);
    }
    const hull = [];
    for (const p of f) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2], b = hull[hull.length - 1];
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) hull.pop(); else break;
      }
      hull.push(p);
    }
    let worst = 0;
    for (const p of f) for (let i = 1; i < hull.length; i++) {
      if (p[0] < hull[i - 1][0] || p[0] > hull[i][0]) continue;
      const t = (p[0] - hull[i - 1][0]) / ((hull[i][0] - hull[i - 1][0]) || 1);
      worst = Math.max(worst, hull[i - 1][1] + t * (hull[i][1] - hull[i - 1][1]) - p[1]);
      break;
    }
    return worst;
  };

  it('a heavy figure has no concave belt at the waist', () => {
    // measured: 0.021 at weight 1.6 and 0.068 at weight 2, against 0.091 / 0.166 when the swell
    // was centred at uu 0.36 with spread 0.30 instead of 0.42 / 0.42.
    for (const sex of ['male', 'female']) {
      expect(concavity({ sex, weight: 1.6 }), `${sex} 1.6`).toBeLessThan(0.05);
      expect(concavity({ sex, weight: 2 }), `${sex} 2`).toBeLessThan(0.10);
    }
  });

  it('...and it only gets more convex as weight goes on', () => {
    // The LEAN figure keeps its waist — a narrowing between the hip flare and the ribs is a waist,
    // not a defect, and the canonical 0.191 is that. What must not happen is a heavy figure
    // keeping it, which is what read as grotesque.
    expect(concavity({ weight: 1.6 })).toBeLessThan(concavity({}) * 0.4);
    expect(concavity({ weight: 1.3 })).toBeLessThan(concavity({}));
  });
});
