/**
 * Convert declarative YAML fixture definitions into MSW request handlers.
 *
 * Fixture format:
 * ```yaml
 * fixtures:
 *   - method: GET
 *     url: /api/orders
 *     status: 200
 *     body:
 *       orders:
 *         - id: ORD-123
 *           status: shipped
 * ```
 */

export interface YamlFixture {
  readonly method: string;
  readonly url: string;
  readonly status?: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

/**
 * Convert an array of declarative fixture definitions to MSW handlers.
 *
 * Lazily imports MSW — returns an empty array if MSW is not installed.
 */
export async function yamlFixturesToHandlers(
  fixtures: readonly YamlFixture[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  if (fixtures.length === 0) return [];

  try {
    const { http, HttpResponse } = await import("msw");
    return fixtures.map((fixture) => {
      const method = fixture.method.toLowerCase() as keyof typeof http;
      const handler = http[method];
      if (typeof handler !== "function") {
        throw new Error(
          `[scenar/preview] Unknown HTTP method in fixture: ${fixture.method}`,
        );
      }
      return handler(fixture.url, () => {
        const status = fixture.status ?? 200;
        const headers = fixture.headers
          ? new Headers(fixture.headers)
          : undefined;

        if (fixture.body === undefined || fixture.body === null) {
          return new HttpResponse(null, { status, headers });
        }

        return HttpResponse.json(fixture.body, { status, headers });
      });
    });
  } catch {
    console.warn(
      "[scenar/preview] msw is not installed. " +
      "YAML fixtures cannot be converted to handlers.",
    );
    return [];
  }
}
