/**
 * THE STADIUM'S WORDS — the presets (the Mojulo Olympics' venues), the liveries, the surfaces, and `readStadium`, which
 * lays a preset's words under the given ones and checks them, refusing teaching. No geometry: an arena reads its venue
 * through this alone (stadium/venue.js); the venue's parts are stadium.js's.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => { throw new Error(`stadium: ${m}`); };
const HEX = /^#[0-9a-f]{6}$/i;

/** The surfaces: a kit material (tiled in the kit's terms) or a flat colour of the sport's own. */
export const STADIUM_SURFACES = Object.freeze({
  grass: { material: 'grass' }, clay: { colour: '#c2643c' }, sand: { material: 'gravel' },   // (clay the courts' terracotta)
  hard: { colour: '#3d6fa6' }, track: { colour: '#b4553c' }, ice: { colour: '#e6eef3' }, wood: { colour: '#c69c64' }, holo: { colour: '#16233a' },
});
export const STADIUM_LOOKS = Object.freeze({ shaded: 'shaded', anime: 'banded', voxel: 'voxel' });
export const STADIUM_TIMES = Object.freeze(['day', 'golden', 'dusk', 'night']);
/** The palettes a stadium's land may be painted in: a kit's ramps (its concrete, its grass). */
export const STADIUM_PALETTES = Object.freeze(['isekai-meadow', 'isekai-garden', 'isekai-sakura', 'isekai-bamboo', 'alien-night', 'airless-plain']);
const ROOFS = ['none', 'canopy', 'ring', 'dome'], FACADES = ['none', 'glass', 'brick', 'metal', 'arches'], LANDMARKS = ['none', 'cauldron', 'arch'];
export const STADIUM_APRONS = { grass: '#5d8f45', concrete: '#a6a39b', sand: '#cdb27f', track: '#5d8f45' };
const SIDES = ['n', 'e', 's', 'w'];

// the shirts a full house wears (the mosaic's colours past the seats)
export const STADIUM_CROWD = ['#e94b3c', '#2f6fd6', '#f2c230', '#f4f4f4', '#2a2a2a', '#3fae5a', '#ff8c2e', '#8e5bd6', '#c9a27a', '#5a3a2a'];
/** The bowl's colour sets: the seats, the concrete, the wall, the roof, the accent; a glow lights a dome's ribs. */
export const STADIUM_LIVERIES = Object.freeze({
  olympic: { seat: '#3f74c9', concrete: '#c9c6bf', wall: '#e9ebee', boards: '#2b59c3', glass: '#7fa9c9', roof: '#f4f5f6', rib: '#b9c0c8', accent: '#e8b02e', track: '#b4553c', screen: '#3f86e0' },
  garden: { seat: '#2f6b3a', concrete: '#c8c2b4', wall: '#3f6346', boards: '#2b4f33', glass: '#5f7f74', roof: '#e9ebe6', rib: '#2f4a35', accent: '#5e2f86', track: '#b4553c', screen: '#3f86e0' },
  club: { seat: '#c3202f', concrete: '#b8b6b2', wall: '#3a3f47', boards: '#16181c', glass: '#6f8aa3', roof: '#e6e8ea', rib: '#d9dce0', accent: '#f2f2f2', track: '#b4553c', screen: '#4a8fe6' },
  stone: { seat: '#cdb894', concrete: '#bfa983', wall: '#d6c29c', boards: '#9f8458', glass: '#6f6a5f', roof: '#c9b48c', rib: '#a68e66', accent: '#8f2e24', track: '#b4553c', screen: '#d8a33e' },
  night: { seat: '#1f2638', concrete: '#2c3346', wall: '#262d40', boards: '#0d1320', glass: '#2ee6ff', roof: '#1a2032', rib: '#3a4560', accent: '#ff3fa4', glow: '#3fe9ff', track: '#5b2bd6', screen: '#2ee6ff' },
  candy: { seat: '#ff7eb6', concrete: '#f3e9d8', wall: '#7ad3ff', boards: '#ffd84a', glass: '#b9f0ff', roof: '#ffffff', rib: '#ff9f43', accent: '#ffd84a', track: '#ff6b6b', screen: '#6c5ce7' },
  meadow: { seat: '#4f9fd8', concrete: '#e2dccd', wall: '#f2efe6', boards: '#2f7fc1', glass: '#9fd0ea', roof: '#ffffff', rib: '#cfd6dc', accent: '#ffcc33', track: '#d0603f', screen: '#3f86e0' },
  town: { seat: '#2f4f8f', concrete: '#aaa59b', wall: '#8a5a44', boards: '#1f3566', glass: '#5f7182', roof: '#d6d8da', rib: '#6b6f75', accent: '#f0c34a', track: '#b4553c', screen: '#3f86e0' },
});
const COLOUR_KEYS = ['seat', 'concrete', 'wall', 'boards', 'glass', 'roof', 'rib', 'accent', 'glow', 'track', 'screen', 'apron'];

