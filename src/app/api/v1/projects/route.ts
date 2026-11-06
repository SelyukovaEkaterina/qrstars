import prisma from "@/lib/prisma";
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
import {
  canAddEstablishment,
  effectivePlan,
  findActiveSubscription,
  getUpgradeHint,
} from "@/lib/subscription-utils";
import { logUserEvent } from "@/lib/user-events-server";

export const OPTIONS = apiOptions;

export const GET = withApiAuth(async (_request, { userId }) => {
  const projects = await prisma.establishment.findMany({
    where: establishmentAccessWhere(userId),
    include: {
      _count: { select: { qrcodes: true, reviews: true } },
      qrcodes: { select: { scansCount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiJson({
    projects: projects.map((p) =>
      serializeProject(p, userId, {
        qrcodes: p._count.qrcodes,
        reviews: p._count.reviews,
        totalScans: p.qrcodes.reduce((sum, q) => sum + q.scansCount, 0),
      })
    ),
  });
});

export const POST = withApiAuth(async (request, { userId }) => {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "invalid_request", "Тело запроса — JSON-объект");

  const parsed = parseProjectInput(body, { requireName: true });
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);

  const existingCount = await prisma.establishment.count({ where: { userId } });
  const plan = effectivePlan(await findActiveSubscription(userId));
  if (!canAddEstablishment(plan, existingCount)) {
    const hint = getUpgradeHint(plan, existingCount);
    return apiError(
      403,
      "upgrade_required",
      hint?.message || "Достигнут лимит проектов на текущем тарифе",
      { requiredPlan: hint?.requiredPlan ?? null }
    );
  }

  const { name, ...rest } = parsed.data;
  const project = await prisma.establishment.create({
    data: { name: name!, ...rest, user: { connect: { id: userId } } },
  });

  logUserEvent(userId, "dash.api_project_created", { projectId: project.id });

  return apiJson(
    { project: serializeProject(project, userId, { qrcodes: 0, reviews: 0, totalScans: 0 }) },
    { status: 201 }
  );
});
