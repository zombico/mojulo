import { getDb } from '../index.js';

function shortRef() {
  // Short collision-resistant slug: 10 chars of base36 from crypto entropy.
  // ~52 bits — plenty for a single-user control plane that mints maybe
  // dozens of sketches a session. Prefix `sk_` so the agent can recognize
  // a sketch ref at a glance.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return `sk_${n.toString(36).padStart(10, '0').slice(-10)}`;
}

function rowToSketch(row) {
  if (!row) return null;
  let manifest;
  try {
    manifest = JSON.parse(row.manifest_json);
  } catch {
    manifest = null;
  }
  return {
    ref: row.ref,
    title: row.title,
    manifest,
    createdAt: row.created_at,
  };
}

export const SketchRepository = {
  create({ title, manifest, ref }) {
    const db = getDb();
    const finalRef = ref || shortRef();
    db.prepare(
      `INSERT INTO sketches (ref, title, manifest_json, created_at)
       VALUES (?, ?, ?, unixepoch())`,
    ).run(finalRef, title, JSON.stringify(manifest));
    return this.getByRef(finalRef);
  },

  getByRef(ref) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sketches WHERE ref = ?').get(ref);
    return rowToSketch(row);
  },

  // Returns recent sketches first, capped at `limit`. Used by the index
  // page; client-side filters the result by title/ref substring so we
  // don't fight pagination at this density. Bump the cap (or add q/server
  // pagination) when the agent's actually minting hundreds.
  list({ limit = 200 } = {}) {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM sketches ORDER BY created_at DESC LIMIT ?')
      .all(limit);
    return rows.map(rowToSketch);
  },
};
