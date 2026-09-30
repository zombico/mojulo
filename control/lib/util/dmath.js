/**
 * dmath: Math's transcendental functions with the same bits on every engine, CPU and Node version.
 *
 * Math is not a stable contract. V8 compiles its C++ fdlibm with fused multiply-add on arm64, so sin, exp,
 * atan2 and the rest round differently there than on x64, and since V8 13.6 (Node 24) Math.pow and `**` call
 * the platform's libm. This module is fdlibm written in plain IEEE-754 double arithmetic, which every
 * JavaScript engine evaluates the same way, so a recipe that must regrow byte for byte on any machine takes
 * its math from here. The golden digests in dmath.test.js are the contract.
 *
 * Arithmetic is + - * /, Math.sqrt, abs, floor, trunc and fround, integer ops on 32-bit words, and word
 * reads through a Float64Array; no other Math member and no `**` (the test scans for them). Arguments are
 * coerced with ToNumber and special values follow ECMAScript, as Math does.
 *
 * Provenance. Each function ports FreeBSD msun (fdlibm) at the revision V8's src/base/ieee754.cc follows, so
 * on x64, where V8's C++ has no fused multiply-add, the results equal V8's Math bit for bit:
 *   freebsd-src 9cf774a577abbe28e03a849d1ec25f47827f07e6 (main), lib/msun/src: e_acos.c e_asin.c s_atan.c
 *     e_atan2.c e_exp.c s_expm1.c e_log.c s_log1p.c e_log2.c k_log.h s_cbrt.c s_tanh.c
 *   freebsd-src 3d215489fe03c6c5cecc3b5ed9ea39118e6ce379 (release/6.0.0, fdlibm 5.3), lib/msun/src:
 *     e_rem_pio2.c k_rem_pio2.c k_sin.c k_cos.c k_tan.c s_sin.c s_cos.c s_tan.c e_log10.c e_pow.c e_sinh.c
 *     e_cosh.c
 * Where V8 departs from msun, dmath follows V8: exp(1) returns Math.E exactly (msun's reduction rounds it one
 * ulp high), and hypot is V8's Math.hypot (the Torque builtin in src/builtins/math.tq: a max-normalised,
 * compensated sum of squares), variadic, the same bits as Math.hypot on every V8. It departs from V8 twice:
 * pow keeps fdlibm's final step r = (z*t1)/(t1-2) - (w+z*w), where V8's legacy pow (Node 22) divides by
 * (t1-2) - (w+z*w) and Node 24 calls libm; and every NaN it returns is the quiet NaN 0x7FF8000000000000
 * (V8's come back with the sign bit set on x64 and clear on arm64, which a typed array's bytes show).
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 * Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.
 *
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 * (s_cbrt.c: optimized by Bruce D. Evans.)
 *
 * hypot, and the exp(1) case, follow V8:
 * Copyright 2006-2011, the V8 project authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 *       copyright notice, this list of conditions and the following
 *       disclaimer in the documentation and/or other materials provided
 *       with the distribution.
 *     * Neither the name of Google Inc. nor the names of its
 *       contributors may be used to endorse or promote products derived
 *       from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * Constants are the shortest decimals of fdlibm's hex values (a literal of more than 20 significant digits
 * may round either way under ECMAScript), each with its hex beside it.
 */

// ── word access ──────────────────────────────────────────────────────────────────────────────────
// fdlibm reads and writes a double as two 32-bit words. Reads go through one scratch double; which Uint32 index
// holds the sign and exponent is detected here, once, from the bits of 1.0 (0x3FF00000 00000000). Writes are
// done with exact arithmetic instead: storing two words and loading the double stalls store-to-load forwarding
// on every CPU, and a power-of-two scaling or a sum of mantissa bits gives the very same bits.
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
F64[0] = 1;
const HI = U32[1] === 0x3ff00000 ? 1 : 0, LO = 1 - HI;
if (U32[HI] !== 0x3ff00000 || U32[LO] !== 0) throw new Error('dmath: unsupported double layout');

const hiWord = (x) => { F64[0] = x; return U32[HI] | 0; };   // GET_HIGH_WORD, signed like fdlibm's int32_t
const loWord = (x) => { F64[0] = x; return U32[LO]; };       // GET_LOW_WORD, unsigned

// POW2[1074 + k] = 2^k for k = -1074..1023, by doubling and halving, which is exact.
const POW2 = new Float64Array(2098);
for (let k = 0, p = 1; k <= 1023; k++, p *= 2) POW2[1074 + k] = p;
for (let k = 0, p = 1; k >= -1074; k--, p /= 2) POW2[1074 + k] = p;
const TWO_M20 = POW2[1074 - 20], TWO_M52 = POW2[1074 - 52], TWO_M1022 = POW2[1074 - 1022];

// INSERT_WORDS for a finite result: the sign, the exponent and the 52 mantissa bits of (hi, lo), assembled by
// sums and products that are all exact.
function fromWords(hi, lo) {
  const e = (hi >>> 20) & 0x7ff, m = (hi & 0xfffff) * TWO_M20 + (lo >>> 0) * TWO_M52;
  const v = e === 0 ? m * TWO_M1022 : (1 + m) * POW2[e + 51];
  return hi >>> 31 ? -v : v;
}
// These two run inside the long functions, so they are kept small enough for TurboFan to inline at every call
// site (a call that is not inlined boxes the doubles it passes). fromHi(h) is INSERT_WORDS(d, h, 0).
function fromHi(h) {
  const e = (h >>> 20) & 0x7ff, v = ((h & 0xfffff) * TWO_M20 + (e === 0 ? 0 : 1)) * POW2[e === 0 ? 52 : e + 51];
  return h >>> 31 ? -v : v;
}
// SET_LOW_WORD(x, 0): x less the magnitude of its low word, lo * 2^(E-52), which leaves exactly the high word.
function hiPart(x) {
  F64[0] = x;
  const e = (U32[HI] >>> 20) & 0x7ff, low = U32[LO] * POW2[e === 0 ? 0 : e - 1];
  return x < 0 ? x + low : x - low;
}

const TWO1023 = 8.98846567431158e+307;        // 0x7FE00000, 0x00000000
const TWOM1000 = 9.332636185032189e-302;      // 0x01700000, 0x00000000
const TWOM969 = POW2[1074 - 969];             // 2^-1022 * 2^53

// x * 2^n with one rounding (musl's, as FreeBSD's s_scalbn.c): a subnormal result is rounded once.
function scalbn(x, n) {
  let y = x;
  if (n > 1023) {
    y *= TWO1023; n -= 1023;
    if (n > 1023) { y *= TWO1023; n -= 1023; if (n > 1023) n = 1023; }
  } else if (n < -1022) {
    y *= TWOM969; n += 969;
    if (n < -1022) { y *= TWOM969; n += 969; if (n < -1022) n = -1022; }
  }
  return y * POW2[1074 + n];
}

// ── argument reduction: x rem pi/2 (e_rem_pio2.c, k_rem_pio2.c of fdlibm 5.3) ──────────────────────
const INVPIO2 = 0.6366197723675814;           // 0x3FE45F30, 0x6DC9C883  53 bits of 2/pi
const PIO2_1 = 1.5707963267341256;            // 0x3FF921FB, 0x54400000  first 33 bits of pi/2
const PIO2_1T = 6.077100506506192e-11;        // 0x3DD0B461, 0x1A626331  pi/2 - PIO2_1
const PIO2_2 = 6.077100506303966e-11;         // 0x3DD0B461, 0x1A600000  second 33 bits of pi/2
const PIO2_2T = 2.0222662487959506e-21;       // 0x3BA3198A, 0x2E037073  pi/2 - (PIO2_1+PIO2_2)
const PIO2_3 = 2.0222662487111665e-21;        // 0x3BA3198A, 0x2E000000  third 33 bits of pi/2
const PIO2_3T = 8.4784276603689e-32;          // 0x397B839A, 0x252049C1  pi/2 - (PIO2_1+PIO2_2+PIO2_3)
const TWO24 = 16777216;                       // 0x41700000, 0x00000000
const TWON24 = 5.960464477539063e-8;          // 0x3E700000, 0x00000000

