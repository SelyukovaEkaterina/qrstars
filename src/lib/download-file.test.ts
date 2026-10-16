import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { downloadBlob, isIosDevice } from "./download-file";

type FakeNode = {
  id?: string;
  tag: string;
  href?: string;
  download?: string;
  rel?: string;
  src?: string;
  alt?: string;
  type?: string;
  textContent: string;
  style: Record<string, string>;
  children: FakeNode[];
  parent?: FakeNode;
  listeners: Record<string, (event?: { target?: FakeNode }) => void>;
  setAttribute: (key: string, value: string) => void;
  appendChild: (child: FakeNode) => FakeNode;
  append: (...children: FakeNode[]) => void;
  addEventListener: (type: string, fn: (event?: { target?: FakeNode }) => void) => void;
  remove: () => void;
  click: () => void;
};

const originalNavigator = globalThis.navigator;
const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;

function createNode(tag: string): FakeNode {
  const node: FakeNode = {
    tag,
    textContent: "",
    style: {},
    children: [],
    listeners: {},
    setAttribute(key, value) {
      if (key === "id") node.id = value;
    },
    appendChild(child) {
      child.parent = node;
      node.children.push(child);
      return child;
    },
    append(...children) {
      for (const child of children) node.appendChild(child);
    },
    addEventListener(type, fn) {
      node.listeners[type] = fn;
    },
    remove() {
      const parent = node.parent;
      if (!parent) return;
      parent.children = parent.children.filter((child) => child !== node);
    },
    click() {
      node.listeners.click?.();
    },
  };
  return node;
}

function findById(node: FakeNode, id: string): FakeNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function installDocument() {
  const body = createNode("body");
  const documentStub = {
    body,
    createElement: (tag: string) => createNode(tag),
    getElementById: (id: string) => findById(body, id),
    documentElement: { clientWidth: 390 },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentStub,
  });
  return body;
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  });
  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    value: originalUrl,
  });
});

function setNavigator(value: Navigator) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

describe("isIosDevice", () => {
  it("recognizes an iPhone", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15",
      platform: "iPhone",
      maxTouchPoints: 5,
    } as Navigator);
    assert.equal(isIosDevice(), true);
  });

  it("does not treat a desktop Mac as iOS", () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 0,
    } as Navigator);
    assert.equal(isIosDevice(), false);
  });
});

describe("downloadBlob", () => {
  it("downloads through a link on desktop", async () => {
    const body = installDocument();
    const seen: FakeNode[] = [];
    body.appendChild = (child) => {
      seen.push(child);
      child.parent = body;
      body.children.push(child);
      return child;
    };
    const revoked: string[] = [];
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: {
        createObjectURL: () => "blob:qr",
        revokeObjectURL: (url: string) => revoked.push(url),
      },
    });
    setNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 0,
    } as Navigator);

    await downloadBlob(new Blob(["png"], { type: "image/png" }), "qr-t2fjsu.png");

    const link = seen.find((child) => child.tag === "a");
    assert.equal(link?.href, "blob:qr");
    assert.equal(link?.download, "qr-t2fjsu.png");
    assert.equal(body.children.includes(link!), false);
  });

  it("opens the iOS share sheet instead of a data link", async () => {
    const body = installDocument();
    let shared: ShareData | null = null;
    setNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
      canShare: () => true,
      share: async (data: ShareData) => {
        shared = data;
      },
    } as unknown as Navigator);

    await downloadBlob(new Blob(["png"], { type: "image/png" }), "qr-t2fjsu.png");

    assert.equal(shared?.files?.length, 1);
    assert.equal(shared?.files?.[0]?.name, "qr-t2fjsu.png");
    assert.equal(body.children.length, 0);
  });

  it("keeps a picture on screen when iOS rejects the share gesture", async () => {
    const body = installDocument();
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: {
        createObjectURL: () => "blob:sheet",
        revokeObjectURL: () => undefined,
      },
    });
    setNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
      canShare: () => false,
    } as unknown as Navigator);

    await downloadBlob(new Blob(["png"], { type: "image/png" }), "qr-t2fjsu.png");

    const sheet = body.children.find((child) => child.id === "qr-file-save-sheet");
    assert.ok(sheet);
    const image = sheet.children[0]?.children.find((child) => child.tag === "img");
    assert.equal(image?.src, "blob:sheet");
    assert.equal(image?.alt, "qr-t2fjsu.png");
  });
});
