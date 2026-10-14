'use client';

/**
 * The repertoire: what a world can be built from, as the sheets mojulo draws from its own tables (the index of forms,
 * the land, the flora, the blocks, the structures, a fortified town, a castle, technology), in a kit. Choosing the kit
 * is the page's own view state; each sheet opens in a tab of its own. A sheet that does not draw in the chosen kit is
 * shown, dimmed, so what each kit can show is visible at a glance. Every word is the data's own.
 */

import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function Repertoire() {
  const { data } = useSWR('/api/sheets', fetcher, { revalidateOnFocus: false });
  const [kit, setKit] = useState('isekai-meadow');
  if (!data?.sheets?.length) return null;
  return (
    <section className="mb-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] p-3">
      <select
        value={kit}
        onChange={(e) => setKit(e.target.value)}
        aria-label="kit"
        className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] bg-[color:var(--bay-bench)] px-2 py-1 font-mono text-[11px] text-[color:var(--ink-primary)]"
      >
        {data.kits.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      {data.sheets.map((s) => {
        const draws = !s.kits.length || s.kits.includes(kit);
        const href = `/api/sheets/${encodeURIComponent(s.id)}${s.kits.length ? `?kit=${encodeURIComponent(kit)}` : ''}`;
        return draws ? (
          <a
            key={s.id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="rounded-[var(--radius-control)] border border-[color:var(--live-idle)] px-2 py-1 font-mono text-[11px] text-[color:var(--live)] hover:border-[color:var(--live)]"
          >
            {s.name}
          </a>
        ) : (
          <span key={s.id} title={s.kits.join(', ')} className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] px-2 py-1 font-mono text-[11px] text-[color:var(--ink-muted)] opacity-50">
            {s.name}
          </span>
        );
      })}
    </section>
  );
}
