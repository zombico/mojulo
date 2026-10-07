/**
 * historic/crews — the people and beasts at the work of the farm, the works and the region (./farmstead.js,
 * ./workshops.js, ./historic-region.js). Those kits build every tool and building at rest and leave the gap on
 * purpose: "the donkey pair and the carter are placed by their own builders, at the yoke", "the moulders are placed
 * by their own builder". This is that builder, over the same miniatures as the town (./miniatures.js `folkKit`).
 *
 * Two passes, after the scene is built, each on its own seeded stream:
 *   - HITCH: every yoke in the scene with a pole run back from it (a plough, a cart, a threshing sledge, a chariot)
 *     gets its team: two beasts abreast, their necks at the yoke, facing away from the pole, and the yoke and the
 *     pole's front end lifted from the ground to the neck. The ploughman stands behind the stilts; any other driver
 *     at the team's head.
 *   - CREWS: every slot whose asset names its workers (`CREWS`) gets them, in its own frame (front −y, ../assets/kit.js):
 *     at its working front facing into it, inside it, or ahead of it (the haulers before a stone sledge), each in a
 *     pose for the work; pens get their beasts.
 * A person or a beast stands only where the footing takes it (no wall, kiln or standing crop under it). Plans in
 * metres; faces out in scene units.
 */
import { orientBox, localSize } from './assets/kit.js';
import { stream, pick } from './layout-kit.js';
import { BEASTS } from './beasts.js';
import { folkKit, peopleOptions, miniatureFaces } from './miniatures.js';
import { SM } from '../../util/math-scope.js';

const WORK = ['stoop', 'hoe'], STAND = ['idleL', 'idleR'], WALK = ['strollL', 'strollR'];

