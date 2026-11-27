// In-page script: WHAT A MOVER LIFTS, SHOWN (worlds/controllable/heave.js) — what the player sees of it:
//
//   the piece      each liftable piece is its own render group (`heave:<id>`, worlds/world-scene.js): drawn where the
//                  runtime has it, so a held one rides in the hero's hands and one set down stands where it was put; a
//                  loaded one is gone (on the truck)
//   the hold       at the foot of the screen, what the action does: lift the piece in reach, or set down the one held
//
// It reads the world and draws; it changes nothing. Emitted only into a page whose world carries `heave`, so every other
// page keeps every byte. Needs THREE, meshes, __world, __CW (the runtime: heaveTarget) and the page's input read
// (__readInput, __k, __padNow, __CTL) in scope.
export function heaveScript() {
  return `
// ── WHAT A MOVER LIFTS, SHOWN ──
const __HV = { hint: null };
// (the action, the interact key (E) or the pad's, read as the runtime's \`act\`: lift, set down)
const __hvRead0 = __readInput;
__readInput = function () {
  const inp = __hvRead0();
  if (window.__mojMenuOpen) return inp;
  const g = __padNow(), gr = g ? __CTL.gamepadRead(g, __DEV) : null;
  if (__k('interact') || (gr && __CTL.held(__BIND, 'interact', 'gamepad', gr))) inp.act = 1;
  return inp;
};
(function () {
  __HV.hint = document.createElement('div');
  __HV.hint.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:12;pointer-events:none;display:none;font:600 14px/1 ui-monospace,monospace;letter-spacing:.12em;color:#e8e6e1;background:rgba(10,12,16,.72);padding:8px 14px;border-radius:3px';
  document.body.appendChild(__HV.hint);
})();
(function __hvFrame() {
  requestAnimationFrame(__hvFrame);
  const W = __world, S = W.heave, p = W.pilotId ? W.byId[W.pilotId] : null;
  if (!S) return;
  for (const P of S.pieces) {
    const own = meshes['heave:' + P.id];
    if (!own) continue;
    // (each of its drawings, its textured ones too, moved by as far as the piece is from where it stood)
    for (const m of [own, ...((own.userData && own.userData.tex) || [])]) {
      m.visible = !P.loaded;
      m.position.set(P.min[0] - P.rest[0], P.min[1] - P.rest[1], P.min[2] - P.rest[2]);
    }
  }
  const held = S.held && S.pieces.find((x) => x.id === S.held), tg = p && !held && __CW.heaveTarget ? __CW.heaveTarget(W, p) : null;
  const say = held ? 'E  ·  set down the ' + held.name : tg ? 'E  ·  lift the ' + tg.name : '';
  __HV.hint.style.display = say ? 'block' : 'none';
  if (say && __HV.hint.textContent !== say) __HV.hint.textContent = say;
})();
`;
}
