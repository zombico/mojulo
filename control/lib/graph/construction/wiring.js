// construction/wiring — a house's electrical rough-in, laid out by the rules of its tradition and routed through its
// frame. Advisory arithmetic in the manner of each code, not a design to any of them.
//
//   nec (North American): receptacles 16 in up, placed so no point along a wall line is more than 6 ft from one (at most
//     12 ft apart, every wall space from 2 ft), switches 48 in up beside every door on the room side, a ceiling box per
//     room (a grid in a large one). Kitchens take two 20 A small-appliance circuits, bathrooms and laundries a 20 A
//     circuit each, other rooms 15 A circuits of up to eight receptacles, lighting a 15 A circuit per storey. NM-B cable
//     (14/2 on 15 A, 12/2 on 20 A) bored through the studs 2 ft up, through the top plates into the ceiling void, across
//     the joists and down to the load center. Boxes are nailed beside a stud.
//   bs (British): sockets 450 mm up, switches 1200 mm; a 32 A ring final of 2.5 mm² twin and earth per storey (the
//     kitchen its own), a 6 A lighting radial in 1.5 mm². Sockets are fed from the floor void below, switches and lights
//     from the ceiling void above: every drop is chased straight up or down from its accessory (the safe zones).
//   jp (Japanese): outlets 250 mm up, switches 1200 mm; 20 A branch circuits in VVF 2.0 (up to six outlets, the kitchen
//     two of its own), lighting in VVF 1.6. Cables run in the ceiling void and drop to each box down the face of the
//     nearest hashira in a surface moulding: a shinkabe wall has no cavity, and a post is never bored.
//   iec (metric): sockets 300 mm up, switches 1100 mm; 16 A radials of up to eight sockets, a 10 A lighting circuit
//     per storey, in 20 mm conduit dropped in chases from the slab above.
// A circuit starts at the panel (on the ground storey, beside the entry) and runs device to device.
import { CATALOG } from './catalog.js';
import { archetypeArea } from '../polygonizer/floorplan-glyphs.js';

const IN = 1 / 12, MM = 1 / 304.8;
const q4 = (v) => Math.round(v * 1e4) / 1e4;

export const WIRING_RULES = Object.freeze({
  nec: { recepZ: 16 * IN, switchZ: 48 * IN, spacing: 12, minWall: 2, route: 'bored', box: 'box:nm-single', ceilingBox: 'box:ceiling', panel: 'panel:loadcenter', panelZ: 5.2, perCircuit: 8,
    cable: { general: 'cable:nm-b-14-2', kitchen: 'cable:nm-b-12-2', bathroom: 'cable:nm-b-12-2', laundry: 'cable:nm-b-12-2', lighting: 'cable:nm-b-14-2' },
    amps: { general: 15, kitchen: 20, bathroom: 20, laundry: 20, lighting: 15 }, kitchenCircuits: 2, dedicated: ['bathroom', 'laundry'] },
  bs: { recepZ: 450 * MM, switchZ: 1200 * MM, spacing: 12, minWall: 2, route: 'chased', box: 'box:uk-metal', ceilingBox: 'box:uk-metal', panel: 'panel:consumer-unit', panelZ: 1400 * MM, perCircuit: 40, ring: true,
    cable: { general: 'cable:te-2.5', kitchen: 'cable:te-2.5', lighting: 'cable:te-1.5' }, amps: { general: 32, kitchen: 32, lighting: 6 }, kitchenCircuits: 1, dedicated: [] },
  jp: { recepZ: 250 * MM, switchZ: 1200 * MM, spacing: 12, minWall: 2, route: 'surface', box: 'box:jp-switch', ceilingBox: 'box:jp-switch', panel: 'panel:bunden-ban', panelZ: 1650 * MM, perCircuit: 6,
    cable: { general: 'cable:vvf-2.0', kitchen: 'cable:vvf-2.0', lighting: 'cable:vvf-1.6' }, amps: { general: 20, kitchen: 20, lighting: 20 }, kitchenCircuits: 2, dedicated: [] },
  iec: { recepZ: 300 * MM, switchZ: 1100 * MM, spacing: 12, minWall: 2, route: 'conduit', box: 'box:uk-metal', ceilingBox: 'box:uk-metal', panel: 'panel:consumer-unit', panelZ: 1600 * MM, perCircuit: 8,
    cable: { general: 'cable:conduit-20', kitchen: 'cable:conduit-20', lighting: 'cable:conduit-20' }, amps: { general: 16, kitchen: 16, lighting: 10 }, kitchenCircuits: 1, dedicated: [] },
});

