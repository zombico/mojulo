// node --test docs/examples/humanoid/test-humanoid.mjs — the humanoid starter: both presets in every register close,
// the jaw hinges by the ear, both eyes read, hair and expression never move a joint. Both heads are resampled from
// fitted heads (canonical); the landmark cage's construction gates run with the cage selected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { humanoidPlan, REGISTERS, HAIR_STYLES, EXPRESSIONS, FACE_VERSION } from './humanoid.plan.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { humanoidHead, humanoidAnchors, HEAD_SOURCES } from './head.mjs';
import { fitCameraSource, fitSilhouetteAgreement, cheekReport, fitViews, FIT_CHEEK, FIT_PRESETS, FIT_DATA_DIR } from './head-fit.mjs';
import { join } from 'node:path';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { validateRig, bindLayered, rigNodesAt } from '../../../control/lib/graph/polygonizer/station-loft-rig.js';
import { layeredExposure } from '../../../control/lib/graph/polygonizer/station-loft-exposure.js';

/** Run with both presets on the landmark cage (kept selectable; its own construction gates). */
const onCage = (fn) => { const was = { ...HEAD_SOURCES }; HEAD_SOURCES.male = HEAD_SOURCES.female = 'landmarks'; try { return fn(); } finally { Object.assign(HEAD_SOURCES, was); } };
const closed = (recipe, dials = {}) => Object.entries(auditLayered(compileLayered(recipe, dials))).filter(([, r]) => !r.pass).map(([n]) => n);

test('male and female close in every register, at rest and at every dial extreme', () => {
  for (const preset of ['male', 'female']) for (const register of Object.keys(REGISTERS)) {
    const recipe = expandPlan(humanoidPlan({ preset, register }));
    const D = recipe.dials; const lo = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), hi = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]));
    for (const dials of [{}, lo, hi]) assert.deepEqual(closed(recipe, dials), [], `${preset}/${register} ${JSON.stringify(dials)}`);
  }
});

test('the worn head: the jaw hinges by the ear and the chin drops, both eyes read, the chin clears the collar', () => {
  const check = (preset) => {
    const recipe = expandPlan(humanoidPlan({ preset })); const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); bindLayered(mesh, recipe, R);
    assert.ok(R.joints.jawHinge[1] < R.joints.jawTip[1] - 0.05 && R.joints.jawHinge[2] > R.joints.jawTip[2] + 0.05, `${preset} the hinge is up and back by the ear, the tip at the chin`);
    // 20° drops the chin at least 15 mm (the fitted hinges sit a little higher and further forward than the cage's).
    const { nodes } = rigNodesAt(R, { jaw: 20 }); assert.ok(nodes.jawTip[2] < R.joints.jawTip[2] - 0.015, `${preset} the chin drops`);
    const ex = layeredExposure(mesh, { res: 320 }); for (const eye of ['eyeR', 'eyeL']) assert.equal(ex.parts[eye].flag, 'reads', `${preset} ${eye}`);
    const chin = Math.min(...mesh.pointIds.map((id, i) => (id.startsWith('jaw/') ? mesh.vertices[i][2] : Infinity)));
    assert.ok(chin > recipe.rig.joints.neckHub.at[2] + 0.05, `${preset} chin ${chin} above the collar`);
  };
  for (const preset of ['male', 'female']) check(preset);
  onCage(() => check('male'));
});

test('the female head is narrower than the male beyond her scale; the nose stands forward on both, the landmark ala a readable plane', () => {
  const eyeRow = (h) => h.parts.cranium.stations[4].points, noseRow = (h) => h.parts.cranium.stations[2].points;
  const m = humanoidHead({ preset: 'male' }), f = humanoidHead({ preset: 'female' });
  // The fitted widths are the references' (the female narrower); the cage's own dimorph rule is 5 %.
  assert.ok(eyeRow(f).sideR[0] < eyeRow(m).sideR[0], `female head ${eyeRow(f).sideR[0]} vs male ${eyeRow(m).sideR[0]}`);
  onCage(() => { const cm = humanoidHead({ preset: 'male' }), cf = humanoidHead({ preset: 'female' }); assert.ok(eyeRow(cf).sideR[0] < 0.95 * eyeRow(cm).sideR[0], 'cage female 5 % narrower'); });
  for (const h of [m, f]) { const r = noseRow(h); assert.ok(r.front[1] - r.innerR[1] > 0.02, `the tip stands ${(r.front[1] - r.innerR[1]).toFixed(3)} forward of the face`); }
  onCage(() => { for (const preset of ['male', 'female']) { const r = noseRow(humanoidHead({ preset })); assert.ok(r.alaR[0] > 0.19 * r.sideR[0] && r.alaR[0] < 0.23 * r.sideR[0], `${preset} the ala forms a narrow but readable nose plane`); } });
});

