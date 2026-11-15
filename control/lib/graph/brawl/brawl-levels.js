/**
 * brawl levels — the levels a brawl can be fought down, each turning its own words into a world recipe and its BELT
 * (brawl-belt.js), as the fight's levels give a lane (versus/versus-levels.js). The brawl never knows what the level is;
 * the level never knows the brawl beyond where its belt runs. A new kind of level is a row.
 *
 *   BRAWL_LEVELS[kind] = { reads, words, build(words) → { manifest, belt } }
 *     greybox  a street blocked out in boxes (level/greybox-scene.js), from a preset, its belt the preset's with any of
 *              its words over it (the screens, the angle, where it runs): `street`, a road along building fronts with
 *              doorways, a kerb and a pavement on the far side, lamps and a few things on it (bins, a barrel, a phone
 *              booth, crates), the near side open to the camera, each held screen's line marked across the band, the
 *              street closed at its start and at its end; `yard`, the practice room's (brawl-practice.js): one long open
 *              screen ruled a metre along and every half metre across the band, a back wall and a rack
 *     town     a street of the GEOTOWN (lib/graph/geotown): a block of the town's pattern with its main street along one
 *              side, the belt down it between the cross streets; its fronts the town's own (shops, by its streetscape) on
 *              the far side, the town's bare margin on the camera's; the street's road, walks, lamps and trees the town's
 *     stage    the belt laid in the indoor level's designer (era/stage.js, the stage kind a building level is built in:
 *              rooms on a kit's grid joined by doorways, dressed and lit by the kit): each screen a room in a row along
 *              the belt, its camera side open, the next screen through a doorway as wide as the band (the band runs on
 *              through it), the room as deep as the band and the room the locked angle's view needs in front of it and
 *              behind; on an open-air kit (the plaza) the street one long room, its fronts the far side. Its sizes are the
 *              belt's: the screens' lengths to the kit's grid, the band's depth, the angle the stage opens framed on
 *
 *   BRAWL_PRESETS, brawlPreset(id, beltOver)  → { reads, belt, blocks }
 *   readBrawlLevel(level)                     → { kind, words } (throws naming the fault)
 *   brawlLevel(level, { title?, register?, practice? }) → the world manifest the brawl is fought on: the level's recipe
 *                                               with its `brawl` block (the belt, the register and, on a greybox, its
 *                                               sun; a practice room's words, brawl-practice.js, when it is one, or a
 *                                               STREET's, brawl-street.js: who plays and its waves, fought down)
 *
 * Pure: no clock, no dice.
 */
import { readBelt, beltPoint, beltCamera, beltFloor, beltDrift, viewHalf, BELT_DEPTH } from './brawl-belt.js';
import { readGreybox, GREYBOX_SUN } from '../level/greybox-scene.js';
import { FIGHT_REGISTERS } from '../versus/versus-levels.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { STAGE_KITS } from '../era/stage.js';
import { designGeotown } from '../geotown/design.js';
import { readDress, settingOfKit } from './brawl-dress.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
/** a block in the belt's frame: its centre `s` along it and `n` across it, on `z`; its length along, depth across and
 * height; turned with the belt */
const beltBlock = (B, s, n, z, [w, d, h], tone) => { const [x, y] = beltPoint(B, s, n); return { at: [x, y, r3(z)], size: [r3(w), r3(d), r3(h)], turn: B.heading, tone }; };

/**
 * A BELT THAT RISES OR DRIFTS, blocked out: each block cut along the belt wherever the floor under it changes, a ramp
 * cut into steps a riser high, so the blockout reads as terraces and flights; and wherever the band slides across, cut
 * at the drift's own points and each piece TURNED onto the band's diagonal, so the whole street (its road, its kerbs,
 * its fronts) runs smooth along it. A block on the ground grows down to it (no gap
 * under a raised road); one off the ground (a lintel, a sign) is lifted whole. A flat belt's blocks are as they were.
 */
