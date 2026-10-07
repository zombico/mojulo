/**
 * historic/workshops — a sub-scene of a historic city: its works, where the things the town and the
 * farms use are made. Where ./farmstead.js shows what a civilisation grew, this shows how it made
 * its tools and its building stuff, and from what. For Sumer that means the alluvium's own materials
 * worked in the open by a canal:
 *   - the marsh reed cut and bundled;
 *   - clay dug from a pit, trodden with straw, struck in moulds and dried in rows, stacked, and some
 *     fired in a brick kiln;
 *   - the potters' wheels and kilns;
 *   - a landing where what the plain lacks comes in by boat: stone, flint, bitumen;
 *   - the bitumen boilers by it;
 *   - the coppersmiths' yard, where imported ingots are melted and cast into the farm's blades, with
 *     charcoal clamps to fuel it;
 *   - the wheelwright making the carts' solid wheels.
 * People and beasts are left out, as in the farmstead.
 *
 * Egypt (New Kingdom, by the Nile) had what the plain lacked: the river runs along the north, and at
 * its east end a sandstone cliff is cut back into a quarry. A sledge road runs from the quarry past the
 * masons' yard to the stone quay with its barge, and the boatyard and the papyrus marsh lie up the bank.
 * Inland are the brick field (the Sumerian pieces in Nile mud, never fired), the potters with their tall
 * kilns, the carpenters and the chariot makers, and the bronze foundry with its pot bellows beside the
 * new glass works.
 *
 * Same contract as the town and the farmstead: the layout emits SLOTS, the culture's kit builds each
 * one on its own dressing stream. Plans in metres. Pure and deterministic.
 */
import { SUMER } from './cultures/sumer.js';
import { SUMER_FARM_ASSETS } from './assets/sumer-farm.js';
import { SUMER_WORKS_ASSETS } from './assets/sumer-works.js';
import { EGYPT_COUNTRY } from './cultures/egypt-country.js';
import { EGYPT_WORKS_ASSETS } from './assets/egypt-works.js';
import { FARM_CULTURES, canalGround, tileGround, standingCrop } from './farmstead.js';
import { palm } from './patterns.js';
import { placeAsset, skinFor } from './assets/kit.js';
import { toScene, groundsToScene, emitHistoric, METRES_PER_UNIT, SCENE_LIGHT } from './historic-city.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { scaleHex } from '../polygonizer/vexar.js';
import { sceneFolk } from './crews.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const stream = (seed, tag) => mulberry32(hash(`${seed}|works|${tag}`));

/** Each culture's works: its town culture, the works kit beside the town and farm kits, the materials' colours. */
export const WORKS_CULTURES = {
  sumer: {
    culture: SUMER,
    label: 'the works of a Sumerian town',
    assets: { ...SUMER.assets, ...SUMER_FARM_ASSETS, ...SUMER_WORKS_ASSETS },
    palette: {
      ...FARM_CULTURES.sumer.palette,
      clay: '#94795a',                          // wet river clay
      greenware: '#b39a78',                     // pots formed, not yet fired
      sherd: '#b9714a',
      charcoal: '#2f2b28',
      ember: '#d0612e',
      molten: '#f0a040',
      crucible: '#8f877c',
      slag: '#4d4743',
      ash: '#a7a29a',
      metal: '#c27b46',                         // fresh-cast copper
      bitumen: '#262220',
      flint: '#8a8376',
      basalt: '#55534f',
      limestone: '#cfc6ab',
      timber: '#6b4f36',                        // imported hardwood, darker than palm
      chips: '#cdb388',
      reedStand: '#a09a5c',                     // standing reed, green going gold
    },
    canal: { width: 12, sink: 1.0 },
  },
  egypt: {
    culture: EGYPT_COUNTRY,
    label: 'the works of New Kingdom Thebes',
    // the Sumerian brick pieces and the charcoal clamp, in Nile colours; everything else Egypt's own
    assets: Object.fromEntries([...['clay-pit', 'clay-mixing', 'brick-field', 'brick-hacks', 'charcoal-clamp'].map((id) => [id, SUMER_WORKS_ASSETS[id]]), ...Object.entries(EGYPT_WORKS_ASSETS)]),
    palette: {
      ...EGYPT_COUNTRY.palette,
      clay: '#6e5a46',                          // wet Nile silt
      greenware: '#8f7a62',
      sherd: '#a5603e',                         // fired Nile silt: red-brown
      charcoal: '#2f2b28', ember: '#d0612e', molten: '#f0a040', crucible: '#8f877c', slag: '#4d4743', ash: '#a7a29a',
      metal: '#b98a4e',                         // bronze
      flint: '#8a8376',
      basalt: '#55534f',
      chips: '#d9c49a',
      glass: '#2f5fae',                         // cobalt blue
      faience: '#3fa3a0',                       // copper turquoise
      quartz: '#ece8de',
      reedStand: '#6f8f4a',                     // standing papyrus
    },
    canal: { width: 30, sink: 1.6 },            // a Nile channel along the north
    layout: 'egypt',
  },
};