test('the landmark cage: the outer slot stands furthest forward at the eye row and recedes row by row to the mouth; the eye sits in an orbit under the brow', () => onCage(() => {
  for (const preset of ['male', 'female']) {
    const st = humanoidHead({ preset }).parts.cranium.stations; const cheek = (i) => st[i].points.outerR[1] / st[i].points.innerR[1];
    for (let i = 4; i > 0; i--) assert.ok(cheek(i) > cheek(i - 1) + 0.02, `${preset} row ${i} ${cheek(i).toFixed(3)} ahead of row ${i - 1} ${cheek(i - 1).toFixed(3)}`);
    assert.ok(st[4].points.innerR[1] < st[5].points.innerR[1] && st[5].points.innerR[1] - st[4].points.innerR[1] < 0.004 && st[4].points.innerR[1] < st[3].points.innerR[1], `${preset} the orbit sits behind the brow and the bridge`);
  }
}));

test('hair, expression and face knobs never move a joint; an unknown preset, hair or body control refuses', () => {
  const base = humanoidPlan({ preset: 'female' });
  for (const hair of HAIR_STYLES) for (const expression of Object.keys(EXPRESSIONS)) { const p = humanoidPlan({ preset: 'female', hair, expression, face: { eyeSize: 1.2 } }); assert.deepEqual(p.joints, base.joints); assert.deepEqual(p.rig.joints.hipR, base.rig.joints.hipR); }
  assert.throws(() => humanoidPlan({ preset: 'nobody' }), /unknown preset/);
  // a figure cast wears the male head pole (face-tune): the chibi hero has a face too
  assert.ok(expandPlan(humanoidPlan({ preset: 'child' })).parts.cranium); assert.equal(humanoidPlan({ preset: 'child', headPreset: 'female' }).include[0].parts.cranium.stations.length, humanoidPlan({ preset: 'female' }).include[0].parts.cranium.stations.length);
  assert.throws(() => humanoidPlan({ face: { jawline: 1.1 } }), /unknown control/);
  assert.throws(() => humanoidPlan({ face: 'square-jaw' }), /unknown move/);
  assert.throws(() => humanoidPlan({ hair: 'mohawk' }), /unknown hair/);
  assert.throws(() => humanoidPlan({ body: { tail: 1 } }), /not a body control/);
});


test('the jaw underside rises toward the ear; the nose bridge does not sink behind the eye plane', () => {
  for (const preset of ['male', 'female']) {
    const { parts } = humanoidHead({ preset });
    const jaw = parts.jaw.stations[0].points, eye = parts.cranium.stations[4].points;
    assert.ok(jaw.sideR[2] > jaw.front[2] + 0.02);
    // The landmark cage lifts the jaw's rear toward the condyle; the fitted jaw's rear is the ramus back edge at
    // row height instead (its own gate below).
    assert.ok(eye.front[1] >= eye.innerR[1]);
  }
  onCage(() => { for (const preset of ['male', 'female']) { const jaw = humanoidHead({ preset }).parts.jaw.stations[0].points; assert.ok(jaw.rearR[2] > jaw.sideR[2] + 0.025, `${preset} cage lifts the jaw's rear`); } });
});

