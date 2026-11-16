/**
 * flow-films — a game's CUTSCENES that are films: a flow's cinematic step may name a film (`film`, the animation
 * studio's, made to the game's order: film/order.js) in place of a scene on a stage. The game's recipe keeps the ref;
 * the video is found each time the game is served or exported, so a cutscene made again is the one that plays.
 *
 *   flowFilms(flow)                 → [{ step, film }] the steps that name a film
 *   withFlowVideos(manifest, srcOf) → the manifest with each such step given `video` (srcOf(film) → the address the
 *                                     page loads it by, or null: the step is left without one and goes straight on),
 *                                     and `missing`: [{ step, film }] the films with no video yet. A game with no
 *                                     such step is returned as it was (the same object)
 *
 * Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The steps of a flow that name a film */
export function flowFilms(flow) {
  return Object.entries(isObj(flow?.steps) ? flow.steps : {}).filter(([, s]) => isObj(s) && s.kind === 'cinematic' && typeof s.film === 'string' && s.film).map(([step, s]) => ({ step, film: s.film }));
}

/** The manifest with its films' videos found (see the header) */
export function withFlowVideos(manifest, srcOf) {
  const films = flowFilms(manifest?.flow);
  if (!films.length) return { manifest, missing: [] };
  const steps = { ...manifest.flow.steps }, missing = [];
  for (const { step, film } of films) {
    const src = srcOf(film);
    if (src) steps[step] = { ...steps[step], video: src };
    else missing.push({ step, film });
  }
  return { manifest: { ...manifest, flow: { ...manifest.flow, steps } }, missing };
}
