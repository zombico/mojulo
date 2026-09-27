// The Chrome for Testing download (~500 MB) happens only with consent: inside
// withChromiumFetch, which the explicit render entry points use. The mint-time
// warm and the gallery never start it. No browser is launched and nothing is
// fetched here: puppeteer, @puppeteer/browsers and the probed paths are stubs.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  existing: new Set(),
  launch: null,
  install: null,
  rasterize: null,
  bakeStrip: null,
}));

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal();
  // Only the browser paths the resolver probes are faked; everything else is real.
  const faked = (p) => /^(\/fake\/|\/Applications\/|\/usr\/bin\/|\/snap\/bin\/|[A-Z]:\\)/.test(String(p));
  const existsSync = (p) => (faked(p) ? h.existing.has(p) : real.existsSync(p));
  return { ...real, existsSync, default: { ...real, existsSync } };
});

vi.mock('puppeteer-core', () => ({
  default: { launch: (opts) => h.launch(opts) },
}));

vi.mock('@puppeteer/browsers', () => ({
  Browser: { CHROME: 'chrome' },
  detectBrowserPlatform: () => 'mac_arm',
  computeExecutablePath: () => '/fake/cft/chrome',
  install: (opts) => h.install(opts),
}));

vi.mock('@/lib/mcp/packs', () => ({ installedGroups: () => new Set(['creative']) }));

vi.mock('@/lib/graph/sketch/sketch-png', () => ({ rasterizeSketchToPng: (...a) => h.rasterize(...a) }));
vi.mock('@/lib/graph/sketch/turntable-bake', () => ({ bakeTurntableStrip: (...a) => h.bakeStrip(...a) }));

const { resolveChromium, _resetChromiumCache } = await import('@/lib/graph/scene/chromium');
const { withChromiumFetch, withoutChromiumFetch } = await import('@/lib/graph/scene/chromium-consent');
const { bakeWarm } = await import('@/lib/graph/scene/scene-png-warm');

const saved = {};
const ENV = ['MOJULO_CHROMIUM', 'PUPPETEER_EXECUTABLE_PATH', 'MOJULO_CHROMIUM_DIR'];

beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k];
  delete process.env.MOJULO_CHROMIUM;
  delete process.env.PUPPETEER_EXECUTABLE_PATH;
  process.env.MOJULO_CHROMIUM_DIR = '/fake/home/chromium';
  h.existing.clear();
  h.launch = vi.fn(async () => ({ close: async () => {} }));
  h.install = vi.fn(async () => {
    h.existing.add('/fake/cft/chrome');
    return { executablePath: '/fake/cft/chrome' };
  });
  h.rasterize = vi.fn(async () => Buffer.from('png'));
  h.bakeStrip = vi.fn(async () => Buffer.from('strip'));
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

describe('resolveChromium — download consent', () => {
  it('never downloads outside a consenting render', async () => {
    await expect(resolveChromium()).rejects.toMatchObject({ code: 'CHROMIUM_UNAVAILABLE' });
    expect(h.install).not.toHaveBeenCalled();
  });

  it('downloads inside withChromiumFetch into the cache dir and reports it', async () => {
    const { value, fetched } = await withChromiumFetch(() => resolveChromium());
    expect(value).toBe('/fake/cft/chrome');
    expect(h.install).toHaveBeenCalledTimes(1);
    expect(h.install.mock.calls[0][0].cacheDir).toBe('/fake/home/chromium');
    expect(fetched.dir).toBe('/fake/home/chromium');
    expect(fetched.notice).toMatch(/Downloaded Chrome for Testing .* into \/fake\/home\/chromium/);
  });

  it('a refusal scope inside a consenting one still refuses', async () => {
    const { value } = await withChromiumFetch(() => withoutChromiumFetch(
      () => resolveChromium().then(() => 'resolved', (err) => err.code),
    ));
    expect(value).toBe('CHROMIUM_UNAVAILABLE');
    expect(h.install).not.toHaveBeenCalled();
  });

  it('allowFetch:false wins over the scope', async () => {
    const { value } = await withChromiumFetch(
      () => resolveChromium({ allowFetch: false }).then(() => 'resolved', (err) => err.code),
    );
    expect(value).toBe('CHROMIUM_UNAVAILABLE');
    expect(h.install).not.toHaveBeenCalled();
  });

  it('keeps the resolve order: an installed browser means no download, even with consent', async () => {
    const chrome = process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`
        : '/usr/bin/google-chrome';
    h.existing.add(chrome);
    const { value, fetched } = await withChromiumFetch(() => resolveChromium());
    expect(value).toBe(chrome);
    expect(fetched).toBeNull();
    expect(h.install).not.toHaveBeenCalled();
  });

  it('a previously downloaded build is reused without consent', async () => {
    h.existing.add('/fake/cft/chrome');
    await expect(resolveChromium()).resolves.toBe('/fake/cft/chrome');
    expect(h.install).not.toHaveBeenCalled();
  });
});

describe('mint-time warm', () => {
  const sketch = { ref: 'sk_warm', manifest: { kind: 'fractal-city' } };

  it('skips quietly on a host with no browser: no download, no bake', async () => {
    await expect(bakeWarm(sketch)).resolves.toBe(false);
    expect(h.install).not.toHaveBeenCalled();
    expect(h.rasterize).not.toHaveBeenCalled();
    expect(h.bakeStrip).not.toHaveBeenCalled();
  });

  it('skips even when fired from inside a consenting render', async () => {
    const { value } = await withChromiumFetch(() => bakeWarm(sketch));
    expect(value).toBe(false);
    expect(h.install).not.toHaveBeenCalled();
  });

  it('bakes the still and the strip with a browser already on the host', async () => {
    h.existing.add('/fake/cft/chrome');
    await expect(bakeWarm(sketch)).resolves.toBe(true);
    expect(h.rasterize).toHaveBeenCalledTimes(1);
    expect(h.bakeStrip).toHaveBeenCalledTimes(1);
    expect(h.install).not.toHaveBeenCalled();
  });
});
