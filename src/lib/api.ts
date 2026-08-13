import type { Cave } from '../types/cave';

// authClient.getSession() only exposes Neon Auth's opaque session token (session.token),
// which our backend can't verify. The actual JWT is returned via the `set-auth-jwt`
// response header on a direct call to the auth server's /get-session — this is how the
// session cookie set by authClient.signIn.email() gets exchanged for a bearer token.
async function authHeader(): Promise<Record<string, string>> {
  const res = await fetch(`${import.meta.env.VITE_NEON_AUTH_URL}/get-session`, {
    credentials: 'include',
  });
  const token = res.headers.get('set-auth-jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getCaves(): Promise<Cave[]> {
  const res = await fetch('/api/caves');
  return handle<Cave[]>(res);
}

export async function getCave(id: string | number): Promise<Cave> {
  const res = await fetch(`/api/caves/${id}`);
  return handle<Cave>(res);
}

export async function createCave(payload: Partial<Cave>): Promise<Cave> {
  const res = await fetch('/api/caves', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
  });
  return handle<Cave>(res);
}

export async function updateCave(id: number, payload: Partial<Cave>): Promise<Cave> {
  const res = await fetch(`/api/caves/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
  });
  return handle<Cave>(res);
}

export async function deleteCave(id: number): Promise<void> {
  const res = await fetch(`/api/caves/${id}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  await handle(res);
}

export async function uploadFile(filename: string, file: File): Promise<void> {
  const res = await fetch(`/api/upload/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'application/octet-stream', ...(await authHeader()) },
    body: file,
  });
  await handle(res);
}

export async function deleteFile(filename: string): Promise<void> {
  const res = await fetch(`/api/upload/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  await handle(res);
}

export function getImageUrl(id: number, ext: string): string {
  return `/api/images/${id}.${ext}`;
}
