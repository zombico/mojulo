/**
 * FLOODS ON A FORM LAND — a geocube level's floodlights (`floods`), on a seventh-generation page: each a lamp on a post or a
 * tower aimed at the ground, a real spot of light that lights what it reaches (the land, its grass and plants, a body under
 * the cast rig) as the land's sun does, falling off by the square of the distance; its head drawn burning, with a glow round
 * it seen from far off; the first FLOODS.shadows of them casting what stands in their beam (a guard, a wall, a truck),
 * drawn every frame. A night level's light is the moon's and these: the dark between them is where a body is not seen.
 *
 *   FLOODS                  the most a level carries, the most that cast, and a lamp's own colour, power, cone and reach
 *   readFloods(list)        → [{ at, aim, colour, power, cone, reach, shadow }] checked (a list of at most FLOODS.most),
 *                           or throws, teaching
 *   floodsScript()          the page's code (needs THREE, scene and the form land's D.floods)
 *
 * `power` is a lamp's light at ten metres in the land's solve's own units (linear, a noon sun's about 1; three's are π
 * those, as the land's sun is set): it falls by the square of the distance, so a third as bright at about seventeen. Pure.
 */
export const FLOODS = Object.freeze({ most: 4, shadows: 2, colour: '#fff1d6', power: 0.6, cone: 50, reach: 40, mapSize: 1024 });
const KEYS = ['at', 'aim', 'colour', 'power', 'cone', 'reach', 'shadow'];
const isXYZ = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

export function readFloods(list) {
  const no = (m) => { throw new Error(`floods: ${m}`); };
  if (!Array.isArray(list) || !list.length || list.length > FLOODS.most) no(`a list of 1 to ${FLOODS.most} floodlights, each { ${KEYS.join(', ')} }`);
  return list.map((f, i) => {
    const at = `floods[${i}]`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) no(`${at} is { ${KEYS.join(', ')} }`);
    for (const k of Object.keys(f)) if (!KEYS.includes(k)) no(`${at}.${k} is not a floodlight's setting (${KEYS.join(', ')})`);
    if (!isXYZ(f.at)) no(`${at}.at is where the lamp hangs, [x, y, z] in metres`);
    if (!isXYZ(f.aim)) no(`${at}.aim is the point on the ground it shines at, [x, y, z]`);
    if (f.colour !== undefined && !/^#[0-9a-f]{6}$/i.test(f.colour)) no(`${at}.colour is a hex colour (${FLOODS.colour}, a warm sodium white, unless said)`);
    if (f.power !== undefined && !(typeof f.power === 'number' && f.power > 0 && f.power <= 4)) no(`${at}.power is its light at ten metres, a noon sun's about 1: over 0 to 4 (${FLOODS.power} unless said)`);
    if (f.cone !== undefined && !(typeof f.cone === 'number' && f.cone >= 10 && f.cone <= 120)) no(`${at}.cone is the beam's whole angle in degrees, 10 to 120 (${FLOODS.cone} unless said)`);
    if (f.reach !== undefined && !(typeof f.reach === 'number' && f.reach >= 5 && f.reach <= 120)) no(`${at}.reach is how far its light goes in metres, 5 to 120 (${FLOODS.reach} unless said)`);
    if (f.shadow !== undefined && typeof f.shadow !== 'boolean') no(`${at}.shadow is true or false: whether what stands in its beam casts (the first ${FLOODS.shadows} cast unless said)`);
    return { at: f.at, aim: f.aim, colour: f.colour ?? FLOODS.colour, power: f.power ?? FLOODS.power, cone: f.cone ?? FLOODS.cone, reach: f.reach ?? FLOODS.reach, shadow: f.shadow ?? i < FLOODS.shadows };
  });
}

/** The page's floods: a spot each, its head and its glow. Needs THREE, scene, D (the form land's payload, D.floods) in
 *  scope. */
export function floodsScript() {
  return `
// THE FLOODS (channels/form-floods.js): each a spot that lights what it reaches as the land's sun does, its head burning
{
  const __flGlow = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  let __flCast = 0;
  window.__mojFloods = D.floods.map((f) => {
    const col = new THREE.Color(f.colour);
    // (power: its light at ten metres, linear; three's are π those, and its spot falls by the square of the distance)
    const L = new THREE.SpotLight(col, f.power * Math.PI * 100, f.reach, (f.cone / 2) * Math.PI / 180, 0.45, 2);
    L.position.set(f.at[0], f.at[1], f.at[2]); L.target.position.set(f.aim[0], f.aim[1], f.aim[2]);
    if (f.shadow) { L.castShadow = true; L.shadow.mapSize.set(${FLOODS.mapSize}, ${FLOODS.mapSize}); L.shadow.camera.near = 0.3; L.shadow.camera.far = f.reach; L.shadow.bias = -0.0006; L.shadow.normalBias = 0.03; __flCast++; }
    scene.add(L, L.target);
    // (its head: a box burning in its own colour, turned to its aim, and a glow round it that the haze does not eat)
    const dir = new THREE.Vector3(f.aim[0] - f.at[0], f.aim[1] - f.at[1], f.aim[2] - f.at[2]).normalize();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.3), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), toneMapped: false }));
    head.position.set(f.at[0], f.at[1], f.at[2]); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); head.raycast = () => {};
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: __flGlow, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    glow.position.copy(head.position).addScaledVector(dir, 0.3); glow.scale.set(2.6, 2.6, 1); glow.raycast = () => {};
    scene.add(head, glow);
    return { light: L, head, glow, at: f.at, aim: f.aim };
  });
}
`;
}
