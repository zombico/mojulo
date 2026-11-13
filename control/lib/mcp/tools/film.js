/**
 * film — the animation studio's door: a FILM (lib/graph/film/film.js) written, read, approved and run, through
 * forge_motion's `film` argument (the door that owns the film intent, as `shoot` writes a world's cameras there). One
 * call does, in order: write (`write`, or `patch`), approve (`approve`), run (`run`); a call with only `ref` reads.
 * Every call answers with the film's readout (lib/graph/film/readout.js): its scenes, its departments, their advice and
 * what to do next. It advises; it refuses only a recipe that is not a film.
 *
 *   film: { write: <a film>, title? }                 a new film row (kind `film`), or the row `ref` names replaced
 *   film: { ref, patch: [{ op: 'set' | 'remove', path, value? }] }   edited at JSON Pointers ('/scenes/1/script')
 *   film: { ref, approve: { <scene id>: 'board' | null } }   the person's approval of a scene's board, stamped by what
 *                                                     the board is drawn from (film.js sceneStamp); null withdraws it
 *   film: { ref, run: 'storyboard' | 'animatic' | 'blender', scenes?: [<id>] }
 *     storyboard  each scene's board (scene-film.js writeStoryboard) under one motion outcome, its front page the
 *                 film's book; seconds, no actor minted
 *     animatic    the boards and ONE cut (motion.mp4): every scene's panels on one clock, joined by cuts, the film's
 *                 voice and each dub's laid end to end (a scene without a dub speaks its own voice; one without voice
 *                 is silent), the captions joined the same way, muxed as tagged tracks
 *     blender     each scene's Blender film pack (scene-film.js writeSceneFilm) under scenes/<id>/blender/, each hero
 *                 minted once a call, and cut.py joining the scenes' renders in order; RESUMABLE: the call works
 *                 until its budget (MOJULO_RUN_BUDGET_MS, else 300 s), records what it made in the row (`made`) and
 *                 says what is `pending`; the next call goes on (a scene made at its current stamp is kept)
 *
 * A scene's recorded lines and dubs are bound when written (scene-voice.js): the row keeps them bound.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFilm, sceneScreenplay, sceneOrder, sceneStamp, FILM_KIND, isFilmKind, FILM_MANUAL } from '@/lib/graph/film/film.js';
import { filmReadout } from '@/lib/graph/film/readout.js';
import { filmBookHtml } from '@/lib/graph/film/book.js';

export const FILM_RUNS = Object.freeze(['storyboard', 'animatic', 'blender']);
export const FILM_BUDGET_MS = 300_000;
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

async function store() {
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { outcomeDirFor, outcomeUrlFor } = await import('@/lib/outcomes-paths');
  return { SketchRepository, outcomeDirFor, outcomeUrlFor, getRow: (r) => SketchRepository.getByRef(r) };
}

/** a film's scenes' recordings bound (paths become recordings the row keeps); a scene that will not parse is left as written */
async function bindFilmVoices(F) {
  const { bindScreenplayVoice } = await import('@/lib/mcp/tools/scene-voice.js');
  const scenes = F.scenes.map((S) => {
    if (S.voice === undefined && S.dub === undefined) return S;
    try {
      const b = bindScreenplayVoice(sceneScreenplay(F, S.id));
      return { ...S, ...(b.voice ? { voice: b.voice } : {}), ...(b.dub ? { dub: b.dub } : {}) };
    } catch (e) {
      if (/\.wav|recording|not held|locale|language tag/i.test(e.message)) throw new Error(`film: scene ${S.id}: ${e.message}`);
      return S;
    }
  });
  return { ...F, scenes };
}

/** each scene played: its set read, its recordings checked, its plan; an error kept by scene, never thrown */
export async function playFilm(F, { getRow }) {
  const { prepareScreenplay, planSceneFilm, setAdvice } = await import('@/lib/mcp/tools/scene-film.js');
  const played = {};
  for (const id of sceneOrder(F)) {
    try {
      const prep = await prepareScreenplay(sceneScreenplay(F, id), { getRow });
      const plan = planSceneFilm(prep.screenplay, { getRow, style: F.style ?? null, grain: F.grain ?? null });
      played[id] = { prep, plan, set: prep.set, advice: [...prep.advice, ...await setAdvice(plan, prep.set)] };
    } catch (e) {
      played[id] = { error: e.message.replace(/\n\(manual:[^)]*\)$/, '') };
    }
  }
  return played;
}

