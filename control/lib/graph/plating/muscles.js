// plating/muscles — the MUSCLE-MAPPED LAYOUT: a fitted shell (shell.js) cut where the body's own grooves run. The realistic
// body labels every skin point with the muscle most under it (body-relational-map.js); a segment's PLATE GROUPS gather its
// muscles into plates (the pectoral's heads one plate, each row of the rectus its own, the deltoid's heads a cap), and each
// plate's edges are the boundaries between its muscle and its neighbours', so the seams fall in the grooves. Each edge is
// then STRAIGHTENED in the suit's style (shell.js `stepped`): held straight, jogging only where the groove moves a slot or
// two and holds there, so a line bends yet stays straight; neighbours read the same boundary through the same rule, so
// they jog together and fit. The labels are eased first (a point takes the group most of its neighbours share), so a
// muscle reads as one clean region. The bone between masses (the tibia's face, the humerus's) is left to the underplate.
//
//   muscleLayout(P, label, S, { groups, uMax, trunk }) → panels in layouts.js's form, the segment's own, for side `S`
//                                                (a pair tagged Lat / Med on a limb, R / L on the trunk)
//
// Pure and deterministic.

/** each segment's PLATE GROUPS: a plate's id, the muscles it gathers (by id, or by a chain's stem: `biceps` its beads),
 * its layer (layouts.js LAYERS), its colour's `role` over the layer's, its `min` width (in slots) to be a plate at all,
 * its `rows` (banded down its length: an articulated joint's) */
export const MUSCLE_GROUPS = Object.freeze({
  torso: [
    { id: 'Pec', muscles: ['pectoralSternal', 'pectoralClavicular'], layer: 'cap' },
    { id: 'Sternum', muscles: ['sternum'], layer: 'mid', role: 'Alloy' },
    { id: 'Collar', muscles: ['clavicle'], layer: 'over', role: 'Alloy' },
    { id: 'Abs1', muscles: ['rectus1'], layer: 'over', role: 'Trim' }, { id: 'Abs2', muscles: ['rectus2'], layer: 'over', role: 'Trim' }, { id: 'Abs3', muscles: ['rectus3'], layer: 'over', role: 'Trim' },
    { id: 'Oblique', muscles: ['obliqueExternal', 'serratus'], layer: 'over' },
    { id: 'Lat', muscles: ['latissimus'], layer: 'over' },
    { id: 'Trap', muscles: ['trapeziusUpper', 'trapeziusLower', 'infraspinatus'], layer: 'cap' },
    { id: 'Spine', muscles: ['erector'], layer: 'mid', role: 'Alloy', min: 3 },
    { id: 'Armpit', muscles: ['axilla', 'pectoralTendon'], layer: 'mid', role: 'Joint', rows: 3 },
  ],
  pelvis: [
    { id: 'Abs4', muscles: ['rectus4'], layer: 'over', role: 'Trim' },
    { id: 'Oblique', muscles: ['obliqueExternal'], layer: 'over' },
    { id: 'Lat', muscles: ['latissimus'], layer: 'over' },
    { id: 'Spine', muscles: ['erector'], layer: 'mid', role: 'Alloy', min: 3 },
    { id: 'Hip', muscles: ['tensorFasciae', 'adductorOrigin'], layer: 'over', role: 'Trim' },
    { id: 'Seat', muscles: ['sweep'], layer: 'over' },
  ],
  upperArm: [
    { id: 'Deltoid', muscles: ['deltoidAnterior', 'deltoidLateral', 'deltoidPosterior'], layer: 'cap' },
    { id: 'Biceps', muscles: ['biceps', 'brachialis'], layer: 'over' },
    { id: 'Triceps', muscles: ['tricepsLong', 'tricepsLateral'], layer: 'over' },
  ],
  foreArm: [
    { id: 'Brachioradialis', muscles: ['brachioradialis'], layer: 'cap', role: 'Trim' },
    { id: 'Extensors', muscles: ['extensors'], layer: 'over' },
    { id: 'Flexors', muscles: ['flexors'], layer: 'over' },
  ],
  thigh: [
    { id: 'RectusFemoris', muscles: ['rectusFemoris'], layer: 'cap' },
    { id: 'VastusLateralis', muscles: ['vastusLateralis'], layer: 'over' },
    { id: 'VastusMedialis', muscles: ['vastusMedialis'], layer: 'over' },
    { id: 'Adductors', muscles: ['adductors', 'adductorOrigin'], layer: 'over', role: 'Alloy' },
    { id: 'Hamstrings', muscles: ['hamstrings', 'sweep'], layer: 'over' },
    { id: 'Tensor', muscles: ['tensorFasciae'], layer: 'over', role: 'Trim' },
    { id: 'Knee', muscles: ['knee', 'patella'], layer: 'cap' },
  ],
  shank: [
    { id: 'GastrocMedial', muscles: ['gastrocnemiusMedial'], layer: 'cap', min: 1 },
    { id: 'GastrocLateral', muscles: ['gastrocnemiusLateral'], layer: 'cap', min: 1 },
    { id: 'Soleus', muscles: ['soleus'], layer: 'over', min: 1 },
  ],
});

/** a muscle's group on a segment (its id, or its chain's stem: `biceps2` → `biceps`) */
const groupOf = (groups) => { const by = {}; for (const g of groups) for (const m of g.muscles) by[m] = g.id; return (m) => (m ? by[m] ?? by[m.replace(/\d+$/, '')] ?? null : null); };

