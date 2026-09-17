import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { htmlToText, parseBounceReason, parseImapInternalDate } from "./email-delivery";

describe("htmlToText", () => {
  it("strips tags and keeps link href", () => {
    const text = htmlToText(
      '<p>Привет</p><a href="https://app.qrstars.ru/dashboard">Кабинет</a>'
    );
    assert.match(text, /Привет/);
    assert.match(text, /Кабинет \(https:\/\/app\.qrstars\.ru\/dashboard\)/);
  });
});

describe("parseBounceReason", () => {
  it("extracts mailinator timeout", () => {
    const body = `A message that you sent could not be delivered
The following address(es) failed:
  qrstars-uj-20260917@mailinator.com
    host mail.mailinator.com [23.239.11.30]
    retry timeout exceeded
`;
    assert.equal(parseBounceReason(body), "retry timeout exceeded");
  });

  it("extracts remote SMTP error", () => {
    const body = `The following address(es) failed:
  user@mail.ru
    host mxs.mail.ru [94.100.180.31]
    SMTP error from remote mail server after end of data:
    550 Message was not accepted -- invalid mailbox. user not found
`;
    assert.match(parseBounceReason(body), /550 Message was not accepted/);
  });
});

describe("parseImapInternalDate", () => {
  it("parses IMAP INTERNALDATE", () => {
    const date = parseImapInternalDate("17-Sep-2026 13:45:44 +0300");
    assert.ok(date);
    assert.equal(date?.toISOString(), "2026-09-17T10:45:44.000Z");
  });
});
