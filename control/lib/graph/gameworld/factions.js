/**
 * FACTIONS — the sides of an open city. A faction is a row its game's maker writes: a name, a colour, its TURF (a part
 * of the district), who its rivals are, and its contact, who stands on its turf and is the way in. The player is with
 * ONE faction at a time: joining one leaves the other. With each there is a STANDING, one number: what is done for it
 * raises it, and it opens what its BOARD posts. The board is the faction's task list, seen from its side: postings are
 * ACTS on the world (errand.js `faction`, `act`), taken on the phone (gameworld/phone-ui.js), paid in money and in
 * standing when the act is done. The law is not one of them: it gives no work and is a response to mayhem.
 *
 *   factions: { <id>: { name?, colour: '#rrggbb', turf: '<side>' | [x0, y0, x1, y1], rivals?: ['<id>'], says? } }
 *       turf    the part of the district that is its own: a side by its word (FACTIONS.turfs: north, south, east, west,
 *               centre and the four corners), or a rectangle in fractions of the district's box (0 to 1, x east, y
 *               north). Two factions' turf may not overlap
 *       says    what its contact says as the player joins
 *       board   what it posts: [{ id, act: { verb, target?, on? }, reward?: [{ item, n? }], standing?, rank?, name?,
 *               says? }]. An ACT is what is done (a verb on a target, on a rival's turf when `on` names one), not what
 *               is carried. `rank` is the standing it is posted at; it pays `reward` and `standing`. What DOES an act is
 *               not here: it is whatever raises the event act:<verb>:<id> (game/errand-mechanics.js lowerAct)
 *
 *   FACTIONS                         the turf words, the words said
 *   readFactions(spec)               → [{ id, name, colour, turf: [x0, y0, x1, y1], rivals, says, board }] | null (refuses a
 *                                      malformed one, teaching)
 *   turfRect(F, box)                 → its turf in the world: [x0, y0, x1, y1] (box: the district's, the same)
 *   factionAt(factions, box, x, y)   → the faction whose turf a point is on, or null
 *   actLine(posting, factions)       → what a posting asks, as a line
 *   turfZones(factions, box)         → [{ id, name, colour, r }]: each turf in the world, for a map
 * Pure, no dice: what a faction is and where is its maker's.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const WORD = /^[a-z][a-z0-9-]{0,31}$/, HEX = /^#[0-9a-f]{6}$/i;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export const FACTIONS = Object.freeze({
  turfs: Object.freeze({
    north: [0, 0.5, 1, 1], south: [0, 0, 1, 0.5], east: [0.5, 0, 1, 1], west: [0, 0, 0.5, 1], centre: [0.25, 0.25, 0.75, 0.75],
    'north-east': [0.5, 0.5, 1, 1], 'north-west': [0, 0.5, 0.5, 1], 'south-east': [0.5, 0, 1, 0.5], 'south-west': [0, 0, 0.5, 0.5],
  }),
  says: 'You are with us now. Work comes to your phone.',
  // how much standing a posting pays, unsaid
  standing: 1,
});
const KEYS = ['name', 'colour', 'turf', 'rivals', 'says', 'board'];
const POST_KEYS = ['id', 'name', 'act', 'reward', 'standing', 'rank', 'says'], ACT_KEYS = ['verb', 'target', 'on'];
const posInt = (v) => Number.isInteger(v) && v >= 1;
const cap = (id) => `${id[0].toUpperCase()}${id.slice(1).replace(/-/g, ' ')}`;

export function readFactions(spec) {
  if (spec === undefined || spec === null) return null;
  const no = (m) => { throw new Error(`gameworld.factions${m}`); };
  if (!isObj(spec) || !Object.keys(spec).length) no(' is { <id>: { name?, colour, turf, rivals?, says? } }: the sides of the city, each a row');
  const out = [];
  for (const [id, F] of Object.entries(spec)) {
    const w = `.${id}`;
    if (!WORD.test(id)) no(`${w}: a faction's id is one lower-case word (reds, dockers)`);
    if (!isObj(F)) no(`${w} is { ${KEYS.join('?, ')}? }`);
    for (const k of Object.keys(F)) if (!KEYS.includes(k)) no(`${w}.${k}: not a faction's key (${KEYS.join(', ')})`);
    if (F.name !== undefined && !(typeof F.name === 'string' && F.name.trim() && F.name.length <= 32)) no(`${w}.name is what it is called, in words`);
    if (typeof F.colour !== 'string' || !HEX.test(F.colour)) no(`${w}.colour is its colour, '#rrggbb': its turf on the map, its people and its cars`);
    const turf = typeof F.turf === 'string' ? FACTIONS.turfs[F.turf] : F.turf;
    if (!Array.isArray(turf) || turf.length !== 4 || turf.some((v) => !Number.isFinite(v) || v < 0 || v > 1) || !(turf[2] > turf[0]) || !(turf[3] > turf[1])) no(`${w}.turf is the part of the district that is its own: a side (${Object.keys(FACTIONS.turfs).join(', ')}) or [x0, y0, x1, y1] in fractions of the district, 0 to 1 (x east, y north)`);
    if (F.rivals !== undefined && (!Array.isArray(F.rivals) || F.rivals.some((r) => typeof r !== 'string' || r === id || !Object.hasOwn(spec, r)))) no(`${w}.rivals names other factions of this game (${Object.keys(spec).filter((k) => k !== id).join(', ') || 'none written'})`);
    if (F.says !== undefined && !(typeof F.says === 'string' && F.says.trim())) no(`${w}.says is what its contact says as the player joins, in words`);
    // ITS BOARD: what it posts, each an ACT (a verb on a target: what is done, not what is carried)
    const board = [];
    if (F.board !== undefined) {
      if (!Array.isArray(F.board) || !F.board.length) no(`${w}.board is [{ id, act: { verb, target?, on? }, reward?, standing?, rank?, name?, says? }]: what it posts, at least one`);
      F.board.forEach((P, k) => {
        const pw = `${w}.board[${k}]`;
        if (!isObj(P)) no(`${pw} is { ${POST_KEYS.join('?, ')}? }`);
        for (const key of Object.keys(P)) if (!POST_KEYS.includes(key)) no(`${pw}.${key}: not a posting's key (${POST_KEYS.join(', ')})`);
        if (typeof P.id !== 'string' || !WORD.test(P.id)) no(`${pw}.id is the posting's name, one lower-case word (tag-the-wall, repo)`);
        if (!isObj(P.act) || typeof P.act.verb !== 'string' || !WORD.test(P.act.verb)) no(`${pw}.act is { verb, target?, on? }: what is done (verb: one lower-case word; the action that does it is wired later, behind the event act:<verb>:<id>)`);
        for (const key of Object.keys(P.act)) if (!ACT_KEYS.includes(key)) no(`${pw}.act.${key}: not an act's key (${ACT_KEYS.join(', ')})`);
        if (P.act.target !== undefined && (typeof P.act.target !== 'string' || !WORD.test(P.act.target))) no(`${pw}.act.target is what it is done to, one lower-case word (car, courier, wall)`);
        if (P.act.on !== undefined && (P.act.on === id || !Object.hasOwn(spec, P.act.on))) no(`${pw}.act.on names the faction whose turf it is done on: another faction of this game`);
        if (P.reward !== undefined && (!Array.isArray(P.reward) || P.reward.some((r) => !isObj(r) || typeof r.item !== 'string' || !WORD.test(r.item) || (r.n !== undefined && !posInt(r.n))))) no(`${pw}.reward is [{ item, n? }]: what it pays`);
        if (P.standing !== undefined && !posInt(P.standing)) no(`${pw}.standing is how much standing it pays, a whole number from 1`);
        if (P.rank !== undefined && !(Number.isInteger(P.rank) && P.rank >= 0)) no(`${pw}.rank is the standing it is posted at, a whole number from 0`);
        if (P.says !== undefined && !(typeof P.says === 'string' && P.says.trim())) no(`${pw}.says is what the posting says, in words`);
        board.push({ id: P.id, name: P.name?.trim() ?? cap(P.id), act: { verb: P.act.verb, ...(P.act.target ? { target: P.act.target } : {}), ...(P.act.on ? { on: P.act.on } : {}) }, reward: (P.reward ?? []).map((r) => ({ item: r.item, n: r.n ?? 1 })), standing: P.standing ?? FACTIONS.standing, rank: P.rank ?? 0, ...(P.says ? { says: P.says.trim() } : {}) });
      });
    }
    out.push({ id, name: F.name?.trim() ?? cap(id), colour: F.colour.toLowerCase(), turf: turf.map(r4), rivals: (F.rivals ?? []).slice(), says: F.says?.trim() ?? FACTIONS.says, board });
  }
  // (turf is one faction's: where two overlap, whose street it is cannot be said)
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i].turf, b = out[j].turf;
    if (Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-6 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-6) no(`: ${out[i].id} and ${out[j].id} claim the same ground: two factions' turf may not overlap`);
  }
  const posts = new Set();
  for (const F of out) for (const P of F.board) { if (posts.has(P.id)) no(`: '${P.id}' names two postings: one name, one posting, across every board`); posts.add(P.id); }
  return out;
}

export function turfRect(F, box) {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
  return [r4(x0 + F.turf[0] * w), r4(y0 + F.turf[1] * h), r4(x0 + F.turf[2] * w), r4(y0 + F.turf[3] * h)];
}

export function factionAt(factions, box, x, y) {
  for (const F of factions ?? []) { const r = turfRect(F, box); if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return F.id; }
  return null;
}

export function turfZones(factions, box) {
  return (factions ?? []).map((F) => ({ id: F.id, name: F.name, colour: F.colour, r: turfRect(F, box) }));
}

/** What a posting asks, as a line: 'Torch a car on Dockers turf'. */
export function actLine(P, factions) {
  const where = P.act.on ? (factions ?? []).find((F) => F.id === P.act.on) : null, v = P.act.verb.replace(/-/g, ' ');
  return `${v[0].toUpperCase()}${v.slice(1)}${P.act.target ? ` a ${P.act.target.replace(/-/g, ' ')}` : ''}${where ? ` on ${where.name} turf` : ''}`;
}
