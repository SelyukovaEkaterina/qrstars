import { connect } from "node:tls";

export type EmailKind = "complaint" | "test" | "welcome" | "lifecycle" | "other";
export type EmailDeliveryStatus = "accepted" | "bounced" | "failed";

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseBounceReason(body: string): string {
  const compact = body.replace(/\r/g, "");
  const failedBlock = compact.match(
    /The following address\(es\) failed:([\s\S]{0,800})/i
  );
  const slice = failedBlock ? failedBlock[1] : compact;
  const smtpErr = slice.match(/SMTP error from remote mail server[\s\S]{0,400}/i);
  if (smtpErr) {
    return smtpErr[0].replace(/\s+/g, " ").trim().slice(0, 400);
  }
  if (/retry timeout exceeded/i.test(slice)) {
    return "retry timeout exceeded";
  }
  if (/Unrouteable address/i.test(slice)) {
    return "Unrouteable address";
  }
  if (/user not found/i.test(slice)) {
    return "user not found";
  }
  const first = slice
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return (first || "delivery failed").slice(0, 400);
}

export function parseImapInternalDate(value: string): Date | null {
  const match = value.match(
    /(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/
  );
  if (!match) return null;
  const [, d, mon, y, hh, mm, ss, tz] = match;
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const month = months[mon];
  if (!month) return null;
  const tzColon = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  return new Date(`${y}-${month}-${d.padStart(2, "0")}T${hh}:${mm}:${ss}${tzColon}`);
}

export async function recordEmailDelivery(opts: {
  to: string;
  status: EmailDeliveryStatus;
  kind?: EmailKind;
  error?: string | null;
  messageId?: string | null;
}): Promise<void> {
  const to = opts.to.trim().toLowerCase();
  if (!to.includes("@")) return;
  try {
    const { default: prisma } = await import("@/lib/prisma");
    await prisma.messengerContact.updateMany({
      where: { provider: "EMAIL", externalId: to },
      data: {
        lastEmailStatus: opts.status,
        lastEmailAt: new Date(),
        lastEmailError: opts.error ?? null,
        lastEmailKind: opts.kind ?? null,
        lastEmailMessageId: opts.messageId ?? null,
      },
    });
  } catch (error) {
    console.error("recordEmailDelivery failed", { to, error });
  }
}

export function imapHost(): string | null {
  if (process.env.E2E_TESTING === "true") return null;
  if (process.env.IMAP_HOST) return process.env.IMAP_HOST;
  const smtp = process.env.SMTP_HOST || "";
  if (smtp.includes("beget")) return "imap.beget.com";
  return null;
}

function imapQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function withImap<T>(fn: (send: (cmd: string) => Promise<string>) => Promise<T>): Promise<T | null> {
  const host = imapHost();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 993, servername: host });
    let buf = "";
    let greetingDone = false;
    let started = false;
    let pending: { tag: string; resolve: (s: string) => void; reject: (e: Error) => void } | null =
      null;
    let seq = 0;

    const flushPending = () => {
      if (!pending) return;
      const tagged = buf.split(/\r?\n/).find((l) => l.startsWith(`${pending!.tag} `));
      if (!tagged) return;
      const out = buf;
      buf = "";
      const { resolve: res, reject: rej, tag } = pending;
      pending = null;
      if (tagged.startsWith(`${tag} NO `) || tagged.startsWith(`${tag} BAD `)) {
        rej(new Error(tagged));
      } else {
        res(out);
      }
    };

    const send = (cmd: string) =>
      new Promise<string>((res, rej) => {
        seq += 1;
        const tag = `A${seq}`;
        pending = { tag, resolve: res, reject: rej };
        socket.write(`${tag} ${cmd}\r\n`);
      });

    const run = async () => {
      if (started) return;
      started = true;
      try {
        const result = await fn(send);
        try {
          await send("LOGOUT");
        } catch {
          /* ignore */
        }
        socket.end();
        resolve(result);
      } catch (e) {
        socket.destroy();
        reject(e);
      }
    };

    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      if (!greetingDone) {
        if (/\* OK /i.test(buf)) {
          greetingDone = true;
          buf = "";
          void run();
        }
        return;
      }
      flushPending();
    });

    socket.on("error", reject);
    socket.setTimeout(12_000, () => {
      socket.destroy();
      reject(new Error("IMAP timeout"));
    });
  });
}

export async function findRecentBounce(
  to: string,
  maxAgeMs = 15 * 60_000
): Promise<string | null> {
  const address = to.trim().toLowerCase();
  if (!address.includes("@")) return null;

  try {
    return await withImap(async (send) => {
      await send(
        `LOGIN ${imapQuoted(process.env.SMTP_USER || "")} ${imapQuoted(process.env.SMTP_PASS || "")}`
      );
      await send("SELECT INBOX");
      const search = await send(`SEARCH TEXT ${imapQuoted(address)}`);
      const ids = (search.match(/\* SEARCH([^\r\n]*)/)?.[1] || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(-8);
      if (ids.length === 0) return null;

      const cutoff = Date.now() - maxAgeMs;
      for (const id of ids.reverse()) {
        const fetched = await send(`FETCH ${id} (INTERNALDATE BODY.PEEK[TEXT])`);
        if (!/delivery failed|address\(es\) failed|Mailer-Daemon/i.test(fetched)) continue;
        if (!fetched.toLowerCase().includes(address)) continue;
        const dateRaw = fetched.match(/INTERNALDATE "([^"]+)"/i)?.[1];
        const date = dateRaw ? parseImapInternalDate(dateRaw) : null;
        if (date && date.getTime() < cutoff) continue;
        return parseBounceReason(fetched);
      }
      return null;
    });
  } catch (error) {
    console.error("findRecentBounce failed", { to: address, error });
    return null;
  }
}

export async function waitForSmtpBounce(
  to: string,
  timeoutMs = 8_000
): Promise<string | null> {
  if (!imapHost()) return null;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const reason = await findRecentBounce(to, timeoutMs + 30_000);
    if (reason) return reason;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return findRecentBounce(to, timeoutMs + 30_000);
}

export function scheduleBounceCheck(to: string, kind?: EmailKind): void {
  if (!imapHost()) return;
  void (async () => {
    const reason = await waitForSmtpBounce(to, 12_000);
    if (!reason) return;
    console.error("Email bounced", { to, kind, reason });
    await recordEmailDelivery({ to, status: "bounced", kind, error: reason });
  })().catch((error) => console.error("scheduleBounceCheck failed", { to, error }));
}
