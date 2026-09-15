import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isEmbeddedInIframe, openExternalUrl } from "./open-external";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
  } else {
    // @ts-expect-error restore missing window in node
    delete globalThis.window;
  }
});

describe("isEmbeddedInIframe", () => {
  it("is false when window is missing", () => {
    // @ts-expect-error simulate SSR
    delete globalThis.window;
    assert.equal(isEmbeddedInIframe(), false);
  });

  it("is false when the page is top-level", () => {
    const top = {} as Window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { self: top, top },
    });
    assert.equal(isEmbeddedInIframe(), false);
  });

  it("is true when the page is framed", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { self: {}, top: {} },
    });
    assert.equal(isEmbeddedInIframe(), true);
  });

  it("is true when the frame is cross-origin", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get self() {
          return {};
        },
        get top() {
          throw new Error("blocked");
        },
      },
    });
    assert.equal(isEmbeddedInIframe(), true);
  });
});

describe("openExternalUrl", () => {
  it("assigns location when top-level", () => {
    const assigned: string[] = [];
    const top = {
      location: { assign: (url: string) => assigned.push(url) },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        self: top,
        top,
        location: top.location,
        open: () => {
          throw new Error("should not open a tab");
        },
      },
    });
    assert.deepEqual(openExternalUrl("https://yandex.ru/maps/"), { openedInNewTab: false });
    assert.deepEqual(assigned, ["https://yandex.ru/maps/"]);
  });

  it("replaces location when asked", () => {
    const replaced: string[] = [];
    const top = {
      location: {
        assign: () => {
          throw new Error("should replace");
        },
        replace: (url: string) => replaced.push(url),
      },
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { self: top, top, location: top.location, open: () => null },
    });
    assert.deepEqual(openExternalUrl("https://yandex.ru/maps/", { history: "replace" }), {
      openedInNewTab: false,
    });
    assert.deepEqual(replaced, ["https://yandex.ru/maps/"]);
  });

  it("opens a new tab when framed", () => {
    const opened: Array<[string, string, string]> = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        self: {},
        top: {},
        location: {
          assign: () => {
            throw new Error("should not assign in iframe");
          },
        },
        open: (url: string, target: string, features: string) => {
          opened.push([url, target, features]);
          return {};
        },
      },
    });
    assert.deepEqual(openExternalUrl("https://yandex.ru/maps/"), { openedInNewTab: true });
    assert.deepEqual(opened, [["https://yandex.ru/maps/", "_blank", "noopener,noreferrer"]]);
  });
});
