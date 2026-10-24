import { Prisma } from "@/generated/prisma/client";
import { findReferrerId } from "@/lib/referral";
import type { OAuthRegistrationAttribution } from "@/lib/registration-utm";
import prisma from "@/lib/prisma";
import {
  acceptPendingInvitesForUser,
  normalizeInviteEmail,
} from "@/lib/establishment-access";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";
import { ensureDefaultEmailContact } from "@/lib/owner-messenger-notify";
import { notifyNewUserRegistration } from "@/lib/telegram-support";

const VK_REQUEST_TIMEOUT_MS = 10_000;

type VkTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  error?: string;
  error_description?: string;
};

type VkUserInfoResponse = {
  user?: {
    user_id?: number | string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  error?: string;
  error_description?: string;
};

export type VkLoginInput = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  state?: string;
};

export type VkLoginUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export class VkAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 503
  ) {
    super(message);
    this.name = "VkAuthError";
  }
}

function requiredServerConfig(): {
  clientId: string;
  redirectUri: string;
  serviceToken: string | null;
} {
  const clientId = process.env.VK_CLIENT_ID?.trim();
  const redirectUri = process.env.VK_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    throw new VkAuthError("Вход через VK временно не настроен", 503);
  }

  return {
    clientId,
    redirectUri,
    serviceToken: process.env.VK_SERVICE_TOKEN?.trim() || null,
  };
}

async function postVk<T>(path: string, body: URLSearchParams): Promise<T> {
  const apiBaseUrl =
    process.env.VK_API_BASE_URL?.trim().replace(/\/+$/, "") || "https://id.vk.ru";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VK_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    let data: T & { error?: string; error_description?: string };
    try {
      data = (await response.json()) as T & {
        error?: string;
        error_description?: string;
      };
    } catch {
      throw new VkAuthError("Сервис VK ID временно недоступен", 503);
    }

    if (!response.ok || data.error) {
      if (response.status >= 500 || response.status === 429) {
        throw new VkAuthError("Сервис VK ID временно недоступен", 503);
      }
      throw new VkAuthError("Не удалось подтвердить вход через VK", 401);
    }

    return data;
  } catch (error) {
    if (error instanceof VkAuthError) throw error;
    throw new VkAuthError("Сервис VK ID временно недоступен", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function getVkProfile(input: VkLoginInput): Promise<{
  vkId: string;
  email: string;
  name: string | null;
}> {
  const { clientId, redirectUri, serviceToken } = requiredServerConfig();
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.codeVerifier,
    client_id: clientId,
    device_id: input.deviceId,
    redirect_uri: redirectUri,
  });
  if (input.state) tokenBody.set("state", input.state);
  if (serviceToken) tokenBody.set("service_token", serviceToken);

  const token = await postVk<VkTokenResponse>("/oauth2/auth", tokenBody);
  if (!token.access_token || token.user_id === undefined) {
    throw new VkAuthError("VK ID вернул неполные данные авторизации", 401);
  }

  const profile = await postVk<VkUserInfoResponse>(
    "/oauth2/user_info",
    new URLSearchParams({
      client_id: clientId,
      access_token: token.access_token,
    })
  );

  const user = profile.user;
  if (!user?.user_id || String(user.user_id) !== String(token.user_id)) {
    throw new VkAuthError("Не удалось подтвердить пользователя VK", 401);
  }

  const email = user.email ? normalizeInviteEmail(user.email) : "";
  if (!email || !email.includes("@")) {
    throw new VkAuthError(
      "VK не передал email. Разрешите доступ к email и попробуйте снова",
      401
    );
  }

  const name =
    [user.first_name?.trim(), user.last_name?.trim()].filter(Boolean).join(" ") ||
    null;

  return { vkId: String(user.user_id), email, name };
}

async function findOrCreateVkUser(
  profile: {
    vkId: string;
    email: string;
    name: string | null;
  },
  attribution?: OAuthRegistrationAttribution
): Promise<{ user: VkLoginUser; created: boolean }> {
  const byVkId = await prisma.user.findUnique({ where: { vkId: profile.vkId } });
  if (byVkId) {
    const emailOwner =
      byVkId.email === profile.email
        ? byVkId
        : await prisma.user.findUnique({ where: { email: profile.email } });
    const user = await prisma.user.update({
      where: { id: byVkId.id },
      data: {
        ...(profile.name ? { name: profile.name } : {}),
        ...(!emailOwner || emailOwner.id === byVkId.id
          ? { email: profile.email }
          : {}),
      },
    });
    return { user, created: false };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        vkId: profile.vkId,
        ...(profile.name && !byEmail.name ? { name: profile.name } : {}),
      },
    });
    return { user, created: false };
  }

  const referredById = await findReferrerId(attribution?.referralCode, profile.email);

  try {
    const user = await prisma.user.create({
      data: {
        email: profile.email,
        vkId: profile.vkId,
        name: profile.name,
        hashedPassword: null,
        registrationSource: "vk_id",
        ...(attribution?.registrationUtm
          ? { registrationUtm: attribution.registrationUtm as Prisma.InputJsonValue }
          : {}),
        ...(attribution?.metrikaClientId ? { metrikaClientId: attribution.metrikaClientId } : {}),
        ...(referredById ? { referredBy: { connect: { id: referredById } } } : {}),
      },
    });
    return { user, created: true };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ vkId: profile.vkId }, { email: profile.email }],
      },
    });
    if (!user) throw error;
    if (!user.vkId) {
      const linked = await prisma.user.update({
        where: { id: user.id },
        data: { vkId: profile.vkId },
      });
      return { user: linked, created: false };
    }
    return { user, created: false };
  }
}

async function afterVkRegistration(user: VkLoginUser): Promise<void> {
  await ensureDefaultEmailContact(user.id, user.email);
  await acceptPendingInvitesForUser(user.id, user.email);

  void notifyNewUserRegistration({
    id: user.id,
    email: user.email,
    name: user.name,
  }).catch((error) => console.error("notifyNewUserRegistration VK:", error));
  void sendLifecycleEmail(user.id, "welcome").catch((error) =>
    console.error("sendLifecycleEmail VK welcome:", error)
  );
}

export async function authenticateWithVk(
  input: VkLoginInput,
  attribution?: OAuthRegistrationAttribution
): Promise<VkLoginUser> {
  const profile = await getVkProfile(input);
  const { user, created } = await findOrCreateVkUser(profile, attribution);
  if (created) await afterVkRegistration(user);
  return user;
}
