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
 * Coexists with the research book's tools (start_research / bind_research_item
 * / get_research / list_research / synthesize_abstract / sketch_research), retired
 * from the list and callable by name (packs.js RETIRED_PACKS) —
 * migration option 3 in app-system/0531/GATHER_STASH_COOK.md. Legacy data is
 * untouched; new gatherings land here.
 *
 * Tool surface (this file):
 *   - mint_stash      — create a renameable bucket
 *   - gather          — bind a typed item (the gate)
 *   - mint_drawer     — sub-grouping within a stash (idempotent on name)
 *   - rename_stash    — stashes are user-facing surfaces
 *   - get_stash       — full stash (drawers + items); with no stash_ref, the list of stashes
 *     (what list_stashes answered, its folded name)
 *   - update_item     — mutate an item in place (gate re-runs on merged state)
 *   - archive_item    — soft-delete an item; downstream citations still resolve
 *   - bind_stash      — link a stash to a bot/app/plan/cook/contextmap_node
 *   - unbind_stash    — remove that link (binding row only; stash + target survive)
 *   - list_stash_bindings — query the adjacency layer in either direction
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
  let item;
  try {
    item = StashRepository.gather({
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
  } catch (err) {
    // Intake rejection — carry the remediation with the refusal (R3a,
    // orientation-ramp.plan.md) so the gate never reads as a dead end.
    if (err instanceof Error && /require|must|exceeds|invalid/i.test(err.message)) {
      err.message += ' next: fix the named field and re-gather — nothing was stored.';
    }
    throw err;
  }
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
  // no stash_ref: the list of stashes (what list_stashes answered, folded onto this door)
  if (input === undefined || input === null || (typeof input === 'object' && input.stash_ref === undefined)) return listStashesHandler(input, _ctx);
  if (typeof input !== 'object') {
    throw new Error('get_stash requires an object with stash_ref');
  }
  const { stash_ref } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is a stash ref; omit it for the list of stashes');
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

export async function updateItemHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('update_item requires an object with item_id');
  }
  const { item_id, title, source_url, body, body_md, body_svg, media_ref, metadata } = input;
  if (!Number.isInteger(item_id)) {
    throw new Error('item_id is required (integer)');
  }
  const item = StashRepository.updateItem({
    itemId: item_id,
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
    type: item.type,
    title: item.title,
    source_url: item.sourceUrl,
    body: item.body,
    body_md: item.bodyMd,
    media_ref: item.mediaRef,
    metadata: item.metadata,
  };
}

export async function archiveItemHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('archive_item requires an object with item_id');
  }
  const { item_id, confirm } = input;
  if (!Number.isInteger(item_id)) {
    throw new Error('item_id is required (integer)');
  }
  const existing = StashRepository.getItemById(item_id);
  if (!existing) {
    throw new Error(`Stash item '${item_id}' not found`);
  }
  const refs = StashRepository.scanItemReferences(item_id);
  const refCount = refs.cooks.length;
  // Two-step gate: if references exist and confirm !== true, return a dry-run
  // shape so the agent can show the warning and re-call with confirm: true.
  // Mirrors execute_plan's per-execution gate. No references → archive
  // straight through (nothing to warn about).
  if (refCount > 0 && confirm !== true) {
    return {
      ok: true,
      archived: false,
      pending_confirm: true,
      item_id,
      references: {
        cook_count: refs.cooks.length,
        cook_refs: refs.cooks,
      },
      warning: `This item appears in ${refs.cooks.length} cook(s). Archive anyway? Re-call with confirm: true — downstream citations will still resolve to the archived content.`,
    };
  }
  const result = StashRepository.archiveItem({ itemId: item_id });
  return {
    ok: true,
    archived: result.archived,
    already_archived: result.alreadyArchived,
    item_id,
    references: {
      cook_count: refs.cooks.length,
      cook_refs: refs.cooks,
    },
  };
}

export async function bindStashHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('bind_stash requires an object with stash_ref + bound_kind + bound_ref');
  }
  const { stash_ref, bound_kind, bound_ref, role } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required');
  }
  if (!bound_kind || typeof bound_kind !== 'string') {
    throw new Error('bound_kind is required (one of: app, plan, cook, contextmap_node)');
  }
  if (!bound_ref || typeof bound_ref !== 'string') {
    throw new Error('bound_ref is required (the target resource ref)');
  }
  const binding = StashRepository.bind({
    stashRef: stash_ref,
    boundKind: bound_kind,
    boundRef: bound_ref,
    role,
  });
  return {
    ok: true,
    stash_ref: binding.stashRef,
    bound_kind: binding.boundKind,
    bound_ref: binding.boundRef,
    role: binding.role,
    created_at: binding.createdAt,
  };
}

