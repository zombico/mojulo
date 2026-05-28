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

// Channel margin between a station's edge and the routing channel. Big
// enough that the arrow is visibly outside the station, small enough that
// short-hop detours don't sprawl.
const CHANNEL_GAP = 24;
// Edge clamp so the channel can never run off the canvas. Arrowhead is 6px
// wide, plus margin to keep the marker visible.
const VIEWBOX_CLAMP = 8;

function edgePath(from, to, via, viewBox, curvature = 1) {
  // `via: '<side>'` routes the edge as an L-shape past one side of both
  // stations, so a long edge between non-adjacent stations doesn't pierce
  // stations sitting in between. The geometry mirrors across sides: exit
  // the source's side, run along a channel just outside the lane, come
  // back into the target's same side.
  if (via === 'right') {
    const startX = from.x + from.w;
    const startY = from.y + from.h / 2;
    const endX = to.x + to.w;
    const endY = to.y + to.h / 2;
    const channelX = Math.min(Math.max(startX, endX) + CHANNEL_GAP, viewBox.width - VIEWBOX_CLAMP);
    return {
      d: `M ${startX} ${startY} L ${channelX} ${startY} L ${channelX} ${endY} L ${endX} ${endY}`,
      midX: channelX,
      midY: (startY + endY) / 2,
    };
  }
  if (via === 'left') {
    const startX = from.x;
    const startY = from.y + from.h / 2;
    const endX = to.x;
    const endY = to.y + to.h / 2;
    const channelX = Math.max(Math.min(startX, endX) - CHANNEL_GAP, VIEWBOX_CLAMP);
    return {
      d: `M ${startX} ${startY} L ${channelX} ${startY} L ${channelX} ${endY} L ${endX} ${endY}`,
      midX: channelX,
      midY: (startY + endY) / 2,
    };
  }
  if (via === 'top') {
    const startX = from.x + from.w / 2;
    const startY = from.y;
    const endX = to.x + to.w / 2;
    const endY = to.y;
    const channelY = Math.max(Math.min(startY, endY) - CHANNEL_GAP, VIEWBOX_CLAMP);
    return {
      d: `M ${startX} ${startY} L ${startX} ${channelY} L ${endX} ${channelY} L ${endX} ${endY}`,
      midX: (startX + endX) / 2,
      midY: channelY,
    };
  }
  if (via === 'bottom') {
    const startX = from.x + from.w / 2;
    const startY = from.y + from.h;
    const endX = to.x + to.w / 2;
    const endY = to.y + to.h;
    const channelY = Math.min(Math.max(startY, endY) + CHANNEL_GAP, viewBox.height - VIEWBOX_CLAMP);
    return {
      d: `M ${startX} ${startY} L ${startX} ${channelY} L ${endX} ${channelY} L ${endX} ${endY}`,
      midX: (startX + endX) / 2,
      midY: channelY,
    };
  }

  // Default S-curve cubic Bezier. The control-point offset scales with
  // `curvature` along the dominant axis — 1 keeps today's geometry, > 1
  // pulls the control points further apart for a swoopier arc, < 1
  // flattens toward a straight line.
  const { startX, startY, endX, endY } = edgeAnchor(from, to);
  const dx = endX - startX;
  const dy = endY - startY;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const k = Math.max(0.2, Math.min(curvature, 3));
  const cp1x = horizontal ? startX + dx * 0.5 * k : startX;
  const cp1y = horizontal ? startY : startY + dy * 0.5 * k;
  const cp2x = horizontal ? endX - dx * 0.5 * k : endX;
  const cp2y = horizontal ? endY : endY - dy * 0.5 * k;
  return {
    d: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
    midX: (startX + endX) / 2,
    midY: (startY + endY) / 2,
  };
}

