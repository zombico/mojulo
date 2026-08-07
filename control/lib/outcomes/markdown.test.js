// Minimal markdown renderer — exercised at unit level so the static template's
// rendering stays predictable as we iterate on it.

import { describe, it, expect } from 'vitest';
import { renderMarkdown, _internals } from './markdown.js';

const { escapeHtml, safeUrl } = _internals;

describe('outcome markdown renderer', () => {
  it('escapes HTML by default — no script injection survives', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('escapes attribute-like content inside inline code', () => {
    const out = renderMarkdown('use `onerror="x"` here');
    expect(out).toContain('<code>onerror=&quot;x&quot;</code>');
  });

  it('strips javascript: links — renders as plain text', () => {
    const out = renderMarkdown('[click me](javascript:alert(1))');
    expect(out).not.toContain('href');
    expect(out).toContain('click me');
  });

  it('renders headings, paragraphs, and a list', () => {
    const md = [
      '# Title',
      '',
      'A paragraph with **bold** and *italic*.',
      '',
      '- one',
      '- two',
      '- three',
    ].join('\n');
    const out = renderMarkdown(md);
    expect(out).toContain('<h1>Title</h1>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
    expect(out).toMatch(/<ul><li>one<\/li><li>two<\/li><li>three<\/li><\/ul>/);
  });

  it('renders fenced code blocks with the language class', () => {
    const md = '```js\nconst x = 1;\n```';
    const out = renderMarkdown(md);
    expect(out).toContain('<pre><code class="language-js">const x = 1;</code></pre>');
  });

  it('renders tables', () => {
    const md = [
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '| 3 | 4 |',
    ].join('\n');
    const out = renderMarkdown(md);
    expect(out).toContain('<table>');
    expect(out).toContain('<th>A</th>');
    expect(out).toContain('<td>3</td>');
  });

  it('renders blockquotes', () => {
    expect(renderMarkdown('> a quoted thought')).toContain('<blockquote>a quoted thought</blockquote>');
  });

  it('renders safe links', () => {
    const out = renderMarkdown('see [the docs](https://example.org/x)');
    expect(out).toContain('<a href="https://example.org/x">the docs</a>');
  });

  it('escapeHtml handles all five specials', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });

  it('safeUrl allows http(s)/mailto/anchor, rejects others', () => {
    expect(safeUrl('https://example.org')).toBe('https://example.org');
    expect(safeUrl('http://example.org')).toBe('http://example.org');
    expect(safeUrl('mailto:x@y.z')).toBe('mailto:x@y.z');
    expect(safeUrl('#section')).toBe('#section');
    expect(safeUrl('javascript:alert(1)')).toBe(null);
    expect(safeUrl('data:text/html,<script>')).toBe(null);
    expect(safeUrl('file:///etc/passwd')).toBe(null);
  });
});
