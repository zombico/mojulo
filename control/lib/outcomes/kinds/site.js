/**
 * Site writer (publication kind: site).
 *
 * The first NAVIGATIONAL kind. Renders a stash as a self-contained, portable,
 * multi-page static website:
 *
 *   <cook_ref>/
 *     ├── index.html        home page  (root items → hero + sections)
 *     ├── <slug>.html       one page per drawer (about, services, contact…)
 *     ├── report.md         source-of-truth markdown (cover blurb slot)
 *     ├── asset-*.png/…     raster images referenced relatively
 *     └── manifest.json     machine index (+ a pages[] map)
 *
 * PORTABILITY CONTRACT (the thing that makes it a real website, not a viewer
 * document): every internal link is RELATIVE — `about.html`, `asset-1.png` —
 * never an absolute `/outcomes/<ref>/…`. The folder must run identically from
 * file://, the /outcomes/<ref>/ route, AND any external static host.
 *
 * Strictly static: no JS framework, no runtime. The mobile nav is a CSS-only
 * checkbox toggle baked into site_page.html.
 *
 * Structure of the stash → site mapping:
 *   - drawer  = page. Root items (no drawer) = the home page.
 *   - order   = section order down the page.
 *   - metadata.role routes an item to a special slot: hero | cta | feature |
 *     service | footer. Unroled items are ordinary sections.
 *   - style   = presentation only (a preset token block + optional accent); the
 *     renderer never rewrites prose.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { StashRepository } from '@/lib/db/repositories/stashes';

import { renderMarkdown } from '../markdown.js';
import { renderTemplate } from '../render-template.js';
import { outcomeDirFor } from '@/lib/outcomes-paths';
import { resolveSketchItem } from '../resolvers/sketch.js';
import { resolveImageItem } from '../resolvers/image.js';

export const SITE_VERSION = 'site-1';

const HERE = moduleDir(import.meta.url, 'lib/outcomes/kinds');
const TEMPLATE_PATH = path.join(HERE, '..', 'template', 'site_page.html');

const PRESETS = new Set(['personal', 'marketing', 'business', 'minimal']);
const DEFAULT_PRESET = 'business';

// Item types the site kind renders. Others are skipped (recorded in manifest).
const ACCEPTED = new Set(['markdown', 'text', 'link', 'sketch', 'image', 'svg']);

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}
function attr(s) { return escapeHtml(s); }

function isoNow() { return new Date().toISOString(); }
function thisYear() { return new Date().getFullYear(); }

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Pull a leading `# heading` off a markdown body. Returns { title, rest }. */
function splitHeading(md) {
  const lines = String(md || '').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    return { title: lines[i].replace(/^#\s+/, '').trim(), rest: lines.slice(i + 1).join('\n').replace(/^\s+/, '') };
  }
  return { title: '', rest: String(md || '') };
}

/** First real paragraph (skipping a leading heading), as plain-ish lede text. */
function firstParagraph(md) {
  const blocks = String(md || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const block = blocks.find((b) => !/^#/.test(b)) || blocks[0] || '';
  return block.replace(/^#+\s+/, '').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim();
}

function roleOf(item) {
  const r = item?.metadata?.role;
  return typeof r === 'string' ? r.toLowerCase().trim() : '';
}

/**
 * Build the ordered page list from a resolved stash. Home first (root items),
 * then one page per drawer in drawer order. A drawer with no accepted items is
 * still given a page (empty pages are cheap; nav stays predictable) — callers
 * that want to prune can filter on section_count.
 */
function planPages(full, skipped) {
  const drawerOrder = new Map(full.drawers.map((d, i) => [d.name, i]));
  const byDrawer = new Map(); // drawerName|null → items[]
  byDrawer.set(null, []);
  for (const d of full.drawers) byDrawer.set(d.name, []);

  for (const it of full.items) {
    if (!ACCEPTED.has(it.type)) {
      skipped.push({ id: it.id, type: it.type, reason: `site does not render type '${it.type}'` });
      continue;
    }
    const key = it.drawer ?? null;
    if (!byDrawer.has(key)) byDrawer.set(key, []);
    byDrawer.get(key).push(it);
  }

  const pages = [{ slug: 'home', label: 'Home', file: 'index.html', isHome: true, items: byDrawer.get(null) || [] }];
  const drawers = [...byDrawer.keys()].filter((k) => k !== null)
    .sort((a, b) => (drawerOrder.get(a) ?? 999) - (drawerOrder.get(b) ?? 999));
  const used = new Set(['home', 'index']);
  for (const name of drawers) {
    let s = slug(name);
    while (used.has(s)) s = `${s}-x`;
    used.add(s);
    pages.push({ slug: s, label: name, file: `${s}.html`, isHome: false, items: byDrawer.get(name) });
  }
  return pages;
}

/**
 * Resolve one item to a render record (resolving sketches/images to files).
 * assetFiles accumulates the raster files to write. Returns null for a skipped
 * item (recorded by the caller).
 */
async function resolveItem(item, assetFiles) {
  const role = roleOf(item);
  if (item.type === 'markdown') {
    const { title, rest } = splitHeading(item.bodyMd);
    return { kind: 'markdown', role, title, html: renderMarkdown(rest || ''), raw: item.bodyMd || '' };
  }
  if (item.type === 'text') {
    return { kind: 'text', role, title: item.title || '', body: item.body || '' };
  }
  if (item.type === 'link') {
    return { kind: 'link', role, url: item.sourceUrl || '', label: item.title || item.sourceUrl || '' };
  }
  if (item.type === 'svg') {
    return { kind: 'figure', role, inline: item.body || '', caption: renderMarkdownCaption(item.bodyMd), missing: !item.body };
  }
  if (item.type === 'sketch') {
    const ref = item?.metadata?.sketch_ref;
    const resolved = await resolveSketchItem({ metadata: { sketch_ref: ref } }, { technical: false });
    return {
      kind: 'figure', role,
      inline: resolved.dangling ? '' : resolved.svgInline,
      caption: renderMarkdownCaption(item.bodyMd),
      label: item?.metadata?.label || '',
      missing: resolved.dangling, ref,
    };
  }
  if (item.type === 'image') {
    const resolved = await resolveImageItem(item);
    if (resolved.dangling) {
      return { kind: 'figure', role, img: null, caption: renderMarkdownCaption(item.bodyMd), missing: true, ref: item.mediaRef };
    }
    const filename = `asset-${assetFiles.length + 1}.${resolved.ext}`;
    assetFiles.push({ filename, buffer: resolved.buffer });
    return { kind: 'figure', role, img: filename, alt: item.title || '', caption: renderMarkdownCaption(item.bodyMd), missing: false };
  }
  return null;
}

function renderMarkdownCaption(md) {
  const t = String(md || '').trim();
  return t ? renderMarkdown(t) : '';
}

// ---- block → HTML -----------------------------------------------------------

function renderFigure(rec) {
  let body;
  if (rec.inline) body = rec.inline;
  else if (rec.img) body = `<img src="${attr(rec.img)}" alt="${attr(rec.alt || '')}">`;
  else return `<div class="figure missing">missing visual${rec.ref ? ` · ${escapeHtml(rec.ref)}` : ''}</div>`;
  const cap = (rec.label || rec.caption)
    ? `<figcaption>${rec.label ? `<strong>${escapeHtml(rec.label)}</strong> ` : ''}${rec.caption || ''}</figcaption>`
    : '';
  return `<figure class="figure">${body}${cap}</figure>`;
}

function renderLinkCard(rec) {
  const dom = domainOf(rec.url);
  return `<a class="linkcard" href="${attr(rec.url)}" target="_blank" rel="noopener noreferrer">`
    + `<span>${escapeHtml(rec.label)}</span>`
    + `${dom ? `<span class="lc-domain">${escapeHtml(dom)}</span>` : ''}</a>`;
}

function renderCallout(rec) {
  const t = rec.title ? `<p class="callout-title">${escapeHtml(rec.title)}</p>` : '';
  return `<aside class="callout">${t}<p>${escapeHtml(rec.body)}</p></aside>`;
}

/** A feature/service card. text → title+body; markdown → title+rendered body. */
function renderCard(rec) {
  if (rec.kind === 'text') {
    return `<div class="card"><h3>${escapeHtml(rec.title || '')}</h3><p>${escapeHtml(rec.body || '')}</p></div>`;
  }
  return `<div class="card"><h3>${escapeHtml(rec.title || '')}</h3><div>${rec.html || ''}</div></div>`;
}

/**
 * Render a page's body items (already resolved) into section HTML. Consecutive
 * feature/service records collapse into one responsive card grid. Everything
 * else renders as its own `.section`.
 */
function renderSections(recs) {
  const out = [];
  let i = 0;
  while (i < recs.length) {
    const rec = recs[i];
    if (rec.role === 'feature' || rec.role === 'service') {
      const cards = [];
      while (i < recs.length && (recs[i].role === 'feature' || recs[i].role === 'service')) {
        cards.push(renderCard(recs[i]));
        i += 1;
      }
      out.push(`<section class="section"><div class="wrap"><div class="grid">${cards.join('')}</div></div></section>`);
      continue;
    }
    out.push(`<section class="section"><div class="wrap">${renderBlock(rec)}</div></section>`);
    i += 1;
  }
  return out.join('\n');
}

function renderBlock(rec) {
  if (rec.kind === 'markdown') {
    const head = rec.title ? `<div class="section-head"><h2>${escapeHtml(rec.title)}</h2></div>` : '';
    return `${head}<div class="prose">${rec.html}</div>`;
  }
  if (rec.kind === 'text') return renderCallout(rec);
  if (rec.kind === 'link') return renderLinkCard(rec);
  if (rec.kind === 'figure') return renderFigure(rec);
  return '';
}

// ---- hero -------------------------------------------------------------------

/**
 * Build the hero band for a page. On the home page it prefers a role="hero"
 * item, falling back to the cook's aim (headline) + report_md (lede). CTAs come
 * from role="cta" link items. Returns { html, consumed:Set<recIndex> }.
 */
function buildHero(recs, page, aim, reportMd, siteTagline) {
  const consumed = new Set();
  let title = '';
  let lede = '';
  let eyebrow = page.isHome ? (siteTagline || '') : '';

  const heroIdx = recs.findIndex((r) => r.role === 'hero');
  if (heroIdx !== -1) {
    const h = recs[heroIdx];
    consumed.add(heroIdx);
    if (h.kind === 'markdown') { title = h.title || ''; lede = firstParagraph(h.raw); }
    else if (h.kind === 'text') { title = h.title || ''; lede = h.body || ''; }
  }

  if (!title) title = page.isHome ? aim : page.label;
  if (!lede && page.isHome) lede = firstParagraph(reportMd);

  const ctas = [];
  recs.forEach((r, idx) => {
    if (r.role === 'cta' && r.kind === 'link') {
      consumed.add(idx);
      const ghost = ctas.length > 0 ? ' ghost' : '';
      ctas.push(`<a class="btn${ghost}" href="${attr(r.url)}">${escapeHtml(r.label)}</a>`);
    }
  });

  const eb = eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : '';
  const ld = lede ? `<p class="lede">${escapeHtml(lede)}</p>` : '';
  const ac = ctas.length ? `<div class="actions">${ctas.join('')}</div>` : '';
  const html = `<header class="hero"><div class="wrap">${eb}<h1>${escapeHtml(title)}</h1>${ld}${ac}</div></header>`;
  return { html, consumed };
}

// ---- nav + footer -----------------------------------------------------------

function renderNav(pages, activeSlug, brand) {
  const links = pages.map((p) => {
    const cur = p.slug === activeSlug ? ' aria-current="page"' : '';
    return `<li><a href="${attr(p.file)}"${cur}>${escapeHtml(p.label)}</a></li>`;
  }).join('');
  return `<div class="wrap">`
    + `<a class="brand" href="index.html">${escapeHtml(brand)}</a>`
    + `<input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Toggle menu">`
    + `<label for="nav-toggle" class="nav-burger" aria-hidden="true">☰</label>`
    + `<ul class="nav-links">${links}</ul>`
    + `</div>`;
}

function renderFooter(brand, tagline, pages, footerRecs) {
  const navCol = `<div><div class="foot-brand">${escapeHtml(brand)}</div>`
    + (tagline ? `<p style="margin:.4rem 0 0">${escapeHtml(tagline)}</p>` : '') + `</div>`;
  const linksCol = `<div><ul style="list-style:none;margin:0;padding:0;line-height:2">`
    + pages.map((p) => `<li><a href="${attr(p.file)}">${escapeHtml(p.label)}</a></li>`).join('')
    + `</ul></div>`;
  const contactCols = footerRecs.map((r) => {
    if (r.kind === 'text') return `<div><div class="foot-brand" style="font-size:.95rem">${escapeHtml(r.title || 'Contact')}</div><p style="margin:.4rem 0 0;white-space:pre-line">${escapeHtml(r.body || '')}</p></div>`;
    if (r.kind === 'link') return `<div><a href="${attr(r.url)}">${escapeHtml(r.label)}</a></div>`;
    if (r.kind === 'markdown') return `<div class="prose" style="font-size:.9rem">${r.html}</div>`;
    return '';
  }).join('');
  return `<footer class="site-footer"><div class="wrap"><div class="cols">${navCol}${linksCol}${contactCols}</div>`
    + `<div class="colophon">© ${thisYear()} ${escapeHtml(brand)}</div></div></footer>`;
}

// ---- writer -----------------------------------------------------------------

export async function writeSiteOutcome({
  cookRef,
  aim,
  stashRef,
  reportMd = '',
  publicationKind = 'site',
  styleOverridesHtml = '',
  preset,
  accent,
}) {
  if (!cookRef || typeof cookRef !== 'string') throw new Error('cookRef is required');
  if (!aim || typeof aim !== 'string') throw new Error('aim is required');
  if (!stashRef || typeof stashRef !== 'string') {
    throw new Error('stashRef is required (site builds from a single stash)');
  }

  const chosenPreset = (preset === undefined || preset === null || preset === '') ? DEFAULT_PRESET : preset;
  if (!PRESETS.has(chosenPreset)) {
    throw new Error(`publication.style.preset '${chosenPreset}' is not a known preset. Options: ${[...PRESETS].join(', ')}.`);
  }

  // Accent override, applied inline on <body> (specificity 1,0,0,0) so it beats
  // the preset's own --accent. Must be a validated hex — cook resolves named
  // colors to hex before we see it; this is a belt-and-suspenders gate.
  const accentHex = (typeof accent === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent.trim()))
    ? accent.trim() : null;
  const bodyStyle = accentHex ? ` style="--accent: ${accentHex}"` : '';

  const full = StashRepository.getFull(stashRef);
  if (!full) throw new Error(`Stash '${stashRef}' not found`);

  // Site-level metadata: sniff a role="site"/site metadata off any item.
  let siteName = '';
  let siteTagline = '';
  for (const it of full.items) {
    const s = it?.metadata?.site;
    if (s && typeof s === 'object') {
      if (!siteName && typeof s.name === 'string') siteName = s.name;
      if (!siteTagline && typeof s.tagline === 'string') siteTagline = s.tagline;
    }
  }
  if (!siteName) siteName = full.stash.title || aim;

  const skipped = [];
  const pages = planPages(full, skipped);

  const totalAccepted = pages.reduce((n, p) => n + p.items.length, 0);
  if (totalAccepted === 0) {
    throw new Error(
      `Stash '${stashRef}' produced 0 renderable items — site needs at least one markdown/text/link/sketch/image/svg item.`,
    );
  }

  const dir = outcomeDirFor(cookRef);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'report.md'), reportMd, 'utf8');

  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const assetFiles = [];
  const pageManifest = [];
  const files = ['report.md'];

  // Footer-role items are SITE-GLOBAL: resolved once, rendered in every page's
  // footer, and excluded from page bodies wherever they live.
  const footerItems = full.items.filter((it) => ACCEPTED.has(it.type) && roleOf(it) === 'footer');
  const footerIds = new Set(footerItems.map((it) => it.id));
  const footerRecs = [];
  for (const it of footerItems) {
    const r = await resolveItem(it, assetFiles);
    if (r) footerRecs.push(r);
  }
  const footerHtml = renderFooter(siteName, siteTagline, pages, footerRecs);

  for (const page of pages) {
    // Resolve this page's body items in order (footer items handled globally).
    const bodyRecs = [];
    for (const it of page.items) {
      if (footerIds.has(it.id)) continue;
      const rec = await resolveItem(it, assetFiles);
      if (rec) bodyRecs.push(rec);
    }

    // Hero (consumes hero/cta records from the body).
    const { html: heroHtml, consumed } = buildHero(bodyRecs, page, aim, reportMd, siteTagline);
    const sectionRecs = bodyRecs.filter((_, idx) => !consumed.has(idx));
    const sectionsHtml = renderSections(sectionRecs);

    const pageContent = `${heroHtml}\n${sectionsHtml}`;

    // Per-page SEO: first item carrying metadata.seo wins.
    let seoDesc = '';
    for (const it of page.items) {
      const seo = it?.metadata?.seo;
      if (seo && typeof seo === 'object' && typeof seo.description === 'string') { seoDesc = seo.description; break; }
    }
    if (!seoDesc) seoDesc = page.isHome ? (siteTagline || firstParagraph(reportMd) || aim) : `${page.label} — ${siteName}`;

    const pageTitle = page.isHome ? siteName : `${page.label} — ${siteName}`;
    const navHtml = renderNav(pages, page.slug, siteName);

    const filled = await renderTemplate(tpl, {
      generator: escapeHtml(`mojulo cook / site template v${SITE_VERSION}`),
      title: escapeHtml(pageTitle),
      site_name: attr(siteName),
      seo_description: attr(seoDesc),
      og_title: attr(pageTitle),
      preset: attr(chosenPreset),
      page_slug: attr(page.slug),
      body_style: bodyStyle,
      nav_html: navHtml,
      page_content: pageContent,
      footer_html: footerHtml,
      style_overrides: styleOverridesHtml,
    });

    await fs.writeFile(path.join(dir, page.file), filled, 'utf8');
    files.push(page.file);
    pageManifest.push({ slug: page.slug, label: page.label, file: page.file, section_count: sectionRecs.length });
  }

  for (const a of assetFiles) {
    await fs.writeFile(path.join(dir, a.filename), a.buffer);
    files.push(a.filename);
  }

  const manifest = {
    cook_ref: cookRef,
    publication: { kind: publicationKind, style: { preset: chosenPreset } },
    template: 'site',
    template_version: SITE_VERSION,
    generated_at: isoNow(),
    aim,
    site_name: siteName,
    preset: chosenPreset,
    stash_ref: stashRef,
    stash_title: full.stash.title,
    page_count: pages.length,
    pages: pageManifest,
    skipped_items: skipped,
    files,
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outcomeDir: dir,
    indexPath: path.join(dir, 'index.html'),
    fileCount: files.length + 1, // + manifest.json
    templateVersion: SITE_VERSION,
    pageCount: pages.length,
    preset: chosenPreset,
    skippedItems: skipped,
  };
}

export const _internals = {
  escapeHtml, slug, splitHeading, firstParagraph, roleOf, planPages,
  renderNav, renderSections, buildHero, PRESETS, DEFAULT_PRESET, ACCEPTED,
};
