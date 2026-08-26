// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as packs.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Roles pack Phase 1 (lib/mcp/roles-pack.plan.md): identity + key mint/revoke +
// attribution. The invariant under test throughout: with MOJULO_ROLES unset,
// behavior is byte-identical to a roles-less install — the tools exist but only
// answer with the activation pointer, tools/list is unchanged, and no delegate
// key resolves.
// ---------------------------------------------------------------------------

import { rolesEnabled, isAdminContext, mintToken, hashToken, resolveBearerUser } from '@/lib/roles/keys';
import { UserRepository, LOCAL_ADMIN_ID } from '@/lib/db/repositories/users';
import { McpToolCallRepository } from '@/lib/db/repositories/mcpToolCalls';

let server;

beforeAll(async () => {
  server = await import('@/lib/mcp/server');
  await server.ensureToolsRegistered();
});

afterEach(() => {
  delete process.env.MOJULO_ROLES;
  delete process.env.MOJULO_MCP_TELEMETRY_CAPTURE;
});

// async: hold MOJULO_ROLES for the WHOLE async dispatch (same caveat as
// packs.test.js's withInstall — the deep dispatch path reads env well past the
// first await; a sync finally would drop the flag before the handler runs).
async function withRoles(fn) {
  process.env.MOJULO_ROLES = 'enabled';
  try {
    return await fn();
  } finally {
    delete process.env.MOJULO_ROLES;
  }
}

const ADMIN_CONTEXT = { mcpSessionId: 'roles-test', userId: 'local' };

async function callTool(name, args, context = ADMIN_CONTEXT) {
  const res = await server.dispatchMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
    context
  );
  const text = res.result?.content?.[0]?.text || res.error?.message || '';
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* advisory text, not JSON */
  }
  return { res, text, parsed, isError: Boolean(res.result?.isError || res.error) };
}

describe('activation gate (MOJULO_ROLES)', () => {
  it('rolesEnabled only on the literal `enabled`', () => {
    expect(rolesEnabled({})).toBe(false);
    expect(rolesEnabled({ MOJULO_ROLES: 'on' })).toBe(false);
    expect(rolesEnabled({ MOJULO_ROLES: 'enabled' })).toBe(true);
  });

  it('roles off: tools answer with the activation pointer, never execute', async () => {
    for (const [name, args] of [
      ['mint_role_key', { name: 'ana' }],
      ['list_role_keys', {}],
      ['revoke_role_key', { user: 'ana' }],
    ]) {
      const { text, isError } = await callTool(name, args);
      expect(isError, `${name} should be gated`).toBe(true);
      expect(text).toMatch(/MOJULO_ROLES=enabled/);
      expect(text).toMatch(/Do not retry/i);
    }
    // and nothing was written
    expect(UserRepository.list()).toEqual([]);
  });

  it('roles tools stay OFF tools/list in both modes (Phase 1 posture)', () => {
    for (const mode of ['on', 'off']) {
      const prev = process.env.MOJULO_TOOL_PACKS;
      process.env.MOJULO_TOOL_PACKS = mode;
      try {
        const names = server.listTools().map((t) => t.name);
        expect(names).not.toContain('mint_role_key');
        expect(names).not.toContain('list_role_keys');
        expect(names).not.toContain('revoke_role_key');
      } finally {
        if (prev === undefined) delete process.env.MOJULO_TOOL_PACKS;
        else process.env.MOJULO_TOOL_PACKS = prev;
      }
    }
  });
});

describe('admin-only (the hard deny-list, Phase 1 slice)', () => {
  it('a privileged context is refused; contexts without a role are the operator', async () => {
    expect(isAdminContext(ADMIN_CONTEXT)).toBe(true); // local/stdio/god-key
    expect(isAdminContext({ userId: 'usr_x', userRole: 'privileged' })).toBe(false);
    await withRoles(async () => {
      const { text, isError } = await callTool(
        'list_role_keys',
        {},
        { mcpSessionId: 'roles-test', userId: 'usr_x', userRole: 'privileged' }
      );
      expect(isError).toBe(true);
      expect(text).toMatch(/admin-only/i);
    });
  });
});

