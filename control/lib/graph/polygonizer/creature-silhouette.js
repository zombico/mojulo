/**
 * THE BASE SILHOUETTE and its VALUE SPLIT: stage 1 of the dressing flow, for any creature's body, with or without a
 * reference. Both read the same fields; a reference only fills them differently (the agent reads them off an image).
 *
 *   baseSilhouette(mesh, plan)   the BASE SILHOUETTE RECORD, read off the body (data, never geometry):
 *     masses     each part family's share of the outline, front and side: what the outline is made of, in order
 *                (the share a family alone draws: the outline with it less the outline without it)
 *     mustSee    the families the outline depends on beyond the trunk (a muzzle, a tail, ears): what no outfit may hide
 *     landmarks  where the eye goes, as heights over the figure's height: the shoulder line, the hips, the head, the
 *                hands, the feet, the tail's tip (from the plan's joints, by the names a creature plan uses)
 *     outline    its character from the front outline's widths: 'barrel' (widest in the middle), 'bell' (widest low),
 *                'column' (even), 'needle' (narrow for its height), 'wedge' (widest high: the shoulders)
 *   monochrome(palette, groups)  true when the body's groups sit within MONO_DL of each other in lightness
 *   bodyMonochrome(mesh, plan)   true when most of the body's own surface is one tone (MONO_SHARE of its area)
 *   secondTone(hex)              the derived second tone: SPLIT_DL darker for a light body, lighter for a dark one,
 *                                its hue turned a little (cooler going dark, warmer going light), so it reads as a
 *                                marking, not a shadow or dirt
 *   markingTint(mesh, plan, markings)   per face, its three corners' colour multipliers (the face-tint shape, so the
 *                                World page and the rig pack carry it as they carry the face's tint), or null:
 *       { pattern: 'countershade' | 'points' | 'both', colour?, light?: '#…' }
 *       countershade: the VENTRAL side (the front and underside of the trunk and neck, the inside of the limbs, under the
 *                     jaw) and the DORSAL side (the back, the top of the head, the outside of the limbs) take the two
 *                     tones, the lighter ventral;
 *                     `ventral: 'panel'` keeps it to a strip down the trunk's front (the throat and the belly) and under
 *                     the jaw, the limbs in the coat (a roll's beast: a dark body lightened all down its front reads as cloth);
 *       points:       the ends of each limb chain (its last part), the tail's last links and the ears take the darker
 *                     tone of a light body, the lighter of a dark one;
 *       per FACE, by its rest centroid and normal, so a border runs along the mesh's own edges: crisp, and ragged by
 *       a seeded jag on each face's threshold (JAG), the toon marking's flame edge, not a gradient.
 *     Only the body's own cover is marked (the groups of its layer-1 parts, and fur: `Fur`, `FurAlt`), and only in its
 *     MAIN tone (within MONO_DL of the area-weighted median): claws, eyes, teeth, the nose, dark paws and everything
 *     worn keep their colours.
 *   drawnMarkings(plan, mesh, palette?)   the markings a DRAWN creature (`style.drawn`) wears: its own (`style.drawn.markings`,
 *                                a reference's or a roll's), else countershading and points when its body is one colour
 *                                (`monochrome`), else none
 *   drawnCrease(plan)            the crease a drawn creature is smoothed at: its body's and its fur's groups welded at
 *                                70° (one form, like the hero's skin), everything else at 35° (a claw, a strap keep edges)
 * Pure and deterministic.
 */
import { figureMask, heightFrame } from './silhouette-gates.js';
import { hexLch, lchHex } from './station-loft-shade.js';
import { faceHex } from './face-hex.js';