const RISER = 0.18;
function terraced(B, blocks) {
  if (!B.rise && !B.drift) return blocks;
  const t = (B.heading * Math.PI) / 180, c = Math.cos(t), si = Math.sin(t), out = [];
  // the cuts a line of points asks of a block from s0 to s1: its own points, and (a rise) a stretch that changes cut so
  // each piece rises by no more than a riser
  const cutsOf = (line, step, s0, s1) => {
    const cuts = [], pts = [[-Infinity, line[0][1]], ...line, [Infinity, line[line.length - 1][1]]];
    for (let i = 1; i < pts.length; i++) {
      const [a, va] = pts[i - 1], [e, ve] = pts[i], lo = Math.max(a, s0), hi = Math.min(e, s1);
      if (hi <= lo) continue;
      const n = !step || Math.abs(ve - va) < 1e-9 || !Number.isFinite(a) || !Number.isFinite(e) ? 1 : Math.max(1, Math.ceil((Math.abs(ve - va) * (hi - lo)) / (e - a) / step));
      for (let k = 1; k <= n; k++) cuts.push(lo + ((hi - lo) * k) / n);
    }
    return cuts;
  };
  for (const b of blocks) {
    const dx = b.at[0] - B.at[0], dy = b.at[1] - B.at[1], s = dx * c + dy * si, n = -dx * si + dy * c, [w, d, h] = b.size, s0 = s - w / 2, s1 = s + w / 2;
    // (a drift cuts a block only at its own points: between two of them the band runs straight on its diagonal)
    const cuts = [...new Set([s0, ...(B.rise ? cutsOf(B.rise, RISER, s0, s1) : []), ...(B.drift ? cutsOf(B.drift, 0, s0, s1) : []), s1].map((v) => Math.round(v * 1e4) / 1e4))].sort((p, q) => p - q);
    const grounded = b.at[2] <= 0.2 + 1e-9;
    for (let k = 1; k < cuts.length; k++) {
      const a = cuts[k - 1], e = cuts[k]; if (e - a < 1e-6) continue;
      const m = (a + e) / 2, lift = beltFloor(B, m);
      // ON A DIAGONAL the piece is TURNED onto it, not stepped: laid along the band's own line between the two cuts
      // (its length the diagonal's, its depth narrowed so it is as deep across the belt as it was), and run on a
      // little past each end so two pieces meeting at a bend close the corner between them
      const dn = B.drift ? beltDrift(B, e) - beltDrift(B, a) : 0, th = Math.atan2(dn, e - a), co = Math.cos(th);
      const [x, y] = beltPoint(B, m, n + (B.drift ? (beltDrift(B, a) + beltDrift(B, e)) / 2 : 0));
      const long = Math.abs(th) > 1e-6 ? (e - a) / co + Math.min(d, 6) * Math.abs(Math.tan(th)) * 0.5 : e - a;
      out.push({ ...b, at: [x, y, r3(grounded ? b.at[2] + Math.min(0, lift) : b.at[2] + lift)], size: [r3(long), r3(Math.abs(th) > 1e-6 ? d * co : d), r3(grounded ? h + Math.abs(lift) : h)], ...(Math.abs(th) > 1e-6 ? { turn: r3((b.turn ?? B.heading) + (th * 180) / Math.PI) } : {}) });
    }
  }
  return out;
}

/**
 * THE STREET, across the belt (n, m; the band the bodies walk is the belt's depth): the road from the near kerb to the
 * far one, the far pavement up to the building fronts, the near pavement and nothing tall on the camera's side. The
 * fronts are cut by doorways (an opening and the dark of the room behind it), every so often along the street.
 */
