/**
 * Exhibit resolver: a `sketch` stash item whose ref is an exhibit (create_exhibit's: a toured or briefed world, a
 * gallery, prepared states) is not a diagram to draw as a figure. A lesson plan (kinds/lesson-plan.js) carries the
 * exhibit itself and reads it as a lesson does:
 *
 *   - its pages are exported and copied into the lesson's folder, exhibits/<ref>/: the download form (opens from the
 *     folder with no internet) and, when it fits a web page, its web form beside it (exhibit/where.js), so the lesson
 *     goes wherever its folder goes;
 *   - its stops, in the learner band's words (a primary band reads the young visitors' captions, an undergraduate or
 *     professional band the in-depth ones, the rest everyone's), each with how sure it is and how long it takes to read
 *     (the kiosk's own pace, exhibit/audit.js holdSeconds);
 *   - for the teacher: what it sets out to teach (its brief's aims), its claims with their sources, the expert's
 *     sign-off as it stands (never established here), and how to show it.
 *
 * The office→creative bridge, like resolvers/sketch.js: everything on the creative side loads lazily, so an install
 * without the creative pack reads the item as an ordinary figure.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SketchRepository } from '@/lib/db/repositories/sketches';

/** A sketch's manifest is an exhibit's when it is a gallery, prepared states, or a world carrying a tour or a brief. */
export function isExhibitManifest(m) {
  return !!m && (m.kind === 'gallery' || m.kind === 'exhibit-states' || !!m.tour || !!m.curation);
}

/** The exhibit audience a learner band reads. */
export function audienceForBand(band) {
  if (band === 'lower_primary' || band === 'upper_primary') return 'child';
  if (band === 'undergrad' || band === 'professional') return 'specialist';
  return 'general';
}

async function loadCreative() {
  try {
    const [exp, audit, brief, halls] = await Promise.all([
      import('@/lib/mcp/tools/sketch-model-export'),
      import('@/lib/graph/exhibit/audit'),
      import('@/lib/graph/exhibit/brief'),
      import('@/lib/mcp/tools/create-exhibit'),
    ]);
    return { exportModelHandler: exp.exportModelHandler, holdSeconds: audit.holdSeconds, accuracyOf: brief.accuracyOf, exhibitLabel: halls.exhibitLabel };
  } catch {
    return null;
  }
}

// a tour's stops as a lesson reads them, in one audience's words
function stopsOf(tour, audience, holdSeconds) {
  return (tour?.stops || []).map((s, i) => {
    const said = (audience !== 'general' && s.captions?.[audience]) || s.caption;
    return { n: i + 1, title: s.title || '', caption: said, grade: s.grade || null, seconds: Math.round(holdSeconds(said)), claims: s.claims || [] };
  });
}

async function copyInto(src, dest) {
  const st = await fs.stat(src);
  if (st.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    for (const e of await fs.readdir(src)) await copyInto(path.join(src, e), path.join(dest, e));
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

/**
 * The exhibit a stash item names, read for a lesson and copied into `outDir`, or null when the ref is not an exhibit
 * (or the creative pack is not installed): { ref, title, label, kind, rooms: [{ title, stops }], states?, aims, claims,
 * accuracy, entry, webEntry?, where, files }.
 */
export async function resolveExhibitItem(sketchRef, { outDir, band = 'secondary' } = {}) {
  const sketch = sketchRef ? SketchRepository.getByRef(sketchRef) : null;
  if (!sketch || !isExhibitManifest(sketch.manifest)) return null;
  const C = await loadCreative();
  if (!C) return null;
  const m = sketch.manifest, audience = audienceForBand(band);
  const statesOf = (sm) => (sm.states || []).map((st) => ({ label: st.label, caption: st.caption || '' }));
  const roomOf = (s) => ({ ref: s.ref, title: s.manifest?.tour?.title || s.manifest?.title || s.title, stops: stopsOf(s.manifest?.tour, audience, C.holdSeconds),
    ...(s.manifest?.kind === 'exhibit-states' ? { states: statesOf(s.manifest), label: s.manifest.label || null } : {}) });
  const kind = m.kind === 'gallery' ? 'gallery' : m.kind === 'exhibit-states' ? 'states' : 'tour';
  const rooms = kind === 'gallery'
    ? (m.rooms || []).map((r) => SketchRepository.getByRef(typeof r === 'string' ? r : r.ref)).filter(Boolean).map(roomOf)
    : kind === 'tour' ? [roomOf(sketch)] : [];
  const states = kind === 'states' ? statesOf(m) : null;
  const brief = m.curation || null;
  const acc = C.accuracyOf(brief);

  // the pages, exported and carried into the lesson's folder
  const out = await C.exportModelHandler({ ref: sketch.ref, format: 'html' });
  const base = path.join('exhibits', sketch.ref), files = [];
  let entry, webEntry = null;
  if (kind === 'tour') {
    await copyInto(out.path, path.join(outDir, base, 'world.html'));
    entry = `${base}/world.html`; files.push(entry);
    if (out.web?.path) { await copyInto(out.web.path, path.join(outDir, base, 'world.cdn.html')); webEntry = `${base}/world.cdn.html`; files.push(webEntry); }
  } else {
    const folder = path.basename(out.dir);
    await copyInto(out.dir, path.join(outDir, base, folder));
    entry = `${base}/${folder}/index.html`; files.push(...out.files.map((f) => `${base}/${folder}/${f}`));
    if (out.web?.dir) {
      const wf = path.basename(out.web.dir);
      await copyInto(out.web.dir, path.join(outDir, base, wf));
      webEntry = `${base}/${wf}/index.html`; files.push(...out.web.files.map((f) => `${base}/${wf}/${f}`));
    }
  }
  return {
    ref: sketch.ref, title: m.tour?.title || m.title || sketch.title, label: C.exhibitLabel(sketch) || null, kind, audience,
    rooms, states, statesLabel: kind === 'states' ? m.label || null : null, aims: brief?.aims || [], claims: (brief?.claims || []).map((c) => ({ id: c.id, text: c.text, cite: [].concat(c.cite || []), grade: c.grade || null })),
    accuracy: acc, entry, webEntry, where: out.where || null, files,
  };
}