export const MONO_DL = 12, SPLIT_DL = 24, JAG = 0.18;
const r3 = (v) => Math.round(v * 1000) / 1000;
const unit = (v) => { const l = Math.hypot(...v); return l > 1e-12 ? v.map((x) => x / l) : v; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** a part's FAMILY: its name less its side and its index (thighR → thigh, tail3 → tail, lock.ruff.torso.R.1.0 → lock.ruff) */
export const familyOf = (part) => (part.startsWith('lock.') || part.startsWith('tile.') || part.startsWith('adorn.') ? part.split('.').slice(0, 2).join('.') : part.replace(/[.\d]+[RL]?$|[RL]$/g, '').replace(/\d+$/, ''));
const TRUNK = /^(torso|pelvis|neck|chest|belly|body)$/;

const sumMask = (m) => { let s = 0; for (let k = 0; k < m.length; k++) s += m[k]; return s; };
const subMesh = (mesh, keep) => ({ vertices: mesh.vertices, faces: mesh.faces.filter((_, fi) => keep(fi)) });

export function baseSilhouette(mesh, plan = {}) {
  const partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
  const fams = [...new Set(mesh.faces.map((_, fi) => familyOf(partOf(fi))))];
  const views = { front: 180, side: 90 }, masses = {};
  for (const [view, az] of Object.entries(views)) {
    const frame = heightFrame(mesh, az), all = figureMask(mesh, az, { frame }), total = sumMask(all);
    for (const f of fams) { const without = figureMask(subMesh(mesh, (fi) => familyOf(partOf(fi)) !== f), az, { frame }); (masses[f] ??= {})[view] = r3((total - sumMask(without)) / total); }
  }
  const order = Object.entries(masses).map(([f, v]) => ({ family: f, front: v.front, side: v.side, share: r3((v.front + v.side) / 2) })).filter((m) => m.share > 0).sort((a, b) => b.share - a.share);
  // the must-see: what the outline depends on beyond the trunk and the paired limbs (every biped has those): a tail, a
  // head's muzzle, ears, horns, wings
  const limbs = new Set((plan.segments || []).filter((g) => g.mirror === 'name').map((g) => familyOf(g.name)));
  const mustSee = order.filter((m) => !TRUNK.test(m.family) && !limbs.has(m.family) && !m.family.startsWith('adorn.') && m.share >= 0.02).slice(0, 4).map((m) => m.family);
  // landmarks: the plan's joints by the names creature plans use, as heights over the figure's height
  const H = heightFrame(mesh, 180).height, J = plan.joints || {}, z0 = Math.min(...mesh.vertices.map((p) => p[2]));
  const at = (re) => { const k = Object.keys(J).find((n) => re.test(n)); return k ? r3((J[k][2] - z0) / H) : null; };
  const landmarks = Object.fromEntries(Object.entries({ shoulders: /^shoulder/, hips: /^hip/, head: /^(neckTop|headBase|neck)$/, hands: /^(wrist|knuckles|hand)/, feet: /^(toeBase|toe|ankle|foot)/, tailTip: /^tail\d+$/ })
    .map(([k, re]) => [k, k === 'tailTip' ? (() => { const t = Object.keys(J).filter((n) => re.test(n)).sort(); return t.length ? r3((J[t[t.length - 1]][2] - z0) / H) : null; })() : at(re)]).filter(([, v]) => v !== null));
  // the outline's character: the front outline's widest row in each third, against its height
  const fm = figureMask(mesh, 180), res = Math.round(Math.sqrt(fm.length)), rows = Array.from({ length: res }, (_, j) => { let n = 0; for (let i = 0; i < res; i++) n += fm[j * res + i]; return n; });
  const span = Math.round(res / 1.1), third = (k) => Math.max(...rows.slice(Math.floor(k * span / 3), Math.floor((k + 1) * span / 3)));
  const [low, mid, high] = [third(0), third(1), third(2)], widest = Math.max(low, mid, high);
  const outline = widest / span < 0.28 ? 'needle' : Math.max(low, mid, high) - Math.min(low, mid, high) < 0.15 * widest ? 'column' : widest === mid ? 'barrel' : widest === low ? 'bell' : 'wedge';
  return { masses: order, mustSee, landmarks, outline, widths: { low: r3(low / span), mid: r3(mid / span), high: r3(high / span) } };
}

export function monochrome(palette, groups) {
  const L = groups.map((g) => palette?.[g]).filter((h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h)).map((h) => hexLch(h)[0]);
  return L.length > 0 && Math.max(...L) - Math.min(...L) < MONO_DL;
}

/** a hue turned up to `by` degrees toward `to` (the short way round) */
const toward = (h, to, by) => { const d = ((to - h + 540) % 360) - 180; return (h + Math.sign(d) * Math.min(Math.abs(d), by) + 360) % 360; };
/** true when most of the body's own surface (MONO_SHARE of its layer-1 area, by the colours it is drawn in: a group's
 * palette entry, else the part's tint) lies within MONO_DL in lightness of its dominant tone: a white wolf with dark paws
 * is one colour; a body half one tone and half another is not */
export const MONO_SHARE = 0.8;
/** the body's dominant lightness (the area-weighted median over its layer-1 surface), and each tone's area */
function bodyTones(mesh, plan) {
  const V = mesh.vertices, partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part, L = [];
  // the body's own surface: not a garment over it, nor a second skin painted on it
  mesh.faces.forEach((t, fi) => { const P = mesh.parts[partOf(fi)]; if (!P || (P.layer ?? 1) !== 1 || P.garment || (Array.isArray(P.painted) && P.painted.includes(mesh.groups[fi]))) return; const hex = plan.palette?.[mesh.groups[fi]] || P.tint; if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return;
    const [a, b, c] = t.map((vi) => V[vi]), area = Math.hypot(...cross(sub(b, a), sub(c, a))) / 2; L.push([hexLch(hex)[0], area]); });
  if (!L.length) return null;
  const total = L.reduce((t, [, a]) => t + a, 0); L.sort((x, y) => x[0] - y[0]);
  let acc = 0, mid = L[0][0]; for (const [l, a] of L) { acc += a; if (acc >= total / 2) { mid = l; break; } }
  return { mid, share: L.reduce((t, [l, a]) => t + (Math.abs(l - mid) <= MONO_DL / 2 ? a : 0), 0) / total };
}
export function bodyMonochrome(mesh, plan) { const T = bodyTones(mesh, plan); return !!T && T.share >= MONO_SHARE; }

export function secondTone(hex) {
  const [L, C, h] = hexLch(hex);
  // a near-neutral body (white, grey, black fur) takes a cool grey-blue going dark, a warm grey going light; a coloured
  // one keeps its chroma, its hue turned a little
  if (C < 12) return L >= 55 ? lchHex(L - SPLIT_DL, 10, 250) : lchHex(L + SPLIT_DL, 8, 70);
  return L >= 55 ? lchHex(L - SPLIT_DL, C * 0.95, toward(h, 250, 15)) : lchHex(L + SPLIT_DL, C * 0.9, toward(h, 70, 15));
}

/** each part's chain: its depth from the trunk along its bind's `prev`, and its chain's length */
function chains(plan) {
  const segs = plan.segments || [], byBone = new Map();
  for (const g of segs) { const b = typeof g.bind === 'object' ? g.bind?.bone ?? g.name : g.name; if (!byBone.has(b) || g.name === b) byBone.set(b, g); }
  const depth = new Map(), last = new Set();
  for (const g of segs) { let d = 0, x = g; while (x && typeof x.bind === 'object' && x.bind?.prev && byBone.has(x.bind.prev) && d < 12) { x = byBone.get(x.bind.prev); d++; } depth.set(g.name, d); }
  for (const g of segs) if (['segment', 'loft'].includes(g.kind) && !(typeof g.bind === 'object' && g.bind?.next && byBone.has(g.bind.next))) last.add(g.name.replace(/[RL]$/, ''));
  return { depth, last };
}

export function markingTint(mesh, plan, markings) {
  if (!markings || markings.pattern === 'none') return null;
  const pattern = markings.pattern ?? 'both', palette = plan.palette ?? {}, V = mesh.vertices, F = mesh.faces;
  const partOf = (fi) => mesh.provenance[F[fi][0]].part;
  // the BODY's own faces: not a garment worn over it, nor what a second skin painted on it (cloth takes no markings)
  const body = new Set(Object.entries(mesh.parts).filter(([, p]) => (p.layer ?? 1) === 1 && !p.garment).map(([n]) => n));
  const painted = (fi) => { const p = mesh.parts[partOf(fi)]; return Array.isArray(p?.painted) && p.painted.includes(mesh.groups[fi]); };
  const cover = new Set([...F.keys()].filter((fi) => body.has(partOf(fi)) && !painted(fi)).map((fi) => mesh.groups[fi]));
  for (const g of ['Fur', 'FurAlt']) cover.add(g);
  const baseOf = (fi) => faceHex(palette, mesh.groups[fi], mesh.parts[partOf(fi)]);
  // only the body's MAIN tone takes a marking: what already stands apart from it (dark paws, a pale belly the plan
  // painted) keeps its colour
  const tones = bodyTones(mesh, plan), mainTone = (hex) => !tones || Math.abs(hexLch(hex)[0] - tones.mid) <= MONO_DL;
  const { last } = chains(plan), tails = Object.keys(mesh.parts).filter((n) => /^tail\d+$/.test(n)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  // `ventral: 'panel'`: the countershade a pale throat and belly only (the half-width each trunk part's own)
  const panel = markings.ventral === 'panel', widths = new Map();
  const halfW = (part) => { if (!widths.has(part)) { let w = 0; F.forEach((t, fi) => { if (partOf(fi) === part) for (const vi of t) w = Math.max(w, Math.abs(V[vi][0])); }); widths.set(part, w); } return widths.get(part); };
  const pointy = (part) => { const base = familyOf(part).replace(/^lock\.|^tile\./, ''); return last.has(part.replace(/[RL]$/, '')) || /^(ear|earInner)$/.test(base) || tails.slice(-2).includes(part); };
  return F.map((t, fi) => {
    const part = partOf(fi), g = mesh.groups[fi];
    if (!cover.has(g) || part.startsWith('adorn.') || mesh.parts[part]?.garment || painted(fi)) return null;
    const P = t.map((vi) => V[vi]), c = [0, 1, 2].map((k) => (P[0][k] + P[1][k] + P[2][k]) / 3), n = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    const base = baseOf(fi); if (!mainTone(base)) return null;
    const light = hexLch(base)[0] >= 55;
    // a panel is always the paler throat and belly; the points take the second tone
    const paler = () => { const [L, C, h] = hexLch(base); return lchHex(Math.min(92, L + (light ? 12 : SPLIT_DL)), C * 0.8, h); };
    let two = markings.colour ?? secondTone(base);
    const jag = JAG * (hash(`${part}/${fi}`) - 0.5);
    let marked = false;
    if (pattern === 'points' || pattern === 'both') marked = pointy(part);
    if (!marked && (pattern === 'countershade' || pattern === 'both')) {
      const fam = familyOf(part), side = c[0] >= 0 ? 1 : -1;
      if (panel) {
        // a PANEL: only the throat and the belly, a strip down the trunk's front, and under the jaw; the limbs keep the coat
        const head = /^(cranium|jaw)$/.test(part);
        if (head) marked = dot(n, unit([0, 0.35, -1])) + jag > 0.35;
        else if (TRUNK.test(fam)) marked = dot(n, unit([0, 1, -0.25])) + jag > 0.3 && Math.abs(c[0]) < (0.36 + jag) * halfW(part);
      } else {
        const ventral = /^(cranium|jaw)$/.test(part) ? [0, 0.35, -1] : /[RL]$/.test(part) && !TRUNK.test(fam) ? [-side, 0.4, -0.2] : [0, 0.85, -0.5];
        const v = dot(n, unit(ventral)) + jag;
        marked = light ? v < -0.1 : v > 0.1;   // a light body darkens its dorsal side, a dark one lightens its ventral
      }
    }
    if (!marked) return null;
    if (panel && !markings.colour && !pointy(part)) two = paler();
    const [a, b] = [hexRgb(base), hexRgb(two)], m = [0, 1, 2].map((k) => +(a[k] > 0.02 ? Math.min(4, b[k] / a[k]) : 1).toFixed(4));
    return [m, m, m];
  });
}

export function drawnMarkings(plan, mesh, palette = null) {
  const d = plan?.style?.drawn; if (!d) return null;
  // the colours as the figure is drawn: the expanded recipe's palette (the plan's, and its worn heads') when given
  if (palette) plan = { ...plan, palette: { ...(plan.palette || {}), ...palette } };
  const own = typeof d === 'object' ? d.markings : undefined;
  if (own !== undefined) return own === false ? null : markingTint(mesh, plan, own);
  return bodyMonochrome(mesh, plan) ? markingTint(mesh, plan, { pattern: 'both' }) : null;
}
export function drawnCrease(plan) {
  const groups = [...new Set([...(plan.segments || []).map((g) => g.group).filter(Boolean), 'Fur', 'FurAlt'])];
  return Object.freeze({ ...Object.fromEntries(groups.map((g) => [g, 70])), default: 35 });
}
