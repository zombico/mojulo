/**
 * THE SIDE MAP'S DRESS (docs/side-map-principles.md "The look", "The closed parts are painted"): the design that makes a
 * side map look good, dealt over its layout (layout.js) as data the build paints from and the laws read. It places
 * nothing: what is where is the layout's; what each thing looks like is the dress's.
 *
 *   a place a zone      each zone a PLACE (its own word, else one dealt from the premise's SETTING by the zone's role),
 *                       each place a material FAMILY (fills.js) and its own key colour, the places' order the story
 *   solid over void     the closed parts lighter and more saturated than the dark, cool open space behind the play,
 *                       every standable top a lit edge lighter still (`edge`)
 *   play against place  what the hero stands on, fights, climbs and takes on one side of the colour wheel, the place on
 *                       the other; the setting picks which way round, or a cube given (reality's) its stone's hue the place's
 *   the boss's colour   reserved: none before the zones that lead to its room, growing toward it, its room's back wall
 *   rhythm              a run's back wall in BAYS a screen and a quarter wide, A (lit, a lamp, its things) and B (a recess)
 *                       by the walls' rule (era/wall-rhythm.js), a pillar between bays and a seam down each, so one
 *                       is always in the frame; a hatch at each spawner
 *   the next place      the last half screen of a zone carries the next zone's family and key at its edge (`peek`)
 *   threads             the setting's pipes, cables, roots or channel carried through the closed parts zone to zone
 *   light               a lamp an A bay; every up run's top open to the next zone's light; a shaft's back wall drawing
 *                       its way (railings that climb, stripes down a chute)
 *   foreshadowing       what the stage is about shown small early, larger at a landing or a reveal, whole in the boss's room
 *   the backdrop        an outdoor zone's by its height on the map (land at the foot, hills, sky and a low horizon at top)
 *   the vista           what the camera sees behind a zone (vista.js): its place's, or the zone's own word; a wall its absence
 *   wear                one dial a place
 *
 *   SETTINGS            the settings a premise names (a row each: its words, its places by role, its threads, its subject,
 *                       its orientation); a new setting is a row
 *   settingOf(premise)  → the setting a premise's words name (the plant unsaid)
 *   dressSideMap(layout, map, { seed?, cube? }) → { setting, palette: { play, place, boss, void }, zones: [{ zone, place,
 *                       family, material (cake.js), indoor, key, edge, void, boss, bays, pillars, seams, lamps, hatches, mark, peek, light, foreshadow,
 *                       backdrop, vista?, wear }], threads: [{ kind, from, to }] }
 *
 * Pure and deterministic: seeded dice (city/plan/dice.js streamOf), never Math.random.
 */
import { readSideMap } from './zones.js';
import { wallRhythm } from '../../era/wall-rhythm.js';
import { streamOf } from '../../city/plan/dice.js';
import { bayGrid } from './path.js';
import { materialOf } from './cake.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// (a place: its name, its fill's family, whether it is inside, and its VISTA, what the camera sees behind it: vista.js, a
// vista from the library or 'wall', the plain back wall; unsaid, a wall inside and the cube's sky and hills outside; and
// its TONE, [hue° off the place's, saturation, lightness]: a place its own colour, so a stage is not one hue all through
// (docs/side-scroll-backgrounds.md); its hue kept within PLACE_SWING of the place's, so play and the boss stay apart)
const P = (name, family, indoor = true, vista = null, tone = null) => Object.freeze({ name, family, indoor, ...(vista ? { vista } : {}), ...(tone ? { tone: Object.freeze(tone) } : {}) });
/** how far a place's tone may swing its hue off the setting's place hue: toward play no nearer than 120° (laws
 * play-against-place), toward the boss no nearer than 30° (boss-colour) */
