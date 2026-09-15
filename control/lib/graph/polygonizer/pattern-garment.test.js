// pattern garment — cut flat in cm, sewn onto the body by closed-form maps.
import { describe, expect, it } from 'vitest';

import { buildPatternGarment, mirrorPiece, validatePatternPiece, validatePatternSpec, PATTERN_DEFAULTS } from './pattern-garment.js';
import { buildGarment, validateGarmentSpec, GARMENT_FIT_KINDS, GARMENTS } from './figure-garments.js';
import { bodyGirths, buildBodyCharts, standoffScalesByChart } from './body-chart.js';
import { buildProtoform } from './figure-proto.js';
import { articulate } from './figure-vajra.js';
import { buildPosedFigure, renderFigureToSvg } from './figure-render.js';

const body = (proto = {}) => buildProtoform(articulate({}), proto);
const rect = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];

// A shift: front + back rectangles half the bust wide, sewn at the sides, plus sleeves.
function shift(girths, { ease = 2 } = {}) {
  const W = girths.bust / 2 + ease * 2, H = 40;
  return {
    id: 'shift', color: { cloth: '#b23a48' }, stature_cm: girths.stature_cm, ease_cm: ease, stitch_cm: 2,
    pieces: [
      { id: 'front', fit: 'pattern', chart: 'trunk', outline: rect(W, H), anchor: { piece: [0, H], chart: { u: 'cf', v: 'collar' } } },
      { id: 'back', fit: 'pattern', chart: 'trunk', outline: rect(W, H), anchor: { piece: [0, H], chart: { u: 'cb', v: 'collar' } } },
      { id: 'sleeveL', fit: 'pattern', chart: 'armL', outline: rect(girths.upperArm - 2 + ease * 2, 25), anchor: { piece: [0, 25], chart: { u: 'cf', v: 'shoulder' } }, mirror: 'sleeveR' },
    ],
    seams: [
      { a: { piece: 'front', edge: 'right' }, b: { piece: 'back', edge: 'left' } },
      { a: { piece: 'front', edge: 'left' }, b: { piece: 'back', edge: 'right' } },
    ],
  };
}

