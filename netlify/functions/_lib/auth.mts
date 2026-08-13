import * as jose from 'jose';

const rawAuthUrl = process.env.VITE_NEON_AUTH_URL;
if (!rawAuthUrl) throw new Error('VITE_NEON_AUTH_URL is not set');
const authUrl: string = rawAuthUrl;

const jwks = jose.createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));

// Neon Auth has no console toggle (yet) to disable public sign-up, so a valid JWT alone only proves
// "this person authenticated with Neon Auth" — not that they're one of the admins. This allowlist is
// the actual authorization boundary for write access.
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);

export class AuthError extends Error {}

// Verifies the caller's Neon Auth JWT and that it belongs to an allowlisted admin. Throws AuthError if
// missing/invalid/not-allowlisted — callers should catch this and respond with errorResponse(err.message, 401).
export async function requireUser(req: Request): Promise<string> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Anda harus masuk untuk melakukan ini.');
  }

  const token = header.slice('Bearer '.length);
  try {
    const { payload } = await jose.jwtVerify(token, jwks, { issuer: new URL(authUrl).origin });
    if (typeof payload.sub !== 'string') throw new Error('missing sub claim');
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!adminEmails.has(email)) throw new Error('not an admin');
    return payload.sub;
  } catch {
    throw new AuthError('Sesi tidak valid atau telah berakhir. Silakan masuk kembali.');
  }
}
