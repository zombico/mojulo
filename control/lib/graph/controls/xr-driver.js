/**
 * xr-driver — the `xr` device family's driver (devices.js `driver: 'webxr-gamepad'`), and the thumbstick shaping a
 * headset's locomotion reads through.
 *
 * Its own closure, the controls-kernel discipline (references nothing outside itself, so a page runs the same code by
 * emitting `buildXrDriver.toString()`), and its own module so only a page with a WebXR session carries it: the kernel
 * is in every game page, and a page that cannot open a session reads no headset.
 *
 *   xrRead(sources, D, analog?)   → read for the kernel: an XRSession's inputSources (any list of { handedness,
 *                                   gamepad }) → read('left.thumbstickY'), a button 0..1, an axis -1..1
 *   stick(x, y, dead, axial)      → [x, y]: a RADIAL dead zone, the travel past it rescaled to 0..1, and a push within
 *                                   `axial` radians of a cardinal snapped onto it, so a push forward goes straight
 *
 * Meta Quest Touch, Touch Plus (Quest 3 / 3S) and Touch Pro all speak xr-standard: trigger 0, grip 1, (no touchpad) 2,
 * thumbstick click 3, A / X 4, B / Y 5, the thumbstick on axes 2 and 3. The menu buttons are the system's, never a page's.
 */

export function buildXrDriver() {
  // one gamepad per hand; a hand with both a tracked hand and a controller reads the one with more axes. A two-axis pad
  // (an early runtime, before xr-standard reserved axes 0 and 1 for a touchpad) carries its thumbstick at 0 and 1.
  function xrRead(sources, D, analog) {
    const X = D.xr, by = {};
    for (const s of sources || []) {
      const g = s && s.gamepad, h = s && s.handedness;
      if (!g || (h !== 'left' && h !== 'right')) continue;
      if (!by[h] || (g.axes || []).length > (by[h].axes || []).length) by[h] = g;
    }
    return (c) => {
      const m = /^(left|right)\.([A-Za-z0-9]+)$/.exec(c || '');
      const g = m && by[m[1]];
      if (!g) return 0;
      const n = m[2];
      if (X.buttons[n] !== undefined) {
        const b = (g.buttons || [])[X.buttons[n]];
        if (!b) return 0;
        return analog ? b.value || 0 : (b.pressed ? 1 : b.value || 0);
      }
      if (X.axes[n] !== undefined) {
        const ax = g.axes || [];
        const i = ax.length < 4 && /^thumbstick/.test(n) ? X.axes[n] - 2 : X.axes[n];
        return +ax[i] || 0;
      }
      return 0;
    };
  }

  // a square dead zone (each axis on its own) lets a worn stick's drift, or a thumb a few degrees off true, leak into the
  // other axis the moment the push clears it: forward curves. Radial, rescaled, snapped near a cardinal, it does not.
  function stick(x, y, dead, axial) {
    const sx = +x || 0, sy = +y || 0, m = Math.hypot(sx, sy), d = Math.min(Math.max(+dead || 0, 0), 0.95);
    if (!(m > d)) return [0, 0];
    const r = Math.min(1, (m - d) / (1 - d)), a = Math.atan2(sy, sx), q = Math.PI / 2, k = Math.round(a / q);
    if (axial > 0 && Math.abs(a - k * q) <= axial) {
      const c = ((k % 4) + 4) % 4;
      return [c === 0 ? r : c === 2 ? -r : 0, c === 1 ? r : c === 3 ? -r : 0];
    }
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  return { xrRead, stick };
}