describe('buildPatternGarment', () => {
  const b = body({ sex: 'female' });
  const g = bodyGirths(b, { stature_cm: 165 });
  const spec = shift(g);

  it('meshes every piece (mirrors included) as sheet ring-stacks with the piece as its panel', () => {
    const { stacks, report, underRanges } = buildPatternGarment(b, spec);
    expect(stacks.map((s) => s.id)).toEqual(['shift:front', 'shift:back', 'shift:sleeveL', 'shift:sleeveR']);
    for (const st of stacks) {
      expect(st.sheet).toBe(true);
      expect(st.rings.length).toBeGreaterThanOrEqual(3);
      const n = st.rings[0].polyline.length;
      for (const rg of st.rings) expect(rg.polyline.length).toBe(n);   // a grid: emitSheetFaces needs equal rows
      expect(st.sheetUv.length).toBe(st.rings.length);
      expect(st.hex).toBe('#3f6f93');
    }
    expect(stacks[0].panel).toBe('front');
    expect(report.pieces.map((p) => p.chart)).toEqual(['trunk', 'trunk', 'armL', 'armR']);
    expect(report.charts).toContain('trunk');
    expect(report.girths.trunk.waist).toBeCloseTo(g.waist, 0);
    expect(underRanges.map((u) => u.chart).sort()).toEqual(['armL', 'armR', 'trunk']);
    expect(report.warnings).toEqual([]);
  });

  it('is deterministic — two builds are byte-identical', () => {
    const a = buildPatternGarment(b, spec), c = buildPatternGarment(b, spec);
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });

  it('places the front on the front and the back on the back, above the waist and standing off by the ease', () => {
    const { stacks } = buildPatternGarment(b, spec);
    const mean = (st, k) => { let s = 0, n = 0; for (const rg of st.rings) for (const p of rg.polyline) { s += p[k]; n++; } return s / n; };
    const front = stacks[0], back = stacks[1];
    expect(mean(front, 'y')).toBeGreaterThan(0.3);
    expect(mean(back, 'y')).toBeLessThan(-0.3);
    // the top row is the collar line: higher than the bottom row (v grows down the chart)
    expect(front.rings[0].center.z).toBeGreaterThan(front.rings[front.rings.length - 1].center.z);
    // ease: the cloth sits OUTSIDE the flesh at the same height — no vertex inside the trunk hull
    const trunk = b.find((s) => s.id === 'trunk');
    const trunkR = Math.max(...trunk.rings.flatMap((rg) => rg.polyline.map((p) => Math.hypot(p.x, p.y))));
    const cfRow = front.rings[Math.floor(front.rings.length / 2)];
    const mid = cfRow.polyline[Math.floor(cfRow.polyline.length / 2)];
    expect(Math.hypot(mid.x, mid.y)).toBeGreaterThan(0.5 * trunkR);
  });

  it('reports each seam: flat lengths, ease in cm with the tailor\'s label, and the gap the stitch closed', () => {
    const { report } = buildPatternGarment(b, spec);
    expect(report.seams.length).toBe(2);
    for (const s of report.seams) {
      expect(s.len_a_cm).toBe(40); expect(s.len_b_cm).toBe(40);
      expect(s.ease_cm).toBe(0); expect(s.label).toBe('flat');
      expect(s.gap_cm).toBeGreaterThanOrEqual(0);
      expect(s.line.length).toBeGreaterThan(2);
    }
    // an eased seam: a longer sleeve cap onto a shorter armhole reads 'eased'; longer still, 'gathered'
    const eased = {
      ...spec, seams: [{ a: { piece: 'front', edge: 'top' }, b: { piece: 'sleeveL', edge: 'top' }, ease_to: 'a' }],
    };
    const r = buildPatternGarment(b, eased).report.seams[0];
    expect(r.ease_to).toBe('a');
    expect(r.ease_cm).toBeCloseTo(r.len_a_cm - r.len_b_cm, 6);
    expect(['eased', 'gathered']).toContain(r.label);
  });

  it('stitches: after the side seams the front\'s right edge and the back\'s left edge coincide', () => {
    const { stacks } = buildPatternGarment(b, spec);
    const front = stacks[0], back = stacks[1];
    for (let i = 0; i < front.rings.length; i++) {
      const fr = front.rings[i].polyline, br = back.rings[i].polyline;
      const a = fr[fr.length - 1], c = br[0];
      expect(Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z)).toBeLessThan(1e-9);
    }
  });

  it('measures the flat-to-curved residual and says when a pattern does not fit the body', () => {
    // a 22 cm-wide front on an ~87 cm bust: the side seams must pull each edge ~10 cm
    const narrow = { ...spec, pieces: spec.pieces.map((p) => (p.id === 'front' || p.id === 'back' ? { ...p, outline: rect(22, 40) } : p)) };
    const wide = buildPatternGarment(b, spec).report, tight = buildPatternGarment(b, narrow).report;
    expect(tight.seams[0].gap_cm).toBeGreaterThan(wide.seams[0].gap_cm);
    expect(tight.pieces[0].strain.max).toBeGreaterThan(wide.pieces[0].strain.max);
    for (const p of wide.pieces) { expect(p.strain.max).toBeLessThan(3.0); expect(p.clipped).toBe(0); }
    expect(wide.hang.trunk).toBeGreaterThan(1);   // the shift stands off the waist
    expect(wide.hang.trunk).toBeLessThan(2);
  });

  it('hangs a piece straight on below its chart, and clamps + warns above it', () => {
    const long = { ...spec, pieces: [{ ...spec.pieces[0], outline: rect(40, 120), anchor: { piece: [0, 120], chart: { u: 'cf', v: 'collar' } } }], seams: [] };   // 120 cm from the collar: past the crotch row
    const { stacks, report } = buildPatternGarment(b, long);
    expect(report.pieces[0].clipped).toBe(0);
    expect(report.warnings).toEqual([]);
    const rings = stacks[0].rings;
    expect(rings[rings.length - 1].center.z).toBeLessThan(0);   // below the crotch row, still hanging
    const high = { ...spec, pieces: [{ ...spec.pieces[0], anchor: { piece: [0, 0], chart: { u: 'cf', v: 'top' } } }], seams: [] };   // hem at the top → the piece rises above the chart
    const r2 = buildPatternGarment(b, high).report;
    expect(r2.pieces[0].clipped).toBeGreaterThan(0);
    expect(r2.warnings[0]).toMatch(/clamped/);
  });

  it('skips a piece whose chart the body lacks, with a warning', () => {
    const noArms = b.filter((s) => !/^(upperArm|forearm)/.test(s.id));
    const { stacks, report } = buildPatternGarment(noArms, spec);
    expect(stacks.map((s) => s.id)).toEqual(['shift:front', 'shift:back']);
    expect(report.warnings.some((w) => /armL/.test(w))).toBe(true);
  });

  it('honours named edges and explicit corners on a shaped piece', () => {
    // a sleeve with a curved cap: cap = the top run; the underarm edges are named
    const cap = [[-12, 0], [12, 0], [12, 20], [10, 26], [5, 30], [0, 31], [-5, 30], [-10, 26], [-12, 20]];
    const piece = { id: 'sleeveL', fit: 'pattern', chart: 'armL', outline: cap, corners: [8, 2, 1, 0], edges: { underarmR: [1, 2], underarmL: [8, 0] }, anchor: { piece: [0, 31], chart: { u: 'cf', v: 'top' } } };
    const one = { id: 'x', pieces: [piece], seams: [{ a: { piece: 'sleeveL', edge: 'underarmL' }, b: { piece: 'sleeveL', edge: 'underarmR' } }] };
    const { stacks, report } = buildPatternGarment(b, one);
    expect(stacks.length).toBe(1);
    expect(report.seams[0].len_a_cm).toBe(20); expect(report.seams[0].len_b_cm).toBe(20);
    expect(report.warnings).toEqual([]);
  });
});

