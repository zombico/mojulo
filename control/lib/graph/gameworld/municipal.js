/**
 * THE MUNICIPAL OFFICE — the temp agency's parallel track, at City Hall: a quest log of INFRA REQUESTS from constituents
 * (a 311 app on the phone; the journal their log). The player, in a city worker's ID from the forger (shops.js PAPERS
 * `municipal`) and nobody asking, does each one themselves, by a combination of what the city already does:
 *
 *   approve   a WORK ORDER, made at City Hall's clerk desk (geocity `cityhall`: a civic front, its inside a building of
 *             its own; its desk a Deskwork shift of work orders, deskwork/card.js CLERK): a shift won puts one in the bag
 *   deliver   its MATERIAL collected at the works yard with a work order in hand (a bag of cold patch, fence panels, a
 *             litter picker and bin bags) and carried to the place, on foot or in anything
 *   fix       played in the engine at the real place (scene/channels/fix-sites.js): at each spot of it (a pothole in the
 *             road, a lot's broken fence panels, a park's litter) hold F, then tap F; every spot fixed, the request is
 *             done: the order and the material used, the pay into the bag, the constituent's thanks
 *
 * A request is a row the world writes (`municipal: { requests: [{ id, kind, from?, says?, reward? }] }`); its kind says
 * the rest (REQUEST_KINDS), and the district places it (requestSites): a pothole at a road's kerb near the start, a
 * fence along a vacant lot's open side (a building site's hoarding where none is), a public space in the park nearest
 * the start. A new kind of request is a row.
 *
 *   MUNICIPAL            the app, its papers, the work order's item
 *   CLERK_DESK           City Hall's clerk desk: its words, its vars (a shift won a work order), its card
 *   REQUEST_KINDS        { <kind>: { name, thing, material: { item, name }, spots, hold: { verb, secs }, tap: { verb,
 *                        n }, done, says, thanks, reward } }
 *   readMunicipal(spec)  → { requests: [{ id, kind, from, says, reward }] } | null (throws, teaching)
 *   requestSites(ends, requests) → [{ id, spots: [{ at, N? }], yard: { at, half }, where }]: each placed, or left out
 *                        (a fence down a vacant lot's open side, else a building site's hoarding by its street)
 *
 * Pure.
 */
import { lawnOf } from './jobsified.js';
import { CLERK } from '../deskwork/card.js';

export const MUNICIPAL = Object.freeze({
  app: 'cityline', appName: 'CityLine 311', papers: 'municipal',
  order: Object.freeze({ item: 'work-order', name: 'work order' }),
  // (the works yard's word where a request's material is had)
  yard: 'works',
});

// CITY HALL'S CLERK DESK (temp-agency.js deskCast's words, levels.js cityhallDoor): a Deskwork shift of work orders
// (deskwork/card.js CLERK), gated by the city worker's ID; a shift won is a work order in the bag, the rank the same
// commendations an office temp's are
export const CLERK_DESK = Object.freeze({
  desk: Object.freeze({ id: 'clerk', title: 'City Hall Intranet', prompt: 'sit down at the clerk\'s desk', gold: 0.05, reach: 2.6 }),
  vars: Object.freeze({ badge: 'held:bag:city-id', coin: 'held:bag:coin', merit: 'held:bag:commendation', each: 'held:bag:work-order' }),
  locked: 'Security: staff only. A city worker\'s ID, please. (The vest alone is not enough. It is close.)',
  reception: 'Front desk: Oh, you\'re from Public Works? The clerk\'s desk is {room}. Work orders don\'t stamp themselves. Well. They do. But not yet.',
  won: 'Clerk\'s supervisor: Stamped and filed. A work order is in your bag. Go and fix something, it says here.',
  lost: 'Clerk\'s supervisor: The work orders are still on the desk. They are not going anywhere. Neither, it seems, are you.',
  card: CLERK,
});

