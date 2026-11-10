// In-page script: POSE SYNC (exhibit/states.js). A World page framed as one state of a prepared-states exhibit tells its
// frame where its camera stands and takes a pose from it, so a visitor who turns the dam to look at the spillway still
// looks at the spillway when the water level changes. It answers pose-get with pose ({ pos, target, fov }), takes
// pose-set, says pose-ready once it can, frame-touch when a visitor touches it and frame-key for the arrows (the
// states' keys, when no tour of its own takes them), and only ever to and from its own
// parent. Framed, it is an exhibit, not the editor: the camera buttons, the wireframe toggle and the orbit hint step
// aside. Emitted only when the page is asked for (`sync`): every other page byte-identical.
export function syncScript() {
  return `
// --- pose sync: a framed state tells its camera to its frame and takes one from it (exhibit/states.js) ---
(function () {
  if (window.parent === window) return;
  if (typeof hud !== 'undefined' && hud) hud.style.display = 'none';
  const hint = document.querySelector('.hint'); if (hint) hint.style.display = 'none';
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window.parent || !d || typeof d.moj !== 'string') return;
    if (d.moj === 'pose-get') {
      try { window.parent.postMessage({ moj: 'pose', pos: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov }, '*'); } catch (err) { /* an opaque frame */ }
    } else if (d.moj === 'pose-set' && Array.isArray(d.pos) && Array.isArray(d.target)) {
      camera.position.fromArray(d.pos); controls.target.fromArray(d.target);
      if (typeof d.fov === 'number') { camera.fov = d.fov; camera.updateProjectionMatrix(); }
      controls.update();
    }
  });
  // a visitor's touch inside the frame is the frame's to know (a kiosk's attract loop stops on it)
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { try { window.parent.postMessage({ moj: 'frame-touch' }, '*'); } catch (err) { /* an opaque frame */ } }, { passive: true, capture: true }));
  const tour = typeof window.__mojTour !== 'undefined';
  // after a drag the keyboard is the frame's: the left and right arrows step the states, unless a tour of its own takes them
  if (!tour) window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { try { window.parent.postMessage({ moj: 'frame-key', key: e.key }, '*'); } catch (err) { /* opaque */ } } });
  try { window.parent.postMessage({ moj: 'pose-ready', tour }, '*'); } catch (err) { /* an opaque frame */ }
})();
`;
}