// 2/pi in 24-bit chunks, 396 hex digits.
const TWO_OVER_PI = new Int32Array([
  0xA2F983, 0x6E4E44, 0x1529FC, 0x2757D1, 0xF534DD, 0xC0DB62, 0x95993C, 0x439041, 0xFE5163, 0xABDEBB,
  0xC561B7, 0x246E3A, 0x424DD2, 0xE00649, 0x2EEA09, 0xD1921C, 0xFE1DEB, 0x1CB129, 0xA73EE8, 0x8235F5,
  0x2EBB44, 0x84E99C, 0x7026B4, 0x5F7E41, 0x3991D6, 0x398353, 0x39F49C, 0x845F8B, 0xBDF928, 0x3B1FF8,
  0x97FFDE, 0x05980F, 0xEF2F11, 0x8B5A0A, 0x6D1F6D, 0x367ECF, 0x27CB09, 0xB74F46, 0x3F669E, 0x5FEA2D,
  0x7527BA, 0xC7EBE5, 0xF17B3D, 0x0739F7, 0x8A5292, 0xEA6BFB, 0x5FB11F, 0x8D5D08, 0x560330, 0x46FC7B,
  0x6BABF0, 0xCFBC20, 0x9AF436, 0x1DA9E3, 0x91615E, 0xE61B08, 0x659985, 0x5F14A0, 0x68408D, 0xFFD880,
  0x4D7327, 0x310606, 0x1556CA, 0x73A8C9, 0x60E27B, 0xC08C6B,
]);
// High words of n*pi/2, n = 1..32: an argument sharing one may cancel, so it gets the careful path.
const NPIO2_HW = new Int32Array([
  0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C, 0x4025FDBB, 0x402921FB,
  0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C, 0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB,
  0x403AB41B, 0x403C463A, 0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
  0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB, 0x404858EB, 0x404921FB,
]);
// pi/2 in 24-bit pieces.
const PIO2 = new Float64Array([
  1.570796251296997,        // 0x3FF921FB, 0x40000000
  7.549789415861596e-8,     // 0x3E74442D, 0x00000000
  5.390302529957765e-15,    // 0x3CF84698, 0x80000000
  3.282003415807913e-22,    // 0x3B78CC51, 0x60000000
  1.270655753080676e-29,    // 0x39F01B83, 0x80000000
  1.2293330898111133e-36,   // 0x387A2520, 0x40000000
  2.7337005381646456e-44,   // 0x36E38222, 0x80000000
  2.1674168387780482e-51,   // 0x3569F31D, 0x00000000
]);

// remPio2 returns n and leaves x - n*pi/2 as RY[0] + RY[1] (fdlibm's y[0], y[1]); a typed array, since a
// double kept in a module variable is boxed on every write.
const RY = new Float64Array(2);
const TX = new Float64Array(3);
const IQ = new Int32Array(20), KF = new Float64Array(20), KQ = new Float64Array(20), FQ = new Float64Array(20);

function remPio2(x) {
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) { RY[0] = x; RY[1] = 0; return 0; }   // |x| ~<= pi/4, no reduction
  if (ix < 0x4002d97c) {                                  // |x| < 3pi/4, n = +-1
    if (hx > 0) {
      let z = x - PIO2_1;
      if (ix !== 0x3ff921fb) { RY[0] = z - PIO2_1T; RY[1] = (z - RY[0]) - PIO2_1T; }   // 33+53 bit pi is good enough
      else { z -= PIO2_2; RY[0] = z - PIO2_2T; RY[1] = (z - RY[0]) - PIO2_2T; }        // near pi/2: 33+33+53 bit pi
      return 1;
    }
    let z = x + PIO2_1;
    if (ix !== 0x3ff921fb) { RY[0] = z + PIO2_1T; RY[1] = (z - RY[0]) + PIO2_1T; }
    else { z += PIO2_2; RY[0] = z + PIO2_2T; RY[1] = (z - RY[0]) + PIO2_2T; }
    return -1;
  }
  if (ix <= 0x413921fb) {                                 // |x| ~<= 2^19*(pi/2), medium size
    let t = Math.abs(x);
    const n = (t * INVPIO2 + 0.5) | 0, fn = n;
    let r = t - fn * PIO2_1, w = fn * PIO2_1T;            // 1st round good to 85 bits
    RY[0] = r - w;
    if (n >= 32 || ix === NPIO2_HW[n - 1]) {              // possible cancellation: check it
      const j = ix >> 20;
      let i = j - ((hiWord(RY[0]) >> 20) & 0x7ff);
      if (i > 16) {                                       // 2nd iteration, good to 118 bits
        t = r; w = fn * PIO2_2; r = t - w; w = fn * PIO2_2T - ((t - r) - w); RY[0] = r - w;
        i = j - ((hiWord(RY[0]) >> 20) & 0x7ff);
        if (i > 49) {                                     // 3rd iteration, 151 bits: covers every case
          t = r; w = fn * PIO2_3; r = t - w; w = fn * PIO2_3T - ((t - r) - w); RY[0] = r - w;
        }
      }
    }
    RY[1] = (r - RY[0]) - w;
    if (hx < 0) { RY[0] = -RY[0]; RY[1] = -RY[1]; return -n; }
    return n;
  }
  if (ix >= 0x7ff00000) { RY[0] = NaN; RY[1] = NaN; return 0; }     // inf or NaN (callers filter these out)
  // Large arguments: z = scalbn(|x|, ilogb(x)-23) split into 24-bit pieces for kernelRemPio2.
  const e0 = (ix >> 20) - 1046;
  let z = Math.abs(x) * POW2[1074 - e0];
  for (let i = 0; i < 2; i++) { TX[i] = z | 0; z = (z - TX[i]) * TWO24; }
  TX[2] = z;
  let nx = 3;
  while (TX[nx - 1] === 0) nx--;                          // skip zero terms
  const n = kernelRemPio2(e0, nx);
  if (hx < 0) { RY[0] = -RY[0]; RY[1] = -RY[1]; return -n; }
  return n;
}

// __kernel_rem_pio2(TX, y, e0, nx, prec = 2, two_over_pi): Payne-Hanek, the last three bits of n and
// |x| - n*pi/2 in RY[0] + RY[1]. prec 2 (jk = 4) as fdlibm 5.3's e_rem_pio2.c and V8 call it.
function kernelRemPio2(e0, nx) {
  const jk = 4, jp = 4, jx = nx - 1;
  let jv = ((e0 - 3) / 24) | 0;
  if (jv < 0) jv = 0;
  let q0 = e0 - 24 * (jv + 1);
  // KF[0..jx+jk] = TWO_OVER_PI[jv-jx .. jv+jk]
  for (let i = 0, j = jv - jx, m = jx + jk; i <= m; i++, j++) KF[i] = j < 0 ? 0 : TWO_OVER_PI[j];
  for (let i = 0; i <= jk; i++) {
    let fw = 0;
    for (let j = 0; j <= jx; j++) fw += TX[j] * KF[jx + i - j];
    KQ[i] = fw;
  }
  let jz = jk, z, n, ih;
  for (;;) {
    // distill KQ[] into IQ[] reversingly
    let i = 0, j = jz;
    for (z = KQ[jz]; j > 0; i++, j--) {
      const fw = (TWON24 * z) | 0;
      IQ[i] = (z - TWO24 * fw) | 0;
      z = KQ[j - 1] + fw;
    }
    // compute n
    z = scalbn(z, q0);                                    // actual value of z
    z -= 8 * Math.floor(z * 0.125);                       // trim off integer >= 8
    n = z | 0;
    z -= n;
    ih = 0;
    if (q0 > 0) {                                         // need IQ[jz-1] to determine n
      i = IQ[jz - 1] >> (24 - q0); n += i;
      IQ[jz - 1] -= i << (24 - q0);
      ih = IQ[jz - 1] >> (23 - q0);
    } else if (q0 === 0) ih = IQ[jz - 1] >> 23;
    else if (z >= 0.5) ih = 2;
    if (ih > 0) {                                         // q > 0.5
      n += 1;
      let carry = 0;
      for (i = 0; i < jz; i++) {                          // compute 1-q
        j = IQ[i];
        if (carry === 0) {
          if (j !== 0) { carry = 1; IQ[i] = 0x1000000 - j; }
        } else IQ[i] = 0xffffff - j;
      }
      if (q0 === 1) IQ[jz - 1] &= 0x7fffff;               // rare case: chance is 1 in 12
      else if (q0 === 2) IQ[jz - 1] &= 0x3fffff;
      if (ih === 2) {
        z = 1 - z;
        if (carry !== 0) z -= scalbn(1, q0);
      }
    }
    // check whether recomputation is needed
    if (z !== 0) break;
    j = 0;
    for (i = jz - 1; i >= jk; i--) j |= IQ[i];
    if (j !== 0) break;
    let k = 1;
    while (jk >= k && IQ[jk - k] === 0) k++;              // k = number of terms needed
    for (i = jz + 1; i <= jz + k; i++) {                  // add KQ[jz+1] .. KQ[jz+k]
      KF[jx + i] = TWO_OVER_PI[jv + i];
      let fw = 0;
      for (j = 0; j <= jx; j++) fw += TX[j] * KF[jx + i - j];
      KQ[i] = fw;
    }
    jz += k;
  }
  // chop off zero terms
  if (z === 0) {
    jz -= 1; q0 -= 24;
    while (IQ[jz] === 0) { jz--; q0 -= 24; }
  } else {                                                // break z into 24-bit pieces if necessary
    z = scalbn(z, -q0);
    if (z >= TWO24) {
      const fw = (TWON24 * z) | 0;
      IQ[jz] = (z - TWO24 * fw) | 0;
      jz += 1; q0 += 24;
      IQ[jz] = fw;
    } else IQ[jz] = z | 0;
  }
  // convert the integer chunks to floating point
  let fw = scalbn(1, q0);
  for (let i = jz; i >= 0; i--) { KQ[i] = fw * IQ[i]; fw *= TWON24; }
  // FQ = PIO2[0..jp] * KQ[jz..0]
  for (let i = jz; i >= 0; i--) {
    fw = 0;
    for (let k = 0; k <= jp && k <= jz - i; k++) fw += PIO2[k] * KQ[i + k];
    FQ[jz - i] = fw;
  }
  // compress FQ into RY[0] + RY[1]
  fw = 0;
  for (let i = jz; i >= 0; i--) fw += FQ[i];
  RY[0] = ih === 0 ? fw : -fw;
  fw = FQ[0] - fw;
  for (let i = 1; i <= jz; i++) fw += FQ[i];
  RY[1] = ih === 0 ? fw : -fw;
  return n & 7;
}

