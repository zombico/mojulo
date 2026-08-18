/**
 * Lesson-plan writer (publication kind: lesson_plan).
 *
 * A teacher tool. Unlike every other kind, lesson_plan renders the SAME
 * authored stash TWICE into one outcome folder:
 *
 *   index.html    teacher plan  — objectives, timed steps, teacher notes,
 *                                 the assessment answer key. Fixed professional
 *                                 register.
 *   handout.html  learner copy  — the student-facing material, tuned by
 *                                 `learnerBand`, printable (US-letter).
 *
 * The two faces are two READINGS of the same items, never two authoring
 * passes. Drawers carry the lesson anatomy; reserved drawer names route to
 * pedagogical sections (objectives, references, activities, assessment,
 * materials, extensions, teacher_notes). Unknown drawer names fall through to
 * a generic section. Root items (no drawer) lead as an "Overview" section.
 *
 * Which face an item lands on is decided by `metadata.audience` ∈
 * {teacher, learner, both}, defaulted by the item's drawer. teacher-tagged
 * items never reach the handout. A handful of optional `metadata.lesson.*`
 * sidecars (`timing`, `teacher_note`, `answer`) drive the richness delta
 * between the faces — they only ever render on the teacher face.
 *
 * Accepted item types: markdown, link, sketch, text. Others (image, svg,
 * script, pointer) are skipped with a manifest record — consistent with the
 * "no image resolver in v1" posture of the other kinds.
 *
 * v1 ships a single band baked into the render. The band drives a
 * `data-band="…"` attribute the handout stylesheet keys off (typography +
 * scaffolding density) — presentation only; the renderer never rewrites prose.
 * TODO: band fan-out — re-publish the same lesson at N bands via
 * forge_publications, one cook per band.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';
import { resolveSketchItem } from '../resolvers/sketch.js';

export const LESSON_PLAN_VERSION = 'lp-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEACHER_TEMPLATE_PATH = path.join(HERE, '..', 'template', 'lesson_plan.html');
const HANDOUT_TEMPLATE_PATH = path.join(HERE, '..', 'template', 'lesson_handout.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pad(n) { return String(n).padStart(3, '0'); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'; }

const ACCEPTED = new Set(['markdown', 'link', 'sketch', 'text']);

// Reserved drawer names → pedagogical section, in fixed anatomy order. The
// `audience` here is the section default; a per-item metadata.audience overrides.
const RESERVED = {
  objectives: { label: 'Objectives', audience: 'both' },
  references: { label: 'References', audience: 'both' },
  activities: { label: 'Activities', audience: 'both' },
  assessment: { label: 'Assessment', audience: 'both' },
  materials: { label: 'Materials', audience: 'both' },
  extensions: { label: 'Extensions', audience: 'both' },
  teacher_notes: { label: 'Teacher notes', audience: 'teacher' },
};
const RESERVED_ORDER = Object.keys(RESERVED);

const BANDS = new Set([
  'lower_primary', 'upper_primary', 'middle', 'secondary', 'undergrad', 'professional',
]);
const DEFAULT_BAND = 'secondary';

const AUDIENCES = new Set(['teacher', 'learner', 'both']);

/** Resolve an item's audience: explicit metadata.audience, else the section default. */
function itemAudience(item, sectionDefault) {
  const a = item?.metadata?.audience;
  if (typeof a === 'string' && AUDIENCES.has(a)) return a;
  return sectionDefault;
}

/** Does an item with `audience` appear on `face` ('teacher' | 'learner')? */
function audienceIncludes(audience, face) {
  if (face === 'teacher') return audience === 'teacher' || audience === 'both';
  return audience === 'learner' || audience === 'both';
}

