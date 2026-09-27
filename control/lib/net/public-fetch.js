/**
 * Fetch a URL that an agent or a user handed us, refusing anything on this
 * machine or its private network: loopback, link-local (cloud metadata at
 * 169.254.169.254), RFC 1918, carrier-grade NAT, multicast and the other
 * special-purpose ranges below.
 *
 * The check runs on the resolved address at connect time (a custom `lookup`),
 * so a hostname that resolves somewhere private is refused, a DNS answer
 * cannot change between the check and the connect, and every redirect hop is
 * checked again. IP literals skip DNS and are checked before connecting.
 *
 * Local development opt-out: MOJULO_ALLOW_PRIVATE_URLS=1.
 */

import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

export const ALLOW_PRIVATE_URLS_ENV = 'MOJULO_ALLOW_PRIVATE_URLS';

const BLOCKED_V4 = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
];

const BLOCKED_V6 = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
];

const BLOCKED = new net.BlockList();
for (const [address, prefix] of BLOCKED_V4) {
  // IPv4 rules also match IPv4-mapped IPv6 (::ffff:a.b.c.d). NAT64
  // (64:ff9b::/96) embeds a v4 address too, so block the same ranges there.
  BLOCKED.addSubnet(address, prefix, 'ipv4');
  BLOCKED.addSubnet(`64:ff9b::${address}`, 96 + prefix, 'ipv6');
}
for (const [address, prefix] of BLOCKED_V6) BLOCKED.addSubnet(address, prefix, 'ipv6');

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** True when `address` (an IP string) is on this machine or a private network. */
export function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return BLOCKED.check(address, 'ipv4');
  if (family === 6) return BLOCKED.check(address, 'ipv6');
  return true; // not an IP at all: never connect to it
}

export class BlockedUrlError extends Error {
  constructor(url, address) {
    super(
      `Refusing to fetch ${url}: it resolves to ${address}, an address on this machine or a private ` +
        `network. Set ${ALLOW_PRIVATE_URLS_ENV}=1 on the mojulo process to allow private addresses ` +
        '(local development only).',
    );
    this.name = 'BlockedUrlError';
    this.code = 'BLOCKED_ADDRESS';
  }
}

function guardedLookup(url, blocked) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      let bad;
      try {
        bad = addresses.find((a) => blocked(a.address));
      } catch (checkErr) {
        return callback(checkErr); // never throw out of a DNS callback
      }
      if (bad) return callback(new BlockedUrlError(url, bad.address));
      if (options.all) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function requestOnce(url, { blocked, headers, signal }) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      headers: { 'user-agent': 'mojulo', ...headers },
      lookup: guardedLookup(url.href, blocked),
      agent: false,
      signal,
    });
    req.on('response', resolve);
    req.on('error', reject);
    req.end();
  });
}

function readBody(res, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(res.headers['content-length']);
    if (maxBytes && Number.isFinite(declared) && declared > maxBytes) {
      res.destroy();
      reject(new Error(`Document too large: ${declared} bytes (max ${maxBytes})`));
      return;
    }
    const chunks = [];
    let total = 0;
    res.on('data', (chunk) => {
      total += chunk.length;
      if (maxBytes && total > maxBytes) {
        res.destroy();
        reject(new Error(`Document too large: more than ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
}

/**
 * GET `url`, following up to `maxRedirects` redirects, each hop checked.
 * @returns {Promise<{ ok: boolean, status: number, statusText: string, url: string,
 *   headers: Object, body: Buffer }>} `headers` is Node's lowercase header object.
 * @throws {BlockedUrlError} when any hop resolves to a blocked address.
 */
export async function fetchPublicUrl(
  url,
  { maxBytes, timeoutMs = 30000, maxRedirects = 5, headers = {}, isBlocked = isBlockedAddress } = {},
) {
  const blocked = process.env[ALLOW_PRIVATE_URLS_ENV] === '1' ? () => false : isBlocked;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(url);

  for (let hop = 0; ; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new Error(`url must be http(s):// (got ${current.protocol})`);
    }
    // net.connect skips `lookup` for IP literals, so check those here.
    const literal = current.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(literal) && blocked(literal)) {
      throw new BlockedUrlError(current.href, literal);
    }

    const res = await requestOnce(current, { blocked, headers, signal });
    if (REDIRECT_STATUSES.has(res.statusCode) && res.headers.location) {
      res.resume();
      if (hop >= maxRedirects) throw new Error(`Too many redirects fetching ${url}`);
      current = new URL(res.headers.location, current);
      continue;
    }

    const body = await readBody(res, maxBytes);
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      statusText: res.statusMessage || '',
      url: current.href,
      headers: res.headers,
      body,
    };
  }
}
