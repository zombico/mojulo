// construction/linings — what closes a frame, in the tradition it is built in, stage by stage.
//
//   north-american — the outer walls sheathed in OSB (dried in, rough-in), glass-wool batts in their stud bays
//     (insulated), and every room lined in ½ in gypsum board hung horizontally in 4 × 8 sheets, joints staggered, the
//     ceiling boarded across the joists (lined). A timber frame (post-and-beam) is closed by structural insulated
//     panels outside its posts, which stay showing inside.
//   british — the brick is plastered inside, two coats (lined); stud partitions and ceilings in 12.5 mm plasterboard,
//     hung vertically in 1200 × 2400 sheets.
//   japanese — shinkabe: each bay between the posts is infilled, set back from the post faces — komai bamboo lath
//     (rough-in), the arakabe clay coat (insulated), and the finish: jūraku inside, shikkui outside (lined). Rooms part
//     at fusuma and the outer openings close with shoji, sliding in the kamoi and shikii; the ceiling is sao-buchi
//     (sugi boards on battens).
//   metric — a steel or concrete frame infilled with block on the outer lines (rough-in), rendered outside and
//     plastered inside, stud partitions in plasterboard (lined).
// The partitions of a steel, concrete or timber frame are stud walls, lined by the tradition's board.
// Returns elements (elements.js) and, for block infill, masonry frames for the frame lowering.
import { registerTextureResolver, encodePng } from '../landscape/surface-textures.js';
import { CATALOG, TRADITIONS, ASSEMBLIES } from './catalog.js';
import { rectMinus, runBox } from './elements.js';
import { SECTIONS } from './sections.js';

export const STAGES = Object.freeze(['frame', 'rough-in', 'insulated', 'lined']);
export const stageAt = (stage, s) => STAGES.indexOf(stage) >= STAGES.indexOf(s);

const IN = 1 / 12, MM = 1 / 304.8;
const q4 = (v) => Math.round(v * 1e4) / 1e4;
const box = (b) => ({ lo: b.lo.map(q4), hi: b.hi.map(q4) });

// ── the komai lath's texture: split bamboo woven at 45 mm, the dark of the bay behind it ──
export const LATH_PREFIX = 'lath:komai';
function lathPng() {
  const N = 90, rgb = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = (x % 45) < 20, h = (y % 45) < 20;
    const c = v || h ? [198 - ((x * 7 + y * 3) % 9), 176 - ((x * 5) % 7), 118] : [44, 38, 30];
    const o = (y * N + x) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
  }
  return `data:image/png;base64,${encodePng(rgb, N, N).toString('base64')}`;
}
let lathUrl = null;
registerTextureResolver(LATH_PREFIX, () => (lathUrl = lathUrl || lathPng()));

// ── a lay-in ceiling's map: two tiles a side, fissured, in the white flanges of the T-bar grid ──
export const LAY_IN_PREFIX = 'ceiling:lay-in';
function layInPng() {
  const T = 96, N = 2 * T, rgb = Buffer.alloc(N * N * 3);
  const h = (x, y) => { let n = Math.imul(x * 374761393 + y * 668265263, 1274126177); n = Math.imul(n ^ (n >>> 13), 1103515245); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x % T, fy = y % T;
    let c;
    if (fx < 2 || fy < 2) c = [247, 247, 245];                              // the grid's flange
    else if (fx < 3 || fy < 3) c = [196, 196, 192];                         // the tile's shadowed edge
    else { const k = h(x, y) < 0.05 ? 0.8 : h(x >> 1, y >> 1) < 0.04 ? 0.88 : 1 - 0.03 * h(x, y + 7); c = [236 * k, 234 * k, 228 * k]; }
    const o = (y * N + x) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
  }
  return `data:image/png;base64,${encodePng(rgb, N, N).toString('base64')}`;
}
let layInUrl = null;
registerTextureResolver(LAY_IN_PREFIX, () => (layInUrl = layInUrl || layInPng()));

/**
 * The underside (ft) of the ceiling a steel or concrete storey hangs under its deepest beam, or null for a system
 * that hangs none. Wiring drops its ceiling boxes to it.
 */
