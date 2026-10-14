/**
 * GET /api/sheets/[id][?kit=<kit>][&seed=n][&finish=<finish>] — a repertoire sheet (the index of forms, the land, the
 * flora, the blocks, the structures, a fortified town, a castle, technology), drawn in a kit and a seed from mojulo's own
 * tables and kept in memory; never stored. A kit the sheet does not draw in answers 422 and names the ones it does.
 * `?download=1` flips the Content-Disposition.
 */

import { NextResponse } from 'next/server';

import { repertoireSheet, drawsIn, drawRepertoire } from '@/lib/graph/sheets/registry';
import { cachedPage } from '@/lib/sheet-cache';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sheet = repertoireSheet(id);
    if (!sheet) return NextResponse.json({ error: `'${id}' is not a sheet` }, { status: 404 });
    const q = request.nextUrl.searchParams;
    const kit = sheet.kits ? q.get('kit') || sheet.kits[0] : null;
    if (kit && !drawsIn(sheet, kit)) return NextResponse.json({ eligible: false, reason: `${id} is drawn in ${sheet.kits.join(', ')}` }, { status: 422 });
    const seed = Number.isInteger(Number(q.get('seed'))) && q.get('seed') ? Number(q.get('seed')) : 8;
    const finish = q.get('finish') || undefined;
    const html = await cachedPage(`repertoire:${id}:${kit}:${seed}:${finish ?? ''}`, () => drawRepertoire(id, { kit: kit ?? undefined, seed, finish }));
    const download = ['1', 'true'].includes(q.get('download'));
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': download ? `attachment; filename="${id}${kit ? `-${kit}` : ''}-${seed}.html"` : 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
