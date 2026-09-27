// Offline-build mode from an npm install: the package ships lite-template without models/
// (package.json "files"), and the bot Dockerfile's `COPY models/ ./models/` fails on a build
// context that has no such directory. Install surface: a silent regression here breaks
// `docker compose up --build` for every air-gapped operator.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';

// docker.js reads its env at module load, so this file sets it before the one import.
const ENV_KEYS = ['LITE_TEMPLATE_PATH', 'ARTIFACTS_DIR', 'STORAGE_ROOT', 'MOJULO_OFFLINE_BUILD'];
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
let tmpRoot;
let entries;

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'docker-offline-test-'));
  const templateDir = path.join(tmpRoot, 'template');
  await fsp.mkdir(path.join(templateDir, 'helper'), { recursive: true });
  await fsp.writeFile(path.join(templateDir, 'Dockerfile'), 'COPY models/ ./models/\n');
  await fsp.writeFile(path.join(templateDir, 'package.json'), '{}');
  await fsp.writeFile(path.join(templateDir, 'helper', 'x.js'), '// fake');
  await fsp.mkdir(path.join(tmpRoot, 'artifacts'));
  await fsp.mkdir(path.join(tmpRoot, 'storage'));

  process.env.LITE_TEMPLATE_PATH = templateDir;
  process.env.ARTIFACTS_DIR = path.join(tmpRoot, 'artifacts');
  process.env.STORAGE_ROOT = path.join(tmpRoot, 'storage');
  process.env.MOJULO_OFFLINE_BUILD = '1';

  const { DockerDeployer } = await import('./docker.js');
  const result = await new DockerDeployer().deploy({
    deploymentId: 'offline-fixture',
    botName: 'offline-bot',
    apiKey: 'bot_fixture_apikey',
    config: {
      _composedInstructions: 'fake composed instructions',
      llm: { provider: 'anthropic', anthropic: { model: 'claude-sonnet-4-6' } },
      config: { name: 'Offline Bot', objective: 'help with tests' },
    },
    enabledProtocols: { knowledge: true },
  });
  entries = new AdmZip(result.artifactPath).getEntries().map((e) => e.entryName);
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL_ENV[k];
  }
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true });
});

describe('offline-build artifact from a template without models/', () => {
  it('carries the template source and a models/ directory for the Dockerfile to COPY', () => {
    expect(entries).toContain('Dockerfile');
    expect(entries).toContain('helper/x.js');
    expect(entries).toContain('models/README.txt');
  });
});
