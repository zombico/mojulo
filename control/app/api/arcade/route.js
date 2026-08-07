/**
 * GET /api/arcade — the Mojulo Arcade menu feed (game-developer.plan.md).
 *
 * One cabinet per playable standalone game: every sketch in the `game` bucket,
 * decorated with the manifest facts the menu shows (level count, tagline,
 * theme accents, music presence) and — when a game project claims the game as
 * its `rules` member — the project chip (title / status / gp_ ref, newest
 * claim wins). Pure projection: the arcade renders state and launches the
 * game shell; authoring stays with the host agent (create_game).
 */

import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';

// member_ref → { projectRef, title, status } for every game claimed as a
// project's rules member. Ordered ASC so the NEWEST edge overwrites in the map
// (the active rules member is the newest-bound one, mirroring rulesMember()).
function projectClaims() {
  const rows = getDb()
    .prepare(
      `SELECT m.member_ref, p.ref AS project_ref, p.title, p.status
         FROM game_project_members m JOIN game_projects p ON p.id = m.project_id
        WHERE m.member_kind = 'sketch' AND m.role = 'rules'
        ORDER BY m.id ASC`,
    )
    .all();
  const byRef = new Map();
  for (const row of rows) {
    byRef.set(row.member_ref, {
      projectRef: row.project_ref,
      title: row.title,
      status: row.status,
    });
  }
  return byRef;
}

export async function GET() {
  try {
    const games = SketchRepository.list({ bucket: 'game' });
    const claims = projectClaims();
    const cabinets = games.map((sketch) => {
      const manifest = sketch.manifest || {};
      return {
        ref: sketch.ref,
        title: sketch.title || manifest.title || sketch.ref,
        tagline: manifest.menu?.tagline ?? null,
        levelCount: Array.isArray(manifest.levels) ? manifest.levels.length : 0,
        theme: manifest.theme ?? null,
        hasMusic: Boolean(manifest.music),
        project: claims.get(sketch.ref) ?? null,
        playUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/game`,
        createdAt: sketch.createdAt ?? null,
      };
    });
    return NextResponse.json({ cabinets });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to list the arcade' },
      { status: 500 },
    );
  }
}