/** Pull the first `# heading` out of a markdown body. Returns { title, rest }. */
function splitMarkdownHeader(md) {
  const lines = String(md || '').split('\n');
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) { titleIdx = i; break; }
  }
  if (titleIdx === -1) return { title: '', rest: '' };
  const first = lines[titleIdx];
  if (!/^#+\s+/.test(first)) return { title: '', rest: lines.join('\n') };
  const title = first.replace(/^#+\s+/, '').trim();
  const rest = lines.slice(titleIdx + 1).join('\n').replace(/^\s+/, '');
  return { title, rest };
}

/**
 * Split an assessment item into question + answer key. Structured
 * `metadata.lesson.answer` wins; otherwise a trailing `> **Answer:** …`
 * blockquote is peeled from the body. Returns { questionMd, answer } where
 * `answer` is '' when none is present.
 */
function splitAnswer(item) {
  const structured = item?.metadata?.lesson?.answer;
  if (typeof structured === 'string' && structured.trim().length > 0) {
    return { questionMd: item.bodyMd || '', answer: structured.trim() };
  }
  return peelTrailingAnswer(item.bodyMd || '');
}

/** Peel a trailing `> **Answer:** …` blockquote. Returns { questionMd, answer }. */
function peelTrailingAnswer(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end -= 1;
  let start = end;
  while (start > 0 && /^>\s?/.test(lines[start - 1])) start -= 1;
  if (start === end) return { questionMd: md, answer: '' };
  const quoted = lines.slice(start, end).map((l) => l.replace(/^>\s?/, '')).join('\n').trim();
  const m = quoted.match(/^[*\s]*answer[*\s]*:?[*\s]*([\s\S]*)$/i);
  if (!m) return { questionMd: md, answer: '' };
  const questionMd = lines.slice(0, start).join('\n').replace(/\s+$/, '');
  return { questionMd, answer: m[1].trim() };
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function humanizeBand(band) {
  return band.replace(/_/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/**
 * Group accepted items into ordered pedagogical sections. Root items lead as
 * "Overview"; reserved drawers follow in fixed anatomy order; unknown drawers
 * trail in stash order. Returns { sections, skipped }.
 */
function buildSections(full, itemIds) {
  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;
  const drawerOrder = new Map(full.drawers.map((d, i) => [d.name, i]));

  const buckets = new Map(); // key → { key, label, audience, order, items: [] }
  const skipped = [];
  const ensure = (key, label, audience, order) => {
    if (!buckets.has(key)) buckets.set(key, { key, label, audience, order, items: [] });
    return buckets.get(key);
  };

  for (const it of items) {
    if (!ACCEPTED.has(it.type)) {
      skipped.push({ id: it.id, type: it.type, reason: `lesson_plan does not render type '${it.type}'` });
      continue;
    }
    if (it.drawer === null || it.drawer === undefined) {
      ensure('overview', 'Overview', 'both', 0).items.push(it);
      continue;
    }
    const norm = String(it.drawer).toLowerCase().trim();
    if (RESERVED[norm]) {
      const def = RESERVED[norm];
      ensure(norm, def.label, def.audience, 1 + RESERVED_ORDER.indexOf(norm)).items.push(it);
    } else {
      ensure(it.drawer, it.drawer, 'both', 100 + (drawerOrder.get(it.drawer) ?? 999)).items.push(it);
    }
  }

  const sections = [...buckets.values()].sort((a, b) => a.order - b.order);
  return { sections, skipped };
}

/** Resolve a single item into a render-ready record (resolves sketches). */
async function resolveItem(item, sectionKey, sectionAudience, figureFiles) {
  const audience = itemAudience(item, sectionAudience);
  const rec = { id: item.id, type: item.type, audience };

  if (item.type === 'markdown' && sectionKey === 'assessment') {
    const { questionMd, answer } = splitAnswer(item);
    rec.assessment = true;
    rec.questionHtml = questionMd.trim() ? renderMarkdown(questionMd) : '';
    rec.answerHtml = answer ? renderMarkdown(answer) : '';
  } else if (item.type === 'markdown') {
    const { title, rest } = splitMarkdownHeader(item.bodyMd);
    rec.title = title;
    rec.bodyHtml = rest ? renderMarkdown(rest) : (title ? '' : renderMarkdown(item.bodyMd || ''));
    const timing = item?.metadata?.lesson?.timing;
    rec.timing = (timing === undefined || timing === null) ? '' : String(timing);
    const note = item?.metadata?.lesson?.teacher_note;
    rec.teacherNoteHtml = (typeof note === 'string' && note.trim()) ? renderMarkdown(note) : '';
  } else if (item.type === 'link') {
    rec.url = item.sourceUrl || '';
    rec.linkTitle = item.title || rec.url;
  } else if (item.type === 'sketch') {
    const sketchRef = item?.metadata?.sketch_ref;
    const resolved = await resolveSketchItem({ metadata: { sketch_ref: sketchRef } }, { technical: false });
    rec.sketchRef = sketchRef;
    rec.label = item?.metadata?.label || '';
    rec.captionHtml = item.bodyMd ? renderMarkdown(item.bodyMd) : '';
    rec.dangling = resolved.dangling;
    if (resolved.dangling || !resolved.svgInline) {
      rec.inline = null;
      rec.filename = null;
    } else {
      const filename = `figure-${pad(figureFiles.length + 1)}.svg`;
      figureFiles.push({ filename, body: resolved.svgStandalone });
      rec.inline = resolved.svgInline;
      rec.filename = filename;
    }
  } else if (item.type === 'text') {
    rec.calloutTitle = item.title || 'Note';
    rec.calloutBody = item.body || '';
  }
  return rec;
}

/** Render one resolved record for one face. */
function renderBlock(rec, face) {
  if (rec.type === 'markdown' && rec.assessment) {
    const q = `<div class="check-q">${rec.questionHtml}</div>`;
    const a = (face === 'teacher' && rec.answerHtml)
      ? `<div class="check-a"><span class="check-a-label">Answer</span>${rec.answerHtml}</div>`
      : '';
    return `<div class="check">${q}${a}</div>`;
  }
  if (rec.type === 'markdown') {
    const timing = (face === 'teacher' && rec.timing)
      ? `<span class="timing">${escapeHtml(rec.timing)}</span>` : '';
    const head = rec.title ? `<h4 class="step-title">${escapeHtml(rec.title)}</h4>` : '';
    const note = (face === 'teacher' && rec.teacherNoteHtml)
      ? `<aside class="teacher-note"><span class="tn-label">Teacher note</span>${rec.teacherNoteHtml}</aside>` : '';
    return `<div class="step">${timing}${head}<div class="step-body">${rec.bodyHtml}</div>${note}</div>`;
  }
  if (rec.type === 'link') {
    const dom = domainOf(rec.url);
    return `<div class="ref"><a href="${escapeHtml(rec.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(rec.linkTitle)}</a>${dom ? `<span class="ref-domain">${escapeHtml(dom)}</span>` : ''}</div>`;
  }
  if (rec.type === 'sketch') {
    const img = rec.inline
      ? `<div class="fig-img">${rec.inline}</div>`
      : `<div class="fig-img missing">missing illustration · ${escapeHtml(rec.sketchRef || '')}</div>`;
    const cap = (rec.label || rec.captionHtml)
      ? `<figcaption>${rec.label ? `<span class="fig-label">${escapeHtml(rec.label)}</span>` : ''}${rec.captionHtml ? `<div class="fig-caption">${rec.captionHtml}</div>` : ''}</figcaption>`
      : '';
    return `<figure class="figure">${img}${cap}</figure>`;
  }
  if (rec.type === 'text') {
    return `<aside class="callout"><p class="callout-title">${escapeHtml(rec.calloutTitle)}</p><p class="callout-body">${escapeHtml(rec.calloutBody)}</p></aside>`;
  }
  return '';
}

/** Assemble the sections HTML for one face. Sections with no visible item are omitted. */
function renderFace(sectionsResolved, face) {
  const blocks = [];
  for (const s of sectionsResolved) {
    const vis = s.recs.filter((r) => audienceIncludes(r.audience, face));
    if (vis.length === 0) continue;
    const inner = vis.map((r) => renderBlock(r, face)).join('\n');
    blocks.push(
      `<section class="lesson-section" id="sec-${slug(s.key)}">`
        + `<header class="sec-head"><h2>${escapeHtml(s.label)}</h2></header>`
        + `<div class="sec-body">${inner}</div>`
        + `</section>`,
    );
  }
  return blocks.join('\n');
}

export async function writeLessonPlanOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'lesson_plan',
  styleOverridesHtml = '',
  learnerBand,
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (lesson_plan builds from a single stash)');
  }

  let band = (learnerBand === undefined || learnerBand === null || learnerBand === '')
    ? DEFAULT_BAND : learnerBand;
  if (!BANDS.has(band)) {
    throw new Error(
      `publication.style.learner_band '${band}' is not a known band. Options: ${[...BANDS].join(', ')}.`,
    );
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const { sections, skipped } = buildSections(full, itemIds);
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);
  if (totalItems === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 content items — lesson_plan needs at least one markdown/link/sketch/text item.`,
    );
  }

  // Resolve every item once (sketches → shared figure files), then render
  // each face from the same records.
  const figureFiles = [];
  const sectionsResolved = [];
  for (const s of sections) {
    const recs = [];
    for (const it of s.items) {
      recs.push(await resolveItem(it, s.key, s.audience, figureFiles));
    }
    sectionsResolved.push({ key: s.key, label: s.label, audience: s.audience, recs });
  }

  const teacherSectionsHtml = renderFace(sectionsResolved, 'teacher');
  const learnerSectionsHtml = renderFace(sectionsResolved, 'learner');

  const overviewHtml = reportMd && reportMd.trim().length > 0
    ? `<section class="overview">${renderMarkdown(reportMd)}</section>`
    : '';

  const bandLabel = humanizeBand(band);

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');
  for (const f of figureFiles) {
    await fs.writeFile(path.join(dir, f.filename), f.body, 'utf8');
  }

  const sharedSlots = {
    generator: escapeHtml(`mojulo cook / lesson_plan template v${LESSON_PLAN_VERSION}`),
    template_version: escapeHtml(LESSON_PLAN_VERSION),
    title: escapeHtml(aim),
    cover_title: escapeHtml(aim),
    overview_html: overviewHtml,
    band_label: escapeHtml(bandLabel),
    cook_ref: escapeHtml(cookRef),
    generated_at_human: escapeHtml(humanNow()),
    style_overrides: styleOverridesHtml,
  };

  const teacherTpl = await fs.readFile(TEACHER_TEMPLATE_PATH, 'utf8');
  const teacherHtml = await renderTemplate(teacherTpl, {
    ...sharedSlots,
    sections_html: teacherSectionsHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, teacherHtml, 'utf8');

  const handoutTpl = await fs.readFile(HANDOUT_TEMPLATE_PATH, 'utf8');
  const handoutHtml = await renderTemplate(handoutTpl, {
    ...sharedSlots,
    band: escapeHtml(band),
    sections_html: learnerSectionsHtml,
  });
  await fs.writeFile(path.join(dir, 'handout.html'), handoutHtml, 'utf8');

  const figureFilenames = figureFiles.map((f) => f.filename);
  const files = ['report.md', 'index.html', 'handout.html', ...figureFilenames];

  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind, style: { learner_band: band } },
    template: 'lesson_plan',
    template_version: LESSON_PLAN_VERSION,
    generated_at: isoNow(),
    aim,
    face: 'both',
    learner_band: band,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    section_count: sectionsResolved.length,
    drawer_audience: Object.fromEntries(sectionsResolved.map((s) => [s.key, s.audience])),
    sections: sectionsResolved.map((s) => ({
      key: s.key,
      label: s.label,
      audience: s.audience,
      teacher_item_count: s.recs.filter((r) => audienceIncludes(r.audience, 'teacher')).length,
      learner_item_count: s.recs.filter((r) => audienceIncludes(r.audience, 'learner')).length,
    })),
    skipped_items: skipped,
    files,
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: files.length + 1,
    templateVersion: LESSON_PLAN_VERSION,
    sectionCount: sectionsResolved.length,
    learnerBand: band,
    skippedItems: skipped,
  };
}

export const _internals = {
  escapeHtml,
  splitMarkdownHeader,
  splitAnswer,
  peelTrailingAnswer,
  itemAudience,
  audienceIncludes,
  buildSections,
  humanizeBand,
  RESERVED,
  BANDS,
  DEFAULT_BAND,
};