const STREET = Object.freeze({ nearKerb: -2.6, nearEdge: -4.2, farKerb: 1.2, front: 3.6, wall: 0.5, wallH: 7, kerb: 0.14, step: 0.12, run: 6, lamp: 9, door: 7, doorW: 1.6, doorH: 2.6, proud: 0.006 });
// (the things on the pavement against the fronts, past the band, by their place along each screen (a fraction of it) and
// their size: a bin, a phone booth, a barrel, a crate)
const THINGS = Object.freeze([[0.2, [0.7, 0.6, 1.1]], [0.55, [1, 1, 2.3]], [0.8, [0.6, 0.6, 0.9]], [0.9, [0.9, 0.9, 0.8]]]);
function streetBlocks(B) {
  const S = STREET, L = B.length, out = [];
  const mid = (a, b) => (a + b) / 2;
  // the ground under the whole, the road its middle tone
  out.push(beltBlock(B, L / 2, mid(S.nearEdge - 4, S.front + 4), -0.3, [L + 2 * S.run, S.front - S.nearEdge + 8, 0.3], 'floor'));
  // the far pavement, a step up, its kerb the lightest; the near pavement the same, low and open to the camera
  out.push(beltBlock(B, L / 2, mid(S.farKerb, S.front), 0, [L + 2 * S.run, S.front - S.farKerb, S.step], 'prop'));
  out.push(beltBlock(B, L / 2, S.farKerb + S.kerb / 2, 0, [L + 2 * S.run, S.kerb, S.step + S.proud], 'edge'));
  out.push(beltBlock(B, L / 2, mid(S.nearEdge, S.nearKerb), 0, [L + 2 * S.run, S.nearKerb - S.nearEdge, S.step], 'prop'));
  out.push(beltBlock(B, L / 2, S.nearKerb - S.kerb / 2, 0, [L + 2 * S.run, S.kerb, S.step + S.proud], 'edge'));
  // the building fronts, cut by doorways: a front between each pair, the room's dark behind each opening, a lintel over
  const doors = [];
  for (let s = S.door / 2; s < L; s += S.door) doors.push(s);
  let from = -S.run;
  const wallN = S.front + S.wall / 2;
  for (const d of doors) {
    const a = d - S.doorW / 2;
    out.push(beltBlock(B, mid(from, a), wallN, 0, [a - from, S.wall, S.wallH], 'wall'));
    out.push(beltBlock(B, d, wallN, S.doorH, [S.doorW, S.wall, S.wallH - S.doorH], 'wall'));
    out.push(beltBlock(B, d, S.front + S.wall + 0.6, 0, [S.doorW + 0.4, 0.4, S.doorH + 0.2], 'wall'));
    // (its frame, the lightest tone a little proud of the front, so the opening reads against the room's dark)
    for (const k of [-1, 1]) out.push(beltBlock(B, d + k * (S.doorW / 2 + 0.06), S.front - 0.03, S.step, [0.12, 0.12, S.doorH - S.step + 0.12], 'edge'));
    out.push(beltBlock(B, d, S.front - 0.03, S.doorH, [S.doorW + 0.24, 0.12, 0.12], 'edge'));
    from = d + S.doorW / 2;
  }
  out.push(beltBlock(B, mid(from, L + S.run), wallN, 0, [L + S.run - from, S.wall, S.wallH], 'wall'));
  // the lamps along the far pavement, just past the band
  for (let s = S.lamp / 2; s < L; s += S.lamp) out.push(beltBlock(B, s, B.depth[1] + 0.25, S.step, [0.16, 0.16, 4.4], 'edge'));
  // the things on the far pavement, by screen
  for (const sc of B.screens) for (const [f, size] of THINGS) out.push(beltBlock(B, sc.from + f * sc.length, S.front - 0.05 - size[1] / 2, S.step, size, 'prop'));
  // each held screen's line across the band, on the road; the street closed at its start and its end
  for (const sc of B.screens) if (sc.gate && sc.to < L) out.push(beltBlock(B, sc.to, mid(S.nearKerb, S.farKerb), 0, [0.12, S.farKerb - S.nearKerb, S.proud], 'edge'));
  for (const s of [-0.4, L + 0.4]) out.push(beltBlock(B, s, mid(S.nearKerb, S.front), 0, [0.5, S.front - S.nearKerb, 2.6], 'wall'));
  return out;
}

