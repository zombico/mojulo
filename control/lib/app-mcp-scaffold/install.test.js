import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installScaffold, _internals } from './install.js';

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-app-mcp-install-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('installScaffold — happy path', () => {
  it('materializes the template into <targetDir>/app-mcp/ with all expected files', () => {
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'image-extractor',
      materializationRef: 'claude-code:/tmp/app-123',
      declaredPurpose: 'Extract structured info from uploaded images',
    });
    expect(out.scaffoldDir).toBe(join(tmpRoot, 'app-mcp'));
    expect(out.reused).toBe(false);

    const expectFiles = [
      'app-mcp/server.js',
      'app-mcp/tools/describe.js',
      'app-mcp/tools/health.js',
      'app-mcp/lib/envelope-client.js',
      'app-mcp/_agent_extend.md',
      'app-mcp/package.json',
    ];
    for (const rel of expectFiles) {
      expect(existsSync(join(tmpRoot, rel))).toBe(true);
    }
  });

  it('substitutes APP_NAME / MATERIALIZATION_REF / DECLARED_PURPOSE into describe.js', () => {
    installScaffold({
      targetDir: tmpRoot,
      appName: 'image-extractor',
      materializationRef: 'claude-code:/tmp/app-123',
      declaredPurpose: 'Extract structured info from uploaded images',
    });
    const describe = readFileSync(join(tmpRoot, 'app-mcp', 'tools', 'describe.js'), 'utf8');
    expect(describe).toContain("APP_NAME = 'image-extractor'");
    expect(describe).toContain("MATERIALIZATION_REF = 'claude-code:/tmp/app-123'");
    expect(describe).toContain("DECLARED_PURPOSE = 'Extract structured info from uploaded images'");
    expect(describe).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('leaves non-placeholder files byte-identical to the template', () => {
    installScaffold({
      targetDir: tmpRoot,
      appName: 'x',
      materializationRef: 'ref-1',
    });
    const serverJs = readFileSync(join(tmpRoot, 'app-mcp', 'server.js'), 'utf8');
    // server.js doesn't carry placeholders — confirm none leaked in.
    expect(serverJs).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(serverJs).toContain('mojulo-app-mcp');
  });

  it('generates a fresh APP_MCP_BEARER and writes it to <targetDir>/.env on first install', () => {
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'x',
      materializationRef: 'ref-1',
    });
    expect(out.bearerGenerated).toBe(true);
    expect(out.bearer).toMatch(/^[a-f0-9]{64}$/);
    const env = readFileSync(out.envPath, 'utf8');
    expect(env).toContain(`APP_MCP_BEARER=${out.bearer}`);
  });

  it('reuses an existing APP_MCP_BEARER when .env already has one (static-per-app policy)', () => {
    const envPath = join(tmpRoot, '.env');
    writeFileSync(envPath, 'OTHER_VAR=value\nAPP_MCP_BEARER=existing-bearer-hex\n');
    const out = installScaffold({
      targetDir: tmpRoot,
      appName: 'x',
      materializationRef: 'ref-1',
    });
    expect(out.bearerGenerated).toBe(false);
    expect(out.bearer).toBe('existing-bearer-hex');
    // .env content preserved (no duplicate APP_MCP_BEARER line appended).
    const env = readFileSync(envPath, 'utf8');
    const matches = env.match(/^APP_MCP_BEARER=/gm) || [];
    expect(matches).toHaveLength(1);
  });
});

describe('installScaffold — idempotence + overwrite', () => {
  it('re-running on an existing scaffold returns reused: true without re-templating', () => {
    installScaffold({ targetDir: tmpRoot, appName: 'first', materializationRef: 'ref-1' });
    const second = installScaffold({
      targetDir: tmpRoot,
      // Different name on the second call — proves the file was NOT rewritten.
      appName: 'second',
      materializationRef: 'ref-2',
    });
    expect(second.reused).toBe(true);
    const describe = readFileSync(join(tmpRoot, 'app-mcp', 'tools', 'describe.js'), 'utf8');
    expect(describe).toContain("APP_NAME = 'first'");
    expect(describe).not.toContain("APP_NAME = 'second'");
  });

  it('overwrite: true repaves the scaffold with new placeholder values', () => {
    installScaffold({ targetDir: tmpRoot, appName: 'first', materializationRef: 'ref-1' });
    const second = installScaffold({
      targetDir: tmpRoot,
      appName: 'second',
      materializationRef: 'ref-2',
      overwrite: true,
    });
    expect(second.reused).toBe(false);
    const describe = readFileSync(join(tmpRoot, 'app-mcp', 'tools', 'describe.js'), 'utf8');
    expect(describe).toContain("APP_NAME = 'second'");
  });
});

describe('installScaffold — rejection paths', () => {
  it('rejects an empty appName', () => {
    expect(() =>
      installScaffold({ targetDir: tmpRoot, appName: '', materializationRef: 'r' }),
    ).toThrow(/non-empty appName/);
  });

  it('rejects an empty materializationRef', () => {
    expect(() =>
      installScaffold({ targetDir: tmpRoot, appName: 'x', materializationRef: '' }),
    ).toThrow(/non-empty materializationRef/);
  });

  it('rejects a missing targetDir', () => {
    expect(() =>
      installScaffold({
        targetDir: '/tmp/__definitely-not-here__',
        appName: 'x',
        materializationRef: 'r',
      }),
    ).toThrow(/does not exist/);
  });
});

describe('_internals.substitute', () => {
  it('replaces every occurrence of every placeholder', () => {
    const out = _internals.substitute(
      '{{APP_NAME}} :: {{MATERIALIZATION_REF}} :: {{APP_NAME}} :: {{DECLARED_PURPOSE}}',
      { appName: 'a', materializationRef: 'r', declaredPurpose: 'p' },
    );
    expect(out).toBe('a :: r :: a :: p');
  });
});