/** the made record's boards as the book shows them */
function boardsOf(made, outcomeUrlFor) {
  const B = made?.storyboard;
  if (!B?.motion_ref) return {};
  const url = outcomeUrlFor(B.motion_ref);
  return Object.fromEntries(Object.entries(B.scenes ?? {}).map(([id, s]) => [id, { page: `${url}scenes/${id}/index.html`, panels: Array.from({ length: s.panels ?? 0 }, (_, k) => `${url}scenes/${id}/panels/${String(k + 1).padStart(2, '0')}.svg`) }]));
}

/** The film's book, read live (the bible route's `book=film`) */
export async function filmBook(row) {
  const { getRow, outcomeUrlFor } = await store();
  const F = row.manifest.film, played = await playFilm(F, { getRow });
  const readout = filmReadout(F, played, { approvals: row.manifest.approvals ?? {}, made: row.manifest.made ?? {}, ref: row.ref });
  return filmBookHtml({ film: { ...F, title: F.title ?? row.title }, readout, boards: boardsOf(row.manifest.made, outcomeUrlFor) });
}

/** a motion outcome folder for a run, filed as forge_motion files any (recipe.json, a Motion Project tag) */
async function runFolder(row, kind, reuse = null) {
  const { outcomeDirFor, outcomeUrlFor } = await store();
  const ref = reuse ?? `mo_${randomUUID().replace(/-/g, '').slice(0, 12)}`, dir = outcomeDirFor(ref);
  mkdirSync(dir, { recursive: true });
  return { ref, dir, url: outcomeUrlFor(ref), kind };
}

async function fileRun(row, run, title, meta) {
  const { OpsTagRepository } = await import('@/lib/db/repositories/ops-tags');
  writeFileSync(path.join(run.dir, 'recipe.json'), JSON.stringify({ motion_ref: run.ref, kind: 'film', title, film_ref: row.ref, shot: { motion: `film:${run.kind}` }, meta: { ...meta, createdAt: Math.floor(Date.now() / 1000) } }, null, 2));
  const tags = OpsTagRepository.listTagsForMember({ memberKind: 'motion', memberRef: run.ref });
  if (!tags.length) {
    const tag = OpsTagRepository.forge({ title: `Film: ${title}`, descriptorMd: `The film ${row.ref}'s ${run.kind} (${run.ref}).` });
    OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'motion', memberRef: run.ref });
  }
}

/** The boards, and with `animatic` the cut (see the header) */
async function runBoards(row, F, played, ids, { animatic }) {
  const { writeStoryboard, frameAligned } = await import('@/lib/mcp/tools/scene-film.js');
  const run = await runFolder(row, animatic ? 'animatic' : 'storyboard'), title = F.title ?? row.title ?? 'film', fps = 24;
  const boards = {}, made = { motion_ref: run.ref, at: new Date().toISOString(), scenes: {} }, out = { scenes: {} };
  const cut = [];
  for (const id of ids) {
    const P = played[id];
    if (P.error) { out.scenes[id] = { error: P.error }; continue; }
    const dir = path.join(run.dir, 'scenes', id);
    const W = await writeStoryboard({ dir, plan: P.plan, title: `${title} · ${id}`, fps, screenplay: P.prep.screenplay, set: P.prep.set, panels: true });
    boards[id] = { page: `${run.url}scenes/${id}/index.html`, panels: W.board.panels.map((p) => `${run.url}scenes/${id}/panels/${String(p.n).padStart(2, '0')}.svg`) };
    made.scenes[id] = { stamp: sceneStamp(F, id), panels: W.board.panels.length };
    out.scenes[id] = { panels: W.board.panels.length, page: boards[id].page };
    cut.push({ id, board: W.board, sound: W.sound, dir, plan: P.plan, prep: P.prep });
  }
  if (animatic && cut.length) out.cut = await writeCut(run, cut, { title, fps, frameAligned });
  await fileRun(row, run, title, { scenes: cut.map((c) => c.id), ...(out.cut ? { durationSec: out.cut.seconds, fps } : {}) });
  return { run, made, boards, out };
}