describe('mirrorPiece', () => {
  it('flips x, keeps the outline counter-clockwise, swaps L/R chart and u line, re-indexes edges and corners', () => {
    const p = { id: 'sleeveL', outline: [[-5, 0], [5, 0], [5, 10], [-5, 10]], chart: 'armL', anchor: { piece: [1, 10], chart: { u: 'sideL', v: 'top' } }, edges: { hem: [0, 1] }, corners: [3, 2, 1, 0] };
    const m = mirrorPiece(p, 'sleeveR');
    expect(m.id).toBe('sleeveR'); expect(m.chart).toBe('armR'); expect(m.mirror).toBeUndefined();
    expect(m.anchor.chart.u).toBe('sideR'); expect(m.anchor.piece).toEqual([-1, 10]);
    const area = m.outline.reduce((a, [x, y], i, o) => { const [qx, qy] = o[(i + 1) % o.length]; return a + x * qy - qx * y; }, 0);
    expect(area).toBeGreaterThan(0);
    // the hem edge still runs along y = 0
    const [i0, i1] = m.edges.hem;
    expect(m.outline[i0][1]).toBe(0); expect(m.outline[i1][1]).toBe(0);
    expect(m.corners.length).toBe(4);
    expect(mirrorPiece({ ...p, anchor: { chart: { u: 0.2 } } }, 'r').anchor.chart.u).toBeCloseTo(0.8, 9);
  });
});

