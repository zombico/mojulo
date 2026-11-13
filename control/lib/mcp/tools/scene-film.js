/**
 * scene-film — the cinematics department's FILM, one core for the door and the script: a screenplay played by its cast
 * (actor/scene.js), shot by its coverage (actor/coverage.js), written as a Blender film pack (actor/scene-film.js) with
 * each actor a skinned GLB of its hero carrying the scene's face take and act.
 *
 *   forge_motion({ subject: { screenplay }, shot: { motion: 'coverage' }, export: 'blender' }) and
 *   scripts/export-scene-blender.mjs both write through `writeSceneFilm`, so the pack is the same bytes either way.
 *
 *   THE SCREENPLAY: { cast: { <who>: { persona?, hero?, register?, style?, role?, mark?, height? } }, marks?, script,
 *   seed? } (who: the name the script writes, lower case). A cast member plays
 *     - from a PERSONA's ref (create_character as 'persona'): the persona is the actor, its hero the body and its
 *       register, style and role its playing; the scene's own words for the part win over the persona's;
 *     - from a HERO: a minted hero's ref, or a hero spec (the hero door's words);
 *     - from nothing: the default hero (the baseline's realistic hero, actor/baseline.js).
 *   A hero acts only where its face takes a performance: the realistic hero (its relational head) or the anime head.
 *
 *   resolveSceneCast(screenplay, { getRow, style? }) → { cast, heroes, sources }   the words actScene reads, each
 *     actor's hero ({ ref } | { spec }) and where each part came from (refs looked up through getRow)
 *   planSceneFilm(screenplay, { getRow, style?, grain? }) → { S, coverage, notes, cast, heroes, sources }   no mint
 *   writeSceneFilm({ outDir, screenplay, getRow, title?, style?, grain?, grade?, fps?, hero?, log? }) → the summary
 *     (the actors minted and written as actors/<who>.glb, the pack's files beside them)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { actScene } from '@/lib/graph/actor/scene.js';
import { coverScene } from '@/lib/graph/actor/coverage.js';
import { sceneActOf } from '@/lib/graph/actor/act.js';
import { directorsNotes } from '@/lib/graph/actor/notes.js';
import { sceneFilmFiles, LOOKS } from '@/lib/graph/actor/scene-film.js';
import { BASELINE } from '@/lib/graph/actor/baseline.js';
import { styleErrors } from '@/lib/graph/actor/style.js';
import { readGrade } from '@/lib/graph/scene/channels/grade.js';
import { isPersonaKind } from '@/lib/graph/persona/persona.js';

export { LOOKS };
export const SCENE_CAST_KEYS = Object.freeze(['persona', 'hero', 'register', 'style', 'role', 'mark', 'height']);
export const SCREENPLAY_KEYS = Object.freeze(['cast', 'marks', 'script', 'seed']);
/** the grain words: the scene shown on ones, twos or threes (shoot/time.js), the camera on ones */
export const GRAINS = Object.freeze({ ones: 1, twos: 2, threes: 3 });

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const MANUAL = "manual: get_motion_vocab({ id: 'scene-film' })";

/** A grain word or number → 1 | 2 | 3 | null (none given) */
export function readGrain(raw, at = 'grain') {
  if (raw == null) return null;
  const g = Object.hasOwn(GRAINS, raw) ? GRAINS[raw] : ({ 1: 1, 2: 2, 3: 3 })[raw];
  if (g === undefined) throw new Error(`${at}: ${Object.keys(GRAINS).join(' | ')}`);
  return g;
}

/** Error lines for a screenplay's shape (empty = valid); the script's words are checked by actScene */
export function screenplayErrors(sp) {
  if (!isPlain(sp)) return ['a screenplay is { cast: { <who>: { persona? | hero?, register?, style?, role?, mark? } }, marks?, script, seed? }'];
  const errs = [];
  const extra = Object.keys(sp).filter((k) => !SCREENPLAY_KEYS.includes(k));
  if (extra.length) errs.push(`a screenplay takes ${SCREENPLAY_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (typeof sp.script !== 'string' || !sp.script.trim()) errs.push('script: the screenplay\'s text ("NAME: the line", "NAME (worried): the line", "Mara crosses to the table.")');
  if (!isPlain(sp.cast) || !Object.keys(sp.cast).length) errs.push('cast: { <who>: { persona?: <ref> | hero?: <ref> | <a hero spec>, … } }, one actor at least');
  else for (const [who, C] of Object.entries(sp.cast)) {
    if (!isPlain(C)) { errs.push(`cast.${who}: { persona? | hero?, register?, style?, role?, mark?, height? }`); continue; }
    const bad = Object.keys(C).filter((k) => !SCENE_CAST_KEYS.includes(k));
    if (bad.length) errs.push(`cast.${who}: a part takes ${SCENE_CAST_KEYS.join(', ')} (not ${bad.join(', ')})`);
    if (C.persona !== undefined && (typeof C.persona !== 'string' || !C.persona)) errs.push(`cast.${who}.persona: a persona's ref (create_character as 'persona')`);
    if (C.persona !== undefined && C.hero !== undefined) errs.push(`cast.${who}: a persona or a hero, not both (the persona's hero is its body)`);
    if (C.hero !== undefined && !(typeof C.hero === 'string' && C.hero) && !isPlain(C.hero)) errs.push(`cast.${who}.hero: a hero's ref or a hero spec`);
    if (C.style !== undefined) errs.push(...styleErrors(C.style, `cast.${who}.style`));
  }
  if (sp.marks !== undefined && !isPlain(sp.marks)) errs.push('marks: { <name>: [x, y] } (metres)');
  return errs;
}

