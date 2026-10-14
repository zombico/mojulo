/**
 * GET /api/elements/[family]/[id]/world[?view=] — an element's specimen as a live World: a geocube's room or land, a
 * kit's bare stage, a grammar's small city (massing, or its look). The specimen is a recipe built here and never stored
 * (elementManifest); it is drawn through the same seam a stored sketch's World is, and kept in memory once drawn.
 */

import { NextResponse } from 'next/server';

import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';
import { elementManifest } from '@/lib/graph/elements/registry';
import { cachedPage } from '@/lib/sheet-cache';

export async function GET(request, { params }) {
  try {
    const { family, id } = await params;
    const view = request.nextUrl.searchParams.get('view') || undefined;
    let manifest;
    try { manifest = elementManifest(family, id, view); } catch (err) { return NextResponse.json({ error: err.message }, { status: 404 }); }
    const html = await cachedPage(`element:${family}:${id}:${view ?? ''}`, async () => {
      const { payload, kind } = await resolveWorldScene({ ref: `element-${family}-${id}`, title: id, manifest }, { live: true });
      if (!payload) throw new Error(`elements: ${family} '${id}' has no World`);
      return emitThreeWorld({ ...payload, walk: !!(payload.walk || WALK_KINDS.has(kind)), hud: true, decollide: true });
    });
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