describe('mint → resolve → revoke lifecycle', () => {
  it('mint returns the token once; the hash resolves the active user', async () => {
    await withRoles(async () => {
      const { parsed, isError } = await callTool('mint_role_key', { name: 'ana' });
      expect(isError).toBe(false);
      expect(parsed.token).toMatch(/^mjr_[0-9a-f]{48}$/);
      expect(parsed.role).toBe('privileged');
      expect(parsed.status).toBe('active');

      // the local admin row was seeded on first mint
      const local = UserRepository.findById(LOCAL_ADMIN_ID);
      expect(local?.role).toBe('admin');

      // bearer resolution — enabled only, active only
      const user = resolveBearerUser(parsed.token);
      expect(user?.name).toBe('ana');
      expect(resolveBearerUser('mjr_' + '0'.repeat(48))).toBeNull();
      expect(resolveBearerUser(parsed.token, {})).toBeNull(); // roles off → never resolves

      // duplicate names refused
      const dup = await callTool('mint_role_key', { name: 'ana' });
      expect(dup.isError).toBe(true);

      // list shows both rows, no hashes
      const list = await callTool('list_role_keys', {});
      const names = list.parsed.users.map((u) => u.name).sort();
      expect(names).toEqual(['Local Operator', 'ana']);
      expect(JSON.stringify(list.parsed)).not.toContain(hashToken(parsed.token));

      // revoke by name: stops resolving, keeps the row, bumps the epoch
      const before = UserRepository.findByName('ana');
      const rev = await callTool('revoke_role_key', { user: 'ana' });
      expect(rev.parsed.status).toBe('revoked');
      expect(resolveBearerUser(parsed.token)).toBeNull();
      expect(UserRepository.findByName('ana').tokenEpoch).toBe(before.tokenEpoch + 1);

      // the operator's own row is not revocable
      const local2 = await callTool('revoke_role_key', { user: LOCAL_ADMIN_ID });
      expect(local2.isError).toBe(true);
      expect(local2.text).toMatch(/CONTROL_PLANE_MCP_KEY/);
    });
  });

  it('an expired key stops resolving', () => {
    withRoles(() => {
      const token = mintToken();
      UserRepository.create({
        name: 'expired-agent',
        role: 'privileged',
        tokenHash: hashToken(token),
        expiresAt: Date.now() - 1000,
      });
      expect(resolveBearerUser(token)).toBeNull();
    });
  });
});

// ── Phase 2: capability enforcement ─────────────────────────────────────────

function privilegedContext({ grants = [], flags = {} } = {}) {
  return {
    mcpSessionId: 'roles-enforce-test',
    userId: 'usr_delegate',
    userRole: 'privileged',
    userGrants: grants,
    userFlags: flags,
  };
}