/** Where a hero's face can act: the realistic hero's relational head or the anime head (layered.js `perform`) */
const acts = (record) => record?.head === 'relational' || record?.head === 'anime';

/** The cast's words, heroes and sources: a persona's playing under the scene's own words for the part */
export function resolveSceneCast(sp, { getRow, style = null } = {}) {
  const errs = screenplayErrors(sp);
  if (errs.length) throw new Error(`screenplay refused:\n - ${errs.join('\n - ')}\n(${MANUAL})`);
  const cast = {}, heroes = {}, sources = {};
  for (const [who, C] of Object.entries(sp.cast)) {
    const { persona, hero, ...words } = C;
    let playing = {}, heroOf = null, source = 'the default hero';
    if (persona !== undefined) {
      const row = getRow?.(persona);
      if (!row || !isPersonaKind(row.manifest?.kind)) throw new Error(`cast.${who}.persona: '${persona}' is ${row ? `a ${row.manifest?.kind ?? 'sketch'}` : 'no sketch'}, not a persona (create_character as 'persona')`);
      const P = row.manifest.persona;
      playing = Object.fromEntries(['register', 'style', 'role'].filter((k) => P[k] !== undefined).map((k) => [k, P[k]]));
      heroOf = { ref: P.hero };
      source = `persona ${persona} (hero ${P.hero})`;
    } else if (typeof hero === 'string') { heroOf = { ref: hero }; source = `hero ${hero}`; }
    else if (isPlain(hero)) { heroOf = { spec: hero }; source = 'a hero spec'; }
    cast[who] = { ...playing, ...words, ...(style && (words.style ?? playing.style) === undefined ? { style } : {}) };
    heroes[who] = heroOf;
    sources[who] = source;
  }
  return { cast, heroes, sources };
}

/** The scene as played and shot, before any actor is minted: the blocking, the coverage and the director's notes */
export function planSceneFilm(sp, { getRow, style = null, grain = null } = {}) {
  const { cast, heroes, sources } = resolveSceneCast(sp, { getRow, style });
  const S = actScene({ ...sp, cast });
  const coverage = coverScene(S, { grain: readGrain(grain) });
  return { S, coverage, notes: directorsNotes(S, coverage), cast, heroes, sources };
}

/** A hero source ({ ref } | { spec } | null) → { key, manifest, record }, refused where its face cannot act */
async function heroSource(src, { who, getRow, fallback }) {
  const { heroRecord } = await import('@/lib/mcp/tools/layered.js');
  if (src?.ref) {
    const row = getRow?.(src.ref);
    if (!row?.manifest?.hero) throw new Error(`cast.${who}: '${src.ref}' is ${row ? `a ${row.manifest?.kind ?? 'sketch'}` : 'no sketch'}, not a hero (create_character as 'hero')`);
    const record = row.manifest.hero;
    if (!acts(record)) throw new Error(`cast.${who}: hero '${src.ref}' cannot act a scene: a face's performance is the realistic hero's (form: 'realistic') or the anime hero's (head: 'anime')`);
    return { key: `ref:${src.ref}`, ref: src.ref, manifest: row.manifest, record };
  }
  const spec = src?.spec ?? fallback;
  const record = heroRecord(spec);
  if (!acts(record)) throw new Error(`cast.${who}: this hero cannot act a scene: a face's performance is the realistic hero's (form: 'realistic') or the anime hero's (head: 'anime')`);
  return { key: `spec:${JSON.stringify(spec)}`, manifest: { kind: 'layered', hero: record }, record };
}