export const PLACE_SWING = Object.freeze([-30, 56]);
/** The settings: the places a stage of each is made of, by the zone's role (across, up, down, room). */
export const SETTINGS = Object.freeze({
  plant: Object.freeze({ words: ['plant', 'factory', 'foundry', 'works', 'mill', 'refinery', 'reactor'], threads: 'pipes', subject: 'the machine it makes',
    play: 'warm', places: { across: [P('the gate tunnel', 'rock', true, 'wall', [-22, 0.3, 0.44]), P('the factory floor', 'machine', true, 'hall', [8, 0.5, 0.56]), P('the loading dock', 'built', true, 'yard', [-28, 0.48, 0.5]), P('the assembly line', 'machine', true, 'hall', [50, 0.46, 0.55]), P('the reactor gallery', 'machine', true, 'reactor', [30, 0.55, 0.6]), P('the sky bridge', 'machine', true, 'future', [-12, 0.6, 0.62])],
      up: [P('the freight shaft', 'padded', true, null, [20, 0.4, 0.52]), P('the service chimney', 'machine', true, 'hall', [-16, 0.45, 0.5])], down: [P('the stairwell', 'built', true, null, [40, 0.38, 0.5]), P('the drop chute', 'machine', true, null, [-26, 0.5, 0.46])], room: [P('the core', 'machine', true, 'reactor', [54, 0.5, 0.5])] } }),
  mountain: Object.freeze({ words: ['mountain', 'volcano', 'cliff', 'peak', 'canyon', 'cave', 'crag'], threads: 'roots', subject: 'what sleeps in the mountain',
    play: 'cool', places: { across: [P('the cliff path', 'rock', false, 'peaks', [0, 0.4, 0.55]), P('the caldera rim', 'rock', false, 'peaks', [-24, 0.55, 0.5]), P('the plateau', 'rock', false, 'peaks', [30, 0.35, 0.62]), P('the works in the rock', 'machine', true, 'hall', [50, 0.45, 0.5])],
      up: [P('the chimney', 'rock', true, null, [-12, 0.35, 0.48]), P('the crevice', 'rock', true, null, [18, 0.3, 0.45])], down: [P('the scree', 'rock', false, 'peaks', [10, 0.35, 0.6]), P('the lava tube', 'rock', true, null, [-28, 0.6, 0.45])], room: [P('the summit chamber', 'built', true, null, [40, 0.5, 0.55])] } }),
  temple: Object.freeze({ words: ['temple', 'ruin', 'shrine', 'tomb', 'pyramid', 'sanctum'], threads: 'channels', subject: 'the idol it keeps',
    play: 'cool', places: { across: [P('the causeway', 'built', false, 'colonnade', [0, 0.45, 0.6]), P('the hall of pillars', 'built', true, 'colonnade', [-22, 0.5, 0.52]), P('the flooded gallery', 'built', true, 'greenhouse', [40, 0.45, 0.55])],
      up: [P('the bell shaft', 'built', true, null, [20, 0.4, 0.5])], down: [P('the stairs down', 'built', true, null, [-14, 0.4, 0.5])], room: [P('the inner sanctum', 'built', true, null, [52, 0.55, 0.5])] } }),
  // (seeded from the starters' rows, docs/backdrop-variations.md: a city by night of neon and towers, and a station in
  // orbit over its planet; their places dealt by role like any setting's, each in its own tone)
  city: Object.freeze({ words: ['city', 'downtown', 'metro', 'highway', 'skyline', 'neon', 'rooftop'], threads: 'cables', subject: 'the tower at its heart',
    play: 'cool', places: { across: [P('the rooftops', 'machine', true, 'future', [0, 0.55, 0.58]), P('the neon market', 'built', true, 'market', [44, 0.5, 0.55]), P('the metro', 'machine', true, 'hall', [-24, 0.45, 0.48]), P('the highway', 'built', true, 'skyline', [20, 0.5, 0.6]), P('the plaza', 'built', true, 'future', [-10, 0.55, 0.62])],
      up: [P('the elevator', 'machine', true, null, [30, 0.4, 0.5])], down: [P('the fire stairs', 'built', true, null, [-20, 0.4, 0.48]), P('the garbage chute', 'machine', true, null, [50, 0.45, 0.45])], room: [P('the penthouse', 'machine', true, 'market', [54, 0.5, 0.52])] } }),
  orbital: Object.freeze({ words: ['orbital', 'orbit', 'spaceport', 'colony', 'satellite', 'space'], threads: 'cables', subject: 'the engine that keeps it aloft',
    play: 'warm', places: { across: [P('the docking ring', 'machine', true, 'orbit', [-20, 0.5, 0.55]), P('the hydroponics bay', 'padded', true, 'greenhouse', [40, 0.45, 0.55]), P('the market deck', 'built', true, 'market', [10, 0.55, 0.6]), P('the observation deck', 'machine', true, 'orbit', [-28, 0.4, 0.62]), P('the reactor ring', 'machine', true, 'reactor', [52, 0.5, 0.52])],
      up: [P('the spoke lift', 'machine', true, null, [20, 0.4, 0.5])], down: [P('the airlock drop', 'machine', true, null, [-15, 0.5, 0.46])], room: [P('the bridge', 'machine', true, 'orbit', [50, 0.5, 0.5])] } }),
  base: Object.freeze({ words: ['base', 'fortress', 'bunker', 'station', 'hangar', 'barracks'], threads: 'cables', subject: 'the weapon it guards',
    play: 'warm', places: { across: [P('the gate', 'built', false, 'skyline', [0, 0.45, 0.55]), P('the barracks', 'built', true, null, [-20, 0.4, 0.5]), P('the hangar', 'machine', true, 'hall', [36, 0.5, 0.55])],
      up: [P('the lift shaft', 'machine', true, null, [14, 0.4, 0.5])], down: [P('the drop shaft', 'machine', true, null, [-24, 0.5, 0.46])], room: [P('the command centre', 'machine', true, 'future', [50, 0.5, 0.52])] } }),
});
/** The setting a premise's words name; the plant when they name none. */
export function settingOf(premise = '') {
  const t = String(premise).toLowerCase();
  return Object.keys(SETTINGS).find((k) => SETTINGS[k].words.some((w) => new RegExp(`\\b${w}`).test(t))) ?? 'plant';
}