/**
 * THE YARD (the practice room's, brawl-practice.js): one long open screen ruled for a brawler. Along the belt a line a
 * metre (every fifth the lightest); across it the band ruled every half metre, its edges and its middle bold, so how far
 * across a body stands reads off the floor (the line a blow must share); a back wall ruled the same, a low rack along its
 * foot where the street's things are laid, the ends walled, the near side open to the camera.
 */
const YARD = Object.freeze({ back: 1.5, wall: 4, line: 0.03, bold: 0.08, proud: 0.006, rack: [0.9, 0.5] });
function yardBlocks(B) {
  const Y = YARD, L = B.length, [n0, n1] = B.depth, out = [];
  const far = n1 + Y.back, near = n0 - 3;
  out.push(beltBlock(B, L / 2, (near + far) / 2, -0.3, [L + 6, far - near, 0.3], 'floor'));
  // along: a line a metre across the band, every fifth the lightest
  for (let s = 1; s < L; s++) out.push(beltBlock(B, s, (n0 + n1) / 2, 0, [s % 5 ? Y.line : Y.bold, n1 - n0, Y.proud], s % 5 ? 'prop' : 'edge'));
  // across: the band ruled every half metre, its edges and its middle bold
  for (let k = 0; k <= Math.round((n1 - n0) * 2); k++) {
    const n = n0 + k / 2, bold = k === 0 || Math.abs(n - n1) < 1e-6 || Math.abs(n - (n0 + n1) / 2) < 1e-6;
    out.push(beltBlock(B, L / 2, n, 0, [L, bold ? Y.bold : Y.line, Y.proud * (bold ? 2 : 1)], bold ? 'edge' : 'prop'));
  }
  // the back wall, ruled a metre along; the rack at its foot
  out.push(beltBlock(B, L / 2, far + 0.2, 0, [L + 6, 0.4, Y.wall], 'wall'));
  for (let s = 1; s < L; s++) out.push(beltBlock(B, s, far - Y.proud / 2, 0, [s % 5 ? Y.line : Y.bold, Y.proud, Y.wall], s % 5 ? 'prop' : 'edge'));
  out.push(beltBlock(B, L / 2, far - Y.rack[1] / 2, 0, [L - 2, Y.rack[1], Y.rack[0]], 'prop'));
  for (const s of [-0.4, L + 0.4]) out.push(beltBlock(B, s, (n0 + far) / 2, 0, [0.5, far - n0, 2.6], 'wall'));
  return out;
}

/** THE PRESETS: each a belt and the blocks laid along it (in its frame, so a belt that runs elsewhere carries its street) */
// (`room`: the most of the street across the belt its band may take, from the near kerb to just short of what stands on
// the far pavement)
const preset = (reads, belt, room, blocks) => Object.freeze({ reads, belt: Object.freeze(belt), room: Object.freeze(room), blocks });
export const BRAWL_PRESETS = Object.freeze({
  street: preset('a road along building fronts with doorways, a far pavement with lamps and things on it, the near side open to the camera; two held screens and the boss\'s', {
    at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic',
    screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, gate: true }, { length: 16, boss: true }],
  }, [STREET.nearKerb, 2.5], streetBlocks),
  yard: preset('the practice yard: one long open screen, the floor ruled a metre along and every half metre across the band (its edges and middle bold), a back wall ruled the same and a rack at its foot', {
    at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: [{ length: 24 }],
  }, [-4, 4], yardBlocks),
});
export const BRAWL_PRESET_IDS = Object.freeze(Object.keys(BRAWL_PRESETS));

/** A preset's belt (its words with `beltOver` over them) and its blocks laid along it. */
export function brawlPreset(id, beltOver = {}) {
  const P = BRAWL_PRESETS[id];
  if (!P) throw new Error(`brawl: a greybox street's preset is one of ${BRAWL_PRESET_IDS.join(', ')}`);
  if (!isObj(beltOver)) throw new Error('brawl: a level\'s belt is { at?, heading?, floor?, depth?, screens?, angle?, rise?, turn?, drift? } over its preset\'s');
  const belt = readBelt({ ...P.belt, ...beltOver }, 'level.belt');
  if (belt.depth[0] < P.room[0] || belt.depth[1] > P.room[1]) throw new Error(`brawl: the ${id} street's band lies within [${P.room.join(', ')}] across its belt (the kerb to what stands on the pavement)`);
  return { reads: P.reads, belt, blocks: terraced(belt, P.blocks(belt)) };
}

