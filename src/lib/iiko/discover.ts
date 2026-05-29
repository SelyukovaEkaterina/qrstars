import { getAccessToken, iikoPost } from "@/lib/iiko/client";
import type {
  IikoDiscoverResult,
  IikoExternalMenu,
  IikoOrderType,
  IikoOrganization,
  IikoPaymentType,
  IikoTerminal,
} from "@/lib/iiko/types";

const SITE_MENU_NAMES = ["сайт/приложение", "сайт", "site"];
const PICKUP_NAMES = ["доставка самовывоз", "самовывоз"];
const DELIVERY_NAMES = ["доставка сайт"];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function matchName(name: string, candidates: string[]): boolean {
  const n = norm(name);
  return candidates.some((c) => n === c || n.includes(c));
}

type OrgsResponse = {
  organizations?: { id?: string; name?: string }[];
};

type MenusResponse = {
  externalMenus?: { id?: string | number; name?: string }[];
  priceCategories?: { id?: string; name?: string }[];
};

type TerminalGroupsResponse = {
  terminalGroups?: {
    organizationId?: string;
    items?: { id?: string; name?: string; organizationId?: string }[];
  }[];
};

type PaymentTypesResponse = {
  paymentTypes?: {
    id?: string;
    code?: string;
    name?: string;
    paymentTypeKind?: string;
  }[];
};

type OrderTypesResponse = {
  orderTypes?: {
    organizationId?: string;
    items?: {
      id?: string;
      name?: string;
      orderServiceType?: string;
      isDeleted?: boolean;
    }[];
  }[];
};

export async function discoverIiko(apiLogin: string): Promise<IikoDiscoverResult> {
  const token = await getAccessToken(apiLogin);

  const orgsData = await iikoPost<OrgsResponse>(
    "/api/1/organizations",
    { organizationIds: null, returnAdditionalInfo: false, includeDisabled: false },
    token
  );
  const organizations: IikoOrganization[] = (orgsData.organizations ?? [])
    .filter((o) => o.id && o.name)
    .map((o) => ({ id: o.id!, name: o.name! }));

  const orgIds = organizations.map((o) => o.id);
  const primaryOrgId = orgIds[0] ?? null;

  const menusData = await iikoPost<MenusResponse>("/api/2/menu", {}, token);
  const externalMenus: IikoExternalMenu[] = (menusData.externalMenus ?? []).map((m) => ({
    id: String(m.id),
    name: m.name ?? String(m.id),
  }));

  let terminals: IikoTerminal[] = [];
  let paymentTypes: IikoPaymentType[] = [];
  let orderTypes: IikoOrderType[] = [];

  if (orgIds.length > 0) {
    const [tgData, ptData, otData] = await Promise.all([
      iikoPost<TerminalGroupsResponse>(
        "/api/1/terminal_groups",
        { organizationIds: orgIds },
        token
      ),
      iikoPost<PaymentTypesResponse>(
        "/api/1/payment_types",
        { organizationIds: orgIds },
        token
      ),
      iikoPost<OrderTypesResponse>(
        "/api/1/deliveries/order_types",
        { organizationIds: orgIds },
        token
      ),
    ]);

    for (const block of tgData.terminalGroups ?? []) {
      for (const t of block.items ?? []) {
        if (t.id) {
          terminals.push({
            id: t.id,
            name: t.name ?? t.id,
            organizationId: t.organizationId ?? block.organizationId ?? primaryOrgId ?? "",
          });
        }
      }
    }

    paymentTypes = (ptData.paymentTypes ?? [])
      .filter((p) => p.id)
      .map((p) => ({
        id: p.id!,
        code: p.code ?? null,
        name: p.name ?? p.id!,
        paymentTypeKind: p.paymentTypeKind ?? "Card",
      }));

    for (const block of otData.orderTypes ?? []) {
      for (const o of block.items ?? []) {
        if (o.id && !o.isDeleted) {
          orderTypes.push({
            id: o.id,
            name: o.name ?? o.id,
            orderServiceType: o.orderServiceType ?? "",
          });
        }
      }
    }
  }

  const suggestedMenu =
    externalMenus.find((m) => norm(m.name).includes("сайт")) ??
    externalMenus[0] ??
    null;

  const sitePayment =
    paymentTypes.find((p) => norm(p.code ?? "") === "site") ?? paymentTypes[0] ?? null;

  const pickupType =
    orderTypes.find((o) => matchName(o.name, PICKUP_NAMES)) ??
    orderTypes.find((o) => o.orderServiceType === "DeliveryPickUp") ??
    null;

  const deliveryType =
    orderTypes.find((o) => matchName(o.name, DELIVERY_NAMES)) ??
    orderTypes.find((o) => o.orderServiceType === "DeliveryByCourier") ??
    null;

  const orgTerminals = primaryOrgId
    ? terminals.filter((t) => t.organizationId === primaryOrgId)
    : terminals;

  return {
    organizations,
    externalMenus,
    terminals,
    paymentTypes,
    orderTypes,
    suggested: {
      organizationId: primaryOrgId,
      externalMenuId: suggestedMenu?.id ?? null,
      terminalGroupId: orgTerminals[0]?.id ?? terminals[0]?.id ?? null,
      paymentTypeId: sitePayment?.id ?? null,
      orderTypePickupId: pickupType?.id ?? null,
      orderTypeDeliveryId: deliveryType?.id ?? null,
      priceCategoryId: null,
    },
  };
}
