/**
 * RepeatField — the abstraction underneath every "repeat" mark in the
 * polygonizer.
 *
 * Six different mark kinds (`array`, `partition`, `mandalaFractal` /
 * `facade-bays`, `manjiFill`, `manjiLevelRepeater`, plus the slot-map
 * `repeat: { count, spacing }` shorthand) are all the same six-field
 * tuple wearing different costumes:
 *
 *     RepeatField {
 *       frame,         // <line | axis | uvFace | radial> — coordinate space
 *       position,      // (cell, frame) → point in frame coords (carried by frame)
 *       motif,         // (i, cell, total) → motif name (sequence-aware)
 *       exclusions,    // [{ kind, test(cell, ctx) }] — filtered at walk time
 *       manjiFrame,    // cardinal manji whose lengthScales scale with the count
 *       provenance,    // { kind, ref, field, role } — survives expansion
 *     }
 *
 * The manjiFrame is what makes this more than a refactor: today it lives
 * only on `facePattern` (via `facadeManjiFrame` inside the renderer), so
 * "manji is reality" is enforced for facade window-bands but bypassable for
 * `array` (step treads, chimney bricks) and `partition` (shelf boards). When
 * every RepeatField carries a `manjiFrame`, every repeated thing in a
 * building is grounded in the same cardinal lattice as the perpendicular
 * mass it lives on.
 *
 * Provenance from `walk(field)` is uniform across all frame kinds:
 * `{ index, total, sequenceIndex, repeatIndex, ... }`. The renderer-specific
 * stamps (`arrayIndex`, `partitionBoardIndex`, `manjiLevel`, `manjiYStacks`)
 * are derivable from this — adapters in the renderer expanders project the
 * uniform shape back into whatever provenance keys downstream code already
 * reads.
 */

import { cardinalManji3D, evaluateManji3D, inscribedCuboid } from './manji.js';

const PRECISION = 3;
const round = (n) => {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** PRECISION;
  return Math.round(n * f) / f;
};

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// ===== Sequence motif (singleton = uniform) =================================

/**
 * Wrap a motif array so the same call site handles both uniform repeats
 * (`['french-window']`) and rhythm-based ones
 * (`['french-window', 'french-window', 'balcony']`). The wrap-around math
 * is the only thing every "repeat with a motif" needed; centralizing it
 * removes the fork between `mandalaFractal` and `manjiLevelRepeater`.
 *
 * Phase: 2D frames (uvFace) should rhythm-match against `col` so the same
 * motif column repeats top-to-bottom (this is exactly what
 * `manjiLevelRepeaterPatternBoxes` does — `motif = sequence[col %
 * sequence.length]`). 1D frames (line/axis/radial) fall back to the global
 * cell index. The default `phaseKey: 'auto'` picks the right one; pass
 * `phaseKey: 'index'` or a named cell key to override.
 */
export function sequenceMotif(sequence, { phaseKey = 'auto' } = {}) {
  const raw = Array.isArray(sequence) && sequence.length ? sequence.slice() : [null];
  const length = raw.length;
  const resolvePhase = (cell) => {
    if (phaseKey === 'auto') return cell?.col !== undefined ? cell.col : cell?.index ?? 0;
    if (phaseKey === 'index') return cell?.index ?? 0;
    return cell?.[phaseKey] ?? cell?.index ?? 0;
  };
  return {
    kind: 'sequence',
    length,
    sequence: raw,
    phaseKey,
    pick(cell) {
      const phase = Math.floor(resolvePhase(cell));
      const wrapped = ((phase % length) + length) % length;
      return {
        motif: raw[wrapped],
        sequenceIndex: wrapped,
        repeatIndex: Math.floor(phase / length),
      };
    },
  };
}

// ===== Exclusions ===========================================================
//
// Exclusion is the field that aches the most across existing kinds:
// `facePattern` has `skip[]` and `voids[]`; the slot map has `excludes:
// ['door']` (which doesn't lower into the pattern); `array` and `partition`
// have nothing. The three constructors below cover those cases under one
// shape — every exclusion is `{ kind, test(cell, context) → boolean }`.

export function byCell(...coords) {
  const specs = coords.map((c) => {
    if (Array.isArray(c)) return { col: c[0], row: c[1] };
    if (c && typeof c === 'object') return { ...c };
    return null;
  }).filter(Boolean);
  return {
    kind: 'byCell',
    specs,
    test(cell) {
      return specs.some((spec) => {
        if (spec.index !== undefined) return spec.index === cell.index;
        if (spec.col !== undefined && spec.row !== undefined) {
          return spec.col === cell.col && spec.row === cell.row;
        }
        if (spec.col !== undefined) return spec.col === cell.col;
        if (spec.row !== undefined) return spec.row === cell.row;
        return false;
      });
    },
  };
}

