/**
 * historic/miniatures — the town's people, for scale and flavour: static low-poly figures stood about a historic
 * city's streets and squares (citizens) and bent over its fields outside the wall (field hands). Not actors: no
 * motion, no paths, nothing to talk to. Each is the fractal city's pedestrian (../figures/pedestrian-asset.js) at its
 * `mini` level of detail: the figure creator's posed protoform baked once per (archetype, pose), dressed per instance
 * by a palette over its body regions and clothed by a fitted skirt cut to its garment's hem: a tunic or a kilt to the
 * knee, a toga, a stola or a robe to the ankle, sleeves where the period wore them.
 *
 * Opt-in (`people` on the city's options) and the World page's alone: an absent channel adds nothing, and the CSS
 * page (a DOM node a face) never draws them. Placed on the plan's claim grid after the layout is final, on their own
 * seeded stream, so no street, house or tree moves. A layout that does not return its grid has no people yet.
 * Plans in metres; faces out in scene units.
 */
import { pedestrianFaces, IDLE_POSES, STROLL_POSES } from '../figures/pedestrian-asset.js';
import { stream, pick } from './layout-kit.js';
import { SM } from '../../util/math-scope.js';

// ── dress: per culture, the skins and the garments its people wear ────────────────────────────────────────────────
// A garment covers the body to its `cut` (a tunic or kilt to the knee, a robe to the shin or the ankle: the figure's
// fitted skirt, ../figures/pedestrian-asset.js CUTS) in `skirt` (else the `shirt`); `sleeve` carries the shirt down
// the forearm; `legs` are trousers or leggings below (else bare shins); a `shoe` it leaves out is bare feet. Nobody is
// bare to the waist. Colours are undyed and earth-dyed wool and linen; the bright ones are few, as they were dear.
const garb = (shirt, cut, o = {}) => ({ shirt, cut, ...o });
const ROMAN = {
  skin: ['#c08a64', '#a8714f', '#d39c76', '#8f5d42'],
  // the belted tunic to the knee, in sandals; the toga's white wool to the ankle over it, the left arm under its fold
  man: [garb('#d8cdb4', 'knee', { shoe: '#5a3e26' }), garb('#a8703c', 'knee', { shoe: '#4a3220' }), garb('#8a5a3c', 'knee', { shoe: '#4a3220' }),
    garb('#ece6d6', 'ankle', { sleeve: true, shoe: '#3a2a1c' })],
  // the stola to the ankle in a dyed wool, long-sleeved
  woman: [garb('#9a4a3a', 'ankle', { sleeve: true, shoe: '#5a3e26' }), garb('#c9b27a', 'ankle', { sleeve: true, shoe: '#5a3e26' }), garb('#5e6a7a', 'ankle', { sleeve: true, shoe: '#4a3220' })],
  // the field hand's short tunic, undyed, barefoot or in rough boots
  hand: [garb('#9a8a6a', 'knee'), garb('#7a6648', 'knee', { shoe: '#4a3a2a' }), garb('#b0a080', 'knee')],
};
const GREEK = {
  skin: ['#c4906a', '#a8744f', '#d6a07a'],
  // the chiton to the knee; the long chiton and himation of an older man
  man: [garb('#e2d8c0', 'knee', { shoe: '#5a3e26' }), garb('#b0804a', 'knee', { shoe: '#5a3e26' }), garb('#e8e2d0', 'ankle', { skirt: '#8a6a4a', shoe: '#4a3220' })],
  // the peplos to the ankle
  woman: [garb('#d8ccb0', 'ankle', { shoe: '#5a3e26' }), garb('#8a5048', 'ankle', { shoe: '#5a3e26' }), garb('#6a7a6a', 'ankle', { sleeve: true, shoe: '#4a3220' })],
  hand: [garb('#9a8a6a', 'knee'), garb('#857254', 'knee')],
};
const EGYPT = {
  skin: ['#9a6440', '#86553a', '#ad7450'],
  // the linen tunic over a kilt to the knee; the sheath dress to the ankle
  man: [garb('#f0ece0', 'knee', { skirt: '#e6e0cc' }), garb('#ece6d4', 'shin', { shoe: '#8a6a40' })],
  woman: [garb('#f2eee2', 'ankle'), garb('#e6dfca', 'ankle', { sleeve: true })],
  hand: [garb('#d8d0b8', 'knee', { skirt: '#e0d8c2' }), garb('#c8bc9e', 'knee')],
};
const SUMER = {
  skin: ['#a46c48', '#8e5c3e', '#b67c56'],
  // the fleece skirt (kaunakes) to the shin under a wool shawl; the women's wrapped wool to the ankle
  man: [garb('#b8a47e', 'shin', { skirt: '#d6c8a4' }), garb('#a89470', 'knee', { skirt: '#c4b088' })],
  woman: [garb('#cbb994', 'ankle', { sleeve: true }), garb('#a88a62', 'ankle')],
  hand: [garb('#a08c68', 'knee', { skirt: '#b4a07a' }), garb('#8c7a5a', 'knee')],
};
const QIN = {
  skin: ['#d0a27a', '#c09068', '#dcae86'],
  // the long robe crossed over, dark for the Qin, long-sleeved; the labourer's jacket to the knee over hemp trousers
  man: [garb('#2e2a2a', 'ankle', { sleeve: true, shoe: '#1c1a18' }), garb('#4a3a32', 'ankle', { sleeve: true, shoe: '#1c1a18' }), garb('#3a4048', 'shin', { sleeve: true, legs: '#2a2a2a', shoe: '#1c1a18' })],
  woman: [garb('#6a3a34', 'ankle', { sleeve: true, shoe: '#1c1a18' }), garb('#3e3a44', 'ankle', { sleeve: true, shoe: '#1c1a18' })],
  hand: [garb('#a89a7a', 'knee', { sleeve: true, legs: '#8a7c60', shoe: '#2a2620' }), garb('#968a6c', 'knee', { legs: '#7a6e56' })],
};
export const DRESS = { pompeii: ROMAN, forum: ROMAN, lindos: GREEK, polis: GREEK, thebes: EGYPT, giza: EGYPT, sumer: SUMER, qin: QIN };