export function suspendedCeilingZ(frames, cfg, S, zb, H) {
  const trad = TRADITIONS[cfg.tradition];
  if ((cfg.system !== 'steel' && cfg.system !== 'concrete') || !trad || !trad.suspended) return null;
  const t = (CATALOG[ASSEMBLIES[trad.suspended].layers[0].material].mm || 15) * MM;
  const soffit = soffitOver(frames, S, zb, H);
  return Math.max(zb + 7.5, Math.min(zb + H - 0.5, (soffit ?? zb + H) - 3 * IN) - t);
}

/** The underside (ft) of the lowest beam or joist over a storey, from its frame, or null. */
function soffitOver(frames, S, zb, H) {
  const fr = frames.find((f) => f.id === `storey-${S}`);
  let z = null;
  for (const m of (fr ? fr.members : [])) {
    if (Math.abs(m.from[2] - m.to[2]) > 0.01 || m.from[2] < zb + H * 0.5 || m.from[2] > zb + H + 1.5) continue;
    const depth = m.section ? (SECTIONS[m.section] ? SECTIONS[m.section].h * MM : 0.5) : Array.isArray(m.stock) ? m.stock[1] : 0.5;
    const under = m.from[2] - depth / 2;
    if (z === null || under < z) z = under;
  }
  return z;
}

/** Where the wall's structure stands: its depth (ft) for a run in a system. */
export function structDepth(system, run) {
  if (run.interior) return system === 'kigumi' ? 120 * MM : 3.5 * IN;
  return { platform: 5.5 * IN, masonry: 215 * MM, steel: 190 * MM, concrete: 190 * MM, 'post-and-beam': 7.25 * IN, kigumi: 120 * MM }[system];
}

/** Openings on a run as [a, b, z0, z1] relative to the storey floor. */
const holesOf = (run, H) => (run.openings || []).map((op) => [op.a, op.b, op.sill || 0, Math.min(op.top ?? H, H)]);

/** A run's lining extent: its ends drawn back to the face of each wall that meets them. */
function liningEnds(run, runs, depthOf, t) {
  const trim = (s, sign) => {
    for (const q of runs) {
      if (q === run || q.orientation === run.orientation) continue;
      if (Math.abs(q.at - s) > 0.05 || run.at < q.along[0] - 0.05 || run.at > q.along[1] + 0.05) continue;
      return sign * (depthOf(q) / 2 + t);
    }
    return 0;
  };
  return [run.along[0] + trim(run.along[0], 1), run.along[1] + trim(run.along[1], -1)];
}

/**
 * Sheets over a wall face: `rows` of `sh` (ft) up from z0, sheets `sl` long along the run, each row's joints shifted
 * half a sheet (so they stagger), cut round the openings, a hairline apart.
 */
function sheetRects(s0, s1, z0, z1, sl, sh, holes) {
  const gap = 0.125 * IN, out = [];
  for (let z = z0, r = 0; z < z1 - 0.05; z += sh, r++) {
    for (let s = s0 - (r % 2) * sl / 2; s < s1 - 0.05; s += sl) {
      for (const [p, q, a, b] of rectMinus([[Math.max(s, s0), Math.min(s + sl, s1), z, Math.min(z + sh, z1)]], holes)) out.push([p + gap / 2, q - gap / 2, a + gap / 2, b - gap / 2]);
    }
  }
  return out;
}

/**
 * planLinings(house, cfg, frames, o) → { elements, frames }: cfg = { system, tradition, stage }; `frames` the house's
 * framing plan (kigumi reads its posts from it); `o` the house options (floorDrop).
 */
