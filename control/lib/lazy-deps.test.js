import { describe, it, expect, vi } from 'vitest';
import { lazyDependency, DependencyUnavailableError } from '@/lib/lazy-deps';

describe('lazyDependency', () => {
  it('imports once, on the first call, and shares the result', async () => {
    const importer = vi.fn(async () => ({ default: 'mod' }));
    const load = lazyDependency('pkg', importer, 'does a thing');
    expect(importer).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([load(), load()]);
    expect(a).toEqual({ default: 'mod' });
    expect(b).toBe(a);
    await load();
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('turns a failed import into an in-band error naming the package and its job', async () => {
    const cause = Object.assign(new Error("Cannot find package 'pkg'"), { code: 'ERR_MODULE_NOT_FOUND' });
    const load = lazyDependency('pkg', async () => { throw cause; }, 'does a thing');
    const err = await load().catch((e) => e);
    expect(err).toBeInstanceOf(DependencyUnavailableError);
    expect(err.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(err.dependency).toBe('pkg');
    expect(err.cause).toBe(cause);
    expect(err.message).toMatch(/^pkg \(does a thing\) could not be loaded on this host: Cannot find package 'pkg'/);
    expect(err.message).toMatch(/reinstall mojulo/);
  });

  it('does not cache a failure, so a later install is picked up without a restart', async () => {
    let installed = false;
    const load = lazyDependency('pkg', async () => {
      if (!installed) throw new Error('missing');
      return { ok: true };
    }, 'does a thing');
    await expect(load()).rejects.toBeInstanceOf(DependencyUnavailableError);
    installed = true;
    await expect(load()).resolves.toEqual({ ok: true });
  });
});
