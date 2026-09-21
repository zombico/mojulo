// field-exact: the scene dispatcher readies the kernel for ANY recipe that wants it (a workbench
// field or cut, a code program, an assembler's frozen sources, a scad row's embedded fields) and
// only then — a recipe without exact terms renders synchronously, as it always did. This file runs
// in its own module registry, so the kernel is COLD for the second case.

import { describe, expect, it } from 'vitest';
import { renderSceneHtml } from './scene-html.js';
import { exactKernelReady } from '@/lib/graph/polygonizer/field-exact';

let hasKernel = true;
try { await import('manifold-3d'); } catch { hasKernel = false; }

const BOX = { id: 'b', op: 'add', shape: { kind: 'box', center: [0, 0, 1], size: [4, 2, 2] } };
const sketch = (exact) => ({ title: 'box', manifest: { kind: 'workbench', fields: [{ id: 'f', ...(exact ? { exact: true } : {}), terms: [BOX] }] } });

describe('renderSceneHtml — the exact seam', () => {
  it('a recipe without exact terms renders synchronously, as before', () => {
    const out = renderSceneHtml(sketch(false));
    expect(typeof out).toBe('string');
    expect(out).toContain('class="f"');
  });

  it('an exact recipe on a cold kernel returns a PROMISE of the HTML; warm, the plain string', async () => {
    if (!hasKernel) return;
    expect(exactKernelReady()).toBe(false);
    const out = renderSceneHtml(sketch(true));
    expect(typeof out.then).toBe('function');
    const html = await out;
    expect(html).toContain('class="f"');
    expect(exactKernelReady()).toBe(true);
    expect(typeof renderSceneHtml(sketch(true))).toBe('string');
  });
});
