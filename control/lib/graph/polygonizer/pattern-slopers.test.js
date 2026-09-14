// slopers — pattern blocks drafted from the body's own girths, so one recipe re-drafts on any body.
import { describe, expect, it } from 'vitest';

import { draftSloper, sloperChart, SLOPER_KINDS } from './pattern-slopers.js';
import { readFileSync } from 'node:fs';
const wardrobeFixture = (dir) => JSON.parse(readFileSync(new URL(`../views/recipe-book/__fixtures__/book/chapters/wardrobe/${dir}/garment.json`, import.meta.url), 'utf8'));
const PATTERN_GARMENTS = { shiftDress: wardrobeFixture('shift-dress'), aLineSkirt: wardrobeFixture('a-line-skirt'), straightTrousers: wardrobeFixture('straight-trousers') };
import { buildPatternGarment, chartMeasures, validatePatternSpec, validatePatternPiece } from './pattern-garment.js';
import { buildGarment, validateGarmentSpec } from './figure-garments.js';
import { buildBodyCharts } from './body-chart.js';
import { buildProtoform } from './figure-proto.js';
import { articulate } from './figure-vajra.js';
import { renderFigureToSvg, figurePatternReport } from './figure-render.js';

const body = (proto = {}) => buildProtoform(articulate({}), proto);
const area = (o) => o.reduce((a, [x, y], i) => { const [qx, qy] = o[(i + 1) % o.length]; return a + x * qy - qx * y; }, 0) / 2;

describe('draftSloper', () => {
  const { charts, worldPerCm } = buildBodyCharts(body({ sex: 'female' }), { stature_cm: 165 });
  const trunk = chartMeasures(charts.trunk, worldPerCm);
  const arm = chartMeasures(charts.armL, worldPerCm);
  arm.girth.upperArm = arm.girth.shoulder; arm.girth.wrist = arm.girth.wrist ?? arm.girth.bottom;
  trunk.girth.neck = 36;

  it('drafts every block as a counter-clockwise outline whose named edges cover it once', () => {
    for (const kind of SLOPER_KINDS) {
      const m = kind === 'sleeve' ? arm : trunk;
      const p = draftSloper(kind, m, {});
      expect(area(p.outline), kind).toBeGreaterThan(50);
      expect(p.chart).toBe(sloperChart(kind));
      expect(p.corners.length).toBe(4);
      const n = p.outline.length;
      // walking the edges in order returns to the start and visits every vertex once
      const names = Object.keys(p.edges);
      let cursor = p.edges[names[0]][0], visited = 0;
      for (const name of names) {
        const [i0, i1] = p.edges[name];
        expect(i0, `${kind}.${name} starts where the previous ended`).toBe(cursor);
        let i = i0; while (i !== i1) { i = (i + 1) % n; visited++; }
        cursor = i1;
      }
      expect(cursor).toBe(p.edges[names[0]][0]);
      expect(visited).toBe(n);
      // mirror-symmetric about x = 0 (a trouser leg is not: its centre line is one edge)
      if (!/^trouser-/.test(kind)) for (const [x, y] of p.outline) expect(p.outline.some(([qx, qy]) => Math.abs(qx + x) < 1e-6 && Math.abs(qy - y) < 1e-6), `${kind} (${x},${y})`).toBe(true);
    }
    expect(() => draftSloper('cape', trunk)).toThrow(/cape/);
  });

  it('a bodice is quarter-bust plus half the ease wide at the bust line, and the back neck is shallower', () => {
    const f = draftSloper('bodice-front', trunk, { ease_bust_cm: 8 }), b = draftSloper('bodice-back', trunk, { ease_bust_cm: 8 });
    const bust = trunk.girth.bust / 4 + 4;
    expect(f.outline.some(([x]) => Math.abs(x - bust) < 0.02)).toBe(true);
    const top = (p) => Math.max(...p.outline.map(([, y]) => y));
    const cfDrop = (p) => top(p) - p.outline.find(([x]) => Math.abs(x) < 1e-6)[1];
    expect(cfDrop(b)).toBeLessThan(cfDrop(f));
    expect(f.anchor.chart).toEqual({ u: 'cf', v: 'top' });
    expect(b.anchor.chart.u).toBe('cb');
  });

  it('a sleeve is bicep plus ease wide, its cap no taller than the arm chart allows, hem = wrist plus ease', () => {
    const s = draftSloper('sleeve', arm, { ease_cm: 4, length: 'short' });
    const xs = s.outline.map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(arm.girth.upperArm + 4, 1);
    const hem = s.outline.filter(([, y]) => y === 0).map(([x]) => x);
    expect(Math.max(...hem) - Math.min(...hem)).toBeCloseTo(arm.girth.wrist + 6, 1);
    expect(s.anchor.piece[1]).toBe(22);
    expect(Math.max(...s.outline.map(([, y]) => y)) - 22).toBeLessThanOrEqual(arm.above);
  });
});

