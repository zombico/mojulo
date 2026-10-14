'use client';

/**
 * /stashes/[ref] — stash detail page (view-only).
 *
 * The drawer rail filters items by drawer; each item card renders its body.
 * Every structural or content edit (rename, status, drawers, gather, move,
 * archive, item edits) goes through the agent over MCP.
 *
 * Renderers shipped: text / markdown / image / svg / link / sketch. Script and
 * pointer fall to small placeholder cards. See
 * lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import WorkshopShell from '@/components/WorkshopShell';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'isomorphic-dompurify';

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

const STATUS_STYLES = {
  open: 'border-teal-500 text-teal-300 bg-teal-900/30',
  archived: 'border-gray-600 text-gray-400 bg-gray-700/40',
};

const ROOT_KEY = '__root__';

export default function StashDetailBody({ stashRef, authEnabled = false }) {
  const tShell = useTranslations('stashes');
  return (
    <WorkshopShell posture="pinned" width={1400} authEnabled={authEnabled} crumb={tShell('title')}>
      <StashDetail stashRef={stashRef} />
    </WorkshopShell>
  );
}

function StashDetail({ stashRef }) {
  const ref = stashRef;
  const t = useTranslations('stashes');
  const tDetail = useTranslations('stashes.detail');
  const tTypes = useTranslations('stashes.detail.itemTypes');

  const [stash, setStash] = useState(null);
  const [drawers, setDrawers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState(ROOT_KEY);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(ref)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStash(data.stash || null);
      setDrawers(Array.isArray(data.drawers) ? data.drawers : []);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  const itemsByDrawer = useMemo(() => {
    const map = new Map();
    map.set(ROOT_KEY, []);
    for (const d of drawers) map.set(d.name, []);
    for (const it of items) {
      const key = it.drawer || ROOT_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return map;
  }, [drawers, items]);

  // If the selected drawer was renamed, follow it. If it was removed (not yet
  // possible — we don't support drawer delete here), fall back to root.
  useEffect(() => {
    if (selectedDrawer === ROOT_KEY) return;
    if (!drawers.some((d) => d.name === selectedDrawer)) {
      setSelectedDrawer(ROOT_KEY);
    }
  }, [drawers, selectedDrawer]);

  const visibleItems = itemsByDrawer.get(selectedDrawer) || [];

  if (notFound) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-8 pt-6 pb-4 max-w-3xl mx-auto">
          <Link href="/stashes" className="text-xs text-teal-400 hover:text-teal-300">
            ← {tDetail('back')}
          </Link>
          <div className="mt-6 border border-gray-700 rounded-lg p-8 bg-gray-800 text-center">
            <h1 className="text-lg font-semibold text-gray-100">{tDetail('notFoundTitle')}</h1>
            <p className="text-sm text-gray-400 mt-2">{tDetail('notFoundBody')}</p>
            <p className="font-mono text-[11px] text-gray-600 mt-3">{ref}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-8 pt-6 pb-12 max-w-6xl mx-auto">
        <Link href="/stashes" className="text-xs text-teal-400 hover:text-teal-300">
          ← {tDetail('back')}
        </Link>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {loading && !stash ? (
          <div className="mt-8 text-center text-gray-500 text-sm">{tDetail('loading')}</div>
        ) : stash ? (
          <>
            <Header
              stash={stash}
              drawerCount={drawers.length}
              itemCount={items.length}
              t={t}
            />

            <div className="mt-6 grid gap-6 grid-cols-[240px_minmax(0,1fr)]">
              <DrawerRail
                drawers={drawers}
                itemsByDrawer={itemsByDrawer}
                selected={selectedDrawer}
                onSelect={setSelectedDrawer}
                tDetail={tDetail}
              />
              <div className="min-w-0 space-y-4">
                <ItemList
                  items={visibleItems}
                  stashRef={ref}
                  tDetail={tDetail}
                  tTypes={tTypes}
                  isEmpty={items.length === 0}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Header({ stash, drawerCount, itemCount, t }) {
  return (
    <div className="mt-4 border border-gray-700 rounded-lg p-6 bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-100 truncate">{stash.title}</h1>
          <p className="font-mono text-xs text-gray-500 mt-1">{stash.stashRef}</p>
        </div>
        <span
          className={`text-xs uppercase tracking-wide px-2 py-1 rounded border shrink-0 ${
            STATUS_STYLES[stash.status] || STATUS_STYLES.open
          }`}
        >
          {stash.status === 'archived' ? t('statusArchived') : t('statusOpen')}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
        <span>{t('itemCount', { count: itemCount })}</span>
        <span>{t('drawerCount', { count: drawerCount })}</span>
        <span>{t('createdAt', { timestamp: formatTimestamp(stash.createdAt) })}</span>
        <span>{t('updatedAt', { timestamp: formatTimestamp(stash.updatedAt) })}</span>
      </div>
    </div>
  );
}

function DrawerRail({ drawers, itemsByDrawer, selected, onSelect, tDetail }) {
  const rows = [
    { key: ROOT_KEY, label: tDetail('rootDrawer') },
    ...drawers.map((d) => ({ key: d.name, label: d.name })),
  ];

  return (
    <aside className="border border-gray-700 rounded-lg bg-gray-800/60 p-2 self-start">
      <ul className="space-y-1">
        {rows.map((row) => {
          const count = (itemsByDrawer.get(row.key) || []).length;
          const isActive = selected === row.key;

          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onSelect(row.key)}
                className={`w-full text-left px-3 py-2 rounded-md transition flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-teal-900/30 border border-teal-500 text-teal-200'
                    : 'border border-transparent text-gray-300 hover:bg-gray-700 hover:text-gray-100'
                }`}
              >
                <span className="text-sm truncate">{row.label}</span>
                <span className="text-[11px] text-gray-500 shrink-0">
                  {tDetail('drawerItemCount', { count })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function ItemList({ items, stashRef, tDetail, tTypes, isEmpty }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
        {isEmpty ? tDetail('noItemsInStash') : tDetail('noItemsInDrawer')}
      </div>
    );
  }
  return (
    <div className="space-y-4 min-w-0">
      {items.map((it) => (
        <ItemCard
          key={it.id}
          item={it}
          stashRef={stashRef}
          tDetail={tDetail}
          tTypes={tTypes}
        />
      ))}
    </div>
  );
}

function ItemCard({ item, stashRef, tDetail, tTypes }) {
  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-700 bg-gray-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-600 text-gray-300">
            {tTypes(item.type)}
          </span>
          {item.title && (
            <span className="text-sm font-medium text-gray-200 truncate">{item.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-500 font-mono">#{item.id}</span>
        </div>
      </div>
      <div className="p-4 min-w-0">
        <ItemBody item={item} stashRef={stashRef} tDetail={tDetail} />
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-xs text-teal-400 hover:text-teal-300 truncate max-w-full"
          >
            {tDetail('openSource')}: {item.sourceUrl} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function ItemBody({ item, stashRef, tDetail }) {
  switch (item.type) {
    case 'text':
      return <TextBody body={item.body} />;
    case 'markdown':
      return <MarkdownBody body={item.bodyMd} />;
    case 'image':
      return <ImageBody item={item} stashRef={stashRef} tDetail={tDetail} />;
    case 'svg':
      return <SvgBody body={item.body} tDetail={tDetail} />;
    case 'link':
      return <LinkBody item={item} tDetail={tDetail} />;
    case 'sketch':
      return <SketchBody item={item} tDetail={tDetail} />;
    case 'script':
      return <ScriptStub item={item} tDetail={tDetail} />;
    case 'pointer':
      return <PointerStub item={item} tDetail={tDetail} />;
    default:
      return <p className="text-xs text-gray-500">{tDetail('deferredRenderer')}</p>;
  }
}

function TextBody({ body }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-200 leading-relaxed">
      {body || ''}
    </pre>
  );
}

function MarkdownBody({ body }) {
  return (
    <div className="markdown-body text-sm text-gray-200 leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-gray-100" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-gray-100 mt-3" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-gray-100 mt-2" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-teal-400 hover:text-teal-300 underline" target="_blank" rel="noreferrer" {...props} />
          ),
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code className="font-mono text-[12px] bg-gray-900/80 border border-gray-700 px-1 py-0.5 rounded text-teal-300" {...props} />
            ) : (
              <code className="font-mono text-[12px]" {...props} />
            ),
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-900/80 border border-gray-700 rounded p-3 overflow-x-auto text-[12px]" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-teal-700 pl-3 text-gray-300 italic" {...props} />
          ),
          table: ({ node, ...props }) => (
            <table className="border-collapse text-[12px] my-2" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-700 px-2 py-1 text-left bg-gray-800/80" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-700 px-2 py-1 align-top" {...props} />
          ),
        }}
      >
        {body || ''}
      </ReactMarkdown>
    </div>
  );
}

function ImageBody({ item, stashRef, tDetail }) {
  const [failed, setFailed] = useState(false);
  const meta = item.metadata || {};
  if (failed) {
    return (
      <div className="text-xs text-gray-500">
        <p>{tDetail('imageFailed')}</p>
        <p className="font-mono mt-1">{item.mediaRef}</p>
      </div>
    );
  }
  return (
    <figure className="space-y-2">
      <img
        src={`/api/stashes/${encodeURIComponent(stashRef)}/media/${item.id}`}
        alt={item.title || meta.alt || tDetail('imageAlt')}
        onError={() => setFailed(true)}
        className="max-w-full h-auto rounded border border-gray-700 bg-gray-900"
      />
      {(meta.width || meta.height || meta.mime) && (
        <figcaption className="text-[11px] text-gray-500 font-mono">
          {tDetail('imageMetaLine', {
            width: meta.width || '?',
            height: meta.height || '?',
            mime: meta.mime || 'image/?',
          })}
        </figcaption>
      )}
    </figure>
  );
}

function SvgBody({ body, tDetail }) {
  const sanitized = useMemo(() => {
    if (!body) return '';
    return DOMPurify.sanitize(body, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  }, [body]);
  return (
    <div
      role="img"
      aria-label={tDetail('svgPreview')}
      className="max-w-full overflow-x-auto bg-gray-900 border border-gray-700 rounded p-2"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function LinkBody({ item, tDetail }) {
  const meta = item.metadata || {};
  return (
    <div className="space-y-1">
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-teal-400 hover:text-teal-300 font-medium break-all"
      >
        {tDetail('linkOpen')} ↗
      </a>
      {meta.description && (
        <p className="text-xs text-gray-400">{meta.description}</p>
      )}
    </div>
  );
}

function SketchBody({ item, tDetail }) {
  const [failed, setFailed] = useState(false);
  const meta = item.metadata || {};
  const sketchRef = meta.sketch_ref;
  if (!sketchRef) {
    return <p className="text-xs text-gray-500">{tDetail('sketchFailed')}</p>;
  }
  // The sketches API renders a self-contained SVG with CSS variables already
  // inlined — fine as an <img src>. Resolution is live: edits to the source
  // sketch propagate immediately (no snapshot, citable-atoms posture). A
  // deleted source surfaces as the failed-load fallback below.
  return (
    <figure className="space-y-2">
      {failed ? (
        <div className="text-xs text-gray-500">
          <p>{tDetail('sketchFailed')}</p>
          <p className="font-mono mt-1">{sketchRef}</p>
        </div>
      ) : (
        <img
          src={`/api/sketches/${encodeURIComponent(sketchRef)}/svg?inline=1`}
          alt={meta.label || sketchRef}
          onError={() => setFailed(true)}
          className="max-w-full h-auto rounded border border-gray-700 bg-gray-900"
        />
      )}
      <figcaption className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
        <a
          href={`/sketches/${encodeURIComponent(sketchRef)}`}
          target="_blank"
          rel="noreferrer"
          className="text-teal-400 hover:text-teal-300"
        >
          {tDetail('openSketch')} ↗
        </a>
        <span>{sketchRef}</span>
        {meta.label && <span className="font-sans text-gray-400">· {meta.label}</span>}
      </figcaption>
    </figure>
  );
}

function ScriptStub({ item, tDetail }) {
  const meta = item.metadata || {};
  const bytes = (item.body || '').length;
  return (
    <div className="text-xs text-gray-400 space-y-1">
      <p className="text-gray-300">{tDetail('stubScriptTitle')}</p>
      <p>{tDetail('stubScriptHint', { language: meta.language || '?', bytes })}</p>
      <p className="text-gray-500">{tDetail('deferredRenderer')}</p>
    </div>
  );
}

function PointerStub({ item, tDetail }) {
  const meta = item.metadata || {};
  return (
    <div className="text-xs text-gray-400 space-y-1">
      <p className="text-gray-300">
        {tDetail('stubPointerTitle')}
        {meta.label ? <span className="ml-2 text-gray-200">{meta.label}</span> : null}
      </p>
      <p className="font-mono">
        {tDetail('stubPointerHint', { nodeRef: meta.node_ref || '?' })}
      </p>
      <p className="text-gray-500">{tDetail('deferredRenderer')}</p>
    </div>
  );
}
