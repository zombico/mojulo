/**
 * order — a CUSTOM ORDER: a cutscene asked of the animation studio by a client (the game studio, for one), who hands
 * over what it already has: its characters, its places and its notes on what happens. The studio makes a film of it
 * and hands the cutscene back. The order is the film's brief, kept in its recipe (`order`), so the film says at every
 * read how far each event has got and what the client is waiting for.
 *
 *   THE ASK (film door: `film: { order }`):
 *     { title?, from?: <the client's ref: a game, a gameworld>, for?: '<what it is for: the prologue, a moment's id>',
 *       cast:   { <who>: <ref> | { persona? | hero?, register?, style?, role?, height? } },   the client's characters
 *       places: { <id>: <a stored world's ref> },                    its geocubes, levels, rooms: the sets
 *       events: [{ id, notes: '<what happens>', place?: <a place's id>, who?: [<who>], props?, script? }],
 *       look?: 'film' | 'anime', deliver?: 'animatic' | 'film' }
 *     An event is one scene. Its `notes` are the client's words for what happens; its `script`, where the client wrote
 *     one, is the scene's screenplay as given. An event with notes only is UNWRITTEN: its scene holds the notes in
 *     place of a screenplay and does not play until the script department writes it from them (advice `unwritten`).
 *
 *   orderErrors(O)  → error lines for an ask (empty = valid)
 *   filmOfOrder(O, { kindOf }) → the film recipe: its cast from the client's characters (`kindOf(ref)` says whether a
 *     ref is a persona or a hero), its sets from the places, a scene an event, and `order` (the brief it keeps):
 *     { from?, for?, deliver, events: [{ id, notes, place?, who }] }
 *   orderBriefErrors(B, F) → error lines for the brief a film keeps (film.js filmErrors)
 *   draftScript(notes)     → what stands for the screenplay of an event nobody has written yet
 *   isDraft(F, id)         → whether a scene still plays its holding screenplay
 *   orderReadout(F, scenes, { made, progress }) → { from?, for?, deliver, events: [{ id, notes, scene, state }],
 *     waiting: [<event id>], ready } where state is unwritten | written | boarded | approved | cut | filmed | rendered
 *     and `ready` says every event has reached what the client asked to have back
 *
 * Pure and deterministic.
 */
export const DELIVERIES = Object.freeze(['animatic', 'film']);
export const ORDER_KEYS = Object.freeze(['title', 'from', 'for', 'cast', 'places', 'events', 'look', 'deliver']);
export const EVENT_KEYS = Object.freeze(['id', 'notes', 'place', 'who', 'props', 'script']);
export const BRIEF_KEYS = Object.freeze(['from', 'for', 'deliver', 'events']);
export const ORDER_STATES = Object.freeze(['unwritten', 'written', 'boarded', 'approved', 'cut', 'filmed', 'rendered']);
const WORD = /^[a-z][a-z0-9_-]{0,31}$/;
const PART_KEYS = ['persona', 'hero', 'register', 'style', 'role', 'height'];
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Error lines for an ask (see the header) */
export function orderErrors(O) {
  const shape = 'an order is { cast: { <who>: <ref> }, places?: { <id>: <ref> }, events: [{ id, notes, place?, who? }], from?, for?, look?, deliver? }';
  if (!isPlain(O)) return [shape];
  const errs = [], extra = Object.keys(O).filter((k) => !ORDER_KEYS.includes(k));
  if (extra.length) errs.push(`an order takes ${ORDER_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (!isPlain(O.cast) || !Object.keys(O.cast).length) errs.push('cast: { <who>: <a character\'s ref> | { persona | hero } }: the characters the client hands over, one at least');
  else for (const [w, C] of Object.entries(O.cast)) {
    if (!WORD.test(w)) errs.push(`cast.${w}: a part's name is the name the script writes, lower case (a word)`);
    if (typeof C === 'string' ? !C : !isPlain(C) || Object.keys(C).some((k) => !PART_KEYS.includes(k))) errs.push(`cast.${w}: a character's ref, or { ${PART_KEYS.join('?, ')}? }`);
  }
  if (O.places !== undefined && (!isPlain(O.places) || Object.entries(O.places).some(([id, ref]) => !WORD.test(id) || typeof ref !== 'string' || !ref))) errs.push('places: { <id>: <a stored world\'s ref> }: the client\'s geocubes, levels and rooms, each named by a word');
  if (O.deliver !== undefined && !DELIVERIES.includes(O.deliver)) errs.push(`deliver: ${DELIVERIES.join(' | ')} (what the client wants back: the boards cut as a video, or the film rendered in Blender)`);
  for (const k of ['from', 'for', 'title']) if (O[k] !== undefined && (typeof O[k] !== 'string' || !O[k].trim())) errs.push(`${k}: words`);
  if (!Array.isArray(O.events) || !O.events.length) errs.push('events: [{ id, notes: \'<what happens>\', place?, who? }], one at least: each is a scene of the cutscene');
  else {
    const seen = new Set();
    O.events.forEach((E, i) => {
      const at = `events[${i}]`;
      if (!isPlain(E)) { errs.push(`${at}: { id, notes, place?, who?, props?, script? }`); return; }
      const bad = Object.keys(E).filter((k) => !EVENT_KEYS.includes(k));
      if (bad.length) errs.push(`${at}: an event takes ${EVENT_KEYS.join(', ')} (not ${bad.join(', ')})`);
      if (typeof E.id !== 'string' || !WORD.test(E.id)) errs.push(`${at}.id: a word (lower case letters, digits, - and _)`);
      else if (seen.has(E.id)) errs.push(`${at}.id: '${E.id}' names two events`);
      else seen.add(E.id);
      if (typeof E.notes !== 'string' || !E.notes.trim()) errs.push(`${at}.notes: what happens, in the client's words`);
      if (E.script !== undefined && (typeof E.script !== 'string' || !E.script.trim())) errs.push(`${at}.script: the scene's screenplay, where the client wrote one`);
      if (E.place !== undefined && !(isPlain(O.places) && Object.hasOwn(O.places, E.place))) errs.push(`${at}.place: '${E.place}' is not one of the order's places (${isPlain(O.places) ? Object.keys(O.places).join(', ') || 'none' : 'none'})`);
      if (E.who !== undefined && !(Array.isArray(E.who) && E.who.length && E.who.every((w) => isPlain(O.cast) && Object.hasOwn(O.cast, w)))) errs.push(`${at}.who: who is in it, each one of the order's cast (${isPlain(O.cast) ? Object.keys(O.cast).join(', ') : ''})`);
    });
  }
  return errs;
}

