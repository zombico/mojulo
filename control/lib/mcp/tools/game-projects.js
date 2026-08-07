/**
 * Game-project tools (GP1, game-developer.plan.md) — the project layer over
 * the game composer substrate, and the ONLY write path to it.
 *
 * A game project is a GROUPING object (its own tables, never a sketches row)
 * that corrals the artifacts of ONE game — rules / levels / characters /
 * audio / graphics / animation / references — so they read as a single
 * project instead of six gallery rails. Same principles as the connected-MCP
 * composer: intent up front (the charter, embedded for semantic recall), a
 * small status machine (active → shipped → archived), membership by typed ref
 * with a role. It never gates a mint and never becomes an editor — shelf and
 * map only. The /games/<ref> studio renders what these tools write; the
 * /arcade floor decorates its cabinets from the `rules` claims.
 *
 * Doctrine: store only what isn't derivable. A bound game manifest already
 * names its levels and music — get_game_project surfaces those as IMPLIED
 * members derived at read time; only the facts the manifest can't know
 * (candidate levels, characters, key art, references) are member rows.
 */

import { registerTool } from '@/lib/mcp/server';
import {
  GameProjectRepository,
  GameProjectMemberRepository,
  GAME_PROJECT_STATUSES,
  MEMBER_KINDS,
  MEMBER_ROLES,
} from '@/lib/db/repositories/game-projects';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const studioUrl = (ref) => `/games/${encodeURIComponent(ref)}`;
const playUrl = (ref) => `/api/sketches/${encodeURIComponent(ref)}/game`;

// Soundtrack-vs-SFX is a manifest fact, derived here — never stored in the role.
function audioKindOf(manifest) {
  const kind = manifest?.kind || '';
  if (kind === 'beats-sfx') return 'sfx';
  if (kind.startsWith('beats-')) return 'soundtrack';
  if (kind.startsWith('voice')) return 'voice';
  return null;
}

// Navigational resolution of one member row: dangling tolerated by design —
// a deleted artifact reads missing:true, it never errors the project read.
function resolveMember(member, rulesLevelRefs) {
  const out = { ...member };
  if (member.memberKind !== 'sketch') return out; // motion/cook/stash pass through in v1
  const sketch = SketchRepository.getByRef(member.memberRef);
  if (!sketch) {
    out.missing = true;
    return out;
  }
  out.title = sketch.title || member.memberRef;
  out.kind = sketch.manifest?.kind ?? null;
  if (member.role === 'level') {
    // Promotion status, derived: in the bound game's manifest > carries a
    // game: contract channel > plain candidate world.
    out.levelStatus = rulesLevelRefs.has(member.memberRef)
      ? 'promoted'
      : sketch.manifest?.game
        ? 'contract'
        : 'candidate';
  }
  if (member.role === 'audio') out.audioKind = audioKindOf(sketch.manifest);
  if (member.role === 'rules') out.playUrl = playUrl(member.memberRef);
  return out;
}

function bindMembers(projectRef, members) {
  return members.map((m) =>
    GameProjectMemberRepository.bind({
      projectRef,
      memberRef: m.ref ?? m.member_ref,
      role: m.role,
      memberKind: m.kind ?? m.member_kind ?? 'sketch',
      label: m.label,
      meta: m.meta,
    }),
  );
}

export async function createGameProjectHandler(input) {
  const { title, charter, members } = input && typeof input === 'object' ? input : {};
  if (members !== undefined && !Array.isArray(members)) {
    throw new Error('members must be an array of { ref, role, kind?, label?, meta? }');
  }
  const project = await GameProjectRepository.createWithEmbedding({ title, charter });
  const bound = members?.length ? bindMembers(project.ref, members) : [];
  return {
    ok: true,
    ref: project.ref,
    url: studioUrl(project.ref),
    project,
    members: bound,
  };
}

