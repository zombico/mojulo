// The Chrome for Testing download (~500 MB) happens only with consent: inside
// withChromiumFetch, which the explicit render entry points use. The mint-time
// warm and the gallery never start it. Chromium keeps its sandbox; only Linux
// falls back to --no-sandbox, after a sandboxed launch failed. No browser is
// launched and nothing is fetched here: puppeteer, @puppeteer/browsers and the
// probed paths are stubs.

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

const {
  resolveChromium, launchChromium, _resetChromiumCache, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS, PINNED_CHROME_BUILD,
} = await import('@/lib/graph/scene/chromium');
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
    expect(h.install.mock.calls[0][0].buildId).toBe(process.env.MOJULO_CHROMIUM_BUILD || PINNED_CHROME_BUILD);
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

describe('the pinned Chrome for Testing build', () => {
  // The bare 'puppeteer-core' specifier is mocked above; this subpath is the real file.
  it('is the build the installed puppeteer-core is released against', async () => {
    const { PUPPETEER_REVISIONS } = await import('puppeteer-core/internal/revisions.js');
    expect(PINNED_CHROME_BUILD).toBe(PUPPETEER_REVISIONS.chrome);
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

describe('launchChromium — sandbox', () => {
  const browser = { close: async () => {} };

  it('never passes --no-sandbox by default', () => {
    for (const args of [CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS]) {
      expect(args).not.toContain('--no-sandbox');
      expect(args).not.toContain('--disable-setuid-sandbox');
    }
  });

  it.each(['darwin', 'win32'])('%s launches sandboxed and never retries without it', async (platform) => {
    const launch = vi.fn(async () => { throw new Error('launch failed'); });
    await expect(launchChromium({ executablePath: '/x', args: CHROMIUM_WEBGL_ARGS }, { platform, launch }))
      .rejects.toThrow('launch failed');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0].args).not.toContain('--no-sandbox');
  });

  it('linux tries the sandbox first and keeps it when it starts', async () => {
    const launch = vi.fn(async () => browser);
    await launchChromium({ executablePath: '/x' }, { platform: 'linux', launch });
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0].args).toEqual(CHROMIUM_LAUNCH_ARGS);
  });

  it('linux retries once with --no-sandbox when the sandbox cannot start, says so, and remembers', async () => {
    const launch = vi.fn(async (opts) => {
      if (!opts.args.includes('--no-sandbox')) throw new Error('No usable sandbox! Update your kernel\nmore log');
      return browser;
    });
    await expect(launchChromium({ executablePath: '/x', args: CHROMIUM_WEBGL_ARGS }, { platform: 'linux', launch }))
      .resolves.toBe(browser);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(launch.mock.calls[1][0].args).toEqual(['--no-sandbox', '--disable-setuid-sandbox', ...CHROMIUM_WEBGL_ARGS]);
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/No usable sandbox!.*--no-sandbox/));

    // The host fact is remembered: the next launch goes straight to the fallback.
    await launchChromium({ executablePath: '/x' }, { platform: 'linux', launch });
    expect(launch).toHaveBeenCalledTimes(3);
    expect(launch.mock.calls[2][0].args[0]).toBe('--no-sandbox');
  });

  it('linux reports the sandboxed failure when the retry fails too', async () => {
    const launch = vi.fn(async (opts) => {
      throw new Error(opts.args.includes('--no-sandbox') ? 'still broken' : 'missing libnss3');
    });
    await expect(launchChromium({ executablePath: '/x' }, { platform: 'linux', launch })).rejects.toThrow('missing libnss3');
    // Not a sandbox problem, so nothing is remembered.
    launch.mockClear();
    await expect(launchChromium({ executablePath: '/x' }, { platform: 'linux', launch })).rejects.toThrow('missing libnss3');
    expect(launch.mock.calls[0][0].args).not.toContain('--no-sandbox');
  });
});
