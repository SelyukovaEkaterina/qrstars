import type { APIRoute } from 'astro';
import { buildOpenApiSpec } from '../../../src/lib/public-api/openapi';

/** Та же спецификация, что отдаёт кабинет на /api/v1/openapi.json. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildOpenApiSpec(), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