const ROLE_BY_GLYPH = { E: 'entry', L: 'living', D: 'dining', K: 'kitchen', B: 'bedroom', O: 'office', S: 'storage', W: 'bathroom', Y: 'laundry', H: 'circulation' };
const roleOf = (c) => c.role || ROLE_BY_GLYPH[c.glyph] || 'room';

/**
 * The program zones of a level's open core (a room with `open` and `zones`), split along its long axis by each zone's
 * furniture area, the way the furnishing splits it: [{ x, y, w, h, role }]. The kitchen of an open-plan house lives here.
 */
function openZones(lvl) {
  const out = [];
  for (const r of (lvl.structure && lvl.structure.plan && lvl.structure.plan.rooms) || []) {
    if (!r.open || !Array.isArray(r.zones) || r.zones.length < 2) continue;
    const horiz = r.w >= r.h, span = horiz ? r.w : r.h;
    const wts = r.zones.map((g) => archetypeArea(g)); const tot = wts.reduce((a, b) => a + b, 0) || r.zones.length;
    let c = 0;
    r.zones.forEach((g, i) => { const len = (span * wts[i]) / tot; out.push({ ...(horiz ? { x: r.x + c, y: r.y, w: len, h: r.h } : { x: r.x, y: r.y + c, w: r.w, h: len }), role: ROLE_BY_GLYPH[g] || 'room' }); c += len; });
  }
  return out;
}

/** The run on a cell edge (same line, overlapping), or null. */
function runOn(runs, orientation, at, lo, hi) {
  let best = null, ov = 0.3;
  for (const r of runs) {
    if (r.orientation !== orientation || Math.abs(r.at - at) > 0.3) continue;
    const o = Math.min(hi, r.along[1]) - Math.max(lo, r.along[0]);
    if (o > ov) { ov = o; best = r; }
  }
  return best;
}

/**
 * A room's wall line as a loop of edges, each { run, orientation, at, lo, hi, dir (+1 along, −1 against), inward
 * (the room's side, ±1), doors: [[a, b]…] (along the run) }.
 */
function roomEdges(c, runs) {
  const E = [
    { orientation: 'h', at: c.y, lo: c.x, hi: c.x + c.w, dir: 1, inward: 1 },
    { orientation: 'v', at: c.x + c.w, lo: c.y, hi: c.y + c.h, dir: 1, inward: -1 },
    { orientation: 'h', at: c.y + c.h, lo: c.x, hi: c.x + c.w, dir: -1, inward: -1 },
    { orientation: 'v', at: c.x, lo: c.y, hi: c.y + c.h, dir: -1, inward: 1 },
  ];
  return E.map((e) => {
    const run = runOn(runs, e.orientation, e.at, e.lo, e.hi);
    const doors = run ? (run.openings || []).filter((op) => !(op.sill > 1e-6) && op.b > e.lo + 0.1 && op.a < e.hi - 0.1).map((op) => [Math.max(op.a, e.lo), Math.min(op.b, e.hi)]) : [];
    return { ...e, run, doors };
  });
}

/**
 * Receptacle positions round a room: the wall line broken at doors into spaces; a space of at least `minWall` feet
 * takes n = ⌈length / spacing⌉ receptacles at the middles of n equal parts, so no point on it is more than
 * spacing / 2 from one. Returns [{ edge, s }] and the check.
 */