/** A garment on a skin → a pedestrian palette: the shirt and skirt, a sleeve or a bare forearm, legs or bare shins. */
function palette(g, skin) {
  const legs = g.legs || skin;
  return { skin, shirt: g.shirt, skirt: g.skirt || g.shirt, forearm: g.sleeve ? g.shirt : skin, thigh: legs, shin: legs, pants: legs, shoe: g.shoe || skin };
}

// ── scale: the bake's own height, so a figure stands at its height in metres ──────────────────────────────────────
const MAN = 1.66;   // metres; the woman and the child keep their archetype's proportion to him
let _unitHeight = null;
function unitHeight() {   // the adult man's height at scale 1
  if (_unitHeight === null) _unitHeight = Math.max(...pedestrianFaces({ lod: 'mini' }).flatMap((f) => f.corners.map((c) => c[2])));
  return _unitHeight;
}

const WORK_POSES = ['stoop', 'stoop', 'hoe', 'hoe', 'idleL', 'carry'];

/**
 * Where a figure may stand in a plan's masses: a bucket of every box by the claim cells it covers, read as the ground
 * under a point. A low box (a kerb, a step, a podium's edge: under knee height over the ground) is stood on; anything
 * taller there (a fountain, a tree, a wall) refuses the spot. Returns `footing(x, y)` → the standing height in metres,
 * or null.
 */
function footings(plan, cell, hAt) {
  const B = new Map(), KNEE = 0.6;
  for (const b of plan.boxes) {
    if (!(b.w > 0 && b.d > 0) || b.kind === 'horizon' || b.w * b.d > 4000) continue;
    for (let r = Math.floor(b.y / cell); r <= Math.floor((b.y + b.d) / cell); r++)
      for (let c = Math.floor(b.x / cell); c <= Math.floor((b.x + b.w) / cell); c++) { const k = r * 100000 + c; if (!B.has(k)) B.set(k, []); B.get(k).push(b); }
  }
  return (x, y) => {
    const g = hAt(x, y), list = B.get(Math.floor(y / cell) * 100000 + Math.floor(x / cell)) || [];
    let z = g;
    for (const b of list) {
      if (x < b.x - 0.2 || x > b.x + b.w + 0.2 || y < b.y - 0.2 || y > b.y + b.d + 0.2 || b.z1 <= g + 0.02 || b.z0 > g + 2) continue;
      if (b.z1 - g >= KNEE) return null;
      z = Math.max(z, b.z1);
    }
    return z;
  };
}

/**
 * The town's people as World faces (scene units). `people`: true, or { density 0–1 (0.5), citizens: false, hands:
 * false }. Citizens stand on the lanes and open ground inside and in the plan's square (`stats.square`, where the
 * town gathers), thicker where the ground is open (a square, a main street) than in a back alley: solo, a pair, a
 * household. Field hands work in gangs of two to four in the plan's fields, facing one way along the row.
 * Returns { faces, citizens, hands }.
 */
