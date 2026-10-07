/**
 * The bug skeleton — bones and part binds derived from the parts a bug is assembled from (build.js's `rig` readout),
 * so a worked bug and one nobody has built rig the same way. Nothing here reaches the plan: a bug without `motion`
 * builds byte-identically.
 *
 * The AXIS: `trunk0..` one bone per trunk segment, rear → front (`trunk0` the root); `neck` over a neck section;
 * `head` over the head (a fused head is the trunk's front bone); `tail0..` one per abdominal segment, front → back,
 * hung on `trunk0`; `metasoma0..` a scorpion's tail, on the last tail bone.
 * LIMBS: per leg pair j `leg{j}Coxa / Femur / Tibia / Tarsus` (socket → hip → knee → ankle → foot, roles
 * `leg.coxa` …), a chela's movable finger `leg{j}Dactyl` on the tarsus; palps the same under `palp…`.
 * HEAD PARTS: `antenna0..2` (the scape, then the flagellum in two), the mouth's bone (`mandible`, `proboscis`,
 * `fang`). WINGS: one bone per blade or wing case, root → tip, on the trunk bone nearest its root.
 * Right-side bones mirror to the left (…R → …L, x → −x), except a pair built with unequal sides (its left joints read).
 *
 * BIND: a section's rings ride its segment bones, each station blended toward the neighbour at the end it nears (as
 * the fauna trunk); a leg piece rides its podomere's bone (tarsomeres, claws, a chela's palm and fixed finger the
 * tarsus); an antenna segment the bone over it; everything else rigid on the bone its region names, else the nearest.
 * Pure and deterministic.
 */
import { assembleBug } from './build.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));
const r4 = (v) => (Math.sign(v) * Math.round(Math.abs(v) * 1e6)) / 1e6 + 0;   // µm: a flea's bones are a millimetre long
const p4 = (p) => p.map(r4);
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const flip = (q) => [-q[0] + 0, q[1], q[2]];
const segDist = (q, a, b) => { const d = sub(b, a), L2 = dot(d, d); const u = L2 > 0 ? Math.min(1, Math.max(0, dot(sub(q, a), d) / L2)) : 0; return dist(q, add(a, mul(d, u))); };
const centre = (part) => { const pts = part.stations.flatMap((st) => Object.values(st.points)); return mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length); };
const stationCentre = (st) => { const v = Object.values(st.points); return mul(v.reduce(add, [0, 0, 0]), 1 / v.length); };

export const LEG_BONES = ['Coxa', 'Femur', 'Tibia', 'Tarsus'];
const LEG_JOINTS = ['socket', 'hip', 'knee', 'ankle', 'foot'];

/**
 * A bug's skeleton from its bauplan: `{ bones: [{ id, parent, head, tail, role? }], bind: { <part>: bind }, legs,
 * plan, rig }`. `legs` lists each grounded or raised leg pair (`{ pair, role, ground, R, L }`, R / L its bone ids).
 */
