/**
 * Minimal HTML-safe markdown renderer for Outcome Artifacts.
 *
 * Why custom: control plane has no markdown lib in deps, and the Outcome
 * template's "static, no JS, no client-side rendering" posture means the
 * markdown→HTML happens once at cook time, server-side, and the output sits
 * frozen on disk. A 200-line renderer is cheaper than pulling marked + a
 * sanitizer.
 *
 * Safety: ALL text is HTML-escaped before any transformation. Raw HTML in
 * source is rendered as literal text. No script tags, no inline event
 * handlers, no img src=javascript: — nothing user-supplied can produce
 * executable HTML.
 *
 * Supports: headings (# … ######), paragraphs, blockquotes (>), unordered
 * lists (- / *), ordered lists (1.), fenced code blocks (```), horizontal
 * rules (---), tables (GFM-style with header + separator + body), inline
 * code (`), bold (**), italic (*), links ([text](url)). Nested lists and
 * nested formatting are intentionally NOT supported — a model-authored
 * outcome report doesn't need them, and supporting them blows up the
 * renderer.
 */

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

// Allow only http(s) and mailto URLs in links. Anything else (javascript:,
// data:, file:, etc.) gets stripped — the link renders as plain text.
function safeUrl(url) {
  const trimmed = String(url || '').trim();
  if (/^(https?:|mailto:|#)/i.test(trimmed)) return trimmed;
  return null;
}

function applyInline(text) {
  // Order matters: escape HTML first, THEN apply markdown transformations on
  // the already-escaped text. Markdown markers can't produce HTML special
  // chars, so this is safe — but raw HTML in the source becomes literal
  // (e.g. "<script>" renders as "&lt;script&gt;").
  let out = escapeHtml(text);

  // Inline code first — its content shouldn't be re-processed for bold/italic.
  // Use a placeholder pass.
  const codeSlots = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    const i = codeSlots.length;
    codeSlots.push(code);
    return `\x00CODE${i}\x00`;
  });

  // Links: [text](url). The text content goes through escape (already done).
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return label;
    return `<a href="${escapeHtml(safe)}">${label}</a>`;
  });

  // Bold then italic — bold uses ** to avoid conflict with single * italic.
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Restore inline code. codeSlots already contains escaped text — we
  // captured it from the post-escape stream — so do NOT escape again here.
  out = out.replace(/\x00CODE(\d+)\x00/g, (_, i) => `<code>${codeSlots[Number(i)]}</code>`);

  return out;
}

function renderTable(headerRow, bodyRows) {
  const cells = (row) => row.split('|').slice(1, -1).map((c) => c.trim());
  const headers = cells(headerRow);
  const bodies = bodyRows.map(cells);
  const thead = `<thead><tr>${headers.map((h) => `<th>${applyInline(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${bodies
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${applyInline(c)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

export function renderMarkdown(src) {
  if (typeof src !== 'string') return '';
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Fenced code block.
    const fence = line.match(/^```\s*([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      const lang = fence[1];
      i++;
      const code = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${classAttr}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${applyInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line) || /^---+$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Table: a header row, then a separator row of |---|---|, then rows.
    if (
      /^\s*\|.+\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])
    ) {
      const header = line.trim();
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        body.push(lines[i].trim());
        i++;
      }
      out.push(renderTable(header, body));
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${applyInline(quoted.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(`<ul>${items.map((t) => `<li>${applyInline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${items.map((t) => `<li>${applyInline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    // Paragraph — accrete until a blank line or a block-starter.
    const para = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*\|.+\|\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${applyInline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

// Test seam.
export const _internals = { escapeHtml, safeUrl, applyInline };