/**
 * THE STAGE: the belt in the indoor designer's rooms. Across the belt (y, m, the camera side y 0): the room's front
 * strip `front` before the band (the locked angles' views reach the floor there, the lowest the nearest), the band, the
 * same behind it (so the doorway, centred on the shared wall, takes the whole band), the far wall. The rooms' height a
 * kit's hall's. The kits the fight's arena stands on, a sunlit one with its look.
 */
const STAGE = Object.freeze({ front: 2.5, height: 7, door: 1 });
const STAGE_LOOK = { 'island-plaza': 'island-noon' };
// (a kit whose dressing stands on the floor, the plaza's fountain, the lab's benches and its tank, is dressed only when
// asked: the band is a fighting floor)
const STAGE_CENTRE_PIECE = new Set(['island-plaza', 'research-lab']);
// (the fight's arena kits, and the contemporary bays: a military base's, a utility's, a science building's, an everyday
// building's: era/stage.js)
export const BRAWL_STAGE_KITS = Object.freeze([...ARENA_KITS, 'bay-military', 'bay-utility', 'bay-science', 'bay-everyday']);
const STAGE_SCREENS = Object.freeze([{ length: 14 }, { length: 16, gate: true }, { length: 16, gate: true }, { length: 16, boss: true }]);

/** The stage a belt is laid in: { manifest (a `kind: 'stage'` recipe), belt }. */
function brawlStage(words) {
  const kit = words.kit ?? 'gothic-stone';
  if (!BRAWL_STAGE_KITS.includes(kit)) throw new Error(`brawl: a stage street's kit is one of ${BRAWL_STAGE_KITS.join(', ')}`);
  const K = STAGE_KITS[kit], g = K.grid ?? 1, open = K.shell === 'plaza';
  const height = words.height ?? STAGE.height;
  if (!(typeof height === 'number' && height >= 4 && height <= 16)) throw new Error('brawl: a stage street is 4 to 16 m high');
  // (the screens on the kit's grid: each length to the nearest whole cell)
  const screens = (words.screens ?? STAGE_SCREENS).map((sc) => (isObj(sc) && typeof sc.length === 'number' ? { ...sc, length: Math.max(g, Math.round(sc.length / g) * g) } : sc));
  const depth = words.depth ?? BELT_DEPTH, front = STAGE.front;
  const band = Array.isArray(depth) && depth.length === 2 ? depth[1] - depth[0] : NaN;
  // (the room's depth on the grid, the band centred in it)
  const D = Math.ceil((band + 2 * front) / g) * g;
  // (a kit dressed as a place of its own is framed as the street is: the band low, its backdrop over it)
  const dressedKit = words.dress !== false && (isObj(words.dress) || !!settingOfKit(kit));
  const belt = readBelt({ at: [0, r3(D / 2 - (depth[0] + depth[1]) / 2)], heading: 0, floor: 0, depth, screens, angle: words.angle ?? (dressedKit ? 'street' : 'classic'), ...(words.turn ? { turn: words.turn } : {}), ...(words.rise ? { rise: words.rise } : {}), ...(words.drift ? { drift: words.drift } : {}) }, 'level');
  const rooms = open
    ? [{ id: 'street', x: 0, y: 0, w: belt.length, d: D, h: height, open: ['-y'] }]
    : belt.screens.map((sc, i) => ({ id: `screen-${i + 1}`, x: sc.from, y: 0, w: sc.length, d: D, h: height, open: ['-y'] }));
  const links = open ? [] : rooms.slice(1).map((r, i) => ({ from: rooms[i].id, to: r.id, width: Math.min(D - 2 * (K.door?.frame ?? 0.3) - (K.wall ?? 0.5) - 0.01, r3(band + STAGE.door)), height: height - 1 }));
  const look = words.look ?? STAGE_LOOK[kit];
  // ITS DRESS (brawl-dress.js): `dress` true | false is the kit's own dressing (as before); an object is the belt's:
  // { setting?, sets?, colour?, seed?, kit?: the kit's own dressing too }. Unsaid, a kit with a setting of its own (a
  // military bay a base, a utility's a facility, an everyday building's an office) is dressed as it; the far strip is
  // the floor between the band and the room's far wall, a front a screen (its doorways' walls kept clear)
  const own = isObj(words.dress) ? words.dress : null, settingId = own?.setting ?? settingOfKit(kit);
  if (own) for (const k of Object.keys(own)) if (!['setting', 'sets', 'colour', 'seed', 'kit'].includes(k)) throw new Error(`brawl: a stage street's dress.${k} is not its word (setting, sets, colour, seed, kit)`);
  const kitDress = own ? own.kit ?? !STAGE_CENTRE_PIECE.has(kit) : words.dress ?? !STAGE_CENTRE_PIECE.has(kit);
  const wallN = r3(D - belt.at[1] - 0.12), far = [r3(belt.depth[1] + 0.25), r3(wallN - 0.05)];
  const { kit: _k, ...laid } = own ?? {};
  const dress = words.dress === false || (!own && !settingId) || far[1] - far[0] < 0.6 ? null
    : readDress({ ...(settingId ? { setting: settingId } : {}), ...laid, far, wall: wallN, ...(open ? {} : { fronts: belt.screens.map((sc) => ({ from: r3(sc.from + 0.5), to: r3(sc.to - 0.5), wall: wallN })) }), ...(belt.drift ? { follows: true } : {}) }, belt, 'level.dress');
  return {
    manifest: {
      kind: 'stage', kit, ...(look ? { reference: look } : {}), ...(words.title ? { title: words.title } : {}),
      ...(kitDress ? {} : { dress: false }),
      viewBox: { width: 1280, height: 720 }, rooms, ...(links.length ? { links } : {}), lights: 'auto',
      camera: { name: 'brawl', worldFraming: { ...beltCamera(belt, viewHalf(belt)), pictureCenter: [640, 360] } },
    },
    belt, ...(dress ? { dress } : {}),
  };
}

