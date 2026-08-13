import type { Config } from '@netlify/functions';
import { sql } from './_lib/db.mts';
import { json, errorResponse } from './_lib/response.mts';
import { requireUser, AuthError } from './_lib/auth.mts';

export default async (req: Request) => {
  const id = Number(new URL(req.url).pathname.split('/').pop());
  if (!Number.isInteger(id)) return errorResponse('ID tidak valid.', 400);

  if (req.method === 'GET') {
    const [cave] = await sql`SELECT * FROM caves WHERE id = ${id}`;
    if (!cave) return errorResponse('Gua tidak ditemukan.', 404);
    return json(cave);
  }

  try {
    await requireUser(req);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.message, 401);
    throw err;
  }

  if (req.method === 'PUT') {
    const [existing] = await sql`SELECT * FROM caves WHERE id = ${id}`;
    if (!existing) return errorResponse('Gua tidak ditemukan.', 404);

    const body = await req.json();
    const merged = { ...existing, ...body };
    const [cave] = await sql`
      UPDATE caves SET
        name = ${merged.name}, region = ${merged.region}, type = ${merged.type},
        depth_m = ${merged.depth_m}, description = ${merged.description},
        utm_x = ${merged.utm_x}, utm_y = ${merged.utm_y}, image_ext = ${merged.image_ext}
      WHERE id = ${id}
      RETURNING *
    `;
    return json(cave);
  }

  if (req.method === 'DELETE') {
    const [cave] = await sql`DELETE FROM caves WHERE id = ${id} RETURNING id`;
    if (!cave) return errorResponse('Gua tidak ditemukan.', 404);
    return json({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
};

export const config: Config = { path: '/api/caves/:id' };
