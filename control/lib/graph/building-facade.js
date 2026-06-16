/**
 * building-facade — randomized building facades, grounded in mojulo's facade-wrap-net
 * vocabulary: a horizontal RHYTHM (window / curtainwall / punched / balcony) over a
 * floor×bay grid, with vertical ZONES (podium → tower → crown). Here each of those
 * becomes a layered CSS background so a box face reads as a varied building skin.
 *
 * makeFacade(seed) → a deterministic descriptor; facadeCss(descriptor, ...) → the CSS.
 * Dependency-free (string building + vexar scaleHex for derived tints).
 */

import { scaleHex } from './polygonizer/vexar.js';

// glass family → [glass, mullion/spandrel]
const FAMILIES = [
  ['#8fb0cf', '#54657a'], ['#7fa3b8', '#4c5d69'], ['#92b6a6', '#516760'],
  ['#b7c0ca', '#646b74'], ['#bda28c', '#6c5b49'], ['#8a93a8', '#4a5061'],
  ['#a8b0bd', '#5b6270'], ['#9ab59f', '#566a59'],
];
const RHYTHMS = ['curtain', 'punched', 'banded', 'balcony', 'grid', 'pier'];
const CROWNS = ['none', 'parapet', 'screen'];
// brick/masonry families → [brick, mortar/trim]
const BRICK_FAMILIES = [
  ['#9c5a44', '#d8c6b0'], ['#a8654a', '#e0d2bd'], ['#8a4e3a', '#cdb9a2'],
  ['#b07a55', '#e6dac6'], ['#7a4636', '#c2ad96'], ['#a35640', '#d6c2aa'],
  ['#6f4a40', '#bdab98'], ['#bd8a5f', '#ece1cf'],
];

function mul32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/** Deterministic facade descriptor from a seed (number) or an rng (function). */
export function makeFacade(seedOrRng, opts = {}) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : mul32((seedOrRng >>> 0) || 1);
  const height = Number.isFinite(opts.height) ? opts.height : 3.5;
  // brick is a LOW/mid-rise material — tall towers stay glass/steel, never brick
  const brickChance = height < 3.2 ? 0.55 : height < 4.6 ? 0.28 : 0;
  const material = rng() < brickChance ? 'brick' : 'glass';
  const [glass, frame] = material === 'brick' ? pick(rng, BRICK_FAMILIES) : pick(rng, FAMILIES);
  // PROGRAM harmonizes a building's choices — so balconies (when present) repeat as
  // ONE coherent type/pattern building-wide, like a real condo, not random per cell.
  const program = pick(rng, ['office', 'office', 'residential', 'residential', 'hotel', 'industrial']);
  let rhythm, balcony = false, balconyType = null, balconyBays = 'all', rooftopKit = [];
  if (program === 'office') {
    rhythm = pick(rng, ['curtain', 'punched', 'banded', 'grid', 'pier', 'pier']);   // pier = strong vertical pilasters (civic/brutalist read)
    rooftopKit = rng() < 0.5 ? ['mechanical', 'antenna'] : ['mechanical', 'cell-tower'];
  } else if (program === 'residential') {
    rhythm = pick(rng, ['grid', 'punched']);
    // balconies and fire escapes are SEPARATE concepts split by material: glass/concrete
    // condos cantilever balconies; brick walk-ups carry fire escapes (set below). Never both.
    if (material !== 'brick') { balcony = true; balconyType = pick(rng, ['slab', 'vertical-rail', 'french']); balconyBays = pick(rng, ['all', 'alt', 'col']); }
    rooftopKit = rng() < 0.5 ? ['water-tank', 'satellite-dish'] : ['water-tank'];
  } else if (program === 'hotel') {
    rhythm = pick(rng, ['grid', 'banded']);
    if (material !== 'brick') { balcony = true; balconyType = 'slab'; balconyBays = 'all'; }   // glass hotel-balcony-stack
    rooftopKit = ['mechanical'];
  } else { // industrial
    rhythm = pick(rng, ['banded', 'grid', 'pier']);
    rooftopKit = rng() < 0.6 ? ['smoke-stack', 'smoke-stack', 'mechanical'] : ['smoke-stack', 'mechanical'];
  }
  const signP = program === 'hotel' ? 0.7 : program === 'office' ? 0.3 : 0.18;
  const storefrontP = material === 'brick' ? 0.42 : program === 'office' || program === 'hotel' ? 0.34 : 0.18;
  const billboardP = height > 3.4 ? (program === 'office' || program === 'hotel' ? 0.34 : 0.16) : 0.08;
  return {
    glass, frame, rhythm, program, material,
    floorH: 0.85 + rng() * 0.55,        // world units per floor → drives floor count
    bayW: 1.15 + rng() * 0.85,          // world units per bay   → drives bay count
    podium: program === 'office' ? rng() < 0.6 : rng() < 0.35,
    crown: pick(rng, CROWNS),
    mullion: (0.9 + rng() * 1.4),
    glassVar: 0.92 + rng() * 0.16,
    balcony, balconyType, balconyBays,
    fireEscape: material === 'brick' && !balcony && rng() < 0.7,  // fire escapes ride brick walk-ups (never alongside balconies)
    awning: program !== 'office' && rng() < 0.3,
    awningTint: pick(rng, ['#b5563f', '#3f6f8a', '#5a7a4a', '#9a7a3a', '#7a4a6a']),
    sign: rng() < signP ? pick(rng, ['#cf4f3a', '#2f6fb0', '#d9b441', '#c44a86', '#3aa06a', '#e8e4d7']) : null,
    storefront: rng() < storefrontP,
    storefrontTint: pick(rng, ['#243848', '#2d4654', '#314037', '#423348', '#473b2d']),
    storefrontTrim: pick(rng, ['#d6c59b', '#c9d3d7', '#b9c3a5', '#d6b28b']),
    rooftopKit: rng() < billboardP ? [...rooftopKit, 'billboard'] : rooftopKit,
  };
}

