/**
 * GET /api/arcade — the Mojulo Arcade menu feed (game-developer.plan.md).
 *
 * One cabinet per playable standalone game: every sketch in the `game` bucket,
 * decorated with the manifest facts the menu shows (level count, tagline,
 * theme accents, music presence) and — when a game project claims the game as
 * its `rules` member — the project chip (title / status / gp_ ref, newest
 * claim wins). Each cabinet says where it came from (`source`): a gameworld's
 * run (`world`, with the world's ref), a quick game (`quick`, the same), a
 * pixelizer reducer (`pixel`), a game project's rules (`project`), or
 * create_game alone (`game`), and what it was shipped as (`shipped`: the
 * self-contained page export_game wrote, and its Godot pack, when on disk).
 * Pure projection: Play renders state and launches the game shell; authoring
 * stays with the host agent.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';

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

// game ref → the gameworld whose run made it: { world, quick }
function worldGames() {
  const byGame = new Map();
  for (const row of SketchRepository.listByKinds({ kinds: ['gameworld'], limit: 2000 })) {
    const game = row.manifest?.made?.game?.ref;
    if (typeof game === 'string') byGame.set(game, { world: row.ref, quick: !!row.manifest.quick });
  }
  return byGame;
}

// what export_game left on disk for a game: its self-contained page, its Godot project
function shippedOf(ref) {
  const dir = outcomeDirFor(ref), url = outcomeUrlFor(ref);
  return {
    html: existsSync(path.join(dir, 'game.html')) ? `${url}game.html` : null,
    godot: existsSync(path.join(dir, 'godot')) ? `${url}godot` : null,
  };
}

const sourceOf = (manifest, made, claim) => (made ? (made.quick ? 'quick' : 'world') : manifest.engine === 'pixelizer' ? 'pixel' : claim ? 'project' : 'game');

export async function GET() {
  try {
    const games = SketchRepository.list({ bucket: 'game' });
    const claims = projectClaims();
    const worlds = worldGames();
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
        source: sourceOf(manifest, worlds.get(sketch.ref), claims.get(sketch.ref)),
        world: worlds.get(sketch.ref)?.world ?? null,
        shipped: shippedOf(sketch.ref),
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