export function byPredicate(fn) {
  if (typeof fn !== 'function') throw new Error('byPredicate: fn must be a function');
  return { kind: 'byPredicate', test: fn };
}

/**
 * Exclude cells that a named role currently occupies. The slot map says
 * `excludes: ['door']`; this resolves the door's cell via a caller-supplied
 * resolver so the window-band excludes whatever cell the door has actually
 * landed on, not whatever cell the recipe author guessed.
 */
export function byRole(roles, defaultResolver) {
  const wanted = Array.isArray(roles) ? roles.slice() : [roles];
  return {
    kind: 'byRole',
    roles: wanted,
    test(cell, context) {
      const resolver = context?.roleResolver ?? defaultResolver;
      if (typeof resolver !== 'function') return false;
      for (const role of wanted) {
        const target = resolver(role);
        if (!target) continue;
        if (target.index !== undefined && target.index === cell.index) return true;
        if (target.col !== undefined && target.row !== undefined &&
            target.col === cell.col && target.row === cell.row) return true;
        if (target.col !== undefined && cell.row === undefined &&
            target.col === cell.col) return true;
      }
      return false;
    },
  };
}

// ===== Frames ===============================================================
//
// Each frame is `{ kind, total, cells(), position(cell) }`. Cells are bare
// metadata about each slot in the field (index, total, plus frame-specific
// hints like col/row or boardIndex/boundary). `position` maps a cell into
// the frame's local coordinate space — pixels for line/radial, world units
// for axis, uv-fraction for uvFace.

export function lineFrame({ from, to, count, ref } = {}) {
  if (!Array.isArray(from) || from.length < 2 || !Array.isArray(to) || to.length < 2) {
    throw new Error('lineFrame: from and to must be [x, y] arrays');
  }
  const total = Math.max(1, Math.floor(finiteOr(count, 1)));
  const fromPoint = [from[0], from[1]];
  const toPoint = [to[0], to[1]];
  return {
    kind: 'line',
    ref,
    from: fromPoint,
    to: toPoint,
    total,
    cells() {
      const out = [];
      for (let i = 0; i < total; i++) out.push({ index: i, total });
      return out;
    },
    position(cell) {
      const t = total === 1 ? 0.5 : cell.index / (total - 1);
      return {
        point: [
          fromPoint[0] + (toPoint[0] - fromPoint[0]) * t,
          fromPoint[1] + (toPoint[1] - fromPoint[1]) * t,
        ],
        t,
      };
    },
  };
}

/**
 * Boards along one axis — `partition`'s shape. `count` is the number of
 * intervals; with `includeBoundary: true` (the default) we emit
 * `count + 1` cells so the start and end boundary boards are nameable.
 * That matches the existing partition expander, which puts the final board
 * at `rawY - thickness` so the end of the field sits flush with the target.
 */
export function axisFrame({ axis = 'y', origin, extent, count, includeBoundary = true, ref } = {}) {
  if (!Array.isArray(origin)) throw new Error('axisFrame: origin must be a coordinate array');
  if (!Number.isFinite(extent)) throw new Error('axisFrame: extent must be a finite number');
  const intervals = Math.max(1, Math.floor(finiteOr(count, 1)));
  const total = includeBoundary ? intervals + 1 : intervals;
  const denom = includeBoundary ? total - 1 : total;
  return {
    kind: 'axis',
    ref,
    axis,
    origin: origin.slice(),
    extent,
    intervals,
    total,
    cells() {
      const out = [];
      for (let i = 0; i < total; i++) {
        out.push({
          index: i,
          total,
          boardIndex: i,
          boundary: i === 0 ? 'start' : (includeBoundary && i === total - 1) ? 'end' : 'internal',
        });
      }
      return out;
    },
    position(cell) {
      const t = denom === 0 ? 0 : cell.index / denom;
      const offset = extent * t;
      const point = origin.slice();
      if (axis === 'x') point[0] += offset;
      else if (axis === 'y') point[1] += offset;
      else if (axis === 'z') { if (point.length < 3) point.push(0); point[2] += offset; }
      else throw new Error(`axisFrame: unknown axis '${axis}'`);
      return { point, t };
    },
  };
}

/**
 * UV grid on a solid's face — `facade-bays` / `manjiLevelRepeater` shape.
 * Coordinates are unit fractions of the face (0..1), so the same field
 * survives perspective projection: only `face.points` change, not the
 * cells' u/v.
 *
 * `topBand` / `lowerBand` reserve fractional strips at the top and bottom
 * of the usable area — that's how the existing renderer carves room for
 * trim bands without subdividing the cell grid around them.
 */