// THE TOWN'S STREET (the geotown, lib/graph/geotown): a block segment of the town's pattern laid with its MAIN STREET
// along the block's south side, the belt down that street between its two cross streets. The shops stand on the far
// side (north, the block's fronts); the near side is the town's bare margin, open to the camera. The street is the
// town's own: its road, kerbs, verges and walks, its lamps and trees, its fronts by its streetscape.
const TOWN = Object.freeze({ cube: 'valley-morning', pattern: 'old-town', streetscape: 'old-centre', seed: 3, clear: 2, depth: [-2.6, 3.4], angle: 'street', fronts: 'rough', steepest: 0.1 });
function brawlTown(words) {
  const seed = words.seed ?? TOWN.seed;
  if (!Number.isInteger(seed)) throw new Error('brawl: a town street\'s seed is a whole number');
  // IT CLIMBS (`climb`, rise over run; less than 0 it falls the way it is walked): the town's own slope, its main
  // street on a profile and its buildings stepping up beside it (geotown/read.js `slope.streets`)
  const climb = words.climb ?? 0;
  if (!(typeof climb === 'number' && Math.abs(climb) <= TOWN.steepest)) throw new Error(`brawl: a town street's climb is its grade, rise over run, −${TOWN.steepest} to ${TOWN.steepest}`);
  const flat = { pattern: words.pattern ?? TOWN.pattern, streetscape: words.streetscape ?? TOWN.streetscape, segment: 'main-street', hills: false, fronts: words.fronts ?? TOWN.fronts };
  const main0 = designGeotown(flat, { seed }).streets.find((s) => s.rank === 'main' && s.axis === 'x');
  const geotown = climb && main0 ? { ...flat, slope: { streets: { [main0.id]: climb } } } : flat;
  const D = designGeotown(geotown, { seed });
  const main = D.streets.find((s) => s.rank === 'main' && s.axis === 'x');
  if (!main) throw new Error('brawl: the town\'s segment has no main street to fight down');
  const cross = D.streets.filter((s) => s.axis === 'y').map((s, k) => ({ at: s.at, half: D.sections.x[k].half })).sort((a, b) => a.at - b.at);
  const x0 = r3(cross[0].at + cross[0].half + TOWN.clear), x1 = r3(cross[cross.length - 1].at - cross[cross.length - 1].half - TOWN.clear);
  const screens = words.screens ?? STAGE_SCREENS;
  const flatBelt = readBelt({ at: [x0, r3(main.at)], heading: 0, floor: r3(D.land.S(x0, main.at)), depth: words.depth ?? TOWN.depth, screens, angle: words.angle ?? TOWN.angle }, 'level');
  // (its rise read off the town's own ground along the street, a point every two metres)
  const rise = climb ? Array.from({ length: Math.floor(flatBelt.length / 2) + 1 }, (_, i) => { const sv = Math.min(flatBelt.length, i * 2); return [r3(sv), r3(D.land.S(x0 + sv, main.at) - flatBelt.floor)]; }).filter((p, i, a) => !i || p[0] > a[i - 1][0]) : null;
  const belt = rise || words.turn || words.drift ? readBelt({ at: flatBelt.at, heading: 0, floor: flatBelt.floor, depth: flatBelt.depth, screens, angle: flatBelt.angle, ...(rise ? { rise } : {}), ...(words.turn ? { turn: words.turn } : {}), ...(words.drift ? { drift: words.drift } : {}) }, 'level') : flatBelt;
  // (a place that already stands, on a band that DRIFTS, is sheared across by it where its page is made, brawl-warp.js:
  // it runs on the band's diagonal, and its dress follows its ground)
  if (belt.length > x1 - x0 + 1e-6) throw new Error(`brawl: the town's block holds a street of ${Math.floor(x1 - x0)} m between its cross streets (the screens run ${r3(belt.length)} m): fewer or shorter screens`);
  // ITS DRESS (brawl-dress.js): on the far walk between the band and the fronts, and on the fronts themselves; a set
  // a screen. `dress: false` leaves the street the town's own
  const Sy = D.sections.y.find((q) => q.rank === 'main') ?? D.sections.y[0], wall = r3(Sy.half);
  if (words.dress !== undefined && words.dress !== false && !isObj(words.dress)) throw new Error('brawl: a town street\'s dress is false (the town\'s own street) or { sets?, colour?, seed? }');
  if (isObj(words.dress)) for (const k of Object.keys(words.dress)) if (!['sets', 'colour', 'seed', 'setting'].includes(k)) throw new Error(`brawl: a town street's dress.${k} is not its word (setting, sets, colour, seed)`);
  // (no near dress: the street's angle frames the band at the frame's foot, the near walk under it)
  const far = [r3(belt.depth[1] + 0.25), r3(wall - 0.05)];
  // (the shops' own lines along the belt, so a mark stands on its building and an alley is dressed as one)
  const fronts = D.plots.filter((pl) => pl.kind === 'shops' && pl.side === 's' && pl.built !== false).map((pl) => ({ from: r3(pl.A[0] + pl.house.env[0] - x0), to: r3(pl.A[0] + pl.house.env[2] - x0), wall: r3(wall + pl.house.env[1]) })).filter((f) => f.to > 0 && f.from < belt.length);
  const dress = words.dress === false || far[1] - far[0] < 0.6 ? null : readDress({ seed, ...(words.dress ?? {}), far, wall, ...(fronts.length ? { fronts } : {}), ...(belt.drift ? { follows: true } : {}) }, belt, 'level.dress');
  return {
    manifest: { kind: 'geocube', cube: words.cube ?? TOWN.cube, show: 'geotown', seed, ...(words.title ? { title: words.title } : {}), geotown },
    belt, ...(dress ? { dress } : {}),
  };
}

