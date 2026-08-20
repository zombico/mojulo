/**
 * Resume / CV writer (publication kind: resume).
 *
 * Single-page US-letter resume. Markdown items become sections — each
 * item's first h1 is the section name, the rest is the section content.
 * Drawer name routes the section to the left sidebar (Skills, Education,
 * Contact) or the main column (Experience, Projects, Publications).
 *
 * Item resolver dispatch:
 *   markdown → section (h1 = title; body = content). Items in a drawer
 *              named 'sidebar' (or any drawer whose name starts with 'sb-')
 *              go in the left column; everything else goes in the main
 *              right column. Drawer name 'identity' is special — its first
 *              item provides the resume header (name + tagline + summary).
 *   text → fallback section content (rare)
 *   other → skipped
 *
 * The agent's `report_md` is the header summary (under the name), used when
 * no 'identity' drawer is present.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';

export const RESUME_VERSION = 're-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'resume.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function splitMarkdownHeader(md) {
  const lines = String(md || '').split('\n');
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) { titleIdx = i; break; }
  }
  if (titleIdx === -1) return { title: '', rest: '' };
  const title = lines[titleIdx].replace(/^#+\s+/, '').trim();
  const rest = lines.slice(titleIdx + 1).join('\n').replace(/^\s+/, '');
  return { title, rest };
}

function isSidebarDrawer(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return n === 'sidebar' || n.startsWith('sb-') || n === 'skills' || n === 'education' || n === 'contact';
}

function isIdentityDrawer(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return n === 'identity' || n === 'header';
}

export async function writeResumeOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'resume',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (resume builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  // Build a drawerId → name map for routing.
  const drawerNameById = new Map();
  for (const d of full.drawers) drawerNameById.set(d.id, d.name);

  // Identity: first item in an 'identity' drawer wins; falls back to aim.
  let resumeName = aim;
  let resumeTagline = '';
  let resumeSummary = '';

  const sidebarSections = [];
  const mainSections = [];
  const skipped = [];

  for (const item of items) {
    const drawerName = item.drawerId === null ? null : (drawerNameById.get(item.drawerId) || null);
    if (item.type !== 'markdown' && item.type !== 'text') {
      skipped.push({ id: item.id, type: item.type, reason: `resume does not render type '${item.type}'` });
      continue;
    }

    // Identity drawer drives header + summary.
    if (isIdentityDrawer(drawerName) && item.type === 'markdown') {
      const { title, rest } = splitMarkdownHeader(item.bodyMd);
      if (title) resumeName = title;
      // First line after title is the tagline; rest is summary.
      const restLines = rest.split('\n');
      let taglineIdx = -1;
      for (let i = 0; i < restLines.length; i++) {
        if (restLines[i].trim().length > 0) { taglineIdx = i; break; }
      }
      if (taglineIdx !== -1) {
        resumeTagline = restLines[taglineIdx].trim();
        resumeSummary = restLines.slice(taglineIdx + 1).join('\n').replace(/^\s+/, '');
      }
      continue;
    }

    // Section content. Markdown items provide section name (h1) + body.
    let sectionName;
    let sectionBody;
    if (item.type === 'markdown') {
      const { title, rest } = splitMarkdownHeader(item.bodyMd);
      sectionName = title || drawerName || item.title || 'Section';
      sectionBody = rest;
    } else {
      sectionName = item.title || drawerName || 'Note';
      sectionBody = item.body || '';
    }

    const bodyHtml = sectionBody
      ? (item.type === 'markdown' ? renderMarkdown(sectionBody) : `<p>${escapeHtml(sectionBody)}</p>`)
      : '<p style="color:#94a3b8;font-style:italic;">(no content)</p>';
    const sectionHtml = `<section class="section"><h2>${escapeHtml(sectionName)}</h2><div class="body">${bodyHtml}</div></section>`;

    if (isSidebarDrawer(drawerName)) sidebarSections.push(sectionHtml);
    else mainSections.push(sectionHtml);
  }

  if (sidebarSections.length === 0 && mainSections.length === 0 && (!reportMd || !reportMd.trim())) {
    throw new Error(
      `Stash '${stashRef}' produced 0 resume content — needs markdown / text items or a non-empty report_md.`,
    );
  }

  // Header summary fallback.
  if (!resumeSummary && reportMd && reportMd.trim().length > 0) {
    resumeSummary = reportMd;
  }

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / resume template v${RESUME_VERSION}`),
    template_version: escapeHtml(RESUME_VERSION),
    title: escapeHtml(resumeName),
    resume_name: escapeHtml(resumeName),
    resume_tagline_html: resumeTagline ? escapeHtml(resumeTagline) : '',
    resume_summary_html: resumeSummary ? renderMarkdown(resumeSummary) : '',
    sidebar_sections_html: sidebarSections.join('\n') || '<p style="color:#94a3b8;font-style:italic;font-size:13px;">(no sidebar sections)</p>',
    main_sections_html: mainSections.join('\n') || '<p style="color:#94a3b8;font-style:italic;font-size:13px;">(no main sections)</p>',
    cook_ref: escapeHtml(cookRef),
    generated_at_iso: escapeHtml(isoNow()),
    generated_at_human: escapeHtml(humanNow()),
    style_overrides: styleOverridesHtml,
  });
  const indexPath = path.join(dir, 'index.html');
  await fs.writeFile(indexPath, filled, 'utf8');

  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind },
    template: 'resume',
    template_version: RESUME_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    name: resumeName,
    sidebar_section_count: sidebarSections.length,
    main_section_count: mainSections.length,
    skipped_items: skipped,
    files: ['report.md', 'index.html'],
  };
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    outcomeDir: dir,
    indexPath,
    fileCount: manifest.files.length + 1,
    templateVersion: RESUME_VERSION,
    name: resumeName,
    skippedItems: skipped,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeader, isSidebarDrawer, isIdentityDrawer };
