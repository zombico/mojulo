/**
 * THE BRIEF: the expert's half of an exhibit. The studio (the operator's agent) owns the craft, the camera and the
 * caption's music; the expert (a curator, a teacher, a museum's educator) owns what the exhibit claims and whom it is
 * for. It rides an exhibit's or a gallery's recipe as `curation` (`brief` is another kind's word on a recipe):
 *
 *   curation: {
 *     aims: ['…'],                       what a visitor should leave understanding (one to six)
 *     audiences?: ['child', 'specialist'],  who it is written for besides everyone: a stop's `captions` say it their way
 *     claims?: [{ id, text, cite, grade }], what it states as fact, each with where it comes from and how sure it is
 *     expert?: { name, role? },           who answers for the claims (as the operator names them)
 *     signoff?: { by, on, claims },       the expert's sign-off, as signed: recorded ONLY when the operator says the
 *                                          expert signed; `claims: 'all'` is stamped at write with a copy of each claim
 *   }
 *
 * THE ACCURACY GATE is the third gate, beside the machine's and the eyes': whether a claim is TRUE. It is the expert's
 * alone. It advises and stamps, never refuses, and the agent never claims it: accuracyOf reads the sign-off against the
 * claims as they are now, so a claim edited after the expert signed reads as changed, not as signed.
 * Pure and deterministic.
 */
import { TOUR_GRADES } from './tour.js';

export const AUDIENCES = Object.freeze(['child', 'general', 'specialist']);
export const AUDIENCE_WORDS = Object.freeze({ child: 'Young visitors', general: 'Everyone', specialist: 'In depth' });
export const BRIEF_LIMITS = Object.freeze({ aims: 6, aim: 200, claims: 40, claim: 400, cite: 6, citeLength: 240, name: 90 });

const KEYS = ['aims', 'audiences', 'claims', 'expert', 'signoff'];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const fail = (at, says) => { throw new Error(`curation: ${at} ${says}`); };
const text = (v, at, max) => {
  if (typeof v !== 'string' || !v.trim()) fail(at, 'is a non-empty string');
  if (v.trim().length > max) fail(at, `is ${v.trim().length} characters; at most ${max}`);
  return v.trim();
};
const list = (v) => (Array.isArray(v) ? v : [v]);

/** A brief, checked; returns its stored form. */
export function readBrief(spec) {
  if (!isObj(spec)) fail('', 'is { aims: [\'…\'], audiences?, claims?, expert?, signoff? }');
  const extra = Object.keys(spec).filter((k) => !KEYS.includes(k));
  if (extra.length) fail(`'${extra[0]}'`, `is not a brief key (it takes ${KEYS.join(', ')})`);
  const aims = list(spec.aims ?? []);
  if (!aims.length || aims.length > BRIEF_LIMITS.aims) fail('aims', `is what a visitor should leave understanding: one to ${BRIEF_LIMITS.aims}`);
  const out = { aims: aims.map((a, i) => text(a, `aims[${i}]`, BRIEF_LIMITS.aim)) };
  if (spec.audiences !== undefined) {
    const au = [...new Set(list(spec.audiences))];
    const bad = au.find((a) => !AUDIENCES.includes(a));
    if (bad !== undefined) fail('audiences', `names '${bad}'; it is any of ${AUDIENCES.join(', ')}`);
    out.audiences = AUDIENCES.filter((a) => au.includes(a));
  }
  if (spec.claims !== undefined) {
    const cs = list(spec.claims);
    if (cs.length > BRIEF_LIMITS.claims) fail('claims', `has ${cs.length}; at most ${BRIEF_LIMITS.claims}`);
    const ids = new Set();
    out.claims = cs.map((c, i) => {
      const at = `claims[${i}]`;
      if (!isObj(c)) fail(at, 'is { id, text, cite, grade }');
      const bad = Object.keys(c).filter((k) => !['id', 'text', 'cite', 'grade'].includes(k));
      if (bad.length) fail(at, `has '${bad[0]}' (a claim takes id, text, cite, grade)`);
      if (typeof c.id !== 'string' || !ID_RE.test(c.id)) fail(`${at}.id`, 'is lowercase letters, digits and dashes, up to 32');
      if (ids.has(c.id)) fail(`${at}.id`, `repeats '${c.id}'`);
      ids.add(c.id);
      if (c.grade !== undefined && !(c.grade in TOUR_GRADES)) fail(`${at}.grade`, `is one of ${Object.keys(TOUR_GRADES).join(', ')}`);
      let cite;
      if (c.cite !== undefined) {
        const cl = list(c.cite);
        if (!cl.length || cl.length > BRIEF_LIMITS.cite) fail(`${at}.cite`, `names one source to ${BRIEF_LIMITS.cite}`);
        cite = cl.map((x, k) => text(x, `${at}.cite[${k}]`, BRIEF_LIMITS.citeLength));
      }
      return { id: c.id, text: text(c.text, `${at}.text`, BRIEF_LIMITS.claim), ...(cite ? { cite } : {}), ...(c.grade ? { grade: c.grade } : {}) };
    });
  }
  if (spec.expert !== undefined) {
    if (!isObj(spec.expert) || Object.keys(spec.expert).some((k) => !['name', 'role'].includes(k))) fail('expert', 'is { name, role? }');
    out.expert = { name: text(spec.expert.name, 'expert.name', BRIEF_LIMITS.name), ...(spec.expert.role !== undefined ? { role: text(spec.expert.role, 'expert.role', BRIEF_LIMITS.name) } : {}) };
  }
  if (spec.signoff !== undefined) {
    const so = spec.signoff;
    if (!isObj(so) || Object.keys(so).some((k) => !['by', 'on', 'claims'].includes(k))) fail('signoff', "is { by, on: 'YYYY-MM-DD', claims: 'all' } (recorded only when the operator says the expert signed)");
    if (!out.claims?.length) fail('signoff', 'signs claims, and this brief states none');
    const on = text(so.on, 'signoff.on', 10);
    if (!DATE_RE.test(on)) fail('signoff.on', "is the day the expert signed, 'YYYY-MM-DD'");
    let signed;
    if (so.claims === 'all') signed = 'all';
    else if (Array.isArray(so.claims) && so.claims.every((c) => isObj(c) && typeof c.id === 'string' && typeof c.text === 'string')) signed = so.claims.map((c) => ({ id: c.id, text: c.text }));
    else fail('signoff.claims', "is 'all' (stamped with a copy of each claim as it stands), or the stamped copy");
    out.signoff = { by: text(so.by, 'signoff.by', BRIEF_LIMITS.name), on, claims: signed };
  }
  return out;
}

