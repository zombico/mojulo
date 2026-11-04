/**
 * rupa/panels.js — METAL PANELS ON OBJECTS (`destruction: 'physical'`): the thin plates a moving thing is skinned in (a
 * car's doors and bonnet, a mech's armour, a locker's door, a drum), each a plate of a metal in its entity's own frame,
 * dented, dished, holed and torn off by the same law the blocks keep (controllable/rupa.js DISTORTION, `state.rupa.panels`)
 * and drawn on the page as the dented sheet it is, riding its entity. rupa is the internal name.
 *
 *   A PANEL     { id?, face: front | back | left | right | top | bottom, at: [x, y, z], size: [w, h], wall?, matter?, color? }
 *               in the entity's frame (x along its heading, y to its left, z up, from its transform's point): `at` the
 *               middle of the plate's outer face, `size` its width and height across the face (front, back: along y
 *               then z; left, right: x then z; top, bottom: x then y), `wall` its thickness (m; a car's body panel about
 *               a millimetre), `matter` a metal (one that yields: steel, sheet-metal, armour-steel, aluminium, brass, …;
 *               steel when unsaid), `color` its paint
 *   panels: true    on a box body ({ type: 'mesh', shape: 'box', size }): a plate on each face but the bottom, the
 *               body's colour, a millimetre of steel (`{ auto: true, wall?, matter?, color? }` to say otherwise)
 *
 *   FACES                       face → [axis, side]
 *   readPanels(entity, where)   → [resolved panel] (each its local box `min`/`max` and its matter's numbers), or null
 *                               when it carries none; a panel that cannot be is refused, naming why
 */
import { blockMatter, resolveMatter, isPlastic, PLASTIC_IDS } from './matter.js';

export const FACES = Object.freeze({ front: [0, 1], back: [0, -1], left: [1, 1], right: [1, -1], top: [2, 1], bottom: [2, -1] });
const WALL = 0.001;   // m: a car's body panel
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const vec = (v, n) => Array.isArray(v) && v.length === n && v.every(num);
// the numbers the runtime reads off a plate (rupa.js createWorld for a block, the same keys)
const KEYS = ['matter', 'mass', 'joules', 'stiff', 'bounce', 'soften', 'melt', 'yield', 'kerfWork', 'kerfHard', 'tensile'];

// a box body's plates: each face but the bottom, the whole face
function autoPanels(e, spec, where) {
  const b = e.body || {};
  if (b.type !== 'mesh' || b.shape !== 'box') throw new Error(`${where}: panels: true plates a box body ({ type: 'mesh', shape: 'box', size }); any other body names its panels`);
  const s = vec(b.size, 3) ? b.size : [1, 1, 1], h = s.map((x) => x / 2), o = spec && typeof spec === 'object' ? spec : {};
  const base = { ...(o.wall !== undefined ? { wall: o.wall } : {}), ...(o.matter !== undefined ? { matter: o.matter } : {}), color: o.color ?? b.color ?? null };
  return [
    { id: 'front', face: 'front', at: [h[0], 0, 0], size: [s[1], s[2]] }, { id: 'back', face: 'back', at: [-h[0], 0, 0], size: [s[1], s[2]] },
    { id: 'left', face: 'left', at: [0, h[1], 0], size: [s[0], s[2]] }, { id: 'right', face: 'right', at: [0, -h[1], 0], size: [s[0], s[2]] },
    { id: 'top', face: 'top', at: [0, 0, h[2]], size: [s[0], s[1]] },
  ].map((p) => ({ ...p, ...base }));
}

/** An entity's panels resolved for the runtime and the page, or null when it carries none. */
export function readPanels(e, where = `${(e && e.id) || 'entity'}.panels`) {
  const v = e && e.panels;
  if (v === undefined || v === null || v === false) return null;
  const list = v === true || (v && typeof v === 'object' && !Array.isArray(v) && v.auto === true) ? autoPanels(e, v, where) : v;
  if (!Array.isArray(list)) throw new Error(`${where} is a list of panels ({ face, at, size, wall?, matter?, color? }) or true (a box body's faces)`);
  const seen = new Set();
  return list.map((p, i) => {
    const at = `${where}[${i}]`;
    if (!p || typeof p !== 'object') throw new Error(`${at} is a panel: { face, at, size, wall?, matter?, color? }`);
    const id = p.id === undefined ? `p${i}` : String(p.id);
    if (seen.has(id)) throw new Error(`${at}.id '${id}' is another panel's`);
    seen.add(id);
    const F = FACES[p.face];
    if (!F) throw new Error(`${at}.face is ${Object.keys(FACES).join(', ')}`);
    if (!vec(p.at, 3)) throw new Error(`${at}.at is [x, y, z] in the entity's frame: the middle of the plate's outer face`);
    if (!vec(p.size, 2) || !(p.size[0] > 0 && p.size[1] > 0)) throw new Error(`${at}.size is [width, height] across its face, each above 0`);
    const wall = p.wall ?? WALL;
    if (!(num(wall) && wall > 0 && wall <= 0.2)) throw new Error(`${at}.wall is the plate's thickness in metres, above 0 and at most 0.2`);
    const m = resolveMatter(p.matter ?? 'steel', `${at}.matter`);
    if (!isPlastic(m)) throw new Error(`${at}.matter: ${m.id} does not yield, and a panel is metal that dents (${PLASTIC_IDS.join(', ')})`);
    // its plate in the entity's frame: the outer face at `at`, the wall inward from it
    const [ax, side] = F, min = [0, 0, 0], max = [0, 0, 0];
    // (across the face: front/back y then z, left/right x then z, top/bottom x then y)
    const [a1, a2] = ax === 0 ? [1, 2] : ax === 1 ? [0, 2] : [0, 1];
    for (const [k, s] of [[a1, p.size[0]], [a2, p.size[1]]]) { min[k] = p.at[k] - s / 2; max[k] = p.at[k] + s / 2; }
    if (side > 0) { min[ax] = p.at[ax] - wall; max[ax] = p.at[ax]; } else { min[ax] = p.at[ax]; max[ax] = p.at[ax] + wall; }
    for (let k = 0; k < 3; k++) { min[k] = r6(min[k]); max[k] = r6(max[k]); }
    const n = blockMatter({ min, max }, { matter: m.id, fill: 1 }, `${at}.matter`), out = { id, face: p.face, min, max, wall };
    for (const k of KEYS) if (n[k] !== undefined) out[k] = n[k];
    if (p.color !== undefined && p.color !== null) out.color = p.color;
    return out;
  });
}
