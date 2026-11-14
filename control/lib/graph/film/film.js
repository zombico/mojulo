/**
 * film — a FILM: several scenes with one cast, their sets, one look and an edit, the animation studio's recipe (a sketch
 * row of kind `film`, its page its book). A scene is a screenplay (actor/scene.js) and is played, shot, boarded and
 * filmed by the same core as one screenplay forged alone (lib/mcp/tools/scene-film.js): `sceneScreenplay` is the seam.
 *
 *   THE RECIPE: { title?, cast: { <who>: { persona? | hero?, register?, style?, role?, height? } },
 *     sets?: { <id>: <a stored world's ref> }, look?: 'film' | 'anime', grade?, grain?, style?,
 *     render?: { light?: 'setups' | 'world', dof?: <an f-stop>, motion_blur?, samples? } (film/render-plan.js),
 *     scenes: [{ id, set?, cast: { <who>: { mark?, register?, style?, role?, height? } }, marks?, script, voice?, dub?,
 *       seed? }],
 *     edit?: { order?: [<scene id>], cuts?: { <scene id>: 'cut' | 'fade' } },
 *     order?: a client's brief, where the film was made to order (film/order.js) }
 *   A scene names who is in it (its `cast`'s keys, each the film's part), the film's words for each part under the
 *   scene's own. `who` is the name the script writes, lower case; a scene's id a word.
 *
 *   filmErrors(F) → error lines (empty = valid): the shape, every scene's part one of the film's, every set named one
 *     of the film's, the edit's scenes the film's. A scene's script is checked when it is played (the readout reports
 *     it, it never refuses the film)
 *   sceneScreenplay(F, id) → the screenplay of a scene: { cast, marks?, script, seed?, world_ref?, voice?, dub? }
 *   sceneOrder(F) → the scene ids in the edit's order (else the scenes')
 *   sceneStamp(F, id) → a short hash of what a scene's board is drawn from (its screenplay, the film's style and grain):
 *     an approval keeps it, and an edit since reads as stale
 *
 * Pure and deterministic.
 */
import { createHash } from 'node:crypto';
import { renderErrors } from './render-plan.js';
import { orderBriefErrors } from './order.js';

export const FILM_KIND = 'film';
export const isFilmKind = (kind) => kind === FILM_KIND;
export const FILM_KEYS = Object.freeze(['title', 'cast', 'sets', 'look', 'grade', 'grain', 'style', 'render', 'scenes', 'edit', 'order']);
export const FILM_PART_KEYS = Object.freeze(['persona', 'hero', 'register', 'style', 'role', 'height']);
export const SCENE_KEYS = Object.freeze(['id', 'set', 'cast', 'marks', 'props', 'script', 'voice', 'dub', 'seed']);
export const SCENE_PART_KEYS = Object.freeze(['mark', 'register', 'style', 'role', 'height']);
export const CUTS = Object.freeze(['cut', 'fade']);
export const FILM_LOOKS = Object.freeze(['film', 'anime']);
const WORD = /^[a-z][a-z0-9_-]{0,31}$/;
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const FILM_MANUAL = "manual: get_motion_vocab({ id: 'film-studio' })";

