/**
 * FIGURE GRADES — one character, conceived once, baked at two grades: the PLAY grade a game walks (its triangles held to
 * what a play camera shows of it) and the POSE grade the cinematics act with (the full density: the face's lenses, the
 * hair's every ring, the body's rounded skin, for a close shot). Both are the same recipe: the same skeleton and bone
 * ids, the same clips, the same palette, the same height; only the sampling differs. The departments use different ones
 * (play modes the play grade, cinematics, the cast sheet and the exports the pose grade); the studio makes and checks
 * them together.
 *
 *   PLAY_GRADE, POSE_GRADE, GRADES        the two words
 *   GRADE_BUDGETS                         a grade's triangle budget by role (hero, party, foe, folk), and why
 *   gradeBudget(grade, role)              → triangles, or null (a grade or role it has none for)
 *   gradeAdvice(tris, grade, role)        → null, or the advice for a figure over its budget (advised, never refused)
 *   figureTris(fig)                       → a baked figure's triangles (its parts as the page reads them)
 *   crossGradeErrors(pose, play)          → [] or what keeps the two bakes from being one character (bones, clips,
 *                                           height)
 *   CLOSE_FRAMES                          the shots that frame a figure close: the pose grade is cut in for them
 *   poseCast(manifest)                    → the figures a play-grade world's close shots can reach (its party, its
 *                                           battles' foes, its scenes' close shots and banter), each baked again at the
 *                                           pose grade as `<name>@pose` and cut in on the page while a close shot is on
 *
 * What the play grade lowers (the hero's `grade: 'play'` at its bake, worlds/world-scene.js heroFigure): the body's
 * rounding split (layered.js bodyRoundsOf), the anime head's coarse sampling and game lenses, its hair's rings, sides and
 * cap (anime-head.js, anime-form.js). A hero on another head keeps its head's sampling at both grades for now.
 * Pure.
 */

export const PLAY_GRADE = 'play';
export const POSE_GRADE = 'pose';
export const GRADES = Object.freeze([PLAY_GRADE, POSE_GRADE]);

/**
 * The budgets, by grade and role. PLAY: what a play camera shows of a person (the party RPG's pulled-back chase, a person
 * about a tenth of a 1080p frame across, 150 to 250 px tall): about one triangle for every few pixels it covers, floored
 * so its outline and its joints hold under the clips (measured 2026-11-06: the anime hero 34k at the play grade, 171k at
 * the pose grade; a party member 37k, 72k; a townsperson 22 to 27k, 55 to 76k). POSE: a close-up's, the cap a cut
 * holds at.
 */
export const GRADE_BUDGETS = Object.freeze({
  [PLAY_GRADE]: Object.freeze({ hero: 40000, party: 40000, foe: 30000, folk: 30000 }),
  [POSE_GRADE]: Object.freeze({ hero: 220000, party: 160000, foe: 120000, folk: 100000 }),
});

export function gradeBudget(grade, role) {
  return GRADE_BUDGETS[grade]?.[role] ?? null;
}

export function gradeAdvice(tris, grade, role) {
  const B = gradeBudget(grade, role);
  if (B === null || !(tris > B)) return null;
  return `a ${role} at the ${grade} grade is ${Math.round(tris / 1000)}k triangles, over its ${Math.round(B / 1000)}k budget: `
    + (grade === PLAY_GRADE ? 'its head and hair carry the most (fewer locks, a lighter style) at the play camera\'s distance' : 'a cut this close sees less than it carries');
}

// (a part's triangles as the page reads it: an index, uint16 or uint32 by its corners, or a float soup of corners)
const b64Bytes = (s) => (typeof s === 'string' ? Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0) : (s?.byteLength ?? (s?.length ?? 0) * 4));
export function figureTris(fig) {
  let n = 0;
  for (const p of fig?.parts || []) {
    if (!p) continue;
    if (p.idx) n += b64Bytes(p.idx) / (p.n > 65535 ? 4 : 2) / 3;
    else if (Number.isFinite(p.faces)) n += p.faces;
    else if (p.pos) n += b64Bytes(p.pos) / 4 / 9;
  }
  return Math.round(n);
}

/** What keeps two bakes from being one character: their bones (ids, in order), their clips (the same names) and their
 * height (within 2%). [] when they are one. */
export function crossGradeErrors(pose, play) {
  const errs = [], ids = (f) => (f?.bones || []).map((b) => b && b.id);
  const a = ids(pose), b = ids(play);
  if (a.length !== b.length || a.some((id, i) => id !== b[i])) errs.push(`bones differ: ${a.length} at the pose grade, ${b.length} at the play grade${a.length === b.length ? ` (${a.find((id, i) => id !== b[i])} first)` : ''}`);
  const ca = Object.keys(pose?.clips || {}).sort().join(','), cb = Object.keys(play?.clips || {}).sort().join(',');
  if (ca !== cb) errs.push(`clips differ: ${ca || 'none'} / ${cb || 'none'}`);
  const ha = pose?.figH, hb = play?.figH;
  if (Number.isFinite(ha) && Number.isFinite(hb) && Math.abs(ha - hb) > 0.02 * ha) errs.push(`heights differ: ${ha} m / ${hb} m`);
  return errs;
}

/** The shots that frame a figure close (scenes.js shot frames, a banter's cuts; a battle's film cuts close on its own,
 * rpg-channel.js): the pose grade is cut in on the figures they are on. */
export const CLOSE_FRAMES = Object.freeze(['close', 'over', 'two']);

/** The figures a world's close shots can reach, by figure name: its party and its battles' foes (the battle's film
 * closes on the actor and the target), and the figures its scenes frame close (a close, over-the-shoulder or two-shot,
 * a banter's speakers). Entity ids are read to the figures their bodies wear. */
export function poseCast(manifest) {
  const ents = new Map((manifest?.entities || []).filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e]));
  const figs = manifest?.figures || {}, out = new Set();
  const add = (id) => { const f = ents.get(id)?.body?.figure ?? (Object.hasOwn(figs, id) ? id : null); if (typeof f === 'string' && Object.hasOwn(figs, f)) out.add(f); };
  const rpg = manifest?.play?.rpg;
  for (const m of rpg?.party || []) add(m?.id);
  for (const enc of rpg?.encounters || []) for (const id of enc?.who || []) add(id);
  for (const sc of manifest?.play?.scenes || []) for (const b of sc?.beats || []) {
    if (b?.shot && CLOSE_FRAMES.includes(b.shot.frame)) for (const id of b.shot.on || []) add(id);
    if (b?.banter) for (const id of b.banter.with || []) add(id);
    // (a script's speakers: its coverage frames each speaker close or over the shoulder, playscape/ui/scene-script.js)
    if (typeof b?.script === 'string') for (const m of b.script.matchAll(/^\s*([A-Z][A-Z0-9 _'-]*?)\s*(?:\([^)]*\))?\s*:/gm)) add(m[1].toLowerCase().replace(/[^a-z0-9_-]/g, ''));
  }
  return out;
}