export async function getGameProjectHandler(input) {
  const { ref } = input && typeof input === 'object' ? input : {};
  if (!ref || typeof ref !== 'string') throw new Error('ref is required (a gp_ project ref)');
  const project = GameProjectRepository.getByRef(ref);
  if (!project) throw new Error(`Game project '${ref}' not found — list_game_projects shows what exists`);

  const members = GameProjectMemberRepository.listByProject(ref);

  // The active rules member (newest-bound) anchors the derived layer: its
  // manifest's levels/music are IMPLIED members, surfaced but never stored.
  const rules = GameProjectMemberRepository.rulesMember(ref);
  const rulesSketch = rules && rules.memberKind === 'sketch' ? SketchRepository.getByRef(rules.memberRef) : null;
  const rulesManifest = rulesSketch?.manifest ?? null;
  const rulesLevelRefs = new Set((rulesManifest?.levels || []).map((l) => l.ref));

  const resolved = members.map((m) => resolveMember(m, rulesLevelRefs));
  const byRole = {};
  for (const role of MEMBER_ROLES) byRole[role] = [];
  for (const m of resolved) (byRole[m.role] ??= []).push(m);

  const storedRefs = new Set(members.map((m) => m.memberRef));
  const implied = rulesManifest
    ? {
        levels: (rulesManifest.levels || []).map((l) => ({
          ref: l.ref,
          title: l.title ?? l.ref,
          gated: Boolean(l.gate),
          alsoStored: storedRefs.has(l.ref),
        })),
        music: [
          ...(rulesManifest.music?.menu ? [{ ref: rulesManifest.music.menu, slot: 'menu' }] : []),
          ...((rulesManifest.music?.battle || []).map((r) => ({ ref: r, slot: 'battle' }))),
        ].map((m) => ({ ...m, alsoStored: storedRefs.has(m.ref) })),
      }
    : { levels: [], music: [] };

  return {
    ok: true,
    project,
    url: studioUrl(ref),
    members: byRole,
    activeRules: rules
      ? {
          ref: rules.memberRef,
          missing: !rulesSketch,
          title: rulesSketch?.title ?? rules.memberRef,
          playUrl: playUrl(rules.memberRef),
          store: rulesManifest?.store ?? null,
          theme: rulesManifest?.theme ?? null,
          tagline: rulesManifest?.menu?.tagline ?? null,
        }
      : null,
    implied,
  };
}

export async function updateGameProjectHandler(input) {
  const { ref, title, charter, status } = input && typeof input === 'object' ? input : {};
  if (!ref || typeof ref !== 'string') throw new Error('ref is required (a gp_ project ref)');
  const project = await GameProjectRepository.updateWithEmbedding({ ref, title, charter, status });
  return { ok: true, project, url: studioUrl(ref) };
}

export async function bindToGameProjectHandler(input) {
  const { ref, action = 'add', members } = input && typeof input === 'object' ? input : {};
  if (!ref || typeof ref !== 'string') throw new Error('ref is required (a gp_ project ref)');
  if (!Array.isArray(members) || !members.length) {
    throw new Error('members is required: [{ ref, role, kind?, label?, meta? }]');
  }
  if (action === 'add') {
    return { ok: true, action, members: bindMembers(ref, members) };
  }
  if (action === 'remove') {
    const removed = members.map((m) => ({
      ref: m.ref ?? m.member_ref,
      role: m.role,
      removed: GameProjectMemberRepository.unbind({
        projectRef: ref,
        memberRef: m.ref ?? m.member_ref,
        role: m.role,
        memberKind: m.kind ?? m.member_kind ?? 'sketch',
      }),
    }));
    return { ok: true, action, members: removed };
  }
  throw new Error("action must be 'add' or 'remove'");
}

export async function listGameProjectsHandler(input) {
  const { status } = input && typeof input === 'object' ? input : {};
  const projects = GameProjectRepository.list({ status }).map((p) => {
    const rules = GameProjectMemberRepository.rulesMember(p.ref);
    return {
      ...p,
      url: studioUrl(p.ref),
      playable: Boolean(rules && SketchRepository.getByRef(rules.memberRef)),
    };
  });
  return { ok: true, projects };
}

