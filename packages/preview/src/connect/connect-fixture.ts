/**
 * Synchronous Connect-RPC MSW handler builder.
 *
 * Unlike {@link connectHandler} (async, lazy-imports MSW), this function
 * uses a static `import` and returns a handler synchronously. Use this
 * when MSW is a direct dependency of your project and you need handlers
 * at module scope:
 *
 * ```ts
 * import { connectFixture } from "@scenar/preview/connect";
 *
 * const fixtures = [
 *   connectFixture(MyQueryController, "list", () => ({ entries: [] })),
 * ];
 * ```
 *
 * If MSW is only an optional peer dependency in your project, use the
 * async {@link connectHandler} instead -- it degrades gracefully when
 * MSW is not installed.
 */

import { http, HttpResponse } from "msw";
import type { ConnectFixtureHandler, ConnectHandlerOptions } from "./connect-handler.js";
import { serializeResult } from "./serialize.js";

interface ServiceDescriptor {
  readonly typeName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly method: Record<string, { readonly name: string; readonly output?: any }>;
}

/**
 * Create an MSW handler for a Connect-RPC unary method (synchronous).
 *
 * Requires `msw` as a direct dependency in your project. For projects
 * where MSW is optional, use the async `connectHandler` instead.
 *
 * @param service - A protobuf service descriptor with `typeName` and `method` map.
 * @param methodKey - The method name as it appears in the descriptor's `method` record.
 * @param handler - Receives the parsed JSON request body, returns the response payload.
 * @param options - Optional status code and headers overrides.
 */
export function connectFixture(
  service: ServiceDescriptor,
  methodKey: string,
  handler: ConnectFixtureHandler,
  options?: ConnectHandlerOptions,
) {
  const method = service.method[methodKey];
  if (!method) {
    const available = Object.keys(service.method).join(", ");
    throw new Error(
      `[scenar/preview/connect] Method "${methodKey}" not found on service ` +
      `"${service.typeName}". Available methods: ${available}`,
    );
  }

  const urlPattern = `*/${service.typeName}/${method.name}`;

  return http.post(urlPattern, async ({ request }) => {
    const body = await request.json().catch(() => undefined);
    const result = await handler(body);

    const status = options?.status ?? 200;
    const extraHeaders: Record<string, string> = {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    };

    const jsonBody = await serializeResult(result, method.output);

    return new HttpResponse(jsonBody, { status, headers: extraHeaders });
  });
}
