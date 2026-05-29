import type { MenuData } from "@/components/dashboard/MenuEditor";

export type IikoMenuConfig = {
  apiLogin: string;
  organizationId: string;
  externalMenuId: string;
  priceCategoryId?: string | null;
  terminalGroupId?: string | null;
  paymentTypeId?: string | null;
  orderTypePickupId?: string | null;
  orderTypeDeliveryId?: string | null;
  hiddenCategoryIds?: string[];
};

export type IikoOrganization = { id: string; name: string };

export type IikoExternalMenu = { id: string; name: string };

export type IikoTerminal = { id: string; name: string; organizationId: string };

export type IikoPaymentType = {
  id: string;
  code: string | null;
  name: string;
  paymentTypeKind: string;
};

export type IikoOrderType = {
  id: string;
  name: string;
  orderServiceType: string;
};

export type IikoDiscoverResult = {
  organizations: IikoOrganization[];
  externalMenus: IikoExternalMenu[];
  terminals: IikoTerminal[];
  paymentTypes: IikoPaymentType[];
  orderTypes: IikoOrderType[];
  suggested: {
    organizationId: string | null;
    externalMenuId: string | null;
    terminalGroupId: string | null;
    paymentTypeId: string | null;
    orderTypePickupId: string | null;
    orderTypeDeliveryId: string | null;
    priceCategoryId: string | null;
  };
};

export type IikoMenuProductIndex = Map<
  string,
  { name: string; price: number | null; iikoProductId: string; iikoSizeId: string | null }
>;

export type ResolvedIikoMenu = MenuData & {
  source?: "MANUAL" | "IIKO";
  _iikoProductIndex?: IikoMenuProductIndex;
};

export type IikoOrderFulfillment = "pickup" | "delivery";

export type IikoOrderLineInput = {
  iikoProductId: string;
  iikoSizeId?: string | null;
  name: string;
  price: string | null;
  qty: number;
};