export function uvFaceFrame({
  cols, rows,
  margin = 0.08,
  gap = 0.025,
  topBand = 0,
  lowerBand = 0,
  ref,
} = {}) {
  const c = Math.max(1, Math.floor(finiteOr(cols, 1)));
  const r = Math.max(1, Math.floor(finiteOr(rows, 1)));
  const usableU = Math.max(0.05, 1 - margin * 2);
  const usableV = Math.max(0.05, 1 - margin * 2 - topBand - lowerBand);
  const cellW = c === 1 ? usableU : (usableU - gap * (c - 1)) / c;
  const cellH = r === 1 ? usableV : (usableV - gap * (r - 1)) / r;
  const total = c * r;
  return {
    kind: 'uvFace',
    ref,
    cols: c, rows: r,
    margin, gap, topBand, lowerBand,
    cellW, cellH,
    total,
    cells() {
      const out = [];
      for (let row = 0; row < r; row++) {
        for (let col = 0; col < c; col++) {
          out.push({
            index: row * c + col,
            total,
            col, row,
            cols: c, rows: r,
          });
        }
      }
      return out;
    },
    position(cell) {
      return {
        u: margin + cell.col * (cellW + gap),
        v: margin + topBand + cell.row * (cellH + gap),
        w: Math.max(cellW, 0.001),
        h: Math.max(cellH, 0.001),
        // Convention shared with `manjiLevelRepeaterPatternBoxes`: manji
        // level counts up from the BOTTOM of the field. Row 0 (top) is the
        // highest level; row rows-1 (bottom) is level 1.
        manjiLevel: r - cell.row,
      };
    },
  };
}

/**
 * Radial frame — `mandalaArrangement` / future ring-stairs / colonnade
 * shape. Default is a full 360° ring with even spacing; passing `sweepDeg`
 * gives an arc.
 */
export function radialFrame({ center, radius, count, sweepDeg = 360, startDeg = -90, ref } = {}) {
  if (!Array.isArray(center) || center.length < 2) {
    throw new Error('radialFrame: center must be a coordinate array');
  }
  const total = Math.max(1, Math.floor(finiteOr(count, 1)));
  const isFullSweep = Math.abs(sweepDeg - 360) < 1e-9 || Math.abs(sweepDeg + 360) < 1e-9;
  return {
    kind: 'radial',
    ref,
    center: center.slice(),
    radius,
    sweepDeg, startDeg,
    total,
    cells() {
      const out = [];
      for (let i = 0; i < total; i++) out.push({ index: i, total });
      return out;
    },
    position(cell) {
      const denom = isFullSweep ? total : Math.max(1, total - 1);
      const t = total === 1 ? 0 : cell.index / denom;
      const angleDeg = startDeg + sweepDeg * t;
      const theta = (angleDeg * Math.PI) / 180;
      return {
        point: [center[0] + radius * Math.cos(theta), center[1] + radius * Math.sin(theta)],
        t,
        angleDeg,
      };
    },
  };
}

// ===== Manji-frame stamps ===================================================
//
// `cardinalManjiFrame` is the shared replacement for the inline
// `facadeManjiFrame` in neo-rembrandt: it accepts any cardinal-bar program,
// evaluates a 3D manji, and reports the inscribed cuboid. The convenience
// constructors (`facadeManjiFrame`, `lineManjiFrame`) are thin wrappers
// preserving the existing scale conventions so adapter migrations don't
// shift any cuboid bounds.

const MANJI_SCALE_DENOM = 4;
const MANJI_SCALE_FLOOR = 0.25;
const manjiScale = (count) => Math.max(count / MANJI_SCALE_DENOM, MANJI_SCALE_FLOOR);

export function cardinalManjiFrame(bars, { ref, kind } = {}) {
  const program = cardinalManji3D(bars);
  const manji = evaluateManji3D(program);
  const cuboid = inscribedCuboid(manji);
  return {
    kind: kind ?? 'cardinal-manji-frame',
    ref,
    axes: program.bars.map((b) => b.axis),
    cuboid: {
      min: { x: round(cuboid.min.x), y: round(cuboid.min.y), z: round(cuboid.min.z) },
      max: { x: round(cuboid.max.x), y: round(cuboid.max.y), z: round(cuboid.max.z) },
    },
  };
}

/**
 * Building-facade frame: bar1 = N-S (facade width, scales with cols),
 * bar2 = E-W (thin depth, fixed), bar3 = Zenith-Nadir (height, scales with
 * rows). Matches the existing `facadeManjiFrame` inside the renderer so the
 * cuboid bounds are bit-identical for migrations.
 */
