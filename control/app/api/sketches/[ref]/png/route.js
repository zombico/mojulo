/**
 * GET /api/sketches/[ref]/png — serve a stored sketch as a rasterized PNG.
 *
 * Rendering lives in @/lib/graph/sketch-png, which dispatches on the sketch's
 * renderer mode: scene kinds (cities / hubs / turntables / rooms) are baked from
 * the live CSS-3D HTML by headless Chromium and disk-cached; SVG/diagram kinds are
 * rasterized from their self-contained SVG with sharp. The gallery uses this as a
 * scene preview (scenes render hard live) and as the "Download PNG" target.
 *
 * Query params:
 *   ?inline=1   — serve inline (Content-Disposition: inline) instead of forcing a
 *                 download. Default is attachment.
 *   ?scale=N    — pixel density / supersample factor (default 2; clamped 1–4).
 */

import { NextResponse } from 'next/server';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { rasterizeSketchToPng } from '@/lib/graph/sketch/sketch-png';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';
import { KIND_KEYFRAME_ANIMATION, KIND_SCENE_MOTION, normalizeImageOutcomesManifest } from '@/lib/graph/image-outcomes/manifest';
import { emitKeyGuide } from '@/lib/graph/image-outcomes/keyframe-emit';
import { emitStageGuidePng } from '@/lib/graph/image-outcomes/scene-plate';

function safeFilename(title, ref) {
  const base = [title, ref].filter(Boolean).join(' ');
  const safe = base
    .trim()
    .replace(/\.png$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'sketch'}.png`;
}

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!sketch.manifest) {
      return NextResponse.json({ error: `Sketch '${ref}' has no manifest` }, { status: 400 });
    }
    // Beats artifacts are audio-only — no still form. Point at the live player
    // instead of falling through to the diagram rasterizer (which would throw).
    if (isBeatsKind(sketch.manifest.kind)) {
      return NextResponse.json({
        error: `Sketch '${ref}' is a beats artifact (audio) — it has no PNG form`,
        player: `/api/sketches/${encodeURIComponent(ref)}/beats`,
      }, { status: 422 });
    }

    const url = new URL(request.url);

    // Keyframe animations have no diagram/scene form — a scaffold request
    // serves the per-key MERU GUIDE (the posed mannequin between register lines
    // the worker paints over) or its OpenPose skeleton (?skeleton=1), emitted
    // deterministically from the manifest's motion + keys.
    if (sketch.manifest.kind === KIND_KEYFRAME_ANIMATION) {
      const keyParam = url.searchParams.get('key');
      const index = Number.parseInt(keyParam ?? '0', 10);
      if (!Number.isInteger(index)) {
        return NextResponse.json({ error: `?key must be an integer (got '${keyParam}')` }, { status: 400 });
      }
      const m = sketch.manifest;
      const emitted = await emitKeyGuide({
        motion: m.motion,
        keys: m.keys ?? 6,
        index,
        ...(m.canvas ? { canvas: m.canvas } : {}),
      });
      const wantSkeleton = url.searchParams.get('skeleton') === '1';
      const buf = wantSkeleton ? emitted.skeleton : emitted.guide;
      const inline = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `${inline}; filename="${safeFilename(`${sketch.title || ''} key-${index}${wantSkeleton ? ' skeleton' : ' guide'}`, sketch.ref || ref)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Scene-motion plate scaffold — the STAGE GUIDE (declared ground plane the
    // worker paints a background over), emitted deterministically from the
    // manifest's stage. ?plate=1; &target=plate-shot-<i> serves a cross-cut
    // shot's own stage guide (default: the base plate).
    if (sketch.manifest.kind === KIND_SCENE_MOTION) {
      const normalized = normalizeImageOutcomesManifest(sketch.manifest);
      const target = url.searchParams.get('target') || 'plate';
      const buf = await emitStageGuidePng(normalized, { target });
      const inline = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `${inline}; filename="${safeFilename(`${sketch.title || ''} ${target} stage guide`, sketch.ref || ref)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const rawScale = Number.parseFloat(url.searchParams.get('scale'));
    const scale = Number.isFinite(rawScale) ? Math.min(4, Math.max(1, rawScale)) : 2;
    // ?panel=<id> — sequential-art scaffolds only: rasterize one panel's crop
    // (the per-panel render payload for the image-render worker).
    const panelId = url.searchParams.get('panel') || undefined;
    // ?control=1 — image-outcomes scaffolds only: the ControlNet variant
    // (geometry only — no labels or dashed boxes for a structural
    // conditioner to trace into pseudo-text).
    const control = url.searchParams.get('control') === '1';

    const png = await rasterizeSketchToPng(sketch, {
      scale,
      ...(panelId ? { panelId } : {}),
      ...(control ? { control: true } : {}),
    });

    const disposition = url.searchParams.get('inline') === '1' ? 'inline' : 'attachment';
    const filename = safeFilename(
      panelId ? `${sketch.title || ''} ${panelId}` : sketch.title,
      sketch.ref || ref,
    );

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const status = err.code === 'SCENE_INELIGIBLE' ? 422 : 500;
    return NextResponse.json(
      { error: err.message || 'Failed to render sketch PNG' },
      { status },
    );
  }
}
