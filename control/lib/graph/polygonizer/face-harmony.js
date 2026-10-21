/**
 * face-harmony — the relational head's face read for its HARMONY: how the features stand to one another, and how far
 * along the sex's axis the face sits. Two pieces, both pure:
 *
 *   dimorphRelations(d, female?)  the relations at `d` along the axis from the male canon (0) to the female pole (1), a
 *                   little past either end (−0.25 … 1.5): every ratio the female pole moves, moved by d. A Nordic
 *                   heroine is a female at ~0.6: some of the male's bone, the rest hers. Hand it to `relationalHead` as
 *                   `relations` (the tune solved for them).
 *   harmonyMeasures(head)  calipers on the skin for the shapes the canon's calipers (head-field-view.js headMeasures)
 *                   do not read, in mm at the canonical stature: the chin's width and its point, the nose's bridge,
 *                   the lower face's taper. A machine reading; it never refuses a face.
 *
 * Two axes stay apart: ANCESTRY (what a face is built from: egocube/ancestry.js, read by epidermis/dermal-looks.js) and
 * the axis here, the face's sex and the harmony of its features. Neither is a statement about the other.
 */
import { RELATIONS, RELATION_POLES } from './head-relational.js';
import { rayIn, MM } from './head-field-view.js';

/** the axis's reach either side of its poles */
export const DIMORPH_RANGE = Object.freeze([-0.25, 1.5]);

/** The relations `d` of the way from the male canon to the female pole (`female`, the pole's ratios by default). */
export function dimorphRelations(d, female = RELATION_POLES.female) {
  if (!Number.isFinite(d) || d < DIMORPH_RANGE[0] || d > DIMORPH_RANGE[1]) throw new Error(`dimorph: a number in ${DIMORPH_RANGE.join(' … ')} (0 the male canon, 1 the female pole)`);
  return Object.fromEntries(Object.entries(female).map(([k, f]) => [k, RELATIONS[k] + d * (f - RELATIONS[k])]));
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The face's front across x at a height: the skin's depth (y) where a ray from ahead meets it, x from the midline out.
 * Returns [{ x, y }] (STAND units), x ≥ 0 on the figure's right.
 */
function frontAcross(field, z, xMax, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const x = (xMax * i) / n, p = rayIn(field, { x, y: 0, z }, [0, 1, 0]); if (p) out.push({ x, y: p.y }); }
  return out;
}
/** where the front falls `drop` behind its midline (the half-width of a ridge or a mass), interpolated; null if never */
function halfWidthAt(row, drop) {
  const y0 = row[0]?.y;
  if (y0 == null) return null;
  for (let i = 1; i < row.length; i++) if (row[i].y < y0 - drop) {
    const a = row[i - 1], b = row[i], t = (a.y - (y0 - drop)) / (a.y - b.y);
    return a.x + t * (b.x - a.x);
  }
  return null;
}
/** the front's fall at `dx` out from the midline (how far behind the midline's front it stands) */
function fallAt(row, dx) {
  const y0 = row[0]?.y;
  for (let i = 1; i < row.length; i++) if (row[i].x >= dx) { const a = row[i - 1], b = row[i], t = (dx - a.x) / (b.x - a.x); return y0 - (a.y + t * (b.y - a.y)); }
  return null;
}
/** the skin's outermost x at a height, within a band of depths (a caliper's sweep) */
function widthAt(field, z, y0, y1, n = 9) {
  let best = null;
  for (let i = 0; i < n; i++) { const y = y0 + ((y1 - y0) * i) / (n - 1), p = rayIn(field, { x: 0, y, z }, [1, 0, 0]); if (p && (best == null || p.x > best)) best = p.x; }
  return best;
}

/**
 * HARMONY CALIPERS on a relational head (`relationalHead`'s { field, landmarks }), mm:
 *   chin width      the chin's front: twice the half-width where it falls 4 mm behind the pogonion
 *   chin fall 10    how far the chin's front falls behind the pogonion 10 mm out (more: a pointier chin)
 *   bridge width    the nose's bridge at the rhinion: twice the half-width where it falls 2 mm behind the ridge
 *   root width      the same at the nose's root, a third of the way from the nasion to the rhinion
 *   mouth width / zy   the face's width at the stomion over its width at the zygions (the lower face's taper)
 *   jaw / zy        the gonions' width over the zygions' (the canon's jaw index, for the taper's line)
 */
export function harmonyMeasures(head) {
  const { field, landmarks: L } = head, s = L.s;
  const mm = (v) => (v == null ? null : r1(v * MM));
  const pg = L.pg, rh = L.noseBridge, n = L.nasion;
  const chinRow = frontAcross(field, pg.z, 0.03 * s, 30);
  const bridgeRow = frontAcross(field, rh.z, 0.015 * s, 30);
  const rootRow = frontAcross(field, n.z + (rh.z - n.z) / 3, 0.015 * s, 30);
  const chin = halfWidthAt(chinRow, 4 / MM), bridge = halfWidthAt(bridgeRow, 2 / MM), root = halfWidthAt(rootRow, 2 / MM);
  const zy = widthAt(field, L.zygionR.z, L.tragionR.y + 0.012 * s, 0.06 * s);
  const mouth = widthAt(field, L.stomion.z, L.gonionR.y, L.stomion.y - 0.02 * s);
  const go = widthAt(field, L.gonionR.z, L.gonionR.y - 0.012 * s, L.gonionR.y + 0.012 * s);
  return {
    'chin width': chin == null ? null : mm(2 * chin), 'chin fall 10': mm(fallAt(chinRow, 10 / MM)),
    'bridge width': bridge == null ? null : mm(2 * bridge), 'root width': root == null ? null : mm(2 * root),
    'mouth width / zy': zy && mouth ? Math.round((mouth / zy) * 1000) / 1000 : null,
    'jaw / zy': zy && go ? Math.round((go / zy) * 1000) / 1000 : null,
  };
}
