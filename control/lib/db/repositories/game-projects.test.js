// Isolate this test file to in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';
// Short-circuit the semantic-index sidecar — GP0 tests cover the grouping
// object, not embedding indexing (createWithEmbedding must degrade to a
// plain create when disabled).
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import {
  GameProjectRepository,
  GameProjectMemberRepository,
  GAME_PROJECT_STATUSES,
  MEMBER_KINDS,
  MEMBER_ROLES,
} from '@/lib/db/repositories/game-projects';

beforeEach(() => {
  closeDb();
  getDb();
});

function mintProject(overrides = {}) {
  return GameProjectRepository.create({
    title: 'Mono-Eye Uprising',
    charter: 'A mobile-suit arena brawler in the z-series register.',
    ...overrides,
  });
}

describe('GameProjectRepository', () => {
  it('creates a project with a gp_ ref and sane defaults', () => {
    const p = mintProject();
    expect(p.ref).toMatch(/^gp_[0-9a-f]{12}$/);
    expect(p.title).toBe('Mono-Eye Uprising');
    expect(p.charter).toContain('z-series');
    expect(p.status).toBe('active');
    expect(GameProjectRepository.getByRef(p.ref)).toEqual(p);
  });

  it('charter is optional; title is not; status is gated', () => {
    const bare = GameProjectRepository.create({ title: 'Untitled Racer' });
    expect(bare.charter).toBeNull();
    expect(() => GameProjectRepository.create({})).toThrow(/title is required/);
    expect(() => GameProjectRepository.create({ title: 'X', status: 'in_progress' })).toThrow(
      /status 'in_progress' is not valid/,
    );
    expect(GAME_PROJECT_STATUSES).toContain('shipped');
  });

  it('createWithEmbedding degrades to a plain create when the index is disabled', async () => {
    const p = await GameProjectRepository.createWithEmbedding({
      title: 'Quiet Call: The Game',
      charter: 'A pixelizer visual toy.',
    });
    expect(p.ref).toMatch(/^gp_/);
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM meta_embeddings WHERE source_kind = 'game_project'")
      .all();
    expect(rows).toHaveLength(0);
  });

  it('updates title / charter / status and refuses junk', () => {
    const p = mintProject();
    const updated = GameProjectRepository.update({
      ref: p.ref,
      title: 'Mono-Eye Uprising II',
      charter: null,
      status: 'shipped',
    });
    expect(updated.title).toBe('Mono-Eye Uprising II');
    expect(updated.charter).toBeNull();
    expect(updated.status).toBe('shipped');
    expect(() => GameProjectRepository.update({ ref: p.ref, status: 'done' })).toThrow(/not valid/);
    expect(() => GameProjectRepository.update({ ref: 'gp_missing000000' })).toThrow(/not found/);
  });

  it('lists newest-updated first with per-role member counts', () => {
    const a = mintProject({ title: 'Project A' });
    const b = mintProject({ title: 'Project B' });
    GameProjectMemberRepository.bind({ projectRef: a.ref, memberRef: 'sk_lvl1', role: 'level' });
    GameProjectMemberRepository.bind({ projectRef: a.ref, memberRef: 'sk_lvl2', role: 'level' });
    GameProjectMemberRepository.bind({ projectRef: a.ref, memberRef: 'sk_theme', role: 'audio' });

    const all = GameProjectRepository.list();
    expect(all.map((p) => p.title)).toContain('Project A');
    const rowA = all.find((p) => p.ref === a.ref);
    expect(rowA.memberCounts).toEqual({ level: 2, audio: 1 });
    const rowB = all.find((p) => p.ref === b.ref);
    expect(rowB.memberCounts).toEqual({});

    GameProjectRepository.update({ ref: b.ref, status: 'archived' });
    expect(GameProjectRepository.list({ status: 'archived' }).map((p) => p.ref)).toEqual([b.ref]);
    expect(() => GameProjectRepository.list({ status: 'nope' })).toThrow(/not valid/);
  });
});

