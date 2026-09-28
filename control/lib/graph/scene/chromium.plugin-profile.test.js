// Under the Claude plugin profile (lib/mcp/plugin-profile.js) the resolver never downloads Chrome
// for Testing, not even for an explicit render that consented: it uses an installed browser or
// MOJULO_CHROMIUM, and otherwise answers with those options and the user-run command that fetches
// the same build. No browser is launched and nothing is fetched here: puppeteer, @puppeteer/browsers
// and the probed paths are stubs, as in chromium.test.js.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ existing: new Set(), launch: null, install: null }));

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal();
  const faked = (p) => /^(\/fake\/|\/Applications\/|\/usr\/bin\/|\/snap\/bin\/|[A-Z]:\\)/.test(String(p));
  const existsSync = (p) => (faked(p) ? h.existing.has(p) : real.existsSync(p));
  return { ...real, existsSync, default: { ...real, existsSync } };
});

vi.mock('puppeteer-core', () => ({ default: { launch: (opts) => h.launch(opts) } }));

vi.mock('@puppeteer/browsers', () => ({
  Browser: { CHROME: 'chrome' },
  detectBrowserPlatform: () => 'mac_arm',
  computeExecutablePath: () => '/fake/cft/chrome',
  install: (opts) => h.install(opts),
}));

vi.mock('@/lib/mcp/packs', () => ({ installedGroups: () => new Set(['creative']) }));

const { resolveChromium, _resetChromiumCache, PINNED_CHROME_BUILD } = await import('@/lib/graph/scene/chromium');
const { withChromiumFetch } = await import('@/lib/graph/scene/chromium-consent');

const ENV = ['MOJULO_CHROMIUM', 'PUPPETEER_EXECUTABLE_PATH', 'MOJULO_CHROMIUM_DIR', 'MOJULO_DISTRIBUTION'];
const saved = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k];
  delete process.env.MOJULO_CHROMIUM;
  delete process.env.PUPPETEER_EXECUTABLE_PATH;
  process.env.MOJULO_CHROMIUM_DIR = '/fake/home/chromium';
  process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
  h.existing.clear();
  h.launch = vi.fn(async () => ({ close: async () => {} }));
  h.install = vi.fn(async () => {
    h.existing.add('/fake/cft/chrome');
    return { executablePath: '/fake/cft/chrome' };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  _resetChromiumCache();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe('resolveChromium under the Claude plugin profile', () => {
  it('never downloads, even inside a consenting render or with allowFetch: true', async () => {
    const consenting = withChromiumFetch(() => resolveChromium());
    await expect(consenting).rejects.toMatchObject({ code: 'CHROMIUM_UNAVAILABLE' });
    await expect(resolveChromium({ allowFetch: true })).rejects.toMatchObject({ code: 'CHROMIUM_UNAVAILABLE' });
    expect(h.install).not.toHaveBeenCalled();
  });

  it('answers in-band with the installed-browser options and the user-run fetch command', async () => {
    const err = await resolveChromium({ allowFetch: true }).catch((e) => e);
    expect(err.message).toMatch(/does not download one/);
    expect(err.message).toMatch(/Google Chrome, Chromium, Microsoft Edge or Brave/);
    expect(err.message).toMatch(/MOJULO_CHROMIUM/);
    expect(err.message).toContain(`install chrome@${PINNED_CHROME_BUILD} --path "/fake/home/chromium"`);
    expect(err.message).toMatch(/npx -y @puppeteer\/browsers@\d+\.\d+\.\d+ install/);
  });

  it('uses an installed browser, or one MOJULO_CHROMIUM names', async () => {
    h.existing.add('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    await expect(withChromiumFetch(() => resolveChromium())).resolves.toMatchObject({
      value: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      fetched: null,
    });
    _resetChromiumCache();
    h.existing.clear();
    h.existing.add('/fake/my/chrome');
    process.env.MOJULO_CHROMIUM = '/fake/my/chrome';
    await expect(resolveChromium({ allowFetch: true })).resolves.toBe('/fake/my/chrome');
    expect(h.install).not.toHaveBeenCalled();
  });

  it('still downloads with consent under the npm distribution (unchanged)', async () => {
    process.env.MOJULO_DISTRIBUTION = 'npm';
    await expect(resolveChromium({ allowFetch: true })).resolves.toBe('/fake/cft/chrome');
    expect(h.install).toHaveBeenCalledTimes(1);
  });
});
