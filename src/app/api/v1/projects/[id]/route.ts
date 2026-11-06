import prisma from "@/lib/prisma";
import { invalidateScanCache } from "@/lib/cache";
import { establishmentAccessWhere } from "@/lib/establishment-access";
import {
  apiError,
  apiJson,
  apiOptions,
  readJsonObject,
  withApiAuth,
} from "@/lib/public-api/auth";
import { parseProjectInput } from "@/lib/public-api/project-input";
import { serializeProject } from "@/lib/public-api/serialize";
import { logUserEvent } from "@/lib/user-events-server";

type RouteContext = { params: Promise<{ id: string }> };

export const OPTIONS = apiOptions;

async function findProject(id: string, userId: string) {
  return prisma.establishment.findFirst({
    where: { id, ...establishmentAccessWhere(userId) },
    include: {
      _count: { select: { qrcodes: true, reviews: true } },
      qrcodes: { select: { scansCount: true, code: true } },
    },
  });
}

function counts(p: NonNullable<Awaited<ReturnType<typeof findProject>>>) {
  return {
    qrcodes: p._count.qrcodes,
    reviews: p._count.reviews,
    totalScans: p.qrcodes.reduce((sum, q) => sum + q.scansCount, 0),
  };
}

export const GET = withApiAuth<RouteContext>(async (_request, { userId }, context) => {
  const { id } = await context.params;
  const project = await findProject(id, userId);
  if (!project) return apiError(404, "not_found", "Проект не найден");
  return apiJson({ project: serializeProject(project, userId, counts(project)) });
});

export const PATCH = withApiAuth<RouteContext>(async (request, { userId }, context) => {
  const { id } = await context.params;
  const project = await findProject(id, userId);
  if (!project) return apiError(404, "not_found", "Проект не найден");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "invalid_request", "Тело запроса — JSON-объект");
  const parsed = parseProjectInput(body, { requireName: false });
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);

  const updated = await prisma.establishment.update({ where: { id }, data: parsed.data });
  // Ссылки на площадки и название попадают в страницы скана.
  for (const q of project.qrcodes) invalidateScanCache(q.code).catch(() => {});

  logUserEvent(userId, "dash.api_project_updated", {
    projectId: id,
    fields: Object.keys(parsed.data),
  });

  return apiJson({ project: serializeProject(updated, userId, counts(project)) });
});