/** STRAIGHTEN a boundary read station by station ([t, s] with s null where the plate is not): held straight, jogging (a
 * straight diagonal over one station's step) where it moves `step` or more and holds within `hold` for `persist` stations */
export function straighten(seq, { step, hold, persist = 2 }) {
  const pts = [[seq[0][0], seq[0][1]]]; let cur = seq[0][1];
  for (let i = 1; i < seq.length; i++) {
    const v = seq[i][1];
    if (Math.abs(v - cur) < step) continue;
    const ahead = seq.slice(i, i + persist);
    if (ahead.length < persist || ahead.some(([, x]) => Math.abs(x - v) > hold)) continue;
    const target = ahead.reduce((a, [, x]) => a + x, 0) / ahead.length;
    pts.push([seq[i - 1][0], cur], [seq[i][0], target]); cur = target;
  }
  pts.push([seq[seq.length - 1][0], cur]);
  return pts.filter((p, i, A) => i === 0 || p[0] > A[i - 1][0] + 1e-9 || p[1] !== A[i - 1][1]);
}

/** the MUSCLE-MAPPED panels of a segment `P` (its rings in ring order) on side `S`: `label(stId, slot)` the muscle there,
 * `groups` its plate groups, `uMax` its stations' last `u`. Each group's runs round each ring (a pair where it lies either
 * side, one through the front or the back where it spans it), their edges at the half-slot between muscles, its longest
 * run of rings; each edge straightened. → [{ id, layer, t, left, right }] */
export function muscleLayout(P, label, S, { groups, uMax, trunk = false }) {
  const n = P.slots.length, h = n / 2, gOf = groupOf(groups), lat = S === 'L' ? -1 : 1;
  // (a slot's design s: + the lateral side; the trunk reads as the right)
  const sOf = (j) => lat * (j <= h ? j / h : (j - n) / h);
  // (the labels EASED: a point takes the group most of its eight neighbours share, twice over, so a muscle reads as one
  // clean region and a stray label or a flicker from ring to ring does not cut a plate)
  let G = P.stations.map((st) => P.slots.map((sl) => gOf(label(st.id, sl))));
  for (let pass = 0; pass < 2; pass++) G = G.map((row, k) => row.map((x, j) => {
    const c = new Map();
    for (let dk = -1; dk <= 1; dk++) { const R = G[k + dk]; if (!R) continue; for (let dj = -1; dj <= 1; dj++) { const v = R[(j + dj + n) % n]; c.set(v, (c.get(v) ?? 0) + 1); } }
    let best = x, most = 0; for (const [v, m] of c) if (m > most || (m === most && v === x)) { best = v; most = m; }
    return most >= 5 ? best : x;
  }));
  const runs = P.stations.map((st, si) => {
    const g = G[si], out = [];
    // (runs round the ring, from the back slot so a run through the front stays whole; one through the back is cut there)
    for (let k = 0; k < n; k++) {
      const j = (h + k) % n; if (!g[j]) continue;
      const prev = (j + n - 1) % n; if (k > 0 && g[prev] === g[j]) continue;
      let e = k; while (e + 1 < n && g[(h + e + 1) % n] === g[j]) e++;
      const js = Array.from({ length: e - k + 1 }, (_, i) => (h + k + i) % n), ss = js.map(sOf), lo = Math.min(...ss) - 0.5 / h, hi = Math.max(...ss) + 0.5 / h;
      out.push({ g: g[j], lo, hi, key: hi < 0.04 ? 'N' : lo > -0.04 ? 'P' : 'M' });
    }
    return out;
  });
  const U = P.stations.map((st, i) => (st.u ?? i) / uMax), panels = [];
  for (const grp of groups) for (const key of ['M', 'P', 'N']) {
    // (its widest run of this side on each ring, then the longest stretch of rings it holds)
    const per = runs.map((rs) => rs.filter((r) => r.g === grp.id && r.key === key).sort((a, b) => b.hi - b.lo - (a.hi - a.lo))[0] ?? null);
    let best = [0, -1], i = 0;
    while (i < per.length) { if (!per[i]) { i++; continue; } let e = i; while (e + 1 < per.length && per[e + 1]) e++; if (e - i > best[1] - best[0]) best = [i, e]; i = e + 1; }
    if (best[1] - best[0] < 3) continue;
    const ks = Array.from({ length: best[1] - best[0] + 1 }, (_, q) => best[0] + q);
    if (ks.reduce((a, k) => a + per[k].hi - per[k].lo, 0) / ks.length < (grp.min ?? 1.5) / h) continue;
    const opt = { step: 1.5 / h, hold: 0.6 / h };
    const left = straighten(ks.map((k) => [U[k], per[k].lo]), opt), right = straighten(ks.map((k) => [U[k], per[k].hi]), opt);
    const t0 = Math.min(U[ks[0]], U[ks[ks.length - 1]]), t1 = Math.max(U[ks[0]], U[ks[ks.length - 1]]), tag = key === 'M' ? '' : trunk ? (key === 'P' ? 'R' : 'L') : key === 'P' ? 'Lat' : 'Med';
    // (banded down its length where its group says: the lames of an articulated joint)
    const rows = grp.rows ?? 1, gap = 0.02, span = (t1 - t0 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) panels.push({ id: `${grp.id}${rows > 1 ? r : ''}${tag}`, layer: grp.layer, ...(grp.role ? { role: grp.role } : {}),
      t: rows > 1 ? [t0 + r * (span + gap), t0 + r * (span + gap) + span] : [t0, t1], left, right });
  }
  return panels;
}