/** The cut: every scene's panels on one clock, its sound laid end to end (see the header) */
async function writeCut(run, cut, { title, fps, frameAligned }) {
  const { animaticSegments, animaticFrameSvg } = await import('@/lib/graph/actor/storyboard.js');
  const { encodeStitchMp4 } = await import('@/lib/motion/encode-mp4');
  const { voiceCaptions, screenClock, VOICE_RATE, muxSound } = await import('@/lib/mcp/tools/scene-voice.js');
  const { decodeWav } = await import('@/lib/graph/face-acting/recordings.js');
  const { writeWavMono } = await import('@/lib/graph/beats/beats-song-dsp.js');
  const { srt, vtt } = await import('@/lib/graph/persona/captions.js');
  const clips = [], placed = [];
  let at = 0;
  for (const c of cut) {
    const segs = frameAligned(animaticSegments(c.board), fps), len = segs.reduce((a, g) => a + g.seconds, 0);
    for (const g of segs) clips.push({ frameSvgs: [animaticFrameSvg(c.board, g, { width: 640, height: 360 })], fps: 1 / g.seconds, title });
    placed.push({ ...c, at, len });
    at += len;
  }
  const mp4 = path.join(run.dir, 'motion.mp4'), enc = await encodeStitchMp4(clips, mp4, { fps, width: 960, bg: '#000000' });
  // (the sound: each scene's track at its place in the cut; a dub's falls back to the scene's own voice, then silence)
  const locales = [...new Set(placed.flatMap((p) => Object.keys(p.sound?.dubs ?? {})))];
  const anyVoice = placed.some((p) => p.sound?.audio);
  const track = (pick) => {
    const out = new Float32Array(Math.ceil(at * VOICE_RATE));
    for (const p of placed) {
      const file = pick(p);
      if (!file) continue;
      const W = decodeWav(readFileSync(path.join(p.dir, file))), o = Math.round(p.at * VOICE_RATE);
      for (let i = 0; i < W.samples.length && o + i < out.length && i < Math.round(p.len * VOICE_RATE); i++) out[o + i] += W.samples[i];
    }
    return writeWavMono(out, VOICE_RATE);
  };
  const captions = (locale) => {
    const cues = placed.flatMap((p) => voiceCaptions(p.plan.S, p.plan.coverage, { fps, dub: locale ? p.prep.screenplay.dub?.[locale] ?? null : null, screen: screenClock(p.plan.S, p.plan.coverage, fps) }).cues.map((q) => ({ ...q, start: r3(q.start + p.at), end: r3(Math.min(q.end, p.len) + p.at) })));
    return { srt: srt(cues), vtt: vtt(cues) };
  };
  const sound = {};
  if (anyVoice || locales.length) {
    if (anyVoice) { writeFileSync(path.join(run.dir, 'voice.wav'), track((p) => p.sound?.audio ?? null)); sound.audio = 'voice.wav'; }
    const C = captions(null); writeFileSync(path.join(run.dir, 'captions.srt'), C.srt); writeFileSync(path.join(run.dir, 'captions.vtt'), C.vtt); sound.captions = 'captions.srt';
    sound.dubs = {};
    for (const L of locales) {
      writeFileSync(path.join(run.dir, `voice.${L}.wav`), track((p) => p.sound?.dubs?.[L]?.audio ?? p.sound?.audio ?? null));
      const D = captions(L); writeFileSync(path.join(run.dir, `captions.${L}.srt`), D.srt); writeFileSync(path.join(run.dir, `captions.${L}.vtt`), D.vtt);
      sound.dubs[L] = { audio: `voice.${L}.wav`, captions: `captions.${L}.srt` };
    }
    if (!locales.length) delete sound.dubs;
  }
  const tracks = Object.keys(sound).length ? await muxSound(mp4, sound, { dir: run.dir, seconds: enc.durationSec }) : null;
  return { mp4: `${run.url}motion.mp4`, seconds: r3(at), bytes: enc.bytes, scenes: placed.map((p) => ({ id: p.id, at: r3(p.at), seconds: r3(p.len) })), ...(tracks ? { tracks } : {}) };
}

