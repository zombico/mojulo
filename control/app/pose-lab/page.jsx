'use client';

/**
 * /pose-lab — the interactive melee pose harness. Live sliders for every posing
 * channel (arm, the new WRIST, torso, legs) drive compileUnitPose through
 * /api/pose-lab and render the posed suit in an orbitable /world iframe. Drag to
 * dial a melee end pose; copy the dof JSON straight into a swing clip. Built to
 * end the "guess → render → correct" loop on precise 3D poses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Slider spec: [group, path, min, max, step, default]. `path` is dotted into the dof.
const CH = [
  ['Right arm', 'shR.pitch', -30, 180, 1, 92],
  ['Right arm', 'shR.yaw', -90, 90, 1, 34],
  ['Right arm', 'shR.roll', -110, 110, 1, 90],
  ['Right arm', 'elbowR', 0, 150, 1, 12],
  ['Right WRIST', 'wristR.pitch', -70, 70, 1, 70],
  ['Right WRIST', 'wristR.yaw', -70, 70, 1, -50],
  ['Left arm', 'shL.pitch', -90, 180, 1, -34],
  ['Left arm', 'shL.yaw', -90, 90, 1, 8],
  ['Left arm', 'elbowL', 0, 150, 1, 34],
  ['Torso', 'shoulders', -80, 80, 1, 30],   // suit waist swivel (SUIT_WAIST_SWIVEL): far past human scapular range
  ['Torso', 'pelvis', -20, 20, 1, 20],
  ['Torso', 'spine.sagittal', -1, 1, 0.02, 0.16],
  ['Torso', 'spine.lateral', -1, 1, 0.02, -0.2],
  ['Torso', 'spine.axial', -1, 1, 0.02, 1],
  ['Torso', 'hinge', 0, 80, 1, 10],
  ['Legs', 'hipR.pitch', -62, 62, 1, 44],
  ['Legs', 'hipL.pitch', -62, 62, 1, -10],
  ['Legs', 'kneeR', 0, 150, 1, 58],
  ['Legs', 'kneeL', 0, 150, 1, 34],
  ['Head', 'neck.pitch', -45, 45, 1, 8],
];
const FIXED = { 'hipR.yaw': -7, 'hipL.yaw': 7 };   // stance width, not exposed

// Optional deep-link seed: `?base=<ref>&pose=<url-encoded flat {channelPath: value}>`
// lets a handoff open the lab pre-loaded on an in-progress pose (only the channels
// present override; the rest keep their defaults). No params → default behaviour.
function readPoseSeed() {
  if (typeof window === 'undefined') return {};
  try {
    const p = new URLSearchParams(window.location.search);
    const raw = p.get('pose');
    return { base: p.get('base') || null, vals: raw ? JSON.parse(raw) : null };
  } catch { return {}; }
}

function setPath(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i += 1) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
  o[parts[parts.length - 1]] = val;
}

export default function PoseLab() {
  const [baseRef, setBaseRef] = useState('sk_80str_v78_skirt_biped_saber_studio');
  const [vals, setVals] = useState(() => Object.fromEntries(CH.map(([, p, , , , d]) => [p, d])));
  const [iframeRef, setIframeRef] = useState(null);
  const [status, setStatus] = useState('idle');
  const [err, setErr] = useState(null);
  const timer = useRef(null);

  // seed from the deep-link once on mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    const seed = readPoseSeed();
    if (seed.base) setBaseRef(seed.base);
    if (seed.vals) setVals((v) => ({ ...v, ...seed.vals }));
  }, []);

  const dof = useMemo(() => {
    const d = {};
    for (const [k, v] of Object.entries({ ...vals, ...FIXED })) setPath(d, k, v);
    return d;
  }, [vals]);

  const apply = useCallback(async () => {
    setStatus('posing'); setErr(null);
    try {
      const res = await fetch('/api/pose-lab', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRef, dof }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || 'error'); setStatus('error'); return; }
      setIframeRef(`/api/sketches/${encodeURIComponent(j.ref)}/world?t=${Date.now()}`);
      setStatus('ok');
    } catch (e) { setErr(String(e?.message || e)); setStatus('error'); }
  }, [baseRef, dof]);

  // debounced live apply on any change
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(apply, 450);
    return () => clearTimeout(timer.current);
  }, [apply]);

  const groups = useMemo(() => {
    const g = {};
    for (const c of CH) { (g[c[0]] = g[c[0]] || []).push(c); }
    return g;
  }, []);

  const dofJson = JSON.stringify(dof, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v), 2);

  return (
    <div style={S.wrap}>
      <div style={S.controls}>
        <div style={S.head}>
          <h1 style={S.h1}>Pose Lab</h1>
          <span style={{ ...S.badge, background: status === 'ok' ? '#1f6f43' : status === 'error' ? '#7a2530' : '#2a2f34' }}>
            {status === 'posing' ? 'posing…' : status === 'error' ? 'error' : 'live'}
          </span>
        </div>
        <label style={S.baseRow}>
          <span style={S.dim}>base unit</span>
          <input value={baseRef} onChange={(e) => setBaseRef(e.target.value)} style={S.input} spellCheck={false} />
        </label>
        {err && <div style={S.err}>{err}</div>}

        {Object.entries(groups).map(([name, chs]) => (
          <fieldset key={name} style={S.group}>
            <legend style={S.legend}>{name}</legend>
            {chs.map(([, path, min, max, step]) => (
              <div key={path} style={S.row}>
                <span style={S.label}>{path}</span>
                <input type="range" min={min} max={max} step={step} value={vals[path]}
                  onChange={(e) => setVals((v) => ({ ...v, [path]: parseFloat(e.target.value) }))}
                  style={S.range} />
                <input type="number" min={min} max={max} step={step} value={vals[path]}
                  onChange={(e) => setVals((v) => ({ ...v, [path]: parseFloat(e.target.value) }))}
                  style={S.num} />
              </div>
            ))}
          </fieldset>
        ))}

        <div style={S.jsonWrap}>
          <div style={S.jsonHead}>
            <span style={S.dim}>dof — paste into a swing clip</span>
            <button style={S.btn} onClick={() => navigator.clipboard?.writeText(dofJson)}>copy</button>
          </div>
          <textarea readOnly value={dofJson} style={S.json} />
        </div>
      </div>

      <div style={S.stage}>
        {iframeRef
          ? <iframe key={iframeRef} src={iframeRef} style={S.iframe} title="posed suit" />
          : <div style={S.placeholder}>drag a slider to pose…</div>}
      </div>
    </div>
  );
}

const mono = 'ui-monospace, Menlo, monospace';
const S = {
  wrap: { display: 'flex', height: '100vh', background: '#0e1014', color: '#d8d0c0', font: `13px/1.5 ${mono}` },
  controls: { width: 420, minWidth: 420, overflowY: 'auto', padding: '16px 16px 60px', borderRight: '1px solid #2a2f34' },
  head: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  h1: { font: `700 18px ${mono}`, margin: 0, color: '#ff4fd8' },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 4, color: '#fff' },
  baseRow: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  dim: { color: '#8b8578', fontSize: 11 },
  input: { background: '#181b1f', border: '1px solid #2a2f34', color: '#d8d0c0', padding: '6px 8px', borderRadius: 4, font: `12px ${mono}` },
  err: { background: '#3a1c22', border: '1px solid #7a2530', color: '#ffb3bd', padding: '8px 10px', borderRadius: 4, marginBottom: 10, fontSize: 12 },
  group: { border: '1px solid #2a2f34', borderRadius: 6, padding: '6px 10px 10px', margin: '0 0 12px' },
  legend: { color: '#35e7ef', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 4px' },
  row: { display: 'grid', gridTemplateColumns: '110px 1fr 56px', alignItems: 'center', gap: 8, margin: '5px 0' },
  label: { fontSize: 11, color: '#b8b0a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  range: { accentColor: '#ff4fd8', width: '100%' },
  num: { width: 56, background: '#181b1f', border: '1px solid #2a2f34', color: '#d8d0c0', padding: '3px 4px', borderRadius: 3, font: `11px ${mono}` },
  jsonWrap: { marginTop: 6 },
  jsonHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  btn: { background: '#ff4fd8', color: '#0e1014', border: 0, borderRadius: 4, padding: '4px 10px', font: `600 11px ${mono}`, cursor: 'pointer' },
  json: { width: '100%', height: 180, background: '#0b0d10', border: '1px solid #2a2f34', color: '#9fe6c8', font: `11px ${mono}`, padding: 8, borderRadius: 4, resize: 'vertical' },
  stage: { flex: 1, position: 'relative', background: '#0b0d10' },
  iframe: { width: '100%', height: '100%', border: 0 },
  placeholder: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b8578' },
};