// glass families biased COOL/neutral — the modern-stacked townhome cladding read
// (charcoal panel, slate, warm-grey) rather than the bluer tower curtainwall.
const MODERN_FAMILIES = [
  ['#9aa3ac', '#565d66'], ['#8d96a0', '#4d535b'], ['#a6a094', '#5e594f'],
  ['#7f8a92', '#474d54'], ['#b0a99c', '#675f53'], ['#92a09c', '#515a57'],
];

/**
 * A facade descriptor tuned for ONE townhouse-row unit. Same shape makeFacade
 * returns (so facadeCss / facadeHtml / facadeFloors / facadeBays all work
 * unchanged), but the ornament flags are forced OFF — the row generator draws the
 * stoops, doors, cornices, and bays itself, so buildingExtras must NOT run.
 * `style` is 'brownstone' (warm masonry walk-up) or 'modern-stacked' (panel/glass);
 * `idx` rotates the palette so attached neighbours differ without breaking the row.
 */
export function makeRowhouseFacade(style, seedOrRng, idx = 0) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : mul32((seedOrRng >>> 0) || 1);
  const brownstone = style !== 'modern-stacked';
  const fam = brownstone ? BRICK_FAMILIES : MODERN_FAMILIES;
  const [glass, frame] = fam[idx % fam.length];                 // rotate by unit index → coherent variation
  const common = {
    glass, frame, glassVar: 0.94 + rng() * 0.12,
    podium: false, mullion: 0.9 + rng() * 0.8,
    // ornaments OFF — the row generator owns stoops/doors/cornices/bays
    balcony: false, balconyType: null, balconyBays: 'all',
    fireEscape: false, awning: false, awningTint: '#5a6068',
    sign: null, storefront: false, storefrontTint: '#243848', storefrontTrim: '#d6c59b',
    noEntrance: true, rooftopKit: [],
  };
  if (brownstone) {
    return { ...common, material: 'brick', program: 'residential',
      rhythm: 'punched', crown: 'parapet',
      floorH: 0.92 + rng() * 0.28, bayW: 1.0 + rng() * 0.5 };
  }
  return { ...common, material: 'glass', program: 'residential',
    rhythm: rng() < 0.5 ? 'grid' : 'banded', crown: 'none',
    floorH: 0.98 + rng() * 0.3, bayW: 1.05 + rng() * 0.5 };
}

