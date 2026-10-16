/**
 * GET /outcomes/<ref>/…: a file is served as itself; a folder with an index.html of its own is that page; a folder
 * without one is drawn as what is in it, so every link to a folder opens.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';

const ROOT = mkdtempSync(path.join(os.tmpdir(), 'outcomes-route-'));
process.env.MOJULO_OUTCOMES_DIR = ROOT;

import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route.js';

const get = (...slug) => GET(new NextRequest(`http://localhost/outcomes/${slug.join('/')}`), { params: Promise.resolve({ slug }) });

beforeAll(async () => {
  await fs.mkdir(path.join(ROOT, 'sk_house', 'sheets'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'sk_house', 'model.ifc'), 'ISO-10303-21;');
  await fs.writeFile(path.join(ROOT, 'sk_house', 'sheets', 'A-101.svg'), '<svg/>');
  await fs.mkdir(path.join(ROOT, 'cook_x'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'cook_x', 'index.html'), '<p>cook</p>');
});

describe('GET /outcomes', () => {
  it('a folder with its own index.html is that page', async () => {
    expect(await (await get('cook_x')).text()).toBe('<p>cook</p>');
  });

  it('a folder without one is drawn as its folders and files, each a link', async () => {
    const top = await get('sk_house');
    expect(top.status).toBe(200);
    expect(top.headers.get('content-type')).toMatch(/text\/html/);
    const html = await top.text();
    expect(html).toContain('href="/outcomes/sk_house/sheets/"');
    expect(html).toContain('href="/outcomes/sk_house/model.ifc" download');
    const sub = await (await get('sk_house', 'sheets')).text();
    expect(sub).toContain('href="/outcomes/sk_house/sheets/A-101.svg" download');
    expect(sub).toContain('<a href="/outcomes/sk_house/">sk_house</a>');
  });

  it('a file is served as itself, with its type; a missing one is not found', async () => {
    const res = await get('sk_house', 'sheets', 'A-101.svg');
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(await res.text()).toBe('<svg/>');
    expect((await get('sk_house', 'nope.svg')).status).toBe(404);
    expect((await get('sk_none')).status).toBe(404);
  });
});
