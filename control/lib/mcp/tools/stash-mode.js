/**
 * MCP Ring 9 — stash mode (Gather / Stash, the sharper-edged successor to
 * research_sessions).
 *
 * A Stash is a renameable user-facing bucket with optional Drawers. Gather is
 * the verb that mints typed items into it. Seven item types — text, markdown,
 * image, svg, script, pointer, link — each with a required-per-type contract
 * validated at intake. The contract is what lets the UI dispatch on type and
 * Cook (slice 2) treat items as ingredients.
 *
 * Coexists with the legacy research_* tools (start_research / bind_research_item
 * / get_research / list_research / synthesize_abstract / sketch_research) —
 * migration option 3 in app-system/0531/GATHER_STASH_COOK.md. Legacy data is
 * untouched; new gatherings land here.
 *
 * Tool surface (this file):
 *   - mint_stash      — create a renameable bucket
 *   - gather          — bind a typed item (the gate)
 *   - mint_drawer     — sub-grouping within a stash (idempotent on name)
 *   - rename_stash    — stashes are user-facing surfaces
 *   - list_stashes    — the inbox
 *   - get_stash       — full stash (drawers + items)
 *
 * Cook + Outcome Artifacts are slice 2 and ship in a sibling file.
 */

import { registerTool } from '@/lib/mcp/server';
import { StashRepository } from '@/lib/db/repositories/stashes';

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

export async function mintStashHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_stash requires an object with title');
  }
  const { title } = input;
  if (!title || typeof title !== 'string') {
    throw new Error('title is required (the bucket name; can be renamed later)');
  }
  const stash = StashRepository.mint({ title });
  return {
    ok: true,
    stash_ref: stash.stashRef,
    title: stash.title,
    status: stash.status,
  };
}

export async function gatherHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('gather requires an object with stash_ref + type');
  }
  const {
    stash_ref,
    drawer,
    type,
    title,
    source_url,
    body,
    body_md,
    body_svg,
    media_ref,
    metadata,
  } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required');
  }
  if (!type || typeof type !== 'string') {
    throw new Error('type is required (one of: text, markdown, image, svg, script, pointer, link)');
  }
  const item = StashRepository.gather({
    stashRef: stash_ref,
    drawer,
    type,
    title,
    sourceUrl: source_url,
    body,
    bodyMd: body_md,
    bodySvg: body_svg,
    mediaRef: media_ref,
    metadata,
  });
  return {
    ok: true,
    item_id: item.id,
    stash_ref,
    type: item.type,
    drawer: drawer ?? null,
  };
}

export async function mintDrawerHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_drawer requires an object with stash_ref + name');
  }
  const { stash_ref, name } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required');
  }
  if (!name || typeof name !== 'string') {
    throw new Error('name is required (the drawer label, unique within the stash)');
  }
  const drawer = StashRepository.mintDrawer({ stashRef: stash_ref, name });
  return {
    ok: true,
    stash_ref,
    drawer: drawer.name,
    created_at: drawer.createdAt,
  };
}

export async function renameStashHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('rename_stash requires an object with stash_ref + title');
  }
  const { stash_ref, title } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required');
  }
  if (!title || typeof title !== 'string') {
    throw new Error('title is required (the new name)');
  }
  const stash = StashRepository.rename(stash_ref, title);
  if (!stash) {
    throw new Error(`Stash '${stash_ref}' not found.`);
  }
  return {
    ok: true,
    stash_ref: stash.stashRef,
    title: stash.title,
  };
}

export async function listStashesHandler(input, _ctx) {
  const { status } = input || {};
  const stashes = StashRepository.list(status ? { status } : {});
  return {
    total: stashes.length,
    stashes: stashes.map((s) => ({
      stash_ref: s.stashRef,
      title: s.title,
      status: s.status,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    })),
  };
}

