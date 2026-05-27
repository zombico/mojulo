'use client';

/**
 * SVG renderer for the creation-map manifest. Hand-positioned stations —
 * positions live on each station object in lib/graph/creation-map.js, no
 * layout engine. Edges are drawn as orthogonal-ish paths between station
 * edges with arrowheads.
 *
 * Station styling varies by `kind`:
 *   input       — dashed border, neutral surface
 *   mcp_tool    — accent border (teal), bold label
 *   filesystem  — slate background
 *   db_row      — purple accent
 */

const STATION_STYLES = {
  input: {
    fill: 'rgba(255,255,255,0.02)',
    stroke: 'var(--border-color)',
    strokeDasharray: '4 3',
    labelFill: 'var(--text-secondary)',
  },
  mcp_tool: {
    fill: 'rgba(20,184,166,0.08)',
    stroke: 'var(--brand-teal)',
    strokeDasharray: null,
    labelFill: 'var(--brand-teal)',
  },
  filesystem: {
    fill: 'rgba(100,116,139,0.10)',
    stroke: 'rgba(148,163,184,0.6)',
    strokeDasharray: null,
    labelFill: 'var(--text-secondary)',
  },
  db_row: {
    fill: 'rgba(168,85,247,0.08)',
    stroke: 'rgba(168,85,247,0.7)',
    strokeDasharray: null,
    labelFill: 'rgb(216,180,254)',
  },
};

function stationCenter(s) {
  return { cx: s.x + s.w / 2, cy: s.y + s.h / 2 };
}

function edgeAnchor(from, to) {
  // Pick the right/left edge midpoint depending on horizontal direction;
  // pick top/bottom if the target is mostly above/below.
  const a = stationCenter(from);
  const b = stationCenter(to);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;

  let startX;
  let startY;
  let endX;
  let endY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // mostly horizontal
    if (dx >= 0) {
      startX = from.x + from.w;
      endX = to.x;
    } else {
      startX = from.x;
      endX = to.x + to.w;
    }
    startY = a.cy;
    endY = b.cy;
  } else {
    // mostly vertical
    if (dy >= 0) {
      startY = from.y + from.h;
      endY = to.y;
    } else {
      startY = from.y;
      endY = to.y + to.h;
    }
    startX = a.cx;
    endX = b.cx;
  }
  return { startX, startY, endX, endY };
}

function edgePath(from, to, via, viewBoxWidth) {
  // `via: 'right'` routes the edge as an L-shape past the right side of
  // both stations, so a long vertical edge between non-adjacent stations
  // in the same lane doesn't pierce stations in between. We exit the
  // source's right edge, run along a channel just right of the lane, then
  // come back into the target's right edge.
  if (via === 'right') {
    const startX = from.x + from.w;
    const startY = from.y + from.h / 2;
    const endX = to.x + to.w;
    const endY = to.y + to.h / 2;
    // Channel sits just outside both stations' right edges. Clamped to
    // viewBox width to keep arrowheads visible if the manifest leaves
    // little room.
    const channelX = Math.min(
      Math.max(startX, endX) + 24,
      viewBoxWidth - 8,
    );
    const d = `M ${startX} ${startY} L ${channelX} ${startY} L ${channelX} ${endY} L ${endX} ${endY}`;
    return {
      d,
      midX: channelX,
      midY: (startY + endY) / 2,
    };
  }

  const { startX, startY, endX, endY } = edgeAnchor(from, to);
  // S-curve via two cubic control points placed along the dominant axis.
  const dx = endX - startX;
  const dy = endY - startY;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const cp1x = horizontal ? startX + dx * 0.5 : startX;
  const cp1y = horizontal ? startY : startY + dy * 0.5;
  const cp2x = horizontal ? endX - dx * 0.5 : endX;
  const cp2y = horizontal ? endY : endY - dy * 0.5;
  return {
    d: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
    midX: (startX + endX) / 2,
    midY: (startY + endY) / 2,
  };
}

// Approximate pixel width of an edge label. Used to size the background
// rect so longer technical labels (e.g. "in payload.app.bindings") don't
// overflow the default 116px box.
function estimateLabelWidth(text, technical) {
  if (!text) return 0;
  const perChar = technical ? 6.5 : 6.2; // mono vs sans at 10px
  return Math.max(60, Math.ceil(text.length * perChar) + 14);
}

function pickLabel(item, technical) {
  if (technical) return item.label;
  return item.friendly?.label ?? item.label;
}

function pickSublabel(item, technical) {
  if (technical) return item.sublabel;
  return item.friendly?.sublabel ?? item.sublabel;
}

function pickItems(station, technical) {
  if (technical) return station.items || [];
  return station.friendly?.items ?? station.items ?? [];
}

export default function CreationMap({ manifest, technical = false }) {
  if (!manifest) return null;
  const { viewBox, stations, edges } = manifest;
  const stationById = new Map(stations.map((s) => [s.id, s]));

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      className="w-full h-auto"
      role="img"
      aria-label="App creation map"
    >
      <defs>
        <marker
          id="creation-map-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
        </marker>
      </defs>

      {/* Edges drawn first so stations cover their entry points. */}
      {edges.map((e, i) => {
        const from = stationById.get(e.from);
        const to = stationById.get(e.to);
        if (!from || !to) return null;
        const { d, midX, midY } = edgePath(from, to, e.via, viewBox.width);
        const label = pickLabel(e, technical);
        const labelWidth = estimateLabelWidth(label, technical);
        return (
          <g key={`edge-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.4"
              opacity="0.7"
              markerEnd="url(#creation-map-arrow)"
            />
            {label ? (
              <g transform={`translate(${midX} ${midY})`}>
                <rect
                  x={-labelWidth / 2}
                  y="-9"
                  width={labelWidth}
                  height="18"
                  rx="4"
                  fill="var(--surface-primary)"
                  stroke="var(--border-color)"
                  strokeOpacity="0.4"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily={
                    technical ? 'var(--font-geist-mono), monospace' : 'var(--font-geist-sans), sans-serif'
                  }
                >
                  {label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {stations.map((s) => {
        const style = STATION_STYLES[s.kind] || STATION_STYLES.input;
        const label = pickLabel(s, technical);
        const sublabel = pickSublabel(s, technical);
        const items = pickItems(s, technical);
        return (
          <g key={s.id}>
            <rect
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx="10"
              ry="10"
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth="1.4"
              strokeDasharray={style.strokeDasharray || undefined}
            />
            <text
              x={s.x + 12}
              y={s.y + 20}
              fill={style.labelFill}
              fontSize="13"
              fontWeight="600"
              fontFamily="var(--font-geist-sans), sans-serif"
            >
              {label}
            </text>
            {sublabel ? (
              <text
                x={s.x + 12}
                y={s.y + 36}
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily={
                  technical ? 'var(--font-geist-mono), monospace' : 'var(--font-geist-sans), sans-serif'
                }
              >
                {sublabel}
              </text>
            ) : null}
            {items.map((item, idx) => (
              <text
                key={`${s.id}-item-${idx}`}
                x={s.x + 12}
                y={s.y + (sublabel ? 54 : 42) + idx * 15}
                fill="var(--text-secondary)"
                fontSize="11"
                fontFamily={
                  technical ? 'var(--font-geist-mono), monospace' : 'var(--font-geist-sans), sans-serif'
                }
              >
                • {item}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