// one balcony of a given TYPE on a cell's +y face (cellX = cell left, z = cell bottom)
function addBalcony(boxes, type, cellX, cw, z, fh, y1) {
  const bx = cellX + cw * 0.14, bw = cw * 0.72;
  if (type === 'french') {                                   // juliet: flush guard rail, no slab
    const dep = 0.12, zt = z + fh * 0.5;
    boxes.push({ x: bx, y: y1, w: bw, d: dep, z0: z + 0.04, z1: z + 0.07, tint: '#8d877b' });
    boxes.push({ x: bx, y: y1, w: bw, d: dep, z0: zt - 0.03, z1: zt, tint: '#8d877b' });
    for (let i = 0; i <= 4; i++) { const vx = bx + (bw - 0.04) * (i / 4); boxes.push({ x: vx, y: y1 + dep - 0.05, w: 0.04, d: 0.04, z0: z + 0.05, z1: zt, tint: '#777166' }); }
    return;
  }
  const depth = Math.min(0.5, cw * 0.42), zt = z + 0.42;
  boxes.push({ x: bx, y: y1, w: bw, d: depth, z0: z, z1: z + 0.12, tint: '#9a9488' });            // floor slab
  if (type === 'vertical-rail') {                            // balusters + top rail
    for (let i = 0; i <= 5; i++) { const vx = bx + (bw - 0.04) * (i / 5); boxes.push({ x: vx, y: y1 + depth - 0.05, w: 0.04, d: 0.05, z0: z + 0.1, z1: zt, tint: '#7d7669' }); }
    boxes.push({ x: bx, y: y1 + depth - 0.06, w: bw, d: 0.06, z0: zt - 0.04, z1: zt, tint: '#857e71' });
  } else {                                                   // slab: solid parapet rail
    boxes.push({ x: bx, y: y1 + depth - 0.05, w: bw, d: 0.05, z0: z + 0.1, z1: zt, tint: '#7d7669' });
  }
  // SIDE rails: a top-rail line down each side, running wall → outer edge (perpendicular to
  // the facade), spanning between the wall and the front rail — so the balcony reads as an
  // enclosed box, not a slab and front rail floating apart.
  for (const sx of [bx, bx + bw - 0.04]) boxes.push({ x: sx, y: y1, w: 0.04, d: depth, z0: zt - 0.04, z1: zt, tint: '#857e71' });
}

// rooftop equipment doodad of a given kind, placed by index to spread them out
function addRoofItem(out, item, idx, x, y, w, d, z1) {
  const spot = [[0.22, 0.28], [0.66, 0.62], [0.42, 0.7], [0.74, 0.24]][idx % 4];
  const px = x + w * spot[0], py = y + d * spot[1];
  if (item === 'water-tank') out.boxes.push({ x: px - w * 0.14, y: py - d * 0.16, w: w * 0.3, d: d * 0.34, z0: z1, z1: z1 + 0.6, tint: '#7a7d82' });
  else if (item === 'mechanical') out.boxes.push({ x: px, y: py, w: w * 0.26, d: d * 0.26, z0: z1, z1: z1 + 0.35, tint: '#6b6e73' });
  else if (item === 'antenna') out.boxes.push({ x: px, y: py, w: 0.1, d: 0.1, z0: z1, z1: z1 + 1.4, tint: '#9aa0a6' });
  else if (item === 'smoke-stack') {
    out.boxes.push({ x: px, y: py, w: 0.26, d: 0.26, z0: z1, z1: z1 + 0.85, tint: '#6a6560' });
    out.boxes.push({ x: px - 0.04, y: py - 0.04, w: 0.34, d: 0.34, z0: z1 + 0.74, z1: z1 + 0.85, tint: '#565250' });
  } else if (item === 'cell-tower') {
    const top = z1 + 1.15;                                                                          // much shorter mast
    out.boxes.push({ x: px, y: py, w: 0.2, d: 0.2, z0: z1, z1: top, tint: '#7c8088' });
    for (const [dx, dy] of [[-0.16, 0.04], [0.16, 0.04], [0.04, -0.16]])                            // small panel antennas (rectangles)
      out.boxes.push({ x: px + dx, y: py + dy, w: 0.11, d: 0.06, z0: top - 0.32, z1: top - 0.04, tint: '#b4bac0' });
    out.boxes.push({ x: px + 0.07, y: py + 0.07, w: 0.05, d: 0.05, z0: top, z1: top + 0.28, tint: '#aab0b6' }); // whip
  } else if (item === 'satellite-dish') {
    const base = z1 + 0.34;
    out.boxes.push({ x: px, y: py, w: 0.3, d: 0.3, z0: z1, z1: base, tint: '#8a8f96' });            // stand
    const C = [px + 0.15, py + 0.15, base + 0.26], s = 0.42, u = [s, 0, 0], v = [0, -s * 0.6, s * 0.5];
    const cc = (su, sv) => [C[0] + u[0] * su + v[0] * sv, C[1] + u[1] * su + v[1] * sv, C[2] + u[2] * su + v[2] * sv];
    out.faces.push({ corners: [cc(-1, -1), cc(1, -1), cc(1, 1), cc(-1, 1)], fill: '#c4c9cf', doubleSided: true }); // tilted dish
  } else if (item === 'billboard') {
    const bw = Math.max(1.0, w * 0.46), bh = 0.82, depth = 0.12;
    const bx = Math.max(x + 0.15, Math.min(x + w - bw - 0.15, px - bw / 2));
    const by = y + d + 0.08;
    out.boxes.push({ x: bx + bw * 0.18, y: by, w: 0.08, d: 0.08, z0: z1, z1: z1 + 0.7, tint: '#555a60' });
    out.boxes.push({ x: bx + bw * 0.78, y: by, w: 0.08, d: 0.08, z0: z1, z1: z1 + 0.7, tint: '#555a60' });
    out.boxes.push({ x: bx, y: by, w: bw, d: depth, z0: z1 + 0.54, z1: z1 + 0.54 + bh, tint: '#2f3f59' });
    out.decals.push({ x0: bx + bw * 0.12, x1: bx + bw * 0.88, z0: z1 + 0.77, z1: z1 + 1.08, fill: '#f0d36a' });
  }
}

