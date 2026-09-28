/**
 * Per-mcpSessionId clientInfo cache.
 *
 * MCP clients send `clientInfo: { name, version }` in their `initialize`
 * request. The control plane uses that name to auto-bind a host adapter
 * (claude-code, codex, generic) when later tool calls don't pass an explicit
 * `host` parameter. State lives in process memory and is dropped on restart,
 * like the agent-tasks queue. (Until 3.0 a sibling, session-binding.js, mapped
 * mcpSessionId → the chatbot builder's session; it left with the factory.)
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
