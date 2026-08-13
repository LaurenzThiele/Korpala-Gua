import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { json, errorResponse } from './_lib/response.mts';
import { requireUser, AuthError } from './_lib/auth.mts';

export default async (req: Request) => {
  try {
    await requireUser(req);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, 401);
    throw err;
  }

  const filename = decodeURIComponent(new URL(req.url).pathname.split('/').pop() ?? '');
  if (!filename) return errorResponse('filename wajib diisi.', 400);
  const store = getStore('cave-images');

  if (req.method === 'PUT') {
    const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
    const buf = await req.arrayBuffer();
    await store.set(filename, buf, { metadata: { contentType } });
    return json({ ok: true, filename });
  }

  if (req.method === 'DELETE') {
    await store.delete(filename);
    return json({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
};

export const config: Config = { path: '/api/upload/:filename' };