describe('the book\'s pattern garments (fixtures) — whole garments as dials over blocks', () => {
  it('the shift dress re-drafts and builds on both poles with every seam closed and no warnings', () => {
    for (const [sex, stature] of [['female', 165], ['male', 178]]) {
      const b = body({ sex });
      const { stacks, report } = buildPatternGarment(b, { ...PATTERN_GARMENTS.shiftDress, stature_cm: stature });
      expect(stacks.map((s) => s.id)).toEqual(['shiftDress:front', 'shiftDress:back', 'shiftDress:sleeveL', 'shiftDress:sleeveR']);
      expect(report.warnings, sex).toEqual([]);
      expect(report.seams.length).toBe(6);
      for (const s of report.seams) { if (!s.over) expect(s.gap_cm, `${sex} ${s.a.edge}`).toBeLessThan(6); expect(['flat', 'eased', 'gathered']).toContain(s.label); }
      expect(report.seams[0].over).toBe(true);
      // side seams: the front and back side edges have the same flat length → flat
      expect(report.seams[2].label).toBe('flat');
      // the bodice top row folds over the yoke to the shoulder seam (an `over` seam), so its max strain is
      // that fold; the mean stays small and the sleeves stay under 1
      for (const p of report.pieces) { expect(p.strain.mean, `${sex} ${p.id}`).toBeLessThan(0.3); expect(p.clipped).toBe(0); expect(p.sloper).toBeTruthy(); }
      for (const p of report.pieces.slice(2)) expect(p.strain.max, `${sex} ${p.id}`).toBeLessThan(1.2);
      // the drafted front differs between the poles (it is the body's own tape)
      expect(report.pieces[0].area_cm2).toBeGreaterThan(500);
    }
    const f = buildPatternGarment(body({ sex: 'female' }), PATTERN_GARMENTS.shiftDress).report.pieces[0].area_cm2;
    const m = buildPatternGarment(body({ sex: 'male' }), PATTERN_GARMENTS.shiftDress).report.pieces[0].area_cm2;
    expect(f).not.toBe(m);
  });

  it('an A-line skirt hangs from the waist and flares below the hip', () => {
    const { stacks, report } = buildPatternGarment(body({ sex: 'female' }), PATTERN_GARMENTS.aLineSkirt);
    expect(stacks.length).toBe(2);
    expect(report.warnings).toEqual([]);
    const front = stacks[0];
    const top = front.rings[0].center.z, bottom = front.rings[front.rings.length - 1].center.z;
    expect(top).toBeGreaterThan(bottom);
    expect(report.hang.trunk).toBeGreaterThanOrEqual(1);
  });

  it('passes the garment door, renders through the figure pipeline, and reports through figurePatternReport', () => {
    for (const key of Object.keys(PATTERN_GARMENTS)) expect(validateGarmentSpec(PATTERN_GARMENTS[key]), key).toEqual([]);
    expect(validatePatternSpec({ id: 'x', pieces: [{ id: 'a', fit: 'pattern', sloper: 'toga' }] })).toEqual([]);   // piece-level check owns the sloper name
    expect(validateGarmentSpec({ id: 'x', pieces: [{ id: 'a', fit: 'pattern', sloper: 'toga' }] })[0]).toMatch(/sloper/);
    expect(validateGarmentSpec({ id: 'x', pieces: [{ id: 'a', fit: 'pattern', sloper: 'sleeve', dials: 3 }] })[0]).toMatch(/dials/);
    const out = buildGarment(body(), PATTERN_GARMENTS.aLineSkirt);
    expect(out.some((s) => s.id === 'aLineSkirt:front')).toBe(true);
    const manifest = { kind: 'figure', proto: { sex: 'female' }, garment: ['tee', PATTERN_GARMENTS.aLineSkirt] };
    expect(renderFigureToSvg(manifest)).toBe(renderFigureToSvg(manifest));
    const r = figurePatternReport(manifest);
    expect(r.length).toBe(1);
    expect(r[0].id).toBe('aLineSkirt');
    expect(r[0].seams.length).toBe(2);
    expect(figurePatternReport({ kind: 'figure', garment: 'tee' })).toBeNull();
  });

  it('drafts on the stand and wears on the pose: the flat pieces are pose-invariant, the fit readout is not', () => {
    const rest = { kind: 'figure', proto: { sex: 'female' }, garment: [PATTERN_GARMENTS.shiftDress] };
    const posed = { ...rest, pose: { shL: { pitch: 60 }, shR: { pitch: 60 }, spine: { sagittal: 0.4 } } };
    const a = figurePatternReport(rest)[0], b = figurePatternReport(posed)[0];
    expect(b.pieces.map((p) => p.outline)).toEqual(a.pieces.map((p) => p.outline));
    expect(b.pieces.map((p) => p.area_cm2)).toEqual(a.pieces.map((p) => p.area_cm2));
    // the posed body reads a different residual (the arms are raised, the trunk bent)
    const strain = (r) => r.pieces.map((p) => p.strain.max).join(',');
    expect(strain(b)).not.toBe(strain(a));
    // and the render itself is deterministic on the pose
    expect(renderFigureToSvg(posed)).toBe(renderFigureToSvg(posed));
  });
});

