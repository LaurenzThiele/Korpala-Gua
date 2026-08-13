import type { Config } from '@netlify/functions';
import { sql } from './_lib/db.mts';
import { json, errorResponse } from './_lib/response.mts';
import { requireUser, AuthError } from './_lib/auth.mts';

export default async (req: Request) => {
  if (req.method === 'GET') {
    const caves = await sql`SELECT * FROM caves ORDER BY name ASC`;
    return json(caves);
  }

  if (req.method === 'POST') {
    try {
      await requireUser(req);
    } catch (err) {
      if (err instanceof AuthError) return errorResponse(err.message, 401);
      throw err;
    }

    const body = await req.json();
    const { name, region, type, depth_m, description, utm_x, utm_y } = body;
    if (!name || !region || !type || utm_x == null || utm_y == null) {
      return errorResponse('Data tidak lengkap.', 400);
    }

    const [cave] = await sql`
      INSERT INTO caves (name, region, type, depth_m, description, utm_x, utm_y)
      VALUES (${name}, ${region}, ${type}, ${depth_m ?? 0}, ${description ?? ''}, ${utm_x}, ${utm_y})
      RETURNING *
    `;
    return json(cave, 201);
  }

  return errorResponse('Method not allowed', 405);
};

export const config: Config = { path: '/api/caves' };