describe('authNotice at the chokepoints (grants, deny-list, flags)', () => {
  it('granted bay executes; ungranted bay gets a terminal advisory', async () => {
    await withRoles(async () => {
      const ok = await callTool('list_world_themes', {}, privilegedContext({ grants: ['pack_world'] }));
      expect(ok.isError).toBe(false);

      const denied = await callTool('list_deployments', {}, privilegedContext({ grants: ['pack_world'] }));
      expect(denied.isError).toBe(true);
      expect(denied.text).toMatch(/pack_bot_operate/);
      expect(denied.text).toMatch(/Do not retry/i);
    });
  });

  it('the hard deny-list holds even when the home pack is granted', async () => {
    await withRoles(async () => {
      for (const name of ['set_env', 'inspect_bot_env', 'start_daemon', 'mint_role_key']) {
        const { text, isError } = await callTool(
          name,
          {},
          privilegedContext({ grants: ['pack_bot_operate', 'pack_runtime'] })
        );
        expect(isError, `${name} must be denied`).toBe(true);
        expect(text).toMatch(/admin-only|deny-list/i);
      }
    });
  });

  it('spine stays available to every key (orientation is not a secret)', async () => {
    await withRoles(async () => {
      const { isError } = await callTool('version', {}, privilegedContext());
      expect(isError).toBe(false);
    });
  });

  it('propose_only: forging plans is fine, sealing is not', async () => {
    await withRoles(async () => {
      const sealed = await callTool(
        'execute_plan',
        { ref: 'pl_x' },
        privilegedContext({ grants: ['pack_plan'], flags: { propose_only: true } })
      );
      expect(sealed.isError).toBe(true);
      expect(sealed.text).toMatch(/propose-only/i);

      // list_plans (same pack, non-sealing) passes the auth gate.
      const listed = await callTool(
        'list_plans',
        {},
        privilegedContext({ grants: ['pack_plan'], flags: { propose_only: true } })
      );
      expect(listed.text).not.toMatch(/propose-only/i);
    });
  });

  it('outward / lifecycle actions require their flags', async () => {
    await withRoles(async () => {
      const noLifecycle = await callTool(
        'start_app',
        {},
        privilegedContext({ grants: ['pack_runtime'] })
      );
      expect(noLifecycle.isError).toBe(true);
      expect(noLifecycle.text).toMatch(/LIFECYCLE/);

      const noOutward = await callTool(
        'save_modular_bot',
        {},
        privilegedContext({ grants: ['pack_bot_build'], flags: { lifecycle: true } })
      );
      expect(noOutward.isError).toBe(true);
      expect(noOutward.text).toMatch(/OUTWARD/);

      // with both flags the auth gate passes (the real handler may still fail
      // on its own terms — that failure must not be an auth denial)
      const flagged = await callTool(
        'start_app',
        {},
        privilegedContext({ grants: ['pack_runtime'], flags: { lifecycle: true } })
      );
      expect(flagged.text).not.toMatch(/LIFECYCLE action/);
    });
  });

  it('the pack dispatcher is gated per member (third chokepoint)', async () => {
    await withRoles(async () => {
      const denied = await callTool(
        'pack_bot_operate',
        { tool: 'list_deployments', args: {} },
        privilegedContext({ grants: ['pack_world'] })
      );
      expect(denied.isError).toBe(true);
      expect(denied.text).toMatch(/pack_bot_operate/);

      const granted = await callTool(
        'pack_world',
        { tool: 'list_world_themes', args: {} },
        privilegedContext({ grants: ['pack_world'] })
      );
      expect(granted.isError).toBe(false);
    });
  });

  it('the plan-executor path is gated under the caller context', async () => {
    await withRoles(async () => {
      await expect(
        server.invokeRegisteredTool('list_deployments', {}, privilegedContext({ grants: [] }))
      ).rejects.toThrow(/pack_bot_operate/);
    });
  });

  it('roles off / admin context: authNotice never fires (byte-identical behavior)', async () => {
    // roles off — even a "privileged-shaped" context is not enforced
    const off = await callTool('list_deployments', {}, privilegedContext());
    expect(off.text).not.toMatch(/does not carry/);
    // roles on, admin — unbounded
    await withRoles(async () => {
      const admin = await callTool('list_deployments', {}, ADMIN_CONTEXT);
      expect(admin.text).not.toMatch(/does not carry/);
    });
  });
});

