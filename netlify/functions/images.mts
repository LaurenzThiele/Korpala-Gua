import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { errorResponse } from './_lib/response.mts';

export default async (req: Request) => {
  const filename = decodeURIComponent(new URL(req.url).pathname.split('/').pop() ?? '');
  if (!filename) return errorResponse('filename wajib diisi.', 400);
  const store = getStore('cave-images');

  const blob = await store.getWithMetadata(filename, { type: 'arrayBuffer' });
  if (!blob) return errorResponse('File tidak ditemukan.', 404);

  const contentType = (blob.metadata?.contentType as string | undefined) ?? 'application/octet-stream';
  return new Response(blob.data, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config: Config = { path: '/api/images/:filename' };