describe('the garment door', () => {
  it('lists pattern as the last fit kind and buildGarment emits the pieces plus under-shells', () => {
    expect(GARMENT_FIT_KINDS[GARMENT_FIT_KINDS.length - 1]).toBe('pattern');
    const b = body(), g = bodyGirths(b, { stature_cm: 178 });
    const out = buildGarment(b, shift(g));
    const ids = out.map((s) => s.id);
    expect(ids.filter((id) => !id.includes(':under:'))).toEqual(['shift:front', 'shift:back', 'shift:sleeveL', 'shift:sleeveR']);
    expect(ids.some((id) => id === 'shift:under:trunk')).toBe(true);
    expect(ids.some((id) => id === 'shift:under:upperArmL')).toBe(true);
    const noUnder = buildGarment(b, { ...shift(g), under: false });
    expect(noUnder.every((s) => !s.id.includes(':under:'))).toBe(true);
  });

  it('renders through the figure pipeline (SVG) on both poles and stays byte-identical', () => {
    for (const sex of ['female', 'male']) {
      const g = bodyGirths(body({ sex }), { stature_cm: 170 });
      const manifest = { kind: 'figure', proto: { sex }, garment: ['trousers', shift(g)], view: 'three-quarter' };
      const a = renderFigureToSvg(manifest), c = renderFigureToSvg(manifest);
      expect(a).toBe(c);
      expect(a).toContain('#b23a48'.slice(0, 4));
    }
  });

  it('leaves a figure without a pattern piece byte-identical (the absent channel)', () => {
    const manifest = { kind: 'figure', proto: { sex: 'female' }, garment: [GARMENTS.tee.id === 'tee' ? 'tee' : 'tee', 'trousers'] };
    const a = renderFigureToSvg(manifest);
    expect(a).toBe(renderFigureToSvg(manifest));
  });

  it('validates pattern pieces and seams at the door', () => {
    const ok = shift(bodyGirths(body(), { stature_cm: 170 }));
    expect(validateGarmentSpec(ok)).toEqual([]);
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'torso', outline: rect(10, 10) }, 'p')[0]).toMatch(/chart/);
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'trunk', outline: [[0, 0], [1, 1]] }, 'p')[0]).toMatch(/outline/);
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'trunk', outline: rect(10, 10), anchor: { chart: { u: 'middle' } } }, 'p')[0]).toMatch(/anchor\.chart\.u/);
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'trunk', outline: rect(10, 10), edges: { top: [0, 1] } }, 'p')[0]).toMatch(/reserved/);
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'trunk', outline: rect(10, 10), ease_cm: 99 }, 'p')[0]).toMatch(/ease_cm/);
    const badSeam = { ...ok, seams: [{ a: { piece: 'front', edge: 'hem' }, b: { piece: 'nowhere', edge: 'left' } }] };
    const errs = validatePatternSpec(badSeam);
    expect(errs.some((e) => /edge: 'hem'/.test(e))).toBe(true);
    expect(errs.some((e) => /'nowhere'/.test(e))).toBe(true);
    expect(validatePatternSpec({ ...ok, stature_cm: 400 })[0]).toMatch(/stature_cm/);
    // the whole-spec validator reaches the same errors through validateGarmentSpec
    expect(validateGarmentSpec(badSeam).length).toBe(errs.length);
    // no pattern pieces → the pattern validator is silent
    expect(validatePatternSpec({ id: 'tee', pieces: [{ fit: 'hull' }], seams: 'junk' })).toEqual([]);
    expect(PATTERN_DEFAULTS.stature_cm).toBe(170);
  });
});