/** cut.py — constant text: the scenes' renders joined in the film's order in Blender's sequencer, their sound with them */
export function cutPy() {
  return String.raw`"""
cut.py - a mojulo film's scenes joined into one cut (mojulo film).

Each scene's own film (scenes/<id>/blender/film/film-<preset>.mp4, made by its pack's film_render.py) laid end to end in
film.json's order on Blender's sequencer, picture and sound, then encoded as cut-<preset>.mp4. A scene not rendered yet
is said and left out.

  blender -b --python cut.py -- [--preset draft|final] [--locale fr]
"""
import bpy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def _opt(name, default=None):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def main():
    with open(os.path.join(HERE, 'film.json')) as f:
        F = json.load(f)
    preset, locale = _opt('--preset', 'draft'), _opt('--locale')
    sc = bpy.context.scene
    sc.render.fps = int(F['fps'])
    seq = sc.sequence_editor_create()
    strips = seq.strips if hasattr(seq, 'strips') else seq.sequences
    frame, w, h = 1, None, None
    for sid in F['order']:
        clip = os.path.join(HERE, 'scenes', sid, 'blender', 'film', 'film-%s%s.mp4' % (preset, '-' + locale if locale else ''))
        if not os.path.exists(clip):
            print('[mojulo cut] scene %s has no %s render yet (%s): left out' % (sid, preset, clip))
            continue
        movie = strips.new_movie(sid, clip, channel=1, frame_start=frame)
        try:
            strips.new_sound(sid + ':sound', clip, channel=2, frame_start=frame)
        except Exception as e:
            print('[mojulo cut] %s: no sound (%s)' % (sid, e))
        if w is None and hasattr(movie, 'elements') and movie.elements:
            w, h = movie.elements[0].orig_width, movie.elements[0].orig_height
        frame += movie.frame_final_duration
    if frame == 1:
        raise SystemExit('[mojulo cut] nothing to cut: render the scenes first (each pack\'s film_render.py)')
    sc.frame_start, sc.frame_end = 1, frame - 1
    if w:
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    if hasattr(sc.render.image_settings, 'media_type'):
        sc.render.image_settings.media_type = 'VIDEO'
    sc.render.image_settings.file_format = 'FFMPEG'
    sc.render.ffmpeg.format = 'MPEG4'
    sc.render.ffmpeg.codec = 'H264'
    sc.render.ffmpeg.audio_codec = 'AAC'
    sc.render.filepath = os.path.join(HERE, 'cut-%s%s.mp4' % (preset, '-' + locale if locale else ''))
    bpy.ops.render.render(animation=True)
    print('MOJ_FILM_CUT_DONE', sc.render.filepath)


main()
`;
}