// a fire escape on the +y face: stacked landings + outer rails + a zigzag of ladder
// strips. Brick walk-ups only (skyscrapers don't have them).
function addFireEscape(out, x, y1, w, d, z0, z1, floors, bays) {
  const fh = (z1 - z0) / floors, cw = w / bays;
  const col = Math.min(bays - 1, Math.max(0, Math.round(bays / 2) - 1));
  const bx = x + col * cw + cw * 0.18, fw = Math.min(1.1, cw * 0.52), depth = 0.42, yo = y1 + depth;
  for (let fl = 1; fl < floors; fl++) {
    const z = z0 + fl * fh;
    out.boxes.push({ x: bx, y: y1, w: fw, d: depth, z0: z, z1: z + 0.05, tint: '#3c3f44' });        // landing
    out.boxes.push({ x: bx, y: yo - 0.04, w: fw, d: 0.04, z0: z, z1: z + 0.4, tint: '#2e3135' });    // outer rail
    if (fl > 1) {                                                                                    // zigzag ladder
      const side = fl % 2, lw = fw * 0.42, lx = bx + side * (fw - lw), lx2 = bx + (1 - side) * (fw - lw);
      out.faces.push({ corners: [[lx, yo, z + 0.02], [lx + lw, yo, z + 0.02], [lx2 + lw, yo, z - fh + 0.02], [lx2, yo, z - fh + 0.02]], fill: '#34373c', doubleSided: true });
    }
  }
}

/**
 * 3D facade ornaments for one building: HARMONIZED repeating balconies (one type +
 * pattern building-wide), awnings, printed signage decals, and a program-driven
 * rooftop equipment kit. Emitted on the +y (camera-facing) face.
 * @returns {{ boxes:Array, decals:Array, faces:Array }}
 */
