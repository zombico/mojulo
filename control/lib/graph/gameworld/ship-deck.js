/**
 * A SHIP'S DECK TO PLAY ON — a boat of the craft shelf (a vehicle word the registry knows, its archetype's hull and its
 * parts) laid as a level's ground: held still with its weather deck at the level's floor (z 0), its bow along +y, and
 * the sea under it as if it made way (the boat water's ship at sea, scene/channels/controllable/boat-water.js). What
 * the level walks is read off the ship: the deck's outline from its hull's lines (the sheer's half-breadth along its
 * length), a rail round it the free run never carries a body over, its house a wall to go round, its sea boat and its
 * davit cover. Drawn as the shelf draws it (craft-rig.js, the form render's light), in the naval look of the shelf's
 * other military boats.
 *
 *   shipDeck(word, { speed?, night?, sky? }) → { archetype, label, figure, at: [x, y, z], heading, length, beam, deckZ,
 *                                          seaZ, halfAt(y), colliders, faces, sea, inside(x, y) }
 *     speed     knots it is shown making (10)
 *     night     the sea's colour at night
 *     sky       the level's sky ({ zenith, horizon }, 0 to 255), the water reflecting it (materials/aqua-look.js)
 *   SHIP_DECK   the numbers: the rail's collider reach outboard, its step along the bow's taper, the walk's sheet under
 *               the ship's own deck
 *
 * Vehicle space as the shelves' (+y the bow, +x starboard, metres); the level's the same, the ship's middle at its
 * origin. Pure.
 */
import { resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { BOAT_ODM } from '../craft-shelf/boat-odm.js';
import { craftPieces } from '../craft-shelf/craft-rig.js';
import { boatDrive, BOAT_DRIVE } from '../craft-shelf/boat-drive.js';
import { SEAWAY_WATERS } from '../worlds/seaway-scene.js';
import { resolveAquaLook } from '../materials/aqua-look.js';

export const SHIP_DECK = Object.freeze({ out: 2, step: 2, sheet: -0.03, rail: 1.1, speed: 10, nightSea: '#0a1822', fill: '#4f555a' });
const KN = 0.514444;
const r2 = (v) => Math.round(v * 100) / 100 + 0;
const lerpLine = (L, s) => { if (s <= L[0][0]) return L[0][1]; for (let i = 1; i < L.length; i++) if (s <= L[i][0]) { const [a, va] = L[i - 1], [b, vb] = L[i]; return va + (vb - va) * (s - a) / (b - a); } return L[L.length - 1][1]; };
const extent = (p) => { const pos = p.soup.pos, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); } return { mn, mx }; };