describe('GameProjectMemberRepository', () => {
  it('binds with gated kind + role, defaulting member_kind to sketch', () => {
    const p = mintProject();
    const m = GameProjectMemberRepository.bind({
      projectRef: p.ref,
      memberRef: 'sk_hero',
      role: 'character',
      label: 'hero',
      meta: { slice: 'party' },
    });
    expect(m.memberKind).toBe('sketch');
    expect(m.role).toBe('character');
    expect(m.label).toBe('hero');
    expect(m.meta).toEqual({ slice: 'party' });

    expect(() =>
      GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'x', role: 'soundtrack' }),
    ).toThrow(new RegExp(`Allowed: ${MEMBER_ROLES.join(', ')}`));
    expect(() =>
      GameProjectMemberRepository.bind({
        projectRef: p.ref,
        memberRef: 'x',
        role: 'audio',
        memberKind: 'bot',
      }),
    ).toThrow(new RegExp(`Allowed: ${MEMBER_KINDS.join(', ')}`));
    expect(() =>
      GameProjectMemberRepository.bind({ projectRef: 'gp_missing000000', memberRef: 'x', role: 'audio' }),
    ).toThrow(/not found/);
    expect(() =>
      GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'x', role: 'audio', meta: [1] }),
    ).toThrow(/plain object/);
  });

  it('tolerates dangling member refs by design (navigational, never a FK)', () => {
    const p = mintProject();
    const m = GameProjectMemberRepository.bind({
      projectRef: p.ref,
      memberRef: 'sk_deleted_long_ago',
      role: 'level',
    });
    expect(m.memberRef).toBe('sk_deleted_long_ago');
  });

  it('re-bind is idempotent: updates label/meta, never duplicates the edge', () => {
    const p = mintProject();
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_boss', role: 'character', label: 'boss' });
    GameProjectMemberRepository.bind({
      projectRef: p.ref,
      memberRef: 'sk_boss',
      role: 'character',
      label: 'final boss',
      meta: { slice: 'party' },
    });
    const members = GameProjectMemberRepository.listByProject(p.ref);
    expect(members).toHaveLength(1);
    expect(members[0].label).toBe('final boss');
    expect(members[0].meta).toEqual({ slice: 'party' });
  });

  it('the same ref may hold two roles (two edges, not a conflict)', () => {
    const p = mintProject();
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_keyart', role: 'graphic' });
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_keyart', role: 'reference' });
    expect(GameProjectMemberRepository.listByProject(p.ref)).toHaveLength(2);
  });

  it('unbind removes exactly one edge and reports whether it did', () => {
    const p = mintProject();
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_theme', role: 'audio' });
    expect(
      GameProjectMemberRepository.unbind({ projectRef: p.ref, memberRef: 'sk_theme', role: 'audio' }),
    ).toBe(true);
    expect(
      GameProjectMemberRepository.unbind({ projectRef: p.ref, memberRef: 'sk_theme', role: 'audio' }),
    ).toBe(false);
    expect(GameProjectMemberRepository.listByProject(p.ref)).toHaveLength(0);
  });

  it('reverse lookup answers "which projects claim this artifact"', () => {
    const a = mintProject({ title: 'Project A' });
    const b = mintProject({ title: 'Project B' });
    GameProjectMemberRepository.bind({ projectRef: a.ref, memberRef: 'sk_shared_world', role: 'level' });
    GameProjectMemberRepository.bind({ projectRef: b.ref, memberRef: 'sk_shared_world', role: 'reference' });

    const owners = GameProjectMemberRepository.listByMember({ memberRef: 'sk_shared_world' });
    expect(owners).toHaveLength(2);
    expect(owners.map((o) => o.projectRef).sort()).toEqual([a.ref, b.ref].sort());
    expect(owners.find((o) => o.projectRef === a.ref).role).toBe('level');
    expect(GameProjectMemberRepository.listByMember({ memberRef: 'sk_unclaimed' })).toEqual([]);
  });

  it('the active rules member is the newest-bound; history is kept', () => {
    const p = mintProject();
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_game_v1', role: 'rules' });
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_game_v2', role: 'rules' });
    expect(GameProjectMemberRepository.rulesMember(p.ref).memberRef).toBe('sk_game_v2');
    expect(
      GameProjectMemberRepository.listByProject(p.ref).filter((m) => m.role === 'rules'),
    ).toHaveLength(2);
    expect(GameProjectMemberRepository.rulesMember('gp_missing000000')).toBeNull();
  });

  it('deleting a project cascades its member edges (FK ON DELETE CASCADE)', () => {
    const p = mintProject();
    GameProjectMemberRepository.bind({ projectRef: p.ref, memberRef: 'sk_lvl', role: 'level' });
    getDb().prepare('DELETE FROM game_projects WHERE ref = ?').run(p.ref);
    const orphans = getDb().prepare('SELECT COUNT(*) AS n FROM game_project_members').get();
    expect(orphans.n).toBe(0);
    expect(GameProjectMemberRepository.listByProject(p.ref)).toEqual([]);
  });
});
