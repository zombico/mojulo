/**
 * readout — what a film's studio says of it: each scene as played (its parts, lines, seconds, shots, recordings, dubs,
 * set, its board's approval), each department's state and its advice, the waves, and what to do next. The door
 * (lib/mcp/tools/film.js) does the IO (each scene's set read and recordings bound, its plan) and hands the results in.
 * It advises and never refuses: a scene whose script will not play is said, by name, and the film reads on.
 *
 *   filmReadout(F, played, { approvals?, made?, ref? }) → { title, scenes, departments, waves, advice, next, approved }
 *     played  { <scene id>: { plan?: { S, coverage, notes }, set?, advice?: [], error?: <message> } }
 *     approvals  { <scene id>: { board: <stamp>, at } } (the person's, per scene: actor's eyes gate)
 *     sets    [{ id, ref, kind?, show?, asked?, read?, unread? }]: each set's world, and what a place asked for in words
 *             read (the door reads the worlds)
 *     made    { storyboard?, animatic?, blender?: { motion_ref, scenes: { <id>: { stamp } }, pending? } }
 *     progress  the render worker's record (scripts/render-film.mjs render.json), read by the door: { dir, scenes:
 *               { <id>: { preset, frames, done, encoded } }, cut }
 *
 * Pure.
 */
import { DEPARTMENTS, ADVICE_HOME, departmentWaves, departmentStates } from './departments.js';
import { sceneOrder, sceneStamp } from './film.js';
import { orderReadout, isDraft } from './order.js';
import { proposeLocation } from './location.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

/** what a hand-back was made of: every scene's stamp, in order (a change since reads as not current) */
export const orderStamp = (F) => sceneOrder(F).map((id) => sceneStamp(F, id)).join('.');