// Approximate pixel width of an edge label. Used to size the background
// rect so longer technical labels (e.g. "in payload.app.bindings") don't
// overflow the default 116px box. Scales with the active font size — mono
// is fixed-pitch, sans is slightly tracked.
function estimateLabelWidth(text, technical, fontSize) {
  if (!text) return 0;
  const ratio = (technical ? 0.64 : 0.62) * fontSize;
  return Math.max(56, Math.ceil(text.length * ratio) + 18);
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

// Two type-scale presets. `default` keeps the historical sizing for the
// curated /graph and scratch /sketches surfaces. `compact` is the
// derived-graph mode: smaller fonts + tighter padding so a denser
// horizontal layout reads at a glance without each station feeling
// oversized for what it carries.
const TYPE_SCALES = {
  default: {
    labelSize: 13,
    sublabelSize: 10,
    itemSize: 11,
    edgeSize: 11,
    labelOffsetX: 12,
    labelOffsetY: 20,
    sublabelOffsetY: 36,
    itemFirstOffset: 42,
    itemFirstOffsetWithSublabel: 54,
    itemLineHeight: 15,
    pillHeight: 22,
    pillY: -11,
  },
  compact: {
    labelSize: 12,
    sublabelSize: 10,
    itemSize: 10,
    edgeSize: 10,
    labelOffsetX: 10,
    labelOffsetY: 18,
    sublabelOffsetY: 32,
    itemFirstOffset: 36,
    itemFirstOffsetWithSublabel: 46,
    itemLineHeight: 13,
    pillHeight: 20,
    pillY: -10,
  },
};

function layerRank(station) {
  // Ground (and unlayered) paint first; air paints last so it sits on top.
  return station.layer === 'air' ? 1 : 0;
}

export default function CreationMap({ manifest, technical = false, compact = false, onNodeClick }) {
  if (!manifest) return null;
  const { viewBox, stations, edges } = manifest;
  const stationById = new Map(stations.map((s) => [s.id, s]));
  const scale = compact ? TYPE_SCALES.compact : TYPE_SCALES.default;
  // Stable sort by layer so air stations paint over ground. When no station
  // carries `layer`, every rank is 0 and the original order is preserved —
  // keeps /graph and /sketches pixel-identical.
  const orderedStations = [...stations].sort((a, b) => layerRank(a) - layerRank(b));

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
        {/* Subtle elevation under the edge-label pills so they read as
            chips lifted off the canvas rather than as inline gaps. Kept
            small (stdDeviation=1.4) so it doesn't compete with station
            borders. */}
        <filter id="creation-map-label-shadow" x="-25%" y="-50%" width="150%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#000" floodOpacity="0.35" />
        </filter>
        {/* Elevation for `layer:'air'` stations in the two-plane fleet scene —
            a larger, softer shadow than the pill shadow so air tokens read as
            hovering above the flat ground band. Inert unless a station opts in
            via `layer:'air'`. */}
        <filter id="creation-map-elevation" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Edges drawn first so stations cover their entry points. */}
      {edges.map((e, i) => {
        const from = stationById.get(e.from);
        const to = stationById.get(e.to);
        if (!from || !to) return null;
        const { d, midX, midY } = edgePath(from, to, e.via, viewBox, e.curvature);
        const label = pickLabel(e, technical);
        const labelWidth = estimateLabelWidth(label, technical, scale.edgeSize);
        return (
          <g key={`edge-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.4"
              opacity="0.8"
              markerEnd="url(#creation-map-arrow)"
            />
            {label ? (
              <g transform={`translate(${midX} ${midY})`}>
                {/* Pill background — surface-elevated sits one step above
                    the diagram surface; drop shadow gives it lift; no
                    border so the chip reads as a single solid token. */}
                <rect
                  x={-labelWidth / 2}
                  y={scale.pillY}
                  width={labelWidth}
                  height={scale.pillHeight}
                  rx={scale.pillHeight / 2}
                  fill="var(--surface-elevated)"
                  filter="url(#creation-map-label-shadow)"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--text-primary)"
                  fontSize={scale.edgeSize}
                  fontWeight={technical ? 400 : 500}
                  letterSpacing={technical ? '0' : '0.3'}
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

      {orderedStations.map((s) => {
        const style = STATION_STYLES[s.kind] || STATION_STYLES.input;
        const label = pickLabel(s, technical);
        const sublabel = pickSublabel(s, technical);
        const items = pickItems(s, technical);
        const clickable = Boolean(s.href && onNodeClick);
        const groupProps = clickable
          ? {
              role: 'link',
              tabIndex: 0,
              style: { cursor: 'pointer' },
              onClick: () => onNodeClick(s),
              onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNodeClick(s);
                }
              },
            }
          : {};
        return (
          <g key={s.id} {...groupProps}>
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
              filter={s.layer === 'air' ? 'url(#creation-map-elevation)' : undefined}
            />
            <text
              x={s.x + scale.labelOffsetX}
              y={s.y + scale.labelOffsetY}
              fill={style.labelFill}
              fontSize={scale.labelSize}
              fontWeight="600"
              fontFamily="var(--font-geist-sans), sans-serif"
            >
              {label}
            </text>
            {sublabel ? (
              <text
                x={s.x + scale.labelOffsetX}
                y={s.y + scale.sublabelOffsetY}
                fill="var(--text-muted)"
                fontSize={scale.sublabelSize}
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
                x={s.x + scale.labelOffsetX}
                y={s.y + (sublabel ? scale.itemFirstOffsetWithSublabel : scale.itemFirstOffset) + idx * scale.itemLineHeight}
                fill="var(--text-secondary)"
                fontSize={scale.itemSize}
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