// who works each asset: [count lo, hi, poses, where] people, and { beast, n, where } beasts. `where`: 'front' (just
// inside the slot's front, facing into it), 'inside' (anywhere in it), 'ahead' (outside the front, facing away),
// 'before' (outside the front, facing into it: the customer, the worshipper). `dress`: the town's 'man' for the priest,
// the shopkeeper and the guard (default the labourer's 'hand'). `deck`: they work up on its top (a quay, a hull).
// `per`: the count is for each `per` m² of a big slot. A beast `town` is the culture's pack animal.
const crew = (lo, hi, poses, where = 'front', o = {}) => ({ lo, hi, poses, where, ...o });
export const CREWS = {
  // the farm
  'harvest-edge': [crew(4, 6, ['stoop'], 'front', { out: true }), crew(1, 2, ['carry', 'stoop'], 'inside')],
  'eg-harvest-edge': [crew(4, 6, ['stoop'], 'front', { out: true }), crew(1, 2, ['carry', 'stoop'], 'inside')],
  'threshing-floor': [crew(2, 3, ['hoe', 'idleL'], 'inside')],
  'eg-threshing-floor': [crew(2, 3, ['hoe', 'idleR'], 'inside'), { beast: 'ox', n: 3, where: 'inside' }],
  'reed-byre': [crew(1, 1, ['stoop'], 'front'), { beast: 'ox', n: 2, where: 'inside' }],
  'eg-cattle-shed': [crew(1, 2, ['stoop', 'idleL'], 'front'), { beast: 'ox', n: 3, where: 'inside' }],
  stable: [{ beast: 'town', n: 2, where: 'inside' }],
  'eg-stable': [{ beast: 'town', n: 2, where: 'inside' }],
  sheepfold: [crew(1, 1, STAND, 'front', { out: true })],
  'eg-fold': [crew(1, 1, STAND, 'front', { out: true })],
  storehouse: [crew(2, 3, ['carry', 'idleL'], 'front', { out: true })],
  'eg-silo-court': [crew(2, 3, ['carry', 'carry', 'idleR'], 'inside')],
  farmhouse: [crew(1, 2, STAND, 'front', { out: true, women: true })],
  'eg-farmhouse': [crew(1, 2, STAND, 'front', { out: true, women: true })],
  shaduf: [crew(1, 1, ['hoe'], 'front')],
  'eg-pillar-shaduf': [crew(1, 1, ['hoe'], 'front')],
  wagon: [crew(1, 1, ['carry'], 'front')],
  'eg-grain-packs': [crew(2, 2, ['carry', 'stoop'], 'inside'), { beast: 'town', n: 2, where: 'inside' }],
  'eg-scribes-shade': [crew(2, 3, STAND, 'inside'), crew(1, 1, ['stoop'], 'front')],
  'eg-garden': [crew(1, 2, ['stoop', 'carry'], 'inside', { women: true })],
  'eg-vineyard': [crew(2, 3, ['stoop', 'carry'], 'inside')],
  'eg-apiary': [crew(1, 1, ['stoop'], 'inside')],
  // the works
  'clay-pit': [crew(2, 3, ['hoe'], 'inside'), crew(1, 2, ['carry'], 'front', { out: true })],
  'clay-mixing': [crew(2, 3, ['hoe', 'stoop'], 'inside')],
  'brick-field': [crew(2, 4, ['stoop'], 'inside')],
  'brick-hacks': [crew(1, 2, ['carry', 'stoop'], 'inside')],
  'brick-kiln': [crew(1, 2, ['stoop', 'carry'], 'front')],
  'potters-yard': [crew(2, 3, ['stoop', 'stoop', 'carry'], 'inside')],
  'eg-potters-yard': [crew(2, 3, ['stoop', 'stoop', 'carry'], 'inside')],
  'eg-pottery-kiln': [crew(1, 1, ['stoop'], 'front')],
  'copper-workshop': [crew(2, 3, ['hoe', 'stoop'], 'inside')],
  'eg-bronze-foundry': [crew(2, 4, ['hoe', 'stoop'], 'inside')],
  'charcoal-clamp': [crew(1, 1, ['hoe'], 'front')],
  wheelwright: [crew(1, 2, ['hoe', 'stoop'], 'inside')],
  'eg-carpenters': [crew(2, 3, ['hoe', 'stoop'], 'inside')],
  'eg-chariot-shop': [crew(1, 2, ['hoe', 'stoop'], 'inside')],
  'stone-landing': [crew(2, 4, ['carry', 'carry', 'stoop'], 'inside')],
  'eg-stone-quay': [crew(2, 4, ['carry', 'stoop'], 'inside')],
  'bitumen-works': [crew(1, 2, ['stoop', 'hoe'], 'inside')],
  'reed-store': [crew(2, 3, ['stoop', 'carry'], 'inside')],
  'eg-papyrus-works': [crew(2, 3, ['stoop', 'carry'], 'inside')],
  'eg-quarry': [crew(3, 5, ['hoe', 'hoe', 'stoop'], 'inside')],
  'eg-stone-sledge': [crew(6, 8, ['hoe'], 'ahead'), crew(1, 1, ['stoop'], 'front')],
  'eg-masons-yard': [crew(2, 4, ['hoe', 'stoop'], 'inside')],
  'eg-boatyard': [crew(2, 3, ['hoe', 'stoop'], 'inside')],
  'eg-stone-barge': [crew(1, 2, ['carry', 'idleL'], 'inside')],
  'eg-glass-works': [crew(1, 2, ['stoop'], 'inside')],
  // Pompeii's farm at the vintage (./assets/pompeii-land.js)
  'pl-villa': [crew(2, 3, STAND, 'inside', { dress: 'man', women: true })],
  'pl-vine-block': [crew(3, 6, ['stoop', 'stoop', 'carry'], 'inside', { women: true, per: 600 })],
  'pl-cella-vinaria': [crew(1, 2, ['stoop', 'carry'], 'inside')],
  'pl-press-room': [crew(2, 4, ['strollL', 'strollR', 'hoe', 'carry'], 'inside')],
  'pl-trapetum': [crew(2, 2, ['hoe'], 'inside')],
  'pl-threshing-terrace': [crew(1, 2, ['hoe', 'carry'], 'inside')],
  'pl-barn': [crew(1, 2, ['carry', ...STAND], 'before', { women: true })],
  'pl-stable': [crew(1, 1, STAND, 'before'), { beast: 'horse', n: 2, where: 'inside' }],
  // the city: Sumer (and the pieces Thebes borrows from its art kit)
  'white-temple': [crew(1, 2, STAND, 'before', { dress: 'man' })],
  altar: [crew(1, 1, ['idleL'], 'before', { dress: 'man' }), crew(1, 3, STAND, 'before', { dress: 'man', women: true })],
  'votive-row': [crew(1, 2, STAND, 'before', { dress: 'man', women: true })],
  well: [crew(1, 2, ['carry', 'idleR'], 'before', { women: true })],
  granary: [crew(1, 2, ['carry'], 'before')],
  'pottery-kiln': [crew(1, 2, ['stoop', 'carry'], 'before')],
  'reed-boat': [crew(1, 2, ['stoop', 'idleL'], 'inside', { deck: true })],
  'city-gate': [crew(1, 2, STAND, 'ahead', { dress: 'man' }), crew(1, 2, ['carry', ...WALK], 'before'), { beast: 'town', n: 1, where: 'ahead' }],
  // Thebes
  'eg-pylon': [crew(1, 3, STAND, 'before', { dress: 'man' })],
  'eg-temenos-gate': [crew(2, 3, STAND, 'ahead', { dress: 'man' }), crew(1, 2, WALK, 'before', { dress: 'man', women: true })],
  'eg-sphinx-row': [crew(2, 4, WALK, 'inside', { dress: 'man', women: true })],
  'eg-offering': [crew(1, 2, ['stoop', 'idleL'], 'before', { dress: 'man' })],
  'eg-sacred-lake': [crew(1, 2, STAND, 'before', { dress: 'man' })],
  'eg-quay': [crew(2, 4, ['carry', 'carry', 'stoop'], 'inside', { deck: true })],
  'eg-nile-ship': [crew(1, 3, ['stoop', 'idleL'], 'inside', { deck: true })],
  'eg-shaduf': [crew(1, 1, ['hoe'], 'front')],
  // Giza
  'gz-pyramid': [crew(3, 6, ['carry', 'hoe'], 'before')],
  'gz-mortuary-temple': [crew(1, 3, STAND, 'before', { dress: 'man' })],
  'gz-valley-temple': [crew(1, 3, STAND, 'before', { dress: 'man' })],
  // Lindos (and the polis)
  'ln-temple': [crew(1, 2, STAND, 'before', { dress: 'man', women: true })],
  'ln-altar': [crew(1, 1, ['idleL'], 'before', { dress: 'man' }), crew(1, 3, STAND, 'before', { dress: 'man', women: true })],
  'ln-propylaia': [crew(1, 3, WALK, 'before', { dress: 'man', women: true })],
  'ln-stoa': [crew(2, 4, STAND, 'inside', { dress: 'man' })],
  'ln-kiln': [crew(1, 2, ['stoop', 'carry'], 'before')],
  'ln-boat': [crew(1, 2, ['stoop', 'idleL'], 'before')],
  'ln-trireme': [crew(2, 4, ['stoop', 'idleL'], 'inside', { deck: true })],
  // Pompeii
  'pp-shop-house': [crew(1, 1, STAND, 'before', { out: true, dress: 'man' }), crew(0, 2, STAND, 'before', { dress: 'man', women: true })],
  'pp-fountain': [crew(1, 3, ['carry', 'idleR', 'idleL'], 'before', { women: true })],
  'pp-altar': [crew(1, 1, ['idleL'], 'before', { dress: 'man' }), crew(1, 3, STAND, 'before', { dress: 'man', women: true })],
  'pp-temple': [crew(1, 3, STAND, 'before', { dress: 'man', women: true })],
  'pp-gate': [crew(1, 2, STAND, 'ahead'), crew(1, 2, ['carry', ...WALK], 'before'), { beast: 'town', n: 1, where: 'ahead' }],
  'pp-portico': [crew(2, 4, STAND, 'inside', { dress: 'man', women: true })],
  'pp-court': [crew(2, 4, WALK, 'inside', { dress: 'man', women: true, per: 1500 })],
  // Qin
  'qn-hall': [crew(2, 3, STAND, 'before', { dress: 'man' })],
  'qn-ward-gate': [crew(1, 2, STAND, 'ahead', { dress: 'man' }), crew(1, 2, WALK, 'before')],
  'qn-market': [crew(4, 8, ['carry', 'stoop', 'idleL', 'idleR'], 'inside', { dress: 'man', women: true, per: 1500 }), { beast: 'town', n: 2, where: 'inside' }],
  'qn-terrace-works': [crew(4, 6, ['hoe', 'carry', 'stoop'], 'inside')],
  'qn-bridge': [crew(1, 3, WALK, 'inside', { dress: 'man', women: true })],
};