// ── sin, cos, tan kernels on [-pi/4, pi/4] (k_sin.c, k_cos.c, k_tan.c of fdlibm 5.3) ─────────────────
const S1 = -0.16666666666666632;              // 0xBFC55555, 0x55555549
const S2 = 0.00833333333332249;               // 0x3F811111, 0x1110F8A6
const S3 = -1.984126982985795e-4;             // 0xBF2A01A0, 0x19C161D5
const S4 = 2.7557313707070068e-6;             // 0x3EC71DE3, 0x57B1FE7D
const S5 = -2.5050760253406863e-8;            // 0xBE5AE5E6, 0x8A2B9CEB
const S6 = 1.58969099521155e-10;              // 0x3DE5D93A, 0x5ACFD57C

// sin(x+y), |y| a tail of x; iy 0 means y is 0.
function kSin(x, y, iy) {
  if ((hiWord(x) & 0x7fffffff) < 0x3e400000) return x;   // |x| < 2^-27
  const z = x * x, v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) return x + v * (S1 + z * r);
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

const C1 = 0.0416666666666666;                // 0x3FA55555, 0x5555554C
const C2 = -0.001388888888887411;             // 0xBF56C16C, 0x16C15177
const C3 = 2.480158728947673e-5;              // 0x3EFA01A0, 0x19CB1590
const C4 = -2.7557314351390663e-7;            // 0xBE927E4F, 0x809C52AD
const C5 = 2.087572321298175e-9;              // 0x3E21EE9E, 0xBDB4B1C4
const C6 = -1.1359647557788195e-11;           // 0xBDA8FAE9, 0xBE8838D4

// cos(x+y). For |x| > 0.3 the final subtraction is split around qx (x/4 truncated, or 0.28125) so that
// 1-qx and x*x/2-qx are exact.
function kCos(x, y) {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix < 0x3e400000) return 1;                          // |x| < 2^-27
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));   // |x| < 0.3
  const qx = ix > 0x3fe90000 ? 0.28125 : fromHi(ix - 0x00200000);
  return (1 - qx) - ((0.5 * z - qx) - (z * r - x * y));
}

const T = new Float64Array([
  0.3333333333333341,       // 0x3FD55555, 0x55555563
  0.13333333333320124,      // 0x3FC11111, 0x1110FE7A
  0.05396825397622605,      // 0x3FABA1BA, 0x1BB341FE
  0.021869488294859542,     // 0x3F9664F4, 0x8406D637
  0.0088632398235993,       // 0x3F8226E3, 0xE96E8493
  0.0035920791075913124,    // 0x3F6D6D22, 0xC9560328
  0.0014562094543252903,    // 0x3F57DBC8, 0xFEE08315
  5.880412408202641e-4,     // 0x3F4344D8, 0xF2F26501
  2.464631348184699e-4,     // 0x3F3026F7, 0x1A8D1068
  7.817944429395571e-5,     // 0x3F147E88, 0xA03792A6
  7.140724913826082e-5,     // 0x3F12B80F, 0x32F0A7E9
  -1.8558637485527546e-5,   // 0xBEF375CB, 0xDB605373
  2.590730518636337e-5,     // 0x3EFB2A70, 0x74BF7AD4
]);
const PIO4 = 0.7853981633974483;              // 0x3FE921FB, 0x54442D18
const PIO4LO = 3.061616997868383e-17;         // 0x3C81A626, 0x33145C07

// tan(x+y) when iy is 1, -1/tan(x+y) when iy is -1.
function kTan(x, y, iy) {
  let z, r, v, w, s, a, t;
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  if (ix < 0x3e300000) {                                  // |x| < 2^-28
    if (((ix | loWord(x)) | (iy + 1)) === 0) return 1 / Math.abs(x);
    if (iy === 1) return x;
    w = x + y;                                            // compute -1/(x+y) carefully
    z = hiPart(w);
    v = y - (z - x);
    t = a = -1 / w;
    t = hiPart(t);
    s = 1 + t * z;
    return t + a * (s + t * v);
  }
  if (ix >= 0x3fe59428) {                                 // |x| >= 0.6744: tan(pi/4-y) = (1-tan(y))/(1+tan(y))
    if (hx < 0) { x = -x; y = -y; }
    z = PIO4 - x;
    w = PIO4LO - y;
    x = z + w; y = 0;
  }
  z = x * x;
  w = z * z;
  // x^5*(T1+x^2*T2+...) as x^5*(T1+x^4*T3+...+x^20*T11) + x^5*(x^2*(T2+x^4*T4+...+x^22*T12))
  r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (ix >= 0x3fe59428) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2 * (x - (w * w / (w + v) - r)));
  }
  if (iy === 1) return w;
  z = hiPart(w);                                          // compute -1/(x+r) accurately
  v = r - (z - x);                                        // z+v = r+x
  t = a = -1 / w;
  t = hiPart(t);
  s = 1 + t * z;
  return t + a * (s + t * v);
}

export function sin(x) {
  x = +x;
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kSin(x, 0, 0);             // |x| ~< pi/4
  if (ix >= 0x7ff00000) return NaN;                       // sin(inf or NaN) is NaN
  const n = remPio2(x);
  switch (n & 3) {
    case 0: return kSin(RY[0], RY[1], 1);
    case 1: return kCos(RY[0], RY[1]);
    case 2: return -kSin(RY[0], RY[1], 1);
    default: return -kCos(RY[0], RY[1]);
  }
}

export function cos(x) {
  x = +x;
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kCos(x, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x);
  switch (n & 3) {
    case 0: return kCos(RY[0], RY[1]);
    case 1: return -kSin(RY[0], RY[1], 1);
    case 2: return -kCos(RY[0], RY[1]);
    default: return kSin(RY[0], RY[1], 1);
  }
}

export function tan(x) {
  x = +x;
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kTan(x, 0, 1);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x);
  return kTan(RY[0], RY[1], 1 - ((n & 1) << 1));              // 1: n even, -1: n odd
}