// the colour wheel: play and place a half turn apart, the boss's a third of the way round from both
const HUE = { warm: 30, cool: 205 }, BOSS_OFF = 115, SPREAD = [0, 26, -22, 14, -12, 8];
const hueOf = (h) => {
  const n = parseInt(h.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255), M = Math.max(r, g, b), d = M - Math.min(r, g, b);
  return d ? Math.round(((M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360) : 0;
};
const hex = (h, s, l) => {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** The dress over a laid map: what each zone looks like. `map` the zone chain as written (its premise and its words). */
export function dressSideMap(layout, map, { seed = 1, cube } = {}) {
  const M = readSideMap(map), key = settingOf(M.premise), S = SETTINGS[key], W = layout.screen.width, H = layout.screen.height;
  const dice = (k) => streamOf(seed, 'side-map-dress', k);
  // (a cube given, reality's: the place takes the hue of the cube's stone, and play the other side of the wheel)
  const placeHue = cube?.colour?.stone ? hueOf(cube.colour.stone) : (HUE[S.play] + 180) % 360, playHue = (placeHue + 180) % 360, bossHue = (playHue + BOSS_OFF) % 360;
  const palette = { play: hex(playHue, 0.78, 0.55), place: hex(placeHue, 0.42, 0.55), boss: hex(bossHue, 0.6, 0.5), void: hex(placeHue, 0.28, 0.1) };
  const roleOf = (Z) => (Z.kind === 'room' ? 'room' : Z.run), seen = { across: 0, up: 0, room: 0 };
  // the zones that lead to the boss's room take its colour, growing toward it
  const bossAt = M.zones.findIndex((Z) => Z.kind === 'room' && Z.teach === 'boss');
  const zs = layout.zones.map((LZ) => LZ.rect[3]), lo = Math.min(...layout.zones.map((LZ) => LZ.rect[2])), hi = Math.max(...zs);
  const zones = M.zones.map((Z, i) => {
    const role = roleOf(Z), list = S.places[role], d = dice(`zone-${i}`);
    // (a down run's places are a cascade's, then a chute's: the drop says which)
    const dealt = role === 'down' ? list[Z.drop === 'chute' ? list.length - 1 : 0] : list[seen[role]++ % list.length];
    const place = Z.place ?? dealt.name, family = Z.fill ?? M.fill ?? dealt.family, indoor = Z.place ? true : dealt.indoor;
    // (its vista: the zone's own word, else its place's; a place the map names itself is inside, a wall behind it)
    const vista = Z.vista ?? (Z.place ? null : dealt.vista ?? null);
    const tn = Z.place ? null : dealt.tone, swing = tn ? Math.max(PLACE_SWING[0], Math.min(PLACE_SWING[1], tn[0])) : null;
    const h = (placeHue + (tn ? swing : SPREAD[i % SPREAD.length]) + (d() - 0.5) * 6 + 360) % 360, sat = tn ? tn[1] : 0.45, light = tn ? tn[2] : 0.58;
    const boss = bossAt < 0 ? 0 : i === bossAt ? 1 : i > bossAt - 3 && i < bossAt ? r3((3 - (bossAt - i)) / 3) : 0;
    const LZ = layout.zones[i], [s0, s1, z0, z1] = LZ.rect, out = { zone: i, place, family, indoor, key: hex(h, sat, light), edge: hex(h, sat * 0.9, Math.min(0.9, light + 0.2)), void: hex(h, 0.28, 0.1), boss, wear: r3(0.2 + 0.5 * d()), ...(vista && vista !== 'wall' ? { vista } : {}) };
    if (role === 'across') {
      // the back wall in bays, a screen and a quarter each, by the walls' rule; a pillar between, a lamp an A bay
      // (the bay grid the path's steps stand on too, path.js bayGrid: the floor keeps the walls' rhythm)
      const { n, width: bw } = bayGrid(s1 - s0, W), order = wallRhythm(n, { pick: d() }) ?? 'A';
      out.bays = [...order];
      out.pillars = Array.from({ length: n - 1 }, (_, k) => r3(s0 + (k + 1) * bw));
      // (a seam down each bay's middle, so a pillar or a seam is always in the frame; an A bay's lamp hangs on it)
      out.seams = out.bays.map((b, k) => r3(s0 + (k + 0.5) * bw));
      out.lamps = out.seams.filter((x, k) => out.bays[k] === 'A');
      out.hatches = layout.spawners.filter((sp) => sp.zone === i).map((sp) => sp.at);
    }
    if (role === 'up') { out.mark = { kind: 'climbs', says: 'the back wall\'s railings step up the shaft: the way is up' }; out.light = { at: 'top', says: 'the shaft\'s top open to the next zone\'s light' }; }
    if (role === 'down') out.mark = Z.drop === 'chute' ? { kind: 'stripes', says: 'hazard stripes down the chute: it is a fall, one way' } : { kind: 'steps', says: 'each step\'s nose lit: the way is down' };
    if (role === 'room' && boss) out.mark = { kind: 'emblem', says: 'the boss\'s mark across the back wall, in its colour' };
    // an outdoor zone's backdrop by its height on the map; inside, none
    if (!indoor) { const u = hi > lo ? ((z0 + z1) / 2 - lo) / (hi - lo) : 0; out.backdrop = u < 1 / 3 ? 'land' : u < 2 / 3 ? 'hills' : 'sky'; }
    // the cake its slices are made of (cake.js): the world's, by the fill, the setting, the height and the cube's climate
    out.material = materialOf(family, { setting: key, indoor, backdrop: out.backdrop ?? null, cold: cube?.snow !== undefined && cube?.snow !== false });
    return out;
  });
  // the next place peeks in: the last half screen of a zone, at its edge, in the next zone's family and key
  zones.forEach((z, i) => {
    const N = zones[i + 1];
    if (!N) return;
    const LZ = layout.zones[i], [s0, s1, z0, z1] = LZ.rect, along = LZ.lock !== 's';
    z.peek = { family: N.family, key: N.key, at: along ? { s0: r3(s1 - W / 2), s1: r3(s1) } : layout.zones[i + 1].rect[2] >= z0 ? { z0: r3(z1 - H / 2), z1: r3(z1) } : { z0: r3(z0), z1: r3(z0 + H / 2) } };
  });
  // what the stage is about: small early, larger at a reveal or a landing, whole in the boss's room
  const early = zones.find((z) => z.indoor && M.zones[z.zone].run === 'across'), mid = zones.find((z) => z.zone > (early?.zone ?? -1) && (M.zones[z.zone].reveal || M.zones[z.zone].beat === 'landing' || M.zones[z.zone].beat === 'reveal'));
  if (early) early.foreshadow = { subject: S.subject, scale: 'small', says: 'behind glass in the back wall' };
  if (mid) mid.foreshadow = { subject: S.subject, scale: 'large', says: 'shown at its size' };
  if (bossAt >= 0) zones[bossAt].foreshadow = { subject: S.subject, scale: 'whole', says: 'the boss\'s room is where it is' };
  // the setting's thread carried through the closed parts from each zone into the next
  const threads = zones.slice(1).map((z) => ({ kind: S.threads, from: z.zone - 1, to: z.zone }));
  return { setting: key, palette, zones, threads };
}