test('the nose has a dorsal plane, a wider alar block and a raised upper-mouth wedge', () => {
  for (const preset of ['male', 'female']) {
    const st = humanoidHead({ preset }).parts.cranium.stations;
    const tip = st[2].points, base = st[1].points, mouth = st[0].points, root = st[4].points;
    assert.ok(tip.bridgeR[0] < tip.noseR[0] * 0.5, `${preset} dorsal plane is narrower than the sidewall`);
    assert.ok(base.alaR[0] > base.noseR[0] * 1.3, `${preset} ala continues outward from the lower sidewall`);
    assert.ok(base.front[1] > base.innerR[1] + 0.006, `${preset} subnasale starts the upper-mouth wedge`);
    assert.ok(mouth.front[1] > mouth.innerR[1] + 0.002, `${preset} philtrum reaches the mouth row`);
    const exposure = layeredExposure(compileLayered(humanoidHead({ preset, register: 'round' })), { res: 400 });
    for (const side of ['R', 'L']) assert.ok(exposure.parts[`nostril${side}`].exposed > 0.12, `${preset} nostril ${side} reads in three-quarter`);
  }
  // The landmark cage's own slot proportions; a fitted head's nose is its fit's, measured against its references.
  onCage(() => { for (const preset of ['male', 'female']) {
    const st = humanoidHead({ preset }).parts.cranium.stations, tip = st[2].points, base = st[1].points, root = st[4].points;
    assert.ok(base.noseR[0] > root.noseR[0] * 2.5, `${preset} outer nose side flares wider than the facial attachment`);
    assert.ok(base.alaR[0] > base.noseR[0] * 1.5, `${preset} cage ala at 1.5× the lower sidewall`);
    assert.ok(base.innerR[0] > root.innerR[0] * 2.2, `${preset} visible face join is wider at the bottom than the top`);
    assert.ok(Math.abs(tip.front[1] - tip.bridgeR[1]) < 0.002, `${preset} bridge has a flat dorsal plane`);
    assert.ok(tip.noseR[1] > tip.innerR[1] + 0.012, `${preset} ala stands off the cheek`);
  } });
  const normal = humanoidHead({ shape: { noseWidth: 1 } }).parts.cranium.stations;
  const wide = humanoidHead({ shape: { noseWidth: 1.25 } }).parts.cranium.stations;
  assert.ok(wide[1].points.alaR[0] > normal[1].points.alaR[0] * 1.24, 'noseWidth opens the alar base');
  assert.equal(wide[1].points.bridgeR[0], normal[1].points.bridgeR[0], 'noseWidth leaves the bridge attachment alone');
});

test('face v3 derives a readable cupid bow and mouth width from the alar base', () => {
  assert.equal(FACE_VERSION, 3);
  for (const preset of ['male', 'female']) {
    const head = humanoidHead({ preset, register: 'round' }), mesh = compileLayered(head);
    assert.equal(head.faceVersion, 3);
    for (const side of ['R', 'L']) assert.ok(head.parts[`upperLip${side}`], `${preset} upper lip ${side}`);
    const mouthX = Math.max(...mesh.pointIds.map((id, i) => id.startsWith('mouthR/') ? mesh.vertices[i][0] : -Infinity));
    const alaX = head.parts.cranium.stations[1].points.alaR[0];
    assert.ok(mouthX > alaX * 1.9 && mouthX < alaX * 2.3, `${preset} mouth ${mouthX} follows ala ${alaX}`);
  }
  const width = (noseWidth) => {
    const mesh = compileLayered(humanoidHead({ shape: { noseWidth } }));
    return Math.max(...mesh.pointIds.map((id, i) => id.startsWith('mouthR/') ? mesh.vertices[i][0] : -Infinity));
  };
  assert.ok(width(1.25) > width(1) * 1.12, 'a wider alar base carries a wider mouth construction');
});

test('refined humanoids remain deterministic, bind and clear the collar at different head scales', () => {
  for (const preset of ['male', 'female']) for (const headScale of [0.85, 1.2]) {
    const plan = humanoidPlan({ preset, headScale });
    assert.deepEqual(plan, humanoidPlan({ preset, headScale }));
    const recipe = expandPlan(plan), mesh = compileLayered(recipe), rig = validateRig(recipe.rig);
    const binding = bindLayered(mesh, recipe, rig);
    assert.ok(binding);
    const collar = plan.segments.find(s => s.name === 'torso').stations.at(-1).z;
    const chin = Math.min(...mesh.pointIds.map((id, i) => id.startsWith('jaw/') ? mesh.vertices[i][2] : Infinity));
    assert.ok(chin > collar + 0.015, `${preset}/${headScale} chin clears the raised collar`);
    assert.deepEqual(closed(recipe), []);
  }
});