// what draws each yoked pole; a culture's own word wins (Sumer threshed with donkeys: the kit names them)
const TEAMS = { 'plough-pole': 'ox', 'sledge-pole': 'ox', 'cart-pole': 'town', 'chariot-pole': 'horse' };
const TEAM_BY = { sumer: { 'sledge-pole': 'town' } };

/**
 * The scene's people and beasts at their work: `{ faces, boxes, stats }`. `boxes` is the plan's own with each hitched
 * yoke and its pole lifted to the team's necks (the scene builds from these instead); the faces go over the scene.
 * `people`: as the town's (`density`, `beasts: false`, `crews: false`, `citizens`/`hands` for the town's own pass).
 */
export function crewFaces(plan, people, s, seed = 1, kit = folkKit(plan, s)) {
  const o = peopleOptions(people), density = o.density;
  const { out, D, H, footing, hooves, stand, beast } = kit;
  const culture = plan.stats.culture, boxes = plan.boxes.slice();
  const townBeast = H ? H.town[0] : 'donkey';
  const beastOf = (k) => (k === 'town' ? townBeast : k);
  const onGround = (kind, [x, y], th) => {
    const h = BEASTS[kind].height, ct = SM.cos(th), st = SM.sin(th);
    return [[h * 0.42, h * 0.16], [h * 0.42, -h * 0.16], [-h * 0.42, h * 0.16], [-h * 0.42, -h * 0.16]].every(([a, b]) => footing(x + a * ct - b * st, y + a * st + b * ct) !== null);
  };

  // ── HITCH: a team at every yoke with a pole run back from it ──
  if (o.beasts !== false) {
    const B = stream(seed, 'hitch');
    const poles = boxes.map((b, i) => [b, i]).filter(([b]) => b.solid === 'beam' && /-pole$/.test(b.kind) && TEAMS[b.kind]);
    for (const [i, y] of boxes.entries()) {
      if (y.kind !== 'yoke' || y.solid !== 'beam') continue;
      const M = [(y.a[0] + y.b[0]) / 2, (y.a[1] + y.b[1]) / 2], len = SM.hypot(y.b[0] - y.a[0], y.b[1] - y.a[1]);
      // the pole whose one end lies on this yoke: the other end is where the load is
      const hit = poles.map(([p, j]) => { const da = SM.hypot(p.a[0] - M[0], p.a[1] - M[1]), db = SM.hypot(p.b[0] - M[0], p.b[1] - M[1]); return { p, j, near: da < db ? 'a' : 'b', d: Math.min(da, db) }; }).filter((q) => q.d < 0.4).sort((a, b) => a.d - b.d)[0];
      if (!hit) continue;
      const far = hit.p[hit.near === 'a' ? 'b' : 'a'], bl = SM.hypot(far[0] - M[0], far[1] - M[1]) || 1;
      const back = [(far[0] - M[0]) / bl, (far[1] - M[1]) / bl], across = [-back[1], back[0]], th = SM.atan2(-back[1], -back[0]);
      const kind = beastOf((TEAM_BY[culture] || {})[hit.p.kind] || TEAMS[hit.p.kind]);
      if (!BEASTS[kind]) continue;
      const h = BEASTS[kind].height, half = Math.max(h * 0.32, len / 2 - h * 0.3), neck = h * 0.56;
      const at = (side) => [M[0] - back[0] * neck + across[0] * side * half, M[1] - back[1] * neck + across[1] * side * half];
      const [l, r] = [at(-1), at(1)];
      // a team stands on the ground over its own pole and yoke: only something tall under a hoof refuses it
      if (!onGround(kind, l, th) || !onGround(kind, r, th)) continue;
      const z = Math.max(kit.hAt(l[0], l[1]), kit.hAt(r[0], r[1])), g = beast(kind, l[0], l[1], z, th, B);
      beast(kind, r[0], r[1], z, th, B);
      // the yoke up on the necks, the pole's front end with it
      const zy = z + h * g * 0.76;
      boxes[i] = beamAt(y, { a: [y.a[0], y.a[1], zy], b: [y.b[0], y.b[1], zy] });
      boxes[hit.j] = beamAt(hit.p, { [hit.near]: [hit.p[hit.near][0], hit.p[hit.near][1], zy - 0.05] });
      // the ploughman at the stilts, else the driver at the head
      const stilts = hit.p.kind === 'plough-pole' ? boxes.filter((b) => b.kind === 'plough-stilt' && b.solid === 'beam' && SM.hypot(b.b[0] - far[0], b.b[1] - far[1]) < 3) : [];
      let px, py, pose;
      if (stilts.length) {
        const top = stilts.map((b) => (b.a[2] > b.b[2] ? b.a : b.b)), mx = top.reduce((a, q) => a + q[0], 0) / top.length, my = top.reduce((a, q) => a + q[1], 0) / top.length;
        [px, py, pose] = [mx + back[0] * 0.45, my + back[1] * 0.45, 'hoe'];
      } else [px, py, pose] = [M[0] - back[0] * h * 0.9 + across[0] * (half + 0.75), M[1] - back[1] * h * 0.9 + across[1] * (half + 0.75), pick(WALK, B)];
      const zp = footing(px, py);
      if (zp !== null) { stand(px, py, zp, th, 'adultM', pose, pick(D.hand, B), B); out.drivers++; }
    }
  }

  // ── CREWS: each slot's workers, in the slot's own frame ──
  if (o.crews !== false) {
    const R = stream(seed, 'crews'), keep = 0.5 + density;   // density 0.5 → everyone; lower thins the crews
    for (const slot of plan.slots || []) {
      const roles = CREWS[slot.asset];
      if (!roles || R() > keep) continue;
      const { W, D: Dp } = localSize(slot.rect, slot.facing);
      const P = (lx, ly) => { const q = orientBox({ x: lx, y: ly, w: 0, d: 0 }, slot.rect, slot.facing); return [q.x, q.y]; };
      const f0 = P(W / 2, 0), f1 = P(W / 2, 1), into = SM.atan2(f1[1] - f0[1], f1[0] - f0[0]);   // the heading from the front into the slot
      const spot = (where) => {
        if (where === 'front') return P(W * (0.15 + R() * 0.7), Math.min(Dp * 0.3, 0.6 + R() * 1.4));
        if (where === 'ahead') return P(W * (0.3 + R() * 0.4), -(0.8 + R() * 5));
        if (where === 'before') return P(W * (0.15 + R() * 0.7), -(0.9 + R() * 2.1));
        return P(W * (0.12 + R() * 0.76), Dp * (0.15 + R() * 0.7));
      };
      for (const role of roles) {
        if (role.beast) {
          if (o.beasts === false) continue;
          const kind = beastOf(role.beast);
          if (!BEASTS[kind]) continue;
          for (let n = 0; n < role.n; n++) for (let tries = 0; tries < 6; tries++) {
            const [x, y] = spot(role.where), th = into + (R() - 0.5) * 2.4, z = hooves(kind, x, y, th, () => true);
            if (z !== null) { beast(kind, x, y, z, th, R); break; }
          }
          continue;
        }
        // `per`: a big open slot (a market, a court) takes its count per that many square metres, up to 40
        const n0 = role.lo + Math.floor(R() * (role.hi - role.lo + 1)), n = role.per ? Math.min(40, Math.round(n0 * Math.max(1, (W * Dp) / role.per))) : n0;
        for (let i = 0; i < n; i++) for (let tries = 0; tries < 4; tries++) {
          const [x, y] = spot(role.where), z = role.deck ? footing.deck(x, y) ?? footing(x, y) : footing(x, y);
          if (z === null || !kit.clear(x, y, 0.55)) continue;
          // into the work, or (`out`, `ahead`) facing out of the slot's front; a little turned either way
          const th = (role.out || role.where === 'ahead' ? into + Math.PI : into) + (R() - 0.5) * 0.7;
          const woman = role.women && R() < 0.6;
          stand(x, y, z, th, woman ? 'adultF' : 'adultM', pick(role.poses, R), pick(woman ? D.woman : D[role.dress || 'hand'], R), R);
          out.crew++;
          break;
        }
      }
    }
  }
  return { faces: out.faces, boxes, stats: { citizens: out.citizens, hands: out.hands, crew: out.crew, beasts: out.beasts, drivers: out.drivers, ...(out.dress ? { dress: out.dress } : {}) }, herd: out.herd };
}

/**
 * A whole scene's people and beasts, on one kit so nobody stands on anybody: the town's pass (./miniatures.js — the
 * citizens on `plan.grid` if the scene has a town, the field hands in its fields, the plough teams unless `teams` is
 * off) and then the hitched teams and the crews. Returns `crewFaces`' { faces, boxes, stats, herd }.
 */
export function sceneFolk(plan, people, s, seed = 1, { teams = true } = {}) {
  if (!people) return null;
  const kit = folkKit(plan, s, plan.grid ? plan.grid.cell : 3, peopleOptions(people).year);
  miniatureFaces(plan, people, s, seed, { teams, kit });
  return crewFaces(plan, people, s, seed, kit);
}

/** A beam with one or both ends moved, its bounds kept in step (../assets/kit.js `beam`). */
function beamAt(b, ends) {
  const a = ends.a || b.a, c = ends.b || b.b, t = b.t;
  return { ...b, a, b: c, x: Math.min(a[0], c[0]) - t / 2, y: Math.min(a[1], c[1]) - t / 2, w: Math.abs(a[0] - c[0]) + t, d: Math.abs(a[1] - c[1]) + t, z0: Math.min(a[2], c[2]) - t / 2, z1: Math.max(a[2], c[2]) + t / 2 };
}