// ── asin, acos (e_asin.c, e_acos.c) ───────────────────────────────────────────────────────────────
const PI = 3.141592653589793;                 // 0x400921FB, 0x54442D18
const PIO2_HI = 1.5707963267948966;           // 0x3FF921FB, 0x54442D18
const PIO2_LO = 6.123233995736766e-17;        // 0x3C91A626, 0x33145C07
const PIO4_HI = 0.7853981633974483;           // 0x3FE921FB, 0x54442D18
const PS0 = 0.16666666666666666;              // 0x3FC55555, 0x55555555
const PS1 = -0.3255658186224009;              // 0xBFD4D612, 0x03EB6F7D
const PS2 = 0.20121253213486293;              // 0x3FC9C155, 0x0E884455
const PS3 = -0.04005553450067941;             // 0xBFA48228, 0xB5688F3B
const PS4 = 7.915349942898145e-4;             // 0x3F49EFE0, 0x7501B288
const PS5 = 3.479331075960212e-5;             // 0x3F023DE1, 0x0DFDF709
const QS1 = -2.403394911734414;               // 0xC0033A27, 0x1C8A2D4B
const QS2 = 2.0209457602335057;               // 0x40002AE5, 0x9C598AC8
const QS3 = -0.6882839716054533;              // 0xBFE6066C, 0x1B8D0159
const QS4 = 0.07703815055590194;              // 0x3FB3B8C5, 0xB12E9282

export function asin(x) {
  x = +x;
  let t = 0, w, p, q, c, r, s;
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {                                 // |x| >= 1
    if (((ix - 0x3ff00000) | loWord(x)) === 0) return x * PIO2_HI + x * PIO2_LO;   // asin(+-1) = +-pi/2
    return NaN;                                           // |x| > 1, or NaN
  }
  if (ix < 0x3fe00000) {                                  // |x| < 0.5
    if (ix < 0x3e400000) return x;                        // |x| < 2^-27
    t = x * x;
    p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
    q = 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
    w = p / q;
    return x + x * w;
  }
  // 1 > |x| >= 0.5
  w = 1 - Math.abs(x);
  t = w * 0.5;
  p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
  q = 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
  s = Math.sqrt(t);
  if (ix >= 0x3fef3333) {                                 // |x| > 0.975
    w = p / q;
    t = PIO2_HI - (2 * (s + s * w) - PIO2_LO);
  } else {
    w = hiPart(s);
    c = (t - w * w) / (s + w);
    r = p / q;
    p = 2 * s * r - (PIO2_LO - 2 * c);
    q = PIO4_HI - 2 * w;
    t = PIO4_HI - (p - q);
  }
  return hx > 0 ? t : -t;
}

export function acos(x) {
  x = +x;
  let z, p, q, r, w, s, c, df;
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {                                 // |x| >= 1
    if (((ix - 0x3ff00000) | loWord(x)) === 0) return hx > 0 ? 0 : PI + 2 * PIO2_LO;   // acos(1) = 0, acos(-1) = pi
    return NaN;
  }
  if (ix < 0x3fe00000) {                                  // |x| < 0.5
    if (ix <= 0x3c600000) return PIO2_HI + PIO2_LO;       // |x| < 2^-57
    z = x * x;
    p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
    q = 1 + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
    r = p / q;
    return PIO2_HI - (x - (PIO2_LO - x * r));
  }
  if (hx < 0) {                                           // x < -0.5
    z = (1 + x) * 0.5;
    p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
    q = 1 + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
    s = Math.sqrt(z);
    r = p / q;
    w = r * s - PIO2_LO;
    return PI - 2 * (s + w);
  }
  z = (1 - x) * 0.5;                                      // x > 0.5
  s = Math.sqrt(z);
  df = hiPart(s);
  c = (z - df * df) / (s + df);
  p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
  q = 1 + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
  r = p / q;
  w = r * s + c;
  return 2 * (df + w);
}

// ── atan, atan2 (s_atan.c, e_atan2.c) ─────────────────────────────────────────────────────────────
const ATANHI = new Float64Array([
  0.4636476090008061,       // 0x3FDDAC67, 0x0561BB4F  atan(0.5) hi
  0.7853981633974483,       // 0x3FE921FB, 0x54442D18  atan(1.0) hi
  0.982793723247329,        // 0x3FEF730B, 0xD281F69B  atan(1.5) hi
  1.5707963267948966,       // 0x3FF921FB, 0x54442D18  atan(inf) hi
]);
const ATANLO = new Float64Array([
  2.2698777452961687e-17,   // 0x3C7A2B7F, 0x222F65E2
  3.061616997868383e-17,    // 0x3C81A626, 0x33145C07
  1.3903311031230998e-17,   // 0x3C700788, 0x7AF0CBBD
  6.123233995736766e-17,    // 0x3C91A626, 0x33145C07
]);
const AT = new Float64Array([
  0.3333333333333293,       // 0x3FD55555, 0x5555550D
  -0.19999999999876483,     // 0xBFC99999, 0x9998EBC4
  0.14285714272503466,      // 0x3FC24924, 0x920083FF
  -0.11111110405462356,     // 0xBFBC71C6, 0xFE231671
  0.09090887133436507,      // 0x3FB745CD, 0xC54C206E
  -0.0769187620504483,      // 0xBFB3B0F2, 0xAF749A6D
  0.06661073137387531,      // 0x3FB10D66, 0xA0D03D51
  -0.058335701337905735,    // 0xBFADDE2D, 0x52DEFD9A
  0.049768779946159324,     // 0x3FA97B4B, 0x24760DEB
  -0.036531572744216916,    // 0xBFA2B444, 0x2C6A6C2F
  0.016285820115365782,     // 0x3F90AD3A, 0xE322DA11
]);

export function atan(x) {
  x = +x;
  let id;
  const hx = hiWord(x), ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {                                 // |x| >= 2^66, or NaN
    if (x !== x) return NaN;
    return hx > 0 ? ATANHI[3] + ATANLO[3] : -ATANHI[3] - ATANLO[3];
  }
  if (ix < 0x3fdc0000) {                                  // |x| < 0.4375
    if (ix < 0x3e400000) return x;                        // |x| < 2^-27
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {                                // |x| < 1.1875
      if (ix < 0x3fe60000) { id = 0; x = (2 * x - 1) / (2 + x); }   // 7/16 <= |x| < 11/16
      else { id = 1; x = (x - 1) / (x + 1); }                       // 11/16 <= |x| < 19/16
    } else if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); }   // |x| < 2.4375
    else { id = 3; x = -1 / x; }                                    // 2.4375 <= |x| < 2^66
  }
  const z = x * x, w = z * z;
  // the sum of AT[i]*z^(i+1), split into odd and even polynomials
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
  return hx < 0 ? -r : r;
}

const PI_O_4 = 0.7853981633974483;            // 0x3FE921FB, 0x54442D18
const PI_O_2 = 1.5707963267948966;            // 0x3FF921FB, 0x54442D18
const PI_LO = 1.2246467991473532e-16;         // 0x3CA1A626, 0x33145C07

export function atan2(y, x) {
  y = +y; x = +x;
  if (x !== x || y !== y) return NaN;
  const hx = hiWord(x), lx = loWord(x), ix = hx & 0x7fffffff;
  const hy = hiWord(y), ly = loWord(y), iy = hy & 0x7fffffff;
  if (hx === 0x3ff00000 && lx === 0) return atan(y);      // x = 1.0
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2);            // 2*sign(x)+sign(y)
  if ((iy | ly) === 0) {                                  // y = 0
    if (m <= 1) return y;                                 // atan(+-0, +anything) = +-0
    return m === 2 ? PI : -PI;                            // atan(+-0, -anything) = +-pi
  }
  if ((ix | lx) === 0) return hy < 0 ? -PI_O_2 : PI_O_2;   // x = 0
  if (ix === 0x7ff00000) {                                // x is inf
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0: return PI_O_4;                            // atan(+inf, +inf)
        case 1: return -PI_O_4;                           // atan(-inf, +inf)
        case 2: return 3 * PI_O_4;                        // atan(+inf, -inf)
        default: return -3 * PI_O_4;                      // atan(-inf, -inf)
      }
    }
    switch (m) {
      case 0: return 0;                                   // atan(+..., +inf)
      case 1: return -0;                                  // atan(-..., +inf)
      case 2: return PI;                                  // atan(+..., -inf)
      default: return -PI;                                // atan(-..., -inf)
    }
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 : PI_O_2;  // y is inf
  // compute y/x
  const k = (iy - ix) >> 20;
  let z;
  if (k > 60) { z = PI_O_2 + 0.5 * PI_LO; m &= 1; }      // |y/x| > 2^60
  else if (hx < 0 && k < -60) z = 0;                      // 0 > |y|/x > -2^-60
  else z = atan(Math.abs(y / x));                         // safe to do y/x
  switch (m) {
    case 0: return z;                                     // atan(+, +)
    case 1: return -z;                                    // atan(-, +)
    case 2: return PI - (z - PI_LO);                      // atan(+, -)
    default: return (z - PI_LO) - PI;                     // atan(-, -)
  }
}