/** The ship a word names, laid as a deck to play on (see the header); throws, teaching, for a word that is no ship. */
export function shipDeck(word, { speed = SHIP_DECK.speed, night = false, sky = null } = {}) {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) throw new Error(`ship: '${word}' is not a vehicle of the library`);
  const a = (handlesOf(hit.id).craft ?? [])[0], A = a && CRAFT_ARCHETYPES[a];
  if (!A || A.realm !== 'water') throw new Error(`ship: the ${hit.id} is no boat of the craft shelf`);
  if (!BOAT_DRIVE[a]) throw new Error(`ship: the ${hit.id} has no drive figures (craft-shelf/boat-drive.js BOAT_DRIVE) to lay its sea by`);
  const hullSku = A.layout.find((l) => l.id === 'hull')?.sku, H = BOAT_ODM[hullSku];
  if (!H?.build?.lines) throw new Error(`ship: the ${hit.id}'s hull draws no lines to read its deck from`);
  const P = craftPieces(a), byId = new Map(P.pieces.map((p) => [p.id, p])), hullE = extent(byId.get('hull'));
  // (its weather deck: where what stands on it stands, its lowest foot; else the hull's sheer amidships)
  // (its house's foot where it has one; an outboard hung off a sea boat hangs below the deck and is never its height)
  const feet = byId.get('super') ? [extent(byId.get('super')).mn[2]] : P.pieces.filter((p) => !/^(hull|shaft|jet)|motor/i.test(p.id)).map((p) => extent(p).mn[2]);
  const deckZ = feet.length ? Math.min(...feet) : hullE.mx[2];
  const length = H.dims.length, beam = hullE.mx[0] - hullE.mn[0], y0 = hullE.mn[1], D = boatDrive(a), wl = D.waterline;
  const half = (y) => lerpLine(H.build.lines.sheerHalf, (y - y0) / length);
  // THE WALK: under the ship's own deck, a sheet the page stands a body on, its outline the hull's at each step
  const S = SHIP_DECK.step, faces = [], colliders = [], z = SHIP_DECK.sheet;
  // (the rail's run: where the bow rail ends, the walk ends with it)
  const rails = H.build.fittings?.rails, bowTo = H.build.fittings?.bowRail?.to ?? rails?.to ?? 1, yEnd = y0 + length * bowTo;
  for (let y = y0; y < yEnd - 1e-6; y += S) {
    const y1 = Math.min(yEnd, y + S), h0 = half(y), h1 = half(y1), w = Math.max(0, Math.min(h0, h1) - 0.15);
    faces.push({ corners: [[-h0, y, z], [h0, y, z], [h1, y1, z], [-h1, y1, z]], fill: SHIP_DECK.fill, group: 'ship:walk', doubleSided: true });
    // (each side's rail over this step: its inner face at the narrower of the step's two breadths, so the taper is never
    // walked off; its collider deeper than a vault crosses, out over the water)
    for (const sd of [-1, 1]) { const xi = sd * w, xo = sd * (w + SHIP_DECK.out); colliders.push({ min: [r2(Math.min(xi, xo)), r2(y), 0], max: [r2(Math.max(xi, xo)), r2(y1), SHIP_DECK.rail], hold: false, of: 'ship:rail' }); }
  }
  // (the stern's rail across the transom, and the bow closed where the walk ends)
  colliders.push({ min: [r2(-half(y0) - SHIP_DECK.out), r2(y0 - SHIP_DECK.out), 0], max: [r2(half(y0) + SHIP_DECK.out), r2(y0 + 0.12), SHIP_DECK.rail], hold: false, of: 'ship:rail' });
  colliders.push({ min: [r2(-half(yEnd) - SHIP_DECK.out), r2(yEnd - 0.1), 0], max: [r2(half(yEnd) + SHIP_DECK.out), r2(yEnd + SHIP_DECK.out), SHIP_DECK.rail], hold: false, of: 'ship:rail' });
  // THE HOUSE and what stands on the deck: its lowest tier a wall to go round (its bridge's wings over the side decks are
  // walked under); a sea boat and its davit low, cover; a mast or a crane's post, thin, left to walk round by eye
  const sup = A.layout.find((l) => l.id === 'super'), SB = sup && BOAT_ODM[sup.sku]?.build;
  if (SB?.tiers?.length && byId.get('super')) {
    const head = byId.get('super').head, top = extent(byId.get('super')).mx[2] - deckZ, T0 = SB.tiers[0];
    const ys = SB.tiers.map((t) => t.y).flat(), lo = Math.min(...SB.tiers.filter((t) => !t.bridge).map((t) => t.y[0])), hi = Math.max(...SB.tiers.filter((t) => !t.bridge).map((t) => t.y[1]));
    void ys;
    colliders.push({ min: [r2(-T0.width / 2), r2(head[1] + lo), 0], max: [r2(T0.width / 2), r2(head[1] + hi), r2(top)], hold: false, of: 'ship:house' });
  }
  for (const id of ['seaBoat', 'davit']) {
    const p = byId.get(id); if (!p) continue;
    const E = extent(p);
    colliders.push({ min: [r2(E.mn[0]), r2(E.mn[1]), 0], max: [r2(E.mx[0]), r2(E.mx[1]), r2(E.mx[2] - deckZ)], hold: false, of: `ship:${id}` });
  }
  // (the sea at the waterline its weight sets, the drive's: under the deck by its freeboard)
  const seaZ = r2(D.rule.waterline - deckZ);
  const Wt = SEAWAY_WATERS.ocean, U = speed * KN;
  // (its water's look the ocean's, reflecting the level's own sky: a night's dark one, the sea a deeper tint and a little
  // less of a mirror under it)
  const look = resolveAquaLook(night ? { kind: 'ocean', tint: SHIP_DECK.nightSea, refl: 0.8, froth: 1.6 } : 'ocean', { sky });
  // (its foam at night the moon's grey, not a noon's white)
  const sea = { kind: 'ocean', color: night ? SHIP_DECK.nightSea : Wt.color, swell: Wt.swell, look, ...(night ? { foamCol: [0.42, 0.47, 0.52] } : {}), wakes: D.wakes, waterline: wl, shore: 1e9, sheet: { size: r2(Math.max(240, 14 * length)), n: 150 } };
  const inside = (x, y) => y >= y0 && y <= yEnd && Math.abs(x) <= half(y) - 0.15;
  // (its figure a craft off the shelf as a world resolves one, world-scene.js `craft`: in the form render, lit by the
  // level's own sky, as its parked aircraft and boats are)
  return { archetype: a, label: A.label, figure: { craft: { archetype: a, ...(A.look ? { look: A.look } : {}) } }, at: [0, 0, r2(-deckZ)], heading: Math.PI / 2, length, beam: r2(beam), deckZ: r2(deckZ), seaZ, halfAt: half, colliders, faces, sea, speed: r2(U), inside, y0: r2(y0), yEnd: r2(yEnd) };
}