/** What stands for the screenplay of an event nobody has written yet: the client's notes, marked. It is not a
 * screenplay and does not play: the scene reads as unwritten until the script department writes it */
export const draftScript = (notes) => `[to be written from the client's notes] ${String(notes).trim()}`;

/** The film an order asks for (see the header) */
export function filmOfOrder(O, { kindOf = () => 'hero' } = {}) {
  const errs = orderErrors(O);
  if (errs.length) throw new Error(`order refused:\n - ${errs.join('\n - ')}`);
  const cast = Object.fromEntries(Object.entries(O.cast).map(([w, C]) => [w, typeof C === 'string' ? { [kindOf(C) === 'persona' ? 'persona' : 'hero']: C } : C]));
  const all = Object.keys(cast);
  const events = O.events.map((E) => ({ id: E.id, notes: E.notes.trim(), ...(E.place !== undefined ? { place: E.place } : {}), who: E.who ?? all }));
  return {
    ...(O.title ? { title: O.title } : {}),
    cast,
    ...(O.places && Object.keys(O.places).length ? { sets: O.places } : {}),
    ...(O.look ? { look: O.look } : {}),
    scenes: O.events.map((E, i) => ({
      id: E.id, ...(E.place !== undefined ? { set: E.place } : {}), cast: Object.fromEntries(events[i].who.map((w) => [w, {}])),
      ...(E.props ? { props: E.props } : {}), script: E.script ?? draftScript(E.notes),
    })),
    edit: { order: O.events.map((E) => E.id) },
    order: { ...(O.from ? { from: O.from } : {}), ...(O.for ? { for: O.for } : {}), deliver: O.deliver ?? 'animatic', events },
  };
}

/** Error lines for the brief a film keeps (see the header) */
export function orderBriefErrors(B, F) {
  if (!isPlain(B)) return ['order: { from?, for?, deliver, events: [{ id, notes, place?, who }] } (written by film: { order })'];
  const errs = [], extra = Object.keys(B).filter((k) => !BRIEF_KEYS.includes(k));
  if (extra.length) errs.push(`order takes ${BRIEF_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (!DELIVERIES.includes(B.deliver)) errs.push(`order.deliver: ${DELIVERIES.join(' | ')}`);
  if (!Array.isArray(B.events) || !B.events.length || B.events.some((E) => !isPlain(E) || typeof E.id !== 'string' || typeof E.notes !== 'string' || !Array.isArray(E.who))) errs.push('order.events: [{ id, notes, place?, who }], the client\'s events');
  else { const ids = new Set((Array.isArray(F?.scenes) ? F.scenes : []).map((S) => S?.id)); for (const E of B.events) if (!ids.has(E.id)) errs.push(`order.events: event '${E.id}' has no scene (a scene of that id plays it)`); }
  return errs;
}

/** Whether a scene still plays its holding screenplay */
export function isDraft(F, id) {
  const E = F.order?.events?.find((e) => e.id === id), S = F.scenes.find((s) => s.id === id);
  return !!E && !!S && S.script === draftScript(E.notes);
}

/** How far an order has got (see the header). `scenes`: the readout's scene rows (film/readout.js) */
export function orderReadout(F, scenes, { made = {}, progress = null } = {}) {
  const B = F.order;
  if (!B) return null;
  const want = B.deliver === 'film' ? 'rendered' : 'cut';
  const events = B.events.map((E) => {
    const row = scenes.find((s) => s.id === E.id), stamp = row?.stamp;
    let state = 'written';
    if (isDraft(F, E.id)) state = 'unwritten';
    else if (progress?.scenes?.[E.id]?.encoded) state = 'rendered';
    else if (made.blender?.scenes?.[E.id]?.stamp === stamp && stamp) state = 'filmed';
    else if (made.animatic && made.storyboard?.scenes?.[E.id]?.stamp === stamp && stamp) state = 'cut';
    else if (row?.board === 'approved') state = 'approved';
    else if (made.storyboard?.scenes?.[E.id]?.stamp === stamp && stamp) state = 'boarded';
    return { id: E.id, notes: E.notes, ...(E.place ? { place: E.place } : {}), who: E.who, scene: E.id, state };
  });
  const reached = (s) => ORDER_STATES.indexOf(s) >= ORDER_STATES.indexOf(want);
  const waiting = events.filter((e) => !reached(e.state)).map((e) => e.id);
  return { ...(B.from ? { from: B.from } : {}), ...(B.for ? { for: B.for } : {}), deliver: B.deliver, events, waiting, ready: waiting.length === 0 };
}
