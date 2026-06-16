/**
 * Heart-assembly geometry shared between the line-mode and mesh-mode
 * spike tests. Pure: returns lathe specs in heart-local + view-rotated
 * world coordinates. No rendering concerns live here.
 */

export const HEART_CLEFT_AMPLITUDE = -0.30;
export const HEART_AXIS_LENGTH = 2.0;
export const HEART_TILT = 0.5;
export const ATRIAL_AXIS_EXTRA = 0.7;
export const ATRIAL_CLEFT_AMPLITUDE = -0.18;

export const HEART_PROFILE = [
  { t: 0.00, radius: 0.75 },   // atrial-end seat
  { t: 0.10, radius: 0.95 },
  { t: 0.35, radius: 1.20 },   // ventricular mass — peak bulge
  { t: 0.55, radius: 1.15 },
  { t: 0.75, radius: 0.80 },
  { t: 0.92, radius: 0.30 },
  { t: 1.00, radius: 0.00 },   // apex pole
];

export const ATRIAL_PROFILE = [
  { t: 0.00, radius: 0.35 },   // narrow top — where great vessels seat
  { t: 0.30, radius: 0.55 },   // auricular bulge ("ears")
  { t: 1.00, radius: 0.75 },   // matches cardiac-sac top width
];

export const HEART_SAC_STYLE = { stroke: '#a23838', width: 0.5 };
export const HEART_ATRIAL_STYLE = { stroke: '#8a2a2a', width: 0.5 };
export const HEART_VESSEL_STYLE = { stroke: '#7a3a3a', width: 0.5 };
export const HEART_CROSS_SECTIONS = 22;
export const HEART_SAMPLES = 48;

function sacEndpoints() {
  return {
    top:  { x:  HEART_TILT, y: 0, z: HEART_AXIS_LENGTH },
    base: { x: -HEART_TILT, y: 0, z: 0 },
  };
}

function atrialEndpoints() {
  const { top, base } = sacEndpoints();
  const dx = top.x - base.x;
  const dy = top.y - base.y;
  const dz = top.z - base.z;
  const len = Math.hypot(dx, dy, dz);
  const ux = dx / len, uy = dy / len, uz = dz / len;
  return {
    top: {
      x: top.x + ux * ATRIAL_AXIS_EXTRA,
      y: top.y + uy * ATRIAL_AXIS_EXTRA,
      z: top.z + uz * ATRIAL_AXIS_EXTRA,
    },
    base: top,
  };
}

function vesselStubs() {
  const { top: atrialTop } = atrialEndpoints();
  return [
    {
      from: { x: atrialTop.x + 0.05, y: atrialTop.y - 0.05, z: atrialTop.z },
      to:   { x: atrialTop.x + 0.32, y: atrialTop.y - 0.28, z: atrialTop.z + 0.60 },
      radius: 0.12,
    },
    {
      from: { x: atrialTop.x - 0.10, y: atrialTop.y + 0.08, z: atrialTop.z },
      to:   { x: atrialTop.x - 0.06, y: atrialTop.y + 0.32, z: atrialTop.z + 0.65 },
      radius: 0.10,
    },
  ];
}

function rotateZ(p, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

export function heartAssembly({
  viewAngle = 0,
  harmonicAmp = HEART_CLEFT_AMPLITUDE,
  harmonicN = 2,
  includeAtria = true,
  includeVessels = true,
  crossSections = HEART_CROSS_SECTIONS,
  samples = HEART_SAMPLES,
} = {}) {
  const rot = (p) => rotateZ(p, viewAngle);
  const cleftPhase = viewAngle;

  const sac = sacEndpoints();
  const lathes = [
    {
      axisFrom: rot(sac.top),
      axisTo:   rot(sac.base),
      profile: HEART_PROFILE,
      harmonics: [{ n: harmonicN, amplitude: harmonicAmp, phase: cleftPhase }],
      crossSections,
      samples,
      style: HEART_SAC_STYLE,
    },
  ];

  if (includeAtria) {
    const atria = atrialEndpoints();
    lathes.push({
      axisFrom: rot(atria.top),
      axisTo:   rot(atria.base),
      profile: ATRIAL_PROFILE,
      harmonics: [{ n: 2, amplitude: ATRIAL_CLEFT_AMPLITUDE, phase: cleftPhase }],
      crossSections: Math.max(8, Math.round(crossSections * 0.65)),
      samples: Math.max(16, Math.round(samples * 0.85)),
      style: HEART_ATRIAL_STYLE,
    });
  }

  if (includeVessels) {
    for (const stub of vesselStubs()) {
      lathes.push({
        axisFrom: rot(stub.from),
        axisTo:   rot(stub.to),
        profile: [
          { t: 0.0, radius: stub.radius },
          { t: 1.0, radius: stub.radius * 0.85 },
        ],
        crossSections: 6,
        samples: 24,
        style: HEART_VESSEL_STYLE,
      });
    }
  }

  return lathes;
}