/**
 * THE MOJULO OLYMPICS: the venues a game starts from, each a set of the words above, each named for the games it suits
 * and good for any other. Any word over a preset moves that part and keeps the rest.
 */
export const STADIUM_PRESETS = Object.freeze({
  olympic: { reads: 'the Olympic stadium: an oval bowl in two tiers round a running track, its roof hung from a ring of masts, the cauldron on its pylon, the city beyond, noon', suits: 'athletics, football, any field', field: { w: 68, d: 105 }, look: 'shaded', palette: 'isekai-meadow', time: 'day', livery: 'olympic', bowl: { shape: 2.4, rows: [16, 14], roof: 'ring', facade: 'glass', crowd: 0.7, gap: 12, apron: 'track', screens: 2, landmark: 'cauldron' }, masts: 0, skyline: { n: 14, height: [35, 110] } },
  'centre-court': { reads: 'a centre court: a steep round bowl close on a lawn, green seats and a purple trim, a canopy over, brick without, the garden\'s towers beyond', suits: 'tennis, badminton, volleyball', field: { w: 18, d: 36 }, look: 'shaded', palette: 'isekai-garden', time: 'day', livery: 'garden', bowl: { shape: 3, rows: [18], rise: 0.48, roof: 'canopy', facade: 'brick', crowd: 0.75, gap: 4, apron: 'grass', screens: 0, landmark: 'none' }, masts: 0, skyline: { n: 8, height: [25, 60] } },
  football: { reads: 'a football ground: a rounded box in two tiers right on the touchline, a canopy all round, an arch sprung over the far stand, screens at the ends, the evening sun', suits: 'football, rugby, hockey', field: { w: 68, d: 105 }, look: 'shaded', palette: 'isekai-meadow', time: 'golden', livery: 'club', bowl: { shape: 5, rows: [14, 16], roof: 'canopy', facade: 'metal', crowd: 0.8, gap: 3, apron: 'grass', screens: 2, landmark: 'arch' }, masts: 0, skyline: { n: 12, height: [30, 90] } },
  colosseum: { reads: 'an amphitheatre: an open ellipse of stone tiers, its wall storeys of arches, sand on the floor, the warm light of the late afternoon', suits: 'duels, combat, chariots, a gladiator\'s game', field: { w: 50, d: 80, surface: 'sand' }, look: 'shaded', palette: 'isekai-bamboo', time: 'golden', livery: 'stone', bowl: { shape: 2, rows: [22], rise: 0.5, roof: 'none', facade: 'arches', crowd: 0.55, gap: 4, apron: 'sand', screens: 0, landmark: 'none' }, masts: 0, skyline: { n: 6, height: [14, 34], forms: ['ziggurat', 'drum', 'column'] } },
  'patron-dome': { reads: 'a patron\'s dome after dark: a round bowl in two tiers under glowing ribs to an open eye, glass boxes lit, an alien night\'s colours, the towers lit beyond', suits: 'a hologram duel, esports, a showcase', field: { w: 40, d: 60, surface: 'holo' }, look: 'shaded', palette: 'alien-night', time: 'dusk', ground: 'concrete', livery: 'night', bowl: { shape: 2.2, rows: [14, 12], roof: 'dome', facade: 'metal', crowd: 0.8, gap: 5, apron: 'concrete', screens: 2, landmark: 'none' }, masts: 0, skyline: { n: 18, height: [60, 160], forms: ['needle', 'turning'] } },
  arcade: { reads: 'an arcade stadium: a chunky rounded bowl in candy colours, open to the sky, screens at the ends, a blocky skyline, bright noon', suits: 'any arcade sport', field: { w: 40, d: 60 }, look: 'voxel', palette: 'isekai-sakura', time: 'day', livery: 'candy', bowl: { shape: 4, rows: [10], rise: 0.5, roof: 'none', facade: 'none', crowd: 0.7, gap: 4, apron: 'concrete', screens: 2, landmark: 'none' }, masts: 4, skyline: { n: 10, height: [20, 60] } },
  anime: { reads: 'an anime stadium: banded light, a bowl under a white canopy, blue seats, a golden evening', suits: 'any sport, drawn as a show', field: { w: 50, d: 76 }, look: 'anime', palette: 'isekai-meadow', time: 'golden', livery: 'meadow', bowl: { shape: 3, rows: [14], roof: 'canopy', facade: 'glass', crowd: 0.7, gap: 4, apron: 'grass', screens: 1, landmark: 'none' }, masts: 4, skyline: { n: 10, height: [30, 80] } },
  municipal: { reads: 'a town ground: a low covered stand down each long side, the ends open, brick, two masts, the evening sun', suits: 'a local match, a school\'s field day', field: { w: 60, d: 95 }, look: 'shaded', palette: 'isekai-bamboo', time: 'golden', livery: 'town', bowl: { shape: 6, rows: [6], roof: 'canopy', facade: 'brick', crowd: 0.45, gap: 4, apron: 'grass', open: ['e', 'w'], screens: 0, landmark: 'none' }, masts: 2, skyline: { n: 6, height: [12, 30], forms: ['ziggurat', 'drum', 'column'] } },
});
export const STADIUM_PRESET_IDS = Object.freeze(Object.keys(STADIUM_PRESETS));
const KEYS = ['kind', 'field', 'preset', 'palette', 'look', 'time', 'ground', 'livery', 'colours', 'bowl', 'masts', 'skyline', 'camera', 'viewBox', 'title', 'seed'];
const BOWL_KEYS = ['shape', 'rows', 'rise', 'roof', 'facade', 'crowd', 'gap', 'clear', 'open', 'apron', 'screens', 'landmark'];
// the keys a world's channels read beside the venue (world-scene.js lays them over any kind's payload)
const CHANNEL_KEYS = ['court', 'pitch', 'meet', 'turns', 'holo', 'innings', 'game', 'events', 'play', 'audio', 'structures', 'weather', 'backdrop'];

