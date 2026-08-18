/**
 * Newsletter writer (publication kind: newsletter).
 *
 * Scroll-mode US-letter publication shaped like a periodical: masthead at
 * top with `aim` as the title and `report_md` as the lede, an optional
 * hero figure pulled from the first sketch/image item, then a 2-column
 * grid of article cards (markdown items), then an "in case you missed it"
 * footer section of link items.
 *
 * Item resolver dispatch:
 *   markdown    → article card in the grid
 *   sketch / svg → hero figure (first wins; subsequent skipped)
 *   text        → pull-quote card in the grid
 *   link        → entry in the "links" footer section
 *   other       → skipped
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '../paths.js';
import { resolveSketchItem, stripXmlDecl } from '../resolvers/sketch.js';

export const NEWSLETTER_VERSION = 'nl-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'newsletter.html');

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function isoNow() { return new Date().toISOString(); }
function humanNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function splitMarkdownHeadline(md) {
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

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export async function writeNewsletterOutcome({
  cookRef,
  aim,
  stashRef,
  itemIds,
  reportMd = '',
  publicationKind = 'newsletter',
  styleOverridesHtml = '',
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (newsletter builds from a single stash)');
  }

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  const filter = itemIds ? new Set(itemIds) : null;
  const items = filter ? full.items.filter((it) => filter.has(it.id)) : full.items;

  const articles = [];
  const links = [];
  const skipped = [];
  let heroResolution = null;
  let heroCaption = null;
  let heroFilename = null;

  for (const item of items) {
    if (!heroResolution && (item.type === 'sketch' || item.type === 'svg')) {
      if (item.type === 'sketch') {
        const r = await resolveSketchItem(
          { metadata: { sketch_ref: item.metadata?.sketch_ref } },
          { technical: false },
        );
        heroResolution = r;
        heroCaption = item.metadata?.label || item.title || null;
        if (r.svgStandalone) heroFilename = 'hero.svg';
      } else {
        const raw = item.body || null;
        heroResolution = {
          svgInline: raw ? stripXmlDecl(raw) : null,
          svgStandalone: raw,
          dangling: !raw,
        };
        heroCaption = item.title || null;
        if (raw) heroFilename = 'hero.svg';
      }
      continue;
    }
    if (item.type === 'markdown') {
      articles.push({ kind: 'article', item });
      continue;
    }
    if (item.type === 'text') {
      articles.push({ kind: 'pull_quote', item });
      continue;
    }
    if (item.type === 'link') {
      links.push(item);
      continue;
    }
    skipped.push({ id: item.id, type: item.type, reason: `newsletter does not render type '${item.type}'` });
  }

  if (articles.length === 0 && links.length === 0 && (!reportMd || !reportMd.trim())) {
    throw new Error(
      `Stash '${stashRef}' produced 0 newsletter content — needs markdown / text / link items or a non-empty report_md.`,
    );
  }

  // Articles HTML.
  const articlesHtml = articles.map((a) => {
    if (a.kind === 'pull_quote') {
      return `<div class="article pull-quote">${escapeHtml(a.item.body || '')}</div>`;
    }
    const { title, rest } = splitMarkdownHeadline(a.item.bodyMd);
    const headlineText = title || a.item.title || 'Untitled';
    const bodyHtml = rest ? renderMarkdown(rest) : '';
    return `<div class="article"><h2>${escapeHtml(headlineText)}</h2><div class="body">${bodyHtml}</div></div>`;
  }).join('\n');

  // Links HTML.
  const linksHtml = links.length > 0
    ? `<section class="links-section"><h3>In case you missed it</h3>${links.map(
        (l) => `<div class="link"><a href="${escapeHtml(l.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.title || l.sourceUrl)}</a><span class="domain">${escapeHtml(domainOf(l.sourceUrl))}</span></div>`,
      ).join('')}</section>`
    : '';

  // Hero figure.
  const heroHtml = heroResolution && heroResolution.svgInline
    ? `<figure class="hero-figure"><div class="visual">${heroResolution.svgInline}</div>${heroCaption ? `<figcaption>${escapeHtml(heroCaption)}</figcaption>` : ''}</figure>`
    : '';

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');
  if (heroFilename && heroResolution.svgStandalone) {
    await fs.writeFile(path.join(dir, heroFilename), heroResolution.svgStandalone, 'utf8');
  }

  const ledeHtml = reportMd && reportMd.trim().length > 0
    ? renderMarkdown(reportMd)
    : '<p style="color:#94a3b8;font-style:italic;">(no lede)</p>';

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const filled = await renderTemplate(tpl, {
    generator: escapeHtml(`mojulo cook / newsletter template v${NEWSLETTER_VERSION}`),
    template_version: escapeHtml(NEWSLETTER_VERSION),
    title: escapeHtml(aim),
    nl_title: escapeHtml(aim),
    nl_kicker: escapeHtml(`${full.stash.title}`),
    nl_lede_html: ledeHtml,
    nl_hero_html: heroHtml,
    nl_articles_html: articlesHtml || '<p style="color:#94a3b8;font-style:italic;grid-column:1/-1;">(no articles)</p>',
    nl_links_html: linksHtml,
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
    template: 'newsletter',
    template_version: NEWSLETTER_VERSION,
    generated_at: isoNow(),
    aim,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    article_count: articles.length,
    link_count: links.length,
    hero_filename: heroFilename || null,
    skipped_items: skipped,
    files: [
      'report.md',
      'index.html',
      ...(heroFilename ? [heroFilename] : []),
    ],
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
    templateVersion: NEWSLETTER_VERSION,
    articleCount: articles.length,
    linkCount: links.length,
    skippedItems: skipped,
  };
}

export const _internals = { escapeHtml, splitMarkdownHeadline, domainOf };