/** The Blender run: each scene's pack, within a budget, resumable (see the header) */
async function runBlender(row, F, played, ids) {
  const { writeSceneFilm, packTitle } = await import('@/lib/mcp/tools/scene-film.js');
  const { getRow } = await store();
  const prev = row.manifest.made?.blender ?? null;
  const run = await runFolder(row, 'blender', prev?.motion_ref ?? null), title = F.title ?? row.title ?? 'film', fps = 24;
  const budget = Number(process.env.MOJULO_RUN_BUDGET_MS) || FILM_BUDGET_MS, t0 = Date.now(), cache = new Map();
  const scenes = { ...(prev?.scenes ?? {}) }, pending = [], out = {};
  for (const id of ids) {
    const P = played[id], stamp = sceneStamp(F, id), dir = path.join(run.dir, 'scenes', id, 'blender');
    if (P.error) { out[id] = { error: P.error }; continue; }
    if (scenes[id]?.stamp === stamp && existsSync(path.join(dir, 'scene.json'))) { out[id] = { kept: true }; continue; }
    if (Date.now() - t0 > budget) { pending.push(id); continue; }
    const film = await writeSceneFilm({ outDir: dir, screenplay: sceneScreenplay(F, id), getRow, title: packTitle(`${title} ${id}`), style: F.style ?? null, grain: F.grain ?? null, grade: F.grade ?? null, fps, prepared: P.prep, cache });
    scenes[id] = { stamp, at: new Date().toISOString() };
    out[id] = { actors: Object.fromEntries(Object.entries(film.actors).map(([w, A]) => [w, { seconds: A.seconds, plays: A.plays }])), files: film.files.length };
  }
  const order = sceneOrder(F);
  writeFileSync(path.join(run.dir, 'film.json'), `${JSON.stringify({ source: 'mojulo', title, fps, look: F.look ?? 'film', order }, null, 2)}\n`);
  writeFileSync(path.join(run.dir, 'cut.py'), cutPy());
  writeFileSync(path.join(run.dir, 'FILM.md'), `# ${title} — a mojulo film for Blender\n\n${order.length} scenes, each its own Blender film pack under \`scenes/<id>/blender/\` (its SCENE.md says how to build and render it). Build each, render each (\`film_render.py -- --preset draft\` or \`final\`), then join them:\n\n    <blender> -b --python cut.py -- --preset draft\n\n${order.map((id) => `- ${id}: ${scenes[id] ? `made ${scenes[id].at}` : pending.includes(id) ? 'pending (the next run makes it)' : 'not made'}`).join('\n')}\n\nThe look is ${F.look ?? 'film'}: \`look.py -- --look ${F.look ?? 'film'}\` in each scene.\n`);
  await fileRun(row, run, title, { scenes: order, pending });
  return { run, made: { motion_ref: run.ref, scenes, ...(pending.length ? { pending } : {}) }, out, pending };
}