export function facadeManjiFrame({ cols = 1, rows = 1, ref } = {}) {
  return cardinalManjiFrame({
    bar1: { axis: 'N-S', lengthScale: manjiScale(cols) },
    bar2: { axis: 'E-W', lengthScale: MANJI_SCALE_FLOOR },
    bar3: { axis: 'Zenith-Nadir', lengthScale: manjiScale(rows) },
  }, { ref, kind: 'facade-manji-frame' });
}

/**
 * Line-shaped frame for 1D repeats — step treads (N-S), brick column
 * (Zenith-Nadir), shingle band (E-W). The chosen axis scales with the
 * count; the orthogonal axis stays at the floor scale.
 */
export function lineManjiFrame({ count = 1, axis = 'N-S', ref } = {}) {
  if (!['N-S', 'E-W', 'Zenith-Nadir'].includes(axis)) {
    throw new Error(`lineManjiFrame: unsupported axis '${axis}' (expected N-S | E-W | Zenith-Nadir)`);
  }
  const scale = manjiScale(count);
  // Always declare all three cardinal bars: the chosen axis carries the
  // count-derived scale, the orthogonal axes sit at the floor scale so the
  // cuboid is fully spanned. A 1D field is still grounded in a 3D lattice.
  const bars = {
    bar1: { axis: 'N-S', lengthScale: axis === 'N-S' ? scale : MANJI_SCALE_FLOOR },
    bar2: { axis: 'E-W', lengthScale: axis === 'E-W' ? scale : MANJI_SCALE_FLOOR },
    bar3: { axis: 'Zenith-Nadir', lengthScale: axis === 'Zenith-Nadir' ? scale : MANJI_SCALE_FLOOR },
  };
  return cardinalManjiFrame(bars, { ref, kind: `line-manji-frame:${axis}` });
}

// ===== RepeatField composer + walk =========================================

/**
 * Compose a RepeatField. The motif defaults to a singleton (uniform);
 * exclusions default to none; manjiFrame defaults to null. The provenance
 * object is merged with the frame's `kind` and `ref` so downstream cells
 * always know which field they came from.
 */
export function repeatField({
  frame,
  motif = sequenceMotif([null]),
  exclusions = [],
  manjiFrame = null,
  provenance = {},
  roleResolver,
} = {}) {
  if (!frame || typeof frame.cells !== 'function' || typeof frame.position !== 'function') {
    throw new Error('repeatField: frame must be a frame object (lineFrame, uvFaceFrame, ...)');
  }
  return {
    frame,
    motif,
    exclusions: Array.isArray(exclusions) ? exclusions.slice() : [],
    manjiFrame,
    provenance: {
      ...provenance,
      kind: provenance.kind ?? frame.kind,
      ref: provenance.ref ?? frame.ref,
    },
    roleResolver,
  };
}

/**
 * Materialize the cells of a RepeatField. Returns an array; each entry is:
 *
 *   {
 *     index, total,
 *     ...frame-specific stamps (col/row, boardIndex/boundary, ...),
 *     ...position-specific stamps (point | u/v/w/h | angleDeg),
 *     motif, sequenceIndex, repeatIndex,
 *     excluded,
 *     provenance: { kind, ref, role?, index, total, sequenceIndex, repeatIndex },
 *     manjiFrame: <frame stamp or null>,
 *   }
 *
 * Excluded cells are filtered out by default. Pass `includeExcluded: true`
 * to keep them (with `excluded: true` set) — useful for debug overlays and
 * for letting another field place into the freed cells.
 */
export function walk(field, options = {}) {
  if (!field || !field.frame) throw new Error('walk: field must be a repeatField');
  const { includeExcluded = false } = options;
  const { frame, motif, exclusions, manjiFrame, provenance, roleResolver } = field;
  const context = { roleResolver, field };
  const out = [];
  for (const baseCell of frame.cells()) {
    const pos = frame.position(baseCell);
    const motifInfo = motif.pick(baseCell);
    const excluded = exclusions.some((spec) => spec?.test?.(baseCell, context) === true);
    if (excluded && !includeExcluded) continue;
    out.push({
      ...baseCell,
      ...pos,
      ...motifInfo,
      excluded,
      provenance: {
        ...provenance,
        index: baseCell.index,
        total: baseCell.total,
        sequenceIndex: motifInfo.sequenceIndex,
        repeatIndex: motifInfo.repeatIndex,
      },
      manjiFrame,
    });
  }
  return out;
}
