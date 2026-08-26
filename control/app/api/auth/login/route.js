import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthEnabled,
} from '@/lib/auth/session';
import { rolesEnabled, resolveBearerUser } from '@/lib/roles/keys';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: false, reason: 'auth_disabled' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const userMatch = safeEqual(username, process.env.CONTROL_PLANE_USER);
  const passMatch = safeEqual(password, process.env.CONTROL_PLANE_PASSWORD);

  // Delegate login (roles pack Phase 4): with roles enabled, a delegate signs
  // in with their key NAME as the username and their bearer key (mjr_…) as the
  // password. Claims carry their id + role + token epoch — bumping the epoch
  // (revoke_role_key) kills their sessions lazily at the Node layer.
  let claims = null;
  if (userMatch && passMatch) {
    claims = { u: 'local', r: 'admin' };
  } else if (rolesEnabled()) {
    const delegate = resolveBearerUser(password);
    if (delegate && safeEqual(username, delegate.name)) {
      claims = { u: delegate.id, r: delegate.role, e: delegate.tokenEpoch };
    }
  }
  if (!claims) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createSessionToken(process.env.CONTROL_PLANE_PASSWORD, { claims });
  const res = NextResponse.json({ ok: true });
  const secure = new URL(req.url).protocol === 'https:';
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