export async function unbindStashHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('unbind_stash requires an object with stash_ref + bound_kind + bound_ref');
  }
  const { stash_ref, bound_kind, bound_ref } = input;
  if (!stash_ref || typeof stash_ref !== 'string') {
    throw new Error('stash_ref is required');
  }
  if (!bound_kind || typeof bound_kind !== 'string') {
    throw new Error('bound_kind is required');
  }
  if (!bound_ref || typeof bound_ref !== 'string') {
    throw new Error('bound_ref is required');
  }
  const removed = StashRepository.unbind({
    stashRef: stash_ref,
    boundKind: bound_kind,
    boundRef: bound_ref,
  });
  return { ok: true, removed };
}

export async function listStashBindingsHandler(input, _ctx) {
  const { stash_ref, bound_kind, bound_ref } = input || {};
  const bindings = StashRepository.listBindings({
    stashRef: stash_ref,
    boundKind: bound_kind,
    boundRef: bound_ref,
  });
  return {
    total: bindings.length,
    bindings: bindings.map((b) => ({
      stash_ref: b.stashRef,
      bound_kind: b.boundKind,
      bound_ref: b.boundRef,
      role: b.role,
      created_at: b.createdAt,
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
      "Mint a stash: the renameable bucket you `gather` typed items into, and the corpus a `cook` reads. Returns { stash_ref, title, status: 'open' }. Relabel with rename_stash; sub-organize with mint_drawer.",
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
    handler: mintStashHandler,
  });

  registerTool({
    name: 'gather',
    description:
      "Ring 9 — the GATHER verb: bind a typed item into a Stash. The intake gate validates a strict per-type contract — malformed items are REJECTED, not silently stored as junk.\n\nTypes and required fields:\n  - text       — body (string, ≤64KB)\n  - markdown   — body_md (string, ≤256KB)\n  - image      — media_ref + metadata.{mime (image/*), width, height, content_hash}. Optional body_md is the caption (photojournal renders it under the photo).\n  - svg        — body_svg (string, ≤128KB, starts with <?xml or <svg)\n  - script     — body (string, ≤128KB) + metadata.language ∈ js|ts|py|sh|sql\n  - pointer    — metadata.{node_ref, label}. node_ref MUST be a contextmap node-ref (a retired surface's). Sketches/plans/sqlite-ids are NOT valid pointer targets — this is the metacontext-only rule.\n  - link       — source_url + title\n  - sketch     — metadata.{sketch_ref, label}. sketch_ref is a sk_… ref minted by create_sketch; renderer resolves it live so edits to the source sketch propagate.\n\nOptional `drawer` parameter routes the item into a named drawer within the stash (mint it first via mint_drawer); omit for the stash root. Returns { item_id, stash_ref, type, drawer }.",
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to gather into.' },
        type: {
          type: 'string',
          enum: ['text', 'markdown', 'image', 'svg', 'script', 'pointer', 'link', 'sketch'],
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
          description: 'Per-type required fields: image needs mime/width/height/content_hash; script needs language; pointer needs node_ref + label; sketch needs sketch_ref + label.',
        },
      },
      required: ['stash_ref', 'type'],
    },
    handler: gatherHandler,
  });

  registerTool({
    name: 'mint_drawer',
    description:
      'A drawer inside a stash (idempotent on its name): optional sub-grouping, such as a chapter. An item gathered without one lives at the stash root. Returns { stash_ref, drawer, created_at }.',
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string' },
        name: { type: 'string', description: 'Unique within the stash.' },
      },
      required: ['stash_ref', 'name'],
    },
    handler: mintDrawerHandler,
  });

  registerTool({
    name: 'rename_stash',
    description:
      'Rename a stash: its ref stays, its title (the label the user sees) changes. Returns { stash_ref, title }.',
    inputSchema: {
      type: 'object',
      properties: { stash_ref: { type: 'string' }, title: { type: 'string' } },
      required: ['stash_ref', 'title'],
    },
    handler: renameStashHandler,
  });

  registerTool({
    name: 'list_stashes',
    description:
      'Folded into get_stash with no `stash_ref` (the stashes, most recently active first; `status` filters). Callable by name.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'archived'] } },
    },
    handler: listStashesHandler,
  });

  registerTool({
    name: 'get_stash',
    description:
      'A stash in full: its row, its drawers and every gathered item by drawer, each with its typed fields (body / body_md / media_ref / metadata). Omit `stash_ref` for the list of stashes, most recently active first, optionally by `status`.',
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'Omit to list the stashes.' },
        status: { type: 'string', enum: ['open', 'archived'], description: 'List filter.' },
      },
    },
    handler: getStashHandler,
  });

  registerTool({
    name: 'update_item',
    description:
      "Change a stash item in place; pass only the fields to change. An item is cited by its id, so the edit shows wherever it is cited (a cook's slices). The intake check re-runs on the merged item, so a partial update cannot break its type's contract. The type itself cannot change: archive and gather again. Returns the updated item.",
    inputSchema: {
      type: 'object',
      properties: {
        item_id: { type: 'integer' },
        title: { type: 'string' },
        source_url: { type: 'string' },
        body: { type: 'string', description: 'Text / script items.' },
        body_md: { type: 'string', description: 'Markdown items.' },
        body_svg: { type: 'string', description: 'Svg items.' },
        media_ref: { type: 'string', description: 'Image items.' },
        metadata: { type: 'object', description: "Replaces the metadata; the type's required fields must still be there." },
      },
      required: ['item_id'],
    },
    handler: updateItemHandler,
  });

  registerTool({
    name: 'archive_item',
    description:
      "Soft-delete a stash item: it leaves the list and detail views, and a cook that cites it still resolves. If a cook cites it, the first call archives nothing and returns { pending_confirm: true, references } so you can warn the operator; call again with `confirm: true`. An item already archived returns { archived: false, already_archived: true }.",
    inputSchema: {
      type: 'object',
      properties: {
        item_id: { type: 'integer' },
        confirm: { type: 'boolean', description: 'true: archive an item a cook cites.' },
      },
      required: ['item_id'],
    },
    handler: archiveItemHandler,
  });

  registerTool({
    name: 'bind_stash',
    description:
      "Ring 9 — link a stash to another substrate resource. The adjacency layer that turns a generic bucket into 'this app's corpus' / 'this plan's working memory' / 'this cook's declared ingredients'. Many-to-many: a stash can bind to many resources, a resource can have many stashes. Idempotent on (stash_ref, bound_kind, bound_ref); re-binding updates the role. v0 is purely navigational — agents do NOT auto-read linked stashes mid-conversation. bound_ref is NOT validated against the target repo (dangling refs are tolerated; the UI shows 'linked resource removed').\n\nbound_kind: app | plan | cook | contextmap_node\nrole (optional): corpus | working_memory | ingredient | reference",
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash to link.' },
        bound_kind: {
          type: 'string',
          enum: ['app', 'plan', 'cook', 'contextmap_node'],
          description: 'The target resource kind.',
        },
        bound_ref: { type: 'string', description: 'The target resource ref (app_…, plan_…, cook_…, or a contextmap node ref).' },
        role: {
          type: 'string',
          enum: ['corpus', 'working_memory', 'ingredient', 'reference'],
          description: 'Optional semantic role this stash plays for the bound resource.',
        },
      },
      required: ['stash_ref', 'bound_kind', 'bound_ref'],
    },
    handler: bindStashHandler,
  });

  registerTool({
    name: 'unbind_stash',
    description:
      'Ring 9 — remove a single (stash, kind, ref) binding row. The stash and the target resource both survive; only the navigational edge between them is dropped. Returns { removed: true|false }.',
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'The stash side of the binding.' },
        bound_kind: {
          type: 'string',
          // 'bot' stays so a binding a 2.x install made to a deployed bot can be removed.
          enum: ['bot', 'app', 'plan', 'cook', 'contextmap_node'],
          description: "The resource kind the binding targets ('bot' only for a binding made before 3.0).",
        },
        bound_ref: { type: 'string', description: 'The resource ref the binding targets.' },
      },
      required: ['stash_ref', 'bound_kind', 'bound_ref'],
    },
    handler: unbindStashHandler,
  });

  registerTool({
    name: 'list_stash_bindings',
    description:
      "Ring 9 — query the stash adjacency layer. Filters in either direction: pass `stash_ref` for 'what is this stash linked to'; pass `bound_kind` + `bound_ref` for 'what stashes link to this resource'; pass `bound_kind` alone for 'every binding of this kind'. No filter returns every binding (operator audit view). Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'Filter to bindings on this stash.' },
        bound_kind: {
          type: 'string',
          // 'bot' stays readable: bindings a 2.x install made to a deployed bot.
          enum: ['bot', 'app', 'plan', 'cook', 'contextmap_node'],
          description: "Filter to bindings targeting this kind ('bot' only for bindings made before 3.0).",
        },
        bound_ref: { type: 'string', description: 'Filter to bindings targeting this resource ref (reverse lookup).' },
      },
    },
    handler: listStashBindingsHandler,
  });
}