export const BRAWL_LEVELS = Object.freeze({
  greybox: Object.freeze({
    reads: `a street blocked out in boxes, from a preset (${BRAWL_PRESET_IDS.join(', ')}), its belt's words over the preset's`,
    words: ['preset', 'belt', 'title'],
    build(words) {
      if (words.preset === undefined) throw new Error(`brawl: a greybox level names a preset (${BRAWL_PRESET_IDS.join(', ')})`);
      const P = brawlPreset(words.preset, words.belt);
      return { manifest: { kind: 'greybox', ...(words.title ? { title: words.title } : {}), blocks: readGreybox({ blocks: P.blocks }).blocks }, belt: P.belt };
    },
  }),
  stage: Object.freeze({
    reads: `the belt laid in the indoor level's rooms (a kit: ${BRAWL_STAGE_KITS.join(', ')}), a room a screen through doorways as wide as the band, its camera side open; the plaza one long street`,
    words: ['kit', 'look', 'height', 'screens', 'depth', 'angle', 'dress', 'turn', 'rise', 'drift', 'title'],
    build: brawlStage,
  }),
  town: Object.freeze({
    reads: 'a street of the geotown: a block of the town\'s pattern, the belt down its main street between its cross streets, the shops on the far side, the town\'s margin open to the camera',
    words: ['pattern', 'streetscape', 'cube', 'seed', 'screens', 'depth', 'angle', 'dress', 'fronts', 'climb', 'turn', 'drift', 'title'],
    build: brawlTown,
  }),
});
export const BRAWL_LEVEL_KINDS = Object.freeze(Object.keys(BRAWL_LEVELS));