export function bugSkeleton(B) {
  const { plan, rig } = assembleBug(B);
  const bones = [], add1 = (b) => { bones.push(b); return b; };

  // ── the AXIS ──
  const T = rig.sections.trunk, trunk = [];
  for (let k = 0; k < T.n; k++) trunk.push(add1({ id: `trunk${k}`, parent: k ? `trunk${k - 1}` : null, head: T.pts[k], tail: T.pts[k + 1], region: 'trunk' }));
  const front = trunk[trunk.length - 1].id;
  const N = rig.sections.neck;
  const neck = N ? add1({ id: 'neck', parent: front, head: N.pts[0], tail: N.pts[N.n], region: 'neck' }) : null;
  const Hs = rig.sections.head;
  const headId = Hs ? add1({ id: 'head', parent: neck ? 'neck' : front, head: Hs.pts[0], tail: Hs.pts[Hs.n], region: 'head' }).id : front;
  const TL = rig.sections.tail, tail = [];
  for (let k = 0; k < TL.n; k++) tail.push(add1({ id: `tail${k}`, parent: k ? `tail${k - 1}` : 'trunk0', head: TL.pts[k], tail: TL.pts[k + 1], region: 'tail' }));
  const lastTail = tail[tail.length - 1].id;
  const meta = [];
  if (rig.metasoma) for (let k = 0; k + 1 < rig.metasoma.length; k++) meta.push(add1({ id: `metasoma${k}`, parent: k ? `metasoma${k - 1}` : lastTail, head: rig.metasoma[k], tail: rig.metasoma[k + 1], region: 'metasoma' }));
  const axial = bones.slice();
  const nearestOf = (set) => (q) => set.reduce((b, c) => (segDist(q, c.head, c.tail) < segDist(q, b.head, b.tail) ? c : b)).id;
  const nearestAxial = nearestOf(axial), nearestTrunk = nearestOf(neck ? [...trunk, neck] : trunk);

  // ── LIMBS (right side; the left mirrors below) ──
  const right = [], legs = [];
  const limb = (tag, J, role) => {
    const ids = LEG_BONES.map((b) => `${tag}${b}R`);
    LEG_BONES.forEach((b, i) => right.push({ id: ids[i], parent: i ? ids[i - 1] : nearestTrunk(J.socket), head: J[LEG_JOINTS[i]], tail: J[LEG_JOINTS[i + 1]], role: `${role}.${b.toLowerCase()}` }));
    if (J.dactyl) right.push({ id: `${tag}DactylR`, parent: ids[3], head: J.dactyl[0], tail: J.dactyl[1], role: `${role}.dactyl` });
  };
  const unequal = {};
  for (const g of rig.legs) {
    limb(`leg${g.pair}`, g.joints, 'leg');
    if (g.left) unequal[`leg${g.pair}`] = g.left;
    legs.push({ pair: g.pair, role: g.role, ground: g.ground, R: LEG_BONES.map((b) => `leg${g.pair}${b}R`), L: LEG_BONES.map((b) => `leg${g.pair}${b}L`), chela: !!g.joints.dactyl });
  }
  for (const p of rig.palps) limb(p.name, p.joints, 'palp');
  // antennae: the scape, then the flagellum in two
  if (rig.antenna) {
    const A = rig.antenna, n = A.length - 1, mid = Math.max(2, Math.round(1 + (n - 1) / 2));
    const cuts = n >= 3 ? [0, 1, mid, n] : n === 2 ? [0, 1, 2] : [0, n];
    for (let i = 0; i + 1 < cuts.length; i++) right.push({ id: `antenna${i}R`, parent: i ? `antenna${i - 1}R` : headId, head: A[cuts[i]], tail: A[cuts[i + 1]], role: 'antenna', span: [cuts[i], cuts[i + 1]] });
  }
  if (rig.mouth) {
    const id = { mandibles: 'mandibleR', fangs: 'fangR', coil: 'proboscis', needle: 'proboscis' }[rig.mouth.kind];
    const b = { id, parent: headId, head: rig.mouth.root, tail: rig.mouth.tip, role: 'mouth' };
    if (id.endsWith('R')) right.push(b); else add1(b);
  }
  for (const w of rig.wings) right.push({ id: w.name, parent: nearestTrunk(w.root), head: w.root, tail: w.tip, role: w.elytra ? 'elytron' : 'wing', ...(w.elytra ? {} : { pair: w.pair }) });
  for (const b of right) bones.push(b);
  // the left: mirrored, or (a pair with unequal sides) its own joints
  for (const b of right) {
    const tag = Object.keys(unequal).find((t) => b.id.startsWith(t) && /^(Coxa|Femur|Tibia|Tarsus|Dactyl)R$/.test(b.id.slice(t.length)));
    let head = flip(b.head), tl = flip(b.tail);
    if (tag) {
      const J = unequal[tag], part = b.id.slice(tag.length, -1), i = LEG_BONES.indexOf(part);
      if (i >= 0) { head = J[LEG_JOINTS[i]]; tl = J[LEG_JOINTS[i + 1]]; } else if (J.dactyl) { head = J.dactyl[0]; tl = J.dactyl[1]; }
    }
    bones.push({ ...b, id: b.id.replace(/R$/, 'L'), parent: right.some((r) => r.id === b.parent) ? b.parent.replace(/R$/, 'L') : b.parent, head, tail: tl });
  }

  // ── BIND ──
  const ids = new Set(bones.map((b) => b.id)), by = Object.fromEntries(bones.map((b) => [b.id, b]));
  const sectionBones = { trunk: trunk.map((b) => b.id), tail: tail.map((b) => b.id), neck: neck ? ['neck'] : [], head: Hs ? ['head'] : [] };
  // a station at share u of its section: its segment's bone, blended toward the neighbour at the end it nears
  const blendIn = (sec, list, u) => {
    const pts = sec.pts.length - 1, x = Math.max(0, Math.min(pts - 1e-9, u * pts)), k = Math.floor(x), v = x - k;
    // the trunk's and tail's bounds are by share, not evenly: find the segment whose bounds hold u
    const nb = v < 0.5 ? list[k - 1] : list[k + 1];
    const w = r6(v < 0.5 ? 0.5 - v : v - 0.5);
    return nb && w > 0 ? { [list[k]]: r6(1 - w), [nb]: w } : { [list[k]]: 1 };
  };
  const bind = {};
  const legOf = /^(leg\d+|palp\d*)(Coxa|Femur|Tibia|Tarsus\d*|Claw\d*|Palm|Finger|Dactyl)([RL])$/;
  for (const p of plan.segments) {
    const nm = p.name;
    if (sectionBones[nm]?.length) {
      const sec = rig.sections[nm], list = sectionBones[nm];
      const blend = {};
      sec.u.forEach((u, i) => { blend[`st${i}`] = blendIn(sec, list, segShare(sec, u)); });
      blend.back = { [list[0]]: 1 }; blend.tip = { [list[list.length - 1]]: 1 };
      bind[nm] = list.length === 1 ? list[0] : { bone: list[0], blend };
      continue;
    }
    const m = nm.match(legOf);
    if (m) { const seg = m[2].replace(/\d+$/, ''), bone = seg === 'Coxa' || seg === 'Femur' || seg === 'Tibia' ? seg : seg === 'Dactyl' && ids.has(`${m[1]}DactylR`) ? 'Dactyl' : 'Tarsus';
      bind[nm] = `${m[1]}${bone}${m[3] === 'L' ? 'L' : 'R'}`; continue; }
    const an = nm.match(/^antenna(\d+)R$/);
    if (an) { const i = +an[1], b = right.find((r) => r.role === 'antenna' && i >= r.span[0] && i < r.span[1]) || right.filter((r) => r.role === 'antenna').pop(); bind[nm] = b.id; continue; }
    if (/^antenna(Comb|Plate|Bristle)/.test(nm)) { const c = centre(p); bind[nm] = nearestOf(right.filter((r) => r.role === 'antenna'))(c); continue; }
    if (/^mandible/.test(nm) && ids.has('mandibleR')) { bind[nm] = 'mandibleR'; continue; }
    if (/^fang(Base)?R$/.test(nm) && ids.has('fangR')) { bind[nm] = 'fangR'; continue; }
    if ((nm === 'proboscis' || nm === 'labellum') && ids.has('proboscis')) { bind[nm] = 'proboscis'; continue; }
    if (ids.has(nm)) { bind[nm] = nm; continue; }   // wings, elytra, metasoma segments
    if (/^(telson|sting)$/.test(nm) && meta.length) { bind[nm] = meta[meta.length - 1].id; continue; }
    if (/^(cercusR|filament|ovipositor|sting|fan\w*)$/.test(nm)) { bind[nm] = lastTail; continue; }
    if (nm === 'waist') { bind[nm] = 'tail0'; continue; }
    if (/^(eye|horn)/.test(nm) && !/pronotum/.test(nm)) { bind[nm] = nearestOf(axial.filter((b) => b.region === 'head' || b.id === headId))(centre(p)); continue; }
    if (nm === 'pronotum' || nm === 'scutellum') {
      // a plate over the trunk: each ring the trunk bone under it
      const pick = nearestOf(trunk), blend = {};
      p.stations.forEach((st, i) => { blend[st.id ?? `st${i}`] = { [pick(stationCentre(st))]: 1 }; });
      const first = Object.keys(blend[Object.keys(blend)[0]])[0];
      blend.back = blend[Object.keys(blend)[0]]; blend.tip = blend[Object.keys(blend)[p.stations.length - 1]];
      bind[nm] = { bone: first, blend }; continue;
    }
    bind[nm] = nearestAxial(centre(p));
  }

  return {
    bones: bones.map((b) => ({ id: b.id, parent: b.parent, head: p4(b.head), tail: p4(b.tail), ...(b.role ? { role: b.role } : {}) })),
    bind, legs, plan, rig, head: headId, length: B.length,
  };
}

/** a station's share u of its section → its share of the section's bound list (bounds are where segments meet) */
function segShare(sec, u) {
  // sec.pts are at the section's segment bounds; the bounds' own u are not stored, but stations at the bounds carry
  // them: the n + 1 bound u values are the station u values at the pinches. Segments are equal unless split: read
  // them back from the stations (every `per` stations a bound), else assume even.
  const n = sec.n, us = sec.u;
  if (n <= 1) return u;
  const per = (us.length - 1) / n;
  if (Number.isInteger(per)) { const b = Array.from({ length: n + 1 }, (_, i) => us[i * per]);
    for (let i = 0; i < n; i++) if (u <= b[i + 1] + 1e-12) return (i + (u - b[i]) / Math.max(1e-12, b[i + 1] - b[i])) / n;
    return 1; }
  return u;
}
