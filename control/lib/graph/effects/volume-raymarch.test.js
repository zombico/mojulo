import { describe, expect, it } from 'vitest';

import { buildVolumeFrag } from './volume-raymarch.js';

const SAMPLE = `void volSample(vec3 p, out vec3 emis, out vec3 ext){ emis = vec3(0.1); ext = vec3(0.2); }`;

describe('buildVolumeFrag — the reusable volume scaffold', () => {
  it('emits a complete fragment shader wired to the built-in camera uniforms', () => {
    const f = buildVolumeFrag({ globals: SAMPLE });
    expect(f).toContain('uniform vec3 uCamPos;');
    expect(f).toContain('uniform mat3 uCamBasis;');
    expect(f).toContain('uniform float uTime;');
    expect(f).toContain('void main()');
    expect(f).toContain('gl_FragColor');
  });

  it('builds the camera ray from uCamBasis exactly like the shipping shaders', () => {
    const f = buildVolumeFrag({ globals: SAMPLE });
    expect(f).toContain('normalize(uCamBasis * vec3(uv.x * tanf, uv.y * tanf, 1.0))');
    expect(f).toContain('vec3 ro = uCamPos;');
  });

  it('runs a bounded emission/absorption march that calls the consumer volSample', () => {
    const f = buildVolumeFrag({ globals: SAMPLE });
    expect(f).toContain('vrSphereT(ro, rd, uRmax)');               // ray-vs-bounds
    expect(f).toContain('volSample(p, emis, ext)');                // transfer function
    expect(f).toContain('col += trans * emis * dt');               // emission front-to-back
    expect(f).toContain('trans *= exp(-ext * dt)');                // per-channel absorption
  });

  it('honours the step count, custom bounds radius, and extra uniforms', () => {
    const f = buildVolumeFrag({ globals: SAMPLE, steps: 64, boundsRadius: 'uShell', uniforms: ['uniform float uShell;'] });
    expect(f).toContain('const int STEPS = 64;');
    expect(f).toContain('vrSphereT(ro, rd, uShell)');
    expect(f).toContain('uniform float uShell;');
  });

  it('selects the tonemap and optional one-shot exposure', () => {
    const aces = buildVolumeFrag({ globals: SAMPLE, tonemap: 'aces' });
    expect(aces).toContain('vrACES(col)');
    const rein = buildVolumeFrag({ globals: SAMPLE, tonemap: 'reinhard', exposureUniform: 'uExposure', uniforms: ['uniform float uExposure;'] });
    expect(rein).toContain('col = col / (col + vec3(1.0))');
    expect(rein).toContain('col *= uExposure;');
  });

  it('can disable the start-jitter (no uTime hash in the ray start)', () => {
    const jit = buildVolumeFrag({ globals: SAMPLE, jitter: true });
    const flat = buildVolumeFrag({ globals: SAMPLE, jitter: false });
    expect(jit).toContain('dt * vrHash13(vec3(gl_FragCoord.xy, floor(uTime)))');
    expect(flat).toContain('float t = t0 + dt * 0.0;');
  });
});

describe('buildVolumeFrag — opt-in generalizations (light transport)', () => {
  const SAMPLE_RD = `void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){ emis = vec3(0.1); ext = vec3(0.2); }`;

  it('the default path is unchanged — no rayDir, no occluder', () => {
    const f = buildVolumeFrag({ globals: SAMPLE });
    expect(f).toContain('volSample(p, emis, ext);');     // 4-arg form
    expect(f).not.toContain('hitGround');                // no occluder machinery
    expect(f).toContain('col += trans * vrStars(rd);');  // plain background
  });

  it('rayDirArg passes the view direction into the transfer function', () => {
    const f = buildVolumeFrag({ globals: SAMPLE_RD, rayDirArg: true });
    expect(f).toContain('volSample(p, rd, emis, ext);');
  });

  it('occluder stops the ray at a solid inner sphere and shades the hit instead of the background', () => {
    const f = buildVolumeFrag({
      globals: `${SAMPLE_RD}\nvec3 ground(vec3 p, vec3 rd){ return vec3(0.1); }`,
      rayDirArg: true,
      boundsRadius: 'uRt',
      occluder: { radiusUniform: 'uRg', groundFn: 'ground' },
      background: 'sky',
    });
    expect(f).toContain('vrSphereT(ro, rd, uRg)');                  // occluder intersection
    expect(f).toContain('bool hitGround');
    expect(f).toContain('if (hitGround) t1 = min(t1, tg.x);');      // march stops at the surface
    expect(f).toContain('hitGround ? ground(ro + rd * tg.x, rd) : sky(rd)');   // shade hit vs background
  });
});

describe('buildVolumeFrag — SCENE SDF occluder (the effects-layer clip against solid worlds)', () => {
  const SAMPLE_RD = `void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){ emis = vec3(0.1); ext = vec3(0.2); }`;
  const SCENE = `${SAMPLE_RD}\nfloat sdfScene(vec3 p){ return sdfBox(p, vec3(1.0)); }\nvec3 ground(vec3 p, vec3 rd){ return vec3(0.1); }\nvec3 sky(vec3 d){ return vec3(0.2); }`;

  const sdfFrag = () => buildVolumeFrag({
    globals: SCENE,
    rayDirArg: true,
    occluder: { sdfFn: 'sdfScene', groundFn: 'ground' },
    background: 'sky',
  });

  it('sphere-traces the scene SDF and clips the volume march at the first surface', () => {
    const f = sdfFrag();
    expect(f).toContain('float d = sdfScene(ro + rd * ts);');       // marches the scene field
    expect(f).toContain('if (d < 0.004)');                          // default surface epsilon
    expect(f).toContain('ts += max(d, 0.02);');                     // default min step
    expect(f).toContain('if (hitGround) t1 = min(t1, tHit);');      // fog stops at the solid
    expect(f).toContain('hitGround ? ground(ro + rd * tHit, rd) : sky(rd)');  // shade hit vs background
    expect(f).not.toContain('vrSphereT(ro, rd, undefined)');        // never falls through to sphere mode
  });

  it('honours custom trace tuning (traceSteps / surfEps / minStep)', () => {
    const f = buildVolumeFrag({
      globals: SCENE,
      rayDirArg: true,
      occluder: { sdfFn: 'sdfScene', groundFn: 'ground', traceSteps: 160, surfEps: '0.001', minStep: '0.05' },
      background: 'sky',
    });
    expect(f).toContain('gi < 160;');
    expect(f).toContain('if (d < 0.001)');
    expect(f).toContain('ts += max(d, 0.05);');
  });

  it('leaves sphere-mode output untouched (SDF mode is purely additive)', () => {
    const sphere = buildVolumeFrag({
      globals: `${SAMPLE_RD}\nvec3 ground(vec3 p, vec3 rd){ return vec3(0.1); }`,
      rayDirArg: true,
      occluder: { radiusUniform: 'uRg', groundFn: 'ground' },
      background: 'sky',
    });
    expect(sphere).toContain('if (hitGround) t1 = min(t1, tg.x);');
    expect(sphere).not.toContain('sdfScene');                       // no SDF machinery leaked in
  });
});