/** At write: a sign-off of `claims: 'all'` is stamped with a copy of each claim as it stands, the record of what was
 * signed. Anything else is returned as it is. */
export function stampSignoff(brief) {
  if (!isObj(brief) || !isObj(brief.signoff) || brief.signoff.claims !== 'all' || !Array.isArray(brief.claims)) return brief;
  return { ...brief, signoff: { ...brief.signoff, claims: brief.claims.map((c) => ({ id: c.id, text: typeof c.text === 'string' ? c.text.trim() : c.text })) } };
}

/**
 * The accuracy gate's reading: { gate: 'accuracy', state, total, signed, changed, unsigned, by?, on? }. state is
 * 'no-claims' | 'unsigned' | 'signed' (every claim as the expert signed it) | 'changed' (some claim edited since, or
 * added since: unsigned). Never 'passed': whether a claim is true is the expert's, and this reads only their record.
 */
export function accuracyOf(brief) {
  const claims = brief?.claims || [];
  if (!claims.length) return { gate: 'accuracy', state: 'no-claims', total: 0, signed: 0, says: 'the exhibit states no claims: nothing for an expert to sign' };
  const so = brief.signoff;
  if (!so || !Array.isArray(so.claims)) {
    return { gate: 'accuracy', state: 'unsigned', total: claims.length, signed: 0, unsigned: claims.map((c) => c.id), says: 'not signed: whether these claims are true is the expert\'s to say; the agent never signs' };
  }
  const was = new Map(so.claims.map((c) => [c.id, c.text]));
  const changed = claims.filter((c) => was.has(c.id) && was.get(c.id) !== c.text).map((c) => c.id);
  const unsigned = claims.filter((c) => !was.has(c.id)).map((c) => c.id);
  const signed = claims.length - changed.length - unsigned.length;
  const state = changed.length || unsigned.length ? 'changed' : 'signed';
  return {
    gate: 'accuracy', state, total: claims.length, signed, by: so.by, on: so.on,
    ...(changed.length ? { changed } : {}), ...(unsigned.length ? { unsigned } : {}),
    says: state === 'signed' ? `signed by ${so.by} on ${so.on}, every claim as it stands`
      : `signed by ${so.by} on ${so.on}, but ${changed.length ? `${changed.length} ${changed.length === 1 ? 'claim' : 'claims'} changed since` : ''}${changed.length && unsigned.length ? ' and ' : ''}${unsigned.length ? `${unsigned.length} added since` : ''}: ask the expert again`,
  };
}

/** A stop's grade from its claims: the least sure of them within one family (a record's or a science's), else the first's. */
export function gradeOfClaims(claims) {
  const graded = claims.filter((c) => c.grade);
  if (!graded.length) return undefined;
  const family = TOUR_GRADES[graded[0].grade];
  if (!graded.every((c) => TOUR_GRADES[c.grade] === family)) return graded[0].grade;
  const order = Object.keys(TOUR_GRADES).filter((g) => TOUR_GRADES[g] === family);   // surest first
  return graded.map((c) => c.grade).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
}
