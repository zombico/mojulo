/**
 * GET /api/motion — list motion artifacts for the gallery.
 *
 * Motions are created via the `forge_motion` MCP tool. Unlike cooks (a DB
 * table), a motion lives as an outcome folder `mo_<…>/` (motion.svg + optional
 * motion.gif + recipe.json) bound into a "Motion Project" ops tag as a `motion`
 * member. This route is the read side: it scans the outcomes dir for motion
 * folders, reads each recipe for display metadata, and resolves the project tag
 * so the gallery can group shots by project. The `/outcomes/<motion_ref>/`
 * static route renders the player.
 *
 * Renders state; offers no authoring — the operator drives forge_motion from
 * their host agent per the dashboard golden rule.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { outcomesBaseDir, outcomeUrlFor } from '@/lib/outcomes-paths';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const base = outcomesBaseDir();
    let entries;
    try {
      entries = await fs.readdir(base, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return NextResponse.json({ motions: [], projects: [] });
      throw err;
    }

    const motions = [];
    for (const ent of entries) {
      if (!ent.isDirectory() || !ent.name.startsWith('mo_')) continue;
      const dir = path.join(base, ent.name);
      let recipe;
      try {
        recipe = JSON.parse(await fs.readFile(path.join(dir, 'recipe.json'), 'utf8'));
      } catch {
        continue; // not a well-formed motion folder
      }
      const files = await fs.readdir(dir).catch(() => []);
      const hasGif = files.includes('motion.gif');
      const hasSvg = files.includes('motion.svg');
      const hasMp4 = files.includes('motion.mp4');
      if (!hasSvg && !hasGif && !hasMp4) continue;
      let createdAt = recipe.meta?.createdAt;
      if (!createdAt) {
        const stat = await fs.stat(dir).catch(() => null);
        createdAt = stat ? Math.floor(stat.mtimeMs / 1000) : null;
      }
      const tags = OpsTagRepository.listTagsForMember({ memberKind: 'motion', memberRef: ent.name });
      const project = tags[0] ? { tagRef: tags[0].tagRef, title: tags[0].title } : null;
      const url = outcomeUrlFor(ent.name);
      motions.push({
        motionRef: ent.name,
        title: recipe.title || ent.name,
        kind: recipe.kind || 'single',
        motion: recipe.shot?.motion || recipe.meta?.motion || 'motion',
        frames: recipe.meta?.frames ?? null,
        fps: recipe.meta?.fps ?? null,
        durationSec: recipe.meta?.durationSec ?? null,
        framing: recipe.meta?.viewBoxStrategy ?? null,
        url,
        svgUrl: hasSvg ? `${url}motion.svg` : null,
        gifUrl: hasGif ? `${url}motion.gif` : null,
        mp4Url: hasMp4 ? `${url}motion.mp4` : null,
        project,
        createdAt,
      });
    }

    motions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const filtered = q
      ? motions.filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            m.motionRef.toLowerCase().includes(q) ||
            m.motion.toLowerCase().includes(q) ||
            (m.project?.title || '').toLowerCase().includes(q),
        )
      : motions;

    // group into projects (by tag) for the gallery; untagged shots fall under null
    const byTag = new Map();
    for (const m of filtered) {
      const key = m.project?.tagRef || '__untagged__';
      if (!byTag.has(key)) {
        byTag.set(key, { tagRef: m.project?.tagRef || null, title: m.project?.title || null, motions: [] });
      }
      byTag.get(key).motions.push(m);
    }

    return NextResponse.json({ motions: filtered, projects: Array.from(byTag.values()) });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to list motions' }, { status: 500 });
  }
}