export function buildingExtras(box, f, floors, bays) {
  const { x, y, w, d, z0, z1 } = box, y1 = y + d;
  const fh = (z1 - z0) / floors, cw = w / bays;
  const out = { boxes: [], decals: [], faces: [] };

  if (f.balcony && f.balconyType) {
    const step = floors * bays > 24 ? 2 : 1;                 // repeat every floor; thin out only if huge
    for (let fl = 1; fl < floors; fl += step) {
      for (let b = 0; b < bays; b++) {
        const on = f.balconyBays === 'all' ? true : f.balconyBays === 'alt' ? ((fl + b) % 2 === 0) : (b % 2 === 0);
        if (!on) continue;
        addBalcony(out.boxes, f.balconyType, x + b * cw, cw, z0 + fl * fh, fh, y1);
      }
    }
  }
  // masonry cornice (capstone band wrapping the parapet)
  if (f.material === 'brick') out.boxes.push({ x: x - 0.12, y: y - 0.12, w: w + 0.24, d: d + 0.24, z0: z1 - 0.26, z1: z1 - 0.04, tint: scaleHex(f.frame, 0.92) });
  if (f.fireEscape) addFireEscape(out, x, y1, w, d, z0, z1, floors, bays);
  if (f.awning) out.boxes.push({ x: x + w * 0.05, y: y1, w: w * 0.9, d: 0.55, z0: z0 + fh * 0.85, z1: z0 + fh * 0.92, tint: f.awningTint });
  if (f.sign) { const sz0 = z0 + (floors - 1.7) * fh, sz1 = z0 + (floors - 0.7) * fh; out.decals.push({ x0: x + w * 0.14, x1: x + w * 0.86, z0: sz0, z1: sz1, fill: f.sign }); }
  if (f.storefront && !f.noEntrance) {
    const base = z0 + 0.05, top = z0 + Math.min(fh * 0.82, 1.25);
    const signTop = top + Math.min(0.22, fh * 0.16);
    out.decals.push({ x0: x + w * 0.08, x1: x + w * 0.92, z0: top, z1: signTop, fill: f.storefrontTrim || '#d6c59b' });
    const paneCount = Math.max(3, Math.min(5, bays));
    const left = x + w * 0.1, span = w * 0.8, gap = Math.min(0.06, span * 0.025);
    const paneW = (span - gap * (paneCount - 1)) / paneCount;
    const door = Math.floor(paneCount / 2);
    for (let i = 0; i < paneCount; i++) {
      const x0 = left + i * (paneW + gap), x1 = x0 + paneW;
      out.decals.push({ x0, x1, z0: base, z1: top, fill: i === door ? '#18242e' : f.storefrontTint || '#243848' });
      out.decals.push({ x0: x0 + paneW * 0.47, x1: x0 + paneW * 0.53, z0: base, z1: top, fill: f.storefrontTrim || '#c9d3d7' });
    }
    out.boxes.push({ x: x + w * 0.07, y: y1, w: w * 0.86, d: 0.34, z0: top, z1: signTop + 0.06, tint: f.awningTint || '#5a6068' });
  }
  // ground-floor entrance (on the +y face)
  if (!f.noEntrance && !f.storefront) {
    const ez0 = z0 + 0.05, ez1 = z0 + Math.min(fh * 0.72, 1.4);
    if (f.material === 'brick') {                              // panelled door + stoop steps
      out.decals.push({ x0: x + w * 0.43, x1: x + w * 0.57, z0: ez0, z1: ez1, fill: '#39291f' });
      for (let s = 0; s < 3; s++) out.boxes.push({ x: x + w * 0.4, y: y1, w: w * 0.2, d: 0.34 - s * 0.1, z0: z0 + s * 0.07, z1: z0 + (s + 1) * 0.07, tint: '#8a857a' });
    } else {                                                   // sliding glass doors + thin canopy
      out.decals.push({ x0: x + w * 0.4, x1: x + w * 0.6, z0: ez0, z1: ez1, fill: '#a8cfe0' });
      out.decals.push({ x0: x + w * 0.498, x1: x + w * 0.502, z0: ez0, z1: ez1, fill: '#56606b' });   // door split
      out.boxes.push({ x: x + w * 0.36, y: y1, w: w * 0.28, d: 0.4, z0: ez1, z1: ez1 + 0.08, tint: '#5a6068' }); // canopy
    }
  }
  if ((z1 - z0) > 3.2) f.rooftopKit.forEach((item, i) => addRoofItem(out, item, i, x, y, w, d, z1));
  return out;
}

// counts from a face's world size + the descriptor's floor/bay scale
export const facadeFloors = (f, height) => Math.max(3, Math.round(height / f.floorH));
export const facadeBays = (f, width) => Math.max(2, Math.round(width / f.bayW));

/**
 * Build the CSS background for one shaded face.
 * @param {object} f       descriptor from makeFacade
 * @param {number} lit     Lambert factor for this face (shades glass + frame together)
 * @param {number} floors
 * @param {number} bays
 */