export function planLinings(house, cfg, frames, o = {}) {
  const { system, stage } = cfg;
  const trad = TRADITIONS[cfg.tradition];
  const drop = o.floorDrop ?? 1.1;
  const els = [], extraFrames = [];
  if (stage === 'frame') return { elements: els, frames: extraFrames };
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const partBoard = ASSEMBLIES[trad.partition].layers.find((l) => l.role === 'lining');
  const board = partBoard ? partBoard.material : 'board:gypsum-12.7';
  const bt = (CATALOG[board].mm || 12.7) * MM;
  const [sw, sh] = (CATALOG[board].sheet || [1219, 2438]).map((v) => v * MM);
  const vertical = cfg.tradition !== 'north-american';                   // British and metric boards hang upright
  const add = (key, ifc, type, material, storey, b, extra = {}) => els.push({ key, ifc, type, material, storey, ...box(b), ...extra });

  for (const lvl of levels) {
    const zb = lvl.baseZ, H = lvl.height, S = lvl.index;
    const runs = (lvl.structure && lvl.structure.wallGraph && lvl.structure.wallGraph.runs) || [];
    const above = levels.find((l) => l.index === S + 1);
    const depth = (run) => structDepth(system, run);
    runs.forEach((run, ri) => {
      const rk = `L${S}:${run.orientation}${q4(run.at)}:${q4(run.along[0])}`;
      const holes = holesOf(run, H);
      const extSide = run.interior ? 0 : (run.exteriorSide || 1);
      const inSides = run.interior ? [1, -1] : [-extSide];
      const d = depth(run);
      const studded = system === 'platform' || (run.interior && system !== 'kigumi');
      // ── stud walls: sheathing and batts outside (platform), boards on the room sides ──
      if (studded) {
        if (!run.interior && system === 'platform') {
          if (stageAt(stage, 'rough-in')) {
            const t = 11.1 * MM;
            const rects = sheetRects(run.along[0] - d / 2 - t, run.along[1] + d / 2 + t, zb - drop, zb + H, 4, 8, holes.map(([a, b, z0, z1]) => [a, b, zb + z0, zb + z1]));
            rects.forEach(([p, q, a, b], n) => add(`${rk}:sheathing:${n}`, 'IfcCovering', 'CLADDING', 'board:osb-11', S, runBox(run, p, q, extSide * (d / 2 + t / 2), t, a, b)));
          }
          if (stageAt(stage, 'insulated')) {
            const s0 = run.along[0] + d / 2, s1 = run.along[1] - d / 2;
            let n = 0;
            for (let s = s0; s < s1 - 0.1; s += 16 * IN) {
              const a = s + 0.75 * IN, b = Math.min(s + 16 * IN - 0.75 * IN, s1 - 0.75 * IN);
              if (b - a < 0.2 || holes.some(([p, q]) => b > p - 3 * IN && a < q + 3 * IN)) continue;
              add(`${rk}:batt:${n++}`, 'IfcCovering', 'INSULATION', 'insulation:glass-wool', S, runBox(run, a, b, 0, d * 0.98, zb + 1.5 * IN, zb + H - 3 * IN));
            }
          }
        }
        if (stageAt(stage, 'lined')) {
          const [e0, e1] = liningEnds(run, runs, depth, 0);
          for (const side of inSides) {
            const rects = vertical ? sheetRects(e0, e1, zb, zb + H - bt, sw, sh, holes.map(([a, b, z0, z1]) => [a, b, zb + z0, zb + z1]))
              : sheetRects(e0, e1, zb, zb + H - bt, sh, sw, holes.map(([a, b, z0, z1]) => [a, b, zb + z0, zb + z1]));
            rects.forEach(([p, q, a, b], n) => add(`${rk}:board${side}:${n}`, 'IfcCovering', 'CLADDING', board, S, runBox(run, p, q, side * (d / 2 + bt / 2), bt, a, b)));
          }
        }
        return;
      }
      // ── the outer walls of the other systems ──
      if (system === 'masonry' && stageAt(stage, 'lined')) {
        const t = 13 * MM;
        const [e0, e1] = liningEnds(run, runs, depth, 0);
        rectMinus([[e0, e1, zb, zb + H]], holes.map(([a, b, z0, z1]) => [a, b, zb + z0, zb + z1])).forEach(([p, q, a, b], n) => add(`${rk}:plaster:${n}`, 'IfcCovering', 'CLADDING', 'plaster:gypsum-two-coat', S, runBox(run, p, q, -extSide * (d / 2 + t / 2), t, a, b)));
      }
      if ((system === 'steel' || system === 'concrete') && stageAt(stage, 'lined')) {
        const hs = holes.map(([a, b, z0, z1]) => [a, b, zb + z0, zb + z1]);
        for (const [mat, t, side, name] of [['plaster:gypsum-two-coat', 13 * MM, -extSide, 'plaster'], ['plaster:render', 15 * MM, extSide, 'render']]) {
          rectMinus([[run.along[0] - (side === extSide ? d / 2 + t : 0), run.along[1] + (side === extSide ? d / 2 + t : 0), zb - (side === extSide ? drop : 0), zb + H]], hs)
            .forEach(([p, q, a, b], n) => add(`${rk}:${name}:${n}`, 'IfcCovering', 'CLADDING', mat, S, runBox(run, p, q, side * (d / 2 + t / 2), t, a, b)));
        }
      }
      if (system === 'post-and-beam' && stageAt(stage, 'rough-in')) {
        const t = 165 * MM;
        const rects = sheetRects(run.along[0] - d / 2 - t, run.along[1] + d / 2 + t, zb - drop, zb + H, 4, 8, holes.map(([a, b, z0, z1]) => [a, b, zb + z0, zb + z1]));
        rects.forEach(([p, q, a, b], n) => add(`${rk}:sip:${n}`, 'IfcWall', 'ELEMENTEDWALL', 'board:sip-165', S, runBox(run, p, q, extSide * (d / 2 + t / 2), t, a, b)));
      }
      if (system === 'kigumi') shinkabe(add, run, rk, S, lvl, frames, stage, extSide, drop, levels[0] === lvl, holes);
      void ri;
    });
    // ── block infill: masonry on each outer line, one wall per line from the foundation up (steel, concrete) ──
    if ((system === 'steel' || system === 'concrete') && stageAt(stage, 'rough-in') && lvl === levels[0]) {
      const lines = new Map();
      for (const L of levels) for (const run of (L.structure.wallGraph.runs || []).filter((r) => !r.interior)) {
        const k = `${run.orientation}:${q4(run.at)}`;
        if (!lines.has(k)) lines.set(k, []);
        lines.get(k).push({ run, zb: L.baseZ, H: L.height });
      }
      const top = levels[levels.length - 1];
      const walls = [...lines.values()].map((line, i) => {
        const run = line[0].run; const s0 = Math.min(...line.map((x) => x.run.along[0])), s1 = Math.max(...line.map((x) => x.run.along[1]));
        const zF = levels[0].baseZ - 5 * IN;
        const P = (s) => (run.orientation === 'h' ? [s, run.at, zF] : [run.at, s, zF]).map(q4);
        const openings = line.flatMap(({ run: r, zb: z }) => (r.openings || []).map((op) => ({ at: q4(op.a - s0), width: q4(op.b - op.a), height: q4((op.top ?? 6.83) - (op.sill || 0)), sill: q4((op.sill || 0) + z - zF) })));
        return { id: `infill-${i}`, from: P(s0), to: P(s1), height: q4(top.baseZ + top.height - zF), unit: 'cmu', bond: 'stretcher', body: 'block', mortar: 'grey', joint: 'flush', openings };
      });
      extraFrames.push({ id: 'infill', unit: 'ft', walls });
    }
    // ── a kigumi floor over its neda: sugi boards, a board's width apart, round the stair ──
    if (system === 'kigumi' && stageAt(stage, 'lined')) {
      const fp = house.footprint, own = ((lvl.structure && lvl.structure.slabHoles) || []).map((h) => [h.x0, h.x1, h.y0, h.y1]);
      const w = 180 * MM, gap = 1 * MM;
      let n = 0;
      for (let y = fp.y0; y < fp.y1 - 0.05; y += w) {
        for (const [p, q, r, t] of rectMinus([[fp.x0, fp.x1, y, Math.min(y + w, fp.y1) - gap]], own)) add(`L${S}:floorboard:${n++}`, 'IfcCovering', 'FLOORING', 'board:sugi-floor', S, { lo: [p, r, zb], hi: [q, t, zb + 15 * MM] });
      }
    }
    // ── ceilings ──
    if (stageAt(stage, 'lined') && trad.ceiling && system !== 'post-and-beam' && system !== 'steel' && system !== 'concrete') {
      const holes = ((above && above.structure && above.structure.slabHoles) || []).map((h) => [h.x0, h.x1, h.y0, h.y1]);
      const fp = house.footprint;
      if (cfg.tradition === 'japanese') {
        for (const c of (lvl.structure.cells || [])) {
          const inset = 60 * MM, zc = zb + H - 0.2;
          const [x0, x1, y0, y1] = [c.x + inset, c.x + c.w - inset, c.y + inset, c.y + c.h - inset];
          const along = c.w >= c.h;
          rectMinus([[x0, x1, y0, y1]], holes).forEach(([p, qq, r, s], n) => add(`L${S}:ceiling:${q4(c.x)},${q4(c.y)}:${n}`, 'IfcCovering', 'CEILING', 'board:sugi-ceiling', S, { lo: [p, r, zc], hi: [qq, s, zc + 9 * MM] }));
          // sao: battens under the boards every 1.5 shaku, across the boards' run
          const span = along ? [y0, y1] : [x0, x1];
          const step = 1.5 * 0.303 / 0.3048;
          let n = 0;
          for (let v = (along ? x0 : y0) + step; v < (along ? x1 : y1) - 0.1; v += step) {
            const lo = along ? [v - 18 * MM, span[0], zc - 36 * MM] : [span[0], v - 18 * MM, zc - 36 * MM];
            const hi = along ? [v + 18 * MM, span[1], zc] : [span[1], v + 18 * MM, zc];
            if (holes.some(([h0, h1, k0, k1]) => hi[0] > h0 && lo[0] < h1 && hi[1] > k0 && lo[1] < k1)) continue;
            add(`L${S}:sao:${q4(c.x)},${q4(c.y)}:${n++}`, 'IfcMember', 'MEMBER', 'timber:sugi', S, { lo, hi });
          }
        }
      } else {
        const zc = zb + H - bt;
        const rects = sheetRects(fp.x0, fp.x1, fp.y0, fp.y1, 12, 4, holes);
        rects.forEach(([p, qq, r, s], n) => add(`L${S}:ceiling:${n}`, 'IfcCovering', 'CEILING', board, S, { lo: [p, r, zc], hi: [qq, s, zc + bt] }));
      }
    }
    // ── a steel or concrete floor is hidden by a ceiling hung under its deepest beam: lay-in tiles in a T-bar grid
    // (North American) or plasterboard on a suspended grid; the storey keeps at least 7½ ft of headroom ──
    if (stageAt(stage, 'lined') && (system === 'steel' || system === 'concrete') && trad.suspended) {
      const layer = ASSEMBLIES[trad.suspended].layers[0];
      const t = (CATALOG[layer.material].mm || 15) * MM;
      const zc = suspendedCeilingZ(frames, cfg, S, zb, H);
      const holes = ((above && above.structure && above.structure.slabHoles) || []).map((h) => [h.x0, h.x1, h.y0, h.y1]);
      const fp = house.footprint, inset = structDepth(system, { interior: false }) / 2;
      rectMinus([[fp.x0 + inset, fp.x1 - inset, fp.y0 + inset, fp.y1 - inset]], holes).forEach(([p, qq, r, s], n) => add(`L${S}:ceiling:${n}`, 'IfcCovering', 'CEILING', layer.material, S, { lo: [p, r, zc], hi: [qq, s, zc + t] }, { suspended: true }));
    }
  }
  return { elements: els, frames: extraFrames };
}

