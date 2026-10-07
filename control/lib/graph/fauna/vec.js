// vec — the small vector and 3×3 rotation kit the fauna solvers share (gait, limb, behavior). Rotations are row arrays;
// z is up, +y is forward (toward the head), +x is the animal's right.
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (v) => Math.hypot(v[0], v[1], v[2]);
export const unit = (v) => { const l = norm(v); return l > 1e-12 ? mul(v, 1 / l) : [0, 0, 0]; };

export const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export const mv = (A, v) => [dot(A[0], v), dot(A[1], v), dot(A[2], v)];
export const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
export const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
export const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
export const axisAngle = (k, a) => { const [x, y, z] = k, c = Math.cos(a), s = Math.sin(a), C = 1 - c; return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]; };
/** The smallest rotation taking unit a onto unit b. */
export const between = (a, b) => { const c = cross(a, b), s = norm(c), d = dot(a, b); if (s < 1e-9) return d > 0 ? I3 : axisAngle(unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), Math.PI); return axisAngle(mul(c, 1 / s), Math.atan2(s, d)); };
