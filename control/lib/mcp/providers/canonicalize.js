// Canonicalize a raw MCP server name into a provider_ref — the canonical
// lowercase key on meta_mcp_providers. Pure function; no DB, no FS.
//
// Intentionally dumb. The agent passes provider_ref explicitly on capabilities
// writes; this function fills the gap on inventory writes where the agent
// passes only the raw server name (e.g. "claude_ai_Gmail"). Four rules cover
// the obvious cases:
//
//   1. lowercase
//   2. strip leading host prefix: claude_ai_, claude-, or @<vendor>/ scope
//   3. strip trailing mcp-server suffix: -mcp-server, _mcp_server, -mcp, _mcp
//   4. normalize separators to underscore
//
// Genuine ambiguity (notion-remote vs notion, two official MCPs from one
// vendor) is the agent's job to disambiguate via the provider_ref passed
// explicitly on a capabilities write. v0 does not accept an inventory-time
// override — that's a deferred v1 affordance per the plan.

const LEADING_HOST_PREFIXES = ['claude_ai_', 'claude-'];
const TRAILING_MCP_SUFFIXES = ['-mcp-server', '_mcp_server', '-mcp', '_mcp'];

export function canonicalizeServerName(rawName) {
  if (typeof rawName !== 'string' || rawName.length === 0) {
    throw new Error('canonicalizeServerName: rawName must be a non-empty string');
  }

  let name = rawName.toLowerCase();

  // Step 2: strip leading host prefix. Order matters — try the most specific
  // first. @vendor/ scope is mutually exclusive with the claude_* prefixes.
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    if (slash !== -1) name = name.slice(slash + 1);
  } else {
    for (const prefix of LEADING_HOST_PREFIXES) {
      if (name.startsWith(prefix)) {
        name = name.slice(prefix.length);
        break;
      }
    }
  }

  // Step 3: strip trailing mcp-server suffix. Order matters — try longest
  // first so "-mcp-server" wins over "-mcp" on names like "notion-mcp-server".
  for (const suffix of TRAILING_MCP_SUFFIXES) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
      break;
    }
  }

  // Step 4: normalize separators. Underscore is canonical (matches how the
  // agent typically writes provider_ref by hand: "google_drive" not
  // "google-drive").
  name = name.replace(/-/g, '_');

  if (name.length === 0) {
    throw new Error(
      `canonicalizeServerName: empty result after canonicalization of "${rawName}"`
    );
  }

  return name;
}

// Exported for tests so the rule tables stay in lockstep with the function.
export const _internals = {
  LEADING_HOST_PREFIXES,
  TRAILING_MCP_SUFFIXES,
};