export const REQUEST_KINDS = Object.freeze({
  pothole: Object.freeze({ name: 'Pothole', thing: 'the pothole', material: Object.freeze({ item: 'cold-patch', name: 'bag of cold-patch asphalt' }), spots: 1,
    hold: Object.freeze({ verb: 'shovel in the asphalt', secs: 2 }), tap: Object.freeze({ verb: 'tamp it down', n: 6 }), done: 'Pothole filled',
    says: 'There is a pothole outside {where} so deep my cat lives in it now. Please fill it. Leave a small one for the cat.', thanks: 'The cat has moved out. Thank you, I think.', reward: 40 }),
  fence: Object.freeze({ name: 'Broken fence', thing: 'the fence', material: Object.freeze({ item: 'fence-panel', name: 'stack of fence panels' }), spots: 3,
    hold: Object.freeze({ verb: 'lift the panel', secs: 1.5 }), tap: Object.freeze({ verb: 'nail it', n: 4 }), done: 'Fence fixed',
    says: 'The fence by {where} has been "temporarily" down since the last mayor. The raccoons have formed a government.', thanks: 'The raccoons have issued a statement. It is mostly hissing. Good work.', reward: 45 }),
  park: Object.freeze({ name: 'Public space', thing: 'the park', material: Object.freeze({ item: 'park-kit', name: 'litter picker and bin bags' }), spots: 3,
    hold: Object.freeze({ verb: 'pick up the litter', secs: 2 }), tap: Object.freeze({ verb: 'tie off the bag', n: 3 }), done: 'Public space tidied',
    says: 'The park is lovely, I assume, under all the litter. Could someone check?', thanks: 'There was grass under there the whole time. Who knew.', reward: 35 }),
});
const FROM = Object.freeze(['Mrs. Henderson', 'Gus from the laundromat', 'The Residents\' Association (all three of them)', 'Dr. Patel', 'A concerned citizen (anonymous, signed)', 'Marjorie, again']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const WORD = /^[a-z][a-z0-9-]{0,31}$/;

export function readMunicipal(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  const no = (m) => { throw new Error(`gameworld.municipal${m}`); };
  if (!isObj(spec)) no(' is { requests: [{ id, kind, from?, says?, reward? }] }: the constituents\' infra requests, done at City Hall\'s say-so');
  for (const k of Object.keys(spec)) if (k !== 'requests') no(`.${k} is not part of it (requests)`);
  if (!Array.isArray(spec.requests) || !spec.requests.length) no('.requests is a list of { id, kind, from?, says?, reward? }, at least one');
  const seen = new Set();
  const requests = spec.requests.map((R, i) => {
    const at = `.requests[${i}]`;
    if (!isObj(R)) no(`${at} is { id, kind, from?, says?, reward? }`);
    for (const k of Object.keys(R)) if (!['id', 'kind', 'from', 'says', 'reward'].includes(k)) no(`${at}.${k} is not part of a request (id, kind, from, says, reward)`);
    if (typeof R.id !== 'string' || !WORD.test(R.id)) no(`${at}.id is its name, lower-case`);
    if (seen.has(R.id)) no(`${at}.id '${R.id}' appears twice`);
    seen.add(R.id);
    const K = REQUEST_KINDS[R.kind];
    if (!K) no(`${at}.kind is one of ${Object.keys(REQUEST_KINDS).join(', ')}`);
    for (const k of ['from', 'says']) if (R[k] !== undefined && !(typeof R[k] === 'string' && R[k].trim())) no(`${at}.${k} is words`);
    if (R.reward !== undefined && !(Number.isInteger(R.reward) && R.reward >= 0)) no(`${at}.reward is the coin it pays, a whole number`);
    return { id: R.id, kind: R.kind, from: R.from ?? FROM[i % FROM.length], says: R.says ?? K.says, reward: R.reward ?? K.reward };
  });
  return { requests };
}

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// a shop's card as people say it ('convenience' the convenience store, 'gun-store' the gun store)
const shopWord = (card) => { const w = String(card).replace(/-/g, ' '); return /(store|shop|pharmacy|diner|market|bakery|cafe|bar)$/.test(w) ? w : `${w} store`; };
// the side of a lot its street is on: the one whose middle is nearest a place (the places stand on the walks)
function streetSide(L, places) {
  const [x0, y0, x1, y1] = L.rect, mids = { s: [(x0 + x1) / 2, y0], n: [(x0 + x1) / 2, y1], w: [x0, (y0 + y1) / 2], e: [x1, (y0 + y1) / 2] };
  const gap = (m) => Math.min(Infinity, ...places.map((q) => d2(q.at, m)));
  return Object.keys(mids).reduce((b, k) => (gap(mids[k]) < gap(mids[b]) - 1e-9 ? k : b), 's');
}
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// how a request's spots are laid (m): a pothole's at least `apart` from another's, a fence's panels `panel` apart along
// its lot's side, `inset` in from it
export const SITES = Object.freeze({ apart: 40, panel: 2.6, inset: 0.4 });

/** Each request placed in the district (its `ends`, gameworld/levels.js geocityEnds): its spots, its works yard (where
 *  its material is had), and the words for where it is. A request whose place the district lacks is left out. */
export function requestSites(ends, requests) {
  const out = [], used = [], s = ends?.spawn ?? [0, 0, 0];
  const yard = (ends?.depots ?? []).find((x) => x.yard === MUNICIPAL.yard);
  if (!yard) return out;
  const Y = { at: yard.at.slice(), half: yard.half.slice() };
  for (const R of requests ?? []) {
    let spots = null, where = null;
    if (R.kind === 'pothole') {
      // (in a road's kerb lane before the places nearest the start, apart from any other)
      const near = (ends.places ?? []).slice().sort((a, b) => d2(a.at, s) - d2(b.at, s) || a.at[0] - b.at[0] || a.at[1] - b.at[1]).slice(0, 80);
      for (const q of near) {
        if (typeof ends.kerbAt !== 'function' || used.some((u) => d2(u, q.at) < SITES.apart)) continue;
        const k = ends.kerbAt(q.at, q.N);
        if (!k) continue;
        spots = [{ at: k.at.map(r3) }]; where = q.card ? `the ${shopWord(q.card)}` : 'the street'; break;
      }
    } else if (R.kind === 'fence') {
      // (along a vacant lot's open side, else a building site's hoarding on the side by its street, nearest the start:
      // its panels down it)
      const free = (q) => !used.some((u) => d2(u, q.at) < SITES.apart), by = (a, b) => d2(a.at, s) - d2(b.at, s) || a.id.localeCompare(b.id);
      const L = (ends.lots ?? []).filter((q) => q.kind === 'vacant' && q.open && free(q)).sort(by)[0] ?? (ends.lots ?? []).filter((q) => q.kind === 'construction' && free(q)).sort(by)[0];
      if (L) {
        const side = L.open ?? streetSide(L, ends.places ?? []), N = { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[side] ?? [0, -1];
        const [x0, y0, x1, y1] = L.rect;
        const c = [(x0 + x1) / 2, (y0 + y1) / 2], e = [c[0] + N[0] * ((x1 - x0) / 2 - SITES.inset), c[1] + N[1] * ((y1 - y0) / 2 - SITES.inset)], t = [-N[1], N[0]];
        const z = L.at[2];
        spots = [-1, 0, 1].map((k) => ({ at: [r3(e[0] + t[0] * k * SITES.panel), r3(e[1] + t[1] * k * SITES.panel), r3(z)], N: N.slice() }));
        where = L.kind === 'vacant' ? 'the empty lot' : 'the building site';
      }
    } else if (R.kind === 'park') {
      // (on the lawn of the park nearest the start: three of its cells, spread)
      const P = lawnOf(ends);
      if (P && P.cells.length >= 3 && !used.some((u) => d2(u, P.cells[0].at) < 10)) {
        const C = P.cells, k = [0, Math.floor(C.length / 2), C.length - 1];
        spots = k.map((i) => ({ at: C[i].at.slice() }));
        where = 'the park';
      }
    }
    if (!spots) continue;
    used.push(...spots.map((q) => q.at));
    out.push({ id: R.id, spots, yard: Y, where });
  }
  return out;
}