/** Read a brawl level: `{ kind, …its words }` (throws naming the fault; its values are built, which is cheap). */
export function readBrawlLevel(level, where = 'level') {
  if (!isObj(level)) throw new Error(`brawl: ${where} is { kind: ${BRAWL_LEVEL_KINDS.join(' | ')}, …its words }`);
  const { kind, ...words } = level;
  const row = BRAWL_LEVELS[kind];
  if (!row) throw new Error(`brawl: ${where}.kind is one of ${BRAWL_LEVEL_KINDS.join(', ')}`);
  for (const k of Object.keys(words)) if (!row.words.includes(k)) throw new Error(`brawl: ${where}.${k} is not a ${kind} level's word (${row.words.join(', ')})`);
  row.build(words);
  return { kind, words };
}

/** The world manifest a brawl is fought on: the level's recipe with its `brawl` block (the belt; the game's register and,
 * on a greybox, the sun the bodies are lit by, as a fight's; `armed`, the ARMED brawler: every hero carries its own
 * weapon the whole game, brawl-page.js). */
export function brawlLevel(level, { title, register, practice, street, armed } = {}) {
  if (armed !== undefined && typeof armed !== 'boolean') throw new Error('brawl: a brawl\'s armed is true (every hero its own weapon) or false');
  const { kind, words } = readBrawlLevel(level);
  if (register !== undefined && !FIGHT_REGISTERS.includes(register)) throw new Error(`brawl: a brawl's register is ${FIGHT_REGISTERS.join(' | ')}`);
  if (practice !== undefined && !isObj(practice)) throw new Error('brawl: a level\'s practice is { players?, dummies?, things?, health? } (brawl-practice.js)');
  if (street !== undefined && !isObj(street)) throw new Error('brawl: a level\'s street is { players?, roster?, waves, things? } (brawl-street.js)');
  if (street && practice) throw new Error('brawl: a level is a practice yard or a street fought down, not both');
  const { manifest, belt, dress } = BRAWL_LEVELS[kind].build({ ...words, ...(title && !words.title ? { title } : {}) });
  return { ...manifest, brawl: { belt, ...(dress ? { dress } : {}), ...(armed ? { armed: true } : {}), ...(register ? { register, ...(manifest.kind === 'greybox' ? { sun: [...GREYBOX_SUN] } : {}) } : {}), ...(practice ? { practice } : {}), ...(street ? { street } : {}) } };
}