describe('trouser blocks — one piece on two charts, the trunk above the crotch and the leg below', () => {
  const trousers = PATTERN_GARMENTS.straightTrousers;

  it('drafts a forked leg: centre line straight on the right edge, hem / inseam / fork / cf / waist / outseam, a join onto the leg', () => {
    const { charts, worldPerCm } = buildBodyCharts(body({ sex: 'female' }), { stature_cm: 165 });
    const { report } = buildPatternGarment(body({ sex: 'female' }), { ...trousers, stature_cm: 165 });
    const front = report.pieces.find((p) => p.id === 'front'), back = report.pieces.find((p) => p.id === 'back');
    expect(front.chart).toBe('trunk'); expect(front.join).toBe('legL');
    const named = (p) => Object.keys(p.edges).filter((k) => !['top', 'right', 'bottom', 'left'].includes(k));
    expect(named(front)).toEqual(['hem', 'inseam', 'fork', 'cf', 'waist', 'outseam']);
    expect(named(back)).toEqual(['hem', 'outseam', 'waist', 'cb', 'fork', 'inseam']);   // the mirror image, listed in outline order
    expect(area(front.outline)).toBeGreaterThan(0); expect(area(back.outline)).toBeGreaterThan(0);
    // the centre line is x = 0 from the crotch to the waist; the fork juts past it at the crotch; the back's fork is bigger
    const cf = front.edges.cf.map((i) => front.outline[i]); expect(cf.every(([x]) => x === 0)).toBe(true);
    const forkF = Math.max(...front.outline.map(([x]) => x)), forkB = Math.max(...back.outline.map(([x]) => -x));
    expect(forkF).toBeGreaterThan(3); expect(forkB).toBeGreaterThan(forkF);
    // the block re-drafts on the male
    const m = buildPatternGarment(body({ sex: 'male' }), { ...trousers, stature_cm: 178 }).report.pieces[0];
    expect(m.area_cm2).not.toBe(front.area_cm2);
    expect(charts.legL).toBeTruthy(); expect(worldPerCm).toBeGreaterThan(0);
    expect(sloperChart('trouser-front')).toBe('trunk');
    expect(SLOPER_KINDS).toContain('trouser-back');
  });

  it('builds on both poles: four pieces, six seams, centre seams closed on the midline, inseam inside the leg, outseam outside, no clamping', () => {
    for (const [sex, stature] of [['female', 165], ['male', 178]]) {
      const b = body({ sex });
      const { charts } = buildBodyCharts(b, { stature_cm: stature });
      const { stacks, report } = buildPatternGarment(b, { ...trousers, stature_cm: stature });
      expect(stacks.map((s) => s.id)).toEqual(['straightTrousers:front', 'straightTrousers:frontR', 'straightTrousers:back', 'straightTrousers:backR']);
      expect(report.warnings, sex).toEqual([]);
      expect(report.seams.length).toBe(6);
      // the back inseam (a bigger fork) is eased onto the front; every other seam is flat
      for (const s of report.seams) { expect(['flat', 'eased'], `${sex} ${s.a.piece}.${s.a.edge}`).toContain(s.label); expect(s.gap_cm, `${sex} ${s.a.piece}.${s.a.edge}`).toBeLessThan(8); }
      for (const p of report.pieces) { expect(p.clipped).toBe(0); expect(p.strain.mean, `${sex} ${p.id}`).toBeLessThan(0.35); }
      // the centre-front seam lies on the midline, its gap is nothing
      const cfSeam = report.seams.find((s) => s.a.edge === 'cf');
      expect(cfSeam.gap_cm).toBeLessThan(1);
      expect(cfSeam.line.every((p) => Math.abs(p.x) < 0.15)).toBe(true);
      // the left leg's inseam lies toward the midline from the leg's axis, the outseam away from it
      const lr = charts.legL.rows;
      const axisX = (p) => { let best = lr[0]; for (const r of lr) if (Math.abs(r.center.z - p.z) < Math.abs(best.center.z - p.z)) best = r; return best.center.x; };
      const inseam = report.seams[0].line, outseam = report.seams[1].line;
      expect(inseam.every((p) => p.x > axisX(p))).toBe(true);
      expect(outseam.every((p) => p.x < axisX(p))).toBe(true);
      // the right leg mirrors
      expect(report.seams[2].line.every((p) => p.x < -axisX(p))).toBe(true);
      // the hem hangs at the ankle: the lowest ring sits below the knee row
      const front = stacks[0];
      expect(front.rings[front.rings.length - 1].center.z).toBeLessThan(lr[Math.round(charts.legL.landmarks.knee * (lr.length - 1))].center.z);
      // under-shells cover both charts
      expect(buildGarment(b, trousers).some((s) => s.id === 'straightTrousers:under:legL')).toBe(true);
    }
  });

  it('passes the door and renders through the figure pipeline under a shift, deterministically, lifting the shift at the hip', () => {
    expect(validateGarmentSpec(trousers)).toEqual([]);
    const manifest = { kind: 'figure', proto: { sex: 'male' }, garment: [trousers, PATTERN_GARMENTS.shiftDress], view: 'three-quarter' };
    expect(renderFigureToSvg(manifest)).toBe(renderFigureToSvg(manifest));
    const r = figurePatternReport(manifest);
    expect(r.map((g) => g.id)).toEqual(['straightTrousers', 'shiftDress']);
    expect(r[1].under.trunk).toBeGreaterThan(1);   // the trousers lift the trunk rows the shift hangs on
    // validation of the join grammar
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'trunk', outline: [[0, 0], [10, 0], [10, 10]], join: { chart: 'wing', y: 5 } }, 'p')[0]).toMatch(/join\.chart/);
    expect(validatePatternPiece({ id: 'a', fit: 'pattern', chart: 'trunk', outline: [[0, 0], [10, 0], [10, 10]], join: { chart: 'legL' } }, 'p')[0]).toMatch(/join\.y/);
  });
});

