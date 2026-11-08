/**
 * THE GREYBOX — the `greybox` world kind: a level blocked out in boxes and nothing else, before any look. Each block is
 * a box shaded by value under one sun (the heartbeat's greybox light, level/heartbeat-scene.js), its tone saying what
 * it stands for, so the space reads by its masses: where the floor is, what walls it, what stands in it, an edge to
 * fall from.
 *
 *   { kind: 'greybox', blocks: [{ at: [x, y, z], size: [w, d, h], turn?, tone? }], title?, walk? }
 *     at    m, the centre of the block's footprint, on its base (z its bottom)
 *     size  m, its width (x), depth (y) and height (z) before it is turned
 *     turn  degrees about its own vertical (0 square to the axes)
 *     tone  floor | wall | prop | edge (floor by default)
 *
 * It is not a fight's: any level may be blocked out with it, and a fight is laid on one by its lane like on any other
 * level (versus/versus-levels.js). A block's bottom is not drawn (a level is seen from above its floors).
 *
 *   GREYBOX_TONES                  the tones' values
 *   readGreybox(manifest)          → { blocks } (throws naming the fault)
 *   greyboxBlockFaces(block)       → the block's faces
 *   assembleGreyboxScene(m, ctx)   → the World page's scene: faces, an overview camera, a walk
 *
 * Pure: no clock, no dice.
 */

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const no = (msg) => { throw new Error(`greybox: ${msg}`); };

/** the tones, by value: the floor the middle, a wall darker, a prop lighter, an edge (a lip, a kerb, a drop) lightest */
export const GREYBOX_TONES = Object.freeze({ floor: '#8d8a83', wall: '#6d6f74', prop: '#a39f96', edge: '#c2bdb2' });
const SUN = (() => { const v = [-0.35, -0.55, 0.76], L = Math.hypot(...v); return v.map((x) => x / L); })();
const shade = (hex, n) => { const s = 0.5 + 0.5 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]); return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * s).toString(16).padStart(2, '0')).join('')}`; };
const KEYS = ['kind', 'blocks', 'title', 'walk', 'versus'];
const BLOCK_KEYS = ['at', 'size', 'turn', 'tone'];
/** the most blocks a greybox takes: a blockout, not a city */
export const GREYBOX_MAX_BLOCKS = 400;

/** Read a greybox's words; → { blocks } with every block settled (throws naming the fault). */
export function readGreybox(manifest = {}) {
  for (const k of Object.keys(manifest)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of the greybox kind (blocks, title, walk)`);
  const blocks = manifest.blocks;
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > GREYBOX_MAX_BLOCKS) no(`blocks is a list of 1 to ${GREYBOX_MAX_BLOCKS} boxes { at: [x, y, z], size: [w, d, h], turn?, tone? }`);
  return {
    blocks: blocks.map((b, i) => {
      const at = `blocks[${i}]`;
      if (!b || typeof b !== 'object' || Array.isArray(b)) no(`${at} is { at: [x, y, z], size: [w, d, h], turn?, tone? }`);
      for (const k of Object.keys(b)) if (!BLOCK_KEYS.includes(k)) no(`${at}.${k} is not a block's word (${BLOCK_KEYS.join(', ')})`);
      if (!Array.isArray(b.at) || b.at.length !== 3 || !b.at.every(isNum)) no(`${at}.at is [x, y, z], the centre of its footprint on its base (m)`);
      if (!Array.isArray(b.size) || b.size.length !== 3 || !b.size.every((v) => isNum(v) && v > 0 && v <= 400)) no(`${at}.size is [w, d, h], each over 0 and at most 400 m`);
      if (b.turn !== undefined && !isNum(b.turn)) no(`${at}.turn is degrees about its own vertical`);
      if (b.tone !== undefined && !GREYBOX_TONES[b.tone]) no(`${at}.tone is one of ${Object.keys(GREYBOX_TONES).join(', ')}`);
      return { at: b.at.map(r3), size: b.size.map(r3), turn: r3(b.turn ?? 0), tone: b.tone ?? 'floor' };
    }),
  };
}

/** A block's faces: its top and four sides (each corner counter-clockwise seen from outside), shaded by its tone. */
export function greyboxBlockFaces(block, k = 0) {
  const [cx, cy, z0] = block.at, [w, d, h] = block.size, hw = w / 2, hd = d / 2, z1 = z0 + h;
  const t = (block.turn * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const P = (x, y, z) => [r3(cx + x * c - y * s), r3(cy + x * s + y * c), r3(z)];
  const N = (x, y, z) => [r3(x * c - y * s), r3(x * s + y * c), r3(z)];
  const hex = GREYBOX_TONES[block.tone], group = `greybox:${block.tone}`;
  const quads = [
    [N(0, 0, 1), [P(-hw, -hd, z1), P(hw, -hd, z1), P(hw, hd, z1), P(-hw, hd, z1)]],
    [N(1, 0, 0), [P(hw, -hd, z0), P(hw, hd, z0), P(hw, hd, z1), P(hw, -hd, z1)]],
    [N(-1, 0, 0), [P(-hw, hd, z0), P(-hw, -hd, z0), P(-hw, -hd, z1), P(-hw, hd, z1)]],
    [N(0, 1, 0), [P(hw, hd, z0), P(-hw, hd, z0), P(-hw, hd, z1), P(hw, hd, z1)]],
    [N(0, -1, 0), [P(-hw, -hd, z0), P(hw, -hd, z0), P(hw, -hd, z1), P(-hw, -hd, z1)]],
  ];
  return quads.map(([normal, corners]) => ({ corners, normal, fill: shade(hex, normal), group, id: `block-${k}` }));
}

/** The `greybox` world kind: its blocks' faces, a camera over the whole from the south-west, a walk on the floor. */
export function assembleGreyboxScene(manifest, ctx = {}) {
  const { blocks } = readGreybox(manifest);
  const faces = blocks.flatMap((b, k) => greyboxBlockFaces(b, k));
  // (the extent of every corner: where the camera looks and where a walk starts)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity, zf = Infinity;
  for (const f of faces) for (const [x, y, z] of f.corners) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
  for (const b of blocks) if (b.tone === 'floor') zf = Math.min(zf, b.at[2] + b.size[2]);
  if (!Number.isFinite(zf)) zf = 0;
  const mid = [(x0 + x1) / 2, (y0 + y1) / 2], span = Math.max(x1 - x0, y1 - y0, 4);
  const spawn = [r3(mid[0]), r3(y0 + 1), r3(zf + 1.7)];
  return {
    title: ctx.title || manifest.title || 'mojulo greybox',
    faces,
    cameras: [{ name: 'over', worldFraming: { cameraPosition: [r3(mid[0] - span * 0.45), r3(y0 - span * 0.75), r3(z1 + span * 0.55)], lookAt: [r3(mid[0]), r3(mid[1]), r3(zf)], horizontalFov: 60 } }],
    viewBox: { width: 1280, height: 720 }, bg: '#16171b',
    walk: manifest.walk === false ? false : { speed: 6, spawn, minEye: 1.7, gravity: 22, radius: 0.4 },
    greybox: { blocks: blocks.length, extent: [[r3(x0), r3(y0)], [r3(x1), r3(y1)]], floor: r3(zf) },
  };
}
