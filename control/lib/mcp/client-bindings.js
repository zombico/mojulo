/**
 * Per-mcpSessionId clientInfo cache.
 *
 * MCP clients send `clientInfo: { name, version }` in their `initialize`
 * request. The control plane uses that name to auto-bind a host adapter
 * (claude-code, codex, generic) when later tool calls don't pass an explicit
 * `host` parameter. State lives in process memory and is dropped on restart —
 * same lifecycle posture as session-binding.js.
 *
 * Symmetric to session-binding.js but with a different concern: that file
 * maps mcpSessionId → BuilderSession; this one maps mcpSessionId → clientInfo.
 * They share nothing else, so they live separately to keep each focused.
 */

// mcpSessionId → { name, version }
const bindings = new Map();

export function rememberClientInfo(mcpSessionId, clientInfo) {
  if (!mcpSessionId || !clientInfo || typeof clientInfo !== 'object') return;
  const { name, version } = clientInfo;
  if (!name || typeof name !== 'string') return;
  bindings.set(mcpSessionId, { name, version: version || null });
}

export function getClientInfo(mcpSessionId) {
  return bindings.get(mcpSessionId) || null;
}

export function getAllClientInfo() {
  return Array.from(bindings.values()).map(({ name, version }) => ({ name, version }));
}

// Test seam.
export function _resetClientBindingsForTests() {
  bindings.clear();
}
