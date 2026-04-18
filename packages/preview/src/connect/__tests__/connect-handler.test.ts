import { describe, it, expect, vi, beforeEach } from "vitest";

const mockServiceDescriptor = {
  typeName: "acme.billing.v1.InvoiceQueryController",
  method: {
    get: { name: "Get", output: { typeName: "acme.billing.v1.Invoice" } },
    list: { name: "List", output: { typeName: "acme.billing.v1.InvoiceList" } },
    findByCustomer: {
      name: "FindByCustomer",
      output: { typeName: "acme.billing.v1.InvoiceList" },
    },
  },
};

class MockHttpResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
  constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.headers = init?.headers ?? {};
  }
  json() { return JSON.parse(this.body); }
}

vi.mock("msw", () => {
  const handlers: Array<{ method: string; url: string; resolver: Function }> = [];

  return {
    http: {
      post: (url: string, resolver: Function) => {
        const handler = { method: "POST", url, resolver };
        handlers.push(handler);
        return handler;
      },
    },
    HttpResponse: MockHttpResponse,
    __handlers: handlers,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connectHandler", () => {
  it("creates an MSW POST handler with the correct URL pattern", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    const handler = await connectHandler(
      mockServiceDescriptor,
      "get",
      () => ({ id: "INV-1", amount: 100 }),
    );

    expect(handler.method).toBe("POST");
    expect(handler.url).toBe(
      "*/acme.billing.v1.InvoiceQueryController/Get",
    );
  });

  it("uses the proto method name (PascalCase) not the JS key", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    const handler = await connectHandler(
      mockServiceDescriptor,
      "findByCustomer",
      () => ({ entries: [] }),
    );

    expect(handler.url).toBe(
      "*/acme.billing.v1.InvoiceQueryController/FindByCustomer",
    );
  });

  it("invokes the handler function and returns its result as JSON", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    const invoiceData = { id: "INV-42", amount: 250 };
    const handler = await connectHandler(
      mockServiceDescriptor,
      "get",
      (input: unknown) => {
        expect(input).toEqual({ value: "INV-42" });
        return invoiceData;
      },
    );

    const mockRequest = {
      json: () => Promise.resolve({ value: "INV-42" }),
    };

    const response = await handler.resolver({ request: mockRequest });
    expect(response.json()).toEqual(invoiceData);
    expect(response.status).toBe(200);
  });

  it("supports async handler functions", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    const handler = await connectHandler(
      mockServiceDescriptor,
      "list",
      async () => ({ entries: [{ id: "INV-1" }] }),
    );

    const mockRequest = { json: () => Promise.resolve({}) };
    const response = await handler.resolver({ request: mockRequest });

    expect(response.json()).toEqual({ entries: [{ id: "INV-1" }] });
  });

  it("applies custom status code from options", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    const handler = await connectHandler(
      mockServiceDescriptor,
      "get",
      () => null,
      { status: 404 },
    );

    const mockRequest = { json: () => Promise.resolve({}) };
    const response = await handler.resolver({ request: mockRequest });

    expect(response.status).toBe(404);
  });

  it("throws for an unknown method key", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    await expect(
      connectHandler(mockServiceDescriptor, "nonExistent", () => ({})),
    ).rejects.toThrow(/Method "nonExistent" not found/);
    await expect(
      connectHandler(mockServiceDescriptor, "nonExistent", () => ({})),
    ).rejects.toThrow(/Available methods: get, list, findByCustomer/);
  });

  it("handles requests with unparseable JSON bodies gracefully", async () => {
    const { connectHandler } = await import("../connect-handler.js");

    const handler = await connectHandler(
      mockServiceDescriptor,
      "list",
      (input: unknown) => {
        expect(input).toEqual({});
        return { entries: [] };
      },
    );

    const mockRequest = {
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    };

    const response = await handler.resolver({ request: mockRequest });
    expect(response.json()).toEqual({ entries: [] });
  });
});

describe("connectHandlers", () => {
  it("creates a handler per method entry", async () => {
    const { connectHandlers } = await import("../connect-handler.js");

    const handlers = await connectHandlers(mockServiceDescriptor, {
      get: () => ({ id: "INV-1" }),
      list: () => ({ entries: [] }),
    });

    expect(handlers).toHaveLength(2);
    expect(handlers.every((h: unknown) => h != null)).toBe(true);
  });

  it("throws for unknown methods in batch", async () => {
    const { connectHandlers } = await import("../connect-handler.js");

    await expect(
      connectHandlers(mockServiceDescriptor, {
        get: () => ({}),
        bogus: () => ({}),
      }),
    ).rejects.toThrow(/Method "bogus" not found/);
  });
});
