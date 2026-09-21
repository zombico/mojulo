// mcp-ui.mjs boots the standalone dashboard at module load (it lists on a port
// and imports server.js), so its env resolution is pinned at the SOURCE level:
// the bind host must be an unconditional assignment. `process.env.HOSTNAME ??=`
// let a Linux shell's exported HOSTNAME=<machine> become the bind address, so
// the server printed `Local: http://<container>:3001` and 127.0.0.1 refused
// (grok-headless-affordances P2).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'mcp-ui.mjs'), 'utf8');

describe('mcp-ui bind host', () => {
  it('sets HOSTNAME unconditionally (never a ??= default) with MOJULO_UI_HOST as the override', () => {
    expect(SRC).not.toMatch(/process\.env\.HOSTNAME\s*\?\?=/);
    expect(SRC).toMatch(/process\.env\.HOSTNAME\s*=\s*host;/);
    expect(SRC).toMatch(/process\.env\.MOJULO_UI_HOST\s*\|\|\s*'127\.0\.0\.1'/);
  });
});
