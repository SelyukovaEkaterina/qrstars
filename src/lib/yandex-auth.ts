import { Prisma } from "@/generated/prisma/client";
import type { OAuthRegistrationAttribution } from "@/lib/registration-utm";
import prisma from "@/lib/prisma";
import {
  acceptPendingInvitesForUser,
  normalizeInviteEmail,
} from "@/lib/establishment-access";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";
import { ensureDefaultEmailContact } from "@/lib/owner-messenger-notify";
import { notifyNewUserRegistration } from "@/lib/telegram-support";

const YANDEX_REQUEST_TIMEOUT_MS = 10_000;

type YandexTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type YandexProfileResponse = {
  id?: string;
  default_email?: string;
  real_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
};

export type YandexLoginUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export class YandexAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 503
  ) {
    super(message);
    this.name = "YandexAuthError";
  }
}

export function getYandexConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.YANDEX_CLIENT_ID?.trim();
  const clientSecret = process.env.YANDEX_CLIENT_SECRET?.trim();
  const redirectUri = process.env.YANDEX_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new YandexAuthError("Вход через Яндекс временно не настроен", 503);
  }

  return { clientId, clientSecret, redirectUri };
}

async function fetchYandex(
  url: string,
  init: RequestInit,
  unavailableMessage: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YANDEX_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw new YandexAuthError(unavailableMessage, 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function getYandexProfile(code: string): Promise<{
  yandexId: string;
  email: string;
  name: string | null;
}> {
  const { clientId, clientSecret, redirectUri } = getYandexConfig();
  const oauthBase =
    process.env.YANDEX_OAUTH_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://oauth.yandex.ru";
  const loginBase =
    process.env.YANDEX_LOGIN_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://login.yandex.ru";

  const tokenResponse = await fetchYandex(
    `${oauthBase}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    },
    "Сервис Яндекс ID временно недоступен"
  );

  const token = (await tokenResponse.json().catch(() => null)) as
    | YandexTokenResponse
    | null;
  if (!tokenResponse.ok || !token?.access_token) {
    if (tokenResponse.status >= 500 || tokenResponse.status === 429) {
      throw new YandexAuthError("Сервис Яндекс ID временно недоступен", 503);
    }
    throw new YandexAuthError("Не удалось подтвердить вход через Яндекс", 401);
  }

  const profileResponse = await fetchYandex(
    `${loginBase}/info?format=json`,
    {
      headers: { Authorization: `OAuth ${token.access_token}` },
    },
    "Сервис Яндекс ID временно недоступен"
  );
  const profile = (await profileResponse.json().catch(() => null)) as
    | YandexProfileResponse
    | null;

  if (!profileResponse.ok || !profile?.id) {
    throw new YandexAuthError("Не удалось получить профиль Яндекса", 401);
  }

  const email = profile.default_email
    ? normalizeInviteEmail(profile.default_email)
    : "";
  if (!email || !email.includes("@")) {
    throw new YandexAuthError(
      "Яндекс не передал email. Разрешите доступ к email и попробуйте снова",
      401
    );
  }

  const name =
    profile.real_name?.trim() ||
    [profile.first_name?.trim(), profile.last_name?.trim()]
      .filter(Boolean)
      .join(" ") ||
    profile.display_name?.trim() ||
    null;

  return { yandexId: profile.id, email, name };
}

async function findOrCreateYandexUser(
  profile: {
    yandexId: string;
    email: string;
    name: string | null;
  },
  attribution?: OAuthRegistrationAttribution
): Promise<{ user: YandexLoginUser; created: boolean }> {
  const byYandexId = await prisma.user.findUnique({
    where: { yandexId: profile.yandexId },
  });
  if (byYandexId) {
    const emailOwner =
      byYandexId.email === profile.email
        ? byYandexId
        : await prisma.user.findUnique({ where: { email: profile.email } });
    const user = await prisma.user.update({
      where: { id: byYandexId.id },
      data: {
        ...(profile.name ? { name: profile.name } : {}),
        ...(!emailOwner || emailOwner.id === byYandexId.id
          ? { email: profile.email }
          : {}),
      },
    });
    return { user, created: false };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });
  if (byEmail) {
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        yandexId: profile.yandexId,
        ...(profile.name && !byEmail.name ? { name: profile.name } : {}),
      },
    });
    return { user, created: false };
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: profile.email,
        yandexId: profile.yandexId,
        name: profile.name,
        hashedPassword: null,
        registrationSource: "yandex_id",
        ...(attribution?.registrationUtm
          ? { registrationUtm: attribution.registrationUtm as Prisma.InputJsonValue }
          : {}),
        ...(attribution?.metrikaClientId ? { metrikaClientId: attribution.metrikaClientId } : {}),
      },
    });
    return { user, created: true };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ yandexId: profile.yandexId }, { email: profile.email }],
      },
    });
    if (!user) throw error;
    if (!user.yandexId) {
      const linked = await prisma.user.update({
        where: { id: user.id },
        data: { yandexId: profile.yandexId },
      });
      return { user: linked, created: false };
    }
    return { user, created: false };
  }
}

async function afterYandexRegistration(user: YandexLoginUser): Promise<void> {
  await ensureDefaultEmailContact(user.id, user.email);
  await acceptPendingInvitesForUser(user.id, user.email);

  void notifyNewUserRegistration({
    id: user.id,
    email: user.email,
    name: user.name,
  }).catch((error) =>
    console.error("notifyNewUserRegistration Yandex:", error)
  );
  void sendLifecycleEmail(user.id, "welcome").catch((error) =>
    console.error("sendLifecycleEmail Yandex welcome:", error)
  );
}

export async function authenticateWithYandex(
  code: string,
  attribution?: OAuthRegistrationAttribution
): Promise<YandexLoginUser> {
  const profile = await getYandexProfile(code);
  const { user, created } = await findOrCreateYandexUser(profile, attribution);
  if (created) await afterYandexRegistration(user);
  return user;
}
