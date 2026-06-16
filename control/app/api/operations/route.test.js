process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db/index';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';
import { GET as listGet, POST as createPost } from './route';
import { GET as detailGet, PATCH as detailPatch } from './[ref]/route';

function reset() {
  const db = getDb();
  db.exec('DELETE FROM ops_tag_members; DELETE FROM ops_tags;');
}

function makeRequest({ url = 'http://localhost/api/operations', method = 'GET', body } = {}) {
  return new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/operations route handlers', () => {
  beforeEach(() => reset());

  describe('GET /api/operations', () => {
    it('returns empty list', async () => {
      const res = await listGet(makeRequest());
      const body = await res.json();
      expect(body.tags).toEqual([]);
    });

    it('returns tags with member counts and totals', async () => {
      const tag = OpsTagRepository.forge({ title: 'Mktg', descriptorMd: 'd' });
      OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'bot', memberRef: 'd1' });
      OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'cook', memberRef: 'c1' });

      const res = await listGet(makeRequest());
      const body = await res.json();
      expect(body.tags).toHaveLength(1);
      expect(body.tags[0].memberTotal).toBe(2);
      expect(body.tags[0].memberCounts).toEqual({ bot: 1, cook: 1 });
    });

    it('filters by status query param', async () => {
      const active = OpsTagRepository.forge({ title: 'A', descriptorMd: 'a' });
      const archived = OpsTagRepository.forge({ title: 'B', descriptorMd: 'b' });
      OpsTagRepository.revise(archived.tagRef, { status: 'archived' });

      const archivedRes = await listGet(
        makeRequest({ url: 'http://localhost/api/operations?status=archived' }),
      );
      const archivedBody = await archivedRes.json();
      expect(archivedBody.tags).toHaveLength(1);
      expect(archivedBody.tags[0].tagRef).toBe(archived.tagRef);

      const activeRes = await listGet(
        makeRequest({ url: 'http://localhost/api/operations?status=active' }),
      );
      const activeBody = await activeRes.json();
      expect(activeBody.tags).toHaveLength(1);
      expect(activeBody.tags[0].tagRef).toBe(active.tagRef);
    });
  });

  describe('POST /api/operations', () => {
    it('creates a tag and returns 201 with descriptor', async () => {
      const res = await createPost(
        makeRequest({
          method: 'POST',
          body: { title: 'Marketing', descriptor: 'Lead nurture, brand voice X.' },
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.tagRef).toMatch(/^ops_[0-9a-f]{12}$/);
      expect(body.title).toBe('Marketing');
      expect(body.descriptorMd).toBe('Lead nurture, brand voice X.');
      expect(body.status).toBe('active');
    });

    it('rejects missing title with 400', async () => {
      const res = await createPost(
        makeRequest({ method: 'POST', body: { descriptor: 'desc' } }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/title is required/);
    });

    it('rejects missing descriptor with 400', async () => {
      const res = await createPost(
        makeRequest({ method: 'POST', body: { title: 'x' } }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/descriptor is required/);
    });

    it('rejects whitespace-only fields', async () => {
      const res = await createPost(
        makeRequest({ method: 'POST', body: { title: '   ', descriptor: 'd' } }),
      );
      expect(res.status).toBe(400);
    });

    it('rejects non-JSON body with 400', async () => {
      const req = new Request('http://localhost/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });
      const res = await createPost(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/operations/[ref]', () => {
    it('404s on unknown ref', async () => {
      const res = await detailGet(makeRequest(), {
        params: Promise.resolve({ ref: 'ops_nonexistent00' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns full descriptor + members', async () => {
      const tag = OpsTagRepository.forge({ title: 'Mktg', descriptorMd: 'm' });
      OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'bot', memberRef: 'd1' });

      const res = await detailGet(makeRequest(), {
        params: Promise.resolve({ ref: tag.tagRef }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tagRef).toBe(tag.tagRef);
      expect(body.descriptorMd).toBe('m');
      expect(body.members).toHaveLength(1);
      expect(body.members[0].memberKind).toBe('bot');
    });
  });

  describe('PATCH /api/operations/[ref]', () => {
    it('patches descriptor (the rubric-sharpening move)', async () => {
      const tag = OpsTagRepository.forge({ title: 'x', descriptorMd: 'vague' });
      const res = await detailPatch(
        makeRequest({ method: 'PATCH', body: { descriptor: 'sharper' } }),
        { params: Promise.resolve({ ref: tag.tagRef }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.descriptorMd).toBe('sharper');
    });

    it('toggles status to archived', async () => {
      const tag = OpsTagRepository.forge({ title: 'x', descriptorMd: 'd' });
      const res = await detailPatch(
        makeRequest({ method: 'PATCH', body: { status: 'archived' } }),
        { params: Promise.resolve({ ref: tag.tagRef }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('archived');
    });

    it('rejects an unknown status', async () => {
      const tag = OpsTagRepository.forge({ title: 'x', descriptorMd: 'd' });
      const res = await detailPatch(
        makeRequest({ method: 'PATCH', body: { status: 'frozen' } }),
        { params: Promise.resolve({ ref: tag.tagRef }) },
      );
      expect(res.status).toBe(400);
    });

    it('rejects empty patch body with 400', async () => {
      const tag = OpsTagRepository.forge({ title: 'x', descriptorMd: 'd' });
      const res = await detailPatch(
        makeRequest({ method: 'PATCH', body: {} }),
        { params: Promise.resolve({ ref: tag.tagRef }) },
      );
      expect(res.status).toBe(400);
    });

    it('404s on unknown ref', async () => {
      const res = await detailPatch(
        makeRequest({ method: 'PATCH', body: { title: 'x' } }),
        { params: Promise.resolve({ ref: 'ops_nonexistent00' }) },
      );
      expect(res.status).toBe(404);
    });

    it('refuses whitespace-only descriptor', async () => {
      const tag = OpsTagRepository.forge({ title: 'x', descriptorMd: 'd' });
      const res = await detailPatch(
        makeRequest({ method: 'PATCH', body: { descriptor: '   ' } }),
        { params: Promise.resolve({ ref: tag.tagRef }) },
      );
      expect(res.status).toBe(400);
    });
  });
});