// The frozen fits: byte-pinned data (re-fitting is an authoring step that re-pins these), exactly symmetric.
const FIT_FILES = {
  female: { 'head-source.json': '639fcdb723e825537f801943116f1c6c93efa54b9451d76c032de30ccd48de02', 'landmarks.json': '82874379b9bf9db9380113efc80df717958c7238fb639b14c160e01b222efddd', 'fit-report.json': '15f7aa122dd305a4e37d9ffe0244c11d0eb48c81b37d2ce3afb392429864e84b' },
  male: { 'head-source.json': 'e8f18cd54bcc016de905482854e36fe9bd12edb4ab93966e26c3647a1693145b', 'landmarks.json': 'cfb6680abfc4bf153eee59f4b4436b058ea12a33d3d9abef9f01d908787d1d00', 'fit-report.json': '5adab46fedc839502d6891f7af4fa58a135139267780339e28ff0c2fd750d01e' },
};
test('each head fit is frozen data: pinned bytes, exact bilateral symmetry', () => {
  assert.deepEqual(FIT_PRESETS.sort(), Object.keys(FIT_FILES).sort());
  for (const [preset, files] of Object.entries(FIT_FILES)) {
    for (const [file, sha] of Object.entries(files)) {
      const bytes = readFileSync(join(FIT_DATA_DIR, preset, file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), sha, `${preset}/${file} changed; re-pin only with a new fit`);
    }
    const src = JSON.parse(readFileSync(join(FIT_DATA_DIR, preset, 'head-source.json'), 'utf8'));
    const at = Object.fromEntries(src.pointIds.map((k, i) => [k, src.vertices[i]]));
    for (const [k, p] of Object.entries(at)) if (k.endsWith('L')) assert.deepEqual([-p[0], p[1], p[2]], at[k.replace(/L$/, 'R')], `${preset} ${k}`);
  }
});

test('each head follows its fit: silhouettes agree through every fitted camera, pupils land on the marked eyes', () => {
  for (const preset of FIT_PRESETS) {
    const mesh = compileLayered(humanoidHead({ preset, hair: 'none' }));
    for (const [view, iou] of Object.entries(fitSilhouetteAgreement(preset, mesh))) assert.ok(iou > 0.88, `${preset} ${view} silhouette IoU ${iou}`);
    const marks = JSON.parse(readFileSync(join(FIT_DATA_DIR, preset, 'landmarks.json'), 'utf8'));
    for (const view of fitViews(preset)) {
      const { source, cam } = fitCameraSource(preset, mesh, view);
      for (const side of ['R', 'L']) {
        const target = marks[view][`eyeCenter${side}`]; if (!target) continue;
        const ps = mesh.pointIds.map((id, i) => (id.startsWith(`pupil${side}/`) ? source.vertices[i] : null)).filter(Boolean);
        const c = [0, 1].map((k) => ps.reduce((sum, p) => sum + p[k], 0) / ps.length + cam.principal[k]);
        assert.ok(Math.hypot(c[0] - target[0], c[1] - target[1]) < 5, `${preset} ${view} pupil ${side} ${c.map((v) => v.toFixed(1))} vs ${target}`);
      }
    }
  }
});

test('face knobs still shape the fitted heads: noseWidth opens the ala and leaves the bridge, jawWidth widens the jaw', () => {
  for (const preset of FIT_PRESETS) {
    const base = humanoidHead({ preset }).parts, wide = humanoidHead({ preset, shape: { noseWidth: 1.25 } }).parts;
    assert.ok(wide.cranium.stations[1].points.alaR[0] > base.cranium.stations[1].points.alaR[0] * 1.2, `${preset} noseWidth opens the alar base`);
    assert.equal(wide.cranium.stations[1].points.bridgeR[0], base.cranium.stations[1].points.bridgeR[0], `${preset} noseWidth leaves the bridge`);
    const jaw = humanoidHead({ preset, shape: { jawWidth: 1.2 } }).parts;
    assert.ok(jaw.jaw.stations[0].points.sideR[0] > base.jaw.stations[0].points.sideR[0] * 1.1, `${preset} jawWidth widens the mandibular angle`);
  }
});