/**
 * Write the scene film pack into outDir: actors/<who>.glb, then the pack's files (actor/scene-film.js). Returns the
 * summary the door and the script report: the files, the actors (bytes, seconds to mint, where each part came from),
 * the scene's seconds, its shots and the director's notes.
 */
export async function writeSceneFilm({ outDir, screenplay, getRow, title = 'scene', style = null, grain = null, grade = null, fps = 24, hero = null, log = () => {} }) {
  if (style !== null) { const e = styleErrors(style, 'style'); if (e.length) throw new Error(e.join('; ')); }
  const graded = readGrade(grade, 'grade');
  if (!Number.isFinite(fps) || fps < 1 || fps > 120) throw new Error('fps: a frame rate, 1 to 120');
  const plan = planSceneFilm(screenplay, { getRow, style, grain });
  const { S, coverage, notes, heroes, sources } = plan;
  // (heroes resolved, and refused, before the first slow mint)
  const srcs = {};
  for (const w of Object.keys(S.actors)) srcs[w] = await heroSource(heroes[w], { who: w, getRow, fallback: hero ?? BASELINE.hero });

  const { expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
  const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf.js');
  mkdirSync(path.join(outDir, 'actors'), { recursive: true });
  const expanded = new Map(), actors = {}, minted = {};
  for (const w of Object.keys(S.actors)) {
    const src = srcs[w], t0 = Date.now();
    const named = `${title} · ${w}`;
    if (!expanded.has(src.key)) expanded.set(src.key, { ...expandLayeredManifest(src.ref ? { ...src.manifest, title: named } : { kind: 'layered', title: named, hero: src.record }), hero: src.record });
    const base = expanded.get(src.key), take = sceneActOf(S.actors[w]);
    const manifest = { ...base, hero: { ...base.hero, perform: { ...(base.hero.perform ?? {}), ...take.perform }, acts: take.acts } };
    // (the lit export: the realistic body's smooth normals and no light baked into its colours, so either look shades it)
    const { payload } = await resolveWorldScene({ ref: `scene-${w}`, title: `${title} · ${w}`, manifest }, { face: true, unshaded: true });
    const glb = facesToGlb(payload, { generator: `mojulo scene film · ${w}`, clips: '_all', skinned: true, lit: true });
    writeFileSync(path.join(outDir, 'actors', `${w}.glb`), Buffer.from(glb.bytes));
    actors[w] = { take: 'scene' };
    minted[w] = { glb: `actors/${w}.glb`, bytes: glb.bytes.byteLength, seconds: Math.round((Date.now() - t0) / 1000), plays: sources[w] };
    log(`actors/${w}.glb: ${(glb.bytes.byteLength / 1e6).toFixed(1)} MB, ${minted[w].seconds} s`);
  }
  const files = sceneFilmFiles({ S, coverage, actors, fps, title, grade: graded });
  for (const f of files) { mkdirSync(path.dirname(path.join(outDir, f.file)), { recursive: true }); writeFileSync(path.join(outDir, f.file), f.text); }
  return {
    files: [...Object.values(minted).map((m) => m.glb), ...files.map((f) => f.file)],
    shotFiles: files.filter((f) => f.file.startsWith('shots/')).map((f) => f.file),
    actors: minted,
    seconds: S.seconds,
    shots: coverage.shots.map((s) => ({ name: s.name, span: s.span })),
    cameras: coverage.cameras.length,
    notes: notes.map((n) => ({ id: n.id, ...(n.at !== undefined ? { at: n.at } : {}), says: n.says, try: n.try })),
    fps,
    grade: graded,
  };
}

/** The pack's title as a file-safe word (the shots are written as `shots/<title>-NN.json`) */
export const packTitle = (title) => String(title ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'scene';

/** shot.params a screenplay takes */
export const SCREENPLAY_PARAMS = Object.freeze(['look', 'style', 'grain', 'grade', 'hero']);

/**
 * forge_motion's SCREENPLAY family: the scene written as a Blender film pack into the motion's outcome folder
 * (`<mo_…>/blender/`), the recipe filed as every motion's is (recipe.json, a Motion Project tag and stash). The tool
 * never launches Blender: the answer names the command that builds the pack where one is found.
 */
export async function forgeScreenplay({ title, subject, shot, exportFormat, tagRef = null }) {
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { StashRepository } = await import('@/lib/db/repositories/stashes');
  const { OpsTagRepository } = await import('@/lib/db/repositories/ops-tags');
  const { outcomeDirFor, outcomeUrlFor } = await import('@/lib/outcomes-paths');
  const { randomUUID } = await import('node:crypto');
  if (!title || typeof title !== 'string') throw new Error('title is required');
  const extraSubject = Object.keys(subject).filter((k) => k !== 'screenplay');
  if (extraSubject.length) throw new Error(`subject.screenplay is a family of its own (not with ${extraSubject.join(', ')}); a set under the scene is to come (${MANUAL})`);
  if (exportFormat !== undefined && exportFormat !== 'blender') throw new Error(`a screenplay is filmed in Blender: export: 'blender' (a web preview of the scene is to come; ${MANUAL})`);
  const S = shot ?? {};
  if (S.motion !== undefined && S.motion !== 'coverage') throw new Error(`a screenplay is shot by its coverage: shot: { motion: 'coverage' } (not '${S.motion}'; ${MANUAL})`);
  const P = S.params ?? {};
  const extra = Object.keys(P).filter((k) => !SCREENPLAY_PARAMS.includes(k));
  if (extra.length) throw new Error(`a screenplay's shot.params are ${SCREENPLAY_PARAMS.join(', ')} (not ${extra.join(', ')}; ${MANUAL})`);
  const look = P.look ?? 'film';
  if (!LOOKS.includes(look)) throw new Error(`shot.params.look: ${LOOKS.join(' | ')}`);
  const fps = S.fps ?? 24;
  const getRow = (r) => SketchRepository.getByRef(r);
  // (refused before anything is written: the script, the cast and its refs)
  planSceneFilm(subject.screenplay, { getRow, style: P.style ?? null, grain: P.grain ?? null });

  const ref = `mo_${randomUUID().replace(/-/g, '').slice(0, 12)}`, dir = outcomeDirFor(ref), filmDir = path.join(dir, 'blender');
  const film = await writeSceneFilm({
    outDir: filmDir, screenplay: subject.screenplay, getRow, title: packTitle(title), style: P.style ?? null,
    grain: P.grain ?? null, grade: P.grade ?? null, fps, hero: P.hero ?? null,
  });
  const recipe = {
    motion_ref: ref, title, subject: { screenplay: subject.screenplay },
    shot: { motion: 'coverage', params: P, fps },
    meta: { motion: 'coverage', fps, frames: Math.round(film.seconds * fps), durationSec: film.seconds, createdAt: Math.floor(Date.now() / 1000) },
  };
  writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(recipe, null, 2));

  const tag = tagRef ? OpsTagRepository.getByRef(tagRef) : OpsTagRepository.forge({
    title: `Motion: ${title}`,
    descriptorMd: `A motion project. A screenplay acted by its cast and shot by its coverage, written as a Blender film pack at ${ref}. Members: the recipe stash and the film.`,
  });
  if (!tag) throw new Error(`tag_ref '${tagRef}' not found`);
  const stash = StashRepository.mint({ title: `Motion: ${title}` });
  for (const w of Object.keys(film.actors)) {
    const C = subject.screenplay.cast[w] ?? {}, member = C.persona ?? (typeof C.hero === 'string' ? C.hero : null);
    if (member) StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', title: `${w} — ${title}`, metadata: { sketch_ref: member, label: `${title} · ${w}` } });
  }
  StashRepository.gather({ stashRef: stash.stashRef, type: 'script', title: 'shot recipe — coverage', body: JSON.stringify(recipe, null, 2), metadata: { language: 'js' } });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'stash', memberRef: stash.stashRef });
  OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'motion', memberRef: ref });

  const url = outcomeUrlFor(ref);
  return {
    ok: true,
    motion_ref: ref,
    tag_ref: tag.tagRef,
    stash_ref: stash.stashRef,
    url,
    seconds: film.seconds,
    frames: recipe.meta.frames,
    shots: film.shots,
    actors: film.actors,
    notes: film.notes,
    blender: {
      dir: filmDir,
      files: film.files.length,
      scene_md: `${url}blender/SCENE.md`,
      look,
      command: `node scripts/export-scene-blender.mjs --build ${filmDir} --look ${look}`,
      render: 'then: <blender> -b film.blend --python film_render.py -- --preset draft (EEVEE) | final (Cycles)',
      note: 'Each actor a skinned GLB with its act and face take, the coverage\'s cameras cut at markers, the look built in Blender. Blender runs on the operator\'s machine; mojulo did not launch it.',
    },
    message:
      `Screenplay filmed: ${Object.keys(film.actors).length} actors, ${film.seconds} s, ${film.shots.length} shots on ${film.cameras} cameras, written as a Blender film pack at ${filmDir} (SCENE.md). `
      + (film.notes.length ? `${film.notes.length} director's notes (notes): each says what to try in the script; none stops the film. ` : 'No director\'s notes. ')
      + `Build it with blender.command, render with film_render.py. Filed under ops tag ${tag.tagRef}.`,
  };
}