export function planWorks({ seed = 1, culture = 'sumer', frame, assets } = {}) {
  const C = WORKS_CULTURES[culture] || WORKS_CULTURES.sumer;
  if (C.layout === 'egypt') return planEgyptWorks({ seed, culture, frame: frame || { w: 232, d: 112 }, assets });
  frame = frame || { w: 180, d: 100 };
  const K = C.culture, P = C.palette, kit = assets || C.assets;
  const L = stream(seed, 'layout'), slots = [], boxes = [], grounds = [];
  const W = frame.w, D = frame.d, J = (a = 1) => (L() - 0.5) * 2 * a;

  // ── 1. the canal along the north; the levee track along its south bank, from the marsh east ──
  const cw = C.canal.width, waterZ = -C.canal.sink, c0 = 14 + L() * 4, amp = 1.2 + L() * 1.2, ph = L() * 6.283;
  const bankN = (x) => c0 + amp * Math.sin((x / W) * 6.283 * 0.6 + ph), bankS = (x) => bankN(x) + cw;
  const southMax = Math.max(...Array.from({ length: 28 }, (_, i) => bankS((i / 27) * W)));
  const marshW = 34, track = { x: marshW, y: southMax + 1, d: 5 };
  const top = track.y + track.d + 2;   // the works start south of the track
  const place = (asset, rect, facing, o = {}) => { slots.push({ asset, rect, facing, ...o }); return rect; };

  // ── 2. the reed marsh at the west end: stands of reed along the water, the cutters' ground at its edge ──
  grounds.push({ kind: 'marsh', x: 0, y: southMax - 4, w: marshW, d: D - southMax + 4, z: 0.02, fill: P.marsh, surface: 'mud', layer: 1 });
  for (const [x, y, w, d] of [[1, southMax - 3, 14, 13], [17, southMax - 3, 14, 8], [2, southMax + 13, 11, 18], [17, southMax + 8, 9, 10], [3, southMax + 40, 26, 14]]) {
    // a bed of reed is ragged: clumps of different heights with gaps of water and mud between them
    const R = stream(seed, `reeds|${x}`);
    for (let cy = y; cy < y + d - 1; cy += 2.6) for (let cx = x; cx < x + w - 1; cx += 2.6) {
      if (R() < 0.18) continue;
      const cw2 = 1.8 + R() * 1.6, cd2 = 1.8 + R() * 1.6;
      standingCrop({ x: cx + R() * 0.6, y: cy + R() * 0.6, w: Math.min(cw2, x + w - cx), d: Math.min(cd2, y + d - cy) }, 1.9 + R() * 1.5, P, boxes, grounds, scaleHex(P.reedStand, 0.92 + R() * 0.22), 'reed-stand', 0.92);
    }
  }
  place('reed-store', { x: 16 + J(), y: southMax + 22, w: 12, d: 7 }, 'n');

  // ── 3. the landing on the bank east of the marsh: boats in, stone and bitumen out ──
  const lx = marshW + 4 + J(), lw = 18, ly = bankS(lx + lw / 2) + 0.2;
  place('stone-landing', { x: lx, y: ly, w: lw, d: 9 }, 'n', { waterZ });
  for (const [bx, n] of [[lx - 2, 0], [lx + 8, 1]]) place('reed-boat', { x: bx, y: bankS(bx + 5) - 3.4 - n * 0.4, w: 10, d: 2.3 }, 'n', { z: waterZ - 0.3 });
  place('bitumen-works', { x: lx + 2, y: ly + 12 + J(), w: 9, d: 7 }, 'n');

  // ── 4. the clay: pit by the canal, mixing pits, the moulding field, the hacks and the kiln ──
  const pit = place('clay-pit', { x: 72, y: top + 1, w: 20, d: 11 }, 'n');   // sunk: on the 4 m column grid, its ground is left out
  place('clay-mixing', { x: pit.x + pit.w + 2, y: top + 2, w: 11, d: 7 }, 'n');
  const field = place('brick-field', { x: 66, y: pit.y + pit.d + 4, w: 30, d: 16 }, 'n');
  place('brick-hacks', { x: field.x + field.w + 2, y: field.y, w: 12, d: 7 }, 'w');
  place('brick-hacks', { x: field.x + field.w + 2, y: field.y + 8.5, w: 12, d: 7 }, 'w');
  const kiln = place('brick-kiln', { x: field.x + field.w + 16, y: field.y + 3, w: 10, d: 10 }, 'w');

  // ── 5. the potters east of the clay, their kilns beside the yard ──
  const pot = place('potters-yard', { x: 125 + J(), y: top + 2, w: 16, d: 12 }, 's');
  place('pottery-kiln', { x: pot.x + pot.w + 1.5, y: pot.y + 0.5, w: 4.5, d: 4.5 }, 's');
  place('pottery-kiln', { x: pot.x + pot.w + 1.5, y: pot.y + 6.5, w: 4.5, d: 4.5 }, 's');

  // ── 6. the metal and the wood: the coppersmiths' yard, charcoal clamps beside it, the wheelwright ──
  const forge = place('copper-workshop', { x: 154 + J(), y: top + 2, w: 15, d: 12.5 }, 's');
  for (const [k, dy] of [[0, 0], [1, 6.5]]) place('charcoal-clamp', { x: forge.x + forge.w + 2, y: forge.y + dy, w: 5.5, d: 5.5 }, 'n', { opened: k === 1 });
  const ww = place('wheelwright', { x: 128 + J(), y: field.y + 1, w: 15, d: 11 }, 'n');

  // ── 7. tracks: the levee track, a cross track through the works, lanes up to it ──
  const crossY = field.y + field.d + 4;
  grounds.push({ kind: 'track', x: track.x, y: track.y, w: W - track.x, d: track.d, z: 0.02, fill: P.lane, surface: 'mud', layer: 1 });
  grounds.push({ kind: 'track', x: lx, y: crossY, w: W - lx, d: 5, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  for (const x of [lx + lw - 4, 122.2]) grounds.push({ kind: 'track', x, y: track.y + track.d, w: 3.4, d: crossY - track.y - track.d, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  grounds.push({ kind: 'track', x: forge.x + forge.w / 2 - 1.7, y: forge.y + forge.d, w: 3.4, d: crossY - forge.y - forge.d, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });   // out of the smiths' gate
  // the work floors: ground beaten bare round each group (kept off the clay pit, which is sunk)
  const floor = (x, y, w, d) => grounds.push({ kind: 'work-floor', x, y, w, d, z: 0.015, fill: scaleHex(P.lane, 0.96), surface: 'mud', layer: 1 });
  floor(lx - 1, ly + 9, lw + 2, 13);
  floor(pit.x - 5, top - 1, 4, crossY - top + 1); floor(pit.x - 1, pit.y + pit.d + 1, kiln.x + kiln.w + 1 - pit.x + 1, crossY - pit.y - pit.d - 1); floor(pit.x + pit.w + 1, top - 1, kiln.x + kiln.w - pit.x - pit.w, pit.y + pit.d + 2 - top);
  floor(pot.x - 2, top - 1, forge.x + forge.w + 8 - pot.x + 2, crossY - top + 1);
  grounds.push({ kind: 'track', x: 110, y: crossY + 5, w: 5, d: D - crossY - 5, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });   // south to the town

  // ── 8. palms along the levee, and a few in the open ground south of the works ──
  const G = stream(seed, 'groves'), taken = slots.map((q) => q.rect);
  const free = (x, y, m = 3) => !taken.some((r) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.d + m);
  for (let x = marshW + 2; x < W - 4; x += 10 + G() * 8) if (free(x, track.y - 1, 4)) boxes.push(palm(x, track.y - 0.6, G));
  for (let k = 0; k < 14; k++) { const x = marshW + 6 + G() * (W - marshW - 12), y = crossY + 8 + G() * (D - crossY - 12); if (free(x, y) && Math.abs(x - 112.5) > 6) boxes.push(palm(x, y, G)); }

  // ── 9. build every slot from the kit, each on its own dressing stream ──
  for (const [i, slot] of slots.entries()) {
    const A = kit[slot.asset];
    if (!A) throw new Error(`no asset '${slot.asset}' in the ${culture} works kit`);
    const placed = placeAsset(A, slot, { palette: P, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds.map((g) => ({ ...g, layer: g.layer ?? 4 })));
  }
  for (const b of boxes) if (b.skin === undefined) { const skin = skinFor(K, b); if (skin) b.skin = skin; }

  // ── 10. the ground round the canal, the clay pit cut out of it ──
  const G0 = canalGround({ W, D, bankN, cw, waterZ, P, holes: slots.filter((q) => kit[q.asset].sunk).map((q) => q.rect) });
  grounds.push(...G0.grounds); boxes.push(...G0.boxes);
  grounds.unshift(...G0.base);
  grounds.sort((a, b) => (a.layer ?? 4) - (b.layer ?? 4));

  // ── 11. views: where each kind of making can be seen at eye level ──
  const views = {
    // on the cross track below the moulding field, looking over the drying rows to the hacks and the kiln
    brickyard: { eye: [field.x + field.w * 0.55, field.y + field.d + 2.5, 1.7], at: [kiln.x + 3, kiln.y + 4, 1.2] },
    // in the coppersmiths' gate (it faces south), looking in at the hearths
    forge: { eye: [forge.x + forge.w / 2 - 1.5, forge.y + forge.d - 1.2, 1.7], at: [forge.x + forge.w - 3, forge.y + 7.5, 0.3] },
    // south of the potters' yard, across the drying pots to the shade and the kilns
    potters: { eye: [pot.x + 3, pot.y + pot.d + 1.5, 1.8], at: [pot.x + 11, pot.y + 4, 1.0] },
    // on the quay, looking along it to the boats
    landing: { eye: [lx + lw + 2, ly + 7, 2.0], at: [lx + 4, ly - 2, 0.6] },
    // on the clay pit's lip, looking down into it
    'clay-pit': { eye: [pit.x - 2, pit.y + pit.d + 2, 2.4], at: [pit.x + pit.w * 0.6, pit.y + pit.d * 0.4, -1.2] },
    wheelwright: { eye: [ww.x + ww.w / 2, ww.y - 4, 1.7], at: [ww.x + ww.w / 2, ww.y + 5, 0.6] },
  };

  return { boxes, grounds, views, slots, frame: { w: W, d: D }, stats: { culture, slots: slots.length, assets: [...new Set(slots.map((q) => q.asset))] } };
}

/**
 * Egypt's works: the Nile along the north; the quarry cliff at its east end; the sledge road west from
 * it past the masons to the stone quay; the boatyard and the papyrus marsh up the bank; brick, pots,
 * timber, bronze and glass inland.
 */
function planEgyptWorks({ seed, culture, frame, assets }) {
  const C = WORKS_CULTURES[culture], K = C.culture, P = C.palette, kit = assets || C.assets;
  const L = stream(seed, 'layout'), slots = [], boxes = [], grounds = [];
  const W = frame.w, D = frame.d, J = (a = 1) => (L() - 0.5) * 2 * a;
  const place = (asset, rect, facing, o = {}) => { slots.push({ asset, rect, facing, ...o }); return rect; };

  // ── 1. the river along the north, the levee track along its south bank ──
  const cw = C.canal.width, waterZ = -C.canal.sink, c0 = 4 + L() * 3, amp = 1.0 + L() * 1.0, ph = L() * 6.283;
  const bankN = (x) => c0 + amp * Math.sin((x / W) * 6.283 * 0.5 + ph), bankS = (x) => bankN(x) + cw;
  const southMax = Math.max(...Array.from({ length: 28 }, (_, i) => bankS((i / 27) * W)));
  const marshW = 34, track = { x: marshW, y: southMax + 1, d: 5 }, top = track.y + track.d + 2;

  // ── 2. the papyrus marsh at the west end, the papyrus works at its edge ──
  grounds.push({ kind: 'marsh', x: 0, y: southMax - 4, w: marshW, d: D - southMax + 4, z: 0.02, fill: P.marsh, surface: 'mud', layer: 1 });
  for (const [x, y, w, d] of [[1, southMax - 3, 14, 12], [17, southMax - 3, 14, 7], [2, southMax + 12, 11, 16], [18, southMax + 32, 12, 10], [3, southMax + 44, 26, 12]]) {
    const R = stream(seed, `papyrus|${x}`);
    for (let cy = y; cy < y + d - 1; cy += 2.8) for (let cx = x; cx < x + w - 1; cx += 2.8) {
      if (R() < 0.2) continue;
      const h = 2.4 + R() * 1.6, sw = 1.8 + R() * 1.6, sd = 1.8 + R() * 1.6;
      standingCrop({ x: cx + R() * 0.6, y: cy + R() * 0.6, w: Math.min(sw, x + w - cx), d: Math.min(sd, y + d - cy) }, h, P, boxes, grounds, scaleHex(P.reedStand, 0.9 + R() * 0.2), 'reed-stand', 0.9);
      if (R() < 0.5) boxes.push({ kind: 'umbel', solid: 'dome', sides: 6, x: cx + 0.4, y: cy + 0.4, w: 0.9, d: 0.9, z0: h - 0.05, z1: h + 0.4, tint: scaleHex(P.papyrus, 1.25), plant: true });   // the umbels over the stand
    }
  }
  place('eg-papyrus-works', { x: 16 + J(), y: southMax + 16, w: 12, d: 7 }, 'n');

  // ── 3. along the bank: the clay pit, the boatyard, the stone quay with its barge ──
  const pit = place('clay-pit', { x: 40, y: top + 1, w: 20, d: 11 }, 'n');   // sunk: on the 4 m column grid
  place('clay-mixing', { x: pit.x + pit.w + 2, y: top + 2, w: 11, d: 7 }, 'n');
  const by = Math.max(bankS(64), bankS(88)) + 0.3, yard = place('eg-boatyard', { x: 62, y: by, w: 26, d: Math.min(10, top - by - 0.5) }, 'n');
  const qx = 98 + J(), qw = 22, qy = bankS(qx + qw / 2) + 0.2;
  const quay = place('eg-stone-quay', { x: qx, y: qy, w: qw, d: 9 }, 'n', { waterZ });
  place('eg-stone-barge', { x: qx + 1, y: bankS(qx + 11) - 5.6, w: 20, d: 5 }, 'n', { z: waterZ - 0.45 });

  // ── 4. the quarry cliff at the east end, by the water; the sledge road west from its face to the quay ──
  const quarry = place('eg-quarry', { x: W - 30, y: southMax - 3, w: 24, d: 36 }, 'w');
  const road = { x: qx + qw - 3, y: top + 1, w: quarry.x - (qx + qw - 3), d: 5 };
  grounds.push({ kind: 'sledge-road', ...road, z: 0.026, fill: scaleHex(P.mud, 0.95), surface: 'mud', layer: 2 });
  for (const x of [road.x + road.w * 0.3, road.x + road.w * 0.68]) place('eg-stone-sledge', { x: x + J(), y: road.y + 0.7, w: 10, d: 3.6 }, 'w');
  const masons = place('eg-masons-yard', { x: qx + qw + 4, y: road.y + road.d + 2, w: 20, d: 14 }, 'n');

  // ── 5. inland: the brick field and hacks, the potters and their kilns, the carpenters and chariot makers ──
  const field = place('brick-field', { x: 40, y: pit.y + pit.d + 4, w: 30, d: 16 }, 'n');
  place('brick-hacks', { x: field.x + field.w + 2, y: field.y, w: 12, d: 7 }, 'w');
  place('brick-hacks', { x: field.x + field.w + 2, y: field.y + 8.5, w: 12, d: 7 }, 'w');
  const pot = place('eg-potters-yard', { x: 76 + J(), y: top + 2, w: 16, d: 12 }, 's');
  place('eg-pottery-kiln', { x: pot.x + pot.w + 1.5, y: pot.y, w: 4.6, d: 4.6 }, 's');
  place('eg-pottery-kiln', { x: pot.x + pot.w + 1.5, y: pot.y + 6.4, w: 4.6, d: 4.6 }, 's');
  const carp = place('eg-carpenters', { x: 88 + J(), y: field.y + 1, w: 15, d: 11 }, 'n');
  const char = place('eg-chariot-shop', { x: carp.x + carp.w + 3, y: field.y + 1, w: 15, d: 11 }, 'n');

  // ── 6. the fire trades east of the masons: the foundry with its charcoal clamps, the glass works ──
  const forge = place('eg-bronze-foundry', { x: masons.x + masons.w + 4 + J(), y: road.y + road.d + 2, w: 15, d: 12.5 }, 's');
  for (const [k, dy] of [[0, 0], [1, 6.5]]) place('charcoal-clamp', { x: forge.x + forge.w + 2, y: forge.y + dy, w: 5.5, d: 5.5 }, 'n', { opened: k === 1 });
  const glass = place('eg-glass-works', { x: forge.x + 2, y: forge.y + forge.d + 3, w: 12, d: 10 }, 'n');

  // ── 7. tracks: the levee track (stopping at the cliff), a cross track, lanes ──
  const crossY = Math.max(field.y + field.d, masons.y + masons.d, glass.y + glass.d) + 3;
  grounds.push({ kind: 'track', x: track.x, y: track.y, w: quarry.x - 2 - track.x, d: track.d, z: 0.02, fill: P.lane, surface: 'mud', layer: 1 });
  grounds.push({ kind: 'track', x: marshW, y: crossY, w: quarry.x - marshW, d: 5, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  for (const x of [pit.x + pit.w + 14, char.x + char.w + 2]) grounds.push({ kind: 'track', x, y: track.y + track.d, w: 3.4, d: crossY - track.y - track.d, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  const floor = (x, y, w, d) => grounds.push({ kind: 'work-floor', x, y, w, d, z: 0.015, fill: scaleHex(P.lane, 0.96), surface: 'mud', layer: 1 });
  floor(road.x, road.y + road.d, quarry.x - road.x, crossY - road.y - road.d);
  floor(pot.x - 2, top - 1, char.x + char.w - pot.x + 2, crossY - top + 1);
  grounds.push({ kind: 'track', x: W * 0.5, y: crossY + 5, w: 5, d: D - crossY - 5, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });   // south to the town

  // ── 8. palms along the levee and in the open ground south ──
  const G = stream(seed, 'groves'), taken = slots.map((q) => q.rect);
  const free = (x, y, m = 3) => !taken.some((r) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.d + m);
  for (let x = marshW + 2; x < quarry.x - 4; x += 10 + G() * 8) if (free(x, track.y - 1, 4)) boxes.push(palm(x, track.y - 0.6, G));
  for (let k = 0; k < 16; k++) { const x = marshW + 6 + G() * (W - marshW - 12), y = crossY + 8 + G() * (D - crossY - 12); if (free(x, y) && Math.abs(x - W * 0.5 - 2.5) > 6) boxes.push(palm(x, y, G)); }

  finishWorks({ seed, culture, K, P, kit, slots, boxes, grounds, W, D, bankN, cw, waterZ });

  // ── 9. views ──
  const s0 = slots.find((q) => q.asset === 'eg-stone-sledge').rect;
  const views = {
    // on the quarry floor, looking up at the benches being cut
    quarry: { eye: [quarry.x - 14, quarry.y + quarry.d * 0.7, 1.7], at: [quarry.x + 8, quarry.y + quarry.d * 0.45, 4.0] },
    // on the sledge road, the block coming toward the camera with the cliff behind it
    haul: { eye: [s0.x - 7, road.y + road.d + 1.2, 1.7], at: [s0.x + 6, road.y + 2.5, 1.0] },
    masons: { eye: [masons.x + masons.w * 0.15, masons.y - 3, 1.7], at: [masons.x + masons.w * 0.5, masons.y + masons.d * 0.6, 2.6] },
    // in the foundry's gate (it faces south), looking in at the hearth and the bellows
    foundry: { eye: [forge.x + forge.w / 2 - 1.0, forge.y + forge.d - 1.0, 1.7], at: [forge.x + forge.w - 3.2, forge.y + 7.3, 0.3] },
    // on the quay, looking along it to the barge
    quay: { eye: [quay.x + quay.w + 1, quay.y + 6, 2.0], at: [quay.x + 6, quay.y - 3, 1.0] },
    boatyard: { eye: [yard.x + yard.w + 3, yard.y + yard.d + 1, 2.0], at: [yard.x + yard.w * 0.5, yard.y + yard.d * 0.45, 1.2] },
    glass: { eye: [glass.x + glass.w / 2, glass.y - 4, 1.7], at: [glass.x + glass.w / 2, glass.y + 5, 0.6] },
    chariots: { eye: [char.x + char.w * 0.3, char.y - 4, 1.7], at: [char.x + char.w * 0.4, char.y + 5, 0.6] },
    brickyard: { eye: [field.x + field.w * 0.55, field.y + field.d + 2.5, 1.7], at: [field.x + field.w + 6, field.y + 4, 1.2] },
    potters: { eye: [pot.x + 3, pot.y + pot.d + 1.5, 1.8], at: [pot.x + 11, pot.y + 4, 1.0] },
  };
  return { boxes, grounds, views, slots, frame: { w: W, d: D }, stats: { culture, slots: slots.length, assets: [...new Set(slots.map((q) => q.asset))] } };
}

/** The shared last steps of a works plan: build every slot from the kit, then lay the ground round the water. */
function finishWorks({ seed, culture, K, P, kit, slots, boxes, grounds, W, D, bankN, cw, waterZ }) {
  for (const [i, slot] of slots.entries()) {
    const A = kit[slot.asset];
    if (!A) throw new Error(`no asset '${slot.asset}' in the ${culture} works kit`);
    const placed = placeAsset(A, slot, { palette: P, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds.map((g) => ({ ...g, layer: g.layer ?? 4 })));
  }
  for (const b of boxes) if (b.skin === undefined) { const skin = skinFor(K, b); if (skin) b.skin = skin; }
  const G0 = canalGround({ W, D, bankN, cw, waterZ, P, holes: slots.filter((q) => kit[q.asset].sunk).map((q) => q.rect) });
  grounds.push(...G0.grounds); boxes.push(...G0.boxes);
  grounds.unshift(...G0.base);
  grounds.sort((a, b) => (a.layer ?? 4) - (b.layer ?? 4));
}

const UNIT_SCALE = { aerial: 22 };

/** Plan → a CSS 3D scene with an aerial camera and the eye-level views, the asked-for view first. */
export function assembleWorksScene(opts = {}) {
  const plan0 = planWorks(opts);
  // `people` (the World's alone, ./crews.js): the work's people and beasts, the yokes lifted onto the teams' necks
  const folk = opts.world && opts.people ? sceneFolk(plan0, opts.people, 1 / METRES_PER_UNIT, opts.seed ?? 1) : null;
  const plan = folk ? { ...plan0, boxes: folk.boxes } : plan0;
  const view = plan.views[opts.view] ? opts.view : 'aerial';
  const s = 1 / METRES_PER_UNIT, us = UNIT_SCALE[view] || 48;
  const { boxes, faces } = toScene(plan.boxes, s, us);
  // an eye-level camera drops a face that reaches behind it: there the big grounds go out as ~12 m
  // tiles; from the air they stay whole, so no tile joins show
  // (4 m within 30 m of the eye, where a big tile would reach behind it)
  const eye = plan.views[view]?.eye, near = (g) => eye && Math.max(g.x - eye[0], eye[0] - g.x - g.w, 0) ** 2 + Math.max(g.y - eye[1], eye[1] - g.y - g.d, 0) ** 2 < 900;
  const grounds = view === 'aerial' ? plan.grounds : plan.grounds.flatMap((g) => (g.poly ? [g] : tileGround(g, near(g) ? 4 : 12)));
  const G = groundsToScene(grounds, s, us);
  faces.unshift(...G.faces);
  const W = plan.frame.w * s, Dd = plan.frame.d * s;
  const cameras = [{ name: 'aerial', worldFraming: { cameraPosition: [W * 0.5, Dd * 1.2, Math.max(W, Dd) * 0.62], lookAt: [W * 0.5, Dd * 0.42, 0], horizontalFov: 72, pictureCenter: [560, 390] } }];
  for (const [name, v] of Object.entries(plan.views)) cameras.push({ name, worldFraming: { cameraPosition: v.eye.map((q) => q * s), lookAt: v.at.map((q) => q * s), horizontalFov: 74, pictureCenter: [560, 390] } });
  const first = cameras.findIndex((c) => c.name === view);
  if (first > 0) cameras.unshift(...cameras.splice(first, 1));
  if (folk) for (const f of folk.faces) faces.push(f);
  const scene = assembleBoxCityScene({ boxes, grounds: G.grounds, faces, cameras, title: `mojulo historic works · ${plan.stats.culture}`, bg: '#d9cdb4', light: SCENE_LIGHT, unitScale: us });
  return { ...scene, stats: folk ? { ...plan.stats, people: folk.stats } : plan.stats };
}

export function renderWorksToHtml(opts = {}) {
  return emitHistoric(assembleWorksScene(opts));
}
