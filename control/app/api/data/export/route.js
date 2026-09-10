import { runScopedSql } from '@/lib/fleet/scoped-sql';

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { sql, format } = body || {};
  const result = await runScopedSql(sql);
  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const ts = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    return new Response(JSON.stringify({ rows: result.rows, columns: result.columns }, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="fleet-query-${ts}.json"`,
      },
    });
  }

  // CSV (default)
  const lines = [result.columns.map(escapeCsv).join(',')];
  for (const row of result.rows) {
    lines.push(result.columns.map((c) => escapeCsv(row[c])).join(','));
  }
  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="fleet-query-${ts}.csv"`,
    },
  });
}