describe('the layering rule', () => {
  const b = body({ sex: 'female' });
  const skirt = {
    id: 'sk', ease_cm: 1.5,
    pieces: [{ id: 'front', fit: 'pattern', sloper: 'skirt-front', dials: { length: 'knee', flare_cm: 6 } }, { id: 'back', fit: 'pattern', sloper: 'skirt-back', dials: { length: 'knee', flare_cm: 6 } }],
    seams: [{ a: { piece: 'front', edge: 'sideR' }, b: { piece: 'back', edge: 'sideL' } }, { a: { piece: 'front', edge: 'sideL' }, b: { piece: 'back', edge: 'sideR' } }],
  };
  const bodice = {
    id: 'bd', ease_cm: 1.5,
    pieces: [{ id: 'front', fit: 'pattern', sloper: 'bodice-front', dials: { hem: 'hip' } }, { id: 'back', fit: 'pattern', sloper: 'bodice-back', dials: { hem: 'hip' } }],
    seams: [{ a: { piece: 'front', edge: 'sideR' }, b: { piece: 'back', edge: 'sideL' } }, { a: { piece: 'front', edge: 'sideL' }, b: { piece: 'back', edge: 'sideR' } }],
  };
  const outer = (stacks) => stacks.filter((s) => !s.id.includes(':under:'));

  it('measures the worn layers\' stand-off per chart row, sleeves on the arm chart and not the trunk', () => {
    const { charts } = buildBodyCharts(b, { stature_cm: 165 });
    const none = standoffScalesByChart(charts, []);
    for (const id of Object.keys(charts)) expect(none[id].every((row) => row.every((v) => v === 1))).toBe(true);
    const tee = outer(buildGarment(b, GARMENTS.tee));
    const sc = standoffScalesByChart(charts, tee);
    const rowMax = (rows) => rows.map((row) => Math.max(...row));
    expect(Math.max(...rowMax(sc.trunk))).toBeGreaterThan(1.02);
    expect(Math.max(...rowMax(sc.armL))).toBeGreaterThan(1.02);
    // the tee's hem hangs over the top of the thigh (true, and small); below that the leg is bare
    expect(rowMax(sc.legL).slice(4).every((v) => v === 1)).toBe(true);
    // the tee's hem ring wraps both thighs' tops and lifts them to its own radius (a closed ring lifts
    // the charts whose axis it encloses), never past the cap
    expect(Math.max(...rowMax(sc.legL))).toBeLessThanOrEqual(2.5);
    // directional: a row lifted at the front is not lifted at the back by the same amount everywhere
    expect(sc.trunk.some((row) => Math.max(...row) - Math.min(...row) > 0.05)).toBe(true);
    // deterministic
    expect(JSON.stringify(standoffScalesByChart(charts, tee))).toBe(JSON.stringify(sc));
  });

  it('a bodice hemmed at the hip over an A-line skirt sits OUTSIDE the skirt at every shared row (no interleave)', () => {
    const skirtStacks = outer(buildGarment(b, skirt));
    const over = buildPatternGarment(b, bodice, { under: skirtStacks });
    const alone = buildPatternGarment(b, bodice);
    expect(over.report.under.trunk).toBeGreaterThan(1);
    expect(alone.report.under.trunk).toBe(1);
    expect(over.report.hang.trunk).toBeGreaterThanOrEqual(alone.report.hang.trunk);   // the bodice hangs from its own shoulders; the lift shows in `under`
    const { charts } = buildBodyCharts(b, { stature_cm: 170 });
    const rows = charts.trunk.rows;
    const radial = (p) => { let best = rows[0]; for (const r of rows) if (Math.abs(r.center.z - p.z) < Math.abs(best.center.z - p.z)) best = r; return { r: Math.hypot(p.x - best.center.x, p.y - best.center.y), az: Math.atan2(p.y - best.center.y, p.x - best.center.x), z: p.z }; };
    const skirtV = skirtStacks.flatMap((s) => s.rings.flatMap((rg) => rg.polyline.map(radial)));
    const zTop = Math.max(...skirtV.map((v) => v.z));
    const dz = (zTop - Math.min(...skirtV.map((v) => v.z))) / 40;
    let checked = 0, inside = 0, worst = 0;
    for (const st of over.stacks) for (const rg of st.rings) for (const p of rg.polyline) {
      if (p.z > zTop) continue;
      const q = radial(p);
      const near = skirtV.filter((v) => Math.abs(v.z - q.z) < dz && Math.abs(((v.az - q.az + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.15);
      if (!near.length) continue;
      checked++;
      const rs = Math.max(...near.map((v) => v.r));
      if (q.r < rs - 0.1) { inside++; worst = Math.max(worst, rs - q.r); }   // 0.1 world units ≈ eight millimetres, under the seam allowance
    }
    expect(checked).toBeGreaterThan(100);
    // the rule is a per-row measure smoothed over ±1 row: a stray vertex under a centimetre inside is tolerated, a band is not
    expect(inside / checked, `${inside} of ${checked} bodice vertices sit inside the skirt (worst by ${worst.toFixed(3)})`).toBeLessThan(0.01);
    expect(worst).toBeLessThan(0.25);
    // the same bodice worn ALONE does interleave — the rule is what fixes it
    let insideAlone = 0;
    for (const st of alone.stacks) for (const rg of st.rings) for (const p of rg.polyline) {
      if (p.z > zTop) continue;
      const q = radial(p);
      const near = skirtV.filter((v) => Math.abs(v.z - q.z) < dz && Math.abs(((v.az - q.az + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.15);
      if (near.length && q.r < Math.max(...near.map((v) => v.r)) - 0.1) insideAlone++;
    }
    expect(insideAlone).toBeGreaterThan(0);
  });

  it('a bodice over a layer that covers the shoulder has its shoulder line above that layer (the cap is lifted by height, not ratio)', () => {
    const { charts, worldPerCm } = buildBodyCharts(b, { stature_cm: 170 });
    const cap = charts.trunk.cap;
    // a pad two centimetres above the crest across its whole width (a tee's shell stops below the yoke's top; a padded jacket does not)
    const pad = { id: 'pad', rings: [{ center: { x: cap.cx, y: cap.cy, z: 0 }, polyline: cap.crest.map(([x, z]) => ({ x, y: cap.cy, z: z + 2 * worldPerCm })) }] };
    const over = buildPatternGarment(b, bodice, { under: [pad] });
    const alone = buildPatternGarment(b, bodice);
    const top = (r) => Math.max(...r.stacks[0].rings[0].polyline.map((p) => p.z));
    // the tip (the grid's first column) lies exactly on the crest, so it carries the whole lift; a vertex a hair
    // down the neck curve sits between the crest and the next cap row and carries lift·t
    // at least the pad's height; the clearance pass then rests the tip up to a centimetre above the pad
    const lift = over.stacks[0].rings[0].polyline[0].z - alone.stacks[0].rings[0].polyline[0].z;
    expect(lift).toBeGreaterThanOrEqual(2 * worldPerCm - 1e-9); expect(lift).toBeLessThan(3.2 * worldPerCm);
    expect(top(over) - top(alone)).toBeGreaterThan(1.5 * worldPerCm);
    // and the crest cloth clears the pad at its own x: the tip rests a centimetre above the pad there
    const tip = over.stacks[0].rings[0].polyline[0];
    const padAt = pad.rings[0].polyline.reduce((best, q) => (Math.abs(q.x - tip.x) < Math.abs(best.x - tip.x) ? q : best));
    expect(tip.z - padAt.z).toBeGreaterThan(0.5 * worldPerCm);
  });

  it('threads through buildPosedFigure in array order — the outer entry reads the inner one', () => {
    const rest = { kind: 'figure', proto: { sex: 'female' }, garment: [skirt, bodice] };
    const svg = renderFigureToSvg(rest);
    expect(svg).toBe(renderFigureToSvg(rest));
    expect(svg).not.toBe(renderFigureToSvg({ ...rest, garment: [bodice, skirt] }));
  });
});

// THE LEVEL CHART (footwear P2) — a chart laid across gravity carries no suspension.
describe('a level chart carries no suspension', () => {
  const body = () => buildProtoform(articulate({}), {});

  it('only the foot charts are level; the trunk, arms, legs and neck are not', () => {
    const { charts } = buildBodyCharts(body(), { stature_cm: 170 });
    expect(charts.footL.level).toBe(true);
    expect(charts.footR.level).toBe(true);
    for (const id of ['trunk', 'armL', 'armR', 'legL', 'legR', 'neck']) expect(charts[id].level, id).toBeUndefined();
  });

  it('a piece on the foot follows its own width — every row stands off 1, not the heel\'s girth carried to the toe', () => {
    const spec = {
      id: 'shoe', ease_cm: 0.6, under: false,
      pieces: [{ id: 'vamp', fit: 'pattern', chart: 'footL', outline: [[-9, 0], [9, 0], [9, 18], [-9, 18]], anchor: { piece: [0, 18], chart: { u: 'cf', v: 'heel' } } }],
    };
    const { report } = buildPatternGarment(body(), spec, {});
    expect(report.warnings ?? []).toEqual([]);
    expect(report.hang.footL).toBe(1);
    for (const r of report.hang_rows.footL) expect(r).toBe(1);
    // without the rule the suspension carries the heel's circumference onto the tiny closing tip
    // ring, which then has to flare ~18x to reach it — the flared toe this guards against
  });
});

// FOOTWEAR WITH NO BLOCK (footwear P3). The proof that the foot chart and the level rule are
// enough: a sandal and a boot shaft are OUTLINE pieces — the move the book's `tie` already makes
// on the trunk — and need no `sloper`, no core addition. `shoe-upper` / `shoe-sole` blocks (P4)
// are repertoire on top of this, not the capability.
describe('a sandal and a boot shaft need no block', () => {
  // A SANDAL: a footbed between the chart's two closing caps, two straps over the instep, and an
  // ankle band on the leg. The footbed does NOT run the whole chart — the heel-cap and toe-tip
  // rings are the tube's closures (7.8 cm and 1.0 cm around), and no piece can sit on them.
  const SANDAL = {
    id: 'sandal', color: { cloth: '#6b4a33' }, under: false, ease_cm: 0.5,
    pieces: [
      { id: 'sole', fit: 'pattern', chart: 'footL', mirror: 'soleR', ease_cm: 1.4,
        outline: [[-2.48, 0], [2.48, 0], [4, 6.15], [3.88, 12.71], [2.88, 20.5], [-2.88, 20.5], [-3.88, 12.71], [-4, 6.15]],
        anchor: { piece: [0, 20.5], chart: { u: 0.5, v: 0.14 } } },   // u 0.5 is the SOLE of a foot chart
      { id: 'toeStrap', fit: 'pattern', chart: 'footL', mirror: 'toeStrapR', ease_cm: 0.5,
        outline: [[-7.5, 0], [7.5, 0], [7.5, 3.2], [-7.5, 3.2]], anchor: { piece: [0, 1.6], chart: { u: 'cf', v: 'ball' } } },
      { id: 'instepStrap', fit: 'pattern', chart: 'footL', mirror: 'instepStrapR', ease_cm: 0.5,
        outline: [[-8.5, 0], [8.5, 0], [8.5, 3.6], [-8.5, 3.6]], anchor: { piece: [0, 1.8], chart: { u: 'cf', v: 'instep' } } },
      { id: 'ankleStrap', fit: 'pattern', chart: 'legL', mirror: 'ankleStrapR', ease_cm: 0.6,
        outline: [[-12, 0], [12, 0], [12, 2.6], [-12, 2.6]], anchor: { piece: [0, 1.3], chart: { u: 'cf', v: 'ankle' } } },
    ],
  };
  const BOOT = {
    id: 'bootShaft', color: { cloth: '#3a2a22' }, under: false, ease_cm: 1,
    pieces: [{ id: 'shaft', fit: 'pattern', chart: 'legL', mirror: 'shaftR', ease_cm: 1,
      outline: [[-13, 0], [13, 0], [14.5, 16], [-14.5, 16]], anchor: { piece: [0, 0], chart: { u: 'cf', v: 'ankle' } } }],
  };

  it('both build on both poles with no warnings, nothing clipped, and strain under 2', () => {
    for (const [name, spec] of [['sandal', SANDAL], ['boot', BOOT]]) {
      for (const sex of ['male', 'female']) {
        const { report } = buildPatternGarment(buildProtoform(articulate({}), { sex }), spec, {});
        expect(report.warnings ?? [], `${name}/${sex}`).toEqual([]);
        expect(report.pieces.length, `${name}/${sex}`).toBe(spec.pieces.length * 2);   // each piece mirrored
        for (const p of report.pieces) {
          expect(p.clipped, `${name}/${sex} ${p.id}`).toBe(0);
          expect(p.strain.max, `${name}/${sex} ${p.id}`).toBeLessThan(2);
        }
      }
    }
  });

  it('every piece declares no sloper — this is outline-only', () => {
    for (const spec of [SANDAL, BOOT]) for (const p of spec.pieces) expect(p.sloper).toBeUndefined();
  });

  it('the sole holds the foot off the ground: a shod figure stands on its soles', () => {
    const lowest = (stacks, pick) => Math.min(...stacks.filter(pick).flatMap((s) => s.rings.flatMap((r) => r.polyline.map((q) => q.z))));
    const shod = buildPosedFigure({}, {}, [SANDAL]);
    const ground = lowest(shod, () => true), foot = lowest(shod, (s) => /^foot/.test(s.id));
    expect(ground).toBeLessThan(foot);            // the sole is now the lowest thing on the figure
    expect(lowest(buildPosedFigure({}, {}, null), () => true)).toBeCloseTo(foot, 9);   // bare, the foot itself is
  });
});
