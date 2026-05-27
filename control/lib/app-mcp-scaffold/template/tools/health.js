// health — liveness ping for the sidecar. The Apps pane's App-MCP panel
// polls this to render an online/offline pill without paying the cost of a
// full describe_app round-trip on every poll.

export const healthTool = {
  name: 'health',
  description: 'Liveness ping. Returns { ok: true, uptime_seconds } when the sidecar is up.',
  inputSchema: { type: 'object', properties: {} },
  async handler() {
    return { ok: true, uptime_seconds: Math.floor(process.uptime()) };
  },
};