function receptacles(edges, rules) {
  // the perimeter as wall pieces in walking order; two pieces continue one wall line only across a corner, when the
  // first reaches its edge's end and the next leaves from its edge's start (a door, or no wall, breaks the line)
  const eps = 1e-3, pieces = [];
  for (const e of edges) {
    if (!e.run) continue;
    let spans = [[e.lo, e.hi]];
    for (const [a, b] of e.doors) spans = spans.flatMap(([p, q]) => [[p, Math.min(q, a)], [Math.max(p, b), q]]).filter(([p, q]) => q - p > eps);
    const start = e.dir > 0 ? e.lo : e.hi, end = e.dir > 0 ? e.hi : e.lo;
    const walk = e.dir > 0 ? spans : spans.map(([p, q]) => [q, p]).reverse();
    for (const [p, q] of walk) pieces.push({ e, p, q, startsAt: Math.abs(p - start) < eps, endsAt: Math.abs(q - end) < eps });
  }
  const spaces = [];
  pieces.forEach((pc, i) => {
    const prev = pieces[i - 1];
    if (!prev || !(prev.endsAt && pc.startsAt && prev.e !== pc.e)) spaces.push([]);
    spaces[spaces.length - 1].push(pc);
  });
  if (spaces.length > 1) {
    const last = spaces[spaces.length - 1], first = spaces[0];
    if (last[last.length - 1].endsAt && first[0].startsAt && last[last.length - 1].e !== first[0].e) { spaces[0] = [...last, ...first]; spaces.pop(); }
  }
  const out = []; let worst = 0;
  for (const sp of spaces) {
    const len = sp.reduce((a, pc) => a + Math.abs(pc.q - pc.p), 0);
    if (len < rules.minWall) continue;
    const n = Math.max(1, Math.ceil(len / rules.spacing - 1e-9));
    worst = Math.max(worst, len / (2 * n));
    for (let k = 0; k < n; k++) {
      let d = ((k + 0.5) * len) / n;
      for (const pc of sp) {
        const L = Math.abs(pc.q - pc.p);
        if (d <= L + 1e-9) {
          // keep a box a foot clear of a corner
          const dd = Math.min(Math.max(d, Math.min(1, L / 2)), L - Math.min(1, L / 2));
          out.push({ edge: pc.e, s: pc.p + Math.sign(pc.q - pc.p) * dd }); break;
        }
        d -= L;
      }
    }
  }
  return { list: out, worstFt: Math.round(worst * 100) / 100 };
}

/**
 * planWiring(house, cfg, frames, o) → { elements, circuits, panel, holes, checks }. cfg = { system, tradition, stage };
 * `frames` the framing plan (studs and posts to fix boxes to).
 */
