import { describe, it, expect, vi, beforeEach } from "vitest";

const mockServiceDescriptor = {
  typeName: "acme.billing.v1.InvoiceQueryController",
  method: {
    get: { name: "Get" },
    list: { name: "List" },
    findByCustomer: { name: "FindByCustomer" },
  },
};

vi.mock("msw", () => ({
  http: {
    post: (url: string, resolver: Function) => ({ method: "POST", url, resolver }),
  },
  HttpResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Headers }) => ({
      type: "json",
      body,
      status: init?.status ?? 200,
      headers: init?.headers,
    }),
  },
}));

import { connectFixture } from "../connect-fixture.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connectFixture (sync)", () => {
  it("creates an MSW POST handler synchronously", () => {
    const handler = connectFixture(
      mockServiceDescriptor,
      "get",
      () => ({ id: "INV-1" }),
    );

    expect(handler.method).toBe("POST");
    expect(handler.url).toBe("*/acme.billing.v1.InvoiceQueryController/Get");
  });

  it("uses the proto method name not the JS key", () => {
    const handler = connectFixture(
      mockServiceDescriptor,
      "findByCustomer",
      () => ({ entries: [] }),
    );

    expect(handler.url).toBe(
      "*/acme.billing.v1.InvoiceQueryController/FindByCustomer",
    );
  });

  it("invokes the handler and returns JSON response", async () => {
    const handler = connectFixture(
      mockServiceDescriptor,
      "get",
      (input: unknown) => {
        expect(input).toEqual({ value: "INV-42" });
        return { id: "INV-42", amount: 250 };
      },
    );

    const mockRequest = {
      json: () => Promise.resolve({ value: "INV-42" }),
    };

    const response = await handler.resolver({ request: mockRequest });
    expect(response.body).toEqual({ id: "INV-42", amount: 250 });
    expect(response.status).toBe(200);
  });

  it("applies custom status code from options", async () => {
    const handler = connectFixture(
      mockServiceDescriptor,
      "get",
      () => null,
      { status: 404 },
    );

    const mockRequest = { json: () => Promise.resolve({}) };
    const response = await handler.resolver({ request: mockRequest });
    expect(response.status).toBe(404);
  });

  it("throws for an unknown method key", () => {
    expect(() =>
      connectFixture(mockServiceDescriptor, "nonExistent", () => ({})),
    ).toThrow(/Method "nonExistent" not found/);
  });

  it("handles unparseable JSON bodies gracefully", async () => {
    const handler = connectFixture(
      mockServiceDescriptor,
      "list",
      (input: unknown) => {
        expect(input).toBeUndefined();
        return { entries: [] };
      },
    );

    const mockRequest = {
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    };

    const response = await handler.resolver({ request: mockRequest });
    expect(response.body).toEqual({ entries: [] });
  });
});