export function miniatureFaces(plan, people, s, seed = 1) {
  const out = { faces: [], citizens: 0, hands: 0 };
  const G = plan.grid;
  if (!people || !G) return out;
  const o = typeof people === 'object' ? people : {};
  const density = Math.max(0, Math.min(1, Number.isFinite(o.density) ? o.density : 0.5));
  const D = DRESS[plan.stats.culture] || ROMAN, { cols, rows, cell, data, codes: C } = G;
  const hAt = plan.hAt || (() => 0), footing = footings(plan, cell, hAt);
  const R = stream(seed, 'people');
  const k = s / unitHeight();
  const stand = (x, y, z, heading, archetype, pose, garment) => {
    const scale = MAN * k * (0.95 + R() * 0.1);
    for (const f of pedestrianFaces({ cx: x * s, cy: y * s, heading, scale, archetype, pose, palette: palette(garment, pick(D.skin, R)), lod: 'mini', cut: garment.cut }))
      out.faces.push({ ...f, corners: f.corners.map(([a, b, c]) => [a, b, c + (z + 0.1) * s]) });
  };
  const code = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows ? data[r * cols + c] : -1);
  // flat ground: no step of more than a hand within a pace either way (keeps hands off a bluff's face)
  const flat = (x, y) => { const z = hAt(x, y); return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => Math.abs(hAt(x + dx, y + dy) - z) < 0.15); };

  // ── citizens: on the lanes, the open ground and the square, by how open the ground round them is ──
  if (o.citizens !== false) {
    const walkCode = new Set([C.LANE, C.OPEN]), sq = plan.stats.square;
    const inSquare = (c, r) => !!sq && (c + 0.5) * cell > sq.x && (c + 0.5) * cell < sq.x + sq.w && (r + 0.5) * cell > sq.y && (r + 0.5) * cell < sq.y + sq.d;
    const walk = (c, r) => walkCode.has(code(c, r)) || inSquare(c, r);
    const at = (x, y) => walk(Math.floor(x / cell), Math.floor(y / cell));
    // openness: the walkable share of the 5 × 5 cells round a cell (an alley ~0.2, a main street ~0.4, a square 1)
    const open = (c, r) => { let n = 0; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (walk(c + dc, r + dr)) n++; return n / 25; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!walk(c, r)) continue;
      const w = open(c, r);
      if (R() > 0.05 * density * (0.25 + w)) continue;
      const x = (c + 0.2 + R() * 0.6) * cell, y = (r + 0.2 + R() * 0.6) * cell, th = R() * Math.PI * 2;
      const poses = R() < 0.5 ? IDLE_POSES : STROLL_POSES, kind = R();
      const side = (d) => [x - SM.sin(th) * d, y + SM.cos(th) * d];
      const one = (px, py, h, arch, garment) => {
        const z = at(px, py) ? footing(px, py) : null;
        if (z === null) return;
        stand(px, py, z, h, arch, pick(poses, R), garment); out.citizens++;
      };
      if (kind < 0.5) {
        const man = R() < 0.55;
        one(x, y, th, man ? 'adultM' : 'adultF', pick(man ? D.man : D.woman, R));
      } else if (kind < 0.8) {   // a pair talking, turned a little to each other
        const [ax, ay] = side(-0.35), [bx, by] = side(0.35);
        one(ax, ay, th + 0.5, 'adultM', pick(D.man, R));
        one(bx, by, th - 0.5, R() < 0.5 ? 'adultM' : 'adultF', pick(R() < 0.5 ? D.man : D.woman, R));
      } else {   // a household: a woman, a child or two, sometimes the man
        const [ax, ay] = side(-0.4), [bx, by] = side(0.4);
        one(ax, ay, th, 'adultF', pick(D.woman, R));
        if (R() < 0.5) one(bx, by, th, 'adultM', pick(D.man, R));
        const n = 1 + (R() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) { const [cx, cy] = side(0.3 * i - 0.1); one(cx + SM.cos(th) * 0.7, cy + SM.sin(th) * 0.7, th + (R() - 0.5), 'child', pick(D.hand, R)); }
      }
    }
  }

  // ── field hands: gangs in the fields the plan draws (its `field` grounds), a few hundred at most ──
  if (o.hands !== false) {
    const fields = plan.grounds.filter((q) => q.kind === 'field' && q.w > 4 && q.d > 4);
    for (let i = fields.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [fields[i], fields[j]] = [fields[j], fields[i]]; }   // seeded order, so the cap takes from everywhere
    const cap = Math.round(400 * density), pField = 0.3 * density;
    for (const q of fields) {
      if (out.hands >= cap) break;
      if (R() > pField) continue;
      const th = R() < 0.5 ? 0 : Math.PI / 2, n = 2 + Math.floor(R() * 3), gap = 1.6 + R() * 0.8;
      const along = th + Math.PI / 2;   // the gang abreast, across the row they work along
      const x = q.x + q.w * (0.25 + R() * 0.5), y = q.y + q.d * (0.25 + R() * 0.5);
      for (let i = 0; i < n; i++) {
        const px = x + SM.cos(along) * gap * (i - (n - 1) / 2) + (R() - 0.5) * 0.6, py = y + SM.sin(along) * gap * (i - (n - 1) / 2) + (R() - 0.5) * 0.6;
        if (px < q.x || px > q.x + q.w || py < q.y || py > q.y + q.d || !flat(px, py)) continue;
        const z = footing(px, py);
        if (z === null) continue;
        stand(px, py, Math.max(z, q.z), th + (R() - 0.5) * 0.4, R() < 0.8 ? 'adultM' : 'adultF', pick(WORK_POSES, R), pick(D.hand, R));
        out.hands++;
      }
    }
  }
  return out;
}
