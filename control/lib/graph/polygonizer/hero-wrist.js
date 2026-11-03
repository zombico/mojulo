// hero-wrist — the wrist's ranges (a leaf: hero-grip re-exports them, hero-servo reads them at load).
/** the wrist's anatomical range, degrees [toward −, toward +] in the rig's signs (flex + the back of the hand up:
 * flexion 80, extension 70; deviation + toward the thumb: ulnar 35, radial 20; twist + palm down: supination and
 * pronation 85 from the thumb-up neutral): the hard body never passes it */
export const WRIST_RANGE = Object.freeze({ flex: [-80, 70], deviation: [-35, 20], twist: [-85, 85] });
/** the wrist's FUNCTIONAL range, where the hand works at ease: the ranges daily tasks use (Ryu et al. 1991: flexion 54,
 * extension 60, radial 17, ulnar 40 — here capped at the anatomical 35; the forearm's turn, Morrey et al. 1981: 50 each
 * way). A skilled held guard keeps inside it */
export const WRIST_EASE = Object.freeze({ flex: [-54, 60], deviation: [-35, 17], twist: [-50, 50] });
