/**
 * THE TOUR: an exhibit's stops, stepped through in order. At each stop the camera moves (eased), a caption explains,
 * the part being talked about is lit while the rest dims, and the stop may say where its claim comes from and how sure
 * it is. It rides any world as the opt-in `tour` key of its recipe (world-scene.js reads it after the payload is built);
 * the World page draws it (scene/channels/tour.js). Absent, it adds nothing: every other page is byte-identical.
 *
 *   tour: {
 *     title?,                      what the tour is called (its plate's heading)
 *     start?,                      the stop the page opens on (default 0); a page's ?stop=<n> overrides it
 *     stops: [{
 *       id?,                       a short id (default s1, s2 …); the crumb's handle and the ?stop= target
 *       title?,                    the stop's heading
 *       caption,                   what the stop says
 *       camera,                    a camera of the world by its name, { pos, target, vfov? }, or
 *                                  { frame: group | [groups], from?: threeQuarter | front | side | top }: fit to them
 *       highlight?,                render groups lit while the rest dims (a group names its sub-groups too: 'body' is
 *                                  'body:hair' as well)
 *       shape?,                    how the stop explains, the deck's grammar: ladder | process | structure | stratified
 *                                  | quantity | formal
 *       cite?,                     where its claim comes from: a source, or several
 *       grade?,                    how sure it is: attested | reconstructed | conjectural (what the record holds), or
 *                                  simulated | depicted | explained (what the science ladder holds)
 *       claims?,                   the brief's claims it states (exhibit/brief.js), by id: a stop with no grade or cite
 *                                  of its own takes the least sure grade and the sources of its claims
 *       captions?,                 { child?, specialist? }: the caption said for another audience (the caption is
 *                                  everyone's); the page offers the switch when any stop has one
 *     }]
 *   }
 *
 * readTour(spec, { cameras, groups }) checks it against the world it rides (a named camera exists, a highlighted group
 * is drawn) and returns the page's normal form, or throws naming what is wrong and what it takes. Pure and
 * deterministic: no clock, no dice.
 */

import { gradeOfClaims } from './brief.js';

export const TOUR_SHAPES = Object.freeze(['ladder', 'process', 'structure', 'stratified', 'quantity', 'formal']);
export const TOUR_GRADES = Object.freeze({
  attested: 'record', reconstructed: 'record', conjectural: 'record',
  simulated: 'science', depicted: 'science', explained: 'science',
});
export const FRAME_FROM = Object.freeze(['threeQuarter', 'front', 'side', 'top']);
export const TOUR_LIMITS = Object.freeze({ stops: 24, caption: 700, title: 90, cite: 6, citeLength: 240, highlight: 12 });

const KEYS = ['title', 'start', 'stops'];
const STOP_KEYS = ['id', 'title', 'caption', 'camera', 'highlight', 'shape', 'cite', 'grade', 'claims', 'captions'];
const OTHER_AUDIENCES = ['child', 'specialist'];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const fail = (at, says) => { throw new Error(`tour: ${at} ${says}`); };
const text = (v, at, max, { required = false } = {}) => {
  if (v === undefined || v === null) { if (required) fail(at, 'is required (a sentence or two)'); return undefined; }
  if (typeof v !== 'string' || !v.trim()) fail(at, 'is a non-empty string');
  const t = v.trim();
  if (t.length > max) fail(at, `is ${t.length} characters; at most ${max}`);
  return t;
};

/** The render groups a payload draws, as names a highlight may use: its faces' groups (a face with none is 'static'),
 * its repeats', its planets'. */
export function tourGroups(payload) {
  const out = new Set();
  for (const f of payload?.faces || []) if (f && !(f.decal === 'shadow' || f.decal === 'ink' || f.water)) out.add(typeof f.group === 'string' && f.group ? f.group : 'static');
  for (const r of payload?.repeats || []) if (r && (r.name || r.group)) out.add(r.name || r.group);
  for (const p of payload?.planets || []) if (p && p.group) out.add(p.group);
  return [...out];
}

