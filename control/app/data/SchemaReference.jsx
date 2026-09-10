'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function SchemaReference() {
  const t = useTranslations('data.schema');
  const [open, setOpen] = useState(false);
  const { data } = useSWR(open ? '/api/data/sql' : null, fetcher);
  const schema = data?.schema || [];

  return (
    <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--surface-primary)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 text-sm flex items-center justify-between"
      >
        <span className="font-medium">{t('availableTables')}</span>
        <span className="text-xs text-[color:var(--text-muted)]">
          {open ? t('clickToHide') : t('clickToShow')}
        </span>
      </button>
      {open && (
        <div className="border-t border-[color:var(--border-color)]/60 p-4 space-y-4">
          <p className="text-xs text-[color:var(--text-muted)]">
            <strong>{t('note')}</strong> {t('scopeNote')}
          </p>
          {schema.map((table) => (
            <div key={table.name}>
              <div className="font-mono text-sm text-[color:var(--brand-teal)]">
                {table.name}
              </div>
              <div className="text-xs text-[color:var(--text-muted)] mb-2">
                {table.description}
              </div>
              <table className="text-xs border-collapse w-full">
                <tbody>
                  {table.columns.map((c) => (
                    <tr
                      key={c.name}
                      className="border-t border-[color:var(--border-color)]/40"
                    >
                      <td className="font-mono py-1 pr-3 align-top whitespace-nowrap">
                        {c.name}
                      </td>
                      <td className="text-[color:var(--text-muted)] py-1">
                        {c.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