export function registerGameProjectTools() {
  registerTool({
    name: 'create_game_project',
    description:
      'Start a GAME PROJECT — the single home that ties one game\'s artifacts together (rules / levels / '
      + 'characters / audio / graphics / animation / references) so the operator sees the whole game at '
      + '/games/<ref> instead of jumping across six gallery rails. A grouping object, not a mint: it never '
      + 'gates create_game and holds no play state. `charter` is the pitch (premise, register, scope) — '
      + 'embedded for semantic recall. Optionally seed `members` at birth. Reach for "start a game project", '
      + '"let\'s make a game" (before any level exists), "keep these game pieces together".',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: "The project's working name." },
        charter: { type: 'string', description: 'The pitch, markdown: premise, register (3D worlds / pixel), scope, tone.' },
        members: {
          type: 'array',
          description: `Optional initial members: [{ ref, role, kind?, label?, meta? }]. role ∈ ${MEMBER_ROLES.join(' | ')}; kind ∈ ${MEMBER_KINDS.join(' | ')} (default sketch).`,
          items: { type: 'object' },
        },
      },
      required: ['title'],
    },
    handler: createGameProjectHandler,
  });

  registerTool({
    name: 'get_game_project',
    description:
      'Read one game project in full: the charter, members grouped by role (each resolved navigationally — '
      + 'a deleted artifact reads missing, never errors), the ACTIVE rules member (newest-bound game) with '
      + 'its store/theme/play URL, per-level promotion status (promoted = in the bound game\'s manifest / '
      + 'contract = carries a game: channel / candidate = plain world), audio members split soundtrack-vs-SFX '
      + 'by their own beats kind, and the IMPLIED members derived from the rules manifest (its levels + music '
      + '— shown, never stored). The read anchor before any bind_to_game_project or a project-aware '
      + 'create_game. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { ref: { type: 'string', description: 'Project ref (gp_…).' } },
      required: ['ref'],
    },
    handler: getGameProjectHandler,
  });

  registerTool({
    name: 'update_game_project',
    description:
      'Update a game project\'s own fields: rename, revise the charter (re-embedded for recall), or move the '
      + `status machine (${GAME_PROJECT_STATUSES.join(' → ')}). \`shipped\` is the arcade's finished-cabinet `
      + 'signal; `archived` hides the project from the default list without touching any member artifact. '
      + 'Members move via bind_to_game_project, not here.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Project ref (gp_…).' },
        title: { type: 'string', description: 'New working name.' },
        charter: { type: 'string', description: 'Replacement charter markdown.' },
        status: { type: 'string', enum: GAME_PROJECT_STATUSES, description: 'New status.' },
      },
      required: ['ref'],
    },
    handler: updateGameProjectHandler,
  });

  registerTool({
    name: 'bind_to_game_project',
    description:
      'Add or remove project members — typed refs with a game-facing role: rules (the deliverable game; '
      + 'newest bind is the ACTIVE one, prior ones stay as history), level (candidate AND promoted worlds), '
      + 'character (figures / sheets / units), audio (beats + voice — one role; soundtrack-vs-SFX derives '
      + 'from the artifact), graphic (key art, skins), animation (motion, cutscenes), reference (dreams, '
      + 'style bibles). Adds are idempotent per (ref, role) — a re-bind updates label/meta. Do NOT bind what '
      + 'the game manifest already names (its levels/music surface as implied members automatically). '
      + '`label` names the slot ("hero", "boss theme"); `meta` is small role-specific data (e.g. { slice: "party" }).',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Project ref (gp_…).' },
        action: { type: 'string', enum: ['add', 'remove'], description: "Default 'add'." },
        members: {
          type: 'array',
          description: `[{ ref, role, kind?, label?, meta? }]. role ∈ ${MEMBER_ROLES.join(' | ')}; kind ∈ ${MEMBER_KINDS.join(' | ')} (default sketch).`,
          items: { type: 'object' },
        },
      },
      required: ['ref', 'members'],
    },
    handler: bindToGameProjectHandler,
  });

  registerTool({
    name: 'list_game_projects',
    description:
      'Index of game projects: ref, title, status, per-role member counts, `playable` (has a live rules '
      + 'member), newest-activity first. Optional `status` filter (active | shipped | archived). The '
      + '/maker/games gallery renders this same shape. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: GAME_PROJECT_STATUSES, description: 'Optional status filter.' },
      },
      required: [],
    },
    handler: listGameProjectsHandler,
  });
}