function readCamera(cam, at, cameras, groupMatch) {
  if (typeof cam === 'string') {
    const index = cameras.findIndex((c) => c && c.name === cam);
    if (index < 0) fail(at, `names no camera '${cam}' (this world's: ${cameras.map((c) => c?.name).filter(Boolean).join(', ') || 'none'})`);
    return { cam: index };
  }
  if (Number.isInteger(cam)) {
    if (cam < 0 || cam >= cameras.length) fail(at, `is camera ${cam}; this world has ${cameras.length}`);
    return { cam };
  }
  if (!isObj(cam)) fail(at, "is a camera's name, { pos, target, vfov? } or { frame, from? }");
  if (cam.frame !== undefined) {
    const extra = Object.keys(cam).filter((k) => !['frame', 'from'].includes(k));
    if (extra.length) fail(at, `has '${extra[0]}' (a framing takes frame and from)`);
    const frame = (Array.isArray(cam.frame) ? cam.frame : [cam.frame]).map((g, i) => groupMatch(g, `${at}.frame[${i}]`));
    if (!frame.length) fail(`${at}.frame`, 'names one group or more');
    if (cam.from !== undefined && !FRAME_FROM.includes(cam.from)) fail(`${at}.from`, `is one of ${FRAME_FROM.join(', ')}`);
    return { frame, from: cam.from ?? 'threeQuarter' };
  }
  const extra = Object.keys(cam).filter((k) => !['pos', 'target', 'vfov'].includes(k));
  if (extra.length) fail(at, `has '${extra[0]}' (a placed camera takes pos, target and vfov)`);
  if (!isVec3(cam.pos)) fail(`${at}.pos`, 'is [x, y, z] in world units (z up)');
  if (!isVec3(cam.target)) fail(`${at}.target`, 'is [x, y, z] in world units (z up)');
  if (cam.vfov !== undefined && !(typeof cam.vfov === 'number' && cam.vfov >= 5 && cam.vfov <= 120)) fail(`${at}.vfov`, 'is degrees, 5 to 120');
  return { pos: cam.pos, target: cam.target, ...(cam.vfov !== undefined ? { vfov: cam.vfov } : {}) };
}

/**
 * Check a tour against the world it rides and return its normal form. `cameras` are the payload's ({ name, … }),
 * `groups` the render groups it draws (tourGroups). Throws `tour: <where> <what it takes>`.
 */