/** Error lines for a film's recipe (see the header) */
export function filmErrors(F) {
  if (!isPlain(F)) return ['a film is { cast: { <who>: { persona | hero } }, scenes: [{ id, cast: { <who>: {} }, script }], sets?, look?, edit? }'];
  const errs = [], extra = Object.keys(F).filter((k) => !FILM_KEYS.includes(k));
  if (extra.length) errs.push(`a film takes ${FILM_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (!isPlain(F.cast) || !Object.keys(F.cast).length) errs.push('cast: { <who>: { persona: <ref> | hero: <ref> | <a hero spec>, register?, style?, role? } }, one part at least');
  else for (const [w, C] of Object.entries(F.cast)) {
    if (!WORD.test(w)) errs.push(`cast.${w}: a part's name is the name the script writes, lower case (a word)`);
    if (!isPlain(C)) { errs.push(`cast.${w}: { persona? | hero?, register?, style?, role?, height? }`); continue; }
    const bad = Object.keys(C).filter((k) => !FILM_PART_KEYS.includes(k));
    if (bad.length) errs.push(`cast.${w}: a film's part takes ${FILM_PART_KEYS.join(', ')} (not ${bad.join(', ')}; a mark is a scene's)`);
    if (C.persona !== undefined && C.hero !== undefined) errs.push(`cast.${w}: a persona or a hero, not both`);
  }
  if (F.sets !== undefined) {
    if (!isPlain(F.sets)) errs.push('sets: { <id>: <a stored world\'s ref> }');
    else for (const [id, ref] of Object.entries(F.sets)) if (!WORD.test(id) || typeof ref !== 'string' || !ref) errs.push(`sets.${id}: a set is a word naming a stored world's ref`);
  }
  if (F.look !== undefined && !FILM_LOOKS.includes(F.look)) errs.push(`look: ${FILM_LOOKS.join(' | ')}`);
  errs.push(...renderErrors(F.render));
  if (!Array.isArray(F.scenes) || !F.scenes.length) errs.push('scenes: [{ id, cast: { <who>: { mark? } }, script }], one at least');
  else {
    const seen = new Set();
    F.scenes.forEach((S, i) => {
      const at = `scenes[${i}]`;
      if (!isPlain(S)) { errs.push(`${at}: { id, set?, cast, marks?, props?, script, voice?, dub?, seed? }`); return; }
      const bad = Object.keys(S).filter((k) => !SCENE_KEYS.includes(k));
      if (bad.length) errs.push(`${at}: a scene takes ${SCENE_KEYS.join(', ')} (not ${bad.join(', ')})`);
      if (typeof S.id !== 'string' || !WORD.test(S.id)) errs.push(`${at}.id: a word (lower case letters, digits, - and _)`);
      else if (seen.has(S.id)) errs.push(`${at}.id: '${S.id}' names two scenes`);
      else seen.add(S.id);
      if (typeof S.script !== 'string' || !S.script.trim()) errs.push(`${at}.script: the scene's screenplay ("NAME: the line", directions)`);
      if (!isPlain(S.cast) || !Object.keys(S.cast).length) errs.push(`${at}.cast: { <who>: { mark? } }, who is in the scene (each a part of the film's cast)`);
      else for (const [w, C] of Object.entries(S.cast)) {
        if (isPlain(F.cast) && !Object.hasOwn(F.cast, w)) errs.push(`${at}.cast.${w}: not a part of the film's cast (${Object.keys(F.cast).join(', ')})`);
        if (!isPlain(C)) { errs.push(`${at}.cast.${w}: { mark?, register?, style?, role? }`); continue; }
        const extraP = Object.keys(C).filter((k) => !SCENE_PART_KEYS.includes(k));
        if (extraP.length) errs.push(`${at}.cast.${w}: a scene's part takes ${SCENE_PART_KEYS.join(', ')} (not ${extraP.join(', ')}; its body is the film's)`);
      }
      if (S.set !== undefined && !(isPlain(F.sets) && Object.hasOwn(F.sets, S.set))) errs.push(`${at}.set: '${S.set}' is not one of the film's sets (${isPlain(F.sets) ? Object.keys(F.sets).join(', ') || 'none' : 'none'})`);
    });
  }
  // (a film made to a client's order keeps its brief: film/order.js)
  if (F.order !== undefined) errs.push(...orderBriefErrors(F.order, F));
  if (F.edit !== undefined) {
    if (!isPlain(F.edit)) errs.push('edit: { order?: [<scene id>], cuts?: { <scene id>: cut | fade } }');
    else {
      const ids = new Set((Array.isArray(F.scenes) ? F.scenes : []).map((S) => S?.id));
      if (F.edit.order !== undefined && !(Array.isArray(F.edit.order) && F.edit.order.every((id) => ids.has(id)))) errs.push(`edit.order: the film's scene ids, in the order they play (${[...ids].join(', ')})`);
      if (F.edit.cuts !== undefined && !(isPlain(F.edit.cuts) && Object.entries(F.edit.cuts).every(([id, c]) => ids.has(id) && CUTS.includes(c)))) errs.push(`edit.cuts: { <scene id>: ${CUTS.join(' | ')} } (how a scene comes in)`);
    }
  }
  return errs;
}

/** A film checked: throws naming every fault */
export function readFilm(F) {
  const errs = filmErrors(F);
  if (errs.length) throw new Error(`film refused:\n - ${errs.join('\n - ')}\n(${FILM_MANUAL})`);
  return F;
}

const sceneOf = (F, id) => {
  const S = F.scenes.find((x) => x.id === id);
  if (!S) throw new Error(`film: no scene '${id}' (${F.scenes.map((x) => x.id).join(', ')})`);
  return S;
};

/** A scene's screenplay: the film's parts under the scene's words, its set the film's world */
export function sceneScreenplay(F, id) {
  const S = sceneOf(F, id);
  const cast = Object.fromEntries(Object.entries(S.cast).map(([w, C]) => [w, { ...F.cast[w], ...C }]));
  return {
    cast, script: S.script,
    ...(S.marks ? { marks: S.marks } : {}),
    ...(S.props ? { props: S.props } : {}),
    ...(S.seed !== undefined ? { seed: S.seed } : {}),
    ...(S.set !== undefined ? { world_ref: F.sets[S.set] } : {}),
    ...(S.voice ? { voice: S.voice } : {}),
    ...(S.dub ? { dub: S.dub } : {}),
  };
}

/** The scenes in the order the film plays them */
export const sceneOrder = (F) => (Array.isArray(F.edit?.order) && F.edit.order.length ? [...F.edit.order] : F.scenes.map((S) => S.id));

/** canonical JSON: keys sorted, so a stamp never moves with key order */
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : isPlain(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

/** What a scene's board is drawn from, hashed (see the header) */
export function sceneStamp(F, id) {
  return createHash('sha256').update(canon({ sp: sceneScreenplay(F, id), style: F.style ?? null, grain: F.grain ?? null })).digest('hex').slice(0, 12);
}
