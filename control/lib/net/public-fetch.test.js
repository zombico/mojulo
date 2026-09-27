import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import {
  fetchPublicUrl,
  isBlockedAddress,
  BlockedUrlError,
  ALLOW_PRIVATE_URLS_ENV,
} from './public-fetch.js';

// upload_document_from_url fetches an agent-supplied URL from the operator's
// machine. Without this guard it could read the dashboard on 127.0.0.1, a
// router admin page, or cloud metadata at 169.254.169.254.

let server;
let port;
let hits = 0;
let redirectTo = null;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits += 1;
    if (req.url === '/redirect' && redirectTo) {
      res.writeHead(302, { location: redirectTo });
      res.end();
      return;
    }
    if (req.url === '/big') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(Buffer.alloc(4096));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('secret local document');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  hits = 0;
  redirectTo = null;
  delete process.env[ALLOW_PRIVATE_URLS_ENV];
});

// Stand-in for "a public host": the test server's own address is let through,
// everything else keeps the real rules.
const onlyTestServerIsPublic = (address) => address !== '127.0.0.1' && isBlockedAddress(address);

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '127.9.9.9', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc12::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:169.254.169.254', '64:ff9b::10.0.0.1',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8', '64:ff9b::8.8.8.8'])(
    'allows %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe('fetchPublicUrl', () => {
  it('refuses a loopback IP literal without connecting', async () => {
    await expect(fetchPublicUrl(`http://127.0.0.1:${port}/doc`)).rejects.toBeInstanceOf(BlockedUrlError);
    expect(hits).toBe(0);
  });

  it('refuses loopback spelled as a decimal IPv4 literal', async () => {
    await expect(fetchPublicUrl(`http://2130706433:${port}/doc`)).rejects.toBeInstanceOf(BlockedUrlError);
    expect(hits).toBe(0);
  });

  it('refuses a hostname that resolves to loopback (checked after DNS)', async () => {
    await expect(fetchPublicUrl(`http://localhost:${port}/doc`)).rejects.toThrow(/private network/);
    expect(hits).toBe(0);
  });

  it('refuses an IPv6 loopback literal', async () => {
    await expect(fetchPublicUrl(`http://[::1]:${port}/doc`)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('refuses a redirect from a public host to cloud metadata', async () => {
    redirectTo = 'http://169.254.169.254/latest/meta-data/';
    await expect(
      fetchPublicUrl(`http://127.0.0.1:${port}/redirect`, { isBlocked: onlyTestServerIsPublic }),
    ).rejects.toBeInstanceOf(BlockedUrlError);
    expect(hits).toBe(1);
  });

  it('refuses a redirect to a hostname that resolves to loopback', async () => {
    redirectTo = `http://localhost:${port}/doc`;
    // Let only the first hop (the IP literal) through; the redirect's DNS
    // answer is then checked with the real rules.
    let firstHop = true;
    const isBlocked = (address) => {
      if (firstHop) {
        firstHop = false;
        return false;
      }
      return isBlockedAddress(address);
    };
    await expect(
      fetchPublicUrl(`http://127.0.0.1:${port}/redirect`, { isBlocked }),
    ).rejects.toBeInstanceOf(BlockedUrlError);
    expect(hits).toBe(1);
  });

  it('fetches from an allowed host and returns status, headers and body', async () => {
    const res = await fetchPublicUrl(`http://127.0.0.1:${port}/doc`, { isBlocked: onlyTestServerIsPublic });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.body.toString('utf8')).toBe('secret local document');
  });

  it(`${ALLOW_PRIVATE_URLS_ENV}=1 lets local development reach private addresses`, async () => {
    process.env[ALLOW_PRIVATE_URLS_ENV] = '1';
    const res = await fetchPublicUrl(`http://127.0.0.1:${port}/doc`);
    expect(res.body.toString('utf8')).toBe('secret local document');
  });

  it('enforces maxBytes', async () => {
    await expect(
      fetchPublicUrl(`http://127.0.0.1:${port}/big`, { isBlocked: onlyTestServerIsPublic, maxBytes: 1024 }),
    ).rejects.toThrow(/too large/);
  });

  it('refuses non-http schemes', async () => {
    await expect(fetchPublicUrl('file:///etc/passwd')).rejects.toThrow(/http\(s\)/);
  });
});