/** The shinkabe of one run: each bay between posts infilled (lath, clay, finish), fusuma and shoji in its openings. */
function shinkabe(add, run, rk, S, lvl, frames, stage, extSide, drop, lowest, holes) {
  const P4 = 120 * MM, beamD = 240 * MM, zb = lvl.baseZ, H = lvl.height;
  const frame = frames.find((f) => f.id === `storey-${S}`);
  if (!frame) return;
  const cross = run.orientation === 'h' ? 1 : 0, along = 1 - cross;
  const posts = frame.members.filter((m) => /^hashira-/.test(m.id) && Math.abs(m.from[cross] - run.at) < 0.02 && m.from[along] > run.along[0] - 0.1 && m.from[along] < run.along[1] + 0.1).map((m) => m.from[along]).sort((a, b) => a - b);
  const z0 = lowest ? zb - 0.35 : zb - drop + beamD, z1 = zb + H;
  const openRects = holes.map(([a, b, s0, s1]) => [a, b, s0 > 0 ? zb + s0 - 0.08 : z0, zb + s1 + 0.16]);
  const layer = stageAt(stage, 'lined') ? 'finish' : stageAt(stage, 'insulated') ? 'clay' : 'lath';
  const t = { lath: 20 * MM, clay: 60 * MM, finish: 76 * MM }[layer];
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i] + P4 / 2, b = posts[i + 1] - P4 / 2;
    if (b - a < 0.1) continue;
    rectMinus([[a, b, z0, z1]], openRects).forEach(([p, q, r, s], n) => {
      const key = `${rk}:shinkabe:${i}:${n}`;
      const bx = runBox(run, p, q, 0, t, r, s);
      if (layer === 'lath') add(key, 'IfcWall', 'PARTITIONING', 'bamboo:komai', S, bx, { texture: LATH_PREFIX, uvM: 0.09 });
      else if (layer === 'clay') add(key, 'IfcWall', 'PARTITIONING', 'clay:arakabe', S, bx);
      else {
        const acrossAxis = run.orientation === 'h' ? 'y' : 'x';
        const jura = CATALOG['plaster:jura'].rgb, shik = CATALOG['plaster:shikkui'].rgb;
        const sideRgb = extSide ? { [`${extSide > 0 ? '+' : '-'}${acrossAxis}`]: shik, [`${extSide > 0 ? '-' : '+'}${acrossAxis}`]: jura } : null;
        add(key, 'IfcWall', 'PARTITIONING', extSide ? 'plaster:shikkui' : 'plaster:jura', S, bx, { rgb: jura, ...(sideRgb ? { sideRgb } : {}) });
      }
    });
  }
  if (!stageAt(stage, 'lined')) return;
  // fittings: fusuma between rooms, shoji at the outer openings — two panels in two tracks each
  for (const [a, b, s0, s1] of holes) {
    const shoji = !!extSide;
    const zLo = zb + s0 + (s0 > 0 ? 0 : 0.02), zHi = zb + s1 + 0.06;
    const w = (b - a) / 2 + 15 * MM;
    for (const [k, p0, off] of [[0, a, -15 * MM], [1, b - w, 15 * MM]]) {
      const key = `${rk}:${shoji ? 'shoji' : 'fusuma'}:${q4(a)}:${k}`;
      const T = shoji ? 30 * MM : 20 * MM;
      if (shoji) {
        add(`${key}:paper`, 'IfcWindow', 'SLIDING', 'paper:washi', S, runBox(run, p0 + 30 * MM, p0 + w - 30 * MM, off + extSide * 8 * MM, 2 * MM, zLo + 30 * MM, zHi - 30 * MM), { alpha: 0.9 });
        // the frame and its kumiko: three uprights, a bar every 300 mm
        const bar = (s0b, s1b, z0b, z1b, n) => add(`${key}:k${n}`, 'IfcMember', 'MEMBER', 'timber:hinoki', S, runBox(run, s0b, s1b, off, T * 0.6, z0b, z1b));
        bar(p0, p0 + 30 * MM, zLo, zHi, 'l'); bar(p0 + w - 30 * MM, p0 + w, zLo, zHi, 'r'); bar(p0, p0 + w, zLo, zLo + 30 * MM, 'b'); bar(p0, p0 + w, zHi - 30 * MM, zHi, 't');
        for (let j = 1; j < 4; j++) { const s = p0 + (w * j) / 4; bar(s - 5 * MM, s + 5 * MM, zLo + 30 * MM, zHi - 30 * MM, `v${j}`); }
        const rows = Math.max(2, Math.round((zHi - zLo) / (300 * MM)));
        for (let j = 1; j < rows; j++) { const z = zLo + ((zHi - zLo) * j) / rows; bar(p0 + 30 * MM, p0 + w - 30 * MM, z - 5 * MM, z + 5 * MM, `h${j}`); }
      } else {
        add(`${key}:paper`, 'IfcDoor', 'SLIDING', 'paper:karakami', S, runBox(run, p0 + 20 * MM, p0 + w - 20 * MM, off, T * 0.8, zLo + 20 * MM, zHi - 20 * MM));
        const rim = [48, 34, 28];
        const edge = (s0b, s1b, z0b, z1b, n) => add(`${key}:f${n}`, 'IfcMember', 'MEMBER', 'timber:hinoki', S, runBox(run, s0b, s1b, off, T, z0b, z1b), { rgb: rim });
        edge(p0, p0 + 20 * MM, zLo, zHi, 'l'); edge(p0 + w - 20 * MM, p0 + w, zLo, zHi, 'r'); edge(p0, p0 + w, zLo, zLo + 20 * MM, 'b'); edge(p0, p0 + w, zHi - 20 * MM, zHi, 't');
        const hz = zLo + 2.6;                                               // the hikite, about 800 mm up
        add(`${key}:hikite`, 'IfcMember', 'MEMBER', 'timber:hinoki', S, runBox(run, p0 + w - 0.35, p0 + w - 0.2, off, T * 1.1, hz, hz + 0.15), { rgb: [40, 30, 24] });
      }
    }
  }
}
