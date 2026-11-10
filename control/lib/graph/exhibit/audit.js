/**
 * THE EXHIBIT AUDIT: an exhibit has no win to prove, so its machine gate asks what a curator asks of a label wall. Does
 * the visitor get a story (a tour), is each claim graded and the record's claims cited, can a stop be read in the time a
 * visitor gives it, does each stop show something (a lit part or a view of its own)? A gallery's rooms are each asked.
 *
 * It advises and stamps; it never refuses (the two gates: this is the machine's, measured; the eyes gate is the
 * operator's, and the accuracy of a claim is the expert's, never this audit's or the agent's). The page half (every
 * stop framed: its lit parts on screen, above the plate) is measured in a browser: scripts/exhibit-audit.mjs, through
 * the page's own window.__mojTour.view(). Pure and deterministic.
 */
import { TOUR_GRADES } from './tour.js';

/** How long a stop is held when the tour plays itself: as long as its caption takes to read (the page's own rule). */
export const holdSeconds = (caption) => Math.min(20, Math.max(7, 2.5 + String(caption).split(/\s+/).filter(Boolean).length / 3.2));
const words = (s) => String(s ?? '').split(/\s+/).filter(Boolean).length;
const CAPTION_WORDS = 60;

const finding = (level, code, says, at) => ({ level, code, says, ...(at !== undefined ? { at } : {}) });

/** One tour (its read form, exhibit/tour.js), as a visitor meets it: { stops, graded, cited, lit, words, seconds, findings }. */
export function auditTour(tour) {
  if (!tour || !Array.isArray(tour.stops) || !tour.stops.length) {
    return { stops: 0, findings: [finding('advice', 'no-tour', 'no tour: a visitor gets a free orbit and no story; give it stops (manual: get_view_vocab({ id: \'tour\' }))')] };
  }
  const findings = [];
  let graded = 0, cited = 0, lit = 0, total = 0, seconds = 0;
  tour.stops.forEach((s, i) => {
    const at = s.id || `s${i + 1}`, n = words(s.caption);
    total += n; seconds += holdSeconds(s.caption);
    if (s.grade) graded += 1; else findings.push(finding('advice', 'ungraded', 'says nothing of how sure it is: give it a grade', at));
    if (s.cite) cited += 1;
    else if (s.grade && TOUR_GRADES[s.grade] === 'record') findings.push(finding('warn', 'uncited-claim', `is graded ${s.grade} from a record and cites none: a visitor may ask how we know`, at));
    if (s.highlight?.length) lit += 1;
    if (n > CAPTION_WORDS) findings.push(finding('advice', 'long-caption', `is ${n} words; a stop reads best under ${CAPTION_WORDS} (split it, or say less)`, at));
    const prev = tour.stops[i - 1];
    if (prev && JSON.stringify(prev.camera) === JSON.stringify(s.camera) && JSON.stringify(prev.highlight || null) === JSON.stringify(s.highlight || null)) {
      findings.push(finding('advice', 'same-view', `shows what ${prev.id} showed: a visitor sees nothing move`, at));
    }
  });
  if (!lit && tour.stops.length > 1) findings.push(finding('advice', 'nothing-lit', 'no stop lights the part it is about: name the groups each caption talks of (highlight)'));
  return { stops: tour.stops.length, graded, cited, lit, words: total, seconds: Math.round(seconds), findings };
}

/**
 * An exhibit's audit: { gate: 'machine', ran, tour, findings, warnings }. `tour` is the read tour (payload.tour) or null.
 * For a gallery pass `rooms`: [{ ref, title, tour }] and each room is audited, its findings tagged with its ref.
 */
export function auditExhibit({ tour = null, rooms = null } = {}) {
  if (Array.isArray(rooms)) {
    const each = rooms.map((r) => ({ ref: r.ref, title: r.title, ...auditTour(r.tour) }));
    const findings = each.flatMap((r) => r.findings.map((f) => ({ ...f, room: r.ref })));
    return {
      gate: 'machine', ran: ['rooms', 'tours', 'claims', 'reading'],
      rooms: each.map(({ findings: _f, ...r }) => r),
      seconds: each.reduce((a, r) => a + (r.seconds || 0), 0),
      findings, warnings: findings.filter((f) => f.level === 'warn').length,
      eyes: 'not run: the operator looks at each room, stop by stop',
    };
  }
  const t = auditTour(tour);
  return {
    gate: 'machine', ran: ['tour', 'claims', 'reading'],
    tour: (({ findings: _f, ...r }) => r)(t),
    findings: t.findings, warnings: t.findings.filter((f) => f.level === 'warn').length,
    eyes: 'not run: the operator looks at each stop',
  };
}
