/**
 * readout — what a film's studio says of it: each scene as played (its parts, lines, seconds, shots, recordings, dubs,
 * set, its board's approval), each department's state and its advice, the waves, and what to do next. The door
 * (lib/mcp/tools/film.js) does the IO (each scene's set read and recordings bound, its plan) and hands the results in.
 * It advises and never refuses: a scene whose script will not play is said, by name, and the film reads on.
 *
 *   filmReadout(F, played, { approvals?, made?, ref? }) → { title, scenes, departments, waves, advice, next, approved }
 *     played  { <scene id>: { plan?: { S, coverage, notes }, set?, advice?: [], error?: <message> } }
 *     approvals  { <scene id>: { board: <stamp>, at } } (the person's, per scene: actor's eyes gate)
 *     made    { storyboard?, animatic?, blender?: { motion_ref, scenes: { <id>: { stamp } }, pending? } }
 *
 * Pure.
 */
import { DEPARTMENTS, ADVICE_HOME, departmentWaves, departmentStates } from './departments.js';
import { sceneOrder, sceneStamp } from './film.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

/** The film's readout (see the header) */
export function filmReadout(F, played, { approvals = {}, made = {}, ref = null } = {}) {
  const order = sceneOrder(F), advice = [];
  const scenes = order.map((id) => {
    const P = played[id] ?? {}, stamp = sceneStamp(F, id), A = approvals[id];
    const approval = A ? (A.board === stamp ? 'approved' : 'stale') : 'open';
    const row = { id, stamp, ...(F.scenes.find((s) => s.id === id).set ? { set: F.scenes.find((s) => s.id === id).set } : {}), board: approval };
    if (P.error) { advice.push({ id: 'scene-refused', scene: id, says: `scene ${id} does not play: ${P.error}`, try: 'mend the scene\'s script or cast (the message names what it takes)' }); return { ...row, error: P.error }; }
    const S = P.plan.S, turns = S.turns;
    for (const n of P.plan.notes ?? []) advice.push({ ...n, scene: id });
    for (const a of P.advice ?? []) advice.push({ ...a, scene: id });
    const recorded = turns.filter((T) => T.recording).length;
    if (recorded && recorded < turns.length) advice.push({ id: 'part-voiced', scene: id, says: `scene ${id}: ${recorded} of ${turns.length} lines are recorded (lines ${turns.map((T, k) => (T.recording ? null : k + 1)).filter(Boolean).join(', ')} are read from their words)`, try: 'record the rest (the voice worker, in each part\'s voice), or none: a scene is timed by one or the other throughout' });
    if (approval === 'stale') advice.push({ id: 'stale', scene: id, says: `scene ${id} changed since its board was approved`, try: 'run its storyboard again and look before approving it again' });
    else if (approval === 'open' && made.storyboard) advice.push({ id: 'unapproved', scene: id, says: `scene ${id}'s board is not approved`, try: `look at it in the film's book and approve it: film: { ref, approve: { ${id}: 'board' } }` });
    return {
      ...row, parts: Object.keys(S.actors), lines: turns.length, seconds: r3(S.seconds), shots: P.plan.coverage.shots.length,
      ...(recorded ? { recorded } : {}), ...(F.scenes.find((s) => s.id === id).dub ? { dubs: Object.keys(F.scenes.find((s) => s.id === id).dub) } : {}),
      ...(P.set ? { place: { world: P.set.ref, title: P.set.title, places: P.set.places } } : {}),
    };
  });
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
  return {
    ...(ref ? { ref } : {}), title: F.title ?? null, scenes, departments, waves, advice: advice.map((a) => ({ ...a, department: ADVICE_HOME[a.id] ?? 'script' })),
    next, approved, ...(ref ? { book: `/api/sketches/${encodeURIComponent(ref)}/bible?book=film` } : {}),
  };
}