// ── exp, expm1 (e_exp.c, s_expm1.c) ───────────────────────────────────────────────────────────────
const O_THRESHOLD = 709.782712893384;         // 0x40862E42, 0xFEFA39EF
const U_THRESHOLD = -745.1332191019411;       // 0xC0874910, 0xD52D3051
const LN2_HI = 0.6931471803691238;            // 0x3FE62E42, 0xFEE00000
const LN2_LO = 1.9082149292705877e-10;        // 0x3DEA39EF, 0x35793C76
const INVLN2 = 1.4426950408889634;            // 0x3FF71547, 0x652B82FE
const P1 = 0.16666666666666602;               // 0x3FC55555, 0x5555553E
const P2 = -0.0027777777777015593;            // 0xBF66C16C, 0x16BEBD93
const P3 = 6.613756321437934e-5;              // 0x3F11566A, 0xAF25DE2C
const P4 = -1.6533902205465252e-6;            // 0xBEBBBD41, 0xC5D26BF1
const P5 = 4.1381367970572385e-8;             // 0x3E663769, 0x72BEA4D0
const E = 2.718281828459045;                  // 0x4005BF0A, 0x8B145769

export function exp(x) {
  x = +x;
  let hi = 0, lo = 0, k = 0;
  let hx = hiWord(x);
  const xsb = hx >>> 31;                                  // sign bit of x
  hx &= 0x7fffffff;                                       // high word of |x|
  if (hx >= 0x40862e42) {                                 // |x| >= 709.78..., or not finite
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | loWord(x)) !== 0) return NaN;
      return xsb === 0 ? x : 0;                           // exp(+-inf) = {inf, 0}
    }
    if (x > O_THRESHOLD) return Infinity;                 // overflow
    if (x < U_THRESHOLD) return 0;                        // underflow
  }
  if (hx > 0x3fd62e42) {                                  // |x| > 0.5 ln2: reduce
    if (hx < 0x3ff0a2b2) {                                // and |x| < 1.5 ln2
      if (x === 1) return E;                              // V8's: the reduction would round exp(1) up
      if (xsb === 0) { hi = x - LN2_HI; lo = LN2_LO; k = 1; }
      else { hi = x + LN2_HI; lo = -LN2_LO; k = -1; }
    } else {
      k = (INVLN2 * x + (xsb === 0 ? 0.5 : -0.5)) | 0;
      hi = x - k * LN2_HI;                                // k*LN2_HI is exact here
      lo = k * LN2_LO;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {                           // |x| < 2^-28
    return 1 + x;
  }
  // x is now in the primary range
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - ((lo - (x * c) / (2 - c)) - hi);
  if (k >= -1021) return k === 1024 ? y * 2 * TWO1023 : y * POW2[1074 + k];
  return y * POW2[1074 + k + 1000] * TWOM1000;
}

// Scaled Q's: Qn here = 2^n * Qn of the rational approximation, for R(2*z) where z = x*x/2.
const Q1 = -0.03333333333333313;              // 0xBFA11111, 0x111110F4
const Q2 = 0.0015873015872548146;             // 0x3F5A01A0, 0x19FE5585
const Q3 = -7.93650757867488e-5;              // 0xBF14CE19, 0x9EAADBB7
const Q4 = 4.008217827329362e-6;              // 0x3ED0CFCA, 0x86E65239
const Q5 = -2.0109921818362437e-7;            // 0xBE8AFDB7, 0x6E09C32D

export function expm1(x) {
  x = +x;
  let y, hi, lo, c = 0, t, k;
  let hx = hiWord(x);
  const xsb = hx & 0x80000000;                            // sign bit of x
  hx &= 0x7fffffff;                                       // high word of |x|
  if (hx >= 0x4043687a) {                                 // |x| >= 56*ln2, or not finite
    if (hx >= 0x40862e42) {                               // |x| >= 709.78...
      if (hx >= 0x7ff00000) {
        if (((hx & 0xfffff) | loWord(x)) !== 0) return NaN;
        return xsb === 0 ? x : -1;                        // expm1(+-inf) = {inf, -1}
      }
      if (x > O_THRESHOLD) return Infinity;               // overflow
    }
    if (xsb !== 0) return -1;                             // x < -56*ln2
  }
  if (hx > 0x3fd62e42) {                                  // |x| > 0.5 ln2: reduce
    if (hx < 0x3ff0a2b2) {                                // and |x| < 1.5 ln2
      if (xsb === 0) { hi = x - LN2_HI; lo = LN2_LO; k = 1; }
      else { hi = x + LN2_HI; lo = -LN2_LO; k = -1; }
    } else {
      k = (INVLN2 * x + (xsb === 0 ? 0.5 : -0.5)) | 0;
      t = k;
      hi = x - t * LN2_HI;                                // t*LN2_HI is exact here
      lo = t * LN2_LO;
    }
    x = hi - lo;
    c = (hi - x) - lo;
  } else if (hx < 0x3c900000) {                           // |x| < 2^-54
    return x;
  } else k = 0;
  // x is now in the primary range
  const hfx = 0.5 * x;
  const hxs = x * hfx;
  const r1 = 1 + hxs * (Q1 + hxs * (Q2 + hxs * (Q3 + hxs * (Q4 + hxs * Q5))));
  t = 3 - r1 * hfx;
  let e = hxs * ((r1 - t) / (6 - x * t));
  if (k === 0) return x - (x * e - hxs);                  // c is 0
  e = (x * (e - c) - c);
  e -= hxs;
  if (k === -1) return 0.5 * (x - e) - 0.5;
  if (k === 1) {
    if (x < -0.25) return -2 * (e - (x + 0.5));
    return 1 + 2 * (x - e);
  }
  if (k <= -2 || k > 56) {                                // exp(x)-1 suffices
    y = 1 - (e - x);
    if (k === 1024) y = y * 2 * TWO1023;
    else y = y * POW2[1074 + k];
    return y - 1;
  }
  if (k < 20) {
    t = 1 - POW2[1074 - k];                               // 1-2^-k
    y = t - (e - x);
    y = y * POW2[1074 + k];
  } else {
    t = POW2[1074 - k];                                   // 2^-k
    y = x - (e + t);
    y += 1;
    y = y * POW2[1074 + k];
  }
  return y;
}

// ── log, log1p, log2, log10 (e_log.c, s_log1p.c, e_log2.c + k_log.h, fdlibm 5.3's e_log10.c) ─────────
const TWO54 = 18014398509481984;              // 0x43500000, 0x00000000
const LG1 = 0.6666666666666735;               // 0x3FE55555, 0x55555593
const LG2 = 0.3999999999940942;               // 0x3FD99999, 0x9997FA04
const LG3 = 0.2857142874366239;               // 0x3FD24924, 0x94229359
const LG4 = 0.22222198432149784;              // 0x3FCC71C5, 0x1D8E78AF
const LG5 = 0.1818357216161805;               // 0x3FC74664, 0x96CB03DE
const LG6 = 0.15313837699209373;              // 0x3FC39A09, 0xD078C69F
const LG7 = 0.14798198605116586;              // 0x3FC2F112, 0xDF3E5244

export function log(x) {
  x = +x;
  let k = 0, dk;
  let hx = hiWord(x);
  const lx = loWord(x);
  if (hx < 0x00100000) {                                  // x < 2^-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;   // log(+-0) = -inf
    if (hx < 0) return NaN;                               // log(-#) = NaN
    k -= 54; x *= TWO54;                                  // subnormal: scale up
    hx = hiWord(x);
  }
  if (hx >= 0x7ff00000) return x === x ? x : NaN;         // +inf, or NaN
  const ex = (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  x *= POW2[1074 - ex - (i >> 20)];                       // normalize x or x/2 (SET_HIGH_WORD's bits, by scaling)
  k += ex + (i >> 20);
  const f = x - 1;
  if ((0x000fffff & (2 + hx)) < 3) {                      // -2^-20 <= f < 2^-20
    if (f === 0) {
      if (k === 0) return 0;
      dk = k;
      return dk * LN2_HI + dk * LN2_LO;
    }
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    if (k === 0) return f - R;
    dk = k;
    return dk * LN2_HI - ((R - dk * LN2_LO) - f);
  }
  const s = f / (2 + f);
  dk = k;
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * LN2_HI - ((hfsq - (s * (hfsq + R) + dk * LN2_LO)) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * LN2_HI - ((s * (f - R) - dk * LN2_LO) - f);
}

export function log1p(x) {
  x = +x;
  let f = 0, c = 0, hu = 0, k = 1, u;
  const hx = hiWord(x), ax = hx & 0x7fffffff;
  if (hx < 0x3fda827a) {                                  // 1+x < sqrt(2)+
    if (ax >= 0x3ff00000) {                               // x <= -1.0
      if (x === -1) return -Infinity;                     // log1p(-1) = -inf
      return NaN;                                         // log1p(x < -1) = NaN
    }
    if (ax < 0x3e200000) {                                // |x| < 2^-29
      if (ax < 0x3c900000) return x;                      // |x| < 2^-54
      return x - x * x * 0.5;
    }
    if (hx > 0 || hx <= (0xbfd2bec4 | 0)) { k = 0; f = x; hu = 1; }   // sqrt(2)/2- <= 1+x < sqrt(2)+
  }
  if (hx >= 0x7ff00000) return x === x ? x : NaN;         // +inf, or NaN
  if (k !== 0) {
    if (hx < 0x43400000) {
      u = 1 + x;
      hu = hiWord(u);
      k = (hu >> 20) - 1023;
      c = k > 0 ? 1 - (u - x) : x - (u - 1);              // correction term
      c /= u;
    } else {
      u = x;
      hu = hiWord(u);
      k = (hu >> 20) - 1023;
      c = 0;
    }
    hu &= 0x000fffff;
    // The thresholds above must give less strict bounds than this one, so the k == 0 case is never
    // reached from here: here the correction term is committed to, and k == 0 would not use it.
    if (hu < 0x6a09e) {                                   // u ~< sqrt(2)
      u *= POW2[1074 - k];                                // normalize u
    } else {
      k += 1;
      u *= POW2[1074 - k];                                // normalize u/2
      hu = (0x00100000 - hu) >> 2;
    }
    f = u - 1;
  }
  const hfsq = 0.5 * f * f;
  if (hu === 0) {                                         // |f| < 2^-20
    if (f === 0) {
      if (k === 0) return 0;
      c += k * LN2_LO;
      return k * LN2_HI + c;
    }
    const R = hfsq * (1 - 0.6666666666666666 * f);
    if (k === 0) return f - R;
    return k * LN2_HI - ((R - (k * LN2_LO + c)) - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  const R = z * (LG1 + z * (LG2 + z * (LG3 + z * (LG4 + z * (LG5 + z * (LG6 + z * LG7))))));
  if (k === 0) return f - (hfsq - s * (hfsq + R));
  return k * LN2_HI - ((hfsq - (s * (hfsq + R) + (k * LN2_LO + c))) - f);
}

// k_log.h: log(1+f) - f + f*f/2, for 1+f in [sqrt(2)/2, sqrt(2)].
function kLog1p(f) {
  const s = f / (2 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1;
  const hfsq = 0.5 * f * f;
  return s * (hfsq + R);
}

const IVLN2HI = 1.4426950407214463;           // 0x3FF71547, 0x65200000
const IVLN2LO = 1.6751713164886512e-10;       // 0x3DE705FC, 0x2EEFA200

export function log2(x) {
  x = +x;
  let k = 0;
  let hx = hiWord(x);
  const lx = loWord(x);
  if (hx < 0x00100000) {                                  // x < 2^-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54; x *= TWO54;
    hx = hiWord(x);
  }
  if (hx >= 0x7ff00000) return x === x ? x : NaN;         // +inf, or NaN
  if (hx === 0x3ff00000 && lx === 0) return 0;            // log2(1) = +0
  const ex = (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x *= POW2[1074 - ex - (i >> 20)];                       // normalize x or x/2
  k += ex + (i >> 20);
  const y = k;
  const f = x - 1;
  const hfsq = 0.5 * f * f;
  const r = kLog1p(f);
  // f-hfsq in extra precision (hi+lo) against the cancellation near sqrt(2) and 1/sqrt(2); then y+val_hi
  // is normalised with Dekker's two-sum. See e_log2.c.
  const hi = hiPart(f - hfsq);
  const lo = (f - hi) - hfsq + r;
  let valHi = hi * IVLN2HI;
  let valLo = (lo + hi) * IVLN2LO + lo * IVLN2HI;
  const w = y + valHi;
  valLo += (y - w) + valHi;
  valHi = w;
  return valLo + valHi;
}

const IVLN10 = 0.4342944819032518;            // 0x3FDBCB7B, 0x1526E50E
const LOG10_2HI = 0.30102999566361177;        // 0x3FD34413, 0x509F6000
const LOG10_2LO = 3.694239077158931e-13;      // 0x3D59FEF3, 0x11F12B36

// log10(x) = n*log10(2) + log10(m): n*LOG10_2HI is exact for |n| < 2^13, and m is taken in [1, 2) for
// n >= 0 or [1/2, 1) for n < 0, so log10(10^N) = N for N = 0..22.
export function log10(x) {
  x = +x;
  let k = 0;
  let hx = hiWord(x), lx = loWord(x);
  if (hx < 0x00100000) {                                  // x < 2^-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54; x *= TWO54;
    hx = hiWord(x); lx = loWord(x);
  }
  if (hx >= 0x7ff00000) return x === x ? x : NaN;         // +inf, or NaN
  if (hx === 0x3ff00000 && lx === 0) return 0;            // log10(1) = +0
  const ex = (hx >> 20) - 1023;
  k += ex;
  const i = k >>> 31;
  const y = k + i;
  x *= POW2[1074 - ex - i];                               // exponent 0x3ff-i: m in [1, 2) or [1/2, 1)
  const z = y * LOG10_2LO + IVLN10 * log(x);
  return z + y * LOG10_2HI;
}

// ── cbrt (s_cbrt.c) ───────────────────────────────────────────────────────────────────────────────
const B1 = 715094163;                         // (1023-1023/3-0.03306235651)*2^20
const B2 = 696219795;                         // (1023-1023/3-54/3-0.03306235651)*2^20
// |1/cbrt(x) - p(x)| < 2^-23.5
const CP0 = 1.87595182427177;                 // 0x3FFE03E6, 0x0F61E692
const CP1 = -1.8849797954337717;              // 0xBFFE28E0, 0x92F02420
const CP2 = 1.6214297201053545;               // 0x3FF9F160, 0x4A49D6C2
const CP3 = -0.758397934778766;               // 0xBFE844CB, 0xBEE751D9
const CP4 = 0.14599619288661245;              // 0x3FC2B000, 0xD4E4EDD7

export function cbrt(x) {
  x = +x;
  let hx = hiWord(x);
  const low = loWord(x);
  const sign = hx & 0x80000000;                           // sign of x
  hx ^= sign;
  if (hx >= 0x7ff00000) return x === x ? x : NaN;         // cbrt(+-inf) is itself
  let t;
  // Rough cbrt to 5 bits: dividing the biased exponent's bits by 3 (s_cbrt.c explains the bias).
  if (hx < 0x00100000) {                                  // zero or subnormal
    if ((hx | low) === 0) return x;                       // cbrt(+-0) is itself
    t = TWO54 * x;
    t = fromHi(sign | (((hiWord(t) & 0x7fffffff) / 3 | 0) + B2));
  } else {
    t = fromHi(sign | ((hx / 3 | 0) + B1));
  }
  // New cbrt to 23 bits: cbrt(x) = t*cbrt(x/t^3) ~= t*P(t^3/x).
  let r = (t * t) * (t / x);
  t = t * ((CP0 + r * (CP1 + r * CP2)) + ((r * r) * r) * (CP3 + r * CP4));
  // Round t away from zero to 23 bits: the 64-bit (bits + 0x80000000) & 0xffffffffc0000000, on words.
  const tlo = loWord(t);
  t = fromWords(hiWord(t) + (tlo >= 0x80000000 ? 1 : 0), (tlo + 0x80000000) & 0xc0000000);
  // One Newton step to 53 bits, error < 0.667 ulps.
  const s = t * t;                                        // t*t is exact
  r = x / s;                                              // error <= 0.5 ulps; |r| < |t|
  const w = t + t;                                        // t+t is exact
  r = (r - t) / (w + r);                                  // r-t is exact; w+r ~= 3*t
  return t + t * r;                                       // error <= 0.5 + 0.5/3 + epsilon
}

// ── sinh, cosh (fdlibm 5.3's e_sinh.c, e_cosh.c), tanh (s_tanh.c) ─────────────────────────────────
// Past log(DBL_MAX) the result is exp(|x|/2)^2/2, up to the overflow threshold 0x408633CE, 0x8FB9F87D.
export function sinh(x) {
  x = +x;
  const jx = hiWord(x), ix = jx & 0x7fffffff;
  if (ix >= 0x7ff00000) return x === x ? x : NaN;         // sinh(+-inf) is itself
  const h = jx < 0 ? -0.5 : 0.5;
  if (ix < 0x40360000) {                                  // |x| < 22: sign(x)*0.5*(E+E/(E+1)), E = expm1(|x|)
    if (ix < 0x3e300000) return x;                        // |x| < 2^-28
    const t = expm1(Math.abs(x));
    if (ix < 0x3ff00000) return h * (2 * t - t * t / (t + 1));
    return h * (t + t / (t + 1));
  }
  if (ix < 0x40862e42) return h * exp(Math.abs(x));       // |x| in [22, log(maxdouble)]
  if (ix < 0x408633ce || (ix === 0x408633ce && loWord(x) <= 0x8fb9f87d)) {
    const w = exp(0.5 * Math.abs(x));
    const t = h * w;
    return t * w;
  }
  return x * 1e307;                                       // overflow
}

export function cosh(x) {
  x = +x;
  const ix = hiWord(x) & 0x7fffffff;
  if (ix >= 0x7ff00000) return x === x ? Infinity : NaN;  // cosh(+-inf) = inf
  if (ix < 0x3fd62e43) {                                  // |x| < 0.5*ln2: 1+expm1(|x|)^2/(2*exp(|x|))
    const t = expm1(Math.abs(x));
    const w = 1 + t;
    if (ix < 0x3c800000) return w;                        // cosh(tiny) = 1
    return 1 + (t * t) / (w + w);
  }
  if (ix < 0x40360000) {                                  // |x| < 22: (exp(|x|)+1/exp(|x|))/2
    const t = exp(Math.abs(x));
    return 0.5 * t + 0.5 / t;
  }
  if (ix < 0x40862e42) return 0.5 * exp(Math.abs(x));     // |x| in [22, log(maxdouble)]
  if (ix < 0x408633ce || (ix === 0x408633ce && loWord(x) <= 0x8fb9f87d)) {
    const w = exp(0.5 * Math.abs(x));
    const t = 0.5 * w;
    return t * w;
  }
  return Infinity;                                        // overflow
}

export function tanh(x) {
  x = +x;
  let z;
  const jx = hiWord(x), ix = jx & 0x7fffffff;
  if (ix >= 0x7ff00000) return x !== x ? NaN : jx >= 0 ? 1 : -1;   // tanh(+-inf) = +-1
  if (ix < 0x40360000) {                                  // |x| < 22
    if (ix < 0x3e300000) return x;                        // |x| < 2^-28
    if (ix >= 0x3ff00000) {                               // |x| >= 1
      const t = expm1(2 * Math.abs(x));
      z = 1 - 2 / (t + 2);
    } else {
      const t = expm1(-2 * Math.abs(x));
      z = -t / (t + 2);
    }
  } else z = 1;                                           // |x| >= 22: +-1
  return jx >= 0 ? z : -z;
}

// ── pow (fdlibm 5.3's e_pow.c) ────────────────────────────────────────────────────────────────────
// x^y = 2^(y*log2(x)): log2(x) in two pieces (the first with 29 trailing zero bits), y*log2(x) = n + y'
// in simulated extra precision with |y'| <= 0.5, then 2^n * exp(y'*ln2). pow(integer, integer) is exact
// whenever the result is representable. fdlibm 5.3's special cases are ECMAScript's: any NaN but
// pow(NaN, +-0) = 1 gives NaN, and pow(+-1, +-inf) is NaN.
const DP_H1 = 0.5849624872207642;             // 0x3FE2B803, 0x40000000  log2(1.5) hi
const DP_L1 = 1.350039202129749e-8;           // 0x3E4CFDEB, 0x43CFD006  log2(1.5) lo
const TWO53 = 9007199254740992;               // 0x43400000, 0x00000000
const HUGE = 1e300, TINY = 1e-300;
// poly coefficients for (3/2)*(log(x)-2s-2/3*s^3)
const L1 = 0.5999999999999946;                // 0x3FE33333, 0x33333303
const L2 = 0.4285714285785502;                // 0x3FDB6DB6, 0xDB6FABFF
const L3 = 0.33333332981837743;               // 0x3FD55555, 0x518F264D
const L4 = 0.272728123808534;                 // 0x3FD17460, 0xA91D4101
const L5 = 0.23066074577556175;               // 0x3FCD864A, 0x93C9DB65
const L6 = 0.20697501780033842;               // 0x3FCA7E28, 0x4A454EEF
const LG2_ = 0.6931471805599453;              // 0x3FE62E42, 0xFEFA39EF
const LG2_H = 0.6931471824645996;             // 0x3FE62E43, 0x00000000
const LG2_L = -1.904654299957768e-9;          // 0xBE205C61, 0x0CA86C39
const OVT = 8.008566259537294e-17;            // 0x3C971547, 0x652B82FE  -(1024-log2(ovfl+.5ulp))
const CP = 0.9617966939259756;                // 0x3FEEC709, 0xDC3A03FD  2/(3ln2)
const CP_H = 0.9617967009544373;              // 0x3FEEC709, 0xE0000000  (float)CP
const CP_L = -7.028461650952758e-9;           // 0xBE3E2FE0, 0x145B01F5  tail of CP_H
const IVLN2 = 1.4426950408889634;             // 0x3FF71547, 0x652B82FE  1/ln2
const IVLN2_H = 1.4426950216293335;           // 0x3FF71547, 0x60000000  24 bits of 1/ln2
const IVLN2_L = 1.9259629911266175e-8;        // 0x3E54AE0B, 0xF85DDF44  1/ln2 tail

export function pow(x, y) {
  x = +x; y = +y;
  let z, ax, zH, zL, pH, pL, y1, t1, t2, r, s, t, u, v, w, i, j, k, n;
  let hx = hiWord(x);
  const lx = loWord(x);
  const hy = hiWord(y), ly = loWord(y);
  let ix = hx & 0x7fffffff;
  const iy = hy & 0x7fffffff;

  if ((iy | ly) === 0) return 1;                          // x^+-0 = 1, even for NaN
  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) {
    return NaN;
  }
  // yisint = 0: y is not an integer, 1: an odd integer, 2: an even integer (only needed for x < 0)
  let yisint = 0;
  if (hx < 0) {
    if (iy >= 0x43400000) yisint = 2;                     // |y| >= 2^53: even
    else if (iy >= 0x3ff00000) {
      k = (iy >> 20) - 0x3ff;                             // exponent
      if (k > 20) {
        j = ly >>> (52 - k);
        if (((j << (52 - k)) >>> 0) === ly) yisint = 2 - (j & 1);
      } else if (ly === 0) {
        j = iy >> (20 - k);
        if ((j << (20 - k)) === iy) yisint = 2 - (j & 1);
      }
    }
  }
  // special values of y
  if (ly === 0) {
    if (iy === 0x7ff00000) {                              // y is +-inf
      if (((ix - 0x3ff00000) | lx) === 0) return NaN;     // (+-1)^+-inf is NaN
      if (ix >= 0x3ff00000) return hy >= 0 ? y : 0;       // (|x|>1)^+-inf = inf, 0
      return hy < 0 ? -y : 0;                             // (|x|<1)^-,+inf = inf, 0
    }
    if (iy === 0x3ff00000) return hy < 0 ? 1 / x : x;     // y is +-1
    if (hy === 0x40000000) return x * x;                  // y is 2
    if (hy === 0x3fe00000 && hx >= 0) return Math.sqrt(x);   // y is 0.5, x >= +0
  }
  ax = Math.abs(x);
  // special values of x
  if (lx === 0 && (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000)) {   // x is +-0, +-inf, +-1
    z = ax;
    if (hy < 0) z = 1 / z;                                // z = 1/|x|
    if (hx < 0) {
      if (((ix - 0x3ff00000) | yisint) === 0) z = NaN;    // (-1)^non-int is NaN
      else if (yisint === 1) z = -z;                      // (x<0)^odd = -(|x|^odd)
    }
    return z;
  }
  n = (hx >>> 31) - 1;
  if ((n | yisint) === 0) return NaN;                     // (x<0)^(non-int) is NaN
  s = 1;                                                  // the sign of the result: -1 for (-ve)^(odd int)
  if ((n | (yisint - 1)) === 0) s = -1;

  if (iy > 0x41e00000) {                                  // |y| > 2^31
    if (iy > 0x43f00000) {                                // |y| > 2^64: must over/underflow
      if (ix <= 0x3fefffff) return hy < 0 ? HUGE * HUGE : TINY * TINY;
      if (ix >= 0x3ff00000) return hy > 0 ? HUGE * HUGE : TINY * TINY;
    }
    // over/underflow if x is not close to one
    if (ix < 0x3fefffff) return hy < 0 ? s * HUGE * HUGE : s * TINY * TINY;
    if (ix > 0x3ff00000) return hy > 0 ? s * HUGE * HUGE : s * TINY * TINY;
    // now |1-x| is tiny <= 2^-20: log(x) by x-x^2/2+x^3/3-x^4/4 suffices
    t = ax - 1;                                           // t has 20 trailing zeros
    w = (t * t) * (0.5 - t * (0.3333333333333333 - t * 0.25));
    u = IVLN2_H * t;                                      // IVLN2_H has 21 significant bits
    v = t * IVLN2_L - w * IVLN2;
    t1 = hiPart(u + v);
    t2 = v - (t1 - u);
  } else {
    n = 0;
    if (ix < 0x00100000) { ax *= TWO53; n -= 53; ix = hiWord(ax); }   // subnormal x
    let ex = (ix >> 20) - 0x3ff;
    n += ex;
    j = ix & 0x000fffff;
    // determine the interval
    ix = j | 0x3ff00000;                                  // normalize ix
    if (j <= 0x3988e) k = 0;                              // |x| < sqrt(3/2)
    else if (j < 0xbb67a) k = 1;                          // |x| < sqrt(3)
    else { k = 0; n += 1; ix -= 0x00100000; ex += 1; }
    ax *= POW2[1074 - ex];                                // SET_HIGH_WORD(ax, ix), by scaling
    // ss = s_h+s_l = (x-1)/(x+1) or (x-1.5)/(x+1.5)
    const bp = k === 0 ? 1 : 1.5;
    u = ax - bp;
    v = 1 / (ax + bp);
    const ss = u * v;
    const sH = hiPart(ss);
    let tH = fromHi(((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18));   // ax+bp, high part
    let tL = ax - (tH - bp);
    const sL = v * ((u - sH * tH) - sH * tL);
    // log(ax)
    let s2 = ss * ss;
    r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += sL * (sH + ss);
    s2 = sH * sH;
    tH = hiPart(3 + s2 + r);
    tL = r - ((tH - 3) - s2);
    // u+v = ss*(1+...)
    u = sH * tH;
    v = sL * tH + tL * ss;
    // 2/(3log2)*(ss+...)
    pH = hiPart(u + v);
    pL = v - (pH - u);
    zH = CP_H * pH;                                       // CP_H+CP_L = 2/(3*log2)
    zL = CP_L * pH + pL * CP + (k === 0 ? 0 : DP_L1);
    // log2(ax) = (ss+..)*2/(3*log2) = n + dp_h + zH + zL
    const dpH = k === 0 ? 0 : DP_H1;
    t = n;
    t1 = hiPart(((zH + zL) + dpH) + t);
    t2 = zL - (((t1 - t) - dpH) - zH);
  }
  // split y into y1+y2 and compute (y1+y2)*(t1+t2)
  y1 = hiPart(y);
  pL = (y - y1) * t1 + y * t2;
  pH = y1 * t1;
  z = pL + pH;
  j = hiWord(z);
  const zlo = loWord(z);
  if (j >= 0x40900000) {                                  // z >= 1024
    if (j !== 0x40900000 || zlo !== 0) return s * HUGE * HUGE;   // z > 1024: overflow
    if (pL + OVT > z - pH) return s * HUGE * HUGE;
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {            // z <= -1075
    if (j !== (0xc090cc00 | 0) || zlo !== 0) return s * TINY * TINY;   // z < -1075: underflow
    if (pL <= z - pH) return s * TINY * TINY;
  }
  // compute 2^(pH+pL)
  i = j & 0x7fffffff;
  k = (i >> 20) - 0x3ff;
  n = 0;
  if (i > 0x3fe00000) {                                   // |z| > 0.5: n = [z+0.5]
    n = j + (0x00100000 >> (k + 1));
    k = ((n & 0x7fffffff) >> 20) - 0x3ff;                 // new k for n
    t = fromHi(n & ~(0x000fffff >> k));
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - k);
    if (j < 0) n = -n;
    pH -= t;
  }
  t = hiPart(pL + pH);
  u = t * LG2_H;
  v = (pL - (t - pH)) * LG2_ + t * LG2_L;
  z = u + v;
  w = v - (z - u);
  t = z * z;
  t1 = z - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  r = (z * t1) / (t1 - 2) - (w + z * w);
  z = 1 - (r - z);
  // times 2^n: SET_HIGH_WORD's exact scaling, or scalbn's single rounding into the subnormals
  return s * (n >= -1022 && n <= 1023 ? z * POW2[1074 + n] : scalbn(z, n));
}

// ── hypot (V8's Math.hypot, src/builtins/math.tq) ─────────────────────────────────────────────────
// Any +-inf gives +inf even beside a NaN, then any NaN gives NaN, all zeros give +0; otherwise each |v|
// is divided by the largest, the squares are summed in argument order with Kahan compensation, and the
// root is scaled back: sqrt(sum)*max. Two and three arguments are the same arithmetic without the array.
export function hypot(a, b) {
  const n = arguments.length;
  if (n === 2) {
    a = Math.abs(+a); b = Math.abs(+b);
    if (a === Infinity || b === Infinity) return Infinity;
    if (a !== a || b !== b) return NaN;
    const max = a > b ? a : b;
    if (max === 0) return 0;
    const na = a / max, nb = b / max;
    return Math.sqrt(na * na + nb * nb) * max;
  }
  if (n === 3) {
    a = Math.abs(+a); b = Math.abs(+b);
    const c = Math.abs(+arguments[2]);
    if (a === Infinity || b === Infinity || c === Infinity) return Infinity;
    if (a !== a || b !== b || c !== c) return NaN;
    let max = a > b ? a : b;
    if (c > max) max = c;
    if (max === 0) return 0;
    const na = a / max, nb = b / max, nc = c / max;
    const pa = na * na, pb = nb * nb;
    const comp = (pa + pb) - pa - pb;
    return Math.sqrt(pa + pb + (nc * nc - comp)) * max;
  }
  const abs = new Float64Array(n);
  let max = 0, nan = false;
  for (let i = 0; i < n; i++) {
    const v = +arguments[i];
    if (v !== v) nan = true;
    else {
      abs[i] = Math.abs(v);
      if (abs[i] > max) max = abs[i];
    }
  }
  if (max === Infinity) return Infinity;
  if (nan) return NaN;
  if (max === 0) return 0;
  let sum = 0, comp = 0;
  for (let i = 0; i < n; i++) {
    const v = abs[i] / max;
    const summand = v * v - comp;
    const prelim = sum + summand;
    comp = (prelim - sum) - summand;
    sum = prelim;
  }
  return Math.sqrt(sum) * max;
}