/** The film's readout (see the header) */
export function filmReadout(F, played, { approvals = {}, made = {}, ref = null, progress = null, sets = null } = {}) {
  const order = sceneOrder(F), advice = [];
  const scenes = order.map((id) => {
    const P = played[id] ?? {}, stamp = sceneStamp(F, id), A = approvals[id];
    const approval = A ? (A.board === stamp ? 'approved' : 'stale') : 'open';
    const row = { id, stamp, ...(F.scenes.find((s) => s.id === id).set ? { set: F.scenes.find((s) => s.id === id).set } : {}), board: approval };
    // (an event of an order nobody has written yet is said below, as unwritten, with the client's notes)
    if (P.error && isDraft(F, id)) return { ...row, unwritten: true };
    if (P.error) { advice.push({ id: 'scene-refused', scene: id, says: `scene ${id} does not play: ${P.error}`, try: 'mend the scene\'s script or cast (the message names what it takes)' }); return { ...row, error: P.error }; }
    const S = P.plan.S, turns = S.turns;
    for (const n of P.plan.notes ?? []) advice.push({ ...n, scene: id });
    for (const a of P.advice ?? []) advice.push({ ...a, scene: id });
    const recorded = turns.filter((T) => T.recording).length;
    if (recorded && recorded < turns.length) advice.push({ id: 'part-voiced', scene: id, says: `scene ${id}: ${recorded} of ${turns.length} lines are recorded (lines ${turns.map((T, k) => (T.recording ? null : k + 1)).filter(Boolean).join(', ')} are read from their words)`, try: 'record the rest (the voice worker, in each part\'s voice), or none: a scene is timed by one or the other throughout' });
    if (approval === 'stale') advice.push({ id: 'stale', scene: id, says: `scene ${id} changed since its board was approved`, try: 'run its storyboard again and look before approving it again' });
    else if (approval === 'open' && made.storyboard) advice.push({ id: 'unapproved', scene: id, says: `scene ${id}'s board is not approved`, try: `look at it in the film's book and approve it: film: { ref, approve: { ${id}: 'board' } }` });
    const pr = progress?.scenes?.[id];
    return {
      ...row, ...(pr ? { render: pr } : {}), parts: Object.keys(S.actors), lines: turns.length, seconds: r3(S.seconds), shots: P.plan.coverage.shots.length,
      ...(recorded ? { recorded } : {}), ...(F.scenes.find((s) => s.id === id).dub ? { dubs: Object.keys(F.scenes.find((s) => s.id === id).dub) } : {}),
      ...(P.set ? { place: { world: P.set.ref, title: P.set.title, places: P.set.places } } : {}),
    };
  });
  // (a film made to order: an event the client gave as notes only still plays its holding screenplay)
  for (const E of F.order?.events ?? []) if (isDraft(F, E.id)) advice.push({ id: 'unwritten', scene: E.id, says: `scene ${E.id} is not written yet. The client's notes: ${E.notes}`, try: `write its screenplay from the notes: film: { ref, patch: [{ op: 'set', path: '/scenes/${F.scenes.findIndex((s) => s.id === E.id)}/script', value: 'NAME: the line …' }] }` });
  // THE SET DEPARTMENT'S LOCATION JOB (film/location.js): a scene with no set plays on a bare stage; where its words
  // name a place (a client's notes on the event, else its script), the place is proposed, with the hour they name
  F.scenes.forEach((S, i) => {
    if (S.set !== undefined) return;
    const P = proposeLocation(F.order?.events?.find((e) => e.id === S.id)?.notes ?? S.script);
    if (!P) return;
    const id = Object.hasOwn(F.sets ?? {}, S.id) ? `${S.id}-set` : S.id;
    const patch = [{ op: 'set', path: `/sets/${id}`, value: P.ask }, { op: 'set', path: `/scenes/${i}/set`, value: id }, ...(P.hour && S.hour === undefined ? [{ op: 'set', path: `/scenes/${i}/hour`, value: P.hour }] : [])];
    advice.push({ id: 'no-set', scene: S.id, says: `scene ${S.id} has no set and plays on a bare stage. Its words (${P.from.join(', ')}) ask for ${P.kind === 'room' ? `a ${P.ask.room} room` : P.kind === 'geotown' ? 'a street of houses' : P.kind === 'geocity' ? 'a city' : 'a land'}${P.hour && S.hour === undefined ? `, at ${P.hour}` : ''}`, try: `film: { ref, patch: ${JSON.stringify(patch)} }`, proposal: P });
  });
  // (a set asked for in words: a word nothing read is said, with what was read, so the words can be mended)
  for (const T of sets ?? []) if (T.unread?.length) advice.push({ id: 'words-unread', set: T.id, says: `the set ${T.id} did not read: ${T.unread.join(', ')} (it read: ${T.read.join(', ') || 'nothing'})`, try: `say it in words a place is made of (the land, what grows, the water, the sky, the hour), or dress the scene with it: film: { ref, patch: [{ op: 'set', path: '/sets/${T.id}/words', value: '…' }] }` });
  // (the cast: a part with no body plays the default hero; a part no scene names)
  for (const [w, C] of Object.entries(F.cast)) {
    if (C.persona === undefined && C.hero === undefined) advice.push({ id: 'no-body', part: w, says: `${w} has no persona or hero: the default realistic hero plays the part`, try: `cast it: cast.${w}.persona (create_character as 'persona') or cast.${w}.hero` });
    if (!F.scenes.some((S) => Object.hasOwn(S.cast, w))) advice.push({ id: 'idle-part', part: w, says: `${w} is in no scene`, try: 'give the part a scene, or take it out of the cast' });
  }
  const approved = scenes.length > 0 && scenes.every((s) => s.board === 'approved');
  const states = departmentStates(F, advice, { approved });
  const departments = DEPARTMENTS.map((D) => ({ id: D.id, name: D.name, owner: D.owner, state: states[D.id], does: D.does, advice: advice.filter((a) => ADVICE_HOME[a.id] === D.id).length }));
  const waves = departmentWaves();
  // (what to do next: the advised departments in wave order, then the runs a film goes through)
  const next = [];
  for (const wave of waves) for (const id of wave) {
    const own = advice.filter((a) => ADVICE_HOME[a.id] === id && id !== 'render');
    if (own.length) next.push({ department: id, says: `${DEPARTMENTS.find((D) => D.id === id).name}: ${own.length} to answer, first: ${own[0].says}`, try: own[0].try });
  }
  if (!made.storyboard) next.push({ department: 'render', says: 'no boards yet', try: "film: { ref, run: 'storyboard' } (seconds: no actor minted)" });
  else if (!approved) next.push({ department: 'render', says: `${scenes.filter((s) => s.board !== 'approved').length} of ${scenes.length} boards to look at`, try: "read the book, then film: { ref, approve: { <scene>: 'board' } }" });
  else if (!made.animatic) next.push({ department: 'render', says: 'the boards are approved', try: "film: { ref, run: 'animatic' } (the cut, with its sound)" });
  else if (!made.blender || made.blender.pending?.length) next.push({ department: 'render', says: made.blender?.pending?.length ? `${made.blender.pending.length} scene(s) still to film` : 'the cut is made', try: "film: { ref, run: 'blender' } (each actor minted: minutes a scene; resumable)" });
  else if (progress && !progress.cut) {
    const left = scenes.filter((s) => !s.render?.encoded);
    next.push({ department: 'render', says: left.length ? `${left.length} scene(s) to render in Blender (${left.map((s) => `${s.id} ${s.render ? `${s.render.done}/${s.render.frames}` : 'not started'}`).join(', ')})` : 'every scene is rendered; the cut is not', try: `on a machine with Blender: node scripts/render-film.mjs ${progress.dir} --preset final (resumable: run it again to go on)` });
  }
  // (made to order: how far each event has got, and the hand-back once every one is where the client asked)
  const brief = orderReadout(F, scenes, { made, progress });
  if (brief?.ready && made.delivered?.stamp !== orderStamp(F)) next.push({ department: 'render', says: `the order is ready to hand back${brief.from ? ` to ${brief.from}` : ''}`, try: 'film: { ref, deliver: true }' });
  return {
    ...(ref ? { ref } : {}), title: F.title ?? null, ...(sets?.length ? { sets } : {}), ...(brief ? { order: { ...brief, ...(made.delivered ? { delivered: { at: made.delivered.at, current: made.delivered.stamp === orderStamp(F) } } : {}) } } : {}), scenes, departments, waves, advice: advice.map((a) => ({ ...a, department: ADVICE_HOME[a.id] ?? 'script' })),
    next, approved, ...(ref ? { book: `/api/sketches/${encodeURIComponent(ref)}/bible?book=film` } : {}),
  };
}
