import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { renderBeatsOffline } from './beats-render.js';
import { BASELINE_FIXTURES } from './beats-render.baseline.fixtures.js';

// Byte-identity pin: representative manifests that opt into no audio-fidelity
// param must render the same WAV bytes forever. If one of these moves, a
// realizer change altered an already-minted row — revert it or make it opt-in.
// The float math runs in node-web-audio-api's native renderer, so hashes are
// keyed per platform-arch; an unpinned platform skips rather than guesses.
const PINS = {
  'darwin-arm64': {
    composition: 'c9c031723a5889532232a18de66f43d4db3c98b46082487ef08db01f93f5e4b2',
    pattern: 'df6d7c24732973a83a8ef8e5eea1726482a23b40109d0b7960c7d8757aab5b6a',
    sfx: '8e1a7122751a5a802ec6d3fc72e76a75b80a12ad6ad134c96f1c22c84a534c67',
    ambient: '3bf3acdc4159a7a7930063b776e31dde35c9fc542f7092f13aea4fa1715d66b4',
  },
}[`${process.platform}-${process.arch}`];

describe('offline render byte-identity baseline', () => {
  for (const [name, { manifest, opts }] of Object.entries(BASELINE_FIXTURES)) {
    it.skipIf(!PINS)(`${name} renders byte-identical to the pin`, async () => {
      const { wav } = await renderBeatsOffline(manifest, opts);
      expect(createHash('sha256').update(wav).digest('hex')).toBe(PINS[name]);
    });
  }
});