export function readTour(spec, { cameras = [], groups = [], claims = null } = {}) {
  const claimOf = new Map((claims || []).map((c) => [c.id, c]));
  if (!isObj(spec)) fail('', 'is { title?, start?, stops: [{ caption, camera, highlight?, shape?, cite?, grade? }] }');
  const extra = Object.keys(spec).filter((k) => !KEYS.includes(k));
  if (extra.length) fail(`'${extra[0]}'`, `is not a tour key (it takes ${KEYS.join(', ')})`);
  if (!Array.isArray(spec.stops) || !spec.stops.length) fail('stops', 'is a list of one stop or more');
  if (spec.stops.length > TOUR_LIMITS.stops) fail('stops', `has ${spec.stops.length}; a tour holds at most ${TOUR_LIMITS.stops}`);
  const known = new Set(groups);
  const groupMatch = (g, at) => {
    if (typeof g !== 'string' || !g) fail(at, 'is a render group\'s name');
    if (known.has(g) || groups.some((k) => k.startsWith(`${g}:`))) return g;
    const list = [...known].sort();
    fail(at, `names no group '${g}' of this world (${list.length ? `its groups: ${list.slice(0, 40).join(', ')}${list.length > 40 ? ' …' : ''}` : 'it draws none a highlight can name'})`);
  };
  const ids = new Set();
  const stops = spec.stops.map((s, i) => {
    const at = `stops[${i}]`;
    if (!isObj(s)) fail(at, 'is { caption, camera, … }');
    const bad = Object.keys(s).filter((k) => !STOP_KEYS.includes(k));
    if (bad.length) fail(`${at}`, `has '${bad[0]}' (a stop takes ${STOP_KEYS.join(', ')})`);
    const id = s.id === undefined ? `s${i + 1}` : s.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) fail(`${at}.id`, 'is lowercase letters, digits and dashes, up to 32');
    if (ids.has(id)) fail(`${at}.id`, `repeats '${id}'`);
    ids.add(id);
    if (s.camera === undefined) fail(`${at}.camera`, "is required: a camera's name, { pos, target } or { frame }");
    const camera = readCamera(s.camera, `${at}.camera`, cameras, groupMatch);
    let highlight;
    if (s.highlight !== undefined) {
      const hs = Array.isArray(s.highlight) ? s.highlight : [s.highlight];
      if (hs.length > TOUR_LIMITS.highlight) fail(`${at}.highlight`, `names ${hs.length} groups; at most ${TOUR_LIMITS.highlight}`);
      highlight = [...new Set(hs.map((g, k) => groupMatch(g, `${at}.highlight[${k}]`)))];
    }
    if (s.shape !== undefined && !TOUR_SHAPES.includes(s.shape)) fail(`${at}.shape`, `is one of ${TOUR_SHAPES.join(', ')}`);
    if (s.grade !== undefined && !(s.grade in TOUR_GRADES)) fail(`${at}.grade`, `is one of ${Object.keys(TOUR_GRADES).join(', ')}`);
    let cite;
    if (s.cite !== undefined) {
      const cs = Array.isArray(s.cite) ? s.cite : [s.cite];
      if (!cs.length || cs.length > TOUR_LIMITS.cite) fail(`${at}.cite`, `names one source to ${TOUR_LIMITS.cite}`);
      cite = cs.map((c, k) => text(c, `${at}.cite[${k}]`, TOUR_LIMITS.citeLength, { required: true }));
    }
    let stated;
    if (s.claims !== undefined) {
      const ids = Array.isArray(s.claims) ? s.claims : [s.claims];
      if (!claimOf.size) fail(`${at}.claims`, 'names claims, and the recipe states none: give it a brief with claims ({ curation: { aims, claims } })');
      stated = [...new Set(ids)].map((id, k) => {
        if (!claimOf.has(id)) fail(`${at}.claims[${k}]`, `names no claim '${id}' (the brief's: ${[...claimOf.keys()].join(', ')})`);
        return claimOf.get(id);
      });
    }
    let captions;
    if (s.captions !== undefined) {
      if (!s.captions || typeof s.captions !== 'object' || Array.isArray(s.captions)) fail(`${at}.captions`, 'is { child?, specialist? } (the caption is everyone\'s)');
      const badA = Object.keys(s.captions).filter((k) => !OTHER_AUDIENCES.includes(k));
      if (badA.length) fail(`${at}.captions`, `has '${badA[0]}' (it takes child and specialist; the caption is everyone's)`);
      captions = Object.fromEntries(OTHER_AUDIENCES.filter((k) => s.captions[k] !== undefined).map((k) => [k, text(s.captions[k], `${at}.captions.${k}`, TOUR_LIMITS.caption, { required: true })]));
    }
    // a stop that states claims and says nothing itself of how sure it is or where it comes from takes theirs
    const grade = s.grade ?? (stated ? gradeOfClaims(stated) : undefined);
    if (!cite && stated) { const from = [...new Set(stated.flatMap((c) => c.cite || []))].slice(0, TOUR_LIMITS.cite); if (from.length) cite = from; }
    return {
      id,
      ...(s.title !== undefined ? { title: text(s.title, `${at}.title`, TOUR_LIMITS.title) } : {}),
      caption: text(s.caption, `${at}.caption`, TOUR_LIMITS.caption, { required: true }),
      camera,
      ...(highlight ? { highlight } : {}),
      ...(s.shape !== undefined ? { shape: s.shape } : {}),
      ...(cite ? { cite } : {}),
      ...(grade !== undefined ? { grade } : {}),
      ...(stated ? { claims: stated.map((c) => c.id) } : {}),
      ...(captions && Object.keys(captions).length ? { captions } : {}),
    };
  });
  // the audiences the page offers: everyone's caption, and each other one any stop says
  const audiences = ['general', ...OTHER_AUDIENCES.filter((a) => stops.some((st) => st.captions && st.captions[a]))];
  let start = 0;
  if (spec.start !== undefined) {
    start = typeof spec.start === 'string' ? stops.findIndex((s) => s.id === spec.start) : spec.start;
    if (!Number.isInteger(start) || start < 0 || start >= stops.length) fail('start', `is a stop's index (0 to ${stops.length - 1}) or its id`);
  }
  return {
    ...(spec.title !== undefined ? { title: text(spec.title, 'title', TOUR_LIMITS.title) } : {}),
    ...(start ? { start } : {}),
    ...(audiences.length > 1 ? { audiences } : {}),
    stops,
  };
}
