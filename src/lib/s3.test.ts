import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAbsolutePublicUrl } from "./s3";

const KEY = "/storage/support/ticket/123-abc.jpg";

describe("getAbsolutePublicUrl", () => {
  it("keeps an already absolute URL untouched", () => {
    const absolute = "https://s3.qrstars.ru/support/ticket/123-abc.jpg";
    assert.equal(getAbsolutePublicUrl(absolute), absolute);
  });

  it("prefixes a relative storage path with the app base URL", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.qrstars.ru";
    assert.equal(getAbsolutePublicUrl(KEY), `https://app.qrstars.ru${KEY}`);
  });

  it("does not double the slash when the base URL ends with one", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.qrstars.ru/";
    assert.equal(getAbsolutePublicUrl(KEY), `https://app.qrstars.ru${KEY}`);
  });

  it("adds a slash for a key without a leading one", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.qrstars.ru";
    assert.equal(
      getAbsolutePublicUrl("storage/x.png"),
      "https://app.qrstars.ru/storage/x.png"
    );
  });

  it("falls back to the production domain without env", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXTAUTH_URL;
    assert.equal(getAbsolutePublicUrl(KEY), `https://app.qrstars.ru${KEY}`);
  });
});