test('each fitted cheek: flat planes around a rounded apex, the lower side one flat mass that rounds out, the ramus reaches the ear, the chin is the fit\'s', () => { for (const preset of FIT_PRESETS) {
  const report = (on) => { const was = FIT_CHEEK.on; FIT_CHEEK.on = on; try { return cheekReport(humanoidHead({ preset }).parts); } finally { FIT_CHEEK.on = was; } };
  const raw = report(false), built = report(true);
  // Flat by construction, and flatter than the raw sampling (whose bends read as stripes; the female's bent 4 mm).
  for (const [plane, mm] of Object.entries(built.flatnessMm)) assert.ok(mm < 0.01, `${preset} ${plane} bends ${mm} mm`);
  assert.ok(Math.max(...Object.values(raw.flatnessMm)) > Math.max(...Object.values(built.flatnessMm)) + 0.5, `${preset} the planes replace a bent raw sampling`);
  assert.ok(built.apexLeadMm > 3, `the apex leads its neighbours by ${built.apexLeadMm} mm`);
  assert.ok(built.sideFullnessMm > 3, `${preset} the lower side bows ${built.sideFullnessMm} mm past the straight ramus (no cavity)`);
  const { jaw, cranium } = humanoidHead({ preset }).parts, side = (st) => st.points.sideR;
  const Js = side(jaw.stations[0]), Ms = side(cranium.stations[1]), Cs = side(cranium.stations[3]);
  const on = (p, a, b) => { const t = (p[2] - a[2]) / (b[2] - a[2]); return Math.hypot(...p.map((v, k) => v - (a[k] + (b[k] - a[k]) * t))); };
  for (const st of [jaw.stations[1], jaw.stations[2], cranium.stations[0]]) assert.ok(on(side(st), Ms, Js) < 1e-5, `${preset} ${st.id} side on the lower ramus`);
  // The chin as the fit draws it: chin bottom, chin front, then the fold under the lower lip (set back on the female,
  // level on the male), each at the fit's own point.
  const [jl0, chinRow, foldRow] = jaw.stations.map((st) => st.points), a = humanoidAnchors(preset);
  assert.equal(jaw.stations.length, 4, `${preset} jawline, chin, fold and the seam ring`);
  for (const [row, name] of [[jl0, 'menton'], [chinRow, 'chinFront'], [foldRow, 'chinFold']]) assert.deepEqual(row.front, a[name], `${preset} ${name}`);
  assert.ok(on(side(cranium.stations[2]), Cs, Ms) < 1e-5, 'the tip row side on the upper ramus');
  const jl = jaw.stations[0].points; assert.ok(jl.innerR[0] < jl.outerR[0] && jl.outerR[0] < jl.sideR[0], `${preset} the jawline runs chin → front → turn → angle without folding`);
} });

test('each fitted jaw meets the ear: the rear column is the ramus back edge at row height, reaching the ear root', () => { for (const preset of FIT_PRESETS) {
  const head = humanoidHead({ preset }), { jaw, cranium } = head.parts, mesh = compileLayered(head);
  const earX = Math.min(...mesh.pointIds.map((id, i) => (id.startsWith('earR/') ? mesh.vertices[i][0] : Infinity)));
  for (const st of [...jaw.stations.slice(0, 2), ...cranium.stations.slice(0, 3)]) {
    const { sideR, rearR } = st.points;
    assert.ok(Math.abs(rearR[2] - sideR[2]) < 1e-6, `${st.id} rear sits at its row's height (no hinge lift behind the jaw)`);
    assert.ok(rearR[1] < sideR[1] && rearR[0] > 0.85 * sideR[0], `${st.id} rear is just behind the ramus`);
  }
  for (const st of cranium.stations.slice(1, 3)) assert.ok(st.points.rearR[0] > earX - 0.008, `${st.id} under the ear reaches the ear root (${st.points.rearR[0]} vs ear ${earX})`);
  for (const dials of [{ jawOpen: 25 }]) assert.deepEqual(closed(head, dials), [], `${preset} the jaw still opens closed`);
} });