export function facadeCss(f, lit, floors, bays) {
  const glass = scaleHex(f.glass, lit * f.glassVar);
  const frame = scaleHex(f.frame, lit);
  const m = f.mullion.toFixed(1);
  const F = Math.max(2, floors), B = Math.max(1, bays);
  const fp = (frac) => `calc(100% / ${F} * ${frac})`;   // fraction of one floor
  const bp = (frac) => `calc(100% / ${B} * ${frac})`;   // fraction of one bay
  const L = [];

  if (f.material === 'brick') {                          // brick-course texture; windows are child divs
    return `repeating-linear-gradient(to top, ${frame} 0 1px, transparent 1px calc(100%/${Math.max(6, F * 5)})),`
      + `repeating-linear-gradient(to right, ${frame} 0 1px, transparent 1px calc(100%/${Math.max(4, B * 4)})),${glass}`;
  }
  if (f.rhythm === 'curtain') {
    L.push(`repeating-linear-gradient(to right, ${frame} 0 ${m}px, transparent ${m}px calc(100%/${B}))`);
    L.push(`repeating-linear-gradient(to top, ${frame} 0 ${m}px, transparent ${m}px calc(100%/${F}))`);
  } else if (f.rhythm === 'punched') {
    // thick spandrel band each floor + vertical piers → discrete masonry windows
    L.push(`repeating-linear-gradient(to top, ${frame} 0 ${fp(0.36)}, transparent ${fp(0.36)} calc(100%/${F}))`);
    L.push(`repeating-linear-gradient(to right, ${frame} 0 ${bp(0.30)}, transparent ${bp(0.30)} calc(100%/${B}))`);
  } else if (f.rhythm === 'banded') {
    // horizontal ribbon windows: strong spandrel bands, faint piers
    L.push(`repeating-linear-gradient(to top, ${frame} 0 ${fp(0.46)}, transparent ${fp(0.46)} calc(100%/${F}))`);
    L.push(`repeating-linear-gradient(to right, ${scaleHex(f.frame, lit * 0.8)} 0 ${m}px, transparent ${m}px calc(100%/${Math.max(2, Math.round(B / 2))}))`);
  } else if (f.rhythm === 'pier') {
    // dominant vertical PILASTERS: wide frame piers + tall recessed window slots, thin spandrel
    L.push(`repeating-linear-gradient(to right, ${frame} 0 ${bp(0.56)}, transparent ${bp(0.56)} calc(100%/${B}))`);
    L.push(`repeating-linear-gradient(to top, ${frame} 0 ${fp(0.18)}, transparent ${fp(0.18)} calc(100%/${F}))`);
    // a faint highlight up the pier edge so the verticals read as relief
    L.push(`repeating-linear-gradient(to right, ${scaleHex(f.frame, lit * 1.18)} 0 1px, transparent 1px calc(100%/${B}))`);
  } else if (f.rhythm === 'balcony') {
    L.push(`repeating-linear-gradient(to right, ${frame} 0 ${m}px, transparent ${m}px calc(100%/${B}))`);
    L.push(`repeating-linear-gradient(to top, ${frame} 0 ${m}px, transparent ${m}px calc(100%/${F}))`);
    // balcony shadow every 3rd floor
    L.push(`repeating-linear-gradient(to top, rgba(0,0,0,.24) 0 ${fp(0.18)}, transparent ${fp(0.18)} calc(100% / ${F} * 3))`);
  } else { // grid
    L.push(`repeating-linear-gradient(to right, ${frame} 0 ${m}px, transparent ${m}px calc(100%/${B}))`);
    L.push(`repeating-linear-gradient(to top, ${frame} 0 ${m}px, transparent ${m}px calc(100%/${F}))`);
  }

  // zones: podium at the GROUND end, crown at the ROOF end (the face's local y maps
  // z0→top of the div, z1→bottom — so ground is the "to bottom" end here).
  if (f.podium) L.push(`linear-gradient(to bottom, transparent 0 ${fp(F - 1.4)}, ${scaleHex(f.frame, lit * 0.72)} ${fp(F - 1.4)})`);
  if (f.crown === 'parapet') L.push(`linear-gradient(to top, transparent 0 ${fp(F - 0.5)}, ${scaleHex(f.frame, lit * 0.85)} ${fp(F - 0.5)})`);
  else if (f.crown === 'screen') L.push(`linear-gradient(to top, transparent 0 ${fp(F - 1.2)}, ${scaleHex(f.glass, lit * 0.6)} ${fp(F - 1.2)})`);

  L.push(f.rhythm === 'pier' ? scaleHex(f.glass, lit * f.glassVar * 0.74) : glass); // base (pier slots read as deep recessed shadow)
  return L.join(',');
}

/**
 * For brick/masonry buildings, the windows are real child elements on the face (so
 * they can have ARCHED tops). Returns the inner HTML for one face (empty for glass).
 */
export function facadeHtml(f, floors, bays) {
  if (f.material !== 'brick') return '';
  const F = Math.max(2, floors), B = Math.max(1, bays);
  const start = f.podium ? 1 : 0;
  let html = '';
  for (let fl = start; fl < F; fl++) {
    for (let b = 0; b < B; b++) {
      const left = ((b + 0.28) / B * 100).toFixed(1), top = ((fl + 0.2) / F * 100).toFixed(1);
      const ww = (0.44 / B * 100).toFixed(1), wh = (0.62 / F * 100).toFixed(1);
      html += `<i class="bw" style="left:${left}%;top:${top}%;width:${ww}%;height:${wh}%"></i>`;
    }
  }
  return html;
}