/** forge_motion's `film` argument (see the header) */
export async function filmHandler(arg) {
  if (!isPlain(arg)) throw new Error(`film: { write } | { ref, patch } | { ref, approve } | { ref, run } | { ref } (${FILM_MANUAL})`);
  const { SketchRepository, getRow } = await store();
  const { applyManifestPatch } = await import('@/lib/mcp/tools/manifest-patch.js');
  const extra = Object.keys(arg).filter((k) => !['ref', 'write', 'patch', 'approve', 'run', 'scenes', 'title'].includes(k));
  if (extra.length) throw new Error(`film takes ref, write, patch, approve, run, scenes, title (not ${extra.join(', ')}; ${FILM_MANUAL})`);
  if (arg.write !== undefined && arg.patch !== undefined) throw new Error('film: write or patch, not both');
  let row = arg.ref ? getRow(arg.ref) : null;
  if (arg.ref && (!row || !isFilmKind(row.manifest?.kind))) throw new Error(`film: '${arg.ref}' is ${row ? `a ${row.manifest?.kind ?? 'sketch'}` : 'no sketch'}, not a film (film: { write } makes one)`);
  if (!row && arg.write === undefined) throw new Error(`film: a new film is { write: { cast, scenes } }; an existing one is { ref } (${FILM_MANUAL})`);
  const did = [];
  // ── write ──
  if (arg.write !== undefined || arg.patch !== undefined) {
    let F = arg.write !== undefined ? arg.write : applyManifestPatch(row.manifest.film, arg.patch).manifest;
    readFilm(F);
    for (const [id, ref] of Object.entries(F.sets ?? {})) if (!getRow(ref)?.manifest) throw new Error(`film: set ${id} names '${ref}', which is no stored world`);
    for (const [w, C] of Object.entries(F.cast)) {
      if (typeof C.persona === 'string' && getRow(C.persona)?.manifest?.kind !== 'persona') throw new Error(`film: cast.${w}.persona '${C.persona}' is not a persona (create_character as 'persona')`);
      if (typeof C.hero === 'string' && !getRow(C.hero)?.manifest?.hero) throw new Error(`film: cast.${w}.hero '${C.hero}' is not a hero (create_character as 'hero')`);
    }
    F = await bindFilmVoices(F);
    const manifest = { kind: FILM_KIND, film: F, ...(row?.manifest.approvals ? { approvals: row.manifest.approvals } : {}), ...(row?.manifest.made ? { made: row.manifest.made } : {}) };
    const title = arg.title ?? F.title ?? row?.title ?? 'film';
    if (row) { SketchRepository.update({ ref: row.ref, manifest, ...(arg.title ? { title } : {}) }); did.push(arg.write !== undefined ? 'rewritten' : 'patched'); }
    else { row = SketchRepository.create({ title, manifest }); did.push('written'); }
    row = getRow(row.ref);
  }
  const F = row.manifest.film;
  // ── approve ──
  if (arg.approve !== undefined) {
    if (!isPlain(arg.approve)) throw new Error("film: approve is { <scene id>: 'board' | null }");
    const approvals = { ...(row.manifest.approvals ?? {}) };
    for (const [id, v] of Object.entries(arg.approve)) {
      if (!F.scenes.some((S) => S.id === id)) throw new Error(`film: approve: no scene '${id}' (${F.scenes.map((S) => S.id).join(', ')})`);
      if (v === null) delete approvals[id];
      else if (v === 'board') approvals[id] = { board: sceneStamp(F, id), at: new Date().toISOString() };
      else throw new Error(`film: approve.${id} is 'board' (the person has looked at its board) or null (withdrawn)`);
    }
    SketchRepository.update({ ref: row.ref, manifest: { ...row.manifest, approvals } });
    row = getRow(row.ref);
    did.push('approved');
  }
  // ── play, and run ──
  const played = await playFilm(F, { getRow });
  let ran = null;
  if (arg.run !== undefined) {
    if (!FILM_RUNS.includes(arg.run)) throw new Error(`film: run is ${FILM_RUNS.join(' | ')}`);
    const ids = arg.scenes === undefined ? sceneOrder(F) : arg.scenes;
    if (!Array.isArray(ids) || !ids.every((id) => F.scenes.some((S) => S.id === id))) throw new Error(`film: scenes is a list of the film's scene ids (${F.scenes.map((S) => S.id).join(', ')})`);
    const made = { ...(row.manifest.made ?? {}) };
    if (arg.run === 'blender') {
      const R = await runBlender(row, F, played, ids);
      made.blender = R.made;
      ran = { run: 'blender', motion_ref: R.run.ref, dir: R.run.dir, film_md: `${R.run.url}FILM.md`, scenes: R.out, ...(R.pending.length ? { pending: R.pending, resume: "film: { ref, run: 'blender' } again: made scenes are kept" } : {}), note: 'Blender runs on the operator\'s machine; mojulo did not launch it. Build and render each scene as its SCENE.md says, then cut.py joins them.' };
    } else {
      const R = await runBoards(row, F, played, ids, { animatic: arg.run === 'animatic' });
      made.storyboard = R.made;
      if (arg.run === 'animatic') made.animatic = { motion_ref: R.run.ref, at: R.made.at };
      const readoutNow = filmReadout(F, played, { approvals: row.manifest.approvals ?? {}, made, ref: row.ref });
      writeFileSync(path.join(R.run.dir, 'index.html'), filmBookHtml({ film: { ...F, title: F.title ?? row.title }, readout: readoutNow, boards: R.boards }));
      ran = { run: arg.run, motion_ref: R.run.ref, page: `${R.run.url}index.html`, scenes: R.out.scenes, ...(R.out.cut ? { cut: R.out.cut } : {}) };
    }
    SketchRepository.update({ ref: row.ref, manifest: { ...row.manifest, made } });
    row = getRow(row.ref);
  }
  const readout = filmReadout(F, played, { approvals: row.manifest.approvals ?? {}, made: row.manifest.made ?? {}, ref: row.ref });
  return {
    ok: true, ref: row.ref, url: `/sketches/${encodeURIComponent(row.ref)}`, ...(did.length ? { did } : {}), ...(ran ? { ran } : {}),
    ...readout,
    message: `Film ${row.ref}${did.length ? ` (${did.join(', ')})` : ''}: ${readout.scenes.length} scenes, ${readout.departments.filter((D) => D.state === 'advised').length} departments with advice.`
      + (ran ? ` Ran ${ran.run}${ran.cut ? `: the cut ${ran.cut.mp4} (${ran.cut.seconds} s)` : ran.page ? `: ${ran.page}` : `: ${ran.film_md}`}${ran.pending ? `; ${ran.pending.length} scene(s) pending (run again)` : ''}.` : '')
      + ` The book: ${readout.book}.${readout.next[0] ? ` Next: ${readout.next[0].try}` : ''}`,
  };
}