describe('the shoulder line — a bodice drafts to the crest and its seam is stitched ON the shoulder (outfit P6)', () => {
  it('the bodice tip sits at the crest\'s end with its measured slope, and the neck opening is the neck\'s base', () => {
    const { charts, worldPerCm } = buildBodyCharts(body({ sex: 'female' }), { stature_cm: 170 });
    const m = chartMeasures(charts.trunk, worldPerCm, 'top');
    expect(m.crest).toBeTruthy();
    expect(m.crest.half_cm).toBeGreaterThan(15); expect(m.crest.half_cm).toBeLessThan(30);
    expect(m.crest.half_cm).toBeCloseTo(charts.trunk.rows[0].girth / 4 / worldPerCm, 1);   // the crest ring's quarter arc: cf → around the neck → the acromion
    expect(m.crest.drop_cm).toBe(0);   // the protoform's yoke is level
    expect(m.crest.neck_cm).toBeGreaterThan(30); expect(m.crest.neck_cm).toBeLessThan(45);
    m.girth.neck = 36; m.standoff = 2 * Math.PI * 3;
    const f = draftSloper('bodice-front', m, {});
    const top = Math.max(...f.outline.map(([, y]) => y));
    const tipR = f.outline[f.edges.shoulderR[0]], neckR = f.outline[f.edges.shoulderR[1]];
    expect(tipR[0]).toBeCloseTo(m.crest.half_cm, 6); expect(tipR[1]).toBeCloseTo(top, 6);      // at the acromion, level with the neck point
    expect(neckR[0]).toBeCloseTo(m.crest.neck_cm / 4, 6); expect(neckR[1]).toBeCloseTo(top, 6);   // a quarter of the neck's base, the ring NOT added
    // without a measured neck base the tailor's neck / 5 stands
    const noNeck = draftSloper('bodice-front', { ...m, crest: { ...m.crest, neck_cm: undefined } }, {});
    expect(noNeck.outline[noNeck.edges.shoulderR[1]][0]).toBeCloseTo(36 / 5, 6);
    // dials still win; a sloped crest drops the tip
    expect(draftSloper('bodice-front', m, { shoulder_cm: 30 }).outline.some(([x]) => Math.abs(x - 15) < 1e-6)).toBe(true);
    const sloped = draftSloper('bodice-front', { ...m, crest: { ...m.crest, drop_cm: 3 } }, {});
    expect(sloped.outline[sloped.edges.shoulderR[0]][1]).toBeCloseTo(top - 3, 6);
    // without a crest the old reading stands
    const bare = draftSloper('bodice-front', { ...m, crest: undefined }, {});
    expect(bare.outline[bare.edges.shoulderR[0]][1]).toBeCloseTo(top - 4, 6);
  });

  it('the shift\'s shoulder seams lie on the crest above the yoke on both poles, closed, and the highest cloth is above the flesh', () => {
    for (const sex of ['female', 'male']) {
      const b = body({ sex });
      const yokeTop = Math.max(...b.find((s) => s.id === 'shoulderYoke').rings.flatMap((rg) => rg.polyline.map((p) => p.z)));
      const { stacks, report } = buildPatternGarment(b, PATTERN_GARMENTS.shiftDress);
      const over = report.seams.filter((s) => s.over);
      expect(over.length).toBe(2);
      for (const s of over) {
        expect(s.gap_cm, `${sex} ${s.a.edge}`).toBeLessThan(1.5);                  // the two edges meet on the crest
        for (const p of s.line) expect(p.z, `${sex} ${s.a.edge}`).toBeGreaterThanOrEqual(yokeTop - 1e-6);
        expect(Math.max(...s.line.map((p) => Math.abs(p.y))) / report.worldPerCm).toBeLessThan(2.5);   // on the shoulder line, not a face of the yoke
      }
      const clothTop = Math.max(...stacks.flatMap((st) => st.rings.flatMap((rg) => rg.polyline.map((p) => p.z))));
      expect(clothTop).toBeGreaterThan(yokeTop);
      // and NO bodice vertex is inside the neck at the cap's height
      const neck = b.find((s) => s.id === 'neck');
      const nz = neck.rings.map((rg) => rg.center.z);
      for (const st of stacks.slice(0, 2)) for (const rg of st.rings) for (const p of rg.polyline) {
        if (p.z < yokeTop - 2 * report.worldPerCm) continue;
        let k = 0; for (let i = 1; i < nz.length; i++) if (Math.abs(nz[i] - p.z) < Math.abs(nz[k] - p.z)) k = i;
        const row = neck.rings[k], a0 = Math.atan2(p.y - row.center.y, p.x - row.center.x);
        // the neck's radius TOWARD the vertex (the ring is not round): the nearest skin point by angle
        let near = row.polyline[0], nd = Infinity;
        for (const q of row.polyline) { const a = Math.abs(Math.atan2(q.y - row.center.y, q.x - row.center.x) - a0), d = Math.min(a, 2 * Math.PI - a); if (d < nd) { nd = d; near = q; } }
        const rb = Math.hypot(near.x - row.center.x, near.y - row.center.y);
        expect(Math.hypot(p.x - row.center.x, p.y - row.center.y), `${sex} ${st.id}`).toBeGreaterThan(rb - 1e-6);
      }
    }
  });
});