/** The words, the preset's under them, checked. */
export function readStadium(m = {}) {
  if (!isObj(m)) fail('a stadium is { field: { w, d, surface? }, preset?, palette?, look?, time?, livery?, bowl?, masts?, skyline? }');
  for (const k of Object.keys(m)) if (!KEYS.includes(k) && !CHANNEL_KEYS.includes(k)) fail(`no '${k}' (${KEYS.filter((x) => x !== 'kind').join(', ')})`);
  const P = m.preset === undefined ? STADIUM_PRESETS.olympic : STADIUM_PRESETS[m.preset];
  if (!P) fail(`preset '${m.preset}' is one of ${STADIUM_PRESET_IDS.join(', ')}`);
  const F = m.field ?? P.field;
  if (!isObj(F) || !(F.w >= 4 && F.w <= 400) || !(F.d >= 4 && F.d <= 400)) fail('field is { w, d } in metres (4 to 400 each), surface?');
  const surface = F.surface ?? P.field.surface ?? 'grass';
  if (!STADIUM_SURFACES[surface]) fail(`field.surface is one of ${Object.keys(STADIUM_SURFACES).join(', ')}`);
  const look = m.look ?? P.look, palette = m.palette ?? P.palette, time = m.time ?? P.time, ground = m.ground ?? P.ground ?? 'grass';
  if (!['grass', 'concrete'].includes(ground)) fail('ground is grass or concrete');
  if (!STADIUM_LOOKS[look]) fail(`look is one of ${Object.keys(STADIUM_LOOKS).join(', ')} (the degree of realism)`);
  if (!STADIUM_PALETTES.includes(palette)) fail(`palette is one of ${STADIUM_PALETTES.join(', ')}`);
  if (!STADIUM_TIMES.includes(time)) fail(`time is one of ${STADIUM_TIMES.join(', ')}`);
  const livery = m.livery ?? P.livery;
  if (!STADIUM_LIVERIES[livery]) fail(`livery is one of ${Object.keys(STADIUM_LIVERIES).join(', ')}`);
  if (m.colours !== undefined) {
    if (!isObj(m.colours)) fail(`colours is { ${COLOUR_KEYS.join('?, ')}? } over the livery's, each a #rrggbb`);
    for (const [k, v] of Object.entries(m.colours)) {
      if (!COLOUR_KEYS.includes(k)) fail(`colours has no '${k}' (${COLOUR_KEYS.join(', ')})`);
      if (!HEX.test(v)) fail(`colours.${k} is a #rrggbb`);
    }
  }
  let bowl = null;
  if (m.bowl !== false) {
    if (m.bowl !== undefined && !isObj(m.bowl)) fail(`bowl is false or { ${BOWL_KEYS.join('?, ')}? }`);
    for (const k of Object.keys(m.bowl ?? {})) if (!BOWL_KEYS.includes(k)) fail(`bowl has no '${k}' (${BOWL_KEYS.join(', ')})`);
    bowl = { ...P.bowl, ...(m.bowl ?? {}) };
    if (!(bowl.shape >= 2 && bowl.shape <= 8)) fail('bowl.shape is 2 (an ellipse) to 8 (nearly a box)');
    if (!(Array.isArray(bowl.rows) && (bowl.rows.length === 1 || bowl.rows.length === 2) && bowl.rows.every((r) => Number.isInteger(r) && r >= 4 && r <= 30))) fail('bowl.rows is [lower] or [lower, upper], 4 to 30 rows a tier');
    if (bowl.rise !== undefined && !(bowl.rise >= 0.2 && bowl.rise <= 0.7)) fail('bowl.rise is 0.2 to 0.7 m a row (the lower tier\'s rake)');
    if (!ROOFS.includes(bowl.roof)) fail(`bowl.roof is one of ${ROOFS.join(', ')}`);
    if (!FACADES.includes(bowl.facade)) fail(`bowl.facade is one of ${FACADES.join(', ')}`);
    if (!LANDMARKS.includes(bowl.landmark ?? 'none')) fail(`bowl.landmark is one of ${LANDMARKS.join(', ')}`);
    if (!(bowl.crowd >= 0 && bowl.crowd <= 1)) fail('bowl.crowd is 0 to 1 (the share of seats taken)');
    if (!(bowl.gap >= 1 && bowl.gap <= 40)) fail('bowl.gap is 1 to 40 m (from the field\'s edge to the pitch wall)');
    if (bowl.clear !== undefined && !(bowl.clear >= 0 && bowl.clear <= 80)) fail('bowl.clear is 0 to 80 m');
    if (!Object.keys(STADIUM_APRONS).includes(bowl.apron ?? 'grass')) fail(`bowl.apron is one of ${Object.keys(STADIUM_APRONS).join(', ')}`);
    if (bowl.apron === 'track' && bowl.gap < 6) fail('bowl.apron \'track\' needs a gap of 6 m or more (its lanes)');
    if (!(Number.isInteger(bowl.screens ?? 0) && (bowl.screens ?? 0) >= 0 && (bowl.screens ?? 0) <= 2)) fail('bowl.screens is 0 to 2');
    const open = bowl.open ?? [];
    if (!(Array.isArray(open) && open.every((s) => SIDES.includes(s)) && open.length < 4)) fail('bowl.open is a list of the sides left open (n, e, s, w), not all four');
    bowl = { ...bowl, open: [...new Set(open)].sort(), apron: bowl.apron ?? 'grass', screens: bowl.screens ?? 0, landmark: bowl.landmark ?? 'none' };
  }
  const masts = m.masts ?? P.masts;
  if (!(Number.isInteger(masts) && masts >= 0 && masts <= 8)) fail('masts is 0 to 8');
  let skyline = null;
  if (m.skyline !== false) {
    if (m.skyline !== undefined && !isObj(m.skyline)) fail('skyline is false or { n?, height?: [lo, hi], forms?, seed? }');
    skyline = { ...P.skyline, ...(m.skyline ?? {}) };
    if (!(Number.isInteger(skyline.n) && skyline.n >= 0 && skyline.n <= 24)) fail('skyline.n is 0 to 24 towers');
    if (!(Array.isArray(skyline.height) && skyline.height.length === 2 && skyline.height[0] > 0 && skyline.height[1] >= skyline.height[0] && skyline.height[1] <= 400)) fail('skyline.height is [lo, hi] metres');
    if (skyline.forms !== undefined && !(Array.isArray(skyline.forms) && skyline.forms.length && skyline.forms.every((x) => SKYLINE_FORMS.includes(x)))) fail(`skyline.forms is a list of ${SKYLINE_FORMS.join(', ')}`);
  }
  const seed = Number.isInteger(m.seed) ? m.seed : 1;
  return { preset: m.preset ?? 'olympic', field: { x: F.x ?? -F.w / 2, y: F.y ?? 0, w: F.w, d: F.d, surface }, look, palette, time, ground, livery, colours: { ...STADIUM_LIVERIES[livery], ...(m.colours ?? {}) }, bowl, masts, skyline, seed };
}


/** The skyline's forms: the fractal structures' presets that read as towers at a distance and stay light without
 * their echo (a few hundred faces each). */
export const SKYLINE_FORMS = Object.freeze(['turning', 'ziggurat', 'needle', 'drum', 'column']);