export async function getStashHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_stash requires an object with stash_ref');
  }
  const { stash_ref } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required');
  }
  const full = StashRepository.getFull(stash_ref);
  if (!full) {
    throw new Error(`Stash '${stash_ref}' not found.`);
  }
  return {
    stash_ref: full.stash.stashRef,
    title: full.stash.title,
    status: full.stash.status,
    created_at: full.stash.createdAt,
    updated_at: full.stash.updatedAt,
    drawers: full.drawers.map((d) => ({ name: d.name, created_at: d.createdAt })),
    items: full.items.map((it) => ({
      item_id: it.id,
      type: it.type,
      drawer: it.drawer,
      title: it.title,
      source_url: it.sourceUrl,
      body: it.body,
      body_md: it.bodyMd,
      media_ref: it.mediaRef,
      metadata: it.metadata,
      created_at: it.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerStashModeTools() {
  registerTool({
    name: 'mint_stash',
    description:
      "Ring 9 — mint a Stash, the renameable user-facing bucket Gathering binds into. Returns { stash_ref, title, status:'open' }. The successor to start_research with a typed item contract on intake; legacy research_sessions remain accessible via list_research / get_research (option-3 coexistence, see app-system/0531/GATHER_STASH_COOK.md). Use rename_stash to relabel; mint_drawer to sub-organize.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the stash (renameable later via rename_stash).' },
      },
      required: ['title'],
    },
    handler: mintStashHandler,
  });

  registerTool({
    name: 'gather',
    description:
      "Ring 9 — the GATHER verb: bind a typed item into a Stash. The intake gate validates a strict per-type contract — malformed items are REJECTED, not silently stored as junk.\n\nTypes and required fields:\n  - text       — body (string, ≤64KB)\n  - markdown   — body_md (string, ≤256KB)\n  - image      — media_ref + metadata.{mime (image/*), width, height, content_hash}\n  - svg        — body_svg (string, ≤128KB, starts with <?xml or <svg)\n  - script     — body (string, ≤128KB) + metadata.language ∈ js|ts|py|sh|sql\n  - pointer    — metadata.{node_ref, label}. node_ref MUST be a contextmap node-ref (from meta_context_brief). Sketches/plans/bots/sqlite-ids are NOT valid pointer targets — this is the metacontext-only rule.\n  - link       — source_url + title\n\nOptional `drawer` parameter routes the item into a named drawer within the stash (mint it first via mint_drawer); omit for the stash root. Returns { item_id, stash_ref, type, drawer }.",
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to gather into.' },
        type: {
          type: 'string',
          enum: ['text', 'markdown', 'image', 'svg', 'script', 'pointer', 'link'],
          description: 'The typed contract for this item.',
        },
        drawer: { type: 'string', description: 'Optional drawer name (must exist in this stash). Omit for stash root.' },
        title: { type: 'string', description: 'Optional short title/label.' },
        body: { type: 'string', description: 'Body string for text / script items.' },
        body_md: { type: 'string', description: 'Markdown body for markdown items.' },
        body_svg: { type: 'string', description: 'SVG/XML body for svg items.' },
        source_url: { type: 'string', description: 'URL (required for link items).' },
        media_ref: { type: 'string', description: 'Stored-media reference (required for image items).' },
        metadata: {
          type: 'object',
          description: 'Per-type required fields: image needs mime/width/height/content_hash; script needs language; pointer needs node_ref + label.',
        },
      },
      required: ['stash_ref', 'type'],
    },
    handler: gatherHandler,
  });

  registerTool({
    name: 'mint_drawer',
    description:
      'Ring 9 — mint (or surface, idempotent on name) a drawer inside a stash. Drawers are optional sub-grouping; an item gathered without a drawer lives at the stash root. Returns { stash_ref, drawer, created_at }.',
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to mint a drawer in.' },
        name: { type: 'string', description: 'Drawer name (unique within the stash; idempotent if it already exists).' },
      },
      required: ['stash_ref', 'name'],
    },
    handler: mintDrawerHandler,
  });

  registerTool({
    name: 'rename_stash',
    description:
      'Ring 9 — rename a stash. The stash_ref is stable; the title is the user-facing label and can change at any time. Returns { stash_ref, title }.',
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to rename.' },
        title: { type: 'string', description: 'New title.' },
      },
      required: ['stash_ref', 'title'],
    },
    handler: renameStashHandler,
  });

  registerTool({
    name: 'list_stashes',
    description:
      "Ring 9 — list stashes (optional `status` filter: open | archived), most-recently-active first. Returns { total, stashes: [{ stash_ref, title, status, created_at, updated_at }] }. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'archived'], description: 'Filter by status.' },
      },
    },
    handler: listStashesHandler,
  });

  registerTool({
    name: 'get_stash',
    description:
      'Ring 9 — fetch a stash in full: the stash row, its drawers, and every gathered item grouped by drawer. Items carry their typed contract fields (body / body_md / media_ref / metadata) — the UI dispatches on `type` to render. Returns the whole stash object.',
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to read.' },
      },
      required: ['stash_ref'],
    },
    handler: getStashHandler,
  });
}