describe('listTools filtering (privileged sees their bays; admin sees roles tools)', () => {
  function names(mode, context) {
    const prev = process.env.MOJULO_TOOL_PACKS;
    process.env.MOJULO_TOOL_PACKS = mode;
    try {
      return server.listTools({ context }).map((t) => t.name);
    } finally {
      if (prev === undefined) delete process.env.MOJULO_TOOL_PACKS;
      else process.env.MOJULO_TOOL_PACKS = prev;
    }
  }

  it('packs mode: spine + granted packs only', async () => {
    await withRoles(async () => {
      const list = names('on', privilegedContext({ grants: ['pack_world', 'pack_diagram'] }));
      expect(list).toContain('forward_context'); // spine
      expect(list).toContain('pack_world');
      expect(list).toContain('pack_diagram');
      expect(list).not.toContain('pack_bot_operate');
      expect(list).not.toContain('mint_role_key'); // roles admin never lists for delegates
    });
  });

  it('flat mode: granted members only, deny-list hidden', async () => {
    await withRoles(async () => {
      const list = names('off', privilegedContext({ grants: ['pack_bot_operate'] }));
      expect(list).toContain('list_deployments'); // granted member
      expect(list).not.toContain('set_env'); // deny-listed, granted pack or not
      expect(list).not.toContain('compose_world'); // ungranted bay
      expect(list).toContain('forward_context'); // spine
    });
  });

  it('admin with roles enabled sees the roles-admin tools in both modes', async () => {
    await withRoles(async () => {
      for (const mode of ['on', 'off']) {
        const list = names(mode, ADMIN_CONTEXT);
        expect(list).toContain('mint_role_key');
        expect(list).toContain('revoke_role_key');
      }
    });
  });

  it('roles off: the surface is byte-identical to a roles-less install', () => {
    for (const mode of ['on', 'off']) {
      const withCtx = names(mode, ADMIN_CONTEXT);
      const withoutCtx = names(mode, undefined);
      expect(withCtx).toEqual(withoutCtx);
      expect(withCtx).not.toContain('mint_role_key');
    }
  });
});

describe('mint with grants + flags', () => {
  it('grants validate against the PACKS manifest; flags persist on the key', async () => {
    await withRoles(async () => {
      const bad = await callTool('mint_role_key', { name: 'typo', grants: ['pack_nope'] });
      expect(bad.isError).toBe(true);
      expect(bad.text).toMatch(/pack_nope/);

      const { parsed } = await callTool('mint_role_key', {
        name: 'analyst',
        grants: ['pack_fleet'],
        propose_only: true,
        expires_in_days: 30,
      });
      expect(parsed.grants).toEqual(['pack_fleet']);
      expect(parsed.flags).toEqual({ propose_only: true });
      expect(UserRepository.grantsFor(parsed.userId)).toEqual(['pack_fleet']);
      expect(UserRepository.findById(parsed.userId).flags).toEqual({ propose_only: true });

      const list = await callTool('list_role_keys', {});
      const analyst = list.parsed.users.find((u) => u.name === 'analyst');
      expect(analyst.grants).toEqual(['pack_fleet']);
      expect(analyst.flags).toEqual({ propose_only: true });
    });
  });
});

describe('attribution + secrets discipline at the telemetry seam', () => {
  it('tool calls persist the context userId; mint_role_key is capture-exempt', async () => {
    process.env.MOJULO_MCP_TELEMETRY_CAPTURE = 'full';
    await withRoles(async () => {
      const { parsed } = await callTool('mint_role_key', { name: 'audit-probe' }, {
        mcpSessionId: 'roles-audit',
        userId: 'local',
      });
      expect(parsed.token).toBeTruthy();
      const [row] = McpToolCallRepository.recent({ tool: 'mint_role_key', limit: 1 });
      expect(row.userId).toBe('local');
      // full capture is ON, but the minting tool is noCapture — the token
      // never lands in the DB, in either direction.
      expect(row.inputJson).toBeNull();
      expect(row.resultJson).toBeNull();
      // a normal tool still records attribution
      await callTool('list_role_keys', {}, { mcpSessionId: 'roles-audit', userId: 'usr_delegate' });
      const [listRow] = McpToolCallRepository.recent({ tool: 'list_role_keys', limit: 1 });
      expect(listRow.userId).toBe('usr_delegate');
    });
  });
});