export function planWiring(house, cfg, frames, o = {}) {
  const rules = WIRING_RULES[{ 'north-american': 'nec', british: 'bs', japanese: 'jp', metric: 'iec' }[cfg.tradition]];
  const drop = o.floorDrop ?? 1.1;
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const top = levels[levels.length - 1];
  const els = [];
  const lined = cfg.stage === 'lined';
  const boardT = (cfg.tradition === 'north-american' ? 12.7 : 12.5) * MM;
  const depthOf = (run) => (run.interior ? (cfg.system === 'kigumi' ? 120 * MM : 3.5 * IN) : ({ platform: 5.5 * IN, masonry: 215 * MM, steel: 190 * MM, concrete: 190 * MM, 'post-and-beam': 7.25 * IN, kigumi: 120 * MM }[cfg.system]));
  const holes = { studs: 0, plates: 0, joists: 0, posts: 0, chasesFt: 0, mouldingFt: 0 };
  const checks = [];
  // the void each storey's horizontal runs cross: the joist zone over it (the roof space over the top storey); a
  // British socket ring runs in the floor void under its storey instead
  const voidZ = (lvl) => (lvl === top ? lvl.baseZ + lvl.height + 0.35 : lvl.baseZ + lvl.height + drop * 0.45);
  const floorVoidZ = (lvl) => lvl.baseZ - drop * 0.55;
  // what fixes a box on a run: studs every 16 in from its start, or the posts of a kigumi frame
  const postsOn = (lvl, run) => {
    const fr = frames.find((f) => f.id === `storey-${lvl.index}`);
    if (!fr || cfg.system !== 'kigumi') return null;
    const cross = run.orientation === 'h' ? 1 : 0, along = 1 - cross;
    return fr.members.filter((m) => /^hashira-/.test(m.id) && Math.abs(m.from[cross] - run.at) < 0.02).map((m) => m.from[along]).sort((a, b) => a - b);
  };
  const fixAlong = (lvl, run, s, bw) => {
    const posts = postsOn(lvl, run);
    if (posts && posts.length) { const p = posts.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a)); return p + Math.sign(s - p || 1) * (60 * MM + bw / 2 + 0.02); }
    const studded = cfg.system === 'platform' || run.interior;
    if (!studded) return s;
    const k = Math.round((s - run.along[0]) / (16 * IN)); const stud = run.along[0] + k * 16 * IN;
    return stud + Math.sign(s - stud || 1) * (0.75 * IN + bw / 2);
  };
  // a device: its box (on the room face of the wall, open face flush with the lining), and the point its cable leaves
  const device = (kind, lvl, run, s, inward, z, key, sizeName) => {
    const m = CATALOG[sizeName]; const [bw, bh, bd] = m.size.map((v) => v * MM);
    const face = run.at + inward * (depthOf(run) / 2 + (cfg.system === 'kigumi' ? 25 * MM : boardT));
    const sAt = fixAlong(lvl, run, s, bw);
    const acrossLo = inward > 0 ? face - bd : face, acrossHi = inward > 0 ? face : face + bd;
    const P = (a, c) => (run.orientation === 'h' ? [a, c] : [c, a]);
    const [x0, y0] = P(sAt - bw / 2, acrossLo), [x1, y1] = P(sAt + bw / 2, acrossHi);
    const lo = [Math.min(x0, x1), Math.min(y0, y1), z - bh / 2], hi = [Math.max(x0, x1), Math.max(y0, y1), z + bh / 2];
    const ifc = kind === 'switch' ? ['IfcSwitchingDevice', 'TOGGLESWITCH'] : kind === 'light' ? ['IfcJunctionBox', 'DATA'] : ['IfcOutlet', 'POWEROUTLET'];
    // the cable leaves from the wall's centre (inside the cavity), or on the room face for a surface-run tradition
    const cav = rules.route === 'surface' ? run.at + inward * (depthOf(run) / 2 + 30 * MM) : run.at;
    const at = P(sAt, cav);
    return { kind, key, ifc, lo, hi, box: sizeName, storey: lvl.index, at: [at[0], at[1], z], lvl, run, inward, s: sAt };
  };
  // ── lay out every room ──
  const devices = [];
  for (const lvl of levels) {
    const runs = (lvl.structure && lvl.structure.wallGraph && lvl.structure.wallGraph.runs) || [];
    const cells = (lvl.structure && lvl.structure.cells) || [];
    const zb = lvl.baseZ, H = lvl.height;
    cells.forEach((c) => {
      const role = roleOf(c);
      const edges = roomEdges(c, runs);
      const rk = `L${lvl.index}:${q4(c.x)},${q4(c.y)}`;
      const R = receptacles(edges, rules);
      checks.push({ rule: 'receptacle-spacing', room: rk, role, worstFt: R.worstFt, ok: R.worstFt <= rules.spacing / 2 + 1e-6 });
      const zones = openZones(lvl);
      const zoneRole = (d) => { const x = (d.lo[0] + d.hi[0]) / 2, y = (d.lo[1] + d.hi[1]) / 2; const z = zones.find((q) => x >= q.x - 0.5 && x <= q.x + q.w + 0.5 && y >= q.y - 0.5 && y <= q.y + q.h + 0.5); return z ? z.role : role; };
      R.list.forEach((r, n) => { const d = device('outlet', lvl, r.edge.run, r.s, r.edge.inward, zb + rules.recepZ, `${rk}:outlet:${n}`, rules.box); devices.push({ ...d, role: zoneRole(d), room: rk }); });
      // a switch beside every door, on the side with the more wall
      let doorCount = 0, switched = 0;
      edges.forEach((e, ei) => e.doors.forEach(([a, b], di) => {
        doorCount++;
        const roomA = a - e.lo, roomB = e.hi - b;
        const s = roomA >= roomB ? a - 4.5 * IN : b + 4.5 * IN;
        if (Math.max(roomA, roomB) < 0.5) return;
        switched++;
        devices.push({ ...device('switch', lvl, e.run, s, e.inward, zb + rules.switchZ, `${rk}:switch:${ei}.${di}`, rules.box), role: 'lighting', room: rk });
      }));
      checks.push({ rule: 'switch-at-door', room: rk, doors: doorCount, switches: switched, ok: switched === doorCount });
      // ceiling boxes: one per room, a grid 12 ft apart in a large one
      const nx = Math.max(1, Math.round(c.w / 12)), ny = Math.max(1, Math.round(c.h / 12));
      const zc = cfg.tradition === 'japanese' ? zb + H - 0.2 : zb + H - (cfg.tradition === 'metric' ? 0 : boardT);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = c.x + ((i + 0.5) * c.w) / nx, y = c.y + ((j + 0.5) * c.h) / ny;
        const [bw, bh, bd] = CATALOG[rules.ceilingBox].size.map((v) => v * MM);
        devices.push({ kind: 'light', key: `${rk}:light:${i}.${j}`, ifc: ['IfcJunctionBox', 'DATA'], lo: [x - bw / 2, y - bh / 2, zc], hi: [x + bw / 2, y + bh / 2, zc + bd], box: rules.ceilingBox, storey: lvl.index, at: [x, y, zc + bd], lvl, role: 'lighting', room: rk, ceiling: true });
      }
    });
  }
  // ── the panel: the ground storey's outer wall, beside the entry ──
  const ground = levels.find((l) => l.index === 0) || levels[0];
  const gRuns = ground.structure.wallGraph.runs;
  const entryRun = gRuns.find((r) => !r.interior && (r.openings || []).some((op) => op.entry)) || gRuns.find((r) => !r.interior && (r.openings || []).some((op) => !(op.sill > 0))) || gRuns.find((r) => !r.interior);
  const entry = (entryRun.openings || []).find((op) => op.entry) || (entryRun.openings || []).find((op) => !(op.sill > 0)) || { a: entryRun.along[0] + 2, b: entryRun.along[0] + 2 };
  const pS = entry.b + 3 < entryRun.along[1] - 1 ? entry.b + 3 : entry.a - 3;
  const pm = CATALOG[rules.panel]; const [pw, ph, pd] = pm.size.map((v) => v * MM);
  const pIn = -(entryRun.exteriorSide || 1);
  const pFace = entryRun.at + pIn * (depthOf(entryRun) / 2 + boardT);
  const PP = (a, c) => (entryRun.orientation === 'h' ? [a, c] : [c, a]);
  const [px0, py0] = PP(pS - pw / 2, pIn > 0 ? pFace - pd : pFace), [px1, py1] = PP(pS + pw / 2, pIn > 0 ? pFace : pFace + pd);
  const pz = ground.baseZ + rules.panelZ;
  const panel = { key: 'panel', ifc: 'IfcElectricDistributionBoard', type: rules.panel === 'panel:loadcenter' ? 'DISTRIBUTIONBOARD' : 'CONSUMERUNIT', material: rules.panel, storey: ground.index, lo: [Math.min(px0, px1), Math.min(py0, py1), pz - ph / 2].map(q4), hi: [Math.max(px0, px1), Math.max(py0, py1), pz + ph / 2].map(q4) };
  const pAt = PP(pS, rules.route === 'surface' ? entryRun.at + pIn * (depthOf(entryRun) / 2 + 30 * MM) : entryRun.at);
  const panelTop = [pAt[0], pAt[1], pz + ph / 2];
  els.push(panel);

  // ── circuits ──
  const circuits = [];
  const newCircuit = (use, storey, rooms = []) => { const c = { no: circuits.length + 1, use, storey, amps: rules.amps[use] || rules.amps.general, cable: rules.cable[use] || rules.cable.general, rooms, devices: [], lengthFt: 0 }; circuits.push(c); return c; };
  for (const lvl of levels) {
    const here = devices.filter((d) => d.storey === lvl.index);
    const outlets = here.filter((d) => d.kind === 'outlet');
    // kitchens: their own circuits, the receptacles alternating between them
    const kitchen = outlets.filter((d) => d.role === 'kitchen');
    if (kitchen.length) { const ks = Array.from({ length: rules.kitchenCircuits }, () => newCircuit('kitchen', lvl.index)); kitchen.forEach((d, i) => ks[i % ks.length].devices.push(d)); }
    for (const role of rules.dedicated) { const ds = outlets.filter((d) => d.role === role); if (ds.length) { const byRoom = new Map(); for (const d of ds) { if (!byRoom.has(d.room)) byRoom.set(d.room, []); byRoom.get(d.room).push(d); } for (const list of byRoom.values()) newCircuit(role, lvl.index).devices.push(...list); } }
    let cur = null;
    for (const d of outlets.filter((x) => x.role !== 'kitchen' && !rules.dedicated.includes(x.role))) {
      if (!cur || cur.devices.length >= rules.perCircuit) cur = newCircuit('general', lvl.index);
      cur.devices.push(d);
    }
    const lights = here.filter((d) => d.kind !== 'outlet');
    if (lights.length) newCircuit('lighting', lvl.index).devices.push(...lights);
  }
  for (const c of circuits) c.rooms = [...new Set(c.devices.map((d) => d.room))];

  // ── routes: Manhattan runs in the voids, drops in the walls ──
  let segN = 0;
  const seg = (a, b, cable, storey, circuit) => {
    const lo = [0, 1, 2].map((i) => Math.min(a[i], b[i])), hi = [0, 1, 2].map((i) => Math.max(a[i], b[i]));
    const len = hi[0] - lo[0] + hi[1] - lo[1] + hi[2] - lo[2];
    if (len < 0.02) return 0;
    const d = (CATALOG[cable].dia || 10) * MM;
    for (let i = 0; i < 3; i++) if (hi[i] - lo[i] < d) { const c = (hi[i] + lo[i]) / 2; lo[i] = c - d / 2; hi[i] = c + d / 2; }
    els.push({ key: `cable:${circuit.no}:${segN++}`, ifc: 'IfcCableSegment', type: 'CABLESEGMENT', material: cable, storey, lo: lo.map(q4), hi: hi.map(q4), minPx: 1.5, circuit: circuit.no, lengthFt: len });
    return len;
  };
  const path = (pts, cable, storey, circuit) => { let L = 0; for (let i = 0; i + 1 < pts.length; i++) L += seg(pts[i], pts[i + 1], cable, storey, circuit); return L; };
  const manhattan = (a, b, z) => [[a[0], a[1], z], [b[0], a[1], z], [b[0], b[1], z]];
  // how a device's cable reaches the void it runs in (and which void)
  const exitZ = (d) => {
    if (d.ceiling) return voidZ(d.lvl);
    if (rules.ring && d.kind === 'outlet') return floorVoidZ(d.lvl);
    return voidZ(d.lvl);
  };
  const countBores = (a, b, d) => {
    if (rules.route !== 'bored') return;
    const across = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    if (a[2] === b[2] && d && Math.abs(a[2] - (d.lvl.baseZ + 2)) < 1e-6) holes.studs += Math.floor(across / (16 * IN));
    else if (a[2] === b[2]) holes.joists += Math.floor(across / (16 * IN) / 2);
  };
  for (const c of circuits) {
    let prev = null;
    for (const d of c.devices) {
      const z = exitZ(d);
      const up = d.ceiling ? [] : [[d.at[0], d.at[1], d.at[2] + (z > d.at[2] ? 1 : -1) * (CATALOG[d.box].size[1] * MM) / 2], [d.at[0], d.at[1], z]];
      if (!d.ceiling) { if (rules.route === 'bored') holes.plates++; if (rules.route === 'chased' || rules.route === 'conduit') holes.chasesFt += Math.abs(z - d.at[2]); if (rules.route === 'surface') holes.mouldingFt += Math.abs(z - d.at[2]); }
      if (!prev) {
        // the home run: from the panel up to this device's void, across, and down to it
        const pv = z;
        const pts = [panelTop, [panelTop[0], panelTop[1], pv], ...manhattan(panelTop, d.at, pv).slice(1), ...up.slice().reverse()];
        c.lengthFt += path(pts, c.cable, d.storey, c);
      } else if (rules.route === 'bored' && !d.ceiling && !prev.ceiling && prev.room === d.room && prev.run && d.run && prev.lvl === d.lvl && Math.abs(prev.at[2] - d.at[2]) < 1e-6 && !doorBetween(prev, d)) {
        // along the wall, bored through the studs two feet up
        const zb2 = d.lvl.baseZ + 2;
        const pts = [[prev.at[0], prev.at[1], prev.at[2]], [prev.at[0], prev.at[1], zb2], ...manhattan(prev.at, d.at, zb2).slice(1), [d.at[0], d.at[1], d.at[2]]];
        for (let i = 0; i + 1 < pts.length; i++) countBores(pts[i], pts[i + 1], d);
        c.lengthFt += path(pts, c.cable, d.storey, c);
      } else {
        const zp = exitZ(prev);
        const zv = zp === z ? z : Math.max(zp, z);
        const pts = [[prev.at[0], prev.at[1], zp], [prev.at[0], prev.at[1], zv], ...manhattan(prev.at, d.at, zv).slice(1), [d.at[0], d.at[1], z], ...up.slice().reverse()];
        for (let i = 0; i + 1 < pts.length; i++) countBores(pts[i], pts[i + 1], null);
        c.lengthFt += path(pts, c.cable, d.storey, c);
      }
      prev = d;
    }
    // a ring closes back to the consumer unit
    if (rules.ring && c.use !== 'lighting' && prev) c.lengthFt += path([[prev.at[0], prev.at[1], exitZ(prev)], ...manhattan(prev.at, panelTop, exitZ(prev)).slice(1), panelTop], c.cable, prev.storey, c);
    c.lengthFt = Math.round(c.lengthFt * 10) / 10;
  }
  // the devices: open boxes at rough-in; lined, a plate on the finished face (the box is behind it)
  for (const d of devices) {
    if (lined && d.ceiling) {
      // a ceiling box, lined: the canopy of its fitting under the ceiling
      const cx = (d.lo[0] + d.hi[0]) / 2, cy = (d.lo[1] + d.hi[1]) / 2, r = 70 * MM;
      els.push({ key: `${d.key}:canopy`, ifc: 'IfcLightFixture', type: 'DIRECTIONSOURCE', material: 'plate:white', storey: d.storey, lo: [cx - r, cy - r, d.lo[2] - 40 * MM].map(q4), hi: [cx + r, cy + r, d.lo[2]].map(q4), host: d.key });
      continue;
    }
    if (lined && !d.ceiling) {
      const [pw2, ph2, pd2] = CATALOG['plate:white'].size.map((v) => v * MM);
      const cx = (d.lo[0] + d.hi[0]) / 2, cy = (d.lo[1] + d.hi[1]) / 2, cz = (d.lo[2] + d.hi[2]) / 2;
      const alongX = d.run.orientation === 'h';
      const faceC = alongX ? (d.inward > 0 ? d.hi[1] : d.lo[1]) : (d.inward > 0 ? d.hi[0] : d.lo[0]);
      const lo = alongX ? [cx - pw2 / 2, d.inward > 0 ? faceC : faceC - pd2, cz - ph2 / 2] : [d.inward > 0 ? faceC : faceC - pd2, cy - pw2 / 2, cz - ph2 / 2];
      const hi = alongX ? [cx + pw2 / 2, d.inward > 0 ? faceC + pd2 : faceC, cz + ph2 / 2] : [d.inward > 0 ? faceC + pd2 : faceC, cy + pw2 / 2, cz + ph2 / 2];
      els.push({ key: `${d.key}:plate`, ifc: d.ifc[0], type: d.ifc[1], material: 'plate:white', storey: d.storey, lo: lo.map(q4), hi: hi.map(q4), host: d.key });
    } else {
      els.push({ key: d.key, ifc: d.ifc[0], type: d.ifc[1], material: d.box, storey: d.storey, lo: d.lo.map(q4), hi: d.hi.map(q4) });
    }
  }
  // a lined house hides its cables in the walls, except a surface-run tradition's mouldings
  const shown = lined ? els.filter((e) => e.ifc !== 'IfcCableSegment' || rules.route === 'surface') : els;
  if (lined && rules.route === 'surface') for (const e of shown) if (e.ifc === 'IfcCableSegment' && e.lo[2] !== e.hi[2] && e.hi[2] - e.lo[2] > 0.2) e.material = 'raceway:moulding';
  checks.push({ rule: 'no-bore-through-hashira', ok: holes.posts === 0, posts: holes.posts });
  checks.push({ rule: 'bored-hole-edge-distance', ok: true, detail: '¾ in holes centred in 2×4 and 2×6 studs and plates leave 1⅜ in to each face (≥ 1¼ in: no nail plates)' });
  checks.push({ rule: 'bored-hole-depth', ok: true, detail: '¾ in in a 3½ in stud is 21% of its depth (≤ 40% bearing); in a joist, at mid-depth, under a third' });
  const rd = (v) => Math.round(v * 10) / 10;
  return {
    elements: shown, all: els,
    circuits: circuits.map((c) => ({ no: c.no, use: c.use, storey: c.storey, amps: c.amps, cable: c.cable, rooms: c.rooms, devices: c.devices.length, lengthFt: c.lengthFt })),
    panel: { material: rules.panel, storey: ground.index, circuits: circuits.length },
    holes: { ...holes, chasesFt: rd(holes.chasesFt), mouldingFt: rd(holes.mouldingFt) },
    checks,
  };
}

/** Is there a door on the wall line between two devices of one room? (Then the cable goes over it, in the void.) */
function doorBetween(a, b) {
  if (a.run !== b.run) return true;                                   // a corner: route via the void (simple, safe)
  const lo = Math.min(a.s, b.s), hi = Math.max(a.s, b.s);
  return (a.run.openings || []).some((op) => !(op.sill > 1e-6) && op.b > lo && op.a < hi);
}
