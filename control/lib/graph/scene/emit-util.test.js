import { describe, expect, it } from 'vitest';

import { escapeHtml, safeJson } from './emit-util.js';
import { emitThreeWorld } from './scene-three.js';

describe('safeJson', () => {
  it('escapes every < so </script> in a value cannot terminate the page script', () => {
    const out = safeJson({ text: 'pwned</script><b>x' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(JSON.parse(out).text).toBe('pwned</script><b>x'); // runtime value unchanged
  });

  it('matches JSON.stringify byte-for-byte when the value carries no <', () => {
    const v = { a: 1, b: ['x', null], c: 'plain text > fine & "quoted"' };
    expect(safeJson(v)).toBe(JSON.stringify(v));
  });

  it('renders "undefined" for undefined, like raw interpolation did', () => {
    expect(safeJson(undefined)).toBe('undefined');
  });
});

describe('escapeHtml', () => {
  it('neutralizes markup in titles', () => {
    expect(escapeHtml('a <script> & "b"')).toBe('a &lt;script&gt; &amp; &quot;b&quot;');
  });
});

describe('emitThreeWorld script-injection hardening', () => {
  const quad = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888888' };
  const hostile = 'closing tag</script><script>alert(1)</script>';

  it('a sign text containing </script> does not add script boundaries to the page', () => {
    const clean = emitThreeWorld({ faces: [quad], signs: [{ id: 's1', variant: 'toast', anchor: { kind: 'slot', slot: 'top' }, text: 'hello', body: [], chrome: {} }] });
    const dirty = emitThreeWorld({ faces: [quad], signs: [{ id: 's1', variant: 'toast', anchor: { kind: 'slot', slot: 'top' }, text: hostile, body: [], chrome: {} }] });
    const count = (s) => (s.match(/<\/script>/g) || []).length;
    expect(count(dirty)).toBe(count(clean)); // hostile text added ZERO script closes
  });

  it('a hostile title cannot break out of <title>', () => {
    const html = emitThreeWorld({ faces: [quad], title: hostile });
    expect(html).toContain('<title>closing tag&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>');
  });
});
